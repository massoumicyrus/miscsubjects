// Write gate: an article body or title write is refused unless the caller holds a write token,
// and a write token is only issued to a caller that answered questions whose answers exist
// nowhere but in the live law text. Reading the law is therefore not a request — it is the
// only path to the credential.
//
// Failure this exists to stop: a model writes an article from its memory of the writing law
// (or from a skill projection of it), satisfies a remembered style, and violates the live
// clauses. Memory cannot answer the challenge; only the fetched text can.
import { WRITING_LAW_OBJECT } from "./writing_law_object.js";

const TTL_SECONDS = 1800; // 30 minutes — long enough to write, short enough that a token is not a key.
const CHALLENGE_TTL = 900;
const QUESTIONS = 3;

function clauses() {
  return (WRITING_LAW_OBJECT.content?.clauses || []).filter((c) => c && c.id);
}

function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function pick(list, n, seed) {
  // Deterministic per challenge id so the same challenge always asks the same questions.
  const out = [];
  const used = new Set();
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = ((h ^ seed.charCodeAt(i)) * 16777619) >>> 0;
  while (out.length < n && used.size < list.length) {
    h = (h * 1103515245 + 12345) >>> 0;
    const i = h % list.length;
    if (used.has(i)) continue;
    used.add(i);
    out.push(list[i]);
  }
  return out;
}

/** Full law text + the questions. The answers are only derivable from the text returned here. */
export async function issueChallenge(env, slug) {
  const all = clauses();
  const cid = "wg_" + (await sha256(String(slug || "") + ":" + Date.now() + ":" + all.length)).slice(0, 24);
  const asked = pick(all, QUESTIONS, cid);
  const answers = {};
  const questions = asked.map((c) => {
    answers[c.id] = norm(c.title);
    return {
      clause_id: c.id,
      question: `Return the exact title of clause ${c.id} as the field "${c.id}".`,
    };
  });
  const lawHash = await sha256(all.map((c) => c.id + c.title + c.law).join("\n"));
  answers.__law_hash = lawHash;
  await env.KV.put(
    "writegate:challenge:" + cid,
    JSON.stringify({ answers, slug: slug || null, ts: Date.now() }),
    { expirationTtl: CHALLENGE_TTL },
  );
  return {
    challenge_id: cid,
    expires_in: CHALLENGE_TTL,
    law_version: WRITING_LAW_OBJECT.version?.current || null,
    law_hash: lawHash,
    clauses: all,
    questions,
    answer_with: {
      method: "POST",
      url: "/api/write-gate/answer",
      body: {
        challenge_id: cid,
        law_hash: "<sha256 of every clause joined as id+title+law with \\n, hex>",
        answers: Object.fromEntries(asked.map((c) => [c.id, "<exact clause title>"])),
      },
    },
    note:
      "Answers exist only in the clauses returned above. A token is issued on all-correct and refused otherwise.",
  };
}

/** Grade the answers. All-correct mints a token bound to the slug (when the challenge named one). */
export async function answerChallenge(env, payload) {
  const cid = String(payload?.challenge_id || "");
  if (!cid) return { ok: false, status: 400, error: "challenge_id required" };
  const raw = await env.KV.get("writegate:challenge:" + cid);
  if (!raw) return { ok: false, status: 410, error: "challenge_expired_or_unknown", next: "GET /api/write-gate/challenge" };
  const rec = JSON.parse(raw);
  const expected = rec.answers || {};
  const given = payload?.answers || {};
  const wrong = [];
  for (const [id, want] of Object.entries(expected)) {
    if (id === "__law_hash") continue;
    if (norm(given[id]) !== want) wrong.push(id);
  }
  if (String(payload?.law_hash || "") !== expected.__law_hash) wrong.push("law_hash");
  if (wrong.length) {
    return {
      ok: false,
      status: 403,
      error: "answers_incorrect",
      wrong,
      next: "GET /api/write-gate/challenge and read the clauses returned before answering",
    };
  }
  const token = "wt_" + (await sha256(cid + ":" + expected.__law_hash + ":" + Date.now())).slice(0, 32);
  await env.KV.put(
    "writegate:token:" + token,
    JSON.stringify({ slug: rec.slug || null, law_hash: expected.__law_hash, issued: Date.now() }),
    { expirationTtl: TTL_SECONDS },
  );
  return {
    ok: true,
    status: 200,
    write_token: token,
    expires_in: TTL_SECONDS,
    slug: rec.slug || null,
    use: "send header x-write-token: <write_token> on POST /api/articles/<slug>",
  };
}

/** True when the token is live and, if it was issued for a slug, matches this slug. */
export async function tokenValid(env, token, slug) {
  if (!token) return false;
  const raw = await env.KV.get("writegate:token:" + String(token));
  if (!raw) return false;
  const rec = JSON.parse(raw);
  if (rec.slug && slug && rec.slug !== slug) return false;
  return true;
}

export function gateRefusal(slug) {
  return {
    ok: false,
    error: "write_gate",
    law: "WRITE_GATE",
    reason:
      "Article body and title writes require a write token. A token is issued only to a caller that fetched the live writing law and answered questions about it correctly.",
    steps: [
      `GET /api/write-gate/challenge?slug=${slug || "<slug>"} — returns every clause and 3 questions`,
      "POST /api/write-gate/answer {challenge_id, law_hash, answers} — returns write_token, valid 30 minutes",
      `POST /api/articles/${slug || "<slug>"} with header x-write-token: <write_token>`,
    ],
  };
}
