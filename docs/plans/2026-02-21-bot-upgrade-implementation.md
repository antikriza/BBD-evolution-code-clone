# PM AI Club Bot — Major Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the PM AI Club bot into a gamified learning platform with XP/levels, homework assignments, contests/polls, and full group management from the web dashboard.

**Architecture:** Monolithic extension of existing SQLite + Express + grammY stack. All features share a single XP engine. 8 new DB tables, 4 new dashboard pages, ~10 new Telegram commands.

**Tech Stack:** grammY, better-sqlite3, Express.js, vanilla JS SPA, Docker

---

## Phase 5: XP & Levels Engine (Foundation)

Everything else depends on this. Must be completed first.

---

### Task 5.1: Add XP columns to users table + create xp_log table

**Files:**
- Modify: `bot/src/db/init.js:14-29` (users table) and append after line 70

**Step 1: Add xp/xp_level columns to users table**

In `bot/src/db/init.js`, add two columns after the `CREATE TABLE IF NOT EXISTS users` block (line 29). Since SQLite doesn't error on `ALTER TABLE IF NOT EXISTS`, use safe ALTERs:

```js
// After line 70 (after scheduled_messages table), add:

// ── Phase 5: XP & Gamification ──

// Add XP columns to users (safe: ALTER ignores if column exists)
try { db.exec('ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE users ADD COLUMN xp_level INTEGER DEFAULT 1'); } catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS xp_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
```

**Step 2: Verify — rebuild Docker and check logs**

```bash
docker compose up -d --build bot
docker logs bbd-evolution-bot --tail 20
```

Expected: No errors about table creation. Bot starts normally.

**Step 3: Commit**

```bash
git add bot/src/db/init.js
git commit -m "feat: add xp_log table and xp columns to users"
```

---

### Task 5.2: Create XP engine DB module

**Files:**
- Create: `bot/src/db/xp.js`

**Step 1: Create the XP engine module**

```js
const db = require('./init');

const XP_LEVELS = [
  { level: 1, title_en: 'Newbie',       title_uk: 'Новачок',     xp: 0 },
  { level: 2, title_en: 'Learner',      title_uk: 'Учень',       xp: 100 },
  { level: 3, title_en: 'Practitioner', title_uk: 'Практик',     xp: 300 },
  { level: 4, title_en: 'Specialist',   title_uk: 'Спеціаліст',  xp: 600 },
  { level: 5, title_en: 'Expert',       title_uk: 'Експерт',     xp: 1000 },
  { level: 6, title_en: 'Master',       title_uk: 'Майстер',     xp: 1500 },
  { level: 7, title_en: 'Legend',        title_uk: 'Легенда',     xp: 2500 },
];

const stmts = {
  addXp: db.prepare(`
    INSERT INTO xp_log (user_id, amount, reason, reference_id) VALUES (?, ?, ?, ?)
  `),
  updateUserXp: db.prepare(`
    UPDATE users SET xp = xp + ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?
  `),
  setUserLevel: db.prepare(`
    UPDATE users SET xp_level = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?
  `),
  getUserXp: db.prepare('SELECT xp, xp_level FROM users WHERE telegram_id = ?'),
  getLeaderboard: db.prepare(`
    SELECT telegram_id, username, first_name, display_name, xp, xp_level
    FROM users WHERE xp > 0 ORDER BY xp DESC LIMIT ?
  `),
  getUserRank: db.prepare(`
    SELECT COUNT(*) + 1 as rank FROM users WHERE xp > (SELECT xp FROM users WHERE telegram_id = ?)
  `),
  getXpBreakdown: db.prepare(`
    SELECT reason, SUM(amount) as total FROM xp_log WHERE user_id = ? GROUP BY reason ORDER BY total DESC
  `),
  getDailyXpCount: db.prepare(`
    SELECT COUNT(*) as cnt FROM xp_log
    WHERE user_id = ? AND reason = ? AND created_at >= datetime('now', '-1 day')
  `),
};

function calculateLevel(xp) {
  let level = 1;
  for (const l of XP_LEVELS) {
    if (xp >= l.xp) level = l.level;
  }
  return level;
}

function getLevelInfo(level, lang) {
  const l = XP_LEVELS.find(x => x.level === level) || XP_LEVELS[0];
  return lang === 'uk' ? l.title_uk : l.title_en;
}

function getNextLevelXp(currentLevel) {
  const next = XP_LEVELS.find(l => l.level === currentLevel + 1);
  return next ? next.xp : null;
}

// Award XP and check for level-up. Returns { newXp, newLevel, leveledUp, levelTitle }
function awardXp(userId, amount, reason, referenceId = null) {
  stmts.addXp.run(userId, amount, reason, referenceId);
  stmts.updateUserXp.run(amount, userId);

  const user = stmts.getUserXp.get(userId);
  if (!user) return null;

  const newLevel = calculateLevel(user.xp);
  const leveledUp = newLevel > user.xp_level;

  if (leveledUp) {
    stmts.setUserLevel.run(newLevel, userId);
  }

  return {
    newXp: user.xp,
    newLevel,
    leveledUp,
    levelTitle: XP_LEVELS.find(l => l.level === newLevel),
  };
}

function getUserXp(userId) {
  return stmts.getUserXp.get(userId);
}

function getLeaderboard(limit = 10) {
  return stmts.getLeaderboard.all(limit);
}

function getUserRank(userId) {
  return stmts.getUserRank.get(userId)?.rank || 0;
}

function getXpBreakdown(userId) {
  return stmts.getXpBreakdown.all(userId);
}

function getDailyXpCount(userId, reason) {
  return stmts.getDailyXpCount.get(userId, reason)?.cnt || 0;
}

module.exports = {
  XP_LEVELS, awardXp, getUserXp, getLeaderboard, getUserRank,
  getXpBreakdown, getDailyXpCount, calculateLevel, getLevelInfo, getNextLevelXp,
};
```

