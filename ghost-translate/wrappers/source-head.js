const ctx = $('Context').first().json;
const src = $('Fetch Source').first().json[ctx.type][0];
return [{ json: {
  url: 'https://criptonautas.co/ghost/api/admin/' + ctx.type + '/' + src.id + '/',
  body: { [ctx.type]: [{ updated_at: src.updated_at, codeinjection_head: mergeHead(src.codeinjection_head, hreflangBlock(src.slug)) }] },
} }];
