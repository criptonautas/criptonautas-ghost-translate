const lists = (name) => {
  const out = [];
  for (const { json } of $(name).all()) {
    // A second page would make real posts look missing.
    if (json.meta && json.meta.pagination && json.meta.pagination.next) throw new Error(name + ' is paginated: raise the limit');
    out.push(...(json.posts || json.pages || []));
  }
  return out;
};
const plan = migrationPlan({ rows: $('Read Rows').all().map((i) => i.json), es: [...lists('Spanish Posts'), ...lists('Spanish Pages')], en: [...lists('English Posts'), ...lists('English Pages')] });
if (plan.problems.length) throw new Error('Migration stopped, nothing written: ' + plan.problems.join('; '));
return plan.out.map((json) => ({ json }));