**Step 2: Commit**

```bash
git add bot/src/db/xp.js
git commit -m "feat: create XP engine DB module with level system"
```

---

### Task 5.3: Create /xp and /leaderboard Telegram handlers

**Files:**
- Create: `bot/src/handlers/xp.js`
- Modify: `bot/src/index.js:51` (register handler)
- Modify: `bot/src/middleware/group-dm.js:20` (exclude /xp and /leaderboard from DM redirect — they should work in group too)

**Step 1: Create the handler**

Create `bot/src/handlers/xp.js`:

```js
const { awardXp, getUserXp, getLeaderboard, getUserRank, getXpBreakdown, XP_LEVELS, getLevelInfo, getNextLevelXp } = require('../db/xp');
const { escHtml } = require('../utils/format');

module.exports = function (bot) {
  bot.command('xp', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const lang = ctx.lang;

    const data = getUserXp(userId);
    if (!data) return ctx.reply(lang === 'uk' ? 'Профіль не знайдено.' : 'Profile not found.');

    const rank = getUserRank(userId);
    const levelTitle = getLevelInfo(data.xp_level, lang);
    const nextXp = getNextLevelXp(data.xp_level);
    const breakdown = getXpBreakdown(userId);

    let progressBar = '';
    if (nextXp) {
      const prevXp = XP_LEVELS.find(l => l.level === data.xp_level)?.xp || 0;
      const progress = Math.min(((data.xp - prevXp) / (nextXp - prevXp)) * 10, 10);
      progressBar = '▓'.repeat(Math.floor(progress)) + '░'.repeat(10 - Math.floor(progress));
      progressBar += ` ${data.xp}/${nextXp} XP`;
    } else {
      progressBar = '▓'.repeat(10) + ' MAX';
    }

    const breakdownText = breakdown.length > 0
      ? breakdown.map(b => `  ${b.reason}: <b>${b.total}</b>`).join('\n')
      : (lang === 'uk' ? '  Поки нічого' : '  Nothing yet');

    const text = lang === 'uk'
      ? `🏆 <b>Твій XP профіль</b>\n\n` +
        `⭐ Рівень: <b>${data.xp_level} — ${levelTitle}</b>\n` +
        `💎 XP: <b>${data.xp}</b>\n` +
        `📊 Рейтинг: <b>#${rank}</b>\n\n` +
        `${progressBar}\n\n` +
        `📋 Розбивка:\n${breakdownText}`
      : `🏆 <b>Your XP Profile</b>\n\n` +
        `⭐ Level: <b>${data.xp_level} — ${levelTitle}</b>\n` +
        `💎 XP: <b>${data.xp}</b>\n` +
        `📊 Rank: <b>#${rank}</b>\n\n` +
        `${progressBar}\n\n` +
        `📋 Breakdown:\n${breakdownText}`;

    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  bot.command('leaderboard', async (ctx) => {
    const lang = ctx.lang;
    const top = getLeaderboard(10);

    if (top.length === 0) {
      return ctx.reply(lang === 'uk' ? 'Рейтинг поки порожній.' : 'Leaderboard is empty.');
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = top.map((u, i) => {
      const medal = medals[i] || `${i + 1}.`;
      const name = escHtml(u.display_name || u.first_name || u.username || `User ${u.telegram_id}`);
      const levelTitle = getLevelInfo(u.xp_level, lang);
      return `${medal} <b>${name}</b> — ${u.xp} XP (${levelTitle})`;
    });

    const header = lang === 'uk' ? '🏆 <b>Топ-10 лідерборд</b>' : '🏆 <b>Top 10 Leaderboard</b>';
    return ctx.reply(`${header}\n\n${lines.join('\n')}`, { parse_mode: 'HTML' });
  });
};
```

**Step 2: Register in index.js**

In `bot/src/index.js`, add before the moderation handler (line 52):

```js
require('./handlers/xp')(bot);
```

**Step 3: Update bot commands list**

In `bot/src/index.js`, add to `enCommands` array (after line 73 `lang`):

```js
{ command: 'xp', description: 'Your XP and level' },
{ command: 'leaderboard', description: 'Top 10 leaderboard' },
```

And `ukCommands` (after line 92 `lang`):

```js
{ command: 'xp', description: 'Твій XP та рівень' },
{ command: 'leaderboard', description: 'Топ-10 рейтинг' },
```

**Step 4: Rebuild and test**

```bash
docker compose up -d --build bot
docker logs bbd-evolution-bot --tail 20
```

**Step 5: Commit**

```bash
git add bot/src/handlers/xp.js bot/src/index.js
git commit -m "feat: add /xp and /leaderboard commands"
```

---

### Task 5.4: Award XP on onboarding completion

**Files:**
- Modify: `bot/src/handlers/callbacks.js` (find the onboarding completion callback)
- Or modify: `bot/src/handlers/onboarding.js` where `completeOnboarding` is called

**Step 1: Find and modify the onboarding completion point**

In the callbacks handler where `completeOnboarding()` is called, add after it:

```js
const { awardXp } = require('../db/xp');
// ... inside the completion callback:
const result = awardXp(userId, 50, 'onboarding');
```

**Step 2: Send level-up notification if applicable**

After awarding XP, check `result.leveledUp` and send a congratulations message.

**Step 3: Rebuild and test**

**Step 4: Commit**

```bash
git add bot/src/handlers/callbacks.js
git commit -m "feat: award 50 XP on onboarding completion"
```

---

### Task 5.5: Award XP for daily quiz (/quiz) — max 3/day

**Files:**
- Modify: `bot/src/handlers/callbacks.js` (find the quiz answer callback `quiz:` prefix)

**Step 1: In the quiz callback handler, after a correct answer:**

```js
const { awardXp, getDailyXpCount } = require('../db/xp');
// ... inside correct answer branch:
const dailyCount = getDailyXpCount(userId, 'quiz');
if (dailyCount < 3) {
  const result = awardXp(userId, 10, 'quiz');
  // Append XP message to reply
}
```

**Step 2: Rebuild and test by answering a quiz**

**Step 3: Commit**

```bash
git add bot/src/handlers/callbacks.js
git commit -m "feat: award 10 XP per correct quiz answer (max 3/day)"
```

---

### Task 5.6: Daily activity XP bonus

**Files:**
- Modify: `bot/src/index.js` (in the DB user profile middleware, around line 26-33)

**Step 1: Add daily activity check in the middleware**

In the user profile middleware block (lines 26-33 of `index.js`), after `ctx.userProfile = getUser(userId)`:

```js
// Daily activity XP (once per day per user)
const { getDailyXpCount, awardXp } = require('./db/xp');
if (ctx.userProfile && ctx.userProfile.onboarding_complete) {
  const dailyActivity = getDailyXpCount(userId, 'daily');
  if (dailyActivity === 0) {
    awardXp(userId, 5, 'daily');
  }
}
```

**Step 2: Rebuild and test**

**Step 3: Commit**

```bash
git add bot/src/index.js
git commit -m "feat: award 5 XP daily activity bonus"
```

---

### Task 5.7: XP Leaderboard API endpoint + dashboard page

**Files:**
- Modify: `bot/src/api/routes.js` (add leaderboard endpoints)
- Modify: `bot/admin/index.html` (add nav link + page container)
- Modify: `bot/admin/app.js` (add renderLeaderboard function)

**Step 1: Add API endpoints in routes.js**

After the moderation routes (line 208), add:

```js
// ── XP & Leaderboard ──
const { getLeaderboard: getXpLeaderboard, getXpBreakdown, XP_LEVELS } = require('../db/xp');

