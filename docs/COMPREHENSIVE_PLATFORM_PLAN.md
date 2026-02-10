# 2OpenClaw Platform - Comprehensive Architecture Plan

## Executive Summary

2OpenClaw is a managed hosting platform for OpenClaw (Clawdbot) - enabling non-technical users to deploy personal AI assistants via Telegram in under 60 seconds. This document covers all edge cases, pricing strategy, scaling, and operational considerations.

---

## 1. Competitor Analysis

### Direct Competitors

| Platform | Pricing | Model | Key Features |
|----------|---------|-------|--------------|
| **MyClaw.ai** | $19-79/month | Fully managed | Zero setup, hosted instances |
| **PAIO** | $15-49/month | BYOK | Bring your own API key |
| **xCloud OpenClaw** | $24/month | Managed | Dedicated resources |
| **Agent37** | $0.99-9.99/month | Budget | Limited features |
| **Self-hosted** | $3-10/month | DIY | VPS + manual setup |

### Key Insights
- Managed services charge $20+/month (4-6x DIY cost)
- BYOK model is gaining popularity (transparency, no hidden costs)
- Security is a major concern - "API Wallet Assassin" problem (runaway loops draining $$$)
- Most competitors target English-speaking markets (opportunity for India focus)

---

## 2. Pricing Strategy

### Recommended: Hybrid BYOK Model

**Why BYOK for 2OpenClaw:**
1. Eliminates API cost risk for platform (users pay their own AI costs)
2. Full cost transparency builds trust
3. Supports enterprise customers with negotiated AI pricing
4. Removes usage ceilings - unlimited conversations
5. Aligns with India's cost-conscious market

### Proposed Pricing Tiers (INR)

| Tier | Price | API Source | Resources | Best For |
|------|-------|------------|-----------|----------|
| **Trial** | Free (7 days) | Platform's limited Gemini | 512MB RAM, 5GB storage | Testing |
| **Starter** | ₹199/month | BYOK required | 1.5GB RAM, 10GB storage | Personal use |
| **Pro** | ₹499/month | BYOK required | 3GB RAM, 20GB storage | Power users |
| **Business** | ₹1,499/month | BYOK required | 4GB RAM, 50GB storage, priority support | Teams |

### API Key Requirements by Tier

```
Trial: Platform provides limited Gemini (rate-limited)
Starter+: User must provide one of:
  - Anthropic API key (recommended: Claude Sonnet 4.5)
  - Google Gemini API key (budget option)
  - OpenAI API key
```

### Platform Revenue Analysis

| Scenario | Monthly Users | Revenue | AI Costs | Net |
|----------|---------------|---------|----------|-----|
| 100 Starter | 100 | ₹19,900 | ₹0 (BYOK) | ₹19,900 |
| 50 Pro + 50 Starter | 100 | ₹34,900 | ₹0 (BYOK) | ₹34,900 |
| Infrastructure cost | - | - | ~₹8,000/month (2 VMs) | - |

---

## 3. OpenClaw Resource Requirements

### Per-Container Requirements

| Usage Level | RAM | CPU | Storage | Notes |
|-------------|-----|-----|---------|-------|
| Minimum | 1.5GB | 0.5 vCPU | 5GB | Light usage only |
| Recommended | 2GB | 1 vCPU | 10GB | Stable for daily use |
| Heavy | 4GB | 2 vCPU | 20GB | Multiple agents, browser automation |

### Current Container Settings
```bash
docker run --memory=1280m --memory-swap=1536m
NODE_OPTIONS="--max-old-space-size=1024"
```

### VM Capacity Planning

| VM Type | RAM | Containers (1.5GB each) | Monthly Cost |
|---------|-----|-------------------------|--------------|
| e2-medium | 4GB | 2 containers | ~$25 |
| e2-standard-2 | 8GB | 4-5 containers | ~$50 |
| e2-standard-4 | 16GB | 8-10 containers | ~$100 |
| e2-standard-8 | 32GB | 18-20 containers | ~$200 |

---

## 4. VM Auto-Scaling Strategy

### Approach: VM Pool with Load Balancer

Since GCP allows only 1 container per VM with the container-optimized approach, use a **VM pool strategy**:

```
                    ┌─────────────────┐
                    │   API Server    │
                    │   (molty VM)    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
         │openclaw2│   │openclaw3│   │openclaw4│
         │(active) │   │(standby)│   │(on-demand)│
         └─────────┘   └─────────┘   └─────────┘
```

### Auto-Scaling Implementation

