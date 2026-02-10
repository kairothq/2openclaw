# 2OpenClaw - Product Requirements Document (PRD)

**Version**: 1.0
**Last Updated**: February 11, 2026
**Author**: Development Team
**Status**: In Development

---

## 1. Product Overview

### 1.1 Vision
2OpenClaw is a managed hosting platform that enables non-technical users in India to deploy personal AI assistants via Telegram in under 60 seconds.

### 1.2 Problem Statement
- OpenClaw (Clawdbot) is powerful but requires technical expertise to deploy
- Self-hosting requires Docker knowledge, VPS management, API configuration
- Free tier AI APIs don't work with OpenClaw (system prompt exceeds TPM limits)
- No India-focused managed hosting exists at affordable price points

### 1.3 Solution
A fully managed platform where users:
1. Enter Telegram bot token
2. Provide their own API key (BYOK model)
3. Get a working AI assistant in 60 seconds

### 1.4 Target Users
- **Primary**: Non-technical users in India wanting personal AI assistants
- **Secondary**: Small businesses wanting customer service bots
- **Tertiary**: Developers wanting quick OpenClaw deployments

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS                                    │
│    Telegram Bot ←→ User Device                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                            │
│    2openclaw.vercel.app                                         │
│    - Landing page                                                │
│    - Onboarding wizard                                          │
│    - User dashboard                                              │
│    - Billing management                                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API SERVER (molty VM)                        │
│    IP: Internal / Load Balanced                                 │
│    - /provision - Create new instances                          │
│    - /instances - List/manage instances                         │
│    - /admin/* - Admin operations                                │
│    - /webhooks/* - Payment, activity webhooks                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Internal Network
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                 CONTAINER HOSTS (openclaw2, 3, 4...)            │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ openclaw-    │ │ openclaw-    │ │ openclaw-    │            │
│  │ user123      │ │ user456      │ │ user789      │            │
│  │ (1.5GB RAM)  │ │ (1.5GB RAM)  │ │ (1.5GB RAM)  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                  │
│  Caddy Reverse Proxy → *.nip.io subdomains                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                            │
│    - Anthropic API (Claude)                                     │
│    - Google AI (Gemini)                                         │
│    - OpenAI API                                                 │
│    - Telegram Bot API                                           │
│    - Stripe/Razorpay (Payments)                                 │
│    - GCS (Backups)                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Current Infrastructure

| Component | Host | IP | Purpose |
|-----------|------|-----|---------|
| API Server | molty VM | Internal | Provisioning API |
| Container Host | openclaw2 | 34.131.95.162 | User containers |
| Frontend | Vercel | 2openclaw.vercel.app | Web interface |
| Backups | GCS | gs://2openclaw-backups/ | Data storage |

### 2.3 Data Flow

```
1. USER ONBOARDING:
   Browser → Vercel → API Server → Container Host → Docker Container

2. TELEGRAM MESSAGE:
   User Phone → Telegram → Bot → Container → AI Provider → Response → User

3. BACKUP:
   Cron → Container Data → GCS Bucket

4. BILLING:
   Razorpay Webhook → API Server → Update User Status → Enable/Disable Container
```

---

## 3. Functional Requirements

### 3.1 User Onboarding (FR-001)

**Description**: New user registration and bot setup flow

**Steps**:
1. User visits 2openclaw.vercel.app
2. Clicks "Get Started"
3. Enters email address
4. Receives OTP, verifies email
5. Follows guided setup:
   - Step 1: Create Telegram bot via BotFather (with video guide)
   - Step 2: Enter bot token
   - Step 3: Select AI provider (Anthropic recommended)
   - Step 4: Enter API key
   - Step 5: Enter Telegram user ID (for allowlist)
6. System provisions container
7. User sends first message to bot
8. Success screen with next steps

**Acceptance Criteria**:
- [ ] Total flow < 60 seconds (after BotFather setup)
- [ ] Clear error messages for invalid inputs
- [ ] Progress indicator shows current step
- [ ] Video tutorials embedded for complex steps
- [ ] Fallback to manual support if provisioning fails

**Edge Cases**:
| Case | Handling |
|------|----------|
| Invalid bot token | Validate format, test with Telegram API |
| Bot token already in use | Show error, suggest creating new bot |
| Invalid API key | Test with provider before saving |
| API key has no credits | Warn user, allow proceed |
| Telegram ID wrong format | Validate numeric, show how to find |
| Container fails to start | Retry 2x, then refund + alert admin |
| Duplicate email | Show login option |

---

### 3.2 Instance Management (FR-002)

**Description**: User can view and manage their bot instance

**Features**:
- View bot status (running/stopped/error)
- View usage statistics (messages today/week/month)
- Update API key
- Update allowed Telegram users
- Restart bot
- View recent logs (sanitized)
- Delete account

**API Endpoints**:
```
GET    /instances/:userId          - Get instance details
PATCH  /instances/:userId/config   - Update configuration
POST   /instances/:userId/restart  - Restart container
DELETE /instances/:userId          - Delete instance
GET    /instances/:userId/logs     - Get recent logs
GET    /instances/:userId/stats    - Get usage statistics
```

**Edge Cases**:
| Case | Handling |
|------|----------|
| Container not responding | Show "Restarting..." status, auto-restart |
| User changes API key to invalid | Validate before applying |
| User removes all allowed IDs | Prevent, require at least 1 |
| Container stuck restarting | Alert admin after 3 attempts |

---

### 3.3 Billing & Subscriptions (FR-003)

**Description**: Payment processing and subscription management

**Tiers**:
| Tier | Price | Trial | Resources |
|------|-------|-------|-----------|
| Trial | Free | 7 days | 1536MB RAM, 5GB storage |
| Starter | ₹199/mo | - | 1.5GB RAM, 10GB storage |
| Pro | ₹499/mo | - | 3GB RAM, 20GB storage |
| Business | ₹1,499/mo | - | 4GB RAM, 50GB storage |

**Payment Flow**:
1. User selects plan
2. Redirected to Razorpay checkout
3. On success: webhook updates user status
4. Container resources adjusted if needed
5. Confirmation email sent

**Subscription States**:
```
TRIAL → ACTIVE → PAST_DUE → SUSPENDED → CANCELLED
                    ↓
              (payment retry)
                    ↓
                 ACTIVE
```

**Edge Cases**:
| Case | Handling |
|------|----------|
| Payment fails | 3-day grace period, then suspend |
| Card expired | Email notification, 7 days to update |
| Refund requested | Process within 7 days, delete data |
| Upgrade mid-cycle | Pro-rate immediately |
| Downgrade mid-cycle | Apply at next billing cycle |
| Chargeback | Suspend immediately, investigate |
| Trial expires | Show upgrade prompt, suspend after 24h |

---

### 3.4 Admin Dashboard (FR-004)

**Description**: Internal admin tools for platform management

**Features**:
- View all instances with status
- View system health (VM RAM, disk, containers)
- Manual instance operations (restart, delete, suspend)
- View payment history
- Send announcements to users
- View error logs
- Capacity planning metrics

**Endpoints**:
```
GET    /admin/instances           - List all instances
GET    /admin/health              - System health metrics
POST   /admin/instances/:id/action - Perform action
GET    /admin/payments            - Payment history
POST   /admin/announcements       - Send announcement
GET    /admin/logs                - Error logs
GET    /admin/capacity            - Capacity metrics
```

---

### 3.5 Inactive Account Cleanup (FR-005)

**Description**: Automatic cleanup of inactive accounts

**Policy**:
| Tier | Warn At | Suspend At | Delete At |
|------|---------|------------|-----------|
| Trial | Day 5 | Day 7 | Day 7 |
| Starter | Day 25 | Day 30 | Day 44 |
| Pro | Day 50 | Day 60 | Never (manual) |
| Business | Day 50 | Day 60 | Never (manual) |

**Process**:
1. Track `lastActivityAt` on each message
2. Daily cron checks all instances
3. Send warning email at threshold
4. Suspend container (stop but keep data)
5. Send final warning email
6. Delete container and data
7. Send deletion confirmation

**Edge Cases**:
| Case | Handling |
|------|----------|
| User replies to warning | Reset inactivity counter |
| User on vacation | Can request pause via support |
| Data deletion fails | Retry 3x, alert admin |
| User wants data back | Not possible after deletion (warn clearly) |

---

### 3.6 Multi-VM Scaling (FR-006)

**Description**: Distribute containers across multiple VMs

**VM Selection Logic**:
```javascript
function selectVM(vms) {
    return vms
        .filter(vm => vm.status === 'healthy')
        .filter(vm => vm.containerCount < vm.maxContainers)
        .filter(vm => vm.ramUsedPercent < 80)
        .sort((a, b) => a.containerCount - b.containerCount)[0];
}
```

**Capacity Thresholds**:
| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| RAM | 70% | 85% | Alert, no new containers |
| Disk | 70% | 90% | Cleanup logs, alert |
| Containers | 80% of max | 100% | Alert, provision new VM |

**Edge Cases**:
| Case | Handling |
|------|----------|
| All VMs full | Reject new signups, alert admin |
| VM goes offline | Mark unhealthy, don't assign new |
| Container on dead VM | Auto-migrate to healthy VM |
| Network partition | Health checks detect, alert |

---

## 4. Non-Functional Requirements

### 4.1 Performance (NFR-001)
- API response time < 500ms (p95)
- Container start time < 30 seconds
- Bot response time < 5 seconds (excluding AI latency)

### 4.2 Availability (NFR-002)
- 99.5% uptime target
- Maximum planned downtime: 4 hours/month
- Auto-recovery from container crashes

### 4.3 Security (NFR-003)
- All API keys encrypted at rest
- HTTPS only (no HTTP)
- Rate limiting on all endpoints
- Input validation on all user data
- No secrets in logs or git
- Regular security audits

### 4.4 Scalability (NFR-004)
- Support 100 concurrent users on single VM
- Linear scaling with additional VMs
- Database-ready architecture for future migration

### 4.5 Data Protection (NFR-005)
- Daily backups to GCS
- 30-day backup retention
- Data deletion within 72 hours of request
- GDPR-compliant data export

---

## 5. Technical Specifications

### 5.1 API Server (Node.js)

**File Structure**:
```
api/
├── server.js           # Main entry point
├── routes/
│   ├── instances.js    # Instance management
│   ├── admin.js        # Admin endpoints
│   ├── webhooks.js     # Payment/activity webhooks
│   └── health.js       # Health checks
├── services/
│   ├── docker.js       # Docker operations
│   ├── provisioning.js # Instance provisioning
│   ├── cleanup.js      # Inactive account cleanup
│   ├── monitoring.js   # Health monitoring
│   ├── email.js        # Email notifications
│   └── payments.js     # Payment processing
├── middleware/
│   ├── auth.js         # Authentication
│   ├── rateLimit.js    # Rate limiting
│   └── validation.js   # Input validation
├── utils/
│   ├── encryption.js   # API key encryption
│   ├── logger.js       # Logging utility
│   └── config.js       # Configuration
└── data/
    └── instances.json  # Instance database (migrate to DB later)
```

### 5.2 Container Configuration

**Docker Run Command**:
```bash
docker run -d \
    --name openclaw-${USER_ID} \
    --memory=1536m \
    --memory-swap=2g \
    --cpus=1 \
    --restart=unless-stopped \
    -e NODE_OPTIONS="--max-old-space-size=1280" \
    -v /opt/2openclaw/data/instances/${USER_ID}:/home/node/.openclaw \
    --health-cmd="curl -sf http://localhost:18789/health || exit 1" \
    --health-interval=30s \
    --health-timeout=10s \
    --health-retries=3 \
    ghcr.io/pspdfkit-labs/openclaw:latest
```

**OpenClaw Config Schema** (`openclaw.json`):
```json
{
    "env": {
        "vars": {
            "ANTHROPIC_API_KEY": "sk-ant-...",
            "OPENAI_API_KEY": "sk-...",
            "GOOGLE_API_KEY": "AIza..."
        }
    },
    "agents": {
        "defaults": {
            "model": {
                "primary": "anthropic/claude-sonnet-4-5"
            },
            "compaction": {
                "reserveTokensFloor": 4000
            }
        }
    },
    "channels": {
        "telegram": {
            "enabled": true,
            "botToken": "123456:ABC...",
            "allowFrom": ["user_telegram_id"],
            "dmPolicy": "allowlist"
        }
    },
    "gateway": {
        "mode": "local",
        "port": 18789,
        "auth": {
            "mode": "token",
            "token": "random_gateway_token"
        }
    },
    "plugins": {
        "entries": {
            "telegram": {
                "enabled": true
            }
        }
    }
}
```

### 5.3 Database Schema (Future)

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    tier VARCHAR(20) DEFAULT 'trial',
    status VARCHAR(20) DEFAULT 'active',
    stripe_customer_id VARCHAR(255),
    last_activity_at TIMESTAMP,
    warning_sent_at TIMESTAMP
);

-- Instances table
CREATE TABLE instances (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    vm_host VARCHAR(100) NOT NULL,
    container_id VARCHAR(100),
    telegram_bot_token_encrypted TEXT,
    ai_provider VARCHAR(50),
    api_key_encrypted TEXT,
    telegram_user_ids TEXT[], -- Array of allowed IDs
    status VARCHAR(20) DEFAULT 'running',
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP -- NULL for paid
);

-- Activity logs
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY,
    instance_id UUID REFERENCES instances(id),
    event_type VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    amount_cents INTEGER,
    currency VARCHAR(3),
    status VARCHAR(20),
    provider_payment_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.4 Cron Jobs

| Job | Schedule | Script | Purpose |
|-----|----------|--------|---------|
| Backup | 3am daily | backup.sh | Backup all instances |
| Cleanup | 2am daily | cleanup_inactive.sh | Remove inactive accounts |
| Health | Every 5min | health_monitor.sh | Check container health |
| Capacity | Every 15min | capacity_check.sh | Monitor VM capacity |
| Expire trials | Midnight | expire_trials.sh | Suspend expired trials |

---

## 6. Implementation Checklist

### Phase 1: Core Fixes (DONE)
- [x] Fix API key configuration format
- [x] Fix model format (anthropic/claude-sonnet-4-5)
- [x] Test with Claude API key
- [x] Document learnings in SETUP_CONTEXT.md

### Phase 2: Reliability
- [ ] Add health monitoring script
- [ ] Add auto-restart on container crash
- [ ] Add activity tracking (lastActivityAt)
- [ ] Implement proper logging
- [ ] Add input validation middleware
- [ ] Add rate limiting

### Phase 3: User Features
- [ ] Implement inactive account cleanup
- [ ] Add email notification service
- [ ] Build user dashboard (view status, logs)
- [ ] Implement config update endpoint
- [ ] Add restart endpoint

### Phase 4: Billing
- [ ] Integrate Razorpay
- [ ] Implement webhook handlers
- [ ] Add subscription state management
- [ ] Implement grace period logic
- [ ] Add upgrade/downgrade flow

### Phase 5: Scaling
- [ ] Add VM health tracking
- [ ] Implement VM selection logic
- [ ] Add capacity monitoring
- [ ] Set up admin alerts
- [ ] Document VM provisioning process

### Phase 6: Admin
- [ ] Build admin dashboard
- [ ] Add manual intervention tools
- [ ] Implement announcement system
- [ ] Add metrics/analytics

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API wallet drain (runaway loops) | Medium | High | Set spending alerts, educate users |
| Container breakout | Low | Critical | Use rootless containers, regular updates |
| Data breach | Low | Critical | Encryption, access controls, audits |
| VM failure | Medium | High | Auto-recovery, backups, multi-VM |
| Payment fraud | Medium | Medium | Razorpay fraud detection |
| DDoS attack | Low | Medium | Cloudflare, rate limiting |
| OpenClaw breaking changes | Medium | High | Pin versions, test before update |

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Onboarding completion rate | >80% | Completed setups / started |
| Time to first message | <2 min | Timestamp difference |
| Trial to paid conversion | >10% | Conversions / trials |
| Monthly churn | <5% | Cancellations / active |
| Support tickets | <5% of users | Tickets / active users |
| Uptime | >99.5% | Monitoring data |

---

## 9. Glossary

| Term | Definition |
|------|------------|
| BYOK | Bring Your Own Key - users provide their own AI API keys |
| OpenClaw | Open-source AI assistant platform (formerly Clawdbot/MoltBot) |
| Container | Docker container running a single user's OpenClaw instance |
| VM | Google Cloud virtual machine hosting containers |
| Gateway | OpenClaw's internal API server (port 18789) |
| TPM | Tokens per minute - rate limit for AI APIs |

---

## 10. Appendix

### A. Test Credentials (Development Only)
```
Test Telegram Bot: @mimi_dad5_bot
Test User ID: 6745036205
Test Instance: 1728651bf1ba79a7
```

### B. Important URLs
```
Frontend: https://2openclaw.vercel.app
API (prod): http://34.131.95.162:3000
GitHub: https://github.com/kairothq/2openclaw
```

### C. SSH Access
```bash
# Development VM
gcloud compute ssh molty --zone=asia-south1-a

# Production VM
gcloud compute ssh openclaw2 --zone=asia-south2-c
```
