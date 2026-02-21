const db = require('./init');

const stmts = {
  get: db.prepare('SELECT * FROM users WHERE telegram_id = ?'),
  upsert: db.prepare(`
    INSERT INTO users (telegram_id, username, first_name, lang)
    VALUES (@telegram_id, @username, @first_name, @lang)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username = @username,
      first_name = @first_name,
      updated_at = CURRENT_TIMESTAMP
  `),
  getAll: db.prepare('SELECT * FROM users ORDER BY created_at DESC'),
  count: db.prepare('SELECT COUNT(*) as total FROM users'),
};

function getUser(telegramId) {
  return stmts.get.get(telegramId) || null;
}

function ensureUser(telegramId, username, firstName, lang) {
  stmts.upsert.run({
    telegram_id: telegramId,
    username: username || null,
    first_name: firstName || null,
    lang: lang || 'en',
  });
  return stmts.get.get(telegramId);
}

function updateField(telegramId, field, value) {
  db.prepare(`UPDATE users SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`).run(value, telegramId);
}

function getUserData(telegramId) {
  const user = getUser(telegramId);
  if (!user) return {};
  try { return JSON.parse(user.data || '{}'); } catch (e) { return {}; }
}

function setUserData(telegramId, data) {
  updateField(telegramId, 'data', JSON.stringify(data));
}

function getAllUsers() {
  return stmts.getAll.all();
}

function getUserCount() {
  return stmts.count.get().total;
}

module.exports = { getUser, ensureUser, updateField, getUserData, setUserData, getAllUsers, getUserCount };
