// Conversation router — explicit [CLAIM] blocks only → quality filter → ledger.
// Defense: asked-and-answered gate with novel-intent override.
// Never parses raw prose. Never triggers reflex on append.

import { loadQuestionGraph } from "./question_graph.js";
import { attachSelf } from "./self_explain.js";
import {
  filterConversationClaims,
  hasNovelQuestionIntent,
} from "./conversation_quality.js";

const TIERS = new Set([
  "human",
  "preclinical",
  "anecdotal",
  "mechanistic",
  "speculative",
  "system",
]);

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(a, b) {
  const ta = new Set(norm(a).split(" ").filter((w) => w.length > 3));
  const tb = new Set(norm(b).split(" ").filter((w) => w.length > 3));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const w of ta) if (tb.has(w)) hit++;
  return hit / Math.max(ta.size, tb.size);
}

/** Find existing question node — high bar, novel intent opens gate. */
export async function findAnsweredQuestion(env, slug, question, opts = {}) {
  const threshold = opts.threshold ?? 0.62;
  const graph = await loadQuestionGraph(env, slug, { limit: 48 });
  const qn = norm(question);
  let best = null;
  for (const node of graph.questions || []) {
    const score = tokenOverlap(qn, node.question);
    if (score < threshold) continue;
    if (hasNovelQuestionIntent(node.question, question)) continue;
    const linked = (graph.evidence || []).filter(
      (e) => e.question_node_id === node.node_id,
    );
    const cited = (node.cited_claim_ids || []).length;
    const answered =
      (node.status === "answered" || node.status === "enriched") &&
      (linked.length > 0 || cited >= 1);
    if (!answered) continue;
    if (!best || score > best.score) {
      best = { node, score, linked, cited };
    }
  }
  if (!best) return null;
  return {
    asked_and_answered: true,
    question_node_id: best.node.node_id,
    question: best.node.question,
    status: best.node.status,
    answer_preview: best.node.answer_preview,
    cited_claim_ids: best.node.cited_claim_ids || [],
    evidence_ingests: best.linked.map((e) => e.ingest_id),
    match_score: best.score,
    graph_url: `/api/articles/${slug}/question-graph`,
    article_url: `https://miscsubjects.com/a/${slug}#${best.node.node_id}`,
    challenge_hint: `claim ${slug}|human|your counter-assertion  OR  [CLAIM:challenge]…challenges: cXX…[/CLAIM]`,
  };
}

/** Parse ONLY explicit [CLAIM] / [QUESTION] / [INGEST] blocks — prose is ignored. */
export function parseRouterBlocks(text) {
  const blocks = { claims: [], questions: [], ingests: [] };
  const raw = String(text || "");
  if (!/\[(CLAIM|QUESTION|INGEST)/i.test(raw)) {
    return blocks;
  }

  const claimRe = /\[CLAIM(?::([^\]]+))?\]([\s\S]*?)\[\/CLAIM\]/gi;
  let m;
  while ((m = claimRe.exec(raw))) {
    const kind = (m[1] || "claim").trim().toLowerCase();
    const body = m[2].trim();
    const fields = parseFields(body);
    const slug = fields.slug || fields.article || "";
    const tier = (fields.tier || (kind === "challenge" ? "mechanistic" : "anecdotal")).toLowerCase();
    const claimText = fields.text || fields.assertion || body.replace(/^[^\n]+\n/, "").trim();
    if (!slug || !claimText) continue;
    const source_ids = fields.source_ids
      ? fields.source_ids.split(/[,;\s]+/).filter(Boolean)
      : [];
    blocks.claims.push({
      slug: slug.toLowerCase(),
      tier: TIERS.has(tier) ? tier : "anecdotal",
      text: claimText.slice(0, 4000),
      who_claims: fields.who_claims || fields.model || fields.author || "conversation-router",
      challenge: kind === "challenge" || fields.challenge === "true",
      challenges: fields.challenges || fields.target || fields.target_claim_id || null,
      source_ids,
      question_node_id: fields.question_node_id || fields.qid || null,
    });
  }

  const qRe = /\[QUESTION\]([\s\S]*?)\[\/QUESTION\]/gi;
  while ((m = qRe.exec(raw))) {
    const fields = parseFields(m[1]);
    const slug = (fields.slug || fields.article || "").toLowerCase();
    const q = fields.text || fields.question || m[1].trim();
    if (!slug || !q) continue;
    blocks.questions.push({ slug, question: q.slice(0, 2000) });
  }

  const iRe = /\[INGEST\]([\s\S]*?)\[\/INGEST\]/gi;
  while ((m = iRe.exec(raw))) {
    const fields = parseFields(m[1]);
    const slug = (fields.slug || fields.article || "").toLowerCase();
    const evidence = fields.text || fields.evidence || m[1].trim();
    if (!slug || !evidence) continue;
    blocks.ingests.push({
      slug,
      evidence: evidence.slice(0, 16000),
      question_node_id: fields.question_node_id || fields.qid || null,
    });
  }

  return blocks;
}

