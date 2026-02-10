# 2OpenClaw - Technical Implementation Guide

This guide contains exact code changes and commands to implement all features.

---

## Phase 2: Reliability Features

### 2.1 Health Monitoring Script

**Create file**: `/opt/startclaw/scripts/health_monitor.sh` on openclaw2 VM

```bash
#!/bin/bash
# Health monitoring script - checks all containers and restarts if unhealthy
# Cron: */5 * * * * /opt/startclaw/scripts/health_monitor.sh >> /var/log/startclaw/health.log 2>&1

LOG_FILE="/var/log/startclaw/health.log"
ALERT_WEBHOOK="${ALERT_WEBHOOK_URL:-}"
MAX_RESTARTS=5

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

send_alert() {
    local message="$1"
    log "ALERT: $message"
    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -sf -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"🚨 OpenClaw Alert: $message\"}" || true
    fi
}

# Ensure log directory exists
mkdir -p /var/log/startclaw

log "Starting health check..."

for container in $(docker ps -a --filter "name=openclaw-" --format "{{.Names}}"); do
    # Get container status
    status=$(docker inspect "$container" --format='{{.State.Status}}')
    health=$(docker inspect "$container" --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")
    restart_count=$(docker inspect "$container" --format='{{.RestartCount}}')

    log "Container: $container | Status: $status | Health: $health | Restarts: $restart_count"

    if [ "$status" != "running" ]; then
        log "Container $container is not running, attempting start..."
        docker start "$container"
        send_alert "Container $container was stopped, started it."
        continue
    fi

    # Check health endpoint directly
    container_healthy=false
    if docker exec "$container" curl -sf http://localhost:18789/health > /dev/null 2>&1; then
        container_healthy=true
    fi

    if [ "$container_healthy" = false ]; then
        if [ "$restart_count" -lt "$MAX_RESTARTS" ]; then
            log "Container $container unhealthy, restarting (attempt $restart_count)..."
            docker restart "$container"
            send_alert "Container $container unhealthy, restarted (attempt $restart_count)"
        else
            log "Container $container exceeded max restarts ($MAX_RESTARTS), needs manual intervention"
            send_alert "🔴 CRITICAL: Container $container exceeded max restarts. Manual intervention required!"
        fi
    fi
done

log "Health check completed."
```

**Setup command**:
```bash
# On openclaw2 VM
sudo tee /opt/startclaw/scripts/health_monitor.sh << 'SCRIPT'
[paste script above]
SCRIPT

sudo chmod +x /opt/startclaw/scripts/health_monitor.sh
sudo mkdir -p /var/log/startclaw

# Add to cron
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/startclaw/scripts/health_monitor.sh >> /var/log/startclaw/health.log 2>&1") | crontab -
```

---

### 2.2 Activity Tracking

**Add to api/server.js** - Activity webhook endpoint:

```javascript
// Activity tracking endpoint - called by OpenClaw gateway
app.post('/webhooks/activity', async (req, res) => {
    try {
        const { userId, eventType, timestamp } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const instances = await loadInstances();

        if (instances[userId]) {
            instances[userId].lastActivityAt = timestamp || new Date().toISOString();
            instances[userId].messageCount = (instances[userId].messageCount || 0) + 1;
            await saveInstances(instances);
            console.log(`[activity] Updated activity for ${userId}`);
        }

        res.json({ status: 'ok' });
    } catch (error) {
        console.error('[activity] Error:', error);
        res.status(500).json({ error: 'Internal error' });
    }
});

// Get instance stats
app.get('/instances/:userId/stats', authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;
        const instances = await loadInstances();
        const instance = instances[userId];

        if (!instance) {
            return res.status(404).json({ error: 'Instance not found' });
        }

        res.json({
            messageCount: instance.messageCount || 0,
            lastActivityAt: instance.lastActivityAt || instance.createdAt,
            createdAt: instance.createdAt,
            status: instance.status || 'running',
            tier: instance.tier || 'trial'
        });
    } catch (error) {
        console.error('[stats] Error:', error);
        res.status(500).json({ error: 'Internal error' });
    }
});
```

