// LAW — the binding design law and ontology for every surface.
// Higher levels may depend only on lower levels. No upward imports.

export const DESIGN_LAW = Object.freeze({
  identity: {
    id: "kao:design-law",
    key: "DESIGN_LAW",
    slug: "design-law",
    title: "The Laws of Design",
    version: "2.0.0",
  },
  ontology: Object.freeze({
    law: ["readability", "type", "color", "measure", "rhythm"],
    tokens: ["color", "type", "space", "measure", "radius"],
    primitive: ["mark", "word", "interval", "line", "disclosure", "button"],
    composition: [
      "navigation-hub",
      "chapter",
      "relationship-card",
      "evidence-swiper",
      "capability-card",
      "directory-widget",
      "inspector",
    ],
    capability: ["evidence-platform", "directory-invoke", "capability-list"],
    surface: ["home", "article", "library", "graph", "admin"],
    representation: ["html", "css", "json", "markdown", "skill"],
    proof: [
      "oriented",
      "readable",
      "related",
      "intentional",
      "valid",
      "dependency-direction",
      "token-conformance",
      "theme-parity",
    ],
  }),
  ratio: null,
  unit: "1rem",
  principle: "Readability determines type, measure, spacing, and layout; no aesthetic ratio governs the interface.",
});

// L0 law → L1 tokens → L2 representations → L3 primitives → L4 compositions
// → L5 capabilities → L6 surfaces → L7 proofs
export const LEVEL_ORDER = Object.freeze([
  "law",
  "tokens",
  "representation",
  "primitive",
  "composition",
  "capability",
  "surface",
  "proof",
]);

// Legacy alias for consumers expecting a separate ontology object.
export const DESIGN_ONTOLOGY = DESIGN_LAW.ontology;
