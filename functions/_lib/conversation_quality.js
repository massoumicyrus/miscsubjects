// Conversation quality filter — runs after router parse, before ledger append.
// Keeps the graph alive: explicit blocks only, capped weight, garbage sweep.

const MEDICAL_SPAM =
  /\b(cures?|treats?|heals?|fixes?|guaranteed|fda approved for|take \d|dose of|prescribe)\b/i;
const VAGUE_OPENERS =
  /^(i think|maybe|perhaps|it seems|in my opinion|sort of|kind of)\b/i;
const COMPOUND_SPLIT = /\s+but\s+|\s+however\s+|\s+although\s+/i;

const CONVERSATION_WEIGHT_CAP = 0.35;
const CONVERSATION_HUMAN_WITHOUT_SOURCE = 0.22;

/** Score a parsed conversation claim before POST. */
export function scoreConversationClaim(c, opts = {}) {
  const text = String(c.text || "").trim();
  const reasons = [];
  const warnings = [];
  let score = 1;

  if (text.length < 24) {
    reasons.push("too_short");
    score -= 0.5;
  }
  if (text.length > 600) {
    reasons.push("too_long_conversational");
    score -= 0.35;
  }
  if (text.endsWith("?") || /^(what|why|how|is|are|can|should)\b/i.test(text)) {
    reasons.push("question_not_claim");
    score -= 0.6;
  }
  if (VAGUE_OPENERS.test(text)) {
    reasons.push("vague_opener");
    score -= 0.25;
  }
  if (COMPOUND_SPLIT.test(text)) {
    reasons.push("compound_fragment");
    score -= 0.4;
    warnings.push("Split into separate [CLAIM] blocks — one falsifiable assertion each.");
  }
  if (MEDICAL_SPAM.test(text) && !(c.source_ids || []).length) {
    reasons.push("medical_spam_unsourced");
    score -= 0.7;
  }
  if (
    String(c.tier || "").toLowerCase() === "human" &&
    !(c.source_ids || []).length &&
    !c.challenge
  ) {
    reasons.push("human_tier_requires_source_or_challenge");
    score -= 0.45;
    warnings.push("Human tier downgraded to anecdotal — no source_ids.");
  }
  if (!/\b(is|are|was|were|has|have|shows?|found|reported|demonstrates?|indicates?|suggests?|causes?|reduces?|increases?|weakens?|strengthens?)\b/i.test(text)) {
    reasons.push("not_falsifiable_shape");
    score -= 0.2;
  }

  const hardReject = new Set([
    "question_not_claim",
    "medical_spam_unsourced",
    "compound_fragment",
    "too_short",
  ]);
  const pass =
    score >= (opts.min_score ?? 0.55) &&
    !reasons.some((r) => hardReject.has(r));

  return {
    pass,
    score: Math.max(0, Math.min(1, score)),
    reject_reasons: pass ? [] : reasons,
    warnings,
  };
}

/** Apply conversation register + weight caps before POST. */
export function normalizeConversationClaim(c, channel) {
  const out = { ...c };
  out.register = "conversation";
  out.section = out.section || "Conversation";
  out.channel = channel || "conversation-router";
  out.rationale = out.rationale || "conversation-router — explicit [CLAIM] block";

  const hasSources = (out.source_ids || []).length > 0;
  if (out.tier === "human" && !hasSources && !out.challenge) {
    out.tier = "anecdotal";
    out.weight = CONVERSATION_HUMAN_WITHOUT_SOURCE;
  } else {
    const base = out.tier === "system" ? 0.3 : 0.28;
    out.weight = Math.min(out.weight ?? base, CONVERSATION_WEIGHT_CAP);
  }
  return out;
}

/** Novel intent in follow-up question — gate should open even if topic overlaps. */
export function hasNovelQuestionIntent(oldQuestion, newQuestion) {
  const oldT = new Set(
    norm(oldQuestion)
      .split(" ")
      .filter((w) => w.length > 4),
  );
  const newWords = norm(newQuestion)
    .split(" ")
    .filter((w) => w.length > 4);
  const novel = newWords.filter((w) => !oldT.has(w));
  return novel.length >= 2;
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Filter a batch of parsed claims — returns { accepted, rejected }. */
export function filterConversationClaims(claims, opts = {}) {
  const max = opts.max_claims ?? 5;
  const accepted = [];
  const rejected = [];

  for (const raw of claims.slice(0, max)) {
    const c = normalizeConversationClaim(raw, opts.channel);
    const scored = scoreConversationClaim(c, opts);
    if (scored.pass) {
      accepted.push({ ...c, quality: scored });
    } else {
      rejected.push({ ...c, quality: scored });
    }
  }
  if (claims.length > max) {
    rejected.push({
      text: "(truncated)",
      quality: {
        pass: false,
        reject_reasons: ["batch_limit_" + max],
        score: 0,
      },
    });
  }
  return { accepted, rejected };
}

/** Retract low-quality conversation claims on one article. */
export async function sweepConversationGarbage(env, slug, opts = {}) {
  const { retractClaimInMeta } = await import("./ledger_honesty.js");

  const row = await env.DB.prepare(
    "SELECT slug, title, body, meta FROM articles WHERE slug=?",
  )
    .bind(slug)
    .first();
  if (!row) return { error: "article not found: " + slug };

  let meta = JSON.parse(row.meta || "{}");
  const retracted = [];

  for (const c of meta.claims || []) {
    const isConversation =
      c.register === "conversation" ||
      c.section === "Conversation" ||
      c.posted_by?.channel?.includes("conversation");
    if (!isConversation || c.status === "retracted") continue;

    const scored = scoreConversationClaim(c, { min_score: opts.min_score ?? 0.4 });
    if (scored.pass) continue;

    if (opts.dry_run) {
      retracted.push({ claim_id: c.id, dry_run: true, reasons: scored.reject_reasons });
      continue;
    }

    const out = retractClaimInMeta(meta, c.id, {
      reason: "conversation garbage sweep: " + (scored.reject_reasons || []).join(", "),
      channel: "conversation-sweep",
      actor: "system/conversation-sweep",
    });
    if (!out.error) {
      meta = out.meta;
      retracted.push({ claim_id: c.id, reasons: scored.reject_reasons });
    }
  }

  if (!opts.dry_run && retracted.length) {
    await env.DB.prepare("UPDATE articles SET meta=?, updated_at=? WHERE slug=?")
      .bind(JSON.stringify(meta), new Date().toISOString(), slug)
      .run();
  }

  const remaining = (meta.claims || []).filter(
    (c) =>
      c.status !== "retracted" &&
      (c.register === "conversation" ||
        c.section === "Conversation" ||
        c.posted_by?.channel?.includes("conversation")),
  ).length;

  return {
    ok: true,
    slug,
    retracted_count: retracted.length,
    retracted,
    conversation_claims_remaining: remaining,
    dry_run: !!opts.dry_run,
  };
}