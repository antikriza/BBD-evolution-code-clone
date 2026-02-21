const db = require('./init');

const stmts = {
  add: db.prepare('INSERT OR IGNORE INTO subscriptions (user_id, topic_slug) VALUES (?, ?)'),
  remove: db.prepare('DELETE FROM subscriptions WHERE user_id = ? AND topic_slug = ?'),
  getUserSubs: db.prepare('SELECT topic_slug FROM subscriptions WHERE user_id = ? ORDER BY subscribed_at'),
  getSubUsers: db.prepare('SELECT user_id FROM subscriptions WHERE topic_slug = ?'),
  getSubCounts: db.prepare('SELECT topic_slug, COUNT(*) as cnt FROM subscriptions GROUP BY topic_slug ORDER BY cnt DESC'),
  isSubscribed: db.prepare('SELECT 1 FROM subscriptions WHERE user_id = ? AND topic_slug = ?'),
  removeAll: db.prepare('DELETE FROM subscriptions WHERE user_id = ?'),
};

function subscribe(userId, topicSlug) {
  stmts.add.run(userId, topicSlug);
}

function unsubscribe(userId, topicSlug) {
  stmts.remove.run(userId, topicSlug);
}

function toggleSubscription(userId, topicSlug) {
  const exists = stmts.isSubscribed.get(userId, topicSlug);
  if (exists) {
    unsubscribe(userId, topicSlug);
    return false; // now unsubscribed
  }
  subscribe(userId, topicSlug);
  return true; // now subscribed
}

function getUserSubscriptions(userId) {
  return stmts.getUserSubs.all(userId).map(r => r.topic_slug);
}

function getSubscribers(topicSlug) {
  return stmts.getSubUsers.all(topicSlug).map(r => r.user_id);
}

function getSubscriptionCounts() {
  return stmts.getSubCounts.all();
}

module.exports = {
  subscribe, unsubscribe, toggleSubscription,
  getUserSubscriptions, getSubscribers, getSubscriptionCounts,
};
