const { InlineKeyboard } = require('grammy');
const { escHtml } = require('../utils/format');
const config = require('../config');

module.exports = function (bot) {
  bot.command('random', async (ctx) => {
    await sendRandom(ctx);
  });

  bot.command('today', async (ctx) => {
    const lang = ctx.lang;
    const data = ctx.courseData;
    const topics = data.allTopicsFlat;

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((now - startOfYear) / 86400000);
    const topic = topics[dayOfYear % topics.length];
    const level = data.raw.levels[topic.levelNum - 1];

    const header = lang === 'uk' ? '📅 <b>Тема дня</b>' : '📅 <b>Topic of the Day</b>';
    const date = now.toISOString().split('T')[0];

    const parts = [
      header,
      `<i>${date}</i>`,
      '',
      `${topic.levelEmoji} <b>${escHtml(topic.title[lang])}</b>`,
      `<i>Level ${topic.levelNum}: ${escHtml(level.title[lang])}</i>`,
      '',
      escHtml(topic.desc[lang]),
    ];

    if (topic.overview && topic.overview[lang] && topic.overview[lang][0]) {
      parts.push('', escHtml(topic.overview[lang][0]).substring(0, 400));
    }

    const miniAppUrl = `${config.COURSE_BASE_URL}/twa/index.html#/level/${topic.levelNum}/${topic.slug}`;
    const kb = new InlineKeyboard()
      .url(lang === 'uk' ? 'Повний урок' : 'Full Lesson', miniAppUrl);

    await ctx.reply(parts.join('\n'), { parse_mode: 'HTML', reply_markup: kb });
  });
};

async function sendRandom(ctx) {
  const lang = ctx.lang;
  const data = ctx.courseData;

  const useTip = Math.random() < 0.5;

  if (useTip && data.allTips[lang].length > 0) {
    const tip = data.allTips[lang][Math.floor(Math.random() * data.allTips[lang].length)];
    const header = lang === 'uk' ? '💡 <b>Порада</b>' : '💡 <b>Tip</b>';
    const text = `${header}\n\n${escHtml(tip.tip)}\n\n<i>— ${escHtml(tip.topicTitle)} (Level ${tip.levelNum})</i>`;

    const kb = new InlineKeyboard()
      .text(lang === 'uk' ? '🔄 Ще' : '🔄 Another', 'random:next')
      .text(lang === 'uk' ? '📖 Тема' : '📖 Topic', `topic:${tip.topicSlug}`);

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  } else {
    const topics = data.allTopicsFlat;
    const topic = topics[Math.floor(Math.random() * topics.length)];

    if (topic.details && topic.details[lang] && topic.details[lang].length > 0) {
      const detail = topic.details[lang][Math.floor(Math.random() * topic.details[lang].length)];
      const header = lang === 'uk' ? '🎲 <b>Факт</b>' : '🎲 <b>Fact</b>';
      const text = `${header}\n\n<b>${escHtml(detail.text)}</b>\n${escHtml(detail.desc)}\n\n<i>— ${escHtml(topic.title[lang])}</i>`;

      const kb = new InlineKeyboard()
        .text(lang === 'uk' ? '🔄 Ще' : '🔄 Another', 'random:next')
        .text(lang === 'uk' ? '📖 Тема' : '📖 Topic', `topic:${topic.slug}`);

      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      // Fallback to tip
      const tip = data.allTips[lang][Math.floor(Math.random() * data.allTips[lang].length)];
      const text = `💡 ${escHtml(tip.tip)}\n\n<i>— ${escHtml(tip.topicTitle)}</i>`;
      await ctx.reply(text, { parse_mode: 'HTML' });
    }
  }
}

module.exports.sendRandom = sendRandom;
