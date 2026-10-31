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
