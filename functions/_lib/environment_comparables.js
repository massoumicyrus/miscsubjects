const STATUSES = new Set(['verified', 'publisher_claim', 'unverified', 'stale']);

function arr(value) { return Array.isArray(value) ? value : []; }

export function validateComparable(value) {
  const edge = value && typeof value === 'object' ? value : {};
  const errors = [];
  if (!String(edge.target_ref || '').includes('://')) errors.push('target_ref is required');
  if (!arr(edge.dimensions).length) errors.push('dimensions are required');
  if (!String(edge.basis || '').trim()) errors.push('basis is required');
  if (!Array.isArray(edge.similarities)) errors.push('similarities are required');
  if (!Array.isArray(edge.differences)) errors.push('differences are required');
  if (!STATUSES.has(edge.status)) errors.push('status must be verified, publisher_claim, unverified, or stale');
  if (edge.status !== 'unverified' && !arr(edge.sources).length) errors.push('sources are required unless status is unverified');
  return { ok: errors.length === 0, errors };
}

function mapOf(input) {
  return input instanceof Map
    ? input
    : new Map(arr(input).filter((item) => item?.ref).map((item) => [item.ref, item]));
}

function displayTarget(targetRef, target) {
  return target
    ? { ref: target.ref, kind: target.kind || 'object', title: target.title || target.summary || target.ref }
    : { ref: targetRef, kind: 'unknown', title: targetRef };
}

export function resolveComparables(input, targetRef, { dimension = null } = {}) {
  const catalog = mapOf(input);
  const target = catalog.get(targetRef);
  const result = {
    schema: 'miscsubjects/environment-comparables/1',
    target_ref: targetRef,
    dimension: dimension || null,
    comparables: [],
    unresolved: [],
  };
  if (!target) {
    result.unresolved.push({ ref: targetRef, reason: 'target_not_registered' });
    return result;
  }

  const append = (edge, inheritedFrom = null) => {
    const valid = validateComparable(edge);
    if (!valid.ok) {
      result.unresolved.push({ ref: edge?.target_ref || null, reason: 'invalid_comparable', errors: valid.errors });
      return;
    }
    if (dimension && !arr(edge.dimensions).includes(dimension)) return;
    const comparableTarget = catalog.get(edge.target_ref);
    if (!comparableTarget) result.unresolved.push({ ref: edge.target_ref, reason: 'comparable_target_not_registered' });
    result.comparables.push({
      target_ref: edge.target_ref,
      target: displayTarget(edge.target_ref, comparableTarget),
      dimensions: arr(edge.dimensions),
      basis: String(edge.basis),
      similarities: arr(edge.similarities),
      differences: arr(edge.differences),
      sources: arr(edge.sources),
      status: edge.status,
      verified_at: edge.verified_at || null,
      inherited_from: inheritedFrom,
    });
  };

  for (const edge of arr(target.comparables)) append(edge);

  const seen = new Set([targetRef]);
  let child = target;
  while (child?.parent_ref && !seen.has(child.parent_ref)) {
    seen.add(child.parent_ref);
    const parent = catalog.get(child.parent_ref);
    if (!parent) break;
    for (const edge of arr(parent.comparables)) {
      const inherited = arr(edge.inheritable_dimensions);
      if (!inherited.length) continue;
      if (dimension && !inherited.includes(dimension)) continue;
      append(edge, parent.ref);
    }
    child = parent;
  }

  return result;
}
