const { Bot } = require('grammy');
const config = require('./config');
const { loadCourseData } = require('./data/loader');
const { initMySQL, syncFromSQLite } = require('./db/mysql');

if (!config.BOT_TOKEN) {
  console.error('BOT_TOKEN is required. Set it in .env file.');
  process.exit(1);
}

const courseData = loadCourseData();
const bot = new Bot(config.BOT_TOKEN);

// Language middleware (file-based per-user persistence)
const { languageMiddleware } = require('./middleware/language');
bot.use(languageMiddleware);

// Attach course data to context
bot.use((ctx, next) => {
  ctx.courseData = courseData;
  return next();
});

// Group message logger (must be before group-dm to capture all messages)
require('./handlers/group-logger')(bot);

// DB user profile middleware
const { ensureUser, getUser } = require('./db/users');
const { getDailyXpCount: getDailyXp, awardXp: giveXp } = require('./db/xp');

bot.use((ctx, next) => {
  const userId = ctx.from?.id;
  if (userId) {
    ensureUser(userId, ctx.from.username, ctx.from.first_name, ctx.lang);
    ctx.userProfile = getUser(userId);
    // Daily activity XP (5 XP, once per day)
    if (ctx.userProfile && ctx.userProfile.onboarding_complete) {
      const dailyActivity = getDailyXp(userId, 'daily');
      if (dailyActivity === 0) {
        giveXp(userId, 5, 'daily');
      }
    }
  }
  return next();
});

// Group commands -> DM redirect
const { groupDmMiddleware } = require('./middleware/group-dm');
groupDmMiddleware(bot);

// Admin handlers (before other handlers to catch /admin callbacks first)
require('./handlers/admin')(bot);

// Register handlers (onboarding first to catch /start with onboard param + text input)
require('./handlers/onboarding')(bot);
require('./handlers/start')(bot);
require('./handlers/course')(bot);
require('./handlers/glossary')(bot);
require('./handlers/quiz')(bot);
require('./handlers/random')(bot);
require('./handlers/community')(bot);
require('./handlers/search')(bot);
require('./handlers/subscribe')(bot);
require('./handlers/homework')(bot);
require('./handlers/contests')(bot);
require('./handlers/xp')(bot);
require('./handlers/moderation')(bot);
require('./handlers/callbacks')(bot);

// Set bot commands
async function setCommands() {
  const enCommands = [
    { command: 'start', description: 'Welcome message' },
    { command: 'help', description: 'List all commands' },
    { command: 'course', description: 'Course overview' },
    { command: 'level', description: 'Topics by level (1-5)' },
    { command: 'topic', description: 'Topic details' },
    { command: 'glossary', description: 'Look up a term' },
    { command: 'quiz', description: 'Random quiz question' },
    { command: 'random', description: 'Random tip or fact' },
    { command: 'today', description: 'Topic of the day' },
    { command: 'rules', description: 'Group rules' },
    { command: 'links', description: 'Useful links' },
    { command: 'faq', description: 'FAQ' },
    { command: 'search', description: 'Search course content' },
    { command: 'subscribe', description: 'Subscribe to topics' },
    { command: 'mysubs', description: 'My subscriptions' },
    { command: 'lang', description: 'Switch language' },
    { command: 'xp', description: 'Your XP and level' },
    { command: 'leaderboard', description: 'Top 10 leaderboard' },
    { command: 'homework', description: 'Your homework assignments' },
    { command: 'contest', description: 'Active contests' },
  ];

  const ukCommands = [
    { command: 'start', description: 'Привітання' },
    { command: 'help', description: 'Список команд' },
    { command: 'course', description: 'Огляд курсу' },
    { command: 'level', description: 'Теми за рівнем (1-5)' },
    { command: 'topic', description: 'Деталі теми' },
    { command: 'glossary', description: 'Пошук терміну' },
    { command: 'quiz', description: 'Випадкове запитання' },
    { command: 'random', description: 'Випадкова порада чи факт' },
    { command: 'today', description: 'Тема дня' },
    { command: 'rules', description: 'Правила групи' },
    { command: 'links', description: 'Корисні посилання' },
    { command: 'faq', description: 'Часті запитання' },
    { command: 'search', description: 'Пошук по курсу' },
    { command: 'subscribe', description: 'Підписка на теми' },
    { command: 'mysubs', description: 'Мої підписки' },
    { command: 'lang', description: 'Змінити мову' },
    { command: 'xp', description: 'Твій XP та рівень' },
    { command: 'leaderboard', description: 'Топ-10 рейтинг' },
    { command: 'homework', description: 'Домашні завдання' },
    { command: 'contest', description: 'Активні конкурси' },
  ];

  try {
    await bot.api.setMyCommands(enCommands);
    await bot.api.setMyCommands(ukCommands, { language_code: 'uk' });
    console.log('Bot commands set.');
  } catch (err) {
    console.error('Failed to set commands:', err.message);
  }
}

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err.message);
});

// Start
async function main() {
  // Initialize MySQL and sync existing users
  const mysqlReady = await initMySQL();
  if (mysqlReady) {
    const sqliteDb = require('./db/init');
    await syncFromSQLite(sqliteDb);
  }

  await setCommands();
  console.log('Bot starting...');
  bot.start();

  // Admin dashboard HTTP server
  const { createServer } = require('./server');
  const app = createServer(bot, courseData);
  const PORT = config.ADMIN_PORT;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Admin dashboard on port ${PORT}`);
  });

  // Background scheduler for scheduled messages
  const { startScheduler } = require('./scheduler');
  startScheduler(bot);
}

main();