**1. Monitoring Script (cron every 5 min)**
```bash
#!/bin/bash
# /opt/startclaw/scripts/check_capacity.sh

THRESHOLD_RAM_PERCENT=80
THRESHOLD_CONTAINERS=8

# Check current VM utilization
USED_RAM=$(free | awk '/Mem:/ {printf "%.0f", $3/$2 * 100}')
CONTAINER_COUNT=$(docker ps -q | wc -l)

if [ "$USED_RAM" -gt "$THRESHOLD_RAM_PERCENT" ] || [ "$CONTAINER_COUNT" -ge "$THRESHOLD_CONTAINERS" ]; then
    # Alert admin or trigger new VM creation
    curl -X POST "https://api.2openclaw.com/admin/scale-alert" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -d "{\"vm\": \"$(hostname)\", \"ram\": $USED_RAM, \"containers\": $CONTAINER_COUNT}"
fi
```

**2. VM Selection Logic (in api/server.js)**
```javascript
async function selectTargetVM() {
    const vms = await getVMStatus(); // Query all VMs

    // Find VM with most available capacity
    const available = vms
        .filter(vm => vm.containerCount < vm.maxContainers)
        .filter(vm => vm.ramUsedPercent < 80)
        .sort((a, b) => a.containerCount - b.containerCount);

    if (available.length === 0) {
        // All VMs full - alert admin
        await sendAdminAlert('All VMs at capacity!');
        throw new Error('No capacity available');
    }

    return available[0];
}
```

**3. Database Schema for Multi-VM**
```javascript
// instances.json or database
{
    "userId": "abc123",
    "vmHost": "openclaw2",  // Which VM hosts this container
    "vmIp": "34.131.95.162",
    "containerId": "openclaw-abc123",
    "createdAt": "2025-02-11T...",
    "expiresAt": null,  // null for paid, date for trial
    "tier": "starter",
    "status": "running"
}
```

### Future: Kubernetes Migration

When scale exceeds 50+ containers, migrate to GKE:
- Automatic pod scaling
- Better resource utilization
- Built-in health checks
- Rolling updates

---

## 5. Inactive Account Cleanup

### Policy

| Tier | Inactivity Period | Warning | Action |
|------|-------------------|---------|--------|
| Trial | 7 days | Day 5 email | Auto-delete |
| Starter | 30 days | Day 25 email | Suspend, delete after 14 more days |
| Pro/Business | 60 days | Day 50 email | Suspend only, manual review |

### Implementation

**1. Database Fields**
```javascript
{
    "userId": "...",
    "lastActivityAt": "2025-02-10T12:00:00Z",  // Updated on every message
    "status": "active" | "warned" | "suspended" | "deleted",
    "warningSentAt": null,
    "tier": "starter"
}
```

**2. Daily Cleanup Cron Script**
```bash
#!/bin/bash
# /opt/startclaw/scripts/cleanup_inactive.sh
# Run daily at 2am: 0 2 * * * /opt/startclaw/scripts/cleanup_inactive.sh

API_URL="http://localhost:3000"
API_SECRET="startclaw2024secret"

# Call API endpoint that handles cleanup logic
curl -X POST "$API_URL/admin/cleanup-inactive" \
    -H "Authorization: Bearer $API_SECRET" \
    -H "Content-Type: application/json"
```

**3. Cleanup API Endpoint**
```javascript
// Add to api/server.js
app.post('/admin/cleanup-inactive', authenticateAdmin, async (req, res) => {
    const instances = await loadInstances();
    const now = new Date();

    for (const [userId, instance] of Object.entries(instances)) {
        const lastActivity = new Date(instance.lastActivityAt);
        const daysSinceActivity = (now - lastActivity) / (1000 * 60 * 60 * 24);

        const thresholds = {
            'trial': { warn: 5, delete: 7 },
            'starter': { warn: 25, suspend: 30, delete: 44 },
            'pro': { warn: 50, suspend: 60, delete: null }
        };

        const t = thresholds[instance.tier] || thresholds.starter;

        if (daysSinceActivity >= t.delete && t.delete !== null) {
            await deleteInstance(userId);
            await sendEmail(instance.email, 'account_deleted');
        } else if (daysSinceActivity >= t.suspend && instance.status !== 'suspended') {
            await suspendInstance(userId);
            await sendEmail(instance.email, 'account_suspended');
        } else if (daysSinceActivity >= t.warn && instance.status === 'active') {
            await markWarned(userId);
            await sendEmail(instance.email, 'inactivity_warning', { daysLeft: t.suspend - daysSinceActivity });
        }
    }

    res.json({ status: 'cleanup completed' });
});
```

