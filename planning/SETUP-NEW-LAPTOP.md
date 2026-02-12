# 2OpenClaw - New Laptop Setup Guide

Complete guide to setting up and running the landing page + dashboard redesign on a new laptop.

---

## Prerequisites to Install

### 1. Install Homebrew (if not already installed)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install Git
```bash
brew install git
```

### 3. Install Node.js (v18 or higher)
```bash
brew install node

# Verify installation
node --version  # Should be v18+
npm --version
```

### 4. Install jq (JSON processor for Ralph script)
```bash
brew install jq
```

### 5. Install Claude Code (if you want to use it for implementation)
```bash
npm install -g @anthropic-ai/claude-code
```

---

## Step 1: Clone the Repository

```bash
# Clone from GitHub
git clone https://github.com/kairothq/2openclaw.git

# Navigate to project
cd 2openclaw
```

---

## Step 2: Install Dependencies

### Backend (API Server)
```bash
cd api
npm install
cd ..
```

### Frontend (Web)
```bash
cd web
npm install
cd ..
```

---

## Step 3: Setup Environment Variables

### Create API `.env` file
```bash
cd api
cp .env.example .env
# Edit .env with your values (not needed for frontend-only work)
cd ..
```

### Create Web `.env.local` file
```bash
cd web
touch .env.local
```

Add to `web/.env.local`:
```env
# Razorpay (for existing payment flow - optional if only working on frontend)
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_secret

# Google OAuth (NEW - you'll need to create)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_secret_here

# GCP Backend API (optional for local dev)
GCP_API_URL=http://your-gcp-server-url
X_API_KEY=your_api_key
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

---

## Step 4: Verify Everything Works

### Test Frontend Build
```bash
cd web
npm run build

# Should complete without errors
```

### Test Frontend Dev Server
```bash
cd web
npm run dev

# Open http://localhost:3000 in browser
# You should see existing landing page
```

---

## Step 5: Understanding the Planning Files

### Location
All planning files are in `/planning/` directory:

```
2openclaw/
├── planning/
│   ├── prd-landing-page.json      # 18 stories for landing page
│   ├── prd-dashboard.json         # 13 stories for dashboard
│   ├── 2openclaw-landing-content.md  # All copy/content
│   ├── README-RALPH.md            # Complete Ralph guide
│   └── run-ralph.sh               # Ralph loop script
```

### Read These First
1. **`README-RALPH.md`** - Complete implementation guide
2. **`2openclaw-landing-content.md`** - All the copy you'll need
3. **`prd-landing-page.json`** - Landing page tasks
4. **`prd-dashboard.json`** - Dashboard tasks

---

## Step 6: Download Template Assets (Optional)

You mentioned templates. If you have them on current laptop:

### Templates You Need
1. **glimmering-map** - For 3D globe
2. **auth-flows-ui-kit** - For auth UI patterns
3. **premium-saa-s-landing-page** - For reference

**On current laptop:**
```bash
# Create archive of templates
cd "/Users/divykairoth/Downloads/Needed/Divys Workspace/1. Projects/pennyclaw"
tar -czf templates.tar.gz glimmering-map auth-flows-ui-kit premium-saa-s-landing-page

# Copy to cloud or USB drive
```

**On new laptop:**
```bash
# Extract wherever you want
tar -xzf templates.tar.gz
```

Or just re-download them if you have the source.

---

## Step 7: Running Ralph

### Option A: Landing Page First (Recommended)

```bash
cd /path/to/2openclaw
./planning/run-ralph.sh landing 20
```

### Option B: Dashboard First

```bash
./planning/run-ralph.sh dashboard 20
```

### Option C: Both in Parallel (2 Terminal Windows)

**Terminal 1:**
```bash
cd /path/to/2openclaw
./planning/run-ralph.sh landing 20
```

**Terminal 2:**
```bash
cd /path/to/2openclaw
./planning/run-ralph.sh dashboard 20
```

---

## Step 8: Using Ralph + Claude Code

### How It Works

1. **Ralph shows you a story:**
```
=== Iteration 1/20 ===
Working on: Install dependencies and setup shadcn/ui
Story ID: landing-setup-1

[Shows full story JSON with acceptance criteria]

Press Enter when ready to implement...
```

2. **You press Enter**

3. **Open Claude Code in another terminal:**
```bash
cd /path/to/2openclaw/web
claude
```

4. **Tell Claude Code:**
```
Implement the following story:

[Paste the story JSON from Ralph]

