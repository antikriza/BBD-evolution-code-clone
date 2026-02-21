const MAX_MSG_LEN = 4000;

function paginate(items, formatter, maxLen = MAX_MSG_LEN) {
  const pages = [];
  let current = '';

  for (const item of items) {
    const formatted = formatter(item);
    if (current.length + formatted.length + 2 > maxLen && current.length > 0) {
      pages.push(current);
      current = '';
    }
    current += (current ? '\n\n' : '') + formatted;
  }
  if (current) pages.push(current);
  return pages.length ? pages : [''];
}

module.exports = { paginate, MAX_MSG_LEN };
