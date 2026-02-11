# 2OpenClaw - Project Context Document

> Last Updated: 2024-02-11
> For: Frontend development agent working in parallel

## Project Overview

**2OpenClaw** is a managed Telegram bot hosting platform. Users create AI-powered Telegram bots that run in isolated Docker containers on GCP.

**Business Model**: BYOK (Bring Your Own Key) - Users provide their own AI API keys (Gemini, OpenAI, or Anthropic) and pay us monthly for hosting infrastructure.

### Pricing Tiers
| Tier | Price | Resources |
|------|-------|-----------|
| Free Trial | ₹0 (7 days) | 1.5GB RAM |
| Starter | ₹199/mo | 1.5GB RAM |
| Pro | ₹499/mo | 3GB RAM |
| Business | ₹1,499/mo | 4GB RAM |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        VERCEL                                │
│  (Next.js 14 Frontend + API Routes)                         │
│                                                              │
│  - User-facing UI (onboarding, dashboard)                   │
│  - Razorpay payment processing (keys stored here)           │
│  - Proxies container management requests to GCP             │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (authenticated)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     GCP VM (34.131.95.162)                  │
│                                                              │
│  - Express.js API server (port 3000)                        │
│  - Docker container orchestration                            │
│  - User data storage (JSON files)                           │
│  - NO payment keys (security requirement)                   │
└─────────────────────────────────────────────────────────────┘
```

### Why This Split?
- **Security**: Razorpay API keys never touch GCP VM (where user bot code runs)
- **Separation of concerns**: Vercel handles payments, GCP handles compute

---

## Tech Stack

### Frontend (Vercel)
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Auth**: Telegram Login Widget (no traditional auth)
- **Payments**: Razorpay Subscriptions API
- **Deployment**: Vercel (auto-deploy on push to main)

### Backend (GCP)
- **Runtime**: Node.js + Express
- **Containers**: Docker (one per user bot)
- **Data**: JSON files at `/opt/2openclaw/data/users/{userId}.json`
- **Process Manager**: systemd (`openclaw-api.service`)

---

## Directory Structure

```
2openclaw/
├── web/                          # Next.js frontend (Vercel)
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── onboard/page.tsx      # Multi-step onboarding flow
│   │   ├── dashboard/page.tsx    # User dashboard
│   │   └── api/
│   │       ├── subscriptions/
│   │       │   ├── create/route.ts    # Creates Razorpay subscription
│   │       │   └── verify/route.ts    # Verifies payment signature
│   │       ├── webhooks/
│   │       │   └── razorpay/route.ts  # Razorpay webhook handler
│   │       └── [...proxy routes to GCP...]
│   ├── components/               # React components
│   ├── lib/
│   │   └── razorpay.ts          # Razorpay service (ALL payment logic)
│   └── public/
│
├── api/                          # Express backend (GCP VM)
│   ├── server.js                 # Main API server
│   ├── services/
│   │   └── docker.js            # Container management
│   └── package.json
│
├── bot/                          # Telegram bot template
│   └── [bot code that runs in containers]
│
└── CONTEXT.md                    # This file
```

---

## Current Implementation Status

### Completed ✅
- [x] Landing page
- [x] Onboarding flow (6 steps: Email → Create Bot → Token → User ID → AI Provider → Plan)
- [x] Telegram bot provisioning
- [x] Docker container management
- [x] Razorpay integration (customer, subscription, webhooks)
- [x] Payment signature verification (just fixed)
- [x] BYOK model with 3 AI providers

### In Progress 🔄
- [ ] Payment flow end-to-end testing
- [ ] Dashboard subscription management UI
- [ ] Plan upgrade/downgrade

### Not Started 📋
- [ ] Dashboard redesign
- [ ] Usage metrics display
- [ ] Bot analytics
- [ ] Mobile responsiveness improvements

---

## Key Files for Frontend Work

### Safe to Modify (no payment/backend logic)
```
web/app/page.tsx                  # Landing page
web/app/dashboard/page.tsx        # Dashboard (needs subscription UI)
web/components/*                  # All components
web/app/globals.css              # Global styles
```

### Avoid Modifying (payment flow in progress)
```
web/app/onboard/page.tsx         # Onboarding - payment integration active
web/lib/razorpay.ts              # Payment logic - being tested
web/app/api/subscriptions/*      # Payment API routes
web/app/api/webhooks/*           # Webhook handlers
```

---

## Environment Variables

### Vercel (Frontend)
```env
# Public (exposed to browser)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxx
NEXT_PUBLIC_API_URL=https://2openclaw.vercel.app

# Private (server-side only)
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
RAZORPAY_PLAN_STARTER=plan_xxx
RAZORPAY_PLAN_PRO=plan_xxx
RAZORPAY_PLAN_BUSINESS=plan_xxx
GCP_API_URL=http://34.131.95.162:3000
GCP_API_SECRET=xxx
```

### GCP VM (Backend)
```env
API_SECRET=xxx                    # Must match GCP_API_SECRET on Vercel
DATA_DIR=/opt/2openclaw/data
PORT=3000
```

---

## User Data Model

Location: `/opt/2openclaw/data/users/{odinseid-based-id}.json`

```json
{
  "odinseid": "e580c03e93c6e12e",
  "odinseTelegramId": "123456789",
  "email": "user@example.com",
  "botToken": "123456:ABC-xxx",
  "aiProvider": "gemini",
  "aiApiKey": "encrypted-key",
  "plan": "starter",
  "subscriptionStatus": "ACTIVE",
  "razorpayCustomerId": "cust_xxx",
  "razorpaySubscriptionId": "sub_xxx",
  "containerStatus": "running",
  "createdAt": "2024-02-11T10:00:00Z"
}
```

### Subscription Status Values
- `TRIAL` - Free trial period
- `PENDING` - Subscription created, awaiting payment
- `ACTIVE` - Paid and active
- `PAST_DUE` - Payment failed, in grace period
- `SUSPENDED` - Container stopped due to non-payment
- `CANCELLED` - User cancelled

---

## API Endpoints

### Vercel API Routes (web/app/api/)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/subscriptions/create` | POST | Create Razorpay subscription |
| `/api/subscriptions/verify` | POST | Verify payment signature |
| `/api/webhooks/razorpay` | POST | Handle Razorpay webhooks |
| `/api/users/[userId]` | GET | Get user data (proxies to GCP) |
| `/api/provision` | POST | Provision container (proxies to GCP) |

### GCP API (api/server.js)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/provision` | POST | Create user + container |
| `/users/:userId` | GET | Get user data |
| `/subscriptions/update-status` | POST | Update subscription status |
| `/containers/:userId/start` | POST | Start container |
| `/containers/:userId/stop` | POST | Stop container |

---

## Development Workflow

### Local Development
```bash
# Frontend
cd web
npm install
npm run dev    # http://localhost:3001

# Backend (requires GCP VM access)
# Changes must be deployed via git push + SSH
```

### Deployment
- **Frontend**: Auto-deploys on push to `main` via Vercel
- **Backend**: Manual deploy via:
  ```bash
  gcloud compute ssh --zone=asia-south2-c openclaw2 --command="cd /opt/2openclaw/api && sudo git pull && sudo systemctl restart openclaw-api"
  ```

### Branching Strategy for Parallel Work
```
main                    # Production
├── feature/frontend-*  # Frontend improvements (safe)
└── feature/payments-*  # Payment flow (in progress)
```

---

## Design Guidelines

### Current UI Style
- Dark theme with gradients
- Primary color: Blue/Purple gradient
- Cards with subtle borders and shadows
- Minimalist, modern aesthetic

### Components Used
- Custom components (no UI library)
- Tailwind CSS for styling
- Framer Motion for animations (optional)

---

## Known Issues / Tech Debt

1. **No loading states**: Many actions lack proper loading indicators
2. **Error handling**: Generic error messages, could be more user-friendly
3. **Mobile**: Not fully responsive
4. **Dashboard**: Needs subscription management UI (upgrade, cancel, billing history)
5. **No tests**: No unit or integration tests

---

## Contact / Resources

- **Repo**: github.com/kairothq/2openclaw
- **Vercel Dashboard**: vercel.com/divys-projects-a4af20de/2openclaw
- **Razorpay Dashboard**: dashboard.razorpay.com (test mode)
- **GCP Project**: [project details]

---

## For the Frontend Agent

### Recommended Tasks
1. **Dashboard Subscription UI**: Show current plan, next billing date, upgrade/cancel buttons
2. **Loading States**: Add spinners/skeletons during API calls
3. **Error Handling**: Better error messages and retry options
4. **Mobile Responsiveness**: Test and fix mobile layouts
5. **Landing Page**: Improve hero section, add testimonials/features

### Do NOT Touch
- Payment flow (onboard/page.tsx payment section)
- Razorpay integration (lib/razorpay.ts)
- Webhook handlers
- Any API routes under `/api/subscriptions/` or `/api/webhooks/`

### Branch Naming
Use `feature/frontend-{description}` for your work. Example:
- `feature/frontend-dashboard-subscription-ui`
- `feature/frontend-mobile-responsive`
