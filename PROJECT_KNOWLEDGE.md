# PROJECT_KNOWLEDGE.md

## 1. PROJECT OVERVIEW

**Project name:** PM AI Club (BBD Evolution Code Clone)

**Purpose:** A bilingual (English/Ukrainian) AI & Programming educational platform consisting of two components:
1. **Static course website** — 42 topics across 5 progressive levels, served as HTML pages and a Telegram Mini App
2. **Telegram group bot** — interactive companion bot for a Telegram learning community, providing course navigation, quizzes, glossary, search, and user onboarding with profile analytics

**Main problem solved:** Delivers structured AI education to a Telegram-based community. The bot acts as an interactive learning assistant within the group chat — answering questions via DM to keep the group clean, running quizzes from course material, and automatically onboarding new members.

**Target audience:** Members of the "PM AI Club" Telegram group — developers, project managers, designers, students interested in AI and programming. Mentor: Oleksandr Selivanskyi (@selivansky).

**Current status:** In production. Bot is running in Docker, course website deployed to GitHub Pages. All 14 bot commands functional. User onboarding with SQLite storage implemented.

---

## 2. TECHNICAL STACK

### Languages
- **JavaScript (Node.js 20)** — bot backend, course page generators
- **HTML/CSS** — static course pages, Telegram Mini App, documentation

### Bot Dependencies (`bot/package.json`)
| Package | Version | Purpose |
|---------|---------|---------|
| grammy | ^1.35.0 | Telegram Bot framework |
| dotenv | ^16.4.0 | Environment variable loading |
| better-sqlite3 | ^11.7.0 | SQLite database (native module) |

### Web Frontend
- **No npm dependencies** — pure Node.js `fs` module for page generation
- **Telegram WebApp SDK** — loaded from CDN inside the Mini App
- **nginx:alpine** — serves static HTML in Docker

### Database
- **SQLite** via better-sqlite3 — stores user profiles at `/app/state/bot.db`
- **JSON file** — per-user language preferences at `/app/state/user-langs.json`

### External Services
- **Telegram Bot API** — via grammy framework (long polling)
- **GitHub Pages** — hosts the static course site and Mini App

### Build & Deployment
- **Docker Compose** — two-service setup (web + bot)
- **No CI/CD pipeline** — manual `docker compose up -d --build`
- **No linting/formatting tools** configured

---

## 3. ARCHITECTURE

### Overall Architecture

Multi-container Docker deployment with two independent services:

```
┌─────────────────────────────────────────────────┐
│  Docker Compose                                 │
│                                                 │
│  ┌─────────────────┐   ┌─────────────────────┐  │
│  │  web (nginx)    │   │  bot (node:20)      │  │
│  │  Port 8888:80   │   │  grammy + sqlite    │  │
│  │                 │   │                     │  │
│  │  Static HTML    │   │  Telegram Bot API   │  │
│  │  course pages   │   │  (long polling)     │  │
│  └─────────────────┘   └─────────────────────┘  │
│                               │                 │
│                         ┌─────┴──────┐          │
│                         │ bot-state  │          │
│                         │  (volume)  │          │
│                         │ bot.db     │          │
│                         │ user-langs │          │
│                         └────────────┘          │
└─────────────────────────────────────────────────┘
```

### Directory Structure