---

### 2.3 Input Validation Middleware

**Add to api/server.js**:

```javascript
const validator = require('validator');

// Validation middleware
const validateProvisionInput = (req, res, next) => {
    const { telegramToken, aiProvider, apiKey, ownerIds, email } = req.body;
    const errors = [];

    // Telegram token format: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
    if (!telegramToken || !/^\d+:[A-Za-z0-9_-]{35}$/.test(telegramToken)) {
        errors.push('Invalid Telegram bot token format');
    }

    // AI Provider
    const validProviders = ['anthropic', 'openai', 'google', 'groq'];
    if (!aiProvider || !validProviders.includes(aiProvider)) {
        errors.push(`Invalid AI provider. Must be one of: ${validProviders.join(', ')}`);
    }

    // API Key validation by provider
    if (!apiKey) {
        errors.push('API key is required');
    } else {
        if (aiProvider === 'anthropic' && !apiKey.startsWith('sk-ant-')) {
            errors.push('Anthropic API keys should start with sk-ant-');
        }
        if (aiProvider === 'openai' && !apiKey.startsWith('sk-')) {
            errors.push('OpenAI API keys should start with sk-');
        }
        if (aiProvider === 'google' && !apiKey.startsWith('AIza')) {
            errors.push('Google API keys should start with AIza');
        }
    }

    // Owner IDs - must be array of numeric strings
    if (!ownerIds || !Array.isArray(ownerIds) || ownerIds.length === 0) {
        errors.push('At least one Telegram user ID is required');
    } else {
        for (const id of ownerIds) {
            if (!/^\d+$/.test(String(id))) {
                errors.push(`Invalid Telegram user ID: ${id}. Must be numeric.`);
            }
        }
    }

    // Email validation
    if (email && !validator.isEmail(email)) {
        errors.push('Invalid email format');
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    next();
};

// Apply to provision endpoint
// Change: app.post('/provision', async (req, res) => {
// To: app.post('/provision', validateProvisionInput, async (req, res) => {
```

---

### 2.4 Rate Limiting

**Add to api/server.js**:

```javascript
const rateLimit = require('express-rate-limit');

// Rate limiters
const provisionLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 provisions per hour per IP
    message: { error: 'Too many provision requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: { error: 'Too many requests. Please slow down.' },
});

// Apply rate limiters
app.use('/provision', provisionLimiter);
app.use('/instances', apiLimiter);
app.use('/admin', apiLimiter);
```

**Install dependency**:
```bash
npm install express-rate-limit validator
```

---

## Phase 3: User Features

### 3.1 Inactive Account Cleanup Service

**Create file**: `api/services/cleanup.js`

