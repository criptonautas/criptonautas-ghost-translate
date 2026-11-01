// Ghost lists every tier on public posts too, so tiers only count when the post is gated by tier.
const tierSlugs = (p) => (p.tiers || []).map((t) => t.slug).sort();

function accessFields(src) {
  if (!src.visibility) throw new Error('Source has no visibility: ' + src.slug);
  return src.visibility === 'tiers'
    ? { visibility: 'tiers', tiers: tierSlugs(src).map((slug) => ({ slug })) }
    : { visibility: src.visibility };
}

function accessChanged(src, en) {
  if (!en) return false;
  if (en.visibility !== src.visibility) return true;
  return src.visibility === 'tiers' && JSON.stringify(tierSlugs(en)) !== JSON.stringify(tierSlugs(src));
}

// The search key is public and a filter is only a request, so gated text never enters the index.
function gateSearchDoc(doc, src) {
  const visibility = src.visibility || 'paid';
  return visibility === 'public' ? { ...doc, visibility } : { ...doc, visibility, excerpt: '', html: '', plaintext: '' };
}
Object.assign(module.exports, { accessFields, accessChanged, gateSearchDoc }); // export
