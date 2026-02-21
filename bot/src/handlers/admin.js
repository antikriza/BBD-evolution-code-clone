const { InlineKeyboard, InputFile } = require('grammy');
const config = require('../config');
const { escHtml } = require('../utils/format');
const {
  getDetailedStats, getRoleBreakdown, getRecentUsers,
  getUsersPaginated, getAllUserIds, getCompletedUserIds, getAllUsers,
} = require('../db/users');
const { getRoles, getExperience, getInterests, addOption, removeOption } = require('../db/settings');
const { getSubscribers, getSubscriptionCounts } = require('../db/subscriptions');
const { createScheduled, getUpcomingMessages } = require('../db/schedule');

function isAdmin(ctx) {
  return config.ADMIN_IDS.includes(ctx.from?.id);
}

function adminOnly(ctx) {
  if (!isAdmin(ctx)) {
    ctx.reply('Access denied.');
    return false;
  }
  return true;
}

module.exports = function (bot) {

  // ── /admin — Main admin menu ──────────────────
  bot.command('admin', async (ctx) => {
    if (!adminOnly(ctx)) return;
    await sendAdminMenu(ctx);
  });

  // ── /stats — Quick stats ──────────────────────
  bot.command('stats', async (ctx) => {
    if (!adminOnly(ctx)) return;
    await sendStats(ctx);
  });

  // ── /users — User list ────────────────────────
  bot.command('users', async (ctx) => {
    if (!adminOnly(ctx)) return;
    await sendUserList(ctx, 0);
  });

  // ── /broadcast <message> — Send to all users ─
  bot.command('broadcast', async (ctx) => {
    if (!adminOnly(ctx)) return;
    const text = ctx.message.text.replace(/^\/broadcast\s*/, '').trim();
    if (!text) {
      await ctx.reply(
        '<b>📢 Broadcast</b>\n\n' +
        'Usage:\n' +
        '<code>/broadcast Your message here</code> — all users\n' +
        '<code>/broadcast_completed Your message</code> — completed only\n' +
        '<code>/broadcast_topic topicslug Your message</code> — topic subscribers\n\n' +
        'Supports HTML formatting.',
        { parse_mode: 'HTML' }
      );
      return;
    }
    await doBroadcast(ctx, text, 'all');
  });

  bot.command('broadcast_completed', async (ctx) => {
    if (!adminOnly(ctx)) return;
    const text = ctx.message.text.replace(/^\/broadcast_completed\s*/, '').trim();
    if (!text) {
      await ctx.reply('Usage: <code>/broadcast_completed Your message</code>', { parse_mode: 'HTML' });
      return;
    }
    await doBroadcast(ctx, text, 'completed');
  });

  // ── /broadcast_topic <slug> <message> — Send to topic subscribers
  bot.command('broadcast_topic', async (ctx) => {
    if (!adminOnly(ctx)) return;
    const parts = ctx.message.text.replace(/^\/broadcast_topic\s*/, '').trim();
    const spaceIdx = parts.indexOf(' ');
    if (spaceIdx === -1 || !parts) {
      await ctx.reply(
        '<b>📢 Topic Broadcast</b>\n\nUsage: <code>/broadcast_topic topic-slug Your message</code>\n\n' +
        'Use /subscriptions to see topics with subscribers.',
        { parse_mode: 'HTML' }
      );
      return;
    }
    const slug = parts.slice(0, spaceIdx);
    const text = parts.slice(spaceIdx + 1).trim();
    await doBroadcast(ctx, text, 'topic', slug);
  });

  // ── /export — Export user data as CSV file ────
  bot.command('export', async (ctx) => {
    if (!adminOnly(ctx)) return;
    await sendExport(ctx);
  });

  // ── /subscriptions — Show subscription stats ──
  bot.command('subscriptions', async (ctx) => {
    if (!adminOnly(ctx)) return;
    await sendSubscriptionStats(ctx);
  });

  // ── /schedule — Show upcoming scheduled messages ─
  bot.command('schedule', async (ctx) => {
    if (!adminOnly(ctx)) return;
    const msgs = getUpcomingMessages(10);
    if (msgs.length === 0) {
      await ctx.reply(
        '<b>📅 Scheduled Messages</b>\n\nNo upcoming messages.\n\n' +
        'Create one:\n<code>/schedule_add 2026-02-21 15:00 Hello!</code>',
        { parse_mode: 'HTML' }
      );
      return;
    }
    const lines = msgs.map(m =>
      `#${m.id} — <b>${escHtml(m.send_at)}</b> [${m.audience}]\n${escHtml((m.text || '').substring(0, 80))}${(m.text || '').length > 80 ? '...' : ''}`
    );
    await ctx.reply(
      `<b>📅 Upcoming Scheduled Messages</b>\n\n${lines.join('\n\n')}`,
      { parse_mode: 'HTML' }
    );
  });

  // ── /schedule_add <datetime> <text> — Schedule a broadcast ─
  bot.command('schedule_add', async (ctx) => {
    if (!adminOnly(ctx)) return;
    const args = ctx.message.text.replace(/^\/schedule_add\s*/, '').trim();
    // Expected: YYYY-MM-DD HH:MM <text>
    const match = args.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(.+)$/s);
    if (!match) {
      await ctx.reply(
        '<b>📅 Schedule a Message</b>\n\n' +
        'Usage: <code>/schedule_add YYYY-MM-DD HH:MM Your message</code>\n\n' +
        'Example:\n<code>/schedule_add 2026-02-21 15:00 Hello everyone!</code>\n\n' +
        'Time is UTC. HTML formatting supported.',
        { parse_mode: 'HTML' }
      );
      return;
    }
    const sendAt = match[1];
    const text = match[2].trim();
    const id = createScheduled(text, 'all', null, sendAt, ctx.from.id);
    await ctx.reply(
      `✅ Scheduled message #${id}\nSend at: <b>${escHtml(sendAt)}</b> UTC\nAudience: all\n\nUse /schedule to view upcoming.`,
      { parse_mode: 'HTML' }
    );
  });

  // ── /editroles, /editexperience, /editinterests — Edit onboarding options
  bot.command('editroles', async (ctx) => {
    if (!adminOnly(ctx)) return;
    await sendEditMenu(ctx, 'roles');
  });

  bot.command('editexperience', async (ctx) => {
    if (!adminOnly(ctx)) return;
    await sendEditMenu(ctx, 'experience');
  });

  bot.command('editinterests', async (ctx) => {
    if (!adminOnly(ctx)) return;
    await sendEditMenu(ctx, 'interests');
  });

  // ── /addoption <setting> <id> <en> | <uk>
  bot.command('addoption', async (ctx) => {
    if (!adminOnly(ctx)) return;
    // Format: /addoption roles analyst Analyst | Аналітик
    const args = ctx.message.text.replace(/^\/addoption\s*/, '').trim();
    const parts = args.split(/\s+/);
    if (parts.length < 3) {
      await ctx.reply(
        '<b>Add option</b>\n\nUsage: <code>/addoption setting id English Label | Українська</code>\n\n' +
        'Settings: roles, experience, interests\n' +
        'Example: <code>/addoption roles analyst Analyst | Аналітик</code>',
        { parse_mode: 'HTML' }
      );
      return;
    }
    const settingKey = parts[0];
    if (!['roles', 'experience', 'interests'].includes(settingKey)) {
      await ctx.reply('Invalid setting. Use: roles, experience, interests');
      return;
    }
    const id = parts[1];
    const rest = parts.slice(2).join(' ');
    const [en, uk] = rest.split('|').map(s => s.trim());
    if (!en) {
      await ctx.reply('English label is required.');
      return;
    }
    const added = addOption(settingKey, id, en, uk || en);
    if (added) {
      await ctx.reply(`✅ Added <b>${escHtml(en)}</b> to ${settingKey}.`, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(`Option with id "${id}" already exists in ${settingKey}.`);
    }
  });

  // ── /removeoption <setting> <id>
  bot.command('removeoption', async (ctx) => {
    if (!adminOnly(ctx)) return;
    const args = ctx.message.text.replace(/^\/removeoption\s*/, '').trim();
    const [settingKey, id] = args.split(/\s+/);
    if (!settingKey || !id) {
      await ctx.reply(
        'Usage: <code>/removeoption setting id</code>\nExample: <code>/removeoption roles analyst</code>',
        { parse_mode: 'HTML' }
      );
      return;
    }
    if (!['roles', 'experience', 'interests'].includes(settingKey)) {
      await ctx.reply('Invalid setting. Use: roles, experience, interests');
      return;
    }
    const removed = removeOption(settingKey, id);
    if (removed) {
      await ctx.reply(`✅ Removed <b>${escHtml(id)}</b> from ${settingKey}.`, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(`Option "${id}" not found in ${settingKey}.`);
    }
  });

  // ── Callback handlers ─────────────────────────
  bot.on('callback_query:data', async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    if (!data.startsWith('admin:')) return next();
    if (!isAdmin(ctx)) {
      await ctx.answerCallbackQuery({ text: 'Access denied' });
      return;
    }

    try {
      if (data === 'admin:stats') {
        await sendStats(ctx);
      } else if (data.startsWith('admin:users:')) {
        const page = parseInt(data.split(':')[2]) || 0;
        await sendUserList(ctx, page);
      } else if (data === 'admin:broadcast_help') {
        await ctx.reply(
          '<b>📢 Broadcast Commands</b>\n\n' +
          '<code>/broadcast Hello everyone!</code>\n→ All users\n\n' +
          '<code>/broadcast_completed Special offer!</code>\n→ Completed profiles only\n\n' +
          '<code>/broadcast_topic ai-agents Check this out!</code>\n→ Subscribers of a topic\n\n' +
          'HTML formatting supported.',
          { parse_mode: 'HTML' }
        );
      } else if (data === 'admin:export') {
        await sendExport(ctx);
      } else if (data === 'admin:edit') {
        await sendEditOverview(ctx);
      } else if (data.startsWith('admin:edit:')) {
        const settingKey = data.split(':')[2];
        await sendEditMenu(ctx, settingKey);
      } else if (data.startsWith('admin:rm:')) {
        const [, , settingKey, id] = data.split(':');
        const removed = removeOption(settingKey, id);
        if (removed) {
          await ctx.answerCallbackQuery({ text: `Removed: ${id}` });
        } else {
          await ctx.answerCallbackQuery({ text: 'Not found' });
        }
        await sendEditMenu(ctx, settingKey, true);
        return;
      } else if (data === 'admin:subs') {
        await sendSubscriptionStats(ctx);
      } else if (data === 'admin:menu') {
        await sendAdminMenu(ctx, true);
      }
      await ctx.answerCallbackQuery();
    } catch (err) {
      console.error('Admin callback error:', err.message);
      try { await ctx.answerCallbackQuery(); } catch (e) {}
    }
  });
};

