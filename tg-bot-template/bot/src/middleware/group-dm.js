const { InlineKeyboard } = require('grammy');

let botUsername = null;

function groupDmMiddleware(bot) {
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

    if (!isGroup || !isCommand || isCallback) {
      return next();
    }

    const userId = ctx.from?.id;
    const lang = ctx.lang;
    const firstName = ctx.from?.first_name || '';
    const chatId = ctx.chat.id;
    const cmdMsgId = ctx.message.message_id;

    try {
      await bot.api.deleteMessage(chatId, cmdMsgId);
    } catch (e) { /* bot might not have delete permission */ }

    const originalReply = ctx.reply.bind(ctx);
    const dmMessages = [];

    ctx.reply = async (text, opts) => {
      try {
        const msg = await bot.api.sendMessage(userId, text, opts);
        dmMessages.push(msg);
        return msg;
      } catch (err) {
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
          setTimeout(async () => {
            try { await bot.api.deleteMessage(chatId, notice.message_id); } catch (e) {}
          }, 15000);
          return null;
        }
        throw err;
      }
    };

    await next();

    if (dmMessages.length > 0) {
      try {
        const note = lang === 'uk'
          ? `\u2709\uFE0F ${firstName}, \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u0432 \u043E\u0441\u043E\u0431\u0438\u0441\u0442\u0438\u0445`
          : `\u2709\uFE0F ${firstName}, check your DM`;
        const groupMsg = await originalReply(note);
        setTimeout(async () => {
          try { await bot.api.deleteMessage(chatId, groupMsg.message_id); } catch (e) {}
        }, 5000);
      } catch (e) { /* ignore */ }
    }
  });
}

module.exports = { groupDmMiddleware };
