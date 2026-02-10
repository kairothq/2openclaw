# 2OpenClaw - Name Migration & Branding Record

**Purpose**: Track all naming decisions and locations for easy future migrations.

---

## Current Brand Status

| Field | Current Value | Notes |
|-------|---------------|-------|
| **Brand Name** | 2openclaw | Has issues - consider changing |
| **Domain** | None (using nip.io) | Plan to buy domain later |
| **GitHub Repo** | kairothq/2openclaw | |
| **Vercel URL** | 2openclaw.vercel.app | |

---

## Naming History

| Date | Old Name | New Name | Reason | Changed By |
|------|----------|----------|--------|------------|
| 2026-02-01 | startclaw | 2openclaw | Rebranding | Initial |
| 2026-02-11 | (cleanup) | 2openclaw | Fixed all remaining startclaw references | Claude |
| TBD | 2openclaw | ??? | See issues below | Pending |

---

## Issues with "2openclaw"

| Problem | Impact | Severity |
|---------|--------|----------|
| Verbal confusion ("two" vs "to") | Users can't tell others the URL | High |
| Voice search fails | 20% users use voice search | Medium |
| Spelling uncertainty | Lost traffic | Medium |
| Looks spammy | Trust issues | Medium |
| Not memorable | Brand recall | Medium |

---

## Alternative Names Considered

| Name | Domain Available? | Pros | Cons |
|------|-------------------|------|------|
| ClawdHost | Check clawdhost.com | Clear, professional | Generic |
| EasyClaw | Check easyclaw.in | Value prop clear, cheap .in | |
| MyClaw | Check myclaw.in | Personal, friendly | Competitor exists |
| LaunchClaw | Check launchclaw.com | Action-oriented | |
| ClawBot | Check clawbot.in | Short | Too generic |
| OpenClawCloud | Check | Professional | Long |
| ClawdDeploy | Check | Technical | Too technical |

---

## All Locations Requiring Name Changes

### Tier 1: Code Files (MUST change)

| File | Location | What to Change |
|------|----------|----------------|
| `api/server.js` | Line ~15 | `DATA_DIR = '/opt/{NAME}/data'` |
| `api/server.js` | Line ~16 | `API_SECRET` default value |
| `infra/scripts/backup.sh` | Lines 7-10 | `INSTANCES_DIR`, `GCS_BUCKET`, `LOG_FILE` |
| `infra/scripts/restore.sh` | All paths | `/opt/{NAME}/` paths |
| `infra/scripts/setup.sh` | All paths | `/opt/{NAME}/` paths |

### Tier 2: Documentation (Should change)

| File | Sections to Update |
|------|-------------------|
| `docs/ARCHITECTURE.md` | Title, all domain references, paths |
| `docs/SETUP.md` | Title, VM names, paths, bucket names |
| `docs/AI_PROVIDERS.md` | Title, all "StartClaw" text |
| `docs/PRD.md` | GCS bucket, paths, URLs |
| `docs/SETUP_CONTEXT.md` | Paths, secrets |
| `docs/LESSONS_LEARNED.md` | Any brand references |
| `docs/COMPREHENSIVE_PLATFORM_PLAN.md` | Paths, buckets |
| `docs/IMPLEMENTATION_GUIDE.md` | All paths |
| `README.md` | Project name, URLs |

### Tier 3: Infrastructure (Requires SSH)

| Location | What to Change |
|----------|----------------|
| molty VM | `~/2openclaw/` directory |
| molty VM | systemd service name |
| openclaw2 VM | `/opt/{NAME}/` directory |
| openclaw2 VM | Cron job paths |
| openclaw2 VM | Log file paths |
| GCS | Bucket name `gs://{NAME}-backups` |
| Vercel | Environment variables |

### Tier 4: External Services

| Service | What to Change |
|---------|----------------|
| GitHub | Repo name (optional) |
| Vercel | Project name, URL |
| GCS | Bucket name |
| Domain registrar | When buying domain |

---

## Environment Variables to Abstract Names

```bash
# .env - All name-dependent values in one place
BRAND_NAME=2openclaw
DOMAIN_SUFFIX=34.131.95.162.nip.io  # Later: yourdomain.com
DATA_DIR=/opt/2openclaw/data
BACKUP_BUCKET=gs://2openclaw-backups
API_SECRET=2openclaw2024secret
LOG_DIR=/var/log/2openclaw
```

---

## Name Change Procedure (Future)

When changing the brand name:

### Step 1: Update this file
- Add entry to "Naming History" table
- Update "Current Brand Status"

### Step 2: Global search & replace in repo
```bash
# Find all occurrences
grep -rn "OLD_NAME" --include="*.md" --include="*.js" --include="*.sh" --include="*.json" .

# Replace (use sed or IDE)
find . -type f \( -name "*.md" -o -name "*.js" -o -name "*.sh" \) -exec sed -i 's/OLD_NAME/NEW_NAME/g' {} +
```

### Step 3: Update infrastructure
```bash
# On VMs
sudo mv /opt/OLD_NAME /opt/NEW_NAME
sudo sed -i 's/OLD_NAME/NEW_NAME/g' /etc/systemd/system/*.service
sudo systemctl daemon-reload

# GCS bucket (create new, migrate, delete old)
gsutil mb gs://NEW_NAME-backups
gsutil -m cp -r gs://OLD_NAME-backups/* gs://NEW_NAME-backups/
gsutil rb gs://OLD_NAME-backups
```

### Step 4: Update external services
- Vercel: Update env vars
- GitHub: Rename repo (optional)
- Update DNS if applicable

### Step 5: Commit and deploy
```bash
git add .
git commit -m "Rebrand: OLD_NAME → NEW_NAME"
git push
```

---

## Quick Reference: Current Paths

```
GitHub:     https://github.com/kairothq/2openclaw
Vercel:     https://2openclaw.vercel.app
API:        http://34.131.95.162:3000
Data:       /opt/2openclaw/data/instances/{userId}/
Backups:    gs://2openclaw-backups/
Logs:       /var/log/2openclaw/
Config:     /opt/2openclaw/data/instances/{userId}/openclaw.json
Scripts:    /opt/2openclaw/scripts/
```

## VMs

```
molty (dev):     gcloud compute ssh molty --zone=asia-south1-a
openclaw2 (prod): gcloud compute ssh openclaw2 --zone=asia-south2-c
```

---

*Last updated: 2026-02-11*
