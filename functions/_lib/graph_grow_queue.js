// Model growth queue — populate → collaborate → repair → reflex per slug.

import { auditLedgerHealth } from "./ledger_durability.js";
import { MODEL_GROW_QUEUE, explainGrowStep } from "./explain.js";
import { attachSelf } from "./self_explain.js";
import { planNextTick } from "./ledger_matrix.js";
import { auditEditorialScope } from "./article_editorial.js";

import { classifySlug } from "./article_ontology.js";

const BASE = "https://miscsubjects.com";
const DEFAULT_SLUGS = [
  "protocol",
  "bpc-157",
  "tb-500",
  "wolverine-stack-glp1",
  "ara-290",
  "tb-500-herniated-disc",
];

/** Priority-first slugs from content_map_57 (novelty 9–10 hooks). */
const PRIORITY_SLUGS = [
  "bpc-157-glp1-gut-damage",
  "tb-500-glp1-muscle-loss",
  "wolverine-stack-glp1",
  "ara-290-herniated-disc",
  "ara-290-sciatica",
  "ara-290-diabetic-neuropathy",
  "bpc-ara-herniated-disc",
  "recovery-stack-herniated-disc",
  "semax-adderall-neuroprotection",
  "semax-selank-adderall",
  "selank-adderall-jitteriness",
  "adderall-stack-intro",
];

async function loadAllSlugs(env) {
  const rows = await env.DB.prepare("SELECT slug FROM articles ORDER BY slug").all();
  return (rows.results || []).map((r) => r.slug);
}

async function resolveSlugList(env, opts = {}) {
  if (opts.slugs?.length) {
    return opts.slugs.map((s) => String(s).toLowerCase());
  }

  const matrixPlan = await planNextTick(env, { limit: 20 });
  const matrixSlugs = (matrixPlan.plans || []).map((p) => p.slug).filter(Boolean);

  if (opts.all || opts.corpus) {
    const all = await loadAllSlugs(env);
    const priority = [
      ...matrixSlugs,
      ...PRIORITY_SLUGS.filter((s) => all.includes(s)),
    ].filter((s, i, a) => a.indexOf(s) === i);
    const rest = all.filter((s) => !priority.includes(s));
    return [...priority, ...rest];
  }

  if (matrixSlugs.length) {
    return [...matrixSlugs, ...DEFAULT_SLUGS.filter((s) => !matrixSlugs.includes(s))];
  }
  return DEFAULT_SLUGS;
}

function parseMeta(m) {
  try {
    return JSON.parse(m || "{}") || {};
  } catch {
    return {};
  }
}

async function fetchJson(path, body, env) {
  const headers = { "content-type": "application/json" };
  if (env.TERMINAL_KEY) headers["x-terminal-key"] = env.TERMINAL_KEY;
  const r = await fetch(BASE + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {}),
  });
  return { status: r.status, j: await r.json().catch(() => ({})) };
}

function modelsOnArticle(meta) {
  const set = new Set();
  for (const c of meta.contributions || []) if (c.model) set.add(String(c.model));
  return set;
}

