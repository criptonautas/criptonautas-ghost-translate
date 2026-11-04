const prep = $('Prepare Translation').all().map((i) => i.json);
const prepared = prep[0].prepared;
const sent = prep.filter((j) => j.kind !== 'none');
let results = [];
try { results = $('DeepL Translate').all(); } catch (e) { results = []; }
const translations = { fields: {}, blocks: {}, alts: {} };
const BUCKET = { text: 'fields', html: 'blocks', alt: 'alts' };
sent.forEach((g, n) => {
  const out = results[n] && results[n].json.translations;
  if (!out || out.length !== g.ids.length) throw new Error('DeepL returned ' + (out ? out.length : 0) + ' of ' + g.ids.length + ' texts');
  g.ids.forEach((id, k) => { translations[BUCKET[g.kind]][id] = out[k].text; });
});
// Dry-run rows are not real English pages, so they must not turn links into en.criptonautas.co.
const slugs = {};
for (const { json: r } of $('Known Slugs').all()) {
  // Rows from before the English slugs carry no en_slug: their English slug is still the Spanish one.
  if (r.slug && !String(r.slug).startsWith('dry:')) slugs[r.slug] = r.en_slug || r.slug;
}
// The owner accepts losing the strikethrough in these posts' p<s>l</s>andemia wordplay.
const ALLOW_LOST = { 'expandir-dinero': ['s'], 'circular-2': ['s'] };
const f = finish({ prepared, translations, slugs, allowLost: ALLOW_LOST[$('Context').first().json.slug] || [] });
if (!f.ok) throw new Error('Translation rejected: ' + f.problems.join('; '));
const ctx = $('Context').first().json;
const src = $('Fetch Source').first().json[ctx.type][0];
const row = $('Get State').first().json;
const old = row && row.state ? JSON.parse(row.state) : null;
const enRes = $('Get English').first().json;
const en = enRes && enRes[ctx.type] && enRes[ctx.type][0] ? enRes[ctx.type][0] : null;
const plan = coverPlan({ esImage: src.feature_image, enImage: en && en.feature_image, cover: old && old.cover });
// A republish changes nothing but status, so a draft twin must still be written back.
// A renamed slug on either site changes nothing but this block, and it needs no translation.
const staleHead = Boolean(en) && !(en.codeinjection_head || '').includes(hreflangBlock(src.slug, en.slug));
const write = !prepared.noop || prep[0].old_out !== f.state.out || plan.changed || (Boolean(en) && en.status !== 'published') || staleHead;
return [{ json: { ...f, write, cover_plan: plan, noop: prepared.noop, kept: prepared.kept, jobs: sent.length, chars_sent: sent.reduce((a, j) => a + j.chars, 0) } }];
