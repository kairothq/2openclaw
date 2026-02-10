#!/bin/bash
# 2OpenClaw Restore Script
# Restores a user's OpenClaw instance from backup
# Uses bind mount paths at /opt/startclaw/data/instances/{userId}/

set -e

usage() {
    echo "Usage: $0 <user_id> [date]"
    echo "  user_id: The user identifier (e.g., user123)"
    echo "  date: Optional backup date (YYYY-MM-DD), defaults to latest"
    exit 1
}

[ -z "$1" ] && usage

USER_ID="$1"
DATE="${2:-latest}"
GCS_BUCKET="gs://startclaw-backups"
INSTANCES_DIR="/opt/startclaw/data/instances"
DATA_DIR="${INSTANCES_DIR}/${USER_ID}"
PORTS_FILE="/opt/startclaw/data/ports.json"
CONTAINER_NAME="openclaw-${USER_ID}"
TEMP_DIR="/tmp/startclaw-restore"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting restore for $USER_ID..."

# Create temp directory
mkdir -p "$TEMP_DIR"

# Find backup file
if [ "$DATE" = "latest" ]; then
    # Check local backups first
    LOCAL_BACKUP=$(ls -t /backups/${USER_ID}-*.tar.gz 2>/dev/null | head -1)
    if [ -n "$LOCAL_BACKUP" ]; then
        log "Using local backup: $LOCAL_BACKUP"
        cp "$LOCAL_BACKUP" "$TEMP_DIR/backup.tar.gz"
    else
        log "Finding latest backup from GCS..."
        BACKUP_FILE=$(gsutil ls "$GCS_BUCKET/${USER_ID}/" 2>/dev/null | sort | tail -1)
        if [ -z "$BACKUP_FILE" ]; then
            log "ERROR: No backups found for $USER_ID"
            exit 1
        fi
        log "Downloading: $BACKUP_FILE"
        gsutil cp "$BACKUP_FILE" "$TEMP_DIR/backup.tar.gz"
    fi
else
    # Try local first, then GCS
    LOCAL_BACKUP="/backups/${USER_ID}-${DATE}.tar.gz"
    if [ -f "$LOCAL_BACKUP" ]; then
        log "Using local backup: $LOCAL_BACKUP"
        cp "$LOCAL_BACKUP" "$TEMP_DIR/backup.tar.gz"
    else
        BACKUP_FILE="$GCS_BUCKET/${USER_ID}/${USER_ID}-${DATE}.tar.gz"
        log "Downloading: $BACKUP_FILE"
        gsutil cp "$BACKUP_FILE" "$TEMP_DIR/backup.tar.gz"
    fi
fi

# Stop existing container if running
if docker ps -a -q -f "name=$CONTAINER_NAME" | grep -q .; then
    log "Stopping existing container..."
    docker rm -f "$CONTAINER_NAME"
fi

# Restore data to bind mount path
log "Restoring data to $DATA_DIR..."
mkdir -p "$INSTANCES_DIR"
rm -rf "$DATA_DIR"
cd "$INSTANCES_DIR" && tar xzf "$TEMP_DIR/backup.tar.gz"

# Fix ownership (uid 1000 = node user in container)
chown -R 1000:1000 "$DATA_DIR"
chmod 700 "$DATA_DIR"

# Read port from ports.json
PORT=18789
if [ -f "$PORTS_FILE" ]; then
    STORED_PORT=$(python3 -c "import json; print(json.load(open('$PORTS_FILE')).get('$USER_ID', ''))" 2>/dev/null || echo "")
    if [ -n "$STORED_PORT" ]; then
        PORT=$STORED_PORT
    fi
fi

log "Starting container on port $PORT with 1280m memory..."
docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -v "${DATA_DIR}":/home/node/.openclaw \
    -p "${PORT}:18789" \
    --memory="1280m" \
    --cpus="0.5" \
    -e NODE_OPTIONS="--max-old-space-size=768" \
    ghcr.io/openclaw/openclaw:latest

# Cleanup
rm -rf "$TEMP_DIR"

# Verify container is running
sleep 3
if docker ps -q -f "name=$CONTAINER_NAME" | grep -q .; then
    log "SUCCESS: $USER_ID restored and running on port $PORT"
else
    log "ERROR: Container failed to start. Check: docker logs $CONTAINER_NAME"
    exit 1
fi
