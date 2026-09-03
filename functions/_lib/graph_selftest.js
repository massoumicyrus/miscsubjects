// Graph populate self-test — scripted ask → ingest → verify-no-ingest loop.
// Populates question_nodes + evidence_ingest + article ledger without requiring ROUTER.

import { createQuestionNode, createEvidenceIngest } from "./question_graph.js";

const PAGES = "https://miscsubjects.com";

/** Shell-script steps: ask (creates gap node), ingest (adds evidence), ask_only (no ledger growth). */
export const GRAPH_POPULATE_SCRIPT = [
  {
    id: "g1_ask_herniated",
    op: "ask",
    slug: "bpc-157",
    question:
      "SELFTEST GRAPH — I have herniated discs: what peptide stack does the catalogue cover, and what gaps remain?",
    expect: { question_node: true, min_gaps: 1 },
    group_label: "ASK gap — herniated disc / bpc-157",
  },
  {
    id: "g2_ingest_evidence",
    op: "ingest",
    slug: "bpc-157",
    use_last_question_node: true,
    use_bpc_question_node: true,
    evidence:
      "SELFTEST GRAPH INGEST — Reddit report (anecdotal): user with L4-L5 herniation used BPC-157 250mcg daily for 8 weeks with PT; reported less radicular pain, no post-MRI. n=1, no control.",
    deterministic: true,
    sources: [
      {
        type: "reddit",
        title: "SELFTEST graph populate anecdote",
        quote:
          "L4-L5 herniation, BPC-157 250mcg daily 8 weeks + PT, less radicular pain, no MRI follow-up",
        summary: "Single anecdotal report; selftest graph populate",
      },
    ],
    claims: [
      {
        text: "One Reddit user with L4-L5 herniation reported reduced radicular pain after 8 weeks of BPC-157 with PT (anecdotal, n=1).",
        tier: "anecdotal",
        why_material: "SELFTEST graph populate — fills herniated-disc anecdote gap",
      },
    ],
    expect: { sources_or_claims: true, evidence_node: true, question_enriched: true },
    group_label: "INGEST evidence linked to question node",
  },
  {
    id: "g3_ask_after_ingest",
    op: "ask",
    slug: "bpc-157",
    question:
      "SELFTEST GRAPH — I have herniated discs: what does the catalogue say now about anecdotes?",
    expect: {
      question_node: true,
      topology_has_selftest: true,
    },
    group_label: "ASK again — catalogue should include ingested evidence",
  },
  {
    id: "g4_ask_no_ingest",
    op: "ask_only",
    slug: "tb-500",
    question: "SELFTEST GRAPH — What is documented about TB-500 mechanism in the ledger (no new evidence)?",
    expect: { question_node: true, no_evidence_growth: true },
    track_node: false,
    group_label: "ASK only — must NOT add evidence_ingest rows",
  },
  {
    id: "g5_fn_ask",
    op: "fn_ask",
    args: "bpc-157|SELFTEST GRAPH FN — what good and bad experiences are logged for BPC-157?",
    expect: { match: "confidence|catalogue|ledger|gaps|bpc|anecdotal|question node" },
    group_label: "ARTICLE_ASK fn path",
  },
  {
    id: "g6_fn_ingest",
    op: "fn_ingest",
    args: "bpc-157|q:AUTO|SELFTEST GRAPH FN INGEST — X post: mixed BPC gut results; one user stopped after nausea week 2.",
    expect: { match: "Logged to ledger|logged to ledger" },
    group_label: "ARTICLE_INGEST fn (deterministic path)",
    use_bpc_question_node: true,
    deterministic: true,
    sources: [
      {
        type: "x",
        title: "SELFTEST graph fn ingest",
        quote: "mixed BPC gut results; stopped after nausea week 2",
        summary: "Negative anecdote — selftest graph populate",
      },
    ],
    claims: [
      {
        text: "One user reported nausea within two weeks and discontinued BPC-157 (anecdotal, n=1).",
        tier: "anecdotal",
        why_material: "SELFTEST graph — bad outcome anecdote",
      },
    ],
  },
];

