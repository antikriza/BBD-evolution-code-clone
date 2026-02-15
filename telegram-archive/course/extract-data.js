#!/usr/bin/env node
/**
 * Extracts ui + levels data from build-all.js into course-data.json.
 * Run once: node extract-data.js
 */

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'build-all.js'), 'utf8');

// Extract the ui object (lines between "const ui = {" and the closing "};")
const uiStart = src.indexOf('const ui = {');
const uiObjStart = src.indexOf('{', uiStart);

// Extract the levels array
const levelsStart = src.indexOf('const levels = [');
const levelsArrStart = src.indexOf('[', levelsStart);

// Find the end of levels array — it's the "];" on its own line before "// SHARED CSS"
const sharedCssMarker = src.indexOf('// SHARED CSS');
const levelsEnd = src.lastIndexOf('];', sharedCssMarker) + 2;

// Find end of ui — it's the "};" before "// BASIC THEORY"
const basicTheoryMarker = src.indexOf('// BASIC THEORY');
const uiEnd = src.lastIndexOf('};', basicTheoryMarker) + 2;

// Use Function constructor to safely evaluate the data (pure data, no side effects)
const evalCode = src.substring(uiStart, uiEnd) + '\n' + src.substring(levelsStart, levelsEnd) +
  '\nreturn { ui, levels };';

const data = new Function(evalCode)();

const outPath = path.join(__dirname, 'course-data.json');
fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');

console.log(`Extracted ${Object.keys(data.ui).length} languages, ${data.levels.length} levels, ` +
  `${data.levels.reduce((s, l) => s + l.topics.length, 0)} topics`);
console.log(`Written to ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
