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

// Two translations of one block must carry the same tags and the same links, in any order.
function shape(b) {
  const tags = (b.match(/<([a-zA-Z][\w-]*)/g) || []).map((t) => t.slice(1).toLowerCase()).sort();
  const urls = [...b.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => m[1]).sort();
  return JSON.stringify({ tags, urls });
}
const sameShape = (a, b) => shape(a) === shape(b);

const ES = 'https://criptonautas.co';
const EN = 'https://en.criptonautas.co';

function rewriteLinks(html, slugs, es = ES, en = EN) {
  const known = new Set(slugs);
  const esc = es.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('href="' + esc + '/([^/"?#]*)/?([?#][^"]*)?"', 'g');
  return html.replace(re, (m, slug, tail) => (slug === '' || known.has(slug)
    ? 'href="' + en + '/' + (slug ? slug + '/' : '') + (tail || '') + '"'
    : m));
}

const I18N = /<!--i18n-->[\s\S]*?<!--\/i18n-->/;
function hreflangBlock(slug, es = ES, en = EN) {
  return '<!--i18n--><link rel="alternate" hreflang="es" href="' + es + '/' + slug + '/">'
    + '<link rel="alternate" hreflang="en" href="' + en + '/' + slug + '/">'
    + '<link rel="alternate" hreflang="x-default" href="' + es + '/' + slug + '/"><!--/i18n-->';
}
// Markers keep any code injection the editors added by hand.
function mergeHead(head, block) {
  const h = head || '';
  return I18N.test(h) ? h.replace(I18N, () => block) : (h ? h + '\n' : '') + block;
}

// DeepL accepts at most 50 texts and 128 KiB per request.
function chunk(jobs, maxTexts = 40, maxChars = 50000) {
  const out = [];
  let cur = [], size = 0;
  for (const j of jobs) {
    if (cur.length && (cur.length >= maxTexts || size + j.text.length > maxChars)) { out.push(cur); cur = []; size = 0; }
    cur.push(j);
    size += j.text.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

Object.assign(module.exports, { shape, sameShape, rewriteLinks, hreflangBlock, mergeHead, chunk }); // export

// File names the cover service produces through Ghost's upload: cover.webp, cover-1.webp, ...
const GENERATED = /\/cover(-\d+)?\.(webp|png)$/i;
const isGeneratedCover = (url) => Boolean(url) && GENERATED.test(url);

// A drawn cover has the Spanish title baked in, so English gets its own; any other image is shared by URL.
function coverPlan({ esImage, enImage, cover }) {
  const es = esImage || null, en = enImage || null;
  if (!es) return { mode: 'none', url: null, changed: en !== null };
  if (!isGeneratedCover(es)) return { mode: 'copy', url: es, changed: en !== es };
  if (cover && cover.es === es && cover.url) return { mode: 'reuse', url: cover.url, changed: en !== cover.url };
  return { mode: 'generate', url: null, changed: true };
}

// Same fields as the Spanish `ghost` collection. Typesense computes the embedding itself.
function searchDoc(en, src, base = EN) {
  const plain = textOf(en.html || '');
  return {
    id: en.id,
    slug: en.slug,
    title: en.title,
    excerpt: en.custom_excerpt || en.excerpt || plain.slice(0, 200),
    url: base + '/' + en.slug + '/',
    feature_image: en.feature_image || '',
    html: en.html || '',
    plaintext: plain,
    authors: (src.authors || []).map((a) => a.name),
    tags: (en.tags || []).filter((t) => t.visibility === 'public').map((t) => t.name),
    published_at: Date.parse(en.published_at),
    updated_at: Date.parse(en.updated_at),
    visibility: 'public',
  };
}

Object.assign(module.exports, { isGeneratedCover, coverPlan, searchDoc }); // export
