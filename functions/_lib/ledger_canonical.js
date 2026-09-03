// Canonical inventory — every RUO peptide, degenerative condition, degenerative pharma.
// Single source of truth for combinatorial matrix + recursive ledger population.

import { PEPTIDE_STACK_LAYER } from "./condition_framework.js";

export const PATHWAYS = ["RUO", "Rx", "RUO/Rx", "cosmetic"];

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** RUO + material Rx peptides — regenerative role on the ledger. */
export const PEPTIDE_CATALOG = [
  { id: "bpc-157", name: "BPC-157", pathway: "RUO", layer: "structure / tissue" },
  { id: "tb-500", name: "TB-500", pathway: "RUO", layer: "inflammation / migration" },
  { id: "ara-290", name: "ARA-290", pathway: "RUO", layer: "nerve / innervation" },
  { id: "semax", name: "Semax", pathway: "RUO", layer: "neural / cognitive" },
  { id: "selank", name: "Selank", pathway: "RUO", layer: "anxiety / neurochemistry" },
  { id: "dsip", name: "DSIP", pathway: "RUO", layer: "sleep / repair window" },
  { id: "kpv", name: "KPV", pathway: "RUO", layer: "gut / localized anti-inflammatory" },
  { id: "ghk-cu", name: "GHK-Cu", pathway: "RUO", layer: "collagen / skin matrix" },
  { id: "pt-141", name: "PT-141", pathway: "RUO/Rx", layer: "sexual / CNS arousal" },
  { id: "thymosin-alpha-1", name: "Thymosin Alpha-1", pathway: "RUO", layer: "immune modulation" },
  { id: "mots-c", name: "MOTS-c", pathway: "RUO", layer: "mitochondrial / metabolic" },
  { id: "ss-31", name: "SS-31 (Elamipretide)", pathway: "RUO", layer: "mitochondrial" },
  { id: "epitalon", name: "Epitalon", pathway: "RUO", layer: "telomere / circadian" },
  { id: "ll-37", name: "LL-37", pathway: "RUO", layer: "antimicrobial / barrier" },
  { id: "dihexa", name: "Dihexa", pathway: "RUO", layer: "neural / HGF pathway" },
  { id: "cerebrolysin", name: "Cerebrolysin", pathway: "RUO/Rx", layer: "neural repair" },
  { id: "pinealon", name: "Pinealon", pathway: "RUO", layer: "neural / pineal" },
  { id: "vip", name: "VIP", pathway: "RUO", layer: "immune / autonomic" },
  { id: "foxo4-dri", name: "FOXO4-DRI", pathway: "RUO", layer: "senolytic" },
  { id: "humanin", name: "Humanin", pathway: "RUO", layer: "mitochondrial / neuroprotective" },
  { id: "retatrutide", name: "Retatrutide", pathway: "RUO", layer: "metabolic / GLP-1/GIP/glucagon" },
  { id: "tirzepatide", name: "Tirzepatide", pathway: "Rx", layer: "metabolic / GLP-1/GIP" },
  { id: "semaglutide", name: "Semaglutide", pathway: "Rx", layer: "metabolic / GLP-1" },
  { id: "tesamorelin", name: "Tesamorelin", pathway: "RUO/Rx", layer: "GH axis / visceral fat" },
  { id: "ipamorelin", name: "Ipamorelin", pathway: "RUO", layer: "GH secretagogue" },
  { id: "cjc-1295", name: "CJC-1295", pathway: "RUO", layer: "GH secretagogue" },
  { id: "mk-677", name: "MK-677 (Ibutamoren)", pathway: "RUO", layer: "GH secretagogue oral" },
  { id: "aod-9604", name: "AOD-9604", pathway: "RUO", layer: "lipolytic fragment" },
  { id: "melanotan-ii", name: "Melanotan II", pathway: "RUO", layer: "melanocortin" },
  { id: "nad-plus", name: "NAD+", pathway: "RUO", layer: "cellular energy" },
  { id: "glutathione", name: "Glutathione", pathway: "RUO", layer: "redox / detox" },
  { id: "snap-8", name: "SNAP-8", pathway: "RUO", layer: "cosmetic neuromodulation" },
  { id: "matrixyl", name: "Matrixyl", pathway: "RUO", layer: "collagen signal" },
].map((p) => ({
  ...p,
  regenerative_role:
    PEPTIDE_STACK_LAYER[p.id]?.regenerative_mechanism ||
    PEPTIDE_STACK_LAYER[p.id.replace(/-/g, "-")]?.regenerative_mechanism ||
    `Studied regenerative or supportive role in ${p.layer} — see peptide root ledger.`,
  evidence_typical:
    PEPTIDE_STACK_LAYER[p.id]?.evidence_tier_typical || "varies — populate required",
}));

