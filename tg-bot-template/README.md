# Telegram Bot Template

A production-ready Telegram group bot template built with **Node.js + grammy + SQLite**. Includes bilingual support (EN/UK), group-to-DM command redirect, persistent user database, and Docker deployment.

## Quick Start

```bash
# 1. Install dependencies
cd bot
npm install

# 2. Create .env with your bot token (get one from @BotFather)
cp .env.example .env
# Edit .env and paste your BOT_TOKEN

# 3. Run
npm start
```

The bot is now running. Send `/start` in Telegram.

### With Docker

```bash
# From template root (where docker-compose.yml is)
cp bot/.env.example bot/.env
# Edit bot/.env with your BOT_TOKEN

docker compose up -d --build
docker logs telegram-bot --tail 20    # Check logs
```

---

## Architecture

```
bot/
├── src/
│   ├── index.js              # Entry point: middleware chain + commands + callbacks
│   ├── config.js             # Environment variable loading
│   ├── middleware/
│   │   ├── language.js       # Per-user bilingual support (EN/UK)
│   │   └── group-dm.js       # Redirects group commands to DM
│   ├── db/
│   │   ├── init.js           # SQLite database setup
│   │   └── users.js          # User CRUD operations
│   └── utils/
│       ├── format.js         # HTML escaping, string truncation
│       └── pagination.js     # Split long text into Telegram message chunks
├── Dockerfile
├── package.json
└── .env.example
```

### How a Request Flows

```
User sends /help in group chat
  │
  ▼
Middleware 1: Language
  Sets ctx.lang = 'en' or 'uk' (auto-detected, persisted)
  │
  ▼
Middleware 2: Database
  Creates/updates user in SQLite, sets ctx.userProfile
  │
  ▼
Middleware 3: Group-DM Redirect
  Deletes command from group → overrides ctx.reply to send via DM
  │
  ▼
Command Handler: /help
  Calls ctx.reply(text) — which now sends to user's DM
  │
  ▼
Post-handler (Group-DM middleware)
  Posts "check your DM" note in group (auto-deletes in 5s)
```

---

## Adding Commands

### Simple Command

Add after the existing commands in `src/index.js`:

```javascript
bot.command('hello', async (ctx) => {
  const lang = ctx.lang;
  const name = escHtml(ctx.from?.first_name || 'there');

  const text = lang === 'uk'
    ? `Привіт, <b>${name}</b>!`
    : `Hello, <b>${name}</b>!`;

  await ctx.reply(text, { parse_mode: 'HTML' });
});
```

Then register it in the command menu (the `setCommands` function):

```javascript
{ command: 'hello', description: 'Say hello' },
```

### Command with Arguments

```javascript
bot.command('echo', async (ctx) => {
  const text = ctx.match?.trim();  // Everything after "/echo "
  if (!text) {
    return ctx.reply('Usage: /echo <text>');
  }
  await ctx.reply(escHtml(text), { parse_mode: 'HTML' });
});
```

### Extracting Handlers to Separate Files

As your bot grows, move commands to `src/handlers/`:

```javascript
// src/handlers/hello.js
const { escHtml } = require('../utils/format');

module.exports = function (bot) {
  bot.command('hello', async (ctx) => {
    const name = escHtml(ctx.from?.first_name || 'there');
    await ctx.reply(`Hello, <b>${name}</b>!`, { parse_mode: 'HTML' });
  });
};
```

Then in `src/index.js`:
```javascript
require('./handlers/hello')(bot);
```

---

## Adding Inline Keyboards & Callbacks

### Creating Buttons

```javascript
const { InlineKeyboard } = require('grammy');

bot.command('menu', async (ctx) => {
  const kb = new InlineKeyboard()
    .text('Option A', 'menu:a')        // callback_data = "menu:a"
    .text('Option B', 'menu:b')
    .row()                              // new row
    .url('Open Link', 'https://...')    // URL button (no callback)
    .row()
    .text('Cancel', 'menu:cancel');

  await ctx.reply('Choose an option:', { reply_markup: kb });
});
```

### Handling Callbacks

Add to the callback router in `src/index.js`:

```javascript
// Inside bot.on('callback_query:data', ...)
} else if (data.startsWith('menu:')) {
  const action = data.split(':')[1];

  if (action === 'cancel') {
    try { await ctx.editMessageText('Cancelled.'); } catch (e) {}
  } else {
    await ctx.reply(`You picked: ${action}`);
  }

  await ctx.answerCallbackQuery();
}
```

### Callback Data Convention

Use colon-separated prefixes: `namespace:action:param`

| Pattern | Example | Use Case |
|---------|---------|----------|
| `prefix:value` | `lang:en` | Simple selection |
| `prefix:action:id` | `user:ban:12345` | Action on specific entity |
| `prefix:page:N` | `list:page:2` | Pagination |

**Important:** Check more specific patterns first. `quiz:next` must come before `quiz:*` in the if-else chain.

### Updating an Existing Message

```javascript
// Replace message text (keeps inline keyboard unless you change it)
await ctx.editMessageText('New text', { parse_mode: 'HTML', reply_markup: kb });

// Remove inline keyboard from message
await ctx.editMessageReplyMarkup({ reply_markup: undefined });
```

---

## Database (SQLite)

### Schema

The default `users` table:

| Column | Type | Description |
|--------|------|-------------|
| telegram_id | INTEGER PK | Telegram user ID |
| username | TEXT | @username |
| first_name | TEXT | Telegram first name |
| lang | TEXT | 'en' or 'uk' |
| data | TEXT | JSON string for custom fields |
| created_at | DATETIME | First interaction |
| updated_at | DATETIME | Last update |

