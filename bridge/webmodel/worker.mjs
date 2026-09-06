// THE PERSISTENT BROWSER-MODEL EXECUTION WORKER.
//
// One process. One Chrome. Five provider adapters. A narrow HTTP contract that exposes browser
// MODEL verbs and nothing else — no arbitrary CDP, no arbitrary JavaScript, no arbitrary
// navigation. The Cloudflare build reaches it through the existing agent.miscsubjects.com
// tunnel and the existing x-terminal-key header; no second tunnel and no second auth system.

import http from 'node:http';
import { chromium } from 'playwright-core';
import { ensureChrome, cdpAlive, ensureDirs, CDP_PORT, PROFILE_ROOT } from './chrome.mjs';
import { adapterFor, PROVIDERS } from './adapters/index.mjs';
import { normalizeProvider, failure, digest, newId, selectCompletedTurn, isStable, canTransition, redact } from './core.mjs';
import * as store from './store.mjs';

const KEY = process.env.TERMINAL_KEY || '';
const PORT = parseInt(process.env.WEBMODEL_PORT || '3011', 10);
const HOST = '127.0.0.1';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.WEBMODEL_TIMEOUT_MS || '240000', 10);
const STABLE_MS = 2500;
const POLL_MS = 700;

let browser = null;
const pages = new Map();        // session_id -> Playwright Page
const locks = new Map();        // session_id -> { since, request_id }
const health = {};              // provider -> { last_ok, last_failure, capture_method }

const now = () => new Date().toISOString();

// ---------------------------------------------------------------- browser plumbing

async function browserHandle() {
  if (browser && browser.isConnected()) return browser;
  const up = await ensureChrome();
  if (up.error) throw Object.assign(new Error(up.detail || up.error), { code: up.error });
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  browser.on('disconnected', () => { browser = null; pages.clear(); });
  return browser;
}

async function context() {
  const b = await browserHandle();
  const ctxs = b.contexts();
  if (!ctxs.length) throw Object.assign(new Error('chrome exposed no browser context'), { code: 'BROWSER_WORKER_OFFLINE' });
  return ctxs[0];
}

// A session's page, re-created and re-navigated after a worker or Chrome restart. This is what
// makes cold restart survivable: the durable session carries the conversation URL, so the tab
// itself is disposable.
async function pageFor(session) {
  const live = pages.get(session.session_id);
  if (live && !live.isClosed()) return live;
  const ctx = await context();
  const page = await ctx.newPage();
  pages.set(session.session_id, page);
  const a = adapterFor(session.provider);
  await page.goto(session.conversation_url || a.newUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  return page;
}

async function detectSession(page, a) {
  // A composer alone does not mean signed in: several providers render one on the logged-out
  // landing page and only reveal the wall on submit. Where a provider has a signed-out marker,
  // that marker decides.
  if (a.signedOutProbe) {
    const n = await page.locator(a.signedOutProbe).count().catch(() => 0);
    if (n > 0) {
      const vis = await page.locator(a.signedOutProbe).first().isVisible().catch(() => false);
      if (vis) return { authed: false, evidence: `signed-out marker present: ${a.signedOutProbe}` };
    }
  }
  try {
    await page.locator(a.composer).first().waitFor({ timeout: 15000, state: 'attached' });
    return { authed: true, evidence: `composer ${a.composer} present` };
  } catch {
    const body = await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');
    const denied = a.authProbe?.deniedText?.test(body || '');
    return { authed: false, evidence: denied ? 'provider is showing a sign-in wall' : 'composer never appeared', body_head: (body || '').slice(0, 200) };
  }
}

async function getConversationUrl(page, a) {
  const url = page.url();
  const m = a.urlPattern.exec(url);
  return { conversation_url: m ? url : null, provider_conversation_id: m ? m[1] : null };
}

// ---------------------------------------------------------------- capture

// Every assistant node with its visible text, minus the provider's reasoning and tool chrome.
async function readAssistantNodes(page, a) {
  return page.evaluate(({ sel, exclude }) => {
    const out = [];
    document.querySelectorAll(sel).forEach((node, i) => {
      const clone = node.cloneNode(true);
      if (exclude) clone.querySelectorAll(exclude).forEach((n) => n.remove());
      // Retry / regenerate / copy affordances render inside the message container on several
      // providers; they are controls, not the answer.
      clone.querySelectorAll('button, [role="button"]').forEach((n) => {
        if (!n.querySelector('p, li, pre, code, h1, h2, h3')) n.remove();
      });
      out.push({ index: i, text: (clone.innerText || '').trim(), id: node.getAttribute('data-message-id') || null });
    });
    return out;
  }, { sel: a.assistantSelector, exclude: a.excludeWithin || null }).catch(() => []);
}

async function isGenerating(page, a) {
  return page.evaluate((s) => !!document.querySelector(s), a.stopSelector).catch(() => false);
}

// THE COMPLETION DETECTOR. It never sleeps a fixed interval and calls that "done": it waits on
// the strongest signal the provider actually gives, and records which one fired.
async function awaitCompletion(page, a, priorCount, deadline, netState) {
  const samples = [];
  let sawGenerating = false;
  while (Date.now() < deadline) {
    await page.waitForTimeout(POLL_MS);
    const generating = await isGenerating(page, a);
    if (generating) sawGenerating = true;
    const nodes = await readAssistantNodes(page, a);
    const picked = selectCompletedTurn(nodes, priorCount);
    if (!picked) continue;
    samples.push({ text: picked.text, at: Date.now() });

    // 1. transport: the provider's own streaming response finished, and the DOM has caught up.
    if (netState.finishedAt && !generating && picked.text) {
      return { picked, capture_method: 'network_stream_end+dom', generating_seen: sawGenerating };
    }
    // 2. UI state transition: the generating indicator appeared and then went away.
    if (sawGenerating && !generating && isStable(samples, STABLE_MS)) {
      return { picked, capture_method: 'stop_indicator_cleared+dom_stable', generating_seen: true };
    }
    // 3. mutation stabilization: the text stopped changing across a real stabilization window.
    if (!generating && isStable(samples, STABLE_MS)) {
      return { picked, capture_method: 'dom_stable', generating_seen: sawGenerating };
    }
  }
  // 4. last resort before declaring a timeout: the accessibility surface — the live region the
  //    provider exposes to screen readers, which survives DOM refactors that break selectors.
  const ax = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[aria-live], [role="log"], [role="article"]')];
    return nodes.map((n) => (n.innerText || '').trim()).filter(Boolean).pop() || null;
  }).catch(() => null);
  if (ax && ax.length > 2) return { picked: { text: ax, id: null }, capture_method: 'accessibility_fallback', generating_seen: sawGenerating };
  return null;
}

