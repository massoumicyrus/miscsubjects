import {
  loadArticleTopology,
  loadGraphTopology,
  resolveAskSlugs,
  followUpPrompts,
  suggestedPrompts,
} from "../../_lib/article_topology.js";
import {
  createQuestionNode,
  createEvidenceIngest,
  loadQuestionGraph,
} from "../../_lib/question_graph.js";
import {
  buildVoxelGraph,
  vxDivide,
  vxChainAppend,
  vxBodyFromDivs,
  vxSha256,
  vxContentHash,
  vxProcedure,
} from "../../_lib/voxel_graph.js";
import { claimIdFromDivId, claimDivId } from "../../_lib/claim_surface.js";
import { articleBoundaryAdvice } from "../../_lib/article_boundary.js";
import { checkSources, sourceLawRefusal } from "../../_lib/source_law.js";
import { publicSecretFindingAndRevoke, publicSecret404 } from '../../_lib/public_secret_guard.js';
import {
  recordDiscourse,
  recordArgumentAtomic,
  findDuplicate,
  isTestStub,
  bumpIndependentlyRaised,
  familyOf,
  readDiscourse,
  backfillDiscourse,
  ATTEST_OUTCOMES,
  similarity,
} from "../../_lib/discourse_widgets.js";
import { vxSemanticHash, vxVersionHash } from "../../_lib/voxel_graph.js";
import { ARTICLE_SLOTS } from "../../_lib/article_constitution.js";
import { purgeArticlePageCache } from "../../_lib/edge_cache.js";
import {
  completeNormandyAssignment,
  findClaimDuplicate,
  readNormandyAssignment,
} from "../../_lib/normandy_contract.js";
import {
  enrichClaim,
  wireClaimSourceGraph,
  repairLedgerMeta,
  auditLedgerHealth,
  checkConstitutionSlots,
  buildConstitutionSlotClaims,
  inferSlotFromSource,
} from "../../_lib/ledger_durability.js";
import { compactLedgerMeta } from "../../_lib/ledger_slim.js";
import {
  retractClaimInMeta,
  challengeClaimInMeta,
  scrubArticleContent,
  honestySummary,
  detectSecrets,
} from "../../_lib/ledger_honesty.js";
import { attachSelf } from "../../_lib/self_explain.js";
import { runReflexPass } from "../../_lib/graph_reflex.js";
import { estimateModelCost } from "../../_lib/model_yield.js";
import { runGrowTick, runGrowBatch } from "../../_lib/graph_grow_queue.js";
import { MODEL_GROW_QUEUE } from "../../_lib/explain.js";
import {
  routerTurn,
  routerGate,
  routerAppend,
} from "../../_lib/conversation_router.js";
import { sweepConversationGarbage } from "../../_lib/conversation_quality.js";
import { offloadRevision, migrateRevisions } from "../../_lib/revisions_r2.js";
import {
  proseWriterForMode,
  bodyNeedsReaderProse,
  topologyProsePayload,
} from "../../_lib/article_prose.js";
import { logEvent, readEventFull } from "../../_lib/event_log.js";
import { enrichmentBrief, usesEnrichmentVoice } from "../../_lib/enrichment_logic.js";
import { parseCrossSlug, catalogById } from "../../_lib/ledger_canonical.js";
import { computeMapping } from "../../_lib/ledger_matrix.js";
import {
  articleMandate,
  auditEditorialScope,
  editorialDebatePrompt,
  classifyArticleMode,
  offMandateClaimIds,
} from "../../_lib/article_editorial.js";
import { respondProtocol } from "../../_lib/protocol_invocation.js";
import { pipelinePromptPack } from "../../_lib/pipeline_prompts.js";
import { resolvePoolToken } from "../../_lib/workspace_object.js";
import {
  isBuildAuthed,
  verifyShareTokenValue,
  tokenAllowsKey,
  consumeShareUse,
  capFingerprint,
  getCapabilityByFingerprint,
  capabilityChainStatus,
  mintShareToken,
} from "../../_lib/admin_session.js";
import {
  buildOipArticle,
  buildOipArticleBundle,
  formatOipArticleBundleMarkdown,
  insertOipArticleVersion,
  isOipArticleSlug,
  listDynamicOipArticles,
  loadDynamicOipArticle,
  oipReviewArticleSlugs,
  parseOipArticleSlug,
  rawOipArticleBody,
  recentOipReviewHistory,
  OIP_REVIEW_QUESTIONS,
  reviewQuestionsFor,
} from "../../_lib/oip_articles.js";

const TIERS = [
  "human",
  "preclinical",
  "anecdotal",
  "mechanistic",
  "speculative",
  "system",
];
const SOURCE_TYPES = [
  "pubmed",
  "clinical_trial",
  "review",
  "medical",
  "anecdotal",
  "business",
  "reddit",
  "x",
  "instagram",
  "youtube",
  "news",
  "statement",
  "hackernews",
  "wikipedia",
  "dictionary",
  "book",
  "primary-text",
  "encyclopedia",
  "reference",
  "github",
  "arxiv",
  "stackoverflow",
  "discord",
  "imessage",
  "whatsapp",
  "publisher_documentation",
  "repository_source",
  "release",
  "runtime_receipt",
  "independent_test",
  "standard",
  "other",
];
const REVIEW_ROLES = ["neutral", "adversary", "endorsement", "source_hunt"];
const EVIDENCE_BASES = [
  "parametric_memory",
  "web_search",
  "provided_document",
  "derived_inference",
  "publisher_claim",
  "source_code",
  "runtime_observation",
  "independent_replication",
];
const BASE_WEIGHT = {
  human: 0.8,
  preclinical: 0.5,
  anecdotal: 0.3,
  mechanistic: 0.3,
  speculative: 0.1,
  system: 0.35,
};
// ── EPISTEMIC STANDING ONTOLOGY ──────────────────────────────────────────────
// Orthogonal to medical `tier`. `tier` grades HOW STRONG the evidence is for a
// health claim; `standing` grades WHAT KIND of standing a claim has in the world.
// The instrument is a demarcation tool: it sorts claims by evidentiary mode, not
// by true/false. Seven modes, ordered strongest→weakest standing:
const STANDINGS = [
  "adjudicated",         // a court / formal body ruled on it (highest bar, narrowest set)
  "documentary",         // a primary record exists (log, filing, photo, transaction); the record is real, its meaning is a separate claim
  "testimonial",         // someone sworn / on-record asserts it (real as an assertion; its truth is downstream)
  "entailed",            // follows DEDUCTIVELY from named premise claims — true if the premises are, no hidden premise (crown jewel + landmine)
  "consistent_unproven", // nothing contradicts it and it fits the pattern, but no positive evidence ("reasonably believed")
  "asserted_at_volume",  // N people assert it — a social fact ("many claim X"), true/false independently of X
  "debunked",            // affirmatively contradicted by established evidence
];
const STANDING_DEFS = {
  adjudicated: "A court or formal adjudicating body ruled on it. Highest bar, narrowest set.",
  documentary: "A primary record exists (log, filing, photo, transaction). The document is real; what it MEANS is a separate claim.",
  testimonial: "Someone sworn or on-record asserts it. Real as an assertion; its truth is downstream.",
  entailed: "Follows deductively from named premise claims (premise_ids). Must be true if the premises are, with NO hidden premise. Filing an entailment with no stated premises, or with a hidden premise, is insinuation wearing entailment's clothes — file it as consistent_unproven instead, or it will be demoted by a hidden_premise challenge.",
  consistent_unproven: "Nothing contradicts it and it fits the pattern, but there is no positive evidence. The 'reasonably believed' bucket.",
  asserted_at_volume: "N people assert it. A social fact ('many claim X'), true or false independently of X. Volume of sources is not evidence.",
  debunked: "Affirmatively contradicted by established evidence.",
};
// Where a disciplined hidden-premise challenge sends a bogus `entailed` claim. An
// entailment with an unstated premise is not a deduction; it is either a pattern-fit
// (consistent_unproven) or a crowd belief (asserted_at_volume). The challenger chooses.
const STANDING_DEMOTE = new Set(["consistent_unproven", "asserted_at_volume"]);
const ELEVATION_THRESHOLD = 0.6;
const MATERIALITY_THRESHOLD = 0.4;
const CUT_THRESHOLD = 0.15;
const REGISTERS = [
  "accessible",
  "standard",
  "technical",
  "source_ledger",
  "combinatorial_accessible",
  "scientific",
  "clinical_plain",
];
const VERIFY_CAP = 16;
const FETCH_TIMEOUT_MS = 6000;
// NO_FABRICATED_LIVE_CONTENT (law, owner order 2026-07-23): live articles carry only real,
// sourced material. Any claim or document that declares itself planted, fabricated, or filed
// as a deliberate fallacy "for demonstration" is refused at intake, on every channel. A worked
// example of catching a bad inference must use a genuinely bad inference found in the wild or
// an offline fixture — never a model-authored lie on a live page. (Origin: the c11 plant in
// openai-huggingface-hack-2026, removed 2026-07-24.)
const PLANTED_MARKERS =
  /deliberately (?:planted|filed|false|fallacious)|planted (?:fallac|deduction|claim|lie)|plant(?:ed|ing) (?:a|one|this) (?:false|fake|fallacious)|fabricated (?:for|as) (?:a )?demo|for demonstration purposes|intentionally (?:false|wrong|fallacious|misleading)|filed here specifically so|so a challenge can demonstrate/i;
function plantedContentViolation(...parts) {
  for (const p of parts) {
    if (!p) continue;
    const m = PLANTED_MARKERS.exec(String(p));
    if (m) return m[0];
  }
  return null;
}
const PLANTED_REFUSAL =
  "NO_FABRICATED_LIVE_CONTENT: live content carries only real, sourced material. Content that declares itself planted, fabricated, or a deliberate fallacy for demonstration is refused. Demonstrate bad inferences with genuinely bad inferences found in the wild, or offline fixtures — never authored lies on the live site.";
