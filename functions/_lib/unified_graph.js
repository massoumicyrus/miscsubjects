// Unified cross-article graph — one request for canvas rendering.

import { buildVoxelGraph } from "./voxel_graph.js";
import { isActiveClaim } from "./ledger_honesty.js";
import { attachSelf } from "./self_explain.js";
import {
  summarizeArticleYield,
  yieldMetricsForPass,
} from "./model_yield.js";

function parseMeta(m) {
  try {
    return JSON.parse(m || "{}") || {};
  } catch {
    return {};
  }
}

function parseSlugs(param, url) {
  const out = [];
  if (param) {
    for (const part of String(param).split(",")) {
      const s = part.trim().toLowerCase();
      if (s) out.push(s);
    }
  }
  for (const [k, v] of url.searchParams.entries()) {
    if (k === "slugs[]" || k === "slugs" || k.startsWith("slugs[")) {
      for (const part of String(v).split(",")) {
        const s = part.trim().toLowerCase();
        if (s) out.push(s);
      }
    }
  }
  return [...new Set(out)];
}

function parseFilterList(param, url, key) {
  const out = [];
  if (param) {
    for (const part of String(param).split(",")) {
      const s = part.trim();
      if (s) out.push(s);
    }
  }
  for (const [k, v] of url.searchParams.entries()) {
    if (k === key + "[]" || k === key || k.startsWith(key + "[")) {
      for (const part of String(v).split(",")) {
        const s = part.trim();
        if (s) out.push(s);
      }
    }
  }
  return [...new Set(out)];
}

async function expandSlugs(env, seeds, depth) {
  const seen = new Set();
  const queue = [...seeds];
  const d = Math.max(1, Math.min(4, Number(depth) || 1));
  let level = 0;
  while (queue.length && level < d) {
    const batch = queue.splice(0, queue.length);
    for (const slug of batch) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      if (level + 1 >= d) continue;
      try {
        const row = await env.DB.prepare(
          "SELECT meta FROM articles WHERE slug=?",
        )
          .bind(slug)
          .first();
        if (!row) continue;
        const meta = parseMeta(row.meta);
        for (const e of meta.embeds || []) {
          const s = String(e).trim().toLowerCase();
          if (s && !seen.has(s)) queue.push(s);
        }
      } catch {}
    }
    level++;
  }
  return [...seen];
}

function gid(slug, id) {
  return slug + ":" + id;
}

function claimPassesFilters(c, opts) {
  if (!opts.include_retracted && !isActiveClaim(c)) return false;
  if (opts.tiers?.length && !opts.tiers.includes(String(c.tier))) return false;
  if (opts.posted_by?.length) {
    const actor = c.posted_by?.actor || c.who_claims || "";
    if (!opts.posted_by.some((p) => actor.includes(p))) return false;
  }
  const isConversation =
    c.register === "conversation" ||
    c.section === "Conversation" ||
    String(c.posted_by?.channel || "").includes("conversation");
  if (opts.exclude_conversation && isConversation) return false;
  if (opts.curated_only && isConversation) return false;
  return true;
}