// ---------------------------------------------------------------- verbs

async function vSessionNew({ provider, profile, conversation_url }) {
  const p = normalizeProvider(provider);
  if (!p) return failure('UNKNOWN_PROVIDER', `provider must be one of ${PROVIDERS.join(', ')}`, { provider_given: provider });
  const a = adapterFor(p);
  const session = {
    session_id: newId('wms'), provider: p, provider_model: null, profile_id: profile || 'default',
    conversation_url: conversation_url || null, provider_conversation_id: null, state: 'new',
    created_at: now(), updated_at: now(), last_turn_id: null,
    metadata: { adapter: a.id, label: a.label, cdp_port: CDP_PORT, profile_root: PROFILE_ROOT },
  };
  store.putSession(session);

  let page;
  try { page = await pageFor(session); }
  catch (e) { return finishSession(session, 'failed', failure(e.code || 'BROWSER_WORKER_OFFLINE', e.message)); }

  const det = await detectSession(page, a);
  if (!det.authed) {
    health[p] = { ...(health[p] || {}), last_failure: { at: now(), code: 'AUTH_REQUIRED', evidence: det.evidence } };
    return finishSession(session, 'auth_required',
      failure('AUTH_REQUIRED', `${a.label} is not signed in on the gateway profile`, { session_id: session.session_id, provider: p, evidence: det.evidence }));
  }
  Object.assign(session, await getConversationUrl(page, a), { state: 'ready', updated_at: now() });
  store.putSession(session);
  return { ok: true, ...publicSession(session) };
}

function finishSession(session, state, result) {
  if (canTransition(session.state, state)) session.state = state;
  session.updated_at = now();
  session.last_failure = result.error || null;
  store.putSession(session);
  return result;
}

function publicSession(s) {
  return {
    session_id: s.session_id, provider: s.provider, provider_model: s.provider_model || null,
    profile_id: s.profile_id, conversation_url: s.conversation_url,
    provider_conversation_id: s.provider_conversation_id, state: s.state,
    created_at: s.created_at, updated_at: s.updated_at, last_turn_id: s.last_turn_id || null,
    metadata: redact(s.metadata || {}),
  };
}

