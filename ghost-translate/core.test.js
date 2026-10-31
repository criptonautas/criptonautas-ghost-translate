const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('./core');

test('splitBlocks keeps top-level elements whole', () => {
  const html = '<p>One <em>two</em></p>\n<figure><img src="a.png"><figcaption>Cap</figcaption></figure>\n<h2>Head</h2>';
  assert.deepEqual(c.splitBlocks(html), [
    '<p>One <em>two</em></p>',
    '<figure><img src="a.png"><figcaption>Cap</figcaption></figure>',
    '<h2>Head</h2>',
  ]);
});

test('splitBlocks treats comments, void tags, scripts and loose text as blocks', () => {
  const html = '<!--kg-card-begin: html--><div><b>x</b></div><!--kg-card-end: html--><hr><script>if (a<b) {}</script>loose text<p>end</p>';
  assert.deepEqual(c.splitBlocks(html), [
    '<!--kg-card-begin: html-->', '<div><b>x</b></div>', '<!--kg-card-end: html-->',
    '<hr>', '<script>if (a<b) {}</script>', 'loose text', '<p>end</p>',
  ]);
});

test('splitBlocks survives > inside attributes, stray closers and unclosed tags', () => {
  assert.deepEqual(c.splitBlocks('<p data-x="a>b">hi</p></div><p>open'), ['<p data-x="a>b">hi</p>', '<p>open']);
  // a void tag proves quoted attributes are honoured: a naive scan would cut it at the first >
  assert.deepEqual(c.splitBlocks('<img alt="a>b" src="x.png"><p>z</p>'), ['<img alt="a>b" src="x.png">', '<p>z</p>']);
});

test('classification of blocks', () => {
  assert.equal(c.needsTranslation('<p>Hola</p>'), true);
  assert.equal(c.needsTranslation('<figure><img src="a.png"></figure>'), false);
  assert.equal(c.needsTranslation('<!--kg-card-begin: html-->'), false);
  assert.equal(c.needsTranslation('<pre><code>x = 1</code></pre>'), false);
  assert.equal(c.isJunk('<p><span style="white-space: pre-wrap;"></span></p>'), true);
  assert.equal(c.isJunk('<figure><img src="a.png"></figure>'), false);
  assert.equal(c.isJunk('<!--kg-card-end: html-->'), false);
  assert.deepEqual(c.units('<p>A</p><p><br></p><hr>'), ['<p>A</p>', '<hr>']);
});

test('sameShape ignores the order of inline tags but not links', () => {
  const a = '<p><b>A</b> y <i>B</i> <a href="https://x.co/">c</a></p>';
  assert.equal(c.sameShape(a, '<p><i>B</i> and <b>A</b> <a href="https://x.co/">c</a></p>'), true);
  assert.equal(c.sameShape(a, '<p><b>A</b> and <i>B</i> c</p>'), false);
  assert.equal(c.sameShape(a, '<p><b>A</b> and <i>B</i> <a href="https://x.co/other">c</a></p>'), false);
});

test('rewriteLinks only touches pages that exist in English', () => {
  const html = '<a href="https://criptonautas.co/faq/">f</a><a href="https://criptonautas.co/nope/">n</a>'
    + '<a href="https://criptonautas.co/tag/x/">t</a><a href="https://criptonautas.co/">h</a>'
    + '<img src="https://criptonautas.co/content/images/a.png"><a href="https://criptonautas.co/faq/#top">q</a>';
  assert.equal(c.rewriteLinks(html, ['faq']),
    '<a href="https://en.criptonautas.co/faq/">f</a><a href="https://criptonautas.co/nope/">n</a>'
    + '<a href="https://criptonautas.co/tag/x/">t</a><a href="https://en.criptonautas.co/">h</a>'
    + '<img src="https://criptonautas.co/content/images/a.png"><a href="https://en.criptonautas.co/faq/#top">q</a>');
});

test('mergeHead replaces only its own block', () => {
  const b = c.hreflangBlock('faq');
  const once = c.mergeHead('<script>keep()</script>', b);
  assert.ok(once.startsWith('<script>keep()</script>'));
  assert.equal(c.mergeHead(once, b), once);
  assert.equal(c.mergeHead(null, b), b);
  assert.match(b, /hreflang="x-default" href="https:\/\/criptonautas\.co\/faq\/"/);
});

test('chunk respects text and character limits', () => {
  const jobs = [1, 2, 3, 4, 5].map((n) => ({ id: String(n), text: 'x'.repeat(10) }));
  assert.deepEqual(c.chunk(jobs, 2, 1000).map((g) => g.length), [2, 2, 1]);
  assert.deepEqual(c.chunk(jobs, 40, 25).map((g) => g.length), [2, 2, 1]);
  assert.deepEqual(c.chunk([{ id: 'big', text: 'x'.repeat(99) }], 40, 25).map((g) => g.length), [1]);
  assert.deepEqual(c.chunk([], 40, 25), []);
});