function parseFields(body) {
  const out = {};
  for (const line of String(body || "").split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const k = line.slice(0, idx).trim().toLowerCase().replace(/\s+/g, "_");
    const v = line.slice(idx + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}

async function apiPost(path, body, env) {
  const BASE = "https://miscsubjects.com";
  const headers = { "content-type": "application/json" };
  if (env.TERMINAL_KEY) headers["x-terminal-key"] = env.TERMINAL_KEY;
  const r = await fetch(BASE + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return r.json().catch(() => ({ error: path + " failed" }));
}

async function postClaim(env, c, channel, model) {
  return apiPost(
    "/api/protocol/claim",
    {
      slug: c.slug,
      tier: c.tier,
      text: c.text,
      weight: c.weight,
      who_claims: c.who_claims || model,
      posted_by: c.who_claims || model,
      channel: channel || "conversation-router",
      author: model || "conversation-router",
      model: model || "conversation-router",
      register: "conversation",
      section: "Conversation",
      source_ids: c.source_ids || [],
      question_node_id: c.question_node_id || undefined,
      rationale: c.rationale,
      skip_reflex: true,
    },
    env,
  );
}

async function postChallenge(env, c, channel, model) {
  const target = String(c.challenges || "").replace(/^c/, "c");
  return apiPost(
    "/api/protocol/challenge",
    {
      slug: c.slug,
      target_claim_id: target,
      text: c.text,
      tier: c.tier,
      who_claims: c.who_claims || model,
      channel: channel || "conversation-router",
      model: model || "conversation-router",
    },
    env,
  );
}

export async function routerGate(env, opts = {}) {
  const slug = String(opts.slug || "").toLowerCase();
  const question = String(opts.question || "").trim();
  if (!slug || !question) return { gate: "open", reason: "no slug or question" };

  const hit = await findAnsweredQuestion(env, slug, question);
  if (!hit) return { gate: "open", slug, question };

  return {
    gate: "answered",
    slug,
    question,
    message:
      "Asked & answered — " +
      hit.question_node_id +
      ". Claims: " +
      (hit.cited_claim_ids.join(", ") || "see ingests") +
      ". Override: force:true or ask a more precise question (2+ new keywords).",
    ...hit,
  };
}

export async function routerAppend(env, opts = {}) {
  const text = String(opts.text || opts.output || "").trim();
  const channel = opts.channel || "conversation-router";
  const model = opts.model || opts.who_claims || "conversation-router";
  const blocks = parseRouterBlocks(text);

  if (!blocks.claims.length && !blocks.questions.length && !blocks.ingests.length) {
    return attachSelf(
      {
        ok: true,
        skipped: true,
        reason: "no explicit [CLAIM]/[QUESTION]/[INGEST] blocks — prose not parsed",
        results: { claims: [], questions: [], ingests: [], rejected: [], errors: [] },
      },
      "conversation_router",
      { why: "Router never auto-parses prose — blocks required" },
    );
  }

  const { accepted, rejected } = filterConversationClaims(blocks.claims, {
    channel,
    max_claims: opts.max_claims ?? 5,
  });
  const results = { claims: [], questions: [], ingests: [], rejected, errors: [] };

  for (const c of accepted) {
    let r;
    if (c.challenge && c.challenges) {
      r = await postChallenge(env, c, channel, model);
      if (!r.error)
        results.claims.push({
          claim_id: r.challenge_claim_id,
          slug: c.slug,
          tier: c.tier,
          kind: "challenge",
          targets: c.challenges,
        });
    } else {
      r = await postClaim(env, c, channel, model);
      if (!r.error)
        results.claims.push({
          claim_id: r.claim_id,
          slug: c.slug,
          tier: c.tier,
          weight: c.weight,
          register: "conversation",
        });
    }
    if (r?.error) results.errors.push({ type: "claim", error: r.error, slug: c.slug });
  }

  for (const q of blocks.questions.slice(0, 3)) {
    const r = await apiPost(
      "/api/protocol/ask",
      {
        slug: q.slug,
        question: q.question,
        channel,
        model,
      },
      env,
    );
    if (r.error) results.errors.push({ type: "question", error: r.error });
    else
      results.questions.push({
        question_node_id: r.question_node_id,
        slug: q.slug,
        confidence: r.confidence,
      });
  }

  for (const ing of blocks.ingests.slice(0, 2)) {
    const r = await apiPost(
      "/api/protocol/ingest",
      {
        slug: ing.slug,
        evidence: ing.evidence,
        question_node_id: ing.question_node_id,
        channel,
        model,
      },
      env,
    );
    if (r.error) results.errors.push({ type: "ingest", error: r.error });
    else results.ingests.push({ ingest_id: r.ingest_id, slug: ing.slug });
  }

  return attachSelf(
    {
      ok: results.errors.length === 0,
      parsed: {
        claims: blocks.claims.length,
        accepted: accepted.length,
        rejected: rejected.length,
        questions: blocks.questions.length,
        ingests: blocks.ingests.length,
      },
      results,
      rules: [
        "Prose is never parsed — only explicit blocks",
        "Max 5 claims per append",
        "Human tier requires source_ids or becomes anecdotal @ 0.22 weight",
        "Conversation register capped @ 0.35 weight",
        "Gate needs 0.62+ match; novel keywords reopen",
      ],
    },
    "conversation_router",
    {
      contains: "quality-filtered conversation → ledger (no reflex on append)",
      how_to_use: "POST /api/protocol/router mode=append|gate|sweep",
    },
  );
}

export async function routerTurn(env, opts = {}) {
  const gate = await routerGate(env, opts);
  if (gate.gate === "answered" && !opts.force) {
    return attachSelf(
      { ok: true, phase: "defense", gate },
      "conversation_router",
      { why: "Graph already answered — model optional" },
    );
  }

  if (!opts.text && !opts.output) {
    return attachSelf(
      { ok: true, phase: "prosecution_ready", gate: gate.gate || "open" },
      "conversation_router",
      { why: "Gate open — emit [CLAIM] blocks in model output" },
    );
  }

  const append = await routerAppend(env, opts);
  return attachSelf(
    { ok: append.ok, phase: "prosecution", gate, append },
    "conversation_router",
    { why: "Filtered blocks appended — rejected logged, not posted" },
  );
}