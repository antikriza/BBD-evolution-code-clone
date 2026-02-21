# PM AI Club Bot — Admin Guide

## Access & Security

### Web Dashboard

**URL:** `https://tg.bigbeautydata.com/admin/`

The dashboard has **two layers of protection**:

| Layer | What | Credentials |
|-------|------|-------------|
| 1. Nginx Basic Auth | Browser popup on page load | Username: `admin` / Password: `BbdAdmin2026!` |
| 2. API Token | Login form inside the dashboard | Token from `.env` → `ADMIN_TOKEN` |

> **To change basic auth password:**
> 1. Generate new hash: `htpasswd -bn admin NEW_PASSWORD`
> 2. Put the output in `.htpasswd` file (project root)
> 3. Rebuild: `docker compose up -d --build web`
>
> **To change API token:**
> 1. Edit `.env` → `ADMIN_TOKEN=your-new-token`
> 2. Rebuild: `docker compose up -d --build bot`

### Telegram Admin Commands

Only users listed in `.env` → `ADMIN_IDS` can use admin commands.
Currently: `125115376`

To add more admins, edit `.env`:
```
ADMIN_IDS=125115376,SECOND_ID,THIRD_ID
```

---

## Web Dashboard Pages

### 1. Dashboard
Overview stats: total users, completed onboarding, new users (24h / 7d), role breakdown, recent users.

### 2. Users
- Paginated user table with search
- Click "View" to see full profile (role, experience, interests, subscriptions)
- Export all users as CSV file

### 3. Settings
Edit onboarding questions (roles, experience levels, interests):
- Each option has an `id`, English label, and Ukrainian label
- Add new options with the form at the bottom
- Remove options with the "Remove" button

### 4. Subscriptions
Shows which course topics have subscribers and how many.

### 5. Broadcast
Send messages to users:
- **All Users** — everyone registered
- **Completed Profiles Only** — users who finished onboarding
- **Topic Subscribers** — users subscribed to a specific topic

Messages support HTML formatting: `<b>bold</b>`, `<i>italic</i>`, `<code>code</code>`

### 6. Schedule
Create timed broadcasts that send automatically:
- Set date/time (UTC), audience, and message
- View upcoming and past messages with status badges
- Cancel pending messages

### 7. Leaderboard
XP rankings showing all users with their level, XP points, and rank. Visual level distribution bar chart.

### 8. Homework
- View all homework assignments with status and completion count
- Create new assignments: title, topic slugs, deadline, XP reward
- Click to see detailed progress per user
- Close assignments manually

### 9. Contests
- Create contests: poll, quiz, or challenge types
- View active/closed contests with status badges
- Contest detail: entries, scores/votes, type-specific views
- Activate, transition to voting, or close contests

### 10. Group Management
Two sections:
- **Bot Messages:** Send new messages to group (with thread ID support), edit or delete sent messages
- **Recent Chat:** Rolling 7-day log of group messages, delete messages or warn users directly from dashboard

---

## Telegram Commands Reference

### For All Users

| Command | Description |
|---------|-------------|
| `/start` | Welcome message + onboarding |
| `/help` | List all commands |
| `/course` | Course overview with 5 levels |
| `/level 1-5` | Topics for a specific level |
| `/topic name` | Topic details |
| `/glossary term` | Look up a key term |
| `/quiz` | Random quiz question |
| `/random` | Random tip or fact |
| `/today` | Topic of the day |
| `/rules` | Group rules |
| `/links` | Useful links |
| `/faq` | FAQ |
| `/search keyword` | Search course content |
| `/subscribe` | Subscribe to topic updates |
| `/mysubs` | View my subscriptions |
| `/lang` | Switch language (EN/UK) |
| `/xp` | Your XP and level |
| `/leaderboard` | Top 10 XP leaderboard |
| `/homework` | Your homework assignments |
| `/complete topic` | Take quiz to complete topic |
| `/contest` | Active contests |
| `/submit` | Submit challenge entry (DM only) |

### Admin — General (DM or Group)

| Command | Description |
|---------|-------------|
| `/admin` | Admin panel with inline buttons |
| `/stats` | Quick bot statistics |
| `/users` | Paginated user list |
| `/broadcast Hello!` | Send message to all users |
| `/broadcast_completed Hello!` | Send to completed profiles only |
| `/broadcast_topic slug Hello!` | Send to topic subscribers |
| `/export` | Export users as CSV file |
| `/subscriptions` | Show subscription statistics |
| `/schedule` | View upcoming scheduled messages |
| `/schedule_add 2026-03-01 15:00 Hello!` | Schedule a broadcast (UTC time) |

### Admin — Onboarding Settings

| Command | Description |
|---------|-------------|
| `/editroles` | View & manage roles |
| `/editexperience` | View & manage experience levels |
| `/editinterests` | View & manage interests |
| `/addoption roles analyst Analyst \| Аналітик` | Add option |
| `/removeoption roles analyst` | Remove option |

### Admin — Content Management

| Command | Description |
|---------|-------------|
| `/assign` | Create homework assignment (interactive) |
| `/poll Question \| Option1 \| Option2` | Create a group poll |
| `/contest quiz 5` | Start a quiz contest with N questions |