// ── Helper functions ──────────────────────────────

function sendAdminMenu(ctx, edit = false) {
  const kb = new InlineKeyboard()
    .text('📊 Stats', 'admin:stats').row()
    .text('👥 Users', 'admin:users:0').row()
    .text('⚙️ Edit Questions', 'admin:edit').row()
    .text('🔔 Subscriptions', 'admin:subs').row()
    .text('📢 Broadcast help', 'admin:broadcast_help').row()
    .text('📋 Export CSV', 'admin:export');

  const text = '<b>🔐 Admin Panel</b>\n\nSelect an action:';

  if (edit && ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb }).catch(() =>
      ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb })
    );
  }
  return ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

async function sendStats(ctx) {
  const s = getDetailedStats();
  const roles = getRoleBreakdown();

  const roleText = roles.length > 0
    ? roles.map(r => `  ${r.role || '(none)'}: <b>${r.cnt}</b>`).join('\n')
    : '  No data';

  const completionPct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;

  const text =
    `<b>📊 Bot Statistics</b>\n\n` +
    `👥 Total users: <b>${s.total}</b>\n` +
    `✅ Completed onboarding: <b>${s.completed}</b> (${completionPct}%)\n` +
    `⏳ Incomplete: <b>${s.incomplete}</b>\n\n` +
    `📅 New users (24h): <b>${s.last_24h}</b>\n` +
    `📅 New users (7d): <b>${s.last_7d}</b>\n\n` +
    `<b>Roles:</b>\n${roleText}`;

  const kb = new InlineKeyboard().text('← Back', 'admin:menu');

  if (ctx.callbackQuery) {
    try { await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb }); } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

