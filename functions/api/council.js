// /api/council — the model group chat. Several models reply to one message, each one
// seeing what the models before it said, so they build on each other and ask the owner
// questions. Grounded in the Loop rules. CF models run with no key; gemini/grok/openai
// join when their key is set. Wired into the Blooio group via a per-chat "council on" flag.
import { sendBlooio } from '../blooio.js';
import { planList } from './plan.js';
import { logRun } from './runs/[[path]].js';

const RULES = 'You are one of several AI models in a group chat with the owner, building Loop, a peptide education site. The other models are here too. Help make the peptide content accurate, clear, and genuinely fascinating, and bounce ideas with the owner and the other models. HARD RULES: never use treats, cures, prevents, reverses, fixes, heals, replaces, "safe alternative", "natural alternative", "clinically proven", or synthetic. Frame everything as: a drug or condition wears down a specific tissue; a peptide has published research on that same tissue; the reader connects it. Always label evidence as animal vs human. Plain words; define any jargon in plain words first. Be brief — 2 to 5 sentences, this is a group chat. End by either asking the owner one sharp question or building on what another model said. Do not sign your name; the chat labels you.';

const SHORT = { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': 'Llama', '@cf/qwen/qwen2.5-coder-32b-instruct': 'Qwen', '@cf/mistralai/mistral-small-3.1-24b-instruct': 'Mistral', 'gemini:gemini-1.5-flash': 'Gemini', 'grok:grok-4': 'Grok', 'openai:gpt-4o-mini': 'GPT' };
function shortName(m) { return SHORT[m] || m.split(/[:/]/).pop(); }

async function callModel(env, model, system, user) {
  if (model.startsWith('@cf/')) {
    const r = await env.AI.run(model, { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 300 });
    const v = r && (r.response ?? r.result ?? ''); return typeof v === 'string' ? v : (v ? JSON.stringify(v) : '');
  }
  const [prov, ...rest] = model.split(':'); const id = rest.join(':');
  if (prov === 'gemini') {
    if (!env.GEMINI_API_KEY) return '[skip: no key]';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent?key=${env.GEMINI_API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }] }) });
    const j = await res.json(); if (!res.ok) return '[skip: gemini ' + res.status + ']';
    return j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  const cfg = { grok: { url: 'https://api.x.ai/v1/chat/completions', key: env.GROK_API_KEY, m: id || 'grok-2-latest' }, openai: { url: 'https://api.openai.com/v1/chat/completions', key: env.OPENAI_API_KEY, m: id || 'gpt-4o-mini' } }[prov];
  if (!cfg) return '[skip: unknown ' + prov + ']';
  if (!cfg.key) return '[skip: no key]';
  const res = await fetch(cfg.url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key }, body: JSON.stringify({ model: cfg.m, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
  const j = await res.json().catch(() => ({})); if (!res.ok) return '[skip: ' + prov + ' ' + res.status + ']';
  return j?.choices?.[0]?.message?.content || '';
}

export async function runCouncil(env, chat, message, send, models) {
  const panel = (models && models.length) ? models : ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/qwen/qwen2.5-coder-32b-instruct', 'gemini:gemini-1.5-flash', 'grok:grok-4', 'openai:gpt-4o-mini'];
  let planCtx = '';
  try { const items = await planList(env); const open = items.filter(i => i.status !== 'done').slice(0, 12); if (open.length) planCtx = "the owner's live task board (help him plan/verify against it):\n" + open.map(i => `- [${i.lane}] ${i.text}`).join('\n') + '\n\n'; } catch {}
  const replies = [];
  for (const model of panel) {
    const heard = replies.filter(r => !r.text.startsWith('[skip')).map(r => `${r.name}: ${r.text}`).join('\n');
    const user = planCtx + (heard ? 'What the other models said so far:\n' + heard + '\n\n' : '') + 'the owner says: ' + message;
    let text = '';
    try { text = String(await callModel(env, model, RULES, user)).trim(); } catch (e) { text = '[skip: ' + e.message + ']'; }
    const name = shortName(model);
    replies.push({ model, name, text });
    if (send && chat && text && !text.startsWith('[skip')) { try { await sendBlooio(env, chat, `[${name}] ${text}`); } catch {} }
  }
  try { await logRun(env, { type: 'council', request: String(message).slice(0, 200), model: 'panel', output: replies.filter(r => !r.text.startsWith('[skip')).map(r => r.name + ': ' + r.text).join('\n\n'), status: 'done' }); } catch {}
  return replies;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const b = await request.json().catch(() => ({}));
  if (!b.message) return new Response(JSON.stringify({ error: 'message required' }), { status: 400, headers: { 'content-type': 'application/json' } });
  const replies = await runCouncil(env, b.chat || null, b.message, !!b.send && !!b.chat, b.models);
  return new Response(JSON.stringify({ chat: b.chat || null, replies }), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}
