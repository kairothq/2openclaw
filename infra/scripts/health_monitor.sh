#!/bin/bash
# Health monitoring script - checks all containers and restarts if unhealthy
# Deploy to: /opt/2openclaw/scripts/health_monitor.sh on openclaw2 VM
# Cron: */5 * * * * /opt/2openclaw/scripts/health_monitor.sh >> /var/log/2openclaw/health.log 2>&1

LOG_DIR="/var/log/2openclaw"
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

# ============================================
# PHASE 2: Recover orphaned data directories
# (data exists but container was deleted)
# ============================================
DATA_DIR="/opt/2openclaw/data/instances"
RECOVERED=0

log "Checking for orphaned data directories..."

for data_dir in "$DATA_DIR"/*/; do
    [ -d "$data_dir" ] || continue

    user_id=$(basename "$data_dir")
    container_name="openclaw-${user_id}"

    # Skip if container exists (running or stopped)
    if docker inspect "$container_name" >/dev/null 2>&1; then
        continue
    fi

    # Check if openclaw.json exists (has credentials to recreate)
    if [ ! -f "${data_dir}openclaw.json" ]; then
        log "Orphaned directory $user_id has no config, skipping"
        continue
    fi

    log "Found orphaned data for $user_id, attempting recovery..."

    # Get port from users file (handle space after colon in JSON)
    port=""
    if [ -f "/opt/2openclaw/data/users/${user_id}.json" ]; then
        port=$(grep -oE '"port":\s*[0-9]+' "/opt/2openclaw/data/users/${user_id}.json" | grep -oE '[0-9]+')
    fi

    # Assign new port if not found
    if [ -z "$port" ]; then
        # Find max port in use
        max_port=$(docker ps --format '{{.Ports}}' | grep -oE '0\.0\.0\.0:[0-9]+' | cut -d: -f2 | sort -n | tail -1)
        port=$((max_port + 1))
        [ "$port" -lt 18001 ] && port=18001
    fi

    # Recreate container
    if docker run -d \
        --name "$container_name" \
        --restart unless-stopped \
        -v "${data_dir%/}:/home/node/.openclaw" \
        -p "${port}:18789" \
        --memory="1536m" \
        --cpus="1" \
        -e NODE_OPTIONS="--max-old-space-size=1280" \
        ghcr.io/openclaw/openclaw:latest 2>/dev/null; then

        send_alert "info" "Recovered orphaned container $container_name on port $port"
        log "Successfully recovered $container_name"
        RECOVERED=$((RECOVERED + 1))

        # Update Caddy if needed
        subdomain="${user_id}.34.131.95.162.nip.io"
        if ! grep -q "$subdomain" /etc/caddy/Caddyfile 2>/dev/null; then
            echo -e "\n${subdomain} {\n    reverse_proxy localhost:${port}\n}" >> /etc/caddy/Caddyfile
            systemctl reload caddy 2>/dev/null || true
            log "Added Caddy route for $subdomain"
        fi
    else
        send_alert "critical" "Failed to recover orphaned container $container_name"
        CRITICAL=$((CRITICAL + 1))
    fi
done

# Log summary
log "Health check completed: Total=$TOTAL, Healthy=$HEALTHY, Restarted=$RESTARTED, Recovered=$RECOVERED, Critical=$CRITICAL"

# Send summary alert if there were issues
if [ "$CRITICAL" -gt 0 ]; then
    send_alert "critical" "Health check summary: $CRITICAL containers need attention!"
elif [ "$RESTARTED" -gt 0 ] || [ "$RECOVERED" -gt 0 ]; then
    send_alert "info" "Health check: Restarted=$RESTARTED, Recovered=$RECOVERED, all healthy"
fi

# Rotate log file if it gets too large (>10MB)
if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null) -gt 10485760 ]; then
    mv "$LOG_FILE" "$LOG_FILE.1"
    log "Rotated log file"
fi
