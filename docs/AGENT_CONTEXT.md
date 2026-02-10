# 2OpenClaw - Complete Project Context for AI Agents

> Last Updated: 2026-02-11
> This document provides full context for AI agents to continue development.

---

## Project Overview

**2OpenClaw** is a managed hosting platform for [OpenClaw](https://github.com/pspdfkit-labs/openclaw) (also known as Clawdbot) - an AI assistant that runs on Telegram.

**Business Model**: Users deploy their own AI Telegram bots with their own API keys (BYOK - Bring Your Own Key). We provide the infrastructure.

**Current Status**: MVP is functional. Users can deploy bots that respond on Telegram.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vercel)                        │
│                    https://2openclaw.vercel.app                  │
│                                                                   │
│  - Next.js app in /web folder                                    │
│  - Deployment form collects: Telegram token, AI provider, API key│
│  - Calls backend API at GCP_API_URL                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTPS POST /provision
                                │ Header: X-API-Key
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (GCP VM: openclaw2)                   │
│                    IP: 34.131.95.162                             │
│                    Zone: asia-south2-c                           │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ 2openclaw-api   │  │ 2openclaw-      │  │ caddy           │  │
│  │ (systemd)       │  │ watcher         │  │ (systemd)       │  │
│  │                 │  │ (systemd)       │  │                 │  │
│  │ - POST /provision│  │ - Docker events │  │ - HTTPS/TLS    │  │
│  │ - Caddy API     │  │ - Instant       │  │ - Reverse proxy│  │
│  │ - User mgmt     │  │   recovery      │  │ - Auto certs   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Docker Containers                         ││
│  │                                                              ││
│  │  openclaw-{userId}  openclaw-{userId}  openclaw-{userId}    ││
│  │       :18001             :18002             :18003           ││
│  │                                                              ││
│  │  Each container:                                             ││
│  │  - Runs ghcr.io/openclaw/openclaw:latest (6.2GB)            ││
│  │  - 1.5GB RAM limit, 1 CPU                                   ││
│  │  - Bind mount: /opt/2openclaw/data/instances/{userId}       ││
│  │  - Config at: /home/node/.openclaw/openclaw.json            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                   │
│  Data Storage:                                                   │
│  /opt/2openclaw/                                                 │
│  ├── api/          <- Git repo (this repo)                      │
│  ├── data/                                                       │
│  │   ├── users/    <- User metadata JSON files                  │
│  │   ├── instances/<- Container data directories                │
│  │   └── ports.json<- Port assignments                          │
│  └── scripts/      <- Deployed bash scripts                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files & Their Purposes

### Backend API (`/api`)
| File | Purpose |
|------|---------|
| `server.js` | Main Express API - provisioning, management, admin endpoints |
| `middleware/validation.js` | Input validation for provisioning requests |
| `middleware/rateLimit.js` | Rate limiting configuration |
| `services/cleanup.js` | Inactive account cleanup service |
| `services/vmSelector.js` | Multi-VM selection (for future scaling) |

### Infrastructure Scripts (`/infra/scripts`)
| File | Purpose |
|------|---------|
| `container-watcher.sh` | **INSTANT RECOVERY** - Docker event listener |
| `health_monitor.sh` | Cron-based health check (backup to watcher) |
| `backup.sh` | Daily backup to GCS |
| `capacity_check.sh` | VM capacity monitoring |
| `cleanup_inactive.sh` | Remove inactive free-tier users |
| `restore.sh` | Restore user from backup |

### Systemd Services (`/infra/systemd`)
| File | Purpose |
|------|---------|
| `2openclaw-api.service` | Main API server |
| `2openclaw-watcher.service` | Container watcher daemon |

### Documentation (`/docs`)
| File | Purpose |
|------|---------|
| `PRD.md` | Product Requirements Document |
| `SETUP.md` | Infrastructure setup guide |
| `CLOUD_AGNOSTIC.md` | Multi-cloud deployment guide |
| `LESSONS_LEARNED.md` | OpenClaw config schema details |
| `NAME_MIGRATION.md` | Rename from startclaw to 2openclaw |
| `AGENT_CONTEXT.md` | This file - AI agent handoff |

### Frontend (`/web`)
- Next.js 14 app
- Deployment form at `/deploy`
- Calls `POST /api/provision` which proxies to backend

---

## Current Server State

