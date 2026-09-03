// The only transport: Cloudflare AI Gateway, Anthropic-shaped messages endpoint.
// One selected model per session. No slots, no aliases, no background model.
import fs from 'node:fs';
import { base } from './config.js';

export async function listModels(cfg) {
  const r = await fetch(base(cfg) + '/v1/models', {
    headers: { 'x-api-key': cfg.token, 'anthropic-version': '2023-06-01' },
  });
  if (!r.ok) throw new Error('models ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return j.data || [];
}

// Streams the answer. onText fires per text delta, onToolUse once per completed tool call.
// Returns the assistant content blocks so the caller can append them to the transcript.
// Rate limiting is a scheduling problem, not a reason to try harder. Three attempts, the
// server's own Retry-After when it gives one, exponential backoff with jitter otherwise,
// and a breaker that stays open for a cooldown once the limit has been hit repeatedly.
const breaker = { openUntil: 0, strikes: 0 };

export function breakerState() {
  const left = Math.max(0, breaker.openUntil - Date.now());
  return { open: left > 0, secondsLeft: Math.ceil(left / 1000), strikes: breaker.strikes };
}

export function resetBreaker() {
  breaker.openUntil = 0;
  breaker.strikes = 0;
}

const MAX_ATTEMPTS = 3;
const COOLDOWN_MS = 60000;
const CONNECT_TIMEOUT_MS = Math.max(30, Number(process.env.MISC_CONNECT_TIMEOUT) || 300) * 1000;
const STALL_TIMEOUT_MS = Math.max(15, Number(process.env.MISC_STALL_TIMEOUT) || 120) * 1000;

function backoffMs(attempt, retryAfter) {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (isFinite(secs) && secs > 0) return Math.min(secs * 1000, 60000);
  }
  const base = [5000, 12000, 25000][attempt] ?? 25000;
  return base + Math.floor(Math.random() * 2000);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// `path` is a parameter because this client now has two lanes: the native OpenAI one it
// should use, and the legacy Anthropic one kept behind MISC_WIRE=anthropic. Everything else
// here — the breaker, the deadlines, the retry classes — is shared by both.
async function send(cfg, body, path = '/v1/messages') {
  const state = breakerState();
  if (state.open) {
    const e = new Error(`rate limit cooldown · ${state.secondsLeft}s left · /retry to try now`);
    e.breaker = true;
    throw e;
  }
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController();
    const hard = setTimeout(() => ac.abort(new Error(`gateway did not answer within ${CONNECT_TIMEOUT_MS / 1000}s`)), CONNECT_TIMEOUT_MS);
    let r;
    try {
      r = await fetch(base(cfg) + path, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.token,
          // Only the Anthropic lane needs that version header; sending it on the native lane
          // would be cargo cult.
          ...(path === '/v1/messages' ? { 'anthropic-version': '2023-06-01' } : {}),
        },
        body,
        signal: ac.signal,
      });
    } catch (e) {
      clearTimeout(hard);
      // A timeout is retryable in exactly the same way a 504 is: the edge gave up, so the
      // call may never have reached a model. Fall through to the backoff path.
      if (attempt === MAX_ATTEMPTS - 1) throw e;
      const wait = backoffMs(attempt, null);
      process.stdout.write(`\r  no answer · retry ${attempt + 1} of 3 in ${Math.round(wait / 1000)}s   `);
      await sleep(wait);
      process.stdout.write('\r' + ' '.repeat(56) + '\r');
      continue;
    }
    clearTimeout(hard);
    // 429/529 are rate limits. 502/503/504/524 are the edge giving up on a slow upstream —
    // the request never reached a model, so retrying is correct and not a duplicate call.
    const RETRYABLE = new Set([429, 529, 502, 503, 504, 524]);
    if (!RETRYABLE.has(r.status)) {
      if (r.ok) breaker.strikes = 0;
      return r;
    }
    breaker.strikes += 1;
    if (attempt === MAX_ATTEMPTS - 1) {
      breaker.openUntil = Date.now() + COOLDOWN_MS;
      const e = new Error(`rate limited · 3 attempts failed · pausing 60s · /retry to override`);
      e.breaker = true;
      throw e;
    }
    const wait = backoffMs(attempt, r.headers.get('retry-after'));
    process.stdout.write(`\r  rate limited · retry ${attempt + 1} of 3 in ${Math.round(wait / 1000)}s   `);
    await sleep(wait);
    process.stdout.write('\r' + ' '.repeat(56) + '\r');
  }
  throw new Error('rate limited');
}

