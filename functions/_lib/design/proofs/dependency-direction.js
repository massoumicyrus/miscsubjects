// PROOF: dependency-direction — no design module may import upward in the ontology.

const LEVELS = [
  "law",
  "tokens",
  "representation",
  "primitive",
  "composition",
  "capability",
  "surface",
  "proof",
];

export function assertDependencyDirection(modulePath, importPaths) {
  const moduleLevel = levelOf(modulePath);
  for (const imp of importPaths) {
    const impLevel = levelOf(imp);
    if (LEVELS.indexOf(moduleLevel) < LEVELS.indexOf(impLevel)) {
      throw new Error(
        `Dependency direction violation: ${modulePath} (${moduleLevel}) imports ${imp} (${impLevel})`,
      );
    }
  }
  return { ok: true };
}

function levelOf(p) {
  if (p.includes("/law/")) return "law";
  if (p.includes("/tokens/")) return "tokens";
  if (p.includes("/primitives/")) return "primitive";
  if (p.includes("/compositions/")) return "composition";
  if (p.includes("/capabilities/")) return "capability";
  if (p.includes("/surfaces/")) return "surface";
  if (p.includes("/representations/")) return "representation";
  if (p.includes("/proofs/")) return "proof";
  return "unknown";
}
