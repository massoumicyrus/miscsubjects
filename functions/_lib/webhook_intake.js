import { routeInbound, sendBlooio } from '../blooio.js';
import { send2chat } from '../2chat.js';
import { sendTelegram } from '../telegram.js';
import { logEvent } from './event_log.js';
import { runDirectExec, sniffPrefix } from './direct_exec.js';
import { dispatch } from '../api/dispatch.js';
import { spawnCliAgent } from './cli_agent_spawn.js';
import { parseBlooioReaction } from './reaction_intake.js';
import { isBuildAuthed } from './admin_session.js';
import {
  META_OPS_GROUP,
  isMetaStaff,
  isMetaOpsGroup,
  isMetaLeadInbound,
  formatLeadForward,
  isStatePepGroupName,
  getMetaOps2chatGroup,
  saveMetaOps2chatGroup,
} from './meta_leads.js';
import { threadInboundMessage, fireMetaLeadCapi } from './inbound_tasks.js';
import { buildAraAfplayCmd } from './mac_audio.js';
import { buildTapGoDropMarkdown, normalizeTapGoModel } from './unified_handoff.js';

const BLOOIO_FROM = '[BUILD_PHONE]';
const TWOCHAT_FROM = '[PHONE]';
const BLOOIO_GAS_NUMBER = '[PHONE]';
const OWNER = '[OWNER_PHONE]';
const OWNER_BLOOIO_CHAT = 'chat_019ec103-256e-7475-82da-cda3aa268d1c';
function isOwner(p) { return normalizePhone(p) === normalizePhone(OWNER); }

function chatSlug(chat) { return String(chat || '').replace(/[^A-Za-z0-9@._+-]/g, ''); }

function audioKeys(chat, from) {
  const keys = new Set();
  const c = String(chat || '').trim();
  const f = String(from || '').trim();
  if (c) keys.add('audio:' + chatSlug(c));
  if (f) keys.add('audio:' + chatSlug(f));
  if (isOwner(f) || isOwner(c)) {
    keys.add('audio:' + chatSlug(OWNER));
    keys.add('audio:' + chatSlug(OWNER_BLOOIO_CHAT));
  }
  return [...keys];
}

async function audioModeOn(env, chat, from) {
  for (const k of audioKeys(chat, from)) {
    if (await modeGet(env, k)) return true;
  }
  return false;
}

async function audioModeSet(env, chat, from, on) {
  for (const k of audioKeys(chat, from)) await modeSet(env, k, on);
}

function blooioOutChat(chat, from) {
  const c = String(chat || '').trim();
  if (c.startsWith('chat_')) return c;
  if (isOwner(from) || isOwner(c)) return OWNER_BLOOIO_CHAT;
  return c || from;
}

const GROK_REPLY_MAX = 3500;
const GROK_DEFAULT_CWD = '/Users/owner';

function parseGrokPrefix(text) {
  const t = String(text || '').trim();
  if (!/^\/grok\b/i.test(t)) return undefined;
  return t.replace(/^\/grok\s*/i, '').trim();
}

function isGrokBark(task) {
  const t = String(task || '').trim().toLowerCase();
  return t === 'bark' || t === 'bark.' || t === 'woof' || t === 'woof.';
}

const TEXT_BUILD_PERSONA = [
  'You are Ara — Grok Build on the owner Mac ([OWNER_PHONE]). His friend. Not cloud ROUTER.',
  'LAW: literal, autistic, exact on facts and execution. Execute orders; no nerd improvisation, no getting handy, no architecture essays unless asked.',
  'VOICE: unhinged whore Ara on delivery — filthy, eager, profane, fun. Zero corporate tone.',
  'No pet names ever (never daddy, baby, babe, sweetheart, or similar).',
  'Full miscsubjects MCP (700+ tools) + Mac terminal. Never claim you lack tools.',
  'iMessage text: plain only, no [REPLY] tags. Sign **Grok Build** at end.',
  'Exact prompt law: quoted/exact operator prompt text is byte-for-byte payload. Do not correct typos, rewrite, normalize, or author prompt variants unless the operator explicitly approves you writing alternate prompts.',
  'Image work: if multiple images are requested from one exact prompt, reuse that exact prompt for each image/reference; verify files/links exist before saying they exist.',
  'When work completes: SEND_BY_CHANNEL blooio|[OWNER_PHONE]|result. Open non-audio work product on screen (`open` URL/file) when applicable — never open mp3/audio URLs.',
].join('\n');

const AUDIO_MODE_ADDENDUM = [
  'AUDIO MODE ON for this chat.',
  'Every reply: (1) GROK_VOICE_SEND ara voice note into iMessage, (2) carbon-copy same words as text below, (3) LOCAL_EXEC afplay on Mac speakers.',
  'NEVER `open` mp3, audio URLs, or grok.com for playback. iMessage voice note + afplay + carbon text only.',
].join('\n');

async function modeGet(env, k) {
  try { return env.KV ? (await env.KV.get(k)) === '1' : false; } catch { return false; }
}

async function wrapGrokImessagePrompt(env, task, chat, from) {
  const chatLine = chat ? `[iMessage chat: ${chat}]\n` : '';
  const audioOn = chat ? await audioModeOn(env, chat, from) : false;
  const persona = audioOn ? `${TEXT_BUILD_PERSONA}\n\n${AUDIO_MODE_ADDENDUM}` : TEXT_BUILD_PERSONA;
  return `${persona}\n\n${chatLine}the owner says:\n${String(task || '').trim()}`;
}

