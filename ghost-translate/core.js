const crypto = require('crypto');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style']);
const MEDIA = /<(img|iframe|video|audio|hr|svg|embed|object|canvas)\b/i;

// Ghost HTML is well formed, so a depth counter is enough and no parser library is needed.
function splitBlocks(html) {
  const blocks = [];
  const lower = html.toLowerCase();
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)(?:"[^"]*"|'[^']*'|[^>"'])*>/g;
  let depth = 0, from = 0, open = 0, m;
  const flush = (upto) => {
    const t = html.slice(from, upto).trim();
    if (t) blocks.push(t);
    from = upto;
  };
  while ((m = re.exec(html))) {
    const tok = m[0], close = m[1], tag = m[2] ? m[2].toLowerCase() : '';
    let end = re.lastIndex;
    if (close) {
      if (depth === 0) { flush(m.index); from = end; continue; }
      if (--depth === 0) { blocks.push(html.slice(open, end)); from = end; }
      continue;
    }
    if (depth === 0) flush(m.index);
    if (RAW.has(tag)) {
      const at = lower.indexOf('</' + tag, end);
      const gt = at < 0 ? -1 : html.indexOf('>', at);
      end = gt < 0 ? html.length : gt + 1;
      re.lastIndex = end;
    }
    if (!tag || VOID.has(tag) || RAW.has(tag) || tok.endsWith('/>')) {
      if (depth === 0) { blocks.push(html.slice(m.index, end)); from = end; }
      continue;
    }
    if (depth === 0) open = m.index;
    depth++;
  }
  flush(html.length);
  return blocks;
}

const isComment = (b) => b.startsWith('<!--');
const textOf = (b) => b
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
// Code blocks and comments are never sent to DeepL.
const needsTranslation = (b) => !isComment(b) && !/^<pre\b/i.test(b) && textOf(b) !== '';
// Blocks Ghost drops on import anyway (empty spacer paragraphs).
const isJunk = (b) => !isComment(b) && textOf(b) === '' && !MEDIA.test(b) && !/<script\b/i.test(b);
const units = (html) => splitBlocks(html || '').filter((b) => !isJunk(b));

Object.assign(module.exports, { sha, splitBlocks, textOf, needsTranslation, isJunk, units }); // export