```
/                               # Repository root
├── Dockerfile                  # nginx container for static course site
├── nginx.conf                  # nginx config (root redirect, caching, absolute_redirect off)
├── docker-compose.yml          # Two services: web + bot, named volume for state
├── .env                        # Bot token + course URL (gitignored)
├── .gitignore                  # .env, node_modules, .DS_Store
├── PROJECT_KNOWLEDGE.md        # This file
│
├── bot/                        # Telegram bot application
│   ├── Dockerfile              # node:20-alpine + python3/make/g++ for native sqlite
│   ├── package.json            # grammy, dotenv, better-sqlite3
│   ├── .env.example            # Template for environment variables
│   └── src/
│       ├── index.js            # Entry point: middleware chain, handler registration, bot.start()
│       ├── config.js           # Loads .env, exports BOT_TOKEN, COURSE_BASE_URL, COURSE_DATA_PATH
│       ├── data/
│       │   ├── loader.js       # Loads course-data.json, builds indexes (topicBySlug, allKeyTerms, allTips)
│       │   ├── search.js       # Full-text search across course content with scoring
│       │   └── quiz-generator.js # 4 quiz types with weighted random selection
│       ├── db/
│       │   ├── init.js         # SQLite setup, WAL mode, users table creation
│       │   └── users.js        # User CRUD: getUser, ensureUser, completeOnboarding, etc.
│       ├── handlers/
│       │   ├── onboarding.js   # New member detection + 4-step DM onboarding flow
│       │   ├── start.js        # /start, /help, /lang commands
│       │   ├── course.js       # /course, /level, /topic with inline keyboard navigation
│       │   ├── glossary.js     # /glossary <term> — fuzzy term search
│       │   ├── quiz.js         # /quiz — generates questions, tracks active quizzes in Map
│       │   ├── random.js       # /random, /today — random tips/facts, topic of the day
│       │   ├── community.js    # /rules, /links, /faq — static bilingual content
│       │   ├── search.js       # /search <keyword> — scored full-text search
│       │   └── callbacks.js    # Central callback_query router for all inline keyboards
│       ├── middleware/
│       │   ├── language.js     # Per-user language detection, persistence to JSON file
│       │   └── group-dm.js     # Redirects group commands to DM, auto-deletes messages
│       └── utils/
│           ├── format.js       # escHtml, truncate, topicCard, termCard, levelCard
│           └── pagination.js   # Splits long messages into 4000-char pages
│
├── telegram-archive/           # Course content and generators
│   ├── course/
│   │   ├── build-all.js        # ~3600-line generator: all data + page builders (EN, UK, TWA)
│   │   ├── build-basic-theory.js # Legacy single-language generator (unused)
│   │   ├── extract-data.js     # Extracts ui+levels from build-all.js → course-data.json
│   │   ├── course-data.json    # Shared data (676KB): 5 levels, 42 topics, 170 terms, 126 tips per lang
│   │   ├── index.html          # Language selector entry point
│   │   ├── en/                 # 49 English HTML pages
│   │   ├── uk/                 # 49 Ukrainian HTML pages
│   │   ├── basic-theory/       # Legacy single-language pages (48 files)
│   │   ├── twa/
│   │   │   └── index.html      # Telegram Mini App (~514KB, self-contained SPA)
│   │   ├── docs/
│   │   │   ├── telegram-posts-en.md  # Telegram-formatted course posts (English)
│   │   │   └── telegram-posts-uk.md  # Telegram-formatted course posts (Ukrainian)
│   │   └── README.md           # Course architecture documentation
│   └── site/                   # Archived HTML pages from original Telegram group
│
├── docs/
│   ├── user-journey.html       # Bot user journey documentation (dark-themed HTML)
│   └── screenshot-journey.jpg  # Screenshot of user-journey page
│
└── LOGS/
    └── claude-edit.log         # Development session log
```

### Bot Middleware Chain (order matters)

```
1. Language middleware        → ctx.lang (en|uk), persisted per-user
2. Course data attachment    → ctx.courseData (loaded once at startup)
3. DB user profile           → ctx.userProfile (SQLite lookup/upsert every request)
4. Group-DM redirect         → intercepts group commands, sends responses via DM
5. Onboarding handler        → new_chat_members + free text for name input
6. Command handlers          → start, course, glossary, quiz, random, community, search
7. Callback router           → all inline keyboard button presses
```

### Design Patterns

- **Middleware chain** — grammy's Composer pattern: each middleware calls `next()` or stops
- **Callback data prefixes** — all inline keyboards use `prefix:value` format (e.g., `level:3`, `quiz:next`, `onboard:role:developer`), routed in a single callback handler via `startsWith()` checks
- **Module-as-function** — each handler file exports `function(bot)` that registers its handlers
- **Prepared statements** — SQLite queries pre-compiled at module load for performance
- **Context enrichment** — middleware attaches data to `ctx` object (lang, courseData, userProfile)

### Data Schema

**SQLite `users` table:**