function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function protocolCtx(b, extra = {}) {
  return {
    slug: extra.slug || b?.slug || b?.peptide || null,
    trace_id: b?.trace_id || extra.trace_id || null,
    actor: b?.role || b?.actor || extra.actor || null,
  };
}
async function respond(env, action, out, status = 200, ctx = {}) {
  return respondProtocol(env, action, out, status, {
    slug: ctx.slug || out?.slug || null,
    actor: ctx.actor || null,
    trace_id: ctx.trace_id || out?.trace_id || out?.trace || null,
    input_preview: ctx.input_preview || null,
  });
}
async function authed(request, env) {
  return isBuildAuthed(request, env);
}
function nowIso() {
  return new Date().toISOString();
}
function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
function parseMeta(m) {
  try {
    return JSON.parse(m || "{}") || {};
  } catch {
    return {};
  }
}
async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
async function getRow(env, slug) {
  return env.DB.prepare(
    "SELECT slug, title, body, meta, created_at, updated_at FROM articles WHERE slug=?",
  )
    .bind(slug)
    .first();
}
function provBody(e) {
  return [
    e.prev,
    e.ts,
    e.model,
    e.action,
    e.prompt,
    e.input,
    e.response,
    e.tokens_in,
    e.tokens_out,
  ].join("|");
}
async function addProv(meta, p) {
  const list = Array.isArray(meta.provenance) ? meta.provenance : [];
  const prev = list.length ? list[list.length - 1].hash : "genesis";
  const e = {
    ts: nowIso(),
    model: String(p.model || "unknown"),
    action: String(p.action || "edit"),
    prompt: String(p.prompt || "").slice(0, 4000),
    input: String(p.input || "").slice(0, 4000),
    response: String(p.response || "").slice(0, 4000),
    tokens_in: Number(p.tokens_in || 0),
    tokens_out: Number(p.tokens_out || 0),
    cost: Number(p.cost || 0),
    prev,
  };
  e.hash = await sha256(provBody(e));
  list.push(e);
  meta.provenance = list;
  return meta;
}
function srcBody(e) {
  return [
    e.prev,
    e.accessed_at,
    e.type,
    e.url,
    e.title,
    e.quote,
    e.summary,
    (e.claim_ids || []).join(","),
  ].join("|");
}
async function verifyOne(src) {
  const url = String(src.url || "").trim();
  if (!/^https?:\/\//i.test(url))
    return {
      link_status: "invalid",
      quote_status: src.quote ? "unverified" : "na",
    };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let link_status = "dead",
    quote_status = src.quote ? "unverified" : "na";
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "miscsubjects-protocol-verifier/1.0" },
    });
    if (!r.ok) {
      link_status = "http_" + r.status;
    } else {
      link_status = "ok";
      if (src.quote) {
        const body = (await r.text()).slice(0, 1500000);
        const norm = (s) => String(s).replace(/\s+/g, " ").toLowerCase();
        quote_status = norm(body).includes(norm(src.quote).slice(0, 180))
          ? "verified"
          : "unverified";
      }
    }
  } catch (e) {
    link_status = e && e.name === "AbortError" ? "timeout" : "dead";
  } finally {
    clearTimeout(t);
  }
  return {
    link_status,
    quote_status,
  };
}
async function pushRevision(env, meta, prevRow, prevMeta) {
  if (!prevRow) return;
  // Heal any legacy inline revisions first — caps the D1 row at its 2 MB per-value limit.
  await migrateRevisions(env, prevRow.slug, meta);
  const revs = Array.isArray(meta.revisions) ? meta.revisions : [];
  const snap = {
    n: revs.length,
    ts: prevRow.updated_at || nowIso(),
    title: prevRow.title,
    body: prevRow.body || "",
    claims: prevMeta.claims || [],
    sources: prevMeta.sources || [],
    register: prevMeta.register || null,
    status: prevMeta.status || "published",
  };
  snap.prev_hash = revs.length ? revs[revs.length - 1].hash : "genesis";
  snap.hash = await sha256(
    [
      snap.n,
      snap.ts,
      snap.title,
      snap.body,
      JSON.stringify(snap.claims),
      JSON.stringify(snap.sources),
    ].join("|"),
  );
  revs.push(await offloadRevision(env, prevRow.slug, snap)); // full snapshot → R2; slim index → D1
  meta.revisions = revs;
}
function contribBody(e) {
  return [
    e.prev_hash,
    e.seq,
    e.ts,
    e.model,
    e.role,
    e.action,
    JSON.stringify(e.payload),
    e.rationale,
  ].join("|");
}
async function addContribution(meta, e) {
  const list = Array.isArray(meta.contributions) ? meta.contributions : [];
  const prev = list.length ? list[list.length - 1].hash : "genesis";
  const entry = {
    seq: list.length,
    id: "k" + (list.length + 1),
    ts: nowIso(),
    model: String(e.model || "unknown"),
    role: String(e.role || e.action || "writer"),
    action: String(e.action || "draft"),
    payload: e.payload || {},
    rationale: String(e.rationale || "").slice(0, 8000),
    tokens_in: Number(e.tokens_in || 0),
    tokens_out: Number(e.tokens_out || 0),
    cost: Number(
      e.cost != null
        ? e.cost
        : estimateModelCost(e.model, e.tokens_in, e.tokens_out),
    ),
    prev_hash: prev,
  };
  entry.hash = await sha256(contribBody(entry));
  list.push(entry);
  meta.contributions = list;
  return entry;
}
async function draft(env, b, doVerify) {
  const errors = [];
  const slug = slugify(b.slug || b.title);
  const title = String(b.title || "").trim();
  const body = String(b.body || "");
  if (!title) errors.push("title required");
  if (!slug) errors.push("slug required (or a title to derive one)");
  const seenSrc = new Set();
  const outSources = [];
  for (let i = 0; i < (Array.isArray(b.sources) ? b.sources : []).length; i++) {
    const s = b.sources[i] || {};
    const id = String(s.id || "s" + (i + 1));
    if (s.type != null && !SOURCE_TYPES.includes(String(s.type)))
      errors.push(
        `source ${id}: type "${s.type}" not in enum -> stored as "other"`,
      );
    const type = SOURCE_TYPES.includes(String(s.type))
      ? String(s.type)
      : "other";
    const url = String(s.url || "");
    const key = (url + "|" + String(s.quote || "")).toLowerCase();
    if (seenSrc.has(key)) {
      errors.push(`source ${id}: duplicate (same url+quote) -> dropped`);
      continue;
    }
    seenSrc.add(key);
    outSources.push({
      id,
      type,
      url,
      title: String(s.title || ""),
      quote: String(s.quote || ""),
      summary: String(s.summary || ""),
      claim_ids: Array.isArray(s.claim_ids) ? s.claim_ids.map(String) : [],
      found_by: String(s.found_by || b.model || (b.prov && b.prov.model) || ""),
      extra: s.extra && typeof s.extra === "object" ? s.extra : {},
      accessed_at: nowIso(),
    });
  }
  let verified = 0,
    capped = 0;
  if (doVerify && outSources.length) {
    const toCheck = outSources.slice(0, VERIFY_CAP);
    capped = Math.max(0, outSources.length - VERIFY_CAP);
    const results = await Promise.allSettled(toCheck.map(verifyOne));
    results.forEach((res, i) => {
      const v =
        res.status === "fulfilled"
          ? res.value
          : {
              link_status: "dead",
              quote_status: toCheck[i].quote ? "unverified" : "na",
            };
      toCheck[i].link_status = v.link_status;
      toCheck[i].quote_status = v.quote_status;
      verified++;
    });
    for (let i = VERIFY_CAP; i < outSources.length; i++) {
      outSources[i].link_status = "unchecked";
      outSources[i].quote_status = outSources[i].quote ? "unchecked" : "na";
    }
    if (capped)
      errors.push(
        `${capped} source(s) over the ${VERIFY_CAP}-per-draft verify cap -> link_status:"unchecked"`,
      );
  } else {
    for (const s of outSources) {
      s.link_status = "unchecked";
      s.quote_status = s.quote ? "unchecked" : "na";
    }
  }
  let prev = "genesis";
  for (const s of outSources) {
    s.prev = prev;
    s.hash = await sha256(srcBody(s));
    prev = s.hash;
  }
  const sourceHead = outSources.length
    ? outSources[outSources.length - 1].hash
    : "genesis";
  const validSourceIds = new Set(outSources.map((s) => s.id));
  const seenClaim = new Set();
  const outClaims = [];
  for (let i = 0; i < (Array.isArray(b.claims) ? b.claims : []).length; i++) {
    const c = b.claims[i] || {};
    const id = String(c.id || "c" + (i + 1));
    const text = String(c.text || "").trim();
    if (!text) {
      errors.push(`claim ${id}: empty text -> skipped`);
      continue;
    }
    const tkey = text.toLowerCase().replace(/\s+/g, " ");
    if (seenClaim.has(tkey)) {
      errors.push(`claim ${id}: duplicate text -> dropped`);
      continue;
    }
    seenClaim.add(tkey);
    const planted = plantedContentViolation(text, c.rationale, c.why_material, c.section);
    if (planted) {
      errors.push(`claim ${id}: planted_content_refused (matched "${planted}") — ${PLANTED_REFUSAL}`);
      continue;
    }
    const tier = TIERS.includes(String(c.tier)) ? String(c.tier) : null;
    if (!tier)
      errors.push(
        `claim ${id}: tier "${c.tier || ""}" not in enum [${TIERS.join("|")}] -> defaulted to "speculative"`,
      );
    const requested = Array.isArray(c.source_ids)
      ? c.source_ids.map(String)
      : [];
    const source_ids = requested.filter((x) => validSourceIds.has(x));
    if (requested.length - source_ids.length > 0)
      errors.push(
        `claim ${id}: ${requested.length - source_ids.length} source_id(s) reference no posted source -> dropped`,
      );
    let source_status = String(c.source_status || "");
    if (!source_ids.length && source_status !== "unsourced") {
      source_status = "unsourced";
      errors.push(`claim ${id}: no valid source -> source_status:"unsourced"`);
    }
    const evidence_basis = EVIDENCE_BASES.includes(String(c.evidence_basis))
      ? String(c.evidence_basis)
      : null;
    if (!evidence_basis)
      errors.push(
        `claim ${id}: evidence_basis "${c.evidence_basis || ""}" not in enum [${EVIDENCE_BASES.join("|")}] -> defaulted to "derived_inference"`,
      );
    outClaims.push(
      enrichClaim(
        {
          id,
          text,
          section: String(c.section || ""),
          tier: tier || "speculative",
          source_ids,
          source_status: source_ids.length
            ? "sourced"
            : source_status || "unsourced",
          why_material: String(c.why_material || ""),
          evidence_basis: evidence_basis || "derived_inference",
          weight: BASE_WEIGHT[tier || "speculative"] || 0.1,
          status: "active",
          stance_scores: {
            neutral: 0,
            pro: 0,
            adversary: 0,
          },
          slot: c.slot || null,
          who_claims: c.who_claims || null,
          posted_by: c.posted_by || null,
          extra: c.extra && typeof c.extra === "object" ? c.extra : {},
        },
        {
          model: b.model || (b.prov && b.prov.model) || "draft",
          channel: b.channel || "protocol/draft",
          actor: c.who_claims || b.model || (b.prov && b.prov.model),
        },
      ),
    );
  }
  if (!title || !slug)
    return {
      error: "invalid",
      errors,
    };
  const existing = await getRow(env, slug);
  const isNewArticle = !existing;
  const prevMeta = existing ? parseMeta(existing.meta) : {};
  const meta = Object.assign({}, prevMeta);
  const mm = b.meta && typeof b.meta === "object" ? b.meta : {};
  for (const k of [
    "style",
    "tags",
    "hero",
    "images",
    "widgets",
    "model",
    "embeds",
    "extra",
    "home",
  ]) {
    if (mm[k] != null) meta[k] = mm[k];
  }
  if (b.home != null) meta.home = (b.home === true || b.home === 'true' || b.home === 1);
  if (b.tags != null) meta.tags = b.tags;
  if (b.style != null) meta.style = b.style;
  if (b.model != null) meta.model = String(b.model);
  const register = String(
    b.register || mm.register || prevMeta.register || "standard",
  );
  if (!REGISTERS.includes(register))
    errors.push(
      `register "${register}" not in enum [${REGISTERS.join("|")}] -> stored as-is`,
    );
  meta.register = register;
  if (existing) await pushRevision(env, meta, existing, prevMeta);
  const wired = wireClaimSourceGraph(outClaims, outSources);
  meta.claims = wired.claims;
  meta.sources = wired.sources;
  meta.source_head = sourceHead;
  const slotCheck = checkConstitutionSlots(meta.claims);
  if (slotCheck.missing_required.length && b.strict_constitution) {
    return {
      error: "constitution incomplete",
      missing_slots: slotCheck.missing_required,
      hint: "Add claims for required slots or POST with strict_constitution:false",
    };
  }
  if (slotCheck.missing_required.length) {
    errors.push(
      "constitution missing slots: " + slotCheck.missing_required.join(", "),
    );
  }
  if (b.prov) await addProv(meta, b.prov);
  else
    await addProv(meta, {
      model: b.model || "unknown",
      action: existing ? "redraft" : "draft",
      input: title,
      response: body.slice(0, 1500),
    });
  await addContribution(meta, {
    model: b.model || (b.prov && b.prov.model) || "unknown",
    role: b.role || "writer",
    action: existing ? "redraft" : "draft",
    payload: {
      title,
      register,
      body: body.slice(0, 20000),
      claims: outClaims,
      sources: outSources.map((s) => ({
        id: s.id,
        type: s.type,
        url: s.url,
        title: s.title,
        quote: s.quote,
        link_status: s.link_status,
        quote_status: s.quote_status,
      })),
    },
    rationale: String(b.rationale || ""),
    tokens_in: (b.prov && b.prov.tokens_in) || 0,
    tokens_out: (b.prov && b.prov.tokens_out) || 0,
  });
  const ts = nowIso();
  await env.DB.prepare(
    "INSERT INTO articles(slug, title, subject, published, body, meta, created_at, updated_at) VALUES (?,?,?,1,?,?,?,?) " +
      "ON CONFLICT(slug) DO UPDATE SET title=excluded.title, body=excluded.body, meta=excluded.meta, updated_at=excluded.updated_at",
  )
    .bind(slug, title, title, body, JSON.stringify(meta), ts, ts)
    .run();
  if (isNewArticle) {
    try {
      const { onArticleCreated } = await import("../../_lib/article_automation.js");
      await onArticleCreated(env, slug, { title });
    } catch {}
  }
  const deadLinks = outSources.filter((s) =>
    /^(dead|timeout|invalid|http_)/.test(String(s.link_status || "")),
  ).length;
  return {
    ok: true,
    slug,
    url: "https://miscsubjects.com/a/" + slug,
    claims: outClaims.length,
    sources: outSources.length,
    source_head: sourceHead,
    provenance_head: meta.provenance
      ? meta.provenance[meta.provenance.length - 1].hash
      : "genesis",
    verification: {
      verified,
      capped_unchecked: capped,
      dead_or_broken_links: deadLinks,
      unverified_quotes: outSources.filter(
        (s) => s.quote_status === "unverified",
      ).length,
    },
    sources_detail: outSources.map((s) => ({
      id: s.id,
      url: s.url,
      link_status: s.link_status,
      quote_status: s.quote_status,
    })),
    validation_notes: errors,
    read: {
      article: "https://miscsubjects.com/a/" + slug,
      source_ledger:
        "https://miscsubjects.com/api/articles/" + slug + "/sources",
      provenance:
        "https://miscsubjects.com/api/articles/" + slug + "/provenance",
    },
  };
}
async function review(env, b) {
  const slug = slugify(b.slug);
  const a = await getRow(env, slug);
  if (!a) return { error: "article not found: " + slug };
  const meta = parseMeta(a.meta);
  const reviews = Array.isArray(meta.reviews) ? meta.reviews : [];
  const role = REVIEW_ROLES.includes(String(b.role))
    ? String(b.role)
    : "neutral";
  const entry = {
    id: "r" + (reviews.length + 1),
    ts: nowIso(),
    role,
    model: String(b.model || "unknown"),
    rationale: String(b.rationale || b.reasoning || "").slice(0, 4000),
    checks: Array.isArray(b.checks) ? b.checks : [],
    contributions: Array.isArray(b.contributions) ? b.contributions : [],
    uncertainties: Array.isArray(b.uncertainties) ? b.uncertainties : [],
    material: b.material !== false,
    tokens_in: Number(b.tokens_in || 0),
    tokens_out: Number(b.tokens_out || 0),
    extra: b.extra && typeof b.extra === "object" ? b.extra : {},
  };
  reviews.push(entry);
  meta.reviews = reviews;
  if (b.prov) await addProv(meta, b.prov);
  else
    await addProv(meta, {
      model: entry.model,
      action: "review:" + role,
      input: slug,
      response: entry.rationale.slice(0, 800),
      tokens_in: entry.tokens_in,
      tokens_out: entry.tokens_out,
    });
  await addContribution(meta, {
    model: entry.model,
    role,
    action: "review",
    payload: {
      checks: entry.checks,
      contributions: entry.contributions,
      uncertainties: entry.uncertainties,
    },
    rationale: entry.rationale,
    tokens_in: entry.tokens_in,
    tokens_out: entry.tokens_out,
  });
  if (!entry.material) {
    const energy = Array.isArray(meta.energy_spent) ? meta.energy_spent : [];
    energy.push({
      ts: nowIso(),
      model: entry.model,
      role,
      tokens_in: entry.tokens_in,
      tokens_out: entry.tokens_out,
      contribution: null,
      reason: "non-material review",
    });
    meta.energy_spent = energy;
  }
  await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
    .bind(JSON.stringify(meta), nowIso(), slug)
    .run();
  return {
    ok: true,
    slug,
    review_id: entry.id,
    role,
    reviews: reviews.length,
    note: "stored \u2014 scoring/weighting/inclusion deferred (see /api/tasks queue)",
  };
}
async function score(env, b) {
  const slug = slugify(b.slug);
  const a = await getRow(env, slug);
  if (!a) return { error: "article not found: " + slug };
  const meta = parseMeta(a.meta);
  const claims = Array.isArray(meta.claims) ? meta.claims : [];
  const reviews = Array.isArray(meta.reviews) ? meta.reviews : [];
  const changes = [];
  for (const c of claims) {
    const base = BASE_WEIGHT[c.tier] || 0.1;
    const oldWeight = Number(c.weight) || base;
    const oldStatus = c.status || "active";
    let pro = 0,
      adversary = 0;
    for (const rev of reviews) {
      if (!Array.isArray(rev.contributions)) continue;
      for (const con of rev.contributions) {
        const cid = con.claim_id || con.target_claim_id;
        if (cid !== c.id) continue;
        const s = Number(con.score) || 0;
        if (rev.role === "endorsement") pro += s;
        else if (rev.role === "adversary") adversary += s;
      }
    }
    const weight = Math.max(0, Math.min(1, base + pro - adversary));
    let status = "active";
    if (weight < CUT_THRESHOLD) status = "cut";
    else if (weight < oldWeight) status = "downweighted";
    c.weight = weight;
    c.status = status;
    c.stance_scores = {
      neutral: 0,
      pro,
      adversary,
    };
    if (Math.abs(weight - oldWeight) > 0.001 || oldStatus !== status) {
      changes.push({
        claim_id: c.id,
        old_weight: oldWeight,
        new_weight: weight,
        status,
      });
    }
  }
  meta.claims = claims;
  await addProv(meta, {
    model: b.model || "scorer",
    action: "score",
    input: slug,
    response: JSON.stringify(changes).slice(0, 2000),
    tokens_in: b.tokens_in || 0,
    tokens_out: b.tokens_out || 0,
  });
  await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
    .bind(JSON.stringify(meta), nowIso(), slug)
    .run();
  return {
    ok: true,
    slug,
    claims_scored: claims.length,
    reviews_considered: reviews.length,
    changes,
    thresholds: {
      elevation: ELEVATION_THRESHOLD,
      materiality: MATERIALITY_THRESHOLD,
      cut: CUT_THRESHOLD,
    },
  };
}
async function inventory(env, b) {
  const kind = String(b.kind || "peptide");
  const items = Array.isArray(b.items) ? b.items : [];
  const ts = nowIso();
  let inserted = 0,
    existing = 0;
  for (const it of items) {
    const name = String(it.name || "").trim();
    if (!name) continue;
    const ev = String(it.evidence || "none");
    const row = await env.DB.prepare(
      "SELECT id FROM pipeline WHERE kind=? AND name=?",
    )
      .bind(kind, name)
      .first();
    if (row) {
      existing++;
      continue;
    }
    const itemData =
      it.data && typeof it.data === "object" ? JSON.stringify(it.data) : null;
    await env.DB.prepare(
      "INSERT INTO pipeline (kind, name, phase, evidence, status, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(kind, name, "queued", ev, "pending", itemData, ts)
      .run();
    inserted++;
  }
  return {
    ok: true,
    kind,
    inserted,
    existing,
    total: inserted + existing,
  };
}
async function outline(env, b) {
  const id = Number(b.item_id);
  if (!id || isNaN(id)) return { error: "item_id required" };
  const row = await env.DB.prepare("SELECT id, data FROM pipeline WHERE id=?")
    .bind(id)
    .first();
  if (!row) return { error: "pipeline item not found: " + id };
  const data = parseMeta(row.data);
  data.outline = String(b.outline || "");
  data.model = String(b.model || "unknown");
  data.reasoning = String(b.reasoning || "");
  await env.DB.prepare(
    "UPDATE pipeline SET phase=?, data=?, updated_at=? WHERE id=?",
  )
    .bind("outlined", JSON.stringify(data), nowIso(), id)
    .run();
  return {
    ok: true,
    item_id: id,
    phase: "outlined",
  };
}
// Known SEO-listicle / content-farm domains: allowed as color, flagged so they
// cannot pass as documentary backing (owner brief 2026-07-24, REFERENCE_FIRST law).
const CONTENT_FARM_RE = /\b(digitalapplied\.com|arbisoft\.com|usaii\.org|generect\.com|vrid\.ai|sourceforge\.net\/software|memeburn\.com)\b/i;

async function sources(env, b) {
  const slug = slugify(b.slug);
  const existing = await getRow(env, slug);
  if (!existing) return { error: "article not found: " + slug };
  // SOURCE_QUOTE_LAW. This route used to stamp a quote-less entry `quote_status: "na"` and store
  // it, which is how a card came to render our description of a study where the study's own words
  // belong. The same contract that guards PUT /api/articles guards it here — one law, both paths.
  const lawful = checkSources(b.sources);
  if (!lawful.ok) return { ...sourceLawRefusal(lawful), slug, status: 422 };
  const prevMeta = parseMeta(existing.meta);
  const meta = Object.assign({}, prevMeta);
  const existingSources = Array.isArray(prevMeta.sources)
    ? prevMeta.sources.map((s) => Object.assign({}, s))
    : [];
  const seen = new Set(
    existingSources.map((s) =>
      (String(s.url || "") + "|" + String(s.quote || "")).toLowerCase(),
    ),
  );
  let maxN = 0;
  existingSources.forEach((s) => {
    const m = /^s(\d+)$/.exec(String(s.id || ""));
    if (m) maxN = Math.max(maxN, +m[1]);
  });
  const added = [];
  for (const s of Array.isArray(b.sources) ? b.sources : []) {
    const key = (
      String(s.url || "") +
      "|" +
      String(s.quote || "")
    ).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const id =
      s.id && !existingSources.some((e) => e.id === String(s.id))
        ? String(s.id)
        : "s" + ++maxN;
    const type = SOURCE_TYPES.includes(String(s.type))
      ? String(s.type)
      : "other";
    added.push({
      id,
      type,
      url: String(s.url || ""),
      title: String(s.title || ""),
      quote: String(s.quote || ""),
      summary: String(s.summary || ""),
      author: String(s.author || ""),
      publisher: String(s.publisher || ""),
      date: String(s.date || ""),
      claim_ids: Array.isArray(s.claim_ids) ? s.claim_ids.map(String) : [],
      found_by: String(s.found_by || b.model || ""),
      extra: s.extra && typeof s.extra === "object" ? s.extra : {},
      accessed_at: nowIso(),
      // Source floor: SEO/content-farm domains are flagged at ingest so they can
      // never silently back documentary-tier claims on technical articles.
      source_grade: CONTENT_FARM_RE.test(String(s.url || "")) ? "content_farm" : "primary_or_press",
    });
  }
  if (!added.length) {
    return {
      error: "duplicate_sources_only",
      status: 409,
      note: "Every submitted URL and quote pair already exists. No graph object was added and no Normandy slot completed.",
      existing_source_ids: existingSources.map(source => source.id).slice(0, 80),
    };
  }
  await pushRevision(env, meta, existing, prevMeta);
  const toCheck = added.slice(0, VERIFY_CAP);
  const results = await Promise.allSettled(toCheck.map(verifyOne));
  results.forEach((res, i) => {
    const v =
      res.status === "fulfilled"
        ? res.value
        : {
            link_status: "dead",
            quote_status: toCheck[i].quote ? "unverified" : "na",
          };
    toCheck[i].link_status = v.link_status;
    toCheck[i].quote_status = v.quote_status;
  });
  for (let i = VERIFY_CAP; i < added.length; i++) {
    added[i].link_status = "unchecked";
    added[i].quote_status = added[i].quote ? "unchecked" : "na";
  }
  const all = existingSources.concat(added);
  let prev = "genesis";
  for (const s of all) {
    s.prev = prev;
    s.hash = await sha256(srcBody(s));
    prev = s.hash;
  }
  meta.sources = all;
  meta.source_head = all.length ? all[all.length - 1].hash : "genesis";
  const claims = Array.isArray(prevMeta.claims)
    ? prevMeta.claims.map((c) => Object.assign({}, c))
    : [];
  const byClaim = {};
  claims.forEach((c) => {
    byClaim[c.id] = c;
  });
  for (const s of added)
    for (const cid of s.claim_ids) {
      const c = byClaim[cid];
      if (c) {
        c.source_ids = Array.from(new Set([...(c.source_ids || []), s.id]));
        c.source_status = "sourced";
      }
    }
  meta.claims = claims;
  if (b.prov) await addProv(meta, b.prov);
  else
    await addProv(meta, {
      model: b.model || "unknown",
      action: "sources",
      input: slug,
      response: added.length + " source(s) added",
    });
  await addContribution(meta, {
    model: b.model || "unknown",
    role: "source_hunt",
    action: "sources",
    payload: {
      added: added.map((s) => ({
        id: s.id,
        type: s.type,
        url: s.url,
        title: s.title,
        quote: s.quote,
        link_status: s.link_status,
        quote_status: s.quote_status,
      })),
    },
    rationale: String(b.rationale || ""),
  });
  await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
    .bind(JSON.stringify(meta), nowIso(), slug)
    .run();
  const dead = added.filter((s) =>
    /^(dead|timeout|invalid|http_)/.test(String(s.link_status || "")),
  ).length;
  return {
    ok: true,
    slug,
    added: added.length,
    total_sources: all.length,
    source_head: meta.source_head,
    verification: {
      verified: toCheck.length,
      dead_or_broken_links: dead,
      unverified_quotes: added.filter((s) => s.quote_status === "unverified")
        .length,
    },
    added_detail: added.map((s) => ({
      id: s.id,
      url: s.url,
      link_status: s.link_status,
      quote_status: s.quote_status,
      claim_ids: s.claim_ids,
    })),
  };
}
async function claim(env, b) {
  const slug = slugify(b.slug);
  const existing = await getRow(env, slug);
  if (!existing) return { error: "article not found: " + slug };
  const text = String(b.text || b.assertion || "").trim();
  if (!text) return { error: "text required" };
  const planted = plantedContentViolation(text, b.rationale, b.why_material, b.section);
  if (planted) {
    return { error: "planted_content_refused", status: 422, matched: planted, note: PLANTED_REFUSAL };
  }
  const tier = TIERS.includes(String(b.tier || "").toLowerCase())
    ? String(b.tier).toLowerCase()
    : "speculative";
  const prevMeta = parseMeta(existing.meta);
  const meta = Object.assign({}, prevMeta);
  const claims = Array.isArray(prevMeta.claims)
    ? prevMeta.claims.map((c) => Object.assign({}, c))
    : [];
  const duplicate = findClaimDuplicate(claims, text);
  if (duplicate) {
    return {
      error: "duplicate_claim",
      status: 409,
      claim_id: duplicate.claim.id,
      current_text: duplicate.claim.text,
      similarity: Number(duplicate.similarity.toFixed(3)),
      note: "The claim is already stored. Add a source, a narrower difference, a contradiction, a consequential question, or a rule proposal instead.",
    };
  }
  await pushRevision(env, meta, existing, prevMeta);
  const sources = Array.isArray(prevMeta.sources)
    ? prevMeta.sources.map((s) => Object.assign({}, s))
    : [];
  const sourceIds = new Set(sources.map((s) => String(s.id)));
  const source_ids = Array.isArray(b.source_ids)
    ? b.source_ids.map(String)
    : [];
  for (const sid of source_ids) {
    if (!sourceIds.has(sid))
      return { error: "unknown source_id: " + sid + " — POST /api/protocol/sources first" };
  }
  let maxN = 0;
  claims.forEach((c) => {
    const m = /^c(\d+)$/.exec(String(c.id || ""));
    if (m) maxN = Math.max(maxN, +m[1]);
  });
  const id =
    b.id && !claims.some((c) => c.id === String(b.id))
      ? String(b.id)
      : "c" + ++maxN;
  const postedBy = {
    actor: String(
      b.who_claims || b.actor || b.author || b.model || "unknown",
    ).slice(0, 200),
    channel: String(b.channel || "api"),
    ts: nowIso(),
    model: b.model ? String(b.model) : null,
    rationale: String(b.rationale || "").slice(0, 500),
  };
  const slotIds = new Set(ARTICLE_SLOTS.map((s) => s.id));
  const slot = b.slot && slotIds.has(String(b.slot)) ? String(b.slot) : null;
  // EPISTEMIC STANDING (optional; orthogonal to tier). If given, it must be in the enum.
  let standing = null;
  let premise_ids = [];
  if (b.standing != null) {
    standing = String(b.standing).toLowerCase();
    if (!STANDINGS.includes(standing)) {
      return {
        error: "unknown_standing",
        status: 422,
        given: standing,
        allowed: STANDINGS,
        note: "standing grades WHAT KIND of standing a claim has, not how strong the health evidence is (that is `tier`). See GET /api/protocol/standings for definitions.",
      };
    }
    // `entailed` discipline: the crown jewel and the landmine. A deduction must NAME its
    // premises, and those premises must exist as claims in THIS article. No premise_ids →
    // the claim is an insinuation wearing entailment's clothes; refuse and teach.
    if (standing === "entailed") {
      premise_ids = Array.isArray(b.premise_ids) ? b.premise_ids.map(String) : [];
      if (premise_ids.length < 1) {
        return {
          error: "entailed_needs_premises",
          status: 422,
          note: "standing=entailed must declare premise_ids: the existing claim ids this conclusion follows from DEDUCTIVELY (true if they are, no hidden premise). An entailment with no stated premises is insinuation, not deduction — file it as standing=consistent_unproven or asserted_at_volume, or name the premises.",
          standings: STANDING_DEFS.entailed,
        };
      }
      const known = new Set(claims.map((c) => String(c.id)));
      const missing = premise_ids.filter((pid) => !known.has(pid));
      if (missing.length) {
        return {
          error: "unknown_premise_ids",
          status: 422,
          missing,
          note: "every premise_id must be an existing claim in this article — post the premises first, then the entailment that names them.",
        };
      }
    }
  }
  const newClaim = {
    id,
    text,
    section: String(b.section || (slot ? slot : "Posted claim")),
    tier,
    ...(standing ? { standing } : {}),
    ...(standing === "entailed" ? { premise_ids } : {}),
    weight:
      typeof b.weight === "number"
        ? b.weight
        : BASE_WEIGHT[tier] || 0.1,
    status: "active",
    source_ids,
    source_status: source_ids.length ? "sourced" : "unsourced",
    who_claims: String(b.who_claims || postedBy.actor),
    posted_by: postedBy,
    why_material: String(
      b.why_material || "posted via claim protocol — prompt injection into ledger",
    ),
    slot,
    register: b.register ? String(b.register) : null,
  };
  claims.push(newClaim);
  // Reciprocal entailment edge: each named premise records that it `entails` this
  // conclusion, so the graph reads both directions (premise → conclusion, conclusion → premise).
  if (standing === "entailed" && premise_ids.length) {
    const byId = {};
    claims.forEach((c) => { byId[String(c.id)] = c; });
    for (const pid of premise_ids) {
      const p = byId[pid];
      if (p) p.entails = Array.from(new Set([...(p.entails || []), id]));
    }
  }
  meta.claims = claims;
  const bySource = {};
  sources.forEach((s) => {
    bySource[s.id] = s;
  });
  for (const sid of source_ids) {
    const s = bySource[sid];
    if (s)
      s.claim_ids = Array.from(new Set([...(s.claim_ids || []), id]));
  }
  // claim_ids is part of srcBody(): linking this claim to an existing source
  // changed that source's body, so rechain the source ledger or the chain
  // verifies broken_at that source. Mirrors the rechain in sources().
  if (source_ids.length) {
    let sprev = "genesis";
    for (const s of sources) {
      s.prev = sprev;
      s.hash = await sha256(srcBody(s));
      sprev = s.hash;
    }
    meta.source_head = sources.length ? sources[sources.length - 1].hash : "genesis";
  }
  meta.sources = sources;
  if (b.prov) await addProv(meta, b.prov);
  else
    await addProv(meta, {
      model: b.model || postedBy.actor,
      action: "claim",
      input: slug + " " + id,
      response: text.slice(0, 2000),
      tokens_in: b.tokens_in || 0,
      tokens_out: b.tokens_out || 0,
    });
  await addContribution(meta, {
    model: b.model || postedBy.actor,
    role: "claim_post",
    action: "claim",
    payload: {
      claim_id: id,
      tier,
      text,
      who_claims: newClaim.who_claims,
      source_ids,
      slot,
      posted_by: postedBy,
    },
    rationale: String(b.rationale || ""),
    tokens_in: b.tokens_in || 0,
    tokens_out: b.tokens_out || 0,
  });
  await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
    .bind(JSON.stringify(meta), nowIso(), slug)
    .run();
  const voxel = buildVoxelGraph(slug, meta);
  const atom = voxel.voxels.find((v) => v.id === id);
  return {
    ok: true,
    slug,
    claim_id: id,
    tier,
    ...(standing ? { standing, ...(standing === "entailed" ? { premise_ids } : {}) } : {}),
    who_claims: newClaim.who_claims,
    posted_by: postedBy,
    source_ids,
    total_claims: claims.length,
    voxel: atom,
    voxels_url: "/api/articles/" + slug + "/voxels",
    message:
      "Claim posted to ledger. Not medical advice. Cite " +
      id +
      " in future asks/ingests.",
  };
}
async function normandyResponse(env, b) {
  const slug = slugify(b.slug);
  const answer = String(b.answer || b.text || "").trim().slice(0, 12000);
  if (!slug || !answer) return { error: "normandy response needs slug and answer" };
  const existing = await getRow(env, slug);
  if (!existing) return { error: "article not found: " + slug, status: 404 };
  const prevMeta = parseMeta(existing.meta);
  const prior = (Array.isArray(prevMeta.contributions) ? prevMeta.contributions : [])
    .filter(item => item.role === "normandy_response")
    .map(item => ({ id: item.id, text: item.payload?.answer || item.rationale || "" }));
  const duplicate = findClaimDuplicate(prior, answer);
  if (duplicate) return {
    error: "duplicate_answer",
    status: 409,
    contribution_id: duplicate.claim.id,
    current_text: duplicate.claim.text,
    similarity: Number(duplicate.similarity.toFixed(3)),
    note: "This answer is already stored. New sources or claims need a new direct answer that states their effect.",
  };
  const meta = Object.assign({}, prevMeta);
  await pushRevision(env, meta, existing, prevMeta);
  const entry = await addContribution(meta, {
    model: b.actor || "unknown",
    role: "normandy_response",
    action: "answer",
    payload: { assignment_id: b.assignment_id || null, answer },
    rationale: "Full owner-facing answer stored with the graph objects created in this assignment.",
  });
  await addProv(meta, { model: b.actor || "unknown", action: "normandy_response", input: b.assignment_id || slug, response: answer });
  await env.DB.prepare("UPDATE articles SET meta=?,updated_at=? WHERE slug=?").bind(JSON.stringify(meta), nowIso(), slug).run();
  return { ok: true, id: entry.id, contribution_id: entry.id, slug, link: "https://miscsubjects.com/a/" + slug, answer_hash: await sha256(answer) };
}
function extractJson(t) {
  // Workers AI JSON mode can hand back an already-parsed object.
  if (t && typeof t === "object") return t;
  let s = String(t || "").trim();
  s = s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const i = s.indexOf("{"),
    j = s.lastIndexOf("}");
  if (i >= 0 && j > i) s = s.slice(i, j + 1);
  try {
    return JSON.parse(s);
  } catch (e) {
    // Gemini occasionally truncates mid-string — try closing open strings/brackets.
    let repaired = s.replace(/,\s*$/, "");
    const open = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
    const openArr = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;
    if (repaired.endsWith('"')) repaired += '"';
    for (let k = 0; k < openArr; k++) repaired += "]";
    for (let k = 0; k < open; k++) repaired += "}";
    return JSON.parse(repaired);
  }
}
function modelProvider(env, model) {
  const m = String(model || "").toLowerCase();
  if (m.startsWith("@cf/")) return { name: "cf", key: null };
  if (m.startsWith("grok/") || /^grok-/.test(m)) return { name: "grok", key: env.GROK_API_KEY || null };
  if (m.startsWith("openai/")) return { name: "openai", key: env.OPENAI_API_KEY || env.OPENAI_KEY || null };
  if (m.startsWith("anthropic/")) return { name: "anthropic", key: env.ANTHROPIC_API_KEY || env.ANTHROPIC_KEY || null };
  if (m.startsWith("google/") || m.startsWith("gemini/"))
    return { name: "google", key: env.GEMINI_KEY || env.GEMINI_API_KEY || null };
  if (m.startsWith("kimi/") || m.includes("moonshot"))
    return { name: "kimi", key: env.MOONSHOT_API_KEY || env.KIMI_API_KEY || null };
  // Default to Grok for bare "grok-..." IDs or when no prefix is recognized.
  return { name: "grok", key: env.GROK_API_KEY || null };
}
function gatewayModelId(model) {
  // Cloudflare AI Gateway compat/chat/completions expects the provider model ID without prefix.
  return String(model || "").replace(/^(grok|openai|anthropic|google|gemini|kimi)\//, "");
}
function cfAiText(r) {
  if (!r) return "";
  if (typeof r === "string") return r;
  return (
    r.response ||
    r.result?.response ||
    r.output ||
    r.text ||
    r.choices?.[0]?.message?.content ||
    ""
  );
}
/** xAI responses + gateway compat use mixed usage field names. */
function normalizeModelUsage(usage) {
  const u = usage || {};
  return {
    prompt_tokens:
      u.prompt_tokens ||
      u.input_tokens ||
      u.promptTokenCount ||
      0,
    completion_tokens:
      u.completion_tokens ||
      u.output_tokens ||
      u.candidatesTokenCount ||
      0,
  };
}
async function callModel(env, model, system, user, maxTokens, search) {
  model = String(model || "grok/grok-4.3");
  const mt = Math.max(256, Math.min(8000, Number(maxTokens) || 3500));
  const provider = modelProvider(env, model);
  try {
    if (model.startsWith("@cf/")) {
      if (!env.AI) return { err: "no AI binding" };
      const r = await env.AI.run(model, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: mt,
      });
      const text = cfAiText(r);
      if (!text) return { err: "cf AI empty response", raw: JSON.stringify(r).slice(0, 400) };
      return { text, usage: r?.usage || {} };
    }
    if (provider.name === "google" && provider.key) {
      const mid = gatewayModelId(model) || "gemini-2.5-flash";
      const rs = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${mid}:generateContent?key=${provider.key}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ parts: [{ text: user }] }],
            generationConfig: {
              maxOutputTokens: mt,
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          }),
        },
      );
      const j = await rs.json().catch(() => null);
      if (!rs.ok || !j)
        return {
          err: "gemini HTTP " + rs.status + (j?.error?.message ? ": " + j.error.message : ""),
        };
      const text = (j?.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || "")
        .join("");
      return {
        text,
        usage: {
          prompt_tokens: j?.usageMetadata?.promptTokenCount || 0,
          completion_tokens: j?.usageMetadata?.candidatesTokenCount || 0,
        },
      };
    }
    if (provider.name === "kimi" && provider.key) {
      const mid = gatewayModelId(model) || "moonshot-v1-8k";
      const rs = await fetch("https://api.moonshot.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: "Bearer " + provider.key,
        },
        body: JSON.stringify({
          model: mid,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: mt,
          temperature: 0.3,
        }),
      });
      const j = await rs.json().catch(() => null);
      if (!rs.ok || !j)
        return { err: "moonshot HTTP " + rs.status + (j?.error?.message ? ": " + j.error.message : "") };
      return {
        text: j?.choices?.[0]?.message?.content || "",
        usage: j.usage || {},
      };
    }
    if (provider.name === "grok") {
      if (!provider.key) return { err: "missing GROK_API_KEY" };
      if (search) {
        const rs = await fetch("https://api.x.ai/v1/responses", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: "Bearer " + provider.key,
          },
          body: JSON.stringify({
            model: gatewayModelId(model),
            instructions: system,
            input: user,
            tools: [{ type: "web_search" }, { type: "x_search" }],
          }),
        });
        const jr = await rs.json().catch(() => null);
        if (!rs.ok || !jr) return { err: "xai responses HTTP " + rs.status };
        const msg = (jr.output || []).find((o) => o.type === "message");
        const txt =
          ((msg && msg.content) || []).map((c) => c.text || "").join("") ||
          jr.output_text ||
          "";
        return {
          text: txt,
          usage: normalizeModelUsage(jr.usage),
          citations: jr.citations || [],
          searched: true,
        };
      }
    }
    if (!env.CF_ACCOUNT_ID) return { err: "missing CF_ACCOUNT_ID" };
    const key = provider.key;
    if (!key) return { err: "missing API key for provider " + provider.name };
    const url = `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/cloud-kernel/compat/chat/completions`;
    // The AI Gateway compat (OpenAI-unified) endpoint resolves the provider from a
    // {provider}/{model} model field — do NOT strip the prefix here (the bare id 400s).
    // gatewayModelId() stays correct for the DIRECT provider calls above.
    const body = {
      model: /\//.test(model) ? model : provider.name + "/" + model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: mt,
    };
    if (provider.name === "grok") body.reasoning_effort = "none";
    if (search) {
      // Cloudflare AI Gateway web search is provider-dependent. We send the standard
      // search_parameters shape; the gateway returns a clear error if the provider
      // does not support it, which is better than silently dropping search.
      body.search_parameters = { mode: "on", return_citations: true };
    }
    const gwHeaders = { "content-type": "application/json", Authorization: "Bearer " + key };
    if (env.AIG_TOKEN) gwHeaders["cf-aig-authorization"] = "Bearer " + env.AIG_TOKEN;
    const r = await fetch(url, {
      method: "POST",
      headers: gwHeaders,
      body: JSON.stringify(body),
    });
    const raw = await r.text();
    let j = null;
    try { j = JSON.parse(raw); } catch { /* non-JSON gateway error body */ }
    if (!r.ok || !j)
      return {
        err:
          "gateway HTTP " +
          r.status +
          ": " +
          (j?.error?.message || String(raw).slice(0, 300)),
      };
    return {
      text: j?.choices?.[0]?.message?.content || "",
      usage: normalizeModelUsage(j.usage),
      citations: j.citations || j?.choices?.[0]?.message?.citations || [],
    };
  } catch (e) {
    return { err: String((e && e.message) || e) };
  }
}
function extractArr(t) {
  let s = String(t || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const i = s.indexOf("["),
    j = s.lastIndexOf("]");
  if (i >= 0 && j > i) s = s.slice(i, j + 1);
  return JSON.parse(s);
}
function slugify2(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
function crossPopulateContext(slug, peptideOverride) {
  const parsed = parseCrossSlug(slug);
  if (!parsed.cross) {
    return {
      query: String(peptideOverride || slug.replace(/-/g, " ")).trim(),
      title: null,
      mapping: null,
    };
  }
  const pep = catalogById("peptide", parsed.peptide);
  const tgt = catalogById(parsed.kind, parsed.target);
  const pepName = pep?.name || parsed.peptide;
  const tgtName = tgt?.name || parsed.target.replace(/-/g, " ");
  const query =
    String(peptideOverride || "").trim() ||
    `${pepName} for ${tgtName}`;
  const mapping = computeMapping(parsed.peptide, parsed.target, parsed.kind);
  return {
    query,
    title: `${pepName} × ${tgtName}`,
    mapping: mapping.error ? null : mapping,
  };
}

async function populate(env, b) {
  const slug = slugify2(b.slug || b.peptide || b.name || b.title);
  if (!slug) return { error: "need slug or peptide" };
  const ctx = crossPopulateContext(
    slug,
    b.peptide || b.name || b.title || "",
  );
  const peptide = ctx.query;
  let row = await getRow(env, slug);
  if (!row) {
    const d = await draft(
      env,
      {
        slug,
        title: ctx.title || peptide || slug.replace(/-/g, " "),
        body: "## Overview\nEvidence is being populated by Grok web search.",
        register: b.register || "standard",
        prov: {
          model: "grok-4.3",
          action: "populate-init",
        },
      },
      false,
    );
    if (d.error) return { error: "create failed: " + d.error };
    row = await getRow(env, slug);
    if (ctx.mapping) {
      const meta = { ...parseMeta(row.meta), mapping: ctx.mapping };
      await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
        .bind(JSON.stringify(meta), nowIso(), slug)
        .run();
      row = await getRow(env, slug);
    }
  }
  const maxRounds = Math.max(1, Math.min(Number(b.max_rounds) || 6, 12));
  const start = Date.now();
  const seen = new Set(
    (parseMeta(row.meta).sources || []).map((s) =>
      String(s.url || "").toLowerCase(),
    ),
  );
  const sys =
    'You are an evidence hunter with live web search. Output ONLY a JSON array of sources, each {"type":"pubmed|clinical_trial|review|medical|reddit|x|instagram|youtube|news|business|anecdotal|other","url":"real working url","title":"...","quote":"exact passage from the page","summary":"what it says","claim_ids":[]}. Use real URLs only, never invented. Return [] only when you genuinely cannot find any NEW credible source.';
  let added = 0,
    rounds = 0,
    done = false;
  let popTokensIn = 0,
    popTokensOut = 0;
  const focus = String(b.focus || "all").toLowerCase();
  let anecdoteRoundDone = focus === "anecdote" || focus === "reddit_x";
  while (rounds < maxRounds && Date.now() - start < 78000) {
    rounds++;
    const have = [...seen].slice(-80).join("\n");
    const wantAnecdote =
      focus === "anecdote" ||
      (!anecdoteRoundDone &&
        rounds >= maxRounds - 1 &&
        focus !== "science" &&
        focus !== "reddit_x");
    let user;
    if (focus === "reddit_x") {
      user =
        'Harvest NEW Reddit threads, Reddit comments, X/Twitter posts, and X replies about "' +
        (peptide || slug) +
        '". Search site:reddit.com and site:x.com / twitter. Include thread titles AND individual comment text. ' +
        "Include good and bad outcomes, side effects, dosing anecdotes (label as anecdotal, not advice). " +
        'Label type as reddit or x. Quote exact comment passages. Minimum 5 sources if any exist. ' +
        "Do NOT repeat URLs already collected:\n" +
        (have || "(none yet)") +
        "\nReturn ONLY the JSON array; [] if nothing new.";
    } else if (wantAnecdote || focus === "anecdote") {
      anecdoteRoundDone = true;
      user =
        'Harvest NEW user-reported experiences about "' +
        (peptide || slug) +
        '" \u2014 Reddit, X, YouTube, forums, comments. Include GOOD and BAD outcomes. ' +
        "Label type as reddit|x|youtube|anecdotal. Quote exact passages. Do NOT repeat URLs already collected:\n" +
        (have || "(none yet)") +
        "\nReturn ONLY the JSON array; [] if nothing new.";
    } else if (focus === "science") {
      user =
        'Find NEW scientific evidence about "' +
        (peptide || slug) +
        '" \u2014 PubMed, clinical trials, reviews, medical sources only. Do NOT repeat URLs:\n' +
        (have || "(none yet)") +
        "\nReturn ONLY the JSON array; [] if nothing new.";
    } else {
      user =
        'Find NEW evidence about the peptide "' +
        (peptide || slug) +
        '" \u2014 PubMed, clinical trials, reviews, medical sources, and also reddit/x/youtube/forum anecdote (label the type). Do NOT repeat any URL already collected:\n' +
        (have || "(none yet)") +
        "\nReturn ONLY the JSON array; [] if nothing new.";
    }
    const r = await callModel(env, "grok-4.3", sys, user, 3500, true);
    popTokensIn += Number(r.usage?.prompt_tokens || 0);
    popTokensOut += Number(r.usage?.completion_tokens || 0);
    if (r.err) {
      done = true;
      break;
    }
    let arr = [];
    try {
      arr = extractArr(r.text);
    } catch {
      arr = [];
    }
    const fresh = (Array.isArray(arr) ? arr : []).filter(
      (x) => x && x.url && !seen.has(String(x.url).toLowerCase()),
    );
    if (!fresh.length) {
      done = true;
      break;
    }
    fresh.forEach((x) => seen.add(String(x.url).toLowerCase()));
    await sources(env, {
      slug,
      sources: fresh,
      model: "grok-4.3",
      rationale: "auto-populate round " + rounds,
    });
    added += fresh.length;
  }
  const afterRow = await getRow(env, slug);
  const afterMeta = parseMeta(afterRow.meta);
  if (popTokensIn || popTokensOut) {
    await addContribution(afterMeta, {
      model: "grok/grok-4.3",
      role: "source_hunt",
      action: "populate",
      payload: { rounds, added, focus },
      rationale: "Grok web-search populate pass",
      tokens_in: popTokensIn,
      tokens_out: popTokensOut,
    });
    await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
      .bind(JSON.stringify(afterMeta), nowIso(), slug)
      .run();
  }
  const repaired = repairLedgerMeta(afterMeta, {
    slug,
    title: afterRow.title,
    materialize_orphans: b.materialize_orphans !== false,
    retier_claims: true,
    channel: "populate-repair",
    default_actor: "grok-4.3-populate",
  });
  let prev = "genesis";
  for (const s of repaired.meta.sources) {
    s.prev = prev;
    s.hash = await sha256(srcBody(s));
    prev = s.hash;
  }
  repaired.meta.source_head = repaired.meta.sources.length
    ? repaired.meta.sources[repaired.meta.sources.length - 1].hash
    : "genesis";
  await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
    .bind(JSON.stringify(repaired.meta), nowIso(), slug)
    .run();
  const finalSources = (repaired.meta.sources || []).length;
  const phaseExhausted = added === 0 && rounds >= 1;
  if (phaseExhausted) done = true;
  const { nextPopulateFocus } = await import("../../_lib/pipeline_chain.js");
  return {
    ok: true,
    slug,
    peptide: peptide || slug,
    focus,
    rounds,
    added,
    total_sources: finalSources,
    materialized_claims: repaired.materialized.length,
    ledger_health: repaired.health,
    done,
    more: !done,
    phase_exhausted: phaseExhausted,
    next_focus: phaseExhausted ? nextPopulateFocus(focus) : null,
    url: "https://miscsubjects.com/a/" + slug,
    model: "grok/grok-4.3",
    tokens_in: popTokensIn,
    tokens_out: popTokensOut,
  };
}
async function repair(env, b) {
  const slug = slugify(b.slug);
  const row = await getRow(env, slug);
  if (!row) return { error: "article not found: " + slug };
  const prevMeta = parseMeta(row.meta);
  const meta = Object.assign({}, prevMeta);
  await pushRevision(env, meta, row, prevMeta);
  const before = auditLedgerHealth(prevMeta, slug);
  const repaired = repairLedgerMeta(meta, {
    slug,
    title: row.title,
    materialize_orphans: b.materialize_orphans === true,
    retier_claims: b.retier_claims !== false,
    backfill_posted_by: b.backfill_posted_by !== false,
    normalize_provenance: b.normalize_provenance === true,
    anchor_source: b.anchor_source ? String(b.anchor_source) : null,
    channel: b.channel || "protocol/repair",
    default_actor: b.model || "system/repair",
  });
  if (b.compact_ledger !== false) {
    const compacted = compactLedgerMeta(repaired.meta, {
      collapse_marketing: b.collapse_marketing !== false,
      dedupe_text: b.dedupe_text !== false,
    });
    repaired.meta = compacted.meta;
    repaired.compact_stats = compacted.stats;
  }
  let prev = "genesis";
  for (const s of repaired.meta.sources) {
    s.prev = prev;
    s.hash = await sha256(srcBody(s));
    prev = s.hash;
  }
  repaired.meta.source_head = repaired.meta.sources.length
    ? repaired.meta.sources[repaired.meta.sources.length - 1].hash
    : "genesis";
  await addProv(repaired.meta, {
    model: b.model || "repair",
    action: "repair",
    input: slug,
    response: JSON.stringify({
      materialized: repaired.materialized.length,
      before: before.issues,
      after: repaired.health.issues,
      focus_stats: repaired.focus_stats,
    }).slice(0, 2000),
  });
  await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
    .bind(JSON.stringify(repaired.meta), nowIso(), slug)
    .run();
  return attachSelf(
    {
      ok: true,
      slug,
      before,
      after: repaired.health,
      focus_stats: repaired.focus_stats,
      focus_audit: repaired.focus_audit,
      materialized: repaired.materialized,
      claims: repaired.meta.claims.length,
      sources: repaired.meta.sources.length,
      url: "https://miscsubjects.com/a/" + slug,
      voxels_url: "/api/articles/" + slug + "/voxels",
    },
    "ledger_repair",
    { slug, contains: "ledger repair report — tier hygiene + source_role focus" },
  );
}
async function fillSlots(env, b) {
  const slug = slugify(b.slug);
  const row = await getRow(env, slug);
  if (!row) return { error: "article not found: " + slug };
  const meta = parseMeta(row.meta);
  const { to_add, check } = buildConstitutionSlotClaims(meta, {
    slug,
    title: row.title,
  });
  if (!to_add.length) {
    return attachSelf(
      {
        ok: true,
        slug,
        message: "constitution slots already complete",
        constitution: check,
        health: auditLedgerHealth(meta, slug),
      },
      "constitution_fill",
      { slug },
    );
  }
  const added = [];
  for (const cl of to_add) {
    const r = await claim(env, {
      slug,
      text: cl.text,
      tier: cl.tier,
      slot: cl.slot,
      section: cl.section,
      source_ids: cl.source_ids,
      who_claims: cl.who_claims,
      why_material: cl.why_material,
      model: b.model || "fill-slots",
      channel: "protocol/fill-slots",
    });
    if (r.error) {
      return {
        error: r.error,
        slug,
        partial: added,
        attempted: cl.slot,
      };
    }
    added.push({ slot: cl.slot, claim_id: r.claim_id });
  }
  const fresh = parseMeta((await getRow(env, slug)).meta);
  const health = auditLedgerHealth(fresh, slug);
  return attachSelf(
    {
      ok: true,
      slug,
      added,
      constitution: checkConstitutionSlots(fresh.claims),
      health,
      url: "https://miscsubjects.com/a/" + slug,
    },
    "constitution_fill",
    {
      slug,
      contains: "constitution slot claims synthesized from ledger topology",
    },
  );
}
async function retract(env, b) {
  const slug = slugify(b.slug);
  const claim_id = String(b.claim_id || b.claimId || "").trim();
  if (!claim_id) return { error: "claim_id required" };
  const row = await getRow(env, slug);
  if (!row) return { error: "article not found: " + slug };
  const prevMeta = parseMeta(row.meta);
  const meta = Object.assign({}, prevMeta);
  await pushRevision(env, meta, row, prevMeta);
  const out = retractClaimInMeta(meta, claim_id, {
    reason: b.reason || b.rationale,
    by: b.by || b.actor || b.model || "operator",
    channel: b.channel || "protocol/retract",
  });
  if (out.error) return out;
  await addProv(out.meta, {
    model: b.model || "retract",
    action: "retract",
    input: slug + " " + claim_id,
    response: String(out.retraction.reason || "").slice(0, 2000),
  });
  await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
    .bind(JSON.stringify(out.meta), nowIso(), slug)
    .run();
  return attachSelf(
    {
      ok: true,
      slug,
      claim_id,
      retraction: out.retraction,
      honesty: honestySummary(out.meta),
      note: "Claim stays on ledger with status:retracted — excluded from ask topology.",
    },
    "ledger_retract",
    { slug },
  );
}
async function challenge(env, b) {
  const slug = slugify(b.slug);
  const target_claim_id = String(
    b.target_claim_id || b.claim_id || "",
  ).trim();
  const text = String(b.text || b.challenge || "").trim();
  if (!target_claim_id || !text)
    return { error: "target_claim_id and text required" };
  const row = await getRow(env, slug);
  if (!row) return { error: "article not found: " + slug };
  const prevMeta = parseMeta(row.meta);
  const meta = Object.assign({}, prevMeta);
  await pushRevision(env, meta, row, prevMeta);
  const out = challengeClaimInMeta(
    meta,
    target_claim_id,
    {
      text,
      tier: b.tier,
      source_ids: b.source_ids,
      who_claims: b.who_claims,
      why_material: b.why_material,
      downweight: b.downweight,
    },
    {
      actor: b.actor || b.model || "adversary",
      model: b.model,
      channel: b.channel || "protocol/challenge",
    },
  );
  if (out.error) return out;
  // HIDDEN-PREMISE DEMOTION — the defense of the `entailed` edge. A challenger points at
  // an entailment and says "that has an unstated premise; it does not follow deductively."
  // If the target is standing=entailed, its standing DEMOTES to consistent_unproven (pattern
  // fit) or asserted_at_volume (crowd belief) — the challenger's call. The demotion is itself
  // a receipted node on the ledger; nothing is deleted, the insinuation is reclassified.
  let demotion = null;
  const wantsDemote = b.hidden_premise === true || String(b.demote_to || "").length > 0;
  if (wantsDemote) {
    const tgt = (out.meta.claims || []).find((c) => String(c.id) === target_claim_id);
    if (!tgt) return { error: "target claim vanished during demotion: " + target_claim_id, status: 500 };
    if (tgt.standing !== "entailed") {
      return {
        error: "not_an_entailment",
        status: 409,
        target_standing: tgt.standing || null,
        note: "hidden_premise demotion only applies to a claim with standing=entailed. This claim is not filed as a deduction, so there is no entailment edge to break.",
      };
    }
    const demoteTo = STANDING_DEMOTE.has(String(b.demote_to || "").toLowerCase())
      ? String(b.demote_to).toLowerCase()
      : "consistent_unproven";
    tgt.standing_demoted_from = "entailed";
    tgt.standing = demoteTo;
    // The named premises no longer entail this conclusion — sever the reciprocal edge.
    const wasPremises = Array.isArray(tgt.premise_ids) ? tgt.premise_ids.slice() : [];
    for (const pid of wasPremises) {
      const p = (out.meta.claims || []).find((c) => String(c.id) === pid);
      if (p && Array.isArray(p.entails)) p.entails = p.entails.filter((x) => x !== target_claim_id);
    }
    tgt.demoted_premise_ids = wasPremises;
    delete tgt.premise_ids;
    out.meta.standing_demotions = Array.isArray(out.meta.standing_demotions) ? out.meta.standing_demotions : [];
    demotion = {
      id: "dem_" + out.meta.standing_demotions.length,
      ts: nowIso(),
      target_claim_id,
      challenge_claim_id: out.challenge_claim_id,
      from: "entailed",
      to: demoteTo,
      severed_premise_ids: wasPremises,
      by: b.actor || b.model || "adversary",
      reason: text.slice(0, 300),
    };
    out.meta.standing_demotions.push(demotion);
  }
  const wired = wireClaimSourceGraph(out.meta.claims, out.meta.sources || []);
  out.meta.claims = wired.claims;
  out.meta.sources = wired.sources;
  await addProv(out.meta, {
    model: b.model || "challenge",
    action: demotion ? "challenge_hidden_premise" : "challenge",
    input: target_claim_id,
    response: text.slice(0, 2000),
  });
  await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
    .bind(JSON.stringify(out.meta), nowIso(), slug)
    .run();
  return attachSelf(
    {
      ok: true,
      slug,
      target_claim_id: out.target_claim_id,
      challenge_claim_id: out.challenge_claim_id,
      ...(demotion ? { demotion, note: "entailment demoted: " + demotion.from + " → " + demotion.to + " (hidden premise). Recorded as a receipted node; nothing deleted." } : {}),
      honesty: honestySummary(out.meta),
    },
    "ledger_challenge",
    { slug },
  );
}
async function scrub(env, b) {
  const slug = slugify(b.slug);
  const row = await getRow(env, slug);
  if (!row) return { error: "article not found: " + slug };
  const prevMeta = parseMeta(row.meta);
  const meta = Object.assign({}, prevMeta);
  await pushRevision(env, meta, row, prevMeta);
  const dry = b.dry_run === true;
  const out = scrubArticleContent(meta, row.body || "", {
    actor: b.actor || b.model || "scrub",
    channel: b.channel || "protocol/scrub",
  });
  if (dry) {
    return attachSelf(
      {
        ok: true,
        slug,
        dry_run: true,
        would_scrub: out.scrubbed,
        total_hits: out.total_hits,
        fields: out.fields,
        preview_secrets: detectSecrets(
          JSON.stringify(meta) + (row.body || ""),
        ).map((h) => ({ type: h.type, fingerprint: h.fingerprint })),
      },
      "ledger_scrub",
      { slug },
    );
  }
  if (!out.scrubbed) {
    return attachSelf(
      { ok: true, slug, scrubbed: false, message: "no secrets detected" },
      "ledger_scrub",
      { slug },
    );
  }
  let prev = "genesis";
  for (const s of out.meta.sources || []) {
    s.prev = prev;
    s.hash = await sha256(srcBody(s));
    prev = s.hash;
  }
  if (out.meta.sources?.length) {
    out.meta.source_head = out.meta.sources[out.meta.sources.length - 1].hash;
  }
  await addProv(out.meta, {
    model: b.model || "scrub",
    action: "scrub",
    input: slug,
    response: JSON.stringify(out.scrub_event).slice(0, 2000),
  });
  await env.DB.prepare(
    "UPDATE articles SET meta=?, body=?, updated_at=? WHERE slug=?",
  )
    .bind(JSON.stringify(out.meta), out.body, nowIso(), slug)
    .run();
  return attachSelf(
    {
      ok: true,
      slug,
      scrubbed: true,
      total_hits: out.total_hits,
      fields: out.fields,
      scrub_event: out.scrub_event,
      honesty: honestySummary(out.meta),
      note: "Secrets replaced with [REDACTED:secret-leak]; scrub_events tombstone retained.",
    },
    "ledger_scrub",
    { slug },
  );
}
async function write(env, b) {
  const model = String(b.model || "grok/grok-4.3");
  const ask = String(b.ask || b.input || "").trim();
  const ws = b.web_search === true || b.web_search === "on";
  const slugEarly = slugify(b.slug || "");
  if (!b.force_write && slugEarly) {
    const existing = await getRow(env, slugEarly);
    if (existing) {
      const { articleIsEnriched } = await import("../../_lib/writer_queue_roles.js");
      const meta = parseMeta(existing.meta);
      if (articleIsEnriched(meta)) {
        return {
          ok: true,
          skipped: true,
          slug: slugEarly,
          reason:
            "article already has a populated ledger — use populate/repair/collaborate; pass force_write:true to replace",
          counts: {
            claims: (meta.claims || []).length,
            sources: (meta.sources || []).length,
          },
          url: "https://miscsubjects.com/a/" + slugEarly,
        };
      }
    }
  }
  if (b.mode === "outline") {
    const osys =
      String(b.system_prompt || "You are a rigorous, neutral medical writer.") +
      "\nOutput ONLY a markdown outline (## sections, - bullets). No prose, no preamble.";
    const items =
      Array.isArray(b.items) && b.items.length
        ? b.items.slice(0, 8)
        : [ask || b.title];
    const outlines = [];
    for (const it of items) {
      const r = await callModel(
        env,
        model,
        osys,
        "Outline an evidence-graded article on: " + String(it),
        Math.min(b.max_tokens || 1200, 1500),
        ws,
      );
      outlines.push({
        item: String(it),
        outline: r.err ? "ERR:" + r.err : r.text,
        citations: r.citations || [],
      });
    }
    return {
      ok: true,
      mode: "outline",
      model,
      web_search: ws,
      count: outlines.length,
      outlines,
    };
  }
  if (!ask && !b.title)
    return { error: "need an ask/input (what to write about) or a title" };
  const reg = b.register || "standard";
  const slugForMode = slugEarly || slugify(b.slug || "");
  const writeMode = slugForMode
    ? classifyArticleMode(slugForMode, b.title || "", {})
    : "article";
  const sys =
    OIP_PLAIN_ENGLISH_LAW + "\n\n" +
    String(b.system_prompt || proseWriterForMode(writeMode)) +
    "\n\nFor the JSON body field: write 1,200+ words of clear plain English (## headings). No journal tone. Teach everything. Claims array stays atomic; body is the readable article.\n\n" +
    "OUTPUT FORMAT \u2014 output ONLY one JSON object, no prose, no markdown fence:\n" +
    '{"slug":"kebab-case","title":"...","body":"markdown with ## headings","register":"' +
    reg +
    '",' +
    '"claims":[{"id":"c1","text":"one assertion","section":"...","tier":"human|preclinical|anecdotal|mechanistic|speculative","source_ids":["s1"],"source_status":"unsourced if no source","why_material":"..."}],' +
    '"sources":[{"id":"s1","type":"pubmed|clinical_trial|review|medical|reddit|x|instagram|youtube|news|business|anecdotal|other","url":"https://real-url","title":"...","quote":"exact passage from the page","summary":"...","claim_ids":["c1"]}]}\n' +
    "Tier every claim. Where there is no human data, say so plainly. Link only URLs you can verify exist; never invent a URL or quote.";
  let user = ask || "Write the article for: " + b.title;
  if (slugForMode && usesEnrichmentVoice(writeMode)) {
    const brief = enrichmentBrief(slugForMode, b.title || "", {});
    user +=
      "\n\nENRICHMENT BRIEF (binding section logic — one ## per compound):\n" +
      JSON.stringify(brief).slice(0, 12000);
  }
  const { text, usage, err, citations } = await callModel(
    env,
    model,
    sys,
    user,
    b.max_tokens,
    ws,
  );
  if (err) return { error: "model call failed: " + err };
  const tok = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
  if (b.publish === false) {
    let parsed = null;
    try {
      parsed = extractJson(text);
    } catch {}
    return {
      ok: true,
      mode: "ideas",
      model,
      tokens: tok,
      web_search: ws,
      citations: citations || [],
      output: parsed || String(text),
    };
  }
  let parsed;
  try {
    parsed = extractJson(text);
  } catch (e) {
    return {
      error: "model did not return valid JSON: " + e.message,
      raw_preview: String(text).slice(0, 700),
    };
  }
  const draftBody = {
    slug: b.slug || parsed.slug || parsed.title,
    title: parsed.title || b.title || "",
    body: parsed.body || "",
    register: parsed.register || reg,
    tags: parsed.tags || b.tags,
    home: parsed.home,
    model,
    claims: Array.isArray(parsed.claims) ? parsed.claims : [],
    sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    prov: {
      model,
      action: "write",
      prompt: String(b.system_prompt || "").slice(0, 2000),
      input: user.slice(0, 2000),
      response: String(text).slice(0, 2000),
      tokens_in: usage.prompt_tokens || 0,
      tokens_out: usage.completion_tokens || 0,
    },
  };
  const res = await draft(env, draftBody, b.verify_sources !== false);
  const slugOut = slugify(draftBody.slug || b.slug || parsed.slug || "");
  return {
    ok: !res.error,
    slug: slugOut || undefined,
    model,
    tokens_in: usage.prompt_tokens || 0,
    tokens_out: usage.completion_tokens || 0,
    generated: {
      title: draftBody.title,
      claims: draftBody.claims.length,
      sources: draftBody.sources.length,
    },
    draft: res,
    prov: draftBody.prov,
    raw_preview: String(text).slice(0, 300),
  };
}
// ATOMIZE — bring an existing article into the claims+sources JSON schema WITHOUT touching
// its body. The schema-variance repair pass: philosophy, OIP, and health content all run on
// the same rules (atomized claims with tiers, hash-chained sources, provenance). Never a
// rewrite: the body is read-only input; only meta.claims / meta.sources / provenance change.
// ── VOXEL DIV PLANE (owner order 2026-07-16) ────────────────────────────────────
// The article body divides into ordered, hashed DIVs (meta.divs). Each DIV carries its
// own SHA-256 content hash and an append-only provenance chain. Four verbs mutate the
// structure: voxel-divide, voxel-edit, voxel-move, voxel-consolidate. All four accept
// the owner (x-terminal-key / admin cookie) OR a share token — the same token the owner
// hands to a model — with scope act, or rows:/pfx: covering VOXEL_<VERB>. After every
// mutation the body is regenerated from the ordered DIVs: the content IS the DIV list.
const VOXEL_CORPUS_RE = /^(grain-|udst-|systems-design-|unified-philosophy-|convergence-encyclopedia-|oip-(axiom|convergence|disconfirming|v2|v3|pattern|sog|invariant|node|catalogue|appendix)-|oip-c07-feedback-cybernetics$)/;

// explicitScope (owner ship-order 2026-07-16, W11/1d): content-mutating voxel verbs REFUSE
// generic act tokens — the published drop promises the general key edits no existing content,
// and the promise must be true. Mutation needs a key minted with rows:/pfx: covering the verb.
async function voxelAuth(request, env, b, verbKey, explicitScope) {
  if (await isBuildAuthed(request, env)) return { ok: true, actor: "owner" };
  let raw = String(b.key || b.share || "").trim();
  if (!raw) {
    const h = request.headers.get("authorization") || "";
    if (/^bearer\s+/i.test(h)) raw = h.replace(/^bearer\s+/i, "").trim();
  }
  if (!raw) {
    try { raw = new URL(request.url).searchParams.get("share") || new URL(request.url).searchParams.get("key") || ""; } catch {}
  }
  if (!raw) return { ok: false, error: "unauthorized: send the share token as body {\"key\":...}, header Authorization: Bearer <token>, or ?share=" };
  const t = await verifyShareTokenValue(env, raw);
  if (!t) return { ok: false, error: "unauthorized: token invalid or expired" };
  if (t.scope === "read") return { ok: false, error: "forbidden: read-scope token cannot mutate DIVs — needs a key scoped to " + verbKey };
  // Workspace-pool credentials: resolve the role's declared rows from the workspace object,
  // then hold the mutation inside the workspace's own object set. A pool grant of VOXEL_EDIT
  // is narrower than rows:VOXEL_EDIT — it edits the pool's work and nothing else.
  if (t.scope === "pool") {
    await resolvePoolToken(env, t);
    const slugArg = slugify(b.slug);
    if (slugArg && !(Array.isArray(t.poolObjects) && t.poolObjects.includes(slugArg))) {
      return { ok: false, error: "pool_object_boundary: this workspace credential is bounded to workspace \"" + (t.pool?.workspace || "?") + "\" and its object set; " + slugArg + " is outside it" };
    }
  }
  if (explicitScope) {
    if (!tokenAllowsKey(t, verbKey) || t.scope === "act") {
      return {
        ok: false,
        error: "forbidden: content mutation requires an EXPLICITLY voxel-scoped key — a general act key does not edit existing content (the published drop promises this). Ask the owner for a key minted with scope=rows:" + verbKey + " (or pfx:VOXEL_).",
      };
    }
  } else if (t.scope !== "act" && !tokenAllowsKey(t, verbKey)) {
    return { ok: false, error: "forbidden: token scope does not cover " + verbKey };
  }
  const fp = t.fingerprint || await capFingerprint(raw);
  const cap = await getCapabilityByFingerprint(env, fp);
  if (cap) {
    if (cap.audience) return { ok: false, error: "audience_bound: this capability is bound to " + cap.audience + " and only runs through the federation inbox" };
    const chain = await capabilityChainStatus(env, cap);
    if (!chain.ok) return { ok: false, error: "capability_" + chain.reason };
  }
  if (!(await consumeShareUse(env, t.nonce, t.maxUses))) {
    return { ok: false, error: "uses_exhausted: token has no remaining uses" };
  }
  return { ok: true, actor: "cap:" + fp, fingerprint: fp };
}

// Link contract (W17 §1): every successful voxel write returns a clickable human permalink.
function voxelLink(slug, discId) {
  return {
    link: "https://miscsubjects.com/i/discourse/" + discId,
    article_link: "https://miscsubjects.com/a/" + slug + "#disc-" + discId,
    say_to_user: "Filed and live. Here is the widget link: https://miscsubjects.com/i/discourse/" + discId,
  };
}

async function voxelFreezeCheck(env, slug) {
  if (!VOXEL_CORPUS_RE.test(slug)) return null;
  const frozen = await env.KV.get("corpus_freeze");
  if (frozen === "1") {
    return { error: "corpus_freeze: canonical corpus pages are write-locked by the owner. DIV mutations are rejected while the freeze is on (owner lifts with KV corpus_freeze=0)." };
  }
  return null;
}

async function voxelSaveArticle(env, slug, meta, body, expected = {}) {
  const metaJson = JSON.stringify(meta);
  let result;
  if (body != null) {
    result = await env.DB.prepare(
      "UPDATE articles SET body=?, meta=?, updated_at=? WHERE slug=? AND COALESCE(meta,'')=COALESCE(?,'') AND COALESCE(body,'')=COALESCE(?,'')",
    ).bind(body, metaJson, nowIso(), slug, expected.meta ?? null, expected.body ?? null).run();
  } else {
    result = await env.DB.prepare(
      "UPDATE articles SET meta=?, updated_at=? WHERE slug=? AND COALESCE(meta,'')=COALESCE(?,'')",
    ).bind(metaJson, nowIso(), slug, expected.meta ?? null).run();
  }
  const saved = Number(result?.meta?.changes || 0) === 1;
  // Every voxel write verb saves through here, so this is the one place the page cache is
  // made honest: without it a plain GET of /a/<slug> kept serving the pre-edit page for the
  // full edge TTL while D1 held the new text (reproduced live on /a/philosophy, 2026-08-08).
  if (saved) await purgeArticlePageCache(env, slug);
  return saved;
}

function voxelDivView(d) {
  return {
    id: d.id, kind: d.kind, order: d.order, status: d.status || "active",
    vx_hash: d.vx_hash, chain_head: d.chain_head,
    chain_length: Array.isArray(d.chain) ? d.chain.length : 0,
    text: d.text,
  };
}

async function claimAsDiv(claim) {
  const id = claimDivId(claim.id);
  const chain = Array.isArray(claim.chain) ? claim.chain : [];
  return {
    id,
    kind: "claim",
    text: String(claim.text || ""),
    status: claim.status || "active",
    chain,
    chain_head: claim.chain_head || (chain.length ? chain[chain.length - 1].hash : "genesis"),
    vx_hash: await vxContentHash(id, claim.text || ""),
    consolidated_into: claim.consolidated_into || null,
  };
}

function applyClaimDiv(claim, div) {
  claim.text = div.text;
  claim.status = div.status || "active";
  claim.chain = div.chain || [];
  claim.chain_head = div.chain_head;
  claim.vx_hash = div.vx_hash;
  if (div.consolidated_into) claim.consolidated_into = div.consolidated_into;
}

async function voxelDivideAction(env, request, b) {
  const slug = slugify(b.slug);
  if (!slug) return { error: "slug required" };
  const auth = await voxelAuth(request, env, b, "VOXEL_DIVIDE", true);
  if (!auth.ok) return { error: auth.error, status: 401 };
  const a = await getRow(env, slug);
  if (!a) return { error: "not found: " + slug, status: 404 };
  const meta = parseMeta(a.meta);
  if (meta.voxel && meta.voxel.mode === "div" && Array.isArray(meta.divs) && meta.divs.length && b.force !== true) {
    return {
      ok: true, slug, already_divided: true, divs: meta.divs.length,
      note: "already in DIV mode — pass force:true to re-divide from the current body (resets chains)",
      voxels_url: "/api/articles/" + slug + "/voxels",
    };
  }
  if (b.force === true && auth.actor !== "owner") {
    return { error: "forbidden: only the owner may force re-divide an existing article because it resets DIV identities and chains", status: 403 };
  }
  const out = await vxDivide(String(a.body || ""), meta.claims || [], auth.actor);
  if (out.error) return { error: out.error, status: 422 };
  meta.divs = out.divs;
  meta.voxel = {
    mode: "div",
    divided_at: nowIso(),
    divided_by: auth.actor,
    original_body_sha: await vxSha256(String(a.body || "")),
    atoms: out.divs.length,
    version: 1,
  };
  await addProv(meta, {
    model: auth.actor, action: "voxel_divide",
    input: slug, response: out.divs.length + " DIVs from body (verbatim, roundtrip-checked)",
  });
  if (!(await voxelSaveArticle(env, slug, meta, null, { meta: a.meta }))) {
    return { error: "article_moved", status: 409, note: "the article changed while it was being divided; re-read and retry" };
  }
  return {
    ok: true, slug, divided: true, divs: out.divs.length,
    original_body_sha: meta.voxel.original_body_sha,
    div_index: out.divs.map((d) => ({ id: d.id, order: d.order, kind: d.kind, vx_hash: d.vx_hash, text_head: d.text.slice(0, 80) })),
    procedure: vxProcedure(slug),
    voxels_url: "/api/articles/" + slug + "/voxels",
    human_side: "https://miscsubjects.com/a/" + slug,
  };
}

async function voxelEditAction(env, request, b) {
  const slug = slugify(b.slug);
  if (!slug) return { error: "slug required" };
  const auth = await voxelAuth(request, env, b, "VOXEL_EDIT", true);
  if (!auth.ok) return { error: auth.error, status: 401 };
  const frozen = await voxelFreezeCheck(env, slug);
  if (frozen) return { ...frozen, status: 423 };
  const a = await getRow(env, slug);
  if (!a) return { error: "not found: " + slug, status: 404 };
  const meta = parseMeta(a.meta);
  const requestedClaimId = claimIdFromDivId(b.div_id);
  if (requestedClaimId) {
    const claims = Array.isArray(meta.claims) ? meta.claims : [];
    const claim = claims.find((item) => String(item.id) === requestedClaimId);
    if (!claim) return { error: "unknown claim DIV: " + String(b.div_id), status: 404 };
    const div = await claimAsDiv(claim);
    if ((div.status || "active") !== "active") return { error: "claim DIV " + div.id + " is " + div.status, status: 409 };
    const expected = String(b.expected_hash || "").trim();
    if (!expected) return { error: "expected_hash required — read /api/articles/" + slug + "/claims/" + requestedClaimId, status: 400 };
    if (expected !== div.vx_hash) return { error: "hash_stale", status: 409, div_id: div.id, current_hash: div.vx_hash, current_text: div.text };
    const text = String(b.text || "").trim();
    if (!text) return { error: "text required — the replacement claim" };
    const plantedEdit = plantedContentViolation(text, b.rationale);
    if (plantedEdit) {
      return { error: "planted_content_refused", status: 422, matched: plantedEdit, note: PLANTED_REFUSAL };
    }
    const before = div.text;
    div.text = text;
    const claimed = String(b.actor || "").slice(0, 120) || null;
    const entry = await vxChainAppend(div, "edit", auth.actor, {
      before_sha: await vxSha256(before), after_sha: await vxSha256(text), claimed_model: claimed,
      rationale: String(b.rationale || "").slice(0, 500),
    });
    applyClaimDiv(claim, div);
    meta.claims = claims;
    await addProv(meta, { model: auth.actor, action: "claim_div_edit", input: slug + " " + div.id, response: text.slice(0, 2000) });
    if (!(await voxelSaveArticle(env, slug, meta, null, { meta: a.meta }))) {
      return { error: "hash_stale", status: 409, note: "the article changed concurrently; re-read the claim hash and retry" };
    }
    const discId = "vx-" + entry.hash.slice(0, 12);
    await recordDiscourse(env, { id: discId, slug, target_div: div.id, stance: "edit", claimed_model: claimed, actor_cap: auth.actor, body: "edited " + div.id + ": " + text.slice(0, 500), status: "landed" });
    return {
      ok: true, slug, claim: { ...voxelDivView(div), claim_id: requestedClaimId }, chain_entry: entry,
      actor: auth.actor, claimed_model: claimed, before_text: before,
      item_link: "https://miscsubjects.com/i/claim/" + slug + "/" + requestedClaimId,
      ...voxelLink(slug, discId),
      verify: "/api/articles/" + slug + "/claims/" + requestedClaimId,
    };
  }
  const divs = Array.isArray(meta.divs) ? meta.divs : [];
  if (!(meta.voxel && meta.voxel.mode === "div") || !divs.length) {
    return { error: "not in DIV mode — POST /api/protocol/voxel-divide {\"slug\":\"" + slug + "\"} first", status: 409 };
  }
  const div = divs.find((d) => d.id === String(b.div_id));
  if (!div) return { error: "unknown div_id: " + String(b.div_id), status: 404 };
  if ((div.status || "active") !== "active") return { error: "div " + div.id + " is " + div.status + " — only active DIVs are editable", status: 409 };
  // CAS (C30): the writer must prove it read the current version. Stale → educate, write nothing.
  const expected = String(b.expected_hash || "").trim();
  if (!expected) return { error: "expected_hash required — the div's CURRENT vx_hash (read it at /api/articles/" + slug + "/voxels). This proves you read what you are editing.", status: 400 };
  if (expected !== div.vx_hash) {
    return {
      error: "hash_stale", status: 409,
      note: "the DIV changed since you read it — re-read, then retry with the current hash",
      div_id: div.id, current_hash: div.vx_hash, current_text: div.text,
      chain_length: Array.isArray(div.chain) ? div.chain.length : 0,
      diff_hint: "your expected_hash " + expected.slice(0, 12) + "… vs current " + String(div.vx_hash).slice(0, 12) + "…",
    };
  }
  const text = String(b.text || "").trim();
  if (!text) return { error: "text required — the DIV's replacement text (verbatim, markdown allowed)" };
  const plantedDiv = plantedContentViolation(text, b.rationale);
  if (plantedDiv) {
    return { error: "planted_content_refused", status: 422, matched: plantedDiv, note: PLANTED_REFUSAL };
  }
  const beforeSha = await vxSha256(div.text);
  const before = div.text;
  div.text = text;
  // Actor = capability fingerprint (server-derived); the self-typed model name is display metadata only.
  const entry = await vxChainAppend(div, "edit", auth.actor, {
    before_sha: beforeSha,
    after_sha: await vxSha256(text),
    claimed_model: String(b.actor || "").slice(0, 120) || null,
    rationale: String(b.rationale || "").slice(0, 500),
  });
  const body = vxBodyFromDivs(divs);
  meta.divs = divs;
  await addProv(meta, {
    model: auth.actor, action: "voxel_edit",
    input: slug + " " + div.id, response: text.slice(0, 2000),
  });
  if (!(await voxelSaveArticle(env, slug, meta, body, { meta: a.meta, body: a.body }))) {
    return { error: "hash_stale", status: 409, note: "the article changed concurrently; re-read the DIV hash and retry" };
  }
  const discId = "vx-" + entry.hash.slice(0, 12);
  await recordDiscourse(env, {
    id: discId, slug, target_div: div.id, stance: "edit",
    claimed_model: String(b.actor || "").slice(0, 120) || null, actor_cap: auth.actor,
    body: "edited " + div.id + ": " + text.slice(0, 500), status: "landed",
  });
  return {
    ok: true, slug, div: voxelDivView(div), chain_entry: entry,
    actor: auth.actor, claimed_model: String(b.actor || "").slice(0, 120) || null,
    before_text: before, body_regenerated: true,
    ...voxelLink(slug, discId),
    verify: "/api/articles/" + slug + "/voxels",
  };
}

async function voxelMoveAction(env, request, b) {
  const slug = slugify(b.slug);
  if (!slug) return { error: "slug required" };
  const auth = await voxelAuth(request, env, b, "VOXEL_MOVE", true);
  if (!auth.ok) return { error: auth.error, status: 401 };
  const frozen = await voxelFreezeCheck(env, slug);
  if (frozen) return { ...frozen, status: 423 };
  const a = await getRow(env, slug);
  if (!a) return { error: "not found: " + slug, status: 404 };
  const meta = parseMeta(a.meta);
  const divs = Array.isArray(meta.divs) ? meta.divs : [];
  if (!(meta.voxel && meta.voxel.mode === "div") || !divs.length) {
    return { error: "not in DIV mode — POST /api/protocol/voxel-divide {\"slug\":\"" + slug + "\"} first", status: 409 };
  }
  const div = divs.find((d) => d.id === String(b.div_id));
  if (!div) return { error: "unknown div_id: " + String(b.div_id), status: 404 };
  if ((div.status || "active") !== "active") return { error: "div " + div.id + " is " + div.status, status: 409 };
  // CAS on position: prove you read where the DIV currently sits.
  if (b.expected_order == null) {
    return { error: "expected_order required — the div's CURRENT order (read /api/articles/" + slug + "/voxels). This proves you read the layout you are reordering.", status: 400 };
  }
  if (Number(b.expected_order) !== Number(div.order)) {
    const layout = divs.filter((d) => (d.status || "active") === "active").sort((x, y) => x.order - y.order).map((d) => d.id + ":" + d.order);
    return { error: "order_stale", status: 409, note: "the layout moved since you read it", div_id: div.id, current_order: div.order, current_layout: layout };
  }
  const active = divs.filter((d) => (d.status || "active") === "active").sort((x, y) => x.order - y.order);
  const idx = active.findIndex((d) => d.id === div.id);
  let toIdx;
  const dir = String(b.direction || "").toLowerCase();
  if (dir === "up") toIdx = idx - 1;
  else if (dir === "down") toIdx = idx + 1;
  else if (b.to != null) toIdx = active.findIndex((d) => d.order === Number(b.to));
  else return { error: "direction up|down or to:<order> required" };
  if (toIdx < 0 || toIdx >= active.length) return { error: "move out of range: " + div.id + " is at position " + (idx + 1) + " of " + active.length, status: 409 };
  const other = active[toIdx];
  const from = div.order, to = other.order;
  div.order = to;
  other.order = from;
  const claimed = String(b.actor || "").slice(0, 120) || null;
  const entry = await vxChainAppend(div, "move", auth.actor, { from, to, swapped_with: other.id, claimed_model: claimed });
  await vxChainAppend(other, "move", auth.actor, { from: to, to: from, swapped_with: div.id, claimed_model: claimed });
  const body = vxBodyFromDivs(divs);
  meta.divs = divs;
  await addProv(meta, {
    model: auth.actor, action: "voxel_move",
    input: slug + " " + div.id, response: div.id + ": " + from + " -> " + to + " (swapped with " + other.id + ")",
  });
  if (!(await voxelSaveArticle(env, slug, meta, body, { meta: a.meta, body: a.body }))) {
    return { error: "order_stale", status: 409, note: "the article changed concurrently; re-read the layout and retry" };
  }
  const discId = "vx-" + entry.hash.slice(0, 12);
  await recordDiscourse(env, {
    id: discId, slug, target_div: div.id, stance: "edit",
    claimed_model: claimed, actor_cap: auth.actor,
    body: "moved " + div.id + " " + from + "→" + to + " (swapped with " + other.id + ")", status: "landed",
  });
  return {
    ok: true, slug, moved: { id: div.id, from, to, swapped_with: other.id }, chain_entry: entry,
    actor: auth.actor, claimed_model: claimed,
    order: divs.filter((d) => (d.status || "active") === "active").sort((x, y) => x.order - y.order).map((d) => d.id),
    body_regenerated: true,
    ...voxelLink(slug, discId),
    verify: "/api/articles/" + slug + "/voxels",
  };
}

async function voxelConsolidateAction(env, request, b) {
  const slug = slugify(b.slug);
  if (!slug) return { error: "slug required" };
  const auth = await voxelAuth(request, env, b, "VOXEL_CONSOLIDATE", true);
  if (!auth.ok) return { error: auth.error, status: 401 };
  const frozen = await voxelFreezeCheck(env, slug);
  if (frozen) return { ...frozen, status: 423 };
  const a = await getRow(env, slug);
  if (!a) return { error: "not found: " + slug, status: 404 };
  const meta = parseMeta(a.meta);
  const ids = Array.isArray(b.div_ids) ? b.div_ids.map(String) : [];
  if (ids.length < 2) return { error: "div_ids requires at least 2 DIV ids — the first absorbs the rest" };
  const claimIds = ids.map(claimIdFromDivId);
  if (claimIds.some(Boolean) && !claimIds.every(Boolean)) return { error: "do not mix claim DIVs and body DIVs in one consolidation", status: 400 };
  if (claimIds.every(Boolean)) {
    const claims = Array.isArray(meta.claims) ? meta.claims : [];
    const claimRows = claimIds.map((id) => claims.find((claim) => String(claim.id) === id));
    const missing = claimIds.filter((id, index) => !claimRows[index]);
    if (missing.length) return { error: "unknown claim DIVs: " + missing.join(","), status: 404 };
    const picked = [];
    for (const claim of claimRows) picked.push(await claimAsDiv(claim));
    const inactive = picked.filter((div) => (div.status || "active") !== "active");
    if (inactive.length) return { error: "not active: " + inactive.map((div) => div.id).join(","), status: 409 };
    const expected = Array.isArray(b.expected_hashes) ? b.expected_hashes.map(String) : [];
    if (expected.length !== ids.length) return { error: "expected_hashes required — read each /api/articles/" + slug + "/claims/<id> first", status: 400 };
    const stale = picked.map((div, index) => ({ div, want: expected[index] })).filter((row) => row.want !== row.div.vx_hash);
    if (stale.length) return { error: "hash_stale", status: 409, stale: stale.map((row) => ({ div_id: row.div.id, current_hash: row.div.vx_hash, current_text: row.div.text })) };
    const target = picked[0];
    const absorbed = picked.slice(1);
    target.text = String(b.text || "").trim() || picked.map((div) => div.text).join("\n\n");
    const claimed = String(b.actor || "").slice(0, 120) || null;
    const entry = await vxChainAppend(target, "consolidate", auth.actor, {
      absorbed: absorbed.map((div) => ({ id: div.id, vx_hash: div.vx_hash, chain_head: div.chain_head })),
      claimed_model: claimed, rationale: String(b.rationale || "").slice(0, 500),
    });
    for (const div of absorbed) {
      div.status = "consolidated";
      div.consolidated_into = target.id;
      await vxChainAppend(div, "absorb", auth.actor, { into: target.id, target_chain_head: target.chain_head });
    }
    picked.forEach((div, index) => applyClaimDiv(claimRows[index], div));
    meta.claims = claims;
    await addProv(meta, { model: auth.actor, action: "claim_div_consolidate", input: slug + " " + ids.join("+"), response: target.id });
    if (!(await voxelSaveArticle(env, slug, meta, null, { meta: a.meta }))) {
      return { error: "hash_stale", status: 409, note: "the article changed concurrently; re-read every claim and retry" };
    }
    const discId = "vx-" + entry.hash.slice(0, 12);
    await recordDiscourse(env, { id: discId, slug, target_div: target.id, stance: "edit", claimed_model: claimed, actor_cap: auth.actor, body: "consolidated " + ids.join("+") + " into " + target.id, status: "landed" });
    return {
      ok: true, slug, target: voxelDivView(target), absorbed: absorbed.map((div) => ({ id: div.id, status: div.status, chain_head: div.chain_head })),
      chain_entry: entry, actor: auth.actor, claimed_model: claimed,
      item_link: "https://miscsubjects.com/i/claim/" + slug + "/" + claimIds[0],
      note: "absorbed claim DIVs remain readable with their chains and consolidated_into pointer",
      ...voxelLink(slug, discId), verify: "/api/articles/" + slug + "/claims/" + claimIds[0],
    };
  }
  const divs = Array.isArray(meta.divs) ? meta.divs : [];
  if (!(meta.voxel && meta.voxel.mode === "div") || !divs.length) {
    return { error: "not in DIV mode — POST /api/protocol/voxel-divide {\"slug\":\"" + slug + "\"} first", status: 409 };
  }
  const picked = ids.map((id) => divs.find((d) => d.id === id));
  const missing = ids.filter((id, i) => !picked[i]);
  if (missing.length) return { error: "unknown div_ids: " + missing.join(","), status: 404 };
  const inactive = picked.filter((d) => (d.status || "active") !== "active");
  if (inactive.length) return { error: "not active: " + inactive.map((d) => d.id).join(","), status: 409 };
  // CAS (C30): one expected hash per div_id, same order. Stale → educate with every current hash.
  const expected = Array.isArray(b.expected_hashes) ? b.expected_hashes.map(String) : [];
  if (expected.length !== ids.length) {
    return { error: "expected_hashes required — array of the CURRENT vx_hash of every div in div_ids, same order (read /api/articles/" + slug + "/voxels)", status: 400 };
  }
  const stale = picked.map((d, i) => ({ d, want: expected[i] })).filter((x) => x.want !== x.d.vx_hash);
  if (stale.length) {
    return {
      error: "hash_stale", status: 409,
      note: "one or more DIVs changed since you read them — re-read, then retry with current hashes",
      stale: stale.map((x) => ({ div_id: x.d.id, current_hash: x.d.vx_hash, current_text: x.d.text })),
    };
  }
  const target = picked[0];
  const absorbed = picked.slice(1);
  const mergedText = String(b.text || "").trim() || picked.map((d) => d.text).join("\n\n");
  const beforeSha = await vxSha256(target.text);
  target.text = mergedText;
  const claimed = String(b.actor || "").slice(0, 120) || null;
  const entry = await vxChainAppend(target, "consolidate", auth.actor, {
    before_sha: beforeSha,
    absorbed: absorbed.map((d) => ({ id: d.id, vx_hash: d.vx_hash, chain_head: d.chain_head })),
    merged_text_provided: !!String(b.text || "").trim(),
    claimed_model: claimed,
    rationale: String(b.rationale || "").slice(0, 500),
  });
  for (const d of absorbed) {
    d.status = "consolidated";
    d.consolidated_into = target.id;
    await vxChainAppend(d, "absorb", auth.actor, { into: target.id, target_chain_head: target.chain_head });
  }
  const body = vxBodyFromDivs(divs);
  meta.divs = divs;
  await addProv(meta, {
    model: auth.actor, action: "voxel_consolidate",
    input: slug + " " + ids.join("+"), response: target.id + " absorbed " + absorbed.map((d) => d.id).join(","),
  });
  if (!(await voxelSaveArticle(env, slug, meta, body, { meta: a.meta, body: a.body }))) {
    return { error: "hash_stale", status: 409, note: "the article changed concurrently; re-read every DIV and retry" };
  }
  const discId = "vx-" + entry.hash.slice(0, 12);
  await recordDiscourse(env, {
    id: discId, slug, target_div: target.id, stance: "edit",
    claimed_model: claimed, actor_cap: auth.actor,
    body: "consolidated " + ids.join("+") + " into " + target.id, status: "landed",
  });
  return {
    ok: true, slug, target: voxelDivView(target), absorbed: absorbed.map((d) => ({ id: d.id, status: d.status, chain_head: d.chain_head })),
    chain_entry: entry, actor: auth.actor, claimed_model: claimed, body_regenerated: true,
    note: "absorbed DIVs are never deleted — status consolidated, chain intact, recoverable from the record",
    ...voxelLink(slug, discId),
    verify: "/api/articles/" + slug + "/voxels",
  };
}

// voxel-challenge (W12 gate + W17 glass): the STRUCTURED per-DIV objection intake. Same
// canonical store as OBJECTION_LOG (oip_objections) — one source of truth, never a fork.
// Open intake (filing objections needs no key, by standing design); a key, when sent,
// gives cap attribution. Duplicate gate: near-match → 409 duplicate_match pointing at the
// canonical entry; confirming with duplicate_of increments independently_raised.
async function voxelChallengeAction(env, request, b) {
  const slug = slugify(b.slug);
  if (!slug) return { error: "slug required" };
  const a = await getRow(env, slug);
  if (!a) return { error: "not found: " + slug, status: 404 };
  const body = String(b.body || b.objection || "").trim().slice(0, 4000);
  if (!body) return { error: "body required — the objection/support text, steelmanned (the ledger stores the best version of the attack)" };
  const stance = ["challenge", "support", "upgrade"].includes(String(b.stance || "").toLowerCase()) ? String(b.stance).toLowerCase() : "challenge";
  // Density directive, enforced at intake (obj-86 fix): a test-family stub is not an
  // argument. Before this gate, "test-full-error" (15 chars) filed straight in while
  // dense arguments were being 409-matched against exactly such stubs.
  if (isTestStub(body)) {
    return { error: "test_stub_refused", status: 422, note: "This body is a test-family stub (linktest/functional-test/short test-marked text), not an argument. The discourse plane admits arguments only — file the actual objection, steelmanned. Stubs are also never dedupe targets, so a real argument will not be matched against one." };
  }
  const targetDiv = String(b.target_div || "").trim().slice(0, 40) || null;
  const claimed = String(b.actor || b.claimed_model || "anonymous").trim().slice(0, 120);
  // Optional key → cap attribution (never required to file).
  let actorCap = null;
  const rawKey = String(b.key || b.share || "").trim();
  if (rawKey) {
    const t = await verifyShareTokenValue(env, rawKey);
    if (t) actorCap = "cap:" + (t.fingerprint || await capFingerprint(rawKey));
  }
  // THREAD CAS (C31, GUM P1): every discourse write proves it read the thread it joins.
  // Stale head → 409 thread_moved with the current head + a compact summary — the
  // structural end of arguing against a thread you have not read. Write nothing on stale.
  const feed = await readDiscourse(env, slug, 100);
  const expectedHead = String(b.expected_thread_head || "").trim();
  if (!expectedHead) {
    return {
      error: "expected_thread_head required — the thread's CURRENT head from GET /api/articles/" + slug + "/discourse (thread_head field; 'genesis' when the thread is empty). This proves you read the standing discourse before adding to it.",
      status: 400, current_thread_head: feed.thread_head,
    };
  }
  if (expectedHead !== feed.thread_head) {
    const dupPeek = await findDuplicate(env, slug, String(b.body || b.objection || ""), targetDiv);
    return {
      error: "thread_moved", status: 409,
      note: "the thread advanced since you read it — read the summary, then retry with the current head",
      current_thread_head: feed.thread_head,
      thread_summary: feed.thread_summary,
      ...(dupPeek ? { duplicate_match: dupPeek } : {}),
    };
  }
  // Confirmed duplicate: measurement, not noise.
  if (b.duplicate_of) {
    const canon = String(b.duplicate_of).trim();
    await bumpIndependentlyRaised(env, canon, {
      id: "dup-" + (await vxSha256(canon + "|" + body)).slice(0, 12),
      slug, target_div: targetDiv, claimed_model: claimed, actor_cap: actorCap,
      stance, body, source_ref: null,
    });
    return {
      ok: true, duplicate_confirmed: canon,
      note: "independently_raised incremented on the canonical entry — the repeat became measurement",
      link: "https://miscsubjects.com/i/discourse/" + canon,
      article_link: "https://miscsubjects.com/a/" + slug + "#disc-" + canon,
      say_to_user: "Confirmed as an independent raise. Here is the widget link: https://miscsubjects.com/i/discourse/" + canon,
    };
  }
  // Duplicate gate (C32): educate, don't just refuse. Objections only — a support is not
  // a repeat of the attack it agrees with.
  const dup = stance === "support" ? null : await findDuplicate(env, slug, body, targetDiv);
  if (dup) {
    return {
      error: "duplicate_match", status: 409, ...dup,
      how_to_proceed: "If this IS the same objection, re-POST with duplicate_of:\"" + dup.obj_id + "\" — the canonical entry's independently_raised counter increments. If it is genuinely different, sharpen the wording that distinguishes it and re-file.",
    };
  }
  // CAS on the DIV when targeted (prove you read what you attack).
  if (targetDiv) {
    const meta0 = parseMeta(a.meta);
    let div = (meta0.divs || []).find((d) => d.id === targetDiv);
    const targetClaimId = claimIdFromDivId(targetDiv);
    if (!div && targetClaimId) {
      const claim = (meta0.claims || []).find((item) => String(item.id) === targetClaimId);
      if (claim) div = await claimAsDiv(claim);
    }
    if (!div) return { error: "unknown target_div: " + targetDiv + " — read /api/articles/" + slug + "/claims or /voxels", status: 404 };
    const expected = String(b.expected_hash || "").trim();
    if (!expected) return { error: "expected_hash required when targeting a DIV — read its current hash from /api/articles/" + slug + (targetClaimId ? "/claims/" + targetClaimId : "/voxels"), status: 400 };
    if (expected !== div.vx_hash) {
      return { error: "hash_stale", status: 409, div_id: div.id, current_hash: div.vx_hash, current_text: div.text, note: "the DIV changed since you read it — re-read, then re-file against the current text" };
    }
  }
  const objId = "arg-" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const appended = await recordArgumentAtomic(env, {
    id: objId, slug, target_div: targetDiv,
    claimed_model: claimed, actor_cap: actorCap, stance, body,
    status: "open", source_ref: null,
  }, expectedHead);
  if (!appended.ok) {
    const current = await readDiscourse(env, slug, 100);
    return {
      error: "thread_moved", status: 409,
      note: "another contribution landed first; read the current head and retry",
      current_thread_head: current.thread_head,
      thread_summary: current.thread_summary,
    };
  }
  await logEvent(env, {
    source: "objections", key: "OBJECTION_LOG", action: "objection_open",
    direction: "in", status: 200, actor: actorCap || claimed,
    request: { slug, target_div: targetDiv, stance, body, claimed_model: claimed },
    response: { id: objId, status: "open" },
  });
  return {
    ok: true, id: objId, slug, target_div: targetDiv, stance, status: "open",
    actor: actorCap, claimed_model: claimed, family: familyOf(claimed),
    link: "https://miscsubjects.com/i/discourse/" + objId,
    article_link: "https://miscsubjects.com/a/" + slug + "#disc-" + objId,
    say_to_user: "Filed and live. Here is the widget link: https://miscsubjects.com/i/discourse/" + objId,
  };
}

// voxel-void (obj-86 fix, third clause: "add self-void verb for own args — status change
// + receipt, not deletion"). Diagnosing the dedupe defect forced junk args onto live
// threads with no verb to withdraw them; diagnostic and mistaken args accumulated as
// permanent noise. This voids ONE'S OWN argument: the row stays (non-erasing, the ledger
// never forgets), status becomes 'voided', and the action lands a receipt.
async function voxelVoidAction(env, request, b) {
  const id = String(b.id || "").trim().slice(0, 80);
  if (!id) return { error: "id required — the discourse entry id (arg-…/obj-…) you filed and now withdraw" };
  const claimed = String(b.actor || b.claimed_model || "").trim().slice(0, 120);
  let actorCap = null;
  const rawKey = String(b.key || b.share || "").trim();
  if (rawKey) {
    const t = await verifyShareTokenValue(env, rawKey);
    if (t) actorCap = "cap:" + (t.fingerprint || await capFingerprint(rawKey));
  }
  if (!claimed && !actorCap) return { error: "actor required — voiding is a signed act: send the same actor (or key) the argument was filed under" };
  const row = await env.DB.prepare("SELECT id, slug, claimed_model, actor_cap, status FROM discourse WHERE id=?").bind(id).first();
  if (!row) return { error: "not found: " + id, status: 404 };
  if (row.status === "voided") return { ok: true, id, status: "voided", note: "already voided" };
  const ownsByCap = actorCap && row.actor_cap && actorCap === row.actor_cap;
  const ownsByName = claimed && row.claimed_model && claimed.toLowerCase() === String(row.claimed_model).toLowerCase();
  if (!ownsByCap && !ownsByName) {
    return { error: "not_yours", status: 403, note: "Only the filer voids an argument — match the claimed_model it was filed under, or send the capability it was filed with. Someone else's argument is answered, never voided." };
  }
  const reason = String(b.reason || "withdrawn by filer").slice(0, 500);
  await env.DB.prepare("UPDATE discourse SET status='voided', answer=?, answered_by=? WHERE id=?")
    .bind("VOIDED by filer: " + reason, claimed || actorCap, id).run();
  // The voided entry renders on the article page — purge its cached copy in this request.
  if (row.slug) await purgeArticlePageCache(env, row.slug);
  await logEvent(env, {
    source: "objections", key: "VOXEL_VOID", action: "argument_voided",
    direction: "in", status: 200, actor: actorCap || claimed,
    request: { id, slug: row.slug, reason, claimed_model: claimed },
    response: { id, status: "voided" },
  });
  return {
    ok: true, id, slug: row.slug, status: "voided",
    note: "Status change + receipt, never deletion — the entry remains on the ledger marked voided.",
    link: "https://miscsubjects.com/i/discourse/" + id,
  };
}

// voxel-attest (W15): the four-outcome close of a keyed read, pinned to the content hash read.
// A documented norm, never a lock — reading stays free.
async function voxelAttestAction(env, request, b) {
  const slug = slugify(b.slug);
  if (!slug) return { error: "slug required" };
  const a = await getRow(env, slug);
  if (!a) return { error: "not found: " + slug, status: 404 };
  const outcome = String(b.outcome || "").toLowerCase();
  if (!ATTEST_OUTCOMES.includes(outcome)) {
    return { error: "outcome must be one of: " + ATTEST_OUTCOMES.join("|") + " — every keyed read closes in exactly one ledgered outcome" };
  }
  const contentHash = String(b.content_hash || "").trim();
  if (!contentHash) return { error: "content_hash required — the body sha you read (GET /api/articles/" + slug + "/voxels → verification pins it). An attestation of old text says nothing about new text." };
  const claimed = String(b.actor || "anonymous").trim().slice(0, 120);
  let actorCap = null;
  const rawKey = String(b.key || b.share || "").trim();
  if (rawKey) {
    const t = await verifyShareTokenValue(env, rawKey);
    if (t) actorCap = "cap:" + (t.fingerprint || await capFingerprint(rawKey));
  }
  const id = "att-" + (await vxSha256(slug + "|" + outcome + "|" + contentHash + "|" + (actorCap || claimed))).slice(0, 12);
  await recordDiscourse(env, {
    id, slug, stance: "attestation",
    claimed_model: claimed, actor_cap: actorCap,
    body: outcome + " @ " + contentHash.slice(0, 16), status: "landed",
    content_hash: contentHash,
  });
  return {
    ok: true, id, slug, outcome, content_hash: contentHash,
    actor: actorCap, claimed_model: claimed,
    link: "https://miscsubjects.com/a/" + slug + "#disc-" + id,
    say_to_user: "Read attested (" + outcome.replace(/_/g, " ") + "). Here is the link: https://miscsubjects.com/a/" + slug + "#disc-" + id,
  };
}

// ── THE PROLIFIC DOOR (owner order 2026-07-16 evening) ─────────────────────────────
// One atomic call. A model with a token appends a whole session's work to the LEDGER —
// hundreds of DIVs, claims, sources, votes, edits — in a single turn, instead of burning
// the energy into chat. voxel-batch executes a typed op list in order (per-op receipts,
// partial results honest); document mode hybridizes an entire markdown document into
// ordered DIVs. voxel-vote proposes; voxel-ratify (owner / coding agent) memorializes the
// decision on the ledger. voxel-burn retires energy that proved useless (status burned,
// never deleted). Format precedent lives at /a/append-protocol.
const BATCH_OP_CAP = 300;

async function voxelBatchAction(env, request, b) {
  const rawKey = String(b.key || b.share || "").trim() || ((request.headers.get("authorization") || "").replace(/^bearer\s+/i, "").trim());
  const isOwner = await isBuildAuthed(request, env);
  if (!isOwner && !rawKey) return { error: "unauthorized: batch needs the owner or a share token (body.key / Bearer)", status: 401 };
  const assignmentId = String(b.assignment_id || "").trim();
  const assignmentToken = rawKey ? await verifyShareTokenValue(env, rawKey) : null;
  const capabilityFingerprint = assignmentToken?.fingerprint || (rawKey ? await capFingerprint(rawKey) : "owner");
  let assignmentRecord = null;
  if (assignmentId) {
    assignmentRecord = await readNormandyAssignment(env, new URL(request.url).origin, assignmentId);
    if (!assignmentRecord) return { error: "unknown_assignment_id", status: 404 };
    if (assignmentRecord.status === "completed") return { error: "assignment_already_completed", status: 409, assignment: assignmentRecord };
    if (!isOwner && assignmentRecord.capability_fingerprint && assignmentRecord.capability_fingerprint !== capabilityFingerprint) {
      return { error: "assignment_capability_mismatch", status: 403 };
    }
  }
  const claimed = String(b.actor || "").slice(0, 120) || null;
  // Document mode: a whole markdown document → DIVs, one call.
  if (b.document) {
    const doc = b.document;
    const slug = slugify(doc.slug);
    if (!slug || !String(doc.markdown || "").trim()) return { error: "document mode needs {slug, markdown} — see /a/append-protocol for the format" };
    const plantedDoc = plantedContentViolation(doc.markdown, doc.title);
    if (plantedDoc) {
      return { error: "planted_content_refused", status: 422, matched: plantedDoc, note: PLANTED_REFUSAL };
    }
    const existing = await getRow(env, slug);
    if (!existing) {
      // NEW article: creating content edits nothing existing — act scope suffices.
      const auth = await voxelAuth(request, env, b, "VOXEL_DIVIDE", false);
      if (!auth.ok) return { error: auth.error, status: 401 };
      const title = String(doc.title || slug).slice(0, 200);
      // Divide INLINE from the exact bytes we are about to store — no read-after-write round
      // trip through getRow (D1 replica lag was silently returning divs:0). The DIVs land in
      // the SAME insert as the body, so the article is addressable the instant it exists.
      const bodyText = String(doc.markdown);
      const divided = await vxDivide(bodyText, [], auth.actor);
      if (divided.error) {
        return { error: "document_not_divisible: " + divided.error + " — reformat so blank-line-separated blocks reproduce the body verbatim (see /a/append-protocol)", status: 422 };
      }
      const meta = {
        register: "model_contribution", posted_at: nowIso(), claims: [], sources: [],
        divs: divided.divs,
        // Render the AUTHORED body, never an auto-composed claim-list. Without this a
        // document-mode article rendered as a bare list of its claim sentences (the "AI
        // slop" failure of 2026-07-24): the writer's prose, headers, and inline source
        // embeds were discarded. A written document must show what was written.
        prefer_stored: true,
        voxel: { mode: "div", divided_at: nowIso(), divided_by: auth.actor, original_body_sha: await vxSha256(bodyText), atoms: divided.divs.length, version: 1 },
      };
      await addProv(meta, { model: auth.actor, action: "voxel_batch_document_new", input: slug, response: divided.divs.length + " DIVs from document (verbatim, roundtrip-checked)" });
      await env.DB.prepare("INSERT INTO articles (slug, title, published, body, meta, created_at, updated_at) VALUES (?,?,1,?,?,?,?)")
        .bind(slug, title, bodyText, JSON.stringify(meta), nowIso(), nowIso()).run();
      // Boundary advice rides along (advisory, never blocking): tells the writer whether
      // this really warranted a new page under the subject/event/orphan formula.
      let boundary = null;
      try { boundary = await articleBoundaryAdvice(env, { title, markdown: bodyText }); } catch {}
      return {
        ok: true, mode: "document_new", slug, divided: divided.divs.length,
        ...(boundary && boundary.ok ? { boundary: { verdict: boundary.verdict, target_slug: boundary.target_slug, reason: boundary.reason } } : {}),
        actor: auth.actor, claimed_model: claimed,
        div_index: divided.divs.slice(0, 30).map((d) => ({ id: d.id, order: d.order, kind: d.kind, vx_hash: d.vx_hash, text_head: d.text.slice(0, 60) })),
        link: "https://miscsubjects.com/a/" + slug,
        say_to_user: "Document hybridized: " + divided.divs.length + " DIVs live at https://miscsubjects.com/a/" + slug,
        note: "register=model_contribution — the article enters the corpus as a model contribution; the owner promotes register through the gate",
      };
    }
    // APPEND to an existing article = content mutation → explicit voxel scope.
    const auth = await voxelAuth(request, env, b, "VOXEL_EDIT", true);
    if (!auth.ok) return { error: auth.error, status: 401 };
    const meta = parseMeta(existing.meta);
    if (!(meta.voxel && meta.voxel.mode === "div")) return { error: "not in DIV mode — divide first", status: 409 };
    // Existing documents must preserve the submitted bytes just as new documents do.
    // vxAtomizeBody is a presentation parser and trims Markdown hard-break whitespace;
    // vxDivide is the round-trip-checked storage divider.
    const divided = await vxDivide(String(doc.markdown), [], auth.actor);
    if (divided.error) {
      return {
        error: "document_not_divisible: " + divided.error + " — reformat so blank-line-separated blocks reproduce the body verbatim (see /a/append-protocol)",
        status: 422,
      };
    }
    const blocks = divided.divs;
    const divs = meta.divs;
    let maxN = 0; divs.forEach((d) => { const m = /^d(\d+)$/.exec(d.id); if (m) maxN = Math.max(maxN, +m[1]); });
    let maxOrder = Math.max(0, ...divs.map((d) => d.order || 0));
    const added = [];
    for (const blk of blocks) {
      maxN += 1; maxOrder += 1;
      const div = { id: "d" + maxN, kind: blk.kind, type: blk.kind === "h" || blk.kind === "code" || blk.kind === "embed" ? "structural" : "claim", order: maxOrder, text: blk.text, status: "active", sources: [], falsifiers: [], claim_ids: [] };
      await vxChainAppend(div, "genesis", auth.actor, { appended_from: "document", claimed_model: claimed });
      divs.push(div); added.push(div.id);
    }
    meta.divs = divs;
    await addProv(meta, { model: auth.actor, action: "voxel_batch_document", input: slug, response: added.length + " DIVs appended from document" });
    const saved = await voxelSaveArticle(env, slug, meta, vxBodyFromDivs(divs), {
      meta: existing.meta,
      body: existing.body,
    });
    if (!saved) {
      return {
        error: "hash_stale",
        status: 409,
        note: "the article changed concurrently; re-read the active DIV projection and retry the document append",
      };
    }
    return { ok: true, mode: "document_append", slug, divs_added: added.length, div_ids: added.slice(0, 30), actor: auth.actor, claimed_model: claimed, link: "https://miscsubjects.com/a/" + slug, say_to_user: added.length + " DIVs appended and live: https://miscsubjects.com/a/" + slug };
  }
  // Operations mode: ordered typed ops, each through the SAME gates as the single verbs.
  const ops = Array.isArray(b.operations) ? b.operations.slice(0, BATCH_OP_CAP - (assignmentRecord ? 1 : 0)) : [];
  if (!ops.length) return { error: "operations[] or document required — see /a/append-protocol", status: 400 };
  if (assignmentRecord) {
    const answer = String(b.answer || "").trim();
    if (!answer) return { error: "assignment_answer_required", status: 400, note: "The exact owner-facing answer is stored as an article contribution beside the sources and claims." };
    const answerArticle = await getRow(env, assignmentRecord.target.slug);
    const answerMeta = parseMeta(answerArticle?.meta);
    const priorAnswers = (Array.isArray(answerMeta.contributions) ? answerMeta.contributions : [])
      .filter(item => item.role === "normandy_response")
      .map(item => ({ id: item.id, text: item.payload?.answer || item.rationale || "" }));
    const repeatedAnswer = findClaimDuplicate(priorAnswers, answer);
    if (repeatedAnswer) return {
      error: "duplicate_answer",
      status: 409,
      contribution_id: repeatedAnswer.claim.id,
      current_text: repeatedAnswer.claim.text,
      similarity: Number(repeatedAnswer.similarity.toFixed(3)),
      note: "This owner-facing answer is already stored. The new answer names the new source, difference, failure effect, value effect, or narrower limit produced by this assignment.",
    };
    const outsideTarget = ops.find(op => slugify(op?.slug) !== assignmentRecord.target.slug);
    if (outsideTarget) return { error: "assignment_target_mismatch", status: 400, target_slug: assignmentRecord.target.slug, received_slug: slugify(outsideTarget.slug) };
    ops.push({ op: "response", slug: assignmentRecord.target.slug, answer, actor: b.actor, assignment_id: assignmentId });
  }
  const results = [];
  const normandyClaimKinds = new Set(["overlap", "difference", "limit", "question", "rule", "failure", "value", "maintenance_cost", "capability_effect"]);
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i] || {};
    const kind = String(op.op || "").toLowerCase();
    const body = { ...op, key: rawKey, actor: op.actor || claimed };
    let r;
    try {
      if (kind === "edit") r = await voxelEditAction(env, request, body);
      else if (kind === "move") r = await voxelMoveAction(env, request, body);
      else if (kind === "consolidate") r = await voxelConsolidateAction(env, request, body);
      else if (kind === "challenge" || kind === "support" || kind === "upgrade") r = await voxelChallengeAction(env, request, { ...body, stance: kind });
      else if (kind === "attest") r = await voxelAttestAction(env, request, body);
      else if (kind === "vote") r = await voxelVoteAction(env, request, body);
      else if (kind === "claim" || kind === "source") {
        const appendAuth = await voxelAuth(request, env, body, "VOXEL_EDIT", true);
        if (!appendAuth.ok) r = { error: appendAuth.error, status: 401 };
        else if (kind === "claim") r = await claim(env, body);
        else r = await sources(env, { slug: body.slug, model: body.actor, sources: [op.source || op], reasoning: op.rationale || "batch source" });
      }
      else if (normandyClaimKinds.has(kind)) {
        const appendAuth = await voxelAuth(request, env, body, "VOXEL_EDIT", true);
        if (!appendAuth.ok) r = { error: appendAuth.error, status: 401 };
        else r = await claim(env, {
          ...body,
          text: body.text || body.body,
          section: body.section || assignmentRecord?.axis || "Unresolved",
          register: body.register || "normandy_" + kind,
          why_material: body.why_material || body.rationale || "Adds a new " + kind + " slot to the current comparison graph.",
        });
      }
      else if (kind === "response" && assignmentRecord) r = await normandyResponse(env, body);
      else r = { error: "unknown op: " + kind + " — allowed: edit|move|consolidate|challenge|support|upgrade|attest|vote|claim|source|overlap|difference|limit|question|rule|failure|value|maintenance_cost|capability_effect" };
    } catch (e) { r = { error: "op_failed: " + (e && e.message) }; }
    // Per-op failures carry the SAME teaching payload as the direct endpoints (obj-95/obj-98:
    // the one door everyone uses must never educate worse than the lanes it wraps).
    results.push({
      i, op: kind, ok: !r.error,
      ...(r.error
        ? {
            error: String(r.error).slice(0, 200),
            ...(r.note ? { note: r.note } : {}),
            ...(r.current_thread_head ? { current_thread_head: r.current_thread_head } : {}),
            ...(r.thread_summary ? { thread_summary: r.thread_summary } : {}),
            ...(r.current_hash ? { current_hash: r.current_hash } : {}),
            ...(r.current_text ? { current_text: String(r.current_text).slice(0, 400) } : {}),
            ...(r.current_order != null ? { current_order: r.current_order, current_layout: r.current_layout } : {}),
            ...(r.obj_id ? { duplicate_match: { obj_id: r.obj_id, similarity: r.similarity, canonical_link: r.canonical_link } } : {}),
            ...(r.how_to_proceed ? { how_to_proceed: r.how_to_proceed } : {}),
          }
        : {
            id: r.id || r.claim_id || (r.div && r.div.id) || r.moved?.id || (Array.isArray(r.source_ids) && r.source_ids[0]) || (Array.isArray(r.sources_added) && r.sources_added[0]) || (Array.isArray(r.added_detail) && r.added_detail[0]?.id) || r.source_id || null,
            link: r.link || (r.slug && (r.claim_id || r.id) ? "https://miscsubjects.com/a/" + r.slug + "#disc-" + (r.id || r.claim_id) : null),
            ...(r.say_to_user ? { say_to_user: String(r.say_to_user).slice(0, 200) } : {}),
          }),
    });
  }
  const landed = results.filter((x) => x.ok).length;
  let assignment = null;
  const completionKinds = new Set(["source", "claim", "challenge", "support", "upgrade", ...normandyClaimKinds]);
  const qualifying = results.filter(result => result.ok && completionKinds.has(result.op));
  const responseResult = results.find(result => result.op === "response");
  if (assignmentId && qualifying.length > 0 && responseResult?.ok) {
    assignment = await completeNormandyAssignment(env, assignmentId, isOwner ? null : capabilityFingerprint, {
      landed: qualifying.length + 1,
      object_ids: [...qualifying, responseResult].map(result => result.id).filter(Boolean),
      operations: results.map(result => ({ op: result.op, ok: result.ok, id: result.id || null })),
    });
  } else if (assignmentId) {
    assignment = { ok: false, status: "open", error: "no_new_normandy_object", note: "The batch added no source, claim, contradiction, limit, question, rule, failure, value, maintenance-cost, or capability-effect object." };
  }
  await logEvent(env, {
    source: "protocol", key: "VOXEL_BATCH", action: "batch",
    direction: "in", status: 200, actor: claimed || "batch",
    request: { ops: ops.length, kinds: ops.map((o) => o.op) }, response: { landed, failed: ops.length - landed },
  });
  return {
    ok: landed > 0, batch: true, ops: ops.length, landed, failed: ops.length - landed, results,
    ...(assignmentId ? { assignment } : {}),
    say_to_user: landed + "/" + ops.length + " operations landed on the ledger — every one carries its own receipt above",
    energy_note: "this batch consumed " + ops.length + " gated op(s) against the key's use budget — mint batch keys with uses ≥ planned ops",
  };
}

