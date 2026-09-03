// GOVERNOR — the build's manager. Periodically reads the last window of ledger turns,
// computes a deterministic symptom digest (recurring errors, file collisions, loop states,
// auth lockouts, cron noise, task flow, waste), has a model write the governor's brief on
// top of it, emails the owner, texts a summary, and ledgers the whole thing.
//
// Triggers (all KV-gated, fired via waitUntil from dispatch traffic — no new routes):
//   time    — every governor_cfg.every_hours (default 12h)
//   volume  — governor_cfg.volume new events since last brief (default 2000)
//   errors  — governor_cfg.error_burst new error events since last brief (default 150)
//   manual  — dispatch GOVERNOR_RUN (always runs; arg 'dry' = digest only, no model/email)
//
// The GOVERNOR directory row holds the charter prompt (editable in the ledger brain panel).
// settings.governor_corpus, when filled, is injected as the owner's systems-governance corpus.

import { logEvent } from './event_log.js';

const OWNER_PHONE = '[OWNER_PHONE]';
// theloopway.com because it resolves and is verified today. [OWNER_EMAIL] is the real primary, but the
// .co delegation to ns1/ns2.dnsimple.com is lame (nameservers answer REFUSED), so nothing reaches it
// until that is repaired at the registrar. Not a wrong address. See functions/api/email/send.js.
const OWNER_EMAIL = '[OWNER_EMAIL]';
const DEFAULT_CFG = { every_hours: 12, volume: 2000, error_burst: 150, model_key: 'GOVERNOR', fallback_key: 'ASK_GEMINI', window_hours: 48, autorun: 1 };

async function cfgOf(env) {
  let cfg = { ...DEFAULT_CFG };
  try {
    const raw = env.KV ? await env.KV.get('governor_cfg') : null;
    if (raw) cfg = { ...cfg, ...JSON.parse(raw) };
  } catch {}
  return cfg;
}

function pt(ts) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts || Date.now()));
  } catch { return String(ts || ''); }
}

function clip(s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n); }

