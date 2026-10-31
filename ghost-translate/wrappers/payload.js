const ctx = $('Context').first().json;
const src = $('Fetch Source').first().json[ctx.type][0];
const enRes = $('Get English').first().json;
const en = enRes && enRes[ctx.type] && enRes[ctx.type][0] ? enRes[ctx.type][0] : null;
const f = $('Finish Translation').first().json;
// The English cover is drawn upstream only when the plan says so; a failed draw leaves the image empty and is retried next run.
let up = null;
try { up = $('Upload English Cover').first().json; } catch (e) { up = null; }
const drawn = up && up.images && up.images[0] ? up.images[0].url : null;
const coverUrl = f.cover_plan.mode === 'generate' ? drawn : f.cover_plan.url;
const body = {
  ...f.fields,
  html: f.html,
  status: 'published',
  visibility: 'public',
  published_at: src.published_at,
  featured: Boolean(src.featured),
  feature_image: coverUrl,
  tags: (src.tags || []).map((t) => ({ name: t.name })),
};
// English owns its slug: it is chosen once on create and never sent again.
const slug = en ? en.slug : slugify(f.fields.title, $('Known Slugs').all().map((i) => i.json.en_slug || i.json.slug));
if (!en) body.slug = slug;
body.codeinjection_head = mergeHead(en && en.codeinjection_head, hreflangBlock(src.slug, slug));
for (const k of Object.keys(f.fields)) if (!f.fields[k]) body[k] = null;
if (en) body.updated_at = en.updated_at;
const base = 'https://en.criptonautas.co/ghost/api/admin/' + ctx.type + '/';
return [{ json: { method: en ? 'PUT' : 'POST', url: base + (en ? en.id + '/' : '') + '?source=html', body: { [ctx.type]: [body] }, cover_url: coverUrl, cover_failed: f.cover_plan.mode === 'generate' && !drawn } }];
