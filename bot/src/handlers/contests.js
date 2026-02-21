const { InlineKeyboard } = require('grammy');
const config = require('../config');
const {
  createContest, getContest, getActiveContests, setContestStatus,
  addEntry, getUserEntry, getEntries, addVote, hasVoted, getVoteCounts,
  getContestResults,
} = require('../db/contests');
const { awardXp } = require('../db/xp');
const { escHtml } = require('../utils/format');
const { generateQuiz } = require('../data/quiz-generator');

// Active quiz contest state: contestId -> { questions, currentQ, scores: {userId: score}, chatId, questionMsgId }
const activeQuizContests = new Map();

module.exports = function (bot) {

  // ── /poll Question? | Option A | Option B | Option C ──
  bot.command('poll', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !config.ADMIN_IDS.includes(userId)) {
      return ctx.reply('⛔ Admin only.');
    }

    const args = (ctx.match || '').trim();
    const parts = args.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length < 3) {
      return ctx.reply('❌ Format: /poll Question? | Option A | Option B | Option C');
    }

    const question = parts[0];
    const options = parts.slice(1);

    const contestId = createContest('poll', question, null, { options }, null, { participate: 5 }, userId);
    setContestStatus(contestId, 'active');

    const kb = new InlineKeyboard();
    options.forEach((opt, i) => {
      kb.text(opt, `poll:${contestId}:${i}`);
      if (i < options.length - 1) kb.row();
    });

    await ctx.reply(`📊 <b>Poll:</b> ${escHtml(question)}`, { parse_mode: 'HTML', reply_markup: kb });
  });

  // Poll vote callback
  bot.on('callback_query:data', async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    if (!data.startsWith('poll:')) return next();

    const [, contestIdStr, optionStr] = data.split(':');
    const contestId = parseInt(contestIdStr);
    const optionIndex = parseInt(optionStr);
    const userId = ctx.from.id;

    const contest = getContest(contestId);
    if (!contest || contest.status !== 'active') {
      return ctx.answerCallbackQuery({ text: 'Poll is closed.', show_alert: true });
    }

    const existing = getUserEntry(contestId, userId);
    if (existing) {
      return ctx.answerCallbackQuery({ text: 'You already voted!', show_alert: true });
    }

    const options = contest.parsedConfig?.options || [];
    const optionText = options[optionIndex] || `Option ${optionIndex + 1}`;

    addEntry(contestId, userId, optionText, null, 0);
    awardXp(userId, contest.xp_participate, 'poll', `contest:${contestId}`);

    await ctx.answerCallbackQuery({ text: `Voted: ${optionText} (+${contest.xp_participate} XP)` });
  });

  // ── /contest — show active contests ──
  bot.command('contest', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const lang = ctx.lang;
    const args = (ctx.match || '').trim();

    // Admin: /contest quiz 5
    if (args.startsWith('quiz') && config.ADMIN_IDS.includes(userId)) {
      return startQuizContest(ctx, bot, args);
    }

    const contests = getActiveContests();
    if (contests.length === 0) {
      return ctx.reply(lang === 'uk' ? '🎯 Немає активних конкурсів.' : '🎯 No active contests.');
    }

    let text = lang === 'uk' ? '<b>🎯 Активні конкурси:</b>\n\n' : '<b>🎯 Active Contests:</b>\n\n';
    for (const c of contests) {
      const typeIcon = c.type === 'quiz' ? '🧠' : c.type === 'poll' ? '📊' : '🏆';
      text += `${typeIcon} <b>${escHtml(c.title)}</b>\n`;
      text += `Type: ${c.type} | Status: ${c.status}`;
      if (c.deadline) text += ` | Deadline: ${c.deadline}`;
      text += '\n\n';
    }
    await ctx.reply(text, { parse_mode: 'HTML' });
  });

  // ── Quiz contest: /contest quiz N ──
  async function startQuizContest(ctx, bot, args) {
    const match = args.match(/quiz\s+(\d+)/);
    const count = match ? Math.min(parseInt(match[1]), 10) : 5;
    const lang = ctx.lang;

    const questions = [];
    for (let i = 0; i < count; i++) {
      const q = generateQuiz(ctx.courseData, lang);
      if (q) questions.push(q);
    }

    if (questions.length === 0) {
      return ctx.reply('❌ Could not generate quiz questions.');
    }

    const contestId = createContest('quiz', `Quiz Contest (${questions.length}Q)`, null,
      { questionCount: questions.length, timePerQuestion: 30 }, null, {}, ctx.from.id);
    setContestStatus(contestId, 'active');

    const state = {
      questions,
      currentQ: 0,
      scores: {},
      chatId: ctx.chat.id,
      questionMsgId: null,
      contestId,
      lang,
      answered: new Set(),
    };
    activeQuizContests.set(contestId, state);

    await ctx.reply(lang === 'uk'
      ? `🧠 <b>Квіз-конкурс починається!</b> ${questions.length} запитань, 30с на кожне.`
      : `🧠 <b>Quiz Contest starts!</b> ${questions.length} questions, 30s each.`
    , { parse_mode: 'HTML' });

    // Send first question after a short delay
    setTimeout(() => postQuizQuestion(bot, contestId), 2000);
  }

  async function postQuizQuestion(bot, contestId) {
    const state = activeQuizContests.get(contestId);
    if (!state) return;

    const q = state.questions[state.currentQ];
    const qNum = state.currentQ + 1;
    const total = state.questions.length;
    state.answered = new Set();

    const kb = new InlineKeyboard();
    q.options.forEach((opt, i) => {
      kb.text(opt, `cquiz:${contestId}:${state.currentQ}:${i}`);
      if (i < q.options.length - 1) kb.row();
    });

    const header = state.lang === 'uk'
      ? `❓ <b>Запитання ${qNum}/${total}</b>`
      : `❓ <b>Question ${qNum}/${total}</b>`;

    try {
      const msg = await bot.api.sendMessage(state.chatId, `${header}\n\n${q.question}`, {
        parse_mode: 'HTML', reply_markup: kb
      });
      state.questionMsgId = msg.message_id;
    } catch (e) {
      console.error('Failed to post quiz question:', e.message);
    }

    // Auto-advance after 30s
    setTimeout(() => advanceQuizQuestion(bot, contestId), 30000);
  }

  async function advanceQuizQuestion(bot, contestId) {
    const state = activeQuizContests.get(contestId);
    if (!state) return;

    const q = state.questions[state.currentQ];
    const correctAnswer = q.options[q.correctIndex];

    // Post correct answer
    try {
      await bot.api.sendMessage(state.chatId,
        state.lang === 'uk'
          ? `✅ Відповідь: <b>${escHtml(correctAnswer)}</b>`
          : `✅ Answer: <b>${escHtml(correctAnswer)}</b>`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}

    state.currentQ++;

    if (state.currentQ >= state.questions.length) {
      // Quiz finished — post results
      await finishQuizContest(bot, contestId);
    } else {
      // Next question after 3s pause
      setTimeout(() => postQuizQuestion(bot, contestId), 3000);
    }
  }

  async function finishQuizContest(bot, contestId) {
    const state = activeQuizContests.get(contestId);
    if (!state) return;

    setContestStatus(contestId, 'closed');
    const contest = getContest(contestId);

    // Sort scores
    const sorted = Object.entries(state.scores)
      .sort((a, b) => b[1] - a[1]);

    let text = state.lang === 'uk'
      ? '🏆 <b>Результати квіз-конкурсу:</b>\n\n'
      : '🏆 <b>Quiz Contest Results:</b>\n\n';

    const medals = ['🥇', '🥈', '🥉'];
    const xpRewards = [contest.xp_first, contest.xp_second, contest.xp_third];

    for (let i = 0; i < Math.min(sorted.length, 10); i++) {
      const [userId, score] = sorted[i];
      const entry = getUserEntry(contestId, parseInt(userId));
      const name = entry ? (entry.display_name || entry.first_name || entry.username || userId) : userId;
      const medal = medals[i] || `${i + 1}.`;
      text += `${medal} ${escHtml(String(name))} — ${score} pts`;

      // Award XP to top 3
      if (i < 3 && xpRewards[i]) {
        awardXp(parseInt(userId), xpRewards[i], 'contest', `contest:${contestId}`);
        text += ` (+${xpRewards[i]} XP)`;
      }
      text += '\n';
    }

    if (sorted.length === 0) {
      text += state.lang === 'uk' ? 'Ніхто не відповів.' : 'No one answered.';
    }

    try {
      await bot.api.sendMessage(state.chatId, text, { parse_mode: 'HTML' });
    } catch (e) {}

    activeQuizContests.delete(contestId);
  }

  // Quiz answer callback
  bot.on('callback_query:data', async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    if (!data.startsWith('cquiz:')) return next();

    const parts = data.split(':');
    const contestId = parseInt(parts[1]);
    const qIndex = parseInt(parts[2]);
    const optIndex = parseInt(parts[3]);
    const userId = ctx.from.id;

    const state = activeQuizContests.get(contestId);
    if (!state || state.currentQ !== qIndex) {
      return ctx.answerCallbackQuery({ text: 'Question expired.', show_alert: true });
    }

    if (state.answered.has(userId)) {
      return ctx.answerCallbackQuery({ text: 'Already answered!', show_alert: true });
    }

    state.answered.add(userId);

    const q = state.questions[qIndex];
    const correct = optIndex === q.correctIndex;
    const points = correct ? 10 : 0;

    if (!state.scores[userId]) state.scores[userId] = 0;
    state.scores[userId] += points;

    // Save to DB
    addEntry(contestId, userId, q.options[optIndex], correct, points);

    await ctx.answerCallbackQuery({
      text: correct ? `✅ Correct! +${points} pts` : '❌ Wrong!',
    });
  });

  // ── /submit <text> — submit challenge entry (DM only) ──
  bot.command('submit', async (ctx) => {
    if (ctx.chat.type !== 'private') {
      return ctx.reply('💡 Use /submit in DM with the bot.');
    }

    const userId = ctx.from?.id;
    if (!userId) return;
    const lang = ctx.lang;
    const text = (ctx.match || '').trim();

    if (!text) {
      return ctx.reply(lang === 'uk'
        ? '❌ Формат: /submit Твоя відповідь тут'
        : '❌ Format: /submit Your answer here');
    }

    // Find active challenge
    const contests = getActiveContests();
    const challenge = contests.find(c => c.type === 'challenge' && c.status === 'active');

    if (!challenge) {
      return ctx.reply(lang === 'uk'
        ? '❌ Немає активного челенджу.'
        : '❌ No active challenge.');
    }

    const existing = getUserEntry(challenge.id, userId);
    if (existing) {
      return ctx.reply(lang === 'uk'
        ? '❌ Ти вже відправив рішення для цього челенджу!'
        : '❌ You already submitted for this challenge!');
    }

    addEntry(challenge.id, userId, text, null, 0);
    awardXp(userId, challenge.xp_participate, 'challenge_submit', `contest:${challenge.id}`);

    await ctx.reply(lang === 'uk'
      ? `✅ Рішення прийнято! +${challenge.xp_participate} XP`
      : `✅ Entry submitted! +${challenge.xp_participate} XP`);
  });

  // ── Challenge vote callback ──
  bot.on('callback_query:data', async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    if (!data.startsWith('cvote:')) return next();

    const [, contestIdStr, entryIdStr] = data.split(':');
    const contestId = parseInt(contestIdStr);
    const entryId = parseInt(entryIdStr);
    const userId = ctx.from.id;

    const contest = getContest(contestId);
    if (!contest || contest.status !== 'voting') {
      return ctx.answerCallbackQuery({ text: 'Voting is closed.', show_alert: true });
    }

    if (hasVoted(contestId, userId)) {
      return ctx.answerCallbackQuery({ text: 'Already voted!', show_alert: true });
    }

    addVote(contestId, userId, entryId);
    awardXp(userId, contest.xp_participate, 'vote', `contest:${contestId}`);

    await ctx.answerCallbackQuery({ text: `Voted! +${contest.xp_participate} XP` });
  });
};