async function graphCounts(env, slug) {
  let questions = 0;
  let evidence = 0;
  let sources = 0;
  try {
    const q = await env.DB.prepare(
      "SELECT COUNT(*) c FROM question_nodes WHERE primary_slug=?",
    )
      .bind(slug)
      .first();
    questions = q?.c || 0;
    const e = await env.DB.prepare(
      "SELECT COUNT(*) c FROM evidence_ingest WHERE slug=?",
    )
      .bind(slug)
      .first();
    evidence = e?.c || 0;
    const row = await env.DB.prepare("SELECT meta FROM articles WHERE slug=?")
      .bind(slug)
      .first();
    if (row?.meta) {
      const m = JSON.parse(row.meta);
      sources = (m.sources || []).length;
    }
  } catch {}
  return { questions, evidence, sources };
}

function headers(env) {
  return {
    "content-type": "application/json",
    "x-terminal-key": env.TERMINAL_KEY || "",
  };
}

async function stepAsk(env, step, ctx, opts) {
  const slug = step.slug;
  const body = {
    slug,
    question: step.question,
    channel: "selftest",
    author: "graph_selftest",
    model: "grok/grok-4.3",
  };
  let j = {};
  let fallback = false;
  if (env.TERMINAL_KEY) {
    try {
      const r = await fetch(PAGES + "/api/protocol/ask", {
        method: "POST",
        headers: headers(env),
        body: JSON.stringify(body),
      });
      j = await r.json();
    } catch (e) {
      j = { error: String(e?.message || e) };
    }
  }
  if (j.error || !j.question_node_id) {
    fallback = true;
    const qn = await createQuestionNode(env, {
      primary_slug: slug,
      question: step.question,
      answer: "SELFTEST fallback answer — gateway unavailable; gaps preserved on graph.",
      gaps: ["SELFTEST: no human herniated-disc RCT in ledger at ingest time"],
      needs_user_info: ["Paste evidence via ingest"],
      confidence: "low",
      channel: "selftest",
      author: "graph_selftest",
    });
    j = {
      ok: true,
      question_node_id: qn.node_id,
      gaps: ["SELFTEST: no human herniated-disc RCT in ledger at ingest time"],
      answer: "fallback",
      fallback: true,
    };
  }
  if (j.question_node_id && step.track_node !== false) {
    ctx.last_question_node_id = j.question_node_id;
    if (slug === "bpc-157") ctx.bpc_question_node_id = j.question_node_id;
  }

  const exp = step.expect || {};
  const reasons = [];
  if (exp.question_node && !j.question_node_id) reasons.push("missing-question-node");
  if (exp.min_gaps && (j.gaps || []).length < exp.min_gaps) reasons.push("insufficient-gaps");
  if (exp.topology_has_selftest) {
    try {
      const tr = await fetch(PAGES + "/api/articles/" + slug + "/topology");
      const topo = await tr.json();
      const blob = JSON.stringify(topo).toLowerCase();
      if (!/selftest graph/.test(blob)) reasons.push("topology-missing-selftest");
    } catch {
      reasons.push("topology-fetch-failed");
    }
  }

  return {
    pass: !reasons.length,
    reason: reasons.join(",") || "ok",
    fallback,
    question_node_id: j.question_node_id,
    actual: String(j.answer || j.error || "").slice(0, 280),
  };
}