### VM: openclaw2
- **IP**: 34.131.95.162
- **Zone**: asia-south2-c
- **Specs**: e2-standard-2 (2 vCPU, 8GB RAM)
- **OS**: Ubuntu 22.04

### Running Services
```bash
# Check status
sudo systemctl status 2openclaw-api      # API server
sudo systemctl status 2openclaw-watcher  # Container watcher
sudo systemctl status caddy              # Reverse proxy
```

### Cron Jobs
```
*/5 * * * *  /opt/2openclaw/scripts/health_monitor.sh
*/15 * * * * /opt/2openclaw/scripts/capacity_check.sh
0 3 * * *    /opt/2openclaw/scripts/backup.sh
0 2 * * *    /opt/2openclaw/scripts/cleanup_inactive.sh
```

---

## Environment Variables

### On Vercel (Frontend)
```
GCP_API_URL=http://34.131.95.162:3000
GCP_API_SECRET=startclaw2024secret
```

### On Server (`/opt/2openclaw/api/.env`)
```
API_SECRET=startclaw2024secret
PORT=3000
GROQ_API_KEY=<for free tier fallback>
GEMINI_API_KEY=<for free tier fallback>
```

---

## What's DONE (Implemented & Working)

### Phase 0: Foundation
- [x] Project structure and documentation
- [x] Name migration (startclaw → 2openclaw)
- [x] Docker image path fixed (`ghcr.io/openclaw/openclaw:latest`)

### Phase 1: Core Provisioning
- [x] API endpoint `POST /provision`
- [x] Container creation with correct OpenClaw config
- [x] Caddy route management (now using Caddy API)
- [x] User data storage
- [x] Port assignment

### Phase 2: Reliability
- [x] Input validation middleware
- [x] Rate limiting
- [x] Health monitoring (cron-based)
- [x] **Instant recovery** (Docker event watcher)
- [x] Self-healing for deleted containers
- [x] Admin endpoints for management

### Infrastructure
- [x] Systemd service for API
- [x] Systemd service for container watcher
- [x] Proper Caddy API integration
- [x] Log rotation

---

## What's LEFT TO DO

### Phase 3: User Experience
- [ ] Email notifications (SendGrid/Resend)
  - Welcome email on signup
  - Expiry warnings (3 days, 1 day before)
  - Bot status notifications
- [ ] Frontend improvements
  - Dashboard showing bot status
  - Usage metrics display
  - Renewal/upgrade UI

### Phase 4: Monetization
- [ ] Razorpay integration for Indian payments
  - Webhook handler for payment confirmation
  - Plan upgrade endpoint
  - Subscription management
- [ ] Pricing tiers:
  - Free: 7 days, 1536MB RAM
  - Pro (₹299/mo): 30 days, 2GB RAM, priority support
  - Business (₹999/mo): Unlimited, 4GB RAM, custom domain

### Phase 5: Scaling
- [ ] Multi-VM support (vmSelector.js exists but not used)
- [ ] Load balancer setup
- [ ] Database for user management (currently JSON files)
- [ ] CI/CD pipeline (GitHub Actions)

### Phase 6: Polish
- [ ] Custom domain support for users
- [ ] Backup/restore UI
- [ ] Analytics dashboard
- [ ] Telegram notifications for admins

---

## Known Issues & Solutions

### Issue: Bot takes 2-3 minutes to respond after deployment
**Cause**: Normal - container startup + Telegram polling + AI warm-up
**Solution**: Inform users to wait 1-2 minutes

### Issue: Container recovery assigns wrong port
**Cause**: JSON parsing didn't handle space after colon
**Solution**: Fixed - uses `grep -oE '"port":\s*[0-9]+'`

### Issue: Caddyfile gets corrupted by sed
**Cause**: Using file manipulation instead of API
**Solution**: Fixed - now uses Caddy Admin API

### Issue: Duplicate log entries in watcher
**Cause**: Bash pipe creates subshell
**Solution**: Cosmetic only, doesn't affect functionality

---

## How to Deploy Changes

```bash
# On local machine
git add -A && git commit -m "Description" && git push origin main

# On server (SSH)
gcloud compute ssh openclaw2 --zone=asia-south2-c

# Pull and deploy
cd /opt/2openclaw/api && sudo git pull origin main

# Update scripts
sudo cp /opt/2openclaw/api/infra/scripts/*.sh /opt/2openclaw/scripts/
sudo chmod +x /opt/2openclaw/scripts/*.sh

# Restart services if needed
sudo systemctl restart 2openclaw-api
sudo systemctl restart 2openclaw-watcher
```

