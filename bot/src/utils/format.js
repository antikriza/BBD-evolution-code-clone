function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(s, max) {
  if (!s || s.length <= max) return s;
  return s.substring(0, max - 3) + '...';
}

function topicCard(topic, level, lang) {
  const parts = [
    `${level.emoji} <b>${escHtml(topic.title[lang])}</b>`,
    `<i>Level ${level.num}: ${escHtml(level.title[lang])}</i>`,
    '',
    escHtml(topic.desc[lang]),
  ];
  if (topic.overview && topic.overview[lang] && topic.overview[lang][0]) {
    parts.push('', truncate(escHtml(topic.overview[lang][0]), 400));
  }
  return parts.filter(l => l !== undefined).join('\n');
}

function termCard(kt, topicTitle) {
  return `<b>${escHtml(kt.term)}</b>\n${escHtml(kt.def)}\n<i>— ${escHtml(topicTitle)}</i>`;
}

function levelCard(level, lang) {
  return `${level.emoji} <b>Level ${level.num}: ${escHtml(level.title[lang])}</b>\n${escHtml(level.desc[lang])}\n<i>${level.topics.length} topics</i>`;
}

module.exports = { escHtml, truncate, topicCard, termCard, levelCard };