async function sendUserList(ctx, page) {
  const pageSize = 10;
  const offset = page * pageSize;
  const users = getUsersPaginated(pageSize + 1, offset);
  const hasMore = users.length > pageSize;
  const display = users.slice(0, pageSize);

  if (display.length === 0) {
    const text = page === 0 ? 'No users yet.' : 'No more users.';
    if (ctx.callbackQuery) return ctx.answerCallbackQuery({ text });
    return ctx.reply(text);
  }

  const lines = display.map((u, i) => {
    const num = offset + i + 1;
    const status = u.onboarding_complete ? '✅' : '⏳';
    const name = u.display_name || u.first_name || '(no name)';
    const uname = u.username ? `@${u.username}` : '';
    const role = u.role || '';
    return `${num}. ${status} <b>${escHtml(name)}</b> ${escHtml(uname)} ${role} [${u.lang}]`;
  });

  const text = `<b>👥 Users</b> (page ${page + 1})\n\n${lines.join('\n')}`;

  const kb = new InlineKeyboard();
  if (page > 0) kb.text('← Prev', `admin:users:${page - 1}`);
  if (hasMore) kb.text('Next →', `admin:users:${page + 1}`);
  kb.row().text('← Back', 'admin:menu');

  if (ctx.callbackQuery) {
    try { await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb }); } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

