const ctx = $('Context').first().json;
const src = $('Fetch Source').first().json[ctx.type][0];
let en = null;
try { en = $('Fetch English After').first().json[ctx.type][0]; } catch (e) { en = null; }
if (!en) {
  const cur = $('Get English').first().json;
  en = cur && cur[ctx.type] && cur[ctx.type][0] ? cur[ctx.type][0] : null;
}
if (!en) throw new Error('No English post to index: ' + src.slug);
return [{ json: { doc: searchDoc(en, src) } }];
