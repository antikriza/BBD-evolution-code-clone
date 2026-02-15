function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateTermQuestion(courseData, lang) {
  const terms = courseData.allKeyTerms[lang];
  if (terms.length < 4) return null;

  const correct = pickRandom(terms);
  const others = terms.filter(t => t.topicSlug !== correct.topicSlug && t.term !== correct.term);
  const distractors = shuffle(others).slice(0, 3);

  const options = shuffle([correct.term, ...distractors.map(d => d.term)]);
  const correctIndex = options.indexOf(correct.term);

  return {
    question: `What concept is described as:\n<i>"${correct.def}"</i>`,
    options,
    correctIndex,
    explanation: `<b>${correct.term}</b> — from topic "${correct.topicTitle}"`,
  };
}

function generateTopicQuestion(courseData, lang) {
  const topics = courseData.allTopicsFlat;
  if (topics.length < 4) return null;

  const correct = pickRandom(topics);
  const desc = correct.desc[lang];
  if (!desc) return null;

  const others = topics.filter(t => t.slug !== correct.slug);
  const distractors = shuffle(others).slice(0, 3);

  const options = shuffle([correct.title[lang], ...distractors.map(d => d.title[lang])]);
  const correctIndex = options.indexOf(correct.title[lang]);

  return {
    question: `Which topic does this describe?\n<i>"${desc}"</i>`,
    options,
    correctIndex,
    explanation: `${correct.levelEmoji} <b>${correct.title[lang]}</b> (Level ${correct.levelNum})`,
  };
}

function generateLevelQuestion(courseData, lang) {
  const topics = courseData.allTopicsFlat;
  const correct = pickRandom(topics);

  const options = courseData.raw.levels.map(l => `${l.emoji} Level ${l.num}: ${l.title[lang]}`);
  const correctIndex = correct.levelNum - 1;

  return {
    question: `Which level covers <b>${correct.title[lang]}</b>?\n<i>${correct.desc[lang]}</i>`,
    options,
    correctIndex,
    explanation: `${correct.levelEmoji} Level ${correct.levelNum}: ${courseData.raw.levels[correct.levelNum - 1].title[lang]}`,
  };
}

function generateTipQuestion(courseData, lang) {
  const tips = courseData.allTips[lang];
  if (tips.length < 2) return null;

  const tip = pickRandom(tips);

  return {
    question: `Is this a real course tip?\n<i>"${tip.tip}"</i>`,
    options: ['True', 'False'],
    correctIndex: 0,
    explanation: `This tip is from <b>${tip.topicTitle}</b> (Level ${tip.levelNum})`,
  };
}

const generators = [
  { fn: generateTermQuestion, weight: 40 },
  { fn: generateTopicQuestion, weight: 25 },
  { fn: generateLevelQuestion, weight: 20 },
  { fn: generateTipQuestion, weight: 15 },
];

function generateQuiz(courseData, lang) {
  const totalWeight = generators.reduce((s, g) => s + g.weight, 0);
  let r = Math.random() * totalWeight;

  for (const g of generators) {
    r -= g.weight;
    if (r <= 0) {
      const q = g.fn(courseData, lang);
      if (q) return q;
    }
  }

  // Fallback: try each generator
  for (const g of generators) {
    const q = g.fn(courseData, lang);
    if (q) return q;
  }
  return null;
}

module.exports = { generateQuiz };
