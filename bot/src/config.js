require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  COURSE_BASE_URL: process.env.COURSE_BASE_URL || 'https://antikriza.github.io/BBD-evolution-code-clone/telegram-archive/course',
  COURSE_DATA_PATH: process.env.COURSE_DATA_PATH || require('path').join(__dirname, '..', 'data', 'course-data.json'),
};
