const FIELDS = ['title', 'custom_excerpt', 'meta_title', 'meta_description', 'og_title', 'og_description', 'twitter_title', 'twitter_description', 'feature_image_alt', 'feature_image_caption'];
const ctx = $('Context').first().json;
const src = $('Fetch Source').first().json[ctx.type][0];
const row = $('Get State').first().json;
const enRes = $('Get English').first().json;
const en = !ctx.dry_run && enRes && enRes[ctx.type] && enRes[ctx.type][0] ? enRes[ctx.type][0] : null;
const fields = {};
for (const k of FIELDS) {
  fields[k] = src[k];
}
const state = row && row.state ? JSON.parse(row.state) : null;
const prepared = prepare({
  fields,
  html: src.html || '',
  state,
  en: en && { fields: Object.fromEntries(FIELDS.map((k) => [k, en[k]])), html: en.html || '' },
});
const items = [
  ...chunk(prepared.jobs.fields).map((g) => ({ kind: 'text', ids: g.map((j) => j.id), texts: g.map((j) => j.text) })),
  ...chunk(prepared.jobs.blocks).map((g) => ({ kind: 'html', ids: g.map((j) => j.id), texts: g.map((j) => j.text) })),
// DeepL bills visible text only, so this is the number to compare with its usage counter.
].map((x) => ({ ...x, chars: x.texts.reduce((a, t) => a + (x.kind === 'html' ? textOf(t).length : t.length), 0) }));
if (!items.length) items.push({ kind: 'none', chars: 0 });
items[0].prepared = prepared;
items[0].old_out = state ? state.out || null : null;
return items.map((json) => ({ json }));