### Using the User Profile

```javascript
// Available in any handler via middleware
bot.command('profile', async (ctx) => {
  const user = ctx.userProfile;  // Set by middleware
  await ctx.reply(`ID: ${user.telegram_id}\nName: ${user.first_name}\nLang: ${user.lang}`);
});
```

### Storing Custom Data

The `data` column holds a JSON string for flexible storage:

```javascript
const { getUserData, setUserData } = require('./db/users');

// Read
const data = getUserData(ctx.from.id);  // { score: 10, level: 2 }

// Write
setUserData(ctx.from.id, { score: 15, level: 3 });
```

### Adding New Tables

Edit `src/db/init.js`:

```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    user_id INTEGER REFERENCES users(telegram_id),
    topic TEXT,
    score INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
```

Then add prepared statements in a new file or in `users.js`:

```javascript
const addScore = db.prepare('INSERT INTO scores (user_id, topic, score) VALUES (?, ?, ?)');
const getTopScores = db.prepare('SELECT * FROM scores ORDER BY score DESC LIMIT 10');
```

### Inspecting the DB from Docker

```bash
docker exec telegram-bot node -e "
  const db = require('./src/db/init');
  console.log(db.prepare('SELECT * FROM users').all());
"
```

---

## Bilingual Support

### How It Works

1. On first interaction, the bot detects the user's Telegram language
2. `uk` or `ru` → Ukrainian, everything else → English
3. Language is persisted in `state/user-langs.json` (survives restarts)
4. Available as `ctx.lang` in every handler

### Bilingual Text Pattern

```javascript
const text = lang === 'uk'
  ? 'Текст українською'
  : 'English text';
```

### Adding More Languages

Edit `src/middleware/language.js`, line with detection logic:

```javascript
// Add Spanish detection
const detected = (tgLang === 'uk' || tgLang === 'ru') ? 'uk'
  : tgLang === 'es' ? 'es'
  : 'en';
```

Then add `es` branches in your text patterns:

```javascript
const texts = {
  en: 'Hello',
  uk: 'Привіт',
  es: 'Hola',
};
const text = texts[lang] || texts.en;
```

---

## Group → DM Redirect

### How It Works

When a user types a command in a group chat:

1. The bot **deletes** the command from the group immediately
2. The bot sends the response to the user's **private DM**
3. A brief note appears in the group: "check your DM" (auto-deletes after 5s)

If the user hasn't started a DM with the bot yet:
- A "Start chat with bot" button appears in the group (auto-deletes after 15s)

### Disabling It

Comment out these two lines in `src/index.js`:

```javascript
// const { groupDmMiddleware } = require('./middleware/group-dm');
// groupDmMiddleware(bot);
```

Now commands will respond directly in the group chat.

### Group Bot Permissions

For the delete/redirect to work, the bot needs these group permissions:
- **Delete messages** — to remove the command
- **Send messages** — to post the brief note

If the bot doesn't have delete permission, it silently skips deletion and still sends the DM.

---

## Docker Deployment

### Build & Run

```bash
docker compose up -d --build      # Build and start
docker compose logs -f bot        # Watch logs
docker compose restart bot        # Restart after .env change
docker compose up -d --build bot  # Rebuild after code change
```

### Persistent Storage

The `bot-state` Docker volume stores:
- `bot.db` — SQLite database (user profiles)
- `user-langs.json` — language preferences

This data **survives** `docker compose down` and rebuilds.

To **delete all data**: `docker compose down -v` (the `-v` flag removes volumes).

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Token from @BotFather |
| `APP_URL` | No | External URL for links |

---

## File Reference

| File | Purpose |
|------|---------|
| `src/index.js` | Entry point. Middleware chain, commands (/start, /help, /ping, /lang), callback router, command menu registration, error handler. |
| `src/config.js` | Loads `.env`, exports `BOT_TOKEN` and `APP_URL`. |
| `src/middleware/language.js` | Auto-detects user language from Telegram, persists to file, sets `ctx.lang`. Exports: `languageMiddleware`, `getUserLang`, `setUserLang`. |
| `src/middleware/group-dm.js` | Intercepts group commands, redirects responses to DM, auto-deletes messages. Exports: `groupDmMiddleware`. |
| `src/db/init.js` | SQLite setup: creates `state/` dir, opens `bot.db`, enables WAL mode, creates `users` table. Exports: `db` instance. |
| `src/db/users.js` | User CRUD with prepared statements. Exports: `getUser`, `ensureUser`, `updateField`, `getUserData`, `setUserData`, `getAllUsers`, `getUserCount`. |
| `src/utils/format.js` | `escHtml(s)` — escapes HTML for Telegram. `truncate(s, max)` — truncates with "...". |
| `src/utils/pagination.js` | `paginate(items, formatter, maxLen)` — splits long content into chunks under Telegram's 4096 char limit. |
| `Dockerfile` | Alpine Node.js 20 image with build tools for better-sqlite3 native module. |
| `docker-compose.yml` | Single bot service with persistent volume for state. |

---

## Next Steps

Ideas for extending this template:

- **Onboarding flow** — ask new users questions (name, role, interests) and store in DB
- **Data loading** — load JSON/API data and attach to `ctx` via middleware
- **Quiz system** — generate questions from your data, track answers in SQLite
- **Admin commands** — `/stats`, `/broadcast`, `/users` with admin-only middleware
- **Webhook mode** — switch from long polling to webhook for production scale
- **Scheduled messages** — use `setInterval` or `node-cron` for daily tips
