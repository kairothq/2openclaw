#!/bin/bash
# Container Watcher - Instant recovery daemon
# Listens to Docker events and immediately recovers crashed/stopped containers
# Deploy as systemd service: /etc/systemd/system/2openclaw-watcher.service

set -u  # Exit on undefined variable

LOG_FILE="/var/log/2openclaw/watcher.log"
DATA_DIR="/opt/2openclaw/data/instances"
EXTERNAL_IP="34.131.95.162"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Add Caddy route using API (not file manipulation)
add_caddy_route() {
    local user_id="$1"
    local port="$2"
    local subdomain="${user_id}.${EXTERNAL_IP}.nip.io"

    # Check if route already exists
    if curl -s http://localhost:2019/config/apps/http/servers/srv0/routes | grep -q "$subdomain"; then
        log "Caddy route for $subdomain already exists"
        return 0
    fi

    # Add route via Caddy API
    curl -s -X POST http://localhost:2019/config/apps/http/servers/srv0/routes \
        -H "Content-Type: application/json" \
        -d "{
            \"match\": [{\"host\": [\"$subdomain\"]}],
            \"handle\": [{
                \"handler\": \"subroute\",
                \"routes\": [{
                    \"handle\": [{
                        \"handler\": \"reverse_proxy\",
                        \"upstreams\": [{\"dial\": \"localhost:$port\"}]
                    }]
                }]
            }],
            \"terminal\": true
        }" > /dev/null 2>&1

    log "Added Caddy route: $subdomain -> localhost:$port"
}

# Recover a container from its data directory
recover_container() {
    local user_id="$1"
    local container_name="openclaw-${user_id}"
    local data_dir="${DATA_DIR}/${user_id}"

    # Check if container already exists
    if docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"; then
        log "Container $container_name already exists, skipping recovery"
        return 0
    fi

    # Check if data directory exists
    if [ ! -d "$data_dir" ] || [ ! -f "${data_dir}/openclaw.json" ]; then
        log "Cannot recover $user_id - no data directory or config"
        return 1
    fi

    # Get port from users file (MUST use original port for Caddy to work)
    local port=""
    if [ -f "/opt/2openclaw/data/users/${user_id}.json" ]; then
        # Handle JSON with space after colon: "port": 18004
        port=$(grep -oE '"port":\s*[0-9]+' "/opt/2openclaw/data/users/${user_id}.json" | grep -oE '[0-9]+')
    fi

    if [ -z "$port" ]; then
        log "Cannot recover $user_id - no port in users file"
        return 1
    fi

    # Check if port is already in use
    if docker ps --format '{{.Ports}}' | grep -q ":${port}->"; then
        log "Port $port already in use, cannot recover $container_name"
        return 1
    fi

    log "Recovering $container_name on port $port..."

    # Create container with original port
    if docker run -d \
        --name "$container_name" \
        --restart unless-stopped \
        -v "${data_dir}:/home/node/.openclaw" \
        -p "${port}:18789" \
        --memory="1536m" \
        --cpus="1" \
        -e NODE_OPTIONS="--max-old-space-size=1280" \
        ghcr.io/openclaw/openclaw:latest 2>&1; then

        log "Successfully recovered $container_name on port $port"
        return 0
    else
        log "Failed to recover $container_name"
        return 1
    fi
}

# Handle container events
handle_event() {
    local event_type="$1"
    local action="$2"
    local container_name="$3"

    # Only handle openclaw containers
    [[ "$container_name" != openclaw-* ]] && return

    local user_id="${container_name#openclaw-}"

    case "$action" in
        die|stop|kill)
            log "Container $container_name $action - checking if recovery needed..."
            sleep 2  # Wait for Docker restart policy to kick in first

            # Check if container is still not running
            if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
                log "Container $container_name not running, attempting recovery..."
                recover_container "$user_id"
            else
                log "Container $container_name recovered by Docker restart policy"
            fi
            ;;
        destroy)
            log "Container $container_name destroyed - attempting recovery..."
            recover_container "$user_id"
            ;;
    esac
}

# Main loop - listen to Docker events
log "Container watcher started - listening for Docker events..."

docker events --filter 'type=container' --filter 'event=die' --filter 'event=stop' --filter 'event=kill' --filter 'event=destroy' \
    --format '{{.Type}} {{.Action}} {{.Actor.Attributes.name}}' | while read -r event_type action container_name; do
    handle_event "$event_type" "$action" "$container_name"
done