### Admin — Group Moderation

These commands work **only in groups** (reply to a user's message):

| Command | Description |
|---------|-------------|
| `/warn reason` | Warn user. Auto-mutes at 3 warnings (1 hour) |
| `/mute 30` | Mute user for N minutes (default: 60) |
| `/unmute` | Remove mute |
| `/ban` | Ban user from group |
| `/warnings` | Show user's warning history |
| `/clearwarnings` | Reset user's warnings to 0 |

**How to use moderation:**
1. Find the offending message in the group
2. Reply to that message with the command (e.g., reply → `/warn spam`)
3. The bot responds in the group (not DM)

**Auto-mute:** After 3 warnings, the user is automatically muted for 1 hour.

> **Important:** The bot must be a group admin with these permissions:
> - Delete messages
> - Restrict members
> - Ban users

---

## Scheduled Messages

### Via Telegram
```
/schedule_add 2026-03-15 09:00 <b>Good morning!</b> New lesson available.
```
- Time is **UTC**
- HTML formatting supported
- Sends to all users by default

### Via Web Dashboard
1. Go to Schedule tab
2. Set date/time, audience, message
3. Click "Schedule Message"

### How it works
- Background job checks every 60 seconds for pending messages
- When `send_at` time arrives, the bot sends to all matching users
- Rate limited: 25 messages per second to avoid Telegram limits
- Status changes: `pending` → `sending` → `sent`

---

## API Endpoints

All endpoints require `Authorization: Bearer <TOKEN>` header.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stats` | Dashboard statistics |
| `GET` | `/api/users?page=0&limit=20` | Paginated users |
| `GET` | `/api/users/search?q=name` | Search users |
| `GET` | `/api/users/:id` | User detail |
| `GET` | `/api/users/export/csv` | CSV export |
| `GET` | `/api/settings/roles` | Get roles |
| `PUT` | `/api/settings/roles` | Update roles `{items: [...]}` |
| `POST` | `/api/settings/roles/options` | Add role `{id, en, uk}` |
| `DELETE` | `/api/settings/roles/options/:id` | Remove role |
| `GET` | `/api/subscriptions` | Topic subscriber counts |
| `POST` | `/api/broadcast` | Send broadcast `{text, audience, topicSlug}` |
| `GET` | `/api/topics` | All course topics |
| `GET` | `/api/schedule` | All scheduled messages |
| `POST` | `/api/schedule` | Create `{text, audience, topicSlug, sendAt}` |
| `DELETE` | `/api/schedule/:id` | Cancel pending message |
| `GET` | `/api/moderation/warnings` | Recent warnings |
| `GET` | `/api/moderation/warnings/:userId` | User's warnings |
| `GET` | `/api/leaderboard` | XP leaderboard |
| `GET` | `/api/users/:id/xp` | User XP breakdown |
| `GET` | `/api/homework` | All homework |
| `POST` | `/api/homework` | Create `{title, topicSlugs, deadline, xpReward}` |
| `GET` | `/api/homework/:id` | Homework detail + progress |
| `PUT` | `/api/homework/:id/close` | Close homework |
| `GET` | `/api/contests` | All contests |
| `POST` | `/api/contests` | Create `{type, title, description, deadline, config}` |
| `GET` | `/api/contests/:id` | Contest detail + entries + results |
| `PUT` | `/api/contests/:id/close` | Close contest |
| `PUT` | `/api/contests/:id/status` | Change status `{status}` |
| `GET` | `/api/group/messages` | Bot's sent messages |
| `POST` | `/api/group/send` | Send message `{chatId, text, threadId}` |
| `PUT` | `/api/group/messages/:id` | Edit bot message `{text}` |
| `DELETE` | `/api/group/messages/:id` | Delete bot message |
| `GET` | `/api/group/chat` | Recent group messages |
| `DELETE` | `/api/group/chat/:chatId/:msgId` | Delete user message |
| `POST` | `/api/group/chat/:chatId/:msgId/warn` | Warn user `{reason}` |

---

## Docker Operations

```bash
# Rebuild & restart everything
docker compose up -d --build

# Rebuild only bot (after code or .env changes)
docker compose up -d --build bot

# Rebuild only web (after nginx/htpasswd changes)
docker compose up -d --build web

# View bot logs
docker logs bbd-evolution-bot --tail 50

# View nginx logs
docker logs bbd-evolution-site --tail 50

# Restart without rebuild
docker compose restart

# Stop everything
docker compose down

# Backup SQLite database
docker cp bbd-evolution-bot:/app/state/bot.db ./backup-bot.db
```

---

## Architecture Overview

```
User → Telegram API → grammY bot (long polling)
                        ↓
                    SQLite (primary DB)
                        ↓
                    MySQL mirror (remote sync)

Browser → nginx:80 → /admin → bot:3000 (Express)
                    → /api   → bot:3000 (Express)
                    → /course → static files
```

- **Bot process:** grammY + Express + Scheduler + XP Engine + Group Logger (single Node.js process)
- **Nginx:** reverse proxy + static file server + basic auth
- **SQLite:** primary data store (WAL mode) — users, XP, homework, contests, group messages
- **MySQL:** async mirror for backup/analytics (users, XP, homework, contests)
