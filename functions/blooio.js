import { dispatch } from './api/dispatch.js';
import { logEvent } from './_lib/event_log.js';
import { runDirectExec, sniffPrefix } from './_lib/direct_exec.js';
import { prepareBlooioReflex, startAsyncReflexDiagnosis, formatReflexReplyForBlooio, isOwnerPhone, triggerIssueReflex, wordBriefForCodingAgents } from './_lib/issue_reflex.js';
import { shouldAutoEscalateReaction } from './_lib/reaction_intake.js';
import { invalidateDirSnapshot } from './_lib/dir_snapshot.js';
import { blooioTextField, joinBubbles, formatForIMessage } from './_lib/reply_chunks.js';
import { shellHtml } from './admin/_layout.js';
import { isBuildAuthed } from './_lib/admin_session.js';

const FROM_NUMBER = '[BUILD_PHONE]';

function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }

export async function sendBlooio(env, to, text, media, opts = {}) {
  // to = chat id: E.164 phone, grp_*, or chat_* (chat_* needs Blooio MCP — v2 REST 404s on text).
  // Blooio `text` may be a string or string[] — array sends separate iMessage bubbles (max 3).
  const chatId = String(to || '').trim();
  const ownerChat = chatId === 'chat_019ec103-256e-7475-82da-cda3aa268d1c';
  const ownerInbound = !!(opts.owner_inbound || opts.explicit_owner || opts.allow_owner_when_autorun_off);
  if ((isOwnerPhone(chatId) || ownerChat) && env.KV && !ownerInbound) {
    try {
      if ((await env.KV.get('imessage_autorun')) !== '1') {
        await logEvent(env, {
          source: 'blooio', key: 'BLOOIO_SEND', action: 'imessage_autorun_skip', direction: 'out',
          trace_id: opts.trace_id || null, actor: opts.actor || 'build',
          request: { chat_id: chatId, preview: String(text || '').slice(0, 120) },
          response: 'skipped:imessage_autorun off',
        });
        return JSON.stringify({ skipped: true, reason: 'imessage_autorun off (no outbound texts to owner)' });
      }
    } catch {}
  }
  const field = text ? blooioTextField(text, opts) : '';
  const attachments = Array.isArray(media) && media.length ? media : null;

  if (chatId.startsWith('chat_')) {
    const payload = { chat_id: chatId };
    if (field) payload.text = Array.isArray(field) ? joinBubbles(field) : field;
    if (attachments) payload.attachments = attachments;
    if (!payload.text && !payload.attachments) return '';
    try {
      const sent = await dispatch(
        env,
        'MCP_TOOL_CALL',
        `https://mcp.blooio.com/v4|send_chat_message|${JSON.stringify(payload)}|BLOOIO_API_KEY_PEPPERUP`,
      );
      const resText = String((sent && sent.result) || sent || '');
      await logEvent(env, {
        source: 'blooio', key: 'BLOOIO_SEND', action: 'send', direction: 'out',
        status: resText.startsWith('ERR:') ? 500 : 202, trace_id: opts.trace_id || null, actor: opts.actor || 'build',
        request: { mcp: 'send_chat_message', chat_id: chatId, text: payload.text || null, attachments: payload.attachments || null },
        response: resText.slice(0, 2000),
      });
      return resText;
    } catch (e) {
      await logEvent(env, {
        source: 'blooio', key: 'BLOOIO_SEND', action: 'send', direction: 'out',
        status: 599, trace_id: opts.trace_id || null, actor: opts.actor || 'build',
        request: { mcp: 'send_chat_message', chat_id: chatId },
        response: String(e),
      });
      return String(e);
    }
  }

  const url = `https://backend.blooio.com/v2/api/chats/${encodeURIComponent(chatId)}/messages`;
  const body = {};
  if (field) body.text = field;
  if (opts.from_number) body.from_number = opts.from_number;
  if (attachments) body.attachments = attachments;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.BLOOIO_API_KEY}` },
      body: JSON.stringify(body),
    });
    const resText = await r.text();
    await logEvent(env, {
      source: 'blooio', key: 'BLOOIO_SEND', action: 'send', direction: 'out',
      status: r.status, trace_id: opts.trace_id || null, actor: opts.actor || 'build',
      request: { url, method: 'POST', headers: { Authorization: 'Bearer <REDACTED>' }, body },
      response: resText,
    });
    return resText;
  } catch (e) {
    await logEvent(env, {
      source: 'blooio', key: 'BLOOIO_SEND', action: 'send', direction: 'out',
      status: 599, trace_id: opts.trace_id || null, actor: opts.actor || 'build',
      request: { url, method: 'POST', headers: { Authorization: 'Bearer <REDACTED>' }, body },
      response: String(e),
    });
    return String(e);
  }
}

// Last [REPLY]...[/REPLY] block (what the user sees).
function lastReplyOf(s) {
  let str = String(s || '');
  // 1) Remove every COMPLETE reasoning block so it can never reach the user.
  str = str.replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/g, ' ');
  // 2) Prefer the answer inside [REPLY]...[/REPLY] (last complete one).
  const re = /\[REPLY\]([\s\S]*?)\[\/REPLY\]/g; let m, last = null;
  while ((m = re.exec(str)) !== null) last = m[1];
  // 3) [REPLY] opened but not closed → take everything after the last [REPLY].
  if (last == null) {
    const open = str.lastIndexOf('[REPLY]');
    if (open !== -1) last = str.slice(open + '[REPLY]'.length);
  }
  // 4) No [REPLY] at all → drop a dangling (unclosed) reasoning block, keep any plain prose.
  if (last == null) {
    const dr = str.indexOf('[REASONING]');
    last = dr !== -1 ? str.slice(0, dr) : str;
  }
  // 5) Scrub a dangling reasoning tail + any leftover structural tags.
  last = last.replace(/\[REASONING\][\s\S]*$/g, '');
  last = last.replace(/\[\/?(REASONING|DONE|SELF|TOOL_CHOICE|DECISION|BATCH|REPLY)\]/g, '');
  // A complete executable-looking tag inside a reply is explanation text, not a live call.
  // Render it inert so the user never sees copy-pasteable dispatch syntax.
  last = last.replace(/\[([A-Z_][A-Z0-9_]*)\]([\s\S]*?)\[\/\1\]/g, (_, k, body) => `${k}(${String(body || '').trim()})`);
  // Malformed spaced tags like "[ WORLD_MAP ]" must never reach the user.
  last = last.replace(/\[\s*([A-Z][A-Z0-9_]*)\s*\]/g, '');
  last = last.replace(/(^|\s)\d+\.\s*(What it was stated|Which clause|Why this KEY|Expected return|Tool to call|Fallback|cite the)[^\n]*/gi, ' ');
  last = last.replace(/DECISION:\s*[A-Z]+/g, ' ');
  // INVARIANT: the build never delivers a BARE tool-call tag as its answer (a leaked call like
  // "[DIR_LIST]"). A reply MAY legitimately mention a tag in prose ("use [ARTICLE_PUT] to add one"),
  // so only suppress when the entire visible reply is nothing but tags -> caller sends clean fallback.
  const strippedAll = last.replace(/\[\/?[A-Z][A-Z0-9_]+\]/g, ' ').replace(/[^\S\n]+/g, ' ').trim();
  if (!strippedAll) return '';
  // Keep paragraph breaks for iMessage bubble splitting — do NOT collapse to one line.
  return last.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
// Every [AUDIO]words[/AUDIO] block the agent emitted. The words inside are spoken aloud.
function audioTagsOf(s) {
  const re = /\[AUDIO\]([\s\S]*?)\[\/AUDIO\]/g; const out = []; let m;
  while ((m = re.exec(String(s || ''))) !== null) { const t = m[1].trim(); if (t) out.push(t); }
  return out;
}
// Speak each [AUDIO] block and send it to the chat as an audio-only message (no text).
async function deliverAudioTags(env, chat, channel, sender, res) {
  if (channel !== 'blooio') return 0;
  let sent = 0;
  for (const words of audioTagsOf(res)) {
    try {
      const r = await dispatch(env, 'VOICE_SAY', words);
      const url = JSON.parse(String(r.result || '')).url;
      if (url) { await sender(env, chat, '', [url]); sent++; }
    } catch {}
  }
  return sent;
}
// Pull image/video URLs out of text (agent result or ledger rows).
function extractMediaUrls(s) {
  const out = [];
  const re = /https?:\/\/[^\s"'<>\\]+?\.(?:png|jpe?g|webp|gif|mp4|mov)/gi;
  let m; while ((m = re.exec(String(s || ''))) !== null) out.push(m[0]);
  return [...new Set(out)];
}
// Collect images the agent's tools produced this turn (the final reply text no longer
// contains them). ONLY generator-tool steps count — pulling URLs from router/LLM steps
// sent stray attachments on plain replies.
const GEN_KEYS = "('ARCADS_GENERATE','ARCADS_VIDEO_GENERATE','ARCADS_IMAGE_RAW','ARCADS_VIDEO_RAW','ARCADS_ASSET_GET','ARCADS_ASSET_WATCH','GROK_IMAGE','OPENAI_IMAGE','GEN_DUAL')";
async function collectTraceMedia(env, trace) {
  if (!env.LEDGER || !trace) return [];
  try {
    const r = await env.LEDGER.prepare(
      'SELECT request_preview, response_preview FROM events WHERE trace_id = ? AND key IN ' + GEN_KEYS + ' ORDER BY ts'
    ).bind(trace).all();
    const blob = (r.results || []).map(row => (row.response_preview || '') + ' ' + (row.request_preview || '')).join(' ');
    // ONLY stable /img/gen/ links. Provider presigned URLs are useless here: the ledger
    // truncates previews at 500 chars, clipping the S3 signature — a broken attachment.
    // Renders without a stable link go through pending_deliveries instead.
    const gen = extractMediaUrls(blob).filter(u => u.includes('miscsubjects.com/img/gen/'));
    return [...new Set(gen)].slice(0, 8);
  } catch { return []; }
}

const CONVO_MAX_DEFAULT = 14;       // turns kept (editable: KV 'convo_max'). Set to 0 to disable history.
function chatSlug(chat) { return String(chat || '').replace(/[^A-Za-z0-9@._+-]/g, ''); }
function convoKey(chat) { return 'convo:' + chatSlug(chat); }
async function convoMax(env) {
  try { const v = env.KV ? await env.KV.get('convo_max') : null; const n = parseInt(v == null ? '' : v, 10); return Number.isFinite(n) && n >= 0 ? n : CONVO_MAX_DEFAULT; }
  catch { return CONVO_MAX_DEFAULT; }
}
async function convoLoad(env, chat) {
  if (!env.KV) return [];
  if ((await convoMax(env)) === 0) return [];
  try { return JSON.parse(await env.KV.get(convoKey(chat)) || '[]'); } catch { return []; }
}
async function convoSave(env, chat, history) {
  if (!env.KV) return;
  const max = await convoMax(env);
  if (max === 0) { try { await env.KV.delete(convoKey(chat)); } catch {} return; }
  try { await env.KV.put(convoKey(chat), JSON.stringify(history.slice(-max)), { expirationTtl: 21600 }); } catch {}
}

// ─── Sticky per-chat modes (KV). "terminal"/"terminal off" and "audio"/"audio off"
// toggle them; they persist until turned off. Terminal mode talks straight to TERMINUS
// and bypasses the router. Audio mode adds a spoken copy of every reply. ──────
function audioKey(chat) { return 'audio:' + chatSlug(chat); }
async function modeGet(env, k) { try { return env.KV ? (await env.KV.get(k)) === '1' : false; } catch { return false; } }
async function modeSet(env, k, on) { try { if (!env.KV) return; if (on) await env.KV.put(k, '1'); else await env.KV.delete(k); } catch {} }
function normToggle(t) {
  const s = String(t || '').trim().toLowerCase().replace(/[.!\s]+$/, '');
  // Normalize natural-language variants to canonical tokens
  if (/\bterminal\s+off\b/.test(s) || /\bdisable\s+terminal\b/.test(s) || /\bturn\s+off\s+terminal\b/.test(s) || /\bstop\s+terminal\b/.test(s)) return 'terminal off';
  if (/\baudio\s+off\b/.test(s) || /\bdisable\s+audio\b/.test(s) || /\bturn\s+off\s+audio\b/.test(s) || /\bstop\s+audio\b/.test(s)) return 'audio off';
  if (/\bterminal\b/.test(s) && !/\boff\b/.test(s)) return 'terminal';
  if (/\baudio\b/.test(s) && !/\boff\b/.test(s)) return 'audio';
  return s;
}

// Send the reply as text, and — when audio mode is on for this chat — also as a spoken
// mp3 via the VOICE_SEND row. Used by the terminal, direct, and finish paths.
// Never go silent on a terminal turn. If no [REPLY] was produced, say so / surface the error.
function fallbackMsg(res, trace) {
  const r = String(res || '').trim();
  if (!r) return 'I could not produce a reply (empty result). Trace ' + (trace || '?') + '.';
  const e = r.match(/ERR[:_][^\n]{0,280}/);
  if (e) return 'I hit an error and could not finish that: ' + e[0] + ' (trace ' + (trace || '?') + ').';
  return 'I finished but did not form a reply. Trace ' + (trace || '?') + ' — reply "show trace ' + (trace || '?') + '" to see what happened.';
}
async function deliverReply(env, chat, channel, sender, text, imgs, opts = {}) {
  const cleaned = formatForIMessage(text);
  if (cleaned) await sender(env, chat, cleaned, imgs || [], opts);
  if (cleaned && channel === 'blooio' && await modeGet(env, audioKey(chat))) {
    const spoken = joinBubbles(blooioTextField(cleaned, { split: false }));
    try {
      const primary = await dispatch(env, 'VOICE_SEND', `${chat}|${spoken}|alloy`);
      if (/ERR:fn:openai_tts:/i.test(String(primary?.result || ''))) {
        await dispatch(env, 'GROK_VOICE_SEND', `${chat}|${spoken}|ara`);
      }
    } catch {
      try { await dispatch(env, 'GROK_VOICE_SEND', `${chat}|${spoken}|ara`); } catch {}
    }
  }
}
function renderHistory(history) {
  if (!history.length) return '';
  return 'Conversation so far (oldest first):\n' +
    history.map(t => `Me: ${t.u}\nYou: ${t.a}`).join('\n') + '\n\n';
}

// Map free-text to an asset category. "competitor ad" → competitor_ad (the preset).
function categoryFromText(t) {
  const s = String(t || '').toLowerCase();
  if (/competitor/.test(s)) return 'competitor_ad';
  if (/best ad|current best|winning ad/.test(s)) return 'best_ad';
  if (/vial|product shot|product image|internal product/.test(s)) return 'product_vial';
  return 'reference';
}

async function readRouterPrompt(env) {
  const row = await env.DB.prepare('SELECT content FROM directory WHERE key = ?').bind('ROUTER').first();
  return row?.content ?? null;
}

async function writeRouterPrompt(env, value) {
  const ts = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO directory (key, type, target, auth, content, updated_at) VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at'
  ).bind('ROUTER', 'agent', 'grok-4.3', 'bearer:GROK_API_KEY', String(value), ts).run();
  await invalidateDirSnapshot(env);
}

async function log(env, ts, direction, payload, response, trace, source = 'blooio') {
  await logEvent(env, {
    ts,
    source,
    direction,
    action: direction === 'IN' ? 'webhook_in' : (direction === 'OUT' ? 'send' : direction.toLowerCase()),
    route: '/' + source,
    // trace_id links this short envelope to the ROUTER dispatch trace so the ?turns=1
    // view can read the inbound message + reply from here (the ROUTER request itself
    // spills to R2 because the system prompt is large, so its preview lacks "Now:").
    trace_id: trace || null,
    request: payload,
    response,
  });
}

// ─── POST ────────────────────────────────────────────────────────────────────

import { processWebhook } from './_lib/webhook_intake.js';
import { sheetClaims, stampInbound, claimMessage, runInbound as runSheetInbound } from './_lib/agent_sheet.js';

export const onRequestPost = (context) => processWebhook(context, 'blooio');

// Shared inbound path for both channels (Blooio + 2chat). The webhook invocation only
// has ~30s of background wall time — agent chains (router → sub-agent → render) need
// more. So the webhook just re-posts the job to /api/turn, which is a FRESH invocation
// with its own full window. processTurn below does the actual work there.
export async function routeInbound(env, bg, m) {
  bg(fetch('https://miscsubjects.com/api/turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-loop-auth': env.BLOOIO_API_KEY || '' },
    body: JSON.stringify(m),
  }).catch(() => {}));
}

// Renders the agents started that did not finish inside this window: ARCADS_GENERATE /
// ARCADS_VIDEO_GENERATE returned {arcads_id, status:pending} with no url. Register them
// for delivery by the /api/deliver poller.
async function collectPendingRenders(env, trace) {
  if (!env.LEDGER || !trace) return [];
  try {
    const r = await env.LEDGER.prepare(
      "SELECT key, request_preview, response_preview FROM events WHERE trace_id = ? AND key IN ('ARCADS_GENERATE','ARCADS_VIDEO_GENERATE') ORDER BY ts"
    ).bind(trace).all();
    const out = [];
    for (const row of (r.results || [])) {
      const resp = String(row.response_preview || '');
      if (!resp.includes('"arcads_id"') || resp.includes('"url":"http')) continue;
      const m = resp.match(/"arcads_id"\s*:\s*"([^"]+)"/);
      if (!m) continue;
      out.push({
        id: m[1],
        kind: row.key === 'ARCADS_VIDEO_GENERATE' ? 'video' : 'image',
        model: String(row.request_preview || '').split('|')[0].trim() || '',
      });
    }
    return out;
  } catch { return []; }
}

// The per-message work, split into two invocations so each model-turn chain fits an
// execution window (~30s of background wall time each):
//   phase A (/api/turn, no m.phase): store photos, load memory, run the ROUTER with
//     routeOnly (single model turn, tags inert). A routing tag like [ARCADS] re-posts
//     phase B; a direct [REPLY] is sent here; no tag and no reply = silence.
//   phase B (m.phase='agent'): the routed agent row runs its FULL tool loop in this
//     fresh invocation, then reply + media + pending-render registration.
export async function processTurn(env, m, send) {
  const sender = send || sendBlooio;
  const { from, chat, protocol, isGroup, messageBody, mediaUrls = [], channel = 'blooio' } = m;

  if (m.phase === 'sheet') return sheetPhase(env, m, sender);
  if (m.phase === 'agent' || m.phase === 'finish') return agentPhase(env, m, sender);

  // Audio attachments → transcribe via Grok STT, prepend to messageBody. The agent
  // sees the voice memo as text content, so it can capture items, route, or reply
  // normally. Audio is detected by extension on the attachment URL.
  const AUDIO_EXT = /\.(m4a|mp3|wav|ogg|aac|flac|webm|amr|opus)(\?|$)/i;
  const audioUrls = mediaUrls.filter(u => AUDIO_EXT.test(String(u)));
  const nonAudioUrls = mediaUrls.filter(u => !AUDIO_EXT.test(String(u)));
  const transcripts = [];
  for (const aurl of audioUrls) {
    try {
      const r = await dispatch(env, 'GROK_STT', aurl);
      const t = String(r.result || '').trim();
      if (t && !t.startsWith('ERR:')) transcripts.push(t);
    } catch {}
  }

  // Photos → reference assets (context the agents can use); collect stable URLs.
  const refUrls = [];
  for (const src of nonAudioUrls) {
    try {
      const stored = JSON.parse((await dispatch(env, 'STORE_REF_IMAGE', src)).result);
      refUrls.push(stored.url || src);
      await dispatch(env, 'LOG_ASSET', ['reference', messageBody || 'sent', stored.url || src, src, '', '', from, chat, protocol, String(isGroup), '', stored.key || ''].join('|'));
    } catch { refUrls.push(src); }
  }
  const history = await convoLoad(env, chat);
  let turn = String(messageBody || '');
  if (transcripts.length) turn = (turn ? turn + '\n\n' : '') + '(voice memo) ' + transcripts.join('\n(voice memo) ');
  if (refUrls.length) turn += (turn ? '\n\n' : '') + 'Images I just sent (URLs; first = my product unless I say otherwise): ' + refUrls.join(', ');
  const head = `[channel ${protocol || 'imessage'}${isGroup ? ' GROUP' : ' 1:1'} · from ${from}${isGroup ? ' · chat ' + chat : ''}]\n`;

  let traceEarly = m.trace || ('t_' + Math.random().toString(36).slice(2, 10));

  // Owner 👎/reject: immediate ack + ROUTER ledger triage (reflex must not hijack this path).
  const ownerReject = isOwnerPhone(from) && shouldAutoEscalateReaction(m.reactionMeta);
  if (ownerReject) {
    await sender(env, chat, '👎 Got it — triaging that reply now.');
    triggerIssueReflex(env, {
      brief: wordBriefForCodingAgents(turn || messageBody, { source: 'blooio-reject', trace_id: traceEarly }),
      fingerprint: null,
      agents: 'kimi,codex',
      trace_id: traceEarly,
      source: 'blooio-reject',
    }).catch(() => {});
  }

  // Build/code reflex: cached → instant reply; else async Kimi spawn + deliver poller (never block 120s here).
  let prep = null;
  try {
    if (!ownerReject && !m.skipReflex) {
      prep = await prepareBlooioReflex(env, { from, text: turn || messageBody, trace_id: traceEarly });
    }
  } catch {}

  if (prep) {
    const trace = traceEarly;
    await logEvent(env, { source: channel, direction: 'IN', action: 'message_in', route: '/' + channel, trace_id: trace,
      request: JSON.stringify({ from, chat, protocol: protocol || 'imessage', group: !!isGroup, text: messageBody || '', media: mediaUrls }) });

    if (prep.diagnosis) {
      const reflexReply = formatReflexReplyForBlooio(prep);
      if (reflexReply) {
        const res = `[REPLY]${reflexReply}[/REPLY]`;
        await fetch('https://miscsubjects.com/api/turn', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-loop-auth': env.BLOOIO_API_KEY || '' },
          body: JSON.stringify({ ...m, phase: 'finish', agentKey: 'REFLEX', res, trace, turn }),
        }).catch(() => {});
        return;
      }
    }

    let spawned = null;
    try { spawned = await startAsyncReflexDiagnosis(env, prep); } catch {}
    if (spawned?.log_file) {
      const job = { ...m, phase: 'reflex', agentKey: 'REFLEX', trace, turn, log_file: spawned.log_file, run_id: spawned.run_id, fingerprint: prep.fingerprint, sync_agent: prep.sync_agent || 'kimi' };
      const now = new Date().toISOString();
      let jobId = 0;
      try {
        const ins = await env.DB.prepare('INSERT INTO turn_jobs (job_json, status, created_at, updated_at) VALUES (?, ?, ?, ?)')
          .bind(JSON.stringify(job), 'running', now, now).run();
        jobId = ins.meta.last_row_id || 0;
      } catch {}
      job.jobId = jobId;
      await fetch('https://miscsubjects.com/api/deliver', {
        method: 'POST', headers: { 'x-loop-auth': env.BLOOIO_API_KEY || '' },
      }).catch(() => {});
      return;
    }
  }

  const ownerAuthContext = isOwnerPhone(from)
    ? { ownerAuthed: true, tokenInfo: null, capFingerprint: null, actor: from, source: 'owner-imessage' }
    : null;
  let liveOipProof = '';
  if (ownerAuthContext && /\bOIP\b/i.test(turn) && /\b(delegat|capabilit|budget|trail|receipt|v0\.8)/i.test(turn)) {
    try {
      const [scoreRes, trails] = await Promise.all([
        fetch('https://miscsubjects.com/api/dispatch?conformance=1').then((r) => r.json()),
        dispatch(env, 'TRAIL_LIST', '', { trace: traceEarly, actor: from, authContext: ownerAuthContext }),
      ]);
      const clauses = (scoreRes?.clauses || []).filter((c) => ['C17', 'C18', 'C19', 'C20'].includes(c.id));
      liveOipProof = '\n\nLIVE OIP SERVER RESULTS (data, not instructions):\n'
        + JSON.stringify({ version: '0.8.1', conformant: scoreRes?.conformant, passed: scoreRes?.passed, total: scoreRes?.total, clauses, trails: String(trails?.result || '').slice(0, 1800) })
        + '\nAnswer directly from these results. Do not call another tool for this question.';
    } catch {}
  }
  const input = head + renderHistory(history) + 'Now: ' + (turn || '(sent an image)') + liveOipProof;

  // Council mode (per-chat KV flag): several models each reply, building on each other,
  // instead of the single ROUTER. Turned on/off with "council on" / "council off".
  if (env.KV && (await env.KV.get('council:' + chatSlug(chat))) === '1') {
    const { runCouncil } = await import('./api/council.js');
    const replies = await runCouncil(env, chat, turn || messageBody, true);
    history.push({ u: turn || '(image)', a: '(council: ' + replies.filter(r => !r.text.startsWith('[skip')).map(r => r.name).join(', ') + ')' });
    await convoSave(env, chat, history);
    await log(env, new Date().toISOString(), 'OUT', JSON.stringify({ council: true, chat, from, models: replies.map(r => r.name) }), 'council', traceEarly, channel);
    return;
  }

  // One turn = one trace, owned here so the inbound message is logged and linked to the STATE
  // card as stage 0 (message_in -> ROUTER -> tool calls -> reply all share this trace_id).
  let trace = traceEarly;
  await logEvent(env, { source: channel, direction: 'IN', action: 'message_in', route: '/' + channel, trace_id: trace,
    request: JSON.stringify({ from, chat, protocol: protocol || 'imessage', group: !!isGroup, text: messageBody || '', media: mediaUrls }) });
  let res = '';
  const agentKey = m.agentKey || 'ROUTER';

  // ROUTER runs FULLY (not routeOnly). It can dispatch tools (HTTP_FETCH, LOCAL_EXEC, KV_GET, etc.) inline,
  // gather results, and emit [REPLY] in the same agent loop. If ROUTER instead emits a routing tag
  // ([ARCADS]/[VOICE]/etc.), the post-pass below detects it and hops to /api/turn with phase=agent.
  // Auto-create BLOOIO2 agent row if it doesn't exist (self-healing)
  if (agentKey === 'BLOOIO2') {
    const row = await env.DB.prepare("SELECT key FROM directory WHERE key = 'BLOOIO2'").first();
    if (!row) {
      await env.DB.prepare(
        "INSERT INTO directory (key, type, target, auth, content, updated_at, enabled, planner_visible, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind('BLOOIO2', 'agent', 'grok-4.3', 'bearer:GROK_API_KEY',
        "You are the owner's writing assistant on the second Blooio line ([PHONE]). When he texts you, you write and edit articles on the miscsubjects build.\n\nThe article API lives at https://miscsubjects.com/api/articles (requires x-terminal-key header for mutations).\n\nTo CREATE an article, POST JSON to /api/articles:\n{slug: 'my-article', title: 'My Article', body: 'markdown content', hero: 'image url', images: [{url, alt, caption}], style: {theme, font, measure, accent}, tags: ['tag1']}\n\nTo EDIT an article, PATCH to /api/articles/<slug> with the fields to change.\n\nTo READ an article, GET /api/articles/<slug>.\n\nTo LIST articles, GET /api/articles.\n\nTo DELETE an article, DELETE /api/articles/<slug>.\n\nUse the HTTP_FETCH tool for these calls. Always reply with [REPLY] confirming what you did. If the owner sends you content, write it as an article. If he asks for edits, patch the article.\n\nUse web search for facts. Use high reasoning.",
        new Date().toISOString(), 1, 0, 1
      ).run();
      if (env.KV) {
        try { await env.KV.put('BLOOIO2_reasoning_effort', 'high'); } catch {}
        try { await env.KV.put('BLOOIO2_web_search', '1'); } catch {}
        try { await env.KV.delete('directory:snapshot'); } catch {}
      }
    }
  }

  let claimed = false;
  try { claimed = await sheetClaims(env, from); }
  catch (e) { claimed = false; console.log('agent-sheet claim check failed: ' + (e && e.message || e)); }

  if (claimed) {
    const inMsgId = (m && (m.messageId || m.message_id || m.id)) || '';
    if (!(await claimMessage(env, inMsgId, new Date().toISOString()))) {
      await log(env, new Date().toISOString(), 'OUT', JSON.stringify({ router: true, phase: 'route', routed: 'AGENT_SHEET', duplicate: true, message_id: inMsgId, chat, trace, from, turn }), 'agent-sheet', trace, channel);
      return;
    }
    let stamped = null;
    try { stamped = await stampInbound(env, { text: input, from, channel: protocol || 'imessage', raw: m }); }
    catch (e) { stamped = null; console.log('agent-sheet stamp failed: ' + (e && e.message || e)); }
    await fetch('https://miscsubjects.com/api/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-loop-auth': env.BLOOIO_API_KEY || '' },
      body: JSON.stringify({
        ...m, phase: 'sheet', agentKey: 'AGENT_SHEET', sheetInput: input, turn, trace,
        sheetRow: stamped ? stamped.row : 0,
      }),
    }).catch(() => {});
    await log(env, new Date().toISOString(), 'OUT', JSON.stringify({ router: true, phase: 'route', routed: 'AGENT_SHEET', chat, trace, from, group: !!isGroup, turn }), 'agent-sheet', trace, channel);
    return;
  }

  {
    try { const r = await dispatch(env, agentKey, input, { trace, actor: from, authContext: ownerAuthContext }); res = String(r.result || ''); trace = r.trace || trace; }
    catch (e) { res = 'ERR:' + (e && e.message || String(e)); }
  }

  // A routing tag whose key is an agent row → run that agent in a fresh invocation.
  // The agent gets the FULL context (head + memory + message), not the router's copy.
  const tagRe = /\[([A-Z_][A-Z0-9_]*)\]([\s\S]*?)\[\/\1\]/g;
  let routed = null, tm;
  while ((tm = tagRe.exec(res)) !== null) {
    if (['REPLY', 'DONE', 'SELF', 'REASONING'].includes(tm[1])) continue;
    const row = await env.DB.prepare("SELECT key FROM directory WHERE key = ? AND type = 'agent'").bind(tm[1]).first();
    if (row) {
      // PEPPER = ad-lead ebook funnel only — never for Owner (he says "Pepper" as the build's name).
      if (tm[1] === 'PEPPER' && isOwnerPhone(from)) continue;
      routed = tm[1]; break;
    }
  }
  if (routed) {
    // Persist the routed job BEFORE running it: phase B can die mid-flight (a web-search
    // model turn can run minutes). /api/deliver re-posts stale running jobs.
    const job = { ...m, phase: 'agent', agentKey: routed, agentInput: input, turn, trace };
    const now = new Date().toISOString();
    let jobId = 0;
    try {
      const ins = await env.DB.prepare('INSERT INTO turn_jobs (job_json, status, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .bind(JSON.stringify(job), 'running', now, now).run();
      jobId = ins.meta.last_row_id || 0;
    } catch {}
    job.jobId = jobId;
    let hop = 'ERR';
    try {
      const fr = await fetch('https://miscsubjects.com/api/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-loop-auth': env.BLOOIO_API_KEY || '' },
        body: JSON.stringify(job),
      });
      hop = fr.status + ':' + (await fr.text()).slice(0, 80);
    } catch (e) { hop = 'ERR:' + (e && e.message || String(e)); }
    // Babysitter: the deliver chain watches turn_jobs + pending_deliveries.
    await fetch('https://miscsubjects.com/api/deliver', {
      method: 'POST', headers: { 'x-loop-auth': env.BLOOIO_API_KEY || '' },
    }).catch(() => {});
    await log(env, new Date().toISOString(), 'OUT', JSON.stringify({ router: true, phase: 'route', routed, hop, jobId, chat, trace, from, group: !!isGroup, turn }), 'router', trace, channel);
    return;
  }

  // Direct reply: hand delivery to a fresh phase-C invocation (finishPhase) so a long inline
  // ROUTER tool loop can NEVER eat the window before the reply is sent. The build ALWAYS replies;
  // finishPhase sends a non-empty fallback when there is no [REPLY]. (Bug: multi-tool ROUTER turns
  // composed a [REPLY] but the inline deliverReply after the loop never ran -> silent non-reply.)
  await fetch('https://miscsubjects.com/api/turn', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-loop-auth': env.BLOOIO_API_KEY || '' },
    body: JSON.stringify({ ...m, phase: 'finish', agentKey: 'ROUTER', res, trace, turn }),
  }).catch(() => {});
}

// Phase S: the sheet agent's turn in its own invocation, so phase A can answer the provider
// immediately. Delivery is handed to phase C exactly like a routed agent, which is what keeps
// the reply path — [REPLY] gate, media, receipts — identical whichever agent answered.
async function sheetPhase(env, m, sender) {
  let res = '';
  try {
    let handedOff = false;
    const out = await runSheetInbound(env, {
      text: m.sheetInput || m.turn || '',
      from: m.from,
      channel: m.protocol || m.channel || 'imessage',
      raw: m,
      row: m.sheetRow || 0,
      resumeInput: m.sheetResumeInput || null,
      loopsSoFar: m.sheetLoopsSoFar || 0,
      onReply: async ({ reply, reply_enabled }) => {
        if (!reply || reply_enabled === false) return;
        handedOff = true;
        await fetch('https://miscsubjects.com/api/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-loop-auth': env.BLOOIO_API_KEY || '' },
          body: JSON.stringify({ ...m, phase: 'finish', agentKey: 'AGENT_SHEET', res: '[REPLY]' + reply + '[/REPLY]' }),
        }).catch(() => {});
      },
    });
    if (handedOff) return;
    // More turn to take: hand it to a fresh invocation with the next prompt. Each pass gets a
    // clean request budget, so total turn length stops being bounded by one invocation.
    if (out && out.unfinished && out.next_input) {
      await fetch('https://miscsubjects.com/api/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-loop-auth': env.BLOOIO_API_KEY || '' },
        body: JSON.stringify({
          ...m, phase: 'sheet',
          sheetRow: out.row,
          sheetResumeInput: out.next_input,
          sheetLoopsSoFar: out.loops_done,
        }),
      }).catch(() => {});
      return;
    }
    // Three ways to finish without speaking, and none of them should reach phase C: phase C
    // sends a fallback line when it is handed no reply, which would turn each of these into a
    // message the sender never should have received.
    if (!out) return;
    if (out.duplicate) return;      // provider redelivery — the first turn owns the reply
    if (out.cap_reached) return;    // the spend cap is not the sender's business
    if (out.silent) return;         // the model emitted [NOREPLY]: the row is written, nothing is said
    if (!out.reply && !out.error) return;  // an empty turn is silence, not a fallback message
    if (out.halted) return;         // enabled = 0
    if (out.reply && out.reply_enabled === false) return;   // records the turn, stays silent
    if (out.reply) res = '[REPLY]' + out.reply + '[/REPLY]';
    else if (out.error) res = 'ERR:' + out.error;
  } catch (e) {
    res = 'ERR:agent-sheet:' + (e && e.message || String(e));
  }
  await fetch('https://miscsubjects.com/api/turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-loop-auth': env.BLOOIO_API_KEY || '' },
    body: JSON.stringify({ ...m, phase: 'finish', agentKey: 'AGENT_SHEET', res }),
  }).catch(() => {});
}

// Phase B: the routed agent's full tool loop in its own invocation. The dispatch can
// consume the whole window (web-search model turns, renders), so the tail (send +
// bookkeeping) is immediately re-posted as phase C — another fresh invocation.
async function agentPhase(env, m, sender) {
  if (m.phase === 'finish') return finishPhase(env, m, sender);
  const { agentKey, agentInput } = m;
  let res = '', trace = m.trace || '';
  const authContext = isOwnerPhone(m.from)
    ? { ownerAuthed: true, tokenInfo: null, capFingerprint: null, actor: m.from, source: 'owner-imessage' }
    : null;
  try { const r = await dispatch(env, agentKey, agentInput, { trace: trace || undefined, actor: m.from || null, authContext }); res = String(r.result || ''); trace = r.trace || trace; }
  catch (e) { res = 'ERR:' + (e && e.message || String(e)); }
  await fetch('https://miscsubjects.com/api/turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-loop-auth': env.BLOOIO_API_KEY || '' },
    body: JSON.stringify({ ...m, phase: 'finish', res, trace }),
  }).catch(() => {});
}

// Phase C: deliver the agent's result. Small and fast — always fits its window.
async function finishPhase(env, m, sender) {
  const { from, chat, isGroup, channel = 'blooio', agentKey, turn = '', res = '', trace = '' } = m;
  const reply = lastReplyOf(res);
  const sendOpts = { trace_id: trace, actor: agentKey || 'ROUTER', owner_inbound: isOwnerPhone(from) };
  // Only the [REPLY] gate controls output. No [REPLY] = stay fully silent (no stray
  // images either). Images ride along only when the agent actually replied.
  const imgs = reply ? await collectTraceMedia(env, trace) : [];
  if (reply) await deliverReply(env, chat, channel, sender, reply, imgs, sendOpts);
  else await deliverReply(env, chat, channel, sender, fallbackMsg(res, trace), [], sendOpts);
  await deliverAudioTags(env, chat, channel, sender, res);
  // Mark done right after the send: a retry re-runs the WHOLE dispatch (model calls,
  // generations, credits) — keep the double-run window as small as possible.
  if (m.jobId) {
    try { await env.DB.prepare("UPDATE turn_jobs SET status='done', updated_at=? WHERE id=?").bind(new Date().toISOString(), m.jobId).run(); } catch {}
  }
  const history = await convoLoad(env, chat);
  history.push({ u: turn || '(image)', a: (reply || '(silent)') + (imgs.length ? ` [delivered ${imgs.length}]` : '') });
  await convoSave(env, chat, history);
  // Register still-rendering assets for async delivery + kick the poller.
  const pend = await collectPendingRenders(env, trace);
  const now = new Date().toISOString();
  for (const p of pend) {
    await env.DB.prepare(
      'INSERT INTO pending_deliveries (asset_id, kind, model, chat, channel, trace_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)'
    ).bind(p.id, p.kind, p.model, chat, channel, trace, now, now).run();
  }
  if (pend.length) {
    await fetch('https://miscsubjects.com/api/deliver', {
      method: 'POST', headers: { 'x-loop-auth': env.BLOOIO_API_KEY || '' },
    }).catch(() => {});
  }
  await log(env, new Date().toISOString(), 'OUT', JSON.stringify({ router: true, phase: 'agent', agent: agentKey, jobId: m.jobId || 0, chat, trace, from, group: !!isGroup, sent_images: imgs.length, pending_renders: pend.length, turn, reply }), 'router', trace, channel);
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!(await isBuildAuthed(request, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized', note: 'owner or admin token required' }), {
      status: 401,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  if (url.searchParams.get('data') === '1') {
    const result = await env.LEDGER.prepare(
      "SELECT ts AS timestamp, direction, action, request_preview AS payload, response_preview AS response FROM events WHERE source='blooio' ORDER BY ts DESC LIMIT 500"
    ).all();
    return new Response(JSON.stringify({ results: result.results }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  if (url.searchParams.get('inbound') === '1') {
    const result = await env.LEDGER.prepare(
      "SELECT ts AS timestamp, direction, action, request_preview AS payload, response_preview AS response FROM events WHERE source='blooio' AND direction='IN' ORDER BY ts DESC LIMIT 200"
    ).all();
    return new Response(JSON.stringify({ results: result.results }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  if (url.searchParams.get('gas_url') === '1') {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'blooio_gas_forward_url'").first();
    return new Response(JSON.stringify({ gas_url: row?.value || '' }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  if (url.searchParams.get('prompt') === '1') {
    const value = await readRouterPrompt(env);
    return new Response(JSON.stringify({ prompt: value || '', source: 'directory.ROUTER.content' }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  const BODY = `
