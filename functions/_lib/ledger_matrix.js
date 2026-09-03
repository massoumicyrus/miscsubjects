// Combinatorial matrix engine — canonical inventory × cross cells × entropy control.
// The ledger uses this to recursively plan its own population, sprawl, and negentropy.

import {
  PEPTIDE_CATALOG,
  CONDITION_CATALOG,
  PHARMA_CATALOG,
  TARGET_CATALOG,
  crossSlug,
  peptideRootSlug,
  layerForPeptide,
  catalogById,
  parseCrossSlug,
} from "./ledger_canonical.js";

export { parseCrossSlug } from "./ledger_canonical.js";
import { PEPTIDE_STACK_LAYER } from "./condition_framework.js";
import { buildArticleOntology } from "./article_ontology.js";

const BASE = "https://miscsubjects.com";

/** Peptide layer relevance to target body_system (0..1). */
const LAYER_MATCH = {
  "structure / tissue": [
    "spine",
    "disc",
    "joint",
    "fascia",
    "wound",
    "skin",
    "muscle",
    "tendon",
    "capsule",
    "foot",
  ],
  "inflammation / migration": [
    "spine",
    "disc",
    "joint",
    "fascia",
    "GI",
    "gut",
    "inflammation",
    "capsule",
  ],
  "nerve / innervation": [
    "nerve",
    "neuropathy",
    "sciatic",
    "cranial",
    "brain",
    "CNS",
    "peripheral",
  ],
  "neural / cognitive": ["brain", "CNS", "cognitive", "sleep", "pineal"],
  "anxiety / neurochemistry": ["CNS", "GABA", "anxiety", "sleep"],
  "sleep / repair window": ["sleep", "CNS"],
  "gut / localized anti-inflammatory": ["GI", "gut"],
  "collagen / skin matrix": ["skin", "face", "collagen"],
  "mitochondrial / metabolic": ["metabolic", "muscle", "mitochondrial"],
  "mitochondrial": ["metabolic", "muscle", "mitochondrial"],
  "metabolic / GLP-1": ["metabolic", "GI", "muscle", "skin"],
  "metabolic / GLP-1/GIP": ["metabolic", "GI", "muscle", "skin"],
  "metabolic / GLP-1/GIP/glucagon": ["metabolic", "GI", "muscle", "skin"],
  "immune modulation": ["immune", "multi-system"],
  "senolytic": ["multi-system", "skin"],
};

function parseMeta(m) {
  try {
    return JSON.parse(m || "{}") || {};
  } catch {
    return {};
  }
}

function clamp(n, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, n));
}

function layerRelevance(peptideId, target) {
  const layer = layerForPeptide(peptideId);
  const body = String(target?.body_system || target?.degenerative_logic || "").toLowerCase();
  const keywords = LAYER_MATCH[layer] || [];
  let hits = 0;
  for (const kw of keywords) {
    if (body.includes(kw.toLowerCase())) hits++;
  }
  const base = hits > 0 ? 0.45 + Math.min(0.45, hits * 0.15) : 0.2;

  const stack = PEPTIDE_STACK_LAYER[peptideId];
  if (stack?.targets_degeneration) {
    const tgtText = String(target?.name || target?.id || "").toLowerCase();
    const degText = stack.targets_degeneration.toLowerCase();
    if (
      (tgtText.includes("nerve") || tgtText.includes("neuropathy")) &&
      degText.includes("nerve")
    ) {
      return clamp(base + 0.2);
    }
    if (
      (tgtText.includes("gut") || tgtText.includes("gi")) &&
      (degText.includes("gut") || layer.includes("gut"))
    ) {
      return clamp(base + 0.15);
    }
    if (tgtText.includes("disc") && degText.includes("disc")) return clamp(base + 0.15);
  }
  return clamp(base);
}

function evidenceFactor(peptideId) {
  const ev = PEPTIDE_CATALOG.find((p) => p.id === peptideId)?.evidence_typical || "";
  if (/human/i.test(ev)) return 0.85;
  if (/preclinical/i.test(ev)) return 0.55;
  if (/emerging human/i.test(ev)) return 0.7;
  return 0.4;
}

