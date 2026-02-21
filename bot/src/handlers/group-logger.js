const { saveGroupMessage } = require('../db/group');

module.exports = function (bot) {
  bot.on('message:text', (ctx, next) => {
    const chat = ctx.chat;
    if (chat.type !== 'group' && chat.type !== 'supergroup') return next();

    const msg = ctx.message;
    saveGroupMessage(
      chat.id,
      msg.message_id,
      msg.message_thread_id || null,
      msg.from?.id,
      msg.from?.username || null,
      msg.from?.first_name || null,
      msg.text
    );

    return next();
  });
};
