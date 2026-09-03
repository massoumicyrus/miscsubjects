// The compounding loop: link graph → lint → next acts. D1 is canonical; the
// Obsidian vault is a lossless projection of these same structures.
//
// Karpathy's compiled-wiki rule, applied to this build: new material must revise
// the existing knowledge structure, not merely join the archive. This module is
// the maintenance pass that makes that mechanical — after any publish, the graph
// is re-derived from the corpus itself (embeds + typed links + wikilinks), and
// the gaps it exposes become the ranked queue of next acts.

import { classifySlug } from "./article_ontology.js";

const RESERVED_WIKI = new Set(["graph"]);
const WIKILINK_RE = /\[\[([a-z0-9][a-z0-9_-]{1,80})(?:\|[^\]\n]{1,160})?\]\]/gi;
const SITE_LINK_RE =
  /\]\((?:https?:\/\/miscsubjects\.com)?\/a\/([a-z0-9][a-z0-9_-]*)\)/gi;

function parseMeta(m) {
  try {
    return JSON.parse(m || "{}") || {};
  } catch {
    return {};
  }
}

export function extractBodyLinks(body) {
  const wiki = new Set();
  const typed = new Set();
  const s = String(body || "");
  let m;
  const wre = new RegExp(WIKILINK_RE.source, "gi");
  while ((m = wre.exec(s))) {
    const t = m[1].toLowerCase();
    if (!RESERVED_WIKI.has(t)) wiki.add(t);
  }
  const lre = new RegExp(SITE_LINK_RE.source, "gi");
  while ((m = lre.exec(s))) typed.add(m[1].toLowerCase());
  return { wiki: [...wiki], typed: [...typed] };
}

const CLAIM_WINDOW = 400;

async function claimFindings(env) {
  const bounds = await env.DB.prepare(
    "SELECT MIN(rowid) AS lo, MAX(rowid) AS hi FROM articles WHERE published = 1",
  ).first();
  const lo = Number(bounds?.lo || 0);
  const hi = Number(bounds?.hi || 0);
  const by = {};
  const bump = (slug, key, n) => {
    (by[slug] = by[slug] || {})[key] = (by[slug]?.[key] || 0) + Number(n || 0);
  };
  for (let start = lo; start <= hi; start += CLAIM_WINDOW) {
    const r = await env.DB.prepare(
      `SELECT a.slug AS slug,
              SUM(CASE WHEN json_extract(c.value,'$.status') NOT IN ('retracted','cut')
                        AND COALESCE(json_array_length(c.value,'$.source_ids'),0) = 0
                       THEN 1 ELSE 0 END) AS unsourced,
              SUM(CASE WHEN json_extract(c.value,'$.status') = 'active'
                        AND COALESCE(json_array_length(c.value,'$.challenged_by'),0) > 0
                       THEN 1 ELSE 0 END) AS challenged
         FROM articles a, json_each(a.meta,'$.claims') c
        WHERE a.published = 1 AND a.rowid >= ? AND a.rowid < ?
          AND c.type = 'object'
        GROUP BY a.slug`,
    )
      .bind(start, start + CLAIM_WINDOW)
      .all();
    for (const x of r.results || []) {
      bump(x.slug, "unsourced_claims", x.unsourced);
      bump(x.slug, "open_challenges", x.challenged);
    }
    /* eslint-disable-next-line no-empty */
    const p = await env.DB.prepare(
      `SELECT a.slug AS slug, COUNT(*) AS missing_why
         FROM articles a, json_each(a.meta,'$.provenance') pv
        WHERE a.published = 1 AND a.rowid >= ? AND a.rowid < ?
          AND pv.type = 'object'
          AND COALESCE(TRIM(json_extract(pv.value,'$.why')),'') = ''
          AND COALESCE(json_extract(pv.value,'$.at'), json_extract(pv.value,'$.time'),'') >= '2026-08-03'
        GROUP BY a.slug`,
    )
      .bind(start, start + CLAIM_WINDOW)
      .all();
    for (const x of p.results || []) bump(x.slug, "missing_why", x.missing_why);
  }
  return by;
}

