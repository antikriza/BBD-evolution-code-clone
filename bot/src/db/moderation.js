const db = require('./init');

const stmts = {
  addWarning: db.prepare('INSERT INTO warnings (user_id, reason, warned_by) VALUES (?, ?, ?)'),
  getWarnings: db.prepare('SELECT * FROM warnings WHERE user_id = ? ORDER BY created_at DESC'),
  getWarningCount: db.prepare('SELECT COUNT(*) as count FROM warnings WHERE user_id = ?'),
  clearWarnings: db.prepare('DELETE FROM warnings WHERE user_id = ?'),
  getRecentWarnings: db.prepare('SELECT w.*, u.username, u.first_name FROM warnings w LEFT JOIN users u ON w.user_id = u.telegram_id ORDER BY w.created_at DESC LIMIT ?'),
};

function addWarning(userId, reason, warnedBy) {
  stmts.addWarning.run(userId, reason || null, warnedBy);
  return stmts.getWarningCount.get(userId).count;
}

function getWarnings(userId) {
  return stmts.getWarnings.all(userId);
}

function getWarningCount(userId) {
  return stmts.getWarningCount.get(userId).count;
}

function clearWarnings(userId) {
  const count = stmts.getWarningCount.get(userId).count;
  stmts.clearWarnings.run(userId);
  return count;
}

function getRecentWarnings(limit = 20) {
  return stmts.getRecentWarnings.all(limit);
}

module.exports = {
  addWarning, getWarnings, getWarningCount, clearWarnings, getRecentWarnings,
};
