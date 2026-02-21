const { InlineKeyboard } = require('grammy');
const { getUser, ensureUser, setOnboardingStep, updateField, completeOnboarding } = require('../db/users');
const { getRoles, getExperience, getInterests } = require('../db/settings');
const { escHtml } = require('../utils/format');
const config = require('../config');

let botUsername = null;

function sendStep(ctx, user, lang) {
  const step = user.onboarding_step;

  if (step === 0) {
    return sendNameQuestion(ctx, lang);
  } else if (step === 1) {
    return sendRoleQuestion(ctx, lang);
  } else if (step === 2) {
    return sendExperienceQuestion(ctx, lang);
  } else if (step === 3) {
    return sendInterestsQuestion(ctx, lang, user);
  }
}

function sendNameQuestion(ctx, lang) {
  const text = lang === 'uk'
    ? '👋 Привіт! Давай познайомимось.\n\n<b>Як тебе називати?</b>\nНапиши своє ім\'я:'
    : '👋 Hi there! Let\'s get acquainted.\n\n<b>What should we call you?</b>\nType your name:';
  return ctx.reply(text, { parse_mode: 'HTML' });
}

function sendRoleQuestion(ctx, lang) {
  const ROLES = getRoles();
  const text = lang === 'uk'
    ? '💼 <b>Яка твоя роль?</b>'
    : '💼 <b>What\'s your role?</b>';
  const kb = new InlineKeyboard();
  ROLES.forEach((r, i) => {
    kb.text(r[lang] || r.en, `onboard:role:${r.id}`);
    if (i < ROLES.length - 1) kb.row();
  });
  return ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

function sendExperienceQuestion(ctx, lang) {
  const EXPERIENCE = getExperience();
  const text = lang === 'uk'
    ? '🎯 <b>Який у тебе досвід з ШІ?</b>'
    : '🎯 <b>Your AI experience level?</b>';
  const kb = new InlineKeyboard();
  EXPERIENCE.forEach((e, i) => {
    kb.text(e[lang] || e.en, `onboard:exp:${e.id}`);
    if (i < EXPERIENCE.length - 1) kb.row();
  });
  return ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

function sendInterestsQuestion(ctx, lang, user) {
  const INTERESTS = getInterests();
  const selected = (user.interests || '').split(',').filter(Boolean);
  const text = lang === 'uk'
    ? '🧩 <b>Що тебе цікавить?</b>\nОбери один або кілька варіантів, потім натисни "Готово":'
    : '🧩 <b>What interests you?</b>\nSelect one or more, then press "Done":';

  const kb = new InlineKeyboard();
  INTERESTS.forEach((item) => {
    const isSelected = selected.includes(item.id);
    const label = `${isSelected ? '✅ ' : ''}${item[lang] || item.en}`;
    kb.text(label, `onboard:int:${item.id}`).row();
  });
  kb.text(lang === 'uk' ? '✔️ Готово' : '✔️ Done', 'onboard:int:done');
  return ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

function sendProfileSummary(ctx, user, lang) {
  const ROLES = getRoles();
  const EXPERIENCE = getExperience();
  const INTERESTS = getInterests();

  const roleName = ROLES.find(r => r.id === user.role);
  const expName = EXPERIENCE.find(e => e.id === user.experience);
  const interestNames = (user.interests || '').split(',').filter(Boolean)
    .map(id => {
      const item = INTERESTS.find(i => i.id === id);
      return item ? (item[lang] || item.en) : id;
    });

  const text = lang === 'uk'
    ? `✅ <b>Профіль збережено!</b>\n\n` +
      `👤 Ім'я: <b>${escHtml(user.display_name)}</b>\n` +
      `💼 Роль: <b>${roleName ? roleName.uk : user.role}</b>\n` +
      `🎯 Досвід: <b>${expName ? expName.uk : user.experience}</b>\n` +
      `🧩 Інтереси: <b>${interestNames.join(', ') || '—'}</b>\n\n` +
      `Тепер можеш користуватись ботом! /help для переліку команд.`
    : `✅ <b>Profile saved!</b>\n\n` +
      `👤 Name: <b>${escHtml(user.display_name)}</b>\n` +
      `💼 Role: <b>${roleName ? roleName.en : user.role}</b>\n` +
      `🎯 Experience: <b>${expName ? expName.en : user.experience}</b>\n` +
      `🧩 Interests: <b>${interestNames.join(', ') || '—'}</b>\n\n` +
      `You're all set! Use /help to see all commands.`;

  return ctx.reply(text, { parse_mode: 'HTML' });
}

// Start or resume onboarding for a user in DM
async function startOnboarding(ctx) {
  const userId = ctx.from?.id;
  if (!userId) return false;

  const lang = ctx.lang;
  let user = getUser(userId);

  if (!user) {
    user = ensureUser(userId, ctx.from.username, ctx.from.first_name, lang);
  }

  if (user.onboarding_complete) return false;

  await sendStep(ctx, user, lang);
  return true;
}

module.exports = function (bot) {
  // Cache bot username
  bot.use(async (ctx, next) => {
    if (!botUsername) {
      try { botUsername = (await bot.api.getMe()).username; } catch (e) {}
    }
    return next();
  });

  // Handle new members joining the group
  bot.on('message:new_chat_members', async (ctx) => {
    const members = ctx.message.new_chat_members;
    const lang = ctx.lang;

    for (const member of members) {
      if (member.is_bot) continue;

      const user = getUser(member.id);
      if (user && user.onboarding_complete) continue;

      ensureUser(member.id, member.username, member.first_name, lang);

      try {
        const dmText = lang === 'uk'
          ? `👋 Привіт, <b>${escHtml(member.first_name || 'друже')}</b>! Ласкаво просимо до <b>PM AI Club</b>!\n\nДавай познайомимось — це займе хвилину.`
          : `👋 Hi, <b>${escHtml(member.first_name || 'there')}</b>! Welcome to <b>PM AI Club</b>!\n\nLet's get acquainted — it'll take a minute.`;
        await bot.api.sendMessage(member.id, dmText, { parse_mode: 'HTML' });

        const nameText = lang === 'uk'
          ? '<b>Як тебе називати?</b>\nНапиши своє ім\'я:'
          : '<b>What should we call you?</b>\nType your name:';
        await bot.api.sendMessage(member.id, nameText, { parse_mode: 'HTML' });
      } catch (err) {
        if (err.error_code === 403) {
          const startUrl = `https://t.me/${botUsername || 'bot'}?start=onboard`;
          const kb = new InlineKeyboard().url(
            lang === 'uk' ? 'Почати знайомство' : 'Start introduction',
            startUrl
          );
          const firstName = member.first_name || '';
          const notice = lang === 'uk'
            ? `${firstName}, натисни кнопку щоб познайомитись з ботом:`
            : `${firstName}, press the button to introduce yourself to the bot:`;
          try {
            const msg = await bot.api.sendMessage(ctx.chat.id, notice, {
              reply_markup: kb,
              message_thread_id: config.WELCOME_THREAD_ID,
            });
            setTimeout(async () => {
              try { await bot.api.deleteMessage(ctx.chat.id, msg.message_id); } catch (e) {}
            }, 30000);
          } catch (e) {}
        }
      }
    }
  });

  // Handle free text for name input (step 0)
  bot.on('message:text', async (ctx, next) => {
    if (ctx.chat.type !== 'private') return next();

    const userId = ctx.from?.id;
    if (!userId) return next();

    if (ctx.message.text.startsWith('/')) return next();

    const user = getUser(userId);
    if (!user || user.onboarding_complete || user.onboarding_step !== 0) return next();

    const name = ctx.message.text.trim().slice(0, 100);
    if (!name) return next();

    updateField(userId, 'display_name', name);
    setOnboardingStep(userId, 1);

    const lang = ctx.lang;
    const ack = lang === 'uk'
      ? `👍 Приємно познайомитись, <b>${escHtml(name)}</b>!`
      : `👍 Nice to meet you, <b>${escHtml(name)}</b>!`;
    await ctx.reply(ack, { parse_mode: 'HTML' });

    const updatedUser = getUser(userId);
    await sendStep(ctx, updatedUser, lang);
  });
};

module.exports.startOnboarding = startOnboarding;
module.exports.sendStep = sendStep;
module.exports.sendProfileSummary = sendProfileSummary;