/** Transparent combinatorial mapping per PROTOCOL_SPEC §mapping. */
export function computeMapping(peptideId, targetId, targetKind = "condition") {
  const peptide = catalogById("peptide", peptideId);
  const target = catalogById(targetKind, targetId) || catalogById("condition", targetId);
  if (!peptide || !target) return { error: "unknown peptide or target", peptideId, targetId };

  const layerRel = layerRelevance(peptideId, target);
  const evFactor = evidenceFactor(peptideId);
  const regen_score = clamp(layerRel * evFactor + (layerRel > 0.5 ? 0.08 : 0));
  const degen_score = clamp(Number(target.degen_score ?? 0.5));
  const delta = Math.round((regen_score - degen_score) * 1000) / 1000;
  const weight = clamp(delta, 0, 1);

  return {
    peptide: peptideId,
    target: targetId,
    target_kind: target.kind || targetKind,
    body_system: target.body_system || target.degenerative_logic?.slice(0, 80) || "general",
    mechanism:
      PEPTIDE_STACK_LAYER[peptideId]?.regenerative_mechanism ||
      peptide.regenerative_role ||
      `Studied ${peptide.layer} role vs ${target.name}`,
    population: "RUO research context — not medical advice",
    data_type: evFactor >= 0.7 ? "cohort" : evFactor >= 0.55 ? "animal" : "mechanistic",
    evidence_tier:
      evFactor >= 0.7 ? "preclinical" : evFactor >= 0.55 ? "preclinical" : "mechanistic",
    regen_score: Math.round(regen_score * 1000) / 1000,
    degen_score,
    delta,
    weight,
    status: "queued",
    slug: crossSlug(peptideId, targetId),
    methodology: {
      regen: `layer_relevance(${layerRel.toFixed(2)}) × evidence_factor(${evFactor.toFixed(2)})`,
      degen: `catalog.degen_score for ${target.name}`,
      delta: "regen_score − degen_score",
      layer: peptide.layer,
      body_system: target.body_system || null,
    },
  };
}

export function buildMatrixCells(opts = {}) {
  const minDelta = Number(opts.min_delta ?? -1);
  const cells = [];
  for (const pep of PEPTIDE_CATALOG) {
    for (const tgt of TARGET_CATALOG) {
      const m = computeMapping(pep.id, tgt.id, tgt.kind);
      if (m.error) continue;
      if (m.delta < minDelta) continue;
      cells.push(m);
    }
  }
  cells.sort((a, b) => b.delta - a.delta);
  return cells;
}

async function loadArticleIndex(env) {
  const rows = await env.DB.prepare("SELECT slug, title, meta FROM articles").all();
  const bySlug = new Map();
  for (const r of rows.results || []) {
    bySlug.set(r.slug, { slug: r.slug, title: r.title, meta: parseMeta(r.meta) });
  }
  return bySlug;
}

async function loadPipelineIndex(env) {
  const rows = await env.DB.prepare("SELECT id, kind, name, pair_a, pair_b, weight, slug, phase, status, data FROM pipeline").all();
  const byKind = { peptide: [], condition: [], pharma: [], combo: [] };
  for (const r of rows.results || []) {
    const k = r.kind || "peptide";
    if (!byKind[k]) byKind[k] = [];
    byKind[k].push(r);
  }
  return byKind;
}

/** Gap audit — what the canonical says should exist vs what does. */
export async function auditGaps(env) {
  const articles = await loadArticleIndex(env);
  const pipeline = await loadPipelineIndex(env);

  const peptideRoots = PEPTIDE_CATALOG.map((p) => ({
    id: p.id,
    name: p.name,
    slug: peptideRootSlug(p.id),
    has_article: articles.has(peptideRootSlug(p.id)),
    in_pipeline: pipeline.peptide.some(
      (r) => r.name?.toLowerCase() === p.name.toLowerCase() || r.name?.toLowerCase() === p.id,
    ),
  }));

  const missing_roots = peptideRoots.filter((p) => !p.has_article);
  const targets = TARGET_CATALOG.map((t) => ({
    id: t.id,
    name: t.name,
    kind: t.kind,
    in_pipeline: pipeline[t.kind]?.some(
      (r) => r.name?.toLowerCase() === t.name.toLowerCase() || r.name?.toLowerCase() === t.id,
    ),
  }));

  const cells = buildMatrixCells();
  const cross_gaps = [];
  for (const m of cells) {
    const hasArticle =
      articles.has(m.slug) ||
      [...articles.keys()].some((s) => parseCrossSlug(s).peptide === m.peptide && parseCrossSlug(s).target === m.target);
    const inPipeline = pipeline.combo.some(
      (r) =>
        (r.pair_a === m.peptide || r.pair_a?.toLowerCase() === m.peptide) &&
        (r.pair_b === m.target || r.pair_b?.toLowerCase() === m.target),
    );
    if (!hasArticle) {
      cross_gaps.push({
        ...m,
        has_article: false,
        in_pipeline: inPipeline,
        priority: Math.round((m.delta + 1) * 50),
      });
    }
  }

  cross_gaps.sort((a, b) => b.delta - a.delta);

  const unmapped_articles = [];
  for (const [slug, art] of articles) {
    const parsed = parseCrossSlug(slug);
    if (parsed.cross && !art.meta.mapping) {
      unmapped_articles.push({
        slug,
        peptide: parsed.peptide,
        target: parsed.target,
        expected_slug: parsed.expected_slug,
      });
    }
  }

  return {
    canonical: {
      peptides: PEPTIDE_CATALOG.length,
      conditions: CONDITION_CATALOG.length,
      pharma: PHARMA_CATALOG.length,
      cross_cells: PEPTIDE_CATALOG.length * TARGET_CATALOG.length,
    },
    corpus: {
      articles: articles.size,
      peptide_roots: peptideRoots.filter((p) => p.has_article).length,
      missing_peptide_roots: missing_roots.length,
      cross_articles: [...articles.keys()].filter((s) => parseCrossSlug(s).cross).length,
      cross_gaps: cross_gaps.length,
      unmapped_crosses: unmapped_articles.length,
    },
    missing_roots,
    targets_missing_pipeline: targets.filter((t) => !t.in_pipeline),
    top_cross_gaps: cross_gaps.slice(0, 40),
    unmapped_articles: unmapped_articles.slice(0, 30),
  };
}