/** Degenerative conditions — entropy targets on the ledger. */
export const CONDITION_CATALOG = [
  { id: "degenerative-disc", name: "Degenerative disc disease", degen_score: 0.85, body_system: "spine / disc" },
  { id: "herniated-disc", name: "Herniated disc / radiculopathy", degen_score: 0.88, body_system: "spine / nerve root" },
  { id: "sciatica", name: "Sciatica", degen_score: 0.82, body_system: "sciatic nerve" },
  { id: "diabetic-neuropathy", name: "Diabetic neuropathy", degen_score: 0.9, body_system: "peripheral nerve" },
  { id: "carpal-tunnel", name: "Carpal tunnel syndrome", degen_score: 0.75, body_system: "median nerve" },
  { id: "long-covid", name: "Long COVID / post-viral syndrome", degen_score: 0.8, body_system: "multi-system" },
  { id: "glp1-gut-damage", name: "GLP-1 gut damage / gastroparesis", degen_score: 0.78, body_system: "GI" },
  { id: "glp1-muscle-loss", name: "GLP-1 muscle loss / sarcopenia", degen_score: 0.72, body_system: "muscle" },
  { id: "ibd-crohns-colitis", name: "IBD (Crohn's / colitis)", degen_score: 0.8, body_system: "GI" },
  { id: "alcohol-gut-damage", name: "Alcohol-induced gut damage", degen_score: 0.77, body_system: "GI" },
  { id: "benzo-withdrawal", name: "Benzodiazepine withdrawal", degen_score: 0.7, body_system: "GABA / CNS" },
  { id: "post-surgical-nerve", name: "Post-surgical nerve injury", degen_score: 0.83, body_system: "peripheral nerve" },
  { id: "chemo-neuropathy", name: "Chemotherapy-induced neuropathy (CIPN)", degen_score: 0.88, body_system: "peripheral nerve" },
  { id: "postherpetic-neuralgia", name: "Postherpetic neuralgia", degen_score: 0.85, body_system: "peripheral nerve" },
  { id: "trigeminal-neuralgia", name: "Trigeminal neuralgia", degen_score: 0.86, body_system: "cranial nerve" },
  { id: "plantar-fasciitis", name: "Plantar fasciitis", degen_score: 0.65, body_system: "fascia / foot" },
  { id: "frozen-shoulder", name: "Frozen shoulder", degen_score: 0.68, body_system: "joint capsule" },
  { id: "diabetic-foot-ulcer", name: "Diabetic foot ulcer", degen_score: 0.92, body_system: "wound / nerve" },
  { id: "sibo-recurrence", name: "SIBO recurrence", degen_score: 0.7, body_system: "GI" },
  { id: "fluoroquinolone-toxicity", name: "Fluoroquinolone toxicity (floxed)", degen_score: 0.9, body_system: "tendon / nerve" },
  { id: "post-finasteride", name: "Post-finasteride syndrome", degen_score: 0.85, body_system: "hormonal / CNS" },
  { id: "stroke-recovery", name: "Stroke recovery", degen_score: 0.88, body_system: "brain" },
  { id: "ozempic-face", name: "GLP-1 facial collagen loss", degen_score: 0.7, body_system: "skin / face" },
  { id: "adderall-insomnia", name: "Stimulant-driven insomnia", degen_score: 0.75, body_system: "sleep / CNS" },
  { id: "adderall-gut", name: "Stimulant gut damage", degen_score: 0.72, body_system: "GI" },
  { id: "statin-brain-fog", name: "Statin-associated cognitive effects", degen_score: 0.68, body_system: "CNS / metabolic" },
];

/** Degenerative pharmaceuticals — repair-suppression or degeneration logic. */
export const PHARMA_CATALOG = [
  { id: "nsaids", name: "NSAIDs", degen_score: 0.55, degenerative_logic: "Suppress inflammation signal; may slow structural repair cascade." },
  { id: "corticosteroid-injection", name: "Corticosteroid injections", degen_score: 0.7, degenerative_logic: "Powerful anti-inflammatory; repeated use linked to tissue weakening." },
  { id: "gabapentin-lyrica", name: "Gabapentin / pregabalin", degen_score: 0.6, degenerative_logic: "Masks neuropathic pain signal; does not repair nerve." },
  { id: "opioids", name: "Opioids", degen_score: 0.75, degenerative_logic: "Suppress pain; tolerance; no tissue repair." },
  { id: "ppis", name: "PPIs (omeprazole, etc.)", degen_score: 0.65, degenerative_logic: "Acid suppression; long-term mucosal and nutrient consequences." },
  { id: "adderall-amphetamine", name: "Amphetamine stimulants", degen_score: 0.72, degenerative_logic: "Forces neurotransmitter release; borrows focus at cost of sleep/gut reserve." },
  { id: "benzodiazepines", name: "Benzodiazepines", degen_score: 0.68, degenerative_logic: "GABAergic suppression; does not rebuild neurochemistry." },
  { id: "blood-pressure-meds", name: "Antihypertensives (various)", degen_score: 0.4, degenerative_logic: "Symptom control; context-dependent tissue effects." },
  { id: "statins", name: "Statins", degen_score: 0.45, degenerative_logic: "Lipid management; debated cognitive/muscle side effects in subset." },
  { id: "glp1-agonists", name: "GLP-1 agonists (class)", degen_score: 0.35, degenerative_logic: "Metabolic benefit vs gut slowing / muscle loss tradeoffs at rapid weight loss." },
  { id: "metformin", name: "Metformin", degen_score: 0.25, degenerative_logic: "Metabolic tool; B12/mitochondrial concerns at chronic use — context dependent." },
  { id: "antidepressants-ssri", name: "SSRIs", degen_score: 0.4, degenerative_logic: "Serotonin modulation; symptom management not structural repair." },
];