async function vSend({ session_id, prompt, request_id, timeout_ms }) {
  if (!session_id) return failure('BAD_REQUEST', 'session_id required');
  if (!prompt || !String(prompt).trim()) return failure('BAD_REQUEST', 'prompt required');

  const cached = store.idemGet(request_id);
  if (cached && cached.state !== 'in_flight') return { ...cached, idempotent_replay: true };
  if (cached && cached.state === 'in_flight') return failure('SESSION_BUSY', 'this request_id is already in flight', { request_id });

  const session = store.getSession(session_id);
  if (!session) return failure('SESSION_NOT_FOUND', `no session ${session_id}`);
  if (session.state === 'closed') return failure('SESSION_NOT_FOUND', 'session is closed');
  if (locks.has(session_id)) return failure('SESSION_BUSY', 'another prompt is already running in this conversation', { held_since: locks.get(session_id).since });
  if (request_id && !store.idemClaim(request_id)) return failure('SESSION_BUSY', 'duplicate request_id', { request_id });

  locks.set(session_id, { since: now(), request_id: request_id || null });
  // The `running` claim is durable BEFORE the browser is touched, so a crash mid-prompt is
  // visible as a crashed turn rather than as a session that merely looks idle.
  session.state = 'running'; session.updated_at = now(); store.putSession(session);

  const a = adapterFor(session.provider);
  const started_at = now();
  const turn_id = newId('wmt');
  let out;
  try { out = await runPrompt({ session, a, prompt: String(prompt), turn_id, started_at, timeout_ms }); }
  catch (e) { out = failure(e.code || 'RESPONSE_CAPTURE_FAILED', e.message || String(e), { session_id, turn_id }); }
  finally { locks.delete(session_id); }

  session.state = out.ok ? 'complete' : (out.error === 'AUTH_REQUIRED' ? 'auth_required' : 'failed');
  if (out.ok) session.last_turn_id = turn_id;
  session.updated_at = now();
  store.putSession(session);

  health[session.provider] = out.ok
    ? { ...(health[session.provider] || {}), last_ok: { at: out.completed_at, turn_id, capture_method: out.capture_method }, capture_method: out.capture_method }
    : { ...(health[session.provider] || {}), last_failure: { at: now(), code: out.error, message: out.message } };

  if (request_id) store.idemPut(request_id, out);
  return out;
}

async function runPrompt({ session, a, prompt, turn_id, started_at, timeout_ms }) {
  const page = await pageFor(session);
  const det = await detectSession(page, a);
  if (!det.authed) return failure('AUTH_REQUIRED', `${a.label} is not signed in on the gateway profile`, { session_id: session.session_id, turn_id, evidence: det.evidence });

  // Transport observation. The raw provider response is kept locally and referenced by digest;
  // it never rides in a receipt.
  const netState = { finishedAt: null, bytes: 0, status: null, url: null, body: null };
  const onResponse = async (r) => {
    if (!a.streamPattern.test(r.url())) return;
    netState.status = r.status(); netState.url = r.url().slice(0, 300);
    try { const b = await r.body(); netState.body = b.toString('utf8'); netState.bytes = b.length; } catch {}
    netState.finishedAt = Date.now();
  };
  page.on('response', onResponse);

  const priorCount = (await readAssistantNodes(page, a)).length;

  try {
    await page.locator(a.composer).first().click({ timeout: 15000 });
    await page.keyboard.type(prompt, { delay: 4 });
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
  } catch (e) {
    page.off('response', onResponse);
    return failure('SUBMIT_FAILED', `could not submit into ${a.label}: ${e.message}`, { session_id: session.session_id, turn_id });
  }

  const budget = Math.min(Math.max(parseInt(timeout_ms || DEFAULT_TIMEOUT_MS, 10), 15000), 900000);
  const done = await awaitCompletion(page, a, priorCount, Date.now() + budget, netState);
  page.off('response', onResponse);

  const bodyText = await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');

  if (!done) {
    if (a.limitText.test(bodyText || '')) {
      const line = (bodyText.split('\n').find((l) => a.limitText.test(l)) || '').trim();
      return failure(/rate/i.test(line) ? 'PROVIDER_RATE_LIMIT' : 'PROVIDER_USAGE_LIMIT', line || 'provider limit', { session_id: session.session_id, turn_id, provider_message: line });
    }
    return failure('RESPONSE_TIMEOUT', `no completed response from ${a.label} within ${budget}ms`, { session_id: session.session_id, turn_id, budget_ms: budget });
  }
  if (!done.picked.text) return failure('RESPONSE_CAPTURE_FAILED', 'completion detected but no text extracted', { session_id: session.session_id, turn_id });

  const conv = await getConversationUrl(page, a);
  if (conv.conversation_url) Object.assign(session, conv);
  const raw_ref = netState.body ? store.writeRaw(turn_id, redact({ url: netState.url, status: netState.status, bytes: netState.bytes, body: netState.body })) : null;

  return {
    ok: true, session_id: session.session_id, provider: session.provider, provider_label: a.label,
    turn_id, prompt, response: done.picked.text,
    conversation_url: conv.conversation_url || session.conversation_url || null,
    provider_conversation_id: conv.provider_conversation_id || session.provider_conversation_id || null,
    provider_turn_id: done.picked.id || null,
    started_at, completed_at: now(), capture_method: done.capture_method, substrate: 'browser_web',
    raw_ref, raw_digest: netState.body ? digest(netState.body) : null, transport_status: netState.status,
    response_digest: digest(done.picked.text), prompt_digest: digest(prompt),
  };
}

