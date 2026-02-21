const db = require('./init');

// ── XP Level Definitions ──
const XP_LEVELS = [
  { level: 1, xp: 0,    title: { en: 'Newbie',       uk: 'Новачок' } },
  { level: 2, xp: 100,  title: { en: 'Learner',      uk: 'Учень' } },
  { level: 3, xp: 300,  title: { en: 'Practitioner',  uk: 'Практик' } },
  { level: 4, xp: 600,  title: { en: 'Specialist',    uk: 'Спеціаліст' } },
  { level: 5, xp: 1000, title: { en: 'Expert',        uk: 'Експерт' } },
  { level: 6, xp: 1500, title: { en: 'Master',        uk: 'Майстер' } },
  { level: 7, xp: 2500, title: { en: 'Legend',         uk: 'Легенда' } },
];

// ── Prepared Statements ──
const stmts = {
  addXp: db.prepare(`
    INSERT INTO xp_log (user_id, amount, reason, reference_id)
    VALUES (?, ?, ?, ?)
  `),

  updateUserXp: db.prepare(`
    UPDATE users SET xp = xp + ?, updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `),

  setUserLevel: db.prepare(`
    UPDATE users SET xp_level = ?, updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `),

  getUserXp: db.prepare(`
    SELECT xp, xp_level FROM users WHERE telegram_id = ?
  `),

  getLeaderboard: db.prepare(`
    SELECT telegram_id, username, first_name, display_name, xp, xp_level
    FROM users
    ORDER BY xp DESC
    LIMIT ?
  `),

  getUserRank: db.prepare(`
    SELECT COUNT(*) + 1 AS rank
    FROM users
    WHERE xp > (SELECT xp FROM users WHERE telegram_id = ?)
  `),

  getXpBreakdown: db.prepare(`
    SELECT reason, SUM(amount) AS total
    FROM xp_log
    WHERE user_id = ?
    GROUP BY reason
    ORDER BY total DESC
  `),

  getDailyXpCount: db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM xp_log
    WHERE user_id = ?
      AND reason = ?
      AND created_at >= datetime('now', '-24 hours')
  `),
};

// ── Helper Functions ──

/**
 * Calculate the level number for a given XP total.
 * Walks the thresholds from highest to lowest and returns the first match.
 */
function calculateLevel(xp) {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i].xp) return XP_LEVELS[i].level;
  }
  return 1;
}

/**
 * Get the localised title for a level.
 * @param {number} level  - level number (1-7)
 * @param {string} lang   - 'en' or 'uk'
 * @returns {{ level: number, title: string, xp: number }}
 */
function getLevelInfo(level, lang = 'en') {
  const entry = XP_LEVELS.find((l) => l.level === level) || XP_LEVELS[0];
  return {
    level: entry.level,
    title: entry.title[lang] || entry.title.en,
    xp: entry.xp,
  };
}

/**
 * Return the XP threshold needed for the next level, or null if already at max.
 */
function getNextLevelXp(currentLevel) {
  const next = XP_LEVELS.find((l) => l.level === currentLevel + 1);
  return next ? next.xp : null;
}

/**
 * Award XP to a user. Inserts log row, bumps the user total, and checks for
 * a level-up. Returns a summary object.
 *
 * @param {number} userId      - telegram_id
 * @param {number} amount      - XP to add (positive integer)
 * @param {string} reason      - machine-readable reason tag
 * @param {string|null} referenceId - optional external reference
 * @returns {{ newXp: number, newLevel: number, leveledUp: boolean, levelTitle: string }}
 */
function awardXp(userId, amount, reason, referenceId = null) {
  const award = db.transaction(() => {
    // 1. Log the XP event
    stmts.addXp.run(userId, amount, reason, referenceId);

    // 2. Increment user XP
    stmts.updateUserXp.run(amount, userId);

    // 3. Read back current totals
    const row = stmts.getUserXp.get(userId);
    if (!row) return null;

    const newXp = row.xp;
    const oldLevel = row.xp_level;
    const newLevel = calculateLevel(newXp);
    let leveledUp = false;

    // 4. Update level if it changed
    if (newLevel !== oldLevel) {
      stmts.setUserLevel.run(newLevel, userId);
      leveledUp = true;
    }

    // 5. Resolve localised title (fall back to 'en')
    const levelTitle = getLevelInfo(newLevel, 'en').title;

    return { newXp, newLevel, leveledUp, levelTitle };
  });

  return award();
}

/**
 * Get a user's current XP and level.
 */
function getUserXp(userId) {
  return stmts.getUserXp.get(userId) || { xp: 0, xp_level: 1 };
}

/**
 * Top-N leaderboard.
 */
function getLeaderboard(limit = 10) {
  return stmts.getLeaderboard.all(limit);
}

/**
 * 1-based rank of a user (how many users have more XP + 1).
 */
function getUserRank(userId) {
  const row = stmts.getUserRank.get(userId);
  return row ? row.rank : null;
}

/**
 * Breakdown of a user's XP by reason.
 */
function getXpBreakdown(userId) {
  return stmts.getXpBreakdown.all(userId);
}

/**
 * How many times a specific reason was logged for a user in the last 24 h.
 * Useful for enforcing daily caps.
 */
function getDailyXpCount(userId, reason) {
  const row = stmts.getDailyXpCount.get(userId, reason);
  return row ? row.cnt : 0;
}

module.exports = {
  XP_LEVELS,
  calculateLevel,
  getLevelInfo,
  getNextLevelXp,
  awardXp,
  getUserXp,
  getLeaderboard,
  getUserRank,
  getXpBreakdown,
  getDailyXpCount,
};