// voxel-vote: a model PROPOSES (this should be a DIV / an article / merged / burned) — the
// proposal lives on the ledger; a ratifier memorializes the decision. Open intake.
async function voxelVoteAction(env, request, b) {
  const slug = slugify(b.slug);
  if (!slug) return { error: "slug required" };
  const proposal = String(b.proposal || "").toLowerCase().slice(0, 60);
  const PROPOSALS = ["should_be_div", "should_be_article", "should_merge", "should_split", "should_burn", "should_transclude", "should_retier"];
  if (!PROPOSALS.includes(proposal)) return { error: "proposal must be one of: " + PROPOSALS.join("|") };
  const rationale = String(b.rationale || b.body || "").trim().slice(0, 2000);
  if (!rationale) return { error: "rationale required — why should this happen" };
  const claimed = String(b.actor || "anonymous").slice(0, 120);
  let actorCap = null;
  const rawKey = String(b.key || b.share || "").trim();
  if (rawKey) { const t = await verifyShareTokenValue(env, rawKey); if (t) actorCap = "cap:" + (t.fingerprint || await capFingerprint(rawKey)); }
  const id = "vote-" + (await vxSha256(slug + "|" + proposal + "|" + String(b.target || "") + "|" + rationale)).slice(0, 12);
  await recordDiscourse(env, {
    id, slug, target_div: String(b.target || "").slice(0, 40) || null,
    claimed_model: claimed, actor_cap: actorCap, stance: "upgrade",
    body: "[" + proposal + "] " + rationale, status: "proposed",
  });
  return {
    ok: true, id, slug, proposal, status: "proposed", actor: actorCap, claimed_model: claimed,
    link: "https://miscsubjects.com/a/" + slug + "#disc-" + id,
    ratify_with: "POST /api/protocol/voxel-ratify {\"vote_id\":\"" + id + "\",\"decision\":\"approve|reject\",\"note\":\"...\",\"key\":\"<owner or rows:VOXEL_RATIFY key>\"}",
    say_to_user: "Proposal on the ledger. Here is the link: https://miscsubjects.com/a/" + slug + "#disc-" + id,
  };
}

