require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  APP_URL: process.env.APP_URL || '',
};