export const PEPTIDE_IDS = new Set(PEPTIDE_CATALOG.map((p) => p.id));
export const TARGET_CATALOG = [
  ...CONDITION_CATALOG.map((c) => ({ ...c, kind: "condition" })),
  ...PHARMA_CATALOG.map((p) => ({ ...p, kind: "pharma" })),
];

export function crossSlug(peptideId, targetId) {
  return slug(`${peptideId}-${targetId}`);
}

export function peptideRootSlug(peptideId) {
  return slug(peptideId);
}

export function layerForPeptide(id) {
  return (
    PEPTIDE_CATALOG.find((p) => p.id === id)?.layer ||
    PEPTIDE_STACK_LAYER[id]?.layer ||
    "general"
  );
}

export function catalogById(kind, id) {
  if (kind === "peptide" || PEPTIDE_IDS.has(id)) {
    return PEPTIDE_CATALOG.find((p) => p.id === id) || null;
  }
  return TARGET_CATALOG.find((t) => t.id === id) || null;
}

const SLUG_TARGET_ALIASES = {
  "disc-disease": "degenerative-disc",
  "disc-degeneration": "degenerative-disc",
  "glp1-gut": "glp1-gut-damage",
  "glp1-muscle": "glp1-muscle-loss",
  ibd: "ibd-crohns-colitis",
  crohns: "ibd-crohns-colitis",
  colitis: "ibd-crohns-colitis",
  "brain-fog": "statin-brain-fog",
  jitteriness: "adderall-insomnia",
  neuroprotection: "adderall-insomnia",
  "tbi-concussion": "stroke-recovery",
  "emotional-blunting": "antidepressants-ssri",
  "ssri-anxiety": "antidepressants-ssri",
  "ssri-sexual-dysfunction": "antidepressants-ssri",
  "selank-ssri": "antidepressants-ssri",
  nsaids: "nsaids",
  ppis: "ppis",
  ppi: "ppis",
  gaba: "gabapentin-lyrica",
  gabapentin: "gabapentin-lyrica",
};

function peptideIdsByLength() {
  return [...PEPTIDE_IDS].sort((a, b) => b.length - a.length);
}

function resolveTargetFromSlug(rest) {
  const candidates = [...TARGET_CATALOG].sort((a, b) => b.id.length - a.id.length);

  const direct = TARGET_CATALOG.find((t) => t.id === rest);
  if (direct) return { id: direct.id, kind: direct.kind };

  for (const t of candidates) {
    if (rest === t.id || rest.startsWith(t.id + "-") || rest.endsWith("-" + t.id)) {
      return { id: t.id, kind: t.kind };
    }
  }

  for (const [alias, canon] of Object.entries(SLUG_TARGET_ALIASES)) {
    if (rest.includes(alias)) {
      const t = TARGET_CATALOG.find((x) => x.id === canon);
      if (t) return { id: t.id, kind: t.kind };
    }
  }

  for (const t of candidates) {
    const parts = t.id.split("-");
    if (parts.every((p) => rest.includes(p))) return { id: t.id, kind: t.kind };
  }
  return null;
}

/** Parse slug into peptide + target when it is a cross cell. */
export function parseCrossSlug(s) {
  const slug = String(s || "").toLowerCase();
  if (!slug || PEPTIDE_IDS.has(slug)) return { peptide: slug, target: null, kind: null, cross: false };

  for (const pid of peptideIdsByLength()) {
    if (slug === pid) return { peptide: pid, target: null, kind: null, cross: false };
    if (slug.startsWith(pid + "-")) {
      const rest = slug.slice(pid.length + 1);
      const target = resolveTargetFromSlug(rest);
      if (target) {
        return {
          peptide: pid,
          target: target.id,
          kind: target.kind,
          cross: true,
          expected_slug: crossSlug(pid, target.id),
        };
      }
    }
  }
  return { peptide: null, target: null, kind: null, cross: false };
}