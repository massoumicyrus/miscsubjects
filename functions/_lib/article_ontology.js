// Recursive article ontology — tree, roles, sprawl detection.

import { PEPTIDE_CATALOG, parseCrossSlug } from "./ledger_canonical.js";

const ROOT_SYSTEM = new Set([
  "protocol",
  "system-map",
  "llm-manifest",
]);

const ROOT_PEPTIDES = new Set(PEPTIDE_CATALOG.map((p) => p.id));

const STACK_MARKERS = ["stack", "wolverine", "recovery-stack", "aging-stack", "adderall-stack", "cognitive-stack"];

function parseMeta(m) {
  try {
    return JSON.parse(m || "{}") || {};
  } catch {
    return {};
  }
}

export function classifySlug(slug) {
  if (ROOT_SYSTEM.has(slug)) return "system_root";
  if (ROOT_PEPTIDES.has(slug)) return "peptide_root";
  if (STACK_MARKERS.some((m) => slug.includes(m))) return "stack";
  const cross = parseCrossSlug(slug);
  if (cross.cross) return "condition";
  if (slug.includes("-glp1-") || slug.includes("-ppi") || slug.includes("-ibd")) return "condition";
  if (slug.includes("herniated") || slug.includes("sciatica") || slug.includes("neuropathy")) return "condition";
  if (slug.includes("degenerative-disc") || slug.includes("disc-disease") || slug.includes("disc-degeneration")) return "condition";
  for (const p of ROOT_PEPTIDES) {
    if (slug.startsWith(p + "-") || slug.includes(p)) return "condition";
  }
  return "article";
}

/** Build ontology tree from all articles. */
export async function buildArticleOntology(env) {
  if (!env.DB) return { error: "no DB" };
  const rows = await env.DB.prepare(
    "SELECT slug, title, meta, updated_at FROM articles ORDER BY slug",
  ).all();
  const articles = rows.results || [];
  const nodes = {};
  const inbound = {};

  for (const a of articles) {
    const meta = parseMeta(a.meta);
    const embeds = Array.isArray(meta.embeds) ? meta.embeds : [];
    let role = classifySlug(a.slug);
    // Protocol/governance articles live under the system tier by constitution; a schema built
    // for peptide trees must not flag them as sprawl by construction.
    if (role === "article") {
      const tags = Array.isArray(meta.tags) ? meta.tags : [];
      if (meta.category === "canon" || tags.includes("canonical") || tags.includes("oip") || tags.includes("for-models") || String(meta.register) === "system") role = "system_doc";
    }
    nodes[a.slug] = {
      slug: a.slug,
      title: a.title,
      role,
      embeds,
      tags: meta.tags || [],
      claims: (meta.claims || []).length,
      sources: (meta.sources || []).length,
      updated_at: a.updated_at,
    };
    for (const e of embeds) {
      inbound[e] = inbound[e] || [];
      inbound[e].push(a.slug);
    }
  }

  const tree = [];
  for (const slug of Object.keys(nodes)) {
    if (nodes[slug].role === "system_root") {
      tree.push(buildBranch(slug, nodes, inbound, new Set()));
    }
  }
  for (const slug of Object.keys(nodes)) {
    if (nodes[slug].role === "peptide_root") {
      tree.push(buildBranch(slug, nodes, inbound, new Set()));
    }
  }

  const sprawl = [];
  const misstep_candidates = [];

  for (const slug of Object.keys(nodes)) {
    const n = nodes[slug];
    const parents = inbound[slug] || [];
    const children = n.embeds || [];

    if (
      n.role !== "peptide_root" &&
      n.role !== "system_root" &&
      n.role !== "system_doc" &&
      !parents.length &&
      children.length < 2
    ) {
      sprawl.push({
        slug,
        reason: "orphan — no parent embeds, not a peptide root",
        suggest: suggestParent(slug, nodes),
      });
    }

    if (n.role === "condition" && parents.length === 0 && !slug.includes("intro")) {
      misstep_candidates.push({
        slug,
        reason: "condition article without parent peptide embed",
        suggest_parent: suggestParent(slug, nodes),
      });
    }

    const dupes = findSimilarSlugs(slug, nodes);
    if (dupes.length) {
      misstep_candidates.push({
        slug,
        reason: "possible duplicate scope",
        similar: dupes,
      });
    }
  }

  return {
    roots: [...ROOT_PEPTIDES].filter((s) => nodes[s]),
    tree,
    nodes,
    inbound,
    sprawl,
    misstep_candidates,
    counts: {
      articles: articles.length,
      system_roots: Object.values(nodes).filter((n) => n.role === "system_root").length,
      peptide_roots: Object.values(nodes).filter((n) => n.role === "peptide_root").length,
      stacks: Object.values(nodes).filter((n) => n.role === "stack").length,
      conditions: Object.values(nodes).filter((n) => n.role === "condition").length,
      sprawl: sprawl.length,
      misstep_candidates: misstep_candidates.length,
    },
  };
}

function buildBranch(slug, nodes, inbound, seen) {
  if (seen.has(slug) || !nodes[slug]) return null;
  seen.add(slug);
  const n = nodes[slug];
  const children = (n.embeds || [])
    .map((c) => buildBranch(c, nodes, inbound, seen))
    .filter(Boolean);
  const referenced_by = inbound[slug] || [];
  return {
    slug,
    title: n.title,
    role: n.role,
    claims: n.claims,
    sources: n.sources,
    referenced_by,
    children,
  };
}

function suggestParent(slug, nodes) {
  for (const p of ROOT_PEPTIDES) {
    if (slug.includes(p.replace("-", "")) || slug.includes(p)) return p;
  }
  if (slug.includes("herniated") || slug.includes("sciatica")) return "recovery-stack-intro";
  if (slug.includes("glp1") || slug.includes("gut")) return "bpc-157";
  if (slug.includes("muscle")) return "tb-500";
  return null;
}

function findSimilarSlugs(slug, nodes) {
  const base = slug.replace(/-glp1-.*/, "").replace(/-stack.*/, "");
  const out = [];
  for (const other of Object.keys(nodes)) {
    if (other === slug) continue;
    if (other.startsWith(base) && base.length > 6) out.push(other);
    if (slug.includes("herniated") && other.includes("herniated") && other !== slug) out.push(other);
  }
  return [...new Set(out)].slice(0, 4);
}