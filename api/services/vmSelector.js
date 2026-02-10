/**
 * VM Selection Service
 *
 * Manages VM pool for multi-VM scaling:
 * - Tracks VM health and capacity
 * - Selects best VM for new containers
 * - Monitors capacity and sends alerts
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const DATA_DIR = process.env.DATA_DIR || '/opt/2openclaw/data';
const VMS_FILE = path.join(__dirname, '../data/vms.json');

// Default VM registry
const DEFAULT_VMS = {
    openclaw2: {
        host: 'openclaw2',
        ip: '34.131.95.162',
        zone: 'asia-south2-c',
        maxContainers: 8,
        ramGB: 16,
        status: 'active'
    }
};

async function loadVMs() {
    try {
        const data = await fs.readFile(VMS_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        // Create default VMs file
        await fs.mkdir(path.dirname(VMS_FILE), { recursive: true });
        await fs.writeFile(VMS_FILE, JSON.stringify(DEFAULT_VMS, null, 2));
        return DEFAULT_VMS;
    }
}

async function saveVMs(vms) {
    await fs.mkdir(path.dirname(VMS_FILE), { recursive: true });
    await fs.writeFile(VMS_FILE, JSON.stringify(vms, null, 2));
}

async function loadInstances() {
    try {
        const instancesFile = path.join(DATA_DIR, 'instances.json');
        const data = await fs.readFile(instancesFile, 'utf8');
        return JSON.parse(data);
    } catch {
        // Try loading from individual user files
        const instances = {};
        const usersDir = path.join(DATA_DIR, 'users');

        try {
            const files = await fs.readdir(usersDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const userId = file.replace('.json', '');
                    const userData = JSON.parse(
                        await fs.readFile(path.join(usersDir, file), 'utf8')
                    );
                    instances[userId] = userData;
                }
            }
        } catch {
            // No instances yet
        }

        return instances;
    }
}

/**
 * Get real-time VM status via SSH
 */
async function getVMStatus(vmConfig) {
    try {
        // SSH to VM and get stats
        const cmd = `gcloud compute ssh ${vmConfig.host} --zone=${vmConfig.zone} --command="
            echo RAM_USED=\\$(free | awk '/Mem:/ {printf \\"%.0f\\", \\$3/\\$2 * 100}')
            echo CONTAINERS=\\$(docker ps --filter name=openclaw- -q | wc -l)
            echo DISK_USED=\\$(df / | awk 'NR==2 {print \\$5}' | tr -d '%')
            echo LOAD=\\$(cat /proc/loadavg | awk '{print \\$1}')
        " 2>/dev/null`;

        const { stdout } = await execAsync(cmd, { timeout: 15000 });

        const stats = {};
        stdout.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                stats[key.trim()] = parseFloat(value.trim()) || 0;
            }
        });

        return {
            ...vmConfig,
            ramUsedPercent: stats.RAM_USED || 0,
            containerCount: stats.CONTAINERS || 0,
            diskUsedPercent: stats.DISK_USED || 0,
            loadAverage: stats.LOAD || 0,
            healthy: true,
            lastChecked: new Date().toISOString()
        };
    } catch (error) {
        console.error(`[vmSelector] Failed to get status for ${vmConfig.host}:`, error.message);
        return {
            ...vmConfig,
            healthy: false,
            error: error.message,
            lastChecked: new Date().toISOString()
        };
    }
}

/**
 * Get VM status using local docker commands (for single-VM setup)
 */
async function getLocalVMStatus(vmConfig) {
    try {
        // Get container count
        const { stdout: containerOutput } = await execAsync(
            'docker ps --filter "name=openclaw-" -q | wc -l'
        );
        const containerCount = parseInt(containerOutput.trim()) || 0;

        // Get RAM usage
        let ramUsedPercent = 0;
        try {
            const { stdout: memOutput } = await execAsync(
                "free | awk '/Mem:/ {printf \"%.0f\", $3/$2 * 100}'"
            );
            ramUsedPercent = parseInt(memOutput.trim()) || 0;
        } catch {
            // Windows/Mac fallback
            ramUsedPercent = 50; // Assume 50% if can't determine
        }

        // Get disk usage
        let diskUsedPercent = 0;
        try {
            const { stdout: diskOutput } = await execAsync(
                "df / | awk 'NR==2 {print $5}' | tr -d '%'"
            );
            diskUsedPercent = parseInt(diskOutput.trim()) || 0;
        } catch {
            diskUsedPercent = 50;
        }

        return {
            ...vmConfig,
            ramUsedPercent,
            containerCount,
            diskUsedPercent,
            healthy: true,
            lastChecked: new Date().toISOString()
        };
    } catch (error) {
        console.error(`[vmSelector] Failed to get local status:`, error.message);
        return {
            ...vmConfig,
            healthy: false,
            error: error.message,
            lastChecked: new Date().toISOString()
        };
    }
}

/**
 * Select the best VM for a new container
 */
