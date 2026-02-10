#!/bin/bash
# 2OpenClaw Daily Backup Script
# Backs up all user OpenClaw data to Google Cloud Storage
# Uses bind mount paths at /opt/2openclaw/data/instances/{userId}/

set -e

INSTANCES_DIR="/opt/2openclaw/data/instances"
BACKUP_DIR="/backups"
GCS_BUCKET="gs://2openclaw-backups"
DATE=$(date +%Y-%m-%d)
LOG_FILE="/opt/2openclaw/logs/backup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

log "Starting daily backup..."

# Check if instances directory exists
if [ ! -d "$INSTANCES_DIR" ]; then
    log "No instances directory found at $INSTANCES_DIR"
    exit 0
fi

# Get all user directories
USER_DIRS=$(ls -d "$INSTANCES_DIR"/*/ 2>/dev/null || echo "")

if [ -z "$USER_DIRS" ]; then
    log "No user instances found"
    exit 0
fi

BACKUP_COUNT=0
ERROR_COUNT=0

for user_dir in $USER_DIRS; do
    USER_ID=$(basename "$user_dir")
    BACKUP_FILE="${USER_ID}-${DATE}.tar.gz"

    log "Backing up $USER_ID..."

    # Tar the user directory directly (bind mount, no Docker volume commands)
    if tar czf "$BACKUP_DIR/${BACKUP_FILE}" -C "$INSTANCES_DIR" "$USER_ID" 2>/dev/null; then
        # Upload to GCS
        if command -v gsutil &>/dev/null; then
            if gsutil -q cp "$BACKUP_DIR/${BACKUP_FILE}" "$GCS_BUCKET/${USER_ID}/" 2>/dev/null; then
                log "SUCCESS: $USER_ID backed up to GCS"
                ((BACKUP_COUNT++))
            else
                log "ERROR: Failed to upload $USER_ID to GCS"
                ((ERROR_COUNT++))
            fi
        else
            log "SUCCESS: $USER_ID backed up locally (gsutil not available)"
            ((BACKUP_COUNT++))
        fi
    else
        log "ERROR: Failed to create backup for $USER_ID"
        ((ERROR_COUNT++))
    fi
done

# Cleanup old local backups (keep 7 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete 2>/dev/null || true

log "Backup complete: $BACKUP_COUNT successful, $ERROR_COUNT errors"

# Exit with error if any backups failed
[ $ERROR_COUNT -eq 0 ] || exit 1