```javascript
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const INSTANCES_FILE = path.join(__dirname, '../data/instances.json');

// Cleanup thresholds in days
const THRESHOLDS = {
    trial: { warn: 5, suspend: 7, delete: 7 },
    starter: { warn: 25, suspend: 30, delete: 44 },
    pro: { warn: 50, suspend: 60, delete: null }, // null = never auto-delete
    business: { warn: 50, suspend: 60, delete: null }
};

async function loadInstances() {
    try {
        const data = await fs.readFile(INSTANCES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

async function saveInstances(instances) {
    await fs.writeFile(INSTANCES_FILE, JSON.stringify(instances, null, 2));
}

async function stopContainer(userId) {
    try {
        await execAsync(`docker stop openclaw-${userId}`);
        console.log(`[cleanup] Stopped container for ${userId}`);
    } catch (error) {
        console.error(`[cleanup] Failed to stop container ${userId}:`, error.message);
    }
}

async function deleteContainer(userId) {
    try {
        await execAsync(`docker rm -f openclaw-${userId}`);
        await execAsync(`rm -rf /opt/startclaw/data/instances/${userId}`);
        console.log(`[cleanup] Deleted container and data for ${userId}`);
    } catch (error) {
        console.error(`[cleanup] Failed to delete ${userId}:`, error.message);
    }
}

async function sendEmail(email, template, data = {}) {
    // TODO: Implement email sending via SendGrid/SES
    console.log(`[cleanup] Would send ${template} email to ${email}`, data);
}

async function runCleanup() {
    console.log('[cleanup] Starting inactive account cleanup...');

    const instances = await loadInstances();
    const now = new Date();
    const results = { warned: 0, suspended: 0, deleted: 0 };

    for (const [userId, instance] of Object.entries(instances)) {
        const tier = instance.tier || 'trial';
        const thresholds = THRESHOLDS[tier] || THRESHOLDS.starter;

        const lastActivity = new Date(instance.lastActivityAt || instance.createdAt);
        const daysSinceActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

        console.log(`[cleanup] ${userId}: tier=${tier}, inactive=${daysSinceActivity} days, status=${instance.status}`);

        // Delete check
        if (thresholds.delete && daysSinceActivity >= thresholds.delete && instance.status !== 'deleted') {
            await deleteContainer(userId);
            instance.status = 'deleted';
            instance.deletedAt = now.toISOString();
            await sendEmail(instance.email, 'account_deleted');
            results.deleted++;
            continue;
        }

        // Suspend check
        if (daysSinceActivity >= thresholds.suspend && instance.status === 'active') {
            await stopContainer(userId);
            instance.status = 'suspended';
            instance.suspendedAt = now.toISOString();
            await sendEmail(instance.email, 'account_suspended', {
                daysUntilDelete: thresholds.delete ? thresholds.delete - daysSinceActivity : null
            });
            results.suspended++;
            continue;
        }

        // Warning check
        if (daysSinceActivity >= thresholds.warn && instance.status === 'active' && !instance.warningSentAt) {
            instance.warningSentAt = now.toISOString();
            await sendEmail(instance.email, 'inactivity_warning', {
                daysUntilSuspend: thresholds.suspend - daysSinceActivity
            });
            results.warned++;
        }
    }

    await saveInstances(instances);

    console.log(`[cleanup] Completed: warned=${results.warned}, suspended=${results.suspended}, deleted=${results.deleted}`);
    return results;
}

module.exports = { runCleanup, THRESHOLDS };
```

**Add cleanup endpoint to api/server.js**:

```javascript
const { runCleanup } = require('./services/cleanup');

// Admin endpoint to trigger cleanup
app.post('/admin/cleanup-inactive', authenticateAdmin, async (req, res) => {
    try {
        const results = await runCleanup();
        res.json({ status: 'completed', results });
    } catch (error) {
        console.error('[admin] Cleanup error:', error);
        res.status(500).json({ error: 'Cleanup failed', details: error.message });
    }
});
```

**Create cron script**: `/opt/startclaw/scripts/cleanup_inactive.sh`

```bash
#!/bin/bash
# Run inactive account cleanup daily at 2am
# Cron: 0 2 * * * /opt/startclaw/scripts/cleanup_inactive.sh

API_URL="http://localhost:3000"
API_SECRET="${GCP_API_SECRET:-startclaw2024secret}"

curl -sf -X POST "$API_URL/admin/cleanup-inactive" \
    -H "Authorization: Bearer $API_SECRET" \
    -H "Content-Type: application/json"
```

---

### 3.2 Instance Restart Endpoint

**Add to api/server.js**:

