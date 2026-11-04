// Turns raw n8n workflow JSON into the shareable templates in workflows/.
// Usage: node ghost-translate/export-workflows.js <dir with raw json>. Raw exports never enter the repository.
const fs = require('fs');
const path = require('path');
const { emit } = require('./emit-node');

const OUT = path.join(__dirname, '..', 'workflows');
const FILES = { 'ghost-translate-post': 'ghost-translate-post', 'ghost-translate-sync': 'ghost-translate-sync', 'ghost-translate-batch': 'ghost-translate-batch', 'ghost-search-index-es': 'ghost-search-index' };
const CODE_NODES = { 'Prepare Translation': 'prepare', 'Finish Translation': 'finish', 'Build Ghost Payload': 'payload', 'Build State Row': 'snapshot', 'Build Search Doc': 'search-doc', 'Build Source Head': 'source-head', 'Check Access': 'access-check', 'Apply Access': 'access-apply', 'Gate Search Doc': 'search-gate' };
const CREDENTIALS = { 'nautas-ghost-api': 'source-ghost-admin', 'ghost-en-admin-api': 'target-ghost-admin', 'DeepL account': 'deepl', 'deepl-api-2': 'deepl-fallback', 'typesense-ghost-en-write': 'typesense-target-write', 'typesense-ghost-write': 'typesense-source-write', 'criptonautas-featured-ghost-cover-token': 'cover-service-token' };

// Ids of the production instance stay out of git: export-private.json maps each one to its token.
const PRIVATE_FILE = path.join(__dirname, '..', 'export-private.json');
const PRIVATE = fs.existsSync(PRIVATE_FILE) ? Object.entries(JSON.parse(fs.readFileSync(PRIVATE_FILE, 'utf8'))) : [];

// Applied to JSON text, so quotes and backslashes appear escaped. Order matters: longer hosts first.
const TOKENS = [
  ...PRIVATE,
  [/ghost-translate-[a-f0-9]{32}/g, '__WEBHOOK_PATH__'],
  ['https://typesense.criptonautas.co', '__TYPESENSE_URL__'],
  ['they must not turn links into en.criptonautas.co', 'they must not turn links into the target site'],
  ['https://en.criptonautas.co', '__TARGET_URL__'],
  ['https://criptonautas.co', '__SOURCE_URL__'],
  ['http://criptonautas-featured-cover:8000', '__COVER_SERVICE_URL__'],
  ['https://api-free.deepl.com', '__DEEPL_API_URL__'],
  ["source_lang: 'ES'", "source_lang: '__SOURCE_LANG__'"],
  ["target_lang: 'EN-US'", "target_lang: '__TARGET_LANG__'"],
  ['hreflang=\\"es\\"', 'hreflang=\\"__SOURCE_HREFLANG__\\"'],
  ['hreflang=\\"en\\"', 'hreflang=\\"__TARGET_HREFLANG__\\"'],
  ['collections/ghost_en/', 'collections/__TYPESENSE_TARGET_COLLECTION__/'],
  ['collections/ghost/', 'collections/__TYPESENSE_SOURCE_COLLECTION__/'],
  ["['terminos','privacidad','home']", '__SKIP_SLUGS__'],
  ['/^FUSIONADO/i', '__SKIP_TITLE_REGEX__'],
  ["?.name ?? 'Criptonautas'", "?.name ?? '__COVER_DEFAULT_CATEGORY__'"],
  ['/\\\\/cover(-\\\\d+)?\\\\.(webp|png)$/i', '__GENERATED_COVER_REGEX__'],
  ["// The owner accepts losing the strikethrough in these posts' p<s>l</s>andemia wordplay.", '// Per post exceptions: slug to the inline tags a translation may drop.'],
  ["{ 'expandir-dinero': ['s'], 'circular-2': ['s'] }", '__ALLOW_LOST__'],
];
const tokenize = (text) => TOKENS.reduce((t, [from, to]) => t.split ? (from instanceof RegExp ? t.replace(from, to) : t.split(from).join(to)) : t, text);

function template(raw) {
  const w = raw.workflow;
  const nodes = w.nodes.map((n) => {
    const node = { ...n };
    delete node.webhookId;
    if (node.credentials) {
      node.credentials = Object.fromEntries(Object.entries(node.credentials).map(([k, c]) => {
        if (!CREDENTIALS[c.name]) throw new Error('Unmapped credential: ' + c.name);
        return [k, { name: CREDENTIALS[c.name] }];
      }));
    }
    if (node.notes) {
      node.notes = node.notes.replace(/ ?core\.js sha256 [a-f0-9]+/, '').replace('Credential typesense-ghost-en-write does not exist yet: bind it before any live run.', '').trim();
      if (!node.notes) delete node.notes;
    }
    if (w.name === 'ghost-translate-post' && CODE_NODES[n.name]) node.parameters = { ...n.parameters, jsCode: emit(CODE_NODES[n.name]) };
    return node;
  });
  const out = { name: w.name === 'ghost-search-index-es' ? 'ghost-search-index' : w.name, description: w.description, nodes, connections: w.connections, settings: { executionOrder: w.settings.executionOrder } };
  return JSON.parse(tokenize(JSON.stringify(out)).replace(/ghost-search-index-es/g, 'ghost-search-index'));
}

module.exports = { template, tokenize, CODE_NODES, OUT };
if (require.main === module) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, file] of Object.entries(FILES)) {
    const raw = JSON.parse(fs.readFileSync(path.join(process.argv[2], name + '.json'), 'utf8'));
    fs.writeFileSync(path.join(OUT, file + '.json'), JSON.stringify(template(raw), null, 2) + '\n');
  }
}
