// Fills the templates in workflows/ with config.json and writes importable files to build/.
// Usage: node ghost-translate/build-workflows.js [config.json]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OPTIONAL_SEARCH = ['Upsert English Search', 'Delete Search Doc', 'Index Spanish'];
const NEVER = '/$^/';
const FALLBACK_NODES = ['DeepL Fallback', 'Fallback Usage Before', 'Fallback Usage After'];

function check(c) {
  const problems = [];
  for (const k of ['source_url', 'target_url']) if (!/^https:\/\/[^/]+$/.test(c[k] || '')) problems.push(k + ' must look like https://example.com, with no trailing slash');
  if (c.source_url === c.target_url) problems.push('source_url and target_url must differ');
  if (!/^[a-zA-Z0-9-]{32,}$/.test(c.webhook_path || '')) problems.push('webhook_path must be at least 32 random characters; it is the only thing hiding the webhook');
  for (const k of ['data_table_id', 'source_lang', 'target_lang', 'source_hreflang', 'target_hreflang']) if (!c[k]) problems.push(k + ' is required');
  if (c.typesense_url && !(c.typesense_source_collection && c.typesense_target_collection)) problems.push('typesense_url needs both collections');
  if (problems.length) throw new Error('Invalid config:\n- ' + problems.join('\n- '));
}

// Values land inside JSON text, so they are escaped the way JSON.stringify escapes them.
const esc = (v) => JSON.stringify(String(v)).slice(1, -1);

function fill(template, c) {
  let text = JSON.stringify(template);
  if (!c.deepl_glossary_id) text = text.split("glossary_id: '__GLOSSARY_ID__', ").join('').split(", glossary_id: '__GLOSSARY_ID__'").join('');
  if (!c.deepl_fallback_glossary_id) text = text.split("glossary_id: '__FALLBACK_GLOSSARY_ID__', ").join('').split(", glossary_id: '__FALLBACK_GLOSSARY_ID__'").join('');
  const skipTitle = c.skip_title_regex ? 'new RegExp(' + JSON.stringify(c.skip_title_regex) + ", 'i')" : NEVER;
  const values = {
    WEBHOOK_PATH: c.webhook_path, SOURCE_URL: c.source_url, TARGET_URL: c.target_url,
    TYPESENSE_URL: c.typesense_url || '', TYPESENSE_SOURCE_COLLECTION: c.typesense_source_collection || '', TYPESENSE_TARGET_COLLECTION: c.typesense_target_collection || '',
    COVER_SERVICE_URL: c.cover_service_url || '', COVER_DEFAULT_CATEGORY: c.cover_default_category || '',
    GENERATED_COVER_REGEX: c.cover_service_url ? '/\\/cover(-\\d+)?\\.(webp|png)$/i' : NEVER,
    DEEPL_API_URL: c.deepl_api_url || 'https://api-free.deepl.com', GLOSSARY_ID: c.deepl_glossary_id || '', FALLBACK_GLOSSARY_ID: c.deepl_fallback_glossary_id || '',
    SOURCE_LANG: c.source_lang, TARGET_LANG: c.target_lang, SOURCE_HREFLANG: c.source_hreflang, TARGET_HREFLANG: c.target_hreflang,
    DATA_TABLE_ID: c.data_table_id, TRANSLATE_POST_WORKFLOW_ID: c.translate_post_workflow_id || '', SEARCH_INDEX_WORKFLOW_ID: c.search_index_workflow_id || '',
    SKIP_SLUGS: JSON.stringify(c.skip_slugs || []), SKIP_TITLE_REGEX: skipTitle, ALLOW_LOST: JSON.stringify(c.allow_lost || {}),
  };
  for (const [k, v] of Object.entries(values)) text = text.split('__' + k + '__').join(esc(v));
  const left = text.match(/__[A-Z_]+__/);
  if (left) throw new Error('Unfilled token: ' + left[0]);
  const wf = JSON.parse(text);
  if (!c.typesense_url) for (const n of wf.nodes) if (OPTIONAL_SEARCH.includes(n.name)) n.disabled = true;
  if (!c.deepl_fallback) for (const name of FALLBACK_NODES) bypass(wf, name);
  if (c.error_workflow_id) wf.settings.errorWorkflow = c.error_workflow_id;
  return wf;
}

// Drops a node and hands its input straight to the node it fed.
function bypass(wf, name) {
  if (!wf.nodes.some((n) => n.name === name)) return;
  const next = wf.connections[name].main[0];
  delete wf.connections[name];
  for (const out of Object.values(wf.connections)) for (const links of out.main) {
    const i = links.findIndex((l) => l.node === name);
    if (i >= 0) links.splice(i, 1, ...next);
  }
  wf.nodes = wf.nodes.filter((n) => n.name !== name);
}

// The sub-workflow ids only exist after the first import, so the callers wait for a second build.
function plan(c) {
  const files = ['ghost-translate-post'];
  if (c.typesense_url) files.push('ghost-search-index');
  const ready = c.translate_post_workflow_id && (!c.typesense_url || c.search_index_workflow_id);
  if (ready) files.push('ghost-translate-sync', 'ghost-translate-batch');
  return { files, ready };
}

module.exports = { check, fill, plan };
if (require.main === module) {
  const c = JSON.parse(fs.readFileSync(process.argv[2] || path.join(ROOT, 'config.json'), 'utf8'));
  check(c);
  const { files, ready } = plan(c);
  fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
  for (const f of files) {
    const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', f + '.json'), 'utf8'));
    fs.writeFileSync(path.join(ROOT, 'build', f + '.json'), JSON.stringify(fill(t, c), null, 2) + '\n');
    console.log('build/' + f + '.json');
  }
  if (!ready) console.log('Import these, put their ids in the config and build again to get ghost-translate-sync and ghost-translate-batch.');
}
