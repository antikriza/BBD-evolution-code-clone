const { InlineKeyboard } = require('grammy');
const { searchCourse } = require('../data/search');
const { escHtml } = require('../utils/format');

module.exports = function (bot) {
  bot.command('search', async (ctx) => {
    const query = ctx.match?.trim();
    const lang = ctx.lang;

    if (!query) {
      return ctx.reply(lang === 'uk' ? 'Вкажіть пошуковий запит: /search AI' : 'Specify a search query: /search AI');
    }

    const results = searchCourse(query, ctx.courseData, lang);

    if (results.length === 0) {
      return ctx.reply(lang === 'uk' ? `Нічого не знайдено за запитом "${query}".` : `No results found for "${query}".`);
    }

    const header = lang === 'uk'
      ? `🔍 <b>Результати пошуку:</b> "${escHtml(query)}"`
      : `🔍 <b>Search results:</b> "${escHtml(query)}"`;

    const list = results.map((r, i) => {
      const t = r.topic;
      return `${i + 1}. ${t.levelEmoji} <b>${escHtml(t.title[lang])}</b>\n   <i>${escHtml(t.desc[lang]).substring(0, 100)}</i>`;
    }).join('\n\n');

    const kb = new InlineKeyboard();
    results.forEach(r => {
      kb.text(r.topic.title[lang], `topic:${r.topic.slug}`).row();
    });

    await ctx.reply(`${header}\n\n${list}`, { parse_mode: 'HTML', reply_markup: kb });
  });
};
