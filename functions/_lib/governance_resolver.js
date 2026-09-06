const RESOLVER_VERSION = 'miscsubjects/governance-resolver/1';

function asCatalog(input) {
  if (input instanceof Map) return input;
  return new Map((Array.isArray(input) ? input : []).filter(Boolean).map((item) => [item.ref, item]));
}

function refs(value) {
  return (Array.isArray(value) ? value : []).map((item) => typeof item === 'string' ? item : item?.rule_ref).filter(Boolean);
}

function directRuleRefs(object) {
  const fromGovernance = refs(object?.governance?.direct);
  const fromEdges = (Array.isArray(object?.relationships) ? object.relationships : [])
    .filter((edge) => edge?.type === 'governed_by')
    .map((edge) => edge.target_ref)
    .filter(Boolean);
  return [...new Set([...fromGovernance, ...fromEdges])];
}

function inheritanceRefs(object) {
  const out = [];
  if (object?.parent_ref) out.push({ ref: object.parent_ref, relation: 'part_of' });
  for (const ref of (Array.isArray(object?.governance?.inherited_from) ? object.governance.inherited_from : [])) {
    out.push({ ref: typeof ref === 'string' ? ref : ref?.ref, relation: 'inherits_rules_from' });
  }
  for (const edge of (Array.isArray(object?.relationships) ? object.relationships : [])) {
    if (edge?.type === 'inherits_rules_from') out.push({ ref: edge.target_ref, relation: edge.type });
  }
  return out.filter((item) => item.ref);
}

function ruleResult(rule, appliesBecause, declaredBy) {
  return {
    rule_ref: rule.ref,
    title: rule.title || rule.summary || rule.ref,
    rule_revision: Number(rule.revision || 1),
    rule_hash: rule.hash || null,
    declared_by: declaredBy,
    applies_because: appliesBecause,
  };
}

export function resolveEffectiveGovernance(input, targetRef) {
  const catalog = asCatalog(input);
  const target = catalog.get(targetRef);
  const result = {
    schema: RESOLVER_VERSION,
    target_ref: targetRef,
    direct: [],
    inherited: [],
    overridden: [],
    effective: [],
    unresolved: [],
    conflicts: [],
    resolution_receipt: null,
  };
  if (!target) {
    result.unresolved.push({ ref: targetRef, reason: 'target_not_registered' });
    return result;
  }

  const levels = [];
  const visited = new Set();
  const walk = (object, path) => {
    if (visited.has(object.ref)) {
      result.conflicts.push({ type: 'governance_cycle', path: [...path, object.ref] });
      return;
    }
    visited.add(object.ref);
    levels.push({ object, path });
    for (const parent of inheritanceRefs(object)) {
      const parentObject = catalog.get(parent.ref);
      const edge = `${object.ref} ${parent.relation} ${parent.ref}`;
      if (!parentObject) {
        result.unresolved.push({ ref: parent.ref, reason: 'inheritance_target_not_registered' });
        continue;
      }
      walk(parentObject, [...path, edge]);
    }
  };
  walk(target, []);

  const overrides = new Map();
  for (const { object } of levels) {
    for (const override of (Array.isArray(object?.governance?.overrides) ? object.governance.overrides : [])) {
      const ruleRef = typeof override === 'string' ? override : override?.rule_ref;
      if (!ruleRef || overrides.has(ruleRef)) continue;
      const record = {
        rule_ref: ruleRef,
        reason: typeof override === 'string' ? 'declared override' : String(override.reason || 'declared override'),
        declared_by: object.ref,
      };
      overrides.set(ruleRef, record);
      result.overridden.push(record);
    }
  }

  const seenRules = new Set();
  levels.forEach(({ object, path }, level) => {
    for (const ruleRef of directRuleRefs(object)) {
      if (seenRules.has(ruleRef)) continue;
      seenRules.add(ruleRef);
      if (overrides.has(ruleRef)) continue;
      const rule = catalog.get(ruleRef);
      if (!rule) {
        result.unresolved.push({ ref: ruleRef, reason: 'rule_not_registered' });
        continue;
      }
      const appliesBecause = [...path, `${object.ref} governed_by ${ruleRef}`];
      const record = ruleResult(rule, appliesBecause, object.ref);
      if (level === 0) result.direct.push(record);
      else result.inherited.push(record);
      result.effective.push(record);
    }
  });

  return result;
}