/** Entropy audit — sprawl, orphans, duplicates, negative-delta noise. */
export async function auditEntropy(env) {
  const ontology = await buildArticleOntology(env);
  const gaps = await auditGaps(env);
  const cells = buildMatrixCells();

  const low_delta_written = [];
  const articles = await loadArticleIndex(env);
  for (const [slug] of articles) {
    const parsed = parseCrossSlug(slug);
    if (!parsed.cross) continue;
    const m = computeMapping(parsed.peptide, parsed.target, parsed.kind);
    if (m.delta < 0) {
      low_delta_written.push({ slug, delta: m.delta, peptide: parsed.peptide, target: parsed.target });
    }
  }

  const orphan_count = ontology.sprawl?.length || 0;
  const misstep_count = ontology.misstep_candidates?.length || 0;
  const negentropy_actions = [];

  if (gaps.missing_roots.length) {
    negentropy_actions.push({
      action: "seed_peptide_roots",
      count: gaps.missing_roots.length,
      slugs: gaps.missing_roots.slice(0, 8).map((p) => p.slug),
    });
  }
  if (gaps.top_cross_gaps.length) {
    negentropy_actions.push({
      action: "populate_high_delta_crosses",
      count: gaps.top_cross_gaps.filter((g) => g.delta > 0).length,
      slugs: gaps.top_cross_gaps.filter((g) => g.delta > 0).slice(0, 6).map((g) => g.slug),
    });
  }
  if (gaps.unmapped_articles.length) {
    negentropy_actions.push({
      action: "backfill_mapping_meta",
      count: gaps.unmapped_articles.length,
    });
  }
  if (orphan_count) {
    negentropy_actions.push({
      action: "collapse_orphans",
      count: orphan_count,
      slugs: (ontology.sprawl || []).slice(0, 6).map((s) => s.slug),
    });
  }
  if (low_delta_written.length) {
    negentropy_actions.push({
      action: "review_low_delta_crosses",
      count: low_delta_written.length,
      note: "written crosses where regen < target degen — may be sprawl",
    });
  }

  const entropy_score = clamp(
    (orphan_count * 0.05 +
      misstep_count * 0.04 +
      gaps.corpus.missing_peptide_roots * 0.08 +
      gaps.corpus.cross_gaps * 0.001 +
      low_delta_written.length * 0.03) /
      2,
    0,
    1,
  );
  const negentropy_score = clamp(1 - entropy_score + gaps.corpus.peptide_roots / PEPTIDE_CATALOG.length / 2, 0, 1);

  return {
    entropy_score: Math.round(entropy_score * 1000) / 1000,
    negentropy_score: Math.round(negentropy_score * 1000) / 1000,
    sprawl: ontology.sprawl?.slice(0, 20) || [],
    misstep_candidates: ontology.misstep_candidates?.slice(0, 15) || [],
    low_delta_written: low_delta_written.slice(0, 15),
    negentropy_actions,
    matrix_stats: {
      total_cells: cells.length,
      positive_delta: cells.filter((c) => c.delta > 0).length,
      high_delta_gt_0_3: cells.filter((c) => c.delta > 0.3).length,
    },
  };
}

