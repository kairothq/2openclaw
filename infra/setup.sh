#!/bin/bash
# StartClaw VM Setup Script
# Run this on a fresh Ubuntu 22.04 VM
# Usage: curl -fsSL https://raw.githubusercontent.com/kairothq/2openclaw/main/infra/setup.sh | bash

set -e

echo "🦞 StartClaw Setup Starting..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_info() { echo -e "${YELLOW}→ $1${NC}"; }
log_error() { echo -e "${RED}✗ $1${NC}"; }

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    log_error "Please run with sudo: curl -fsSL ... | sudo bash"
    exit 1
fi

# Get the actual user (not root)
ACTUAL_USER=${SUDO_USER:-$USER}
HOME_DIR=$(eval echo ~$ACTUAL_USER)

log_info "Setting up for user: $ACTUAL_USER"

# Step 1: Update system
log_info "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
log_success "System updated"

# Step 2: Install Docker
log_info "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker $ACTUAL_USER
    log_success "Docker installed"
else
    log_success "Docker already installed"
fi

# Step 3: Install Caddy
log_info "Installing Caddy..."
if ! command -v caddy &> /dev/null; then
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y -qq caddy
    log_success "Caddy installed"
else
    log_success "Caddy already installed"
fi

# Step 4: Install Node.js 22
log_info "Installing Node.js 22..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
    log_success "Node.js installed"
else
    log_success "Node.js already installed"
fi

# Step 5: Create StartClaw directories
log_info "Creating directories..."
mkdir -p /opt/startclaw/{scripts,data,logs,api}
mkdir -p /opt/startclaw/data/{users,instances}
mkdir -p /opt/startclaw/api/{services,middleware,data}
mkdir -p /var/log/startclaw
mkdir -p /backups
chown -R $ACTUAL_USER:$ACTUAL_USER /opt/startclaw
chown -R $ACTUAL_USER:$ACTUAL_USER /var/log/startclaw
chown -R $ACTUAL_USER:$ACTUAL_USER /backups
log_success "Directories created"

# Step 6: Download scripts and API files
log_info "Downloading StartClaw scripts..."
REPO_RAW="https://raw.githubusercontent.com/kairothq/2openclaw/main"