async function vRead({ session_id, n }) {
  const session = store.getSession(session_id);
  if (!session) return failure('SESSION_NOT_FOUND', `no session ${session_id}`);
  let page;
  try { page = await pageFor(session); } catch (e) { return failure(e.code || 'BROWSER_WORKER_OFFLINE', e.message); }
  const nodes = await readAssistantNodes(page, adapterFor(session.provider));
  const take = Math.min(Math.max(parseInt(n || 1, 10), 1), 20);
  return { ok: true, session_id, provider: session.provider, count: nodes.length, messages: nodes.slice(-take) };
}

async function vStatus() {
  const v = await cdpAlive();
  const sessions = store.allSessions();
  const providers = {};
  for (const p of PROVIDERS) {
    const a = adapterFor(p);
    providers[p] = {
      label: a.label, adapter_loaded: true,
      last_ok: health[p]?.last_ok || null, last_failure: health[p]?.last_failure || null,
      capture_method_working: health[p]?.capture_method || null,
      sessions: sessions.filter((s) => s.provider === p && s.state !== 'closed').length,
    };
  }
  return {
    ok: true,
    worker: { up: true, pid: process.pid, node: process.version, port: PORT, started_at: STARTED_AT },
    chrome: { up: !!v, cdp_port: CDP_PORT, version: v ? v.Browser : null, profile_root: PROFILE_ROOT, connected: !!(browser && browser.isConnected()) },
    providers,
    sessions: sessions.filter((s) => s.state !== 'closed').map(publicSession),
    running_jobs: [...locks.entries()].map(([sid, l]) => ({ session_id: sid, since: l.since, request_id: l.request_id })),
    recovered_on_boot: RECOVERED,
  };
}

async function vClose({ session_id }) {
  const session = store.getSession(session_id);
  if (!session) return failure('SESSION_NOT_FOUND', `no session ${session_id}`);
  const p = pages.get(session_id);
  if (p && !p.isClosed()) { try { await p.close(); } catch {} }
  pages.delete(session_id); locks.delete(session_id);
  session.state = 'closed'; session.updated_at = now();
  store.putSession(session);
  return { ok: true, ...publicSession(session) };
}

async function vResume({ session_id, provider, conversation_url, profile }) {
  if (session_id) {
    const s = store.getSession(session_id);
    if (!s) return failure('SESSION_NOT_FOUND', `no session ${session_id}`);
    if (s.state === 'closed') { s.state = 'ready'; store.putSession(s); }
    let page;
    try { page = await pageFor(s); } catch (e) { return failure(e.code || 'BROWSER_WORKER_OFFLINE', e.message); }
    const a = adapterFor(s.provider);
    const det = await detectSession(page, a);
    if (!det.authed) return finishSession(s, 'auth_required', failure('AUTH_REQUIRED', `${a.label} is not signed in`, { session_id: s.session_id }));
    Object.assign(s, await getConversationUrl(page, a));
    s.state = 'ready'; s.updated_at = now(); store.putSession(s);
    return { ok: true, ...publicSession(s) };
  }
  if (!conversation_url) return failure('BAD_REQUEST', 'session_id or conversation_url required');
  return vSessionNew({ provider, profile, conversation_url });
}

// ---------------------------------------------------------------- http

const ROUTES = {
  '/webmodel/session/new': vSessionNew,
  '/webmodel/session/resume': vResume,
  '/webmodel/send': vSend,
  '/webmodel/read': vRead,
  '/webmodel/status': vStatus,
  '/webmodel/close': vClose,
};

const STARTED_AT = now();
ensureDirs();
const RECOVERED = store.recoverRunning();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  const send = (code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(b) }); res.end(b); };

  if (url.pathname === '/webmodel/health') return send(200, { ok: true, worker: 'webmodel', pid: process.pid, started_at: STARTED_AT, providers: PROVIDERS });
  if (KEY && req.headers['x-terminal-key'] !== KEY) return send(401, { ok: false, error: 'unauthorized' });

  const fn = ROUTES[url.pathname];
  if (!fn) return send(404, failure('BAD_REQUEST', `no such verb ${url.pathname}`, { verbs: Object.keys(ROUTES) }));

  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 4e6) req.destroy(); });
  req.on('end', async () => {
    let body = {};
    if (raw) { try { body = JSON.parse(raw); } catch { return send(400, failure('BAD_REQUEST', 'body must be JSON')); } }
    try { send(200, await fn(body)); }             // the shape carries the verdict, not the status code
    catch (e) { send(200, failure(e.code || 'RESPONSE_CAPTURE_FAILED', e.message || String(e))); }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[webmodel] listening ${HOST}:${PORT} key_set=${!!KEY} providers=${PROVIDERS.join(',')} recovered=${RECOVERED.length}`);
});
