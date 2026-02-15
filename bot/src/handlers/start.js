const { InlineKeyboard } = require('grammy');
const config = require('../config');

module.exports = function (bot) {
  bot.command('start', async (ctx) => {
    const lang = ctx.lang;
    const texts = {
      en: {
        welcome: 'Welcome to <b>PM AI Club</b> Bot!',
        desc: 'AI & Programming Course — 42 topics across 5 levels.\nMentor: Oleksandr Selivanskyi (@selivansky)',
        hint: 'Use /help to see all commands.',
      },
      uk: {
        welcome: 'Ласкаво просимо до боту <b>PM AI Club</b>!',
        desc: 'Курс з ШІ та програмування — 42 теми на 5 рівнях.\nМентор: Олександр Селіванський (@selivansky)',
        hint: 'Використовуйте /help для переліку команд.',
      },
    };
    const t = texts[lang] || texts.en;

    const kb = new InlineKeyboard()
      .url('Open Course', `${config.COURSE_BASE_URL}/twa/index.html`)
      .row()
      .text('🇬🇧 EN', 'lang:en')
      .text('🇺🇦 UK', 'lang:uk');

    await ctx.reply(`${t.welcome}\n\n${t.desc}\n\n${t.hint}`, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.command('help', async (ctx) => {
    const lang = ctx.lang;
    const texts = {
      en: `<b>Available Commands:</b>

<b>Course Navigation</b>
/course — Course overview with levels
/level &lt;1-5&gt; — Topics for a specific level
/topic &lt;name&gt; — Topic details
/glossary &lt;term&gt; — Look up a key term

<b>Interactive</b>
/quiz — Random quiz question
/random — Random tip or fact
/today — Topic of the day

<b>Community</b>
/rules — Group rules
/links — Useful links
/faq — Frequently asked questions
/search &lt;keyword&gt; — Search course content

<b>Settings</b>
/lang — Switch language (EN/UK)
/help — This message`,
      uk: `<b>Доступні команди:</b>

<b>Навігація курсом</b>
/course — Огляд курсу з рівнями
/level &lt;1-5&gt; — Теми певного рівня
/topic &lt;назва&gt; — Деталі теми
/glossary &lt;термін&gt; — Пошук терміну

<b>Інтерактив</b>
/quiz — Випадкове запитання
/random — Випадкова порада чи факт
/today — Тема дня

<b>Спільнота</b>
/rules — Правила групи
/links — Корисні посилання
/faq — Часті запитання
/search &lt;ключове слово&gt; — Пошук по курсу

<b>Налаштування</b>
/lang — Змінити мову (EN/UK)
/help — Це повідомлення`,
    };

    await ctx.reply(texts[lang] || texts.en, { parse_mode: 'HTML' });
  });

  bot.command('lang', async (ctx) => {
    const kb = new InlineKeyboard()
      .text('🇬🇧 English', 'lang:en')
      .text('🇺🇦 Українська', 'lang:uk');

    await ctx.reply('Select language / Оберіть мову:', { reply_markup: kb });
  });
};