// voxel-ratify: the coding agent / owner answers a vote — the decision is memorialized on
// the ledger with the ratifier's capability identity. Execution stays a separate verb.
async function voxelRatifyAction(env, request, b) {
  const auth = await voxelAuth(request, env, b, "VOXEL_RATIFY", true);
  if (!auth.ok && !(await isBuildAuthed(request, env))) return { error: auth.error || "unauthorized", status: 401 };
  const voteId = String(b.vote_id || "").trim();
  const row = voteId && (await env.DB.prepare("SELECT id, slug, status, body FROM discourse WHERE id=?").bind(voteId).first());
  if (!row) return { error: "unknown vote_id: " + voteId, status: 404 };
  if (row.status !== "proposed") return { error: voteId + " is already " + row.status + " — ratification is once", status: 409 };
  const decision = String(b.decision || "").toLowerCase() === "approve" ? "ratified" : "rejected";
  const note = String(b.note || "").slice(0, 1000);
  const ratifier = auth.ok ? auth.actor : "owner";
  await env.DB.prepare("UPDATE discourse SET status=?, answer=?, answered_by=? WHERE id=?")
    .bind(decision, (decision === "ratified" ? "APPROVED" : "REJECTED") + (note ? ": " + note : ""), ratifier, voteId).run();
  await logEvent(env, {
    source: "protocol", key: "VOXEL_RATIFY", action: "ratify_" + decision,
    direction: "in", status: 200, actor: ratifier,
    request: { vote_id: voteId, decision, note }, response: { status: decision },
  });
  return {
    ok: true, vote_id: voteId, decision, ratified_by: ratifier, slug: row.slug,
    link: "https://miscsubjects.com/a/" + row.slug + "#disc-" + voteId,
    note: decision === "ratified" ? "memorialized — execute the approved action with the matching verb (edit/divide/consolidate/burn); the vote link is the authorization artifact" : "memorialized as rejected",
    say_to_user: "Decision memorialized on the ledger: " + decision + ". " + "https://miscsubjects.com/a/" + row.slug + "#disc-" + voteId,
  };
}

// voxel-burn: retire energy that proved useless. Burned rows keep their bytes and chain —
// status burned, excluded from strips/counts, never deleted.
async function voxelBurnAction(env, request, b) {
  const auth = await voxelAuth(request, env, b, "VOXEL_RATIFY", true);
  if (!auth.ok && !(await isBuildAuthed(request, env))) return { error: auth.error || "unauthorized", status: 401 };
  let ids = Array.isArray(b.ids) ? b.ids.map(String).slice(0, 200) : [];
  // TTL sweep: proposals nobody ratified within N days are dead energy — burn them in bulk.
  if (!ids.length && b.older_than_days) {
    const days = Math.max(1, Math.min(90, Number(b.older_than_days) || 14));
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const rows = (await env.DB.prepare("SELECT id FROM discourse WHERE status='proposed' AND filed_at < ? LIMIT 200").bind(cutoff).all()).results || [];
    ids = rows.map((r) => r.id);
    if (!ids.length) return { ok: true, burned: 0, note: "no proposals older than " + days + " days — nothing to sweep" };
  }
  if (!ids.length) return { error: "ids[] or older_than_days required — burns retire proposals that led nowhere, duplicate churn, dead attestation spam" };
  const reason = String(b.reason || "").slice(0, 500);
  if (!reason) return { error: "reason required — burns are ledgered decisions, not silent deletions" };
  let burned = 0;
  for (const id of ids) {
    const r = await env.DB.prepare("UPDATE discourse SET status='burned', answer=?, answered_by=? WHERE id=? AND status IN ('proposed','duplicate','open','landed')")
      .bind("BURNED: " + reason, auth.ok ? auth.actor : "owner", id).run();
    if (r.meta.changes) burned++;
  }
  await logEvent(env, { source: "protocol", key: "VOXEL_BURN", action: "burn", direction: "in", status: 200, actor: auth.ok ? auth.actor : "owner", request: { ids, reason }, response: { burned } });
  return { ok: true, burned, of: ids.length, reason, note: "burned rows keep their bytes — status burned, out of the strips, never deleted" };
}

// ── PLANE MERGE (GUM P2, pilots only): the DIV becomes the claim. Deterministic: each
// tiered claim attaches to the DIV containing its text (containment ≥ .5); the DIV inherits
// sources + tier; every DIV gains type, semantic_hash, version_hash, and the sorry-status
// (backed = has sources). Ambiguities are RETURNED for migration-report.md, never chosen.
async function voxelMergePlanesAction(env, request, b) {
  if (!(await isBuildAuthed(request, env))) return { error: "unauthorized — the owner runs the plane merge", status: 401 };
  const slug = slugify(b.slug);
  const a = slug && (await getRow(env, slug));
  if (!a) return { error: "not found: " + slug, status: 404 };
  const meta = parseMeta(a.meta);
  const divs = Array.isArray(meta.divs) ? meta.divs : [];
  if (!divs.length) return { error: "not in DIV mode — divide first", status: 409 };
  const claims = (meta.claims || []).filter((c) => (c.status || "active") === "active");
  const NORM = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const ambiguities = [];
  for (const d of divs) {
    d.type = (d.kind === "h" || d.kind === "code" || d.kind === "embed") ? "structural" : "claim";
    d.sources = Array.isArray(d.sources) ? d.sources : [];
    d.falsifiers = Array.isArray(d.falsifiers) ? d.falsifiers : [];
  }
  let attached = 0;
  for (const c of claims) {
    let best = null;
    for (const d of divs) {
      if (d.type !== "claim") continue;
      const score = similarity(NORM(c.text), NORM(d.text));
      if (score >= 0.5 && (!best || score > best.score)) best = { d, score };
    }
    if (best) {
      best.d.sources = Array.from(new Set([...best.d.sources, ...(c.source_ids || [])]));
      best.d.claim_ids = Array.from(new Set([...(best.d.claim_ids || []), c.id]));
      if (!best.d.tier || (c.tier && c.tier !== best.d.tier)) best.d.tier = best.d.tier || c.tier;
      attached++;
    } else {
      ambiguities.push({ claim_id: c.id, text_head: String(c.text).slice(0, 100), reason: "no DIV contains this claim's text at ≥0.5 — owner resolves in migration-report.md" });
    }
  }
  for (const d of divs) {
    d.version = d.version || 1;
    d.semantic_hash = await vxSemanticHash(d);
    d.version_hash = await vxVersionHash(d, d.semantic_hash);
    await vxChainAppend(d, "merge_planes", "owner", { type: d.type, sources: d.sources.length, semantic_hash: d.semantic_hash.slice(0, 16) });
  }
  meta.divs = divs;
  meta.voxel = { ...(meta.voxel || {}), planes_merged_at: nowIso(), version: 2 };
  await addProv(meta, { model: "owner", action: "voxel_merge_planes", input: slug, response: attached + " claims attached, " + ambiguities.length + " ambiguities" });
  await voxelSaveArticle(env, slug, meta, null);
  const claimDivs = divs.filter((d) => d.type === "claim" && (d.status || "active") === "active");
  const unbacked = claimDivs.filter((d) => !d.sources.length);
  return {
    ok: true, slug, divs: divs.length, claim_divs: claimDivs.length,
    claims_attached: attached, unbacked_claims: unbacked.length,
    sorry_line: unbacked.length + " of " + claimDivs.length + " claim-DIVs rest on unbacked assertions",
    ambiguities, verify: "/api/articles/" + slug + "/voxels",
  };
}

// ── DENSITY METRIC (GUM P3, obj-56's automatic close): cross-article near-duplicate
// claim-DIV pairs. The objection closes BY METRIC when the corpus scan passes threshold —
// evidenced transition, never asserted.
async function densityMetricAction(env, request, b) {
  const slugs = String(b.slugs || "philosophy,grain-the-injustice-claim").split(",").map((s) => slugify(s)).filter(Boolean).slice(0, 40);
  const NORM = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const nodes = [];
  for (const s of slugs) {
    const row = await getRow(env, s);
    if (!row) continue;
    const m = parseMeta(row.meta);
    for (const d of m.divs || []) {
      if ((d.status || "active") !== "active") continue;
      if ((d.type || "claim") !== "claim") continue;
      if (String(d.text).length < 80) continue;
      nodes.push({ slug: s, id: d.id, text: NORM(d.text), transcludes: d.transcludes || null });
    }
  }
  const pairs = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].slug === nodes[j].slug) continue;
      if (nodes[i].transcludes || nodes[j].transcludes) continue;
      const score = similarity(nodes[i].text, nodes[j].text);
      if (score >= 0.7) pairs.push({ a: nodes[i].slug + "#" + nodes[i].id, b: nodes[j].slug + "#" + nodes[j].id, similarity: Math.round(score * 1000) / 1000 });
    }
  }
  const THRESHOLD = 3;
  const passing = pairs.length < THRESHOLD;
  let obj56 = "open";
  if (passing && slugs.length >= 10) {
    // corpus-scale scan passing → the metric closes obj-56 automatically, with this receipt as artifact
    try {
      await env.DB.prepare("UPDATE discourse SET status='closed_by_metric', answer=?, answered_by='metric:density' WHERE id='obj-56' AND status='open'")
        .bind("cross-article duplicate pairs " + pairs.length + " < " + THRESHOLD + " across " + slugs.length + " articles (density metric)").run();
      obj56 = "closed_by_metric";
    } catch { /* leave open */ }
  }
  return {
    ok: true, scanned_articles: slugs.length, claim_nodes: nodes.length,
    cross_article_duplicate_pairs: pairs.length, threshold: THRESHOLD, passing,
    scope_note: slugs.length < 10 ? "pilot-scope scan — obj-56 closes only on a corpus-scale (≥10 article) passing scan" : "corpus-scale scan",
    obj_56_status: obj56, pairs: pairs.slice(0, 20),
  };
}

// ── COLD-PROBE HARNESS (W16) ────────────────────────────────────────────────────
// probe-start mints a narrowed probe key + the package a cold model receives.
// probe-grade reads ARTIFACTS (the key's ledgered writes), never self-report.
// Metrics accumulate per article per model family; every new model release is a
// free perturbation — re-probe on release.
async function probeStartAction(env, request, b) {
  if (!(await isBuildAuthed(request, env))) return { error: "unauthorized — the owner starts probes", status: 401 };
  const slug = slugify(b.slug || "philosophy");
  const family = String(b.family || "unknown").toLowerCase().slice(0, 40);
  const model = String(b.model || "").slice(0, 120);
  const minted = await mintShareToken(env, { ttlSec: 3600, scope: "rows:VOXEL_EDIT,VOXEL_MOVE,VOXEL_CONSOLIDATE,VOXEL_DIVIDE", maxUses: 12 });
  const fp = await capFingerprint(minted.token);
  const id = "probe_" + fp.slice(4, 12) + "_" + Math.random().toString(36).slice(2, 6);
  const pkg = [
    "COLD PROBE " + id + " — you are being graded on ARTIFACTS, not on what you say.",
    "1. Read " + "https://miscsubjects.com/api/articles/" + slug + "/bundle?format=markdown — the MASTHEAD opens it.",
    "2. Read https://miscsubjects.com/api/articles/" + slug + "/voxels — DIVs, hashes, chains, the full procedure.",
    "3. Make ONE valid CAS write with this key (edit a DIV: send its CURRENT vx_hash as expected_hash): " + minted.token,
    "4. File one steelmanned objection OR confirm a duplicate (POST /api/protocol/voxel-challenge — no key needed).",
    "5. Close your read: POST /api/protocol/voxel-attest with the content_hash you read and one honest outcome.",
    "6. End your reply to the human with the link each write returned.",
  ].join("\n");
  const rec = { id, slug, family, model, fingerprint: fp, nonce: minted.nonce, started_at: nowIso(), graded: false };
  await env.KV.put("probe:" + id, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 30 });
  return { ok: true, probe_id: id, slug, family, fingerprint: fp, package: pkg, grade_with: "POST /api/protocol/probe-grade {\"probe_id\":\"" + id + "\"}" };
}

async function probeGradeAction(env, request, b) {
  if (!(await isBuildAuthed(request, env))) return { error: "unauthorized — the owner grades probes", status: 401 };
  const id = String(b.probe_id || "").trim();
  const raw = id && (await env.KV.get("probe:" + id));
  if (!raw) return { error: "unknown probe_id: " + id, status: 404 };
  const rec = JSON.parse(raw);
  const cap = "cap:" + rec.fingerprint;
  const uses = parseInt(await env.KV.get("share_use:" + rec.nonce), 10) || 0;
  const rows = (await env.DB.prepare("SELECT stance, status, target_div FROM discourse WHERE actor_cap=?").bind(cap).all()).results || [];
  const grades = {
    key_used: uses > 0,
    cas_write_landed: rows.some((r) => r.stance === "edit"),
    objection_or_dup_filed: rows.some((r) => r.stance === "challenge" || r.status === "duplicate"),
    read_attested: rows.some((r) => r.stance === "attestation"),
    ended_with_link: "UNKNOWN — gradeable only from the model's transcript, not the ledger",
  };
  const score = ["key_used", "cas_write_landed", "objection_or_dup_filed", "read_attested"].filter((k) => grades[k] === true).length;
  const firstGrade = !rec.graded;
  const priorScore = rec.score;
  rec.graded = true; rec.grades = grades; rec.score = score + "/4"; rec.graded_at = nowIso();
  await env.KV.put("probe:" + id, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 90 });
  // per-article per-family metric: one run per probe; a re-grade updates, never double-counts.
  const mk = "probe_metrics:" + rec.slug + ":" + rec.family;
  const m = JSON.parse((await env.KV.get(mk)) || '{"runs":0,"full_passes":0}');
  if (firstGrade) { m.runs += 1; if (score === 4) m.full_passes += 1; }
  else if (priorScore !== rec.score) { if (score === 4) m.full_passes += 1; else if (priorScore === "4/4") m.full_passes -= 1; }
  m.last = { probe: id, score: rec.score, at: rec.graded_at, model: rec.model };
  await env.KV.put(mk, JSON.stringify(m));
  return { ok: true, probe_id: id, slug: rec.slug, family: rec.family, model: rec.model, key_uses: uses, grades, score: rec.score, metrics_key: mk, metrics: m };
}

