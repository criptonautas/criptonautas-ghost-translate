// lib: access
const ctx = $('Context').first().json;
const src = $('Fetch Source').first().json[ctx.type][0];
const json = $input.first().json;
Object.assign(json.body[ctx.type][0], accessFields(src));
return [{ json }];
