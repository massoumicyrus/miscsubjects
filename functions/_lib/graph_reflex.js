// Reflex layer — graph proves its own shape by probing live state vs vision claims.

import { enrichClaim } from "./ledger_durability.js";
import { isActiveClaim } from "./ledger_honesty.js";

const BASE = "https://miscsubjects.com";

/** Vision probes: weakness/significance claim → live check → reflex edge kind */
export const REFLEX_PROBES = [
  {
    vision_id: "c7",
    slug: "protocol",
    label: "multi-model monoculture solved",
    async probe() {
      const j = await fetch(BASE + "/api/articles/bpc-157/contributions").then((r) =>
        r.json(),
      );
      const models = (j.models || []).map(String);
      const ok =
        models.some((m) => /kimi|moonshot/i.test(m)) &&
        models.some((m) => /gemini/i.test(m));
      return {
        ok,
        detail: `bpc-157 models: ${models.join(", ") || "none"}`,
        cross_slug: "bpc-157",
      };
    },
  },
  {
    vision_id: "c31",
    slug: "protocol",
    label: "Kimi+Gemini live writeback evidenced",
    async probe() {
      const j = await fetch(BASE + "/api/articles/bpc-157/contributions").then((r) =>
        r.json(),
      );
      return {
        ok: (j.count || 0) >= 2 && (j.verification?.valid !== false),
        detail: `contributions=${j.count} valid=${j.verification?.valid}`,
        cross_slug: "bpc-157",
      };
    },
  },
  {
    vision_id: "c9",
    slug: "protocol",
    label: "source forest not monoculture (bpc-157)",
    async probe() {
      const j = await fetch(BASE + "/api/articles/bpc-157/sources").then((r) =>
        r.json(),
      );
      const types = new Set((j.sources || []).map((s) => s.type));
      return {
        ok: (j.count || 0) >= 10 && types.has("pubmed") && types.has("reddit"),
        detail: `sources=${j.count} types=${[...types].join(",")}`,
        cross_slug: "bpc-157",
      };
    },
  },
  {
    vision_id: "c14",
    slug: "protocol",
    label: "adversary challenge layer exercised",
    async probe() {
      const h = await fetch(BASE + "/api/articles/bpc-157/health").then((r) =>
        r.json(),
      );
      return {
        ok: (h.honesty?.challenges || 0) >= 1,
        detail: `challenges=${h.honesty?.challenges}`,
        cross_slug: "bpc-157",
      };
    },
  },
  {
    vision_id: "c11",
    slug: "protocol",
    label: "hash chain valid on flagship",
    async probe() {
      const s = await fetch(BASE + "/api/articles/bpc-157/sources").then((r) =>
        r.json(),
      );
      return {
        ok: s.verification?.valid === true,
        detail: `chain head=${(s.verification?.head || "").slice(0, 12)}`,
        cross_slug: "bpc-157",
      };
    },
  },
  {
    vision_id: "c25",
    slug: "protocol",
    label: "decentralized spine (still centralized — expect gap)",
    async probe() {
      return { ok: false, detail: "D1/Pages/TERMINAL_KEY — documented weakness, not fixed", gap: true };
    },
  },
  {
    vision_id: "c30",
    slug: "protocol",
    label: "unified graph API live",
    async probe() {
      const j = await fetch(BASE + "/api/graph?slugs=protocol,bpc-157&depth=1").then((r) =>
        r.json(),
      );
      return {
        ok: j.ok === true && (j.counts?.claims || 0) >= 20,
        detail: `claims=${j.counts?.claims} edges=${j.counts?.edges}`,
        cross_slug: "bpc-157",
      };
    },
  },
  {
    vision_id: "c17",
    slug: "protocol",
    label: "graph canvas browser shipped",
    async probe() {
      const r = await fetch(BASE + "/graph.html", { method: "HEAD" });
      return {
        ok: r.ok,
        detail: `graph.html status=${r.status}`,
      };
    },
  },
  {
    vision_id: "c24",
    slug: "protocol",
    label: "ontology embed wiring (still thin — expect gap)",
    async probe() {
      const j = await fetch(BASE + "/api/articles/bpc-157/health").then((r) => r.json());
      const embeds = j.embeds || j.ontology?.embeds || [];
      return {
        ok: Array.isArray(embeds) && embeds.length >= 2,
        detail: `bpc-157 embeds=${embeds.length || 0}`,
        gap: !embeds?.length,
        cross_slug: "bpc-157",
      };
    },
  },
];

