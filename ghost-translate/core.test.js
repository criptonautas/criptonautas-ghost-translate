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

test('sameShape tolerates a split inline span but not a lost one', () => {
  const a = '<p>La <em>frase semilla</em> va<br>aqui</p>';
  assert.equal(c.sameShape(a, '<p>The <em>seed</em> <em>phrase</em> goes<br>here</p>'), true);
  assert.equal(c.sameShape(a, '<p>The seed phrase goes<br>here</p>'), false);
  assert.equal(c.sameShape(a, '<p>The <em>seed phrase</em> goes here</p>'), false);
});

test('sameShape tolerates a split link but not a lost or changed url', () => {
  const a = '<p>Ver <a href="https://x.co/">este enlace</a><br>hoy</p>';
  assert.equal(c.sameShape(a, '<p>See <a href="https://x.co/">this</a> <a href="https://x.co/">link</a><br>today</p>'), true);
  assert.equal(c.sameShape(a, '<p>See <a href="https://y.co/">this</a><br>today</p>'), false);
  assert.equal(c.sameShape(a, '<p>See this<br>today</p>'), false);
  assert.equal(c.sameShape('<p><a href="https://x.co/">a</a> <a href="https://y.co/">b</a></p>', '<p><a href="https://x.co/">a b</a></p>'), false);
  assert.equal(c.sameShape('<p>p<s>l</s>andemia</p>', '<p>plandemic</p>'), false);
});

test('markup in a field goes to DeepL as plain text and is hashed raw', () => {
  const raw = '<i><em class="italic">as above, so below</em></i>';
  const p = c.prepare({ fields: { caption: raw }, html: '', state: null, en: null });
  assert.deepEqual(p.jobs.fields.map((j) => j.text), ['as above, so below']);
  assert.equal(p.fields.caption.h, c.sha(raw));
  const state = { fields: { caption: { h: c.sha(raw), t: 'x' } }, body: [] };
  const edited = c.prepare({ fields: { caption: '<i>as above, so below</i>' }, html: '', state, en: null });
  assert.equal(edited.jobs.fields.length, 1);
  assert.equal(c.prepare({ fields: { caption: '<br>' }, html: '', state: null, en: null }).jobs.fields.length, 0);
});

test('allowLost tolerates only the named tag, and only in the wrapper for its slug', () => {
  const src = '<p>p<s>l</s>andemia <em>x</em> <a href="https://x.co/">y</a></p>';
  const lostS = '<p>plandemic <em>x</em> <a href="https://x.co/">y</a></p>';
  assert.equal(c.sameShape(src, lostS), false);
  assert.equal(c.sameShape(src, lostS, ['s']), true);
  assert.equal(c.sameShape(src, '<p>plandemic x <a href="https://x.co/">y</a></p>', ['s']), false);
  assert.equal(c.sameShape(src, '<p>plandemic <em>x</em> y</p>', ['s']), false);
  assert.equal(c.sameShape('<p>a</p>', '<p><s>a</s></p>', ['s']), false);
  const { execFileSync } = require('node:child_process');
  const code = execFileSync('node', [__dirname + '/emit-node.js', 'finish'], { encoding: 'utf8' });
  const run = (slug) => {
    const prepared = c.prepare({ fields: {}, html: '<p>p<s>l</s>andemia</p>', state: null, en: null });
    const job = prepared.jobs.blocks[0];
    const data = {
      'Prepare Translation': [{ json: { kind: 'html', ids: [job.id], chars: 9, prepared, old_out: null } }],
      'DeepL Translate': [{ json: { translations: [{ text: '<p>plandemic</p>' }] } }],
      'Known Slugs': [{ json: {} }],
      Context: [{ json: { slug, type: 'posts' } }],
      'Fetch Source': [{ json: { posts: [{ feature_image: null }] } }],
      'Get State': [{ json: {} }],
      'Get English': [{ json: {} }],
    };
    const $ = (n) => ({ all: () => data[n], first: () => data[n][0] });
    return new Function('$', 'require', code)($, require);
  };
  assert.equal(run('expandir-dinero')[0].json.ok, true);
  assert.throws(() => run('other'), /shape mismatch/);
});

test('a self-closed div keeps its closer and an empty mount point is not junk', () => {
  const html = '<!--kg-card-begin: html--><p></p><div id="meet" /></div><!--kg-card-end: html-->';
  assert.deepEqual(c.units(html), ['<!--kg-card-begin: html-->', '<div id="meet" /></div>', '<!--kg-card-end: html-->']);
  assert.deepEqual(c.splitBlocks('<svg><path d="M0"/><path d="M1"/></svg><p>x</p>'), ['<svg><path d="M0"/><path d="M1"/></svg>', '<p>x</p>']);
  assert.equal(c.isJunk('<div class="mount"></div>'), false);
  assert.equal(c.isJunk('<h1 id=""></h1>'), true);
  assert.equal(c.isJunk('<style>.a{}</style>'), false);
  assert.equal(c.isJunk('<p><span style="white-space: pre-wrap;"></span></p>'), true);
  assert.equal(c.isJunk('<p></p>'), true);
});

