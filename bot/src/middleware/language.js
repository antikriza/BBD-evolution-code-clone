const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '..', '..', 'state');
const LANG_FILE = path.join(STATE_DIR, 'user-langs.json');

// Load persisted user languages
let userLangs = {};
try {
  if (fs.existsSync(LANG_FILE)) {
    userLangs = JSON.parse(fs.readFileSync(LANG_FILE, 'utf8'));
  }
} catch (e) { /* start fresh */ }

function save() {
  try {
    const dir = path.dirname(LANG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LANG_FILE, JSON.stringify(userLangs), 'utf8');
  } catch (e) {
    console.error('Failed to save user langs:', e.message);
  }
}

function getUserLang(userId) {
  return userLangs[userId] || null;
}

function setUserLang(userId, lang) {
  userLangs[userId] = lang;
  save();
}

function languageMiddleware(ctx, next) {
  const userId = ctx.from?.id;
  if (!userId) {
    ctx.lang = 'en';
    return next();
  }

  const stored = getUserLang(userId);
  if (stored) {
    ctx.lang = stored;
  } else {
    // Auto-detect on first interaction, then persist
    const tgLang = ctx.from?.language_code;
    const detected = (tgLang === 'uk' || tgLang === 'ru') ? 'uk' : 'en';
    setUserLang(userId, detected);
    ctx.lang = detected;
  }

  return next();
}

module.exports = { languageMiddleware, getUserLang, setUserLang };
