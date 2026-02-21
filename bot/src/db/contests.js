const db = require('./init');

const stmts = {
  create: db.prepare(`
    INSERT INTO contests (type, title, description, config, deadline, xp_first, xp_second, xp_third, xp_participate, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getById: db.prepare('SELECT * FROM contests WHERE id = ?'),
  getActive: db.prepare(`
    SELECT * FROM contests WHERE status IN ('pending', 'active', 'voting') ORDER BY created_at DESC
  `),
  getAll: db.prepare('SELECT * FROM contests ORDER BY created_at DESC LIMIT ?'),
  setStatus: db.prepare('UPDATE contests SET status = ? WHERE id = ?'),

  addEntry: db.prepare(`
    INSERT INTO contest_entries (contest_id, user_id, answer, is_correct, score)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(contest_id, user_id)
    DO UPDATE SET answer = ?, is_correct = ?, score = score + ?
  `),
  getEntries: db.prepare(`
    SELECT ce.*, u.display_name, u.first_name, u.username
    FROM contest_entries ce
    JOIN users u ON u.telegram_id = ce.user_id
    WHERE ce.contest_id = ?
    ORDER BY ce.score DESC
  `),
  getUserEntry: db.prepare('SELECT * FROM contest_entries WHERE contest_id = ? AND user_id = ?'),
  getEntryById: db.prepare('SELECT * FROM contest_entries WHERE id = ?'),

  addVote: db.prepare(`
    INSERT INTO contest_votes (contest_id, voter_id, entry_id) VALUES (?, ?, ?)
  `),
  hasVoted: db.prepare('SELECT id FROM contest_votes WHERE contest_id = ? AND voter_id = ?'),
  getVoteCounts: db.prepare(`
    SELECT entry_id, COUNT(*) as votes FROM contest_votes
    WHERE contest_id = ? GROUP BY entry_id ORDER BY votes DESC
  `),
};

function createContest(type, title, description, config, deadline, xpValues, createdBy) {
  const xp = xpValues || {};
  const result = stmts.create.run(
    type, title, description || null,
    config ? JSON.stringify(config) : null,
    deadline || null,
    xp.first || 50, xp.second || 30, xp.third || 15, xp.participate || 5,
    createdBy || null
  );
  return result.lastInsertRowid;
}

function getContest(id) {
  const c = stmts.getById.get(id);
  if (c && c.config) {
    try { c.parsedConfig = JSON.parse(c.config); } catch (e) { c.parsedConfig = {}; }
  }
  return c;
}

function getActiveContests() {
  return stmts.getActive.all();
}

function getAllContests(limit = 50) {
  return stmts.getAll.all(limit);
}

function setContestStatus(id, status) {
  const result = stmts.setStatus.run(status, id);
  return result.changes > 0;
}

function addEntry(contestId, userId, answer, isCorrect, score) {
  stmts.addEntry.run(contestId, userId, answer, isCorrect ? 1 : 0, score || 0, answer, isCorrect ? 1 : 0, score || 0);
}

function getEntries(contestId) {
  return stmts.getEntries.all(contestId);
}

function getUserEntry(contestId, userId) {
  return stmts.getUserEntry.get(contestId, userId);
}

function getEntryById(entryId) {
  return stmts.getEntryById.get(entryId);
}

function addVote(contestId, voterId, entryId) {
  stmts.addVote.run(contestId, voterId, entryId);
}

function hasVoted(contestId, voterId) {
  return !!stmts.hasVoted.get(contestId, voterId);
}

function getVoteCounts(contestId) {
  return stmts.getVoteCounts.all(contestId);
}

function getContestResults(contestId) {
  const contest = getContest(contestId);
  if (!contest) return [];
  const entries = getEntries(contestId);
  if (contest.type === 'challenge') {
    const votes = getVoteCounts(contestId);
    const voteMap = {};
    votes.forEach(v => { voteMap[v.entry_id] = v.votes; });
    return entries.map(e => ({ ...e, votes: voteMap[e.id] || 0 })).sort((a, b) => b.votes - a.votes);
  }
  return entries; // Already sorted by score DESC for quiz
}

module.exports = {
  createContest,
  getContest,
  getActiveContests,
  getAllContests,
  setContestStatus,
  addEntry,
  getEntries,
  getUserEntry,
  getEntryById,
  addVote,
  hasVoted,
  getVoteCounts,
  getContestResults,
};
