#!/usr/bin/env node
/**
 * Splits the single-page Telegram archive into a multi-page browsable structure.
 * Run: node build-pages.js
 */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'evolyutsiya-koda-archive.html'), 'utf8');

// Helper: extract a balanced div from html starting at position pos
// where html[pos] starts with '<div'
function extractBalancedDiv(html, pos) {
  var depth = 0;
  var i = pos;
  while (i < html.length) {
    var openIdx = html.indexOf('<div', i);
    var closeIdx = html.indexOf('</div>', i);
    if (closeIdx === -1) break;
    if (openIdx !== -1 && openIdx < closeIdx) {
      depth++;
      i = openIdx + 4;
    } else {
      depth--;
      if (depth === 0) {
        return html.substring(pos, closeIdx + 6);
      }
      i = closeIdx + 6;
    }
  }
  return html.substring(pos);
}

// Extract topic sections
const topics = [];
var topicStartMarker = '<div id="topic-';
var searchPos = 0;

while (true) {
  var topicPos = html.indexOf(topicStartMarker, searchPos);
  if (topicPos === -1) break;

  var topicDiv = extractBalancedDiv(html, topicPos);

  // Extract id
  var idMatch = topicDiv.match(/id="(topic-\d+)"/);
  var id = idMatch ? idMatch[1] : 'unknown';

  // Extract title and count
  var titleMatch = topicDiv.match(/<h2>([\s\S]*?)<span class="msg-total">\((\d+) messages\)<\/span><\/h2>/);
  var title = titleMatch ? titleMatch[1].trim() : id;
  var count = titleMatch ? parseInt(titleMatch[2]) : 0;

  // Extract individual messages using balanced div extraction
  var messages = [];
  var msgSearchPos = 0;
  while (true) {
    var msgPos = topicDiv.indexOf('<div class="message', msgSearchPos);
    if (msgPos === -1) break;
    var msgDiv = extractBalancedDiv(topicDiv, msgPos);
    messages.push(msgDiv);
    msgSearchPos = msgPos + msgDiv.length;
  }

  topics.push({ id: id, title: title, count: count, messages: messages });
  searchPos = topicPos + topicDiv.length;
}

console.log('Found ' + topics.length + ' topics, total messages: ' + topics.reduce(function(s,t){return s+t.messages.length},0));

// Create output directory
const outDir = path.join(__dirname, 'site');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Shared CSS
const sharedCSS = `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#0e1621; color:#e4e6eb; }
a { color:#6ab2f2; text-decoration:none; }
a:hover { text-decoration:underline; }
.header { background:#17212b; padding:16px 24px; border-bottom:1px solid #2b3a4a; display:flex; align-items:center; gap:16px; position:sticky; top:0; z-index:10; }
.header h1 { font-size:18px; color:#6ab2f2; }
.header .back { color:#8696a4; font-size:14px; }
.container { max-width:900px; margin:0 auto; padding:20px 24px; }
.topic-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:12px; margin-top:20px; }
.topic-card { background:#17212b; border-radius:12px; padding:18px; border-left:3px solid #2b5278; transition:background 0.15s; display:block; }
.topic-card:hover { background:#1e2c3a; text-decoration:none; }
.topic-card h3 { color:#e4e6eb; font-size:15px; margin-bottom:6px; }
.topic-card .count { color:#8696a4; font-size:13px; }
.message { background:#17212b; border-radius:12px; padding:14px 18px; margin-bottom:10px; border-left:3px solid #2b5278; }
.sender { color:#6ab2f2; font-weight:600; font-size:13px; margin-bottom:4px; }
.msg-text { font-size:14px; line-height:1.6; word-wrap:break-word; }
.msg-date { color:#8696a4; font-size:11px; margin-top:6px; text-align:right; }
.stats-bar { display:flex; gap:24px; margin:16px 0; color:#8696a4; font-size:14px; }
.stats-bar span { color:#6ab2f2; font-weight:600; }
h2 { color:#6ab2f2; font-size:22px; margin-bottom:16px; padding-bottom:10px; border-bottom:1px solid #2b3a4a; }
.msg-total { font-size:14px; color:#8696a4; font-weight:normal; }
.pagination { display:flex; gap:8px; margin:20px 0; flex-wrap:wrap; }
.pagination a { background:#17212b; padding:6px 12px; border-radius:6px; color:#6ab2f2; font-size:13px; }
.pagination a.active { background:#2b5278; }
.footer { text-align:center; padding:30px; color:#8696a4; font-size:12px; margin-top:30px; border-top:1px solid #2b3a4a; }
`;

