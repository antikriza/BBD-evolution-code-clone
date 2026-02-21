const { InlineKeyboard } = require('grammy');
const { getUserSubscriptions, toggleSubscription } = require('../db/subscriptions');
const { escHtml } = require('../utils/format');

module.exports = function (bot) {

  // /subscribe — Show topic subscription menu
  bot.command('subscribe', async (ctx) => {
    if (ctx.chat.type !== 'private') {
      await ctx.reply(ctx.lang === 'uk'
        ? 'Надішли /subscribe мені в особисті повідомлення.'
        : 'Send /subscribe to me in DM.');
      return;
    }
    await sendSubscribeMenu(ctx, 0);
  });

  // /mysubs — Show current subscriptions
  bot.command('mysubs', async (ctx) => {
    const lang = ctx.lang;
    const subs = getUserSubscriptions(ctx.from.id);
    const courseData = ctx.courseData;

    if (subs.length === 0) {
      await ctx.reply(lang === 'uk'
        ? 'У тебе немає підписок. Використай /subscribe щоб підписатись на теми.'
        : 'You have no subscriptions. Use /subscribe to follow topics.');
      return;
    }

    const lines = subs.map(slug => {
      const entry = courseData.topicBySlug[slug];
      if (!entry) return `- ${slug}`;
      return `${entry.level.emoji} ${escHtml(entry.topic.title[lang])}`;
    });

    await ctx.reply(
      `<b>${lang === 'uk' ? '🔔 Твої підписки' : '🔔 Your Subscriptions'}</b>\n\n${lines.join('\n')}\n\n${lang === 'uk' ? 'Використай /subscribe щоб змінити.' : 'Use /subscribe to change.'}`,
      { parse_mode: 'HTML' }
    );
  });

  // Callback: toggle subscription or paginate
  bot.on('callback_query:data', async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    if (!data.startsWith('sub:')) return next();

    if (data.startsWith('sub:toggle:')) {
      const slug = data.replace('sub:toggle:', '');
      const nowSubscribed = toggleSubscription(ctx.from.id, slug);
      const lang = ctx.lang;
      const entry = ctx.courseData.topicBySlug[slug];
      const name = entry ? (entry.topic.title[lang]) : slug;
      await ctx.answerCallbackQuery({
        text: nowSubscribed
          ? (lang === 'uk' ? `✅ Підписано: ${name}` : `✅ Subscribed: ${name}`)
          : (lang === 'uk' ? `❌ Відписано: ${name}` : `❌ Unsubscribed: ${name}`),
      });
      // Refresh the menu
      const page = parseInt(data.split(':')[3]) || 0;
      await sendSubscribeMenu(ctx, 0, true);
    } else if (data.startsWith('sub:page:')) {
      const page = parseInt(data.split(':')[2]) || 0;
      await sendSubscribeMenu(ctx, page, true);
      await ctx.answerCallbackQuery();
    } else {
      await ctx.answerCallbackQuery();
    }
  });
};

async function sendSubscribeMenu(ctx, page, edit = false) {
  const lang = ctx.lang;
  const courseData = ctx.courseData;
  const userSubs = getUserSubscriptions(ctx.from.id);
  const allTopics = courseData.allTopicsFlat;

  const pageSize = 8;
  const offset = page * pageSize;
  const slice = allTopics.slice(offset, offset + pageSize);
  const hasMore = offset + pageSize < allTopics.length;

  const text = lang === 'uk'
    ? `<b>🔔 Підписки на теми</b> (стор. ${page + 1})\n\nОбери теми, про які хочеш отримувати сповіщення:`
    : `<b>🔔 Topic Subscriptions</b> (page ${page + 1})\n\nSelect topics to receive notifications about:`;

  const kb = new InlineKeyboard();
  slice.forEach(topic => {
    const isSubbed = userSubs.includes(topic.slug);
    const label = `${isSubbed ? '🔔 ' : '  '}${topic.levelEmoji} ${topic.title[lang]}`;
    kb.text(label, `sub:toggle:${topic.slug}`).row();
  });

  if (page > 0) kb.text('← Prev', `sub:page:${page - 1}`);
  if (hasMore) kb.text('Next →', `sub:page:${page + 1}`);

  if (edit && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}