# Infrastructure scripts
curl -fsSL "$REPO_RAW/infra/scripts/backup.sh" -o /opt/startclaw/scripts/backup.sh
curl -fsSL "$REPO_RAW/infra/scripts/restore.sh" -o /opt/startclaw/scripts/restore.sh
curl -fsSL "$REPO_RAW/infra/scripts/health_monitor.sh" -o /opt/startclaw/scripts/health_monitor.sh
curl -fsSL "$REPO_RAW/infra/scripts/cleanup_inactive.sh" -o /opt/startclaw/scripts/cleanup_inactive.sh
curl -fsSL "$REPO_RAW/infra/scripts/capacity_check.sh" -o /opt/startclaw/scripts/capacity_check.sh
chmod +x /opt/startclaw/scripts/*.sh

# API server files
curl -fsSL "$REPO_RAW/api/server.js" -o /opt/startclaw/api/server.js
curl -fsSL "$REPO_RAW/api/package.json" -o /opt/startclaw/api/package.json

# API services
curl -fsSL "$REPO_RAW/api/services/cleanup.js" -o /opt/startclaw/api/services/cleanup.js
curl -fsSL "$REPO_RAW/api/services/vmSelector.js" -o /opt/startclaw/api/services/vmSelector.js

# API middleware
curl -fsSL "$REPO_RAW/api/middleware/validation.js" -o /opt/startclaw/api/middleware/validation.js
curl -fsSL "$REPO_RAW/api/middleware/rateLimit.js" -o /opt/startclaw/api/middleware/rateLimit.js

# API data
curl -fsSL "$REPO_RAW/api/data/vms.json" -o /opt/startclaw/api/data/vms.json

log_success "Scripts and API files downloaded"

# Step 7: Pull OpenClaw Docker image
log_info "Pulling OpenClaw Docker image (this may take a minute)..."
docker pull ghcr.io/openclaw/openclaw:latest
log_success "OpenClaw image ready"

# Step 8: Setup Caddy config
log_info "Configuring Caddy..."
EXTERNAL_IP=$(curl -s ifconfig.me)
cat > /etc/caddy/Caddyfile << EOF
# StartClaw Caddy Configuration

# Health check endpoint
:80 {
    respond /health "OK" 200
}

# User instances will be added dynamically below
# Format: user123.${EXTERNAL_IP}.nip.io { reverse_proxy localhost:PORT }
EOF
systemctl restart caddy
log_success "Caddy configured"

# Step 9: Install API dependencies
log_info "Installing API dependencies..."
cd /opt/startclaw/api
sudo -u $ACTUAL_USER npm install --production 2>/dev/null || npm install --production
log_success "API dependencies installed"

# Step 10: Create systemd service for API
log_info "Creating API service..."
cat > /etc/systemd/system/startclaw-api.service << EOF
[Unit]
Description=StartClaw Provisioning API
After=network.target docker.service

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=/opt/startclaw/api
EnvironmentFile=/opt/startclaw/api/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable startclaw-api
log_success "API service created"

# Step 11: Setup cron jobs
log_info "Setting up scheduled jobs..."

# Create cron job entries
CRON_JOBS=$(cat << 'CRON'
# StartClaw Scheduled Jobs
# Daily backup at 3 AM
0 3 * * * /opt/startclaw/scripts/backup.sh >> /var/log/startclaw/backup.log 2>&1
# Health check every 5 minutes
*/5 * * * * /opt/startclaw/scripts/health_monitor.sh >> /var/log/startclaw/health.log 2>&1
# Capacity check every 15 minutes
*/15 * * * * /opt/startclaw/scripts/capacity_check.sh >> /var/log/startclaw/capacity.log 2>&1
# Inactive account cleanup daily at 2 AM
0 2 * * * /opt/startclaw/scripts/cleanup_inactive.sh >> /var/log/startclaw/cleanup.log 2>&1
CRON
)

# Install cron jobs for the user
echo "$CRON_JOBS" | crontab -u $ACTUAL_USER -
log_success "Scheduled jobs configured:
   - Backup: Daily at 3 AM
   - Health Monitor: Every 5 minutes
   - Capacity Check: Every 15 minutes
   - Cleanup: Daily at 2 AM"

# Step 12: Open firewall ports
log_info "Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 3000/tcp
    # Note: Not enabling UFW - GCP firewall handles this; UFW can lock out SSH
fi
log_success "Firewall configured"

# Get external IP
EXTERNAL_IP=$(curl -s ifconfig.me)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🦞 StartClaw Setup Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "External IP: $EXTERNAL_IP"
echo ""
echo "Next steps:"
echo "1. Create .env file:"
echo "   nano /opt/startclaw/api/.env"
echo ""
echo "   Required variables:"
echo "   API_SECRET=$(openssl rand -hex 32)"
echo "   DATA_DIR=/opt/startclaw/data"
echo ""
echo "   Optional (for default trial instances):"
echo "   GEMINI_API_KEY=your_key_here"
echo "   GROQ_API_KEY=your_key_here"
echo ""
echo "   Optional (for alerts):"
echo "   ALERT_WEBHOOK_URL=https://hooks.slack.com/..."
echo ""
echo "2. Start the API:"
echo "   sudo systemctl start startclaw-api"
echo ""
echo "3. Test endpoints:"
echo "   curl http://localhost:3000/health"
echo "   curl -H 'Authorization: Bearer YOUR_SECRET' http://localhost:3000/admin/health"
echo ""
echo "Scheduled jobs running:"
echo "   - Health monitor: Every 5 min"
echo "   - Capacity check: Every 15 min"
echo "   - Cleanup: Daily at 2 AM"
echo "   - Backup: Daily at 3 AM"
echo ""
echo "Logs:"
echo "   /var/log/startclaw/health.log"
echo "   /var/log/startclaw/capacity.log"
echo "   /var/log/startclaw/cleanup.log"
echo "   /var/log/startclaw/backup.log"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
