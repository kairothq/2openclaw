/**
 * Inactive Account Cleanup Service
 *
 * Handles automatic warning, suspension, and deletion of inactive accounts
 * based on tier-specific thresholds.
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const DATA_DIR = process.env.DATA_DIR || '/opt/2openclaw/data';
const INSTANCES_FILE = path.join(DATA_DIR, 'instances.json');

// Cleanup thresholds in days by tier
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
        // Try legacy format (individual user files)
        return await loadInstancesFromUserFiles();
    }
}

async function loadInstancesFromUserFiles() {
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
    } catch (error) {
        console.log('[cleanup] No user files found');
    }

    return instances;
}

async function saveInstances(instances) {
    await fs.writeFile(INSTANCES_FILE, JSON.stringify(instances, null, 2));

    // Also update individual user files for compatibility
    const usersDir = path.join(DATA_DIR, 'users');
    await fs.mkdir(usersDir, { recursive: true });

    for (const [userId, instance] of Object.entries(instances)) {
        await fs.writeFile(
            path.join(usersDir, `${userId}.json`),
            JSON.stringify(instance, null, 2)
        );
    }
}

async function stopContainer(userId) {
    const containerName = `openclaw-${userId}`;
    try {
        await execAsync(`docker stop ${containerName}`);
        console.log(`[cleanup] Stopped container for ${userId}`);
        return true;
    } catch (error) {
        console.error(`[cleanup] Failed to stop container ${userId}:`, error.message);
        return false;
    }
}

async function deleteContainer(userId) {
    const containerName = `openclaw-${userId}`;
    const dataDir = path.join(DATA_DIR, 'instances', userId);

    try {
        // Remove container
        await execAsync(`docker rm -f ${containerName}`).catch(() => {});

        // Remove data directory
        await fs.rm(dataDir, { recursive: true, force: true });

        // Remove user file
        await fs.rm(path.join(DATA_DIR, 'users', `${userId}.json`), { force: true }).catch(() => {});

        console.log(`[cleanup] Deleted container and data for ${userId}`);
        return true;
    } catch (error) {
        console.error(`[cleanup] Failed to delete ${userId}:`, error.message);
        return false;
    }
}

/**
 * Send email notification
 * TODO: Implement actual email sending via SendGrid/SES
 */
async function sendEmail(email, template, data = {}) {
    console.log(`[cleanup] Would send ${template} email to ${email}`, data);

    // TODO: Implement actual email sending
    // const templates = {
    //     inactivity_warning: 'Your OpenClaw bot has been inactive...',
    //     account_suspended: 'Your OpenClaw bot has been suspended...',
    //     account_deleted: 'Your OpenClaw bot and data have been deleted...'
    // };

    return true;
}

/**
 * Main cleanup function
 * Called daily via cron job
 */
async function runCleanup() {
    console.log('[cleanup] Starting inactive account cleanup...');

    const instances = await loadInstances();
    const now = new Date();
    const results = { warned: 0, suspended: 0, deleted: 0, errors: 0 };

    for (const [userId, instance] of Object.entries(instances)) {
        try {
            // Skip already deleted instances
            if (instance.status === 'deleted') {
                continue;
            }

            const tier = instance.tier || instance.plan || 'trial';
            const thresholds = THRESHOLDS[tier] || THRESHOLDS.starter;

            // Calculate days since last activity
            const lastActivity = new Date(instance.lastActivityAt || instance.createdAt);
            const daysSinceActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

            console.log(`[cleanup] ${userId}: tier=${tier}, inactive=${daysSinceActivity} days, status=${instance.status || 'active'}`);

            // DELETE check (only if threshold is set and reached)
            if (thresholds.delete && daysSinceActivity >= thresholds.delete && instance.status !== 'deleted') {
                console.log(`[cleanup] Deleting ${userId} after ${daysSinceActivity} days inactive`);

                if (await deleteContainer(userId)) {
                    instance.status = 'deleted';
                    instance.deletedAt = now.toISOString();
                    await sendEmail(instance.email, 'account_deleted', { userId });
                    results.deleted++;
                } else {
                    results.errors++;
                }
                continue;
            }

            // SUSPEND check
            if (daysSinceActivity >= thresholds.suspend && instance.status !== 'suspended' && instance.status !== 'deleted') {
                console.log(`[cleanup] Suspending ${userId} after ${daysSinceActivity} days inactive`);

                if (await stopContainer(userId)) {
                    instance.status = 'suspended';
                    instance.suspendedAt = now.toISOString();

                    const daysUntilDelete = thresholds.delete
                        ? thresholds.delete - daysSinceActivity
                        : null;

                    await sendEmail(instance.email, 'account_suspended', {
                        userId,
                        daysUntilDelete,
                        reactivateUrl: `https://2openclaw.vercel.app/dashboard?userId=${userId}`
                    });
                    results.suspended++;
                } else {
                    results.errors++;
                }
                continue;
            }

            // WARNING check (only for active instances that haven't been warned)
            if (daysSinceActivity >= thresholds.warn &&
                (instance.status === 'active' || !instance.status) &&
                !instance.warningSentAt) {

                console.log(`[cleanup] Warning ${userId} at ${daysSinceActivity} days inactive`);

                instance.warningSentAt = now.toISOString();

                await sendEmail(instance.email, 'inactivity_warning', {
                    userId,
                    daysUntilSuspend: thresholds.suspend - daysSinceActivity,
                    daysUntilDelete: thresholds.delete
                        ? thresholds.delete - daysSinceActivity
                        : null
                });
                results.warned++;
            }

        } catch (error) {
            console.error(`[cleanup] Error processing ${userId}:`, error);
            results.errors++;
        }
    }

    // Save updated instances
    await saveInstances(instances);

    console.log(`[cleanup] Completed: warned=${results.warned}, suspended=${results.suspended}, deleted=${results.deleted}, errors=${results.errors}`);
    return results;
}

/**
 * Reset warning for a user (called when user becomes active again)
 */
async function resetWarning(userId) {
    const instances = await loadInstances();

    if (instances[userId]) {
        delete instances[userId].warningSentAt;
        instances[userId].lastActivityAt = new Date().toISOString();

        // If suspended, reactivate
        if (instances[userId].status === 'suspended') {
            instances[userId].status = 'active';
            delete instances[userId].suspendedAt;

            // Restart container
            const containerName = `openclaw-${userId}`;
            try {
                await execAsync(`docker start ${containerName}`);
                console.log(`[cleanup] Reactivated container for ${userId}`);
            } catch (error) {
                console.error(`[cleanup] Failed to restart ${userId}:`, error.message);
            }
        }

        await saveInstances(instances);
    }
}

module.exports = {
    runCleanup,
    resetWarning,
    THRESHOLDS,
    loadInstances,
    saveInstances
};