/** Recursive population plan — what the ledger should grow next. */
export async function planNextTick(env, opts = {}) {
  const limit = Math.min(30, Number(opts.limit) || 12);
  const gaps = await auditGaps(env);
  const entropy = await auditEntropy(env);
  const plans = [];

  for (const root of gaps.missing_roots) {
    plans.push({
      slug: root.slug,
      step: "populate",
      layer: "peptide_root",
      reason: `canonical peptide root missing — ${root.name}`,
      priority: 200 + (PEPTIDE_CATALOG.findIndex((p) => p.id === root.id) < 15 ? 5 : 0),
      mapping: null,
    });
  }

  for (const gap of gaps.top_cross_gaps.filter((g) => g.delta > -0.2).slice(0, limit)) {
    plans.push({
      slug: gap.slug,
      step: "populate",
      layer: "cross_cell",
      reason: `matrix gap Δ=${gap.delta} — ${gap.peptide} × ${gap.target}`,
      priority: 120 + Math.round(gap.delta * 80),
      mapping: gap,
    });
  }

  for (const u of gaps.unmapped_articles.slice(0, 10)) {
    plans.push({
      slug: u.slug,
      step: "backfill_mapping",
      layer: "meta",
      reason: "cross article lacks meta.mapping",
      priority: 95,
      mapping: computeMapping(u.peptide, u.target),
    });
  }

  for (const action of entropy.negentropy_actions) {
    if (action.action === "collapse_orphans" && action.slugs?.length) {
      for (const slug of action.slugs.slice(0, 3)) {
        plans.push({
          slug,
          step: "repair",
          layer: "entropy",
          reason: "orphan sprawl — repair/embed",
          priority: 70,
        });
      }
    }
  }

  plans.sort((a, b) => b.priority - a.priority);
  const pick = plans[0] || null;

  return {
    pick,
    plans: plans.slice(0, limit),
    gaps_summary: {
      missing_roots: gaps.missing_roots.length,
      cross_gaps: gaps.corpus.cross_gaps,
      unmapped: gaps.corpus.unmapped_crosses,
    },
    entropy: {
      score: entropy.entropy_score,
      negentropy: entropy.negentropy_score,
      actions: entropy.negentropy_actions,
    },
    urls: {
      matrix: BASE + "/api/matrix",
      gaps: BASE + "/api/matrix/gaps",
      entropy: BASE + "/api/matrix/entropy",
      seed: "POST " + BASE + "/api/matrix/seed",
    },
  };
}

/** Seed canonical inventory into pipeline table (deterministic, no LLM). */
export async function seedCanonical(env) {
  const ts = new Date().toISOString();
  let inserted = { peptide: 0, condition: 0, pharma: 0 };
  let existing = { peptide: 0, condition: 0, pharma: 0 };

  async function upsertKind(kind, items) {
    for (const it of items) {
      const name = it.name || it.id;
      const row = await env.DB.prepare("SELECT id FROM pipeline WHERE kind=? AND (name=? OR name=?)")
        .bind(kind, name, it.id)
        .first();
      if (row) {
        existing[kind]++;
        continue;
      }
      await env.DB.prepare(
        "INSERT INTO pipeline (kind, name, phase, evidence, data, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          kind,
          name,
          "queued",
          it.evidence_typical || it.pathway || "",
          JSON.stringify({ canonical_id: it.id, layer: it.layer || it.body_system || null }),
          "pending",
          ts,
        )
        .run();
      inserted[kind]++;
    }
  }

  await upsertKind("peptide", PEPTIDE_CATALOG);
  await upsertKind("condition", CONDITION_CATALOG);
  await upsertKind("pharma", PHARMA_CATALOG);

  return { ok: true, inserted, existing, total_catalog: PEPTIDE_CATALOG.length + CONDITION_CATALOG.length + PHARMA_CATALOG.length };
}

