#!/bin/bash
# Inactive account cleanup script
# Deploy to: /opt/startclaw/scripts/cleanup_inactive.sh on molty VM
# Cron: 0 2 * * * /opt/startclaw/scripts/cleanup_inactive.sh >> /var/log/startclaw/cleanup.log 2>&1

API_URL="${API_URL:-http://localhost:3000}"
API_SECRET="${API_SECRET:-startclaw2024secret}"
LOG_DIR="/var/log/startclaw"

mkdir -p "$LOG_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running inactive account cleanup..."

response=$(curl -sf -X POST "$API_URL/admin/cleanup-inactive" \
    -H "Authorization: Bearer $API_SECRET" \
    -H "Content-Type: application/json" 2>&1)

if [ $? -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleanup completed: $response"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Cleanup failed: $response"
    exit 1
fi