test('isGeneratedCover recognises only the cover service file names', () => {
  for (const u of ['https://criptonautas.co/content/images/2026/10/cover.webp', 'https://criptonautas.co/content/images/2026/10/cover-12.webp', 'https://x.co/a/cover.png']) {
    assert.equal(c.isGeneratedCover(u), true, u);
  }
  for (const u of ['https://criptonautas.co/content/images/2026/10/trump-1.png', 'https://x.co/discover.webp', 'https://x.co/my-cover.webp', '', null]) {
    assert.equal(c.isGeneratedCover(u), false, String(u));
  }
});

test('coverPlan decides when English needs its own cover', () => {
  const gen = 'https://criptonautas.co/content/images/2026/10/cover-2.webp';
  const photo = 'https://criptonautas.co/content/images/2026/10/trump-1.png';
  const own = 'https://en.criptonautas.co/content/images/2026/10/cover.webp';
  assert.deepEqual(c.coverPlan({ esImage: null, enImage: null, cover: null }), { mode: 'none', url: null, changed: false });
  assert.deepEqual(c.coverPlan({ esImage: photo, enImage: photo, cover: null }), { mode: 'copy', url: photo, changed: false });
  assert.deepEqual(c.coverPlan({ esImage: photo, enImage: null, cover: null }), { mode: 'copy', url: photo, changed: true });
  assert.deepEqual(c.coverPlan({ esImage: gen, enImage: null, cover: null }), { mode: 'generate', url: null, changed: true });
  assert.deepEqual(c.coverPlan({ esImage: gen, enImage: own, cover: { es: gen, url: own } }), { mode: 'reuse', url: own, changed: false });
  // the Spanish cover was replaced, so the English one is drawn again
  assert.equal(c.coverPlan({ esImage: gen, enImage: own, cover: { es: 'https://x.co/cover-9.webp', url: own } }).mode, 'generate');
});

test('searchDoc carries the fields of the ghost collection', () => {
  const en = {
    id: 'e1', slug: 'faq', title: 'FAQ', custom_excerpt: null, excerpt: 'Short', html: '<p>Hello <b>world</b></p>', feature_image: null,
    published_at: '2026-10-28T04:39:45.000Z', updated_at: '2026-10-28T05:00:09.000Z',
    tags: [{ name: 'monero', visibility: 'public' }, { name: '#nivel-1', visibility: 'internal' }],
  };
  assert.deepEqual(c.searchDoc(en, { authors: [{ name: 'satonotdead' }] }), {
    id: 'e1', slug: 'faq', title: 'FAQ', excerpt: 'Short', url: 'https://en.criptonautas.co/faq/', feature_image: '',
    html: en.html, plaintext: 'Hello world', authors: ['satonotdead'], tags: ['monero'],
    published_at: Date.parse(en.published_at), updated_at: Date.parse(en.updated_at), visibility: 'public',
  });
});

const posts = require('./fixtures/posts.json').posts;
const fake = (t) => t.replace(/>([^<]+)</g, (m, x) => '>EN ' + x + '<'); // keeps tags and links
const fieldsOf = (p) => ({ title: p.slug, custom_excerpt: p.custom_excerpt, meta_description: p.meta_description });
function run(input, slugs = []) {
  const prepared = c.prepare(input);
  const tr = { fields: {}, blocks: {} };
  for (const j of prepared.jobs.fields) tr.fields[j.id] = 'EN ' + j.text;
  for (const j of prepared.jobs.blocks) tr.blocks[j.id] = fake(j.text);
  return { prepared, f: c.finish({ prepared, translations: tr, slugs }) };
}
const firstRun = (p) => {
  const a = run({ fields: fieldsOf(p), html: p.html, state: null, en: null });
  const state = c.snapshot(a.f.state, a.f.html);
  return { a, state, en: { fields: a.f.fields, html: a.f.html } };
};

test('every real post splits without losing text or links', () => {
  for (const p of posts) {
    const joined = c.units(p.html).join('\n');
    assert.equal(c.textOf(joined), c.textOf(p.html), p.slug);
    assert.deepEqual(JSON.parse(c.shape(joined)).urls, JSON.parse(c.shape(p.html)).urls, p.slug);
  }
});

test('first run translates, second run is a no-op with zero jobs', () => {
  for (const p of posts) {
    const { a, state, en } = firstRun(p);
    assert.equal(a.f.ok, true, p.slug + ': ' + a.f.problems.join('; '));
    assert.equal(state.aligned, true, p.slug + ' not aligned');
    const b = c.prepare({ fields: fieldsOf(p), html: p.html, state, en });
    assert.equal(b.jobs.blocks.length + b.jobs.fields.length, 0, p.slug);
    assert.equal(b.noop, true, p.slug);
  }
});