```sql
CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,   -- Telegram user ID
  username TEXT,                      -- @username
  first_name TEXT,                   -- Telegram first name
  display_name TEXT,                 -- Self-reported name (onboarding Q1)
  role TEXT,                         -- developer|pm|designer|student|other
  experience TEXT,                   -- beginner|intermediate|advanced|expert
  interests TEXT,                    -- Comma-separated: ai-models,coding-tools,agents,prompt-eng,career
  lang TEXT DEFAULT 'en',            -- en|uk
  onboarding_step INTEGER DEFAULT 0, -- 0-4 (which question user is on)
  onboarding_complete INTEGER DEFAULT 0, -- 0 or 1
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Course data structure (`course-data.json`):**

```
{
  ui: { en: { ... }, uk: { ... } },       // UI translations
  levels: [
    {
      num: 1, emoji: "🌱",
      title: { en: "Beginner", uk: "Новачок" },
      desc: { en: "...", uk: "..." },
      topics: [
        {
          slug: "generative-ai",
          title: { en: "Generative AI", uk: "Генеративний ШІ" },
          desc: { en: "...", uk: "..." },
          overview: { en: ["paragraph1", ...], uk: [...] },
          details: { en: [{ text, desc, links }], uk: [...] },
          sections: { en: [{ title, items }], uk: [...] },
          keyTerms: { en: [{ term, def }], uk: [...] },
          tips: { en: ["tip1", ...], uk: [...] },
          related: ["tag1", "tag2"]
        },
        ...
      ]
    },
    ...
  ]
}
```

---

## 4. KEY FILES

### `bot/src/index.js`
- **Purpose:** Application entry point. Sets up middleware chain and registers all handlers.
- **Key responsibilities:** Validates BOT_TOKEN, loads course data, configures middleware order, registers Telegram command menu (EN + UK), starts long polling.
- **Dependencies:** grammy, all middleware, all handlers, db/users, data/loader

### `bot/src/handlers/callbacks.js`
- **Purpose:** Central router for all inline keyboard button presses.
- **Handles:** `level:`, `topic:`, `terms:`, `tips:`, `quiz:next`, `quiz:N`, `random:`, `lang:`, `onboard:role:`, `onboard:exp:`, `onboard:int:`, `onboard:int:done`, `back:course`
- **Critical ordering:** `quiz:next` must be checked before `quiz:*` (prefix overlap), `onboard:int:done` before `onboard:int:*`
- **Dependencies:** course.js (showLevel, showTopic), quiz.js (activeQuizzes, sendQuiz), random.js (sendRandom), onboarding.js (INTERESTS, sendStep, sendProfileSummary), language.js (setUserLang), db/users.js

### `bot/src/middleware/group-dm.js`
- **Purpose:** Redirects all group commands to user's private DM to keep the group clean.
- **How it works:** Intercepts group commands → deletes the command message → overrides `ctx.reply` to send via `bot.api.sendMessage(userId, ...)` → posts auto-deleting "check your DM" note in group
- **Fallback:** If user hasn't started bot DM (error 403), shows temporary "Start chat with bot" button (15s auto-delete)
- **Exports:** `groupDmMiddleware(bot)`

### `bot/src/handlers/onboarding.js`
- **Purpose:** 4-step user introduction flow triggered on group join or first `/start`.
- **Steps:** Name (free text) → Role (buttons) → Experience (buttons) → Interests (multi-select + Done)
- **Exports:** Module function `(bot)` + `startOnboarding`, `ROLES`, `EXPERIENCE`, `INTERESTS`, `sendStep`, `sendProfileSummary`
- **Listens for:** `message:new_chat_members`, `message:text` (name input in DM)

### `bot/src/data/quiz-generator.js`
- **Purpose:** Generates quiz questions from course data.
- **4 question types:** Term-Definition Match (40%), Topic Identification (25%), Level Classification (20%), True/False Tips (15%)
- **Exports:** `generateQuiz(courseData, lang)` → `{ question, options, correctIndex, explanation }`

### `bot/src/data/loader.js`
- **Purpose:** Loads `course-data.json` and builds lookup indexes.
- **Returns:** `{ raw, topicBySlug, allKeyTerms, allTips, allTopicsFlat }`
- **Data volume:** 5 levels, 42 topics, 170 terms per language, 126 tips per language

### `bot/src/data/search.js`
- **Purpose:** Full-text search across all course content with relevance scoring.
- **Scoring:** Title exact match (100), title partial (50), key term match (30), detail text (20), overview (10), tip (5)
- **Exports:** `searchCourse(query, courseData, lang, limit)`

### `bot/src/db/init.js`
- **Purpose:** SQLite database initialization.
- **Location:** `/app/state/bot.db` (persisted via Docker named volume)
- **Config:** WAL journal mode enabled
- **Exports:** `db` instance (better-sqlite3 Database object)

### `bot/src/db/users.js`
- **Purpose:** User CRUD operations with prepared statements.
- **Exports:** `getUser`, `ensureUser`, `setOnboardingStep`, `updateField`, `completeOnboarding`, `getAllUsers`, `getUserStats`
- **Note:** `updateField` uses dynamic SQL (`db.prepare()` per call) — acceptable for onboarding flow but avoid in hot paths

### `bot/src/middleware/language.js`
- **Purpose:** Per-user bilingual support with file-based persistence.
- **Detection:** Auto-detects from Telegram `language_code` (uk/ru → Ukrainian, else English)
- **Storage:** JSON file at `/app/state/user-langs.json` (in-memory cache + sync write on change)
- **Exports:** `languageMiddleware`, `getUserLang`, `setUserLang`

### `telegram-archive/course/build-all.js`
- **Purpose:** Monolithic ~3600-line script containing all course data and page generators.
- **Generates:** 49 EN pages, 49 UK pages, language selector, Telegram Mini App
- **Data:** Imports from `course-data.json` (ui + levels), original data kept as `_ui_unused` / `_levels_unused`

### `telegram-archive/course/extract-data.js`
- **Purpose:** One-time extraction script. Parses `build-all.js` to extract `ui` and `levels` objects into `course-data.json`.
- **Method:** Uses `new Function()` to evaluate the pure data portion of build-all.js
- **Output:** `course-data.json` (676KB)

### `telegram-archive/course/twa/index.html`
- **Purpose:** Telegram Mini App — self-contained SPA (~514KB) with all course data embedded as JSON.
- **Features:** Hash-based routing, 4 views (language selector, course, level, topic), Telegram SDK integration, dark theme

---

## 5. CONFIGURATION

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BOT_TOKEN` | Telegram Bot API token from @BotFather | Yes |
| `COURSE_BASE_URL` | Base URL for course links (default: GitHub Pages URL) | No |
| `COURSE_DATA_PATH` | Path to course-data.json (default: `../data/course-data.json`) | No |

