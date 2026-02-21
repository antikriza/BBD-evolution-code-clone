const {
  getUserXp,
  getLeaderboard,
  getUserRank,
  getXpBreakdown,
  getLevelInfo,
  getNextLevelXp,
} = require('../db/xp');
const { escHtml } = require('../utils/format');

/**
 * Build a text progress bar.
 * @param {number} current  - current XP
 * @param {number} target   - XP needed for next level
 * @param {number} barLen   - number of segments
 * @returns {string}
 */
function progressBar(current, target, barLen = 10) {
  const ratio = Math.min(current / target, 1);
  const filled = Math.round(ratio * barLen);
  const empty = barLen - filled;
  return '\u2593'.repeat(filled) + '\u2591'.repeat(empty);
}

/** Localised reason labels */
const REASON_LABELS = {
  en: {
    quiz_correct: 'Quiz (correct)',
    quiz_attempt: 'Quiz (attempt)',
    daily_login: 'Daily login',
    onboarding: 'Onboarding',
    topic_view: 'Topic viewed',
    streak: 'Streak bonus',
  },
  uk: {
    quiz_correct: 'Quiz (pravilno)',
    quiz_attempt: 'Quiz (sproba)',
    daily_login: 'Shchodennyi vkhid',
    onboarding: 'Onbording',
    topic_view: 'Pereglyad temy',
    streak: 'Bonus za seriyu',
  },
};

function reasonLabel(reason, lang) {
  const map = REASON_LABELS[lang] || REASON_LABELS.en;
  return map[reason] || reason;
}

module.exports = function (bot) {
  // ── /xp ────────────────────────────────────────────────────
  bot.command('xp', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const lang = ctx.lang || 'en';
    const { xp, xp_level } = getUserXp(userId);
    const rank = getUserRank(userId);
    const levelInfo = getLevelInfo(xp_level, lang);
    const nextXp = getNextLevelXp(xp_level);
    const breakdown = getXpBreakdown(userId);

    // Progress bar
    let progressLine;
    if (nextXp !== null) {
      const prevXp = levelInfo.xp;           // threshold of current level
      const current = xp - prevXp;           // XP earned inside this level
      const needed = nextXp - prevXp;        // XP span of this level
      const bar = progressBar(current, needed);
      progressLine = `${bar} ${current}/${needed} XP`;
    } else {
      // Max level reached
      progressLine = lang === 'uk' ? 'MAX' : 'MAX';
    }

    // Breakdown lines
    const breakdownLines = breakdown.map(
      (r) => `  ${escHtml(reasonLabel(r.reason, lang))}: <b>${r.total}</b> XP`
    );

    const title = lang === 'uk' ? 'Твій XP профіль' : 'Your XP Profile';
    const levelLabel = lang === 'uk' ? 'Рівень' : 'Level';
    const rankLabel = lang === 'uk' ? 'Ранг' : 'Rank';
    const totalLabel = lang === 'uk' ? 'Всього XP' : 'Total XP';
    const progressLabel = lang === 'uk' ? 'Прогрес' : 'Progress';
    const breakdownLabel = lang === 'uk' ? 'Розбивка XP' : 'XP Breakdown';

    const lines = [
      `<b>${title}</b>`,
      '',
      `${levelLabel}: <b>${xp_level}</b> — ${escHtml(levelInfo.title)}`,
      `${totalLabel}: <b>${xp}</b>`,
      `${rankLabel}: <b>#${rank}</b>`,
      '',
      `${progressLabel}: ${progressLine}`,
    ];

    if (breakdownLines.length > 0) {
      lines.push('', `<b>${breakdownLabel}:</b>`, ...breakdownLines);
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  });

  // ── /leaderboard ───────────────────────────────────────────
  bot.command('leaderboard', async (ctx) => {
    const lang = ctx.lang || 'en';
    const rows = getLeaderboard(10);

    const title = lang === 'uk' ? 'Топ-10 рейтинг' : 'Top 10 Leaderboard';
    const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49']; // gold, silver, bronze

    const lines = [`<b>${title}</b>`, ''];

    rows.forEach((row, i) => {
      const prefix = i < 3 ? medals[i] : `${i + 1}.`;
      const name = escHtml(row.display_name || row.first_name || row.username || `User ${row.telegram_id}`);
      const info = getLevelInfo(row.xp_level, lang);
      lines.push(
        `${prefix} ${name} — <b>${row.xp}</b> XP (${escHtml(info.title)})`
      );
    });

    if (rows.length === 0) {
      lines.push(lang === 'uk' ? 'Поки що немає даних.' : 'No data yet.');
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  });
};
