// OIP invocation logging for /api/protocol/* — where writer-queue cost actually lives.
import { logInvocation } from "./invocation_log.js";
import {
  buildInvocationEvent,
  computeDispatchYield,
  knowledgeObjectDescriptor,
  OIP_VERSION,
} from "./object_contract.js";
import { estimateModelCost, materialOutputsFromPass } from "./model_yield.js";

const BASE = "https://miscsubjects.com";

/** Protocol action → directory knowledge object id. */
const PROTOCOL_OBJECT_IDS = {
  write: "PROTOCOL_WRITE",
  populate: "PROTOCOL_POPULATE",
  claim: "PROTOCOL_CLAIM",
  ingest: "PROTOCOL_INGEST",
  repair: "PROTOCOL_REPAIR",
  ask: "ARTICLE_ASK",
  collaborate: "PROTOCOL_RUN",
  grow: "GRAPH_GROW",
  run: "PROTOCOL_RUN",
  draft: "PROTOCOL_WRITE",
  sources: "PROTOCOL_INGEST",
  contribute: "PROTOCOL_WRITE",
  "synthesize-body": "PROTOCOL_WRITE",
  "fill-slots": "PROTOCOL_REPAIR",
  poll: "PROTOCOL_RUN",
  critique: "PROTOCOL_RUN",
  editorial: "PROTOCOL_WRITE",
  score: "PROTOCOL_RUN",
  review: "PROTOCOL_RUN",
  "oip-seed": "OIP_ARTICLE_REVIEW",
  "oip-review": "OIP_ARTICLE_REVIEW",
  "oip-write": "OIP_ARTICLE_REVIEW",
  "oip-revise": "OIP_ARTICLE_REVIEW",
  "model-intake": "MODEL_CHAT_INTAKE",
  "editorial-board": "EDITORIAL_BOARD_RUN",
  "oip-purify-seed": "OIP_PURIFICATION_SEED",
  "question-answer": "ARTICLE_ASK",
  challenge: "PROTOCOL_CLAIM",
  retract: "PROTOCOL_REPAIR",
  scrub: "PROTOCOL_REPAIR",
  reflex: "GRAPH_GROW",
  inventory: "PROTOCOL_RUN",
  outline: "PROTOCOL_WRITE",
  router: "ROUTER",
};

function pickProv(out) {
  if (!out || typeof out !== "object") return null;
  if (out.prov) return out.prov;
  if (out.draft?.prov) return out.draft.prov;
  if (out.generated?.prov) return out.generated.prov;
  return null;
}

function pickTokens(out) {
  const prov = pickProv(out);
  const ti = Number(
    out?.tokens_in ?? prov?.tokens_in ?? (out?.tokens ? Math.floor(out.tokens / 2) : 0) ?? 0,
  );
  const to = Number(out?.tokens_out ?? prov?.tokens_out ?? 0);
  if (ti || to) return { tokens_in: ti, tokens_out: to };
  if (out?.tokens) {
    const t = Number(out.tokens);
    return { tokens_in: Math.floor(t / 2), tokens_out: Math.ceil(t / 2) };
  }
  return { tokens_in: 0, tokens_out: 0 };
}

function pickModel(out) {
  const prov = pickProv(out);
  return String(out?.model || prov?.model || "unknown");
}

/** Count material outputs from protocol response shapes. */
export function countProtocolOutputs(out, action) {
  if (!out || out.error) return 0;
  if (out.skipped === true) return 0;
  if (out.material === false) return 0;

  const a = String(action || "").toLowerCase();
  if (a === "populate") return Math.max(0, Number(out.added || 0));
  if (a === "write" || a === "draft") {
    if (out.generated) {
      return (
        Number(out.generated.claims || 0) +
        Number(out.generated.sources || 0) +
        (out.generated.title ? 1 : 0)
      );
    }
    if (out.draft?.slug) return 1;
    if (out.mode === "outline" && out.count > 0) return Number(out.count);
    if (out.mode === "ideas") return 1;
  }
  if (a === "claim") return out.claim_id ? 1 : Number(out.claims_added?.length || 0);
  if (a === "ingest" || a === "sources") {
    return Number(out.sources_added || out.added || out.count || 0) || (out.ok ? 1 : 0);
  }
  if (a === "repair" || a === "fill-slots") {
    const mat = out.materialized;
    const matN = Array.isArray(mat) ? mat.length : Number(out.materialized_claims || 0);
    return matN + Number(out.wired || out.slots_filled || 0);
  }
  if (a === "collaborate" || a === "grow" || a === "run") {
    const ids = materialOutputsFromPass({ payload: out });
    if (ids.length) return ids.length;
    return Number(out.claims_added?.length || out.claims_posted || 0);
  }
  if (a === "oip-review") return out.review ? 1 : 0;
  if (a === "oip-seed") return Number(out.inserted || 0);
  if (a === "oip-write" || a === "oip-revise") return out.version ? 1 : 0;
  if (a === "model-intake") return out.task_id ? 1 : 0;
  if (a === "editorial-board") return Number(out.purification_queue?.inserted || 0) || (out.decision ? 1 : 0);
  if (a === "oip-purify-seed") return Number(out.inserted || 0);
  if (a === "question-answer") return out.answer ? 1 : 0;
  if (a === "ask") return out.question_node_id ? 1 : 0;
  if (a === "challenge") return out.challenge_id ? 1 : 0;
  if (a === "contribute") return out.contribution_id ? 1 : 0;
  if (out.ok === true) return 1;
  return 0;
}

