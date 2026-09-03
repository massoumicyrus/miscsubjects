// Dataview-style queries against live article ledger.

import { isActiveClaim } from "./ledger_honesty.js";
import { classifySlug } from "./article_ontology.js";

function parseMeta(m) {
  try {
    return JSON.parse(m || "{}") || {};
  } catch {
    return {};
  }
}

function vaultFolder(slug, role) {
  switch (role) {
    case "system_root":
      return "System/" + slug;
    case "peptide_root":
      return "Peptides/" + slug;
    case "stack":
      return "Stacks/" + slug;
    case "condition":
      return "Conditions/" + slug;
    default:
      return "Articles/" + slug;
  }
}

function parseWhere(where) {
  const out = {};
  if (!where) return out;
  for (const part of String(where).split("&")) {
    const [k, v] = part.split("=").map((s) => s.trim());
    if (k && v != null) out[k] = decodeURIComponent(v);
  }
  return out;
}

function pickFields(row, fields) {
  if (!fields?.length) return row;
  const o = {};
  for (const f of fields) if (row[f] != null) o[f] = row[f];
  return o;
}

export async function runGraphQuery(env, url) {
  let from = String(url.searchParams.get("from") || url.searchParams.get("slug") || "")
    .trim()
    .toLowerCase();
  if (from.includes("/")) from = from.split("/").filter(Boolean).pop() || from;
  const slugsParam = url.searchParams.get("slugs");
  let slugs = [];
  if (slugsParam) {
    slugs = slugsParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  } else if (from) {
    const folderOnly = new Set(["peptides", "stacks", "conditions", "system", "articles"]);
    if (folderOnly.has(from)) {
      const cap = from.charAt(0).toUpperCase() + from.slice(1);
      const rows = await env.DB.prepare(
        "SELECT slug, title, meta FROM articles ORDER BY slug",
      ).all();
      for (const r of rows.results || []) {
        const rs = classifySlug(r.slug);
        if (vaultFolder(r.slug, rs).startsWith(cap)) slugs.push(r.slug);
      }
    } else {
      slugs = [from];
    }
  } else {
    slugs = ["protocol", "bpc-157"];
  }

  const where = parseWhere(url.searchParams.get("where"));
  const kind = String(url.searchParams.get("kind") || "claim").toLowerCase();
  const returnFields = (url.searchParams.get("return") || url.searchParams.get("fields") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const includeRetracted = url.searchParams.get("include_retracted") === "true";
  const limit = Math.min(500, Number(url.searchParams.get("limit") || 100));

  const rows = [];
  for (const slug of [...new Set(slugs)]) {
    const row = await env.DB.prepare(
      "SELECT slug, title, meta, updated_at FROM articles WHERE slug=?",
    )
      .bind(slug)
      .first();
    if (!row) continue;
    const meta = parseMeta(row.meta);

    if (kind === "claim" || kind === "claims") {
      for (const c of meta.claims || []) {
        if (!includeRetracted && !isActiveClaim(c)) continue;
        if (where.tier && String(c.tier) !== where.tier) continue;
        if (where.status && String(c.status || "active") !== where.status) continue;
        if (where.slot && String(c.slot || c.section || "") !== where.slot) continue;
        if (where.posted_by) {
          const actor = c.posted_by?.actor || c.who_claims || "";
          if (!actor.includes(where.posted_by)) continue;
        }
        if (where.section && String(c.section || "") !== where.section) continue;
        rows.push(
          pickFields(
            {
              kind: "claim",
              slug,
              id: c.id,
              text: c.text,
              tier: c.tier,
              weight: c.weight,
              slot: c.slot,
              section: c.section,
              status: c.status || "active",
              posted_by: c.posted_by?.actor || c.who_claims,
              source_ids: c.source_ids || [],
              vault_path: vaultFolder(slug, classifySlug(slug)) + "/claims/" + c.id,
            },
            returnFields,
          ),
        );
      }
    } else if (kind === "source" || kind === "sources") {
      for (const s of meta.sources || []) {
        if (where.type && String(s.type) !== where.type) continue;
        rows.push(
          pickFields(
            {
              kind: "source",
              slug,
              id: s.id,
              type: s.type,
              url: s.url,
              title: s.title,
              hash: s.hash,
              prev: s.prev,
              link_status: s.link_status,
              vault_path: vaultFolder(slug, classifySlug(slug)) + "/sources/" + s.id,
            },
            returnFields,
          ),
        );
      }
    } else if (kind === "article" || kind === "articles") {
      if (where.role && classifySlug(slug) !== where.role) continue;
      rows.push(
        pickFields(
          {
            kind: "article",
            slug,
            title: row.title,
            role: classifySlug(slug),
            claims: (meta.claims || []).length,
            sources: (meta.sources || []).length,
            vault_path: vaultFolder(slug, classifySlug(slug)),
            updated_at: row.updated_at,
          },
          returnFields,
        ),
      );
    }
  }

  return {
    ok: true,
    query: {
      from: from || null,
      slugs,
      kind,
      where: Object.keys(where).length ? where : null,
      return: returnFields.length ? returnFields : null,
      limit,
    },
    count: rows.length,
    rows: rows.slice(0, limit),
    dataview_example:
      'TABLE tier, weight, posted_by FROM "Peptides/bpc-157" WHERE tier = "human"',
    api_example:
      "/api/v1/query?from=bpc-157&kind=claim&where=tier=human&return=id,text,weight,posted_by",
  };
}