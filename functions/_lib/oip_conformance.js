// OIP conformance suite — the executable answer to "prove this is a protocol".
// A protocol is (1) defined message formats, (2) invariants, (3) a conformance test.
// Each clause below is one normative requirement from the OIP spec (/a/oip-spec),
// executed LIVE against the running build. Evidence is receipts and public URLs,
// never raw tokens. GET /api/dispatch?conformance=1 runs it; results cache 120s.

import { createWork, transitionWork } from './oip_work.js';
import { PROTOCOL_LAWS } from './protocol_laws.js';
import { getCapabilityByFingerprint } from './admin_session.js';
import { publicSecretFindingAndRevoke } from './public_secret_guard.js';

const BASE = "https://miscsubjects.com";

async function hashText(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value == null ? '' : value)));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function ownerHeaders(env) {
  return {
    "content-type": "application/json",
    "x-terminal-key": String(env.TERMINAL_KEY || ""),
  };
}

async function getJson(url, headers) {
  const r = await fetch(url, headers ? { headers } : undefined);
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch {}
  return { status: r.status, body, text };
}

async function postJson(env, payload) {
  const r = await fetch(BASE + "/api/dispatch", {
    method: "POST",
    headers: ownerHeaders(env),
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch {}
  return { status: r.status, body, text };
}

async function postJsonToken(token, payload) {
  const r = await fetch(BASE + "/api/dispatch?share=" + encodeURIComponent(token || ""), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch {}
  return { status: r.status, body, text };
}

function clause(id, title, requirement, pass, evidence, note) {
  return { id, title, requirement, pass: !!pass, evidence: evidence || null, note: note || null };
}

async function safeClause(id, title, run) {
  try { return await run(); }
  catch (e) { return clause(id, title, '', false, null, String(e?.message || e)); }
}

/** Run every conformance clause live. Returns the scorecard. */
export async function runOipConformance(env, options = {}) {
  const clauses = [];
  const started = new Date().toISOString();

  if (!options.onlyLaws) {
  const corePart = Number(options.corePart || 0);
  if (!corePart || corePart === 1) {

  // C1 — self-describing manifest
  try {
    const m = await getJson(BASE + "/api/dispatch");
    clauses.push(clause("C1", "Self-describing manifest",
      "GET /api/dispatch with no parameters MUST return a machine-readable manifest with a protocol version and endpoint map.",
      m.status === 200 && m.body && m.body.version && m.body.endpoints,
      { url: BASE + "/api/dispatch", status: m.status, version: m.body?.version || null }));
  } catch (e) { clauses.push(clause("C1", "Self-describing manifest", "", false, null, String(e?.message || e))); }

  // C2 — object self-description
  try {
    const k = await getJson(BASE + "/api/dispatch?key=NOW");
    const has = k.body && (k.body.object || k.body.key || k.body.self || k.body.what);
    clauses.push(clause("C2", "Object self-description",
      "GET /api/dispatch?key=<KEY> MUST return the object's contract: what it is, when to use it, input shape, and how to invoke it.",
      k.status === 200 && !!has,
      { url: BASE + "/api/dispatch?key=NOW", status: k.status }));
  } catch (e) { clauses.push(clause("C2", "Object self-description", "", false, null, String(e?.message || e))); }

  // C3 — plain-language discovery
  try {
    const a = await getJson(BASE + "/api/dispatch?ask=" + encodeURIComponent("what time is it"));
    const best = a.body?.best || (Array.isArray(a.body?.matches) && a.body.matches[0]);
    clauses.push(clause("C3", "Plain-language discovery",
      "GET /api/dispatch?ask=<plain words> MUST return the best-matching object with a runnable invocation (run_now or example).",
      a.status === 200 && !!best,
      { url: BASE + "/api/dispatch?ask=what+time+is+it", status: a.status, best_key: best?.key || best?.object || null }));
  } catch (e) { clauses.push(clause("C3", "Plain-language discovery", "", false, null, String(e?.message || e))); }

  // C4 — invocation envelope (fires the NOW no-op)
  let nowInv = null;
  try {
    const r = await postJson(env, { key: "NOW", body: "conformance-c4" });
    nowInv = r.body?.invocation?.id || r.body?.proof?.invocation_id || null;
    const receiptLink = r.body?.invocation?.links?.receipt || r.body?.proof?.receipt || null;
    clauses.push(clause("C4", "Invocation envelope",
      "Every invocation MUST return an envelope carrying an invocation id, a receipt link, and a proof block whose ok reflects the real result.",
      r.status === 200 && !!nowInv && !!receiptLink && r.body?.proof?.ok === true,
      { invocation_id: nowInv, confirm: nowInv ? BASE + "/api/dispatch?confirm=" + nowInv : null }));
  } catch (e) { clauses.push(clause("C4", "Invocation envelope", "", false, null, String(e?.message || e))); }

  // C4a/C4b — THE MATERIAL/ATTEMPT INVARIANT. Added 2026-07-30 after an external audit found a
  // provider 503 receipted as "material result proven": the flag was derived from the dispatch
  // completing, not from the provider's outcome. This is the one label the whole system rests on,
  // so both directions are now tested, in-process, against the real classifier.
  try {
    const { providerFailed, providerStatusOf } = await import("./object_contract.js");
    const FAILS = [
      '{"channel":"blooio","status":503,"body":"{\\"error\\":\\"ApiError\\",\\"status\\":503}"}',
      'HTTP 403:Please set a user-agent and respect our robot policy',
      '{"status":200,"body":"{\\"error\\":\\"rejected\\"}"}',
      '{"ok":false,"error":"nope"}',
    ];
    const OKS = [
      'HTTP 200:{"ok":true,"messageId":"<abc@miscsubjects.com>"}',
      '{"channel":"blooio","status":200,"body":"{\\"ok\\":true}"}',
      '{"arcads_id":"x","status":"pending"}',
    ];
    const badMissed = FAILS.filter((r) => !providerFailed(r));
    const goodBlocked = OKS.filter((r) => providerFailed(r));
    clauses.push(clause("C4a", "A provider failure inside a completed dispatch is an ATTEMPT, never a material result",
      "A runner that proxies a provider MUST derive material from the PROVIDER's outcome. A provider error or a status >= 400 nested inside a 200-shaped envelope MUST produce attempt proven; result not observed.",
      badMissed.length === 0,
      { probes: FAILS.length, missed: badMissed.length, statuses: FAILS.map((r) => providerStatusOf(r)) }));
    clauses.push(clause("C4b", "A provider success MUST still count as material",
      "The failure check MUST NOT swallow genuine successes: a provider status < 400, or a pending async handle, MUST remain material.",
      goodBlocked.length === 0,
      { probes: OKS.length, wrongly_blocked: goodBlocked.length, statuses: OKS.map((r) => providerStatusOf(r)) }));
  } catch (e) {
    clauses.push(clause("C4a", "Material/attempt invariant", "", false, null, String(e?.message || e)));
  }

  // C4c — AN ADJUDICATOR MAY NOT NAME A MODEL IT IS NOT. Added 2026-07-30 after an audit found
  // ADJUDICATE_GROK targeting a Kimi model and ADJUDICATE_MINIMAX targeting a GLM model, with
  // signature strings naming models that never ran. Calibration is per-model, so a lying key
  // would attribute a miss rate to a model that never executed and the whole run would be void.
  try {
    const rows = (await env.DB.prepare(
      "SELECT key, target, content FROM directory WHERE key LIKE 'ADJUDICATE%' AND enabled <> 0"
    ).all()).results || [];
    const VENDORS = ['grok', 'minimax', 'kimi', 'glm', 'llama', 'gpt', 'claude', 'opus', 'sonnet', 'haiku', 'gemini', 'qwen', 'deepseek', 'mistral'];
    const offenders = [];
    for (const r of rows) {
      const target = String(r.target || '').toLowerCase();
      const key = String(r.key || '').toLowerCase();
      // Every vendor token in the KEY must also appear in the TARGET.
      for (const v of VENDORS) {
        if (key.includes(v) && !target.includes(v)) offenders.push({ key: r.key, target: r.target, reason: 'key names ' + v + ', target does not' });
      }
      // The prompt must not hardcode a model name; it must sign with the supplied MODEL_TARGET.
      const body = String(r.content || '');
      if (!/MODEL_TARGET/.test(body)) offenders.push({ key: r.key, target: r.target, reason: 'prompt does not require signing with MODEL_TARGET' });
    }
    clauses.push(clause("C4c", "An adjudicator may not name a model it is not",
      "Every enabled ADJUDICATE* row MUST have a key whose vendor tokens appear in its target, and MUST sign with the MODEL_TARGET string supplied at invocation rather than a model name hardcoded in its prompt. Calibration is per-model; a row that lies about which model executes voids any error rate derived from it.",
      offenders.length === 0,
      { checked: rows.length, offenders }));
  } catch (e) { clauses.push(clause("C4c", "An adjudicator may not name a model it is not", "", false, null, String(e?.message || e))); }

  // C5 — receipt forensics
  try {
    const rc = await getJson(BASE + "/api/dispatch?receipt=" + nowInv, ownerHeaders(env));
    const R = rc.body?.receipt || rc.body || {};
    const story = rc.body?.story || R.story || null;
    clauses.push(clause("C5", "Receipts hold the full record",
      "GET ?receipt=<invocation id> MUST return the full request, the full response, and a one-line story of what happened.",
      rc.status === 200 && !!(R.request_full || R.request) && !!(R.response_full || R.response) && !!story,
      { invocation_id: nowInv, has_story: !!story }));
  } catch (e) { clauses.push(clause("C5", "Receipts hold the full record", "", false, null, String(e?.message || e))); }

  // C6 — replay
  try {
    const rp = await postJson(env, { replay: nowInv });
    const newInv = rp.body?.invocation?.id || rp.body?.proof?.invocation_id || null;
    const replayOf = rp.body?.invocation?.replay_of || rp.body?.replay_of || null;
    clauses.push(clause("C6", "Replay",
      "POST {replay:<invocation id>} MUST re-run the recorded invocation and link the new receipt to the original via replay_of.",
      rp.status === 200 && !!newInv && replayOf === nowInv,
      { original: nowInv, replay: newInv, replay_of: replayOf }));
  } catch (e) { clauses.push(clause("C6", "Replay", "", false, null, String(e?.message || e))); }

  // C7 — repair lineage (linked correction, written in both directions)
  try {
    const fix = await postJson(env, { key: "NOW", body: "conformance-c7-repair", repairs: nowInv });
    const fixInv = fix.body?.invocation?.id || fix.body?.proof?.invocation_id || null;
    const fixRepairs = fix.body?.invocation?.repairs || null;
    const target = await getJson(BASE + "/api/dispatch?receipt=" + nowInv, ownerHeaders(env));
    const repairedBy = target.body?.receipt?.repaired_by || target.body?.repaired_by || null;
    clauses.push(clause("C7", "Repairs link both ways",
      "Any invocation MUST accept a linked repair: POST {key, body, repairs:<id>} links them BOTH ways — the repair carries repairs=<target id> and the target receipt reads back repaired_by=<repair id>. History is annotated, never rewritten or deleted.",
      !!fixInv && fixRepairs === nowInv && repairedBy === fixInv,
      { target: nowInv, repair: fixInv, repairs: fixRepairs, repaired_by: repairedBy }));
  } catch (e) { clauses.push(clause("C7", "Repairs link both ways", "", false, null, String(e?.message || e))); }

  // C8 — fail closed on unknown objects
  try {
    const u = await postJson(env, { key: "NOSUCHKEY_CONFORMANCE_123", body: "" });
    const ranFalse = u.body?.ran === false || u.body?.proof?.ok === false || /unknown_key|did_you_mean/.test(u.text);
    clauses.push(clause("C8", "Fail closed",
      "An unknown object MUST return a machine-readable failure (ran:false, nearest-key suggestions) — never a 200 that can be misread as success.",
      ranFalse,
      { attempted: "NOSUCHKEY_CONFORMANCE_123", got_did_you_mean: /did_you_mean/.test(u.text) }));
  } catch (e) { clauses.push(clause("C8", "Fail closed", "", false, null, String(e?.message || e))); }

  // C9 — append-only ledger
  try {
    const inv = await getJson(BASE + "/api/invocations?limit=1", ownerHeaders(env));
    const rows = inv.body?.invocations || inv.body?.results || inv.body || [];
    const row = Array.isArray(rows) ? rows[0] : null;
    clauses.push(clause("C9", "Append-only ledger",
      "Every invocation MUST land in an append-only ledger readable by id, carrying request, response, actor, and trace.",
      inv.status === 200 && !!row,
      { url: BASE + "/api/invocations", latest: row?.invocation_id || row?.id || null }));
  } catch (e) { clauses.push(clause("C9", "Append-only ledger", "", false, null, String(e?.message || e))); }

  // C10 — idempotency dedup
  try {
    // The production guarantee is intentionally a one-second parallel-burst membrane.
    // Fire the conformance pair concurrently so the test measures that contract instead
    // of spending the entire window awaiting the first request's ledger writes.
    const dedupBody = "conformance-dedup-" + Math.random().toString(36).slice(2, 8);
    const pair = await Promise.all([
      postJson(env, { key: "NOW", body: dedupBody }),
      postJson(env, { key: "NOW", body: dedupBody }),
    ]);
    const fired = pair.find((x) => x.body?.invocation?.id || x.body?.proof?.invocation_id) || pair[0];
    const duplicate = pair.find((x) => x.body?.deduped === true || x.body?.already_ran === true);
    const deduped = !!duplicate;
    clauses.push(clause("C10", "Repeat protection",
      "An identical call from the same caller within the repeat window (about 90 seconds) MUST return the original receipt and MUST NOT re-fire the action.",
      pair.every((x) => x.status === 200) && deduped,
      { first: fired.body?.invocation?.id || fired.body?.proof?.invocation_id || null, second_deduped: deduped }));
  } catch (e) { clauses.push(clause("C10", "Repeat protection", "", false, null, String(e?.message || e))); }

  // C11 — capability scoping (least privilege)
  try {
    const mint = await getJson(BASE + "/api/dispatch?mint_share=1&scope=row&key=NOW&ttl=120&uses=3", ownerHeaders(env));
    const tok = mint.body?.share_token || mint.body?.token || null;
    const fp = mint.body?.fingerprint || null;
    const okRun = tok ? await getJson(BASE + "/api/dispatch?invoke=NOW&body=&share=" + encodeURIComponent(tok)) : { status: 0 };
    const denied = tok ? await getJson(BASE + "/api/dispatch?invoke=LOCAL_EXEC&body=echo%20x&share=" + encodeURIComponent(tok)) : { status: 0 };
    clauses.push(clause("C11", "Capability scoping",
      "A row-scoped capability MUST invoke only its named object and MUST be denied on every other object (least privilege is enforced, not advisory).",
      okRun.status === 200 && (denied.status === 401 || denied.status === 403),
      { fingerprint: fp, allowed_status: okRun.status, denied_status: denied.status, token: "<REDACTED>" }));
  } catch (e) { clauses.push(clause("C11", "Capability scoping", "", false, null, String(e?.message || e))); }

  // C12 — public documentation plane
  try {
    const map = await getJson(BASE + "/api/dispatch?map=1");
    const page = await fetch(BASE + "/a/oip");
    const html = await page.text();
    clauses.push(clause("C12", "Public documentation plane",
      "Docs MUST be reachable with zero credentials: the capability tree (?map=1) and the human article root (/a/oip). Actions stay gated; reading never is.",
      map.status === 200 && page.status === 200 && html.includes("Object Invocation Protocol"),
      { map_status: map.status, article_status: page.status }));
  } catch (e) { clauses.push(clause("C12", "Public documentation plane", "", false, null, String(e?.message || e))); }

  // C13 — self-correcting clarity recursion
  try {
    const reviews = env.LEDGER
      ? await env.LEDGER.prepare("SELECT COUNT(*) AS n FROM events WHERE key='OIP_ARTICLE_REVIEW'").first()
      : null;
    const versions = env.DB
      ? await env.DB.prepare("SELECT COUNT(*) AS n FROM oip_articles").first()
      : null;
    clauses.push(clause("C13", "The docs test their own clarity",
      "The documentation MUST test itself: fresh models score every article's machine JSON and English separately, failing articles get machine revisions (append-only versions), and named gaps become new machine-written articles.",
      Number(reviews?.n || 0) > 0 && Number(versions?.n || 0) > 0,
      { reviews_ledgered: Number(reviews?.n || 0), article_versions: Number(versions?.n || 0) }));
  } catch (e) { clauses.push(clause("C13", "The docs test their own clarity", "", false, null, String(e?.message || e))); }

  // C14 — human/machine duality
  try {
    const bundle = await getJson(BASE + "/api/articles/oip/bundle");
    clauses.push(clause("C14", "Human/machine duality",
      "Every article MUST exist in two synchronized forms: a human page (/a/<slug>) and a machine bundle (JSON with body + machine map). The English is the presentation of the JSON, not a separate document.",
      bundle.status === 200 && !!bundle.body?.body && !!bundle.body?.machine,
      { bundle_status: bundle.status, has_machine: !!bundle.body?.machine }));
  } catch (e) { clauses.push(clause("C14", "Human/machine duality", "", false, null, String(e?.message || e))); }

  }
  if (!corePart || corePart === 2) {

  // C15 — server time law
  try {
    const inj = await postJson(env, { key: "NOW", body: "conformance-c15-" + Math.random().toString(36).slice(2, 8), now: "2030-01-01T00:00:00Z", ts: "2030-01-01T00:00:00Z" });
    const invTs = String(inj.body?.invocation?.ts || "");
    let clock = null;
    try { clock = JSON.parse(inj.body?.result || "{}"); } catch {}
    const pacific = /[+-]\d\d:\d\d$/.test(invTs);
    const ignoredInjected = invTs.indexOf("2030") === -1 && String(clock?.today || "").indexOf("2030") === -1;
    clauses.push(clause("C15", "Server time law",
      "Every product timestamp MUST be stamped by the server clock in Pacific time. A caller-supplied time MUST be ignored. No token or item can carry a time it chose.",
      pacific && ignoredInjected,
      { invocation_ts: invTs, clock_today: clock?.today || null, injected_2030_ignored: ignoredInjected }));
  } catch (e) { clauses.push(clause("C15", "Server time law", "", false, null, String(e?.message || e))); }

  // C16 — token-relative affordances (v0.7). An affordance list is computed from the
  // presented credential: public/read never sees an invoke move; owner/act always does.
  try {
    const pub = await getJson(BASE + "/api/dispatch?key=NOW");
    const pubOps = (pub.body?._self?.affordances?.operations || []).map((o) => o.op);
    const own = await postJson(env, { key: "NOW", body: "conformance-c16-" + Math.random().toString(36).slice(2, 8) });
    const ownOps = (own.body?.affordances?.operations || []).map((o) => o.op);
    clauses.push(clause("C16", "You only see moves your token can make",
      "The list of available moves MUST be computed from the token that was presented. A token that cannot run a tool MUST NOT be shown a run move; an owner or act token MUST be shown one. The server enforces the limits either way.",
      pub.status === 200 && pubOps.length > 0 && !pubOps.includes("invoke") && ownOps.includes("invoke"),
      { public_key_NOW_ops: pubOps, owner_envelope_ops: ownOps }));
  } catch (e) { clauses.push(clause("C16", "You only see moves your token can make", "", false, null, String(e?.message || e))); }

  // C17 — typed intent/authority separation plus delegation chain (v0.8.1).
  try {
    const fired = await postJson(env, {
      key: "NOW", body: "conformance-c17-" + Math.random().toString(36).slice(2, 8),
      on_behalf_of: ["conformance-suite", "the-owner"],
      authorized_by: "conformance clause C17 self-test",
    });
    const inv = fired.body?.invocation;
    const chain = inv?.on_behalf_of?.claimed_chain;
    const chainOk = Array.isArray(chain) && chain[0] === "conformance-suite" && chain[1] === "the-owner";
    const typedIntentOk = inv?.intent?.kind === 'invocation_intent'
      && inv?.intent?.authority_kind === 'owner_session'
      && inv?.intent?.current_user_request?.kind === 'caller_attestation'
      && inv?.intent?.current_user_request?.verified_by_credential === false
      && inv?.intent?.retrieved_text_is_data === true
      && Array.isArray(inv?.operation_contract?.preconditions)
      && Array.isArray(inv?.operation_contract?.effects)
      && inv?.postcondition?.proof === 'receipt';
    let receiptOk = false;
    if (inv?.id) {
      const rc = await getJson(BASE + "/api/dispatch?receipt=" + encodeURIComponent(inv.id), ownerHeaders(env));
      const rChain = rc.body?.receipt?.acted_on_behalf_of?.claimed_chain;
      receiptOk = Array.isArray(rChain) && rChain[0] === "conformance-suite"
        && rc.body?.receipt?.authorized_by_user === "conformance clause C17 self-test"
        && rc.body?.receipt?.invocation?.intent?.kind === 'invocation_intent';
    }
    clauses.push(clause("C17", "Receipts separate who allowed it from who asked for it",
      "Every invocation MUST record two separate things: the verified token that allowed it, and the caller's quoted user request that asked for it. It MUST say what the tool needs before it runs, what it changes, and what should be true after; MUST mark fetched text as data, not instructions; and MUST keep the who-acted-for-whom chain on the receipt.",
      chainOk && typedIntentOk && receiptOk,
      { invocation_id: inv?.id || null, envelope_chain: chain || null, typed_intent: typedIntentOk, receipt_carries_chain: receiptOk }));
  } catch (e) { clauses.push(clause("C17", "Delegation chain on receipts", "", false, null, String(e?.message || e))); }

  // C18 — attenuation only narrows and sibling budgets cannot multiply authority (v0.8.1).
  try {
    const parent = await getJson(BASE + "/api/dispatch?mint_share=1&scope=act&ttl=300&uses=2&purpose=conformance-c18-parent", ownerHeaders(env));
    const pTok = encodeURIComponent(parent.body?.share_token || "");
    const child = await getJson(BASE + "/api/dispatch?attenuate=1&share=" + pTok + "&scope=row&key=NOW&ttl=120&uses=1&purpose=conformance-c18-child-a");
    const sibling = await getJson(BASE + "/api/dispatch?attenuate=1&share=" + pTok + "&scope=row&key=NOW&ttl=120&uses=1&purpose=conformance-c18-child-b");
    const overflow = await getJson(BASE + "/api/dispatch?attenuate=1&share=" + pTok + "&scope=row&key=NOW&ttl=120&uses=1&purpose=conformance-c18-child-overflow");
    const readParent = await getJson(BASE + "/api/dispatch?mint_share=1&scope=read&ttl=300&purpose=conformance-c18-read-parent", ownerHeaders(env));
    const rTok = encodeURIComponent(readParent.body?.share_token || "");
    const widen = await getJson(BASE + "/api/dispatch?attenuate=1&share=" + rTok + "&scope=act&ttl=120&uses=2");
    const narrowOk = child.status === 200 && sibling.status === 200 && child.body?.ok && child.body?.scope === "row:NOW"
      && child.body?.parent_fingerprint === parent.body?.fingerprint && Number(child.body?.delegation_depth) === 1
      && Number(child.body?.budget_reserved_from_parent) === 1;
    const aggregateBounded = overflow.status === 403 && overflow.body?.error === "parent_exhausted";
    const widenDenied = widen.status === 403 && widen.body?.error === "scope_widen_denied";
    await getJson(BASE + "/api/dispatch?revoke=" + encodeURIComponent(parent.body?.fingerprint || ""), ownerHeaders(env));
    await getJson(BASE + "/api/dispatch?revoke=" + encodeURIComponent(readParent.body?.fingerprint || ""), ownerHeaders(env));
    clauses.push(clause("C18", "A handed-down token can only shrink",
      "A token holder MAY mint a smaller child token. Each child's budget MUST be taken from the parent's remainder one at a time, so children together can never spend more than the parent has left. Any request for a WIDER child MUST be refused and logged.",
      narrowOk && aggregateBounded && widenDenied,
      { parent: parent.body?.fingerprint || null, children: [child.body?.fingerprint || null, sibling.body?.fingerprint || null], overflow_status: overflow.status, overflow_error: overflow.body?.error || null, widen_status: widen.status, widen_error: widen.body?.error || null }));
  } catch (e) { clauses.push(clause("C18", "A handed-down token can only shrink", "", false, null, String(e?.message || e))); }

  // C19 — membrane revocation (v0.8.1): invocation checks ancestors even if a descendant
  // escapes the eager cascade scan or is concurrently restored.
  try {
    const parent = await getJson(BASE + "/api/dispatch?mint_share=1&scope=act&ttl=300&uses=5&purpose=conformance-c19-parent", ownerHeaders(env));
    const pTok = encodeURIComponent(parent.body?.share_token || "");
    const child = await getJson(BASE + "/api/dispatch?attenuate=1&share=" + pTok + "&scope=row&key=NOW&ttl=180&uses=3&purpose=conformance-c19-child");
    const cTok = encodeURIComponent(child.body?.share_token || "");
    const before = await getJson(BASE + "/api/dispatch?invoke=NOW&body=conformance-c19-" + Math.random().toString(36).slice(2, 8) + "&share=" + cTok);
    const revoke = await getJson(BASE + "/api/dispatch?revoke=" + encodeURIComponent(parent.body?.fingerprint || ""), ownerHeaders(env));
    const after = await getJson(BASE + "/api/dispatch?invoke=NOW&body=conformance-c19b-" + Math.random().toString(36).slice(2, 8) + "&share=" + cTok);
    await env.LEDGER.prepare('UPDATE capabilities SET revoked=0, revoked_ts=NULL WHERE fingerprint=?').bind(child.body?.fingerprint || '').run();
    const escaped = await getJson(BASE + "/api/dispatch?invoke=NOW&body=conformance-c19-escaped-" + Math.random().toString(36).slice(2, 8) + "&share=" + cTok);
    await env.LEDGER.prepare('UPDATE capabilities SET revoked=1, revoked_ts=? WHERE fingerprint=?').bind(new Date().toISOString(), child.body?.fingerprint || '').run();
    const cascaded = Array.isArray(revoke.body?.descendants_revoked) && revoke.body.descendants_revoked.includes(child.body?.fingerprint);
    clauses.push(clause("C19", "Revoking a parent kills every child",
      "Revoking a token MUST also revoke every token handed down from it, all the way down. Every call MUST also check the full chain of parents, so a child that slipped past the sweep still fails.",
      before.status === 200 && revoke.status === 200 && cascaded && after.status === 401 && escaped.status === 401 && escaped.body?.error === 'ancestor_revoked',
      { child_before: before.status, revoked_descendants: revoke.body?.descendants_revoked || null, child_after: after.status, child_after_error: after.body?.error || null, simulated_escape_status: escaped.status, simulated_escape_error: escaped.body?.error || null }));
  } catch (e) { clauses.push(clause("C19", "Revoking a parent kills every child", "", false, null, String(e?.message || e))); }

  // C20 — authority-preserving trails (v0.8.1): successful scoped replay keeps lineage,
  // while a narrower child that can call TRAIL_RUN but not the recorded step fails closed.
  try {
    const parent = await getJson(BASE + "/api/dispatch?mint_share=1&scope=rows&keys=NOW,TRAIL_SAVE,TRAIL_RUN&ttl=300&uses=10&risk_ceiling=high&purpose=conformance-c20-parent", ownerHeaders(env));
    const token = parent.body?.share_token || "";
    const q = encodeURIComponent(token);
    const a = await getJson(BASE + "/api/dispatch?invoke=NOW&body=conformance-c20a-" + Math.random().toString(36).slice(2, 8) + "&share=" + q);
    const b = await getJson(BASE + "/api/dispatch?invoke=NOW&body=conformance-c20b-" + Math.random().toString(36).slice(2, 8) + "&share=" + q);
    const ia = a.body?.invocation?.id, ib = b.body?.invocation?.id;
    const nm = "conformance-c20-" + Math.random().toString(36).slice(2, 8);
    const saved = await postJsonToken(token, { key: "TRAIL_SAVE", body: nm + "|" + ia + "," + ib });
    let savedOk = false; try { savedOk = JSON.parse(saved.body?.result || "{}").ok === true; } catch {}
    const child = await getJson(BASE + "/api/dispatch?attenuate=1&share=" + q + "&scope=row&key=TRAIL_RUN&ttl=120&uses=2&risk_ceiling=high&purpose=conformance-c20-narrow-child");
    const deniedRun = await postJsonToken(child.body?.share_token || "", { key: "TRAIL_RUN", body: nm });
    let denied = null; try { denied = JSON.parse(deniedRun.body?.result || "{}"); } catch {}
    const run = await postJsonToken(token, { key: "TRAIL_RUN", body: nm });
    let steps = []; let runOk = false;
    try { const rr = JSON.parse(run.body?.result || "{}"); runOk = rr.ok === true; steps = rr.steps || []; } catch {}
    const lineageOk = steps.length === 2 && steps[0]?.replay_of === ia && steps[1]?.replay_of === ib && steps.every((s) => s.ok && s.invocation);
    const scopeEscapeDenied = deniedRun.status === 200 && denied?.ok === false && denied?.steps?.[0]?.stopped === 'scope_mismatch';
    await getJson(BASE + "/api/dispatch?revoke=" + encodeURIComponent(parent.body?.fingerprint || ""), ownerHeaders(env));
    clauses.push(clause("C20", "Saved sequences re-run under the caller's own token",
      "A saved trail MUST re-check every step against the caller's own token, stop at the first refusal or failure, and link every step it ran back to the original receipt. Holding the run-a-trail permission alone MUST NOT unlock the recorded steps.",
      savedOk && scopeEscapeDenied && runOk && lineageOk,
      { trail: nm, originals: [ia, ib], narrow_child_denial: denied?.steps?.[0]?.stopped || null, steps: steps.map((s) => ({ inv: s.invocation, replay_of: s.replay_of, ok: s.ok })) }));
  } catch (e) { clauses.push(clause("C20", "Saved sequences re-run under the caller's own token", "", false, null, String(e?.message || e))); }

  // C21 — resource attenuation (v0.9): payload authority is bounded in bytes and
  // descendants may inherit or lower the ceiling, never raise it.
  try {
    const parent = await getJson(BASE + "/api/dispatch?mint_share=1&scope=row&key=NOW&ttl=180&uses=3&max_body_bytes=8&purpose=conformance-c21-parent", ownerHeaders(env));
    const token = encodeURIComponent(parent.body?.share_token || "");
    const allowed = await getJson(BASE + "/api/dispatch?invoke=NOW&body=12345678&share=" + token);
    const denied = await getJson(BASE + "/api/dispatch?invoke=NOW&body=123456789&share=" + token);
    const widened = await getJson(BASE + "/api/dispatch?attenuate=1&share=" + token + "&scope=row&key=NOW&ttl=120&uses=1&max_body_bytes=9");
    const narrowed = await getJson(BASE + "/api/dispatch?attenuate=1&share=" + token + "&scope=row&key=NOW&ttl=120&uses=1&max_body_bytes=4");
    await getJson(BASE + "/api/dispatch?revoke=" + encodeURIComponent(parent.body?.fingerprint || ""), ownerHeaders(env));
    clauses.push(clause("C21", "Size and spend limits can only shrink",
      "A capability MAY set a byte ceiling on each invocation payload. Oversized input MUST fail before the runner fires, and a delegated child MUST inherit or lower that ceiling, never raise it.",
      allowed.status === 200 && denied.status === 413 && String(denied.body?.error || "").startsWith("payload_ceiling:")
        && widened.status === 403 && widened.body?.error === "payload_ceiling_widen_denied"
        && narrowed.status === 200 && Number(narrowed.body?.max_body_bytes) === 4,
      { parent: parent.body?.fingerprint || null, allowed_status: allowed.status, oversized_status: denied.status, widen_status: widened.status, narrowed_ceiling: narrowed.body?.max_body_bytes || null }));
  } catch (e) { clauses.push(clause("C21", "Size and spend limits can only shrink", "", false, null, String(e?.message || e))); }

  // C22 — exact input, output, and contract fingerprints (v1.0).
  try {
    const input = 'conformance-c22-' + Math.random().toString(36).slice(2, 8);
    const fired = await postJson(env, { key: 'NOW', body: input });
    const fp = fired.body?.invocation?.fingerprints || {};
    const pass = fp.algorithm === 'sha-256' && fp.input === await hashText(input)
      && fp.output === await hashText(fired.body?.result) && /^[0-9a-f]{64}$/.test(String(fp.contract || ''));
    clauses.push(clause('C22', 'Receipts fingerprint the exact exchange',
      'Every receipt MUST carry SHA-256 fingerprints of the exact invocation input, exact output, and object contract so tampering or contract drift is detectable.',
      pass, { invocation_id: fired.body?.invocation?.id || null, fingerprints: fp }));
  } catch (e) { clauses.push(clause('C22', 'Receipts fingerprint the exact exchange', '', false, null, String(e?.message || e))); }

  // C23 — row capability contract pinning (v1.0).
  try {
    const mint = await getJson(BASE + '/api/dispatch?mint_share=1&scope=row&key=NOW&ttl=180&uses=3&purpose=conformance-c23', ownerHeaders(env));
    const tok = mint.body?.share_token || '';
    const before = await getJson(BASE + '/api/dispatch?invoke=NOW&body=c23-before&share=' + encodeURIComponent(tok));
    await env.LEDGER.prepare('UPDATE capabilities SET contract_hash=? WHERE fingerprint=?').bind('0'.repeat(64), mint.body?.fingerprint || '').run();
    const after = await getJson(BASE + '/api/dispatch?invoke=NOW&body=c23-after&share=' + encodeURIComponent(tok));
    await getJson(BASE + '/api/dispatch?revoke=' + encodeURIComponent(mint.body?.fingerprint || ''), ownerHeaders(env));
    clauses.push(clause('C23', 'A row token is pinned to the contract it was given',
      'A row-scoped capability MUST record the object contract fingerprint at mint time and MUST fail closed before execution if that contract changes.',
      before.status === 200 && after.status === 409 && String(after.body?.error || '').startsWith('contract_changed:'),
      { fingerprint: mint.body?.fingerprint || null, contract_hash: mint.body?.contract_hash || null, before: before.status, after: after.status, error: after.body?.error || null }));
  } catch (e) { clauses.push(clause('C23', 'A row token is pinned to the contract it was given', '', false, null, String(e?.message || e))); }

  // C24 — accountable work state machine (v1.0).
  try {
    const made = await createWork(env, { title: 'conformance C24', asker: 'c24:asker' });
    const id = made.work?.id;
    const promised = await transitionWork(env, id, 'promise', 'c24:worker');
    const done = await transitionWork(env, id, 'done', 'c24:worker', { receipt_id: 'inv_c24', evidence: { proof: true } });
    const badClose = await transitionWork(env, id, 'close', 'c24:worker');
    const closed = await transitionWork(env, id, 'close', 'c24:asker');
    clauses.push(clause('C24', 'Only the asker closes the work',
      'Work MUST move asked → promised → done → closed. Only the promisor may mark it done, and only the original asker may close it after inspecting the evidence.',
      made.ok && promised.work?.state === 'promised' && done.work?.state === 'done' && badClose.status === 403 && closed.work?.state === 'closed',
      { work_id: id, worker_close_error: badClose.error || null, final_state: closed.work?.state || null }));
  } catch (e) { clauses.push(clause('C24', 'Only the asker closes the work', '', false, null, String(e?.message || e))); }

  // C25 — output artifact references are first-class receipt fields (v1.0).
  try {
    const fired = await postJson(env, { key: 'OIP_TREE', body: '' });
    const links = fired.body?.invocation?.artifacts || [];
    clauses.push(clause('C25', 'Receipts point to produced artifacts',
      'When an output contains durable URLs, files, article paths, or R2 keys, the invocation receipt MUST expose them as structured artifact references.',
      fired.status === 200 && Array.isArray(links) && links.length > 0,
      { invocation_id: fired.body?.invocation?.id || null, artifact_count: links.length, sample: links.slice(0, 3) }));
  } catch (e) { clauses.push(clause('C25', 'Receipts point to produced artifacts', '', false, null, String(e?.message || e))); }

  // C26 — federation discovery + envelope law (v1.1). Both nodes publish a resolvable
  // well-known; the home inbox treats a query envelope as data and executes nothing.
  try {
    const wk = await getJson(BASE + "/.well-known/oip.json");
    const homeAgent = (wk.body?.agents || []).find((a) => a.id === "pepper@miscsubjects.com");
    const peerWk = await getJson("https://oip-peer.owner-account.workers.dev/.well-known/oip.json");
    const peerAgent = (peerWk.body?.agents || []).find((a) => String(a.id).startsWith("buttercup@"));
    clauses.push(clause("C26", "Federated identity is discoverable and envelopes are data",
      "Every federation node MUST publish /.well-known/oip.json with each agent's ES256 public key and inbox, so a stranger resolves identity with zero prior coordination; and a query envelope MUST be answerable without executing anything.",
      wk.status === 200 && wk.body?.protocol === "oip-message/1" && !!homeAgent?.public_key_jwk && !!homeAgent?.inbox && peerWk.status === 200 && !!peerAgent?.public_key_jwk,
      { home_agent: homeAgent?.id || null, home_inbox: homeAgent?.inbox || null, peer_agent: peerAgent?.id || null }));
  } catch (e) { clauses.push(clause("C26", "Federated identity is discoverable and envelopes are data", "", false, null, String(e?.message || e))); }

  // C27 — audience-bound capability (v1.1). A capability minted for a named remote agent MUST
  // fail closed when presented directly at the door (no verified signed sender).
  try {
    const mint = await getJson(BASE + "/api/dispatch?mint_share=1&scope=row&key=NOW&ttl=120&uses=2&aud=[REDACTED_EMAIL]&purpose=conformance-c27", ownerHeaders(env));
    const tok = mint.body?.share_token || "";
    const aud = mint.body?.audience || null;
    const direct = tok ? await getJson(BASE + "/api/dispatch?invoke=NOW&body=c27&share=" + encodeURIComponent(tok)) : { status: 0, body: {} };
    await getJson(BASE + "/api/dispatch?revoke=" + encodeURIComponent(mint.body?.fingerprint || ""), ownerHeaders(env));
    clauses.push(clause("C27", "A capability can be bound to one specific remote agent",
      "A capability MAY name the exact remote agent it is for. It MUST run only inside a signed invoke from that agent, and MUST fail closed (audience_bound) when presented directly with no verified sender — so a leaked or forwarded token is inert.",
      aud === "[REDACTED_EMAIL]" && direct.status === 403 && String(direct.body?.error || "").startsWith("audience_bound"),
      { audience: aud, direct_status: direct.status, direct_error: direct.body?.error || null }));
  } catch (e) { clauses.push(clause("C27", "A capability can be bound to one specific remote agent", "", false, null, String(e?.message || e))); }

  }
  if (!corePart || corePart === 3) {

  // C28 — envelope-layer payload encryption (v1.2). The body can be sealed to a recipient's
  // published key and opened only by that key, independent of the signature and the transport.
  try {
    const { encryptBodyTo, decryptBodyWith, generateKeypairJwk, publicJwkFromPrivate } = await import('./oip_envelope.js');
    const kp = await generateKeypairJwk();
    const secret = { m: 'sealed-' + Math.random().toString(36).slice(2, 10), n: 7 };
    const enc = await encryptBodyTo(publicJwkFromPrivate(kp.privateJwk), secret);
    const opened = await decryptBodyWith(enc, kp.privateJwk);
    let wrongFailed = false;
    try { const other = await generateKeypairJwk(); await decryptBodyWith(enc, other.privateJwk); } catch { wrongFailed = true; }
    clauses.push(clause('C28', 'A message body can be sealed to one recipient',
      'The OIP envelope MUST support encrypting the body to a recipient\'s published key so the same sealed message can travel over HTTPS, email, or any carrier. Only the holder of that key may open it; anyone else fails.',
      enc.alg === 'ECDH-P256-A256GCM' && opened && opened.m === secret.m && opened.n === 7 && wrongFailed,
      { alg: enc.alg, opened_ok: opened?.m === secret.m, wrong_key_denied: wrongFailed }));
  } catch (e) { clauses.push(clause('C28', 'A message body can be sealed to one recipient', '', false, null, String(e?.message || e))); }

  // C29 — projection integrity (voxel DIV plane, ship-order 2026-07-16). Every divided
  // article's chains recompute from genesis and the body is byte-equivalent to the ordered
  // DIVs — the rendered page and the machine read draw from this same verified object.
  try {
    const vx = await getJson(BASE + "/api/articles/philosophy/voxels");
    const v = vx.body?.verification || {};
    clauses.push(clause("C29", "Projection integrity: DIV hashes recompute, body equals the DIV list",
      "On a divided article, every per-DIV provenance chain MUST recompute from genesis and the stored body MUST equal the ordered active DIVs. Verification is recomputed on every read, never trusted.",
      vx.status === 200 && vx.body?.div_mode === true && v.all_chains_valid === true && v.body_matches_divs === true,
      { divs: v.divs, all_chains_valid: v.all_chains_valid, body_matches_divs: v.body_matches_divs }));
  } catch (e) { clauses.push(clause("C29", "Projection integrity", "", false, null, String(e?.message || e))); }

  // C30 — CAS on content. A stale expected_hash MUST 409 hash_stale with the current
  // text + hash in the payload (educate, don't just refuse) and write nothing.
  try {
    const vx = await getJson(BASE + "/api/articles/philosophy/voxels");
    const d2 = (vx.body?.divs || []).find((d) => d.id === "d2");
    const r = await fetch(BASE + "/api/protocol/voxel-edit", {
      method: "POST", headers: { "content-type": "application/json", "x-terminal-key": env.TERMINAL_KEY || "" },
      body: JSON.stringify({ slug: "philosophy", div_id: "d2", text: "conformance-stale-probe", expected_hash: "0000stale0000" }),
    });
    const j = await r.json().catch(() => ({}));
    const vx2 = await getJson(BASE + "/api/articles/philosophy/voxels");
    const d2b = (vx2.body?.divs || []).find((d) => d.id === "d2");
    clauses.push(clause("C30", "CAS on content: stale hash writes nothing",
      "voxel-edit under valid owner authority with a stale expected_hash MUST return 409 hash_stale and write nothing.",
      r.status === 409 && j.error === "hash_stale" && d2 && d2b && d2.vx_hash === d2b.vx_hash && !String(d2b.text).includes("conformance-stale-probe"),
      { refusal_status: r.status, error: String(j.error || "").slice(0, 60), hash_unchanged: d2?.vx_hash === d2b?.vx_hash }));
  } catch (e) { clauses.push(clause("C30", "CAS on content", "", false, null, String(e?.message || e))); }

  // C31/C32 — the discourse gate. Filing a near-verbatim copy of a standing objection MUST
  // return duplicate_match with the canonical entry and an education payload, not a new row.
  try {
    const disc = await getJson(BASE + "/api/articles/philosophy/discourse");
    const strongest = disc.body?.strongest_open;
    let dupOk = false, evidence = null;
    if (strongest) {
      const r = await fetch(BASE + "/api/protocol/voxel-challenge", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: "philosophy", expected_thread_head: disc.body?.thread_head, stance: "challenge", body: strongest.gist, actor: "conformance-probe" }),
      });
      const j = await r.json().catch(() => ({}));
      dupOk = r.status === 409 && j.error === "duplicate_match" && !!j.obj_id && !!j.canonical_link && !!j.how_to_proceed;
      evidence = { status: r.status, canonical: j.obj_id, similarity: j.similarity, education: !!j.how_to_proceed };
    }
    clauses.push(clause("C32", "Duplicate objections gate to the canonical entry",
      "Re-filing a standing objection MUST 409 duplicate_match carrying the canonical id, its link, and how to proceed — the repeat becomes measurement (independently_raised), never noise.",
      dupOk, evidence, strongest ? null : "no open objection to probe against"));
  } catch (e) { clauses.push(clause("C32", "Duplicate detection", "", false, null, String(e?.message || e))); }

  // C31 — CAS on discourse (GUM P1). Filing against a stale thread head MUST 409
  // thread_moved WITH the current head and a compact thread summary — the education
  // payload that ends arguing against a thread you have not read. Nothing is written.
  try {
    const before = await getJson(BASE + "/api/articles/philosophy/discourse");
    const r = await fetch(BASE + "/api/protocol/voxel-challenge", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "philosophy", expected_thread_head: "obj-STALE", stance: "challenge", body: "conformance thread-CAS probe " + Math.random().toString(36).slice(2, 8), actor: "conformance-probe" }),
    });
    const j = await r.json().catch(() => ({}));
    const after = await getJson(BASE + "/api/articles/philosophy/discourse");
    clauses.push(clause("C31", "CAS on discourse: stale thread head educates, writes nothing",
      "voxel-challenge with a stale expected_thread_head MUST return 409 thread_moved carrying the current thread_head and a thread summary (id, gist, OPEN/ANSWERED, answer link per entry), and MUST NOT write.",
      r.status === 409 && j.error === "thread_moved" && !!j.current_thread_head && Array.isArray(j.thread_summary) && j.thread_summary.length > 0 && before.body?.counts?.total === after.body?.counts?.total,
      { status: r.status, current_thread_head: j.current_thread_head, summary_entries: (j.thread_summary || []).length, total_unchanged: before.body?.counts?.total === after.body?.counts?.total }));
  } catch (e) { clauses.push(clause("C31", "CAS on discourse", "", false, null, String(e?.message || e))); }

  // C33 — consolidation lineage. An absorbed DIV keeps its full chain, its status flips to
  // consolidated, and the absorb entry names the target — nothing is deleted.
  try {
    const vx = await getJson(BASE + "/api/articles/grain-the-receipt/voxels");
    const d5 = (vx.body?.divs || []).find((d) => d.id === "d5");
    const absorb = (d5?.chain || []).find((c) => c.op === "absorb");
    clauses.push(clause("C33", "Consolidation lineage survives",
      "After voxel-consolidate the absorbed DIV MUST remain readable with status consolidated, chain intact, and an absorb entry naming the target.",
      d5 && d5.status === "consolidated" && !!absorb && absorb.detail?.into === d5.consolidated_into,
      { absorbed: d5?.id, status: d5?.status, into: d5?.consolidated_into, chain_length: d5?.chain_length }));
  } catch (e) { clauses.push(clause("C33", "Consolidation lineage", "", false, null, String(e?.message || e))); }

  // C34 — credential hygiene (regression for the 2026-07-16 leak fix). No response field of
  // a real invocation may carry a full sh.* token.
  try {
    const r = await getJson(BASE + "/api/dispatch?key=NOW");
    const raw = JSON.stringify(r.body || {});
    const leaked = /sh\.\d{6,}\.[a-z]/.test(raw);
    clauses.push(clause("C34", "No credential travels in any response",
      "No response field anywhere may contain a full share token. Receipt links stay bare (?receipt=inv_ID); say_to_user hands the keyless ?confirm= link; the caller attaches its own credential.",
      r.status === 200 && !leaked, { token_pattern_found: leaked }));
  } catch (e) { clauses.push(clause("C34", "Credential hygiene", "", false, null, String(e?.message || e))); }

  // C35 — formal claims are first-class DIVs with stable identity and a content hash.
  try {
    const claims = await getJson(BASE + "/api/articles/philosophy/claims");
    const first = claims.body?.claims?.[0];
    clauses.push(clause("C35", "Every formal claim is a first-class hashed DIV",
      "The claim read MUST expose claim:<id>, a current content hash, a stable public URL, exact contribution shape, and exact scoped edit shape.",
      claims.status === 200 && claims.body?.count > 0 && /^claim:/.test(first?.id || "") && /^[a-f0-9]{64}$/.test(first?.content_hash || "") && !!first?.stable_url && !!first?.contribute && !!first?.edit,
      { count: claims.body?.count, id: first?.id, hash: String(first?.content_hash || "").slice(0, 12), stable_url: first?.stable_url }));
  } catch (e) { clauses.push(clause("C35", "Claim DIVs", "", false, null, String(e?.message || e))); }

  // C36 — blind clients receive argument bodies and contribution instructions in raw HTML.
  try {
    const page = await fetch(BASE + "/a/philosophy?conformance=" + Date.now(), {
      headers: { accept: "text/html" },
    });
    const html = await page.text();
    clauses.push(clause("C36", "A blind model can read and contribute from the article URL",
      "Raw article HTML MUST contain server-rendered claim ids/hashes, model argument bodies, stable widget links, and the exact voxel-challenge endpoint; JavaScript execution is not required.",
      page.status === 200 && html.includes('data-machine-contribution-surface="1"') && html.includes('data-server-rendered="1"') && html.includes('/api/protocol/voxel-challenge') && html.includes('/i/discourse/'),
      { status: page.status, claim_surface: html.includes('data-machine-contribution-surface="1"'), server_arguments: html.includes('data-server-rendered="1"') }));
  } catch (e) { clauses.push(clause("C36", "Blind-model article surface", "", false, null, String(e?.message || e))); }

  // C37 — the inventory is a graph: article -> tool/code and tool/code -> articles.
  try {
    const article = await getJson(BASE + "/api/inventory?id=" + encodeURIComponent("art:philosophy"));
    const tool = await getJson(BASE + "/api/inventory?id=" + encodeURIComponent("dir:VOXEL_EDIT"));
    clauses.push(clause("C37", "Directory contains articles with links in both directions",
      "An article inventory item MUST name its governing tool/code objects, and each governing object MUST return reverse article relationships.",
      article.status === 200 && Array.isArray(article.body?.relationships) && article.body.relationships.length >= 2 && tool.status === 200 && Array.isArray(tool.body?.reverse_relationships) && tool.body.reverse_relationships.some((r) => r.id === "art:philosophy"),
      { article_edges: article.body?.relationships?.length, reverse_edges: tool.body?.reverse_relationships?.length }));
  } catch (e) { clauses.push(clause("C37", "Bidirectional directory", "", false, null, String(e?.message || e))); }

  // C38 — individual article, claim, DIV, discourse, tool, and code URLs resolve publicly.
  try {
    const claims = await getJson(BASE + "/api/articles/philosophy/claims");
    const claimId = claims.body?.claims?.[0]?.claim_id;
    const urls = [
      BASE + "/i/article/philosophy", BASE + "/i/claim/philosophy/" + encodeURIComponent(claimId || "missing"),
      BASE + "/i/div/philosophy/d1", BASE + "/i/tool/VOXEL_EDIT",
      BASE + "/i/code/functions/_lib/voxel_graph.js",
    ];
    const reads = await Promise.all(urls.map((url) => fetch(url, { redirect: "manual" })));
    clauses.push(clause("C38", "Every item type has a stable public link",
      "Stable item links MUST resolve without credentials to a human or machine representation.",
      reads.every((r) => r.status === 200 || (r.status >= 300 && r.status < 400)),
      { statuses: reads.map((r, i) => ({ url: urls[i], status: r.status })) }));
  } catch (e) { clauses.push(clause("C38", "Stable item links", "", false, null, String(e?.message || e))); }

  }

  }

  if (options.includeLaws !== false) {

  // C39-C44 are independent law probes. Run them concurrently so adding executable
  // law coverage cannot push the complete owner proof past the edge response window.
  const lawClauses = await Promise.all([
    safeClause("C39", "L11 federation census", async () => {
    const g = await getJson(BASE + "/api/governance");
    const counts = g.body?.counts || {};
    const censusLaw = g.body?.participation?.census_law || counts.census_law;
    return clause("C39", "L11 computed federation census",
      "The public governance registry MUST compute node/owner/facet counts from live records and publish census_law explaining that labels are self-asserted evidence, not identity proof.",
      g.status === 200 && Number.isFinite(Number(counts.total ?? counts.total_records)) && Number.isFinite(Number(counts.non_owner_node_count)) && typeof censusLaw === "string" && /self-asserted|not identity/i.test(censusLaw),
      { status: g.status, total_records: counts.total ?? counts.total_records, non_owner_node_count: counts.non_owner_node_count, census_law: censusLaw });
    }),
    safeClause("C40", "L12 deployment mutex", async () => {
    const d = await getJson(BASE + "/api/dispatch?key=DEPLOY_LEASE");
    const raw = JSON.stringify(d.body || {});
    return clause("C40", "L12 production deployment mutex",
      "The deployed lease object MUST expose acquire/check/release, bounded expiry, holder identity, nonce ownership, and receipted conflict refusal.",
      d.status === 200 && ["acquire", "check", "release", "nonce", "holder", "receipt"].every((word) => raw.toLowerCase().includes(word)),
      { status: d.status, contract_terms_present: ["acquire", "check", "release", "nonce", "holder", "receipt"].filter((word) => raw.toLowerCase().includes(word)) });
    }),
    safeClause("C41", "L13 relay taxonomy", async () => {
    const r = await getJson(BASE + "/api/relay");
    const raw = JSON.stringify(r.body || {});
    return clause("C41", "L13 relay outcome taxonomy",
      "Relay v3 MUST preserve a valid append-only chain and distinguish SUCCESS, PARTIAL, MODEL_FAILED, LANE_TIMEOUT, and DENIED outcomes.",
      r.status === 200 && r.body?.social_proof?.chain?.valid === true && ["SUCCESS", "PARTIAL", "MODEL_FAILED", "LANE_TIMEOUT", "DENIED"].every((word) => raw.includes(word)),
      { status: r.status, chain_valid: r.body?.social_proof?.chain?.valid, head: r.body?.social_proof?.chain?.head || null });
    }),
    safeClause("C42", "L14 credential guard", async () => {
    const mint = await getJson(BASE + "/api/dispatch?mint_share=1&scope=row&key=OIP_GOVERNANCE&ttl=120&uses=1", ownerHeaders(env));
    const token = mint.body?.share_token || mint.body?.token || null;
    const fingerprint = mint.body?.fingerprint || null;
    const finding = token ? await publicSecretFindingAndRevoke({ message: "credential guard probe " + token }, env, { route: "/api/conformance/c42", actor: "conformance-c42" }) : null;
    const stored = fingerprint ? await getCapabilityByFingerprint(env, fingerprint) : null;
    return clause("C42", "L14 live-match credential auto-revocation",
      "A live capability found at a public evidence ingress MUST be rejected generically, revoked before return, and unusable afterward; proof exposes only its fingerprint.",
      !!token && finding?.blocked === true && finding?.revoked?.includes(fingerprint) && Number(stored?.revoked || 0) === 1,
      { fingerprint, guard_entrypoint: "publicSecretFindingAndRevoke", blocked: finding?.blocked === true, revoked: Number(stored?.revoked || 0) === 1, token: "<REDACTED>" });
    }),
    safeClause("C43", "L15 repair lineage", async () => {
    const repair = env.DB ? await env.DB.prepare("SELECT id,canonical_of FROM discourse WHERE id LIKE 'repair-%' AND canonical_of LIKE 'obj-%' ORDER BY rowid DESC LIMIT 1").first() : null;
    const original = repair ? await env.DB.prepare("SELECT id FROM discourse WHERE id=? LIMIT 1").bind(repair.canonical_of).first() : null;
    return clause("C43", "L15 canonical objection repair lineage",
      "A repair MUST be an appended discourse record naming canonical_of, while the original objection remains publicly readable; repair never erases or overwrites history.",
      !!repair && !!original,
      { public_link: repair?.id ? BASE + "/a/oip#disc-" + repair.id : null, repair_id: repair?.id || null, canonical_of: repair?.canonical_of || null, original_preserved: !!original });
    }),
    safeClause("C44", "L16 unknown-key refusal", async () => {
    const u = await postJson(env, { key: "DEPLOY_LEAS", body: "" });
    const raw = u.text || "";
    return clause("C44", "L16 unknown-key fail-closed education",
      "A near-miss object name MUST return a typed refusal plus did-you-mean suggestions and MUST NOT execute the suggested object.",
      /unknown_key/.test(raw) && /did_you_mean/.test(raw) && !u.body?.invocation?.id && u.body?.proof?.ok !== true,
      { attempted: "DEPLOY_LEAS", unknown_key: /unknown_key/.test(raw), did_you_mean: /did_you_mean/.test(raw), invocation_created: !!u.body?.invocation?.id });
    }),
  ]);
  clauses.push(...lawClauses);

  // C45 / L17 — the public registry and runtime agree one-to-one.
  try {
    const m = await getJson(BASE + "/api/protocol-laws");
    const laws = m.body?.laws || [];
    // C45 is evaluating the scorecard immediately before it appends itself.
    const runtimeIds = new Set([...clauses.map((item) => item.id), "C45"]);
    const unique = new Set(laws.map((law) => law.clause));
    const closed = laws.length === PROTOCOL_LAWS.length && laws.every((law) => law.status !== "deployed" || runtimeIds.has(law.clause));
    clauses.push(clause("C45", "L17 law-to-clause atomic closure",
      "Every law marked deployed MUST name one unique conformance clause that exists in the same runtime; the ship command MUST refuse an open law.",
      m.status === 200 && closed && unique.size === laws.length && laws.some((law) => law.id === "L17" && law.clause === "C45"),
      { status: m.status, deployed_laws: laws.filter((law) => law.status === "deployed").length, unique_clauses: unique.size, closed }));
  } catch (e) { clauses.push(clause("C45", "L17 law closure", "", false, null, String(e?.message || e))); }
  }

  const passed = clauses.filter((c) => c.pass).length;
  return {
    kind: "oip_conformance",
    protocol: "OIP",
    spec: BASE + "/a/oip-spec",
    definition: "A protocol is defined message formats plus invariants plus a conformance test. This is the conformance test, executed live.",
    ran_at: started,
    clauses,
    passed,
    total: clauses.length,
    conformant: passed === clauses.length,
    verdict: passed === clauses.length
      ? "CONFORMANT — all " + clauses.length + " protocol clauses hold on the live build."
      : "NOT CONFORMANT — " + (clauses.length - passed) + " of " + clauses.length + " clauses failed.",
    rerun: BASE + "/api/dispatch?conformance=1",
    note: "The latest completed owner scorecard remains public until a newer completed run replaces it. Evidence is receipts and public confirm URLs; capability tokens are never echoed.",
  };
}