/** Score what each slug needs next. */
export async function planGrowTargets(env, slugs) {
  const matrixPlan = await planNextTick(env, { limit: 30 });
  const matrixBoost = new Map(
    (matrixPlan.plans || []).map((p) => [p.slug, p.priority || 0]),
  );

  const plans = [];
  for (const slug of slugs) {
    const row = await env.DB.prepare(
      "SELECT slug, title, body, meta, updated_at FROM articles WHERE slug=?",
    )
      .bind(slug)
      .first();
    if (!row) {
      const matrixPriority = matrixBoost.get(slug) || 0;
      plans.push({
        slug,
        missing: true,
        next_step: matrixPlan.plans?.find((p) => p.slug === slug)?.step || "populate",
        reason:
          matrixPlan.plans?.find((p) => p.slug === slug)?.reason ||
          "article does not exist — populate creates seed",
        priority: Math.max(100, matrixPriority),
        matrix_priority: matrixPriority || undefined,
      });
      continue;
    }
    const meta = parseMeta(row.meta);
    const health = auditLedgerHealth(meta, slug);
    const sources = (meta.sources || []).length;
    const claims = (meta.claims || []).length;
    const bodyLen = String(row.body || "").length;
    const models = modelsOnArticle(meta);
    const hasKimi = [...models].some((m) => /kimi|moonshot/i.test(m));
    const hasGemini = [...models].some((m) => /gemini/i.test(m));
    const challenges = (meta.challenges || []).length;
    let next_step = "populate";
    let reason = "";
    let priority = 10;

    const protocolRow = await env.DB.prepare(
      "SELECT meta FROM articles WHERE slug='protocol'",
    ).first();
    const protocolMeta = protocolRow ? parseMeta(protocolRow.meta) : {};
    const reflexToday =
      (protocolMeta.reflex_last || "").slice(0, 10) ===
      new Date().toISOString().slice(0, 10);

    if (!reflexToday && slug === "protocol") {
      next_step = "reflex";
      reason = "protocol reflex pass not run today (vision conformance)";
      priority = 90;
    } else if (sources < 3) {
      next_step = "populate";
      reason = "source forest empty (" + sources + ")";
      priority = 95;
    } else if (sources < 8 || claims < 15) {
      next_step = sources < 8 ? "populate" : !hasKimi ? "kimi_collaborate" : !hasGemini ? "gemini_collaborate" : "repair";
      reason = sources < 8
        ? "sources thin (" + sources + ") — need science + social forest"
        : "claims thin (" + claims + ") — model pass";
      priority = sources < 8 ? 98 : 85;
    } else if (!hasKimi) {
      next_step = "kimi_collaborate";
      reason = "no Kimi contribution yet";
      priority = 70;
    } else if (!hasGemini) {
      next_step = "gemini_collaborate";
      reason = "no Gemini contribution yet";
      priority = 65;
    } else if (!(health.constitution || {}).complete) {
      next_step = "fill_slots";
      reason =
        "constitution incomplete: " +
        ((health.constitution || {}).missing_required || []).join(", ");
      priority = 88;
    } else if (!health.ok) {
      next_step = "repair";
      reason = "health audit failed: " + (health.issues || []).slice(0, 2).join("; ");
      priority = 75;
    } else if (claims >= 15 && challenges === 0 && hasGemini) {
      next_step = "kimi_adversary";
      reason = "no adversarial challenges — Kimi must push back on one overstrong claim";
      priority = 72;
    } else if (!(meta.editorial || {}).pass && claims >= 5) {
      const edAudit = auditEditorialScope(slug, row.title, row.body, meta);
      next_step = "editorial";
      reason =
        "editorial debate gate — " +
        (edAudit.violations[0]?.message || "mandate / question resolution not verified");
      priority = 94;
    } else if (bodyLen < 2800 && (claims >= 5 || sources >= 5)) {
      next_step = "synthesize_body";
      reason = "reader body thin (" + bodyLen + " chars) — ledger has " + claims + " claims / " + sources + " sources";
      priority = 92;
    } else if (claims < 15) {
      next_step = "kimi_collaborate";
      reason = "claim count low (" + claims + ")";
      priority = 40;
    } else {
      next_step = "populate";
      reason = "maintenance populate pass";
      priority = 20;
    }

    const matrixPriority = matrixBoost.get(slug) || 0;
    if (matrixPriority > priority) {
      priority = matrixPriority;
      if (matrixPlan.plans?.find((p) => p.slug === slug)?.layer === "peptide_root") {
        reason = "matrix: missing canonical peptide root";
      } else if (matrixPlan.plans?.find((p) => p.slug === slug)?.layer === "cross_cell") {
        reason = matrixPlan.plans.find((p) => p.slug === slug)?.reason || reason;
      }
    }

    plans.push({
      slug,
      title: row.title,
      role: classifySlug(slug),
      sources,
      claims,
      models: [...models],
      health_ok: health.ok,
      next_step,
      reason,
      priority,
      matrix_priority: matrixPriority || undefined,
    });
  }
  plans.sort((a, b) => b.priority - a.priority);
  return plans;
}