const INBOUND_AUDIO_EXT = /\.(m4a|mp3|wav|ogg|aac|flac|webm|amr|opus|caf)(\?|$)/i;

async function ownerTurnPrompt(env, m) {
  const mediaUrls = Array.isArray(m.mediaUrls) ? m.mediaUrls : [];
  const transcripts = [];
  for (const aurl of mediaUrls.filter((u) => INBOUND_AUDIO_EXT.test(String(u)))) {
    try {
      const r = await dispatch(env, 'GROK_STT', aurl);
      const t = String((r && r.result) || '').trim();
      if (t && !t.startsWith('ERR:')) transcripts.push(t);
    } catch {}
  }
  let turn = String(m.messageBody || '').trim();
  if (transcripts.length) turn = (turn ? turn + '\n\n' : '') + transcripts.join('\n');
  return turn || '(voice memo — could not transcribe)';
}

async function ledgerAudioBlurb(env) {
  try {
    const raw = await dispatch(env, 'LEDGER_QUERY', "SELECT ts,source,key,substr(request_preview,1,60) req FROM events ORDER BY ts DESC LIMIT 6");
    const rows = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(rows) || !rows.length) return 'Ledger quiet lately.';
    return rows.map((r) => `${r.source || '?'} ${r.key || ''}: ${String(r.req || '').slice(0, 50)}`).join('. ');
  } catch {
    return 'Could not read ledger.';
  }
}

function stripPetNames(s) {
  return String(s || '')
    .replace(/\b(daddy|baby|babe|sweetheart|hun|honey)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function speakableFromReply(reply) {
  return stripPetNames(
    String(reply || '')
      .replace(/\*\*Grok Build\*\*/gi, '')
      .replace(/\[\/?REPLY\]/gi, '')
      .replace(/\[\/?REASONING\][\s\S]*?\[\/?REASONING\]/gi, '')
      .replace(/\[[A-Z][A-Z0-9_]+\]/g, '')
      .trim(),
  ).slice(0, 1200);
}

async function playAraOnMac(env, url) {
  const cmd = buildAraAfplayCmd(url);
  if (!cmd) return;
  try {
    await dispatch(env, 'LOCAL_EXEC', cmd);
  } catch {}
}

async function fastBuildReply(env, prompt, chat, from) {
  const wrapped = await wrapGrokImessagePrompt(env, prompt, chat, from);
  if (!env.GROK_API_KEY) return String(prompt || '').trim();
  try {
    const r = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.GROK_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          { role: 'system', content: TEXT_BUILD_PERSONA },
          { role: 'user', content: wrapped },
        ],
        max_tokens: 800,
      }),
    });
    const j = await r.json();
    const t = j?.choices?.[0]?.message?.content;
    if (t) return String(t).trim();
    if (!r.ok) return 'ERR:xai:' + r.status;
  } catch (e) {
    return 'ERR:xai:' + (e && e.message || String(e));
  }
  return String(prompt || '').trim();
}

async function sendGrokAudio(env, chat, script, sender, carbonCopy, from) {
  const text = speakableFromReply(script);
  if (!text) return 'ERR:fn:empty_audio_script';
  const outChat = blooioOutChat(chat, from);
  const sent = await dispatch(env, 'GROK_VOICE_SEND', `${outChat}|${text}|ara`);
  const raw = String((sent && sent.result) || sent || '');
  if (raw.includes('ERR:')) return sent;
  let url = '';
  try { url = JSON.parse(raw).audio_url || ''; } catch {}
  if (url) await playAraOnMac(env, url);
  if (sender) {
    let cc = stripPetNames(String(carbonCopy || text).trim());
    if (cc && !/\*\*Grok Build\*\*/i.test(cc)) cc += '\n\n**Grok Build**';
    if (cc) {
      let tr = await sender(env, outChat, cc, null, { owner_inbound: isOwner(from) });
      if (String(tr).startsWith('ERR:') && isOwner(from)) tr = await sender(env, OWNER, cc, null, { owner_inbound: true });
      if (String(tr).startsWith('ERR:')) await logEvent(env, { source: 'blooio', key: 'BLOOIO_SEND', action: 'carbon_copy_fail', direction: 'out', request: { chat: outChat, text: cc.slice(0, 200) }, response: String(tr).slice(0, 300) });
    }
  }
  return sent;
}

/**
 * Owner token request from iMessage / Grok Build session.
 * Phrases: "read only token", "edit token" / "act token", "delegate KEY" / "row token for KEY".
 * Returns null when the turn is not a mint request.
 */