```javascript
// Restart instance
app.post('/instances/:userId/restart', authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;
        const instances = await loadInstances();

        if (!instances[userId]) {
            return res.status(404).json({ error: 'Instance not found' });
        }

        const containerName = `openclaw-${userId}`;

        // Restart container
        await execAsync(`docker restart ${containerName}`);

        // Wait for health
        let healthy = false;
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 3000));
            try {
                await execAsync(`docker exec ${containerName} curl -sf http://localhost:18789/health`);
                healthy = true;
                break;
            } catch (e) {
                console.log(`[restart] Waiting for ${containerName} to be healthy... (${i+1}/10)`);
            }
        }

        if (!healthy) {
            return res.status(500).json({ error: 'Container failed to become healthy after restart' });
        }

        instances[userId].lastRestartAt = new Date().toISOString();
        await saveInstances(instances);

        res.json({ status: 'restarted', healthy: true });
    } catch (error) {
        console.error('[restart] Error:', error);
        res.status(500).json({ error: 'Restart failed', details: error.message });
    }
});
```

---

### 3.3 Update Config Endpoint (Enhanced)

**Add to api/server.js**:

```javascript
// Update instance configuration
app.patch('/instances/:userId/config', authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;
        const { aiProvider, apiKey, ownerIds } = req.body;
        const instances = await loadInstances();

        if (!instances[userId]) {
            return res.status(404).json({ error: 'Instance not found' });
        }

        const configPath = `/opt/startclaw/data/instances/${userId}/openclaw.json`;

        // Read current config
        const { stdout } = await execAsync(`cat ${configPath}`);
        const config = JSON.parse(stdout);

        // Update API key if provided
        if (apiKey && aiProvider) {
            // Validate API key
            const keyValidation = await validateApiKey(aiProvider, apiKey);
            if (!keyValidation.valid) {
                return res.status(400).json({ error: `Invalid API key: ${keyValidation.error}` });
            }

            // Clear old keys, set new one
            config.env = config.env || { vars: {} };
            config.env.vars = {};

            const keyMapping = {
                'anthropic': 'ANTHROPIC_API_KEY',
                'openai': 'OPENAI_API_KEY',
                'google': 'GOOGLE_API_KEY',
                'groq': 'GROQ_API_KEY'
            };

            const modelMapping = {
                'anthropic': 'anthropic/claude-sonnet-4-5',
                'openai': 'openai/gpt-4o',
                'google': 'google/gemini-2.0-flash',
                'groq': 'groq/llama-3.3-70b-versatile'
            };

            config.env.vars[keyMapping[aiProvider]] = apiKey;
            config.agents.defaults.model.primary = modelMapping[aiProvider];

            instances[userId].aiProvider = aiProvider;
        }

        // Update allowed users if provided
        if (ownerIds && Array.isArray(ownerIds) && ownerIds.length > 0) {
            config.channels.telegram.allowFrom = ownerIds.map(String);
            instances[userId].ownerIds = ownerIds;
        }

        // Write updated config
        await execAsync(`cat > ${configPath} << 'EOF'
${JSON.stringify(config, null, 2)}
EOF`);

        // Fix permissions
        await execAsync(`chown 1000:1000 ${configPath}`);

        // Restart container to apply changes
        await execAsync(`docker restart openclaw-${userId}`);

        instances[userId].lastConfigUpdateAt = new Date().toISOString();
        await saveInstances(instances);

        res.json({ status: 'updated', message: 'Configuration updated and container restarted' });
    } catch (error) {
        console.error('[config] Error:', error);
        res.status(500).json({ error: 'Config update failed', details: error.message });
    }
});

// Helper function to validate API key
async function validateApiKey(provider, key) {
    try {
        switch (provider) {
            case 'anthropic':
                const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'x-api-key': key,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'claude-sonnet-4-5-20241022',
                        max_tokens: 1,
                        messages: [{ role: 'user', content: 'hi' }]
                    })
                });
                if (anthropicRes.status === 401) return { valid: false, error: 'Invalid API key' };
                return { valid: true };

            case 'openai':
                const openaiRes = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                if (openaiRes.status === 401) return { valid: false, error: 'Invalid API key' };
                return { valid: true };

            default:
                return { valid: true }; // Skip validation for other providers
        }
    } catch (error) {
        console.error('[validateApiKey] Error:', error);
        return { valid: true }; // Allow on network error
    }
}
```

---

## Phase 4: Multi-VM Scaling

### 4.1 VM Registry

**Create file**: `api/data/vms.json`

```json
{
    "openclaw2": {
        "host": "openclaw2",
        "ip": "34.131.95.162",
        "zone": "asia-south2-c",
        "maxContainers": 8,
        "ramGB": 16,
        "status": "active"
    }
}
```

### 4.2 VM Selection Service

**Create file**: `api/services/vmSelector.js`

```javascript
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const VMS_FILE = path.join(__dirname, '../data/vms.json');
const INSTANCES_FILE = path.join(__dirname, '../data/instances.json');