export async function buildLinkGraph(env, opts = {}) {
  // Scalars only. LENGTH() and json_array_length() are evaluated by D1; the
  // isolate receives integers, not the 90 MB the numbers describe.
  const rows = await env.DB.prepare(
    `SELECT slug, title, updated_at,
            LENGTH(body) AS body_bytes,
            COALESCE(json_array_length(meta,'$.claims'),0)  AS claims,
            COALESCE(json_array_length(meta,'$.sources'),0) AS sources,
            SUBSTR(COALESCE(json_extract(meta,'$.subject'),
                            json_extract(meta,'$.summary'),
                            json_extract(meta,'$.description'),''),1,160) AS summary
       FROM articles
      WHERE published = 1
      ORDER BY slug`,
  ).all();
  const articles = rows.results || [];

  let findings = {};
  if (opts.enrich !== false) {
    try {
      findings = await claimFindings(env);
    } catch {
      findings = {};
    }
  }

  const nodes = {};
  for (const a of articles) {
    const f = findings[a.slug] || {};
    nodes[a.slug] = {
      slug: a.slug,
      title: a.title,
      role: classifySlug(a.slug),
      updated_at: a.updated_at,
      claims: Number(a.claims || 0),
      sources: Number(a.sources || 0),
      unsourced_claims: Number(f.unsourced_claims || 0),
      open_challenges: Number(f.open_challenges || 0),
      body_bytes: Number(a.body_bytes || 0),
      missing_why: Number(f.missing_why || 0),
      summary: String(a.summary || "").replace(/\s+/g, " "),
    };
  }

  const edgeRows = await env.DB.prepare(
    `SELECT from_slug, to_slug, target, kind, resolved
       FROM article_links
      ORDER BY from_slug, kind, target`,
  ).all();

  const edges = [];
  const inbound = {};
  const unresolved = [];
  for (const e of edgeRows.results || []) {
    // A stored edge whose target has since been unpublished is unresolved now,
    // whatever the row says. The node set is the authority on what exists.
    if (e.resolved && e.to_slug && nodes[e.to_slug]) {
      edges.push({ from: e.from_slug, to: e.to_slug, kind: e.kind });
      (inbound[e.to_slug] = inbound[e.to_slug] || []).push(e.from_slug);
    } else {
      unresolved.push({ from: e.from_slug, target: e.target, kind: e.kind });
    }
  }

  return { nodes, edges, inbound, unresolved, count: articles.length };
}

// Lint — Karpathy's third operation. Every finding is derived, none is stored;
// running it twice against an unchanged corpus returns identical output.
export async function graphLint(env, opts = {}) {
  const staleDays = Number(opts.stale_days || 120);
  const g = opts.graph || (await buildLinkGraph(env));
  const now = Date.now();

  const orphans = [];
  const unsourced = [];
  const contested = [];
  const stale = [];
  const missing_why = [];

  for (const n of Object.values(g.nodes)) {
    const inb = g.inbound[n.slug] || [];
    if (
      !inb.length &&
      n.role !== "system_root" &&
      n.role !== "peptide_root"
    ) {
      orphans.push({ slug: n.slug, title: n.title, role: n.role });
    }
    if (n.unsourced_claims)
      unsourced.push({ slug: n.slug, unsourced_claims: n.unsourced_claims });
    if (n.open_challenges)
      contested.push({ slug: n.slug, open_challenges: n.open_challenges });
    if (n.missing_why)
      missing_why.push({ slug: n.slug, missing_why: n.missing_why });
    const age = (now - Date.parse(n.updated_at || 0)) / 86400000;
    if (age > staleDays && inb.length >= 3) {
      stale.push({
        slug: n.slug,
        title: n.title,
        inbound: inb.length,
        days_since_update: Math.round(age),
      });
    }
  }

  orphans.sort((a, b) => a.slug.localeCompare(b.slug));
  unsourced.sort((a, b) => b.unsourced_claims - a.unsourced_claims);
  stale.sort((a, b) => b.inbound - a.inbound);

  // A wikilink to a page that does not exist is an authored request for that
  // page — the strongest "write next" signal the corpus can emit.
  const wanted = {};
  for (const u of g.unresolved) {
    (wanted[u.target] = wanted[u.target] || []).push(u.from);
  }
  const missing_pages = Object.entries(wanted)
    .map(([target, from]) => ({ target, requested_by: [...new Set(from)] }))
    .sort((a, b) => b.requested_by.length - a.requested_by.length);

  return {
    generated_at: new Date().toISOString(),
    counts: {
      articles: g.count,
      edges: g.edges.length,
      orphans: orphans.length,
      missing_pages: missing_pages.length,
      unsourced_claim_articles: unsourced.length,
      contested_articles: contested.length,
      stale: stale.length,
      missing_why_articles: missing_why.length,
    },
    orphans,
    missing_pages,
    unsourced_claims: unsourced.slice(0, 100),
    open_challenges: contested,
    stale,
    missing_why: missing_why.sort((a, b) => b.missing_why - a.missing_why),
  };
}