export async function buildUnifiedGraph(env, url) {
  const seeds = parseSlugs(url.searchParams.get("slugs"), url);
  if (!seeds.length) seeds.push("protocol", "bpc-157");

  const slugs = await expandSlugs(
    env,
    seeds,
    url.searchParams.get("depth") || 1,
  );
  const tiers = parseFilterList(url.searchParams.get("tiers"), url, "tiers");
  const posted_by = parseFilterList(
    url.searchParams.get("posted_by"),
    url,
    "posted_by",
  );
  const include_retracted =
    url.searchParams.get("include_retracted") === "true";
  const include_challenges =
    url.searchParams.get("include_challenges") !== "false";
  const layer = String(url.searchParams.get("layer") || "").toLowerCase();
  const includeYield =
    layer === "yield" || url.searchParams.get("include_yield") === "true";
  const curatedOnly =
    layer === "curated" || url.searchParams.get("exclude_conversation") === "true";

  const nodes = [];
  const edges = [];
  const articles = [];
  const reflexTargets = new Set();
  const reflexSources = new Set();
  const yieldPasses = new Set();
  const yieldTargets = new Set();
  const yieldByArticle = {};

  for (const slug of slugs) {
    const row = await env.DB.prepare(
      "SELECT slug, title, meta FROM articles WHERE slug=?",
    )
      .bind(slug)
      .first();
    if (!row) continue;
    const meta = parseMeta(row.meta);
    const graph = buildVoxelGraph(slug, meta);
    articles.push({ slug, title: row.title });

    for (const v of graph.voxels || []) {
      const claim = (meta.claims || []).find((c) => c.id === v.id) || v;
      if (
        !claimPassesFilters(claim, {
          include_retracted,
          tiers,
          posted_by,
          curated_only: curatedOnly,
          exclude_conversation: curatedOnly,
        })
      )
        continue;

      nodes.push({
        id: gid(slug, v.id),
        kind: "claim",
        slug,
        claim_id: v.id,
        text: v.text,
        tier: v.tier,
        weight: v.weight,
        slot: claim.slot || null,
        section: claim.section || null,
        reflex: claim.reflex || null,
        status: v.status,
        who_claims: v.who_claims,
        posted_by: v.posted_by,
        source_ids: (v.source_ids || []).map((sid) => gid(slug, sid)),
      });

      const isReflex =
        claim.section === "reflex" ||
        (claim.reflex && typeof claim.reflex === "object");
      if (isReflex) reflexSources.add(gid(slug, v.id));

      for (const e of v.edges || []) {
        if (!include_challenges && (e.type === "challenges" || e.type === "challenged_by"))
          continue;
        const edgeSlug = e.cross_slug || slug;
        const edge = {
          from: gid(slug, v.id),
          type: e.type,
          slug,
          edge_slug: edgeSlug,
        };
        if (e.target) {
          if (e.type === "live_probe") {
            edge.to = "probe:" + String(e.target).replace(/[^a-zA-Z0-9/:._-]/g, "_");
            edge.target_kind = "probe";
            edge.probe_url = e.target;
          } else {
            edge.to =
              e.type === "supported_by"
                ? gid(slug, e.target)
                : gid(edgeSlug, e.target);
            edge.target_kind = e.type === "supported_by" ? "source" : "claim";
          }
        }
        if (e.actor) edge.actor = e.actor;
        if (e.ts) edge.ts = e.ts;
        if (e.cross_slug) edge.cross_slug = e.cross_slug;
        edges.push(edge);

        if (isReflex && e.target && ["proves", "responds_to", "conforms_to"].includes(e.type)) {
          reflexTargets.add(edge.to);
        }
      }
    }

    for (const s of graph.sources || []) {
      nodes.push({
        id: gid(slug, s.id),
        kind: "source",
        slug,
        source_id: s.id,
        type: s.type,
        url: s.url,
        title: s.title,
        quote: s.quote,
        found_by: s.found_by,
        hash: s.hash,
        prev: s.prev,
        claim_ids: (s.claim_ids || []).map((cid) => gid(slug, cid)),
      });
    }

    if (includeYield) {
      yieldByArticle[slug] = summarizeArticleYield(meta);
      for (const p of meta.contributions || []) {
        const y = yieldMetricsForPass(p);
        const pid = gid(slug, p.id);
        yieldPasses.add(pid);
        nodes.push({
          id: pid,
          kind: "pass",
          slug,
          pass_id: p.id,
          model: p.model,
          action: p.action,
          role: p.role,
          ts: p.ts,
          tokens_in: y.tokens_in,
          tokens_out: y.tokens_out,
          cost_usd: y.cost_usd,
          output_count: y.output_count,
          usd_per_output: y.usd_per_output,
          material: y.material,
          label: p.id,
        });
        for (const cid of y.outputs) {
          const tid = gid(slug, cid);
          yieldTargets.add(tid);
          edges.push({
            from: pid,
            to: tid,
            type: "yields",
            slug,
            target_kind: "claim",
          });
        }
      }
    }
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  let cleanEdges = edges.filter((e) => {
    if (!e.to) return true;
    if (e.target_kind === "probe") return true;
    return nodeIds.has(e.to);
  });

  let outNodes = nodes;
  if (layer === "reflex") {
    const keep = new Set([...reflexSources, ...reflexTargets]);
    for (const e of cleanEdges) {
      if (reflexSources.has(e.from)) {
        if (e.to) keep.add(e.to);
        keep.add(e.from);
      }
    }
    outNodes = nodes.filter(
      (n) =>
        keep.has(n.id) ||
        (n.kind === "claim" && reflexTargets.has(n.id)),
    );
    const keepIds = new Set(outNodes.map((n) => n.id));
    for (const e of cleanEdges) {
      if (e.target_kind === "probe" && reflexSources.has(e.from)) keepIds.add(e.to);
    }
    cleanEdges = cleanEdges.filter(
      (e) =>
        reflexSources.has(e.from) ||
        (e.to && keepIds.has(e.from) && keepIds.has(e.to)),
    );
    for (const e of cleanEdges) {
      if (e.target_kind === "probe" && e.probe_url && !keepIds.has(e.to)) {
        outNodes.push({
          id: e.to,
          kind: "probe",
          slug: e.slug,
          url: e.probe_url,
          label: "live probe",
        });
        keepIds.add(e.to);
      }
    }
  }

  if (layer === "yield") {
    const keep = new Set([...yieldPasses, ...yieldTargets]);
    outNodes = nodes.filter((n) => keep.has(n.id));
    const keepIds = new Set(outNodes.map((n) => n.id));
    cleanEdges = cleanEdges.filter(
      (e) => e.type === "yields" && keepIds.has(e.from) && keepIds.has(e.to),
    );
  }

  return {
    ok: true,
    slugs,
    seed_slugs: seeds,
    depth: Number(url.searchParams.get("depth") || 1),
    layer: layer || null,
    yield: includeYield ? yieldByArticle : null,
    filters: {
      tiers: tiers.length ? tiers : null,
      posted_by: posted_by.length ? posted_by : null,
      include_retracted,
      include_challenges,
      layer: layer || null,
    },
    articles,
    nodes: outNodes,
    edges: cleanEdges,
    counts: {
      articles: articles.length,
      nodes: outNodes.length,
      claims: outNodes.filter((n) => n.kind === "claim").length,
      sources: outNodes.filter((n) => n.kind === "source").length,
      probes: outNodes.filter((n) => n.kind === "probe").length,
      reflex_claims: outNodes.filter(
        (n) => n.kind === "claim" && reflexSources.has(n.id),
      ).length,
      passes: outNodes.filter((n) => n.kind === "pass").length,
      edges: cleanEdges.length,
    },
  };
}

export async function unifiedGraphResponse(env, request) {
  const url = new URL(request.url);
  const graph = await buildUnifiedGraph(env, url);
  return attachSelf(graph, "unified_graph", {
    contains: "cross-article claim+source nodes and edges for graph canvas",
    how_to_use:
      "GET /api/graph?slugs=protocol,bpc-157&tiers=human,system&include_challenges=true",
  });
}