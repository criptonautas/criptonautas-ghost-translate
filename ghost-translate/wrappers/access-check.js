// lib: access
const ctx = $('Context').first().json;
const src = $('Fetch Source').first().json[ctx.type][0];
const enRes = $('Get English').first().json;
const en = enRes && enRes[ctx.type] && enRes[ctx.type][0] ? enRes[ctx.type][0] : null;
// Gating a post changes no text, and the English twin must not stay open.
return [{ json: { changed: accessChanged(src, en) } }];