async function loadVMs() {
    const data = await fs.readFile(VMS_FILE, 'utf8');
    return JSON.parse(data);
}

async function loadInstances() {
    try {
        const data = await fs.readFile(INSTANCES_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

async function getVMStatus(vmConfig) {
    try {
        // SSH to VM and get stats
        const cmd = `gcloud compute ssh ${vmConfig.host} --zone=${vmConfig.zone} --command="
            echo RAM_USED=\\$(free | awk '/Mem:/ {printf \\"%.0f\\", \\$3/\\$2 * 100}')
            echo CONTAINERS=\\$(docker ps --filter name=openclaw- -q | wc -l)
            echo DISK_USED=\\$(df / | awk 'NR==2 {print \\$5}' | tr -d '%')
        "`;

        const { stdout } = await execAsync(cmd, { timeout: 10000 });
        const stats = {};
        stdout.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) stats[key.trim()] = parseInt(value.trim());
        });

        return {
            ...vmConfig,
            ramUsedPercent: stats.RAM_USED || 0,
            containerCount: stats.CONTAINERS || 0,
            diskUsedPercent: stats.DISK_USED || 0,
            healthy: true
        };
    } catch (error) {
        console.error(`[vmSelector] Failed to get status for ${vmConfig.host}:`, error.message);
        return {
            ...vmConfig,
            healthy: false,
            error: error.message
        };
    }
}

async function selectBestVM() {
    const vms = await loadVMs();
    const instances = await loadInstances();

    // Count containers per VM
    const containerCounts = {};
    for (const instance of Object.values(instances)) {
        const vmHost = instance.vmHost || 'openclaw2';
        containerCounts[vmHost] = (containerCounts[vmHost] || 0) + 1;
    }

    // Get status for all active VMs
    const vmStatuses = await Promise.all(
        Object.values(vms)
            .filter(vm => vm.status === 'active')
            .map(async vm => {
                const status = await getVMStatus(vm);
                status.containerCount = containerCounts[vm.host] || 0;
                return status;
            })
    );

    // Filter and sort
    const available = vmStatuses
        .filter(vm => vm.healthy)
        .filter(vm => vm.containerCount < vm.maxContainers)
        .filter(vm => vm.ramUsedPercent < 85)
        .sort((a, b) => a.containerCount - b.containerCount);

    if (available.length === 0) {
        throw new Error('No VM capacity available. All VMs are at capacity.');
    }

    console.log(`[vmSelector] Selected ${available[0].host} (${available[0].containerCount}/${available[0].maxContainers} containers)`);
    return available[0];
}

async function checkCapacity() {
    const vms = await loadVMs();
    const alerts = [];

    for (const vm of Object.values(vms)) {
        if (vm.status !== 'active') continue;

        const status = await getVMStatus(vm);

        if (!status.healthy) {
            alerts.push({ level: 'critical', vm: vm.host, message: 'VM unreachable' });
        } else if (status.ramUsedPercent > 85) {
            alerts.push({ level: 'critical', vm: vm.host, message: `RAM at ${status.ramUsedPercent}%` });
        } else if (status.ramUsedPercent > 70) {
            alerts.push({ level: 'warning', vm: vm.host, message: `RAM at ${status.ramUsedPercent}%` });
        }

        if (status.containerCount >= status.maxContainers) {
            alerts.push({ level: 'critical', vm: vm.host, message: 'At max container capacity' });
        } else if (status.containerCount >= status.maxContainers * 0.8) {
            alerts.push({ level: 'warning', vm: vm.host, message: `${status.containerCount}/${status.maxContainers} containers` });
        }
    }

    return alerts;
}