// Generate index.html
const totalMsgs = topics.reduce(function(s, t) { return s + t.count; }, 0);
const topicCardsHtml = topics.map(function(t) {
  const slug = t.title.replace(/[^a-zA-Z\u0400-\u04FF0-9]/g, '_').replace(/_+/g, '_');
  return '<a href="' + slug + '.html" class="topic-card"><h3>' + t.title + '</h3><div class="count">' + t.count + ' messages</div></a>';
}).join('\n');

const indexHtml = '<!DOCTYPE html>\n'
+ '<html lang="ru">\n<head>\n<meta charset="UTF-8">\n'
+ '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
+ '<title>Эволюция Кода - Telegram Archive</title>\n'
+ '<style>' + sharedCSS + '\n'
+ '.hero { text-align:center; padding:40px 20px; }\n'
+ '.hero h1 { font-size:32px; color:#6ab2f2; margin-bottom:8px; }\n'
+ '.hero p { color:#8696a4; font-size:16px; max-width:600px; margin:0 auto; line-height:1.6; }\n'
+ '</style>\n</head>\n<body>\n'
+ '<div class="hero">\n<h1>Эволюция Кода</h1>\n'
+ '<p>Telegram Group Archive - AI &amp; Programming Community</p>\n'
+ '<div class="stats-bar" style="justify-content:center; margin-top:16px;">\n'
+ '<div><span>' + topics.length + '</span> Topics</div>\n'
+ '<div><span>' + totalMsgs + '</span> Messages</div>\n'
+ '<div><span>870</span> Members</div>\n'
+ '</div>\n</div>\n'
+ '<div class="container">\n<h2>Topics</h2>\n'
+ '<div class="topic-grid">\n' + topicCardsHtml + '\n</div>\n'
+ '<div class="footer">Exported from Telegram Web on ' + new Date().toISOString().split('T')[0] + '</div>\n'
+ '</div>\n</body>\n</html>';

fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml);
console.log('Created index.html');

// Generate individual topic pages
var MSGS_PER_PAGE = 100;

topics.forEach(function(topic) {
  var slug = topic.title.replace(/[^a-zA-Z\u0400-\u04FF0-9]/g, '_').replace(/_+/g, '_');
  var totalPages = Math.ceil(topic.messages.length / MSGS_PER_PAGE) || 1;

  for (var page = 0; page < totalPages; page++) {
    var start = page * MSGS_PER_PAGE;
    var end = Math.min(start + MSGS_PER_PAGE, topic.messages.length);
    var pageMsgs = topic.messages.slice(start, end);

    var paginationHtml = '';
    if (totalPages > 1) {
      paginationHtml = '<div class="pagination">';
      for (var p = 0; p < totalPages; p++) {
        var pFile = p === 0 ? slug + '.html' : slug + '_page' + (p + 1) + '.html';
        var activeClass = p === page ? ' active' : '';
        paginationHtml += '<a href="' + pFile + '" class="' + activeClass + '">' + (p + 1) + '</a>';
      }
      paginationHtml += '</div>';
    }

    var fileName = page === 0 ? slug + '.html' : slug + '_page' + (page + 1) + '.html';
    var pageHtml = '<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n'
      + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
      + '<title>' + topic.title + ' - Эволюция Кода Archive</title>\n'
      + '<style>' + sharedCSS + '</style>\n</head>\n<body>\n'
      + '<div class="header">\n'
      + '<a href="index.html" class="back">← Back to Topics</a>\n'
      + '<h1>' + topic.title + '</h1>\n</div>\n'
      + '<div class="container">\n'
      + '<h2>' + topic.title + ' <span class="msg-total">(' + topic.count + ' messages'
      + (totalPages > 1 ? ', page ' + (page + 1) + '/' + totalPages : '') + ')</span></h2>\n'
      + paginationHtml + '\n'
      + pageMsgs.join('\n') + '\n'
      + paginationHtml + '\n'
      + '<div class="footer"><a href="index.html">← Back to all topics</a></div>\n'
      + '</div>\n</body>\n</html>';

    fs.writeFileSync(path.join(outDir, fileName), pageHtml);
  }

  console.log('Created ' + slug + '.html (' + totalPages + ' pages, ' + topic.count + ' msgs)');
});

console.log('\nDone! ' + topics.length + ' topic pages + index.html created in ./site/');