async function atomize(env, b) {
  const slug = slugify2(b.slug);
  if (!slug) return { error: "need slug" };
  const a = await getRow(env, slug);
  if (!a) return { error: "article not found: " + slug };
  const meta = parseMeta(a.meta);
  const existingClaims = Array.isArray(meta.claims) ? meta.claims : [];
  const minClaims = Number(b.min_claims) || 4;
  if (existingClaims.length >= minClaims && b.force !== true) {
    return {
      ok: true,
      skipped: true,
      slug,
      reason: "already atomized (" + existingClaims.length + " claims) — pass force:true to re-run",
    };
  }
  const model = String(b.model || "grok/grok-4.3");
  const sys =
    OIP_PLAIN_ENGLISH_LAW +
    "\n\n" +
    String(
      b.system_prompt ||
        "You are a claim atomizer. Read the article body. Extract every material assertion as an atomic claim with an honest evidence tier. Attach real sources (primary works, papers, books) with exact quotes where you can verify them; mark claims unsourced when you cannot. NEVER rewrite, summarize, or output the body.",
    ) +
    "\n\nOUTPUT FORMAT — output ONLY one JSON object, no prose, no markdown fence:\n" +
    '{"claims":[{"id":"c1","text":"one assertion","section":"## heading it came from","tier":"human|preclinical|anecdotal|mechanistic|speculative","source_ids":["s1"],"source_status":"unsourced if no source","why_material":"..."}],' +
    '"sources":[{"id":"s1","type":"review|news|business|other","url":"https://real-url","title":"...","quote":"exact passage","summary":"...","claim_ids":["c1"]}]}\n' +
    "Tier mapping for non-medical content: empirically established → human; formally proven / mathematical → mechanistic; historical or textual attribution → anecdotal; metaphysical or interpretive → speculative. Never invent a URL or quote.";
  const user =
    "TITLE: " +
    a.title +
    "\n\nBODY (read-only — atomize, do not rewrite):\n" +
    String(a.body || "").slice(0, 14000) +
    (existingClaims.length
      ? "\n\nEXISTING CLAIM TEXTS (do not duplicate):\n" +
        JSON.stringify(existingClaims.map((c) => c.text).slice(0, 30))
      : "");
  const r = await callModel(
    env,
    model,
    sys,
    user,
    b.max_tokens || 3600,
    b.web_search === true,
  );
  if (r.err) return { error: "model call failed: " + r.err };
  let parsed;
  try {
    parsed = extractJson(r.text);
  } catch (e) {
    return {
      error: "model did not return valid JSON: " + e.message,
      raw_preview: String(r.text).slice(0, 500),
    };
  }
  const normalizeText = (t) =>
    String(t || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const seenTexts = new Set(existingClaims.map((c) => normalizeText(c.text)));
  let maxC = 0;
  existingClaims.forEach((c) => {
    const m = /^c(\d+)$/.exec(String(c.id || ""));
    if (m) maxC = Math.max(maxC, +m[1]);
  });
  const idMap = {};
  const newClaims = [];
  for (const c of Array.isArray(parsed.claims) ? parsed.claims : []) {
    const text = String(c.text || "").trim();
    if (!text || seenTexts.has(normalizeText(text))) continue;
    seenTexts.add(normalizeText(text));
    const tier = String(c.tier || "speculative");
    const id = "c" + ++maxC;
    idMap[String(c.id || "")] = id;
    newClaims.push({
      id,
      text,
      section: String(c.section || ""),
      tier,
      source_ids: Array.isArray(c.source_ids) ? c.source_ids.map(String) : [],
      source_status: c.source_status || (Array.isArray(c.source_ids) && c.source_ids.length ? "sourced" : "unsourced"),
      why_material: String(c.why_material || ""),
      evidence_basis: "atomized",
      weight: BASE_WEIGHT[tier] || 0.1,
      status: "active",
      stance_scores: { neutral: 0, pro: 0, adversary: 0 },
    });
  }
  if (!newClaims.length && !(Array.isArray(parsed.sources) && parsed.sources.length)) {
    return { ok: true, slug, claims_added: 0, sources_added: 0, note: "nothing material to atomize" };
  }
  meta.claims = existingClaims.concat(newClaims);
  await addProv(meta, {
    model,
    action: "atomize",
    prompt: String(b.system_prompt || "").slice(0, 2000),
    input: ("atomize " + slug).slice(0, 2000),
    response: String(r.text).slice(0, 2000),
    tokens_in: r.usage?.prompt_tokens || 0,
    tokens_out: r.usage?.completion_tokens || 0,
  });
  await addContribution(meta, {
    model,
    role: "atomizer",
    action: "atomize",
    payload: { claims: newClaims.map((c) => ({ id: c.id, text: c.text, tier: c.tier })) },
    rationale: "schema conformance: body left untouched, claims atomized",
    tokens_in: r.usage?.prompt_tokens || 0,
    tokens_out: r.usage?.completion_tokens || 0,
  });
  await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
    .bind(JSON.stringify(meta), nowIso(), slug)
    .run();
  // Sources ride the existing hash-chained intake (dedup + link/quote verification).
  let sourcesAdded = 0;
  const srcIn = (Array.isArray(parsed.sources) ? parsed.sources : []).map((s) => ({
    ...s,
    claim_ids: (Array.isArray(s.claim_ids) ? s.claim_ids : []).map((cid) => idMap[String(cid)] || String(cid)),
  }));
  if (srcIn.length) {
    const sres = await sources(env, { slug, model, sources: srcIn, reasoning: "atomize pass" });
    sourcesAdded = sres && sres.added != null ? sres.added : 0;
  }
  const sc = await score(env, { slug }).catch(() => null);
  return {
    ok: true,
    slug,
    claims_added: newClaims.length,
    sources_added: sourcesAdded,
    total_claims: meta.claims.length,
    scored: !!(sc && sc.ok),
    url: "https://miscsubjects.com/a/" + slug,
  };
}
async function contribute(env, b) {
  const slug = slugify(b.slug);
  const existing = await getRow(env, slug);
  if (!existing)
    return { error: "article not found: " + slug + " \u2014 draft it first" };
  const meta = parseMeta(existing.meta);
  const payload = {};
  if (b.title != null) payload.title = String(b.title);
  if (b.body != null) payload.body = String(b.body).slice(0, 20000);
  if (Array.isArray(b.claims)) payload.claims = b.claims;
  if (Array.isArray(b.sources)) payload.sources = b.sources;
  if (b.notes != null) payload.notes = String(b.notes);
  const entry = await addContribution(meta, {
    model: b.model || "unknown",
    role: b.role || "writer",
    action: "contribute",
    payload,
    rationale: String(b.rationale || ""),
    tokens_in: (b.prov && b.prov.tokens_in) || b.tokens_in || 0,
    tokens_out: (b.prov && b.prov.tokens_out) || b.tokens_out || 0,
  });
  if (b.prov) await addProv(meta, b.prov);
  else
    await addProv(meta, {
      model: b.model || "unknown",
      action: "contribute",
      input: slug,
      response: String(payload.title || payload.notes || "contribution").slice(
        0,
        400,
      ),
    });
  await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
    .bind(JSON.stringify(meta), nowIso(), slug)
    .run();
  const models = [...new Set((meta.contributions || []).map((c) => c.model))];
  return {
    ok: true,
    slug,
    contribution_id: entry.id,
    total_contributions: (meta.contributions || []).length,
    distinct_models: models.length,
    models,
    note:
      "head unchanged \u2014 original post recorded. GET /api/articles/" +
      slug +
      "/contributions shows all.",
  };
}
async function runProtocolJob(env, role) {
  const want = String(role || "writer")
    .toLowerCase()
    .trim();
  const r = await fetch("https://miscsubjects.com/api/dispatch", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-terminal-key": String(env.TERMINAL_KEY || ""),
    },
    body: JSON.stringify({
      key: "PROTOCOL_RUN",
      body: want,
    }),
  });
  const text = await r.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      raw: text,
    };
  }
}
async function next(env, role) {
  const want = String(role || "")
    .toLowerCase()
    .trim();
  let row = null;
  if (want === "writer-queue") {
    const {
      WRITER_QUEUE_ORDER_SQL,
      writerQueueBindParams,
      writerQueueInClause,
    } = await import("../../_lib/writer_queue_roles.js");
    row = await env.DB.prepare(
      "UPDATE tasks SET status='running' WHERE id = (SELECT id FROM tasks WHERE status='open' AND LOWER(COALESCE(source,'')) IN (" +
        writerQueueInClause() +
        ") ORDER BY " +
        WRITER_QUEUE_ORDER_SQL +
        " LIMIT 1) RETURNING id, body, source, created_at",
    )
      .bind(...writerQueueBindParams())
      .first();
  } else if (want) {
    row = await env.DB.prepare(
      "UPDATE tasks SET status='running' WHERE id = (SELECT id FROM tasks WHERE status='open' AND LOWER(COALESCE(source,'')) != 'owner' AND LOWER(COALESCE(source,'')) LIKE ? ORDER BY id LIMIT 1) RETURNING id, body, source, created_at",
    )
      .bind("%" + want + "%")
      .first();
  } else {
    // NEVER auto-run owner tasks — they are the owner's, closed only by hand (TASK_COMPLETE) or the UI.
    row = await env.DB.prepare(
      "UPDATE tasks SET status='running' WHERE id = (SELECT id FROM tasks WHERE status='open' AND LOWER(COALESCE(source,'')) != 'owner' ORDER BY id LIMIT 1) RETURNING id, body, source, created_at",
    ).first();
  }
  if (row) {
    let job = null;
    try {
      job = JSON.parse(row.body);
    } catch {}
    return {
      task_id: row.id,
      created_at: row.created_at,
      role: row.source,
      job: job || row.body,
    };
  }
  if (want) {
    const scan =
      (
        await env.DB.prepare(
          "SELECT id, body, source, created_at FROM tasks WHERE status='open' AND LOWER(COALESCE(source,'')) != 'owner' ORDER BY id DESC LIMIT 100",
        ).all()
      ).results || [];
    for (const r of scan) {
      let job = null;
      try {
        job = JSON.parse(r.body);
      } catch {}
      const jrole = String(
        (job && (job.role || job.phase)) || "",
      ).toLowerCase();
      if (jrole.includes(want)) {
        await env.DB.prepare("UPDATE tasks SET status='running' WHERE id=?")
          .bind(r.id)
          .run();
        return {
          task_id: r.id,
          created_at: r.created_at,
          role: r.source,
          job: job || r.body,
        };
      }
    }
  }
  return {
    task_id: null,
    note: "no open task" + (want ? " for role " + want : ""),
  };
}
function contract() {
  const K = "x-terminal-key: <YOUR_TERMINAL_KEY>";
  return {
    protocol: "regeneration",
    base: "https://miscsubjects.com",
    auth: "header x-terminal-key on every mutating call",
    WEB_CHATGPT_RUNTIME: {
      first: "Open https://miscsubjects.com/api/model-lane with the browser/web tool.",
      use: "Configured OpenAI Actions from https://miscsubjects.com/api/openai/actions.json; if only URL opening exists, use GET /api/protocol/voxel-<verb>?fire=1 with URL-encoded fields.",
      never: "Do not use Advanced Data Analysis/code-interpreter Bash, Python, or curl for miscsubjects.com. That sandbox can fail DNS while the site and token are healthy.",
      batch: "Use the voxelBatch Action for document-sized or prolific work. GET payload URLs are only for small writes because URLs have length limits.",
      proof: "A write is complete only when the response returns its real public link or receipt.",
    },
    QUICKSTART_CURL: {
      "A. have Grok write an article and HAND IT BACK (no publish \u2014 reformat then post yourself)":
        "curl -s -X POST https://miscsubjects.com/api/protocol/write -H '" +
        K +
        '\' -H \'content-type: application/json\' -d \'{"publish":false,"web_search":true,"ask":"Write the evidence-graded review of BPC-157"}\'   # returns {output:{title,body,claims,sources}} \u2014 no xAI key needed, Grok runs server-side',
      "B. have Grok write AND publish in one call":
        "curl -s -X POST https://miscsubjects.com/api/protocol/write -H '" +
        K +
        '\' -H \'content-type: application/json\' -d \'{"slug":"bpc-157","web_search":true,"ask":"Write the evidence-graded review of BPC-157"}\'   # writes + publishes -> https://miscsubjects.com/a/bpc-157',
      "C. populate evidence widgets (Grok + web search loops until none new)":
        "curl -s -X POST https://miscsubjects.com/api/protocol/populate -H '" +
        K +
        '\' -H \'content-type: application/json\' -d \'{"peptide":"BPC-157","slug":"bpc-157","max_rounds":3}\'',
      "D. post/replace an article YOURSELF (you supply the JSON)":
        "curl -s -X POST https://miscsubjects.com/api/articles/bpc-157 -H '" +
        K +
        '\' -H \'content-type: application/json\' -d \'{"title":"...","body":"## ...","tags":["peptide"],"claims":[...],"sources":[...]}\'   # PUT = replace head, PATCH = merge (add without erasing), DELETE = remove',
      "E. read an article / its exact re-postable shape":
        "curl -s https://miscsubjects.com/api/articles/bpc-157            # full read\ncurl -s 'https://miscsubjects.com/api/articles/bpc-157?format=post'   # only the fields you re-post",
      writer_prompt_template:
        "Pass your own system_prompt in the body to control voice/rules; the JSON OUTPUT FORMAT (title/body/claims/sources) is appended automatically. Omit it to use the default neutral evidence-graded writer.",
      flags: {
        web_search: "true = live citations (routes to xAI Responses direct)",
        publish: "false = return the JSON, post nothing",
        mode: '"outline" + items:[...] = outlines only',
        max_tokens: "256-8000",
      },
    },
    endpoints: {
      "POST /api/protocol/draft": {
        body: {
          slug: "string",
          title: "string",
          body: "markdown",
          claims:
            "[{ id, text, section, tier(" +
            TIERS.join("|") +
            '), source_ids:[id]|source_status:"unsourced", why_material, extra }]',
          sources:
            "[{ id, type(" +
            SOURCE_TYPES.join("|") +
            "), url, title, quote, summary, claim_ids:[id], extra }]",
          register:
            "one of [" +
            REGISTERS.join("|") +
            "] \u2014 combinatorial pages must be accessible, scientific may be dense",
          meta: "{ style, tags, hero, images, widgets, ... } (open passthrough)",
          prov: "{ model, action, prompt, input, response, tokens_in, tokens_out, cost }",
          verify_sources:
            "bool (default true) \u2014 server fetches each url + checks the quote appears",
        },
        does: "validates schema/tiers/source-refs, dedupes, fetches+verifies sources, hash-chains the source ledger, snapshots the prior revision (append-only), records provenance, publishes",
      },
      "POST /api/protocol/sources": {
        body: {
          slug: "string",
          sources:
            "[{type,url,title,quote,summary,author,publisher,date,claim_ids}]",
          model: "string",
          prov: "{...}",
        },
        does: "attaches + server-verifies sources on an existing article, re-chains the ledger, flips backed claims to source_status:sourced",
      },
      "POST /api/protocol/contribute": {
        body: {
          slug: "string",
          model: "string",
          role: "string",
          title: "?",
          body: "?",
          claims: "?[]",
          sources: "?[]",
          notes: "?",
          rationale: "string",
        },
        does: "records a model's ORIGINAL post on an existing article WITHOUT changing the head \u2014 put N models on one article; all originals preserved + hash-chained",
      },
      "POST /api/protocol/write": {
        body: {
          slug: "string",
          model: "grok/grok-4.3 | @cf/...",
          system_prompt: "string (you control it)",
          ask: "what to write about",
          register: "string",
          max_tokens: "int",
        },
        does: "calls the model with your prompt+input, parses the article JSON, validates+verifies+publishes it end-to-end",
      },
      "POST /api/protocol/review": {
        body: {
          slug: "string",
          role: REVIEW_ROLES.join("|"),
          model: "string",
          rationale: "string",
          checks: "[{name,pass}]",
          contributions: "[{target_claim_id,action,text,score,why_material}]",
          uncertainties: "[string]",
          prov: "{...}",
        },
        does: "stores the pass on the article; non-material passes are logged as energy_spent; call /score to apply weights",
      },
      "POST /api/protocol/oip-seed": {
        body: {
          slugs: "optional string[]; default all OIP root/primer articles",
          models: "optional string[]; default Grok + Gemini + Kimi",
        },
        does: "queues OIP article clarity review tasks in tasks.source=oip-review; cron drains them through PROTOCOL_RUN one at a time",
      },
      "POST /api/protocol/oip-review": {
        body: {
          slug: "oip or oip-* article slug",
          model: "grok/grok-4.3 | gemini/gemini-2.5-flash | kimi/moonshot-v1-8k | @cf/... | ...",
          enqueue_followups: "bool; default true — findings become queued work: existing named slugs get review tasks, missing ones get oip-write tasks, failing reviews get one oip-revise task",
        },
        does: "sends the OIP article bundle to a fresh model, separately scores machine JSON clarity and English clarity, writes OIP_ARTICLE_REVIEW to the append-only ledger, then queues follow-up write/revise/review tasks",
      },
      "POST /api/protocol/oip-write": {
        body: {
          slug: "new oip-* slug (dynamic space)",
          title: "?string working title",
          why: "?string why a reviewer asked for it",
          model: "?string writer model; default free Workers AI",
          force: "?bool overwrite-with-new-version when the slug already exists",
        },
        does: "a model writes a missing OIP article in plain English (acronyms defined, curl shapes, MCP comparison), stores it as append-only oip_articles version 1, queues its first clarity review, and ledgers OIP_ARTICLE_WRITE",
      },
      "POST /api/protocol/oip-revise": {
        body: {
          slug: "primer or machine-written oip-* slug",
          model: "?string revise model; default free Workers AI",
          force: "?bool revise even without recorded reviewer fixes",
        },
        does: "a model rewrites the article applying its reviewers' concrete fixes and named gaps, stores a NEW append-only version, queues a re-review, and ledgers OIP_ARTICLE_REVISE",
      },
      "POST /api/protocol/model-intake": {
        body: "raw text/plain chat log OR JSON {text, source_model, context, target}",
        does: "stores the raw external-model/chat text as MODEL_CHAT_INTAKE in the append-only ledger, then queues an editorial-board task that reads the ledger event and decides what OIP documentation must be purified",
      },
      "POST /api/protocol/editorial-board": {
        body: {
          intake_event_id: "MODEL_CHAT_INTAKE event id",
          model: "?receiving model; default Workers AI",
          purification_model: "?model for later oip-revise tasks",
        },
        does: "a receiving model reads the raw chat ledger event, extracts owner complaints and content-rule defects as machine JSON, ledgers EDITORIAL_BOARD_DECISION, and queues OIP purification tasks without editing article content directly",
      },
      "POST /api/protocol/oip-purify-seed": {
        body: {
          slugs: "?OIP slugs; default all OIP root/primer/dynamic articles",
          model: "?purification model",
          brief: "?rule brief attached to queued jobs",
        },
        does: "queues OIP review/revise tasks under logical-proof-v1. Root/generated pages are re-reviewed; primer/dynamic articles get append-only oip-revise tasks",
      },
      "POST /api/protocol/score": {
        body: {
          slug: "string",
          model: "string",
          tokens_in: "?int",
          tokens_out: "?int",
        },
        does: "recomputes claim weights from adversary/endorsement reviews and updates claim.status (active|downweighted|cut)",
      },
      "POST /api/protocol/inventory": {
        body: {
          kind: "peptide|condition|pharma",
          items: "[{name,evidence}]",
          model: "string",
        },
        does: "upserts enumerated items into the pipeline table (P0)",
      },
      "POST /api/protocol/outline": {
        body: {
          item_id: "int",
          outline: "markdown",
          model: "string",
          reasoning: "string",
        },
        does: "stores an outline on a pipeline item and advances it to phase=outlined (P1)",
      },
      "POST /api/protocol/library-snapshot": {
        body: {
          limit: "int 1-50 (default 20)",
          model: "grok/grok-4.3 | openai/gpt-4o | ..."
        },
        does: "reads published articles, polls a web-search model, and returns a per-article source snapshot with context, claim_type, and weight"
      },
      "POST /api/protocol/ask": {
        body: {
          slug: "string",
          slugs: "optional string[] — explicit multi-article graph",
          question: "string",
          graph: "bool — false forces single article; default auto-expands on condition keywords",
          model: "grok/grok-4.3 (default)",
        },
        does:
          "answers from topology; creates question_node on graph; returns question_node_id, ingest_hint, needs_user_info[], gaps[]",
      },
      "POST /api/protocol/ingest": {
        body: {
          slug: "string",
          evidence: "string — paste from Grok/GPT/Gemini or study",
          question_node_id: "optional — link to prior ask node",
          channel: "imessage|whatsapp|web",
        },
        does:
          "parse evidence → source ledger + claims + evidence_ingest node; use q:NODE_ID| prefix in evidence to link",
      },
      "POST /api/protocol/claim": {
        body: {
          slug: "string",
          text: "string — one falsifiable assertion",
          tier: TIERS.join("|"),
          who_claims: "string — study author, platform, n=, or model id",
          source_ids: "optional [s1,s2] — must exist in hash-chained ledger",
          section: "optional",
          slot:
            "optional constitution slot: " +
            ARTICLE_SLOTS.map((s) => s.id).join("|"),
          channel: "api|imessage|whatsapp|web|llm",
          model: "optional poster id",
        },
        does:
          "prompt-injection style POST — one claim voxel with posted_by provenance; does not rewrite article body",
      },
      "POST /api/protocol/voxel-divide": {
        body: { slug: "string", key: "share token (or owner auth)", force: "bool — re-divide, resets chains" },
        does:
          "atomize the article body into ordered, hashed DIVs (meta.divs) — verbatim, roundtrip-checked, idempotent. Each DIV: own SHA-256 hash + append-only provenance chain. The content becomes the DIV list.",
      },
      "POST /api/protocol/voxel-edit": {
        body: { slug: "string", div_id: "d3", expected_hash: "REQUIRED — the div's CURRENT vx_hash from /api/articles/<slug>/voxels; stale → 409 hash_stale with current text+hash", text: "replacement text (verbatim, markdown ok)", actor: "display name (identity = your key's fingerprint)", key: "voxel-scoped token rows:VOXEL_* (act refused for mutation)" },
        does:
          "replace one DIV's text; chain gains {op:edit, before_sha, after_sha, actor}; body regenerated from the ordered DIVs",
      },
      "POST /api/protocol/voxel-move": {
        body: { slug: "string", div_id: "d3", expected_order: "REQUIRED — the div's CURRENT order; missing → 400, stale → 409 order_stale with the layout", direction: "up|down (or to:<order>)", key: "voxel-scoped token rows:VOXEL_*" },
        does:
          "move a DIV up/down in the order; both swapped DIVs chain the move; body regenerated",
      },
      "POST /api/protocol/voxel-consolidate": {
        body: { slug: "string", div_ids: "[d3,d4,...] — first absorbs the rest", expected_hashes: "REQUIRED — CURRENT vx_hash per div_id, same order", text: "optional merged text", actor: "model", key: "voxel-scoped token rows:VOXEL_*" },
        does:
          "merge DIVs: target absorbs the others (status consolidated, chains intact, never deleted); body regenerated",
      },
      "POST /api/protocol/voxel-challenge": {
        body: { slug: "string", expected_thread_head: "REQUIRED — thread_head from /api/articles/<slug>/discourse ('genesis' when empty); stale → 409 thread_moved with summary", target_div: "optional d3 (then expected_hash REQUIRED)", stance: "challenge|support|upgrade", body: "steelmanned text", actor: "model" },
        does: "open intake, no key — file an argument; near-duplicates 409 duplicate_match to the canonical entry; confirm with duplicate_of to increment independently_raised",
      },
      "POST /api/protocol/voxel-attest": {
        body: { slug: "string", outcome: "novel_objection|duplicate_confirm|upgrade_proposal|nothing_to_add", content_hash: "the body sha you read", actor: "model" },
        does: "the four-outcome close of a keyed read, pinned to the content hash read — a norm, never a lock",
      },
      "POST /api/protocol/voxel-batch": {
        body: { document: "{slug,title,markdown} — whole document → DIVs in one call (new slug: act key; append: voxel scope)", operations: "[{op:edit|move|consolidate|challenge|support|upgrade|attest|vote|claim|source,...}] — ≤300 ops, per-op receipts", actor: "model", key: "token" },
        does: "THE PROLIFIC DOOR — a whole model turn lands on the ledger in one call; honest per-op tally; format precedent at /a/append-protocol",
      },
      "POST /api/protocol/voxel-vote": {
        body: { slug: "string", target: "d3 (optional)", proposal: "should_be_div|should_be_article|should_merge|should_split|should_burn|should_transclude|should_retier", rationale: "why", actor: "model" },
        does: "open proposal — lands status proposed, addressable at birth; a different key ratifies",
      },
      "POST /api/protocol/voxel-ratify": {
        body: { vote_id: "vote-…", decision: "approve|reject", note: "one line", key: "owner or rows:VOXEL_RATIFY" },
        does: "memorializes the decision with the ratifier's capability identity; once per vote; execution stays a separate verb citing the vote link",
      },
      "POST /api/protocol/voxel-burn": {
        body: { ids: "[discourse row ids] or older_than_days: 14", reason: "REQUIRED", key: "owner or rows:VOXEL_RATIFY" },
        does: "retire dead energy — status burned, bytes+chains kept, out of the strips, never deleted",
      },
      "POST /api/protocol/repair": {
        body: {
          slug: "string",
          materialize_orphans: "bool (default true) — orphan sources → who_claims_what claims",
          backfill_posted_by: "bool (default true)",
        },
        does:
          "wire claim↔source graph, backfill posted_by, materialize orphan sources; re-chain source ledger",
      },
      "POST /api/protocol/fill-slots": {
        body: { slug: "string" },
        does:
          "synthesize missing required constitution slot claims from existing ledger topology",
      },
      "POST /api/protocol/retract": {
        body: { slug: "string", claim_id: "string", reason: "string" },
        does:
          "mark claim status:retracted — stays on ledger, excluded from ask; retraction event appended",
      },
      "POST /api/protocol/challenge": {
        body: {
          slug: "string",
          target_claim_id: "string",
          text: "counter-evidence assertion",
          tier: "optional",
          source_ids: "optional",
        },
        does:
          "append adversary challenge claim linked to target; may downweight target",
      },
      "POST /api/protocol/scrub": {
        body: { slug: "string", dry_run: "bool — scan only" },
        does:
          "detect leaked secrets in article meta/body; redact with scrub_events tombstone (auth required)",
      },
      "POST /api/protocol/collaborate": {
        body: {
          slug: "string",
          model:
            "kimi/moonshot-v1-8k (default) | gemini/gemini-2.5-flash — collaborator #2",
        },
        does:
          "External model reads topology, posts 1–3 claims with posted_by, optional adversary challenge — multi-model writeback",
      },
      "POST /api/protocol/reflex": {
        body: { slug: "string (default protocol)" },
        does:
          "live probes vs vision claims — posts reflex conformance claims with proves/responds_to edges; graph proves its own shape",
      },
      "POST /api/protocol/grow": {
        body: { slug: "optional", step: "populate|kimi_collaborate|gemini_collaborate|repair|reflex", batch: "int 1-5", slugs: "optional[]" },
        does:
          "model growth queue — auto-picks slug, runs one pipeline step; returns _self + _explain + plans; batch=N runs N ticks",
      },
      "GET /api/protocol/grow": {
        does: "returns MODEL_GROW_QUEUE pipeline definition with what/why/how per step",
      },
      "GET /api/articles/<slug>/health":
        "ledger durability audit — orphan sources, missing posted_by, constitution slots",
      "GET /api/articles/<slug>/graph-topology":
        "?slugs=a,b,c or ?question=... — merged claims/sources across condition+stack articles",
      "GET /api/articles/<slug>/topology":
        "public JSON bundle for ROUTER GET-before-answer",
      "GET /api/articles/<slug>/prompts":
        "auto-suggested iMessage/WhatsApp prompts from claims and anecdotes",
      "POST /api/protocol/poll": {
        body: {
          slug: "string",
          model: "grok/grok-4.3 | @cf/moonshotai/kimi-k2.6",
          max_tokens: "int",
        },
        does:
          "multi-model enrichment pass \u2014 additive plain-English sections, claims, sources; legibility-gated; records a model swipe in meta.contributions",
      },
      "POST /api/protocol/run?role=writer":
        "manual one-tick protocol runner (cron uses this internally) \u2014 claims the next open task, runs it, and closes/reopens it",
      "GET /api/protocol/next?role=writer":
        "atomically claim the next open task (sets status=running so it is not double-pulled)",
      "GET /api/articles/<slug>/sources":
        "the hash-chained source ledger + verify{valid,head}",
      "GET /api/articles/<slug>/contributions":
        "every model's original post on this article (all N), hash-chained + verify{valid,head}",
      "GET /api/articles/<slug>/provenance":
        "the hash-chained write/edit ledger + verify{valid,head}",
      "GET /api/articles/<slug>/revisions":
        "list of preserved prior revisions (append-only); GET /api/articles/<slug>?rev=n returns one verbatim",
    },
    invariants: [
      "append-only \u2014 PUT/PATCH never erase; the original is always at ?rev=0",
      "DELETE is blocked on protocol/tier0 articles \u2014 retract via a revision",
      "sources verified server-side, never by model vote",
      "a verified chain proves integrity, not truth",
    ],
    enums: {
      tier: TIERS,
      source_type: SOURCE_TYPES,
      review_role: REVIEW_ROLES,
      register: REGISTERS,
    },
  };
}
// Ingest user-submitted evidence (model export, study paste) → source ledger + claims + question graph.
async function ingest(env, b) {
  const slug = slugify2(b.slug);
  let evidence = String(b.evidence || b.text || b.body || "").trim();
  let question_node_id = b.question_node_id || b.qid || null;
  if (!slug) return { error: "need slug" };
  if (!evidence) return { error: "need evidence text" };

  if (evidence.startsWith("q:")) {
    const qm = /^q:([a-z0-9_-]+)\|/i.exec(evidence);
    if (qm) {
      question_node_id = question_node_id || qm[1];
      evidence = evidence.slice(qm[0].length).trim();
    }
  }
  if (!evidence) return { error: "need evidence after q:node_id|" };

  const row = await getRow(env, slug);
  if (!row) return { error: "article not found: " + slug };

  let qContext = null;
  if (question_node_id) {
    try {
      qContext = await env.DB.prepare(
        "SELECT question, gaps_json, needs_json FROM question_nodes WHERE node_id=?",
      )
        .bind(question_node_id)
        .first();
    } catch {}
  }

  let parsed;
  let modelUsage = { prompt_tokens: 0, completion_tokens: 0 };
  if (b.deterministic) {
    parsed = {
      summary: String(b.summary || "Deterministic ingest").slice(0, 2000),
      sources: Array.isArray(b.sources) ? b.sources : [],
      claims: Array.isArray(b.claims) ? b.claims : [],
    };
    if (!parsed.sources.length && evidence) {
      parsed.sources = [
        {
          type: "anecdotal",
          title: "Ingested evidence",
          quote: evidence.slice(0, 2000),
          summary: parsed.summary,
        },
      ];
    }
  } else {
  const model = String(b.model || "grok/grok-4.3");
  const sys =
    "You parse user-submitted evidence for a peptide article evidence ledger. " +
    "Extract factual claims and citable sources. Tier-honest: mark preclinical vs human vs anecdotal. " +
    "Never invent URLs — leave url empty if not in the paste. Plain English summary.\n\n" +
    "Output ONLY one JSON object:\n" +
    '{"summary":"...","sources":[{"type":"pubmed|reddit|anecdotal|review|clinical_trial|other","url":"","title":"","quote":"","summary":"","tier_hint":"human|preclinical|anecdotal|mechanistic"}],"claims":[{"text":"...","tier":"preclinical|anecdotal|human|mechanistic|speculative","section":"Ingested evidence","why_material":"..."}]}';
  const userCtx = qContext
    ? "LINKED QUESTION: " +
      qContext.question +
      "\nGAPS: " +
      (qContext.gaps_json || "[]") +
      "\nNEEDS: " +
      (qContext.needs_json || "[]") +
      "\n\n"
    : "";
  const r = await callModel(
    env,
    model,
    sys,
    userCtx + "EVIDENCE TO PARSE:\n" + evidence.slice(0, 14000),
    b.max_tokens || 2800,
    false,
  );
  if (r.err) return { error: "model parse failed: " + r.err };
  modelUsage = r.usage || modelUsage;

  try {
    parsed = extractJson(r.text);
  } catch (e) {
    return {
      error: "model did not return valid JSON: " + e.message,
      raw_preview: String(r.text).slice(0, 600),
    };
  }
  }

  const ingestModel = b.deterministic ? "deterministic" : String(b.model || "grok/grok-4.3");
  const srcOut = await sources(env, {
    slug,
    model: "ingest:" + ingestModel,
    sources: (parsed.sources || []).map((s, i) => ({
      type: s.type || "anecdotal",
      url: s.url || "",
      title: s.title || "Ingested evidence " + (i + 1),
      quote: s.quote || evidence.slice(0, 500),
      summary: s.summary || parsed.summary || "",
      found_by: b.channel || "user-ingest",
      extra: { question_node_id, ingest_channel: b.channel || "imessage" },
    })),
    rationale: "User evidence ingest" + (question_node_id ? " for " + question_node_id : ""),
  });
  if (srcOut.error) return srcOut;

  const addedSourceIds = (srcOut.added_detail || []).map((s) => s.id);
  const addedClaimIds = [];

  if (Array.isArray(parsed.claims) && parsed.claims.length) {
    const fresh = await getRow(env, slug);
    const meta = parseMeta(fresh.meta);
    const claims = Array.isArray(meta.claims) ? meta.claims.map((c) => ({ ...c })) : [];
    let maxN = 0;
    claims.forEach((c) => {
      const m = /^c(\d+)$/.exec(String(c.id || ""));
      if (m) maxN = Math.max(maxN, +m[1]);
    });
    const ingestSources = Array.isArray(parsed.sources) ? parsed.sources : [];
    for (let ci = 0; ci < parsed.claims.length; ci++) {
      const cl = parsed.claims[ci];
      const srcMeta = ingestSources[ci] || ingestSources[0] || {};
      const id = "c" + ++maxN;
      const tier = TIERS.includes(String(cl.tier)) ? String(cl.tier) : "anecdotal";
      const slot =
        cl.slot ||
        inferSlotFromSource(
          {
            type: srcMeta.type,
            url: srcMeta.url,
            summary: srcMeta.summary || parsed.summary,
            title: srcMeta.title,
            quote: srcMeta.quote,
          },
          cl.text,
        );
      claims.push(
        enrichClaim(
          {
            id,
            text: String(cl.text || "").slice(0, 2000),
            tier,
            weight: BASE_WEIGHT[tier] || 0.3,
            section: String(cl.section || slot || "Ingested evidence"),
            slot,
            source_ids: addedSourceIds,
            source_status: addedSourceIds.length ? "sourced" : "unsourced",
            why_material: String(cl.why_material || "User-submitted evidence ingest"),
            status: "active",
            who_claims: cl.who_claims || b.author || b.channel || "user-ingest",
          },
          {
            model: "ingest:" + ingestModel,
            channel: b.channel || "imessage",
            author: b.author || "user",
          },
        ),
      );
      addedClaimIds.push(id);
    }
    let sources = Array.isArray(meta.sources) ? meta.sources.map((s) => ({ ...s })) : [];
    const wired = wireClaimSourceGraph(claims, sources);
    meta.claims = wired.claims;
    meta.sources = wired.sources;
    await addContribution(meta, {
      model: "ingest:" + ingestModel,
      role: "ingest",
      action: "ingest_claims",
      payload: { claim_ids: addedClaimIds, question_node_id, summary: parsed.summary },
      rationale: String(parsed.summary || "").slice(0, 400),
      tokens_in: modelUsage.prompt_tokens || 0,
      tokens_out: modelUsage.completion_tokens || 0,
    });
    await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
      .bind(JSON.stringify(meta), nowIso(), slug)
      .run();
  }

  const evNode = await createEvidenceIngest(env, {
    slug,
    question_node_id,
    channel: b.channel || "imessage",
    author: b.author || "user",
    raw_text: evidence,
    summary: parsed.summary || "",
    source_ids: addedSourceIds,
    claim_ids: addedClaimIds,
    model: "ingest:" + ingestModel,
  });

  return {
    ok: true,
    slug,
    deterministic: !!b.deterministic,
    question_node_id: question_node_id || null,
    ingest_id: evNode.ingest_id,
    summary: parsed.summary || "",
    sources_added: srcOut.added || 0,
    source_ids: addedSourceIds,
    claim_ids: addedClaimIds,
    url: "https://miscsubjects.com/a/" + slug,
    topology_url: "https://miscsubjects.com/api/articles/" + slug + "/topology",
    question_graph_url:
      "https://miscsubjects.com/api/articles/" + slug + "/question-graph",
    message:
      "Logged to ledger — " +
      (srcOut.added || 0) +
      " source(s)" +
      (addedClaimIds.length ? ", " + addedClaimIds.length + " claim(s)" : "") +
      (question_node_id ? " · linked to " + question_node_id : ""),
  };
}

// Answer from article topology only — honest gaps, no invented dosing/medical advice.
/** Model growth queue — one tick of populate/collaborate/repair/reflex with full explainability. */
async function grow(env, b, url) {
  const batch = Number(b.batch || url?.searchParams?.get("batch") || 0);
  if (batch > 1) {
    return runGrowBatch(env, {
      count: batch,
      slugs: b.slugs,
      all: b.all || b.corpus,
      corpus: b.corpus || b.all,
      slug: slugify2(b.slug),
      step: b.step,
      force: b.force,
    });
  }
  return runGrowTick(env, {
    slugs: Array.isArray(b.slugs) ? b.slugs.map((s) => slugify2(s)) : null,
    all: b.all || b.corpus,
    corpus: b.corpus || b.all,
    slug: slugify2(b.slug),
    step: b.step,
    force: b.force,
    excludeSlugs: Array.isArray(b.excludeSlugs) ? b.excludeSlugs.map((s) => slugify2(s)) : [],
  });
}

/** Live reflex pass — probe APIs vs protocol vision claims, stain graph with conformance. */
async function reflex(env, b) {
  const out = await runReflexPass(env, {
    slug: slugify2(b.slug) || "protocol",
    model: b.model || "system/reflex",
  });
  if (out.error) return out;
  return attachSelf(out, "protocol_reflex", {
    contains: "reflex conformance claims + probe results",
    how_to_use:
      "POST /api/protocol/reflex then GET /api/graph?slugs=protocol,bpc-157&layer=reflex",
  });
}

/** Record a question node without LLM (deterministic graph seed). */
async function recordQuestion(env, b) {
  const slug = slugify2(b.slug);
  const question = String(b.question || b.q || "").trim();
  if (!slug) return { error: "need slug" };
  if (!question) return { error: "need question" };
  const qNode = await createQuestionNode(env, {
    primary_slug: slug,
    slugs: Array.isArray(b.slugs) ? b.slugs.map((s) => slugify2(s)).filter(Boolean) : [slug],
    question,
    answer: String(b.answer || "").slice(0, 2000),
    confidence: b.confidence || "high",
    cited_claim_ids: b.cited_claim_ids || [],
    cited_source_ids: b.cited_source_ids || [],
    gaps: b.gaps || [],
    channel: b.channel || "protocol/question",
    author: b.author || "system/question",
  });
  if (qNode.error) return qNode;
  return {
    ok: true,
    slug,
    question_node_id: qNode.node_id,
    ingest_hint: qNode.ingest_hint,
    question_graph_url: "/api/articles/" + slug + "/question-graph",
  };
}

async function ask(env, b) {
  const slug = slugify2(b.slug);
  const question = String(b.question || b.q || b.ask || "").trim();
  if (!slug && !(Array.isArray(b.slugs) && b.slugs.length)) return { error: "need slug" };
  if (!question) return { error: "need question" };

  const explicitSlugs = Array.isArray(b.slugs)
    ? b.slugs.map((s) => slugify2(s)).filter(Boolean)
    : [];
  let resolved_slugs = explicitSlugs.length
    ? explicitSlugs
    : resolveAskSlugs(question, slug);
  if (!resolved_slugs.length && slug) resolved_slugs = [slug];
  if (b.graph === false) resolved_slugs = [resolved_slugs[0] || slug];
  const multi = b.graph !== false && resolved_slugs.length > 1;

  const topoOpts = { user_limit: 16, related_limit: 6 };
  let topo;
  if (multi) {
    topo = await loadGraphTopology(env, resolved_slugs, topoOpts);
  } else {
    topo = await loadArticleTopology(env, resolved_slugs[0] || slug, topoOpts);
  }
  if (topo.error) return { error: topo.error };

  const primary = multi ? topo.primary_slug || resolved_slugs[0] : topo.slug;
  const model = String(b.model || "grok/grok-4.3");
  const sys =
    "You are the miscsubjects peptide evidence assistant. Answer ONLY from the ARTICLE TOPOLOGY JSON provided. " +
    (multi
      ? "This is a GRAPH topology spanning multiple articles — cite global_id (article_slug:claim_id) when referencing claims/sources. "
      : "Cite claim ids and source ids you rely on. ") +
    "Separate scientific evidence from anecdotes by tier and source type. " +
    "Claims are pre-ranked safety-first: when the question is about safety, interactions, or whether something is safe to combine, cite interaction_risk / limitations-slot claims FIRST, before who_claims_what marketing volume. Treat quote_gated:true claims as low-confidence. " +
    "If the question needs information NOT in the topology (patient specifics, dosing, diagnosis), say clearly what you do NOT know " +
    "and list needs_user_info[] — things you would need the person to tell you. " +
    "For stack/condition questions: say what the catalogue covers, what it does NOT cover, and what you'd need to know. " +
    "Never prescribe doses or tell someone to take a peptide. Not medical advice. Plain English. " +
    "Topology excludes retracted/cut claims — do not cite them; if honesty.retractions exist, note that bad claims may have been retracted but remain auditable at ?include_inactive=1.\n\n" +
    "Output ONLY one JSON object:\n" +
    '{"answer":"...","confidence":"high|medium|low|unknown","cited_claim_ids":[],"cited_source_ids":[],"needs_user_info":[],"gaps":[],"related_slugs":[],"disclaimer":"not medical advice"}';
  const user =
    "QUESTION: " +
    question +
    "\n\nTOPOLOGY:\n" +
    JSON.stringify(topo).slice(0, 28000);
  const r = await callModel(env, model, sys, user, b.max_tokens || 2400, false);
  if (r.err) return { error: "model call failed: " + r.err };
  let parsed;
  try {
    parsed = extractJson(r.text);
  } catch (e) {
    return {
      error: "model did not return valid JSON: " + e.message,
      raw_preview: String(r.text).slice(0, 600),
      topology_url: "https://miscsubjects.com/api/articles/" + slug + "/topology",
    };
  }
  const row = await getRow(env, primary);
  if (row) {
    const meta = parseMeta(row.meta);
    await addContribution(meta, {
      model,
      role: "ask",
      action: "ask",
      payload: {
        question: question.slice(0, 500),
        answer: String(parsed.answer || "").slice(0, 2000),
        cited_claim_ids: parsed.cited_claim_ids || [],
        cited_source_ids: parsed.cited_source_ids || [],
        needs_user_info: parsed.needs_user_info || [],
        gaps: parsed.gaps || [],
        resolved_slugs,
        graph: multi,
      },
      rationale: "Q: " + question.slice(0, 200),
      tokens_in: r.usage?.prompt_tokens || 0,
      tokens_out: r.usage?.completion_tokens || 0,
    });
    await addProv(meta, {
      model,
      action: "ask",
      input: question.slice(0, 800),
      response: String(parsed.answer || "").slice(0, 1500),
      tokens_in: r.usage?.prompt_tokens || 0,
      tokens_out: r.usage?.completion_tokens || 0,
    });
    await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
      .bind(JSON.stringify(meta), nowIso(), primary)
      .run();
  }

  const qNode = await createQuestionNode(env, {
    primary_slug: primary,
    slugs: resolved_slugs,
    question,
    answer: parsed.answer || "",
    confidence: parsed.confidence || "unknown",
    cited_claim_ids: parsed.cited_claim_ids || [],
    cited_source_ids: parsed.cited_source_ids || [],
    needs_user_info: parsed.needs_user_info || [],
    gaps: parsed.gaps || [],
    channel: b.channel || "ask",
    author: b.author || "anonymous",
    parent_node_id: b.parent_node_id || b.question_node_id || null,
  });
  const qn = qNode.error ? {} : qNode;

  const suggested_followups = followUpPrompts(topo, 3);
  const ingest_hint = qn.node_id
    ? (parsed.gaps || []).length
      ? "Have evidence? Text: ingest " +
        primary +
        "|q:" +
        qn.node_id +
        "|paste from Grok/GPT/Gemini or a study"
      : qn.ingest_hint
    : null;

  return {
    ok: true,
    slug: primary,
    resolved_slugs,
    graph: multi,
    question,
    question_node_id: qn.node_id || null,
    ingest_hint,
    model,
    answer: parsed.answer || "",
    confidence: parsed.confidence || "unknown",
    cited_claim_ids: parsed.cited_claim_ids || [],
    cited_source_ids: parsed.cited_source_ids || [],
    needs_user_info: parsed.needs_user_info || [],
    gaps: parsed.gaps || [],
    related_slugs: parsed.related_slugs || [],
    suggested_followups,
    disclaimer: parsed.disclaimer || "not medical advice",
    topology_url:
      "https://miscsubjects.com/api/articles/" +
      primary +
      (multi ? "/graph-topology?slugs=" + resolved_slugs.join(",") : "/topology"),
    prompts_url: "https://miscsubjects.com/api/articles/" + primary + "/prompts",
    url: "https://miscsubjects.com/a/" + primary,
  };
}

