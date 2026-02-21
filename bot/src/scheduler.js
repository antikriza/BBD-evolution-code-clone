const { getPendingMessages, setStatus } = require('./db/schedule');
const { getAllUserIds, getCompletedUserIds } = require('./db/users');
const { getSubscribers } = require('./db/subscriptions');
const { getOverdueHomework, closeHomework } = require('./db/homework');
const { getActiveContests, setContestStatus } = require('./db/contests');
const { cleanupOldGroupMessages } = require('./db/group');

const INTERVAL_MS = 60 * 1000; // Check every 60 seconds

function startScheduler(bot) {
  console.log('Scheduler started (checking every 60s)');

  setInterval(async () => {
    const pending = getPendingMessages();
    if (pending.length === 0) return;

    for (const msg of pending) {
      // Mark as sending to prevent double-send
      setStatus(msg.id, 'sending', 0);

      let ids;
      if (msg.audience === 'topic' && msg.topic_slug) {
        ids = getSubscribers(msg.topic_slug);
      } else if (msg.audience === 'completed') {
        ids = getCompletedUserIds();
      } else {
        ids = getAllUserIds();
      }

      let sent = 0, failed = 0;
      for (const id of ids) {
        try {
          await bot.api.sendMessage(id, msg.text, { parse_mode: 'HTML' });
          sent++;
        } catch (err) {
          failed++;
        }
        // Rate limit: pause every 25 messages
        if ((sent + failed) % 25 === 0) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      setStatus(msg.id, 'sent', sent);
      console.log(`Scheduled #${msg.id} sent: ${sent} ok, ${failed} failed (${ids.length} total)`);
    }

    // ── Homework deadline checks ──
    const overdue = getOverdueHomework();
    for (const hw of overdue) {
      closeHomework(hw.id);
      console.log(`Homework #${hw.id} "${hw.title}" auto-closed (deadline passed)`);
    }

    // ── Contest deadline checks ──
    const activeContests = getActiveContests();
    for (const c of activeContests) {
      if (c.deadline && new Date(c.deadline) <= new Date()) {
        if (c.type === 'challenge' && c.status === 'active') {
          setContestStatus(c.id, 'voting');
          console.log(`Contest #${c.id} "${c.title}" transitioned to voting`);
        } else {
          setContestStatus(c.id, 'closed');
          console.log(`Contest #${c.id} "${c.title}" auto-closed (deadline passed)`);
        }
      }
    }

    // ── Cleanup old group messages (rolling 7-day buffer) ──
    cleanupOldGroupMessages();
  }, INTERVAL_MS);
}

module.exports = { startScheduler };
