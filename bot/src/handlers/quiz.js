const { InlineKeyboard } = require('grammy');
const { generateQuiz } = require('../data/quiz-generator');
const { escHtml } = require('../utils/format');

// Store active quizzes: messageId -> { correctIndex, explanation }
const activeQuizzes = new Map();

module.exports = function (bot) {
  bot.command('quiz', async (ctx) => {
    await sendQuiz(ctx);
  });
};

async function sendQuiz(ctx) {
  const lang = ctx.lang;
  const q = generateQuiz(ctx.courseData, lang);

  if (!q) {
    return ctx.reply(lang === 'uk' ? 'Не вдалося створити запитання.' : 'Could not generate a question.');
  }

  const kb = new InlineKeyboard();
  q.options.forEach((opt, i) => {
    kb.text(opt, `quiz:${i}`);
    if (i < q.options.length - 1) kb.row();
  });

  const header = lang === 'uk' ? '🧠 <b>Квіз</b>' : '🧠 <b>Quiz</b>';
  const msg = await ctx.reply(`${header}\n\n${q.question}`, { parse_mode: 'HTML', reply_markup: kb });

  activeQuizzes.set(`${msg.chat.id}:${msg.message_id}`, {
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    options: q.options,
    lang,
  });
}

module.exports.activeQuizzes = activeQuizzes;
module.exports.sendQuiz = sendQuiz;
