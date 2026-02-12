#!/bin/bash

# 2OpenClaw Ralph Implementation Loop
# Usage: ./run-ralph.sh [landing|dashboard] [max_iterations]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed.${NC}"
    echo "Install with: brew install jq"
    exit 1
fi

# Parse arguments
PRD_TYPE=${1:-landing}
MAX_ITERATIONS=${2:-20}

if [[ "$PRD_TYPE" == "landing" ]]; then
    PRD_FILE="planning/prd-landing-page.json"
    BRANCH_NAME="feature/landing-page-redesign"
elif [[ "$PRD_TYPE" == "dashboard" ]]; then
    PRD_FILE="planning/prd-dashboard.json"
    BRANCH_NAME="feature/dashboard-redesign"
else
    echo -e "${RED}Error: Invalid PRD type. Use 'landing' or 'dashboard'${NC}"
    exit 1
fi

# Check if PRD file exists
if [[ ! -f "$PRD_FILE" ]]; then
    echo -e "${RED}Error: PRD file not found: $PRD_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         2OpenClaw Ralph Implementation Loop                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}PRD Type:${NC} $PRD_TYPE"
echo -e "${YELLOW}PRD File:${NC} $PRD_FILE"
echo -e "${YELLOW}Branch:${NC} $BRANCH_NAME"
echo -e "${YELLOW}Max Iterations:${NC} $MAX_ITERATIONS"
echo ""

# Create/checkout feature branch
echo -e "${BLUE}Checking out branch: $BRANCH_NAME${NC}"
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"

# Initialize progress file
PROGRESS_FILE="web/progress.txt"
if [[ ! -f "$PROGRESS_FILE" ]]; then
    echo "=== 2OpenClaw Implementation Progress ===" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "" >> "$PROGRESS_FILE"
fi

# Main loop
ITERATION=1
while [[ $ITERATION -le $MAX_ITERATIONS ]]; do
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Iteration $ITERATION / $MAX_ITERATIONS${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo ""

    # Find next incomplete story
    STORY=$(jq -r '.stories[] | select(.passes == false) | @json' "$PRD_FILE" | head -1)

    if [[ -z "$STORY" ]]; then
        echo -e "${GREEN}✅ All stories completed!${NC}"
        echo ""
        echo "Completed: $(date)" >> "$PROGRESS_FILE"
        break
    fi

    # Parse story details
    STORY_ID=$(echo "$STORY" | jq -r '.id')
    STORY_TITLE=$(echo "$STORY" | jq -r '.title')
    STORY_PRIORITY=$(echo "$STORY" | jq -r '.priority')

    echo -e "${YELLOW}Working on:${NC} $STORY_TITLE"
    echo -e "${YELLOW}Story ID:${NC} $STORY_ID"
    echo -e "${YELLOW}Priority:${NC} $STORY_PRIORITY"
    echo ""

    # Display full story
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}STORY TO IMPLEMENT:${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "$STORY" | jq '.'
    echo ""

    # Show acceptance criteria
    echo -e "${YELLOW}ACCEPTANCE CRITERIA:${NC}"
    echo "$STORY" | jq -r '.acceptanceCriteria[]' | while read -r criterion; do
        echo "  ✓ $criterion"
    done
    echo ""

    # Instructions
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}Instructions for Claude Code:${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "1. Read the story above"
    echo "2. Implement ALL acceptance criteria"
    echo "3. Run 'npm run build' in web/ directory to verify"
    echo "4. Verify in browser if story requires it"
    echo "5. When complete, return here and type 'DONE'"
    echo ""
    echo -e "${YELLOW}Alternative commands:${NC}"
    echo "  SKIP  - Skip this story for now"
    echo "  ABORT - Stop Ralph entirely"
    echo ""

    # Wait for user input
    read -p "Press Enter when you're ready to start implementation with Claude Code..."

    # After implementation, ask for status
    echo ""
    while true; do
        read -p "$(echo -e ${YELLOW}Story status [DONE/SKIP/ABORT]:${NC} )" STATUS

        case $STATUS in
            DONE|done)
                echo ""
                echo -e "${BLUE}Verifying build...${NC}"

                # Try to build (optional - user should have already done this)
                cd web
                if npm run build > /dev/null 2>&1; then
                    echo -e "${GREEN}✅ Build successful${NC}"
                else
                    echo -e "${RED}⚠️  Build had issues - review before committing${NC}"
                fi
                cd ..

                # Commit changes
                echo ""
                echo -e "${BLUE}Committing changes...${NC}"
                git add .
                COMMIT_MSG="feat: $STORY_TITLE

Story ID: $STORY_ID
Priority: $STORY_PRIORITY

Implemented acceptance criteria:
$(echo "$STORY" | jq -r '.acceptanceCriteria[]' | sed 's/^/- /')

[Ralph automated commit]"

                git commit -m "$COMMIT_MSG" || echo -e "${YELLOW}No changes to commit${NC}"

                # Update PRD to mark story as complete
                echo -e "${BLUE}Marking story as complete in PRD...${NC}"
                jq --arg id "$STORY_ID" '(.stories[] | select(.id == $id) | .passes) = true' "$PRD_FILE" > tmp.$$.json && mv tmp.$$.json "$PRD_FILE"

                # Log to progress file
                echo "[$ITERATION] $STORY_ID: $STORY_TITLE - COMPLETED" >> "$PROGRESS_FILE"

                echo -e "${GREEN}✅ Story completed and committed${NC}"
                break
                ;;

            SKIP|skip)
                echo -e "${YELLOW}⏭️  Skipping story${NC}"
                echo "[$ITERATION] $STORY_ID: $STORY_TITLE - SKIPPED" >> "$PROGRESS_FILE"
                break
                ;;

            ABORT|abort)
                echo -e "${RED}🛑 Aborting Ralph loop${NC}"
                echo "[$ITERATION] ABORTED by user" >> "$PROGRESS_FILE"
                exit 0
                ;;

            *)
                echo -e "${RED}Invalid input. Please enter DONE, SKIP, or ABORT${NC}"
                ;;
        esac
    done

    ITERATION=$((ITERATION + 1))
done

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                Ralph Loop Complete                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "  Total iterations: $((ITERATION - 1))"
echo "  Progress log: $PROGRESS_FILE"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Review progress.txt for summary"
echo "  2. Test the implementation thoroughly"
echo "  3. Merge to main when ready:"
echo "     git checkout main"
echo "     git merge $BRANCH_NAME"
echo ""