test('raw blocks outside a card are wrapped once, adjacent ones together', () => {
  const stats = '<iframe src="https://s.co/x"></iframe>\n<script async src="https://s.co/j.js"></script>';
  const a = c.prepare({ fields: {}, html: stats, state: null, en: null });
  assert.deepEqual(a.body.map((u) => u.src), ['<!--kg-card-begin: html-->', '<iframe src="https://s.co/x"></iframe>', '<script async src="https://s.co/j.js"></script>', '<!--kg-card-end: html-->']);
  assert.equal(a.jobs.blocks.length, 0);
  const f = c.finish({ prepared: a, translations: { fields: {}, blocks: {} }, slugs: [] });
  const state = c.snapshot(f.state, f.html);
  assert.equal(state.aligned, true);
  const inCard = '<!--kg-card-begin: html--><script>x()</script><!--kg-card-end: html-->';
  assert.deepEqual(c.prepare({ fields: {}, html: inCard, state: null, en: null }).body.map((u) => u.src), c.units(inCard));
  assert.deepEqual(c.prepare({ fields: {}, html: '<figure class="kg-card kg-embed-card"><iframe src="x"></iframe></figure>', state: null, en: null }).body.length, 1);
  assert.equal(c.prepare({ fields: {}, html: stats, state, en: { fields: {}, html: f.html } }).noop, true);
});

test('bookmark metadata comes from the source, in every card, and self-repairs stored blocks', () => {
  const card = (title, meta) => '<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://x.co/"><div class="kg-bookmark-content"><div class="kg-bookmark-title">' + title + '</div><div class="kg-bookmark-metadata">' + meta + '</div></div></a></figure>';
  const good = '<img class="kg-bookmark-icon" src="https://x.co/i.png" alt=""><span class="kg-bookmark-author">Comunidad Criptonauta</span><span class="kg-bookmark-publisher">satoshinotdead</span>';
  const bad = '<img class="kg-bookmark-icon" src="https://x.co/i.png" alt=""><span class="kg-bookmark-author">Criptonauts Community atoshinotdead</span>';
  const src = '<div>' + card('Hola', good) + card('Chau', good) + '</div>';
  const translated = '<div>' + card('Hello', bad) + card('Bye', bad) + '</div>';
  const fresh = c.prepare({ fields: {}, html: src, state: null, en: null });
  const one = c.finish({ prepared: fresh, translations: { fields: {}, blocks: { [fresh.jobs.blocks[0].id]: translated } }, slugs: [] });
  assert.equal(one.html, '<div>' + card('Hello', good) + card('Bye', good) + '</div>');
  // a row written before this fix repairs itself with no DeepL job, then settles
  const oldState = c.snapshot({ fields: {}, body: [{ h: c.sha(src), t: translated }], out: c.sha(translated), enh: null, aligned: false }, translated);
  const live = { fields: {}, html: translated };
  const repair = c.prepare({ fields: {}, html: src, state: oldState, en: live });
  assert.equal(repair.jobs.blocks.length, 0);
  const fixed = c.finish({ prepared: repair, translations: { fields: {}, blocks: {} }, slugs: [] });
  assert.equal(fixed.html, one.html);
  assert.notEqual(fixed.state.out, oldState.out);
  const settled = c.snapshot(fixed.state, fixed.html);
  const again = c.prepare({ fields: {}, html: src, state: settled, en: { fields: {}, html: fixed.html } });
  assert.equal(again.noop, true);
  assert.equal(c.finish({ prepared: again, translations: { fields: {}, blocks: {} }, slugs: [] }).state.out, settled.out);
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

test('an unchanged post still writes when its English twin is not published', () => {
  const { execFileSync } = require('node:child_process');
  const code = execFileSync('node', [__dirname + '/emit-node.js', 'finish'], { encoding: 'utf8' });
  const html = '<p>Hola mundo</p>';
  const fields = { title: 'Hola' };
  const first = c.prepare({ fields, html, state: null, en: null });
  const f = c.finish({ prepared: first, translations: { fields: { [first.fields.title.h]: 'Hello' }, blocks: { [first.body[0].h]: '<p>Hello world</p>' } }, slugs: [] });
  const state = c.snapshot(f.state, f.html);
  const run = (status) => {
    const en = { status, html: f.html, feature_image: null, title: 'Hello' };
    const prepared = c.prepare({ fields, html, state, en: { fields: { title: 'Hello' }, html: f.html } });
    const nodes = {
      'Prepare Translation': { kind: 'none', chars: 0, prepared, old_out: state.out },
      'Known Slugs': { slug: 'a' },
      Context: { slug: 'a', type: 'posts' },
      'Fetch Source': { posts: [{ feature_image: null }] },
      'Get State': { state: JSON.stringify(state) },
      'Get English': { posts: [en] },
    };
    const $ = (n) => {
      if (!nodes[n]) throw new Error('not executed');
      return { first: () => ({ json: nodes[n] }), all: () => [{ json: nodes[n] }] };
    };
    return new Function('$', '$input', 'require', code)($, {}, require)[0].json;
  };
  assert.equal(run('published').noop, true);
  assert.equal(run('published').write, false);
  assert.equal(run('draft').write, true);
  assert.equal(run('draft').jobs, 0);
});
