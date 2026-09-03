// Question graph — questions and ingested evidence as hash-chained nodes on the article topology.

async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

function nowIso() {
  return new Date().toISOString();
}

function nodeBody(e) {
  return [
    e.prev_hash,
    e.ts,
    e.node_id,
    e.primary_slug,
    e.question,
    e.answer_preview || "",
    e.status,
  ].join("|");
}

function ingestBody(e) {
  return [
    e.prev_hash,
    e.ts,
    e.ingest_id,
    e.slug,
    e.question_node_id || "",
    String(e.raw_text || "").slice(0, 4000),
    e.summary || "",
  ].join("|");
}

async function lastNodeHash(env, slug) {
  try {
    const row = await env.DB.prepare(
      "SELECT hash FROM question_nodes WHERE primary_slug=? ORDER BY id DESC LIMIT 1",
    )
      .bind(slug)
      .first();
    return row?.hash || "genesis";
  } catch {
    return "genesis";
  }
}

async function lastIngestHash(env, slug) {
  try {
    const row = await env.DB.prepare(
      "SELECT hash FROM evidence_ingest WHERE slug=? ORDER BY id DESC LIMIT 1",
    )
      .bind(slug)
      .first();
    return row?.hash || "genesis";
  } catch {
    return "genesis";
  }
}

function makeNodeId(question, slug) {
  const base = String(slug || "q") + ":" + String(question || "").slice(0, 80);
  return "qn_" + base.replace(/[^a-z0-9]+/gi, "_").slice(0, 48).toLowerCase();
}