export function extractProtocolYield(out, action) {
  const { tokens_in, tokens_out } = pickTokens(out);
  const model = pickModel(out);
  const cost =
    out?.cost != null
      ? Number(out.cost)
      : estimateModelCost(model, tokens_in, tokens_out);
  const material_outputs = countProtocolOutputs(out, action);
  const material = material_outputs > 0;
  const tokens_total = tokens_in + tokens_out;
  return {
    tokens_in,
    tokens_out,
    tokens_total,
    cost_usd: Math.round(cost * 1e8) / 1e8,
    material_outputs,
    usd_per_output:
      material_outputs > 0 ? Math.round((cost / material_outputs) * 1e6) / 1e6 : null,
    material,
    waste: !material && (tokens_total > 0 || cost > 0),
  };
}

export function protocolObjectId(action) {
  const a = String(action || "").toLowerCase();
  return PROTOCOL_OBJECT_IDS[a] || "PROTOCOL_RUN";
}

export function wrapProtocolResponse(out, action, ctx = {}) {
  const yield_ = extractProtocolYield(out, action);
  const object_id = protocolObjectId(action);
  const slug = ctx.slug || out?.slug || null;
  const invocation = buildInvocationEvent({
    trace_id: ctx.trace_id || null,
    object_id,
    row: { key: object_id, type: "knowledge", category: "protocol", runner: "model" },
    actor: ctx.actor || slug,
    input: ctx.input_preview || (slug ? "slug=" + slug : action),
    result: JSON.stringify(out).slice(0, 2000),
    cost_usd: yield_.cost_usd,
  });
  invocation.yield = {
    tokens_in: yield_.tokens_in,
    tokens_out: yield_.tokens_out,
    tokens_total: yield_.tokens_total,
    cost_usd: yield_.cost_usd,
    material_outputs: yield_.material_outputs,
    usd_per_output: yield_.usd_per_output,
  };
  invocation.material = yield_.material;
  invocation.waste = yield_.waste;
  if (slug) invocation.slug = slug;

  const knowledge = knowledgeObjectDescriptor(slug || "system-map");
  return {
    ...out,
    invocation,
    yield: yield_,
    _oip: {
      version: OIP_VERSION,
      object_id,
      runner: "model",
      slug,
      knowledge: slug ? knowledge : null,
      observe: {
        invocations: BASE + "/api/invocations" + (slug ? "?slug=" + encodeURIComponent(slug) : ""),
        contributions: slug ? BASE + "/api/articles/" + encodeURIComponent(slug) + "/contributions" : null,
      },
    },
  };
}

export async function logProtocolInvocation(env, action, out, ctx = {}) {
  const wrapped = wrapProtocolResponse(out, action, ctx);
  await logInvocation(env, {
    trace_id: ctx.trace_id,
    object_id: protocolObjectId(action),
    row: { key: protocolObjectId(action), type: "knowledge", category: "protocol", runner: "model" },
    actor: ctx.actor || ctx.slug || null,
    input: ctx.input_preview || ctx.slug || action,
    result: JSON.stringify(out).slice(0, 2000),
    cost_usd: wrapped.yield.cost_usd,
    invocation: wrapped.invocation,
  });
  return wrapped;
}

/** JSON response helper — logs invocation then returns wrapped payload. */
export function protocolJson(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

export async function respondProtocol(env, action, out, status = 200, ctx = {}) {
  const slug = ctx.slug || out?.slug || null;
  const wrapped = await logProtocolInvocation(env, action, out, { ...ctx, slug });
  return protocolJson(wrapped, status);
}