const withCache = (block) => Array.isArray(block) && block.length
  ? block.map((b, i) => i === block.length - 1
      ? { ...b, cache_control: { type: 'ephemeral' } }
      : b)
  : block;

// The aig shim normalizes every upstream to OpenAI shape and rejects an array system
// ("expected string, received array"), so system stays a plain string and tools stay a
// plain array for all models. Cache_control is stripped by the shim's toOpenAITools, so
// attaching it would only risk a 400. The real per-call saving is directory-backed
// capability discovery (constant-size prompt), not cache markers.
function systemWithCache(system) { return system; }
function toolsWithCache(tools) { return tools; }

// WHAT GOES ON THE WIRE, PER STEP. The messages protocol is stateless: every step of a tool
// loop resends the system prompt, every tool schema, and the entire conversation so far. A
// hundred-step loop is a hundred re-sends of a prompt that never changes plus a transcript
// that only grows. That is not a bug in this client, it is the shape of the protocol — but it
// is invisible, and what is invisible does not get paid attention until the bill arrives.
// MISC_TRACE=1 prints one line per call: step, system bytes, tool-schema bytes, message bytes,
// total, and how much of the total is the unchanging prefix.
let traceStep = 0;
export function resetTrace() { traceStep = 0; }

// MISC_TRACE_DUMP=<path> writes the EXACT system prompt and tool schemas of the first call to
// disk, so an outside auditor reads what was actually sent rather than a reconstruction of it.
// It writes once per process, never the messages (those carry the operator's own words), and
// nothing at all unless the variable is set.
let dumped = false;
function dump(system, tools) {
  const dest = process.env.MISC_TRACE_DUMP;
  if (!dest || dumped) return;
  dumped = true;
  try {
    fs.writeFileSync(dest + '.system.txt', String(system || ''));
    fs.writeFileSync(dest + '.tools.json', JSON.stringify(tools || [], null, 2));
  } catch {}
}

function trace(system, tools, messages, total) {
  dump(system, tools);
  if (!process.env.MISC_TRACE) return;
  traceStep += 1;
  const sysB = Buffer.byteLength(String(system || ''));
  const toolB = Buffer.byteLength(JSON.stringify(tools || []));
  const msgB = Buffer.byteLength(JSON.stringify(messages || []));
  const fixed = sysB + toolB;
  const line = `[wire] step ${String(traceStep).padStart(3)} · system ${sysB} · tools ${toolB} · messages ${msgB} · total ${total} · fixed prefix ${(fixed / total * 100).toFixed(1)}%`;
  process.stderr.write(line + '\n');
}

