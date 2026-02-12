# 2OpenClaw Ralph Implementation Guide

## Overview

This guide explains how to use Ralph (AI-assisted implementation loop) to build the new 2OpenClaw landing page and dashboard.

## Files Created

1. **`prd-landing-page.json`** - PRD for landing page redesign (18 stories)
2. **`prd-dashboard.json`** - PRD for dashboard redesign (13 stories)
3. **`run-ralph.sh`** - Ralph loop script (interactive mode)
4. **`2openclaw-landing-content.md`** - Complete content/copy reference

## Prerequisites

```bash
# Install jq (JSON processor)
brew install jq

# Make script executable
chmod +x /Users/divykairoth/.claude/plans/run-ralph.sh
```

## Quick Start

### Option 1: Landing Page First (Recommended)

```bash
# Navigate to plans directory
cd /Users/divykairoth/.claude/plans

# Run Ralph for landing page (20 iterations max)
./run-ralph.sh landing 20
```

### Option 2: Dashboard First

```bash
# Run Ralph for dashboard
./run-ralph.sh dashboard 20
```

### Option 3: Both in Parallel (Advanced)

Open two terminal windows and run both simultaneously:

**Terminal 1:**
```bash
./run-ralph.sh landing 20
```

**Terminal 2:**
```bash
./run-ralph.sh dashboard 20
```

## How Ralph Works

### The Loop

1. **Read PRD** - Script reads the PRD JSON file
2. **Select Story** - Finds first incomplete story (`passes: false`)
3. **Display Story** - Shows story details and acceptance criteria
4. **Implement** - You implement using Claude Code
5. **Verify** - Run `npm run build` and verify in browser
6. **Commit** - Script commits changes and updates PRD
7. **Repeat** - Moves to next story

### Interactive Flow

```
=== Iteration 1/20 ===
Working on: Install dependencies and setup shadcn/ui for landing page
Story ID: landing-setup-1
Priority: 1

STORY TO IMPLEMENT:
{
  "id": "landing-setup-1",
  "title": "Install dependencies and setup shadcn/ui for landing page",
  "priority": 1,
  "passes": false,
  "description": "As a developer, I want to install necessary UI libraries...",
  "acceptanceCriteria": [
    "Install framer-motion for animations",
    "Install @radix-ui/react-dialog for video modals",
    ...
  ]
}

Instructions for Claude Code:
1. Read the story above
2. Implement ALL acceptance criteria
3. Run 'npm run build' to verify
4. Verify in browser if required
5. When complete, type 'DONE' and I'll commit

Press Enter when you're ready to start implementation with Claude Code...
```

### Implementing with Claude Code

When prompted, open Claude Code in the 2openclaw project:

```bash
# In another terminal
cd /Users/divykairoth/Openclaw/2openclaw/web
claude
```

Then tell Claude Code:

```
Implement the following story:

[Copy the story JSON from Ralph output]

Follow ALL acceptance criteria. When done, run 'npm run build' to verify.
```

### Marking Complete

When implementation is done:

1. Verify it works in browser
2. Run `npm run build` successfully
3. Return to Ralph terminal
4. Type **`DONE`** and press Enter

Ralph will:
- Run build check again
- Commit your changes with descriptive message
- Mark story as `passes: true` in PRD
- Move to next story

## Story Status Commands

When Ralph asks for status:

- **`DONE`** - Story completed successfully, commit and continue
- **`SKIP`** - Skip this story for now, move to next
- **`ABORT`** - Stop Ralph entirely

## Tips for Success

### 1. One Story at a Time

Focus on ONE story completely before moving to next. Don't try to implement multiple stories at once.

### 2. Read Acceptance Criteria Carefully

Every story has specific acceptance criteria. ALL must be met.

### 3. Verify in Browser

Stories with "Verify in browser using dev-browser skill" MUST be visually verified:

```bash
# Start dev server
cd /Users/divykairoth/Openclaw/2openclaw/web
npm run dev

# Open http://localhost:3000 in browser
# Check the implemented feature works
```

### 4. Reference Content Document

All copy/text is in `/Users/divykairoth/.claude/plans/2openclaw-landing-content.md`

Don't invent copy - use exactly what's in the content document.

### 5. Integration with Existing 2openclaw

**IMPORTANT:** The dashboard PRD integrates with EXISTING 2openclaw backend.

