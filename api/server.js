/**
 * 2OpenClaw Provisioning API
 * Handles creating, managing, and monitoring OpenClaw containers
 *
 * IMPORTANT: This API creates OpenClaw instances with the correct config format.
 * See /docs/LESSONS_LEARNED.md for details on the config schema.
 */

require('dotenv').config();

const express = require('express');
const { exec, spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// Middleware imports
const { validateProvisionInput, validateConfigUpdate } = require('./middleware/validation');
const { provisionLimiter, apiLimiter, adminLimiter, webhookLimiter } = require('./middleware/rateLimit');

// Service imports
const { runCleanup, resetWarning, loadInstances, saveInstances } = require('./services/cleanup');
const { selectBestVM, checkCapacity, getAllVMStatuses } = require('./services/vmSelector');

const app = express();
app.use(express.json());

// Trust proxy for correct IP detection behind load balancers
app.set('trust proxy', 1);

// Config
const PORT = process.env.PORT || 3000;
const API_SECRET = process.env.API_SECRET || 'change-me-in-production';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DATA_DIR = '/opt/2openclaw/data';
const CADDY_FILE = '/etc/caddy/Caddyfile';
const BASE_PORT = 18001;

// Get external IP
let EXTERNAL_IP = '';
exec('curl -s ifconfig.me', (err, stdout) => {
    EXTERNAL_IP = stdout.trim();
    console.log(`External IP: ${EXTERNAL_IP}`);
});

// Middleware: Auth check for regular API
const authMiddleware = (req, res, next) => {
    const token = req.headers['x-api-key'];
    if (token !== API_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Middleware: Admin authentication (uses Bearer token)
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (token !== API_SECRET) {
        return res.status(401).json({ error: 'Unauthorized - Admin access required' });
    }
    next();
};

// Helper: Run shell command
const runCommand = (cmd) => {
    return new Promise((resolve, reject) => {
        exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                reject({ error: error.message, stderr });
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
};

// Helper: Get next available port
const getNextPort = async () => {
    try {
        const data = await fs.readFile(path.join(DATA_DIR, 'ports.json'), 'utf8');
        const ports = JSON.parse(data);
        const maxPort = Math.max(...Object.values(ports), BASE_PORT - 1);
        return maxPort + 1;
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(path.join(DATA_DIR, 'ports.json'), '{}');
        return BASE_PORT;
    }
};

// Helper: Save port mapping
const savePort = async (userId, port) => {
    const portsFile = path.join(DATA_DIR, 'ports.json');
    let ports = {};
    try {
        const data = await fs.readFile(portsFile, 'utf8');
        ports = JSON.parse(data);
    } catch {}
    ports[userId] = port;
    await fs.writeFile(portsFile, JSON.stringify(ports, null, 2));
};

// Helper: Get user's port
const getUserPort = async (userId) => {
    try {
        const data = await fs.readFile(path.join(DATA_DIR, 'ports.json'), 'utf8');
        const ports = JSON.parse(data);
        return ports[userId];
    } catch {
        return null;
    }
};

// Helper: Add Caddy route
const addCaddyRoute = async (userId, port) => {
    const subdomain = `${userId}.${EXTERNAL_IP}.nip.io`;
    const routeBlock = `
${subdomain} {
    reverse_proxy localhost:${port}
}
`;
    
    // Append to Caddyfile
    await fs.appendFile(CADDY_FILE, routeBlock);
    
    // Reload Caddy (not restart - requires admin endpoint enabled)
    await runCommand('systemctl reload caddy');
    
    return subdomain;
};

/**
 * Create OpenClaw config with CORRECT schema
 * 
 * CRITICAL LESSONS LEARNED:
 * 1. API keys go under env.vars, NOT providers
 * 2. Telegram uses botToken, NOT token
 * 3. channels.telegram.enabled AND plugins.entries.telegram.enabled must BOTH be true
 * 4. gateway.mode must be "local"
 * 5. gateway.auth needs mode + token (object format)
 * 6. agents.defaults.model.primary (object with primary key, not string)
 * 7. Config file goes at /home/node/.openclaw/openclaw.json (root, not config subfolder)
 */
const createConfig = (telegramToken, aiProvider, apiKey, ownerIds, gatewayToken) => {
    const config = {
        env: {
            vars: {}
        },
        agents: {
            defaults: {
                model: {
                    primary: 'anthropic/claude-sonnet-4-5'  // Default to Claude
                }
            }
        },
        channels: {
            telegram: {
                enabled: true,
                botToken: telegramToken
            }
        },
        gateway: {
            mode: 'local',
            port: 18789,
            auth: {
                mode: 'token',
                token: gatewayToken || crypto.randomBytes(16).toString('hex')
            }
        },
        plugins: {
            entries: {
                telegram: {
                    enabled: true
                }
            }
        }
    };
    
    // Set AI provider API key and model
    if (aiProvider === 'gemini' || aiProvider === 'google') {
        const geminiKey = apiKey || GEMINI_API_KEY;
        if (geminiKey) {
            config.env.vars.GEMINI_API_KEY = geminiKey;
            // Gemini 2.0 Flash - fast and has 1M TPM free tier!
            config.agents.defaults.model.primary = 'google/gemini-2.0-flash';
        }
    } else if (aiProvider === 'groq') {
        const groqKey = apiKey || GROQ_API_KEY;
        if (groqKey) {
            config.env.vars.GROQ_API_KEY = groqKey;
            config.agents.defaults.model.primary = 'groq/gemma2-9b-it';
        }
    } else if (aiProvider === 'anthropic' && apiKey) {
        config.env.vars.ANTHROPIC_API_KEY = apiKey;
        config.agents.defaults.model.primary = 'anthropic/claude-sonnet-4-5';
    } else if (aiProvider === 'openai' && apiKey) {
        config.env.vars.OPENAI_API_KEY = apiKey;
        config.agents.defaults.model.primary = 'openai/gpt-4o';
    } else if (aiProvider === 'openrouter' && apiKey) {
        config.env.vars.OPENROUTER_API_KEY = apiKey;
        // Use free model - Gemini 2.0 Flash (free via OpenRouter)
        config.agents.defaults.model.primary = 'anthropic/claude-sonnet-4-5';
    } else if (GEMINI_API_KEY) {
        // Default: Gemini free tier (1M TPM - much better than Groq's 12K!)
        config.env.vars.GEMINI_API_KEY = GEMINI_API_KEY;
        config.agents.defaults.model.primary = 'google/gemini-2.0-flash';
    } else if (GROQ_API_KEY) {
        // Fallback to Groq
        config.env.vars.GROQ_API_KEY = GROQ_API_KEY;
        config.agents.defaults.model.primary = 'groq/gemma2-9b-it';
    }
    
    // Set owner IDs for DM allowlist
    if (ownerIds && ownerIds.length > 0) {
        config.channels.telegram.allowFrom = ownerIds.map(String);
        config.channels.telegram.dmPolicy = 'allowlist';
    }
    
    return config;
};

// ==================== ROUTES ====================

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// List all instances
app.get('/instances', authMiddleware, async (req, res) => {
    try {
        const { stdout } = await runCommand('docker ps -a --filter "name=openclaw-" --format "{{.Names}},{{.Status}},{{.Ports}}"');
        const instances = stdout.trim().split('\n').filter(Boolean).map(line => {
            const [name, status, ports] = line.split(',');
            const userId = name.replace('openclaw-', '');
            return { userId, name, status, ports };
        });
        res.json({ instances });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get instance status
app.get('/instances/:userId', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    const containerName = `openclaw-${userId}`;
    
    try {
        const { stdout } = await runCommand(`docker inspect ${containerName} --format '{{.State.Status}},{{.State.StartedAt}}'`);
        const [status, startedAt] = stdout.trim().split(',');
        const port = await getUserPort(userId);
        const subdomain = port ? `${userId}.${EXTERNAL_IP}.nip.io` : null;
        
        // Try to read user data for plan info
        let plan = 'free';
        try {
            const userData = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'users', `${userId}.json`), 'utf8'));
            plan = userData.plan || 'free';
        } catch {}
        
        res.json({ userId, status, startedAt, port, subdomain, url: subdomain ? `https://${subdomain}` : null, plan });
    } catch (error) {
        res.status(404).json({ error: 'Instance not found' });
    }
});

// Provision new instance (with rate limiting and validation)
app.post('/provision', provisionLimiter, authMiddleware, validateProvisionInput, async (req, res) => {
    const { userId, telegramToken, aiProvider, apiKey, ownerIds, plan } = req.body;
    
    if (!userId || !telegramToken) {
        return res.status(400).json({ error: 'userId and telegramToken are required' });
    }
    
    const containerName = `openclaw-${userId}`;
    const dataDir = path.join(DATA_DIR, 'instances', userId);
    
    try {
        // Check if already exists
        try {
            await runCommand(`docker inspect ${containerName}`);
            return res.status(409).json({ error: 'Instance already exists' });
        } catch {}
        
        // Get next port
        const port = await getNextPort();
        
        // Set resource limits based on plan
        // Free tier needs 1280m/768MB heap minimum - OpenClaw uses ~500MB at startup
        let memory = '1280m';
        let cpus = '0.5';
        let heapSize = '768';
        if (plan === 'starter') {
            memory = '1280m';
            cpus = '0.5';
            heapSize = '768';
        } else if (plan === 'pro') {
            memory = '1536m';
            cpus = '1.0';
            heapSize = '1024';
        } else if (plan === 'power') {
            memory = '2g';
            cpus = '2.0';
            heapSize = '1536';
        }
        
        // Generate gateway token for this instance
        const gatewayToken = crypto.randomBytes(16).toString('hex');
        
        // Create config with CORRECT format
        const config = createConfig(telegramToken, aiProvider, apiKey, ownerIds, gatewayToken);
        
        // Create data directory with correct permissions
        await fs.mkdir(dataDir, { recursive: true });
        
        // Write config to the data directory
        // IMPORTANT: Config goes at openclaw.json (root level), NOT config/openclaw.json
        await fs.writeFile(
            path.join(dataDir, 'openclaw.json'), 
            JSON.stringify(config, null, 2)
        );
        
        // Set ownership to uid 1000 (node user in container)
        await runCommand(`chown -R 1000:1000 ${dataDir}`);
        await runCommand(`chmod 700 ${dataDir}`);
        
        // Start container with bind mount (NOT named volume)
        // This allows the config to be read/written properly
        await runCommand(`docker run -d \
            --name ${containerName} \
            --restart unless-stopped \
            -v ${dataDir}:/home/node/.openclaw \
            -p ${port}:18789 \
            --memory="${memory}" \
            --cpus="${cpus}" \
            -e NODE_OPTIONS="--max-old-space-size=${heapSize}" \
            ghcr.io/pspdfkit-labs/openclaw:latest`);
        
        // Save port mapping
        await savePort(userId, port);
        
        // Add Caddy route
        const subdomain = await addCaddyRoute(userId, port);
        
        // Save user data
        const userData = {
            userId,
            port,
            subdomain,
            gatewayToken,
            plan: plan || 'free',
            aiProvider: aiProvider || 'groq',
            createdAt: new Date().toISOString(),
            expiresAt: plan === 'free' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null
        };
        await fs.mkdir(path.join(DATA_DIR, 'users'), { recursive: true });
        await fs.writeFile(path.join(DATA_DIR, 'users', `${userId}.json`), JSON.stringify(userData, null, 2));
        
        res.json({
            success: true,
            userId,
            subdomain,
            url: `https://${subdomain}`,
            port,
            gatewayToken,
            plan: plan || 'free'
        });
        
    } catch (error) {
        // Cleanup on failure
        try {
            await runCommand(`docker rm -f ${containerName}`);
            await fs.rm(dataDir, { recursive: true, force: true });
        } catch {}
        
        console.error('Provision error:', error);
        res.status(500).json({ error: error.message || error.stderr || 'Provisioning failed' });
    }
});

// Restart instance
app.post('/instances/:userId/restart', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    const containerName = `openclaw-${userId}`;
    
    try {
        await runCommand(`docker restart ${containerName}`);
        res.json({ success: true, message: 'Instance restarted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop instance
app.post('/instances/:userId/stop', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    const containerName = `openclaw-${userId}`;
    
    try {
        await runCommand(`docker stop ${containerName}`);
        res.json({ success: true, message: 'Instance stopped' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start instance
app.post('/instances/:userId/start', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    const containerName = `openclaw-${userId}`;
    
    try {
        await runCommand(`docker start ${containerName}`);
        res.json({ success: true, message: 'Instance started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete instance
app.delete('/instances/:userId', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    const { keepBackup } = req.query;
    const containerName = `openclaw-${userId}`;
    const dataDir = path.join(DATA_DIR, 'instances', userId);
    
    try {
        // Stop and remove container
        await runCommand(`docker rm -f ${containerName}`);
        
        // Remove data directory (unless keeping backup)
        if (keepBackup !== 'true') {
            await fs.rm(dataDir, { recursive: true, force: true });
        }
        
        // Remove from Caddy config
        try {
            const caddyContent = await fs.readFile(CADDY_FILE, 'utf8');
            const subdomain = `${userId}.${EXTERNAL_IP}.nip.io`;
            // Remove the route block for this user
            const routeRegex = new RegExp(`\\n${subdomain.replace(/\./g, '\\.')} \\{[^}]*\\}\\n?`, 'g');
            const newContent = caddyContent.replace(routeRegex, '\n');
            await fs.writeFile(CADDY_FILE, newContent);
            await runCommand('systemctl reload caddy');
        } catch (caddyErr) {
            console.error('Failed to clean up Caddy route:', caddyErr);
        }

        // Remove port mapping
        try {
            const portsFile = path.join(DATA_DIR, 'ports.json');
            const portsData = JSON.parse(await fs.readFile(portsFile, 'utf8'));
            delete portsData[userId];
            await fs.writeFile(portsFile, JSON.stringify(portsData, null, 2));
        } catch {}

        // Remove user data file
        try {
            await fs.rm(path.join(DATA_DIR, 'users', `${userId}.json`), { force: true });
        } catch {}

        res.json({ success: true, message: 'Instance deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update instance config (e.g., API key change)
app.patch('/instances/:userId/config', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    const { aiProvider, apiKey } = req.body;
    const containerName = `openclaw-${userId}`;
    const configPath = path.join(DATA_DIR, 'instances', userId, 'openclaw.json');

    try {
        // Read existing config
        const configData = JSON.parse(await fs.readFile(configPath, 'utf8'));

        // Update AI provider key
        if (aiProvider && apiKey) {
            // Clear old provider keys
            delete configData.env.vars.GROQ_API_KEY;
            delete configData.env.vars.GEMINI_API_KEY;
            delete configData.env.vars.ANTHROPIC_API_KEY;
            delete configData.env.vars.OPENAI_API_KEY;
            delete configData.env.vars.OPENROUTER_API_KEY;

            // Set new key and model
            if (aiProvider === 'gemini' || aiProvider === 'google') {
                configData.env.vars.GEMINI_API_KEY = apiKey;
                configData.agents.defaults.model.primary = 'google/gemini-2.0-flash';
            } else if (aiProvider === 'groq') {
                configData.env.vars.GROQ_API_KEY = apiKey;
                configData.agents.defaults.model.primary = 'groq/gemma2-9b-it';
            } else if (aiProvider === 'anthropic') {
                configData.env.vars.ANTHROPIC_API_KEY = apiKey;
                configData.agents.defaults.model.primary = 'anthropic/claude-sonnet-4-5';
            } else if (aiProvider === 'openai') {
                configData.env.vars.OPENAI_API_KEY = apiKey;
                configData.agents.defaults.model.primary = 'openai/gpt-4o';
            } else if (aiProvider === 'openrouter') {
                configData.env.vars.OPENROUTER_API_KEY = apiKey;
                configData.agents.defaults.model.primary = 'anthropic/claude-sonnet-4-5';
            }
        }

        // Write updated config
        await fs.writeFile(configPath, JSON.stringify(configData, null, 2));
        await runCommand(`chown 1000:1000 ${configPath}`);

        // Restart container to pick up new config
        await runCommand(`docker restart ${containerName}`);

        res.json({ success: true, message: 'Config updated, instance restarting' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get instance logs
app.get('/instances/:userId/logs', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    const { lines = 100 } = req.query;
    const containerName = `openclaw-${userId}`;
    
    try {
        const { stdout } = await runCommand(`docker logs ${containerName} --tail ${lines} 2>&1`);
        res.json({ logs: stdout });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get instance stats
app.get('/instances/:userId/stats', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    const containerName = `openclaw-${userId}`;
    
    try {
        const { stdout } = await runCommand(`docker stats ${containerName} --no-stream --format "{{.CPUPerc}},{{.MemUsage}},{{.NetIO}}"`);
        const [cpu, memory, network] = stdout.trim().split(',');
        res.json({ cpu, memory, network });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upgrade instance resources
app.post('/instances/:userId/upgrade', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    const { plan } = req.body;
    const containerName = `openclaw-${userId}`;
    
    let memory = '1g';
    let cpus = '0.5';
    if (plan === 'pro') {
        memory = '1536m';
        cpus = '1.0';
    } else if (plan === 'power') {
        memory = '2g';
        cpus = '2.0';
    }
    
    try {
        await runCommand(`docker update --memory="${memory}" --cpus="${cpus}" ${containerName}`);
        res.json({ success: true, message: `Upgraded to ${plan}`, memory, cpus });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Validate Telegram token
app.post('/validate/telegram', async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({ error: 'Token required' });
    }
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await response.json();
        
        if (data.ok) {
            res.json({ valid: true, bot: data.result });
        } else {
            res.json({ valid: false, error: data.description });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ACTIVITY TRACKING ====================

// Activity webhook - called by OpenClaw gateway on each message
app.post('/webhooks/activity', webhookLimiter, async (req, res) => {
    try {
        const { userId, eventType, timestamp, messageCount } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        // Load user data
        const userFile = path.join(DATA_DIR, 'users', `${userId}.json`);
        let userData = {};

        try {
            userData = JSON.parse(await fs.readFile(userFile, 'utf8'));
        } catch {
            // User not found - may be a stale webhook
            return res.status(404).json({ error: 'User not found' });
        }

        // Update activity
        userData.lastActivityAt = timestamp || new Date().toISOString();
        userData.messageCount = (userData.messageCount || 0) + 1;

        // Reset warning if user was warned
        if (userData.warningSentAt) {
            delete userData.warningSentAt;
            console.log(`[activity] Reset warning for ${userId} due to activity`);
        }

        // Reactivate if suspended
        if (userData.status === 'suspended') {
            userData.status = 'active';
            delete userData.suspendedAt;
            console.log(`[activity] Reactivated ${userId} due to activity`);

            // Restart container
            try {
                await runCommand(`docker start openclaw-${userId}`);
            } catch (e) {
                console.error(`[activity] Failed to restart container for ${userId}`);
            }
        }

        await fs.writeFile(userFile, JSON.stringify(userData, null, 2));
        console.log(`[activity] Updated activity for ${userId}`);

        res.json({ status: 'ok', messageCount: userData.messageCount });
    } catch (error) {
        console.error('[activity] Error:', error);
        res.status(500).json({ error: 'Internal error' });
    }
});

// ==================== ADMIN ENDPOINTS ====================

// Get all instances (admin)
app.get('/admin/instances', adminLimiter, authenticateAdmin, async (req, res) => {
    try {
        // Get container statuses
        const { stdout } = await runCommand('docker ps -a --filter "name=openclaw-" --format "{{.Names}},{{.Status}},{{.State}}"');

        const containerStatuses = {};
        stdout.trim().split('\n').filter(Boolean).forEach(line => {
            const [name, status, state] = line.split(',');
            const userId = name.replace('openclaw-', '');
            containerStatuses[userId] = { status, state };
        });

        // Get user data
        const usersDir = path.join(DATA_DIR, 'users');
        const files = await fs.readdir(usersDir).catch(() => []);

        const instances = [];
        for (const file of files) {
            if (!file.endsWith('.json')) continue;

            const userId = file.replace('.json', '');
            try {
                const userData = JSON.parse(await fs.readFile(path.join(usersDir, file), 'utf8'));
                instances.push({
                    userId,
                    email: userData.email,
                    tier: userData.tier || userData.plan || 'trial',
                    status: userData.status || 'active',
                    containerStatus: containerStatuses[userId]?.state || 'unknown',
                    createdAt: userData.createdAt,
                    lastActivityAt: userData.lastActivityAt,
                    messageCount: userData.messageCount || 0,
                    vmHost: userData.vmHost || 'openclaw2'
                    // Note: API keys are never exposed
                });
            } catch (e) {
                console.error(`[admin] Failed to read user ${userId}:`, e.message);
            }
        }

        res.json({
            total: instances.length,
            instances: instances.sort((a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt)
            )
        });
    } catch (error) {
        console.error('[admin] Error listing instances:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get system health
app.get('/admin/health', adminLimiter, authenticateAdmin, async (req, res) => {
    try {
        const vmStatuses = await getAllVMStatuses();
        const alerts = await checkCapacity();

        res.json({
            status: alerts.filter(a => a.level === 'critical').length > 0 ? 'critical' :
                    alerts.filter(a => a.level === 'warning').length > 0 ? 'warning' : 'healthy',
            vms: vmStatuses,
            alerts,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[admin] Health check error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Perform admin action on instance
app.post('/admin/instances/:userId/action', adminLimiter, authenticateAdmin, async (req, res) => {
    const { userId } = req.params;
    const { action } = req.body;
    const containerName = `openclaw-${userId}`;

    const validActions = ['restart', 'stop', 'start', 'delete', 'suspend'];
    if (!validActions.includes(action)) {
        return res.status(400).json({
            error: `Invalid action. Must be one of: ${validActions.join(', ')}`
        });
    }

    try {
        const userFile = path.join(DATA_DIR, 'users', `${userId}.json`);
        let userData = {};
        try {
            userData = JSON.parse(await fs.readFile(userFile, 'utf8'));
        } catch {}

        switch (action) {
            case 'restart':
                await runCommand(`docker restart ${containerName}`);
                userData.lastRestartAt = new Date().toISOString();
                break;

            case 'stop':
                await runCommand(`docker stop ${containerName}`);
                break;

            case 'start':
                await runCommand(`docker start ${containerName}`);
                userData.status = 'active';
                break;

            case 'suspend':
                await runCommand(`docker stop ${containerName}`);
                userData.status = 'suspended';
                userData.suspendedAt = new Date().toISOString();
                break;

            case 'delete':
                await runCommand(`docker rm -f ${containerName}`);
                await fs.rm(path.join(DATA_DIR, 'instances', userId), { recursive: true, force: true });
                userData.status = 'deleted';
                userData.deletedAt = new Date().toISOString();
                break;
        }

        await fs.writeFile(userFile, JSON.stringify(userData, null, 2));

        res.json({
            status: 'success',
            action,
            userId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error(`[admin] Action ${action} failed for ${userId}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Trigger inactive account cleanup (admin)
app.post('/admin/cleanup-inactive', adminLimiter, authenticateAdmin, async (req, res) => {
    try {
        console.log('[admin] Manual cleanup triggered');
        const results = await runCleanup();
        res.json({
            status: 'completed',
            results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[admin] Cleanup error:', error);
        res.status(500).json({ error: 'Cleanup failed', details: error.message });
    }
});

// Get capacity alerts
app.get('/admin/capacity', adminLimiter, authenticateAdmin, async (req, res) => {
    try {
        const alerts = await checkCapacity();
        const vmStatuses = await getAllVMStatuses();

        // Calculate totals
        const totals = vmStatuses.reduce((acc, vm) => {
            acc.totalContainers += vm.containerCount || 0;
            acc.maxContainers += vm.maxContainers || 0;
            return acc;
        }, { totalContainers: 0, maxContainers: 0 });

        res.json({
            capacityUsed: Math.round((totals.totalContainers / totals.maxContainers) * 100),
            totalContainers: totals.totalContainers,
            maxContainers: totals.maxContainers,
            availableSlots: totals.maxContainers - totals.totalContainers,
            alerts,
            vms: vmStatuses.map(vm => ({
                host: vm.host,
                containerCount: vm.containerCount,
                maxContainers: vm.maxContainers,
                ramUsedPercent: vm.ramUsedPercent,
                healthy: vm.healthy
            }))
        });
    } catch (error) {
        console.error('[admin] Capacity check error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== API VALIDATION ENDPOINTS ====================

// Validate API key with provider
app.post('/validate/api-key', apiLimiter, async (req, res) => {
    const { provider, apiKey } = req.body;

    if (!provider || !apiKey) {
        return res.status(400).json({ error: 'provider and apiKey required' });
    }

    try {
        let valid = false;
        let error = null;

        switch (provider) {
            case 'anthropic':
                const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'claude-sonnet-4-5-20241022',
                        max_tokens: 1,
                        messages: [{ role: 'user', content: 'hi' }]
                    })
                });
                if (anthropicRes.status === 401) {
                    error = 'Invalid API key';
                } else if (anthropicRes.status === 429) {
                    valid = true; // Key is valid but rate limited
                } else {
                    valid = true;
                }
                break;

            case 'openai':
                const openaiRes = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                valid = openaiRes.status !== 401;
                if (!valid) error = 'Invalid API key';
                break;

            case 'google':
            case 'gemini':
                const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                valid = geminiRes.status !== 400 && geminiRes.status !== 403;
                if (!valid) error = 'Invalid API key';
                break;

            default:
                // Skip validation for unknown providers
                valid = true;
        }

        res.json({ valid, error, provider });
    } catch (err) {
        console.error('[validate] API key validation error:', err);
        // On network error, assume key is valid
        res.json({ valid: true, warning: 'Could not verify key due to network error' });
    }
});

// ==================== SERVER STARTUP ====================

// Create data directories
const initDataDirs = async () => {
    await fs.mkdir(path.join(DATA_DIR, 'users'), { recursive: true });
    await fs.mkdir(path.join(DATA_DIR, 'instances'), { recursive: true });
};

// Start server
initDataDirs().then(() => {
    app.listen(PORT, () => {
        console.log(`🦞 2OpenClaw API running on port ${PORT}`);
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   Data directory: ${DATA_DIR}`);
    });
});
