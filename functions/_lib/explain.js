// Full explainability — every feature answers what/why/how/verify/queue.

import { FEATURES } from "./self_explain.js";

const BASE = "https://miscsubjects.com";

/** Canonical growth queue — models add articles, sources, features in order. */
export const MODEL_GROW_QUEUE = [
  {
    id: "populate",
    model: "grok/grok-4.3",
    what: "Web-search evidence hunt → hash-chained source voxels + claims",
    why: "Source forest is oxygen; without external URLs the graph is tautology",
    how: "POST /api/protocol/populate",
    dispatch: "POPULATE",
    verifies: "/api/articles/{slug}/sources → count↑, verification.valid",
    next: "kimi_collaborate",
  },
  {
    id: "kimi_collaborate",
    model: "kimi/moonshot-v1-8k",
    what: "Read topology, post 1–3 tier-honest claims, optional challenge",
    why: "Multi-model provenance — first external model writeback",
    how: "POST /api/protocol/collaborate",
    dispatch: "KIMI_COLLABORATE",
    verifies: "/api/articles/{slug}/contributions → models includes kimi",
    next: "gemini_collaborate",
  },
  {
    id: "gemini_collaborate",
    model: "gemini/gemini-2.5-flash",
    what: "Cheap second pass — gap-fill what_is_unknown slots",
    why: "Cross-model corroboration + adversarial tension at low $/claim",
    how: "POST /api/protocol/collaborate",
    dispatch: "GEMINI_COLLABORATE",
    verifies: "/api/articles/{slug}/contributions → models includes gemini",
    next: "editorial",
  },
  {
    id: "editorial",
    model: "kimi/moonshot-v1-8k",
    what: "Debate club gate — mandate, prosecutor, defender, judge; scope + question resolution",
    why: "Stops wrong template (regen frame on API docs) and peptide drift on primers",
    how: "POST /api/protocol/editorial",
    dispatch: "EDITORIAL",
    verifies: "meta.editorial.pass === true",
    next: "repair",
  },
  {
    id: "repair",
    model: "system/repair",
    what: "Wire claim↔source graph, backfill posted_by, materialize orphans",
    why: "Orphan sources break voxel edges and ask routing",
    how: "POST /api/protocol/repair",
    dispatch: null,
    verifies: "/api/articles/{slug}/health → ok:true",
    next: "reflex",
  },
  {
    id: "reflex",
    model: "system/reflex",
    what: "Live probes vs protocol vision claims → conformance atoms",
    why: "Graph proves its own shape recursively",
    how: "POST /api/protocol/reflex",
    dispatch: "REFLEX_PASS",
    verifies: "/api/graph?layer=reflex → reflex_claims>0",
    next: "populate",
  },
];

export function explainFeature(featureId, ctx = {}) {
  const slug = ctx.slug || "{slug}";
  const f = FEATURES[featureId] || {};
  const urls = {};
  if (f.read) urls.read = String(f.read).replace(/\{slug\}/g, slug);
  if (f.write) urls.write = String(f.write).replace(/\{slug\}/g, slug);

  const queueStep = MODEL_GROW_QUEUE.find((s) => s.id === featureId || s.dispatch === featureId);

  return {
    feature: featureId,
    name: f.name || featureId,
    what: f.what || ctx.what || null,
    why: f.why || ctx.why || queueStep?.why || "Auditable collective intelligence",
    how: f.how || ctx.how_to_use || queueStep?.how || f.what,
    model: f.model || queueStep?.model || null,
    verifies: f.verifies || queueStep?.verifies?.replace(/\{slug\}/g, slug) || null,
    urls,
    imessage: f.imessage ? String(f.imessage).replace(/\{slug\}/g, slug) : null,
    router: f.router || null,
    queue: {
      role: queueStep?.id || null,
      next_step: queueStep?.next || f.next_in_queue || null,
      pipeline: MODEL_GROW_QUEUE.map((s) => ({
        id: s.id,
        model: s.model,
        what: s.what,
      })),
    },
    related: (f.related || []).map((id) => ({
      id,
      what: FEATURES[id]?.what,
    })),
    not_medical_advice: true,
  };
}

export function explainGrowStep(step, result, slug) {
  const def = MODEL_GROW_QUEUE.find((s) => s.id === step) || {};
  return {
    step,
    slug,
    model: def.model,
    what: def.what,
    why: def.why,
    how: def.how,
    verifies: def.verifies?.replace(/\{slug\}/g, slug),
    outcome: result?.ok === false ? "failed" : result?.material === false ? "no_material" : "ok",
    detail: result?.error || result?.rationale || result?.claims_added || result?.added || null,
    next_recommended: def.next,
    canvas: BASE + "/graph.html?slugs=" + slug,
    vault: BASE + "/api/articles/obsidian-vault?slugs=" + slug,
  };
}

/** Attach rich _explain alongside _self on any payload. */
export function attachExplain(data, featureId, ctx = {}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { _explain: explainFeature(featureId, ctx), data };
  }
  return {
    _explain: explainFeature(featureId, ctx),
    ...data,
  };
}