// THE ANTHROPIC LANE, KEPT ONLY AS A FALLBACK. Reach it with MISC_WIRE=anthropic.
// This client speaks Anthropic's Messages protocol for one historical reason: the gateway shim
// it points at was written so CLAUDE CODE could use the account's AI Gateway, and Claude Code
// speaks exactly one wire format. misc is not Claude Code — it lives in the same repository as
// that shim and can speak anything. Every step of every tool loop was therefore translated
// Anthropic -> OpenAI on the way out and OpenAI -> Anthropic SSE on the way back, to reach an
// upstream (/ai/v1/chat/completions) that was OpenAI-shaped the entire time.
//
// Measured cost of the round trip, all of it read out of the shim rather than guessed:
// max_tokens clamped to 16,384 whatever we asked for; cache_control dropped, so explicit
// prompt caching was never once possible; thinking blocks dropped between turns; system
// flattened into a role:system message. The translation is faithful for tool schemas — that
// was tested, 16 in and 16 out byte-identical — so this hop was never the cause of misused
// tool calls. It was simply two conversions and four silent behaviour changes for nothing.
async function streamAnthropic(cfg, { system, messages, tools, onText, onThinking, maxTokens = 16384 }) {
  const body = JSON.stringify({
    model: cfg.model,
    max_tokens: maxTokens,
    stream: true,
    system: systemWithCache(system),
    messages,
    ...(tools && tools.length ? { tools: toolsWithCache(tools) } : {}),
  });
  trace(system, tools, messages, Buffer.byteLength(body));
  const r = await send(cfg, body);
  if (!r.ok || !r.body) {
    throw new Error('gateway ' + r.status + ': ' + (await r.text()).slice(0, 300));
  }

  const blocks = [];
  let stopReason = null;
  let usage = null;
  let served = null;
  let buf = '';
  const reader = r.body.getReader();
  const dec = new TextDecoder();

  // THE STALL WATCHDOG. The hang was here, not in the connect: fetch resolved, the stream
  // opened, and then no further chunk ever arrived. `await reader.read()` has no deadline of
  // its own, so the loop parked forever. Every read now races a timer; if the upstream goes
  // quiet for longer than STALL_TIMEOUT_MS mid-response, the read throws instead of waiting
  // out the session. Partial text already streamed is preserved by the caller's error path.
  const readWithDeadline = async () => {
    let t;
    try {
      return await Promise.race([
        reader.read(),
        new Promise((_, rej) => {
          t = setTimeout(
            () => rej(new Error(`gateway stalled mid-response · no data for ${STALL_TIMEOUT_MS / 1000}s`)),
            STALL_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      clearTimeout(t);
    }
  };

  for (;;) {
    const { value, done } = await readWithDeadline();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let ev;
      try { ev = JSON.parse(payload); } catch { continue; }

      if (ev.type === 'content_block_delta' && ev.delta.type === 'thinking_delta') {
        onThinking && onThinking(ev.delta.thinking);
        continue;
      }
      if (ev.type === 'message_start') {
        // Input tokens arrive once, at the top; output tokens accumulate in message_delta.
        usage = { ...(ev.message && ev.message.usage || {}) };
        // The model that ACTUALLY answered, which is not always the one that was asked for:
        // this gateway serves @cf/moonshotai/kimi-k2.7-code for any identifier it does not
        // recognise and still answers 200. The bill follows the served model, so the footer
        // has to price this one — never cfg.model.
        served = (ev.message && ev.message.model) || null;
      } else if (ev.type === 'content_block_start') {
        if (ev.content_block.type === 'thinking') continue; // shown live, not replayed
        blocks[ev.index] = ev.content_block.type === 'tool_use'
          ? { ...ev.content_block, input: '' }
          : { ...ev.content_block, text: '' };
      } else if (ev.type === 'content_block_delta') {
        const b = blocks[ev.index];
        if (!b) continue;
        if (ev.delta.type === 'text_delta') { b.text += ev.delta.text; onText && onText(ev.delta.text); }
        else if (ev.delta.type === 'input_json_delta') b.input += ev.delta.partial_json;
      } else if (ev.type === 'message_delta') {
        stopReason = ev.delta && ev.delta.stop_reason || stopReason;
        usage = { ...(usage || {}), ...(ev.usage || {}) };
      }
    }
  }

  for (const b of blocks) {
    if (b && b.type === 'tool_use' && typeof b.input === 'string') {
      try { b.input = JSON.parse(b.input || '{}'); } catch { b.input = {}; }
    }
  }
  return { blocks: blocks.filter(Boolean), stopReason, usage, served };
}

// ---------------------------------------------------------------- the native lane

// misc's internal message shape stays Anthropic-flavoured (text / tool_use / tool_result
// blocks) because misc.js is built on it and there is no reason to churn the whole client to
// change a wire format. The difference is WHERE the conversion happens: once, locally, in this
// process — instead of twice over the network inside a shim written for another client.
function toOpenAIBody({ system, messages, tools, maxTokens, model }) {
  const out = [];
  if (system) out.push({ role: 'system', content: String(system) });

  for (const m of messages || []) {
    if (typeof m.content === 'string') { out.push({ role: m.role, content: m.content }); continue; }
    if (!Array.isArray(m.content)) continue;

    if (m.role === 'assistant') {
      let text = '';
      const calls = [];
      for (const b of m.content) {
        if (!b) continue;
        if (b.type === 'text') text += b.text || '';
        else if (b.type === 'tool_use') {
          calls.push({
            id: b.id,
            type: 'function',
            function: { name: b.name, arguments: JSON.stringify(b.input == null ? {} : b.input) },
          });
        }
      }
      // Empty string rather than null: some upstreams reject a null assistant content on the
      // turn that carries only tool calls.
      const a = { role: 'assistant', content: text || '' };
      if (calls.length) a.tool_calls = calls;
      out.push(a);
      continue;
    }

    // A user turn carries tool results, text, or both. Tool results must precede the text so
    // each one follows the assistant call it answers.
    const parts = [];
    for (const b of m.content) {
      if (!b) continue;
      if (b.type === 'tool_result') {
        const c = typeof b.content === 'string' ? b.content
          : Array.isArray(b.content) ? b.content.map((x) => (x && x.type === 'text' ? x.text : JSON.stringify(x))).join('\n')
            : JSON.stringify(b.content ?? '');
        out.push({ role: 'tool', tool_call_id: b.tool_use_id, content: c || '(no output)' });
      } else if (b.type === 'text' && b.text) {
        parts.push(b.text);
      }
    }
    if (parts.length) out.push({ role: 'user', content: parts.join('\n') });
  }

  const body = { model, messages: out, stream: true, max_tokens: maxTokens };
  if (tools && tools.length) {
    body.tools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description || '', parameters: t.input_schema || { type: 'object', properties: {} } },
    }));
    body.tool_choice = 'auto';
  }
  return body;
}

