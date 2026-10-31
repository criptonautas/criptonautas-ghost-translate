// Rebuild only: below this the Ghost list is wrong, not the site small, so nothing is deleted.
const MIN_DOCS = 20;
const keep = new Set($('Build Docs').all().map((i) => i.json.doc.id));
if (keep.size < MIN_DOCS) throw new Error('Only ' + keep.size + ' source docs, refusing to delete');
const raw = String($input.first().json.data || '');
const ids = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l).id);
if (!ids.length) throw new Error('Export returned no ids');
return ids.filter((id) => !keep.has(id)).map((id) => ({ json: { id } }));