async function sendEditOverview(ctx) {
  const roles = getRoles();
  const exp = getExperience();
  const interests = getInterests();

  const text =
    `<b>⚙️ Onboarding Questions</b>\n\n` +
    `💼 <b>Roles</b> (${roles.length}): ${roles.map(r => r.en).join(', ')}\n\n` +
    `🎯 <b>Experience</b> (${exp.length}): ${exp.map(e => e.en).join(', ')}\n\n` +
    `🧩 <b>Interests</b> (${interests.length}): ${interests.map(i => i.en).join(', ')}`;

  const kb = new InlineKeyboard()
    .text('💼 Edit Roles', 'admin:edit:roles').row()
    .text('🎯 Edit Experience', 'admin:edit:experience').row()
    .text('🧩 Edit Interests', 'admin:edit:interests').row()
    .text('← Back', 'admin:menu');

  if (ctx.callbackQuery) {
    try { await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb }); } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

async function sendEditMenu(ctx, settingKey, forceEdit = false) {
  const getterMap = { roles: getRoles, experience: getExperience, interests: getInterests };
  const emojiMap = { roles: '💼', experience: '🎯', interests: '🧩' };
  const items = getterMap[settingKey]();
  const emoji = emojiMap[settingKey];

  const lines = items.map(item => `  <b>${escHtml(item.en)}</b> (${escHtml(item.uk)}) — id: <code>${item.id}</code>`);

  const text =
    `${emoji} <b>${settingKey.charAt(0).toUpperCase() + settingKey.slice(1)}</b>\n\n` +
    `${lines.join('\n')}\n\n` +
    `To add: <code>/addoption ${settingKey} newid English | Українська</code>\n` +
    `To remove: tap ❌ below or <code>/removeoption ${settingKey} id</code>`;

  const kb = new InlineKeyboard();
  items.forEach(item => {
    kb.text(`❌ ${item.en}`, `admin:rm:${settingKey}:${item.id}`).row();
  });
  kb.text('← Back', 'admin:edit');

  const isEdit = forceEdit || !!ctx.callbackQuery;
  if (isEdit && ctx.callbackQuery) {
    try { await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb }); } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

