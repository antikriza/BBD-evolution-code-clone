function searchCourse(query, courseData, lang, limit = 10) {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results = [];
  const seen = new Set();

  courseData.allTopicsFlat.forEach(topic => {
    let score = 0;
    const title = (topic.title[lang] || '').toLowerCase();
    const desc = (topic.desc[lang] || '').toLowerCase();

    if (title === q) score += 100;
    else if (title.includes(q)) score += 50;
    if (desc.includes(q)) score += 20;

    if (topic.overview && topic.overview[lang]) {
      topic.overview[lang].forEach(p => {
        if (p.toLowerCase().includes(q)) score += 10;
      });
    }
    if (topic.keyTerms && topic.keyTerms[lang]) {
      topic.keyTerms[lang].forEach(kt => {
        if (kt.term.toLowerCase().includes(q)) score += 30;
        if (kt.def.toLowerCase().includes(q)) score += 15;
      });
    }
    if (topic.details && topic.details[lang]) {
      topic.details[lang].forEach(d => {
        if ((d.text || '').toLowerCase().includes(q)) score += 20;
        if ((d.desc || '').toLowerCase().includes(q)) score += 10;
      });
    }
    if (topic.tips && topic.tips[lang]) {
      topic.tips[lang].forEach(t => {
        if (t.toLowerCase().includes(q)) score += 5;
      });
    }

    if (score > 0 && !seen.has(topic.slug)) {
      seen.add(topic.slug);
      results.push({ topic, score });
    }
  });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

module.exports = { searchCourse };
