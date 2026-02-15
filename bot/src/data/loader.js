const fs = require('fs');
const config = require('../config');

function loadCourseData() {
  const raw = JSON.parse(fs.readFileSync(config.COURSE_DATA_PATH, 'utf8'));

  const topicBySlug = {};
  const allKeyTerms = { en: [], uk: [] };
  const allTips = { en: [], uk: [] };
  const allTopicsFlat = [];

  raw.levels.forEach(level => {
    level.topics.forEach(topic => {
      topicBySlug[topic.slug] = { levelNum: level.num, topic, level };
      allTopicsFlat.push({ ...topic, levelNum: level.num, levelEmoji: level.emoji, levelTitle: level.title });

      ['en', 'uk'].forEach(lang => {
        if (topic.keyTerms && topic.keyTerms[lang]) {
          topic.keyTerms[lang].forEach(kt => {
            allKeyTerms[lang].push({ ...kt, topicSlug: topic.slug, topicTitle: topic.title[lang], levelNum: level.num });
          });
        }
        if (topic.tips && topic.tips[lang]) {
          topic.tips[lang].forEach(tip => {
            allTips[lang].push({ tip, topicSlug: topic.slug, topicTitle: topic.title[lang], levelNum: level.num });
          });
        }
      });
    });
  });

  console.log(`Loaded: ${raw.levels.length} levels, ${allTopicsFlat.length} topics, ${allKeyTerms.en.length} EN terms, ${allTips.en.length} EN tips`);

  return { raw, topicBySlug, allKeyTerms, allTips, allTopicsFlat };
}

module.exports = { loadCourseData };