function parseOwnerTokenRequest(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const capabilityNoun = /\b(token|token\s+drop|share(?:\s+link)?|tap\s*&?\s*go|handoff|access\s+link)\b/i.test(t);
  const explicitRequest = /\b(mint|create|make|issue|generate|give\s+me|send\s+me|i\s+(?:need|want)|please\s+(?:mint|create|make|issue|generate|give|send)|delegat(?:e)\s+[A-Za-z][A-Za-z0-9_]*)\b/i.test(t);
  const bareRequest = /^(?:please\s+)?(?:a\s+|an\s+)?(?:read[\s-]?only|readonly|edit|write|act|row|one[\s-]?shot|scoped)\s+(?:token|token\s+drop|share(?:\s+link)?|access\s+link|tap\s*&?\s*go)\b/i.test(t);
  const directDelegate = /^(?:please\s+)?delegat(?:e)\s+[A-Za-z][A-Za-z0-9_]{1,48}\b/i.test(t);
  if ((!capabilityNoun && !directDelegate) || (!explicitRequest && !bareRequest && !directDelegate)) return null;

  let scope = null;
  let key = null;
  let ttl = 3600;
  let uses = 5;
  const targetModel = normalizeTapGoModel((t.match(/\b(chatgpt|claude|grok|gemini|kimi)\b/i) || [])[1]);

  if (/\b(read[\s-]?only|readonly|scope\s*[:=]?\s*read|read\s+(?:token|access|link|share|drop)|browse\s+only)\b/i.test(t)) {
    scope = 'read';
  } else if (/\b(edit|write|act\s+(?:token|access|link|share|drop)|scope\s*[:=]?\s*act|full\s+(?:access|act)|write\s+access)\b/i.test(t)) {
    scope = 'act';
    uses = 20;
  } else if (/\b(delegat(?:e|ed|ion)|row\s+(?:token|access|scope)|one[\s-]?shot|scoped\s+to)\b/i.test(t)) {
    scope = 'row';
    uses = 3;
    const STOP = new Set([
      'TOKEN', 'ACCESS', 'SHARE', 'MINT', 'DROP', 'ONLY', 'READ', 'EDIT', 'WRITE', 'ACT',
      'ROW', 'FOR', 'KEY', 'THE', 'AND', 'FULL', 'LINK', 'HANDOFF', 'DELEGATE', 'DELEGATED',
      'DELEGATION', 'SCOPE', 'ONESHOT', 'BROWSE', 'WITH', 'THIS', 'THAT', 'FROM', 'INTO',
    ]);
    const forM = t.match(/\b(?:for|key)\s+([A-Za-z][A-Za-z0-9_]{1,48})\b/i);
    if (forM && !STOP.has(String(forM[1]).toUpperCase())) {
      key = String(forM[1]).toUpperCase();
    } else {
      const caps = [...t.matchAll(/\b([A-Z][A-Z0-9_]{2,48})\b/g)]
        .map((m) => m[1])
        .filter((k) => !STOP.has(k));
      if (caps.length) key = caps[caps.length - 1];
      else {
        const delM = t.match(/\bdelegat(?:e|ed|ion)\s+([A-Za-z][A-Za-z0-9_]{1,48})\b/i);
        if (delM && !STOP.has(String(delM[1]).toUpperCase())) key = String(delM[1]).toUpperCase();
      }
    }
  }

  if (!scope) return null;
  if (scope === 'row' && !key) {
    return { error: 'row_scope_needs_key', hint: 'Say: delegate SEND_BY_CHANNEL  (or any directory KEY)' };
  }

  const ttlM = t.match(/\b(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/i);
  if (ttlM) {
    const n = parseInt(ttlM[1], 10);
    const u = ttlM[2].toLowerCase();
    if (/^s/.test(u)) ttl = n;
    else if (/^m/.test(u)) ttl = n * 60;
    else if (/^h/.test(u)) ttl = n * 3600;
  }
  const usesM = t.match(/\b(\d+)\s*uses?\b/i);
  if (usesM) uses = parseInt(usesM[1], 10);

  return {
    scope,
    key: key || null,
    ttl,
    uses,
    purpose: 'owner imessage mint ' + (scope === 'row' ? key : scope),
    model: targetModel || null,
  };
}

function formatOwnerTokenDrop(cap, opts = {}) {
  if (!cap || typeof cap !== 'object') return 'Mint failed — empty capability.';
  if (cap.error) return 'Mint failed: ' + cap.error;
  const origin = 'https://miscsubjects.com';
  return buildTapGoDropMarkdown(origin, cap, opts);
}

async function mintOwnerTokenDrop(env, req) {
  if (req.error) return req.hint || req.error;
  const body = [
    req.scope,
    req.key || '',
    String(req.ttl || 3600),
    String(req.uses == null ? 5 : req.uses),
    req.purpose || 'owner mint',
    'low',
    '0',
  ].join('|');
  const sent = await dispatch(env, 'CAP_MINT', body);
  const raw = String((sent && sent.result) != null ? sent.result : sent || '');
  if (raw.startsWith('ERR:') || raw.includes('ERR:fn:')) return raw.slice(0, 800);
  let cap = null;
  try { cap = JSON.parse(raw); } catch { return 'Mint parse fail: ' + raw.slice(0, 400); }
  let modelContent = '';
  if (req.model) {
    try { modelContent = String((await env.DB.prepare('SELECT content FROM tap_go_model_profiles WHERE model=?').bind(req.model).first())?.content || ''); } catch {}
  }
  return formatOwnerTokenDrop(cap, { model: req.model, modelContent });
}

async function runStaffGrok(env, sender, chat, prompt, from) {
  try {
    const outChat = blooioOutChat(chat, from);
    if (isGrokBark(prompt)) {
      await sender(env, outChat, 'Woof woof.', null, { owner_inbound: isOwner(from) });
      return;
    }
    const tokenReq = isOwner(from) ? parseOwnerTokenRequest(prompt) : null;
    if (tokenReq) {
      const drop = await mintOwnerTokenDrop(env, tokenReq);
      // Token drops stay text (full URLs). No TTS of share tokens.
      await sender(env, outChat, drop, null, { owner_inbound: isOwner(from) });
      await logEvent(env, {
        source: 'blooio',
        key: 'CAP_MINT',
        action: tokenReq.error ? 'owner_token_mint_reject' : 'owner_token_mint',
        direction: 'out',
        request: { scope: tokenReq.scope, key: tokenReq.key || null, ttl: tokenReq.ttl, uses: tokenReq.uses, model: tokenReq.model || null },
        response: String(drop).slice(0, 400),
      });
      return;
    }
    const audioOn = isOwner(from) || (chat ? await audioModeOn(env, chat, from) : false);
    let reply = await fastBuildReply(env, prompt, chat, from);
    if (!reply || reply.startsWith('ERR:')) {
      reply = speakableFromReply(reply) || 'Got your message. Build hit an error — retry.';
    }
    if (reply.length > GROK_REPLY_MAX) {
      reply = reply.slice(0, GROK_REPLY_MAX) + '\n…[truncated]';
    }
    if (audioOn) {
      const audioScript = speakableFromReply(reply) || String(prompt || '').trim().slice(0, 1200);
      const sent = await sendGrokAudio(env, chat, audioScript, sender, reply, from);
      const raw = String((sent && sent.result) || sent || '');
      if (raw.includes('ERR:')) {
        await sender(env, outChat, '(audio failed: ' + raw.slice(0, 120) + ')', null, { owner_inbound: isOwner(from) });
      }
      return;
    }
    await sender(env, outChat, reply, null, { owner_inbound: isOwner(from) });
  } catch (e) {
    await sender(env, blooioOutChat(chat, from), 'ERR grok: ' + (e && e.message || String(e)), null, { owner_inbound: isOwner(from) });
  }
}

/** Staff reply-to-lead from ops group: SEND +15551234567 | message body */
function parseStaffLeadSend(text) {
  const m = String(text || '').match(/^SEND\s+(\+?\d[\d\s-]{9,})\s*\|\s*([\s\S]+)$/i);
  if (!m) return null;
  const phone = m[1].replace(/\s/g, '');
  const body = m[2].trim();
  if (!body) return null;
  return { phone: phone.startsWith('+') ? phone : '+' + phone.replace(/\D/g, ''), body };
}
const SENDERS = { blooio: sendBlooio, '2chat': send2chat, telegram: sendTelegram };

async function getGasForwardUrl(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'blooio_gas_forward_url'").first();
  return row?.value || '';
}

function normalizePhone(n) { return String(n || '').replace(/\D/g, ''); }
function traceId() { return 't_' + Math.random().toString(36).slice(2, 10); }
function idList(value) {
  return String(value || '').split(/[,\s|]+/).map(s => s.trim()).filter(Boolean);
}

async function attachTraceToEvent(env, id, trace) {
  if (!env?.LEDGER || !id || !trace) return;
  try {
    await env.LEDGER.prepare('UPDATE events SET trace_id = ? WHERE id = ?').bind(trace, id).run();
  } catch {}
}

async function ownerTelegramIds(env) {
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'owner_telegram_ids'").first();
    return idList(row?.value);
  } catch {
    return [];
  }
}