**4. Activity Tracking Webhook**
```javascript
// OpenClaw sends activity to gateway, forward to our API
// Add webhook in openclaw.json config or use gateway logs
// Update lastActivityAt on each user message
```

---

## 6. Backup Strategy

### Current Implementation
- Script: `/opt/startclaw/scripts/backup.sh`
- Schedule: Daily at 3am
- Storage: GCS bucket `gs://startclaw-backups/`
- Retention: 7 days local, 30 days GCS

### Enhanced Backup Plan

**1. Backup Types**
| Type | Frequency | Retention | Contents |
|------|-----------|-----------|----------|
| Full | Weekly (Sunday) | 90 days | All data + configs |
| Incremental | Daily | 30 days | Changed files only |
| Config-only | On change | 1 year | openclaw.json files |

**2. Pre-Backup Health Check**
```bash
# Check container is healthy before backup
docker exec $CONTAINER_ID node -e "console.log('healthy')" || {
    echo "Container unhealthy, skipping backup"
    exit 1
}
```

**3. Backup Verification**
```bash
# After backup, verify integrity
gsutil ls -l gs://startclaw-backups/$DATE/$USER_ID/ || {
    echo "Backup verification failed!"
    # Alert admin
}
```

---

## 7. Edge Cases & Error Handling

### 7.1 API Key Issues

| Issue | Detection | User Action | Platform Action |
|-------|-----------|-------------|-----------------|
| Invalid key | 401 on first request | Re-enter key | Show clear error message |
| Rate limited | 429 from provider | Upgrade AI plan | Suggest model switch |
| Quota exceeded | 429 persistent | Add billing | Pause bot, notify user |
| Key revoked | 401 after working | Generate new key | Disable bot, notify |

**Implementation:**
```javascript
// Wrap AI calls with error handling
async function makeAIRequest(message, config) {
    try {
        return await aiProvider.chat(message);
    } catch (error) {
        if (error.status === 401) {
            await notifyUser(config.userId, 'Your API key is invalid. Please update it in settings.');
            await pauseInstance(config.userId);
        } else if (error.status === 429) {
            await notifyUser(config.userId, 'Rate limit reached. Please wait or upgrade your AI provider plan.');
        }
        throw error;
    }
}
```

### 7.2 Container Crashes

| Scenario | Detection | Auto-Recovery | Escalation |
|----------|-----------|---------------|------------|
| OOM kill | Docker health check | Restart with more memory | Alert if 3+ restarts |
| Process exit | Health check fails | Auto-restart | Alert after 5 restarts |
| Stuck process | No response in 5 min | Force restart | Manual investigation |
| Disk full | Log monitoring | Clear old logs | Alert admin |

**Health Check Implementation:**
```yaml
# docker-compose.yml
healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 60s
```

**Auto-Recovery Script:**
```bash
#!/bin/bash
# /opt/startclaw/scripts/health_monitor.sh (cron every 5 min)

for container in $(docker ps -aq --filter "name=openclaw-"); do
    if ! docker exec $container curl -sf http://localhost:18789/health; then
        RESTART_COUNT=$(docker inspect $container --format='{{.RestartCount}}')
        if [ "$RESTART_COUNT" -lt 5 ]; then
            docker restart $container
            echo "Restarted $container (attempt $RESTART_COUNT)"
        else
            echo "ALERT: $container exceeded restart limit"
            # Send admin alert
        fi
    fi
done
```

### 7.3 Payment & Billing

| Scenario | Handling |
|----------|----------|
| Payment failed | Grace period (3 days), then suspend |
| Subscription cancelled | Run until period end, then suspend |
| Refund requested | Process within 7 days, delete data |
| Upgrade mid-cycle | Pro-rate, apply immediately |
| Downgrade mid-cycle | Apply at next billing cycle |

### 7.4 User Onboarding Failures

| Step | Failure Mode | Recovery |
|------|--------------|----------|
| Telegram token | Invalid format | Validate before submit, show BotFather link |
| API key | Wrong provider | Auto-detect provider from key prefix |
| Container start | Timeout | Retry 2x, then refund & alert |
| First message | No response | Check logs, offer support |

### 7.5 Data & Privacy

| Requirement | Implementation |
|-------------|----------------|
| Data deletion request | Delete within 72 hours, provide confirmation |
| Export data | API endpoint to download all user data |
| Encryption at rest | GCS bucket encryption enabled |
| Encryption in transit | HTTPS only, no HTTP |
| API key storage | Encrypted in config, never logged |