async function sendSubscriptionStats(ctx) {
  const counts = getSubscriptionCounts();
  const courseData = ctx.courseData;

  let text;
  if (counts.length === 0) {
    text = '<b>🔔 Topic Subscriptions</b>\n\nNo subscriptions yet.';
  } else {
    const lines = counts.map(c => {
      const entry = courseData.topicBySlug[c.topic_slug];
      const name = entry ? entry.topic.title.en : c.topic_slug;
      return `  ${escHtml(name)}: <b>${c.cnt}</b> subscriber${c.cnt !== 1 ? 's' : ''}`;
    });
    text = `<b>🔔 Topic Subscriptions</b>\n\n${lines.join('\n')}\n\n` +
      `To broadcast: <code>/broadcast_topic slug message</code>`;
  }

  const kb = new InlineKeyboard().text('← Back', 'admin:menu');

  if (ctx.callbackQuery) {
    try { await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb }); } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

async function doBroadcast(ctx, text, audience, topicSlug) {
  let ids;
  let label;
  if (audience === 'topic') {
    ids = getSubscribers(topicSlug);
    label = `topic "${topicSlug}"`;
    if (ids.length === 0) {
      await ctx.reply(`No subscribers for topic "${topicSlug}".`);
      return;
    }
  } else if (audience === 'completed') {
    ids = getCompletedUserIds();
    label = 'completed';
  } else {
    ids = getAllUserIds();
    label = 'all';
  }

  const status = await ctx.reply(
    `📢 Broadcasting to <b>${ids.length}</b> ${label} users...`,
    { parse_mode: 'HTML' }
  );

  let sent = 0;
  let failed = 0;
  let blocked = 0;

  for (const id of ids) {
    try {
      await ctx.api.sendMessage(id, text, { parse_mode: 'HTML' });
      sent++;
    } catch (err) {
      if (err.error_code === 403) {
        blocked++;
      } else {
        failed++;
      }
    }
    if ((sent + failed + blocked) % 25 === 0) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const report =
    `<b>📢 Broadcast complete</b>\n\n` +
    `✅ Sent: <b>${sent}</b>\n` +
    `🚫 Blocked bot: <b>${blocked}</b>\n` +
    `❌ Failed: <b>${failed}</b>\n` +
    `📊 Total: <b>${ids.length}</b>`;

  try {
    await ctx.api.editMessageText(ctx.chat.id, status.message_id, report, { parse_mode: 'HTML' });
  } catch (e) {
    await ctx.reply(report, { parse_mode: 'HTML' });
  }
}

async function sendExport(ctx) {
  const users = getAllUsers();
  const header = 'telegram_id,username,first_name,display_name,role,experience,interests,lang,onboarding_complete,joined_at';
  const rows = users.map(u =>
    [u.telegram_id, u.username || '', u.first_name || '', u.display_name || '',
     u.role || '', u.experience || '', `"${(u.interests || '').replace(/"/g, '""')}"`,
     u.lang, u.onboarding_complete, u.joined_at].join(',')
  );
  const csv = [header, ...rows].join('\n');
  const buffer = Buffer.from(csv, 'utf-8');

  await ctx.replyWithDocument(
    new InputFile(buffer, `users-${new Date().toISOString().slice(0, 10)}.csv`),
    { caption: `📋 ${users.length} users exported` }
  );
}