async function runStep(env, slug, step) {
  switch (step) {
    case "populate":
      return (
        await fetchJson("/api/protocol/populate", {
          slug,
          max_rounds: 4,
          focus: "science",
        }, env)
      ).j;
    case "kimi_collaborate":
      return (
        await fetchJson("/api/protocol/collaborate", {
          slug,
          model: "kimi/moonshot-v1-8k",
        }, env)
      ).j;
    case "gemini_collaborate":
      return (
        await fetchJson("/api/protocol/collaborate", {
          slug,
          model: "gemini/gemini-2.5-flash",
        }, env)
      ).j;
    case "kimi_adversary":
      return (
        await fetchJson("/api/protocol/collaborate", {
          slug,
          model: "kimi/moonshot-v1-8k",
          require_challenge: true,
        }, env)
      ).j;
    case "fill_slots":
      return (await fetchJson("/api/protocol/fill-slots", { slug }, env)).j;
    case "repair":
      return (
        await fetchJson(
          "/api/protocol/repair",
          { slug, materialize_orphans: false, retier_claims: true },
          env,
        )
      ).j;
    case "synthesize_body":
      return (
        await fetchJson("/api/protocol/synthesize-body", { slug }, env)
      ).j;
    case "reflex":
      return (await fetchJson("/api/protocol/reflex", { slug: "protocol" }, env)).j;
    case "backfill_mapping":
      return (await fetchJson("/api/matrix/backfill", { slugs: [slug] }, env)).j;
    case "editorial":
      return (
        await fetchJson(
          "/api/protocol/editorial",
          { slug, model: "kimi/moonshot-v1-8k" },
          env,
        )
      ).j;
    default:
      return { error: "unknown step: " + step };
  }
}

/** One growth tick — pick slug, run one queue step, full explainability. */
export async function runGrowTick(env, opts = {}) {
  const slugParam = opts.slug ? String(opts.slug).toLowerCase() : null;
  const stepParam = opts.step || null;
  const slugs = await resolveSlugList(env, opts);
  const exclude = new Set((opts.excludeSlugs || []).map((s) => String(s).toLowerCase()));

  const plans = await planGrowTargets(env, slugs);
  const pick = slugParam
    ? plans.find((p) => p.slug === slugParam) || { slug: slugParam, next_step: stepParam || "populate", reason: "forced" }
    : plans.find((p) => !exclude.has(p.slug)) || plans[0];

  if (!pick) {
    return attachSelf({ ok: false, error: "no grow targets" }, "graph_grow", {
      contains: "model growth queue — no slugs to process",
    });
  }

  const step = stepParam || pick.next_step;
  const result = await runStep(env, pick.slug, step);
  const explain = explainGrowStep(step, result, pick.slug);

  const matrixTick = await planNextTick(env, { limit: 8 });

  const out = {
    ok: !result.error,
    tick: {
      slug: pick.slug,
      step,
      reason: pick.reason,
      plan: pick,
    },
    result,
    explain,
    queue: MODEL_GROW_QUEUE,
    matrix: {
      pick: matrixTick.pick,
      entropy: matrixTick.entropy,
      gaps: matrixTick.gaps_summary,
    },
    plans: plans.slice(0, 6),
    urls: {
      graph: BASE + "/graph.html?slugs=" + pick.slug,
      health: BASE + "/api/articles/" + pick.slug + "/health",
      vault: BASE + "/api/articles/obsidian-vault?slugs=" + pick.slug,
      system_map: BASE + "/api/articles/system-map?format=markdown",
    },
    next: {
      command: "POST /api/protocol/grow",
      dispatch: "[GRAPH_GROW][/GRAPH_GROW] or [GRAPH_GROW]" + pick.slug + "|" + (MODEL_GROW_QUEUE.find((s) => s.id === step)?.next || "populate") + "[/GRAPH_GROW]",
      suggested_slug: plans[1]?.slug || pick.slug,
      suggested_step: plans.find((p) => p.slug === (plans[1]?.slug || pick.slug))?.next_step,
    },
  };

  return attachSelf(
    { ...out, explain_step: explain },
    "graph_grow",
    {
      slug: pick.slug,
      contains: "one model queue tick — populate/collaborate/repair/reflex",
      how_to_use: "POST /api/protocol/grow or [GRAPH_GROW][/GRAPH_GROW]",
      why: explain.why,
    },
  );
}

export async function runGrowBatch(env, opts = {}) {
  const n = Math.min(20, Math.max(1, Number(opts.count) || 3));
  const results = [];
  const used = [];
  for (let i = 0; i < n; i++) {
    const tick = await runGrowTick(env, {
      slugs: opts.slugs,
      all: opts.all,
      corpus: opts.corpus,
      slug: opts.slug && i === 0 ? opts.slug : null,
      step: i === 0 ? opts.step : null,
      excludeSlugs: used,
      force: opts.force,
    });
    results.push(tick);
    if (tick.tick?.slug) used.push(tick.tick.slug);
    if (tick.result?.error && !opts.force) break;
  }
  return attachSelf(
    { ok: true, ticks: results.length, results },
    "graph_grow_batch",
    {
      contains: "multi-tick model growth queue",
      how_to_use: "POST /api/protocol/grow {\"batch\":3}",
    },
  );
}