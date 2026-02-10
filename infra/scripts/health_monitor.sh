#!/bin/bash
# Health monitoring script - checks all containers and restarts if unhealthy
# Deploy to: /opt/startclaw/scripts/health_monitor.sh on openclaw2 VM
# Cron: */5 * * * * /opt/startclaw/scripts/health_monitor.sh >> /var/log/startclaw/health.log 2>&1

LOG_DIR="/var/log/startclaw"
LOG_FILE="$LOG_DIR/health.log"
ALERT_WEBHOOK="${ALERT_WEBHOOK_URL:-}"
MAX_RESTARTS=5
RESTART_WINDOW=3600  # Reset restart count after 1 hour of stability

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

send_alert() {
    local level="$1"
    local message="$2"
    log "ALERT [$level]: $message"

    if [ -n "$ALERT_WEBHOOK" ]; then
        local emoji="🔴"
        [ "$level" = "warning" ] && emoji="🟡"
        [ "$level" = "info" ] && emoji="🟢"

        curl -sf -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"$emoji OpenClaw Alert: $message\"}" || true
    fi
}

# Ensure log directory exists
mkdir -p "$LOG_DIR"

log "Starting health check..."

# Track containers checked
TOTAL=0
HEALTHY=0
RESTARTED=0
CRITICAL=0

for container in $(docker ps -a --filter "name=openclaw-" --format "{{.Names}}"); do
    TOTAL=$((TOTAL + 1))

    # Get container status details
    status=$(docker inspect "$container" --format='{{.State.Status}}' 2>/dev/null)
    health=$(docker inspect "$container" --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")
    restart_count=$(docker inspect "$container" --format='{{.RestartCount}}' 2>/dev/null || echo "0")
    started_at=$(docker inspect "$container" --format='{{.State.StartedAt}}' 2>/dev/null)

    log "Container: $container | Status: $status | Health: $health | Restarts: $restart_count"

    # Check if container is not running
    if [ "$status" != "running" ]; then
        log "Container $container is not running (status: $status), attempting start..."
        if docker start "$container" 2>/dev/null; then
            send_alert "warning" "Container $container was stopped, started it."
            RESTARTED=$((RESTARTED + 1))
        else
            send_alert "critical" "Failed to start container $container"
            CRITICAL=$((CRITICAL + 1))
        fi
        continue
    fi

    # Check health endpoint directly (more reliable than Docker health status)
    container_healthy=false
    if docker exec "$container" curl -sf http://localhost:18789/health > /dev/null 2>&1; then
        container_healthy=true
        HEALTHY=$((HEALTHY + 1))
    fi

    if [ "$container_healthy" = false ]; then
        log "Container $container unhealthy, checking restart count..."

        if [ "$restart_count" -lt "$MAX_RESTARTS" ]; then
            log "Restarting $container (attempt $((restart_count + 1))/$MAX_RESTARTS)..."
            if docker restart "$container" 2>/dev/null; then
                send_alert "warning" "Container $container unhealthy, restarted (attempt $((restart_count + 1))/$MAX_RESTARTS)"
                RESTARTED=$((RESTARTED + 1))

                # Wait a bit and check if it came back healthy
                sleep 10
                if docker exec "$container" curl -sf http://localhost:18789/health > /dev/null 2>&1; then
                    log "Container $container is healthy after restart"
                    HEALTHY=$((HEALTHY + 1))
                fi
            else
                send_alert "critical" "Failed to restart container $container"
                CRITICAL=$((CRITICAL + 1))
            fi
        else
            CRITICAL=$((CRITICAL + 1))
            send_alert "critical" "Container $container exceeded max restarts ($MAX_RESTARTS). Manual intervention required!"
            log "Container $container exceeded max restarts, needs manual intervention"
        fi
    fi
done

# Log summary
log "Health check completed: Total=$TOTAL, Healthy=$HEALTHY, Restarted=$RESTARTED, Critical=$CRITICAL"

# Send summary alert if there were issues
if [ "$CRITICAL" -gt 0 ]; then
    send_alert "critical" "Health check summary: $CRITICAL containers need attention!"
elif [ "$RESTARTED" -gt 0 ]; then
    send_alert "info" "Health check: Restarted $RESTARTED containers, all now healthy"
fi

# Rotate log file if it gets too large (>10MB)
if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null) -gt 10485760 ]; then
    mv "$LOG_FILE" "$LOG_FILE.1"
    log "Rotated log file"
fi
