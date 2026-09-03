import { attachSelf } from "../../_lib/self_explain.js";
import {
  matrixSnapshot,
  auditGaps,
  auditEntropy,
  planNextTick,
  seedCanonical,
  syncCombos,
  backfillMapping,
  computeMapping,
  parseCrossSlug,
  buildMatrixCells,
} from "../../_lib/ledger_matrix.js";
import {
  PEPTIDE_CATALOG,
  CONDITION_CATALOG,
  PHARMA_CATALOG,
} from "../../_lib/ledger_canonical.js";

const BASE = "https://miscsubjects.com";

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function authed(request, env) {
  return (
    !!env.TERMINAL_KEY &&
    (request.headers.get("x-terminal-key") || "") === env.TERMINAL_KEY
  );
}

function contract() {
  return {
    service: "combinatorial matrix",
    what:
      "Canonical peptide × degenerative target matrix with transparent regen/degen/delta scoring. Drives recursive ledger population and entropy control.",
    catalog: {
      peptides: PEPTIDE_CATALOG.length,
      conditions: CONDITION_CATALOG.length,
      pharma: PHARMA_CATALOG.length,
    },
    endpoints: {
      "GET /api/matrix": "full snapshot — ?peptide=&target=&min_delta=&limit=",
      "GET /api/matrix/gaps": "missing roots, cross gaps, unmapped articles",
      "GET /api/matrix/entropy": "sprawl/orphan audit + negentropy actions",
      "GET /api/matrix/plan": "next recursive population tick",
      "GET /api/matrix/peptide/:id": "all cells for one peptide",
      "GET /api/matrix/target/:id": "all cells for one condition/pharma target",
      "POST /api/matrix/seed": "seed canonical → pipeline (auth)",
      "POST /api/matrix/sync": "sync combo rows with mapping weights (auth)",
      "POST /api/matrix/backfill": "write meta.mapping on cross articles (auth)",
      "POST /api/matrix/compute": "compute one mapping {peptide,target,target_kind} (auth)",
    },
    related: {
      protocol_grow: BASE + "/api/protocol/grow",
      ontology: BASE + "/api/articles/ontology",
      spec: "PROTOCOL_SPEC.md §mapping",
    },
  };
}

async function handle(request, env) {
  if (!env.DB) return json({ error: "DB binding missing" }, 503);

  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const action = (parts[2] || "").toLowerCase();
  const sub = (parts[3] || "").toLowerCase();
  const mutates = method === "POST" || method === "PUT" || method === "PATCH";
  if (mutates && !authed(request, env)) {
    return json({ error: "unauthorized — header x-terminal-key required" }, 401);
  }

  if (method === "GET" && !action) {
    const snap = await matrixSnapshot(env, {
      peptide: url.searchParams.get("peptide"),
      target: url.searchParams.get("target"),
      min_delta: url.searchParams.get("min_delta"),
      limit: url.searchParams.get("limit") || 100,
    });
    return json(
      attachSelf(snap, "matrix", {
        what: "combinatorial peptide × degenerative target matrix",
        how_to_use: "GET /api/matrix/gaps then POST /api/matrix/seed + /sync",
        related: [BASE + "/api/matrix/plan", BASE + "/api/protocol/grow"],
      }),
    );
  }

  if (method === "GET" && action === "gaps") {
    const gaps = await auditGaps(env);
    return json(
      attachSelf({ ok: true, ...gaps }, "matrix_gaps", {
        what: "canonical inventory vs corpus gaps",
        why: "drives which peptide roots and cross cells the ledger must populate",
      }),
    );
  }

  if (method === "GET" && action === "entropy") {
    const entropy = await auditEntropy(env);
    return json(
      attachSelf({ ok: true, ...entropy }, "matrix_entropy", {
        what: "sprawl, orphans, low-delta noise — negentropy control",
      }),
    );
  }

  if (method === "GET" && action === "plan") {
    const plan = await planNextTick(env, { limit: url.searchParams.get("limit") });
    return json(
      attachSelf({ ok: true, ...plan }, "matrix_plan", {
        what: "recursive population tick — what the ledger grows next",
        how_to_use: "POST /api/protocol/grow or POST /api/matrix/tick",
      }),
    );
  }

  if (method === "GET" && action === "peptide" && sub) {
    const cells = buildMatrixCells().filter((c) => c.peptide === sub);
    return json({ ok: true, peptide: sub, cells, count: cells.length });
  }

  if (method === "GET" && action === "target" && sub) {
    const cells = buildMatrixCells().filter((c) => c.target === sub);
    return json({ ok: true, target: sub, cells, count: cells.length });
  }

  if (method === "GET" && action === "parse" && sub) {
    return json({ ok: true, slug: sub, parsed: parseCrossSlug(sub) });
  }

  if (method === "POST" && action === "seed") {
    const out = await seedCanonical(env);
    return json(
      attachSelf(out, "matrix_seed", {
        what: "deterministic canonical seed → pipeline table",
      }),
    );
  }

  if (method === "POST" && action === "sync") {
    const b = await request.json().catch(() => ({}));
    const out = await syncCombos(env, b);
    return json(
      attachSelf(out, "matrix_sync", {
        what: "peptide × target combo rows with transparent mapping weights",
      }),
    );
  }

  if (method === "POST" && action === "backfill") {
    const b = await request.json().catch(() => ({}));
    const out = await backfillMapping(env, b);
    return json(
      attachSelf(out, "matrix_backfill", {
        what: "meta.mapping + methodology claim on cross articles",
      }),
    );
  }

  if (method === "POST" && action === "compute") {
    const b = await request.json().catch(() => ({}));
    const m = computeMapping(b.peptide, b.target, b.target_kind || "condition");
    return json(m.error ? m : { ok: true, mapping: m }, m.error ? 400 : 200);
  }

  if (method === "POST" && action === "tick") {
    const plan = await planNextTick(env);
    if (!plan.pick) return json({ ok: false, error: "no matrix tick available", plan }, 404);

    const pick = plan.pick;
    if (pick.step === "backfill_mapping") {
      const out = await backfillMapping(env, { slugs: [pick.slug] });
      return json({ ok: true, tick: pick, result: out, plan: plan.plans.slice(0, 8) });
    }

    const headers = { "content-type": "application/json" };
    if (env.TERMINAL_KEY) headers["x-terminal-key"] = env.TERMINAL_KEY;
    const path =
      pick.step === "repair"
        ? "/api/protocol/repair"
        : "/api/protocol/populate";
    const body =
      pick.step === "repair"
        ? { slug: pick.slug, materialize_orphans: false }
        : { slug: pick.slug, max_rounds: 4, focus: "science" };

    const r = await fetch(BASE + path, { method: "POST", headers, body: JSON.stringify(body) });
    const result = await r.json().catch(() => ({}));
    return json({
      ok: !result.error,
      tick: pick,
      result,
      entropy: plan.entropy,
      next_plans: plan.plans.slice(1, 6),
    });
  }

  return json(contract(), 404);
}

export async function onRequest(context) {
  return handle(context.request, context.env);
}