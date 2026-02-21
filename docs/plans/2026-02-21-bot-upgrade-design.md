# PM AI Club Bot — Major Upgrade Design

**Date:** 2026-02-21
**Approach:** Monolithic extension (same SQLite + Express + grammY stack)

## Overview

Five feature groups that transform the bot from a course-delivery tool into a gamified learning platform with full admin control:

1. **XP & Levels Engine** — RPG-style progression system
2. **Homework System** — Admin-assigned topics with deadlines
3. **Contests & Challenges** — Quiz contests, creative challenges, polls
4. **Group Message Management** — Full group control from web dashboard
5. **Dashboard Extensions** — 4 new admin pages

---

## 1. XP & Levels Engine

Foundation for all gamification. Every feature awards XP through this shared engine.

### Level Thresholds

| Level | Title (EN) | Title (UK) | XP Required |
|-------|-----------|-----------|-------------|
| 1 | Newbie | Novachok | 0 |
| 2 | Learner | Uchen | 100 |
| 3 | Practitioner | Praktyk | 300 |
| 4 | Specialist | Spetsialist | 600 |
| 5 | Expert | Ekspert | 1000 |
| 6 | Master | Maister | 1500 |
| 7 | Legend | Lehenda | 2500 |

### XP Earning Actions

| Action | XP | Notes |
|--------|-----|-------|
| Complete onboarding | 50 | One-time |
| Complete a homework topic | 30 | Per topic |
| Win a quiz contest (1st) | 50 | 30 for 2nd, 15 for 3rd |
| Answer quiz correctly (/quiz) | 10 | Max 3/day |
| Submit challenge entry | 20 | Per challenge |
| Win a challenge vote (1st) | 40 | |
| Vote in a poll | 5 | Once per poll |
| Daily activity bonus | 5 | Any bot interaction per day |

### DB: `xp_log` table

```sql
CREATE TABLE xp_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### DB: Modify `users` table

```sql
ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN xp_level INTEGER DEFAULT 1;
```

### Telegram Commands

- `/xp` — Show your XP, level, rank, progress to next level
- `/leaderboard` — Top 10 users by XP

Level-up notification sent as DM when user crosses a threshold.

### Dashboard: "Leaderboard" page

Full leaderboard with XP, level, and XP breakdown per category.

---

## 2. Homework System

Admin assigns course topics as mandatory homework with deadlines. Users complete them for XP.

### Flow

1. Admin creates homework (picks topics, sets deadline) from dashboard or Telegram
2. Bot notifies users about new homework via DM
3. User reads the topic, then uses `/complete <topic>` to mark it done
4. Bot asks a verification quiz question from that topic
5. Correct answer = marked complete + XP awarded
6. Admin tracks completion rates in dashboard

### DB: `homework` table

```sql
CREATE TABLE homework (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  topic_slugs TEXT NOT NULL,
  deadline DATETIME,
  xp_reward INTEGER DEFAULT 30,
  created_by INTEGER,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### DB: `homework_progress` table

```sql
CREATE TABLE homework_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  homework_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  topic_slug TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  completed_at DATETIME,
  UNIQUE(homework_id, user_id, topic_slug)
);
```

### Telegram Commands

- `/homework` — Show my active homework (topics, deadlines, status)
- `/complete <topic>` — Mark homework topic as done (triggers quiz)
- Admin: `/assign <topic_slugs> <deadline>` — Create homework

### Notifications

- New homework: DM to all users
- 24h before deadline: reminder DM to users who haven't completed
- Deadline passed: auto-close (via scheduler)

### Dashboard: "Homework" page

- Create homework: pick topics, set deadline, set XP reward
- View active/closed homework with completion rates
- Per-homework detail: which users completed, which are overdue

---

## 3. Contests & Challenges

Three types of competitive activities, all awarding XP.

### Type 1: Quiz Contest (Timed)

1. Admin: `/contest quiz 5` — starts 5-question quiz contest in group
2. Bot posts questions one at a time with inline answer buttons
3. Users tap answers; bot tracks correctness and response time
4. After 30s timeout per question, bot shows correct answer + scoreboard
5. Final results after all questions: 1st/2nd/3rd get XP

### Type 2: Challenge (Submission-based)

1. Admin creates challenge from dashboard (title, description, deadline, voting method)
2. Bot announces in group
3. Users: `/submit <text>` — submit entry via DM
4. After deadline: community vote (bot posts entries) or admin picks winner from dashboard
5. Winner gets XP

### Type 3: Poll (Quick vote)

1. Admin: `/poll Question? | Option A | Option B | Option C`
2. Bot posts poll in group with inline buttons
3. Users vote, earn 5 XP for participating
4. Results visible in dashboard

### DB: `contests` table

```sql
CREATE TABLE contests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  config TEXT,
  deadline DATETIME,
  xp_first INTEGER DEFAULT 50,
  xp_second INTEGER DEFAULT 30,
  xp_third INTEGER DEFAULT 15,
  xp_participate INTEGER DEFAULT 5,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### DB: `contest_entries` table

```sql
CREATE TABLE contest_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  answer TEXT,
  is_correct INTEGER,
  score INTEGER DEFAULT 0,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contest_id, user_id)
);
```

### DB: `contest_votes` table

```sql
CREATE TABLE contest_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id INTEGER NOT NULL,
  voter_id INTEGER NOT NULL,
  entry_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contest_id, voter_id)
);
```

### Telegram Commands

- `/contest` — Show active contests
- `/submit <text>` — Submit challenge entry
- Admin: `/poll Q | A | B` — Create quick poll
- Admin: `/contest quiz N` — Start quiz contest

### Dashboard: "Contests" page

- Create contest (type selector, config form)
- View active/past contests with entries and results
- For challenges: review submissions, pick winners
- For polls: see vote breakdown

---

## 4. Group Message Management (Web UI)

Full group control from the admin dashboard.

### Part A: Bot Message Management

- **Send:** Compose message with HTML formatting, choose target (main chat or topic thread), send or schedule
- **Edit:** Dashboard shows sent bot messages; admin edits text, bot calls `editMessageText()`
- **Delete:** Admin clicks delete, bot calls `deleteMessage()`

### Part B: User Message Moderation

- Bot stores last ~200 group messages in a rolling buffer
- Dashboard shows recent messages with user info
- Admin can: delete message, warn user, mute user — all from dashboard
- Auto-cleanup: delete buffer rows older than 7 days

### DB: `bot_messages` table

```sql
CREATE TABLE bot_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  thread_id INTEGER,
  text TEXT,
  sent_by INTEGER,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### DB: `group_messages` table (rolling buffer)

