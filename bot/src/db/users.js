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

function setOnboardingStep(telegramId, step) {
  stmts.setStep.run(step, telegramId);
}

function updateField(telegramId, field, value) {
  db.prepare(`UPDATE users SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`).run(value, telegramId);
}

function completeOnboarding(telegramId, profile) {
  stmts.complete.run({
    telegram_id: telegramId,
    display_name: profile.displayName,
    role: profile.role,
    experience: profile.experience,
    interests: profile.interests,
  });
}

function getAllUsers() {
  return stmts.getAllUsers.all();
}

function getUserStats() {
  return stmts.getStats.get();
}

module.exports = { getUser, ensureUser, setOnboardingStep, updateField, completeOnboarding, getAllUsers, getUserStats };
