const { Router } = require('express');
const {
  getDetailedStats, getRoleBreakdown, getRecentUsers,
  getUsersPaginated, getAllUsers, getAllUserIds,
  getCompletedUserIds, getUser, searchUsers, getUserCount,
} = require('../db/users');
const {
  getRoles, getExperience, getInterests,
  setRoles, setExperienceList, setInterests,
  addOption, removeOption,
} = require('../db/settings');
const {
  getSubscriptionCounts, getSubscribers, getUserSubscriptions,
} = require('../db/subscriptions');
const {
  createScheduled, getAllMessages, getUpcomingMessages, cancelMessage, deleteMessage,
} = require('../db/schedule');
const {
  getWarnings, getWarningCount, clearWarnings, getRecentWarnings,
} = require('../db/moderation');
const { getLeaderboard: getXpLeaderboard, getXpBreakdown, XP_LEVELS } = require('../db/xp');
const {
  getAllHomework, createHomework: createHw, getHomeworkById,
  getHomeworkProgress, getCompletedUserCount, closeHomework,
} = require('../db/homework');
const {
  getAllContests, createContest: createNewContest, getContest, getContestResults,
  setContestStatus, getEntries,
} = require('../db/contests');

module.exports = function (bot, courseData) {
  const router = Router();

  // ── Dashboard stats ──
  router.get('/stats', (req, res) => {
    const stats = getDetailedStats();
    const roles = getRoleBreakdown();
    const recent = getRecentUsers(5);
    res.json({ stats, roles, recent });
  });

  // ── Users ──
  router.get('/users/export/csv', (req, res) => {
    const users = getAllUsers();
    const header = 'telegram_id,username,first_name,display_name,role,experience,interests,lang,onboarding_complete,joined_at';
    const rows = users.map(u =>
      [u.telegram_id, u.username || '', u.first_name || '', u.display_name || '',
       u.role || '', u.experience || '', `"${(u.interests || '').replace(/"/g, '""')}"`,
       u.lang, u.onboarding_complete, u.joined_at].join(',')
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="users-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send([header, ...rows].join('\n'));
  });

  router.get('/users/search', (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ users: [] });
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const users = searchUsers(q, limit);
    res.json({ users });
  });

  router.get('/users/:id', (req, res) => {
    const user = getUser(parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    const subscriptions = getUserSubscriptions(user.telegram_id);
    res.json({ user, subscriptions });
  });

  router.get('/users', (req, res) => {
    const page = parseInt(req.query.page) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = page * limit;
    const users = getUsersPaginated(limit, offset);
    const total = getUserCount();
    res.json({ users, total, page, limit });
  });

  // ── Settings ──
  router.get('/settings/:key', (req, res) => {
    const getters = { roles: getRoles, experience: getExperience, interests: getInterests };
    const getter = getters[req.params.key];
    if (!getter) return res.status(400).json({ error: 'Invalid key. Use: roles, experience, interests' });
    res.json({ key: req.params.key, items: getter() });
  });

  router.put('/settings/:key', (req, res) => {
    const setters = { roles: setRoles, experience: setExperienceList, interests: setInterests };
    const setter = setters[req.params.key];
    if (!setter) return res.status(400).json({ error: 'Invalid key' });
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
    setter(items);
    res.json({ ok: true, key: req.params.key, items });
  });

  router.post('/settings/:key/options', (req, res) => {
    if (!['roles', 'experience', 'interests'].includes(req.params.key)) {
      return res.status(400).json({ error: 'Invalid key' });
    }
    const { id, en, uk } = req.body;
    if (!id || !en) return res.status(400).json({ error: 'id and en are required' });
    const added = addOption(req.params.key, id, en, uk || en);
    if (!added) return res.status(409).json({ error: `Option "${id}" already exists` });
    res.json({ ok: true });
  });

  router.delete('/settings/:key/options/:optionId', (req, res) => {
    if (!['roles', 'experience', 'interests'].includes(req.params.key)) {
      return res.status(400).json({ error: 'Invalid key' });
    }
    const removed = removeOption(req.params.key, req.params.optionId);
    if (!removed) return res.status(404).json({ error: 'Option not found' });
    res.json({ ok: true });
  });

  // ── Subscriptions ──
  router.get('/subscriptions', (req, res) => {
    const counts = getSubscriptionCounts();
    const enriched = counts.map(c => {
      const entry = courseData.topicBySlug[c.topic_slug];
      return {
        topic_slug: c.topic_slug,
        title_en: entry ? entry.topic.title.en : c.topic_slug,
        title_uk: entry ? entry.topic.title.uk : c.topic_slug,
        count: c.cnt,
      };
    });
    res.json({ subscriptions: enriched });
  });

  // ── Broadcast ──
  router.post('/broadcast', async (req, res) => {
    const { audience, topicSlug, text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    let ids;
    if (audience === 'topic') {
      if (!topicSlug) return res.status(400).json({ error: 'topicSlug required for topic audience' });
      ids = getSubscribers(topicSlug);
    } else if (audience === 'completed') {
      ids = getCompletedUserIds();
    } else {
      ids = getAllUserIds();
    }

    if (ids.length === 0) {
      return res.json({ status: 'done', sent: 0, failed: 0, total: 0 });
    }

    // Return immediately, broadcast async
    res.json({ status: 'started', total: ids.length });

    let sent = 0, failed = 0;
    for (const id of ids) {
      try {
        await bot.api.sendMessage(id, text, { parse_mode: 'HTML' });
        sent++;
      } catch (err) {
        failed++;
      }
      // Rate limit: pause every 25 messages
      if ((sent + failed) % 25 === 0) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    console.log(`Broadcast done: sent=${sent} failed=${failed} total=${ids.length}`);
  });

  // ── Topics list (for broadcast topic selector) ──
  router.get('/topics', (req, res) => {
    const topics = courseData.allTopicsFlat.map(t => ({
      slug: t.slug,
      title_en: t.title.en,
      title_uk: t.title.uk,
      levelEmoji: t.levelEmoji,
    }));
    res.json({ topics });
  });

  // ── Scheduled Messages ──
  router.get('/schedule', (req, res) => {
    const upcoming = req.query.upcoming === 'true';
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const messages = upcoming ? getUpcomingMessages(limit) : getAllMessages(limit);
    res.json({ messages });
  });

  router.post('/schedule', (req, res) => {
    const { text, audience, topicSlug, sendAt } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    if (!sendAt) return res.status(400).json({ error: 'sendAt is required (YYYY-MM-DD HH:MM)' });
    const id = createScheduled(text, audience || 'all', topicSlug, sendAt, null);
    res.json({ ok: true, id });
  });

  router.delete('/schedule/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const cancelled = cancelMessage(id);
    if (!cancelled) return res.status(404).json({ error: 'Message not found or not pending' });
    res.json({ ok: true });
  });

  // ── Moderation ──
  router.get('/moderation/warnings', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const warnings = getRecentWarnings(limit);
    res.json({ warnings });
  });

  router.get('/moderation/warnings/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const warnings = getWarnings(userId);
    const count = getWarningCount(userId);
    res.json({ userId, count, warnings });
  });

  // ── XP & Leaderboard ──
  router.get('/leaderboard', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const leaderboard = getXpLeaderboard(limit);
    res.json({ leaderboard, levels: XP_LEVELS });
  });

  router.get('/users/:id/xp', (req, res) => {
    const userId = parseInt(req.params.id);
    const breakdown = getXpBreakdown(userId);
    res.json({ breakdown });
  });

  // ── Homework ──
  router.get('/homework', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const homework = getAllHomework(limit);
    const enriched = homework.map(hw => {
      const completedCount = getCompletedUserCount(hw.id);
      return { ...hw, completedCount };
    });
    res.json({ homework: enriched });
  });

  router.post('/homework', (req, res) => {
    const { title, topicSlugs, deadline, xpReward } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!topicSlugs || !topicSlugs.length) return res.status(400).json({ error: 'topicSlugs is required' });
    const slugs = Array.isArray(topicSlugs) ? topicSlugs.join(',') : topicSlugs;
    const id = createHw(title, slugs, deadline || null, xpReward || 30, null);
    res.json({ ok: true, id });
  });

  router.get('/homework/:id', (req, res) => {
    const hw = getHomeworkById(parseInt(req.params.id));
    if (!hw) return res.status(404).json({ error: 'Homework not found' });
    const progress = getHomeworkProgress(hw.id);
    const completedCount = getCompletedUserCount(hw.id);
    res.json({ homework: hw, progress, completedCount });
  });

  router.put('/homework/:id/close', (req, res) => {
    const closed = closeHomework(parseInt(req.params.id));
    if (!closed) return res.status(404).json({ error: 'Homework not found' });
    res.json({ ok: true });
  });

  // ── Contests ──
  router.get('/contests', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const contests = getAllContests(limit);
    res.json({ contests });
  });

  router.post('/contests', (req, res) => {
    const { type, title, description, deadline, config, xp } = req.body;
    if (!type || !title) return res.status(400).json({ error: 'type and title are required' });
    if (!['poll', 'quiz', 'challenge'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
    const id = createNewContest(type, title, description, config, deadline, xp, null);
    res.json({ ok: true, id });
  });

  router.get('/contests/:id', (req, res) => {
    const contest = getContest(parseInt(req.params.id));
    if (!contest) return res.status(404).json({ error: 'Contest not found' });
    const entries = getEntries(contest.id);
    const results = getContestResults(contest.id);
    res.json({ contest, entries, results });
  });

  router.put('/contests/:id/close', (req, res) => {
    const id = parseInt(req.params.id);
    const contest = getContest(id);
    if (!contest) return res.status(404).json({ error: 'Contest not found' });
    setContestStatus(id, 'closed');
    res.json({ ok: true });
  });

  router.put('/contests/:id/status', (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const contest = getContest(id);
    if (!contest) return res.status(404).json({ error: 'Contest not found' });
    setContestStatus(id, status);
    res.json({ ok: true });
  });

  // ── Group Management ──
  const groupDb = require('../db/group');

  router.get('/group/messages', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    res.json({ messages: groupDb.getBotMessages(limit) });
  });

  router.post('/group/send', async (req, res) => {
    const { chatId, text, threadId } = req.body;
    if (!chatId || !text) return res.status(400).json({ error: 'chatId and text required' });
    try {
      const opts = { parse_mode: 'HTML' };
      if (threadId) opts.message_thread_id = threadId;
      const msg = await bot.api.sendMessage(chatId, text, opts);
      groupDb.saveBotMessage(chatId, msg.message_id, threadId || null, text, null);
      res.json({ ok: true, messageId: msg.message_id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/group/messages/:id', async (req, res) => {
    const { text } = req.body;
    const botMsg = groupDb.getBotMessage(parseInt(req.params.id));
    if (!botMsg) return res.status(404).json({ error: 'Not found' });
    try {
      await bot.api.editMessageText(botMsg.chat_id, botMsg.message_id, text, { parse_mode: 'HTML' });
      groupDb.updateBotMessageText(botMsg.id, text);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/group/messages/:id', async (req, res) => {
    const botMsg = groupDb.getBotMessage(parseInt(req.params.id));
    if (!botMsg) return res.status(404).json({ error: 'Not found' });
    try {
      await bot.api.deleteMessage(botMsg.chat_id, botMsg.message_id);
      groupDb.deleteBotMessage(botMsg.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/group/chat', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    res.json({ messages: groupDb.getRecentGroupMessages(limit) });
  });

  router.delete('/group/chat/:chatId/:msgId', async (req, res) => {
    const chatId = parseInt(req.params.chatId);
    const msgId = parseInt(req.params.msgId);
    try {
      await bot.api.deleteMessage(chatId, msgId);
      groupDb.deleteGroupMessage(chatId, msgId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/group/chat/:chatId/:msgId/warn', (req, res) => {
    const msg = groupDb.getGroupMessage(parseInt(req.params.chatId), parseInt(req.params.msgId));
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    const { reason } = req.body;
    const { addWarning, getWarningCount } = require('../db/moderation');
    addWarning(msg.user_id, reason || 'Warned from dashboard', 0);
    const count = getWarningCount(msg.user_id);
    res.json({ ok: true, warningCount: count });
  });

  return router;
};