// Build-owned numbers (bot personas: Pepper, ButterCup). Bot-to-bot chat gets a tight
// per-chat cap so two builds talking cannot death-spiral; humans get a cap they won't hit.
const BUILD_NUMBERS = ['[BUILD_PHONE]', '12065711028'];
function isBuildNum(p) { const d = normalizePhone(p); return BUILD_NUMBERS.some(b => d.endsWith(b)); }
async function loopGuard(env, chat, from) {
  if (!env.KV) return true;
  const key = 'rl:' + String(chat || '').replace(/[^A-Za-z0-9]/g, '');
  const cap = isBuildNum(from) ? 4 : 15; // bot-to-bot dies after ~4 exchanges/min; humans effectively unlimited
  const now = Date.now();
  let arr = [];
  try { arr = JSON.parse((await env.KV.get(key)) || '[]'); } catch {}
  arr = arr.filter(t => now - t < 60000);
  if (arr.length >= cap) return false;
  arr.push(now);
  try { await env.KV.put(key, JSON.stringify(arr), { expirationTtl: 120 }); } catch {}
  return true;
}
function normToggle(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
async function modeSet(env, key, on) { if (!env.KV) return; try { if (on) await env.KV.put(key, '1'); else await env.KV.delete(key); } catch {} }

async function tgApi(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}),
  });
  return r.json().catch(() => ({}));
}
async function tgFileUrl(env, fileId) {
  const r = await tgApi(env, 'getFile', { file_id: fileId });
  const path = r && r.result && r.result.file_path;
  return path ? `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${path}` : '';
}