async function selectBestVM() {
    const vms = await loadVMs();
    const instances = await loadInstances();

    // Count containers per VM from our instance data
    const containerCounts = {};
    for (const instance of Object.values(instances)) {
        if (instance.status !== 'deleted') {
            const vmHost = instance.vmHost || 'openclaw2';
            containerCounts[vmHost] = (containerCounts[vmHost] || 0) + 1;
        }
    }

    // Get status for all active VMs
    const vmList = Object.values(vms).filter(vm => vm.status === 'active');

    if (vmList.length === 0) {
        throw new Error('No active VMs available');
    }

    // For single VM, use local status check
    if (vmList.length === 1) {
        const status = await getLocalVMStatus(vmList[0]);
        status.containerCount = containerCounts[vmList[0].host] || 0;

        if (!status.healthy) {
            throw new Error(`VM ${vmList[0].host} is unhealthy: ${status.error}`);
        }

        if (status.containerCount >= status.maxContainers) {
            throw new Error(`VM ${vmList[0].host} at max capacity (${status.containerCount}/${status.maxContainers})`);
        }

        if (status.ramUsedPercent >= 85) {
            throw new Error(`VM ${vmList[0].host} RAM critically high (${status.ramUsedPercent}%)`);
        }

        return status;
    }

    // Multi-VM: get status from all VMs
    const vmStatuses = await Promise.all(
        vmList.map(async vm => {
            const status = await getVMStatus(vm);
            status.containerCount = containerCounts[vm.host] || 0;
            return status;
        })
    );

    // Filter and sort by available capacity
    const available = vmStatuses
        .filter(vm => vm.healthy)
        .filter(vm => vm.containerCount < vm.maxContainers)
        .filter(vm => vm.ramUsedPercent < 85)
        .sort((a, b) => {
            // Primary: fewest containers
            if (a.containerCount !== b.containerCount) {
                return a.containerCount - b.containerCount;
            }
            // Secondary: lowest RAM usage
            return a.ramUsedPercent - b.ramUsedPercent;
        });

    if (available.length === 0) {
        throw new Error('No VM capacity available. All VMs are at capacity or unhealthy.');
    }

    console.log(`[vmSelector] Selected ${available[0].host} (${available[0].containerCount}/${available[0].maxContainers} containers, ${available[0].ramUsedPercent}% RAM)`);
    return available[0];
}

/**
 * Check capacity across all VMs and return alerts
 */
async function checkCapacity() {
    const vms = await loadVMs();
    const alerts = [];

    for (const vm of Object.values(vms)) {
        if (vm.status !== 'active') continue;

        let status;
        if (Object.keys(vms).length === 1) {
            status = await getLocalVMStatus(vm);
        } else {
            status = await getVMStatus(vm);
        }

        // Health check
        if (!status.healthy) {
            alerts.push({
                level: 'critical',
                vm: vm.host,
                message: `VM unreachable: ${status.error}`
            });
            continue;
        }

        // RAM checks
        if (status.ramUsedPercent > 85) {
            alerts.push({
                level: 'critical',
                vm: vm.host,
                message: `RAM at ${status.ramUsedPercent}% - immediate action required`
            });
        } else if (status.ramUsedPercent > 70) {
            alerts.push({
                level: 'warning',
                vm: vm.host,
                message: `RAM at ${status.ramUsedPercent}% - approaching limit`
            });
        }

        // Disk checks
        if (status.diskUsedPercent > 90) {
            alerts.push({
                level: 'critical',
                vm: vm.host,
                message: `Disk at ${status.diskUsedPercent}% - cleanup required`
            });
        } else if (status.diskUsedPercent > 70) {
            alerts.push({
                level: 'warning',
                vm: vm.host,
                message: `Disk at ${status.diskUsedPercent}%`
            });
        }

        // Container capacity checks
        if (status.containerCount >= status.maxContainers) {
            alerts.push({
                level: 'critical',
                vm: vm.host,
                message: `At max container capacity (${status.containerCount}/${status.maxContainers})`
            });
        } else if (status.containerCount >= status.maxContainers * 0.8) {
            alerts.push({
                level: 'warning',
                vm: vm.host,
                message: `Container capacity at ${Math.round(status.containerCount / status.maxContainers * 100)}% (${status.containerCount}/${status.maxContainers})`
            });
        }
    }

    return alerts;
}

/**
 * Get all VM statuses for admin dashboard
 */
async function getAllVMStatuses() {
    const vms = await loadVMs();
    const instances = await loadInstances();

    // Count containers per VM
    const containerCounts = {};
    for (const instance of Object.values(instances)) {
        if (instance.status !== 'deleted') {
            const vmHost = instance.vmHost || 'openclaw2';
            containerCounts[vmHost] = (containerCounts[vmHost] || 0) + 1;
        }
    }

    const statuses = [];
    for (const vm of Object.values(vms)) {
        let status;
        if (Object.keys(vms).length === 1) {
            status = await getLocalVMStatus(vm);
        } else {
            status = await getVMStatus(vm);
        }
        status.containerCount = containerCounts[vm.host] || 0;
        statuses.push(status);
    }

    return statuses;
}

/**
 * Add a new VM to the pool
 */
async function addVM(vmConfig) {
    const vms = await loadVMs();

    if (vms[vmConfig.host]) {
        throw new Error(`VM ${vmConfig.host} already exists`);
    }

    vms[vmConfig.host] = {
        host: vmConfig.host,
        ip: vmConfig.ip,
        zone: vmConfig.zone,
        maxContainers: vmConfig.maxContainers || 8,
        ramGB: vmConfig.ramGB || 16,
        status: 'active'
    };

    await saveVMs(vms);
    return vms[vmConfig.host];
}

/**
 * Update VM status (active/maintenance/inactive)
 */
async function updateVMStatus(host, status) {
    const vms = await loadVMs();

    if (!vms[host]) {
        throw new Error(`VM ${host} not found`);
    }

    vms[host].status = status;
    await saveVMs(vms);
    return vms[host];
}

module.exports = {
    loadVMs,
    saveVMs,
    selectBestVM,
    checkCapacity,
    getAllVMStatuses,
    getVMStatus,
    getLocalVMStatus,
    addVM,
    updateVMStatus
};