// ── Deterministic symptom digest. Everything counted, nothing inferred. ──
export async function buildGovernorDigest(env, windowHours) {
  // events.ts holds BOTH formats (UTC-Z and Pacific-offset — known defect, governor tracks it).
  // Compare against the earlier of the two renderings of the cutoff instant: the window can
  // only over-include a few boundary hours, never silently drop rows.
  const cutMs = Date.now() - (windowHours || 48) * 3600000;
  const sinceZ = new Date(cutMs).toISOString();
  const sincePT = new Date(cutMs - 7 * 3600000).toISOString().replace('Z', '-07:00');
  const since = sincePT < sinceZ ? sincePT : sinceZ;
  const d = { window_start: since, window_hours: windowHours || 48, flags: [] };

  // Events in window (bounded, ts-indexed).
  const ev = (await env.LEDGER.prepare(
    'SELECT key, source, status, action FROM events WHERE ts > ? ORDER BY ts DESC LIMIT 6000'
  ).bind(since).all()).results || [];
  d.events_scanned = ev.length;
  const errByKey = {}, authByKey = {}, byKey = {};
  let noise = 0;
  for (const e of ev) {
    const k = e.key || e.source || '?';
    byKey[k] = (byKey[k] || 0) + 1;
    if (k === 'PROTOCOL_RUN' || k === 'AUTOMATE_RUN_DUE' || k === 'TODO_RUN') noise++;
    if (typeof e.status === 'number' && e.status >= 400) {
      errByKey[k] = (errByKey[k] || 0) + 1;
      // Only authenticated callers count toward a lockout: a dead credential fails WITH an
      // actor. Anonymous 401/403s are the gate rejecting strangers — the 2026-07-22 false
      // "MARKETING_API dead credential" URGENT came from one unauthenticated 12-endpoint sweep.
      if ((e.status === 401 || e.status === 403) && e.actor) authByKey[k] = (authByKey[k] || 0) + 1;
    }
  }
  d.total_errors = Object.values(errByKey).reduce((s, n) => s + n, 0);
  d.noise_events = noise;
  d.noise_ratio = ev.length ? Math.round((noise / ev.length) * 100) / 100 : 0;
  d.top_keys = Object.entries(byKey).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => ({ key: k, n }));
  d.error_streaks = Object.entries(errByKey).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => ({ key: k, errors: n }));
  d.auth_lockouts = Object.entries(authByKey).map(([k, n]) => ({ key: k, n }));
  for (const s of d.error_streaks) if (s.errors >= 25) d.flags.push('URGENT: ' + s.key + ' failed ' + s.errors + '× in window — circuit-breaker candidate');
  for (const a of d.auth_lockouts) if (a.n >= 10) d.flags.push('URGENT: ' + a.key + ' auth-locked (' + a.n + '× 401/403) — no model turn can fix a dead credential');

  // Coding-agent turns: collisions, loops, audit failures.
  let turns = [];
  try {
    turns = (await env.DB.prepare(
      'SELECT id, ts, agent, session, files_json, user_input, assistant_text, audit_verdict FROM agent_turns WHERE ts > ? ORDER BY id DESC LIMIT 400'
    ).bind(since).all()).results || [];
  } catch {}
  d.agent_turns_scanned = turns.length;
  const fileEditors = {};
  const fileLastTs = {};
  const fileEditorTs = {};
  let loops = 0, auditFails = 0;
  for (const t of turns) {
    if (/\[LOOP\]/.test(String(t.assistant_text || ''))) loops++;
    if (/fail|false|reject/i.test(String(t.audit_verdict || ''))) auditFails++;
    try {
      for (const f of JSON.parse(t.files_json || '[]')) {
        const path = typeof f === 'string' ? f : (f && (f.path || f.file)) || '';
        if (!path) continue;
        const who = String(t.agent || '?') + ':' + String(t.session || '?').slice(0, 12);
        (fileEditors[path] = fileEditors[path] || new Set()).add(who);
        if (!fileLastTs[path] || String(t.ts) > fileLastTs[path]) fileLastTs[path] = String(t.ts);
        const per = (fileEditorTs[path] = fileEditorTs[path] || {});
        if (!per[who] || String(t.ts) > per[who]) per[who] = String(t.ts);
      }
    } catch {}
  }
  d.loop_states = loops;
  d.audit_failures = auditFails;
  // Claims-awareness: FILE_CLAIM invocations are ledgered; an editor holding a claim on the
  // file makes their edit LAWFUL. A collision = violation only when an editor lacks a claim.
  // last_edit_ts makes the G10 institution rule decidable per file.
  const claimed = new Set();
  try {
    const cl = (await env.LEDGER.prepare(
      "SELECT request_preview FROM events WHERE key='FILE_CLAIM' AND ts > ? LIMIT 2000"
    ).bind(since).all()).results || [];
    for (const c of cl) {
      const s = String(c.request_preview || '');
      // Two logged shapes: pipe args (claim|path|holder|ttl) and fn JSON array (["claim","path","holder","ttl"]).
      const m = s.match(/claim\|([^|"]+)\|([^|"]+)/) || s.match(/"claim"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/);
      if (m) claimed.add(m[1].trim() + '::' + m[2].trim());
    }
  } catch {}
  // The ruling is computed HERE, deterministically — the model reports it, never re-judges it.
  // A violation = an unclaimed editor's edit. MECHANISM FAILED only when a violation edit
  // happened AFTER the write-law institution date; older violations are pre-law history that
  // rolls out of the window under monitoring.
  let lawSince = '';
  try {
    const instRaw = await env.DB.prepare("SELECT value FROM settings WHERE key='governor_instituted'").first();
    lawSince = (instRaw && JSON.parse(instRaw.value)?.write_collision?.since) || '';
  } catch {}
  const collisions = Object.entries(fileEditors).filter(([, who]) => who.size > 1)
    .map(([path, who]) => {
      const editors = [...who];
      const rel = path.replace(/^.*miscsubjects-pages\//, '');
      const unclaimed = editors.filter((e) => !claimed.has(path + '::' + e) && !claimed.has(rel + '::' + e));
      // Epoch math, never string compares — the table holds both Z and Pacific-offset stamps.
      const lastViolationMs = Math.max(0, ...unclaimed.map((e) => Date.parse((fileEditorTs[path] || {})[e] || '') || 0));
      return { file: path, editors, unclaimed_editors: unclaimed, lawful: unclaimed.length === 0, last_violation_ts: lastViolationMs ? new Date(lastViolationMs).toISOString() : null, _lv_ms: lastViolationMs };
    }).slice(0, 15);
  d.file_collisions = collisions.map(({ _lv_ms, ...c }) => c);
  const violations = collisions.filter((c) => !c.lawful);
  const lawMs = Date.parse(lawSince) || 0;
  const postLaw = lawMs ? violations.filter((c) => c._lv_ms > lawMs) : violations;
  d.collision_ruling = {
    collisions: collisions.length,
    violations: violations.length,
    violations_after_law: postLaw.length,
    law_since: lawSince || null,
    ruling: postLaw.length >= 1
      ? 'MECHANISM FAILED — unclaimed edits AFTER the write law: ' + postLaw.map((c) => c.file.split('/').pop() + ' by ' + c.unclaimed_editors.join('+')).slice(0, 5).join('; ')
      : (violations.length ? 'INSTITUTED, monitoring — all ' + violations.length + ' violations predate the write law and roll out of the window' : 'CLEAN'),
  };
  if (postLaw.length >= 1) d.flags.push('URGENT: ' + d.collision_ruling.ruling);

  // Task flow — with backlog composition so purge decisions are informed, never blind.
  try {
    const tc = await env.DB.prepare("SELECT SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) created, SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) open_backlog FROM tasks").bind(since).first();
    const roles = (await env.DB.prepare("SELECT LOWER(COALESCE(source,'?')) role, COUNT(*) n FROM tasks WHERE status='open' GROUP BY role ORDER BY n DESC LIMIT 10").all()).results || [];
    d.tasks = { created_in_window: tc?.created || 0, open_backlog: tc?.open_backlog || 0, backlog_by_role: roles };
  } catch {}

  // Published-content quality — the class that shipped a 925-char stub to the live site.
  try {
    const thin = (await env.DB.prepare(
      "SELECT slug, MAX(version) v, LENGTH(body) chars FROM oip_articles GROUP BY slug HAVING chars < 2500"
    ).all()).results || [];
    const junk = (await env.DB.prepare(
      "SELECT COUNT(*) n FROM articles WHERE published=1 AND (slug='slug' OR slug LIKE 'mode-%' OR slug LIKE 'slug-%' OR title='title')"
    ).first());
    d.published_quality = {
      oip_articles_below_floor: thin.map((r) => ({ slug: r.slug, head_version: r.v, chars: r.chars })),
      artifact_slugs_published: junk?.n || 0,
    };
    if (thin.length) d.flags.push('URGENT: ' + thin.length + ' live OIP article(s) below the 2500-char floor at head version — stub content is public');
    if (junk?.n) d.flags.push('URGENT: ' + junk.n + ' pipeline-artifact slug(s) still published');
  } catch {}

  // Sync symmetry — all four corners (Cloudflare/GitHub↔/local/Drive) must be current.
  try {
    const { syncHealth } = await import('./ledger_sync.js');
    const corners = await syncHealth(env);
    d.sync_corners = corners.map((c) => ({ id: c.id, state: c.state, age_s: c.age_s }));
    const dead = corners.filter((c) => c.state === 'red');
    if (dead.length) d.flags.push('URGENT: sync asymmetry — ' + dead.map((c) => c.label).join(', ') + ' stale/never — the corners are not in unison');
  } catch {}

  // Instituted mechanisms — laws already shipped against a flagged class. The brief
  // reports these classes as INSTITUTED (monitoring) instead of re-alarming on trailing
  // window data; only recurrence AFTER the institution date re-escalates.
  try {
    const inst = await env.DB.prepare("SELECT value FROM settings WHERE key='governor_instituted'").first();
    d.instituted = inst && inst.value ? JSON.parse(inst.value) : {};
  } catch { d.instituted = {}; }

  // Thread bus — machines post, the owner accepts; a piling proposed backlog means
  // the loop is starving for governance. Counted, flagged, remembered.
  try {
    const bus = await env.DB.prepare("SELECT SUM(CASE WHEN status='proposed' THEN 1 ELSE 0 END) proposed, SUM(CASE WHEN status='accepted' AND decided_at > datetime('now','-1 day') THEN 1 ELSE 0 END) accepted_24h, COUNT(*) total FROM thread_updates").first();
    d.thread_bus = { proposed: bus?.proposed || 0, accepted_24h: bus?.accepted_24h || 0, total: bus?.total || 0 };
    if ((bus?.proposed || 0) >= 5) d.flags.push('URGENT: ' + bus.proposed + ' proposed thread updates await owner acceptance — the bus is starving; accept or reject them (taps in each ledger event)');
  } catch {}

  // NAME LAW (owner law, 2026-07-03, same standing as the PST time law): the owner's name
  // never appears on any public surface. The governor fetches the key public pages every
  // run and greps the redaction list. A hit is URGENT and a recurrence class.
  try {
    const redact = ['the owner', '[OWNER_SURNAME]'];
    const surfaces = ['/api/protocol/thread-update', '/api/articles/oip-total-structure/drop', '/a/oip', '/api/articles/system-map', '/api/protocol/thread-state?target=oip&format=markdown'];
    const hits = [];
    for (const sfc of surfaces) {
      const raw = (await fetch('https://miscsubjects.com' + sfc).then((r) => r.text()).catch(() => '')).toLowerCase();
      const t = raw.replace(/[OWNER_HANDLE]\//g, '');   // the GitHub account slug is not removable here
      for (const w of redact) if (t.includes(w)) { hits.push(sfc + ' contains "' + w + '"'); break; }
    }
    d.name_law = { surfaces_checked: surfaces.length, violations: hits };
    if (hits.length) d.flags.push('URGENT: NAME LAW VIOLATED — the owner name is on public surfaces: ' + hits.join('; '));
  } catch {}

  // RESTATEMENT LAW: the owner never has to say a rule twice. Owner inbound turns carrying
  // restatement-pain markers are counted; any occurrence means a stated rule was not captured
  // as law — the brief must name the rule and the mechanism that now holds it.
  try {
    const pain = (await env.DB.prepare(
      "SELECT COUNT(*) n FROM agent_turns WHERE ts > ? AND input_kind='human' AND (user_input LIKE '%RESTAT%' OR user_input LIKE '%ALREADY SAID%' OR user_input LIKE '%ALREADY TOLD%' OR user_input LIKE '%OVER & OVER%' OR user_input LIKE '%OVER AND OVER%' OR user_input LIKE '%AGAIN AND AGAIN%')"
    ).bind(since).first());
    d.owner_restatement_pain = pain?.n || 0;
    if ((pain?.n || 0) >= 1) d.flags.push('URGENT: the owner restated a rule ' + pain.n + '× this window — a stated law was not captured into enforcement; identify it and institute it');
  } catch {}

  // Prior briefs — the governor remembers what it already told the owner.
  try {
    const pb = (await env.LEDGER.prepare("SELECT ts, response_preview FROM events WHERE key='GOVERNOR_BRIEF' ORDER BY ts DESC LIMIT 5").all()).results || [];
    d.prior_briefs = pb.map((r) => {
      let subj = '', verdict = '';
      try { const j = JSON.parse(r.response_preview); subj = j.subject || ''; } catch { subj = clip(r.response_preview, 120); }
      return pt(r.ts) + ' PT · ' + clip(subj, 120) + (verdict ? ' · ' + verdict : '');
    });
  } catch {}

  // Invocation yield/waste.
  try {
    const inv = await env.LEDGER.prepare('SELECT COUNT(*) n, SUM(waste) waste, ROUND(SUM(cost_usd),4) cost FROM invocations WHERE ts > ?').bind(since).first();
    d.invocations = { n: inv?.n || 0, waste: inv?.waste || 0, cost_usd: inv?.cost || 0 };
  } catch {}

  // Compact recent turns — what actually got said/done (grounding sample for the model).
  d.recent_turns = turns.slice(0, 60).map((t) => pt(t.ts) + ' PT · ' + (t.agent || '?') + ' · IN: ' + clip(t.user_input, 150) + ' · OUT: ' + clip(t.assistant_text, 180));

  // Recurrence memory — deterministic issue-class counters across ALL past runs, so the
  // governor can say "Nth time" instead of rediscovering the same disease every brief.
  try {
    const raw = await env.DB.prepare("SELECT value FROM settings WHERE key='governor_memory'").first();
    const mem = raw && raw.value ? JSON.parse(raw.value) : {};
    const bump = (cls) => { mem[cls] = { count: ((mem[cls] && mem[cls].count) || 0) + 1, last: new Date().toISOString() }; };
    if (d.file_collisions.length) bump('write_collision');
    if (d.auth_lockouts.some((a) => a.n >= 10)) bump('auth_lockout');
    if (d.loop_states >= 3) bump('loop_burn');
    if (d.noise_ratio >= 0.2) bump('cron_noise');
    if ((d.tasks?.open_backlog || 0) >= 1000) bump('task_backlog');
    if ((d.published_quality?.oip_articles_below_floor || []).length || d.published_quality?.artifact_slugs_published) bump('garbage_published');
    if ((d.sync_corners || []).some((c) => c.state === 'red')) bump('sync_asymmetry');
    if ((d.thread_bus?.proposed || 0) >= 5) bump('bus_backlog');
    if ((d.name_law?.violations || []).length) bump('name_on_site');
    if ((d.owner_restatement_pain || 0) >= 1) bump('owner_restatement');
    await env.DB.prepare("INSERT INTO settings (key, value, description, updated_at) VALUES ('governor_memory', ?, 'governor issue-class recurrence counters', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at")
      .bind(JSON.stringify(mem), new Date().toISOString()).run();
    d.issue_recurrence = mem;
  } catch {}

  return d;
}

function briefPrompt(charter, corpus, digest) {
  return [
    charter || 'You are GOVERNOR, the build manager. Analyze the digest and write the daily brief to the owner.',
    corpus ? '\n## the owner SYSTEMS-GOVERNANCE CORPUS (honor this worldview)\n' + corpus : '',
    '\n## DETERMINISTIC DIGEST (counted from the ledger — treat as ground truth, never contradict it)\n',
    JSON.stringify({ ...digest, recent_turns: undefined }, null, 1),
    '\n## RECENT TURNS SAMPLE\n',
    (digest.recent_turns || []).join('\n'),
    '\n## OUTPUT CONTRACT — exactly these sections, plain sentences, no hedging:',
    'SUBJECT: one line, ≤80 chars.',
    'SITUATION: 3-6 sentences — what the build did this window and its health.',
    'RECURRING PROBLEMS: numbered; each = pattern + count from the digest + root cause. Use issue_recurrence to say how many briefs in a row have seen this class.',
    'CONFLICTS: agents/paths working against each other (double edits, contradictory prompts, dead loops). Say "none observed" if none.',
    'INSTITUTIONAL CHANGES I PROPOSE: numbered; each = ONE concrete change naming the exact directory row, file, or law to alter, and what it relieves.',
    'DECISIONS NEEDED FROM the owner: numbered yes/no questions only.',
    'VERDICT: one line — GREEN / YELLOW / RED and why.',
    'HARD RULES: every numeric claim carries its digest count in parentheses. If a digest list is empty (e.g. auth_lockouts: []) you MUST write "none observed" for that class — inventing an incident that is not in the digest is a firing offense.',
  ].join('\n');
}

// ── Full governor run: digest → model brief → email + iMessage + ledger. ──
export async function governorRun(env, mode) {
  const m = String(mode || '').toLowerCase().trim();
  const cfg = await cfgOf(env);
  const digest = await buildGovernorDigest(env, cfg.window_hours);
  if (m === 'dry') return JSON.stringify({ ok: true, dry: true, digest: { ...digest, recent_turns: digest.recent_turns.slice(0, 5) } }, null, 1);

  // Charter (editable directory row) + corpus (settings).
  let charter = '', corpus = '';
  try {
    const row = await env.DB.prepare("SELECT content FROM directory WHERE key='GOVERNOR'").first();
    charter = String(row?.content || '');
  } catch {}
  try {
    const c = await env.DB.prepare("SELECT value FROM settings WHERE key='governor_corpus'").first();
    corpus = String(c?.value || '');
    if (/^fill me/i.test(corpus)) corpus = '';
  } catch {}

  // Model brief through dispatch — the call itself is ledgered with actor + cost.
  const { dispatch } = await import('../api/dispatch.js');
  const prompt = briefPrompt(charter, corpus, digest);
  let brief = '', modelUsed = cfg.model_key;
  try {
    const out = await dispatch(env, cfg.model_key, prompt, { actor: 'governor' });
    brief = String((out && out.result) || '');
  } catch (e) { brief = 'ERR: ' + (e && e.message || e); }
  if (!brief || /^(ERR|PROVIDER_ERROR)/.test(brief)) {
    modelUsed = cfg.fallback_key;
    try {
      const out2 = await dispatch(env, cfg.fallback_key, prompt, { actor: 'governor' });
      brief = String((out2 && out2.result) || brief);
    } catch {}
  }

  const urgent = digest.flags.length > 0;
  const subjLine = (brief.match(/SUBJECT:\s*(.+)/) || [])[1] || 'Build brief';
  const verdict = (brief.match(/VERDICT:\s*(.+)/) || [])[1] || '';
  const subject = '[GOVERNOR' + (urgent ? ' · URGENT' : '') + '] ' + clip(subjLine, 90) + ' — ' + pt(Date.now()) + ' PT';
  const footer = '\n\n—\nGovernor of miscsubjects. Model: ' + modelUsed +
    '\nLedger: https://miscsubjects.com/admin/ledger?service=governor' +
    '\nRe-run now: GET https://miscsubjects.com/api/dispatch?invoke=GOVERNOR_RUN (terminal key or act token)' +
    '\nEdit my charter: the GOVERNOR card brain panel on /admin/ledger?view=turns' +
    '\nFeed my corpus: settings key governor_corpus';

  // DELIVERY DISCIPLINE — the governor speaks when the situation CHANGES, never on repeat.
  // Same verdict-color + same flags within 6h → ledger the brief, skip email + text.
  // mode 'force' overrides (the owner explicitly asked). Prevents the brief-storm failure mode
  // (2026-07-03: eight urgent texts in one hour during a debugging loop).
  const color = (verdict.match(/\b(GREEN|YELLOW|RED)\b/i) || ['', ''])[1].toUpperCase();
  const deliveryHash = color + '|' + digest.flags.join('|');
  let deliver = m === 'force';
  try {
    const prevRaw = env.KV ? await env.KV.get('governor_last_delivery') : null;
    const prev = prevRaw ? JSON.parse(prevRaw) : null;
    const nowS = Math.floor(Date.now() / 1000);
    if (!deliver) deliver = !prev || prev.hash !== deliveryHash || (nowS - (prev.ts || 0)) >= 21600;
    if (deliver && env.KV) await env.KV.put('governor_last_delivery', JSON.stringify({ hash: deliveryHash, ts: nowS }));
  } catch { deliver = true; }

  let emailRes = '', smsRes = '';
  if (deliver) {
    try { emailRes = String((await dispatch(env, 'EMAIL_SEND', OWNER_EMAIL + '|' + subject + '|' + brief + footer, { actor: 'governor' }))?.result || ''); } catch (e) { emailRes = 'ERR:' + (e && e.message || e); }
    try { smsRes = String((await dispatch(env, 'SEND_BY_CHANNEL', 'blooio|' + OWNER_PHONE + '|' + clip('Governor: ' + (verdict || subjLine) + (urgent ? ' · ' + digest.flags[0] : '') + ' Full brief emailed.', 480), { actor: 'governor' }))?.result || ''); } catch (e) { smsRes = 'ERR:' + (e && e.message || e); }
  } else {
    emailRes = smsRes = 'SKIPPED: unchanged verdict/flags within 6h — ledgered only';
  }

  const eventId = await logEvent(env, {
    source: 'governor', key: 'GOVERNOR_BRIEF', action: 'brief', direction: 'out',
    status: urgent ? 299 : 200, actor: 'governor:' + modelUsed,
    request: { digest, prompt_chars: prompt.length },
    response: { subject, brief, email: clip(emailRes, 300), sms: clip(smsRes, 300) },
  });

  // Advance the trigger baselines.
  try {
    if (env.KV) {
      await env.KV.put('governor_last_run', String(Math.floor(Date.now() / 1000)));
      const tot = await env.LEDGER.prepare('SELECT SUM(n) t, SUM(errors) e FROM events_stats').first();
      await env.KV.put('governor_last_count', String(tot?.t || 0));
      await env.KV.put('governor_last_errors', String(tot?.e || 0));
    }
  } catch {}

  return JSON.stringify({ ok: true, urgent, delivered: deliver, flags: digest.flags, subject, model: modelUsed, event: eventId, email: clip(emailRes, 160), sms: clip(smsRes, 160), verdict: clip(verdict, 200) }, null, 1);
}

// ── Conversational governor: the owner texts a question, this answers from live evidence. ──
// Sized for an iMessage reply. Never delivers anything itself — the ROUTER replies.
export async function governorAsk(env, question) {
  const q = String(question || '').trim() || 'What is the state of the build right now?';
  const cfg = await cfgOf(env);
  const digest = await buildGovernorDigest(env, Math.min(cfg.window_hours, 24));
  let charter = '', corpus = '';
  try { charter = String((await env.DB.prepare("SELECT content FROM directory WHERE key='GOVERNOR'").first())?.content || ''); } catch {}
  try {
    corpus = String((await env.DB.prepare("SELECT value FROM settings WHERE key='governor_corpus'").first())?.value || '');
    if (/^fill me/i.test(corpus)) corpus = '';
  } catch {}
  const prompt = [
    charter,
    corpus ? '\n## the owner SYSTEMS-GOVERNANCE CORPUS\n' + corpus : '',
    '\n## DETERMINISTIC DIGEST (ground truth — never contradict a count; empty list = "none observed")\n',
    JSON.stringify({ ...digest, recent_turns: digest.recent_turns.slice(0, 25) }, null, 1),
    '\n## the owner ASKS\n' + q,
    '\n## ANSWER CONTRACT: answer the literal question from the digest evidence in ≤1100 characters, plain sentences, counts in parentheses, no sections, no preamble, no sign-off. If the digest cannot answer it, say exactly what evidence is missing.',
  ].join('\n');
  const { dispatch } = await import('../api/dispatch.js');
  let answer = '';
  try { answer = String((await dispatch(env, cfg.model_key, prompt, { actor: 'governor:ask' }))?.result || ''); } catch (e) { answer = 'ERR: ' + (e && e.message || e); }
  if (!answer || /^(ERR|PROVIDER_ERROR)/.test(answer)) {
    try { answer = String((await dispatch(env, cfg.fallback_key, prompt, { actor: 'governor:ask' }))?.result || answer); } catch {}
  }
  answer = clip(answer, 1400);
  await logEvent(env, {
    source: 'governor', key: 'GOVERNOR_ASK', action: 'ask', direction: 'out', status: 200,
    actor: 'governor', request: { question: q }, response: { answer },
  });
  return answer;
}

// ── Trigger check. Cheap (KV + one rollup SUM); fired via waitUntil off dispatch traffic. ──
let lastIsolateCheck = 0;
export async function governorTick(env) {
  try {
    const now = Date.now();
    if (now - lastIsolateCheck < 60000) return null;   // in-isolate gate: ≤1 KV check per minute
    lastIsolateCheck = now;
    if (!env || !env.KV || !env.LEDGER) return null;
    const cfg = await cfgOf(env);
    // force_off is the owner's kill switch (owner order 2026-08-04): it outranks autorun and
    // stays until the owner explicitly commits the governor back on (remove force_off from
    // governor_cfg in KV). No agent may lift it on its own judgment.
    if (cfg.force_off) return null;
    if (!cfg.autorun) return null;
    const nowS = Math.floor(now / 1000);
    const lastRun = parseInt(await env.KV.get('governor_last_run') || '0', 10);
    const lastCount = parseInt(await env.KV.get('governor_last_count') || '0', 10);
    const lastErrors = parseInt(await env.KV.get('governor_last_errors') || '0', 10);
    const tot = await env.LEDGER.prepare('SELECT SUM(n) t, SUM(errors) e FROM events_stats').first();
    const due =
      (nowS - lastRun >= cfg.every_hours * 3600) ||
      (lastCount > 0 && (tot?.t || 0) - lastCount >= cfg.volume) ||
      (lastErrors > 0 && (tot?.e || 0) - lastErrors >= cfg.error_burst);
    if (!due) return null;
    // Claim the run before the slow part so concurrent isolates don't double-fire.
    await env.KV.put('governor_last_run', String(nowS));
    if (!lastCount) { await env.KV.put('governor_last_count', String(tot?.t || 0)); await env.KV.put('governor_last_errors', String(tot?.e || 0)); return null; }
    return await governorRun(env, '');
  } catch {
    return null;
  }
}
