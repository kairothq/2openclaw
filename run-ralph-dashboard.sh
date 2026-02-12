#!/bin/bash
# Automated Ralph for Dashboard Redesign
# This runs FULLY AUTOMATED - no manual intervention needed

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║    2OpenClaw Dashboard - Fully Automated Ralph             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Setup paths
RALPH_DIR="/Users/divykairoth/ralph"
PROJECT_DIR="/Users/divykairoth/Openclaw/2openclaw"
WEB_DIR="$PROJECT_DIR/web"
PRD_FILE="$PROJECT_DIR/planning/prd-dashboard.json"

# Verify Ralph exists
if [[ ! -f "$RALPH_DIR/ralph.sh" ]]; then
    echo "❌ Error: Ralph not found at $RALPH_DIR"
    echo "Run: git clone https://github.com/snarktank/ralph.git /Users/divykairoth/ralph"
    exit 1
fi

# Verify PRD exists
if [[ ! -f "$PRD_FILE" ]]; then
    echo "❌ Error: PRD not found at $PRD_FILE"
    exit 1
fi

# Copy PRD to web directory (where Ralph will run)
echo "📋 Copying PRD to web directory..."
cp "$PRD_FILE" "$WEB_DIR/prd.json"

# Create AGENTS.md if it doesn't exist
if [[ ! -f "$WEB_DIR/AGENTS.md" ]]; then
    echo "📝 Creating AGENTS.md..."
    cat > "$WEB_DIR/AGENTS.md" << 'EOF'
# 2OpenClaw Dashboard Implementation

## Project Context
Redesigning the dashboard following StartClaw style with shadcn/ui dark theme.
Dashboard integrates with EXISTING 2openclaw backend APIs - reuse, don't recreate.

## Tech Stack
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Framer Motion
- shadcn/ui components

## Important - Integration with Existing Backend
✅ Reuse existing API endpoints:
- `/api/instance/[userId]/*` - Container management
- `/api/subscriptions/*` - Payment/billing
- `/api/validate-telegram` - Bot validation
✅ Use existing localStorage pattern: `startclaw_instance`
✅ Use existing Razorpay integration

❌ DO NOT modify:
- `/app/onboard/page.tsx` - Existing onboarding
- `/lib/razorpay.ts` - Payment service
- `/app/api/subscriptions/**` - Payment APIs
- `/app/api/webhooks/**` - Webhooks

## Design System
- Dark theme (zinc palette)
- Brand color: Lobster orange (#f97316)
- No emojis - minimalist icons only (lucide-react)
- Modular components for future "skills" feature

## Content Reference
All copy is in `planning/2openclaw-landing-content.md` - Dashboard section.
EOF
fi

# Create branch
echo "🌿 Creating/checking out feature branch..."
cd "$WEB_DIR"
git checkout -b feature/dashboard-redesign 2>/dev/null || git checkout feature/dashboard-redesign

# Run Ralph
echo ""
echo "🤖 Starting Ralph..."
echo "   Tool: Claude Code"
echo "   Model: Sonnet 4.5"
echo "   Max Iterations: 20"
echo "   Working directory: $WEB_DIR"
echo ""
echo "Ralph will now run FULLY AUTOMATED."
echo "You can monitor progress in this terminal."
echo ""
echo "Press Ctrl+C to stop at any time."
echo ""
sleep 3

# Run Ralph with Claude Code from the web directory
cd "$WEB_DIR"
"$RALPH_DIR/ralph.sh" --tool claude 20

echo ""
echo "✅ Ralph completed!"
echo ""
echo "Next steps:"
echo "  1. Review changes: git log"
echo "  2. Test in browser: npm run dev"
echo "  3. Merge to main: git checkout main && git merge feature/dashboard-redesign"
