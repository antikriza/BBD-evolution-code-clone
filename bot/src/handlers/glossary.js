const { InlineKeyboard } = require('grammy');
const { escHtml } = require('../utils/format');

module.exports = function (bot) {
  bot.command('glossary', async (ctx) => {
    const query = ctx.match?.trim().toLowerCase();
    const lang = ctx.lang;
    const data = ctx.courseData;

    if (!query) {
      return ctx.reply(lang === 'uk' ? 'Вкажіть термін: /glossary transformer' : 'Specify a term: /glossary transformer');
    }

    const matches = data.allKeyTerms[lang].filter(kt =>
      kt.term.toLowerCase().includes(query) || kt.def.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      return ctx.reply(lang === 'uk' ? `Термін "${query}" не знайдено.` : `Term "${query}" not found.`);
    }

    const shown = matches.slice(0, 8);
    const text = shown.map(kt =>
      `<b>${escHtml(kt.term)}</b>\n${escHtml(kt.def)}\n<i>— ${escHtml(kt.topicTitle)} (Level ${kt.levelNum})</i>`
    ).join('\n\n');

    const footer = matches.length > 8
      ? `\n\n<i>${lang === 'uk' ? `...та ще ${matches.length - 8}` : `...and ${matches.length - 8} more`}</i>`
      : '';

    await ctx.reply(text + footer, { parse_mode: 'HTML' });
  });
};