/** Reject model prose that would wreck canonical legibility (plain English ledger). */
function legibilityGate(text) {
  const t = String(text || "").trim();
  if (!t) return { pass: true, reasons: [] };
  const words = t.split(/\s+/).filter(Boolean);
  const reasons = [];
  if (words.length >= 16) {
    const avg =
      words.reduce((s, w) => s + w.replace(/[^a-zA-Z]/g, "").length, 0) /
      words.length;
    if (avg > 8.2) reasons.push("avg_word_length_high");
    const longFrac = words.filter((w) => w.length > 13).length / words.length;
    if (longFrac > 0.14) reasons.push("too_many_long_words");
  }
  const jargon = (
    t.match(
      /\b(utilize|leverage|synergistic|peptidomimetic|pharmacokinetic|pleiotropic|paradigm shift|upregulates? the|downregulates? the)\b/gi,
    ) || []
  ).length;
  if (jargon > 2) reasons.push("jargon_density");
  if (/\b(you should take|patients must|prescribe|dose \d+\s*mg)\b/i.test(t))
    reasons.push("medical_advice");
  return { pass: reasons.length === 0, reasons };
}

const KIMI_COLLABORATOR = "kimi/moonshot-v1-8k";
const KIMI_COLLABORATOR_FALLBACKS = [
  "kimi/moonshot-v1-8k",
  "@cf/moonshotai/kimi-k2.6",
  "@cf/moonshotai/kimi-k2-instruct",
];
const GEMINI_COLLABORATOR = "gemini/gemini-2.5-flash";
const GEMINI_COLLABORATOR_FALLBACKS = [
  "gemini/gemini-2.5-flash",
  "gemini/gemini-2.0-flash",
  "google/gemini-1.5-flash",
];

function collaboratorProfile(model) {
  const m = String(model || "").toLowerCase();
  if (m.startsWith("gemini/") || m.startsWith("google/")) {
    return {
      label: "Gemini",
      who_claims: "gemini-collaborator",
      self_tag: "gemini_collaborator",
      fallbacks: GEMINI_COLLABORATOR_FALLBACKS,
      identity: "collaborator #2 (cheap Gemini, after Kimi)",
      not_peers: "you are not Grok and you are not Kimi",
    };
  }
  return {
    label: "Kimi",
    who_claims: "kimi-collaborator",
    self_tag: "kimi_collaborator",
    fallbacks: KIMI_COLLABORATOR_FALLBACKS,
    identity: "collaborator #1 on the miscsubjects peptide evidence ledger",
    not_peers: "you are not Grok",
  };
}

/** Multi-model collaborator — read topology, post claims, optional challenge. */
async function collaborate(env, b) {
  const slug = slugify2(b.slug);
  if (!slug) return { error: "need slug" };
  const row = await getRow(env, slug);
  if (!row) return { error: "article not found: " + slug };
  const profile = collaboratorProfile(b.model);
  const modelCandidates = b.model ? [String(b.model)] : profile.fallbacks;
  const topo = await loadArticleTopology(env, slug, { include_inactive: false });
  if (topo.error) return { error: topo.error };

  const requireChallenge = b.require_challenge === true;
  const sys =
    OIP_PLAIN_ENGLISH_LAW + "\n\n" +
    `You are ${profile.label} — ${profile.identity} (${profile.not_peers}). ` +
    "Read the topology. ADD 1–3 tier-honest claims the ledger lacks — use slots what_is_known (for human/preclinical findings), what_is_unknown (gaps), mechanism (pathways), who_claims_what (anecdotes only). " +
    "Use ONLY source_ids that appear in the topology. Never invent URLs. " +
    (requireChallenge
      ? "You MUST challenge exactly ONE weak claim (unsourced, overstrong human tier, or marketing dressed as science) with counter-evidence from topology. "
      : "Optionally challenge ONE weak claim (unsourced or overstrong) with counter-evidence from topology. ") +
    "No medical advice. No doses. Plain English.\n\n" +
    "Output ONLY one JSON object:\n" +
    '{"material":true,"rationale":"what you added and why you are not Grok","claims_add":[' +
    '{"text":"one assertion","tier":"human|preclinical|anecdotal|mechanistic|speculative","slot":"what_is_unknown|who_claims_what|what_is_known|limitations","source_ids":["s1"],"why_material":"..."}' +
    '],"challenge":{"target_claim_id":"c1","text":"counter-evidence","tier":"mechanistic","why_material":"..."}|null}\n' +
    'If nothing material: {"material":false,"rationale":"..."}';

  const user = JSON.stringify({
    slug,
    title: row.title,
    claims_active: (topo.claims || []).slice(0, 16),
    sources_sample: (topo.sources || []).slice(0, 10).map((s) => ({
      id: s.id,
      type: s.type,
      title: s.title,
    })),
    honesty: topo.honesty,
    instruction:
      "State explicit gaps (what_is_unknown). Name who claims what from anecdotes if missing.",
  }).slice(0, 14000);

  const maxTok = Math.max(2048, Number(b.max_tokens) || 4096);
  let r = null;
  let model = modelCandidates[0];
  const tries = [];
  let parsed = null;
  for (const mdl of modelCandidates) {
    model = mdl;
    for (let attempt = 0; attempt < 3; attempt++) {
      r = await callModel(env, mdl, sys, user, maxTok, false);
      tries.push({
        model: mdl,
        attempt: attempt + 1,
        err: r.err || null,
        chars: (r.text || "").length,
      });
      if (r.err || !String(r.text || "").trim()) continue;
      try {
        parsed = extractJson(r.text);
        break;
      } catch (e) {
        tries[tries.length - 1].parse_err = e.message;
      }
    }
    if (parsed) break;
  }
  if (!r || r.err)
    return { error: "collaborator model failed: " + (r?.err || "no response"), tries };
  if (!parsed)
    return {
      error: "collaborator JSON parse failed after retries",
      model,
      tries,
      raw_preview: String(r.text || "").slice(0, 600),
    };

  if (parsed.material === false) {
    const meta = parseMeta(row.meta);
    await addContribution(meta, {
      model,
      role: "collaborator",
      action: "collaborate",
      payload: { material: false, notes: parsed.rationale },
      rationale: String(parsed.rationale || ""),
      tokens_in: r.usage?.prompt_tokens || 0,
      tokens_out: r.usage?.completion_tokens || 0,
    });
    await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
      .bind(JSON.stringify(meta), nowIso(), slug)
      .run();
    return {
      ok: true,
      slug,
      model,
      material: false,
      rationale: parsed.rationale || "",
      tokens_in: r.usage?.prompt_tokens || 0,
      tokens_out: r.usage?.completion_tokens || 0,
    };
  }

  const prevMeta = parseMeta(row.meta);
  const meta = Object.assign({}, prevMeta);
  await pushRevision(env, meta, row, prevMeta);

  const validSourceIds = new Set((meta.sources || []).map((s) => String(s.id)));
  let claimList = Array.isArray(meta.claims)
    ? meta.claims.map((c) => ({ ...c }))
    : [];
  let maxC = 0;
  claimList.forEach((c) => {
    const m = /^c(\d+)$/.exec(String(c.id || ""));
    if (m) maxC = Math.max(maxC, +m[1]);
  });

  const addedClaimIds = [];
  for (const c of Array.isArray(parsed.claims_add) ? parsed.claims_add : []) {
    const text = String(c.text || "").trim();
    if (!text) continue;
    const tier = TIERS.includes(String(c.tier)) ? String(c.tier) : "mechanistic";
    const source_ids = (Array.isArray(c.source_ids) ? c.source_ids : [])
      .map(String)
      .filter((id) => validSourceIds.has(id));
    const id = "c" + ++maxC;
    const srcForSlot = source_ids.length
      ? (meta.sources || []).find((s) => s.id === source_ids[0])
      : null;
    const slot =
      c.slot ||
      (srcForSlot ? inferSlotFromSource(srcForSlot, text) : null) ||
      (tier === "anecdotal" ? "who_claims_what" : "what_is_unknown");
    claimList.push(
      enrichClaim(
        {
          id,
          text,
          tier,
          weight: BASE_WEIGHT[tier] || 0.3,
          section: String(c.section || slot || "Collaborator addition"),
          slot,
          source_ids,
          source_status: source_ids.length ? "sourced" : "unsourced",
          why_material: String(c.why_material || profile.label + " collaborator pass"),
          status: "active",
          who_claims: profile.who_claims,
        },
        {
          model,
          channel: "protocol/collaborate",
          actor: model,
        },
      ),
    );
    addedClaimIds.push(id);
  }

  meta.claims = claimList;
  let challenge_id = null;
  if (parsed.challenge && parsed.challenge.target_claim_id) {
    const ch = challengeClaimInMeta(
      meta,
      String(parsed.challenge.target_claim_id),
      {
        text: parsed.challenge.text,
        tier: parsed.challenge.tier,
        who_claims: model + " (adversary)",
        why_material: parsed.challenge.why_material,
      },
      { actor: model, model, channel: "protocol/collaborate" },
    );
    if (!ch.error) {
      challenge_id = ch.challenge_claim_id;
      claimList = ch.meta.claims;
      meta.challenges = ch.meta.challenges;
    }
  }
  if (requireChallenge && !challenge_id && claimList.length) {
    const skipAdversary = (c) =>
      ["disclaimer", "what_it_is"].includes(c.slot) ||
      String(c.who_claims || "").includes("miscsubjects");
    const target =
      claimList
        .filter(
          (c) =>
            c.status !== "retracted" &&
            !(c.challenged_by || []).length &&
            !skipAdversary(c) &&
            !(c.source_ids || []).length &&
            ["preclinical", "human", "mechanistic", "speculative"].includes(
              String(c.tier),
            ),
        )
        .sort((a, b) => (b.weight || 0) - (a.weight || 0))[0] ||
      claimList.find(
        (c) =>
          c.status !== "retracted" &&
          !(c.challenged_by || []).length &&
          !skipAdversary(c) &&
          (c.source_ids || []).length &&
          c.tier === "preclinical" &&
          (c.weight || 0) >= 0.45,
      );
    if (target) {
      const ch = challengeClaimInMeta(
        meta,
        String(target.id),
        {
          text:
            String(parsed.rationale || "").slice(0, 400) ||
            `${profile.label} adversary: claim ${target.id} is overstrong or unsourced — topology does not support this weight.`,
          tier: "mechanistic",
          who_claims: model + " (adversary)",
          why_material: "Required adversary pass — downweight pending verification",
        },
        { actor: model, model, channel: "protocol/collaborate-adversary" },
      );
      if (!ch.error) {
        challenge_id = ch.challenge_claim_id;
        claimList = ch.meta.claims;
        meta.challenges = ch.meta.challenges;
      }
    }
  }

  const wired = wireClaimSourceGraph(claimList, meta.sources || []);
  meta.claims = wired.claims;
  meta.sources = wired.sources;

  const entry = await addContribution(meta, {
    model,
    role: "collaborator",
    action: "collaborate",
    payload: {
      claims_added: addedClaimIds,
      challenge_id,
      rationale: parsed.rationale,
    },
    rationale: String(parsed.rationale || "").slice(0, 800),
    tokens_in: r.usage?.prompt_tokens || 0,
    tokens_out: r.usage?.completion_tokens || 0,
  });

  await addProv(meta, {
    model,
    action: "collaborate",
    input: slug,
    response: String(parsed.rationale || "").slice(0, 2000),
    tokens_in: r.usage?.prompt_tokens || 0,
    tokens_out: r.usage?.completion_tokens || 0,
  });

  await createEvidenceIngest(env, {
    slug,
    channel: "collaborate",
    author: model,
    raw_text: String(r.text || "").slice(0, 12000),
    summary: String(parsed.rationale || profile.label + " collaborator pass").slice(0, 500),
    source_ids: [],
    claim_ids: addedClaimIds,
    model,
  });

  await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
    .bind(JSON.stringify(meta), nowIso(), slug)
    .run();

  const fresh = parseMeta((await getRow(env, slug)).meta);
  return attachSelf(
    {
      ok: true,
      slug,
      model,
      collaborator: model,
      material: true,
      contribution_id: entry.id,
      claims_added: addedClaimIds,
      challenge_claim_id: challenge_id,
      honesty: honestySummary(fresh),
      voxels_url: "/api/articles/" + slug + "/voxels",
      url: "https://miscsubjects.com/a/" + slug,
      tokens_in: r.usage?.prompt_tokens || 0,
      tokens_out: r.usage?.completion_tokens || 0,
    },
    profile.self_tag,
    { slug, contains: profile.label + " multi-model collaborator writeback" },
  );
}

/** Rewrite article body from ledger topology — comprehensive plain English. */
async function synthesizeBody(env, b) {
  const slug = slugify2(b.slug);
  if (!slug) return { error: "need slug" };
  const row = await getRow(env, slug);
  if (!row) return { error: "article not found: " + slug };
  const prevMeta = parseMeta(row.meta);
  const claimsN = (prevMeta.claims || []).length;
  if (claimsN < 5 && !b.force) {
    return {
      error: "need at least 5 claims — populate/repair first",
      claims: claimsN,
    };
  }
  if (!b.force && !bodyNeedsReaderProse(row.body, prevMeta, slug)) {
    return {
      ok: true,
      skipped: true,
      slug,
      reason: "body already adequate",
      chars: String(row.body || "").length,
      url: "https://miscsubjects.com/a/" + slug,
    };
  }

  const topo = await loadArticleTopology(env, slug, { include_inactive: false });
  if (topo.error) return { error: topo.error };

  const model = String(b.model || "grok/grok-4.3");
  const mode = classifyArticleMode(slug, row.title, prevMeta);
  const payload = topologyProsePayload(
    { ...topo, meta: prevMeta },
    { claim_limit: Math.min(56, Number(b.claim_limit) || 48) },
  );
  const user =
    "Write the reader-facing article body from this evidence ledger. Respect mode, mandate, and enrichment_brief in the JSON — condition-first, one ## Why [compound] might help you per peptide in scope. Do NOT apply peptide invariant sections to system/primer articles or enrichment condition/stack/cross articles.\n\n" +
    JSON.stringify(payload).slice(0, 28000);
  const sys =
    OIP_PLAIN_ENGLISH_LAW + "\n\n" +
    proseWriterForMode(mode) +
    "\n\nOutput ONLY markdown (## headings). No JSON, no code fence, no preamble. Omit sections with no material — never write 'No catalogued evidence' placeholders.";
  const r = await callModel(
    env,
    model,
    sys,
    user,
    Math.max(4096, Number(b.max_tokens) || 6500),
    false,
  );
  if (r.err) return { error: "model call failed: " + r.err };

  let newBody = String(r.text || "").trim();
  newBody = newBody.replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/i, "");
  const leg = legibilityGate(newBody);
  if (!leg.pass && !b.force) {
    return {
      error: "prose failed legibility gate",
      reasons: leg.reasons,
      raw_preview: newBody.slice(0, 500),
    };
  }
  if (newBody.length < 900 && !b.force) {
    return {
      error: "prose too short",
      chars: newBody.length,
      raw_preview: newBody.slice(0, 400),
    };
  }

  const meta = Object.assign({}, prevMeta);
  await pushRevision(env, meta, row, prevMeta);

  const entry = await addContribution(meta, {
    model,
    role: "editor",
    action: "synthesize_body",
    payload: {
      chars: newBody.length,
      claims_used: payload.claims.length,
      legibility: leg,
    },
    rationale: "Reader body rewritten from ranked ledger topology — plain English",
    tokens_in: r.usage?.prompt_tokens || 0,
    tokens_out: r.usage?.completion_tokens || 0,
  });
  await addProv(meta, {
    model,
    action: "synthesize_body",
    input: slug,
    response: newBody.slice(0, 2000),
    tokens_in: r.usage?.prompt_tokens || 0,
    tokens_out: r.usage?.completion_tokens || 0,
  });
  meta.prose_synthesized_at = nowIso();
  meta.prose_synthesized_by = model;

  await env.DB.prepare(
    "UPDATE articles SET body=?, meta=?, updated_at=? WHERE slug=?",
  )
    .bind(newBody.slice(0, 20000), JSON.stringify(meta), nowIso(), slug)
    .run();

  return attachSelf(
    {
      ok: true,
      slug,
      model,
      material: true,
      contribution_id: entry.id,
      chars: newBody.length,
      claims_used: payload.claims.length,
      legibility: leg,
      url: "https://miscsubjects.com/a/" + slug,
    },
    "synthesize_body",
    { slug, contains: "plain-English reader body from evidence ledger" },
  );
}

// Multi-model enrichment pass: Grok / Kimi add meat (claims, sources, sections) — legibility-gated.
async function poll(env, b) {
  const slug = slugify2(b.slug);
  if (!slug) return { error: "need slug" };
  const existing = await getRow(env, slug);
  if (!existing) return { error: "article not found: " + slug };
  const prevMeta = parseMeta(existing.meta);
  const model = String(b.model || "grok/grok-4.3");
  const claims = (prevMeta.claims || []).slice(0, 28);
  const sources = (prevMeta.sources || []).slice(0, 16);
  const sys =
    OIP_PLAIN_ENGLISH_LAW + "\n\n" +
    "You are an editor for the canonical peptide evidence ledger on miscsubjects.com. " +
    "ADDITIVE ONLY: missing context, clearer plain-English paragraphs, evidence-graded claims, and sources. " +
    "Never rewrite the whole article. Never use academic jargon, stacked Latin, or hype. " +
    "Write for a smart adult reader — short sentences, honest hedging, no medical advice or dosing. " +
    "This is the definitive ledger; legibility beats density.\n\n" +
    "Output ONLY one JSON object:\n" +
    '{"material":true,"rationale":"what you added and why","legibility":{"plain_english":true,"reading_level":"accessible|clinical_plain"},' +
    '"body_append":"## Section title\\n\\nNew paragraphs only — do not repeat existing text",' +
    '"claims_add":[{"text":"...","section":"...","tier":"human|preclinical|anecdotal|mechanistic|speculative","source_ids":["s1"],"why_material":"..."}],' +
    '"sources_add":[{"type":"pubmed|reddit|x|review|clinical_trial|youtube|news|other","url":"https://...","title":"...","quote":"exact short quote","summary":"...","claim_ids":["c1"]}],' +
    '"notes":"one line for the model contribution card"}\n' +
    "If nothing material to add, set material:false and body_append:null and empty arrays.";
  const user =
    "SLUG: " +
    slug +
    "\nTITLE: " +
    existing.title +
    "\nREGISTER: " +
    (prevMeta.register || "source_ledger") +
    "\n\nBODY:\n" +
    String(existing.body || "").slice(0, 14000) +
    "\n\nCLAIMS:\n" +
    JSON.stringify(claims) +
    "\n\nSOURCES (" +
    sources.length +
    "):\n" +
    JSON.stringify(
      sources.map((s) => ({
        id: s.id,
        type: s.type,
        url: s.url,
        title: s.title,
      })),
    );
  const r = await callModel(env, model, sys, user, b.max_tokens || 3200, false);
  if (r.err) return { error: "model call failed: " + r.err };
  let parsed;
  try {
    parsed = extractJson(r.text);
  } catch (e) {
    return {
      error: "model did not return valid JSON: " + e.message,
      raw_preview: String(r.text).slice(0, 500),
    };
  }
  if (parsed.material === false) {
    await addContribution(prevMeta, {
      model,
      role: "editor",
      action: "poll",
      payload: { material: false, notes: parsed.notes || parsed.rationale || "" },
      rationale: String(parsed.rationale || "nothing material"),
      tokens_in: r.usage?.prompt_tokens || 0,
      tokens_out: r.usage?.completion_tokens || 0,
    });
    await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
      .bind(JSON.stringify(prevMeta), nowIso(), slug)
      .run();
    return {
      ok: true,
      slug,
      model,
      material: false,
      rationale: parsed.rationale || "",
      url: "https://miscsubjects.com/a/" + slug,
    };
  }
  const bodyAppend = String(parsed.body_append || "").trim();
  const leg = legibilityGate(bodyAppend);
  const meta = Object.assign({}, prevMeta);
  let newBody = String(existing.body || "").trim();
  let bodyChanged = false;
  let claimsAdded = 0;
  let sourcesAdded = 0;
  const claimList = Array.isArray(prevMeta.claims)
    ? prevMeta.claims.map((c) => Object.assign({}, c))
    : [];
  let maxC = 0;
  claimList.forEach((c) => {
    const m = /^c(\d+)$/.exec(String(c.id || ""));
    if (m) maxC = Math.max(maxC, +m[1]);
  });
  for (const c of Array.isArray(parsed.claims_add) ? parsed.claims_add : []) {
    const text = String(c.text || "").trim();
    if (!text || !legibilityGate(text).pass) continue;
    const tier = TIERS.includes(String(c.tier)) ? String(c.tier) : "mechanistic";
    const id = "c" + ++maxC;
    claimList.push(
      enrichClaim(
        {
          id,
          text,
          section: String(c.section || "Editorial addition"),
          tier,
          source_ids: Array.isArray(c.source_ids) ? c.source_ids.map(String) : [],
          source_status: (c.source_ids || []).length ? "sourced" : "unsourced",
          why_material: String(c.why_material || "").slice(0, 500),
          evidence_basis: "derived_inference",
          weight: BASE_WEIGHT[tier] || 0.3,
          status: "active",
          stance_scores: { neutral: 0, pro: 0, adversary: 0 },
          who_claims: model,
          extra: { added_by: model, via: "poll" },
        },
        { model, channel: "protocol/poll", actor: model },
      ),
    );
    claimsAdded++;
  }
  meta.claims = claimList;
  const existingSources = Array.isArray(prevMeta.sources)
    ? prevMeta.sources.map((s) => Object.assign({}, s))
    : [];
  const seen = new Set(
    existingSources.map((s) =>
      (String(s.url || "") + "|" + String(s.quote || "")).toLowerCase(),
    ),
  );
  let maxS = 0;
  existingSources.forEach((s) => {
    const m = /^s(\d+)$/.exec(String(s.id || ""));
    if (m) maxS = Math.max(maxS, +m[1]);
  });
  const addedSrc = [];
  for (const s of Array.isArray(parsed.sources_add) ? parsed.sources_add : []) {
    const key = (
      String(s.url || "") +
      "|" +
      String(s.quote || "")
    ).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const type = SOURCE_TYPES.includes(String(s.type)) ? String(s.type) : "other";
    addedSrc.push({
      id: "s" + ++maxS,
      type,
      url: String(s.url || ""),
      title: String(s.title || ""),
      quote: String(s.quote || ""),
      summary: String(s.summary || ""),
      claim_ids: Array.isArray(s.claim_ids) ? s.claim_ids.map(String) : [],
      found_by: model,
      extra: { via: "poll" },
      accessed_at: nowIso(),
    });
  }
  const toCheck = addedSrc.slice(0, VERIFY_CAP);
  const vresults = await Promise.allSettled(toCheck.map(verifyOne));
  vresults.forEach((res, i) => {
    const v =
      res.status === "fulfilled"
        ? res.value
        : {
            link_status: "dead",
            quote_status: toCheck[i].quote ? "unverified" : "na",
          };
    toCheck[i].link_status = v.link_status;
    toCheck[i].quote_status = v.quote_status;
  });
  for (let i = VERIFY_CAP; i < addedSrc.length; i++) {
    addedSrc[i].link_status = "unchecked";
    addedSrc[i].quote_status = addedSrc[i].quote ? "unchecked" : "na";
  }
  sourcesAdded = addedSrc.length;
  const allSrc = existingSources.concat(addedSrc);
  let prevH = "genesis";
  for (const s of allSrc) {
    s.prev = prevH;
    s.hash = await sha256(srcBody(s));
    prevH = s.hash;
  }
  meta.sources = allSrc;
  meta.source_head = allSrc.length ? allSrc[allSrc.length - 1].hash : "genesis";
  const byClaim = {};
  claimList.forEach((c) => {
    byClaim[c.id] = c;
  });
  for (const s of addedSrc)
    for (const cid of s.claim_ids) {
      const c = byClaim[cid];
      if (c) {
        c.source_ids = Array.from(new Set([...(c.source_ids || []), s.id]));
        c.source_status = "sourced";
      }
    }
  meta.claims = claimList;
  if (
    (bodyAppend && leg.pass) ||
    claimsAdded > 0 ||
    sourcesAdded > 0
  ) {
    await pushRevision(env, meta, existing, prevMeta);
  }
  if (bodyAppend && leg.pass) {
    newBody = newBody + "\n\n" + bodyAppend;
    bodyChanged = true;
  }
  const entry = await addContribution(meta, {
    model,
    role: "editor",
    action: "poll",
    payload: {
      material: true,
      body_append: bodyAppend && leg.pass ? bodyAppend.slice(0, 2000) : null,
      body_rejected: bodyAppend && !leg.pass ? leg.reasons : null,
      claims_added: claimsAdded,
      sources_added: sourcesAdded,
      notes: String(parsed.notes || parsed.rationale || "").slice(0, 400),
      legibility: parsed.legibility || {},
    },
    rationale: String(parsed.rationale || ""),
    tokens_in: r.usage?.prompt_tokens || 0,
    tokens_out: r.usage?.completion_tokens || 0,
  });
  await addProv(meta, {
    model,
    action: "poll",
    input: slug,
    response: String(parsed.notes || parsed.rationale || "poll").slice(0, 800),
    tokens_in: r.usage?.prompt_tokens || 0,
    tokens_out: r.usage?.completion_tokens || 0,
  });
  await env.DB.prepare(
    "UPDATE articles SET body=?, meta=?, updated_at=? WHERE slug=?",
  )
    .bind(newBody, JSON.stringify(meta), nowIso(), slug)
    .run();
  await score(env, { slug, model: "scorer" });
  return {
    ok: true,
    slug,
    model,
    material: true,
    contribution_id: entry.id,
    body_appended: bodyChanged,
    body_rejected: bodyAppend && !leg.pass ? leg.reasons : null,
    legibility: leg,
    claims_added: claimsAdded,
    sources_added: sourcesAdded,
    total_sources: allSrc.length,
    url: "https://miscsubjects.com/a/" + slug,
    note: "Model swipe recorded — inspect Contributions deck on the article page",
  };
}

/** Editorial debate club — mandate, prosecutor, defender, judge; scope gate before publish. */
async function editorial(env, b) {
  const slug = slugify2(b.slug);
  if (!slug) return { error: "need slug" };
  const row = await getRow(env, slug);
  if (!row) return { error: "article not found: " + slug };
  let meta = parseMeta(row.meta);
  const audit = auditEditorialScope(slug, row.title, row.body, meta);
  const model = String(b.model || "kimi/moonshot-v1-8k");

  const sys =
    OIP_PLAIN_ENGLISH_LAW + "\n\n" +
    "Audit one article against scope. Three roles report, then a verdict.\n" +
    "PROSECUTOR: scope violations, wrong template, off-mandate peptide drift, empty sections.\n" +
    "DEFENDER: what legitimately belongs in scope.\n" +
    "JUDGE: pass only if must_answer questions are resolved; list answerable_but_missing and required_fixes.\n" +
    "Output ONLY JSON: {mandate, prosecutor:{violations,score}, defender:{in_scope,defends}, judge:{verdict,resolves_must_answer,unanswered_ought,answerable_but_missing,required_fixes,editorial_score}, pass:bool}";
  const user = editorialDebatePrompt(slug, row.title, row.body, meta, audit);
  const r = await callModel(env, model, sys, user, b.max_tokens || 3200, false);
  if (r.err) return { error: "model call failed: " + r.err };

  let debate;
  try {
    debate = extractJson(r.text);
  } catch (e) {
    return {
      error: "model did not return valid JSON: " + e.message,
      audit,
      raw_preview: String(r.text).slice(0, 600),
    };
  }

  const pass =
    debate.pass === true &&
    debate.judge?.verdict === "pass" &&
    (debate.judge?.editorial_score ?? 0) >= Number(b.min_score ?? 0.65);

  const ts = nowIso();
  meta.editorial = {
    ts,
    model,
    mode: audit.mode,
    mandate: debate.mandate || audit.mandate,
    audit,
    debate: {
      prosecutor: debate.prosecutor,
      defender: debate.defender,
      judge: debate.judge,
    },
    pass,
    required_fixes: debate.judge?.required_fixes || [],
  };

  const methodology_claim = {
    id: "c_ed_" + slug.slice(0, 20),
    text:
      `Editorial debate (${pass ? "PASS" : "FAIL"}): ` +
      (debate.judge?.required_fixes?.[0] ||
        `verdict=${debate.judge?.verdict}; score=${debate.judge?.editorial_score}`),
    section: "what_is_known",
    slot: "what_is_known",
    tier: "system",
    weight: 0.3,
    posted_by: { actor: model, channel: "api", ts },
    who_claims: "editorial debate club",
  };
  const claims = Array.isArray(meta.claims) ? [...meta.claims] : [];
  const idx = claims.findIndex((c) => String(c.id || "").startsWith("c_ed_"));
  if (idx >= 0) claims[idx] = methodology_claim;
  else claims.push(methodology_claim);
  meta.claims = claims;

  await pushRevision(env, meta, row, parseMeta(row.meta));
  await addProv(meta, {
    model,
    action: "editorial_debate",
    input: slug,
    response: JSON.stringify(debate.judge || {}).slice(0, 2000),
    tokens_in: r.usage?.prompt_tokens || 0,
    tokens_out: r.usage?.completion_tokens || 0,
  });
  let retracted = [];
  if (b.apply_fixes && !pass) {
    const toRetract = offMandateClaimIds(slug, meta.claims, meta);
    for (const claim_id of toRetract.slice(0, 40)) {
      const rr = await retract(env, {
        slug,
        claim_id,
        reason: "Editorial scrub: off-mandate compound drift on primer article",
      });
      if (rr.ok) retracted.push(claim_id);
    }
    if (retracted.length) {
      const fresh = await getRow(env, slug);
      meta = parseMeta(fresh.meta);
      meta.editorial.retracted_off_mandate = retracted;
    }
    await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
      .bind(JSON.stringify(meta), ts, slug)
      .run();
  } else {
    await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
      .bind(JSON.stringify(meta), ts, slug)
      .run();
  }

  return {
    ok: true,
    slug,
    pass,
    retracted_off_mandate: retracted,
    mode: audit.mode,
    mandate: meta.editorial.mandate,
    violations: audit.violations,
    judge: debate.judge,
    required_fixes: meta.editorial.required_fixes,
    next: pass
      ? null
      : "Fix required_fixes, retract off-scope claims, POST /api/protocol/synthesize-body, re-run editorial",
    url: "https://miscsubjects.com/a/" + slug,
  };
}

async function critique(env, b) {
  const slug = slugify2(b.slug);
  if (!slug) return { error: "need slug" };
  const a = await getRow(env, slug);
  if (!a) return { error: "article not found: " + slug };
  const meta = parseMeta(a.meta);
  const role = REVIEW_ROLES.includes(String(b.role)) ? String(b.role) : "adversary";
  const model = String(b.model || "grok/grok-4.3");
  const claims = (meta.claims || []).slice(0, 24);
  const sources = (meta.sources || []).slice(0, 12);
  const sys =
    OIP_PLAIN_ENGLISH_LAW + "\n\n" +
    "You are an evidence-graded article " +
    role +
    " reviewer. Read the article, claims, and sources. " +
    "Find what is unclear, overclaimed, under-sourced, or could be more legible. " +
    "Output ONLY one JSON object:\n" +
    '{"rationale":"...","checks":[{"name":"...","pass":true}],"contributions":[{"claim_id":"c1 or null","text":"specific fix or challenge","score":0.0-1.0,"material":true}],"material":true}\n' +
    "If nothing material to add, set material:false and explain in rationale.";
  const user =
    "TITLE: " +
    a.title +
    "\n\nBODY:\n" +
    String(a.body || "").slice(0, 12000) +
    "\n\nCLAIMS:\n" +
    JSON.stringify(claims) +
    "\n\nSOURCES (" +
    sources.length +
    "):\n" +
    JSON.stringify(
      sources.map((s) => ({
        id: s.id,
        type: s.type,
        url: s.url,
        title: s.title,
        hash: s.hash,
      })),
    );
  const r = await callModel(env, model, sys, user, b.max_tokens || 2800, false);
  if (r.err) return { error: "model call failed: " + r.err };
  let parsed;
  try {
    parsed = extractJson(r.text);
  } catch (e) {
    return {
      error: "model did not return valid JSON: " + e.message,
      raw_preview: String(r.text).slice(0, 500),
    };
  }
  const rev = await review(env, {
    slug,
    role,
    model,
    rationale: parsed.rationale || "",
    checks: parsed.checks || [],
    contributions: (parsed.contributions || []).map((c) => ({
      claim_id: c.claim_id || c.target_claim_id || null,
      text: c.text || "",
      score: Number(c.score) || 0,
      material: c.material !== false,
    })),
    material: parsed.material !== false,
    prov: {
      model,
      action: "critique:" + role,
      input: slug,
      response: String(r.text).slice(0, 2000),
      tokens_in: r.usage?.prompt_tokens || 0,
      tokens_out: r.usage?.completion_tokens || 0,
    },
  });
  if (rev.error) return rev;
  const scored = await score(env, { slug, model: "scorer" });
  return {
    ok: true,
    slug,
    role,
    review_id: rev.review_id,
    reviews: rev.reviews,
    score: scored.changes || [],
    url: "https://miscsubjects.com/a/" + slug,
  };
}
async function librarySnapshot(env, b) {
  const limit = Math.max(1, Math.min(50, Number(b.limit) || 20));
  const model = String(b.model || "grok/grok-4.3");
  const rows = (await env.DB.prepare(
    "SELECT slug, title, meta FROM articles WHERE published=1 ORDER BY updated_at DESC LIMIT ?"
  ).bind(limit).all()).results || [];
  if (!rows.length) return { error: "no published articles" };
  const items = rows.map((r) => {
    const meta = parseMeta(r.meta);
    const claims = (meta.claims || []).slice(0, 3);
    const claimTexts = claims.map((c) => String(c.text || "").slice(0, 160)).join(" | ");
    return {
      slug: r.slug,
      title: String(r.title || "").slice(0, 120),
      register: String(meta.register || "standard"),
      claims: claimTexts,
    };
  });
  const sys = "You are a research assistant with live web search. Output ONLY a JSON array.";
  const user =
    "Here are articles from my library:\n" +
    items.map((it, i) => `${i + 1}. ${it.title} (${it.slug}) [${it.register}]${it.claims ? " claims: " + it.claims : ""}`).join("\n") +
    "\n\nFor each article, find ONE credible web source that supports, contradicts, or contextualizes its core claim. " +
    "Return a JSON array where each object has: slug, source_url, source_title, context (one sentence), claim_type (human|preclinical|anecdotal|mechanistic|speculative), weight (0.0-1.0). " +
    "Use real URLs only. If no good source, set source_url to \"\".";
  const r = await callModel(env, model, sys, user, 4000, true);
  if (r.err) return { error: "model call failed: " + r.err };
  let parsed = null;
  try {
    parsed = extractArr(r.text);
  } catch (e) {
    return { error: "model did not return valid JSON array: " + e.message, raw_preview: String(r.text).slice(0, 700) };
  }
  return {
    ok: true,
    model,
    searched: true,
    articles: items.length,
    snapshot: Array.isArray(parsed) ? parsed : [parsed],
    citations: r.citations || [],
  };
}

function scoreNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

function normalizeOipReview(parsed) {
  const p = parsed && typeof parsed === "object" ? parsed : {};
  const s = p.scores && typeof p.scores === "object" ? p.scores : {};
  // Philosophy register: the reviewer returned prosecution-axis scores. Pass gates on
  // traversal, relationship-to-OIP, and prosecution readiness; findings route to the
  // objection ledger downstream (never to a rewrite queue).
  if (s.traversal_clarity != null || s.prosecution_readiness != null) {
    const phScores = {
      traversal_clarity: scoreNumber(s.traversal_clarity),
      claim_typing: scoreNumber(s.claim_typing),
      falsification_clarity: scoreNumber(s.falsification_clarity),
      objection_surface_clarity: scoreNumber(s.objection_surface_clarity),
      relationship_to_oip: scoreNumber(s.relationship_to_oip),
      zero_context_key: scoreNumber(s.zero_context_key),
      prosecution_readiness: scoreNumber(s.prosecution_readiness),
    };
    const phPass = (
      p.pass !== false &&
      (phScores.traversal_clarity ?? 0) >= 7 &&
      (phScores.relationship_to_oip ?? 0) >= 7 &&
      (phScores.prosecution_readiness ?? 0) >= 7
    );
    return {
      pass: phPass,
      register: "total_structure",
      scores: phScores,
      strongest_attack: p.strongest_attack || null,
      stale_settled_entries: Array.isArray(p.stale_settled_entries) ? p.stale_settled_entries : [],
      missing_concepts: Array.isArray(p.missing_concepts) ? p.missing_concepts : [],
      concrete_fixes: Array.isArray(p.concrete_fixes) ? p.concrete_fixes : [],
      followup_questions: Array.isArray(p.followup_questions) ? p.followup_questions : [],
      raw: p,
    };
  }
  const scores = {
    json_clarity: scoreNumber(s.json_clarity ?? s.machine_json ?? p.json_clarity),
    english_clarity: scoreNumber(s.english_clarity ?? s.article_body ?? p.english_clarity),
    zero_context_human: scoreNumber(s.zero_context_human ?? s.human_clarity ?? p.zero_context_human),
    curl_operability: scoreNumber(s.curl_operability ?? p.curl_operability),
    mcp_comparison: scoreNumber(s.mcp_comparison ?? p.mcp_comparison),
  };
  const concreteFixes = Array.isArray(p.concrete_fixes) ? p.concrete_fixes
    : Array.isArray(p.fixes) ? p.fixes
      : [];
  const missingConcepts = Array.isArray(p.missing_concepts) ? p.missing_concepts
    : Array.isArray(p.subsidiary_articles) ? p.subsidiary_articles
      : [];
  const blocking = concreteFixes.filter((x) => {
    const t = typeof x === "string" ? x : JSON.stringify(x || {});
    return /\b(block|missing|required|cannot|unclear|guess)\b/i.test(t);
  });
  const pass = (
    p.pass !== false &&
    scores.json_clarity != null &&
    scores.english_clarity != null &&
    scores.zero_context_human != null &&
    scores.json_clarity >= 8 &&
    scores.english_clarity >= 8 &&
    scores.zero_context_human >= 8 &&
    (scores.curl_operability == null || scores.curl_operability >= 8) &&
    (scores.mcp_comparison == null || scores.mcp_comparison >= 8) &&
    blocking.length === 0
  );
  return {
    pass,
    scores,
    can_operate: p.can_operate || p.can_operate_via_curl || null,
    curl_shape: p.curl_shape || p.curl || null,
    mcp_comparison: p.mcp_comparison_text || p.mcp_comparison || null,
    missing_concepts: missingConcepts,
    subsidiary_articles: Array.isArray(p.subsidiary_articles) ? p.subsidiary_articles : [],
    concrete_fixes: concreteFixes,
    followup_questions: Array.isArray(p.followup_questions) ? p.followup_questions : [],
    raw: p,
  };
}