Follow ALL acceptance criteria. When done, run 'npm run build' to verify.
```

5. **Claude Code implements the story**

6. **Verify it works:**
```bash
# In web directory
npm run build     # Should succeed
npm run dev       # Check in browser
```

7. **Return to Ralph terminal and type:** `DONE`

8. **Ralph commits automatically and shows next story**

---

## Step 9: Alternative - Manual Implementation (Without Claude Code)

You can implement manually instead of using Claude Code:

1. Ralph shows you the story
2. You implement it yourself using any editor
3. Test with `npm run build`
4. Return to Ralph and type `DONE`
5. Ralph commits and continues

---

## Important Notes

### What NOT to Modify
These files are part of existing working system - DON'T TOUCH:

❌ `/web/app/onboard/page.tsx` - Existing payment flow
❌ `/web/lib/razorpay.ts` - Payment service
❌ `/web/app/api/subscriptions/**` - Payment APIs
❌ `/web/app/api/webhooks/**` - Webhooks

### What You WILL Modify
✅ `/web/app/page.tsx` - Landing page (complete rebuild)
✅ `/web/components/**` - New directory you'll create
✅ `/web/app/dashboard/**` - New dashboard pages
✅ `/web/app/globals.css` - Extend with new styles
✅ `/web/tailwind.config.js` - Add shadcn/ui config

### Progress Tracking

Ralph creates:
- `web/progress.txt` - Implementation progress log
- Updates PRD files marking `passes: true` for completed stories
- Git commits for each completed story

### Resuming After Break

If you stop Ralph and want to resume later:

```bash
# Just run Ralph again
./planning/run-ralph.sh landing 20

# It will pick up where you left off (next incomplete story)
```

### Checking What's Left

```bash
# See incomplete stories
jq '.stories[] | select(.passes == false) | {id, title, priority}' planning/prd-landing-page.json

# See completed stories
jq '.stories[] | select(.passes == true) | {id, title}' planning/prd-landing-page.json

# Read progress log
cat web/progress.txt
```

---

## Troubleshooting

### Build Fails

```bash
cd web
npm run build

# If errors, check:
npm run build 2>&1 | grep error

# Clean and retry
rm -rf .next node_modules
npm install
npm run build
```

### Git Issues

```bash
# If branch already exists
git checkout feature/landing-page-redesign

# If you need fresh start
git checkout main
git branch -D feature/landing-page-redesign
# Then run Ralph again
```

### Ralph Script Permission Error

```bash
chmod +x planning/run-ralph.sh
```

---

## Quick Reference Commands

```bash
# Clone repo
git clone https://github.com/kairothq/2openclaw.git
cd 2openclaw

# Install dependencies
cd api && npm install && cd ..
cd web && npm install && cd ..

# Run Ralph (landing page)
./planning/run-ralph.sh landing 20

# Start dev server (in another terminal)
cd web && npm run dev

# Check progress
cat web/progress.txt

# Build for production
cd web && npm run build
```

---

## After Implementation Complete

### Merge to Main

```bash
# Landing page merge
git checkout main
git merge feature/landing-page-redesign

# Dashboard merge
git checkout main
git merge feature/dashboard-redesign

# Push to GitHub
git push origin main
```

### Deploy to Vercel

The web app is configured for Vercel. Just push to main and it auto-deploys.

---

## Getting Help

1. **Check `planning/README-RALPH.md`** - Comprehensive guide
2. **Check `planning/2openclaw-landing-content.md`** - All copy/content
3. **Read PRD acceptance criteria** - Very detailed requirements
4. **Check existing code** - See patterns in current 2openclaw

---

## Summary Checklist

On new laptop:

- [ ] Install Homebrew
- [ ] Install Git, Node.js (v18+), jq
- [ ] Clone repository: `git clone https://github.com/kairothq/2openclaw.git`
- [ ] Install dependencies: `cd api && npm install` + `cd web && npm install`
- [ ] Create `.env.local` in web/ with Google OAuth credentials
- [ ] Test build: `cd web && npm run build`
- [ ] Read `planning/README-RALPH.md`
- [ ] Read `planning/2openclaw-landing-content.md`
- [ ] Run Ralph: `./planning/run-ralph.sh landing 20`
- [ ] Implement stories one by one
- [ ] Verify in browser as you go

---

**Total Time Estimate:**
- Setup: 30-60 minutes (first time)
- Implementation: 14-22 hours (via Ralph)

Good luck! 🦞
