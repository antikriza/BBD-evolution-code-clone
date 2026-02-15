const { InlineKeyboard } = require('grammy');
const { escHtml, topicCard } = require('../utils/format');
const config = require('../config');

module.exports = function (bot) {
  bot.command('course', async (ctx) => {
    const lang = ctx.lang;
    const data = ctx.courseData;
    const totalTopics = data.allTopicsFlat.length;

    const title = lang === 'uk' ? 'Курс з ШІ та програмування' : 'AI & Programming Course';
    const subtitle = lang === 'uk'
      ? `${totalTopics} тем на ${data.raw.levels.length} рівнях`
      : `${totalTopics} topics across ${data.raw.levels.length} levels`;

    const kb = new InlineKeyboard();
    data.raw.levels.forEach(level => {
      kb.text(`${level.emoji} ${level.title[lang]} (${level.topics.length})`, `level:${level.num}`).row();
    });

    await ctx.reply(`<b>${escHtml(title)}</b>\n${escHtml(subtitle)}\n\n${lang === 'uk' ? 'Оберіть рівень:' : 'Select a level:'}`, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  });

  bot.command('level', async (ctx) => {
    const arg = ctx.match?.trim();
    const num = parseInt(arg);
    if (!num || num < 1 || num > 5) {
      return ctx.reply(ctx.lang === 'uk' ? 'Вкажіть рівень від 1 до 5: /level 1' : 'Specify a level from 1 to 5: /level 1');
    }
    await showLevel(ctx, num);
  });

  bot.command('topic', async (ctx) => {
    const query = ctx.match?.trim().toLowerCase();
    if (!query) {
      return ctx.reply(ctx.lang === 'uk' ? 'Вкажіть назву теми: /topic generative-ai' : 'Specify a topic name: /topic generative-ai');
    }

    const data = ctx.courseData;
    const lang = ctx.lang;

    // Try exact slug match
    let found = data.topicBySlug[query];

    // Try partial match on slug or title
    if (!found) {
      const entry = Object.entries(data.topicBySlug).find(([slug, { topic }]) =>
        slug.includes(query) || topic.title[lang]?.toLowerCase().includes(query) || topic.title.en?.toLowerCase().includes(query)
      );
      if (entry) found = entry[1];
    }

    if (!found) {
      return ctx.reply(ctx.lang === 'uk' ? `Тему "${query}" не знайдено. Спробуйте /search ${query}` : `Topic "${query}" not found. Try /search ${query}`);
    }

    await showTopic(ctx, found.topic, found.level);
  });
};

async function showLevel(ctx, num) {
  const data = ctx.courseData;
  const lang = ctx.lang;
  const level = data.raw.levels[num - 1];
  if (!level) return;

  const text = `${level.emoji} <b>Level ${level.num}: ${escHtml(level.title[lang])}</b>\n${escHtml(level.desc[lang])}\n\n${lang === 'uk' ? 'Оберіть тему:' : 'Select a topic:'}`;

  const kb = new InlineKeyboard();
  level.topics.forEach((topic, i) => {
    kb.text(topic.title[lang], `topic:${topic.slug}`);
    if (i % 2 === 1) kb.row();
  });
  if (level.topics.length % 2 === 1) kb.row();
  kb.text(lang === 'uk' ? '← Назад до курсу' : '← Back to course', 'back:course');

  const msgOpts = { parse_mode: 'HTML', reply_markup: kb };

  if (ctx.callbackQuery) {
    try { await ctx.editMessageText(text, msgOpts); } catch (e) { /* message not modified */ }
  } else {
    await ctx.reply(text, msgOpts);
  }
}

async function showTopic(ctx, topic, level) {
  const lang = ctx.lang;
  const card = topicCard(topic, level, lang);

  const miniAppUrl = `${config.COURSE_BASE_URL}/twa/index.html#/level/${level.num}/${topic.slug}`;

  const kb = new InlineKeyboard()
    .url(lang === 'uk' ? 'Повний урок' : 'Full Lesson', miniAppUrl)
    .row()
    .text(lang === 'uk' ? 'Терміни' : 'Key Terms', `terms:${topic.slug}`)
    .text(lang === 'uk' ? 'Поради' : 'Tips', `tips:${topic.slug}`)
    .row()
    .text(lang === 'uk' ? '← Назад до рівня' : '← Back to level', `level:${level.num}`);

  const msgOpts = { parse_mode: 'HTML', reply_markup: kb };

  if (ctx.callbackQuery) {
    try { await ctx.editMessageText(card, msgOpts); } catch (e) { /* message not modified */ }
  } else {
    await ctx.reply(card, msgOpts);
  }
}

// Export for callback handler
module.exports.showLevel = showLevel;
module.exports.showTopic = showTopic;