test('editing one paragraph re-translates exactly one block', () => {
  const p = posts.find((x) => x.slug === 'patrones');
  const { state, en } = firstRun(p);
  const blocks = c.units(p.html);
  const i = blocks.findIndex((b) => b.startsWith('<p>'));
  blocks[i] = blocks[i].replace('</p>', ' Nueva frase.</p>');
  const r = run({ fields: fieldsOf(p), html: blocks.join('\n'), state, en });
  assert.equal(r.prepared.jobs.blocks.length, 1);
  assert.equal(r.prepared.jobs.fields.length, 0);
  assert.equal(r.prepared.noop, false);
});

test('inserting a paragraph translates only the new one', () => {
  const p = posts.find((x) => x.slug === 'tor-1');
  const { state, en } = firstRun(p);
  const blocks = c.units(p.html);
  blocks.splice(3, 0, '<p>Inserto nuevo.</p>');
  const r = run({ fields: fieldsOf(p), html: blocks.join('\n'), state, en });
  assert.equal(r.prepared.jobs.blocks.length, 1);
  assert.match(r.f.html, /EN Inserto nuevo\./);
});

test('a hand edit in English survives a Spanish edit elsewhere, but not in the same block', () => {
  const p = posts.find((x) => x.slug === 'monero-3');
  const { state, en } = firstRun(p);
  const src = c.units(p.html);
  const text = src.map((b, i) => (c.needsTranslation(b) ? i : -1)).filter((i) => i >= 0);
  const first = text[0], last = text[text.length - 1];
  assert.notEqual(first, last);
  const enBlocks = c.units(en.html);
  enBlocks[first] = '<p>MANUAL FIX</p>';
  const enEdited = { fields: en.fields, html: enBlocks.join('\n') };
  const untouched = c.prepare({ fields: fieldsOf(p), html: p.html, state, en: enEdited });
  assert.equal(untouched.noop, true);
  const other = src.slice(); other[last] = other[last].replace('</p>', ' Cambio.</p>');
  const kept = run({ fields: fieldsOf(p), html: other.join('\n'), state, en: enEdited });
  assert.match(kept.f.html, /MANUAL FIX/);
  assert.equal(kept.prepared.kept, 1);
  const same = src.slice(); same[first] = same[first].replace('</p>', ' Cambio.</p>');
  const overwritten = run({ fields: fieldsOf(p), html: same.join('\n'), state, en: enEdited });
  assert.doesNotMatch(overwritten.f.html, /MANUAL FIX/);
});

test('finish rejects a translation that drops a link', () => {
  const html = '<p>Ver <a href="https://x.co/">esto</a></p>';
  const prepared = c.prepare({ fields: {}, html, state: null, en: null });
  const f = c.finish({ prepared, translations: { fields: {}, blocks: { [prepared.jobs.blocks[0].id]: '<p>See this</p>' } }, slugs: [] });
  assert.equal(f.ok, false);
  assert.match(f.problems[0], /shape mismatch/);
});

test('finish reports a missing translation instead of writing blanks', () => {
  const prepared = c.prepare({ fields: { title: 'Hola' }, html: '<p>Hola</p>', state: null, en: null });
  const f = c.finish({ prepared, translations: { fields: {}, blocks: {} }, slugs: [] });
  assert.equal(f.ok, false);
});

test('output hash changes when a linked page becomes translated', () => {
  const html = '<p><a href="https://criptonautas.co/faq/">q</a></p>';
  const a = run({ fields: {}, html, state: null, en: null }, []);
  const b = run({ fields: {}, html, state: null, en: null }, ['faq']);
  assert.notEqual(a.f.state.out, b.f.state.out);
});

test('a field edited by hand in English is kept while Spanish is unchanged', () => {
  const p = posts[0];
  const { state, en } = firstRun(p);
  const r = c.prepare({ fields: fieldsOf(p), html: p.html, state, en: { fields: { ...en.fields, title: 'My own title' }, html: en.html } });
  assert.equal(r.fields.title.t, 'My own title');
});

test('emitted Code node bodies are valid JavaScript and carry no exports', () => {
  const { execFileSync } = require('node:child_process');
  for (const name of ['prepare', 'finish', 'payload', 'snapshot', 'search-doc', 'source-head']) {
    const code = execFileSync('node', [__dirname + '/emit-node.js', name], { encoding: 'utf8' });
    assert.doesNotMatch(code, /module\.exports/);
    assert.doesNotThrow(() => new Function('$', '$input', 'require', code), name);
  }
});
