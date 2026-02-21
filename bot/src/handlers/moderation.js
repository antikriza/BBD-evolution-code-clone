const config = require('../config');
const { addWarning, getWarnings, getWarningCount, clearWarnings } = require('../db/moderation');
const { escHtml } = require('../utils/format');

function isAdmin(ctx) {
  return config.ADMIN_IDS.includes(ctx.from?.id);
}

// Resolve target user from reply or @username mention
function getTargetUser(ctx) {
  // If replying to a message, use that user
  if (ctx.message?.reply_to_message?.from) {
    const u = ctx.message.reply_to_message.from;
    if (u.is_bot) return null;
    return { id: u.id, name: u.first_name || u.username || String(u.id) };
  }
  return null;
}

module.exports = function (bot) {

  // /warn — Add warning to user (reply to their message)
  bot.command('warn', async (ctx) => {
    if (ctx.chat.type === 'private') return;
    if (!isAdmin(ctx)) return;

    const target = getTargetUser(ctx);
    if (!target) {
      await ctx.reply('Reply to a user\'s message to warn them.', { reply_to_message_id: ctx.message?.message_id });
      return;
    }

    const reason = ctx.message.text.split(/\s+/).slice(1).join(' ') || 'No reason given';
    const count = addWarning(target.id, reason, ctx.from.id);

    let text = `\u26a0\ufe0f <b>${escHtml(target.name)}</b> warned (${count}/3)\nReason: ${escHtml(reason)}`;

    // Auto-mute at 3 warnings
    if (count >= 3) {
      try {
        const until = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        await ctx.restrictChatMember(target.id, {
          until_date: until,
          permissions: { can_send_messages: false },
        });
        text += `\n\n\ud83d\udd07 Auto-muted for 1 hour (3+ warnings)`;
      } catch (e) {
        text += `\n\n\u274c Could not mute: ${e.message}`;
      }
    }

    await ctx.reply(text, { parse_mode: 'HTML' });
  });

  // /mute — Restrict user (reply to message)
  bot.command('mute', async (ctx) => {
    if (ctx.chat.type === 'private') return;
    if (!isAdmin(ctx)) return;

    const target = getTargetUser(ctx);
    if (!target) {
      await ctx.reply('Reply to a user\'s message to mute them.');
      return;
    }

    const args = ctx.message.text.split(/\s+/).slice(1);
    const minutes = parseInt(args[0]) || 60;
    const until = Math.floor(Date.now() / 1000) + minutes * 60;

    try {
      await ctx.restrictChatMember(target.id, {
        until_date: until,
        permissions: { can_send_messages: false },
      });
      await ctx.reply(`\ud83d\udd07 <b>${escHtml(target.name)}</b> muted for ${minutes} minutes.`, { parse_mode: 'HTML' });
    } catch (e) {
      await ctx.reply(`\u274c Could not mute: ${e.message}`);
    }
  });

  // /unmute — Remove restrictions
  bot.command('unmute', async (ctx) => {
    if (ctx.chat.type === 'private') return;
    if (!isAdmin(ctx)) return;

    const target = getTargetUser(ctx);
    if (!target) {
      await ctx.reply('Reply to a user\'s message to unmute them.');
      return;
    }

    try {
      await ctx.restrictChatMember(target.id, {
        permissions: {
          can_send_messages: true,
          can_send_audios: true,
          can_send_documents: true,
          can_send_photos: true,
          can_send_videos: true,
          can_send_video_notes: true,
          can_send_voice_notes: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
        },
      });
      await ctx.reply(`\ud83d\udd0a <b>${escHtml(target.name)}</b> unmuted.`, { parse_mode: 'HTML' });
    } catch (e) {
      await ctx.reply(`\u274c Could not unmute: ${e.message}`);
    }
  });

  // /ban — Ban user from group
  bot.command('ban', async (ctx) => {
    if (ctx.chat.type === 'private') return;
    if (!isAdmin(ctx)) return;

    const target = getTargetUser(ctx);
    if (!target) {
      await ctx.reply('Reply to a user\'s message to ban them.');
      return;
    }

    try {
      await ctx.banChatMember(target.id);
      await ctx.reply(`\ud83d\udeab <b>${escHtml(target.name)}</b> banned.`, { parse_mode: 'HTML' });
    } catch (e) {
      await ctx.reply(`\u274c Could not ban: ${e.message}`);
    }
  });

  // /warnings — Show user's warnings
  bot.command('warnings', async (ctx) => {
    if (ctx.chat.type === 'private') return;
    if (!isAdmin(ctx)) return;

    const target = getTargetUser(ctx);
    if (!target) {
      await ctx.reply('Reply to a user\'s message to see their warnings.');
      return;
    }

    const warns = getWarnings(target.id);
    if (warns.length === 0) {
      await ctx.reply(`\u2705 <b>${escHtml(target.name)}</b> has no warnings.`, { parse_mode: 'HTML' });
      return;
    }

    const lines = warns.slice(0, 10).map((w, i) =>
      `${i + 1}. ${escHtml(w.reason || 'No reason')} — ${w.created_at}`
    );

    await ctx.reply(
      `\u26a0\ufe0f <b>${escHtml(target.name)}</b> — ${warns.length} warning(s)\n\n${lines.join('\n')}`,
      { parse_mode: 'HTML' }
    );
  });

  // /clearwarnings — Reset user's warnings
  bot.command('clearwarnings', async (ctx) => {
    if (ctx.chat.type === 'private') return;
    if (!isAdmin(ctx)) return;

    const target = getTargetUser(ctx);
    if (!target) {
      await ctx.reply('Reply to a user\'s message to clear their warnings.');
      return;
    }

    const removed = clearWarnings(target.id);
    await ctx.reply(`\ud83e\uddf9 Cleared ${removed} warning(s) for <b>${escHtml(target.name)}</b>.`, { parse_mode: 'HTML' });
  });
};