const STOP_MAP = { tool_calls: 'tool_use', stop: 'end_turn', length: 'max_tokens', content_filter: 'refusal' };

// AN ARTICLE DOES NOT FIT IN 8,192 OUTPUT TOKENS, SO THE AGENT COULD NOT WRITE ONE.
// The default was 8192 on both lanes. A publishable body plus the claims and sources CLAIM_LAW
// and SOURCE_QUOTE_LAW require is comfortably past that, and it all has to arrive inside a
// single tool_use argument blob — so the call truncates mid-JSON and never lands. Watched in
// the operator's terminal across three hundred-step runs: the agent researched the feature
// correctly, said "I have everything needed to write the article", and then did not write it.
// It was not stalling. The one call it needed to make could not fit through the pipe.
async function streamNative(cfg, { system, messages, tools, onText, onThinking, maxTokens = 32768 }) {
  const payload = toOpenAIBody({ system, messages, tools, maxTokens, model: cfg.model });
  const body = JSON.stringify(payload);
  trace(system, tools, messages, Buffer.byteLength(body));

  const r = await send(cfg, body, '/v1/chat/completions');
  if (!r.ok || !r.body) {
    throw new Error('gateway ' + r.status + ': ' + (await r.text()).slice(0, 300));
  }
  let served = r.headers.get('x-aig-model-served') || null;

  let text = '';
  const calls = new Map();   // index -> { id, name, args }
  let stopReason = null;
  let usage = null;
  let buf = '';
  const reader = r.body.getReader();
  const dec = new TextDecoder();

  const readWithDeadline = async () => {
    let t;
    try {
      return await Promise.race([
        reader.read(),
        new Promise((_, rej) => {
          t = setTimeout(() => rej(new Error(`gateway stalled mid-response · no data for ${STALL_TIMEOUT_MS / 1000}s`)), STALL_TIMEOUT_MS);
        }),
      ]);
    } finally { clearTimeout(t); }
  };

  for (;;) {
    const { value, done } = await readWithDeadline();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const p = line.slice(5).trim();
      if (!p || p === '[DONE]') continue;
      let ev;
      try { ev = JSON.parse(p); } catch { continue; }

      if (ev.model && !served) served = ev.model;
      // Usage arrives on its own final chunk because stream_options.include_usage is set by
      // the gateway lane. Map it to the names the rest of this client already prices on.
      if (ev.usage) {
        usage = {
          input_tokens: ev.usage.prompt_tokens || 0,
          output_tokens: ev.usage.completion_tokens || 0,
          cache_read_input_tokens: ev.usage.prompt_tokens_details?.cached_tokens || 0,
          cache_creation_input_tokens: 0,
        };
      }
      const ch = ev.choices && ev.choices[0];
      if (!ch) continue;
      if (ch.finish_reason) stopReason = STOP_MAP[ch.finish_reason] || ch.finish_reason;
      const d = ch.delta || {};
      // Some upstreams put chain-of-thought on a reasoning_content delta. Route it to the
      // thinking sink so it stays out of the transcript, exactly as the old lane did.
      if (d.reasoning_content && onThinking) onThinking(d.reasoning_content);
      if (d.content) { text += d.content; onText && onText(d.content); }
      for (const tc of d.tool_calls || []) {
        const i = tc.index ?? 0;
        const cur = calls.get(i) || { id: '', name: '', args: '' };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name = tc.function.name;
        // Arguments stream as string fragments and must be concatenated before parsing.
        if (tc.function?.arguments) cur.args += tc.function.arguments;
        calls.set(i, cur);
      }
    }
  }

  const blocks = [];
  if (text) blocks.push({ type: 'text', text });
  for (const [i, c] of [...calls.entries()].sort((a, b) => a[0] - b[0])) {
    let input = {};
    try { input = c.args ? JSON.parse(c.args) : {}; }
    catch { input = { __unparsed: c.args }; }   // surfaced to the model as a tool error, not silently dropped
    blocks.push({ type: 'tool_use', id: c.id || `call_${i}`, name: c.name, input });
  }
  if (!stopReason) stopReason = blocks.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn';
  return { blocks, stopReason, usage, served };
}

// One switch, so the change is reversible and the old path stays auditable rather than deleted.
export async function stream(cfg, opts) {
  return process.env.MISC_WIRE === 'anthropic'
    ? streamAnthropic(cfg, opts)
    : streamNative(cfg, opts);
}