router.get('/leaderboard', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const leaderboard = getXpLeaderboard(limit);
  res.json({ leaderboard, levels: XP_LEVELS });
});

router.get('/users/:id/xp', (req, res) => {
  const userId = parseInt(req.params.id);
  const breakdown = getXpBreakdown(userId);
  res.json({ breakdown });
});
```

**Step 2: Add nav link and page container in index.html**

After the Schedule nav link (line 28), add:
```html
<a href="#leaderboard" class="nav-link" data-page="leaderboard">Leaderboard</a>
```

After the page-schedule div (line 40), add:
```html
<div id="page-leaderboard" class="page hidden"></div>
```

**Step 3: Add renderLeaderboard in app.js**

Add to the router map and create `renderLeaderboard()` function that:
- Fetches `/api/leaderboard`
- Renders a table: Rank, Name, Level, Title, XP, with color-coded level badges
- Shows level distribution chart (simple bar counts)

**Step 4: Rebuild, test API with curl, verify dashboard page**

```bash
docker compose up -d --build bot && docker compose up -d --build web
curl -s -H "Authorization: Bearer TOKEN" http://localhost:8888/api/leaderboard | jq
```

**Step 5: Commit**

```bash
git add bot/src/api/routes.js bot/admin/index.html bot/admin/app.js
git commit -m "feat: add leaderboard API endpoint and dashboard page"
```

---

### Task 5.8: Update /help to show XP commands

**Files:**
- Modify: `bot/src/handlers/start.js`

**Step 1: Add XP commands to /help output**

In the help text blocks, add:
- EN: `📊 /xp — Your XP and level\n📊 /leaderboard — Top 10`
- UK: `📊 /xp — Твій XP та рівень\n📊 /leaderboard — Топ-10 рейтинг`

**Step 2: Commit**

```bash
git add bot/src/handlers/start.js
git commit -m "feat: update /help with XP commands"
```

---

## Phase 6: Homework System

Depends on Phase 5 (XP engine). Admin assigns topics, users complete them for XP.

---

### Task 6.1: Create homework DB tables

**Files:**
- Modify: `bot/src/db/init.js` (append after xp_log table)

**Step 1: Add tables**

```js
db.exec(`
  CREATE TABLE IF NOT EXISTS homework (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    topic_slugs TEXT NOT NULL,
    deadline DATETIME,
    xp_reward INTEGER DEFAULT 30,
    created_by INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS homework_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    homework_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    topic_slug TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    completed_at DATETIME,
    UNIQUE(homework_id, user_id, topic_slug)
  )
`);
```

**Step 2: Rebuild and verify**

**Step 3: Commit**

```bash
git add bot/src/db/init.js
git commit -m "feat: add homework and homework_progress tables"
```

---

### Task 6.2: Create homework DB module

**Files:**
- Create: `bot/src/db/homework.js`

**Step 1: Create module with CRUD operations**

Functions needed:
- `createHomework(title, topicSlugs, deadline, xpReward, createdBy)` — insert row, return id
- `getActiveHomework()` — all where status='active'
- `getUserHomework(userId)` — active homework with user's progress per topic
- `markTopicComplete(homeworkId, userId, topicSlug)` — upsert progress, set completed=1
- `isTopicCompleted(homeworkId, userId, topicSlug)` — check if already done
- `getHomeworkProgress(homeworkId)` — all progress rows for a homework
- `getHomeworkCompletionRate(homeworkId)` — percentage of users who completed all topics
- `closeHomework(id)` — set status='closed'
- `getOverdueHomework()` — active homework where deadline < now
- `getIncompleteUsers(homeworkId)` — users who haven't completed all topics

**Step 2: Commit**

```bash
git add bot/src/db/homework.js
git commit -m "feat: create homework DB module"
```

---

### Task 6.3: Create /homework, /complete, /assign handlers

**Files:**
- Create: `bot/src/handlers/homework.js`
- Modify: `bot/src/index.js` (register handler)

**Step 1: Create handler**

Commands:
- `/homework` — shows user's active homework with completion checkmarks per topic
- `/complete <topic_slug>` — triggers a quiz question from that topic. If correct, marks complete + awards XP via `awardXp(userId, hw.xp_reward, 'homework', homeworkId)`
- `/assign <slug1,slug2> <YYYY-MM-DD> <title>` — admin-only, creates homework and DMs all users

**Step 2: Register in index.js**

```js
require('./handlers/homework')(bot);
```

**Step 3: Add to bot commands list in index.js**

EN: `{ command: 'homework', description: 'Your homework assignments' }`
UK: `{ command: 'homework', description: 'Домашні завдання' }`

**Step 4: Rebuild and test**

**Step 5: Commit**

```bash
git add bot/src/handlers/homework.js bot/src/index.js
git commit -m "feat: add /homework, /complete, /assign commands"
```

---

### Task 6.4: Homework deadline scheduler

**Files:**
- Modify: `bot/src/scheduler.js` (add homework checks to the existing interval)

**Step 1: Add homework deadline logic**

In the existing `setInterval` callback, after the scheduled messages block, add:

```js
// Homework deadline checks
const { getOverdueHomework, closeHomework, getIncompleteUsers } = require('./db/homework');

