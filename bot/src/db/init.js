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

module.exports = db;