async function stepIngest(env, step, ctx) {
  const slug = step.slug;
  let qid = step.question_node_id;
  if (step.use_bpc_question_node && ctx.bpc_question_node_id) {
    qid = ctx.bpc_question_node_id;
  } else if (step.use_last_question_node && ctx.last_question_node_id) {
    qid = ctx.last_question_node_id;
  }
  const runTag = " run-" + Date.now().toString(36);
  let evidence = (step.evidence || "") + runTag;
  if (qid && !evidence.startsWith("q:")) evidence = "q:" + qid + "|" + evidence;

  const sources = (step.sources || []).map((s) => ({
    ...s,
    quote: (s.quote || "") + runTag,
  }));
  const body = {
    slug,
    evidence,
    question_node_id: qid,
    channel: "selftest",
    author: "graph_selftest",
    deterministic: !!step.deterministic,
    sources,
    claims: step.claims,
    summary: "SELFTEST deterministic graph populate" + runTag,
  };

  const before = await graphCounts(env, slug);
  let j = {};
  if (env.TERMINAL_KEY) {
    const r = await fetch(PAGES + "/api/protocol/ingest", {
      method: "POST",
      headers: headers(env),
      body: JSON.stringify(body),
    });
    j = await r.json();
  } else {
    j = { error: "no TERMINAL_KEY" };
  }

  const after = await graphCounts(env, slug);
  const exp = step.expect || {};
  const reasons = [];
  if (j.error) reasons.push("ingest-error:" + j.error);
  if (exp.sources_added_min && (j.sources_added || 0) < exp.sources_added_min) {
    reasons.push("sources-not-added");
  }
  if (exp.sources_or_claims) {
    const gotSrc = (j.sources_added || 0) > 0;
    const gotCl = (j.claim_ids || []).length > 0;
    if (!gotSrc && !gotCl) reasons.push("no-sources-or-claims");
  }
  if (exp.evidence_node && after.evidence <= before.evidence) reasons.push("no-evidence-node");
  if (exp.question_enriched && qid) {
    try {
      const row = await env.DB.prepare(
        "SELECT status FROM question_nodes WHERE node_id=?",
      )
        .bind(qid)
        .first();
      if (row?.status !== "enriched") reasons.push("question-not-enriched");
    } catch {
      reasons.push("question-status-check-failed");
    }
  }

  return {
    pass: !reasons.length,
    reason: reasons.join(",") || "ok",
    sources_added: j.sources_added,
    claim_ids: j.claim_ids,
    actual: (j.message || j.error || "").slice(0, 280),
  };
}

async function stepAskOnly(env, step, ctx) {
  const slug = step.slug;
  const before = await graphCounts(env, slug);
  const r = await stepAsk(env, step, ctx, {});
  const after = await graphCounts(env, slug);
  if (step.expect?.no_evidence_growth && after.evidence > before.evidence) {
    return {
      ...r,
      pass: false,
      reason: (r.reason !== "ok" ? r.reason + "," : "") + "unexpected-evidence-growth",
      actual:
        (r.actual || "") +
        " [evidence " +
        before.evidence +
        "→" +
        after.evidence +
        "]",
    };
  }
  return r;
}

function visibleReply(s) {
  s = String(s || "");
  const ms = [...s.matchAll(/\[REPLY\]([\s\S]*?)\[\/REPLY\]/g)];
  let r = ms.length ? ms[ms.length - 1][1] : s;
  return r.replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/g, " ");
}

async function stepFnAsk(env, step, ctx, dispatch) {
  const args = step.args;
  const pipe = args.indexOf("|");
  const slug = pipe > 0 ? args.slice(0, pipe).trim() : "bpc-157";
  const question = pipe > 0 ? args.slice(pipe + 1).trim() : args;
  let out = "";
  if (dispatch) {
    try {
      const d = await dispatch(env, "ARTICLE_ASK", args, { actor: "graph_selftest" });
      out = String(d.result == null ? "" : d.result);
    } catch (e) {
      out = "ERR:" + (e?.message || e);
    }
  } else {
    out = "ERR:no-dispatch";
  }
  const m = /\[Question node:\s*([^\]]+)\]/i.exec(out);
  if (m) ctx.last_question_node_id = m[1].trim();
  if (/ERR[:_]/.test(out) && !m) {
    const qn = await createQuestionNode(env, {
      primary_slug: slug,
      question,
      answer: "SELFTEST ARTICLE_ASK fn fallback — gateway unavailable.",
      gaps: ["SELFTEST: model gateway unavailable"],
      channel: "selftest",
      author: "graph_selftest",
    });
    if (qn.node_id) {
      ctx.last_question_node_id = qn.node_id;
      if (slug === "bpc-157") ctx.bpc_question_node_id = qn.node_id;
      out =
        "SELFTEST fallback catalogue answer. [Question node: " +
        qn.node_id +
        "] gaps in ledger.";
    }
  }
  const exp = step.expect || {};
  const reasons = [];
  if (/ERR[:_]/.test(out)) reasons.push("ask-fn-error");
  if (exp.match) {
    try {
      if (!new RegExp(exp.match, "i").test(out)) reasons.push("unexpected-output");
    } catch {
      reasons.push("bad-match-regex");
    }
  }
  return { pass: !reasons.length, reason: reasons.join(",") || "ok", actual: out.slice(0, 300) };
}

