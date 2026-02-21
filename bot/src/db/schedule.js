const db = require('./init');

const stmts = {
  create: db.prepare('INSERT INTO scheduled_messages (text, audience, topic_slug, send_at, created_by) VALUES (?, ?, ?, ?, ?)'),
  getPending: db.prepare("SELECT * FROM scheduled_messages WHERE status = 'pending' AND send_at <= datetime('now') ORDER BY send_at ASC"),
  getAll: db.prepare('SELECT * FROM scheduled_messages ORDER BY send_at DESC LIMIT ?'),
  getUpcoming: db.prepare("SELECT * FROM scheduled_messages WHERE status = 'pending' ORDER BY send_at ASC LIMIT ?"),
  getById: db.prepare('SELECT * FROM scheduled_messages WHERE id = ?'),
  setStatus: db.prepare('UPDATE scheduled_messages SET status = ?, sent_count = ? WHERE id = ?'),
  cancel: db.prepare("UPDATE scheduled_messages SET status = 'cancelled' WHERE id = ? AND status = 'pending'"),
  delete: db.prepare('DELETE FROM scheduled_messages WHERE id = ?'),
};

function createScheduled(text, audience, topicSlug, sendAt, createdBy) {
  const result = stmts.create.run(text, audience, topicSlug || null, sendAt, createdBy || null);
  return result.lastInsertRowid;
}

function getPendingMessages() {
  return stmts.getPending.all();
}

function getAllMessages(limit = 50) {
  return stmts.getAll.all(limit);
}

function getUpcomingMessages(limit = 10) {
  return stmts.getUpcoming.all(limit);
}

function getById(id) {
  return stmts.getById.get(id);
}

function setStatus(id, status, sentCount = 0) {
  stmts.setStatus.run(status, sentCount, id);
}

function cancelMessage(id) {
  const info = stmts.cancel.run(id);
  return info.changes > 0;
}

function deleteMessage(id) {
  const info = stmts.delete.run(id);
  return info.changes > 0;
}

module.exports = {
  createScheduled, getPendingMessages, getAllMessages, getUpcomingMessages,
  getById, setStatus, cancelMessage, deleteMessage,
};