module.exports = { selectBestVM, checkCapacity, getVMStatus };
```

---

## Phase 5: Admin Dashboard Endpoints

**Add to api/server.js**:

```javascript
const { checkCapacity, getVMStatus } = require('./services/vmSelector');

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (token !== process.env.GCP_API_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Get all instances (admin)
app.get('/admin/instances', authenticateAdmin, async (req, res) => {
    try {
        const instances = await loadInstances();
        res.json(Object.entries(instances).map(([id, data]) => ({
            id,
            ...data,
            apiKey: '***hidden***' // Never expose API keys
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get system health
app.get('/admin/health', authenticateAdmin, async (req, res) => {
    try {
        const vms = require('./data/vms.json');
        const vmStatuses = await Promise.all(
            Object.values(vms).map(vm => getVMStatus(vm))
        );
        const alerts = await checkCapacity();

        res.json({
            vms: vmStatuses,
            alerts,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Perform admin action on instance
app.post('/admin/instances/:userId/action', authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { action } = req.body;

        const validActions = ['restart', 'stop', 'start', 'delete'];
        if (!validActions.includes(action)) {
            return res.status(400).json({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` });
        }

        const containerName = `openclaw-${userId}`;

        switch (action) {
            case 'restart':
                await execAsync(`docker restart ${containerName}`);
                break;
            case 'stop':
                await execAsync(`docker stop ${containerName}`);
                break;
            case 'start':
                await execAsync(`docker start ${containerName}`);
                break;
            case 'delete':
                await execAsync(`docker rm -f ${containerName}`);
                await execAsync(`rm -rf /opt/startclaw/data/instances/${userId}`);
                const instances = await loadInstances();
                delete instances[userId];
                await saveInstances(instances);
                break;
        }

        res.json({ status: 'success', action, userId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

---

## Quick Setup Commands

### On molty VM (API Server):

```bash
# SSH to molty
gcloud compute ssh molty --zone=asia-south2-a

# Navigate to project
cd ~/2openclaw

# Install new dependencies
npm install express-rate-limit validator

# Create services directory
mkdir -p api/services api/data

# Create cleanup service
# [paste cleanup.js content]

# Create VM selector service
# [paste vmSelector.js content]

# Create VMs registry
echo '{"openclaw2":{"host":"openclaw2","ip":"34.131.95.162","zone":"asia-south2-c","maxContainers":8,"ramGB":16,"status":"active"}}' > api/data/vms.json

# Restart API
sudo systemctl restart startclaw-api
```

### On openclaw2 VM (Container Host):

```bash
# SSH to openclaw2
gcloud compute ssh openclaw2 --zone=asia-south2-c

# Create scripts directory
sudo mkdir -p /opt/startclaw/scripts /var/log/startclaw

# Create health monitor script
sudo nano /opt/startclaw/scripts/health_monitor.sh
# [paste script]
sudo chmod +x /opt/startclaw/scripts/health_monitor.sh

# Create cleanup script
sudo nano /opt/startclaw/scripts/cleanup_inactive.sh
# [paste script]
sudo chmod +x /opt/startclaw/scripts/cleanup_inactive.sh

# Add cron jobs
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/startclaw/scripts/health_monitor.sh >> /var/log/startclaw/health.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/startclaw/scripts/cleanup_inactive.sh >> /var/log/startclaw/cleanup.log 2>&1") | crontab -

# Verify cron
crontab -l
```

---

## Testing Checklist

- [ ] Health monitor detects crashed container
- [ ] Health monitor auto-restarts container
- [ ] Cleanup warns inactive trial user at day 5
- [ ] Cleanup deletes trial user at day 7
- [ ] API validates invalid Telegram token
- [ ] API validates invalid API key format
- [ ] Rate limiter blocks excessive requests
- [ ] Config update validates new API key
- [ ] Restart endpoint restarts and confirms healthy
- [ ] Admin endpoints require authentication
- [ ] VM selector chooses least-loaded VM