### Configuration Files

| File | Purpose |
|------|---------|
| `.env` | Bot token and URLs (gitignored) |
| `bot/.env.example` | Template showing required variables |
| `docker-compose.yml` | Service definitions, volumes, port mapping |
| `nginx.conf` | Web server: root redirect to /course/, caching, `absolute_redirect off` |
| `bot/src/config.js` | Loads dotenv, exports config with defaults |

### Docker Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `bot-state` (named) | `/app/state` | SQLite database + user language preferences |
| Bind mount (read-only) | `/app/data/course-data.json` | Course data shared from host |

### Deployment

```bash
# First time
cp bot/.env.example .env      # Add your BOT_TOKEN
docker compose up -d --build   # Build and start both services

# After code changes
docker compose up -d --build bot   # Rebuild bot only

# After course content changes
cd telegram-archive/course
node extract-data.js               # Re-extract shared data
node build-all.js                  # Regenerate HTML pages
docker compose up -d --build       # Rebuild both services
```

**Ports:** Web server on `localhost:8888`, bot communicates directly with Telegram API (no exposed port).

---

## 6. DEVELOPMENT HISTORY

### Timeline

| Date | Commit | Description |
|------|--------|-------------|
| 2026-02-07 | `3e4b9c5` | **Initial commit** — repository setup |
| 2026-02-07 | `7efa10f` | **Bilingual course + Mini App** — build-all.js with all 42 topics, EN/UK pages, Telegram Mini App (SPA) |
| 2026-02-07 | `a30da2d` | **Project documentation** — architecture guide, deployment instructions (README.md) |
| 2026-02-07 | `d5b3236` | **Content enrichment** — all 42 topics expanded to full educational content |
| 2026-02-07 | `be39209` | **Level 3 upgrade** — rich format with tips and related tags across all levels |
| 2026-02-07 | `71af95f` | **Telegram posts** — formatted posts for all 42 topics in EN and UK |
| 2026-02-15 | `c6f6086` | **Transfer** — code transferred to new repository |
| 2026-02-15 | `b70d289` | **Bot + Docker** — complete Telegram bot (14 commands, quiz system, glossary, search, group-DM redirect, language persistence, SQLite onboarding), Dockerfiles, docker-compose, nginx config |

### Key Development Phases

1. **Phase 1 (Feb 7):** Course content creation — 42 topics, bilingual, Telegram Mini App with SPA routing
2. **Phase 2 (Feb 7):** Content enrichment — overviews, key terms (170 per language), tips (126 per language), cross-links
3. **Phase 3 (Feb 15):** Bot implementation — built from scratch with grammy, all 14 commands, quiz generator (4 types), full-text search, inline keyboard navigation
4. **Phase 4 (Feb 15):** Infrastructure — Docker Compose setup (nginx + bot), language persistence fix (session → file-based), group-DM redirect middleware, SQLite user onboarding

