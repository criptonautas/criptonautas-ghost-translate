const BASE = 'https://criptonautas.co';
const out = [];
for (const item of $input.all()) {
  // A second page would silently shrink the list that decides what the rebuild deletes.
  if (item.json.meta && item.json.meta.pagination && item.json.meta.pagination.next) throw new Error('Ghost list is paginated: raise the limit');
  for (const src of item.json.posts || item.json.pages || []) {
    if (src.status !== 'published') continue;
    const doc = { ...searchDoc(src, src, BASE), visibility: src.visibility };
    // The search key is public and a filter is only a request, so paid text never enters the index.
    if (src.visibility !== 'public') Object.assign(doc, { excerpt: '', html: '', plaintext: '' });
    out.push({ json: { doc } });
  }
}
return out;