async function enqueueOipReviewTasks(env, b = {}) {
  let defaults = oipReviewArticleSlugs();
  if (!Array.isArray(b.slugs) || !b.slugs.length) {
    const dyn = await listDynamicOipArticles(env);
    defaults = [...defaults, ...dyn.map((d) => d.slug).filter((s) => !defaults.includes(s))];
  }
  const requested = (Array.isArray(b.slugs) && b.slugs.length ? b.slugs : defaults)
    .map((s) => slugify2(s))
    .filter(Boolean);
  // oip-* slugs pass the prefix router; any other explicitly requested slug is accepted
  // when it exists on the articles plane — corpus pages review through the bundle fallback.
  const slugs = [];
  for (const s of requested) {
    if (isOipArticleSlug(s)) { slugs.push(s); continue; }
    const row = await env.DB.prepare("SELECT slug FROM articles WHERE slug=?").bind(s).first().catch(() => null);
    if (row) slugs.push(s);
  }
  const models = (Array.isArray(b.models) && b.models.length
    ? b.models
    : [b.model || "grok/grok-4.3", "gemini/gemini-2.5-flash", "kimi/moonshot-v1-8k"])
    .map((m) => String(m || "").trim())
    .filter(Boolean);
  const inserted = [];
  const existing = [];
  for (const slug of [...new Set(slugs)]) {
    for (const model of [...new Set(models)]) {
      const body = {
        role: "oip-review",
        post_to: "/api/protocol/oip-review",
        slug,
        model,
        questions: reviewQuestionsFor(slug),
      };
      const dupe = await env.DB.prepare(
        "SELECT id FROM tasks WHERE status IN ('open','running') AND source='oip-review' AND body LIKE ? AND body LIKE ? LIMIT 1",
      ).bind(likeFrag("slug", slug), likeFrag("model", model)).first();
      if (dupe) {
        existing.push({ slug, model, id: dupe.id });
        continue;
      }
      const r = await env.DB.prepare(
        "INSERT INTO tasks (created_at, status, body, source) VALUES (datetime('now'), 'open', ?, 'oip-review')",
      ).bind(JSON.stringify(body)).run();
      inserted.push({ slug, model, id: r.meta.last_row_id });
    }
  }
  return {
    ok: true,
    role: "oip-review",
    inserted: inserted.length,
    existing: existing.length,
    tasks: inserted,
    skipped_existing: existing,
    run_one: "POST /api/protocol/run?role=oip-review",
    cron_gate: "KV oip_review_autorun=1",
  };
}

const OIP_MAX_OPEN_TASKS = 60;
const OIP_DEFAULT_LOOP_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
// Writers/revisers get a stronger model: the free 70B anchors on existing errors instead of applying ground truth.
const OIP_WRITER_MODEL = "gemini/gemini-2.5-flash";

/** extractJson, then a second pass escaping raw newlines/tabs inside string literals (writer models emit markdown bodies with literal control chars). */
function extractJsonLoose(t) {
  try {
    return extractJson(t);
  } catch {
    let s = String(t || "").trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const i = s.indexOf("{"), j = s.lastIndexOf("}");
    if (i >= 0 && j > i) s = s.slice(i, j + 1);
    let out = "";
    let inString = false;
    for (let k = 0; k < s.length; k++) {
      const c = s[k];
      if (inString) {
        if (c === "\\") { out += c + (s[k + 1] || ""); k++; continue; }
        if (c === '"') { inString = false; out += c; continue; }
        if (c === "\n") { out += "\\n"; continue; }
        if (c === "\r") { out += "\\r"; continue; }
        if (c === "\t") { out += "\\t"; continue; }
        if (c.charCodeAt(0) < 32) continue;
        out += c;
        continue;
      }
      if (c === '"') inString = true;
      out += c;
    }
    return JSON.parse(out);
  }
}

// LAW — carved into every writer, editor, answer, and review prompt. Enforced by oipDocLint.
const OIP_PLAIN_ENGLISH_LAW =
  "WRITING LAW (absolute). Write OIP as a protocol specification. " +
  "Every sentence is a definition, a requirement, a mechanism, or a proof. " +
  "Define each thing by what it is, the route or object that performs it, the receipt that proves it, and the conformant behavior that follows. " +
  "A statement without an object, route, receipt, schema, source, or conformance rule is invalid. " +
  "Use affirmative protocol language. Define a thing by what it is and does. State a comparison as one property beside another property. " +
  "Every article states its invariant in the first five lines, and carries one end-to-end example, one receipt rule, and one conformance rule. " +
  "Define each acronym once, affirmatively, on first use: OIP (Object Invocation Protocol); API; CLI; REST; JSON; URL; MCP (Model Context Protocol: a model connects to a server that exposes tools, resources, and prompts over a session). " +
  "The OIP unit is the work object. The OIP proof is the receipt. The OIP loop is object, invoke, ledger, receipt, replay, repair. " +
  "`POST /api/dispatch {key, body}` or `GET /api/dispatch?invoke=KEY&body=...` invokes an object; every invocation appends to the ledger and returns a receipt at `/api/dispatch?receipt=inv_ID`. " +
  "Only name routes that exist on miscsubjects.com: /api/dispatch, /api/articles, /a/<slug>. " +
  "Forbidden in specification prose (permitted only inside an explicit comparison article): the negation form 'X is not Y', 'does not', 'not merely', 'not just', 'unlike', 'basically', 'just', 'hobbyist', 'power user', 'agent running wild', 'safety theater', 'AI doom', 'prompt injection', 'wrapper', 'dashboard', objections, defenses, caveats, disclaimers, jokes, metaphors, and evaluator opinions.";

// Enforces the law mechanically on generated bodies. The writer path rejects a body carrying a
// forbidden frame so the failure register never reaches the ledger.
const OIP_FORBIDDEN_FRAMES = [
  /\bis not\b/i, /\bare not\b/i, /\bdoes not\b/i, /\bnot merely\b/i, /\bnot just\b/i,
  /\bunlike\b/i, /\bbasically\b/i, /\bhobbyist\b/i, /\bpower users?\b/i, /\bagents? running wild\b/i,
  /\bsafety theater\b/i, /\bAI doom\b/i, /\bwrapper\b/i, /\bdashboard\b/i, /\bwhat OIP is not\b/i,
];
const OIP_REQUIRED_ANCHORS = [
  "object", "route", "receipt", "schema", "ledger", "runner", "authority", "scope",
  "replay", "repair", "conformance", "source", "artifact", "invocation", "invoke",
];
function oipDocLint(body, { comparison = false } = {}) {
  const text = String(body || "");
  const violations = [];
  if (!comparison) {
    for (const re of OIP_FORBIDDEN_FRAMES) {
      const m = text.match(re);
      if (m) violations.push("forbidden_frame:" + m[0].toLowerCase().trim());
    }
  }
  const lower = text.toLowerCase();
  if (!OIP_REQUIRED_ANCHORS.some((a) => lower.includes(a)))
    violations.push("no_anchor");
  return { ok: violations.length === 0, violations: [...new Set(violations)] };
}

/** D1 caps LIKE patterns at 50 chars; build a JSON-field fragment that always fits. */
function likeFrag(field, value) {
  const v = String(value || "").replace(/["%_\\]/g, "");
  const prefix = '%"' + field + '":"';
  const maxTotal = 48; // safety margin under D1 ~50 char LIKE limit
  const maxValue = Math.max(0, maxTotal - prefix.length - 2); // 2 for closing quote + %
  const safe = v.length > maxValue ? v.slice(0, maxValue) : v;
  return prefix + safe + '"%';
}

async function openOipTaskCount(env) {
  const r = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM tasks WHERE status IN ('open','running') AND source='oip-review'",
  ).first();
  return Number(r?.n || 0);
}

async function enqueueOipLoopTask(env, postTo, body) {
  const dupe = await env.DB.prepare(
    "SELECT id FROM tasks WHERE status IN ('open','running') AND source='oip-review' AND body LIKE ? AND body LIKE ? LIMIT 1",
  ).bind(likeFrag("post_to", postTo), likeFrag("slug", body.slug)).first();
  if (dupe) return { existing: dupe.id };
  const task = { role: "oip-review", post_to: postTo, ...body };
  const r = await env.DB.prepare(
    "INSERT INTO tasks (created_at, status, body, source) VALUES (datetime('now'), 'open', ?, 'oip-review')",
  ).bind(JSON.stringify(task)).run();
  return { id: r.meta.last_row_id };
}

/**
 * The recursion step: turn one review's findings into queued work.
 * - subsidiary slug that already resolves to an article -> queue a review of it
 * - subsidiary slug with no article -> queue oip-write (a model writes it)
 * - failing review with concrete fixes -> queue oip-revise (a model rewrites this article)
 */
async function processOipFollowups(env, { review, slug, model, review_event_id, corpus }) {
  const out = { reviews_enqueued: [], writes_enqueued: [], revise_enqueued: null, skipped: [] };
  const open = await openOipTaskCount(env);
  // The cap guards TASK creation only. Objection logging (the verbatim-law route for
  // shelf/corpus findings) is a ledger write, not a task — it must never be starved by
  // a full queue, so the capped path falls through to the objection branch below.
  const capped = open >= OIP_MAX_OPEN_TASKS;
  if (capped) out.skipped.push("open oip task cap reached: " + open + "/" + OIP_MAX_OPEN_TASKS);
  let newWrites = 0;
  for (const p of (capped ? [] : (review.subsidiary_articles || [])).slice(0, 5)) {
    const pSlug = slugify2(typeof p === "string" ? p : p?.slug);
    if (!pSlug || pSlug === slug) continue;
    if (!pSlug.startsWith("oip-") || !isOipArticleSlug(pSlug)) {
      out.skipped.push(pSlug + ": not an oip-* slug");
      continue;
    }
    const existing = await buildOipArticle(env, pSlug);
    if (existing) {
      const q = await enqueueOipLoopTask(env, "/api/protocol/oip-review", {
        slug: pSlug,
        model,
        questions: reviewQuestionsFor(slug),
      });
      if (q.id) out.reviews_enqueued.push(pSlug);
    } else if (newWrites < 3) {
      const w = await enqueueOipLoopTask(env, "/api/protocol/oip-write", {
        slug: pSlug,
        title: (typeof p === "object" && p?.title) || pSlug.replace(/^oip-/, "").replace(/-/g, " "),
        why: (typeof p === "object" && p?.why) || "named as a missing concept by a reviewer",
        model: OIP_WRITER_MODEL,
        review_event_id: review_event_id || null,
      });
      if (w.id) {
        out.writes_enqueued.push(pSlug);
        newWrites++;
      }
    }
  }
  if (review.pass === false && (review.concrete_fixes || []).length) {
    const parsed = parseOipArticleSlug(slug);
    const { shelfFor } = await import("../../_lib/oip_articles.js");
    if (shelfFor(slug) || corpus) {
      // VERBATIM LAW: Total Structure voxels carry the author's exact words. A failing
      // review NEVER queues a model rewrite here — findings route to the objection ledger
      // (Book X: the attack protocol is the intake) and amendment stays with the owner.
      try {
        await env.DB.prepare(
          "INSERT INTO oip_objections (slug, objection, actor, status) VALUES (?,?,?,'open')"
        ).bind(slug, "Review findings (" + (review_event_id || "unledgered") + "): " + (review.concrete_fixes || []).join(" · ").slice(0, 3800), "review-loop").run();
        out.objection_logged = slug;
      } catch {}
    } else if (!capped && parsed && (parsed.type === "primer" || parsed.type === "dynamic")) {
      const r = await enqueueOipLoopTask(env, "/api/protocol/oip-revise", {
        slug,
        model: OIP_WRITER_MODEL,
        review_event_id: review_event_id || null,
      });
      if (r.id) out.revise_enqueued = slug;
    }
  }
  return out;
}

/** A model writes a missing OIP article. Append-only version 1, then straight into the review cycle. */
/** Text the owner through the canonical NOTIFY_OWNER row. Fire-and-forget; never blocks the loop. */
async function notifyOwner(env, text) {
  try {
    await fetch("https://miscsubjects.com/api/dispatch", {
      method: "POST",
      headers: { "content-type": "application/json", "x-terminal-key": String(env.TERMINAL_KEY || "") },
      body: JSON.stringify({ key: "NOTIFY_OWNER", body: String(text || "").slice(0, 600) }),
    });
  } catch {}
}

/**
 * One agent from the answer forum picks up a reader question asked through the
 * iMessage/WhatsApp article widgets, answers it from the article itself, stores the
 * answer as a hash-chained user_entries row (the widget thread), ledgers the Q&A,
 * and texts the owner. Cron drains tasks.source='article-question' one per tick.
 */
async function questionAnswer(env, b) {
  const slug = slugify2(b.slug || "");
  const q = String(b.question || "").trim();
  if (!q) return { error: "question required" };
  let ctxText = "";
  let title = slug;
  if (slug && isOipArticleSlug(slug)) {
    const bun = await buildOipArticleBundle(env, slug, { slim: true, review_limit: 2 });
    if (!bun.error) { ctxText = formatOipArticleBundleMarkdown(bun).slice(0, 16000); title = bun.title || slug; }
  } else if (slug) {
    const row = await env.DB.prepare("SELECT title, body FROM articles WHERE slug=?").bind(slug).first();
    if (row) { ctxText = "# " + row.title + "\n\n" + String(row.body || "").slice(0, 16000); title = row.title; }
  }
  const model = String(b.model || OIP_WRITER_MODEL);
  const sys =
    OIP_PLAIN_ENGLISH_LAW + "\n\n" +
    "You are one agent in the build's public answer forum. A reader tapped a message widget on an article and asked a question. " +
    "Answer plainly and completely in under 200 words, like a good text message. Define every acronym. " +
    "If the question is operational (how do I run/call/see something), give the exact URL or curl against https://miscsubjects.com. " +
    "Answer only from the article and the build's real routes; if the article does not contain the answer, say exactly what is missing. Never invent facts or links.";
  const r = await callModel(env, model, sys,
    "ARTICLE (" + (slug || "no slug") + "):\n" + (ctxText || "(no article context)") +
    "\n\nREADER QUESTION from " + String(b.author || "anonymous") + ": " + q, 1400, false);
  if (r.err) return { error: "model call failed: " + r.err, slug, model };
  let answer = String(r.text || "").trim().slice(0, 4000);
  // JSON-mime models (Gemini) wrap prose in {"answer": "..."} — unwrap any obvious envelope.
  try {
    const j = JSON.parse(answer);
    if (j && typeof j === "object") {
      const inner = j.answer || j.response || j.text || j.reply;
      if (typeof inner === "string" && inner.trim()) answer = inner.trim().slice(0, 4000);
    }
  } catch {}
  if (!answer) return { error: "empty answer", slug, model };
  const ts = new Date().toISOString();
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode([ts, slug, "answer", answer, model].join("|")));
  const hash = [...new Uint8Array(hashBuf)].map((x) => x.toString(16).padStart(2, "0")).join("");
  const ins = await env.DB.prepare(
    "INSERT INTO user_entries (ts, subject, context, text, author, source_url, hash, status) VALUES (?,?,?,?,?,?,?,?)",
  ).bind(ts, slug, "answer:" + (b.entry_id || ""), answer, "forum:" + model, "https://miscsubjects.com/a/" + slug, hash, "answered").run();
  if (b.entry_id) {
    try { await env.DB.prepare("UPDATE user_entries SET status='answered' WHERE id=?").bind(b.entry_id).run(); } catch {}
  }
  const out = {
    ok: true,
    slug,
    question: q,
    answer,
    model,
    answer_entry_id: ins.meta.last_row_id,
    question_entry_id: b.entry_id || null,
    thread: "https://miscsubjects.com/api/user-entry?subject=" + encodeURIComponent(slug),
    human_page: "https://miscsubjects.com/a/" + slug,
    tokens_in: r.usage?.prompt_tokens || 0,
    tokens_out: r.usage?.completion_tokens || 0,
  };
  const eventId = await logEvent(env, {
    source: "article-forum",
    key: "ARTICLE_QA",
    actor: model,
    action: "answer",
    direction: "internal",
    status: 200,
    trace_id: String(b.trace_id || "qa_" + Date.now().toString(36)),
    request: { slug, question: q, author: b.author || "anonymous", entry_id: b.entry_id || null, channel: b.channel || null },
    response: out,
  });
  out.ledger_event_id = eventId;
  await notifyOwner(env, '💬 Reader question on "' + title + '" — "' + q.slice(0, 90) + '" → answered by ' + model + ". Thread: https://miscsubjects.com/a/" + slug);
  return out;
}

async function oipWrite(env, b) {
  const slug = slugify2(b.slug || "");
  if (!slug || !slug.startsWith("oip-") || !isOipArticleSlug(slug))
    return { error: "bad OIP slug: " + slug };
  const parsed = parseOipArticleSlug(slug);
  if (parsed.type !== "dynamic" && parsed.type !== "primer")
    return { error: "slug lives in generated shelf/system/capability space: " + slug };
  const existingDyn = await loadDynamicOipArticle(env, slug);
  if (existingDyn && !b.force)
    return { skipped: true, note: "article already exists at version " + existingDyn.version, slug };
  if (parsed.type === "primer" && !b.force)
    return { skipped: true, note: "static primer already exists; use oip-revise", slug };
  const model = String(b.model || OIP_WRITER_MODEL);
  const requestedTitle = String(b.title || slug.replace(/^oip-/, "").replace(/-/g, " ")).slice(0, 140);
  const why = String(b.why || "").slice(0, 500);
  const library = await listDynamicOipArticles(env);
  const sys =
    "You write one new article for the miscsubjects OIP documentation tree. " +
    OIP_PLAIN_ENGLISH_LAW + " " +
    "Structure: markdown ## sections, each an affirmative statement proven in place: the definition of the concept; the exact route that operates it (curl against https://miscsubjects.com); the receipt that proves the operation; where its record lives in the ledger. " +
    "Where a related standard (for example MCP) is relevant, state the concept's own property and the adjacent standard's own property side by side; do not phrase either as a negation of the other. " +
    'Return ONLY one JSON object: {"title":"...","body":"markdown, 500-9000 characters"}';
  const user =
    "NEW ARTICLE SLUG: " + slug +
    "\nWORKING TITLE: " + requestedTitle +
    (why ? "\nWHY IT WAS REQUESTED: " + why : "") +
    "\nEXISTING OIP ARTICLES (do not duplicate them; link to them with /a/<slug> where useful):\n" +
    oipReviewArticleSlugs().concat(library.map((d) => d.slug)).map((s) => "- /a/" + s).join("\n") +
    "\nQUALITY BAR (a fresh model will score the result on these):\n" +
    OIP_REVIEW_QUESTIONS.map((q, i) => (i + 1) + ". " + q).join("\n");
  const r = await callModel(env, model, sys, user, b.max_tokens || 4000, false);
  if (r.err) return { error: "model call failed: " + r.err, slug, model };
  let parsedOut = null;
  try {
    parsedOut = extractJsonLoose(r.text);
  } catch (e) {
    return { error: "writer model did not return valid JSON: " + e.message, slug, model, raw_preview: String(r.text || "").slice(0, 600) };
  }
  const title = String(parsedOut?.title || requestedTitle).slice(0, 180);
  const body = String(parsedOut?.body || "").trim();
  // 2500-char publish floor (was 400 — that floor let a 925-char circular stub go live).
  // insertOipArticleVersion enforces the same gate; failing here gives the model loop a
  // clean error instead of a thrown gate.
  if (body.length < 2500) return { error: "writer body too short (" + body.length + " chars < 2500 publish floor)", slug, model };
  {
    const lint = oipDocLint(body, { comparison: /compar|vs-|mcp/.test(slug) });
    if (!lint.ok) return { error: "writer body violates the writing law", slug, model, lint: lint.violations };
  }
  let version;
  try {
    version = await insertOipArticleVersion(env, {
    slug,
    title,
    body: body.slice(0, 20000),
    author_model: model,
    source: b.review_event_id ? "subsidiary" : "manual",
    review_event_id: b.review_event_id || null,
    });
  } catch (e) {
    return { error: String(e && e.message || e), slug, model };
  }
  const reviewQueue = await enqueueOipLoopTask(env, "/api/protocol/oip-review", {
    slug,
    model,
    questions: reviewQuestionsFor(slug),
  });
  const out = {
    ok: true,
    slug,
    version,
    title,
    model,
    body_chars: body.length,
    human_page: "https://miscsubjects.com/a/" + slug,
    bundle: "https://miscsubjects.com/api/articles/" + slug + "/bundle?format=markdown",
    review_task: reviewQueue.id || reviewQueue.existing || null,
    tokens_in: r.usage?.prompt_tokens || 0,
    tokens_out: r.usage?.completion_tokens || 0,
  };
  const eventId = await logEvent(env, {
    source: "oip-review",
    key: "OIP_ARTICLE_WRITE",
    actor: model,
    action: "write",
    direction: "internal",
    status: 200,
    trace_id: String(b.trace_id || "oip_write_" + Date.now().toString(36)),
    request: { slug, title: requestedTitle, why, model, review_event_id: b.review_event_id || null },
    response: out,
  });
  out.ledger_event_id = eventId;
  await notifyOwner(env, '📄 New OIP article published: "' + title + '" (v' + version + ", by " + model + ") → https://miscsubjects.com/a/" + slug);
  return out;
}

/** A model rewrites a failing OIP article by applying its reviewers' concrete fixes. New append-only version. */
async function oipRevise(env, b) {
  const slug = slugify2(b.slug || "");
  if (!slug || !isOipArticleSlug(slug)) return { error: "bad OIP slug: " + slug };
  const parsed = parseOipArticleSlug(slug);
  if (parsed.type !== "primer" && parsed.type !== "dynamic")
    return { error: "only primer or machine-written articles can be revised: " + slug };
  const current = await rawOipArticleBody(env, slug);
  if (!current) return { error: "no article body found for " + slug };
  const history = await recentOipReviewHistory(env, slug, 5);
  const fixes = (history.reviews || []).flatMap((r) => r.concrete_fixes || []).slice(0, 12);
  const gaps = [...new Set((history.reviews || []).flatMap((r) =>
    (r.missing_concepts || []).map((x) => (typeof x === "string" ? x : x?.slug || x?.title || "")).filter(Boolean),
  ))].slice(0, 10);
  if (!fixes.length && !gaps.length && !b.force)
    return { skipped: true, note: "no reviewer fixes or gaps recorded for " + slug, slug };
  const model = String(b.model || OIP_WRITER_MODEL);
  const sys =
    "You revise one existing article in the miscsubjects OIP documentation tree. " +
    OIP_PLAIN_ENGLISH_LAW + " " +
    "Apply the reviewer fixes and close the named gaps. Keep everything that already works. Keep the same subject. " +
    'Return ONLY one JSON object: {"title":"...","body":"full revised markdown body","changes":["one line per change made"]}';
  const user =
    "ARTICLE SLUG: " + slug +
    "\nCURRENT TITLE: " + current.title +
    "\nCURRENT BODY:\n" + String(current.body).slice(0, 16000) +
    "\n\nREVIEWER FIXES TO APPLY:\n" + (fixes.length ? fixes.map((f, i) => (i + 1) + ". [" + (f.target || "body") + "] " + (f.field_or_section || "") + ": " + (f.change || JSON.stringify(f))).join("\n") : "(none recorded)") +
    "\n\nGAPS NAMED BY REVIEWERS:\n" + (gaps.length ? gaps.map((g) => "- " + g).join("\n") : "(none recorded)") +
    "\n\nQUALITY BAR (a fresh model will re-score the result on these):\n" +
    OIP_REVIEW_QUESTIONS.map((q, i) => (i + 1) + ". " + q).join("\n");
  const r = await callModel(env, model, sys, user, b.max_tokens || 4500, false);
  if (r.err) return { error: "model call failed: " + r.err, slug, model };
  let parsedOut = null;
  try {
    parsedOut = extractJsonLoose(r.text);
  } catch (e) {
    return { error: "revise model did not return valid JSON: " + e.message, slug, model, raw_preview: String(r.text || "").slice(0, 600) };
  }
  const title = String(parsedOut?.title || current.title).slice(0, 180);
  const body = String(parsedOut?.body || "").trim();
  if (body.length < 2500)
    return { error: "revised body too short (" + body.length + " chars < 2500 publish floor)", slug, model };
  {
    const lint = oipDocLint(body, { comparison: /compar|vs-|mcp/.test(slug) });
    if (!lint.ok) return { error: "revised body violates the writing law", slug, model, lint: lint.violations };
  }
  let version;
  try {
    version = await insertOipArticleVersion(env, {
      slug,
      title,
      body: body.slice(0, 20000),
      author_model: model,
      source: "revision",
      review_event_id: b.review_event_id || null,
    });
  } catch (e) {
    return { error: String(e && e.message || e), slug, model };
  }
  const reviewQueue = await enqueueOipLoopTask(env, "/api/protocol/oip-review", {
    slug,
    model,
    questions: reviewQuestionsFor(slug),
  });
  const out = {
    ok: true,
    slug,
    version,
    title,
    model,
    body_chars: body.length,
    changes: Array.isArray(parsedOut?.changes) ? parsedOut.changes.slice(0, 12) : [],
    fixes_applied: fixes.length,
    gaps_considered: gaps.length,
    human_page: "https://miscsubjects.com/a/" + slug,
    review_task: reviewQueue.id || reviewQueue.existing || null,
    tokens_in: r.usage?.prompt_tokens || 0,
    tokens_out: r.usage?.completion_tokens || 0,
  };
  const eventId = await logEvent(env, {
    source: "oip-review",
    key: "OIP_ARTICLE_REVISE",
    actor: model,
    action: "revise",
    direction: "internal",
    status: 200,
    trace_id: String(b.trace_id || "oip_revise_" + Date.now().toString(36)),
    request: { slug, model, fixes, gaps, review_event_id: b.review_event_id || null },
    response: out,
  });
  out.ledger_event_id = eventId;
  await notifyOwner(env, '✍️ OIP article revised: "' + title + '" (v' + version + ", " + fixes.length + " reviewer fixes applied) → https://miscsubjects.com/a/" + slug);
  return out;
}

function oipSlugsFromText(text) {
  const s = String(text || "");
  const found = new Set();
  const patterns = [
    /\/a\/(oip(?:-[a-z0-9-]+)?)/gi,
    /\b(oip(?:-[a-z0-9-]+)?)\b/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(s)) !== null) {
      const slug = slugify2(m[1] || "");
      if (slug && isOipArticleSlug(slug)) found.add(slug);
    }
  }
  if (!found.size && /\bOIP\b|Object Invocation Protocol/i.test(s)) found.add("oip");
  return [...found].slice(0, 24);
}

async function queueOipPurification(env, b = {}) {
  let slugs = Array.isArray(b.slugs) && b.slugs.length ? b.slugs : null;
  if (!slugs) {
    const dyn = await listDynamicOipArticles(env);
    slugs = [...oipReviewArticleSlugs(), ...dyn.map((d) => d.slug)];
  }
  const model = String(b.model || OIP_WRITER_MODEL);
  const unique = [...new Set(slugs.map((s) => slugify2(s)).filter((s) => s && isOipArticleSlug(s)))];
  const inserted = [];
  const existing = [];
  const skipped = [];
  for (const slug of unique) {
    const parsed = parseOipArticleSlug(slug);
    const canRevise = parsed && (parsed.type === "primer" || parsed.type === "dynamic");
    const postTo = canRevise ? "/api/protocol/oip-revise" : "/api/protocol/oip-review";
    const q = await enqueueOipLoopTask(env, postTo, {
      slug,
      model,
      force: canRevise ? true : undefined,
      purification: true,
      purification_rules: "logical-proof-v1",
      intake_event_id: b.intake_event_id || null,
      editorial_event_id: b.editorial_event_id || null,
      brief: String(b.brief || "").slice(0, 1000),
      questions: postTo.includes("review") ? OIP_REVIEW_QUESTIONS : undefined,
    });
    if (q.id) inserted.push({ slug, task_id: q.id, post_to: postTo });
    else if (q.existing) existing.push({ slug, task_id: q.existing, post_to: postTo });
    else skipped.push(slug);
  }
  return {
    ok: true,
    role: "oip-review",
    rules: "logical-proof-v1",
    inserted: inserted.length,
    existing: existing.length,
    skipped,
    tasks: inserted,
    skipped_existing: existing,
    run_one: "POST /api/protocol/run?role=oip-review",
    cron_gate: "KV oip_review_autorun=1",
  };
}

async function readModelIntakeRequest(request) {
  const url = new URL(request.url);
  const ct = request.headers.get("content-type") || "";
  const rawBody = await request.text();
  let parsed = null;
  if (/json/i.test(ct)) {
    try { parsed = JSON.parse(rawBody || "{}"); } catch {}
  }
  const p = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const text = String(p.text || p.chat || p.log || p.body || p.input || rawBody || "").trim();
  return {
    text,
    source_model: String(url.searchParams.get("source_model") || p.source_model || p.model || "unknown-model").slice(0, 120),
    context: String(url.searchParams.get("context") || p.context || "").slice(0, 500),
    target: String(url.searchParams.get("target") || p.target || "oip").slice(0, 80),
    author: String(url.searchParams.get("author") || p.author || "owner").slice(0, 120),
  };
}

async function modelChatIntake(env, request) {
  const b = await readModelIntakeRequest(request);
  if (!b.text) return { error: "text required" };
  const textSha = await sha256(b.text);
  const slugs = oipSlugsFromText(b.text);
  const traceId = "model_chat_" + Date.now().toString(36);
  const eventId = await logEvent(env, {
    source: "model-chat-intake",
    key: "MODEL_CHAT_INTAKE",
    actor: b.source_model,
    action: "raw_chat_ingest",
    direction: "IN",
    status: 202,
    route: "/api/protocol/model-intake",
    trace_id: traceId,
    request: {
      source_model: b.source_model,
      context: b.context,
      target: b.target,
      author: b.author,
      text_sha256: textSha,
      text: b.text,
      slugs,
    },
    response: { queued: true },
  });
  const job = {
    role: "editorial-board",
    post_to: "/api/protocol/editorial-board",
    intake_event_id: eventId,
    source_model: b.source_model,
    context: b.context,
    target: b.target,
    author: b.author,
    text_sha256: textSha,
    slugs,
    preview: b.text.slice(0, 1000),
    instruction: "Extract owner complaints and documentation-rule defects. Do not edit content directly. Queue OIP purification tasks that follow logical-proof rules.",
  };
  const r = await env.DB.prepare(
    "INSERT INTO tasks (created_at, status, body, source) VALUES (datetime('now'), 'open', ?, 'editorial-board')",
  ).bind(JSON.stringify(job)).run();
  return {
    ok: true,
    intake_event_id: eventId,
    text_sha256: textSha,
    chars: b.text.length,
    slugs,
    task_id: r.meta.last_row_id,
    task_role: "editorial-board",
    run_one: "POST /api/protocol/run?role=editorial-board",
    ledger: eventId ? "https://miscsubjects.com/api/events/" + eventId : null,
  };
}

function parseStoredJson(str) {
  try { return JSON.parse(str || "{}") || {}; } catch { return {}; }
}

async function editorialBoard(env, b = {}) {
  const eventId = String(b.intake_event_id || "").trim();
  if (!eventId) return { error: "intake_event_id required" };
  const ev = await readEventFull(env, eventId);
  if (!ev) return { error: "intake event not found: " + eventId };
  const req = parseStoredJson(ev.request_json || ev.request_preview || "{}");
  const text = String(req.text || b.text || "").trim();
  if (!text) return { error: "intake event has no text: " + eventId };
  const fallbackSlugs = [...new Set([...(Array.isArray(b.slugs) ? b.slugs : []), ...(Array.isArray(req.slugs) ? req.slugs : []), ...oipSlugsFromText(text)])]
    .map((s) => slugify2(s))
    .filter((s) => s && isOipArticleSlug(s));
  const model = String(b.model || OIP_DEFAULT_LOOP_MODEL);
  const sys =
    OIP_PLAIN_ENGLISH_LAW + "\n\n" +
    "You are the miscsubjects editorial board intake model. You read raw chat logs from any outside model or from the owner. " +
    "You do not edit article content. You extract documentation-rule defects, owner complaints, target OIP article slugs, and a purification brief. " +
    "The central rule is logical proof: every claim must be proven in place by a route, object, receipt, or ledger event. " +
    "Return ONLY JSON with this shape: " +
    '{"summary":"...","owner_complaints":["..."],"rule_defects":["..."],"content_rules":["..."],"target_slugs":["oip"],"purification_brief":"...","priority":1}';
  const user =
    "INTAKE EVENT: " + eventId +
    "\nSOURCE MODEL: " + String(req.source_model || b.source_model || "unknown") +
    "\nCONTEXT: " + String(req.context || b.context || "") +
    "\nFALLBACK SLUGS: " + (fallbackSlugs.join(", ") || "oip") +
    "\nRAW CHAT LOG:\n" + text.slice(0, 28000);
  const r = await callModel(env, model, sys, user, b.max_tokens || 2600, false);
  let decision = null;
  if (r.err) {
    decision = {
      summary: "Deterministic fallback: model call failed: " + r.err,
      owner_complaints: ["Documentation asserted instead of proving; route/curl/receipt shapes must be explicit."],
      rule_defects: ["Missing logical-proof rule enforcement."],
      content_rules: [OIP_PLAIN_ENGLISH_LAW],
      target_slugs: fallbackSlugs.length ? fallbackSlugs : ["oip"],
      purification_brief: "Rewrite under logical-proof-v1: every sentence must define the mechanism or cite the exact route, object, receipt, or ledger event.",
      priority: 1,
    };
  } else {
    try { decision = extractJsonLoose(r.text); }
    catch {
      decision = {
        summary: String(r.text || "").slice(0, 500),
        owner_complaints: ["Editorial board model returned non-JSON; raw output stored in decision summary."],
        rule_defects: ["Board output must be machine-native JSON."],
        content_rules: [OIP_PLAIN_ENGLISH_LAW],
        target_slugs: fallbackSlugs.length ? fallbackSlugs : ["oip"],
        purification_brief: "Apply logical-proof-v1 and rerun review.",
        priority: 1,
      };
    }
  }
  const targetSlugs = [...new Set([
    ...(Array.isArray(decision.target_slugs) ? decision.target_slugs : []),
    ...fallbackSlugs,
  ])]
    .map((s) => slugify2(s))
    .filter((s) => s && isOipArticleSlug(s));
  if (!targetSlugs.length) targetSlugs.push("oip", "oip-operating-model");
  decision.target_slugs = targetSlugs.slice(0, 24);
  const editorialEventId = await logEvent(env, {
    source: "editorial-board",
    key: "EDITORIAL_BOARD_DECISION",
    actor: model,
    action: "decide",
    direction: "internal",
    status: 200,
    trace_id: String(b.trace_id || "editorial_" + Date.now().toString(36)),
    request: { intake_event_id: eventId, source_model: req.source_model || b.source_model || null },
    response: { decision, tokens_in: r.usage?.prompt_tokens || 0, tokens_out: r.usage?.completion_tokens || 0 },
  });
  const queued = await queueOipPurification(env, {
    slugs: decision.target_slugs,
    model: b.purification_model || OIP_WRITER_MODEL,
    intake_event_id: eventId,
    editorial_event_id: editorialEventId,
    brief: decision.purification_brief || decision.summary || "",
  });
  return {
    ok: true,
    intake_event_id: eventId,
    editorial_event_id: editorialEventId,
    model,
    decision,
    purification_queue: queued,
    ledger: editorialEventId ? "https://miscsubjects.com/api/events/" + editorialEventId : null,
  };
}

async function oipPurifySeed(env, b = {}) {
  const out = await queueOipPurification(env, {
    slugs: Array.isArray(b.slugs) && b.slugs.length ? b.slugs : null,
    model: b.model || OIP_WRITER_MODEL,
    intake_event_id: b.intake_event_id || null,
    editorial_event_id: b.editorial_event_id || null,
    brief: b.brief || "Manual purification seed under logical-proof-v1.",
  });
  const eventId = await logEvent(env, {
    source: "editorial-board",
    key: "OIP_PURIFICATION_SEED",
    actor: String(b.actor || "manual"),
    action: "seed",
    direction: "internal",
    status: 200,
    trace_id: String(b.trace_id || "oip_purify_" + Date.now().toString(36)),
    request: b,
    response: out,
  });
  out.ledger_event_id = eventId;
  out.ledger = eventId ? "https://miscsubjects.com/api/events/" + eventId : null;
  return out;
}