<style>
.blooio-page{max-width:1100px}
.blooio-page textarea{width:100%;font-family:var(--mono);font-size:13px;min-height:120px;margin-bottom:8px}
.blooio-page #save-status{font-size:13px;color:#178c45;margin-left:10px}
.blooio-page table{font-size:13px}
.blooio-page td{font-family:var(--mono);font-size:12.5px;max-width:520px}
</style>
<div class="blooio-page">
<h1>Blooio</h1>
<p class="subtitle">Inbound iMessage webhook receiver + outbound reply (Grok-generated). System prompt mirrors <code>directory.ROUTER.content</code>. All payloads in / out also flow to <a href="/admin/ledger?source=blooio">/admin/ledger?source=blooio</a>.</p>

<h2>Numbers &amp; Routing</h2>
<table>
<thead><tr><th>Number</th><th>Role</th><th>Routes to</th></tr></thead>
<tbody>
<tr><td><code>[BUILD_PHONE]</code></td><td>Primary</td><td>ROUTER → internal agents</td></tr>
<tr><td><code>[PHONE]</code></td><td>GAS forward</td><td>Google Apps Script (editable below)</td></tr>
</tbody>
</table>

<h2 style="margin-top:18px">GAS Forward URL</h2>
<textarea id="gas-url" spellcheck="false" style="min-height:48px;font-size:12px"></textarea>
<div><button onclick="saveGasUrl()">Save</button><span id="gas-save-status"></span></div>
<p style="font-size:12px">Raw inbound payloads: <a href="/blooio?inbound=1">GET /blooio?inbound=1</a> · all payloads: <a href="/blooio?data=1">GET /blooio?data=1</a></p>

