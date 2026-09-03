// MASTER FRONT-SIDE DESIGN LAW
// One recursive system governs public navigation, editorial reading, data widgets,
// maps, and admin chrome. Local pages may compose these primitives; they may not
// invent a new type family, scale, palette, spacing rhythm, or navigation grammar.
//
// Canonical implementation: functions/_lib/design/. This module preserves the legacy API.

export {
  DESIGN_LAW,
  DESIGN_ONTOLOGY,
  LEVEL_ORDER,
} from "./design/law/design-law.js";

// Legacy aliases preserved for existing consumers.
export { DESIGN_LAW as DESIGN_SYSTEM } from "./design/law/design-law.js";

// Legacy chrome helpers remain available from design_system.js.
export {
  designSystemStyles as designLawStyles,
  designSystemHeader as designLawHeader,
  designSystemFooter as designLawFooter,
  structureReaderHtml,
} from "./design_system.js";