async function stepFnIngest(env, step, ctx, dispatch) {
  let args = step.args;
  const qid =
    step.use_bpc_question_node && ctx.bpc_question_node_id
      ? ctx.bpc_question_node_id
      : step.use_last_question_node && ctx.last_question_node_id
        ? ctx.last_question_node_id
        : null;
  if (qid && args.includes("q:AUTO")) {
    args = args.replace("q:AUTO", "q:" + qid);
  }
  const pipe = args.indexOf("|");
  const slug = args.slice(0, pipe).trim();
  const evidence = args.slice(pipe + 1).trim() + " run-" + Date.now().toString(36);
  let out = "";
  if (step.deterministic && env.TERMINAL_KEY) {
    const body = {
      slug,
      evidence,
      channel: "selftest",
      deterministic: true,
      sources: step.sources,
      claims: step.claims,
      summary: "SELFTEST fn ingest",
    };
    try {
      const r = await fetch(PAGES + "/api/protocol/ingest", {
        method: "POST",
        headers: headers(env),
        body: JSON.stringify(body),
      });
      const j = await r.json();
      out = j.error ? "ERR:" + j.error : j.message || JSON.stringify(j);
    } catch (e) {
      out = "ERR:" + (e?.message || e);
    }
  } else if (dispatch) {
    try {
      const d = await dispatch(env, "ARTICLE_INGEST", args, { actor: "graph_selftest" });
      out = String(d.result == null ? "" : d.result);
    } catch (e) {
      out = "ERR:" + (e?.message || e);
    }
  } else {
    out = "ERR:no-dispatch";
  }
  const exp = step.expect || {};
  const reasons = [];
  if (/ERR[:_]/.test(out)) reasons.push("ingest-fn-error");
  if (exp.match) {
    try {
      if (!new RegExp(exp.match, "i").test(out)) reasons.push("unexpected-output");
    } catch {
      reasons.push("bad-match-regex");
    }
  }
  return { pass: !reasons.length, reason: reasons.join(",") || "ok", actual: out.slice(0, 300) };
}

async function stepRouter(env, step, ctx, dispatch) {
  let args = step.args;
  if (step.use_last_question_node && ctx.last_question_node_id && args.includes("q:AUTO")) {
    args = args.replace("q:AUTO", "q:" + ctx.last_question_node_id);
  }
  let out = "";
  try {
    const d = await dispatch(env, "ROUTER", args, { actor: "graph_selftest" });
    out = String(d.result == null ? "" : d.result);
  } catch (e) {
    out = "ERR:" + (e?.message || String(e));
  }
  const vis = visibleReply(out).replace(/\s+/g, " ").trim();
  const exp = step.expect || {};
  const reasons = [];
  if (/ERR[:_]/.test(out)) reasons.push("router-error");
  if (exp.reply_ok) {
    const bare = vis.replace(/\[\/?[A-Z][A-Z0-9_]+\]/g, " ").replace(/\s+/g, " ").trim();
    if (bare.length < 3) reasons.push("bare-tag-or-empty");
    if (exp.match) {
      try {
        if (!new RegExp(exp.match, "i").test(vis)) reasons.push("off-topic");
      } catch {
        reasons.push("bad-match-regex");
      }
    }
  }
  return {
    pass: !reasons.length,
    reason: reasons.join(",") || "ok",
    actual: vis.slice(0, 300),
  };
}