/** Record an ask as a question node on the graph. */
export async function createQuestionNode(env, opts) {
  if (!env.DB) return { error: "no DB" };
  const slug = String(opts.primary_slug || opts.slug || "").trim().toLowerCase();
  const question = String(opts.question || "").trim();
  if (!slug || !question) return { error: "need slug and question" };

  const ts = nowIso();
  const prev_hash = await lastNodeHash(env, slug);
  const node_id =
    opts.node_id ||
    makeNodeId(question, slug) +
      "_" +
      (await sha256(ts + question)).slice(0, 8);

  const entry = {
    node_id,
    ts,
    primary_slug: slug,
    slugs_json: JSON.stringify(opts.slugs || [slug]),
    question: question.slice(0, 4000),
    answer_preview: String(opts.answer || "").slice(0, 2000),
    confidence: String(opts.confidence || "unknown"),
    status: opts.gaps?.length ? "gap" : "answered",
    parent_node_id: opts.parent_node_id || null,
    gaps_json: JSON.stringify(opts.gaps || []),
    needs_json: JSON.stringify(opts.needs_user_info || []),
    cited_claims_json: JSON.stringify(opts.cited_claim_ids || []),
    cited_sources_json: JSON.stringify(opts.cited_source_ids || []),
    channel: opts.channel || "ask",
    author: opts.author || "anonymous",
    prev_hash,
  };
  entry.hash = await sha256(nodeBody(entry));

  try {
    await env.DB.prepare(
      `INSERT INTO question_nodes (
        node_id, ts, primary_slug, slugs_json, question, answer_preview, confidence,
        status, parent_node_id, gaps_json, needs_json, cited_claims_json, cited_sources_json,
        channel, author, hash, prev_hash
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        entry.node_id,
        entry.ts,
        entry.primary_slug,
        entry.slugs_json,
        entry.question,
        entry.answer_preview,
        entry.confidence,
        entry.status,
        entry.parent_node_id,
        entry.gaps_json,
        entry.needs_json,
        entry.cited_claims_json,
        entry.cited_sources_json,
        entry.channel,
        entry.author,
        entry.hash,
        entry.prev_hash,
      )
      .run();
  } catch (e) {
    return { error: "question_nodes insert failed: " + (e?.message || String(e)) };
  }

  return {
    ok: true,
    node_id: entry.node_id,
    hash: entry.hash,
    status: entry.status,
    ingest_hint: "Text evidence with: ingest " + slug + "|q:" + entry.node_id + "|your evidence",
  };
}

/** Record evidence ingest and link to a question node. */
export async function createEvidenceIngest(env, opts) {
  if (!env.DB) return { error: "no DB" };
  const slug = String(opts.slug || "").trim().toLowerCase();
  const raw_text = String(opts.raw_text || "").trim();
  if (!slug || !raw_text) return { error: "need slug and raw_text" };

  const ts = nowIso();
  const prev_hash = await lastIngestHash(env, slug);
  const ingest_id =
    opts.ingest_id ||
    "ev_" + (await sha256(ts + raw_text.slice(0, 200))).slice(0, 12);

  const entry = {
    ingest_id,
    ts,
    slug,
    question_node_id: opts.question_node_id || null,
    channel: opts.channel || "imessage",
    author: opts.author || "anonymous",
    raw_text: raw_text.slice(0, 16000),
    summary: String(opts.summary || "").slice(0, 2000),
    source_ids_json: JSON.stringify(opts.source_ids || []),
    claim_ids_json: JSON.stringify(opts.claim_ids || []),
    model: opts.model || "ingest",
    prev_hash,
    status: opts.status || "promoted",
  };
  entry.hash = await sha256(ingestBody(entry));

  try {
    await env.DB.prepare(
      `INSERT INTO evidence_ingest (
        ingest_id, ts, slug, question_node_id, channel, author, raw_text, summary,
        source_ids_json, claim_ids_json, model, hash, prev_hash, status
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        entry.ingest_id,
        entry.ts,
        entry.slug,
        entry.question_node_id,
        entry.channel,
        entry.author,
        entry.raw_text,
        entry.summary,
        entry.source_ids_json,
        entry.claim_ids_json,
        entry.model,
        entry.hash,
        entry.prev_hash,
        entry.status,
      )
      .run();

    if (opts.question_node_id) {
      await env.DB.prepare(
        "UPDATE question_nodes SET status=? WHERE node_id=? AND status IN ('gap','answered')",
      )
        .bind("enriched", opts.question_node_id)
        .run();
    }
  } catch (e) {
    return { error: "evidence_ingest insert failed: " + (e?.message || String(e)) };
  }

  return {
    ok: true,
    ingest_id: entry.ingest_id,
    hash: entry.hash,
    question_node_id: entry.question_node_id,
  };
}

/** Load question + evidence nodes for topology / graph GET. */
export async function loadQuestionGraph(env, slug, opts = {}) {
  const s = String(slug || "").trim().toLowerCase();
  if (!s || !env.DB) return { questions: [], evidence: [], edges: [] };

  const limit = opts.limit || 24;
  let questions = [];
  let evidence = [];

  try {
    const q = await env.DB.prepare(
      `SELECT node_id, ts, primary_slug, slugs_json, question, answer_preview, confidence,
              status, parent_node_id, gaps_json, needs_json, cited_claims_json, cited_sources_json,
              channel, author, hash
       FROM question_nodes WHERE primary_slug=? OR slugs_json LIKE ?
       ORDER BY ts DESC LIMIT ?`,
    )
      .bind(s, "%" + s + "%", limit)
      .all();
    questions = (q.results || []).map((r) => ({
      node_id: r.node_id,
      ts: r.ts,
      primary_slug: r.primary_slug,
      slugs: safeJson(r.slugs_json, []),
      question: r.question,
      answer_preview: r.answer_preview,
      confidence: r.confidence,
      status: r.status,
      parent_node_id: r.parent_node_id,
      gaps: safeJson(r.gaps_json, []),
      needs_user_info: safeJson(r.needs_json, []),
      cited_claim_ids: safeJson(r.cited_claims_json, []),
      cited_source_ids: safeJson(r.cited_sources_json, []),
      channel: r.channel,
      author: r.author,
      hash: r.hash,
    }));

    const e = await env.DB.prepare(
      `SELECT ingest_id, ts, slug, question_node_id, channel, author, summary,
              source_ids_json, claim_ids_json, model, hash, status
       FROM evidence_ingest WHERE slug=? ORDER BY ts DESC LIMIT ?`,
    )
      .bind(s, limit)
      .all();
    evidence = (e.results || []).map((r) => ({
      ingest_id: r.ingest_id,
      ts: r.ts,
      slug: r.slug,
      question_node_id: r.question_node_id,
      channel: r.channel,
      author: r.author,
      summary: r.summary,
      source_ids: safeJson(r.source_ids_json, []),
      claim_ids: safeJson(r.claim_ids_json, []),
      model: r.model,
      hash: r.hash,
      status: r.status,
    }));
  } catch {
    return { questions: [], evidence: [], edges: [], error: "question graph tables missing" };
  }

  const edges = [];
  for (const ev of evidence) {
    if (ev.question_node_id) {
      edges.push({
        from: ev.question_node_id,
        to: ev.ingest_id,
        type: "evidence_for",
        source_ids: ev.source_ids,
      });
    }
  }
  for (const qn of questions) {
    if (qn.parent_node_id) {
      edges.push({ from: qn.parent_node_id, to: qn.node_id, type: "follow_up" });
    }
    for (const sid of qn.cited_source_ids || []) {
      edges.push({ from: qn.node_id, to: sid, type: "cites_source" });
    }
    for (const cid of qn.cited_claim_ids || []) {
      edges.push({ from: qn.node_id, to: cid, type: "cites_claim" });
    }
  }

  return {
    slug: s,
    questions,
    evidence,
    edges,
    counts: { questions: questions.length, evidence: evidence.length, edges: edges.length },
  };
}

function safeJson(s, fallback) {
  try {
    return JSON.parse(s || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

/** Parse ingest arg: slug|text or slug|q:node_id|text */
export function parseIngestArg(raw) {
  const text = String(raw || "").trim();
  const pipe = text.indexOf("|");
  if (pipe <= 0) return { error: "usage slug|evidence  or  slug|q:node_id|evidence" };
  const slug = text.slice(0, pipe).trim().toLowerCase();
  let rest = text.slice(pipe + 1).trim();
  let question_node_id = null;
  const qm = /^q:([a-z0-9_-]+)\|/i.exec(rest);
  if (qm) {
    question_node_id = qm[1];
    rest = rest.slice(qm[0].length).trim();
  }
  if (!rest) return { error: "need evidence text after |" };
  return { slug, question_node_id, evidence: rest };
}