- ✅ Reuse existing API endpoints (`/api/instance/[userId]`, `/api/subscriptions/*`)
- ✅ Reuse existing localStorage patterns
- ✅ Reuse existing Razorpay integration
- ❌ Don't recreate payment logic
- ❌ Don't modify `/app/onboard/page.tsx`
- ❌ Don't touch `lib/razorpay.ts`

### 6. Component Modularity for Future Skills

Design dashboard components to be modular:

```typescript
// Good - Modular for future skills
interface AgentInstanceCardProps {
  agentId: string;
  name: string;
  status: 'active' | 'paused';
  skills?: Skill[];  // For future use
}

// Not good - Hardcoded
const AgentCard = () => {
  return <div>Nova - Professional</div>;
};
```

## Templates to Use

### glimmering-map (Globe)

Located at: `/Users/divykairoth/Downloads/Needed/Divys Workspace/1. Projects/pennyclaw/glimmering-map`

Use for: 3D globe in testimonials section

### auth-flows-ui-kit

Located at: `/Users/divykairoth/Downloads/Needed/Divys Workspace/1. Projects/pennyclaw/auth-flows-ui-kit`

Use if: You want to use existing auth UI patterns

### Shader Button (Platform Toggle)

Use shader button effect from glimmering-map for the Telegram/WhatsApp toggle in Add Employee flow.

## Progress Tracking

### Check Progress

```bash
# See what's done
cat /Users/divykairoth/Openclaw/2openclaw/web/progress.txt

# Check PRD status
jq '.stories[] | select(.passes == false) | {id, title, priority}' /Users/divykairoth/.claude/plans/prd-landing-page.json
```

### Resume After Interruption

Ralph saves progress in PRD file. Just run the script again:

```bash
./run-ralph.sh landing 20
```

It will pick up where it left off (next incomplete story).

## Troubleshooting

### Build Fails

```bash
# Check errors
npm run build

# Fix TypeScript errors
npm run build 2>&1 | grep error

# Try clean install
rm -rf .next node_modules
npm install
npm run build
```

### Git Issues

```bash
# If branch already exists
git checkout feature/landing-page-redesign

# If you need to reset
git checkout main
git branch -D feature/landing-page-redesign
# Then run Ralph again
```

### Story Too Complex

If a story is too big:

1. Type `SKIP` in Ralph
2. Manually split the story into smaller pieces in PRD
3. Run Ralph again

## Final Verification

After all stories complete:

### Landing Page Checklist

```bash
# Start dev server
npm run dev

# Visit http://localhost:3000
```

Check:
- [ ] Hero displays with shimmer button
- [ ] Google OAuth sign-in works
- [ ] Platform selection shows Telegram/WhatsApp
- [ ] Video modals open and play
- [ ] Comparison section displays
- [ ] Use cases render as pills
- [ ] Globe rotates smoothly
- [ ] Testimonials show with circular avatars
- [ ] Pricing cards display correctly
- [ ] Responsive on mobile (test 375px width)

### Dashboard Checklist

```bash
# Visit http://localhost:3000/dashboard
```

Check:
- [ ] Dashboard requires login
- [ ] Metrics cards display
- [ ] Add Employee flow works (all 4 steps)
- [ ] Marketplace displays templates
- [ ] Settings page loads
- [ ] Sidebar navigation works
- [ ] Responsive on mobile

## Merging to Main

When everything works:

```bash
cd /Users/divykairoth/Openclaw/2openclaw/web

# Landing page merge
git checkout main
git merge feature/landing-page-redesign

# Dashboard merge
git checkout main
git merge feature/dashboard-redesign

# Push to GitHub
git push origin main
```

## Support

If you get stuck:

1. Check `progress.txt` for what was last attempted
2. Review PRD acceptance criteria again
3. Ask Claude Code for help with specific error messages
4. Check existing 2openclaw code for patterns

## Summary

Ralph makes implementation systematic:

1. **One story at a time** - Focus and verify each piece
2. **Automatic commits** - Clean git history
3. **Progress tracking** - Never lose your place
4. **Quality gates** - Build must pass before continuing

Total time estimate:
- Landing page: ~8-12 hours (18 stories)
- Dashboard: ~6-10 hours (13 stories)
- Combined: ~14-22 hours

Good luck! 🦞
