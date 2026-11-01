const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { emit } = require('./emit-node');
const { tokenize, CODE_NODES } = require('./export-workflows');
const { check, fill, plan } = require('./build-workflows');

const ROOT = path.join(__dirname, '..');
const NAMES = ['ghost-translate-post', 'ghost-translate-sync', 'ghost-translate-batch', 'ghost-search-index'];
const load = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', n + '.json'), 'utf8'));
const config = { source_url: 'https://a.test', target_url: 'https://b.test', source_lang: 'ES', target_lang: 'EN-US', source_hreflang: 'es', target_hreflang: 'en', webhook_path: 'x'.repeat(32), data_table_id: 't1', translate_post_workflow_id: 'w1', search_index_workflow_id: 'w2' };
const full = { ...config, typesense_url: 'https://s.test', typesense_source_collection: 'es', typesense_target_collection: 'en', cover_service_url: 'http://cover:8000', cover_default_category: 'News', deepl_glossary_id: 'g1', skip_slugs: ['terms'], skip_title_regex: '^DRAFT', allow_lost: { p: ['s'] }, error_workflow_id: 'e1' };

test('templates carry nothing private', () => {
  for (const n of [...NAMES]) {
    const t = JSON.stringify(load(n));
    assert.doesNotMatch(t, /criptonautas|eeac4ee26c9c|28201961|1A8x4Ajzo|dB4sfMhT|dvYu8wxV|WPc3DZDf|NTR6mUfv|KOwdxezO|lzuhgFax|SrFAelNF|3cl4kcFN|6YeRd2MB|expandir|FUSIONADO|terminos|webhookId|errorWorkflow/i, n);
    for (const node of load(n).nodes) for (const c of Object.values(node.credentials || {})) assert.deepEqual(Object.keys(c), ['name']);
  }
});

test('template Code nodes match the code in this repository', () => {
  const nodes = load('ghost-translate-post').nodes;
  for (const [name, wrapper] of Object.entries(CODE_NODES)) {
    const node = nodes.find((n) => n.name === name);
    assert.equal(node.parameters.jsCode, JSON.parse('"' + tokenize(JSON.stringify(emit(wrapper)).slice(1, -1)) + '"'), name);
  }
});

for (const [label, c] of [['minimal', config], ['full', full]]) {
  test('a ' + label + ' config fills every template with valid Code nodes', () => {
    for (const n of NAMES) {
      const wf = fill(load(n), c);
      assert.doesNotMatch(JSON.stringify(wf), /__[A-Z_]+__/);
      for (const node of wf.nodes) if (node.parameters.jsCode) new Function('$', '$input', 'require', 'module', node.parameters.jsCode);
    }
  });
}

test('without optional services the nodes are off and the options gone', () => {
  const post = fill(load('ghost-translate-post'), config);
  assert.equal(post.nodes.find((n) => n.name === 'Upsert English Search').disabled, true);
  assert.equal(fill(load('ghost-translate-sync'), config).nodes.find((n) => n.name === 'Index Spanish').disabled, true);
  const deepl = post.nodes.find((n) => n.name === 'DeepL Translate').parameters.jsonBody;
  assert.doesNotMatch(deepl, /glossary_id/);
  assert.match(post.nodes.find((n) => n.name === 'Prepare Translation').parameters.jsCode, /const GENERATED = \/\$\^\//);
});

test('a full config reaches the nodes that use it', () => {
  const post = fill(load('ghost-translate-post'), full);
  assert.equal(post.settings.errorWorkflow, 'e1');
  assert.match(post.nodes.find((n) => n.name === 'DeepL Translate').parameters.jsonBody, /glossary_id: 'g1'/);
  const scope = post.nodes.find((n) => n.name === 'Out Of Scope').parameters.conditions.conditions[0].leftValue;
  assert.match(scope, /\["terms"\]/);
  assert.match(scope, /new RegExp\("\^DRAFT", 'i'\)/);
  assert.match(post.nodes.find((n) => n.name === 'Finish Translation').parameters.jsCode, /const ALLOW_LOST = \{"p":\["s"\]\}/);
  assert.equal(fill(load('ghost-translate-sync'), full).nodes.find((n) => n.name === 'Ghost Webhook').parameters.path, full.webhook_path);
});

test('sync verifies destructive events against the source', () => {
  const c = load('ghost-translate-sync').connections;
  assert.deepEqual(c['Route Event'].main.slice(1).map((o) => o[0].node), ['Verify Source', 'Verify Source']);
  assert.equal(c['Source Confirms'].main[0][0].node, 'Find State');
  assert.equal(c['Normalize Event'].main[0][0].node, 'Valid Event');
});

test('check refuses unsafe config and plan waits for the workflow ids', () => {
  assert.throws(() => check({ ...config, webhook_path: 'short' }), /webhook_path/);
  assert.throws(() => check({ ...config, source_url: 'https://a.test/' }), /source_url/);
  assert.doesNotThrow(() => check(config));
  assert.deepEqual(plan({ ...config, translate_post_workflow_id: '' }).files, ['ghost-translate-post']);
  assert.equal(plan(full).files.length, 4);
});