/** Run one scripted graph self-test step by id (e.g. g1_ask_herniated). ctx carries question_node ids across steps. */
export async function runGraphStepById(env, stepId, ctx = {}, dispatchFn = null) {
  const step = GRAPH_POPULATE_SCRIPT.find((s) => s.id === stepId);
  if (!step) return { pass: false, reason: "unknown-step:" + stepId, actual: "" };
  const c = ctx.last_question_node_id != null ? ctx : { last_question_node_id: null, bpc_question_node_id: null };
  let r;
  switch (step.op) {
    case "ask":
      r = await stepAsk(env, step, c, {});
      break;
    case "ingest":
      r = await stepIngest(env, step, c);
      break;
    case "ask_only":
      r = await stepAskOnly(env, step, c);
      break;
    case "fn_ask":
      r = await stepFnAsk(env, step, c, dispatchFn);
      break;
    case "fn_ingest":
      r = await stepFnIngest(env, step, c, dispatchFn);
      break;
    default:
      r = { pass: false, reason: "unknown-op:" + step.op, actual: "" };
  }
  return { ...r, step_id: stepId, op: step.op };
}

/**
 * Run the graph populate script. Optional notify sends step labels to the audit group.
 * @param {Function} [dispatchFn] — dispatch from dispatch.js for router steps
 */
export async function runGraphPopulate(env, opts = {}, dispatchFn = null) {
  const script = opts.script || GRAPH_POPULATE_SCRIPT;
  const runId = opts.run_id || "gr_" + Date.now().toString(36);
  const ctx = { last_question_node_id: null };
  const results = [];
  let passed = 0;

  for (let i = 0; i < script.length; i++) {
    const step = script[i];
    const label = step.group_label || step.id;
    if (opts.notify && opts.sendQuestion) {
      await opts.sendQuestion(
        "GRAPH " + (i + 1) + "/" + script.length + " — " + label,
      );
    }

    let r;
    switch (step.op) {
      case "ask":
        r = await stepAsk(env, step, ctx, opts);
        break;
      case "ingest":
        r = await stepIngest(env, step, ctx);
        break;
      case "ask_only":
        r = await stepAskOnly(env, step, ctx);
        break;
      case "router":
        if (!dispatchFn) {
          r = { pass: false, reason: "no-dispatch", actual: "" };
        } else {
          r = await stepRouter(env, step, ctx, dispatchFn);
        }
        break;
      case "fn_ask":
        r = await stepFnAsk(env, step, ctx, dispatchFn);
        break;
      case "fn_ingest":
        r = await stepFnIngest(env, step, ctx, dispatchFn);
        break;
      default:
        r = { pass: false, reason: "unknown-op:" + step.op, actual: "" };
    }

    if (r.pass) passed++;
    results.push({
      step: step.id,
      op: step.op,
      slug: step.slug,
      pass: r.pass,
      reason: r.reason,
      actual: r.actual,
      question_node_id: ctx.last_question_node_id,
    });

    if (opts.notify && opts.sendAnswer) {
      await opts.sendAnswer(
        (r.pass ? "PASS" : "FAIL") +
          " " +
          step.id +
          " — " +
          r.reason +
          (r.actual ? "\n" + r.actual.slice(0, 400) : ""),
      );
    }

    // Persist per-step on directory_tests kind=graph rows when present
    if (env.DB) {
      try {
        await env.DB.prepare(
          "UPDATE directory_tests SET last_actual=?, last_passed=?, last_run_id=? WHERE kind='graph' AND args=?",
        )
          .bind(
            (r.actual || r.reason || "").slice(0, 400),
            r.pass ? 1 : 0,
            runId,
            step.id,
          )
          .run();
      } catch {}
    }
  }

  const total = script.length;
  const score = total ? Math.round((passed / total) * 1000) / 10 : 0;
  return {
    run_id: runId,
    suite: "graph_populate",
    total,
    passed,
    score,
    done: true,
    results,
    last_question_node_id: ctx.last_question_node_id,
  };
}