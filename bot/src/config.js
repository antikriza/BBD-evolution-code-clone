require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  COURSE_BASE_URL: process.env.COURSE_BASE_URL || 'https://antikriza.github.io/BBD-evolution-code-clone/telegram-archive/course',
  COURSE_DATA_PATH: process.env.COURSE_DATA_PATH || require('path').join(__dirname, '..', 'data', 'course-data.json'),
  MYSQL_HOST: process.env.MYSQL_HOST,
  MYSQL_DATABASE: process.env.MYSQL_DATABASE,
  MYSQL_USER: process.env.MYSQL_USER,
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
  ADMIN_IDS: (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean),
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',
  ADMIN_PORT: parseInt(process.env.ADMIN_PORT) || 3000,
  WELCOME_THREAD_ID: parseInt(process.env.WELCOME_THREAD_ID) || 20,
  GROUP_CHAT_ID: process.env.GROUP_CHAT_ID || '',
};