```sql
CREATE TABLE group_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  thread_id INTEGER,
  user_id INTEGER NOT NULL,
  username TEXT,
  first_name TEXT,
  text TEXT,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### API Endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | /api/group/messages | List bot's sent messages |
| POST | /api/group/send | Send new message to group |
| PUT | /api/group/messages/:id | Edit bot message |
| DELETE | /api/group/messages/:id | Delete bot message |
| GET | /api/group/chat | Recent group chat (buffer) |
| DELETE | /api/group/chat/:msgId | Delete a user's message |
| POST | /api/group/chat/:msgId/warn | Warn the message author |

### Dashboard: "Group" page

Two sub-sections:
1. **Bot Messages** — list of sent bot messages with Edit/Delete, "New Message" composer
2. **Recent Chat** — scrollable feed of recent group messages with Warn/Mute/Delete per message

---

## 5. New Dashboard Pages Summary

| # | Page | Content |
|---|------|---------|
| 7 | Leaderboard | XP rankings, level breakdown |
| 8 | Homework | Create/manage homework, completion tracking |
| 9 | Contests | Create/manage contests, polls, challenges |
| 10 | Group | Bot message CRUD + chat moderation |

(Pages 1-6 already exist: Dashboard, Users, Settings, Subscriptions, Broadcast, Schedule)

---

## Implementation Phases

| Phase | Features | Dependencies |
|-------|----------|-------------|
| **Phase 5** | XP engine + /xp + /leaderboard + Leaderboard dashboard | None |
| **Phase 6** | Homework + /homework + /complete + Homework dashboard | Phase 5 (XP) |
| **Phase 7** | Contests + polls + voting + Contests dashboard | Phase 5 (XP) |
| **Phase 8** | Group message management + Group dashboard | None |

Phases 5 is the foundation. Phases 6 and 7 depend on it. Phase 8 is independent.

---

## Architecture Notes

- All new tables added to `bot/src/db/init.js`
- XP engine as a shared module: `bot/src/db/xp.js`
- New handlers follow existing pattern: `bot/src/handlers/<feature>.js`
- New DB modules: `bot/src/db/homework.js`, `bot/src/db/contests.js`, `bot/src/db/group.js`
- Dashboard pages follow existing SPA pattern in `bot/admin/app.js`
- MySQL mirror extended for new tables
- Scheduler extended for homework deadline checks and contest auto-close
