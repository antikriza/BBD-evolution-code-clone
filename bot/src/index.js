const { Bot } = require('grammy');
const config = require('./config');
const { loadCourseData } = require('./data/loader');

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

// DB user profile middleware
const { ensureUser, getUser } = require('./db/users');
bot.use((ctx, next) => {
  const userId = ctx.from?.id;
  if (userId) {
    ensureUser(userId, ctx.from.username, ctx.from.first_name, ctx.lang);
    ctx.userProfile = getUser(userId);
  }
  return next();
});

// Group commands -> DM redirect
const { groupDmMiddleware } = require('./middleware/group-dm');
groupDmMiddleware(bot);

// Register handlers (onboarding first to catch /start with onboard param + text input)
require('./handlers/onboarding')(bot);
require('./handlers/start')(bot);
require('./handlers/course')(bot);
require('./handlers/glossary')(bot);
require('./handlers/quiz')(bot);
require('./handlers/random')(bot);
require('./handlers/community')(bot);
require('./handlers/search')(bot);
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
    { command: 'lang', description: 'Switch language' },
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

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err.message);
});

// Start
async function main() {
  await setCommands();
  console.log('Bot starting...');
  bot.start();
}

main();
