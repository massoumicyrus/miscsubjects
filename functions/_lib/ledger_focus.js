// Article focus + source_role hygiene — keeps stack/condition graphs disciplined.

import { sourceHint, tierForSourceType, weightForTier } from "./ledger_durability.js";
import { parseCrossSlug } from "./ledger_canonical.js";

export const SOURCE_ROLES = [
  "core_stack_evidence",
  "cycle_background",
  "mechanism_support",
  "anecdotal_report",
  "commercial_claim",
  "adjacent_context",
  "exclude_candidate",
];

const COMMERCIAL_RE =
  /\b(commercial vendor|vendors? and clinics? market|clinic market|our peptide|buy (?:now|peptide)|peptide (?:shop|store)|limitlesslife|cosmetic peptide|medspa|wellness clinic)\b/i;

const STACK_MARKERS = ["stack", "cognitive-stack", "adderall-stack", "recovery-stack", "wolverine"];

/** Per-slug inclusion boundaries — narrower graph like ara-290-herniated-disc. */
export const ARTICLE_FOCUS = {
  "cognitive-stack-adderall-insomnia": {
    kind: "stack",
    peptides: ["semax", "selank", "dsip"],
    themes: [
      "sleep",
      "insomnia",
      "anxiety",
      "cognition",
      "cognitive",
      "adderall",
      "stimulant",
      "amphetamine",
      "bdnf",
      "circadian",
      "deep sleep",
      "delta sleep",
      "anxiolytic",
      "neuroplastic",
      "brain fog",
      "restorative sleep",
    ],
    adjacent_ok: [
      "melatonin",
      "adenosine",
      "gaba",
      "cortisol",
      "dopamine",
      "norepinephrine",
      "functional connectivity",
      "fmri",
    ],
    exclude_signals: [
      "collagen peptide",
      "collagen tripeptide",
      "collagen supplement",
      "fmt",
      "fecal microbiota",
      "microbiota transplant",
      "photobiomodulation",
      "pbm",
      "low-level laser",
      "oxytocin",
      "photobiomodul",
      "ghk-cu",
      "bpc-157",
      "tb-500",
      "tb500",
      "ara-290",
      "retatrutide",
      "tirzepatide",
      "wound healing peptide",
      "skin peptide",
      "cosmetic",
      "gut microbiome transplant",
    ],
  },
  "semax-selank-adderall": {
    kind: "stack",
    peptides: ["semax", "selank"],
    themes: ["adderall", "stimulant", "anxiety", "jitter", "cognition", "bdnf"],
    adjacent_ok: ["dopamine", "anxiolytic"],
    exclude_signals: ["collagen", "fmt", "pbm", "oxytocin", "bpc-157", "tb-500"],
  },
  "cognitive-stack-intro": {
    kind: "stack",
    peptides: ["semax", "selank", "dsip"],
    themes: ["sleep", "anxiety", "cognition", "cycle", "interconnected"],
    adjacent_ok: ["melatonin", "circadian"],
    exclude_signals: ["collagen", "fmt", "pbm", "oxytocin", "bpc-157"],
  },
};

export function focusProfileForSlug(slug, title = "") {
  const s = String(slug || "").toLowerCase();
  if (ARTICLE_FOCUS[s]) return { ...ARTICLE_FOCUS[s], slug: s };

  if (STACK_MARKERS.some((m) => s.includes(m))) {
    const peptides = [];
    for (const p of ["semax", "selank", "dsip", "bpc-157", "tb-500", "ara-290", "kpv"]) {
      if (s.includes(p)) peptides.push(p);
    }
    return {
      slug: s,
      kind: "stack",
      peptides,
      themes: ["sleep", "anxiety", "cognition", "repair", "stack"],
      adjacent_ok: [],
      exclude_signals: ["collagen peptide", "fmt", "fecal microbiota", "photobiomodulation", "oxytocin"],
    };
  }

  const cross = parseCrossSlug(s);
  if (cross.cross) {
    return {
      slug: s,
      kind: "condition",
      peptides: [cross.peptide],
      themes: [cross.target?.replace(/-/g, " "), cross.peptide?.replace(/-/g, " ")].filter(Boolean),
      adjacent_ok: [],
      exclude_signals: [],
    };
  }

  return null;
}

function textBlob(source, claimText = "") {
  return (
    sourceHint(source) +
    " " +
    String(claimText || "") +
    " " +
    String(source?.url || "")
  ).toLowerCase();
}

function hitsAny(text, terms) {
  return (terms || []).some((t) => text.includes(String(t).toLowerCase()));
}