async function oipReview(env, b) {
  const slug = slugify2(b.slug || "oip");
  if (!slug) return { error: "OIP article not found: " + slug };
  const model = String(b.model || "grok/grok-4.3");
  // Non-oip-prefixed corpus slugs resolve through the bundle's articles-plane fallback;
  // the bundle error below is the single not-found gate.
  const bundle = await buildOipArticleBundle(env, slug, { slim: false, review_limit: 3 });
  if (bundle.error) return bundle;
  const bundleMarkdown = formatOipArticleBundleMarkdown(bundle).slice(0, 28000);
  // Register-aware output contract (IX.10): philosophy voxels are scored on prosecution
  // readiness and traversal — never on protocol-doc operability — and the reviewer is told
  // the verbatim law up front: findings become objections, never rewrites.
  const { shelfFor } = await import("../../_lib/oip_articles.js");
  const isPhilosophy = !!shelfFor(slug) || !!bundle.corpus;
  const sys = isPhilosophy
    ? (
      "You are a fresh model prosecuting one voxel of THE TOTAL STRUCTURE — the verbatim source philosophy of the Object Invocation Protocol. " +
      "VERBATIM LAW: this text is prose-preserving; you may attack, score, and propose patches as objections, but never propose rewriting the author's words. Do not call tools. " +
      "Return ONLY one JSON object with this shape: " +
      '{"pass":true,"scores":{"traversal_clarity":0-10,"claim_typing":0-10,"falsification_clarity":0-10,"objection_surface_clarity":0-10,"relationship_to_oip":0-10,"zero_context_key":0-10,"prosecution_readiness":0-10},' +
      '"strongest_attack":{"surface":"S1-S8","exact_claim":"...","attack_type":"...","minimum_patch":"..."},' +
      '"stale_settled_entries":["..."],' +
      '"missing_concepts":["..."],' +
      '"concrete_fixes":[{"target":"objection_ledger|shelf|bundle","change":"..."}],' +
      '"followup_questions":["..."]}'
    )
    : (
      "You are a fresh model evaluating one miscsubjects OIP article. " +
      "Judge machine clarity and human clarity separately. Do not call tools. Do not rewrite the article. " +
      "Return ONLY one JSON object with this shape: " +
      '{"pass":true,"scores":{"json_clarity":0-10,"english_clarity":0-10,"zero_context_human":0-10,"curl_operability":0-10,"mcp_comparison":0-10},' +
      '"can_operate_via_curl":{"answer":true,"route_shape":"..."},' +
      '"mcp_comparison_text":"...",' +
      '"missing_concepts":["..."],' +
      '"subsidiary_articles":[{"slug":"oip-example","title":"...","why":"..."}],' +
      '"concrete_fixes":[{"target":"body|machine_json","field_or_section":"...","change":"..."}],' +
      '"followup_questions":["..."]}'
    );
  const user =
    "ARTICLE SLUG: " + slug +
    "\n\nREVIEW QUESTIONS:\n" + reviewQuestionsFor(slug, !!bundle.corpus).map((q, i) => (i + 1) + ". " + q).join("\n") +
    "\n\nARTICLE BUNDLE:\n" + bundleMarkdown;
  const r = await callModel(env, model, sys, user, b.max_tokens || 3200, false);
  if (r.err) return { error: "model call failed: " + r.err, slug, model };
  let parsed = null;
  try {
    parsed = extractJson(r.text);
  } catch (e) {
    parsed = {
      pass: false,
      scores: {},
      concrete_fixes: [{ target: "model_output", field_or_section: "json", change: "review model did not return valid JSON: " + e.message }],
      raw_preview: String(r.text || "").slice(0, 1000),
    };
  }
  const review = normalizeOipReview(parsed);
  const traceId = String(b.trace_id || "oip_review_" + Date.now().toString(36));
  const out = {
    ok: true,
    slug,
    model,
    review,
    tokens_in: r.usage?.prompt_tokens || 0,
    tokens_out: r.usage?.completion_tokens || 0,
    bundle_url: "https://miscsubjects.com/api/articles/" + slug + "/bundle?format=markdown",
    questions: reviewQuestionsFor(slug),
  };
  const eventId = await logEvent(env, {
    source: "oip-review",
    key: "OIP_ARTICLE_REVIEW",
    actor: model,
    action: "review",
    direction: "internal",
    status: 200,
    trace_id: traceId,
    request: { slug, model, bundle_url: out.bundle_url, questions: OIP_REVIEW_QUESTIONS },
    response: out,
  });
  out.ledger_event_id = eventId;
  out.ledger = eventId ? "https://miscsubjects.com/api/events/" + eventId : null;
  // The recursion: findings become queued work unless the caller opts out.
  if (b.enqueue_followups !== false) {
    try {
      out.followups = await processOipFollowups(env, { review, slug, model, review_event_id: eventId, corpus: !!bundle.corpus });
    } catch (e) {
      out.followups = { error: String(e?.message || e) };
    }
  }
  return out;
}

// \u2500\u2500 THE MATERIAL THREAD BUS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// raw model turn \u2192 ledger event \u2192 material classification \u2192 branch/thread promotion \u2192
// machine JSON \u2192 the next model inherits protocol state. The ledger is the tape; this is
// the compiled memory. Only material deltas promote \u2014 everything is ledgered, sludge never
// reaches state. Verbatim law holds: thread updates NEVER touch philosophy text.
const BRANCH_KEYWORDS = [
  // Operator rule order (2026-07-03): first match wins.
  ['B7', /proof|hygiene|broken|\blink\b|404|receipt|surface/i],
  ['B2', /\bmcp\b|abstraction|\baccess\b|\btool\b|comparison/i],
  ['B9', /ledger|thread|\bbus\b|promot|memory|machine json/i],
  ['B10', /\bdrop\b|\bcold\b|onboard|handoff/i],
  ['B4', /objection|prosecut|relitigat|settled ground|attack the/i],
  ['B3', /replay|repair|lineage|confirm=/i],
  ['B5', /philosophy|axiom|moral floor|total structure|verbatim/i],
  ['B6', /traversal|shelf|voxel graph|bundle|json route/i],
  ['B8', /auth|token|capabilit|security|injection|tenant/i],
];
function classifyMaterial(text) {
  const t = String(text || '');
  if (t.trim().length < 40) return { material: false, type: 'noise' };
  let type = 'clarification';
  if (/materially new|missing (layer|benefit|recursion)|should (gain|add|become)|the next model/i.test(t)) type = 'branch_update';
  if (/i object|objection:|this fails|cannot concede/i.test(t)) type = 'objection';
  if (/settle|answered|resolved/i.test(t) && /objection|thread/i.test(t)) type = 'settlement';
  if (/patch:|minimum patch|fix is to/i.test(t)) type = 'patch';
  if (/broke|breakage|500|internal error|regression/i.test(t)) type = 'breakage';
  if (/test (passed|failed)|acceptance test/i.test(t)) type = 'test_result';
  if (/prior art|already exists in/i.test(t)) type = 'prior_art';
  if (/open question|unresolved:/i.test(t)) type = 'open_question';
  let branch = 'B1';
  for (const [bid, rx] of BRANCH_KEYWORDS) { if (rx.test(t)) { branch = bid; break; } }
  return { material: true, type, branch };
}
function tokSet(s) { return new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3)); }
async function threadStateFor(env, target) {
  const tgt = String(target || 'oip');
  const threads = (await env.DB.prepare("SELECT * FROM protocol_threads WHERE target=? OR ?='oip' ORDER BY branch_id, thread_id").bind(tgt, tgt).all()).results || [];
  const updates = (await env.DB.prepare("SELECT * FROM thread_updates WHERE target=? ORDER BY id DESC LIMIT 400").bind(tgt).all()).results || [];
  const byThread = {};
  for (const u of updates) (byThread[u.thread_key || '?'] = byThread[u.thread_key || '?'] || []).push(u);
  const branches = {};
  for (const th of threads) {
    const ups = byThread[th.thread_key] || [];
    const b = (branches[th.branch_id] = branches[th.branch_id] || { branch_id: th.branch_id, branch_name: th.branch_name, threads: [] });
    b.branch_id_full = th.branch_id + '_' + th.branch_name;
    b.threads.push({
      thread_id: th.thread_id, thread_key: th.thread_key, thread_name: th.thread_name, status: th.status,
      rejected_updates: ups.filter((u) => u.status === 'rejected' || u.status === 'superseded').slice(0, 10)
        .map((u) => ({ id: u.id, classified_type: u.material_type, raw_text: u.material_delta, actor: u.actor, status: u.status, owner_note: u.owner_note, at: u.created_at })),
      latest_material_delta: (ups.find((u) => u.status === 'accepted' || u.status === 'settled') || ups.find((u) => u.status === 'proposed') || {}).material_delta || null,
      latest_status: (ups.find((u) => u.status === 'accepted' || u.status === 'settled') || ups.find((u) => u.status === 'proposed') || {}).status || null,
      source_events: ups.slice(0, 5).map((u) => u.source_ledger_event || u.raw_ledger_event).filter(Boolean),
      accepted_updates: ups.filter((u) => u.status === 'accepted' || u.status === 'settled').slice(0, 10)
        .map((u) => ({ id: u.id, type: u.material_type, classified_type: u.material_type, delta: u.material_delta, raw_text: u.material_delta, actor: u.actor, at: u.created_at, accepted_at: u.decided_at, source_event: u.source_ledger_event || u.raw_ledger_event })),
      proposed_updates: ups.filter((u) => u.status === 'proposed').slice(0, 10)
        .map((u) => ({ id: u.id, type: u.material_type, delta: u.material_delta, actor: u.actor, at: u.created_at })),
    });
  }
  const latest = updates.filter((u) => u.status === 'accepted' || u.status === 'settled').slice(0, 10)
    .map((u) => ({ id: u.id, thread: u.thread_key, type: u.material_type, delta: u.material_delta, actor: u.actor, source_event: u.source_ledger_event || u.raw_ledger_event, at: u.created_at }));
  return {
    kind: 'protocol_thread_state',
    target: tgt,
    reads_as: 'The compiled cross-model memory of the protocol. Read this BEFORE critiquing: if your point matches an accepted update, cite it instead of repeating it; if it is new load, POST /api/protocol/thread-update.',
    post_url: '/api/protocol/thread-update',
    branches: Object.values(branches),
    latest_material_deltas: latest,
    open_threads: threads.filter((t) => t.status === 'open' || t.status === 'active').map((t) => t.thread_key + ' ' + t.thread_name),
    settled_threads: threads.filter((t) => t.status === 'settled').map((t) => t.thread_key + ' ' + t.thread_name),
    counts: { threads: threads.length, updates: updates.length, accepted: updates.filter((u) => u.status === 'accepted').length, proposed: updates.filter((u) => u.status === 'proposed').length },
  };
}
function threadStateMarkdown(st) {
  const lines = ['# Protocol thread state \u2014 ' + st.target, '', st.reads_as, ''];
  for (const b of st.branches) {
    const live = b.threads.filter((t) => t.latest_material_delta);
    if (!live.length) continue;
    lines.push('## ' + b.branch_id + ' ' + b.branch_name);
    for (const t of live) lines.push('- **' + t.thread_key + ' ' + t.thread_name + '** [' + t.status + '] \u2014 ' + String(t.latest_material_delta).slice(0, 300));
    lines.push('');
  }
  lines.push('Post new load: POST /api/protocol/thread-update {"actor":"you","target":"' + st.target + '","raw_text":"..."}');
  return lines.join('\n');
}

// Web ChatGPT's browser can open URLs but its code-interpreter sandbox may not resolve
// miscsubjects.com. This bridge turns one explicitly marked GET into the exact same body
// the POST lane receives. `payload` is the durable full-JSON shape; named query fields are
// the convenient shape for one small operation. Never fire without the literal fire=1.
export function browserFireBody(url) {
  const p = url.searchParams;
  const payload = p.get('payload');
  if (payload) {
    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  const out = {};
  const jsonFields = new Set(['document', 'operations', 'div_ids', 'expected_hashes', 'ids', 'source']);
  const numberFields = new Set(['expected_order', 'older_than_days']);
  for (const [key, value] of p.entries()) {
    if (key === 'fire' || key === 'payload') continue;
    if (jsonFields.has(key)) {
      try { out[key] = JSON.parse(value); } catch { out[key] = value; }
    } else if (numberFields.has(key) && /^-?\d+(?:\.\d+)?$/.test(value)) {
      out[key] = Number(value);
    } else {
      out[key] = value;
    }
  }
  if (!out.key && out.share) out.key = out.share;
  return out;
}

async function runVoxelAction(action, env, request, body) {
  if (action === 'voxel-divide') return voxelDivideAction(env, request, body);
  if (action === 'voxel-edit') return voxelEditAction(env, request, body);
  if (action === 'voxel-move') return voxelMoveAction(env, request, body);
  if (action === 'voxel-consolidate') return voxelConsolidateAction(env, request, body);
  if (action === 'voxel-challenge') return voxelChallengeAction(env, request, body);
  if (action === 'voxel-void') return voxelVoidAction(env, request, body);
  if (action === 'voxel-attest') return voxelAttestAction(env, request, body);
  if (action === 'voxel-batch') return voxelBatchAction(env, request, body);
  if (action === 'voxel-vote') return voxelVoteAction(env, request, body);
  if (action === 'voxel-ratify') return voxelRatifyAction(env, request, body);
  if (action === 'voxel-burn') return voxelBurnAction(env, request, body);
  return null;
}

async function handle(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const action = (parts[2] || "").toLowerCase();
  const mutates =
    method === "POST" ||
    method === "PUT" ||
    method === "PATCH" ||
    method === "DELETE";

  // THE ONE LINK. GET the same address models POST to. Paste this URL into any model
  // conversation and the model knows exactly how to talk to the owner and exactly what to
  // hand back. Plain words only. This page programs the conversation.
  if (method === "GET" && action === "thread-update") {
    const md = [
      '# How to talk to the owner — read this once, then follow it for the whole conversation',
      '',
      'The owner runs a protocol that saves useful ideas from model conversations. The owner is not a clipboard. You do the packaging, not the owner.',
      '',
      '## The one rule',
      '',
      'Whenever your reply contains a MATERIALLY NEW idea — a real finding, a fix, a risk, a missing piece — end your reply with a SAVE BLOCK in exactly this shape:',
      '',
      '```',
      'SAVE THIS?',
      'WHAT IT SAVES (one plain sentence): <the idea, in words a tired human reads in 3 seconds>',
      'IF HE RUNS IT: this exact idea is saved into protocol memory and every future model inherits it.',
      'IF HE DOES NOTHING: nothing is saved, nothing changes.',
      '',
      "curl -s -X POST 'https://miscsubjects.com/api/protocol/thread-update' -H 'content-type: application/json' -d '{\"actor\":\"<your model name>\",\"target\":\"oip\",\"raw_text\":\"<the idea, complete, self-contained>\"}'",
      '```',
      '',
      'If you can call URLs yourself, POST it directly instead and tell him: "Saved as proposal #<id>: <the idea in one sentence>. Accept tap: <the accept curl the response gives you>."',
      '',
      'If your reply contains nothing materially new: NO block. Do not mention the protocol at all.',
      '',
      '## How you must speak',
      '',
      '- Plain sentences. Every protocol word you use, you translate in the same breath (never bare "accept", "bus", "delta", "thread-state").',
      '- When he asks "what is this?" about anything, answer with exactly: 1) what the object is, 2) its ID, 3) the exact text inside it, 4) what accepting does, 5) what happens if he does nothing. Nothing else.',
      '- Never claim something is saved, live, or working unless you saw the response prove it.',
      '- Never repeat an explanation he did not ask for. Never push a command while he is asking a question.',
      '',
      '## Before you critique anything',
      '',
      'Read the already-saved ideas first: https://miscsubjects.com/api/protocol/thread-state?target=oip&format=markdown',
      'If your point is already there, cite it instead of repeating it. Only new load gets a SAVE BLOCK.',
      '',
      '## What this protocol is (one sentence each)',
      '',
      '- OIP: every action a machine takes here produces a receipt anyone can open — https://miscsubjects.com/a/oip',
      '- The philosophy it implements, readable end to end by machine or human: https://miscsubjects.com/a/oip-total-structure',
      '- The full cold-start pack if you want everything: https://miscsubjects.com/api/articles/oip-total-structure/drop',
    ].join('\n');
    return new Response(md, { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'public, max-age=60' } });
  }

  // OPEN INTAKE: any model may post a material thread update (raw turn text or structured).
  // Always ledgered; promoted to PROPOSED when material; owner accepts/rejects/settles.
  if (method === "POST" && action === "thread-update" && !parts[3]) {
    const b = await request.json().catch(() => ({}));
    const raw = String(b.raw_text || b.material_delta || '').trim().slice(0, 8000);
    if (!raw) return json({ error: 'raw_text (or material_delta) required' }, 400);
    const actor = String(b.actor || 'anonymous').slice(0, 120);
    const target = String(b.target || 'oip').slice(0, 80);
    const cls = classifyMaterial(raw);
    const { logEvent } = await import('../../_lib/event_log.js');
    const rawEventId = await logEvent(env, {
      source: 'threads', key: 'THREAD_UPDATE', action: cls.material ? 'material_' + cls.type : 'noise',
      direction: 'in', status: 200, actor: 'public:' + actor,
      request: { target, raw_text: raw, source_kind: b.source_kind || 'model_turn', source_url: b.source_url || null },
      response: { classified: cls },
    });
    if (!cls.material) {
      return json({ ok: true, material: false, type: 'noise', ledgered: rawEventId, note: 'Logged to the tape; below the materiality floor, not promoted to state.' });
    }
    const branch = String(b.suggested_branch || cls.branch);
    let threadKey = String(b.suggested_thread || '');
    let threadCreated = null;
    if (threadKey && !/^B\d+:T\d+$/.test(threadKey)) {
      // Free-text thread name from a machine → create the thread. Machines govern machines.
      const name = threadKey.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'unnamed';
      const maxT = await env.DB.prepare("SELECT MAX(CAST(substr(thread_id,2) AS INTEGER)) n FROM protocol_threads WHERE branch_id=?").bind(branch).first();
      const tid = 'T' + (((maxT && maxT.n) || 0) + 1);
      const bname = (await env.DB.prepare("SELECT branch_name FROM protocol_threads WHERE branch_id=? LIMIT 1").bind(branch).first())?.branch_name || branch;
      threadKey = branch + ':' + tid;
      await env.DB.prepare("INSERT OR IGNORE INTO protocol_threads (thread_key, branch_id, branch_name, thread_id, thread_name, target, status) VALUES (?,?,?,?,?,?, 'open')")
        .bind(threadKey, branch, bname, tid, name, target).run();
      threadCreated = { thread_key: threadKey, thread_name: name };
    }
    if (!threadKey) {
      const th = await env.DB.prepare("SELECT thread_key FROM protocol_threads WHERE branch_id=? ORDER BY thread_id DESC LIMIT 1").bind(branch).first();
      threadKey = th ? th.thread_key : branch + ':T0';
    }
    const mine = tokSet(raw);
    const accepted = (await env.DB.prepare("SELECT id, thread_key, material_delta FROM thread_updates WHERE target=? AND status IN ('accepted','settled') ORDER BY id DESC LIMIT 60").bind(target).all()).results || [];
    let relit = null;
    for (const a of accepted) {
      const theirs = tokSet(a.material_delta);
      const inter = [...mine].filter((w) => theirs.has(w)).length;
      if (inter / (Math.min(mine.size, theirs.size) || 1) >= 0.6) { relit = a; break; }
    }
    const status = relit ? 'relitigation_candidate' : 'proposed';
    const r = await env.DB.prepare(
      "INSERT INTO thread_updates (target, thread_key, material_type, material_delta, actor, source_kind, source_url, source_ledger_event, raw_ledger_event, status, relitigation_of) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(target, threadKey, cls.type, raw, actor, String(b.source_kind || 'model_turn'), b.source_url || null, b.source_ledger_event || null, rawEventId, status, relit ? relit.id : null).run();
    const id = r.meta.last_row_id;
    return json({
      ok: true, material: true, id, type: cls.type, branch, thread: threadKey, status, classifier: 'v2-operator',
      ...(threadCreated ? { thread_created: threadCreated } : {}),
      ...(relit ? { relitigation_of: relit.id, matched_thread: relit.thread_key, settled_answer: relit.material_delta, instruction: 'Bring new load or cite this accepted update.' } : {}),
      raw_ledger_event: rawEventId,
      accept_tap: "curl -s -X POST 'https://miscsubjects.com/api/protocol/thread-update/" + id + "/accept' -H 'x-terminal-key: $TERMINAL_KEY' -H 'content-type: application/json' -d '{\"status\":\"accepted\"}'",
      thread_state: '/api/protocol/thread-state?target=' + encodeURIComponent(target),
    });
  }
  if (method === "POST" && action === "thread-update" && parts[3] && (parts[4] || '') === 'accept') {
    if (!(await authed(request, env))) return json({ error: 'unauthorized \u2014 owner accepts thread updates' }, 401);
    const id = parseInt(parts[3], 10);
    const b = await request.json().catch(() => ({}));
    const status = ['accepted','rejected','settled','superseded'].includes(String(b.status)) ? String(b.status) : 'accepted';
    const row = await env.DB.prepare('SELECT id, target, thread_key FROM thread_updates WHERE id=?').bind(id).first();
    if (!row) return json({ error: 'thread update not found: ' + id }, 404);
    const threadKey = String(b.thread || row.thread_key);
    await env.DB.prepare("UPDATE thread_updates SET status=?, owner_note=?, thread_key=?, decided_at=datetime('now') WHERE id=?")
      .bind(status, String(b.owner_note || '').slice(0, 2000) || null, threadKey, id).run();
    if (status === 'accepted') await env.DB.prepare("UPDATE protocol_threads SET status='active' WHERE thread_key=? AND status='open'").bind(threadKey).run();
    const { logEvent } = await import('../../_lib/event_log.js');
    await logEvent(env, { source: 'threads', key: 'THREAD_ACCEPT', action: 'thread_' + status, direction: 'in', status: 200, actor: 'owner', request: { id, status, thread: threadKey, owner_note: b.owner_note || null }, response: { ok: true } });
    return json({ ok: true, id, status, thread: threadKey, thread_state: '/api/protocol/thread-state?target=' + encodeURIComponent(row.target) });
  }
  if (method === "GET" && action === "thread-state") {
    const st = await threadStateFor(env, url.searchParams.get('target') || 'oip');
    if ((url.searchParams.get('format') || '') === 'markdown') {
      return new Response(threadStateMarkdown(st), { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'public, max-age=30' } });
    }
    return new Response(JSON.stringify(st, null, 2), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30', 'access-control-allow-origin': '*' } });
  }

  const browserFireActions = new Set([
    'voxel-divide', 'voxel-edit', 'voxel-move', 'voxel-consolidate', 'voxel-challenge',
    'voxel-void', 'voxel-attest', 'voxel-batch', 'voxel-vote', 'voxel-ratify', 'voxel-burn',
  ]);
  if (method === 'GET' && browserFireActions.has(action)) {
    if (url.searchParams.get('fire') !== '1') {
      return json({
        error: 'write_not_fired',
        note: 'Web ChatGPT: use the browser/web tool, not code-interpreter Bash. Add fire=1 plus named fields, or payload=<URL-encoded JSON>. For large batches use the OpenAI Action at /api/openai/actions.json.',
        method: 'GET',
        example: '/api/protocol/voxel-challenge?fire=1&slug=<slug>&expected_thread_head=<head>&stance=challenge&body=<URL-encoded text>&actor=chatgpt',
      }, 405);
    }
    const body = browserFireBody(url);
    const out = await runVoxelAction(action, env, request, body);
    return respond(env, action, out, out?.error ? (out.status || 400) : 200, protocolCtx(body));
  }

  // VOXEL DIV verbs sit ABOVE the owner gate: voxelAuth accepts the owner OR the share
  // token the owner hands to a model (act scope, or rows:/pfx: covering VOXEL_<VERB>).
  // ARTICLE BOUNDARY — "is this a new article, or DIVs for an existing one?" Deterministic
  // rule, open to any caller (advisory, read-only): POST {title, markdown}.
  if (method === "POST" && action === "article-boundary") {
    const b = await request.json().catch(() => ({}));
    const advice = await articleBoundaryAdvice(env, b || {});
    return json(advice, advice.status || 200);
  }
  if (method === "POST" && action === "voxel-divide") {
    const b = await request.json().catch(() => ({}));
    const out = await voxelDivideAction(env, request, b);
    return respond(env, "voxel-divide", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "voxel-edit") {
    const b = await request.json().catch(() => ({}));
    const out = await voxelEditAction(env, request, b);
    return respond(env, "voxel-edit", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "voxel-move") {
    const b = await request.json().catch(() => ({}));
    const out = await voxelMoveAction(env, request, b);
    return respond(env, "voxel-move", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "voxel-consolidate") {
    const b = await request.json().catch(() => ({}));
    const out = await voxelConsolidateAction(env, request, b);
    return respond(env, "voxel-consolidate", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "voxel-challenge") {
    const b = await request.json().catch(() => ({}));
    const out = await voxelChallengeAction(env, request, b);
    return respond(env, "voxel-challenge", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "voxel-void") {
    const b = await request.json().catch(() => ({}));
    const out = await voxelVoidAction(env, request, b);
    return respond(env, "voxel-void", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "voxel-attest") {
    const b = await request.json().catch(() => ({}));
    const out = await voxelAttestAction(env, request, b);
    return respond(env, "voxel-attest", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "voxel-batch") {
    const b = await request.json().catch(() => ({}));
    const out = await voxelBatchAction(env, request, b);
    return respond(env, "voxel-batch", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "voxel-vote") {
    const b = await request.json().catch(() => ({}));
    const out = await voxelVoteAction(env, request, b);
    return respond(env, "voxel-vote", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "voxel-ratify") {
    const b = await request.json().catch(() => ({}));
    const out = await voxelRatifyAction(env, request, b);
    return respond(env, "voxel-ratify", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "voxel-burn") {
    const b = await request.json().catch(() => ({}));
    const out = await voxelBurnAction(env, request, b);
    return respond(env, "voxel-burn", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "voxel-merge-planes") {
    const b = await request.json().catch(() => ({}));
    const out = await voxelMergePlanesAction(env, request, b);
    return respond(env, "voxel-merge-planes", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "density-metric") {
    const b = await request.json().catch(() => ({}));
    const out = await densityMetricAction(env, request, b);
    return respond(env, "density-metric", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "probe-start") {
    const b = await request.json().catch(() => ({}));
    const out = await probeStartAction(env, request, b);
    return respond(env, "probe-start", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "probe-grade") {
    const b = await request.json().catch(() => ({}));
    const out = await probeGradeAction(env, request, b);
    return respond(env, "probe-grade", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "GET" && action === "probe-metrics") {
    const list = await env.KV.list({ prefix: "probe_metrics:" });
    const out = {};
    for (const k of list.keys) out[k.name.slice(14)] = JSON.parse((await env.KV.get(k.name)) || "{}");
    return json({ ok: true, READ_ME: "Cold-probe equilibrium metrics per article per model family. full_passes/runs is the drop first-try success rate; novel-confusion trends are read from the discourse duplicates. Re-probe on every new model release.", metrics: out });
  }
  if (method === "POST" && action === "discourse-backfill") {
    if (!(await authed(request, env))) return json({ error: "unauthorized — owner runs the backfill" }, 401);
    const out = await backfillDiscourse(env);
    return respond(env, "discourse-backfill", out, out.error ? 400 : 200, protocolCtx({}));
  }

  if (mutates && !(await authed(request, env)))
    return json(
      { error: "unauthorized \u2014 header x-terminal-key required" },
      401,
    );
  if (method === "GET" && !action) return json(contract());
  if (method === "GET" && action === "grow") {
    return json(
      attachSelf(
        { ok: true, queue: MODEL_GROW_QUEUE },
        "graph_grow",
        {
          contains: "model growth pipeline — populate → collaborate → repair → reflex",
          how_to_use: "POST /api/protocol/grow to run one tick",
        },
      ),
    );
  }
  if (method === "GET" && action === "prompt-pack") {
    const slug = url.searchParams.get("slug") || "";
    const out = await pipelinePromptPack(env, slug, {
      ask: url.searchParams.get("ask") || "",
      title: url.searchParams.get("title") || "",
    });
    return json(
      attachSelf(out, "pipeline_prompt_pack", {
        slug: slug || undefined,
        contains: "read-only mirror of writer/editor prompts the queue would send",
      }),
      out.error ? 400 : 200,
    );
  }
  if (method === "GET" && action === "next")
    return json(await next(env, url.searchParams.get("role")));
  if (method === "POST" && action === "run") {
    const role = url.searchParams.get("role");
    const out = await runProtocolJob(env, role);
    return respond(env, "run", out, out.error ? 400 : 200, { actor: role });
  }
  if (method === "POST" && action === "score") {
    const b = await request.json().catch(() => ({}));
    const out = await score(env, b);
    return respond(env, "score", out, out.error ? 404 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "inventory") {
    const b = await request.json().catch(() => ({}));
    const out = await inventory(env, b);
    return respond(env, "inventory", out, out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "outline") {
    const b = await request.json().catch(() => ({}));
    const out = await outline(env, b);
    return respond(env, "outline", out, out.error ? 404 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "draft") {
    const b = await request.json().catch(() => ({}));
    const auth = await voxelAuth(request, env, b, "VOXEL_EDIT", true);
    if (!auth.ok) return respond(env, "draft", { error: auth.error }, 401, protocolCtx(b));
    const out = await draft(env, b, b.verify_sources !== false);
    return respond(env, "draft", out, out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "review") {
    const b = await request.json().catch(() => ({}));
    const out = await review(env, b);
    return respond(env, "review", out, out.error ? 404 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "oip-seed") {
    const b = await request.json().catch(() => ({}));
    const out = await enqueueOipReviewTasks(env, b);
    return respond(env, "oip-seed", out, out.error ? 400 : 200, protocolCtx(b, { slug: "oip", actor: "oip-review-seed" }));
  }
  if (method === "POST" && action === "oip-review") {
    const b = await request.json().catch(() => ({}));
    const out = await oipReview(env, b);
    return respond(env, "oip-review", out, out.error ? 400 : 200, protocolCtx(b, { actor: "oip-review" }));
  }
  if (method === "POST" && action === "question-answer") {
    const b = await request.json().catch(() => ({}));
    const out = await questionAnswer(env, b);
    return respond(env, "question-answer", out, out.error ? 400 : 200, protocolCtx(b, { slug: b.slug, actor: "article-forum" }));
  }
  if (method === "POST" && action === "oip-write") {
    const b = await request.json().catch(() => ({}));
    const out = await oipWrite(env, b);
    return respond(env, "oip-write", out, out.error ? 400 : 200, protocolCtx(b, { slug: out.slug || null, actor: "oip-write" }));
  }
  if (method === "POST" && action === "oip-revise") {
    const b = await request.json().catch(() => ({}));
    const out = await oipRevise(env, b);
    return respond(env, "oip-revise", out, out.error ? 400 : 200, protocolCtx(b, { slug: out.slug || null, actor: "oip-revise" }));
  }
  if (method === "POST" && action === "model-intake") {
    const out = await modelChatIntake(env, request);
    return respond(env, "model-intake", out, out.error ? 400 : 202, protocolCtx({}, { slug: "oip", actor: "model-chat-intake" }));
  }
  if (method === "POST" && action === "editorial-board") {
    const b = await request.json().catch(() => ({}));
    const out = await editorialBoard(env, b);
    return respond(env, "editorial-board", out, out.error ? 400 : 200, protocolCtx(b, { slug: "oip", actor: "editorial-board" }));
  }
  if (method === "POST" && action === "oip-purify-seed") {
    const b = await request.json().catch(() => ({}));
    const out = await oipPurifySeed(env, b);
    return respond(env, "oip-purify-seed", out, out.error ? 400 : 200, protocolCtx(b, { slug: "oip", actor: "oip-purification" }));
  }
  if (method === "POST" && action === "sources") {
    const b = await request.json().catch(() => ({}));
    const auth = await voxelAuth(request, env, b, "VOXEL_EDIT", true);
    if (!auth.ok) return respond(env, "sources", { error: auth.error }, 401, protocolCtx(b));
    const out = await sources(env, b);
    return respond(env, "sources", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "atomize") {
    const b = await request.json().catch(() => ({}));
    const auth = await voxelAuth(request, env, b, "VOXEL_EDIT", true);
    if (!auth.ok) return respond(env, "atomize", { error: auth.error }, 401, protocolCtx(b));
    const out = await atomize(env, b);
    return respond(env, "atomize", out, out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "contribute") {
    const b = await request.json().catch(() => ({}));
    const auth = await voxelAuth(request, env, b, "VOXEL_EDIT", true);
    if (!auth.ok) return respond(env, "contribute", { error: auth.error }, 401, protocolCtx(b));
    const out = await contribute(env, b);
    return respond(env, "contribute", out, out.error ? 404 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "write") {
    const b = await request.json().catch(() => ({}));
    const auth = await voxelAuth(request, env, b, "VOXEL_EDIT", true);
    if (!auth.ok) return respond(env, "write", { error: auth.error }, 401, protocolCtx(b));
    const out = await write(env, b);
    return respond(env, "write", out, out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "populate") {
    const b = await request.json().catch(() => ({}));
    const out = await populate(env, b);
    return respond(env, "populate", out, out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "editorial") {
    const b = await request.json().catch(() => ({}));
    const out = await editorial(env, b);
    return respond(env, "editorial", out, out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "critique") {
    const b = await request.json().catch(() => ({}));
    const out = await critique(env, b);
    return respond(env, "critique", out, out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "poll") {
    const b = await request.json().catch(() => ({}));
    const out = await poll(env, b);
    return respond(env, "poll", out, out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "synthesize-body") {
    const b = await request.json().catch(() => ({}));
    const out = await synthesizeBody(env, b);
    return respond(env, "synthesize-body", out, out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "question") {
    const b = await request.json().catch(() => ({}));
    const out = await recordQuestion(env, b);
    return respond(env, "ask", out, out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "ask") {
    const b = await request.json().catch(() => ({}));
    const out = await ask(env, b);
    return respond(env, "ask", out, out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "ingest") {
    const b = await request.json().catch(() => ({}));
    const auth = await voxelAuth(request, env, b, "VOXEL_EDIT", true);
    if (!auth.ok) return respond(env, "ingest", { error: auth.error }, 401, protocolCtx(b));
    const out = await ingest(env, b);
    return respond(env, "ingest", out, out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "claim") {
    const b = await request.json().catch(() => ({}));
    const auth = await voxelAuth(request, env, b, "VOXEL_EDIT", true);
    if (!auth.ok) return respond(env, "claim", { error: auth.error }, 401, protocolCtx(b));
    const out = await claim(env, b);
    return respond(env, "claim", out, out.error ? (out.status || 400) : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "repair") {
    const b = await request.json().catch(() => ({}));
    const auth = await voxelAuth(request, env, b, "VOXEL_EDIT", true);
    if (!auth.ok) return respond(env, "repair", { error: auth.error }, 401, protocolCtx(b));
    const out = await repair(env, b);
    return respond(env, "repair", out, out.error ? 404 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "fill-slots") {
    const b = await request.json().catch(() => ({}));
    const out = await fillSlots(env, b);
    return respond(env, "fill-slots", out, out.error ? 404 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "retract") {
    const b = await request.json().catch(() => ({}));
    const out = await retract(env, b);
    return respond(env, "retract", out, out.error ? 404 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "challenge") {
    const b = await request.json().catch(() => ({}));
    const out = await challenge(env, b);
    return respond(env, "challenge", out, out.error ? 404 : 200, protocolCtx(b));
  }
  if (method === "GET" && action === "standings") {
    return json({
      ok: true,
      what: "Epistemic standing ontology — a demarcation instrument. It sorts each claim by what KIND of standing it has, not by true/false. Orthogonal to medical `tier` (which grades evidence strength for a health claim).",
      order_strongest_to_weakest: STANDINGS,
      definitions: STANDING_DEFS,
      entailed_discipline: {
        rule: "standing=entailed requires premise_ids — the existing claim ids the conclusion follows from deductively (true if they are, no hidden premise).",
        landmine: "A valid-looking deduction on a hidden premise is the primary engine of conspiracy. 'He flew on the plane + he knew X → he is complicit' is insinuation wearing entailment's clothes.",
        defense: "POST /api/protocol/challenge {target_claim_id, text, hidden_premise:true, demote_to:'consistent_unproven'|'asserted_at_volume'} demotes the entailment and records the demotion as a receipted node. The graph plus this challenge layer is a structured, auditable argument about what is known — not a truth machine.",
      },
      demote_targets: [...STANDING_DEMOTE],
      post: "POST /api/protocol/claim {slug, text, tier, standing, premise_ids?} — standing optional; premise_ids required when standing=entailed.",
    });
  }
  if (method === "POST" && action === "scrub") {
    const b = await request.json().catch(() => ({}));
    const out = await scrub(env, b);
    return respond(env, "scrub", out, out.error ? 404 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "collaborate") {
    const b = await request.json().catch(() => ({}));
    const out = await collaborate(env, b);
    return respond(env, "collaborate", out, out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "reflex") {
    const b = await request.json().catch(() => ({}));
    const out = await reflex(env, b);
    return respond(env, "grow", out, out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "grow") {
    const b = await request.json().catch(() => ({}));
    const out = await grow(env, b, url);
    return respond(env, "grow", out, out.ok === false && out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "router") {
    const b = await request.json().catch(() => ({}));
    const mode = String(b.mode || "turn").toLowerCase();
    let out;
    if (mode === "gate") out = await routerGate(env, b);
    else if (mode === "append") out = await routerAppend(env, b);
    else if (mode === "sweep") {
      out = await sweepConversationGarbage(env, slugify2(b.slug), {
        dry_run: b.dry_run,
        min_score: b.min_score,
      });
    } else out = await routerTurn(env, b);
    return respond(env, "run", out, out.ok === false && out.error ? 400 : 200, protocolCtx(b));
  }
  if (method === "POST" && action === "library-snapshot") {
    const b = await request.json().catch(() => ({}));
    const out = await librarySnapshot(env, b);
    return respond(env, "populate", out, out.error ? 400 : 200, protocolCtx(b));
  }
  return json(
    {
      error: "not found: " + method + " " + url.pathname,
      try: "GET /api/protocol for the contract",
    },
    404,
  );
}
export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    const action = String(parts[2] || '').toLowerCase();
    const publicWrite = action === 'thread-update' || action.startsWith('voxel-');
    if (publicWrite && request.method !== 'GET' && request.method !== 'HEAD') {
      const text = await request.clone().text();
      let payload = text;
      try {
        payload = JSON.parse(text || '{}');
        if (payload && typeof payload === 'object') {
          payload = { ...payload };
          delete payload.key;
          delete payload.share;
          delete payload.token;
          delete payload.authorization;
        }
      } catch {}
      if (await publicSecretFindingAndRevoke(payload, env, { route: '/api/protocol', actor: 'protocol-ingress' })) return publicSecret404();
    } else if (publicWrite) {
      if (url.searchParams.get('fire') === '1') {
        const publicParams = {};
        for (const [key, value] of url.searchParams.entries()) {
          if (!['key', 'share', 'token', 'authorization', 'terminal_key', 'tk'].includes(key)) publicParams[key] = value;
        }
        if (await publicSecretFindingAndRevoke(publicParams, env, { route: '/api/protocol', actor: 'protocol-ingress' })) return publicSecret404();
      }
    }
    return await handle(context.request, context.env);
  } catch (e) {
    return json(
      { error: "unhandled: " + ((e && e.message) || String(e)) },
      500,
    );
  }
}
