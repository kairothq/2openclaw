# 2OpenClaw Platform - Complete Setup Context

## Architecture
- **Vercel**: 2openclaw.vercel.app (frontend)
- **GitHub**: kairothq/2openclaw
- **molty VM**: Development (asia-south1-a)
- **openclaw2 VM**: Production (asia-south2-c, IP: 34.131.95.162)

## Critical Learning: FREE APIs DO NOT WORK

OpenClaw system prompt is ~10K+ tokens. Free APIs fail:
- Groq free: 6K-12K TPM limit → fails
- OpenRouter free: rate limits → fails
- Gemini free: quota exhausts → fails

**Solution**: Use paid APIs (Anthropic Claude or Gemini with billing)

## Correct OpenClaw Config Format

```json
{
  "env": {
    "vars": {
      "ANTHROPIC_API_KEY": "sk-ant-..."
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-5"
      }
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "123:ABC",
      "allowFrom": ["user_id"],
      "dmPolicy": "allowlist"
    }
  },
  "gateway": {
    "mode": "local",
    "port": 18789,
    "auth": {"mode": "token", "token": "hex"}
  },
  "plugins": {
    "entries": {
      "telegram": {"enabled": true}
    }
  }
}
```

## Docker Settings
```bash
docker run -d --name openclaw-{id} \
  -v /opt/2openclaw/data/instances/{id}:/home/node/.openclaw \
  -p {port}:18789 --memory="1280m" --cpus="0.5" \
  -e NODE_OPTIONS="--max-old-space-size=768" \
  ghcr.io/pspdfkit-labs/openclaw:latest
```

## API Endpoints (openclaw2:3000)
- GET /health
- GET /instances (auth required)
- POST /provision
- PATCH /instances/{id}/config
- GET /instances/{id}/logs

## Vercel Env Vars
```
GCP_API_URL=http://34.131.95.162:3000
GCP_API_SECRET=2openclaw2024secret
```

## SSH Access
```bash
gcloud compute ssh molty --zone=asia-south1-a
gcloud compute ssh openclaw2 --zone=asia-south2-c
```

## Common Fixes
1. "Context limit" → Use paid API
2. "Unknown model" → Check model format
3. Container crash → Use 1280m memory
4. OpenRouter 404 → Enable privacy settings

*Last updated: 2026-02-11*