/** Classify one source row for graph discipline. */
export function classifySourceRole(source, opts = {}) {
  const focus = opts.focus;
  const text = textBlob(source);
  const type = String(source?.type || "").toLowerCase();

  if (COMMERCIAL_RE.test(text)) return "commercial_claim";
  if (["reddit", "x", "twitter", "youtube", "instagram", "anecdotal"].includes(type)) {
    if (focus) {
      const peptideHit = hitsAny(text, focus.peptides);
      const themeHit = hitsAny(text, focus.themes);
      const excludeHit = hitsAny(text, focus.exclude_signals);
      if (excludeHit && !peptideHit) return "exclude_candidate";
      if (peptideHit && themeHit) return "anecdotal_report";
      if (themeHit) return "cycle_background";
      return "adjacent_context";
    }
    return "anecdotal_report";
  }

  if (!focus) return type === "pubmed" || type === "review" ? "mechanism_support" : "adjacent_context";

  const peptideHit = hitsAny(text, focus.peptides);
  const themeHit = hitsAny(text, focus.themes);
  const adjacentHit = hitsAny(text, focus.adjacent_ok);
  const excludeHit = hitsAny(text, focus.exclude_signals);

  if (excludeHit && !peptideHit) return "exclude_candidate";

  if (peptideHit && themeHit) return "core_stack_evidence";
  if (peptideHit) return "mechanism_support";
  if (themeHit || adjacentHit) return "cycle_background";
  return "adjacent_context";
}

/** Apply source_role + focus cuts on claims. */
export function applyFocusHygiene(meta, slug, title = "") {
  const focus = focusProfileForSlug(slug, title);
  const sources = (meta.sources || []).map((s) => ({ ...s }));
  const claims = (meta.claims || []).map((c) => ({ ...c }));
  const bySource = {};
  let roles_assigned = 0;
  let excluded_sources = 0;
  let cut_claims = 0;
  let commercial_sources = 0;

  for (const s of sources) {
    const role = classifySourceRole(s, { focus });
    if (s.source_role !== role) roles_assigned++;
    s.source_role = role;
    if (role === "exclude_candidate") excluded_sources++;
    if (role === "commercial_claim") commercial_sources++;
  }
  for (const s of sources) bySource[s.id] = s;

  for (const c of claims) {
    if (c.status === "retracted") continue;
    const sids = c.source_ids || [];
    const roles = sids.map((id) => bySource[id]?.source_role).filter(Boolean);
    let primary = roles[0] || null;
    const claimText = String(c.text || "").toLowerCase();

    if (focus && !primary) {
      primary = classifySourceRole(
        { type: "other", title: c.text, summary: c.text, url: "" },
        { focus },
      );
    }
    if (primary) c.source_role = primary;

    const claimExclude =
      focus &&
      hitsAny(claimText, focus.exclude_signals) &&
      !hitsAny(claimText, focus.peptides);
    const allExcluded =
      claimExclude ||
      (roles.length > 0 && roles.every((r) => r === "exclude_candidate"));
    const commercialOnly =
      roles.length > 0 && roles.every((r) => r === "commercial_claim");

    if (allExcluded && focus) {
      c.status = "cut";
      c.weight = 0.05;
      c.focus_cut_reason = "exclude_candidate — off-focus for " + slug;
      cut_claims++;
    } else if (commercialOnly) {
      c.tier = "speculative";
      c.weight = weightForTier("speculative", { marketing_grey: true });
      c.source_role = "commercial_claim";
    } else if (primary === "adjacent_context" && focus?.kind === "stack") {
      c.weight = Math.min(Number(c.weight) || 0.3, 0.25);
    }
  }

  return {
    meta: { ...meta, sources, claims, focus: focus ? { ...focus, applied_at: new Date().toISOString() } : null },
    focus,
    stats: {
      roles_assigned,
      excluded_sources,
      commercial_sources,
      cut_claims,
      core: sources.filter((s) => s.source_role === "core_stack_evidence").length,
      cycle: sources.filter((s) => s.source_role === "cycle_background").length,
      adjacent: sources.filter((s) => s.source_role === "adjacent_context").length,
    },
  };
}

export function focusAudit(meta, slug, title = "") {
  const focus = focusProfileForSlug(slug, title);
  const sources = meta.sources || [];
  const claims = meta.claims || [];
  const active = claims.filter((c) => c.status !== "retracted" && c.status !== "cut");

  const byRole = {};
  for (const r of SOURCE_ROLES) byRole[r] = 0;
  for (const s of sources) {
    const role = s.source_role || classifySourceRole(s, { focus });
    byRole[role] = (byRole[role] || 0) + 1;
  }

  const misPreclinical = active.filter((c) => {
    if (c.tier !== "preclinical") return false;
    const text = String(c.text || "").toLowerCase();
    return /\b(patients?|human subjects?|clinical trial|randomi[sz]ed|volunteers?|gad patients|fmri study)\b/.test(
      text,
    );
  });

  return {
    slug,
    focus: focus?.slug || null,
    source_roles: byRole,
    active_claims: active.length,
    cut_claims: claims.filter((c) => c.status === "cut").length,
    mislabeled_preclinical: misPreclinical.map((c) => ({ id: c.id, text: c.text?.slice(0, 120) })),
    discipline_score: focus
      ? Math.round(
          ((byRole.core_stack_evidence || 0) * 2 +
            (byRole.cycle_background || 0) +
            (byRole.mechanism_support || 0)) /
            Math.max(1, sources.length) *
            100,
        ) / 100
      : null,
  };
}