### Significant Design Decisions

- **Data extraction**: Course data was originally embedded in `build-all.js` (3600 lines). `extract-data.js` was created to extract it to shared `course-data.json` used by both the web generator and the bot
- **Language persistence**: Initially used grammy's in-memory session (lost on restart). Replaced with file-based `user-langs.json` keyed by user ID, not chat ID
- **Group privacy**: All bot commands in groups are deleted and responses sent to DM. This required overriding `ctx.reply` in middleware — a pattern that intercepts the reply function to redirect output
- **SQLite over alternatives**: Chosen for zero-config operation inside Docker. better-sqlite3 requires native build tools (python3, make, g++) in the Alpine image
- **Quiz system**: Active quizzes stored in-memory `Map<chatId:msgId, quizData>`. No persistence needed — quizzes are ephemeral

### Branches
- `main` — single branch, all development happens here

---

## 7. BUSINESS LOGIC

### Bot Commands — Complete List

| Command | Handler | Description |
|---------|---------|-------------|
| `/start` | start.js | Welcome + triggers onboarding if not completed |
| `/help` | start.js | Lists all commands grouped by category |
| `/lang` | start.js | Language switcher (EN/UK inline buttons) |
| `/course` | course.js | Course overview with 5 level buttons |
| `/level N` | course.js | Topics list for level N (1-5) |
| `/topic name` | course.js | Topic detail card (fuzzy slug/title match) |
| `/glossary term` | glossary.js | Search key terms (170 per language) |
| `/quiz` | quiz.js | Random quiz from 4 question types |
| `/random` | random.js | Random tip or course fact |
| `/today` | random.js | Topic of the day (dayOfYear % 42) |
| `/rules` | community.js | Static group rules (6 rules) |
| `/links` | community.js | Course URLs (Mini App, EN, UK) |
| `/faq` | community.js | 5 Q&A pairs about the course |
| `/search keyword` | search.js | Full-text search with relevance scoring |

### User Onboarding Flow

```
User joins group
  │
  ├─ Bot can DM user?
  │   ├─ Yes → Send welcome + ask Name in DM
  │   └─ No  → Post "Start introduction" button in group (30s auto-delete)
  │             User clicks → /start onboard → DM opens
  │
  ▼
Step 0: "What should we call you?" → free text → display_name
Step 1: "What's your role?" → buttons → role (developer|pm|designer|student|other)
Step 2: "Your AI experience?" → buttons → experience (beginner|intermediate|advanced|expert)
Step 3: "What interests you?" → multi-select → interests (ai-models,coding-tools,agents,prompt-eng,career)
  │
  ▼
Profile saved to SQLite → confirmation message → user can use all commands
```

### Group-DM Redirect Logic

```
User sends /command in group
  │
  ├─ Bot deletes the command message from group
  ├─ Overrides ctx.reply → sends via bot.api.sendMessage(userId)
  ├─ Handler runs normally (doesn't know about redirect)
  │
  ├─ DM sent successfully?
  │   ├─ Yes → Post "✉️ check your DM" in group (5s auto-delete)
  │   └─ No (403 error) → Post "Start chat with bot" button (15s auto-delete)
```

### Quiz System

- 4 question types with weighted random: Term Match (40%), Topic ID (25%), Level Classification (20%), True/False (15%)
- Active quizzes tracked in `Map<chatId:msgId, { correctIndex, explanation, options, lang }>`
- Answer handling in callbacks.js: compares selected index with correctIndex, shows result + explanation
- "Next question" button chains to new quiz

### Language Detection

- Auto-detected from Telegram `language_code` on first interaction
- `uk` or `ru` → Ukrainian; everything else → English
- Persisted in `user-langs.json` (keyed by numeric user ID)
- Switchable anytime via `/lang` or `lang:en`/`lang:uk` callback buttons

---

## 8. KNOWN ISSUES AND TECHNICAL DEBT

### Potential Issues

1. **`updateField` uses dynamic SQL** (`bot/src/db/users.js:57`) — constructs SQL string with field name parameter. Only called from onboarding flow with controlled field names, but not parameterized for the column name. Not a user-input vector since field names come from code, not user input.

2. **Language stored in two places** — `user-langs.json` (file) and `users.lang` (SQLite). The file is the source of truth for the language middleware; SQLite stores the initial detection value. These could diverge if a user changes language after onboarding.