export function reflexEdgesForClaim(claim) {
  const r = claim.reflex;
  if (!r || typeof r !== "object") return [];
  const edges = [];
  if (r.proves) edges.push({ type: "proves", target: r.proves });
  if (r.responds_to) edges.push({ type: "responds_to", target: r.responds_to });
  if (r.cross_proves) {
    const parts = String(r.cross_proves).split(":");
    const cid = parts.pop();
    const slug = parts.join(":") || "protocol";
    if (slug && cid) edges.push({ type: "proves", target: cid, cross_slug: slug });
  }
  if (r.live_probe) edges.push({ type: "live_probe", target: r.live_probe });
  if (r.kind === "conformance" && r.vision_id)
    edges.push({ type: "conforms_to", target: r.vision_id });
  return edges;
}

export async function runReflexPass(env, opts = {}) {
  const slug = String(opts.slug || "protocol").toLowerCase();
  const row = await env.DB.prepare("SELECT slug, title, meta FROM articles WHERE slug=?")
    .bind(slug)
    .first();
  if (!row) return { error: "article not found: " + slug };

  let meta;
  try {
    meta = JSON.parse(row.meta || "{}") || {};
  } catch {
    meta = {};
  }

  const claims = Array.isArray(meta.claims) ? meta.claims.map((c) => ({ ...c })) : [];
  const results = [];
  const added = [];
  let maxC = 0;
  claims.forEach((c) => {
    const m = /^c(\d+)$/.exec(String(c.id || ""));
    if (m) maxC = Math.max(maxC, +m[1]);
  });

  const ts = new Date().toISOString().slice(0, 19) + "Z";

  for (const probe of REFLEX_PROBES) {
    if (probe.slug !== slug) continue;
    let out;
    try {
      out = await probe.probe();
    } catch (e) {
      out = { ok: false, detail: String(e.message || e) };
    }
    results.push({ vision_id: probe.vision_id, label: probe.label, ...out });

    const vision = claims.find((c) => c.id === probe.vision_id);
    if (!vision) continue;

    const existing = claims.find(
      (c) =>
        c.reflex?.vision_id === probe.vision_id &&
        c.reflex?.probe_ts?.slice(0, 10) === ts.slice(0, 10),
    );
    if (existing) continue;

    const id = "c" + ++maxC;
    const text = out.ok
      ? `REFLEX OK [${ts}]: ${probe.label} — ${out.detail}`
      : out.gap
        ? `REFLEX GAP [${ts}]: ${probe.label} — ${out.detail} (weakness still open)`
        : `REFLEX FAIL [${ts}]: ${probe.label} — ${out.detail}`;

    const newClaim = enrichClaim(
      {
        id,
        text,
        tier: out.ok ? "system" : out.gap ? "human" : "speculative",
        weight: out.ok ? 0.35 : out.gap ? 0.8 : 0.1,
        slot: out.ok ? "what_is_known" : "what_is_unknown",
        section: "reflex",
        source_status: "unsourced",
        source_ids: [],
        why_material: "Live probe — graph proving its own shape against vision claim " + probe.vision_id,
        status: "active",
        who_claims: "system/reflex",
        reflex: {
          kind: "conformance",
          vision_id: probe.vision_id,
          probe_ts: ts,
          ok: out.ok,
          cross_slug: out.cross_slug || null,
          cross_proves: out.cross_slug
            ? `protocol:${probe.vision_id}`
            : null,
          responds_to: out.gap ? probe.vision_id : null,
          proves: out.ok ? probe.vision_id : null,
          live_probe: out.cross_slug
            ? BASE + "/api/articles/" + out.cross_slug + "/health"
            : null,
        },
      },
      { actor: "system/reflex", channel: "protocol/reflex", model: opts.model || "system/reflex" },
    );
    claims.push(newClaim);
    added.push(id);
  }

  meta.claims = claims;
  meta.reflex_last = ts;
  meta.reflex_passes = (meta.reflex_passes || 0) + 1;

  await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
    .bind(JSON.stringify(meta), new Date().toISOString(), slug)
    .run();

  return {
    ok: true,
    slug,
    ts,
    probes: results,
    claims_added: added,
    reflex_passes: meta.reflex_passes,
    url: BASE + "/graph.html?slugs=protocol,bpc-157&layer=reflex",
  };
}