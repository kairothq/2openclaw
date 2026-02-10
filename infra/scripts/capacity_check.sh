#!/bin/bash
# VM Capacity Monitoring Script
# Deploy to: /opt/2openclaw/scripts/capacity_check.sh on container host VMs
# Cron: */15 * * * * /opt/2openclaw/scripts/capacity_check.sh >> /var/log/2openclaw/capacity.log 2>&1

LOG_DIR="/var/log/2openclaw"
LOG_FILE="$LOG_DIR/capacity.log"
ALERT_WEBHOOK="${ALERT_WEBHOOK_URL:-}"
API_URL="${API_URL:-http://localhost:3000}"

# Thresholds
RAM_WARNING=70
RAM_CRITICAL=85
DISK_WARNING=70
DISK_CRITICAL=90
CONTAINER_WARNING_PERCENT=80

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

send_alert() {
    local level="$1"
    local message="$2"
    log "ALERT [$level]: $message"

    if [ -n "$ALERT_WEBHOOK" ]; then
        local emoji="🟡"
        [ "$level" = "critical" ] && emoji="🔴"
        [ "$level" = "info" ] && emoji="🟢"

        curl -sf -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"$emoji $(hostname) Capacity: $message\"}" 2>/dev/null || true
    fi
}

mkdir -p "$LOG_DIR"

log "Starting capacity check..."

# Get RAM usage
RAM_TOTAL=$(free | awk '/Mem:/ {print $2}')
RAM_USED=$(free | awk '/Mem:/ {print $3}')
RAM_PERCENT=$((RAM_USED * 100 / RAM_TOTAL))

# Get disk usage
DISK_PERCENT=$(df / | awk 'NR==2 {print $5}' | tr -d '%')

# Get container count
CONTAINER_COUNT=$(docker ps --filter "name=openclaw-" -q 2>/dev/null | wc -l)
MAX_CONTAINERS=${MAX_CONTAINERS:-8}
CONTAINER_PERCENT=$((CONTAINER_COUNT * 100 / MAX_CONTAINERS))

# Get load average
LOAD_AVG=$(cat /proc/loadavg 2>/dev/null | awk '{print $1}' || echo "0")

log "Metrics: RAM=${RAM_PERCENT}% Disk=${DISK_PERCENT}% Containers=${CONTAINER_COUNT}/${MAX_CONTAINERS} (${CONTAINER_PERCENT}%) Load=${LOAD_AVG}"

# Check RAM
if [ "$RAM_PERCENT" -ge "$RAM_CRITICAL" ]; then
    send_alert "critical" "RAM at ${RAM_PERCENT}% - immediate action required!"
elif [ "$RAM_PERCENT" -ge "$RAM_WARNING" ]; then
    send_alert "warning" "RAM at ${RAM_PERCENT}% - approaching limit"
fi

# Check disk
if [ "$DISK_PERCENT" -ge "$DISK_CRITICAL" ]; then
    send_alert "critical" "Disk at ${DISK_PERCENT}% - cleanup required immediately!"

    # Auto-cleanup old logs
    log "Attempting automatic log cleanup..."
    find /var/log -name "*.gz" -mtime +7 -delete 2>/dev/null || true
    find /var/log/2openclaw -name "*.log.*" -mtime +7 -delete 2>/dev/null || true
    docker system prune -f --filter "until=168h" 2>/dev/null || true
elif [ "$DISK_PERCENT" -ge "$DISK_WARNING" ]; then
    send_alert "warning" "Disk at ${DISK_PERCENT}%"
fi

# Check containers
if [ "$CONTAINER_COUNT" -ge "$MAX_CONTAINERS" ]; then
    send_alert "critical" "At max container capacity! (${CONTAINER_COUNT}/${MAX_CONTAINERS})"
elif [ "$CONTAINER_PERCENT" -ge "$CONTAINER_WARNING_PERCENT" ]; then
    send_alert "warning" "Container capacity at ${CONTAINER_PERCENT}% (${CONTAINER_COUNT}/${MAX_CONTAINERS})"
fi

# Summary
STATUS="healthy"
[ "$RAM_PERCENT" -ge "$RAM_WARNING" ] || [ "$DISK_PERCENT" -ge "$DISK_WARNING" ] || [ "$CONTAINER_PERCENT" -ge "$CONTAINER_WARNING_PERCENT" ] && STATUS="warning"
[ "$RAM_PERCENT" -ge "$RAM_CRITICAL" ] || [ "$DISK_PERCENT" -ge "$DISK_CRITICAL" ] || [ "$CONTAINER_COUNT" -ge "$MAX_CONTAINERS" ] && STATUS="critical"

log "Capacity check completed: status=$STATUS"

# Rotate log file if too large
if [ -f "$LOG_FILE" ] && [ $(stat -c%s "$LOG_FILE" 2>/dev/null || stat -f%z "$LOG_FILE" 2>/dev/null) -gt 5242880 ]; then
    mv "$LOG_FILE" "$LOG_FILE.1"
    log "Rotated log file"
fi

exit 0
