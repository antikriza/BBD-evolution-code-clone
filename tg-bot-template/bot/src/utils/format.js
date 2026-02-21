function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(s, max) {
  if (!s || s.length <= max) return s;
  return s.substring(0, max - 3) + '...';
}

module.exports = { escHtml, truncate };