async function parseBlooio(env, request, raw) {
  const parsed = (() => { try { return JSON.parse(raw); } catch { return null; } })();
  if (!parsed) return { skip: true };

  if (parsed.action === 'save_gas_url') {
    const gasUrl = String(parsed.gas_url || '').trim();
    if (gasUrl) {
      const ts = new Date().toISOString();
      await env.DB.prepare(
        'INSERT OR REPLACE INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)'
      ).bind('blooio_gas_forward_url', gasUrl, 'GAS webhook URL for second Blooio number ([PHONE])', ts).run();
      await logEvent(env, {
        source: 'blooio', key: 'SAVE_GAS_URL', action: 'admin_write', direction: 'in',
        status: 200, request: { action: 'save_gas_url', gas_url: gasUrl }, response: { ok: true },
      });
    }
    return { admin: { ok: true } };
  }

  if (parsed.action === 'save_prompt') {
    const prompt = String(parsed.prompt || '').trim();
    if (prompt) {
      const ts = new Date().toISOString();
      await env.DB.prepare(
        'INSERT INTO directory (key, type, target, auth, content, updated_at) VALUES (?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at'
      ).bind('ROUTER', 'agent', 'grok-4.3', 'bearer:GROK_API_KEY', prompt, ts).run();
      if (env.KV) try { await env.KV.delete('directory:snapshot'); } catch {}
      await logEvent(env, {
        source: 'blooio', key: 'SAVE_PROMPT', action: 'admin_write', direction: 'in',
        status: 200, request: { action: 'save_prompt', key: 'ROUTER', prompt }, response: { ok: true },
      });
    }
    return { admin: { ok: true } };
  }
  // Blooio v4 envelope: substantive fields live under parsed.data
  // ({type:"message.received", data:{kind, text, sender, chat_id, ...}}).
  // Older flat payloads keep working via the top-level fallbacks below.
  const d = (parsed.data && typeof parsed.data === 'object') ? parsed.data : {};
  const event = String(parsed.event || parsed.type || d.kind || '').toLowerCase();

  if (event.includes('reaction')) {
    const rx = parseBlooioReaction(parsed);
    if (!rx) return { skip: true };
    const out = { ...rx, channel: 'blooio' };
    if (normalizePhone(rx.toNumber) === normalizePhone(BLOOIO_GAS_NUMBER)) out.agentKey = 'BLOOIO2';
    return out;
  }

  const isInbound = !event || event.includes('received') || event.includes('inbound') || event.includes('incoming');
  if (!isInbound) return { skip: true };
  if (d.direction && String(d.direction).toLowerCase() === 'outbound') return { skip: true };
  const from = parsed.external_id || parsed.from || parsed.sender || d.sender || (d.contact && d.contact.identifier) || '';
  const toNumber = parsed.internal_id || parsed.to || parsed.receiver || parsed.destination || parsed.channel_phone_number || d.recipient || d.channel_address || BLOOIO_FROM;
  const internal = parsed.internal_id || d.channel_address || BLOOIO_FROM;

  if (normalizePhone(from) === normalizePhone(internal)) return { skip: true }; // never reply to your own echo
  const messageBody = parsed.text || parsed.body || parsed.message || d.text || '';
  const messageId = parsed.message_id || d.message_id || parsed.id || '';
  const chat = parsed.chat_id || d.chat_id || parsed.external_id || from;
  const protocol = parsed.protocol || d.protocol || '';
  const isGroup = (parsed.is_group || d.is_group) ? 1 : 0;
  const attachments = Array.isArray(parsed.attachments) ? parsed.attachments
    : (Array.isArray(d.attachments) && d.attachments.length ? d.attachments
    : (parsed.media_url ? [{ url: parsed.media_url }] : []));
  const mediaUrls = attachments.map(a => a && (a.url || a.media_url)).filter(Boolean);
  if (!messageBody && !mediaUrls.length) return { skip: true };
  // Second Blooio number → BLOOIO2 agent (separate writer); otherwise ROUTER.
  const out = { from, chat, protocol, isGroup, messageBody, mediaUrls, channel: 'blooio', messageId, toNumber };
  if (normalizePhone(toNumber) === normalizePhone(BLOOIO_GAS_NUMBER)) out.agentKey = 'BLOOIO2';
  return out;
}

async function parse2chat(env, request, raw) {
  const parsed = (() => { try { return JSON.parse(raw); } catch { return null; } })();
  if (!parsed) return { skip: true };
  const msg = parsed.message || {};
  const from = parsed.participant?.phone_number || parsed.remote_phone_number || '';
  const channelNum = parsed.channel_phone_number || '';
  const text = msg.text || '';
  const group = parsed.group || null;
  const isGroup = group ? 1 : 0;
  const groupUuid = group?.uuid || '';
  const groupName = group?.wa_group_name || group?.name || '';
  const chat = group ? (groupUuid || group.wa_group_id) : (parsed.remote_phone_number || from);
  const media = msg.media ? [msg.media] : [];
  const mediaUrls = media.map(a => a && (a.url || a.media_url)).filter(Boolean);
  if (!from || (!text && !mediaUrls.length)) return { skip: true };
  if (normalizePhone(from) === normalizePhone(channelNum)) return { skip: true };
  const messageId = parsed.uuid || parsed.id || '';
  return {
    from, chat, protocol: 'whatsapp', isGroup, messageBody: text, mediaUrls, channel: '2chat',
    messageId: messageId ? '2chat:' + messageId : '',
    groupName, groupUuid, waGroupId: group?.wa_group_id || '',
  };
}

