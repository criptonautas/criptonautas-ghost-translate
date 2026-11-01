// lib: access
const ctx = $('Context').first().json;
const src = $('Fetch Source').first().json[ctx.type][0];
return [{ json: { doc: gateSearchDoc($input.first().json.doc, src) } }];
