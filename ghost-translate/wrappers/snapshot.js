const ctx = $('Context').first().json;
const f = $('Finish Translation').first().json;
const src = $('Fetch Source').first().json[ctx.type][0];
const pay = $('Build Ghost Payload').first().json;
const enAfter = $input.first().json[ctx.type][0];
const state = snapshot(f.state, enAfter.html || '');
// Remember which Spanish cover the English one was drawn for, so it is not drawn again.
state.cover = (f.cover_plan.mode === 'generate' || f.cover_plan.mode === 'reuse') && pay.cover_url ? { es: src.feature_image, url: pay.cover_url } : null;
return [{ json: { slug: ctx.slug, type: ctx.type, state: JSON.stringify(state), aligned: state.aligned } }];