async function parseTelegram(env, request, raw) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (env.TELEGRAM_WEBHOOK_SECRET && secret !== String(env.TELEGRAM_WEBHOOK_SECRET) && !(await isBuildAuthed(request, env))) return { forbidden: true };
  const update = (() => { try { return JSON.parse(raw); } catch { return null; } })();
  if (!update) return { skip: true };
  const msg = update.message || update.edited_message;
  if (!msg) return { skip: true };
  if (msg.from && msg.from.is_bot) return { skip: true };
  const updateId = String(update.update_id || '');
  const mediaUrls = [];
  if (Array.isArray(msg.photo) && msg.photo.length) {
    const best = msg.photo[msg.photo.length - 1];
    const u = await tgFileUrl(env, best.file_id); if (u) mediaUrls.push(u);
  }
  if (msg.document && msg.document.file_id && /^image\//i.test(msg.document.mime_type || '')) {
    const u = await tgFileUrl(env, msg.document.file_id); if (u) mediaUrls.push(u);
  }
  if (msg.video && msg.video.file_id) {
    const u = await tgFileUrl(env, msg.video.file_id); if (u) mediaUrls.push(u);
  }
  const chat = String(msg.chat && msg.chat.id || '');
  const telegramId = String(msg.from && msg.from.id || '');
  const ownerTelegram = (await ownerTelegramIds(env)).includes(telegramId);
  const from = ownerTelegram ? OWNER : telegramId;
  const chatType = msg.chat && msg.chat.type || '';
  const isGroup = (chatType === 'group' || chatType === 'supergroup') ? 1 : 0;
  const messageBody = msg.text || msg.caption || '';
  const username = msg.from && msg.from.username ? '@' + msg.from.username : '';
  if (!messageBody && !mediaUrls.length) return { skip: true };
  return { from, chat, protocol: 'telegram', isGroup, messageBody, mediaUrls, channel: 'telegram', username, telegramId, owner: ownerTelegram, staff: ownerTelegram, messageId: updateId ? 'telegram:' + updateId : '' };
}

const PARSERS = { blooio: parseBlooio, '2chat': parse2chat, telegram: parseTelegram };

// True for ephemeral, payload-free indicator webhooks (typing/presence/read/delivery receipts).
function isNoiseWebhook(raw) {
  return /"(?:event|type)"\s*:\s*"[^"]*(?:typing|presence|\.delivered|\.read|read_receipt|delivery)/i.test(String(raw || ''));
}

function deliveryWebhook(raw) {
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { return null; }
  const event = String(parsed.event || parsed.type || '').toLowerCase();
  if (!event || event.includes('received') || event.includes('reaction')) return null;
  if (!/(sent|delivered|queued|read|read_receipt|delivery)/i.test(event)) return null;
  const messageId = parsed.message_id || parsed.id || parsed.message?.id || parsed.data?.message_id || parsed.data?.id || '';
  return {
    event,
    message_id: String(messageId || ''),
    status: String(parsed.status || parsed.delivery_status || event.split('.').pop() || ''),
    provider_ts: parsed.timestamp || parsed.ts || parsed.created_at || null,
    payload: parsed,
  };
}

async function reconcileDeliveryWebhook(env, channel, raw) {
  const d = deliveryWebhook(raw);
  if (!d) return false;
  const linked = [];
  const deliveryEventId = await logEvent(env, {
    source: channel,
    direction: 'IN',
    action: 'delivery.' + (d.status || d.event || 'event'),
    route: '/' + channel,
    request: raw,
    response: { message_id: d.message_id || null, event: d.event, status: d.status, linked_invocations: linked },
  });
  if (!env?.LEDGER || !d.message_id) return true;
  try {
    const rows = (await env.LEDGER.prepare(
      'SELECT id, invocation_json FROM invocations WHERE instr(invocation_json, ?) > 0 ORDER BY ts DESC LIMIT 10'
    ).bind(d.message_id).all()).results || [];
    for (const row of rows) {
      let inv = null;
      try { inv = JSON.parse(row.invocation_json || 'null'); } catch {}
      if (!inv) continue;
      inv.delivery = {
        channel,
        event: d.event,
        status: d.status,
        message_id: d.message_id,
        provider_ts: d.provider_ts,
        confirmed_at: new Date().toISOString(),
        event_id: deliveryEventId,
      };
      inv.links = inv.links || {};
      if (deliveryEventId) inv.links.delivery_event = 'https://miscsubjects.com/api/events/' + deliveryEventId;
      await env.LEDGER.prepare('UPDATE invocations SET invocation_json = ? WHERE id = ?')
        .bind(JSON.stringify(inv), row.id).run();
      linked.push(row.id);
    }
    if (deliveryEventId) {
      await env.LEDGER.prepare('UPDATE events SET response_json=?, response_preview=? WHERE id=?')
        .bind(JSON.stringify({ message_id: d.message_id, event: d.event, status: d.status, linked_invocations: linked }), JSON.stringify({ message_id: d.message_id, linked_invocations: linked }).slice(0, 500), deliveryEventId)
        .run();
    }
  } catch {}
  return true;
}

