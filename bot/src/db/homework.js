const db = require('./init');

// Prepared statements
const stmts = {
  create: db.prepare(`
    INSERT INTO homework (title, topic_slugs, deadline, xp_reward, created_by)
    VALUES (?, ?, ?, ?, ?)
  `),
  getActive: db.prepare(`
    SELECT * FROM homework WHERE status = 'active' ORDER BY created_at DESC
  `),
  getAll: db.prepare(`
    SELECT * FROM homework ORDER BY created_at DESC LIMIT ?
  `),
  getById: db.prepare('SELECT * FROM homework WHERE id = ?'),
  close: db.prepare(`UPDATE homework SET status = 'closed' WHERE id = ?`),
  getOverdue: db.prepare(`
    SELECT * FROM homework WHERE status = 'active' AND deadline IS NOT NULL AND deadline < datetime('now')
  `),

  // Progress
  markComplete: db.prepare(`
    INSERT INTO homework_progress (homework_id, user_id, topic_slug, completed, completed_at)
    VALUES (?, ?, ?, 1, datetime('now'))
    ON CONFLICT(homework_id, user_id, topic_slug)
    DO UPDATE SET completed = 1, completed_at = datetime('now')
  `),
  isCompleted: db.prepare(`
    SELECT completed FROM homework_progress
    WHERE homework_id = ? AND user_id = ? AND topic_slug = ?
  `),
  getUserProgress: db.prepare(`
    SELECT topic_slug, completed, completed_at FROM homework_progress
    WHERE homework_id = ? AND user_id = ?
  `),
  getHomeworkProgress: db.prepare(`
    SELECT hp.*, u.display_name, u.first_name, u.username
    FROM homework_progress hp
    JOIN users u ON u.telegram_id = hp.user_id
    WHERE hp.homework_id = ?
  `),
  getCompletedUserCount: db.prepare(`
    SELECT COUNT(DISTINCT user_id) as cnt FROM homework_progress
    WHERE homework_id = ? AND completed = 1
  `),
};

function createHomework(title, topicSlugs, deadline, xpReward, createdBy) {
  const slugsStr = Array.isArray(topicSlugs) ? topicSlugs.join(',') : topicSlugs;
  const result = stmts.create.run(title, slugsStr, deadline || null, xpReward || 30, createdBy || null);
  return result.lastInsertRowid;
}

function getActiveHomework() {
  return stmts.getActive.all();
}

function getAllHomework(limit = 50) {
  return stmts.getAll.all(limit);
}

function getHomeworkById(id) {
  return stmts.getById.get(id);
}

function closeHomework(id) {
  const result = stmts.close.run(id);
  return result.changes > 0;
}

function getOverdueHomework() {
  return stmts.getOverdue.all();
}

function markTopicComplete(homeworkId, userId, topicSlug) {
  stmts.markComplete.run(homeworkId, userId, topicSlug);
}

function isTopicCompleted(homeworkId, userId, topicSlug) {
  const row = stmts.isCompleted.get(homeworkId, userId, topicSlug);
  return row && row.completed === 1;
}

function getUserProgress(homeworkId, userId) {
  return stmts.getUserProgress.all(homeworkId, userId);
}

function getHomeworkProgress(homeworkId) {
  return stmts.getHomeworkProgress.all(homeworkId);
}

function getCompletedUserCount(homeworkId) {
  const row = stmts.getCompletedUserCount.get(homeworkId);
  return row ? row.cnt : 0;
}

function getUserHomework(userId) {
  const active = getActiveHomework();
  return active.map(hw => {
    const slugs = hw.topic_slugs.split(',').filter(Boolean);
    const progress = getUserProgress(hw.id, userId);
    const completedSlugs = progress.filter(p => p.completed).map(p => p.topic_slug);
    return {
      ...hw,
      topics: slugs,
      completedTopics: completedSlugs,
      totalTopics: slugs.length,
      completedCount: completedSlugs.length,
      isFullyComplete: completedSlugs.length >= slugs.length,
    };
  });
}

function getIncompleteUsers(homeworkId) {
  const hw = getHomeworkById(homeworkId);
  if (!hw) return [];
  const slugs = hw.topic_slugs.split(',').filter(Boolean);
  // Get all users who are onboarded
  const allUsers = db.prepare('SELECT telegram_id FROM users WHERE onboarding_complete = 1').all();
  const incomplete = [];
  for (const u of allUsers) {
    const progress = getUserProgress(homeworkId, u.telegram_id);
    const completedSlugs = progress.filter(p => p.completed).map(p => p.topic_slug);
    if (completedSlugs.length < slugs.length) {
      incomplete.push(u.telegram_id);
    }
  }
  return incomplete;
}

module.exports = {
  createHomework,
  getActiveHomework,
  getAllHomework,
  getHomeworkById,
  closeHomework,
  getOverdueHomework,
  markTopicComplete,
  isTopicCompleted,
  getUserProgress,
  getHomeworkProgress,
  getCompletedUserCount,
  getUserHomework,
  getIncompleteUsers,
};
