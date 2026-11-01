const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('./access');
const { emit } = require('./emit-node');

test('accessFields copies the gate of the source and refuses to guess', () => {
  assert.deepEqual(a.accessFields({ visibility: 'public', tiers: [{ slug: 'free' }] }), { visibility: 'public' });
  assert.deepEqual(a.accessFields({ visibility: 'paid' }), { visibility: 'paid' });
  assert.deepEqual(a.accessFields({ visibility: 'tiers', tiers: [{ slug: 'b' }, { slug: 'a' }] }), { visibility: 'tiers', tiers: [{ slug: 'a' }, { slug: 'b' }] });
  assert.throws(() => a.accessFields({ slug: 'x' }), /no visibility/);
});

test('accessChanged sees a newly gated post but ignores tier lists on public posts', () => {
  assert.equal(a.accessChanged({ visibility: 'public' }, null), false);
  assert.equal(a.accessChanged({ visibility: 'paid' }, { visibility: 'public' }), true);
  assert.equal(a.accessChanged({ visibility: 'public', tiers: [{ slug: 'a' }] }, { visibility: 'public', tiers: [] }), false);
  assert.equal(a.accessChanged({ visibility: 'tiers', tiers: [{ slug: 'a' }] }, { visibility: 'tiers', tiers: [{ slug: 'b' }] }), true);
  assert.equal(a.accessChanged({ visibility: 'tiers', tiers: [{ slug: 'a' }, { slug: 'b' }] }, { visibility: 'tiers', tiers: [{ slug: 'b' }, { slug: 'a' }] }), false);
});

test('gateSearchDoc keeps gated text out of the index, also when visibility is missing', () => {
  const doc = { id: 'x', html: '<p>Secret</p>', plaintext: 'Secret', excerpt: 'Secret', visibility: 'public' };
  for (const src of [{ visibility: 'paid' }, { visibility: 'members' }, { visibility: 'tiers' }, {}]) {
    const out = a.gateSearchDoc(doc, src);
    assert.equal(out.html + out.plaintext + out.excerpt, '');
    assert.notEqual(out.visibility, 'public');
  }
  assert.equal(a.gateSearchDoc(doc, { visibility: 'public' }).html, '<p>Secret</p>');
});

test('the access nodes run as emitted', () => {
  const nodes = { Context: { type: 'posts' }, 'Fetch Source': { posts: [{ visibility: 'paid' }] }, 'Get English': { posts: [{ visibility: 'public' }] } };
  const $ = (n) => ({ first: () => ({ json: nodes[n] }) });
  const run = (name, input) => new Function('$', '$input', 'module', emit(name))($, { first: () => ({ json: input }) }, { exports: {} })[0].json;
  assert.equal(run('access-check').changed, true);
  assert.equal(run('access-apply', { body: { posts: [{ visibility: 'public' }] } }).body.posts[0].visibility, 'paid');
  assert.equal(run('search-gate', { doc: { html: 'x', visibility: 'public' } }).doc.html, '');
});
