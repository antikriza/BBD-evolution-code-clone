const { InlineKeyboard } = require('grammy');
const config = require('../config');
const { startOnboarding } = require('./onboarding');

module.exports = function (bot) {
  bot.command('start', async (ctx) => {
    // In private chat, check if user needs onboarding first
    if (ctx.chat.type === 'private') {
      const started = await startOnboarding(ctx);
      if (started) return; // Onboarding in progress
    }

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
    const isAdmin = config.ADMIN_IDS.includes(ctx.from?.id);

    const adminBlockEn = isAdmin ? `

<b>Moderation (Group)</b>
/warn — Warn user (reply to message)
/mute [min] — Mute user (default 60 min)
/unmute — Unmute user
/ban — Ban user
/warnings — Show user warnings
/clearwarnings — Reset warnings

<b>Admin</b>
/admin — Admin panel
/stats — Bot statistics
/broadcast — Send broadcast
/schedule — Upcoming scheduled messages

<b>Content Admin</b>
/assign — Create homework assignment
/poll — Create group poll` : '';

    const adminBlockUk = isAdmin ? `

<b>Модерація (Група)</b>
/warn — Попередити (у відповідь)
/mute [хв] — Замутити (за замовч. 60 хв)
/unmute — Розмутити
/ban — Забанити
/warnings — Показати попередження
/clearwarnings — Скинути попередження

<b>Адмін</b>
/admin — Панель адміна
/stats — Статистика бота
/broadcast — Розсилка
/schedule — Заплановані повідомлення

<b>Контент-адмін</b>
/assign — Створити домашнє завдання
/poll — Створити опитування` : '';

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

<b>XP & Progress</b>
/xp — Your XP and level
/leaderboard — Top 10 leaderboard

<b>Homework</b>
/homework — Your assignments
/complete &lt;topic&gt; — Complete a topic quiz

<b>Contests</b>
/contest — Active contests
/submit — Submit challenge entry (DM)

<b>Community</b>
/rules — Group rules
/links — Useful links
/faq — Frequently asked questions
/search &lt;keyword&gt; — Search course content

<b>Settings</b>
/lang — Switch language (EN/UK)
/help — This message${adminBlockEn}`,
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

<b>XP & Прогрес</b>
/xp — Твій XP та рівень
/leaderboard — Топ-10 рейтинг

<b>Домашні завдання</b>
/homework — Твої завдання
/complete &lt;тема&gt; — Пройти тест по темі

<b>Конкурси</b>
/contest — Активні конкурси
/submit — Надіслати роботу (в ЛС)

<b>Спільнота</b>
/rules — Правила групи
/links — Корисні посилання
/faq — Часті запитання
/search &lt;ключове слово&gt; — Пошук по курсу

<b>Налаштування</b>
/lang — Змінити мову (EN/UK)
/help — Це повідомлення${adminBlockUk}`,
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
