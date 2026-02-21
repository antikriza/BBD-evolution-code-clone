const db = require('./init');

const stmts = {
  saveBotMsg: db.prepare(`
    INSERT INTO bot_messages (chat_id, message_id, thread_id, text, sent_by) VALUES (?, ?, ?, ?, ?)
  `),
  getBotMessages: db.prepare('SELECT * FROM bot_messages ORDER BY sent_at DESC LIMIT ?'),
  getBotMessage: db.prepare('SELECT * FROM bot_messages WHERE id = ?'),
  updateBotText: db.prepare('UPDATE bot_messages SET text = ? WHERE id = ?'),
  deleteBotMsg: db.prepare('DELETE FROM bot_messages WHERE id = ?'),

  saveGroupMsg: db.prepare(`
    INSERT INTO group_messages (chat_id, message_id, thread_id, user_id, username, first_name, text)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  getRecentGroup: db.prepare('SELECT * FROM group_messages ORDER BY received_at DESC LIMIT ?'),
  getGroupMsg: db.prepare('SELECT * FROM group_messages WHERE chat_id = ? AND message_id = ?'),
  deleteGroupMsg: db.prepare('DELETE FROM group_messages WHERE chat_id = ? AND message_id = ?'),
  cleanup: db.prepare("DELETE FROM group_messages WHERE received_at < datetime('now', '-7 days')"),
};

function saveBotMessage(chatId, messageId, threadId, text, sentBy) {
  stmts.saveBotMsg.run(chatId, messageId, threadId || null, text, sentBy || null);
}

function getBotMessages(limit = 50) {
  return stmts.getBotMessages.all(limit);
}

function getBotMessage(id) {
  return stmts.getBotMessage.get(id);
}

function updateBotMessageText(id, newText) {
  return stmts.updateBotText.run(newText, id).changes > 0;
}

function deleteBotMessage(id) {
  return stmts.deleteBotMsg.run(id).changes > 0;
}

function saveGroupMessage(chatId, messageId, threadId, userId, username, firstName, text) {
  stmts.saveGroupMsg.run(chatId, messageId, threadId || null, userId, username || null, firstName || null, text);
}

function getRecentGroupMessages(limit = 100) {
  return stmts.getRecentGroup.all(limit);
}

function getGroupMessage(chatId, messageId) {
  return stmts.getGroupMsg.get(chatId, messageId);
}

function deleteGroupMessage(chatId, messageId) {
  return stmts.deleteGroupMsg.run(chatId, messageId).changes > 0;
}

function cleanupOldGroupMessages() {
  return stmts.cleanup.run().changes;
}

module.exports = {
  saveBotMessage,
  getBotMessages,
  getBotMessage,
  updateBotMessageText,
  deleteBotMessage,
  saveGroupMessage,
  getRecentGroupMessages,
  getGroupMessage,
  deleteGroupMessage,
  cleanupOldGroupMessages,
};
