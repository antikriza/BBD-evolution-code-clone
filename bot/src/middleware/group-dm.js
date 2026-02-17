const { InlineKeyboard } = require('grammy');

let botUsername = null;

function groupDmMiddleware(bot) {
  // Cache bot username on first use
  bot.use(async (ctx, next) => {
    if (!botUsername) {
      try { botUsername = (await bot.api.getMe()).username; } catch (e) { /* retry next time */ }
    }
    return next();
  });

  bot.use(async (ctx, next) => {
    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
    const isCommand = ctx.message?.text?.startsWith('/');
    const isCallback = !!ctx.callbackQuery;

    // Only intercept commands in groups (not callbacks, not DMs)
    if (!isGroup || !isCommand || isCallback) {
      return next();
    }

    const userId = ctx.from?.id;
    const lang = ctx.lang;
    const firstName = ctx.from?.first_name || '';
    const chatId = ctx.chat.id;
    const cmdMsgId = ctx.message.message_id;

    // Delete the user's command from group immediately
    try {
      await bot.api.deleteMessage(chatId, cmdMsgId);
    } catch (e) { /* bot might not have delete permission */ }

    // Override ctx.reply to send to DM instead
    const originalReply = ctx.reply.bind(ctx);
    const dmMessages = [];

    ctx.reply = async (text, opts) => {
      try {
        const msg = await bot.api.sendMessage(userId, text, opts);
        dmMessages.push(msg);
        return msg;
      } catch (err) {
        // User hasn't started the bot in DM
        if (err.error_code === 403) {
          const startUrl = `https://t.me/${botUsername || 'bot'}?start=from_group`;
          const kb = new InlineKeyboard().url(
            lang === 'uk' ? 'Почати чат з ботом' : 'Start chat with bot',
            startUrl
          );
          const notice = await originalReply(
            lang === 'uk'
              ? `${firstName}, спочатку натисніть кнопку, щоб почати чат з ботом:`
              : `${firstName}, please start a DM with the bot first:`,
            { reply_markup: kb }
          );
          // Auto-delete the notice after 15 seconds
          setTimeout(async () => {
            try { await bot.api.deleteMessage(chatId, notice.message_id); } catch (e) {}
          }, 15000);
          return null;
        }
        throw err;
      }
    };

    await next();

    // If DM was sent successfully, post a brief note in group then auto-delete
    if (dmMessages.length > 0) {
      try {
        const note = lang === 'uk'
          ? `✉️ ${firstName}, відповідь в особистих`
          : `✉️ ${firstName}, check your DM`;
        const groupMsg = await originalReply(note);

        setTimeout(async () => {
          try { await bot.api.deleteMessage(chatId, groupMsg.message_id); } catch (e) {}
        }, 5000);
      } catch (e) { /* ignore */ }
    }
  });
}

module.exports = { groupDmMiddleware };
