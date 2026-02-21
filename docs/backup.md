# Bot Database Backup Guide

The bot stores all user data in a single SQLite file: `bot.db`

---

## What's Inside

One table — `users`:

| Column | Type | Description |
|--------|------|-------------|
| telegram_id | INTEGER | Telegram user ID (primary key) |
| username | TEXT | @username |
| first_name | TEXT | Telegram first name |
| display_name | TEXT | Name from onboarding (Step 0) |
| role | TEXT | developer / pm / designer / student / other (Step 1) |
| experience | TEXT | beginner / intermediate / advanced / expert (Step 2) |
| interests | TEXT | Comma-separated: ai-models,coding-tools,agents,prompt-eng,career (Step 3) |
| lang | TEXT | en or uk |
| onboarding_step | INTEGER | 0–4 (current onboarding step) |
| onboarding_complete | INTEGER | 0 or 1 |
| joined_at | DATETIME | First interaction timestamp |
| updated_at | DATETIME | Last update timestamp |

---

## Where Is the File

| Environment | Path |
|-------------|------|
| Docker (VPS) | Named volume `bot-state` → `/app/state/bot.db` |
| Local dev | `bot/state/bot.db` |

---

## Manual Backup

### From VPS (Docker)

```bash
# Copy DB out of the container
cd /opt/bbd-bot
docker compose cp bot:/app/state/bot.db ./backups/bot-$(date +%Y%m%d-%H%M%S).db

# Or copy to your local machine via scp
scp user@vps-ip:/opt/bbd-bot/backups/bot-*.db ./local-backups/
```

### From local PC

```bash
cp bot/state/bot.db backups/bot-$(date +%Y%m%d-%H%M%S).db
```

---

## Automated Daily Backup (VPS)

### Option 1 — Cron job (simple)

```bash
# Create backup directory
sudo mkdir -p /opt/bbd-bot/backups

# Add cron job (runs daily at 3 AM)
crontab -e
```

Add this line:

```
0 3 * * * cd /opt/bbd-bot && docker compose cp bot:/app/state/bot.db ./backups/bot-$(date +\%Y\%m\%d).db && find ./backups -name "bot-*.db" -mtime +30 -delete
```

This:
1. Copies the DB daily
2. Deletes backups older than 30 days

### Option 2 — Backup script

Save as `/opt/bbd-bot/backup.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/bbd-bot/backups"
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

FILENAME="bot-$(date +%Y%m%d-%H%M%S).db"

# Copy from running container
docker compose -f /opt/bbd-bot/docker-compose.yml cp bot:/app/state/bot.db "$BACKUP_DIR/$FILENAME"

echo "Backed up to $BACKUP_DIR/$FILENAME ($(du -h "$BACKUP_DIR/$FILENAME" | cut -f1))"

# Clean old backups
find "$BACKUP_DIR" -name "bot-*.db" -mtime +$KEEP_DAYS -delete
echo "Cleaned backups older than $KEEP_DAYS days."
```

```bash
chmod +x /opt/bbd-bot/backup.sh

# Add to cron
crontab -e
# Add: 0 3 * * * /opt/bbd-bot/backup.sh >> /opt/bbd-bot/backups/backup.log 2>&1
```

---

## Restore from Backup

```bash
cd /opt/bbd-bot

# Stop the bot (important — SQLite doesn't like writes during copy)
docker compose stop bot

# Copy backup into the volume
docker compose cp ./backups/bot-20250219.db bot:/app/state/bot.db

# Restart
docker compose start bot
```

---

## Export to CSV (for viewing in Excel/Google Sheets)

From VPS:

```bash
# Enter the container
docker compose exec bot sh

# Inside container — export to CSV
sqlite3 /app/state/bot.db -header -csv "SELECT * FROM users;" > /app/state/users-export.csv
exit

# Copy CSV out
docker compose cp bot:/app/state/users-export.csv ./users-export.csv
```

Or from outside, if `sqlite3` is installed on the VPS:

```bash
# Find actual volume path
VOLUME_PATH=$(docker volume inspect bbd-bot_bot-state --format '{{.Mountpoint}}')
sudo sqlite3 "$VOLUME_PATH/bot.db" -header -csv "SELECT * FROM users;" > users-export.csv
```

---

## Transfer DB from Local PC to VPS

If you have existing user data on your local PC:

```bash
# 1. On local PC — copy the DB file
scp bot/state/bot.db user@vps-ip:/opt/bbd-bot/bot.db.transfer

# 2. On VPS — stop bot, copy into volume, restart
cd /opt/bbd-bot
docker compose stop bot
docker compose cp ./bot.db.transfer bot:/app/state/bot.db
docker compose start bot
rm bot.db.transfer
```

---

## Important Notes

- **Never delete the volume with `-v`**: `docker compose down` is safe, `docker compose down -v` destroys the database.
- **SQLite WAL mode**: The bot uses WAL (Write-Ahead Logging). When backing up, there may be `-wal` and `-shm` files alongside `bot.db`. The main `.db` file alone is sufficient for backup if the bot is stopped first. For hot backups (while running), copy all three files.
- **File size**: SQLite is compact. Even 10,000 users would be under 1 MB.
