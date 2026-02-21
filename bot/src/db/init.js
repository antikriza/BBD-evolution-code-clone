const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const STATE_DIR = path.join(__dirname, '..', '..', 'state');
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });

const DB_PATH = path.join(STATE_DIR, 'bot.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    display_name TEXT,
    role TEXT,
    experience TEXT,
    interests TEXT,
    lang TEXT DEFAULT 'en',
    onboarding_step INTEGER DEFAULT 0,
    onboarding_complete INTEGER DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    user_id INTEGER NOT NULL,
    topic_slug TEXT NOT NULL,
    subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, topic_slug)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reason TEXT,
    warned_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS scheduled_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    audience TEXT NOT NULL DEFAULT 'all',
    topic_slug TEXT,
    send_at DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_by INTEGER,
    sent_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── Phase 5: XP & Gamification ──
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

// ── Phase 6: Homework System ──
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

// ── Phase 7: Contests & Challenges ──
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

// ── Phase 8: Group Message Management ──
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

module.exports = db;
