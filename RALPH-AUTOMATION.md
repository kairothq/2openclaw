# Ralph Automation - Fully Automated Implementation

✅ **Setup Complete!** Ralph is ready to run fully automated.

## Quick Start

### Run Landing Page (Fully Automated)
```bash
./run-ralph-landing.sh
```

### Run Dashboard (Fully Automated)
```bash
./run-ralph-dashboard.sh
```

### Run Both in Parallel
```bash
# Terminal 1
./run-ralph-landing.sh

# Terminal 2
./run-ralph-dashboard.sh
```

---

## What Happens Automatically

1. ✅ **Copies PRD** to web/prd.json
2. ✅ **Creates AGENTS.md** with project context
3. ✅ **Creates git branch** (feature/landing-page-redesign or feature/dashboard-redesign)
4. ✅ **Runs Ralph** with Claude Code
5. ✅ **Implements each story** automatically
6. ✅ **Commits after each story** with detailed message
7. ✅ **Updates PRD** marking stories complete
8. ✅ **Continues until done** (max 20 iterations)

---

## What You Need to Do

### NOTHING! Just run the script.

Ralph will:
- Read each story from the PRD
- Spawn Claude Code
- Implement the story
- Verify with `npm run build`
- Commit changes
- Move to next story
- Repeat until all 18 stories (landing) or 13 stories (dashboard) are done

---

## Monitoring Progress

### Watch in Real-Time
The terminal will show:
- Current iteration
- Story being implemented
- Build status
- Commit messages

### Check Progress File
```bash
cat web/progress.txt
```

### Check Git History
```bash
cd web
git log --oneline
```

### Check PRD Status
```bash
# See what's done
cat web/prd.json | jq '.stories[] | select(.passes == true) | .title'

# See what's pending
cat web/prd.json | jq '.stories[] | select(.passes == false) | .title'
```

---

## Time Estimates

**Landing Page (18 stories):** 8-12 hours
**Dashboard (13 stories):** 6-10 hours
**Both in Parallel:** 8-12 hours (same time, run simultaneously)

---

## Stopping and Resuming

### Stop Ralph
Press **Ctrl+C** in the terminal

### Resume Later
Just run the script again:
```bash
./run-ralph-landing.sh
```

Ralph will:
- Read the PRD
- Find the first incomplete story (`passes: false`)
- Continue from there

---

## After Completion

### 1. Review Changes
```bash
cd web
git log --oneline
git diff main..feature/landing-page-redesign
```

### 2. Test in Browser
```bash
cd web
npm run dev
# Open http://localhost:3000
```

### 3. Merge to Main
```bash
cd web
git checkout main
git merge feature/landing-page-redesign
git push origin main
```

---

## Troubleshooting

### Ralph Fails to Start
```bash
# Check Ralph is installed
ls -la /Users/divykairoth/ralph/ralph.sh

# If missing, clone it:
git clone https://github.com/snarktank/ralph.git /Users/divykairoth/ralph
```

### Build Errors During Implementation
Ralph will show the error and continue to next story. Check:
```bash
cd web
npm run build
# Fix any errors manually
# Then run Ralph again to continue
```

### Git Branch Issues
```bash
# If branch already exists
cd web
git checkout feature/landing-page-redesign

# If you want fresh start
git checkout main
git branch -D feature/landing-page-redesign
# Then run Ralph script again
```

---

## Technical Details

### What Ralph Uses
- **Tool:** Claude Code (via `--tool claude`)
- **Model:** Sonnet 4.5 (default, fast and capable)
- **Max Iterations:** 20
- **Working Directory:** `/Users/divykairoth/Openclaw/2openclaw/web`

### Files Created by Ralph
- `web/prd.json` - Copy of your PRD (gets updated with `passes: true`)
- `web/AGENTS.md` - Project context for Claude Code
- `web/progress.txt` - Implementation log
- Git commits on feature branch

### Integration with Existing 2openclaw
Ralph is configured to:
- ✅ Reuse existing APIs (Razorpay, instance management)
- ✅ Not modify payment flow
- ✅ Use existing localStorage patterns
- ✅ Follow shadcn/ui dark theme
- ✅ Use exact copy from planning/2openclaw-landing-content.md

---

## FAQ

**Q: Can I modify stories while Ralph is running?**
A: Yes, but wait for current story to finish. Edit `web/prd.json` and Ralph will pick up changes on next iteration.

**Q: Can I run both landing and dashboard at same time?**
A: Yes! They work on different branches so won't conflict.

**Q: What if Ralph gets stuck on a story?**
A: Press Ctrl+C, manually fix the issue, mark story as `passes: true` in PRD, run Ralph again.

**Q: Can I switch to Opus instead of Sonnet?**
A: Not directly with these scripts. Use original Ralph if you need Opus. For this task, Sonnet is recommended.

---

## Success Criteria

After Ralph completes:

**Landing Page:**
- [ ] 18 stories marked `passes: true`
- [ ] Hero displays with shimmer button
- [ ] Google OAuth works
- [ ] Platform selection (Telegram/WhatsApp)
- [ ] Video modals open
- [ ] Comparison section shows
- [ ] Use cases render as pills
- [ ] 3D globe rotates
- [ ] Testimonials display
- [ ] Pricing cards show
- [ ] Responsive on mobile

**Dashboard:**
- [ ] 13 stories marked `passes: true`
- [ ] Dashboard requires login
- [ ] Metrics display
- [ ] Add Employee flow works (4 steps)
- [ ] Marketplace shows templates
- [ ] Settings page loads
- [ ] Integrates with existing backend

---

**Ready to start?**

```bash
./run-ralph-landing.sh
```

Let it run and check back in 8-12 hours! ☕🦞
