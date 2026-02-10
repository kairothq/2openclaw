# Cloud-Agnostic Architecture

2OpenClaw is designed to be portable across cloud providers.

---

## Current Infrastructure

| Component | Current | Notes |
|-----------|---------|-------|
| API/Container Host | GCP e2-standard-2 | $300 free credit |
| Backups | Google Cloud Storage | gs://2openclaw-backups |
| Frontend | Vercel | Free tier |
| Domain | nip.io (temporary) | Plan to buy domain later |

---

## Environment Variables

All infrastructure-specific values are in environment variables:

```bash
# /opt/2openclaw/.env
BRAND_NAME=2openclaw
DOMAIN_SUFFIX=34.131.95.162.nip.io  # Later: yourdomain.com
DATA_DIR=/opt/2openclaw/data
BACKUP_REMOTE=gcs:2openclaw-backups  # rclone format
API_SECRET=2openclaw2024secret
LOG_DIR=/var/log/2openclaw
EXTERNAL_IP=34.131.95.162
PORT=3000
```

---

## Backup Storage Abstraction

Use `rclone` instead of `gsutil` for cloud-agnostic backups:

### Install rclone
```bash
curl https://rclone.org/install.sh | sudo bash
```

### Configure remote (interactive)
```bash
rclone config
```

### Supported backends
- Google Cloud Storage (gcs)
- Amazon S3 (s3)
- Backblaze B2 (b2)
- DigitalOcean Spaces (s3)
- Dropbox (dropbox)
- Local filesystem (local)

### Usage in backup script
```bash
# Instead of: gsutil cp file gs://bucket/
# Use:        rclone copy file remote:bucket/

BACKUP_REMOTE="${BACKUP_REMOTE:-gcs:2openclaw-backups}"
rclone copy /backups "$BACKUP_REMOTE/"
```

---

## Migration Checklist: GCP to Other Provider

### 1. Export Data
```bash
# On old server
tar czf 2openclaw-full-backup.tar.gz /opt/2openclaw/
scp 2openclaw-full-backup.tar.gz user@new-server:/tmp/
```

### 2. New Server Setup
```bash
# On new server (Hostinger, DigitalOcean, Hetzner, etc.)

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Caddy
sudo apt install caddy

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Create directories
sudo mkdir -p /opt/2openclaw/data/instances
sudo chown -R 1000:1000 /opt/2openclaw/data
```

### 3. Import Data
```bash
tar xzf /tmp/2openclaw-full-backup.tar.gz -C /
```

### 4. Update Environment
```bash
# Update .env with new IP
nano /opt/2openclaw/.env
# Change EXTERNAL_IP and DOMAIN_SUFFIX
```

### 5. Update Vercel
```
# In Vercel dashboard, update environment variable:
GCP_API_URL=http://NEW_IP:3000
```

### 6. Start Services
```bash
cd /opt/2openclaw/api
npm install
sudo systemctl start 2openclaw-api

# Restart all containers
for container in $(docker ps -aq --filter "name=openclaw-"); do
    docker start $container
done
```

---

## Supported Providers Comparison

| Provider | vCPU | RAM | Storage | Monthly Cost | Notes |
|----------|------|-----|---------|--------------|-------|
| **GCP e2-medium** | 2 | 4GB | 10GB | ~$25 | Current, $300 free credit |
| **GCP e2-standard-2** | 2 | 8GB | 20GB | ~$50 | Current production |
| **Hostinger KVM 2** | 2 | 8GB | 100GB | $9 | Great value |
| **DigitalOcean** | 2 | 4GB | 80GB | $24 | Easy to use |
| **Hetzner CX22** | 2 | 4GB | 40GB | ~$5 | EU only, cheapest |
| **Oracle Cloud** | 4 | 24GB | 200GB | $0 | Free tier, complex |
| **Vultr** | 2 | 4GB | 80GB | $24 | Global locations |

### Recommendation
- **Current**: Stay on GCP while $300 credit lasts
- **After credit**: Migrate to Hostinger ($9/mo) or Hetzner ($5/mo)

---

## DNS/Domain Migration

### Current: nip.io (no domain needed)
```
user123.34.131.95.162.nip.io → localhost:PORT
```

### Future: Custom domain
```bash
# 1. Buy domain (e.g., 2openclaw.com or better name)

# 2. Set DNS A record
*.2openclaw.com → SERVER_IP

# 3. Update Caddy config
{$DOMAIN_SUFFIX} {
    reverse_proxy localhost:{$PORT}
}

# 4. Update .env
DOMAIN_SUFFIX=2openclaw.com
```

---

## Docker Image Portability

The OpenClaw Docker image works on any provider:

```bash
# Same command everywhere
docker pull ghcr.io/openclaw/openclaw:latest

docker run -d \
    --name openclaw-$USER_ID \
    --restart unless-stopped \
    -v /opt/2openclaw/data/instances/$USER_ID:/home/node/.openclaw \
    -p $PORT:18789 \
    --memory="1536m" \
    --cpus="1" \
    -e NODE_OPTIONS="--max-old-space-size=1280" \
    ghcr.io/openclaw/openclaw:latest
```

---

## Monitoring Portability

All monitoring scripts use standard Linux tools:
- `docker` - Container management
- `curl` - Health checks
- `free` - RAM usage
- `df` - Disk usage
- `cron` - Scheduling

No cloud-specific dependencies.

---

## Cost Optimization Path

| Stage | Users | Infrastructure | Monthly Cost |
|-------|-------|----------------|--------------|
| MVP | 0-10 | GCP free tier | $0 |
| Growth | 10-50 | Hostinger KVM 2 | $9 |
| Scale | 50-200 | 2x Hostinger | $18 |
| Enterprise | 200+ | Kubernetes | $100+ |

---

*Last updated: 2026-02-11*
