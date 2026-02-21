const db = require('./init');
const { mysqlUpsertUser, mysqlSetStep, mysqlUpdateField, mysqlCompleteOnboarding } = require('./mysql');

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
  setStep: db.prepare('UPDATE users SET onboarding_step = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?'),
  setField: db.prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?'),
  complete: db.prepare(`
    UPDATE users SET
      display_name = @display_name,
      role = @role,
      experience = @experience,
      interests = @interests,
      onboarding_step = 4,
      onboarding_complete = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = @telegram_id
  `),
  getAllUsers: db.prepare('SELECT * FROM users ORDER BY joined_at DESC'),
  getStats: db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(onboarding_complete) as completed,
      COUNT(DISTINCT role) as unique_roles
    FROM users
  `),
  getDetailedStats: db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(onboarding_complete) as completed,
      SUM(CASE WHEN onboarding_complete = 0 THEN 1 ELSE 0 END) as incomplete,
      COUNT(DISTINCT role) as unique_roles,
      SUM(CASE WHEN joined_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) as last_24h,
      SUM(CASE WHEN joined_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as last_7d
    FROM users
  `),
  getRoleBreakdown: db.prepare(`
    SELECT role, COUNT(*) as cnt FROM users WHERE role IS NOT NULL AND role != '' GROUP BY role ORDER BY cnt DESC
  `),
  getRecentUsers: db.prepare(`
    SELECT telegram_id, username, first_name, display_name, role, lang, onboarding_complete, joined_at
    FROM users ORDER BY joined_at DESC LIMIT ?
  `),
  getUsersPaginated: db.prepare(`
    SELECT telegram_id, username, first_name, display_name, role, lang, onboarding_complete, joined_at
    FROM users ORDER BY joined_at DESC LIMIT ? OFFSET ?
  `),
  getCompletedUserIds: db.prepare('SELECT telegram_id FROM users WHERE onboarding_complete = 1'),
  getAllUserIds: db.prepare('SELECT telegram_id FROM users'),
  searchUsers: db.prepare(`
    SELECT telegram_id, username, first_name, display_name, role, lang, onboarding_complete, joined_at
    FROM users
    WHERE username LIKE ? OR first_name LIKE ? OR display_name LIKE ? OR CAST(telegram_id AS TEXT) LIKE ?
    ORDER BY joined_at DESC LIMIT ?
  `),
  getUserCount: db.prepare('SELECT COUNT(*) as count FROM users'),
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
  // Mirror to MySQL (async, non-blocking)
  mysqlUpsertUser(telegramId, username, firstName, lang);
  return stmts.get.get(telegramId);
}

function setOnboardingStep(telegramId, step) {
  stmts.setStep.run(step, telegramId);
  mysqlSetStep(telegramId, step);
}

function updateField(telegramId, field, value) {
  db.prepare(`UPDATE users SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`).run(value, telegramId);
  mysqlUpdateField(telegramId, field, value);
}

function completeOnboarding(telegramId, profile) {
  stmts.complete.run({
    telegram_id: telegramId,
    display_name: profile.displayName,
    role: profile.role,
    experience: profile.experience,
    interests: profile.interests,
  });
  mysqlCompleteOnboarding(telegramId, profile);
}

function getAllUsers() {
  return stmts.getAllUsers.all();
}

function getUserStats() {
  return stmts.getStats.get();
}

function getDetailedStats() {
  return stmts.getDetailedStats.get();
}

function getRoleBreakdown() {
  return stmts.getRoleBreakdown.all();
}

function getRecentUsers(limit = 10) {
  return stmts.getRecentUsers.all(limit);
}

function getUsersPaginated(limit = 10, offset = 0) {
  return stmts.getUsersPaginated.all(limit, offset);
}

function getCompletedUserIds() {
  return stmts.getCompletedUserIds.all().map(r => r.telegram_id);
}

function getAllUserIds() {
  return stmts.getAllUserIds.all().map(r => r.telegram_id);
}

function searchUsers(query, limit = 20) {
  const pattern = `%${query}%`;
  return stmts.searchUsers.all(pattern, pattern, pattern, pattern, limit);
}

function getUserCount() {
  return stmts.getUserCount.get().count;
}

module.exports = {
  getUser, ensureUser, setOnboardingStep, updateField, completeOnboarding,
  getAllUsers, getUserStats, getDetailedStats, getRoleBreakdown,
  getRecentUsers, getUsersPaginated, getCompletedUserIds, getAllUserIds,
  searchUsers, getUserCount,
};
