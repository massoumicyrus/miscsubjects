import { WorkflowEntrypoint } from 'cloudflare:workers';
import { handleOipEmail, extractOipEnvelope, readHeader } from './oip_email.js';
import { handleInboundEmail } from './inbound_mail.js';
// ONE SOURCE OF TRUTH FOR THE SEND LAW. This is the same module the Pages route uses, imported
// across the repo rather than copied, so the two enforcement points cannot drift apart. The Pages
// route refuses early with a useful message; THIS is the point no caller can go around, because it
// is the last code that runs before env.EMAIL.send().
import { checkOutbound } from '../../../functions/_lib/email_send_law.js';

const PAGES_BASE = 'https://miscsubjects.com';
// BUILD LAW — TIME: server clock only, Pacific-offset ISO. No caller-supplied time is honored.
function buildNowIso(ms) {
  const d = ms != null ? new Date(ms) : new Date();
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const p = {}; for (const { type, value } of f.formatToParts(d)) p[type] = value;
  const asIfUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const diff = Math.round((asIfUTC - d.getTime()) / 60000);
  const sign = diff >= 0 ? '+' : '-', a = Math.abs(diff);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}
function dispatchHeaders(env) { return { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY || '' }; }
// Pull the bare address out of a "Name <addr@host>" header value.
function cleanAddr(v) { const m = /<([^>]+)>/.exec(String(v || '')); return (m ? m[1] : String(v || '')).trim(); }
async function streamToText(stream) {
  if (!stream) return '';
  try { return await new Response(stream).text(); } catch { return ''; }
}
function deliverHeaders(env) { return { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY || '' }; }
async function fetchJsonWithTimeout(url, init = {}, timeoutMs = 110000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
  try {
    const resp = await fetch(url, { ...init, signal: ctrl.signal });
    const json = await resp.json().catch(() => ({}));
    return { resp, json };
  } finally {
    clearTimeout(timer);
  }
}

export class DeliverWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const tickAt = await step.do('record start', async () => buildNowIso());
    const tick = await step.do('pages deliver tick', { retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' } }, async () => {
      const resp = await fetch(PAGES_BASE + '/api/deliver', { method: 'POST', headers: deliverHeaders(this.env), body: JSON.stringify({ reason: 'deliver_workflow_tick' }) });
      return { status: resp.status, body: (await resp.text()).slice(0, 500) };
    });
    const pending = await step.do('list pending', async () => {
      const r = await this.env.DB.prepare("SELECT id, asset_id, channel, recipient FROM pending_deliveries WHERE status IN ('queued','polling') ORDER BY id LIMIT 25").all();
      return (r.results || []).map(x => ({ id: x.id, asset_id: x.asset_id, channel: x.channel, recipient: x.recipient }));
    });
    const results = [];
    for (const job of pending) {
      try {
        const r = await step.do(`deliver ${job.id}`, { retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' } }, async () => {
          const resp = await fetch(PAGES_BASE + '/api/deliver', { method: 'POST', headers: deliverHeaders(this.env), body: JSON.stringify({ id: job.id }) });
          return { id: job.id, status: resp.status, body: (await resp.text()).slice(0, 500) };
        });
        results.push(r);
      } catch (e) {
        results.push({ id: job.id, error: String(e && e.message || e) });
      }
    }
    return { tickAt, tick, attempted: pending.length, results };
  }
}

