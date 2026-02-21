const { InlineKeyboard } = require('grammy');
const config = require('../config');
const {
  getUserHomework, getHomeworkById, isTopicCompleted,
  markTopicComplete, createHomework, getActiveHomework,
} = require('../db/homework');
const { awardXp } = require('../db/xp');
const { escHtml } = require('../utils/format');
const { getAllUserIds } = require('../db/users');

// Store pending homework quiz verifications: chatId:msgId -> { homeworkId, topicSlug, correctIndex, userId }
const pendingHwQuiz = new Map();

function generateTopicQuiz(courseData, topicSlug, lang) {
  const terms = (courseData.allKeyTerms[lang] || []).filter(t => t.topicSlug === topicSlug);
  if (terms.length >= 4) {
    // Term-based question
    const correct = terms[Math.floor(Math.random() * terms.length)];
    const others = courseData.allKeyTerms[lang].filter(t => t.topicSlug !== topicSlug && t.term !== correct.term);
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [correct.term, ...shuffled.map(d => d.term)].sort(() => Math.random() - 0.5);
    const correctIndex = options.indexOf(correct.term);
    return {
      question: lang === 'uk'
        ? `Який термін описано як:\n<i>"${correct.def}"</i>`
        : `What concept is described as:\n<i>"${correct.def}"</i>`,
      options,
      correctIndex,
    };
  }

  // Fallback: topic identification question
  const entry = courseData.topicBySlug[topicSlug];
  if (!entry) return null;
  const topicTitle = entry.topic.title[lang];
  const topics = courseData.allTopicsFlat;
  const others = topics.filter(t => t.slug !== topicSlug).sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [topicTitle, ...others.map(t => t.title[lang])].sort(() => Math.random() - 0.5);
  const correctIndex = options.indexOf(topicTitle);
  const desc = entry.topic.desc ? entry.topic.desc[lang] : '';
  return {
    question: lang === 'uk'
      ? `Яка тема описана так?\n<i>"${desc}"</i>`
      : `Which topic does this describe?\n<i>"${desc}"</i>`,
    options,
    correctIndex,
  };
}

