const prep = $('Prepare Translation').all().map((i) => i.json);
const prepared = prep[0].prepared;
const sent = prep.filter((j) => j.kind !== 'none');
let results = [];
try { results = $('DeepL Translate').all(); } catch (e) { results = []; }
const translations = { fields: {}, blocks: {} };
sent.forEach((g, n) => {
  const out = results[n] && results[n].json.translations;
  if (!out || out.length !== g.ids.length) throw new Error('DeepL returned ' + (out ? out.length : 0) + ' of ' + g.ids.length + ' texts');
  g.ids.forEach((id, k) => { translations[g.kind === 'html' ? 'blocks' : 'fields'][id] = out[k].text; });
});
// Dry-run rows are not real English pages, so they must not turn links into en.criptonautas.co.
const slugs = [...new Set($('Known Slugs').all().map((i) => String(i.json.slug || '')).filter((s) => s && !s.startsWith('dry:')))];
const f = finish({ prepared, translations, slugs });
if (!f.ok) throw new Error('Translation rejected: ' + f.problems.join('; '));
const ctx = $('Context').first().json;
const src = $('Fetch Source').first().json[ctx.type][0];
const row = $('Get State').first().json;
const old = row && row.state ? JSON.parse(row.state) : null;
const enRes = $('Get English').first().json;
const en = enRes && enRes[ctx.type] && enRes[ctx.type][0] ? enRes[ctx.type][0] : null;
const plan = coverPlan({ esImage: src.feature_image, enImage: en && en.feature_image, cover: old && old.cover });
const write = !prepared.noop || prep[0].old_out !== f.state.out || plan.changed;
return [{ json: { ...f, write, cover_plan: plan, noop: prepared.noop, kept: prepared.kept, jobs: sent.length, chars_sent: sent.reduce((a, j) => a + j.chars, 0) } }];