---

## 8. Monitoring & Alerts

### Metrics to Track

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| VM RAM usage | >70% | >85% | Scale up |
| VM disk usage | >70% | >90% | Cleanup + alert |
| Container restarts | >3/hour | >10/hour | Investigate |
| API latency | >2s | >5s | Check load |
| Failed provisions | >5% | >10% | Emergency fix |
| Payment failures | >5% | >15% | Check Stripe |

### Alerting Channels
1. **Telegram Bot** - Instant alerts to admin
2. **Email** - Daily summary reports
3. **Dashboard** - Real-time metrics (future)

---

## 9. Implementation Phases

### Phase 1: Core Platform (Current - 2 weeks)
- [x] Basic provisioning API
- [x] Single VM deployment
- [x] Claude API integration
- [ ] BYOK key validation
- [ ] Basic admin dashboard

### Phase 2: Reliability (2 weeks)
- [ ] Health monitoring scripts
- [ ] Auto-restart on crash
- [ ] Enhanced backup system
- [ ] Activity tracking

### Phase 3: Scaling (2 weeks)
- [ ] Multi-VM support
- [ ] VM selection logic
- [ ] Capacity monitoring
- [ ] Admin alerts

### Phase 4: User Experience (2 weeks)
- [ ] Inactive account cleanup
- [ ] Email notifications
- [ ] Usage dashboard
- [ ] Support ticketing

### Phase 5: Growth (Ongoing)
- [ ] Affiliate program
- [ ] API for developers
- [ ] White-label option
- [ ] Enterprise features

---

## 10. Files to Create/Modify

### New Files Needed

| File | Purpose | Location |
|------|---------|----------|
| `api/routes/admin.js` | Admin endpoints | molty VM |
| `api/services/cleanup.js` | Inactive account logic | molty VM |
| `api/services/monitoring.js` | Health checks | molty VM |
| `scripts/health_monitor.sh` | Container health | openclaw2 VM |
| `scripts/capacity_check.sh` | VM capacity | openclaw2 VM |
| `scripts/cleanup_inactive.sh` | Cleanup cron | openclaw2 VM |

### Files to Modify

| File | Changes |
|------|---------|
| `api/server.js` | Add admin routes, multi-VM support |
| `api/server.js` | Add activity tracking endpoint |
| `scripts/backup.sh` | Add verification, incremental backups |
| `infra/setup.sh` | Add monitoring tools installation |

---

## 11. Security Checklist

- [ ] API keys encrypted in database
- [ ] Admin endpoints require authentication
- [ ] Rate limiting on all endpoints
- [ ] Input validation on all user data
- [ ] SQL injection prevention (if using DB)
- [ ] CORS properly configured
- [ ] HTTPS enforced
- [ ] Secrets not in git
- [ ] Regular security audits
- [ ] Incident response plan

---

## 12. Cost Projections

### Infrastructure Costs (Monthly)

| Scale | VMs | GCS | Bandwidth | Total |
|-------|-----|-----|-----------|-------|
| 0-10 users | 1x e2-standard-2 | $5 | $5 | ~$60 |
| 10-50 users | 2x e2-standard-4 | $10 | $20 | ~$230 |
| 50-200 users | 4x e2-standard-4 | $25 | $50 | ~$475 |
| 200+ users | GKE cluster | $50 | $100 | ~$600+ |

### Break-Even Analysis

| Users | Revenue (₹199 avg) | Costs | Profit |
|-------|-------------------|-------|--------|
| 10 | ₹1,990 | ₹5,000 | -₹3,010 |
| 30 | ₹5,970 | ₹5,000 | +₹970 |
| 50 | ₹9,950 | ₹8,000 | +₹1,950 |
| 100 | ₹19,900 | ₹12,000 | +₹7,900 |

**Break-even: ~25-30 paying users**

---

## Sources

- [OpenClaw Hardware Requirements](https://boostedhost.com/blog/en/openclaw-hardware-requirements/)
- [Managed vs Self Hosting OpenClaw](https://xcloud.host/managed-vs-self-hosting-openclaw)
- [BYOK Pricing Models](https://kinde.com/learn/billing/billing-for-ai/byok-pricing/)
- [GCP Container Autoscaling](https://cloud.google.com/compute/docs/containers/)
- [SaaS Inactive Account Cleanup](https://saasalerts.com/why-stale-account-cleanup-is-important-and-how-to-do-it/)
- [OpenRouter BYOK Guide](https://openrouter.ai/docs/guides/overview/auth/byok)
