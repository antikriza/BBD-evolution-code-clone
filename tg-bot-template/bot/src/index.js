const { Bot, InlineKeyboard } = require('grammy');
const config = require('./config');
const { escHtml } = require('./utils/format');

// ─── Startup ────────────────────────────────────────────────────────
if (!config.BOT_TOKEN) {
  console.error('BOT_TOKEN is required. Set it in .env file.');
  process.exit(1);
}

const bot = new Bot(config.BOT_TOKEN);

// ─── Middleware 1: Language ─────────────────────────────────────────
// Detects user language from Telegram, persists per-user, sets ctx.lang
const { languageMiddleware, setUserLang } = require('./middleware/language');
bot.use(languageMiddleware);

// ─── Middleware 2: Database ─────────────────────────────────────────
// Creates/updates user in SQLite on every interaction, sets ctx.userProfile
const { ensureUser, getUser } = require('./db/users');
bot.use((ctx, next) => {
  const userId = ctx.from?.id;
  if (userId) {
    ensureUser(userId, ctx.from.username, ctx.from.first_name, ctx.lang);
    ctx.userProfile = getUser(userId);
  }
  return next();
});

// ─── Middleware 3: Group → DM Redirect ──────────────────────────────
// When a user sends a command in a group, the bot:
//   1. Deletes the command from group
//   2. Sends the response to user's DM instead
//   3. Posts a brief "check your DM" note (auto-deletes in 5s)
// To DISABLE this, comment out the two lines below:
const { groupDmMiddleware } = require('./middleware/group-dm');
groupDmMiddleware(bot);

// ─── Commands ───────────────────────────────────────────────────────

// /start — Welcome message
bot.command('start', async (ctx) => {
  const lang = ctx.lang;

  const text = lang === 'uk'
    ? '<b>Welcome!</b>\n\nЦе шаблон Telegram-бота.\nВикористовуйте /help для переліку команд.'
    : '<b>Welcome!</b>\n\nThis is a Telegram bot template.\nUse /help to see all commands.';

  const kb = new InlineKeyboard()
    .text('🇬🇧 EN', 'lang:en')
    .text('🇺🇦 UK', 'lang:uk');

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
});

// /help — Command list
bot.command('help', async (ctx) => {
  const lang = ctx.lang;

  const text = lang === 'uk'
    ? `<b>Команди:</b>\n\n/start — Привітання\n/help — Цей список\n/ping — Перевірка бота\n/lang — Змінити мову`
    : `<b>Commands:</b>\n\n/start — Welcome message\n/help — This list\n/ping — Check if bot is alive\n/lang — Switch language`;

  await ctx.reply(text, { parse_mode: 'HTML' });
});

// /ping — Simple health check
bot.command('ping', async (ctx) => {
  const { getUserCount } = require('./db/users');
  const count = getUserCount();
  const lang = ctx.lang;

  const text = lang === 'uk'
    ? `Pong! Bot працює.\nКористувачів: <b>${count}</b>`
    : `Pong! Bot is running.\nUsers: <b>${count}</b>`;

  await ctx.reply(text, { parse_mode: 'HTML' });
});

// /lang — Language switcher
bot.command('lang', async (ctx) => {
  const kb = new InlineKeyboard()
    .text('🇬🇧 English', 'lang:en')
    .text('🇺🇦 Українська', 'lang:uk');

  await ctx.reply('Select language / Оберіть мову:', { reply_markup: kb });
});

// ─── Callback Router ────────────────────────────────────────────────
// All inline keyboard button presses arrive here.
// Convention: callback data uses "prefix:value" format.
// IMPORTANT: check more specific prefixes first (e.g. "quiz:next" before "quiz:")

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;

  try {
    // Language switching
    if (data.startsWith('lang:')) {
      const newLang = data.split(':')[1];
      if (ctx.from?.id) setUserLang(ctx.from.id, newLang);
      ctx.lang = newLang;
      const msg = newLang === 'uk' ? '🇺🇦 Мову змінено на українську' : '🇬🇧 Language set to English';
      await ctx.answerCallbackQuery({ text: msg });
      try { await ctx.editMessageText(msg); } catch (e) {}

    // ── Add your callback handlers here ──
    // Example:
    // } else if (data.startsWith('action:')) {
    //   const value = data.split(':')[1];
    //   await ctx.reply(`You selected: ${value}`);
    //   await ctx.answerCallbackQuery();

    } else {
      await ctx.answerCallbackQuery();
    }
  } catch (err) {
    console.error('Callback error:', err.message);
    try { await ctx.answerCallbackQuery(); } catch (e) {}
  }
});

// ─── Command Menu ───────────────────────────────────────────────────
async function setCommands() {
  const enCommands = [
    { command: 'start', description: 'Welcome message' },
    { command: 'help', description: 'List all commands' },
    { command: 'ping', description: 'Check bot status' },
    { command: 'lang', description: 'Switch language' },
  ];

  const ukCommands = [
    { command: 'start', description: 'Привітання' },
    { command: 'help', description: 'Список команд' },
    { command: 'ping', description: 'Статус бота' },
    { command: 'lang', description: 'Змінити мову' },
  ];

  try {
    await bot.api.setMyCommands(enCommands);
    await bot.api.setMyCommands(ukCommands, { language_code: 'uk' });
    console.log('Bot commands set.');
  } catch (err) {
    console.error('Failed to set commands:', err.message);
  }
}

// ─── Error Handler ──────────────────────────────────────────────────
bot.catch((err) => {
  console.error('Bot error:', err.message);
});

// ─── Start ──────────────────────────────────────────────────────────
async function main() {
  await setCommands();
  console.log('Bot starting...');
  bot.start();
}

main();