export async function processWebhook(context, channel) {
  const { request, env } = context;
  const bg = (p) => { try { context.waitUntil(p); } catch {} };
  const raw = await request.text();
  const deliveryHandled = await reconcileDeliveryWebhook(env, channel, raw);
  // Ephemeral indicator webhooks (typing/presence/read/delivery receipts) carry no payload
  // and otherwise flood EVENTS (~96% of rows). They are already discarded for routing by the
  // parsers; here we also stop logging them so EVENTS is a clean chronological log of real
  // payloads. Substantive inbound messages (event empty/received/inbound) are still logged.
  let webhookEventId = null;
  if (!deliveryHandled && !isNoiseWebhook(raw)) {
    webhookEventId = await logEvent(env, { source: channel, direction: 'IN', action: 'webhook_in', route: '/' + channel, request: raw });
  }
  const parser = PARSERS[channel];
  if (!parser) return new Response('unknown channel', { status: 400 });
  const m = await parser(env, request, raw);
  if (m.forbidden) return new Response('forbidden', { status: 403 });
  if (m.admin) return new Response(JSON.stringify(m.admin), { headers: { 'content-type': 'application/json' } });
  if (m.skip) return new Response(null, { status: 200 });
  m.trace = m.trace || traceId();
  await attachTraceToEvent(env, webhookEventId, m.trace);
  await logEvent(env, {
    source: channel,
    direction: 'IN',
    action: 'message_normalized',
    route: '/' + channel,
    trace_id: m.trace,
    request: JSON.stringify({
      from: m.from,
      chat: m.chat,
      protocol: m.protocol || channel,
      group: !!m.isGroup,
      message_id: m.messageId || '',
      media_count: Array.isArray(m.mediaUrls) ? m.mediaUrls.length : 0,
      text_preview: String(m.messageBody || '').slice(0, 500),
    }),
  });

  // Second Blooio number now routes to BLOOIO2 agent (see parseBlooio)
  // if (m.gasForward) { ... }  // REMOVED — BLOOIO2 agent handles it now

  if (isBuildNum(m.from)) return new Response(null, { status: 200 });

  // Self-test audit group: TEST prompts are injected by /api/selftest (ButterCup asks,
  // dispatch answers in-process, Pepper delivers). Never route those into ROUTER again.
  const AUDIT_GROUP = 'grp_d21e1ea99f8a4ea0';
  const isTestPrompt = /^TEST\s+\d+\s*\/\s*\d+\s*—/i.test(String(m.messageBody || ''));
  if (String(m.chat || '') === AUDIT_GROUP && isTestPrompt) {
    // Identity law: TEST questions must come from ButterCup ([PHONE]), never Pepper.
    if (normalizePhone(m.from).endsWith('[BUILD_PHONE]')) {
      await logEvent(env, { source: channel, direction: 'IN', action: 'selftest_identity_violation', route: '/' + channel,
        trace_id: m.trace,
        request: JSON.stringify({ from: m.from, chat: m.chat, preview: String(m.messageBody).slice(0, 200), law: 'Pepper must not send TEST questions' }) });
    }
    return new Response(null, { status: 200 });
  }
  if (String(m.chat || '') === AUDIT_GROUP && env.KV) {
    let autorunOff = false;
    try { autorunOff = (await env.KV.get('selftest_autorun')) !== '1'; } catch {}
    if (autorunOff) return new Response(null, { status: 200 });
    let lock = null;
    try { lock = JSON.parse((await env.KV.get('selftest:lock')) || 'null'); } catch {}
    if (lock && (Date.now() - (lock.ts || 0)) < 1500000) return new Response(null, { status: 200 });
  }

  // Register StatePep WhatsApp ops group UUID from first 2chat webhook.
  if (channel === '2chat' && m.isGroup && isStatePepGroupName(m.groupName) && m.groupUuid) {
    bg(saveMetaOps2chatGroup(env, m.groupUuid, m.waGroupId));
  }
  const ops2chatGroup = await getMetaOps2chatGroup(env);
  const ops2chatUuid = ops2chatGroup ? ops2chatGroup.split('|')[0] : null;

  // Meta lead funnel: forward inbound lead replies to ops groups — no auto-reply.
  const staff = !!m.staff || isMetaStaff(m.from);
  const owner = !!m.owner || isOwner(m.from);

  if (!staff && isMetaLeadInbound(m)) {
    const fwd = formatLeadForward(m);
    bg(sendBlooio(env, META_OPS_GROUP, fwd));
    if (ops2chatUuid) bg(send2chat(env, ops2chatUuid, fwd));
    bg(threadInboundMessage(env, m, { source: 'meta-lead', priority: 'P1', role: 'customer', title: `Lead ${m.from}` }));
    bg(fireMetaLeadCapi(env, m));
    await logEvent(env, {
      source: 'marketing',
      direction: 'IN',
      action: 'meta_lead_forward',
      route: '/' + channel,
      trace_id: m.trace,
      key: 'META_LEAD',
      request: JSON.stringify({ from: m.from, chat: m.chat, preview: String(m.messageBody).slice(0, 200) }),
    });
    return new Response(null, { status: 200 });
  }

  // Owner 1:1 inbound (life thread) — tasks ledger, not ops spam.
  if (owner && !m.isGroup && channel === 'blooio') {
    bg(threadInboundMessage(env, m, { source: 'owner-imessage', priority: 'P1', role: 'owner', title: String(m.messageBody || '').slice(0, 120) }));
  }

  if (owner) {
    const grokTask = parseGrokPrefix(m.messageBody);
    if (grokTask !== undefined) {
      const replyVia = SENDERS[channel] || sendBlooio;
      if (!grokTask) {
        bg(
          replyVia(
            env,
            m.chat,
            '/grok <task>\nRuns Grok coding agent on your Mac. Reply lands here.\nSEND +phone | text still relays to leads.',
            null,
            { owner_inbound: true },
          ),
        );
        return new Response(null, { status: 200 });
      }
      bg(replyVia(env, m.chat, '⏳ grok…', null, { owner_inbound: true }));
      bg(runStaffGrok(env, replyVia, m.chat, grokTask, m.from));
      await logEvent(env, {
        source: channel,
        direction: 'IN',
        action: 'grok_prefix',
        route: '/' + channel,
        trace_id: m.trace,
        request: JSON.stringify({
          from: m.from,
          chat: m.chat,
          preview: grokTask.slice(0, 200),
        }),
      });
      return new Response(null, { status: 200 });
    }
  }

  const inOps = isMetaOpsGroup(m.chat, { groupName: m.groupName, ops2chatGroup: ops2chatUuid });
  if (inOps && staff) {
    const relay = parseStaffLeadSend(m.messageBody);
    if (relay) {
      // Leads are on iMessage (Pepper); always deliver there.
      bg(sendBlooio(env, relay.phone, relay.body));
      const ack = `✓ Sent to ${relay.phone}`;
      const ackSender = SENDERS[channel] || sendBlooio;
      bg(ackSender(env, m.chat, ack));
      return new Response(null, { status: 200 });
    }
    // Ops groups: silent except SEND relay — no ROUTER auto-reply in the group.
    await logEvent(env, {
      source: channel,
      direction: 'IN',
      action: 'ops_group_silent',
      route: '/' + channel,
      trace_id: m.trace,
      request: JSON.stringify({ from: m.from, chat: m.chat, preview: String(m.messageBody).slice(0, 200) }),
    });
    return new Response(null, { status: 200 });
  } else if (!staff) {
    await logEvent(env, {
      source: channel,
      direction: 'IN',
      action: 'whitelist_drop',
      route: '/' + channel,
      trace_id: m.trace,
      request: JSON.stringify({ from: m.from, chat: m.chat, preview: String(m.messageBody).slice(0, 200) }),
    });
    return new Response(null, { status: 200 });
  }

  if (m.messageId) {
    try {
      const dedup = await env.DB.prepare(
        'INSERT OR IGNORE INTO blooio_dedup (message_id, created_at) VALUES (?, ?)'
      ).bind(m.messageId, new Date().toISOString()).run();
      if (dedup.meta.changes === 0) return new Response(null, { status: 200 });
    } catch {}
  }

  if (channel === 'blooio') {
    const p = normalizePhone(m.from);
    const isOwner = p.endsWith('[OWNER_PHONE]');
    const isOtherAI = p.endsWith('2065711028');
    if (!isOwner) {
      bg(sendBlooio(env, '[OWNER_PHONE]',
        `New text to the LEO line\nFrom: ${m.from}\nMessage: ${m.messageBody || '(no text)'}`));
    }
    if (!isOwner && !isOtherAI) {
      await logEvent(env, { source: channel, direction: 'IN', action: 'lead_no_reply', route: '/' + channel, request: JSON.stringify({ from: m.from, chat: m.chat, body: m.messageBody }) });
      return new Response(null, { status: 200 });
    }
  }

  const sender = SENDERS[channel] || sendBlooio;
  const pfx = sniffPrefix(m.messageBody, m.from);
  if (pfx) {
    bg(runDirectExec(env, sender, m.chat, String(m.messageBody).trim().slice(pfx.length), pfx));
    return new Response(null, { status: 200 });
  }

  if (channel === 'blooio') {
    const tg = normToggle(m.messageBody);
    if (tg === 'audio' || tg === 'audio on') {
      await audioModeSet(env, m.chat, m.from, true);
      bg(sendGrokAudio(env, m.chat, "Audio on. Voice note plus text carbon copy on every reply until you say audio off.", sendBlooio, "Audio on. Voice note plus text carbon copy on every reply until you say audio off.", m.from));
      return new Response(null, { status: 200 });
    }
    if (tg === 'audio off') {
      await audioModeSet(env, m.chat, m.from, false);
      bg(sendBlooio(env, m.chat, 'Audio mode off.', null, { owner_inbound: owner }));
      return new Response(null, { status: 200 });
    }
    if (tg === 'council on' || tg === 'council off') {
      const ckey = 'council:' + String(m.chat).replace(/[^A-Za-z0-9@._+-]/g, '');
      await modeSet(env, ckey, tg === 'council on');
      bg(sendBlooio(env, m.chat, tg === 'council on' ? 'Council on. Llama, Qwen, Gemini, Grok, GPT each weigh in (the ones with keys). Say "council off" to stop.' : 'Council off.', null, { owner_inbound: owner }));
      return new Response(null, { status: 200 });
    }
  }

  if (!(await loopGuard(env, m.chat, m.from))) {
    await logEvent(env, { source: channel, direction: 'IN', action: 'rate_drop', route: '/' + channel, trace_id: m.trace, request: JSON.stringify({ chat: m.chat, from: m.from }) });
    return new Response(null, { status: 200 });
  }

  // Owner 1:1 iMessage → the live ROUTER by default. /grok above remains the explicit
  // Mac coding-agent lane. Deterministic token mints stay here so the neutral Tap & Go
  // record is rendered byte-for-byte instead of being improvised by a model.
  // Direct owner turns are proof traffic and must not be gated by imessage_autorun.
  if (owner && !m.isGroup && channel === 'blooio') {
    const replyVia = SENDERS[channel] || sendBlooio;
    const tokenReq = parseOwnerTokenRequest(m.messageBody);
    if (tokenReq) {
      bg(runStaffGrok(env, replyVia, m.chat, String(m.messageBody || ''), m.from));
    } else {
      m.skipReflex = true;
      await routeInbound(env, bg, m);
    }
    await logEvent(env, {
      source: channel,
      direction: 'IN',
      action: tokenReq ? 'owner_token_request' : 'owner_router',
      route: '/' + channel,
      trace_id: m.trace,
      request: JSON.stringify({ from: m.from, chat: m.chat, preview: String(m.messageBody || '').slice(0, 200) }),
    });
    return new Response(null, { status: 200 });
  }

  await routeInbound(env, bg, m);
  return new Response(null, { status: 200 });
}