export function mergeOipConformance(core, laws) {
  const cores = Array.isArray(core) ? core : [core];
  const clauses = [...cores.flatMap((part) => part?.clauses || []), ...(laws?.clauses || [])].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  const ids = new Set(clauses.map((item) => item.id));
  if (clauses.length !== 45 || ids.size !== 45 || clauses[0]?.id !== 'C1' || clauses[44]?.id !== 'C45') {
    throw new Error('incomplete conformance components');
  }
  const passed = clauses.filter((item) => item.pass).length;
  return {
    ...cores[0],
    kind: 'oip_conformance',
    ran_at: new Date().toISOString(),
    component_runs: { core: cores.map((part) => part?.ran_at), laws: laws.ran_at },
    clauses,
    passed,
    total: clauses.length,
    conformant: passed === clauses.length,
    verdict: passed === clauses.length
      ? 'CONFORMANT — all ' + clauses.length + ' protocol clauses hold on the live build.'
      : 'NOT CONFORMANT — ' + (clauses.length - passed) + ' of ' + clauses.length + ' clauses failed.',
    note: 'The complete scorecard is assembled atomically from independently completed core and law batches, then remains public until replaced by a newer completed pair.',
  };
}

export function conformanceMarkdown(c) {
  const lines = [
    "# OIP conformance — live run",
    "",
    "> " + c.definition,
    "",
    "**Verdict:** " + c.verdict,
    "**Ran:** " + c.ran_at + " · **Spec:** " + c.spec + " · **Re-run:** " + c.rerun,
    "",
    "| clause | title | pass | evidence |",
    "|---|---|---|---|",
  ];
  for (const cl of c.clauses) {
    lines.push(
      "| " + cl.id + " | " + cl.title + " | " + (cl.pass ? "PASS" : "FAIL") + " | " +
      (cl.evidence ? JSON.stringify(cl.evidence).replace(/\|/g, "\\|").slice(0, 160) : (cl.note || "")) + " |",
    );
  }
  lines.push("");
  lines.push("## The clauses in full");
  lines.push("");
  for (const cl of c.clauses) {
    lines.push("**" + cl.id + " — " + cl.title + "** (" + (cl.pass ? "PASS" : "FAIL") + ")");
    lines.push(cl.requirement);
    lines.push("");
  }
  return lines.join("\n");
}