// Paced self-test: sends ONE question into the group every 30s (ButterCup asks, Pepper answers via
// /api/selftest), so the 25-question run is a real timed sequence in the group chat — never a
// blocking 25-at-once call. Each step is auditable in the group and scored in selftest_runs.
export class SelfTestWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const payload = event.payload || event.params || {};
    const manual = payload.manual !== false;
    const autorunOn = this.env.KV ? (await this.env.KV.get('selftest_autorun')) === '1' : false;
    if (!manual && !autorunOn) {
      if (this.env.KV) { try { await this.env.KV.delete('selftest:lock'); } catch {} }
      return { skipped: true, done: true, reason: 'selftest_autorun off' };
    }
    const runId = (payload.params && payload.params.run_id) || payload.run_id || ('st_clean_' + Date.now().toString(36));
    const total = await step.do('count', async () => {
      const r = await this.env.DB.prepare("SELECT COUNT(*) c FROM directory_tests WHERE kind='e2e'").first();
      return (r && r.c) || 0;
    });
    const results = [];
    for (let i = 0; i < total; i++) {
      const r = await step.do(`q ${i}`, { retries: { limit: 2, delay: '10 seconds', backoff: 'exponential' } }, async () => {
        try {
          const { resp, json: j } = await fetchJsonWithTimeout(PAGES_BASE + '/api/selftest', {
            method: 'POST', headers: dispatchHeaders(this.env),
            body: JSON.stringify({ action: 'run', limit: 1, offset: i, run_id: runId, fresh_run: i === 0, manual }),
          }, 110000);
          if (j.skipped) return { offset: i, skipped: true, done: true, reason: j.reason || j.error || 'skipped' };
          return (j.results && j.results[0]) || { offset: i, http: resp.status, error: j.error || null };
        } catch (e) {
          return { offset: i, error: 'selftest_fetch_timeout:' + (e && e.message || e) };
        }
      });
      results.push(r);
      if (r && r.skipped) break;
      if (i < total - 1) await step.sleep(`pace ${i}`, '30 seconds');  // timer: one question / 30s
    }
    const graphAutorunOn = manual || (this.env.KV ? (await this.env.KV.get('selftest_autorun')) === '1' : false);
    const graph = graphAutorunOn ? await step.do('graph populate', { retries: { limit: 2, delay: '15 seconds', backoff: 'exponential' } }, async () => {
      try {
          const { resp, json } = await fetchJsonWithTimeout(PAGES_BASE + '/api/selftest', {
            method: 'POST', headers: dispatchHeaders(this.env),
            body: JSON.stringify({ action: 'graph_run', notify: true, run_id: 'gr_wf_' + runId, manual }),
          }, 120000);
        if (json && json.skipped) return { skipped: true, done: true, reason: json.reason || 'skipped' };
        return json && Object.keys(json).length ? json : { error: 'graph_run failed', http: resp.status };
      } catch (e) {
        return { error: 'graph_run_timeout:' + (e && e.message || e) };
      }
    }) : { skipped: true, reason: 'selftest_autorun off' };
    return { run_id: runId, total, done: true, results, graph };
  }
}

export class ExpertDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(request) {
    const url = new URL(request.url);
    const op = url.searchParams.get('op') || 'ping';
    if (op === 'ping') return new Response(JSON.stringify({ ok: true, do: 'ExpertDO', id: this.state.id?.toString?.() || null, ts: buildNowIso() }), { headers: { 'content-type': 'application/json' } });
    if (op === 'chat') {
      const { messages, model } = await request.json().catch(() => ({ messages: [], model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' }));
      const r = await this.env.AI.run(model || '@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages });
      return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } });
    }
    return new Response('ERR:unknown_op:' + op, { status: 400 });
  }
}

function agentJ(o, st) { return new Response(JSON.stringify(o), { status: st || 200, headers: { 'content-type': 'application/json' } }); }
function agentPub(s) { return { ok: true, id: s.id, goal: s.goal, brain: s.brain, status: s.status, steps: s.steps, maxSteps: s.maxSteps, last_action: s.last_action, updated: s.updated }; }

