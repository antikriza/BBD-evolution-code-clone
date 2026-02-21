# VPS Deployment Guide

Transfer BBD Evolution bot + course site from local PC (SSH tunnel) to a standalone VPS.

**Target domain:** `tg.bigbeautydata.com`

---

## Architecture

```
Internet
   │
   ▼
tg.bigbeautydata.com ──► Caddy (auto-HTTPS, port 443/80)
                              │
                              ▼
                         Docker Compose
                         ┌─────────────────────┐
                         │  web (nginx:alpine)  │ :8888 → course HTML
                         │  bot (node:20-alpine)│ outbound only (Telegram polling)
                         │  bot-state volume    │ SQLite persistence
                         └─────────────────────┘
```

The **bot** uses long polling (outbound HTTPS to Telegram API) — no incoming ports needed.
The **web** container serves course pages on port 8888, proxied by Caddy.

---

## Prerequisites

- VPS with Ubuntu 22.04+ (1 GB RAM is enough)
- Root or sudo access
- Domain `tg.bigbeautydata.com` DNS managed by you

---

## Step 1 — System Setup

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl
```

### Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo systemctl enable docker
```

Log out and back in for the docker group to take effect:

```bash
exit
# SSH back in
```

Verify:

```bash
docker --version
docker compose version
```

---

## Step 2 — Clone Repository

```bash
sudo mkdir -p /opt/bbd-bot
sudo chown $USER:$USER /opt/bbd-bot
git clone https://github.com/antikriza/BBD-evolution-code-clone.git /opt/bbd-bot
cd /opt/bbd-bot
```

---

## Step 3 — Configure Environment

```bash
cp bot/.env.example .env
nano .env
```

Set your real values:

```
BOT_TOKEN=<your-telegram-bot-token>
COURSE_BASE_URL=https://antikriza.github.io/BBD-evolution-code-clone/telegram-archive/course
```

> **Note:** `.env` is in the project root (not inside `bot/`).
> Docker Compose injects these vars via `env_file: .env`.

---

## Step 4 — Build & Start Containers

```bash
cd /opt/bbd-bot
docker compose up -d --build
```

Check status:

```bash
docker compose ps
docker compose logs -f bot   # watch bot logs (Ctrl+C to exit)
docker compose logs -f web   # watch web logs
```

Expected output from bot:

```
Bot commands set.
Bot starting...
```

---

## Step 5 — DNS

Go to your DNS provider and update the A record:

```
tg.bigbeautydata.com  →  A  →  <VPS-IP-ADDRESS>
```

Remove any old records (CNAME, tunnel configs, etc.).

Wait for propagation (usually 1–15 minutes). Verify:

```bash
dig tg.bigbeautydata.com +short
# Should show your VPS IP
```

---

## Step 6 — HTTPS with Caddy

Caddy auto-provisions Let's Encrypt certificates.

### Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### Configure

```bash
sudo tee /etc/caddy/Caddyfile << 'EOF'
tg.bigbeautydata.com {
    reverse_proxy localhost:8888
}
EOF
```

### Start

```bash
sudo systemctl restart caddy
sudo systemctl enable caddy
```

### Verify

Open `https://tg.bigbeautydata.com` in a browser — you should see the course site with a valid SSL certificate.

---

## Step 7 — Disable Old SSH Tunnel

Once everything works on the VPS, stop the SSH tunnel on your local PC.
The bot and site now run independently on the VPS.

---

## Maintenance

### View logs

```bash
cd /opt/bbd-bot
docker compose logs -f          # all services
docker compose logs -f bot      # bot only
docker compose logs --tail=50   # last 50 lines
```

### Restart services

```bash
docker compose restart          # restart all
docker compose restart bot      # restart bot only
```

### Update code

```bash
cd /opt/bbd-bot
git pull
docker compose up -d --build
```

### Check disk usage

```bash
docker system df
du -sh /var/lib/docker/volumes/  # volume sizes
```

### Backup SQLite database

```bash
docker compose cp bot:/app/state/bot.db ./backup-bot.db
```

See [backup.md](./backup.md) for automated daily backups, restore, and CSV export.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Bot not starting | `docker compose logs bot` — check for token errors |
| "BOT_TOKEN is required" | Verify `.env` has `BOT_TOKEN=...` in project root |
| Course data missing | Check `telegram-archive/course/course-data.json` exists |
| Port 8888 already in use | `sudo lsof -i :8888` — kill conflicting process |
| Caddy won't start | `sudo systemctl status caddy` — check DNS points to VPS |
| SSL certificate fails | DNS must resolve to VPS IP before Caddy can get cert |
| Container keeps restarting | `docker compose logs bot --tail=100` for crash reason |
| SQLite locked | Only one bot container should run; check `docker compose ps` |

---

## File Structure on VPS

```
/opt/bbd-bot/
├── .env                          # BOT_TOKEN + COURSE_BASE_URL
├── docker-compose.yml            # web + bot services
├── Dockerfile                    # web (nginx) image
├── nginx.conf                    # course site config
├── bot/
│   ├── Dockerfile                # bot (node) image
│   ├── package.json
│   └── src/                      # bot source code
└── telegram-archive/
    └── course/
        ├── course-data.json      # mounted into bot container
        ├── en/                   # English course pages
        ├── uk/                   # Ukrainian course pages
        └── twa/                  # TWA pages
```

Docker volume `bot-state` stores `/app/state/bot.db` (SQLite) — persists across rebuilds.