// Auto-close overdue homework
const overdue = getOverdueHomework();
for (const hw of overdue) {
  closeHomework(hw.id);
  console.log(`Homework #${hw.id} "${hw.title}" auto-closed (deadline passed)`);
}

// 24h reminder (check homework where deadline is between now and now+25h, and not yet reminded)
// This requires adding a `reminded` column or tracking — keep it simple: just close overdue for now.
```

**Step 2: Rebuild and test**

**Step 3: Commit**

```bash
git add bot/src/scheduler.js
git commit -m "feat: auto-close overdue homework via scheduler"
```

---

### Task 6.5: Homework API endpoints + dashboard page

**Files:**
- Modify: `bot/src/api/routes.js`
- Modify: `bot/admin/index.html`
- Modify: `bot/admin/app.js`

**Step 1: Add API endpoints**

```
GET  /api/homework              — list all homework (active + closed)
POST /api/homework              — create homework {title, topicSlugs, deadline, xpReward}
GET  /api/homework/:id          — homework detail with progress per user
PUT  /api/homework/:id/close    — close homework manually
```

**Step 2: Add nav link + page container**

```html
<a href="#homework" class="nav-link" data-page="homework">Homework</a>
<div id="page-homework" class="page hidden"></div>
```

**Step 3: Add renderHomework in app.js**

- Create homework form: topic multi-select (from `/api/topics`), deadline datetime, XP reward, title
- Active homework list with completion percentage bars
- Click to expand: per-user completion table

**Step 4: Rebuild, test, commit**

```bash
git add bot/src/api/routes.js bot/admin/index.html bot/admin/app.js
git commit -m "feat: add homework API endpoints and dashboard page"
```

---

## Phase 7: Contests & Challenges

Depends on Phase 5 (XP engine). Three contest types: quiz, challenge, poll.

---

### Task 7.1: Create contest DB tables

**Files:**
- Modify: `bot/src/db/init.js`

**Step 1: Add 3 tables**

```js
db.exec(`
  CREATE TABLE IF NOT EXISTS contests (
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
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS contest_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contest_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    answer TEXT,
    is_correct INTEGER,
    score INTEGER DEFAULT 0,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contest_id, user_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS contest_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contest_id INTEGER NOT NULL,
    voter_id INTEGER NOT NULL,
    entry_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contest_id, voter_id)
  )
`);
```

**Step 2: Rebuild, verify, commit**

```bash
git add bot/src/db/init.js
git commit -m "feat: add contests, contest_entries, contest_votes tables"
```

---

### Task 7.2: Create contests DB module

**Files:**
- Create: `bot/src/db/contests.js`

**Step 1: Create module**

Functions:
- `createContest(type, title, description, config, deadline, xpValues, createdBy)` — returns id
- `getContest(id)` — single contest
- `getActiveContests()` — where status IN ('pending', 'active', 'voting')
- `getAllContests(limit)` — all, ordered by created_at DESC
- `setContestStatus(id, status)` — update status
- `addEntry(contestId, userId, answer, isCorrect, score)` — upsert entry
- `getEntries(contestId)` — all entries for contest
- `getUserEntry(contestId, userId)` — single entry
- `addVote(contestId, voterId, entryId)` — insert vote
- `hasVoted(contestId, voterId)` — check
- `getVoteCounts(contestId)` — entry_id + count, ordered by count DESC
- `getContestResults(contestId)` — entries ordered by score DESC (quiz) or vote count (challenge)

**Step 2: Commit**

```bash
git add bot/src/db/contests.js
git commit -m "feat: create contests DB module"
```

---

### Task 7.3: Create poll handler (/poll)

**Files:**
- Create: `bot/src/handlers/contests.js`
- Modify: `bot/src/index.js`

**Step 1: Create handler with poll functionality first (simplest contest type)**

`/poll Question? | Option A | Option B | Option C` — admin-only
- Creates contest with type='poll', config=JSON with options array
- Posts in group with inline buttons `poll:<contestId>:<optionIndex>`
- On callback: records vote, awards 5 XP, shows "Voted!" acknowledgment
- `/contest` shows active contests

**Step 2: Register handler and add to group commands exception list**

In `group-dm.js`, add `/poll` and `/contest` to GROUP_COMMANDS if they should work in-group.

**Step 3: Rebuild and test**

**Step 4: Commit**

```bash
git add bot/src/handlers/contests.js bot/src/index.js bot/src/middleware/group-dm.js
git commit -m "feat: add /poll command with voting and XP"
```

---

### Task 7.4: Add quiz contest (/contest quiz N)

**Files:**
- Modify: `bot/src/handlers/contests.js`

**Step 1: Add quiz contest flow**

`/contest quiz 5` — admin-only, starts 5-question quiz in group
- Creates contest with type='quiz', config={questionCount: 5, timePerQuestion: 30}
- Posts questions one at a time with inline buttons
- Tracks correct answers and response time per user
- After all questions: post scoreboard, award XP (1st/2nd/3rd)

This is the most complex handler. Key implementation details:
- Use a Map to track active quiz state (current question index, scores per user)
- `setTimeout` for question timeouts (30s each)
- Reuse `generateQuiz()` from `bot/src/data/quiz-generator.js`
- Callback format: `cquiz:<contestId>:<questionIndex>:<optionIndex>`

**Step 2: Rebuild and test in group**

**Step 3: Commit**

```bash
git add bot/src/handlers/contests.js
git commit -m "feat: add quiz contest with timed questions and XP"
```

---

### Task 7.5: Add challenge with submissions (/submit) and voting

**Files:**
- Modify: `bot/src/handlers/contests.js`

**Step 1: Add challenge creation (admin dashboard or Telegram)**

Challenge flow:
- Admin creates from dashboard: type='challenge', title, description, deadline, voting method (community/admin)
- Bot announces in group
- `/submit <text>` — DM only, creates entry for active challenge
- After deadline (via scheduler): if community vote → post entries with vote buttons; if admin pick → admin selects from dashboard

**Step 2: Add vote handling for challenge entries**

Callback: `cvote:<contestId>:<entryId>` — 1 vote per user, awards 5 XP for voting

**Step 3: Add challenge close + winner XP**

When admin closes or deadline hits: calculate winner by votes, award XP (1st/2nd/3rd)

**Step 4: Commit**

```bash
git add bot/src/handlers/contests.js
git commit -m "feat: add challenge submissions and community voting"
```

---

### Task 7.6: Contest scheduler auto-close

**Files:**
- Modify: `bot/src/scheduler.js`

**Step 1: Add contest deadline checking**

In the scheduler interval, after homework checks:

```js
const { getActiveContests, setContestStatus } = require('./db/contests');
// Check contests with passed deadlines
const activeContests = getActiveContests();
for (const c of activeContests) {
  if (c.deadline && new Date(c.deadline) <= new Date()) {
    if (c.type === 'challenge' && c.status === 'active') {
      setContestStatus(c.id, 'voting'); // transition to voting phase
    } else {
      setContestStatus(c.id, 'closed');
    }
  }
}
```

**Step 2: Commit**

```bash
git add bot/src/scheduler.js
git commit -m "feat: auto-close contests via scheduler"
```

---

### Task 7.7: Contests API endpoints + dashboard page

**Files:**
- Modify: `bot/src/api/routes.js`
- Modify: `bot/admin/index.html`
- Modify: `bot/admin/app.js`

**Step 1: Add API endpoints**

```
GET    /api/contests              — list all contests
POST   /api/contests              — create contest {type, title, description, deadline, config}
GET    /api/contests/:id          — contest detail + entries + votes
PUT    /api/contests/:id/close    — close contest + calculate winners
PUT    /api/contests/:id/winner   — admin pick winner {entryId}
```

**Step 2: Add nav link + page container**

```html
<a href="#contests" class="nav-link" data-page="contests">Contests</a>
<div id="page-contests" class="page hidden"></div>
```

**Step 3: Add renderContests in app.js**

- Contest type selector (quiz/challenge/poll)
- Create form per type
- Active contests list with status badges
- Challenge view: submissions + vote counts + pick winner button
- Poll view: vote breakdown bar chart

**Step 4: Rebuild, test, commit**

```bash
git add bot/src/api/routes.js bot/admin/index.html bot/admin/app.js
git commit -m "feat: add contests API endpoints and dashboard page"
```

---

## Phase 8: Group Message Management

Independent of other phases. Can be built in parallel with Phase 6/7.

---

### Task 8.1: Create group message DB tables

**Files:**
- Modify: `bot/src/db/init.js`

**Step 1: Add tables**

```js
db.exec(`
  CREATE TABLE IF NOT EXISTS bot_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    thread_id INTEGER,
    text TEXT,
    sent_by INTEGER,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS group_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    thread_id INTEGER,
    user_id INTEGER NOT NULL,
    username TEXT,
    first_name TEXT,
    text TEXT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
```

**Step 2: Commit**

```bash
git add bot/src/db/init.js
git commit -m "feat: add bot_messages and group_messages tables"
```

---

### Task 8.2: Create group DB module

**Files:**
- Create: `bot/src/db/group.js`

**Step 1: Create module**

Functions:
- `saveBotMessage(chatId, messageId, threadId, text, sentBy)` — insert
- `getBotMessages(limit)` — ordered by sent_at DESC
- `getBotMessage(id)` — single
- `updateBotMessageText(id, newText)` — update text
- `deleteBotMessage(id)` — delete row
- `saveGroupMessage(chatId, messageId, threadId, userId, username, firstName, text)` — insert
- `getRecentGroupMessages(limit)` — ordered by received_at DESC
- `getGroupMessage(chatId, messageId)` — single by chat+msg id
- `deleteGroupMessage(chatId, messageId)` — delete row
- `cleanupOldGroupMessages()` — delete where received_at < datetime('now', '-7 days')

**Step 2: Commit**

```bash
git add bot/src/db/group.js
git commit -m "feat: create group message DB module"
```

---

### Task 8.3: Add group message listener (rolling buffer)

**Files:**
- Create: `bot/src/handlers/group-logger.js`
- Modify: `bot/src/index.js` (register BEFORE other handlers so it captures all messages)

**Step 1: Create the listener**

```js
const { saveGroupMessage } = require('../db/group');

module.exports = function (bot) {
  // Listen to ALL text messages in groups, save to rolling buffer
  bot.on('message:text', (ctx, next) => {
    const chat = ctx.chat;
    if (chat.type !== 'group' && chat.type !== 'supergroup') return next();

    const msg = ctx.message;
    saveGroupMessage(
      chat.id,
      msg.message_id,
      msg.message_thread_id || null,
      msg.from?.id,
      msg.from?.username || null,
      msg.from?.first_name || null,
      msg.text
    );

    return next();
  });
};
```

**Step 2: Register in index.js EARLY (before group-dm middleware, around line 36)**

```js
require('./handlers/group-logger')(bot);
```

**Step 3: Add cleanup to scheduler**

In `bot/src/scheduler.js`, add:
```js
const { cleanupOldGroupMessages } = require('./db/group');
// Inside the interval, once per cycle:
cleanupOldGroupMessages();
```

**Step 4: Commit**

```bash
git add bot/src/handlers/group-logger.js bot/src/index.js bot/src/scheduler.js
git commit -m "feat: add group message logger with rolling buffer"
```

---

### Task 8.4: Group management API endpoints

**Files:**
- Modify: `bot/src/api/routes.js`

**Step 1: Add endpoints**

These endpoints need access to `bot` for Telegram API calls:

```js
// ── Group Management ──
const groupDb = require('../db/group');

// Bot messages
router.get('/group/messages', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json({ messages: groupDb.getBotMessages(limit) });
});

router.post('/group/send', async (req, res) => {
  const { chatId, text, threadId } = req.body;
  if (!chatId || !text) return res.status(400).json({ error: 'chatId and text required' });
  try {
    const opts = { parse_mode: 'HTML' };
    if (threadId) opts.message_thread_id = threadId;
    const msg = await bot.api.sendMessage(chatId, text, opts);
    groupDb.saveBotMessage(chatId, msg.message_id, threadId || null, text, null);
    res.json({ ok: true, messageId: msg.message_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/group/messages/:id', async (req, res) => {
  const { text } = req.body;
  const botMsg = groupDb.getBotMessage(parseInt(req.params.id));
  if (!botMsg) return res.status(404).json({ error: 'Not found' });
  try {
    await bot.api.editMessageText(botMsg.chat_id, botMsg.message_id, text, { parse_mode: 'HTML' });
    groupDb.updateBotMessageText(botMsg.id, text);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/group/messages/:id', async (req, res) => {
  const botMsg = groupDb.getBotMessage(parseInt(req.params.id));
  if (!botMsg) return res.status(404).json({ error: 'Not found' });
  try {
    await bot.api.deleteMessage(botMsg.chat_id, botMsg.message_id);
    groupDb.deleteBotMessage(botMsg.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User messages (moderation)
router.get('/group/chat', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  res.json({ messages: groupDb.getRecentGroupMessages(limit) });
});

router.delete('/group/chat/:chatId/:msgId', async (req, res) => {
  const chatId = parseInt(req.params.chatId);
  const msgId = parseInt(req.params.msgId);
  try {
    await bot.api.deleteMessage(chatId, msgId);
    groupDb.deleteGroupMessage(chatId, msgId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/group/chat/:chatId/:msgId/warn', (req, res) => {
  const msg = groupDb.getGroupMessage(parseInt(req.params.chatId), parseInt(req.params.msgId));
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  const { reason } = req.body;
  const { addWarning, getWarningCount } = require('../db/moderation');
  addWarning(msg.user_id, reason || 'Warned from dashboard', 0);
  const count = getWarningCount(msg.user_id);
  res.json({ ok: true, warningCount: count });
});
```

**Step 2: Commit**

```bash
git add bot/src/api/routes.js
git commit -m "feat: add group management API endpoints"
```

---

### Task 8.5: Group management dashboard page

**Files:**
- Modify: `bot/admin/index.html`
- Modify: `bot/admin/app.js`

**Step 1: Add nav link + page container**

```html
<a href="#group" class="nav-link" data-page="group">Group</a>
<div id="page-group" class="page hidden"></div>
```

**Step 2: Add renderGroup in app.js**

Two sections:

**Bot Messages section:**
- "New Message" form: chat ID input (pre-filled with group ID from config), thread ID, text area, Send button
- Table: ID, sent_at, text preview (truncated), thread_id, Edit/Delete buttons
- Edit opens modal with text area

**Recent Chat section:**
- Scrollable table: time, user (name + @username), message text, action buttons (Delete, Warn, Mute)
- Auto-refresh every 30s
- Delete calls `DELETE /api/group/chat/:chatId/:msgId`
- Warn calls `POST /api/group/chat/:chatId/:msgId/warn`

**Step 3: Add GROUP_CHAT_ID to .env and config.js**

```
GROUP_CHAT_ID=-1003812557946
```

So the dashboard can pre-fill the chat ID for sending messages.

**Step 4: Rebuild, test, commit**

```bash
git add bot/admin/index.html bot/admin/app.js bot/src/config.js .env
git commit -m "feat: add group management dashboard page"
```

---

## Final Tasks

---

### Task 9.1: Update /help command for all new features

**Files:**
- Modify: `bot/src/handlers/start.js`

Add all new commands to the help output:
- XP section: `/xp`, `/leaderboard`
- Homework section: `/homework`, `/complete`
- Contests section: `/contest`, `/submit`
- Admin section: `/assign`, `/poll`, `/contest quiz`

---

### Task 9.2: Extend MySQL mirror for new tables

**Files:**
- Modify: `bot/src/db/mysql.js`

Add MySQL table creation and sync for: `xp_log`, `homework`, `homework_progress`, `contests`, `contest_entries`, `contest_votes`. Mirror writes in the respective DB modules (same pattern as existing user mirror).

---

### Task 9.3: Update admin-guide.md

**Files:**
- Modify: `docs/admin-guide.md`

Add documentation for all new features, commands, API endpoints, and dashboard pages.

---

### Task 9.4: Full rebuild and integration test

```bash
docker compose up -d --build --force-recreate
docker logs bbd-evolution-bot --tail 30
# Verify all pages load:
curl -s -o /dev/null -w "%{http_code}" http://localhost:8888/course/
curl -s -o /dev/null -w "%{http_code}" -u 'admin:BbdAdmin2026!' http://localhost:8888/admin/
curl -s -H "Authorization: Bearer TOKEN" http://localhost:8888/api/leaderboard
curl -s -H "Authorization: Bearer TOKEN" http://localhost:8888/api/homework
curl -s -H "Authorization: Bearer TOKEN" http://localhost:8888/api/contests
curl -s -H "Authorization: Bearer TOKEN" http://localhost:8888/api/group/messages
curl -s -H "Authorization: Bearer TOKEN" http://localhost:8888/api/group/chat
```

Test Telegram commands: `/xp`, `/leaderboard`, `/homework`, `/contest`

---

## Summary

| Phase | Tasks | New Files | Modified Files |
|-------|-------|-----------|----------------|
| **5 — XP Engine** | 5.1–5.8 | `db/xp.js`, `handlers/xp.js` | `db/init.js`, `index.js`, `routes.js`, `admin/*`, `callbacks.js`, `start.js` |
| **6 — Homework** | 6.1–6.5 | `db/homework.js`, `handlers/homework.js` | `db/init.js`, `index.js`, `routes.js`, `scheduler.js`, `admin/*` |
| **7 — Contests** | 7.1–7.7 | `db/contests.js`, `handlers/contests.js` | `db/init.js`, `index.js`, `routes.js`, `scheduler.js`, `admin/*`, `group-dm.js` |
| **8 — Group Mgmt** | 8.1–8.5 | `db/group.js`, `handlers/group-logger.js` | `db/init.js`, `index.js`, `routes.js`, `scheduler.js`, `admin/*`, `config.js`, `.env` |
| **9 — Final** | 9.1–9.4 | — | `start.js`, `mysql.js`, `admin-guide.md` |

**Total: ~27 tasks across 4 phases + final cleanup**