// Resident agent: a durable loop. Each alarm tick frames the goal + progress, asks the
// brain (default ROUTER) for the next move via Pages /api/dispatch (tagged actor=id so
// every step lands in the LEDGER), and re-arms the alarm until RESIDENT_COMPLETE or the
// step cap. Survives the Mac sleeping; steerable mid-flight via /agent/send.
export class AgentDO {
  constructor(state, env) { this.state = state; this.env = env; }
  async get() { return await this.state.storage.get('s'); }
  async put(s) {
    await this.state.storage.put('s', s);
    try {
      await this.env.DB.prepare('INSERT OR REPLACE INTO agents (id,goal,brain,status,steps,last_action,created,updated) VALUES (?,?,?,?,?,?,?,?)')
        .bind(s.id, s.goal, s.brain, s.status, s.steps, s.last_action || '', s.created, s.updated).run();
    } catch (e) {}
  }
  async fetch(request) {
    const url = new URL(request.url);
    const op = url.searchParams.get('op') || 'status';
    if (op === 'spawn') {
      const b = await request.json().catch(() => ({}));
      const now = buildNowIso(); // BUILD LAW — TIME: b.now ignored
      const s = { id: b.id, goal: String(b.goal || ''), brain: String(b.brain || 'ROUTER'), status: 'running', steps: 0,
        maxSteps: Math.min(Math.max(parseInt(b.maxSteps || '12', 10) || 12, 1), 40), history: [], inbox: [],
        last_action: 'spawned', created: now, updated: now };
      await this.put(s);
      await this.state.storage.setAlarm(Date.now() + 1500);
      return agentJ(agentPub(s));
    }
    const s = await this.get();
    if (!s) return agentJ({ ok: false, error: 'no_such_agent' }, 404);
    if (op === 'status') return agentJ(agentPub(s));
    if (op === 'events') return agentJ({ ok: true, id: s.id, history: (s.history || []).slice(-30) });
    if (op === 'send') {
      const b = await request.json().catch(() => ({}));
      s.inbox = s.inbox || []; s.inbox.push(String(b.msg || '')); s.updated = buildNowIso();
      if (s.status === 'paused' || s.status === 'done') { s.status = 'running'; await this.state.storage.setAlarm(Date.now() + 800); }
      await this.put(s); return agentJ(agentPub(s));
    }
    if (op === 'pause') { s.status = 'paused'; s.updated = buildNowIso(); await this.put(s); return agentJ(agentPub(s)); }
    if (op === 'resume') { if (s.status !== 'running') { s.status = 'running'; await this.state.storage.setAlarm(Date.now() + 800); } s.updated = buildNowIso(); await this.put(s); return agentJ(agentPub(s)); }
    if (op === 'kill') { s.status = 'killed'; s.updated = buildNowIso(); await this.put(s); try { await this.state.storage.deleteAlarm(); } catch (e) {} return agentJ(agentPub(s)); }
    return agentJ({ ok: false, error: 'unknown_op:' + op }, 400);
  }
  async alarm() {
    let s = await this.get();
    if (!s || s.status !== 'running') return;
    if (s.steps >= s.maxSteps) { s.status = 'done'; s.last_action = 'step cap (' + s.maxSteps + ') reached'; s.updated = buildNowIso(); await this.put(s); return; }
    s.steps++;
    const steer = (s.inbox && s.inbox.length) ? ('\nOWNER STEER: ' + s.inbox.join(' | ')) : '';
    s.inbox = [];
    const tail = (s.history || []).slice(-4).join('\n') || '(nothing yet)';
    const input = 'RESIDENT TASK — you are an autonomous agent working one goal over many turns (step ' + s.steps + ' of ' + s.maxSteps + ').\nGOAL: ' + s.goal +
      '\nProgress so far:\n' + tail + steer +
      '\nEmit the SINGLE next tool tag that makes progress on the GOAL, then reply. When the GOAL is fully complete, include the exact token RESIDENT_COMPLETE in your reply. Never repeat a step that already succeeded.';
    let res = '';
    try {
      const r = await fetch(PAGES_BASE + '/api/dispatch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: s.brain, body: input, actor: s.id }) });
      const j = await r.json(); res = String(j.result || '');
    } catch (e) { res = 'ERR:agent_fetch:' + (e && e.message || e); }
    const clean = res.replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/g, '').replace(/\s+/g, ' ').trim();
    s.history = s.history || []; s.history.push('step ' + s.steps + ': ' + clean.slice(0, 180));
    s.last_action = clean.slice(0, 180); s.updated = buildNowIso();
    if (/RESIDENT_COMPLETE/.test(res)) { s.status = 'done'; s.last_action = 'complete: ' + clean.slice(0, 160); await this.put(s); return; }
    await this.put(s);
    await this.state.storage.setAlarm(Date.now() + 4000);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/agent/')) {
      const sub = url.pathname.slice('/agent/'.length);
      if (sub === 'spawn') {
        const b = await request.json().catch(() => ({}));
        if (!b.id) return new Response('ERR:missing_id', { status: 400 });
        const stub = env.AGENT_DO.get(env.AGENT_DO.idFromName(b.id));
        return stub.fetch(new Request('https://do/?op=spawn', { method: 'POST', body: JSON.stringify(b), headers: { 'content-type': 'application/json' } }));
      }
      const aid = url.searchParams.get('id');
      if (!aid) return new Response('ERR:missing_id', { status: 400 });
      const stub = env.AGENT_DO.get(env.AGENT_DO.idFromName(aid));
      const body = request.method === 'POST' ? await request.text() : '';
      return stub.fetch(new Request('https://do/?op=' + sub, { method: 'POST', body, headers: { 'content-type': 'application/json' } }));
    }
    if (url.pathname === '/email/send' && request.method === 'POST') {
      if (!env.EMAIL) return new Response(JSON.stringify({ error: 'EMAIL binding missing' }), { status: 503, headers: { 'content-type': 'application/json' } });
      const key = request.headers.get('x-terminal-key') || '';
      if (!key || key !== env.TERMINAL_KEY) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
      const b = await request.json().catch(() => ({}));
      const to = b.to || b.recipient;
      const subject = String(b.subject || 'miscsubjects');
      const text = String(b.text || b.body || '');
      const html = String(b.html || (text ? `<pre>${text.replace(/</g, '&lt;')}</pre>` : ''));
      if (!to || (!text && !html)) return new Response(JSON.stringify({ error: 'need to + text/html' }), { status: 400, headers: { 'content-type': 'application/json' } });
      // EMAIL_SEND_LAW, at the last hop. A caller that reaches this worker directly with the terminal
      // key skips the Pages route entirely, so the refusal has to live here too or it is decorative.
      {
        let expected = null;
        try { expected = env.KV ? await env.KV.get('commercial_send_authorization') : null; } catch { expected = null; }
        const refusal = checkOutbound({ ...b, to, text, html }, {
          commercialAuthorization: request.headers.get('x-commercial-authorization'),
          commercialAuthorizationExpected: expected,
        });
        if (refusal) return new Response(JSON.stringify(refusal, null, 2), { status: 422, headers: { 'content-type': 'application/json' } });
      }
      try {
        const cc = Array.isArray(b.cc) ? b.cc.filter(Boolean) : (b.cc ? [String(b.cc)] : []);
        const bcc = Array.isArray(b.bcc) ? b.bcc.filter(Boolean) : (b.bcc ? [String(b.bcc)] : []);
        const r = await env.EMAIL.send({
          to,
          ...(cc.length ? { cc } : {}),
          ...(bcc.length ? { bcc } : {}),
          from: { email: String(b.from || 'build@miscsubjects.com'), name: String(b.from_name || 'miscsubjects build') },
          subject,
          text: text || html.replace(/<[^>]+>/g, ''),
          html: html || text,
          replyTo: b.reply_to || 'build@miscsubjects.com',
        });
        return new Response(JSON.stringify({ ok: true, messageId: r?.messageId || r, to, cc, bcc_count: bcc.length, subject }), { headers: { 'content-type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 502, headers: { 'content-type': 'application/json' } });
      }
    }
    // OIP email adapter — test route. POST {raw:"<full email text>"} OR {envelope, from, subject}.
    // Runs the exact parse -> /oip/inbox -> compose pipeline the live email() handler uses, but does
    // NOT send, so the whole email carrier is provable over HTTP. Public (only processes envelopes,
    // which /oip/inbox gates itself).
    if (url.pathname === '/oip/email' && request.method === 'POST') {
      const b = await request.json().catch(() => ({}));
      let raw = b.raw;
      if (!raw && b.envelope) {
        // synthesize a minimal email around a supplied envelope for testing
        raw = `From: ${b.from || 'someone@example.com'}\r\nSubject: ${b.subject || 'OIP'}\r\nMessage-ID: <${b.message_id || 'test@example.com'}>\r\n\r\n-----BEGIN OIP MESSAGE-----\r\n${JSON.stringify(b.envelope)}\r\n-----END OIP MESSAGE-----\r\n`;
      }
      if (!raw) return new Response(JSON.stringify({ error: 'need raw or envelope' }), { status: 400, headers: { 'content-type': 'application/json' } });
      const from = b.from || readHeader(raw, 'From') || 'someone@example.com';
      const subject = b.subject || readHeader(raw, 'Subject') || 'OIP message';
      const messageId = b.message_id || readHeader(raw, 'Message-ID') || null;
      const result = await handleOipEmail(env, { raw, from: cleanAddr(from), subject, messageId, pagesBase: PAGES_BASE });
      return new Response(JSON.stringify({ ok: true, sent: false, ...result }, null, 2), { headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, name: 'loop-safe-sibling', ts: buildNowIso() }), { headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname === '/do/expert/ping') {
      const id = env.CF_EXPERT_DO.idFromName(url.searchParams.get('name') || 'default');
      const stub = env.CF_EXPERT_DO.get(id);
      return stub.fetch(new Request('https://do/?op=ping'));
    }
    if (url.pathname === '/do/expert/chat') {
      const id = env.CF_EXPERT_DO.idFromName(url.searchParams.get('name') || 'default');
      const stub = env.CF_EXPERT_DO.get(id);
      return stub.fetch(new Request('https://do/?op=chat', { method: 'POST', body: await request.text(), headers: { 'content-type': 'application/json' } }));
    }
    if (url.pathname === '/wf/deliver/trigger') {
      if (!env.DELIVER_WF) return new Response('ERR:no_workflow_binding', { status: 500 });
      const payload = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
      const inst = await env.DELIVER_WF.create({ params: payload });
      return new Response(JSON.stringify({ id: inst.id, status: 'queued' }), { headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname === '/wf/deliver/status') {
      if (!env.DELIVER_WF) return new Response('ERR:no_workflow_binding', { status: 500 });
      const id = url.searchParams.get('id');
      if (!id) return new Response('ERR:missing_id', { status: 400 });
      const inst = await env.DELIVER_WF.get(id);
      const status = await inst.status();
      return new Response(JSON.stringify({ id, ...status }), { headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname === '/wf/selftest/trigger') {
      if (!env.SELFTEST_WF) return new Response('ERR:no_selftest_workflow', { status: 500 });
      // Vault-level master: default OFF. Codex/agents cannot re-arm selftest via this door.
      let masterOn = false;
      if (env.KV) { try { masterOn = (await env.KV.get('selftest_master')) === '1'; } catch {} }
      if (!masterOn) {
        return new Response(JSON.stringify({
          skipped: true,
          reason: 'selftest_master OFF',
          law: 'Owner enables only from https://miscsubjects.com/admin/selftest with confirm phrase ENABLE SELFTEST. Agents cannot re-enable.',
        }), { status: 423, headers: { 'content-type': 'application/json' } });
      }
      const runId = 'st_wf_' + Math.random().toString(36).slice(2, 8);
      const inst = await env.SELFTEST_WF.create({ params: { run_id: runId, manual: true } });
      return new Response(JSON.stringify({ id: inst.id, run_id: runId, status: 'queued', manual: true, note: 'master ON — one question every 30s into the group' }), { headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname === '/wf/selftest/status') {
      if (!env.SELFTEST_WF) return new Response('ERR:no_selftest_workflow', { status: 500 });
      const id = url.searchParams.get('id'); if (!id) return new Response('ERR:missing_id', { status: 400 });
      const inst = await env.SELFTEST_WF.get(id);
      return new Response(JSON.stringify({ id, ...(await inst.status()) }), { headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname === '/wf/selftest/kill' && request.method === 'POST') {
      const key = request.headers.get('x-terminal-key') || '';
      if (!key || key !== env.TERMINAL_KEY) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
      const loopOff = ['imessage_autorun', 'selftest_autorun', 'todo_autorun', 'proactive_msgs', 'protocol_autorun', 'writer_queue_autorun', 'article_qa_autorun', 'oip_review_autorun', 'editorial_board_autorun', 'graph_grow_autorun', 'github_loop_autorun'];
      if (env.KV) {
        for (const k of loopOff) { try { await env.KV.put(k, '0'); } catch {} }
        try { await env.KV.put('selftest_master', '0'); } catch {}
        try { await env.KV.delete('selftest:lock'); } catch {}
      }
      const terminated = [];
      if (env.CF_API_TOKEN) {
        const accountId = '<CLOUDFLARE_ACCOUNT_ID>';
        const wfName = 'selftest-workflow';
        try {
          let cursor = undefined;
          for (let page = 0; page < 5; page++) {
            const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
            const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workflows/${wfName}/instances${q}`, {
              headers: { Authorization: 'Bearer ' + env.CF_API_TOKEN },
            });
            const j = await r.json().catch(() => ({}));
            const items = (j.result && j.result.instances) || [];
            for (const inst of items) {
              if (inst.status !== 'running' && inst.status !== 'queued' && inst.status !== 'waiting') continue;
              const tr = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workflows/${wfName}/instances/${inst.id}/terminate`, {
                method: 'POST', headers: { Authorization: 'Bearer ' + env.CF_API_TOKEN },
              });
              terminated.push({ id: inst.id, status: inst.status, terminate_http: tr.status });
            }
            cursor = j.result && j.result.cursor;
            if (!cursor) break;
          }
        } catch (e) {
          return new Response(JSON.stringify({ killed: true, lock_cleared: true, terminated, workflow_api_error: String(e?.message || e) }), { headers: { 'content-type': 'application/json' } });
        }
      }
      return new Response(JSON.stringify({ killed: true, imessage_autorun: '0', loops_off: loopOff, lock_cleared: true, terminated }), { headers: { 'content-type': 'application/json' } });
    }
    return new Response('loop-safe-sibling: /health, /do/expert/ping?name=X, /do/expert/chat?name=X (POST {messages,model}), /wf/deliver/trigger (POST), /wf/deliver/status?id=X, /wf/selftest/trigger (POST), /wf/selftest/status?id=X', { status: 200 });
  },

  async scheduled(event, env, ctx) {
    const ts = buildNowIso();
    // 9 PM PST/PDT Stripe daily → StatePep WhatsApp group
    if (event.cron === '0 4 * * *') {
      ctx.waitUntil(fetch(PAGES_BASE + '/api/stripe-daily-wa', {
        method: 'POST',
        headers: dispatchHeaders(env),
      }).catch(() => {}));
      return;
    }
    ctx.waitUntil((async () => {
      try {
        await env.DB.prepare(
          "INSERT INTO log (ts, trace, step, parent, key, type, input, output) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(ts, 'sibling-cron-' + ts, 0, null, 'sibling.cron', 'cron', JSON.stringify({ cron: event.cron, scheduledTime: event.scheduledTime }), 'tick').run();
      } catch {}
    })());
    ctx.waitUntil(fetch(PAGES_BASE + '/api/deliver', { method: 'POST', headers: deliverHeaders(env) }).catch(() => {}));
    ctx.waitUntil(fetch(PAGES_BASE + '/api/dispatch', { method: 'POST', headers: dispatchHeaders(env), body: JSON.stringify({ key: 'TODO_RUN', body: '' }) }).catch(() => {}));
    // Protocol recursion tick: claim one open writer/reviewer/source_hunt job, run it, close/reopen.
    // Self-gates on KV protocol_autorun (default off). One item per tick so the 100s cap is never hit.
    ctx.waitUntil((async () => {
      try {
        const protoOn = env.KV ? await env.KV.get('protocol_autorun') : null;
        if (protoOn === '1') {
          await fetch(PAGES_BASE + '/api/protocol/run?role=writer', { method: 'POST', headers: dispatchHeaders(env) });
        }
      } catch {}
    })());
    // OIP recursive review: one article clarity review per tick when enabled.
    // Seed tasks with POST /api/protocol/oip-seed; each task asks a fresh model about JSON clarity
    // and English clarity, then stores OIP_ARTICLE_REVIEW in the append-only ledger.
    ctx.waitUntil((async () => {
      try {
        const oipOn = env.KV ? await env.KV.get('oip_review_autorun') : null;
        if (oipOn === '1') {
          await fetch(PAGES_BASE + '/api/protocol/run?role=oip-review', { method: 'POST', headers: dispatchHeaders(env) });
        }
      } catch {}
    })());
    // Editorial board intake: raw external-model/chat logs land in MODEL_CHAT_INTAKE,
    // then one receiving model distills complaints/rules and queues OIP purification.
    ctx.waitUntil((async () => {
      try {
        const boardOn = env.KV ? await env.KV.get('editorial_board_autorun') : null;
        if (boardOn === '1') {
          await fetch(PAGES_BASE + '/api/protocol/run?role=editorial-board', { method: 'POST', headers: dispatchHeaders(env) });
        }
      } catch {}
    })());
    // Article answer forum: readers ask through the iMessage/WhatsApp widgets;
    // one agent answers per tick. Cheap no-op when the queue is empty.
    ctx.waitUntil((async () => {
      try {
        const qaOn = env.KV ? await env.KV.get('article_qa_autorun') : null;
        if (qaOn !== '0') {
          await fetch(PAGES_BASE + '/api/protocol/run?role=article-question', { method: 'POST', headers: dispatchHeaders(env) });
        }
      } catch {}
    })());
    // Peptide article queue: write + populate + repair + collaborate (source=writer-queue).
    // Two parallel ticks when backlog is deep (~30s/write → ~2 articles/min).
    ctx.waitUntil((async () => {
      try {
        const qOn = env.KV ? await env.KV.get('writer_queue_autorun') : null;
        if (qOn !== '1') return;
        const headers = dispatchHeaders(env);
        const run = () =>
          fetch(PAGES_BASE + '/api/protocol/run?role=writer-queue', { method: 'POST', headers });
        await Promise.all([run(), run()]);
      } catch {}
    })());
    // Graph grow: single tick populate/collaborate/repair (NOT batch — avoids CF 524).
    ctx.waitUntil((async () => {
      try {
        const gOn = env.KV ? await env.KV.get('graph_grow_autorun') : null;
        if (gOn === '1') {
          await fetch(PAGES_BASE + '/api/protocol/grow', {
            method: 'POST',
            headers: dispatchHeaders(env),
            body: JSON.stringify({ all: true }),
          });
        }
      } catch {}
    })());
    // GitHub loop: one tick / 5 min (cheap — not every minute like writer-queue).
    ctx.waitUntil((async () => {
      try {
        const gOn = env.KV ? await env.KV.get('github_loop_autorun') : null;
        if (gOn === '1' && new Date().getMinutes() % 5 === 0) {
          await fetch(PAGES_BASE + '/api/github-loop/run', { method: 'POST', headers: dispatchHeaders(env) });
        }
      } catch {}
    })());
    // Fold recent GitHub commits into the ledger every tick (idempotent — only new commits insert).
    ctx.waitUntil(fetch(PAGES_BASE + '/admin/ledger?github_poll=1&n=15').catch(() => {}));
    // Automation loop: fire every enabled automation whose interval has elapsed (each is gated
    // per-row by its own enabled flag + schedule, so this is a no-op when nothing is due).
    ctx.waitUntil(fetch(PAGES_BASE + '/api/dispatch', {
      method: 'POST', headers: dispatchHeaders(env),
      body: JSON.stringify({ key: 'AUTOMATE_RUN_DUE', body: '' }),
    }).catch(() => {}));
  },

  async queue(batch, env) {
    for (const msg of batch.messages) {
      try {
        const job = msg.body || {};
        const r = await fetch(PAGES_BASE + '/api/dispatch', {
          method: 'POST',
          headers: dispatchHeaders(env),
          body: JSON.stringify({ key: job.key, body: job.body }),
        });
        await r.text();
        msg.ack();
      } catch {
        msg.retry();
      }
    }
  },

  async email(message, env, ctx) {
    const subject = message.headers.get('subject') || '(no subject)';
    const messageId = message.headers.get('message-id') || null;
    const from = cleanAddr(message.from);
    const preview = `${message.from} → ${message.to}: ${subject}`.slice(0, 240);
    const dest = env.EMAIL_FORWARD || '[OWNER_EMAIL]';

    // Read the raw message once and check for an OIP envelope.
    const raw = await streamToText(message.raw);
    const envelope = extractOipEnvelope(raw);

    if (envelope) {
      // OIP over email: process through the real home inbox and reply into the same thread.
      const result = await handleOipEmail(env, { raw, from, subject, messageId, pagesBase: PAGES_BASE });
      ctx.waitUntil((async () => {
        // Ledger the inbound OIP email.
        try {
          await fetch(PAGES_BASE + '/api/dispatch', {
            method: 'POST', headers: dispatchHeaders(env),
            body: JSON.stringify({ key: 'LEDGER_EXEC', body: [
              'INSERT INTO events (id, ts, source, key, action, direction, status, request_preview, response_preview, request_json, response_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              'em_' + Date.now(), buildNowIso(), 'email', 'EMAIL_OIP_INBOUND', 'inbound',
              String(result.inbox_status || 0), preview,
              'oip:' + (result.reply_envelope?.kind || 'no_reply'),
              JSON.stringify({ from, subject, envelope_id: envelope.id, kind: envelope.kind }).slice(0, 4000), '{}',
            ].join('|') }),
          });
        } catch {}
        // Send the signed reply back into the thread.
        if (result.reply_email && env.EMAIL) {
          try {
            await env.EMAIL.send({
              to: result.reply_email.to,
              from: { email: 'pepper@miscsubjects.com', name: 'pepper (OIP agent)' },
              subject: result.reply_email.subject,
              text: result.reply_email.text,
              replyTo: 'pepper@miscsubjects.com',
              headers: result.reply_email.headers,
            });
          } catch {}
        }
      })());
      return; // handled as OIP; do not forward to the human inbox
    }

    await handleInboundEmail(message, env, ctx, { raw, dest });
  },
};
