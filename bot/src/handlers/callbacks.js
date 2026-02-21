const { InlineKeyboard } = require('grammy');
const { showLevel, showTopic } = require('./course');
const { activeQuizzes, sendQuiz } = require('./quiz');
const { sendRandom } = require('./random');
const { escHtml } = require('../utils/format');
const { setUserLang } = require('../middleware/language');
const { getUser, setOnboardingStep, updateField, completeOnboarding } = require('../db/users');
const { sendStep, sendProfileSummary } = require('./onboarding');
const { getInterests } = require('../db/settings');
const { awardXp, getDailyXpCount } = require('../db/xp');

module.exports = function (bot) {
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;

    try {
      if (data.startsWith('level:')) {
        const num = parseInt(data.split(':')[1]);
        await showLevel(ctx, num);
        await ctx.answerCallbackQuery();
      } else if (data.startsWith('topic:')) {
        const slug = data.split(':')[1];
        const entry = ctx.courseData.topicBySlug[slug];
        if (entry) {
          await showTopic(ctx, entry.topic, entry.level);
        }
        await ctx.answerCallbackQuery();
      } else if (data.startsWith('terms:')) {
        const slug = data.split(':')[1];
        const entry = ctx.courseData.topicBySlug[slug];
        if (entry) {
          const lang = ctx.lang;
          const terms = entry.topic.keyTerms?.[lang] || [];
          if (terms.length === 0) {
            await ctx.answerCallbackQuery({ text: lang === 'uk' ? 'Немає термінів' : 'No terms available' });
            return;
          }
          const text = terms.map(kt => `<b>${escHtml(kt.term)}</b> — ${escHtml(kt.def)}`).join('\n\n');
          const header = `${entry.level.emoji} <b>${escHtml(entry.topic.title[lang])}</b> — ${lang === 'uk' ? 'Терміни' : 'Key Terms'}`;
          const kb = new InlineKeyboard().text(lang === 'uk' ? '← Назад' : '← Back', `topic:${slug}`);
          try {
            await ctx.editMessageText(`${header}\n\n${text}`, { parse_mode: 'HTML', reply_markup: kb });
          } catch (e) { /* not modified */ }
        }
        await ctx.answerCallbackQuery();
      } else if (data.startsWith('tips:')) {
        const slug = data.split(':')[1];
        const entry = ctx.courseData.topicBySlug[slug];
        if (entry) {
          const lang = ctx.lang;
          const tips = entry.topic.tips?.[lang] || [];
          if (tips.length === 0) {
            await ctx.answerCallbackQuery({ text: lang === 'uk' ? 'Немає порад' : 'No tips available' });
            return;
          }
          const text = tips.map((t, i) => `${i + 1}. ${escHtml(t)}`).join('\n\n');
          const header = `${entry.level.emoji} <b>${escHtml(entry.topic.title[lang])}</b> — ${lang === 'uk' ? 'Поради' : 'Tips'}`;
          const kb = new InlineKeyboard().text(lang === 'uk' ? '← Назад' : '← Back', `topic:${slug}`);
          try {
            await ctx.editMessageText(`${header}\n\n${text}`, { parse_mode: 'HTML', reply_markup: kb });
          } catch (e) { /* not modified */ }
        }
        await ctx.answerCallbackQuery();
      } else if (data === 'quiz:next') {
        await sendQuiz(ctx);
        await ctx.answerCallbackQuery();
      } else if (data.startsWith('quiz:')) {
        const answerIdx = parseInt(data.split(':')[1]);
        const key = `${ctx.callbackQuery.message.chat.id}:${ctx.callbackQuery.message.message_id}`;
        const quiz = activeQuizzes.get(key);

        if (!quiz) {
          await ctx.answerCallbackQuery({ text: 'Quiz expired' });
          return;
        }

        const correct = answerIdx === quiz.correctIndex;
        const lang = quiz.lang;
        const emoji = correct ? '✅' : '❌';
        const status = correct
          ? (lang === 'uk' ? 'Правильно!' : 'Correct!')
          : (lang === 'uk' ? 'Неправильно!' : 'Wrong!');

        const selectedOpt = quiz.options[answerIdx] || '?';
        const correctOpt = quiz.options[quiz.correctIndex];

        let resultText = `${emoji} <b>${status}</b>`;
        if (!correct) {
          resultText += `\n${lang === 'uk' ? 'Ваша відповідь' : 'Your answer'}: ${escHtml(selectedOpt)}`;
          resultText += `\n${lang === 'uk' ? 'Правильна відповідь' : 'Correct answer'}: <b>${escHtml(correctOpt)}</b>`;
        }
        resultText += `\n\n${quiz.explanation}`;

        // Award XP for correct quiz answer (max 3/day)
        if (correct) {
          const userId = ctx.from?.id;
          if (userId) {
            const dailyCount = getDailyXpCount(userId, 'quiz');
            if (dailyCount < 3) {
              const result = awardXp(userId, 10, 'quiz');
              const xpMsg = lang === 'uk' ? `\n\n💎 +10 XP` : `\n\n💎 +10 XP`;
              resultText += xpMsg;
              if (result && result.leveledUp) {
                const lvlTitle = lang === 'uk' ? result.levelTitle.title_uk : result.levelTitle.title_en;
                resultText += lang === 'uk'
                  ? `\n🎉 Новий рівень: ${result.newLevel} — ${lvlTitle}!`
                  : `\n🎉 Level up: ${result.newLevel} — ${lvlTitle}!`;
              }
            }
          }
        }

        const kb = new InlineKeyboard()
          .text(lang === 'uk' ? '🔄 Наступне запитання' : '🔄 Next question', 'quiz:next');

        try {
          await ctx.editMessageText(resultText, { parse_mode: 'HTML', reply_markup: kb });
        } catch (e) { /* not modified */ }

        activeQuizzes.delete(key);
        await ctx.answerCallbackQuery();
      } else if (data.startsWith('random:')) {
        await sendRandom(ctx);
        await ctx.answerCallbackQuery();
      } else if (data.startsWith('lang:')) {
        const newLang = data.split(':')[1];
        if (ctx.from?.id) setUserLang(ctx.from.id, newLang);
        ctx.lang = newLang;
        const msg = newLang === 'uk' ? '🇺🇦 Мову змінено на українську' : '🇬🇧 Language set to English';
        await ctx.answerCallbackQuery({ text: msg });
        try {
          await ctx.editMessageText(msg);
        } catch (e) { /* not modified */ }
      } else if (data.startsWith('onboard:role:')) {
        const roleId = data.split(':')[2];
        const userId = ctx.from?.id;
        if (userId) {
          updateField(userId, 'role', roleId);
          setOnboardingStep(userId, 2);
          const user = getUser(userId);
          const lang = ctx.lang;
          try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch (e) {}
          await sendStep(ctx, user, lang);
        }
        await ctx.answerCallbackQuery();
      } else if (data.startsWith('onboard:exp:')) {
        const expId = data.split(':')[2];
        const userId = ctx.from?.id;
        if (userId) {
          updateField(userId, 'experience', expId);
          setOnboardingStep(userId, 3);
          const user = getUser(userId);
          const lang = ctx.lang;
          try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch (e) {}
          await sendStep(ctx, user, lang);
        }
        await ctx.answerCallbackQuery();
      } else if (data === 'onboard:int:done') {
        const userId = ctx.from?.id;
        if (userId) {
          const user = getUser(userId);
          const lang = ctx.lang;
          if (user) {
            completeOnboarding(userId, {
              displayName: user.display_name,
              role: user.role,
              experience: user.experience,
              interests: user.interests || '',
            });
            // Award XP for completing onboarding
            awardXp(userId, 50, 'onboarding');
            try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch (e) {}
            const finalUser = getUser(userId);
            await sendProfileSummary(ctx, finalUser, lang);
          }
        }
        await ctx.answerCallbackQuery();
      } else if (data.startsWith('onboard:int:')) {
        const interestId = data.split(':')[2];
        const userId = ctx.from?.id;
        if (userId) {
          const user = getUser(userId);
          if (user) {
            const current = (user.interests || '').split(',').filter(Boolean);
            const idx = current.indexOf(interestId);
            if (idx >= 0) {
              current.splice(idx, 1);
            } else {
              current.push(interestId);
            }
            updateField(userId, 'interests', current.join(','));

            // Rebuild keyboard with updated selections
            const lang = ctx.lang;
            const selected = current;
            const kb = new InlineKeyboard();
            getInterests().forEach((item) => {
              const isSelected = selected.includes(item.id);
              const label = `${isSelected ? '✅ ' : ''}${item[lang] || item.en}`;
              kb.text(label, `onboard:int:${item.id}`).row();
            });
            kb.text(lang === 'uk' ? '✔️ Готово' : '✔️ Done', 'onboard:int:done');

            try {
              await ctx.editMessageReplyMarkup({ reply_markup: kb });
            } catch (e) {}
          }
        }
        await ctx.answerCallbackQuery();
      } else if (data === 'back:course') {
        // Re-trigger course view
        const lang = ctx.lang;
        const cData = ctx.courseData;
        const totalTopics = cData.allTopicsFlat.length;
        const title = lang === 'uk' ? 'Курс з ШІ та програмування' : 'AI & Programming Course';
        const subtitle = lang === 'uk' ? `${totalTopics} тем на ${cData.raw.levels.length} рівнях` : `${totalTopics} topics across ${cData.raw.levels.length} levels`;

        const kb = new InlineKeyboard();
        cData.raw.levels.forEach(level => {
          kb.text(`${level.emoji} ${level.title[lang]} (${level.topics.length})`, `level:${level.num}`).row();
        });

        try {
          await ctx.editMessageText(`<b>${escHtml(title)}</b>\n${escHtml(subtitle)}\n\n${lang === 'uk' ? 'Оберіть рівень:' : 'Select a level:'}`, {
            parse_mode: 'HTML',
            reply_markup: kb,
          });
        } catch (e) { /* not modified */ }
        await ctx.answerCallbackQuery();
      } else {
        await ctx.answerCallbackQuery();
      }
    } catch (err) {
      console.error('Callback error:', err.message);
      try { await ctx.answerCallbackQuery(); } catch (e) { /* ignore */ }
    }
  });
};