3. **Quiz state is in-memory** — `activeQuizzes` Map is lost on bot restart. Users mid-quiz will see "Quiz expired" after a redeploy. Low impact since quizzes are quick interactions.

4. **No rate limiting** — bot has no protection against command spam. grammy middleware could be added.

5. **Synchronous file writes** — `language.js` uses `fs.writeFileSync` on every language change. Fine for low traffic but could become a bottleneck at scale.

6. **No tests** — no test suite, no testing framework configured.

7. **No linting/formatting** — no ESLint, Prettier, or EditorConfig. Code style is consistent but not enforced.

8. **Legacy files** — `telegram-archive/course/basic-theory/` (48 pages) and `build-basic-theory.js` are from the initial single-language generator. Still in repo but unused.

### No TODOs/FIXMEs in Code

The codebase has no TODO, FIXME, HACK, or XXX comments.

---

## 9. APIs / INTERFACES

### Telegram Bot API (consumed)

The bot uses grammy's long polling mode (no webhook). Key API methods used:
- `bot.api.sendMessage(userId, text, opts)` — send DM
- `bot.api.deleteMessage(chatId, msgId)` — auto-delete group messages
- `bot.api.getMe()` — get bot username (cached)
- `bot.api.setMyCommands(commands, opts)` — register command menu (EN + UK)
- `ctx.reply()` / `ctx.editMessageText()` / `ctx.answerCallbackQuery()` — standard grammy context methods

### Callback Data Format

All inline keyboard buttons use colon-separated callback data:

| Pattern | Example | Handler |
|---------|---------|---------|
| `level:N` | `level:3` | Show level topics |
| `topic:slug` | `topic:generative-ai` | Show topic detail |
| `terms:slug` | `terms:prompt` | Show topic key terms |
| `tips:slug` | `tips:rag` | Show topic tips |
| `quiz:next` | `quiz:next` | Generate new quiz |
| `quiz:N` | `quiz:2` | Answer quiz (index) |
| `random:next` | `random:next` | Another random tip/fact |
| `lang:code` | `lang:uk` | Switch language |
| `onboard:role:id` | `onboard:role:developer` | Set role |
| `onboard:exp:id` | `onboard:exp:beginner` | Set experience |
| `onboard:int:id` | `onboard:int:agents` | Toggle interest |
| `onboard:int:done` | `onboard:int:done` | Finish interests |
| `back:course` | `back:course` | Return to course overview |

### Web Server (nginx)

| URL | Response |
|-----|----------|
| `http://localhost:8888/` | 301 → `/course/` |
| `http://localhost:8888/course/` | Language selector |
| `http://localhost:8888/course/en/` | English course index |
| `http://localhost:8888/course/uk/` | Ukrainian course index |
| `http://localhost:8888/course/twa/index.html` | Telegram Mini App |

No authentication. All static content, no dynamic endpoints.

---

## 10. PROJECT CONVENTIONS

### Code Style
- **No formal linting** — no ESLint/Prettier config
- **Semicolons:** yes, consistently used
- **Quotes:** single quotes for strings
- **Indentation:** 2 spaces
- **Trailing commas:** used in arrays and objects
- **Error handling:** `try { ... } catch (e) { /* comment */ }` pattern — silent catches for non-critical operations (message deletion, edit failures)

### Naming Conventions
- **Files:** kebab-case (`group-dm.js`, `quiz-generator.js`)
- **Variables/functions:** camelCase (`sendQuiz`, `topicBySlug`, `allKeyTerms`)
- **Database columns:** snake_case (`telegram_id`, `onboarding_step`, `display_name`)
- **Callback data:** colon-separated (`level:3`, `onboard:role:developer`)
- **Constants:** UPPER_CASE only for `MAX_MSG_LEN` in pagination.js; most config values are camelCase

### Module Pattern
- Handlers export `function(bot)` — called with bot instance to register listeners
- Some handlers also export named functions via `module.exports.functionName = ...` after the main export
- Middleware exported as named functions: `{ middlewareName }`

### Bilingual Content Pattern
Every user-facing string has `en` and `uk` variants:
```javascript
const text = lang === 'uk'
  ? 'Ukrainian text'
  : 'English text';
```

### Commit Style
- Imperative mood, concise description
- No conventional commits prefix (no `feat:`, `fix:`, etc.)
- Examples: "Add Telegram group bot and Docker setup", "Expand all 42 topics to full educational content"