---

## API Endpoints Reference

### Public (with X-API-Key header)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Health check |
| POST | `/provision` | Create new bot instance |
| GET | `/instances` | List all instances |
| GET | `/instances/:userId` | Get instance details |
| POST | `/instances/:userId/restart` | Restart instance |
| POST | `/instances/:userId/stop` | Stop instance |
| POST | `/instances/:userId/start` | Start instance |
| DELETE | `/instances/:userId` | Delete instance |
| GET | `/instances/:userId/logs` | Get container logs |
| GET | `/instances/:userId/stats` | Get container stats |
| POST | `/validate/telegram` | Validate Telegram token |
| POST | `/validate/api-key` | Validate AI API key |

### Admin (with Bearer token)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/admin/instances` | List all with details |
| GET | `/admin/health` | System health overview |
| GET | `/admin/capacity` | VM capacity info |
| POST | `/admin/cleanup-inactive` | Trigger cleanup |
| POST | `/admin/instances/:userId/action` | Admin actions |

### Webhooks
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/webhooks/activity` | Track bot activity |

---

## OpenClaw Config Schema

**CRITICAL**: OpenClaw has specific config requirements. See `/docs/LESSONS_LEARNED.md`.

Key points:
1. Config file: `/home/node/.openclaw/openclaw.json` (NOT in config subfolder)
2. API keys go in `env.vars`, NOT `providers`
3. Telegram uses `botToken`, NOT `token`
4. Both `channels.telegram.enabled` AND `plugins.entries.telegram.enabled` must be true
5. `gateway.mode` must be `"local"`

---

## Useful Commands

```bash
# SSH to server
gcloud compute ssh openclaw2 --zone=asia-south2-c

# View running containers
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

# View container logs
docker logs openclaw-{userId} --tail 100

# Check API logs
sudo journalctl -u 2openclaw-api -f

# Check watcher logs
tail -f /var/log/2openclaw/watcher.log

# Check Caddy routes
curl -s http://localhost:2019/config/apps/http/servers/srv0/routes | python3 -m json.tool

# Manual container recovery
docker run -d --name openclaw-{userId} --restart unless-stopped \
  -v /opt/2openclaw/data/instances/{userId}:/home/node/.openclaw \
  -p {port}:18789 --memory="1536m" --cpus="1" \
  -e NODE_OPTIONS="--max-old-space-size=1280" \
  ghcr.io/openclaw/openclaw:latest
```

---

## Repository Structure

```
2openclaw/
├── api/
│   ├── server.js              # Main API
│   ├── package.json
│   ├── middleware/
│   │   ├── validation.js
│   │   └── rateLimit.js
│   └── services/
│       ├── cleanup.js
│       └── vmSelector.js
├── web/                        # Next.js frontend
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── deploy/
│   │   │   └── page.tsx       # Deployment form
│   │   └── api/
│   │       └── provision/
│   │           └── route.ts   # API proxy
│   └── package.json
├── infra/
│   ├── scripts/
│   │   ├── container-watcher.sh
│   │   ├── health_monitor.sh
│   │   ├── backup.sh
│   │   ├── capacity_check.sh
│   │   ├── cleanup_inactive.sh
│   │   └── restore.sh
│   ├── systemd/
│   │   ├── 2openclaw-api.service
│   │   └── 2openclaw-watcher.service
│   └── docker-compose.yml
├── docs/
│   ├── PRD.md
│   ├── SETUP.md
│   ├── CLOUD_AGNOSTIC.md
│   ├── LESSONS_LEARNED.md
│   ├── NAME_MIGRATION.md
│   └── AGENT_CONTEXT.md       # This file
└── README.md
```

---

## Contact & Resources

- **GitHub**: https://github.com/kairothq/2openclaw
- **OpenClaw Repo**: https://github.com/pspdfkit-labs/openclaw
- **Docker Image**: ghcr.io/openclaw/openclaw:latest
- **Vercel Dashboard**: https://vercel.com (for frontend)
- **GCP Console**: https://console.cloud.google.com (for VM)

---

*This document should give any AI agent complete context to continue development.*