/** Sync combinatorial combo rows from canonical matrix. */
export async function syncCombos(env, opts = {}) {
  const minDelta = Number(opts.min_delta ?? -0.5);
  const ts = new Date().toISOString();
  const cells = buildMatrixCells({ min_delta: minDelta });
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const m of cells) {
    const name = `${m.peptide} × ${m.target}`;
    const row = await env.DB.prepare(
      "SELECT id, weight, data FROM pipeline WHERE kind='combo' AND pair_a=? AND pair_b=?",
    )
      .bind(m.peptide, m.target)
      .first();

    if (row) {
      const data = parseMeta(row.data);
      data.mapping = m;
      await env.DB.prepare("UPDATE pipeline SET weight=?, data=?, updated_at=? WHERE id=?")
        .bind(m.weight, JSON.stringify(data), ts, row.id)
        .run();
      updated++;
      continue;
    }

    await env.DB.prepare(
      "INSERT INTO pipeline (kind, name, phase, pair_a, pair_b, weight, evidence, data, status, updated_at) VALUES ('combo', ?, 'queued', ?, ?, ?, ?, ?, 'pending', ?)",
    )
      .bind(
        name,
        m.peptide,
        m.target,
        m.weight,
        m.evidence_tier,
        JSON.stringify({ mapping: m }),
        ts,
      )
      .run();
    inserted++;
  }

  return {
    ok: true,
    inserted,
    updated,
    skipped,
    total_cells: cells.length,
    positive_delta: cells.filter((c) => c.delta > 0).length,
  };
}

/** Backfill meta.mapping on cross articles from computed matrix. */
export async function backfillMapping(env, opts = {}) {
  const slugs = opts.slugs;
  const articles = await loadArticleIndex(env);
  const ts = new Date().toISOString();
  let updated = 0;
  const results = [];

  const targets = slugs?.length ? slugs : [...articles.keys()];

  for (const slug of targets) {
    const art = articles.get(slug);
    if (!art) continue;
    const parsed = parseCrossSlug(slug);
    if (!parsed.cross || !parsed.peptide || !parsed.target) continue;
    if (art.meta.mapping?.delta != null && !opts.force) continue;

    const mapping = computeMapping(parsed.peptide, parsed.target, parsed.kind);
    const meta = { ...art.meta, mapping };
    const methodology_claim = {
      id: "c_map_" + slug.slice(0, 24),
      text:
        `Combinatorial mapping (transparent): ${mapping.peptide} vs ${mapping.target} — ` +
        `regen=${mapping.regen_score}, degen=${mapping.degen_score}, Δ=${mapping.delta}. ` +
        `Method: ${mapping.methodology.regen}; ${mapping.methodology.degen}.`,
      section: "what_is_known",
      tier: "system",
      weight: 0.35,
      stance_scores: {},
    };
    const claims = Array.isArray(meta.claims) ? [...meta.claims] : [];
    const idx = claims.findIndex((c) => String(c.id || "").startsWith("c_map_"));
    if (idx >= 0) claims[idx] = methodology_claim;
    else claims.push(methodology_claim);
    meta.claims = claims;

    await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
      .bind(JSON.stringify(meta), ts, slug)
      .run();
    updated++;
    results.push({ slug, delta: mapping.delta, mapping });
  }

  return { ok: true, updated, results: results.slice(0, 20) };
}

/** Full matrix snapshot for GET /api/matrix. */
export async function matrixSnapshot(env, opts = {}) {
  const peptide = opts.peptide ? String(opts.peptide).toLowerCase() : null;
  const target = opts.target ? String(opts.target).toLowerCase() : null;
  const gaps = await auditGaps(env);
  const entropy = await auditEntropy(env);

  let cells = buildMatrixCells({ min_delta: Number(opts.min_delta ?? -1) });
  if (peptide) cells = cells.filter((c) => c.peptide === peptide);
  if (target) cells = cells.filter((c) => c.target === target);

  const articles = await loadArticleIndex(env);
  const enriched = cells.slice(0, Number(opts.limit) || 200).map((c) => ({
    ...c,
    has_article: articles.has(c.slug),
    url: articles.has(c.slug) ? BASE + "/a/" + c.slug : null,
  }));

  return {
    catalog: {
      peptides: PEPTIDE_CATALOG.map((p) => ({ id: p.id, name: p.name, layer: p.layer, pathway: p.pathway })),
      conditions: CONDITION_CATALOG.map((c) => ({ id: c.id, name: c.name, degen_score: c.degen_score })),
      pharma: PHARMA_CATALOG.map((p) => ({ id: p.id, name: p.name, degen_score: p.degen_score })),
    },
    cells: enriched,
    gaps: gaps.corpus,
    missing_roots: gaps.missing_roots.map((p) => p.id),
    entropy: {
      score: entropy.entropy_score,
      negentropy: entropy.negentropy_score,
    },
    methodology:
      "Each cell: regen_score = layer_relevance × evidence_factor; degen_score = catalog; delta = regen − degen; weight = clamp(delta,0,1). Ledger plans population from gaps + entropy.",
  };
}