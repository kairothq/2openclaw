#!/bin/bash
# Automated Ralph for Landing Page Redesign
# This runs FULLY AUTOMATED - no manual intervention needed

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║    2OpenClaw Landing Page - Fully Automated Ralph          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Setup paths
RALPH_DIR="/Users/divykairoth/ralph"
PROJECT_DIR="/Users/divykairoth/Openclaw/2openclaw"
WEB_DIR="$PROJECT_DIR/web"
PRD_FILE="$PROJECT_DIR/planning/prd-landing-page.json"

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
# 2OpenClaw Landing Page Implementation

## Project Context
Redesigning the landing page following SimpleClaw/StartClaw style with shadcn/ui dark theme.

## Tech Stack
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Framer Motion
- shadcn/ui components

## Important Files NOT to Modify
- `/app/onboard/page.tsx` - Existing payment flow
- `/lib/razorpay.ts` - Payment service
- `/app/api/subscriptions/**` - Payment APIs
- `/app/api/webhooks/**` - Webhooks

## Design System
- Dark theme (zinc palette)
- Brand color: Lobster orange (#f97316)
- No emojis - minimalist icons only (lucide-react)
- Responsive mobile-first design

## Acceptance Criteria Pattern
All UI stories must include: "Verify in browser using dev-browser skill"

## Content Reference
All copy is in `planning/2openclaw-landing-content.md` - use exact copy from there.
EOF
fi

# Create branch
echo "🌿 Creating/checking out feature branch..."
cd "$WEB_DIR"
git checkout -b feature/landing-page-redesign 2>/dev/null || git checkout feature/landing-page-redesign

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
echo "  3. Merge to main: git checkout main && git merge feature/landing-page-redesign"