module.exports = function (bot) {
  // /homework — show user's active homework
  bot.command('homework', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const lang = ctx.lang;

    const homework = getUserHomework(userId);
    if (homework.length === 0) {
      return ctx.reply(lang === 'uk'
        ? '📚 У тебе немає активних домашніх завдань.'
        : '📚 You have no active homework.');
    }

    let text = lang === 'uk' ? '<b>📚 Домашні завдання:</b>\n\n' : '<b>📚 Your Homework:</b>\n\n';
    for (const hw of homework) {
      const statusIcon = hw.isFullyComplete ? '✅' : '📝';
      text += `${statusIcon} <b>${escHtml(hw.title)}</b>\n`;
      if (hw.deadline) text += `⏰ ${lang === 'uk' ? 'Дедлайн' : 'Deadline'}: ${hw.deadline}\n`;
      text += `💎 ${hw.xp_reward} XP ${lang === 'uk' ? 'за тему' : 'per topic'}\n`;

      for (const slug of hw.topics) {
        const done = hw.completedTopics.includes(slug);
        const entry = ctx.courseData.topicBySlug[slug];
        const name = entry ? entry.topic.title[lang] : slug;
        text += `  ${done ? '✅' : '⬜'} ${escHtml(name)}\n`;
      }
      text += `\n${lang === 'uk' ? 'Виконати' : 'Complete'}: /complete_${hw.id}_SLUG\n\n`;
    }

    await ctx.reply(text, { parse_mode: 'HTML' });
  });

  // /complete <topic_slug> or /complete_<hwId>_<slug>
  bot.command('complete', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const lang = ctx.lang;
    const args = (ctx.match || '').trim();

    if (!args) {
      return ctx.reply(lang === 'uk'
        ? '❌ Вкажи тему: /complete &lt;topic_slug&gt;'
        : '❌ Specify topic: /complete &lt;topic_slug&gt;', { parse_mode: 'HTML' });
    }

    // Find matching homework + topic
    const homework = getUserHomework(userId);
    let targetHw = null;
    let targetSlug = null;

    // Try parsing /complete_<hwId>_<slug> format
    const parts = args.split('_');
    if (parts.length >= 2) {
      const hwId = parseInt(parts[0]);
      const slug = parts.slice(1).join('_');
      if (hwId) {
        targetHw = homework.find(h => h.id === hwId && h.topics.includes(slug));
        if (targetHw) targetSlug = slug;
      }
    }

    // Fallback: search by slug across all homework
    if (!targetHw) {
      for (const hw of homework) {
        if (hw.topics.includes(args)) {
          targetHw = hw;
          targetSlug = args;
          break;
        }
      }
    }

    if (!targetHw || !targetSlug) {
      return ctx.reply(lang === 'uk'
        ? '❌ Тему не знайдено у домашніх завданнях.'
        : '❌ Topic not found in your homework.');
    }

    // Check if already completed
    if (isTopicCompleted(targetHw.id, userId, targetSlug)) {
      return ctx.reply(lang === 'uk'
        ? '✅ Ти вже виконав цю тему!'
        : '✅ You already completed this topic!');
    }

    // Generate verification quiz
    const quiz = generateTopicQuiz(ctx.courseData, targetSlug, lang);
    if (!quiz) {
      // No quiz available — mark complete directly
      markTopicComplete(targetHw.id, userId, targetSlug);
      const xpResult = awardXp(userId, targetHw.xp_reward, 'homework', `hw:${targetHw.id}:${targetSlug}`);
      let text = lang === 'uk'
        ? `✅ Тему виконано! +${targetHw.xp_reward} XP`
        : `✅ Topic completed! +${targetHw.xp_reward} XP`;
      if (xpResult && xpResult.leveledUp) {
        const lvlTitle = lang === 'uk' ? xpResult.levelTitle.title_uk : xpResult.levelTitle.title_en;
        text += `\n🎉 Level up: ${xpResult.newLevel} — ${lvlTitle}!`;
      }
      return ctx.reply(text);
    }

    // Send quiz
    const kb = new InlineKeyboard();
    quiz.options.forEach((opt, i) => {
      kb.text(opt, `hwquiz:${i}`);
      if (i < quiz.options.length - 1) kb.row();
    });

    const entry = ctx.courseData.topicBySlug[targetSlug];
    const topicName = entry ? entry.topic.title[lang] : targetSlug;
    const header = lang === 'uk'
      ? `📝 <b>Перевірка:</b> ${escHtml(topicName)}`
      : `📝 <b>Verification:</b> ${escHtml(topicName)}`;

    const msg = await ctx.reply(`${header}\n\n${quiz.question}`, { parse_mode: 'HTML', reply_markup: kb });

    pendingHwQuiz.set(`${msg.chat.id}:${msg.message_id}`, {
      homeworkId: targetHw.id,
      topicSlug: targetSlug,
      correctIndex: quiz.correctIndex,
      userId,
      xpReward: targetHw.xp_reward,
      lang,
    });
  });

  // /assign <slug1,slug2> <YYYY-MM-DD> <title> — admin only
  bot.command('assign', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !config.ADMIN_IDS.includes(userId)) {
      return ctx.reply('⛔ Admin only.');
    }
    const lang = ctx.lang;
    const args = (ctx.match || '').trim();
    const match = args.match(/^(\S+)\s+(\d{4}-\d{2}-\d{2})\s+(.+)$/);

    if (!match) {
      return ctx.reply(
        lang === 'uk'
          ? '❌ Формат: /assign slug1,slug2 2026-03-01 Назва завдання'
          : '❌ Format: /assign slug1,slug2 2026-03-01 Homework title',
      );
    }

    const [, slugsStr, deadline, title] = match;
    const slugs = slugsStr.split(',').filter(Boolean);

    const id = createHomework(title, slugs, deadline, 30, userId);

    // DM all users about new homework
    const allIds = getAllUserIds();
    let sent = 0;
    const notify = lang === 'uk'
      ? `📚 <b>Нове домашнє завдання:</b> ${escHtml(title)}\n⏰ Дедлайн: ${deadline}\n\nВикористай /homework для деталей.`
      : `📚 <b>New homework:</b> ${escHtml(title)}\n⏰ Deadline: ${deadline}\n\nUse /homework for details.`;

    for (const uid of allIds) {
      try {
        await bot.api.sendMessage(uid, notify, { parse_mode: 'HTML' });
        sent++;
      } catch (e) {}
      if (sent % 25 === 0) await new Promise(r => setTimeout(r, 1000));
    }

    await ctx.reply(
      lang === 'uk'
        ? `✅ Домашнє завдання #${id} створено. Повідомлено ${sent} користувачів.`
        : `✅ Homework #${id} created. Notified ${sent} users.`,
    );
  });

  // Handle homework quiz callbacks
  bot.on('callback_query:data', async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    if (!data.startsWith('hwquiz:')) return next();

    const msgKey = `${ctx.callbackQuery.message.chat.id}:${ctx.callbackQuery.message.message_id}`;
    const quiz = pendingHwQuiz.get(msgKey);

    if (!quiz) {
      return ctx.answerCallbackQuery({ text: 'Quiz expired.', show_alert: true });
    }

    if (ctx.from.id !== quiz.userId) {
      return ctx.answerCallbackQuery({ text: 'This quiz is not for you.', show_alert: true });
    }

    const answerIndex = parseInt(data.split(':')[1]);
    const correct = answerIndex === quiz.correctIndex;
    const lang = quiz.lang;

    pendingHwQuiz.delete(msgKey);

    if (correct) {
      markTopicComplete(quiz.homeworkId, quiz.userId, quiz.topicSlug);
      const xpResult = awardXp(quiz.userId, quiz.xpReward, 'homework', `hw:${quiz.homeworkId}:${quiz.topicSlug}`);
      let text = lang === 'uk'
        ? `✅ Правильно! Тему виконано. +${quiz.xpReward} XP`
        : `✅ Correct! Topic completed. +${quiz.xpReward} XP`;
      if (xpResult && xpResult.leveledUp) {
        const lvlTitle = lang === 'uk' ? xpResult.levelTitle.title_uk : xpResult.levelTitle.title_en;
        text += `\n🎉 Level up: ${xpResult.newLevel} — ${lvlTitle}!`;
      }
      await ctx.editMessageText(text, { parse_mode: 'HTML' });
    } else {
      await ctx.editMessageText(
        lang === 'uk'
          ? '❌ Неправильно. Спробуй ще раз: /homework'
          : '❌ Incorrect. Try again: /homework',
      );
    }
    await ctx.answerCallbackQuery();
  });
};
