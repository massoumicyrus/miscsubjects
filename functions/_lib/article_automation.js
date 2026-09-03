import { scrubOwnerIdentity } from './public_secret_guard.js';
// Event-driven hooks on article lifecycle — self-firing recursion brick.

const BASE = "https://miscsubjects.com";

/**
 * Fires after a new article row is created (not on update).
 * Ledgered so any model can see "a new article landed" and act via share token.
 */
export async function onArticleCreated(env, slug, meta = {}) {
  if (!env?.LEDGER || !slug) return { ok: false, reason: "no_ledger_or_slug" };
  const ts = new Date().toISOString();
  const trace = "t_article_" + Math.random().toString(36).slice(2, 10);
  const payload = {
    kind: "article_created",
    slug,
    title: meta.title || slug,
    url: BASE + "/a/" + slug,
    bundle: BASE + "/api/articles/" + encodeURIComponent(slug) + "/bundle?format=markdown",
    admin: BASE + "/admin/articles/" + encodeURIComponent(slug),
    self: BASE + "/api/articles/" + encodeURIComponent(slug),
    system_map: BASE + "/api/articles/system-map?format=markdown&article=" + encodeURIComponent(slug),
    act_hint: "GET " + BASE + "/api/dispatch?resume=1 — see this event in recent turns after ledger ingest",
  };
  let eventId = null;
  try {
    await env.LEDGER.prepare(
      `INSERT INTO events (id, ts, source, key, actor, action, direction, status, trace_id, request_preview, response_preview)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      eventId = crypto.randomUUID(),
      ts,
      "automation",
      "ARTICLE_CREATED",
      "build:article-hook",
      "article_created",
      "internal",
      200,
      trace,
      JSON.stringify({ slug }),
      scrubOwnerIdentity(JSON.stringify(payload))
    ).run();
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
  let fired = null;
  try {
    const { dispatch } = await import("../api/dispatch.js");
    const rr = await dispatch(env, "AUTOMATE_FIRE", "ARTICLE_CREATED|" + JSON.stringify(payload), {
      actor: "article-created-hook",
    });
    try { fired = JSON.parse(rr.result || "{}"); } catch { fired = { raw: rr.result }; }
  } catch (e) {
    fired = { error: String(e?.message || e) };
  }
  return { ok: true, trace_id: trace, slug, event_id: eventId, payload, automations: fired };
}

/**
 * Fires after a CLI turn lands (grok/cc/agent_log). Points the next model at unified handoff.
 */
export async function onCliTurnComplete(env, rec = {}) {
  if (!env?.LEDGER) return { ok: false, reason: "no_ledger" };
  const agent = String(rec.agent || "cli");
  const ts = new Date().toISOString();
  const trace = "t_turn_" + Math.random().toString(36).slice(2, 10);
  const payload = {
    kind: "cli_turn_complete",
    agent,
    session: rec.session || null,
    turn_key: rec.turn_key || null,
    handoff: BASE + "/api/handoff?format=markdown",
    resume: BASE + "/api/dispatch?resume=1&format=markdown",
    ledger: BASE + "/admin/ledger?cards=1&service=" + (agent === "grok" ? "grok-cli" : agent === "claude" ? "claude-cli" : "all"),
    act_hint: "Append &share=<ACT_TOKEN> to handoff URL — same token as build/resume/invoke",
  };
  try {
    await env.LEDGER.prepare(
      `INSERT INTO events (id, ts, source, key, actor, action, direction, status, trace_id, request_preview, response_preview)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      ts,
      agent === "grok" ? "grok-cli" : agent === "claude" ? "claude-code" : "automation",
      "TURN_COMPLETE",
      "build:turn-hook",
      "turn_complete",
      "internal",
      200,
      trace,
      // BOTH SIDES GET SCRUBBED, NOT JUST THE ONE WE COMPOSE. This INSERT goes straight to D1
      // and never touches event_log.js, so it does not inherit that lane's redaction — the
      // scrub has to be spelled out here, on every column that carries caller-supplied text.
      // It was only on the response, which is the half this file builds itself; the request
      // half echoed rec.turn_key verbatim, and a turn_key is a local filesystem path. A CLI
      // run on 2026-08-05 wrote /Users/<name>/.gemini/tmp/... into request_preview and failed
      // the post-promotion NAME_LAW gate, blocking every deploy until it was scrubbed. The
      // response column on the same row was clean, which is what made the asymmetry obvious.
      scrubOwnerIdentity(JSON.stringify({ agent, turn_key: rec.turn_key || null })),
      scrubOwnerIdentity(JSON.stringify(payload))
    ).run();
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
  return { ok: true, trace_id: trace, payload };
}