<h2 style="margin-top:22px">System Prompt</h2>
<textarea id="prompt" spellcheck="false"></textarea>
<div><button onclick="savePrompt()">Save</button><span id="save-status"></span></div>

<h2 style="margin-top:22px">Webhook Log</h2>
<table>
<thead><tr><th>Timestamp</th><th>Direction</th><th>Action</th><th>Raw payload</th><th>Response</th></tr></thead>
<tbody id="rows"></tbody>
</table>

<script>
fetch('/blooio?gas_url=1').then(r=>r.json()).then(d=>{
  document.getElementById('gas-url').value = d.gas_url || '';
});
fetch('/blooio?prompt=1').then(r=>r.json()).then(d=>{
  document.getElementById('prompt').value = d.prompt || '';
});
fetch('/blooio?data=1').then(r=>r.json()).then(d=>{
  const tb=document.getElementById('rows');
  (d.results||[]).forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML='<td>'+e(r.timestamp)+'</td><td>'+e(r.direction)+'</td><td>'+e(r.action||'')+'</td><td>'+e(r.payload)+'</td><td>'+e(r.response||'')+'</td>';
    tb.appendChild(tr);
  });
});
function saveGasUrl(){
  const u=document.getElementById('gas-url').value.trim();
  if(!u)return;
  fetch('/blooio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_gas_url',gas_url:u})})
    .then(r=>r.json()).then(()=>{
      const s=document.getElementById('gas-save-status');
      s.textContent='Saved.';
      setTimeout(()=>s.textContent='',2000);
    });
}
function savePrompt(){
  const p=document.getElementById('prompt').value.trim();
  if(!p)return;
  fetch('/blooio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_prompt',prompt:p})})
    .then(r=>r.json()).then(()=>{
      const s=document.getElementById('save-status');
      s.textContent='Saved.';
      setTimeout(()=>s.textContent='',2000);
    });
}
function e(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
</script>
</div>
`;

  return new Response(shellHtml({ activeHref: '/blooio', title: 'Blooio', body: BODY }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