// Next acts — the loop driver. Ranked, typed, each with the reason it exists
// and the operation that clears it. Consumed by the unified loop rep, the
// vault's next.md, and any model asking "what should be written next?".
export async function nextActs(env, opts = {}) {
  const lint = opts.lint || (await graphLint(env, opts));
  const acts = [];

  for (const m of lint.missing_pages.slice(0, 25)) {
    acts.push({
      kind: "write",
      target: m.target,
      score: 90 + m.requested_by.length,
      reason:
        "wikilinked from " +
        m.requested_by.slice(0, 5).join(", ") +
        (m.requested_by.length > 5 ? " +" + (m.requested_by.length - 5) : "") +
        " but no page exists",
      clears: "publish /a/" + m.target,
    });
  }
  for (const c of lint.open_challenges.slice(0, 15)) {
    acts.push({
      kind: "resolve",
      target: c.slug,
      score: 80 + c.open_challenges,
      reason: c.open_challenges + " active claim(s) under challenge",
      clears: "adjudicate the challenge on /a/" + c.slug,
    });
  }
  for (const u of lint.unsourced_claims.slice(0, 15)) {
    acts.push({
      kind: "source",
      target: u.slug,
      score: 60 + Math.min(u.unsourced_claims, 20),
      reason: u.unsourced_claims + " active claim(s) with no source",
      clears: "attach sources on /a/" + u.slug,
    });
  }
  for (const s of lint.stale.slice(0, 10)) {
    acts.push({
      kind: "revise",
      target: s.slug,
      score: 40 + Math.min(s.inbound, 30),
      reason:
        s.inbound +
        " inbound links, untouched for " +
        s.days_since_update +
        " days",
      clears: "re-read sources and update /a/" + s.slug,
    });
  }
  for (const o of lint.orphans.slice(0, 20)) {
    acts.push({
      kind: "connect",
      target: o.slug,
      score: 20,
      reason: "no inbound links — unreachable from the graph",
      clears: "wikilink it from a parent page, or fold it in",
    });
  }
  for (const w of (lint.missing_why || []).slice(0, 10)) {
    acts.push({
      kind: "why",
      target: w.slug,
      score: 50 + Math.min(w.missing_why, 10),
      reason:
        w.missing_why +
        " provenance entr(y/ies) with no why — the decision's reason is off the record",
      clears:
        "append the why via the provenance webhook on /a/" +
        w.slug +
        " (tenant-law: the why travels with the write)",
    });
  }

  // The outward half of the loop, from the same derivation: replies move
  // priors, drafted leads await review, high-fit classes go quiet. Preview DB
  // lacks these tables, so each probe fails soft.
  try {
    const replies = await env.DB.prepare(
      "SELECT COUNT(*) c FROM lead_replies WHERE status='new'",
    ).first();
    if (replies?.c) {
      acts.push({
        kind: "respond",
        target: "lead_replies",
        score: 95 + Math.min(replies.c, 5),
        reason: replies.c + " unread reply(ies) — responses update priors",
        clears: "read the replies, update promo-class priors, answer",
      });
    }
  } catch {}
  try {
    const drafted = await env.DB.prepare(
      "SELECT COUNT(*) c FROM leads WHERE status='drafted'",
    ).first();
    if (drafted?.c) {
      acts.push({
        kind: "outreach",
        target: "leads",
        score: 70,
        reason: drafted.c + " drafted lead(s) awaiting review",
        clears: "review packet → owner approval → tracked send",
      });
    }
  } catch {}
  try {
    const classes = await env.DB.prepare(
      "SELECT key, name, fit, last_contact_ts FROM promo_classes WHERE fit>=60 ORDER BY fit DESC LIMIT 5",
    ).all();
    for (const pc of classes.results || []) {
      const days = pc.last_contact_ts
        ? (Date.now() - Date.parse(pc.last_contact_ts)) / 86400000
        : Infinity;
      if (days > 7) {
        acts.push({
          kind: "outreach",
          target: pc.key,
          score: 50 + Math.round((pc.fit || 0) / 10),
          reason:
            (pc.name || pc.key) +
            " (fit " +
            pc.fit +
            ") uncontacted for " +
            (isFinite(days) ? Math.round(days) + " days" : "ever"),
          clears: "draft a zero-context letter for this class → DRAFT email to owner",
        });
      }
    }
  } catch {}

  acts.sort((a, b) => b.score - a.score);
  return {
    generated_at: lint.generated_at,
    counts: lint.counts,
    acts: acts.slice(0, Number(opts.limit || 50)),
  };
}
