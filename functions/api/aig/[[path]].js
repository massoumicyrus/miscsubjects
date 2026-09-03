// Anthropic Messages API -> Cloudflare AI Gateway.
//
// Claude Code speaks exactly one wire protocol: POST /v1/messages in Anthropic's format.
// This endpoint answers that protocol and forwards every call to the single account AI
// Gateway (cloud-kernel), so the model behind the CLI can be Kimi, GLM, Grok, GPT or
// Claude while authentication, logging, caching and billing all stay on Cloudflare.
//
// Use it by pointing the CLI at this route:
//   export ANTHROPIC_BASE_URL="https://miscsubjects.com/api/aig/<TERMINAL_KEY>"
//   export ANTHROPIC_AUTH_TOKEN="<TERMINAL_KEY>"
//   export ANTHROPIC_MODEL="kimi"
//
// Two lanes, both on the account's AI REST surface so one credential and one gateway
// cover everything:
//   0. /v1/chat/completions -> passed through untranslated (misc and any OpenAI-shaped client).
//   1. anthropic/* -> POST /ai/v1/messages, Anthropic own schema, body passed through.
//   2. everything else -> POST /ai/v1/chat/completions, translated in both directions.
//
// The account API token is the only credential. Workers AI models (@cf/...) bill as
// Workers AI; catalogue models (moonshotai/, xai/, anthropic/, openai/) bill through
// Unified Billing credits, so no provider key is needed for either.

import { logEvent } from '../../_lib/event_log.js';

const GATEWAY = 'default'; // the authenticated gateway; override with AIG_GATEWAY_ID

// Short names the CLI can put in ANTHROPIC_MODEL. Every id verified live against this
// account's catalogue on 2026-07-25.
const ALIASES = {
  kimi: '@cf/moonshotai/kimi-k2.7-code',
  'kimi-k2.7-code': '@cf/moonshotai/kimi-k2.7-code',
  'kimi-k2.6': '@cf/moonshotai/kimi-k2.6',
  'kimi-k3': 'moonshotai/kimi-k3',
  glm: '@cf/zai-org/glm-5.2',
  'glm-5.2': '@cf/zai-org/glm-5.2',
  'glm-flash': '@cf/zai-org/glm-4.7-flash',
  grok: 'xai/grok-4.5',
  gpt: 'openai/gpt-5.5',
  minimax: 'minimax/m3',
  opus5: 'anthropic/claude-opus-5',
  sonnet5: 'anthropic/claude-sonnet-5',
};

// The CLI fills four model slots. Anything that still looks like a Claude id after alias
// resolution is a slot the operator did not set; send it to the default model instead of
// silently calling Anthropic.
// The desktop client rejects model names that don't look Anthropic-shaped, so keyword
// matching is what makes "claude-kimi" or "claude-sonnet-glm" usable as a picker entry.
async function resolveModel(raw, env) {
  const asked = String(raw || '').trim();
  const fallback = env.AIG_DEFAULT_MODEL || ALIASES.kimi;
  if (!asked) return fallback;
  if (ALIASES[asked]) return ALIASES[asked];
  if (asked.startsWith('@cf/') || asked.includes('/')) return asked;
  // A published id from the live catalogue that this isolate has not seen yet: match it
  // back to the real model by slug rather than dropping the caller onto the default.
  if (/^claude-/.test(asked)) {
    const live = await liveCatalogue(env);
    const hit = live && live.find(([id]) => id === asked);
    if (hit) { ALIASES[asked] = hit[1]; return hit[1]; }
  }
  const low = asked.toLowerCase();
  if (low.includes('kimi')) return ALIASES.kimi;
  if (low.includes('glm')) return ALIASES.glm;
  if (low.includes('grok')) return ALIASES.grok;
  if (low.includes('gpt')) return ALIASES.gpt;
  return fallback;
}

// The client's model discovery drops any id that does not start with claude/anthropic, so
// every alias is also published under a Claude-shaped name. One table drives both the
// alias map and the published list: a published id can never resolve to another model.
const CATALOGUE = [
  ['claude-kimi-k2.7-code', '@cf/moonshotai/kimi-k2.7-code', 'Kimi K2.7 Code (Workers AI, 262k)'],
  ['claude-kimi-k2.6', '@cf/moonshotai/kimi-k2.6', 'Kimi K2.6 (Workers AI, 262k)'],
  ['claude-kimi-k3', 'moonshotai/kimi-k3', 'Kimi K3 (catalogue, 1M)'],
  ['claude-glm-5.2', '@cf/zai-org/glm-5.2', 'GLM-5.2 (Workers AI, 262k)'],
  ['claude-glm-flash', '@cf/zai-org/glm-4.7-flash', 'GLM-4.7 Flash (Workers AI, cheapest)'],
  ['claude-grok-4.5', 'xai/grok-4.5', 'Grok 4.5 (catalogue)'],
  ['claude-minimax-m3', 'minimax/m3', 'MiniMax M3 (catalogue)'],
  ['claude-opus-native', 'anthropic/claude-opus-5', 'Claude Opus 5 — ANTHROPIC RATES, opt-in only'],
  ['claude-sonnet-native', 'anthropic/claude-sonnet-5', 'Claude Sonnet 5 — ANTHROPIC RATES, opt-in only'],
];

for (const [id, target] of CATALOGUE) ALIASES[id] = target;

// Slot names that pass every client-side model-name check, including the desktop app's
// allowlist and the Agent SDK's. They are real Anthropic ids used as labels for the slots;
// what actually runs is on the right. Documented so nobody mistakes the label for the model.
ALIASES['claude-opus-5'] = '@cf/moonshotai/kimi-k2.7-code';
ALIASES['claude-sonnet-5'] = '@cf/moonshotai/kimi-k2.7-code';
ALIASES['claude-sonnet-4-5'] = '@cf/moonshotai/kimi-k2.7-code';
ALIASES['claude-haiku-4-5'] = '@cf/zai-org/glm-4.7-flash';

// The hand-kept table above is the floor, not the ceiling: the account's whole text
// catalogue is published too, each id slugged Claude-shaped so the client keeps it, and
// registered in ALIASES so the published id resolves back to the real model. Live list
// first, static table if the upstream call fails, so discovery never returns nothing.
function slugFor(id) {
  const slug = String(id)
    .replace(/^@cf\//, '')
    .replace(/[^A-Za-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return 'claude-' + slug;
}

const TEXT_TASKS = /text-generation|chat/i;

// The compat endpoint answers with every model the gateway can address, most of which
// need a provider key this account does not hold. Keep the providers that bill straight
// through Workers AI or Unified Billing, and keep only the chat models: the picker is a
// list a person reads, not a dump of 2,400 ids.
// Unified Billing pays for these without a provider key of your own; Workers AI models
// bill as Workers AI. Everything else on the gateway needs a key this account does not
// hold, so publishing it would be publishing a 401.
const PROVIDER_ALLOW = /^(workers-ai|@cf|anthropic|openai|xai|grok|google-ai-studio|google-vertex-ai|deepseek|moonshotai|zai-org|minimax)\b/i;
const NOT_CHAT = /embed|rerank|whisper|tts|speech|image|img|video|vision-only|guard|moderation|classif|translat|upscal|diffusion|flux|lyria|veo|imagen|sdxl|stable-|melo|bge|resnet|detr|m2m|nomic|ideogram|recraft|krea|elevenlabs/i;

// Three places list models and none of them lists all of them: the gateway's compat
// endpoint carries the partner catalogue (DeepSeek, Qwen, Llama), the account AI surface
// carries the Anthropic-shaped lane, and Workers AI search carries the @cf/ models. Read
// all three, keep whatever answers.
function catalogueSources(env) {
  const acct = env.CF_ACCOUNT_ID;
  const gw = env.AIG_GATEWAY_ID || GATEWAY;
  return [
    `https://gateway.ai.cloudflare.com/v1/${acct}/${gw}/compat/models?limit=1000`,
    aiBase(env) + '/v1/models?limit=1000',
    `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/models/search?per_page=500`,
  ];
}

async function liveCatalogue(env, report) {
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!token || !env.CF_ACCOUNT_ID) return null;
  const rows = [];
  const seen = new Set();
  for (const url of catalogueSources(env)) {
    let note = 'ok';
    try {
      const r = await fetch(url, {
        headers: {
          authorization: 'Bearer ' + token,
          ...(env.AIG_RUN_TOKEN ? { 'cf-aig-authorization': 'Bearer ' + env.AIG_RUN_TOKEN } : {}),
          'anthropic-version': '2023-06-01',
        },
      });
      if (!r.ok) { note = 'http ' + r.status; }
      else {
        const j = await r.json();
        const list = Array.isArray(j.data) ? j.data : Array.isArray(j.result) ? j.result : [];
        let added = 0;
        let priced = 0;
        for (const m of list) {
          const real = m.id || m.name;
          if (!real) continue;
          const taskName = m.task && m.task.name;
          if (taskName && !TEXT_TASKS.test(taskName)) continue;
          if (!PROVIDER_ALLOW.test(String(real))) continue;
          if (NOT_CHAT.test(String(real))) continue;
          const id = slugFor(real);
          // Workers AI publishes unit prices on the model record; carry them through so a
          // client can show real money instead of guessing at a rate card.
          let price = null;
          for (const pr of m.properties || []) {
            if (pr.property_id === 'price' && Array.isArray(pr.value)) {
              for (const v of pr.value) {
                const per = Number(v.price);
                if (!isFinite(per)) continue;
                if (/input/i.test(v.unit || '')) price = { ...(price || {}), in: per };
                else if (/output/i.test(v.unit || '')) price = { ...(price || {}), out: per };
              }
            }
          }
          // A model already seen from an earlier source is not a duplicate to drop: the
          // later source may be the one carrying its price.
          if (seen.has(id)) {
            if (price) {
              const existing = rows.find((r) => r[0] === id);
              if (existing && !existing[3]) { existing[3] = price; priced++; }
            }
            continue;
          }
          seen.add(id);
          rows.push([id, real, m.display_name || m.description || real, price]);
          added++;
        }
        note = `ok ${added} new, ${priced} priced, ${list.length} seen`;
      }
    } catch (e) { note = 'err ' + (e && e.message || e); }
    if (report) report.push({ url, note });
  }
  return rows.length ? rows : null;
}

async function modelCatalogue(env, report) {
  const live = await liveCatalogue(env, report);
  const rows = [...CATALOGUE];
  if (live) {
    const have = new Set(rows.map(([id]) => id));
    for (const row of live) if (!have.has(row[0])) { rows.push(row); have.add(row[0]); }
  }
  for (const [id, target] of rows) if (!ALIASES[id]) ALIASES[id] = target;
  return {
    // id stays Claude-shaped because the desktop client drops anything else. raw_id is the
    // model's actual name, for clients that have no such restriction and would rather not
    // read "claude-glm" on their own screen.
    data: rows.map(([id, real, name, price]) => ({
      type: 'model', id, raw_id: real, display_name: name, created_at: '2026-07-25T00:00:00Z',
      ...(price ? { pricing: price } : {}),
    })),
    has_more: false,
    first_id: rows[0][0],
    last_id: rows[rows.length - 1][0],
  };
}

function aiBase(env) {
  return 'https://api.cloudflare.com/client/v4/accounts/' + env.CF_ACCOUNT_ID + '/ai';
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function apiError(message, status = 400, type = 'invalid_request_error') {
  return json({ type: 'error', error: { type, message } }, status);
}

// ---------------------------------------------------------------- request translation

function textOf(block) {
  if (typeof block === 'string') return block;
  if (block && typeof block.text === 'string') return block.text;
  return '';
}

// The CLI puts a per-request attribution line at the very front of the system prompt.
// Forwarding it moves the cache key on every call, so upstream prefix caches never hit.
// Dropping it is what makes Workers AI cached-input pricing actually apply.
function isAttributionBlock(block) {
  return /^\s*x-anthropic-billing-header:/i.test(textOf(block));
}

function systemText(system) {
  if (!system) return '';
  if (typeof system === 'string') return system;
  if (Array.isArray(system)) {
    return system.filter((b) => !isAttributionBlock(b)).map(textOf).filter(Boolean).join('\n\n');
  }
  return '';
}

function stringifyToolResult(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = content.map((b) => {
      if (typeof b === 'string') return b;
      if (b && b.type === 'text') return b.text || '';
      if (b && b.type === 'image') return '[image omitted]';
      return JSON.stringify(b);
    });
    return parts.filter(Boolean).join('\n');
  }
  if (content == null) return '';
  return JSON.stringify(content);
}

// Anthropic messages -> OpenAI chat messages. Tool results become role:"tool" turns and
// must be emitted before any remaining user text so they follow their assistant call.
function toOpenAIMessages(body) {
  const out = [];
  const sys = systemText(body.system);
  if (sys) out.push({ role: 'system', content: sys });

  for (const msg of body.messages || []) {
    const content = msg.content;
    if (typeof content === 'string') {
      out.push({ role: msg.role, content });
      continue;
    }
    if (!Array.isArray(content)) continue;

    if (msg.role === 'assistant') {
      let text = '';
      const toolCalls = [];
      for (const b of content) {
        if (!b) continue;
        if (b.type === 'text') text += b.text || '';
        else if (b.type === 'tool_use') {
          toolCalls.push({
            id: b.id,
            type: 'function',
            function: { name: b.name, arguments: JSON.stringify(b.input == null ? {} : b.input) },
          });
        }
        // thinking / redacted_thinking blocks carry no cross-provider meaning: dropped.
      }
      // Empty string, not null: MiniMax M3 rejects a null assistant content outright
      // ("Invalid value at messages[N].content") on the turn that carries only tool calls.
      const m = { role: 'assistant', content: text || '' };
      if (toolCalls.length) m.tool_calls = toolCalls;
      out.push(m);
      continue;
    }

    // user turn: tool results first, then whatever the human/harness said. Images become
    // OpenAI image_url parts -- Kimi K2.7 Code and GLM both accept vision input, so a
    // screenshot pasted into the CLI reaches the model instead of being dropped.
    const userParts = [];
    for (const b of content) {
      if (!b) continue;
      if (b.type === 'tool_result') {
        out.push({
          role: 'tool',
          tool_call_id: b.tool_use_id,
          content: stringifyToolResult(b.content) || '(no output)',
        });
      } else if (b.type === 'text') {
        if (b.text) userParts.push({ type: 'text', text: b.text });
      } else if (b.type === 'image') {
        const src = b.source || {};
        if (src.type === 'base64' && src.data) {
          userParts.push({ type: 'image_url', image_url: { url: 'data:' + (src.media_type || 'image/png') + ';base64,' + src.data } });
        } else if (src.type === 'url' && src.url) {
          userParts.push({ type: 'image_url', image_url: { url: src.url } });
        }
      }
    }
    if (userParts.length) {
      const onlyText = userParts.every((p) => p.type === 'text');
      out.push({ role: 'user', content: onlyText ? userParts.map((p) => p.text).join('\n') : userParts });
    }
  }
  return out;
}

function toOpenAITools(tools) {
  if (!Array.isArray(tools) || !tools.length) return undefined;
  const out = [];
  for (const t of tools) {
    if (!t || !t.name) continue;
    // Server-side Anthropic tools (web_search, text_editor, bash) have no schema and no
    // meaning off-platform. Skipping them keeps the request valid instead of half-valid.
    if (!t.input_schema && t.type) continue;
    out.push({
      type: 'function',
      function: {
        name: t.name,
        description: String(t.description || '').slice(0, 4000),
        parameters: t.input_schema || { type: 'object', properties: {} },
      },
    });
  }
  return out.length ? out : undefined;
}

function toOpenAIToolChoice(tc) {
  if (!tc) return undefined;
  if (tc.type === 'auto') return 'auto';
  if (tc.type === 'any') return 'required';
  if (tc.type === 'none') return 'none';
  if (tc.type === 'tool' && tc.name) return { type: 'function', function: { name: tc.name } };
  return undefined;
}

// OpenAI's reasoning models reject max_tokens outright: "Unsupported parameter:
// 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead."
// Measured 2026-07-26 on openai/gpt-5.5, gpt-5.2 and every gpt-5.x that is not -batch.
// They also reject a non-default temperature, so it is dropped rather than forwarded.
function needsMaxCompletionTokens(model) {
  return /(^|\/)(?:openai\/)?(?:o[134]|gpt-5)/i.test(String(model || ''));
}

function buildCompatBody(body, model) {
  const out = {
    model,
    messages: toOpenAIMessages(body),
    stream: !!body.stream,
  };
  const maxTokens = Number(body.max_tokens) || 4096;
  if (needsMaxCompletionTokens(model)) out.max_completion_tokens = Math.min(maxTokens, 16384);
  else out.max_tokens = Math.min(maxTokens, 16384);
  if (typeof body.temperature === 'number' && !needsMaxCompletionTokens(model)) out.temperature = body.temperature;
  if (Array.isArray(body.stop_sequences) && body.stop_sequences.length) out.stop = body.stop_sequences.slice(0, 4);
  const tools = toOpenAITools(body.tools);
  if (tools) {
    out.tools = tools;
    const choice = toOpenAIToolChoice(body.tool_choice);
    if (choice) out.tool_choice = choice;
  }
  if (out.stream) out.stream_options = { include_usage: true };
  return out;
}

const STOP_MAP = { stop: 'end_turn', length: 'max_tokens', tool_calls: 'tool_use', function_call: 'tool_use', content_filter: 'end_turn' };

// ---------------------------------------------------------------- response translation

function toAnthropicMessage(oai, model) {
  const choice = (oai.choices && oai.choices[0]) || {};
  const msg = choice.message || {};
  const content = [];
  // Kimi and GLM spend max_tokens on reasoning_content first. When the budget runs out
  // before any answer text, falling back to the reasoning keeps the turn non-empty --
  // an empty assistant turn makes the CLI abort with "no visible output".
  if (msg.content) content.push({ type: 'text', text: String(msg.content) });
  else if (msg.reasoning_content) content.push({ type: 'text', text: String(msg.reasoning_content) });
  for (const call of msg.tool_calls || []) {
    let input = {};
    try { input = JSON.parse(call.function?.arguments || '{}'); } catch { input = {}; }
    content.push({ type: 'tool_use', id: call.id || ('toolu_' + Math.random().toString(36).slice(2)), name: call.function?.name || 'unknown', input });
  }
  if (!content.length) content.push({ type: 'text', text: '' });
  const usage = oai.usage || {};
  return {
    id: oai.id || 'msg_aig',
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: STOP_MAP[choice.finish_reason] || 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: usage.prompt_tokens || 0,
      output_tokens: usage.completion_tokens || 0,
      cache_read_input_tokens: usage.prompt_tokens_details?.cached_tokens || 0,
      cache_creation_input_tokens: 0,
    },
  };
}

// OpenAI SSE deltas -> the Anthropic event sequence the CLI's parser expects.
function streamTranslate(upstream, model) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let blockIndex = -1;
  let openBlock = null; // 'text' | 'tool'
  const toolSlots = new Map(); // openai tool index -> anthropic block index
  let stopReason = 'end_turn';
  let usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 };
  let sawText = false;
  let sawTool = false;
  let buffer = '';
  let reasoning = '';

  return new ReadableStream({
    async start(controller) {
      const send = (event, data) => {
        controller.enqueue(enc.encode('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n'));
      };
      const closeBlock = () => {
        if (openBlock !== null) {
          send('content_block_stop', { type: 'content_block_stop', index: blockIndex });
          openBlock = null;
        }
      };

      send('message_start', {
        type: 'message_start',
        message: {
          id: 'msg_aig', type: 'message', role: 'assistant', model,
          content: [], stop_reason: null, stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      });

      const reader = upstream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += dec.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            let chunk;
            try { chunk = JSON.parse(payload); } catch { continue; }
            if (chunk.usage) {
              usage = {
                input_tokens: chunk.usage.prompt_tokens || usage.input_tokens,
                output_tokens: chunk.usage.completion_tokens || usage.output_tokens,
                // Cached prompt tokens bill at a fraction of the fresh rate. Dropping them
                // here made every client price a cached turn as if it were all fresh —
                // roughly 5x over on a long session (owner-reported, 2026-07-26).
                cache_read_input_tokens: chunk.usage.prompt_tokens_details?.cached_tokens
                  ?? chunk.usage.cached_tokens ?? usage.cache_read_input_tokens,
              };
            }
            const choice = (chunk.choices && chunk.choices[0]) || null;
            if (!choice) continue;
            const delta = choice.delta || {};

            // Reasoning models emit their thinking on a separate field. Forwarding it as
            // a thinking block is what lets a client show work in progress rather than a
            // silent gap before the answer.
            const thought = delta.reasoning_content ?? delta.reasoning;
            if (typeof thought === 'string' && thought.length) {
              if (openBlock !== 'thinking') {
                closeBlock();
                blockIndex += 1;
                openBlock = 'thinking';
                send('content_block_start', { type: 'content_block_start', index: blockIndex, content_block: { type: 'thinking', thinking: '' } });
              }
              send('content_block_delta', { type: 'content_block_delta', index: blockIndex, delta: { type: 'thinking_delta', thinking: thought } });
            }

            if (typeof delta.content === 'string' && delta.content.length) {
              if (openBlock !== 'text') {
                closeBlock();
                blockIndex += 1;
                openBlock = 'text';
                send('content_block_start', { type: 'content_block_start', index: blockIndex, content_block: { type: 'text', text: '' } });
              }
              sawText = true;
              send('content_block_delta', { type: 'content_block_delta', index: blockIndex, delta: { type: 'text_delta', text: delta.content } });
            }

            if ((delta.tool_calls || []).length) sawTool = true;
            for (const call of delta.tool_calls || []) {
              const slot = call.index == null ? 0 : call.index;
              if (!toolSlots.has(slot)) {
                closeBlock();
                blockIndex += 1;
                toolSlots.set(slot, blockIndex);
                openBlock = 'tool';
                send('content_block_start', {
                  type: 'content_block_start', index: blockIndex,
                  content_block: { type: 'tool_use', id: call.id || ('toolu_' + slot + '_' + Math.random().toString(36).slice(2)), name: call.function?.name || 'unknown', input: {} },
                });
              }
              const args = call.function?.arguments;
              if (args) {
                send('content_block_delta', { type: 'content_block_delta', index: toolSlots.get(slot), delta: { type: 'input_json_delta', partial_json: args } });
              }
            }

            if (typeof delta.reasoning_content === 'string') reasoning += delta.reasoning_content;
            if (choice.finish_reason) stopReason = STOP_MAP[choice.finish_reason] || 'end_turn';
          }
        }
      } catch (e) {
        send('error', { type: 'error', error: { type: 'api_error', message: String(e && e.message || e) } });
      }

      // A turn that produced only reasoning and no answer reads to the operator as the
      // agent ignoring them. If nothing addressed to the user came back, hand over the
      // reasoning rather than an empty message.
      if (!sawText && !sawTool) {
        closeBlock();
        blockIndex += 1;
        send('content_block_start', { type: 'content_block_start', index: blockIndex, content_block: { type: 'text', text: '' } });
        send('content_block_delta', { type: 'content_block_delta', index: blockIndex, delta: { type: 'text_delta', text: reasoning || '(the model returned no answer)' } });
        openBlock = 'text';
      }
      closeBlock();
      send('message_delta', { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, cache_read_input_tokens: usage.cache_read_input_tokens || 0, cache_creation_input_tokens: 0 } });
      send('message_stop', { type: 'message_stop' });
      controller.close();
    },
  });
}

// ---------------------------------------------------------------- routing

function authorized(env, request, url) {
  const keys = [env.TERMINAL_KEY, env.AIG_SHIM_TOKEN].filter(Boolean);
  if (!keys.length) return false;
  const header = (request.headers.get('x-api-key') || '').trim();
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const seg = url.pathname.split('/').filter(Boolean); // api, aig, <token?>, v1, messages
  const pathToken = seg[2] && seg[2] !== 'v1' ? decodeURIComponent(seg[2]) : '';
  return keys.some((k) => k === header || k === bearer || k === pathToken);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/aig/, '');
  const tail = path.replace(/^\/[^/]*(?=\/v1\/)/, ''); // strip an optional token segment

  // Nothing here answers without the token, including the discovery list: an unauthenticated
  // reader should not learn which models this account routes or that the route exists.
  if (!authorized(env, request, url)) return apiError('unauthorized', 401, 'authentication_error');

  // Spend for a calendar day, computed from the gateway's own logs. Clients cannot page
  // the Cloudflare API themselves (no account token, and dispatch clips long bodies), so
  // the number the footer shows comes from here — the same figure Cloudflare bills.
  if (/\/spend/.test(tail)) {
    const token = env.CLOUDFLARE_API_TOKEN;
    if (!token) return apiError('CLOUDFLARE_API_TOKEN missing', 500, 'api_error');
    const account = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;
    const day = new URL(request.url).searchParams.get('day')
      || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    const gw = env.AIG_GATEWAY_ID || GATEWAY;
    let total = 0, calls = 0, page = 1;
    const byModel = {};
    while (page <= 60) {
      const url = `https://api.cloudflare.com/client/v4/accounts/${account}/ai-gateway/gateways/${gw}/logs?per_page=50&page=${page}`;
      const r = await fetch(url, { headers: { authorization: 'Bearer ' + token } });
      if (!r.ok) break;
      const j = await r.json().catch(() => null);
      const rows = (j && j.result) || [];
      if (!rows.length) break;
      let past = false;
      for (const row of rows) {
        const d = new Date(row.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
        if (d === day) {
          const c = Number(row.cost || 0);
          total += c; calls += 1;
          byModel[row.model] = (byModel[row.model] || 0) + c;
        } else if (d < day) past = true;
      }
      if (past || rows.length < 50) break;
      page += 1;
    }
    return json({ day, usd: Number(total.toFixed(8)), calls, by_model: byModel });
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    if (/\/v1\/models/.test(tail)) {
      if (url.searchParams.get('debug') === '1') {
        const report = [];
        const cat = await modelCatalogue(env, report);
        return json({ sources: report, count: cat.data.length, data: cat.data });
      }
      return json(await modelCatalogue(env));
    }
    return json({
      ok: true,
      endpoint: 'anthropic-messages -> cloudflare ai gateway (' + GATEWAY + ')',
      models: Object.keys(ALIASES),
      usage: 'ANTHROPIC_BASE_URL=https://miscsubjects.com/api/aig/<token>',
    });
  }
  if (request.method !== 'POST') return apiError('POST only', 405);
  if (!env.CF_ACCOUNT_ID) return apiError('CF_ACCOUNT_ID missing', 500, 'api_error');

  let body;
  try { body = await request.json(); } catch { return apiError('body must be JSON'); }

  if (/count_tokens/.test(tail)) {
    // Optional endpoint: without it the client estimates locally. A cheap character-based
    // count over the parts that actually cost tokens beats a 404 and beats counting the
    // JSON envelope, which inflates by roughly a third on a tool-heavy request.
    let chars = systemText(body.system).length;
    for (const m of toOpenAIMessages(body)) {
      chars += typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content || '').length;
      if (m.tool_calls) chars += JSON.stringify(m.tool_calls).length;
    }
    for (const t of toOpenAITools(body.tools) || []) chars += JSON.stringify(t).length;
    return json({ input_tokens: Math.ceil(chars / 3.7) });
  }

  // Model discovery: the client asks GET/POST /v1/models with a 3-second timeout and
  // ignores every id that does not begin with claude or anthropic, so the aliases are
  // published Claude-shaped. Turn it on with CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1.
  if (/\/v1\/models/.test(tail)) return json(await modelCatalogue(env));

  // LANE 0: NATIVE OPENAI CHAT COMPLETIONS, NO TRANSLATION IN EITHER DIRECTION.
  //
  // Everything else in this file exists for one reason: Claude Code speaks only Anthropic's
  // /v1/messages, so a client that cannot be changed gets a translation layer. misc is not
  // Claude Code. It is a client in this repository that can speak whatever we want, and it
  // inherited an Anthropic wire format built for a different consumer — so every misc call
  // was translated Anthropic -> OpenAI on the way out and OpenAI -> Anthropic SSE on the way
  // back, twice per step, for no benefit. The upstream was always chat completions anyway.
  //
  // What the round trip silently cost misc, all of it verified in this file:
  //   - max_tokens clamped to 16,384 by buildCompatBody, whatever the client asked for
  //   - cache_control dropped, since neither translator copies it — so explicit prompt
  //     caching was never once possible on the lane the cost argument rests on
  //   - thinking / redacted_thinking blocks dropped between turns
  //   - system flattened into a role:system message
  //
  // This lane forwards the body as given. Same token, same authenticated gateway, same
  // cf-aig-* retry headers, same ledger row, same 404-to-compat fallback and the same
  // provider-driven max_completion_tokens retry. Only the translation is gone.
  if (/\/v1\/chat\/completions/.test(tail)) {
    // `body` is already parsed above — the request stream is consumed by then, so re-reading
    // it here answered 400 "body is not valid JSON" on a perfectly valid payload. Caught on
    // the first live call after deploy.
    const model = await resolveModel(body.model, env);
    const token = env.CLOUDFLARE_API_TOKEN;
    if (!token) return apiError('CLOUDFLARE_API_TOKEN missing', 500, 'api_error');

    const headers = {
      'content-type': 'application/json',
      authorization: 'Bearer ' + token,
      'cf-aig-gateway-id': env.AIG_GATEWAY_ID || GATEWAY,
      'cf-aig-metadata': JSON.stringify({
        via: 'native-openai',
        shim: 'api/aig',
        model_asked: String(body.model || ''),
        session: request.headers.get('x-session-id') || undefined,
        tools: Array.isArray(body.tools) ? body.tools.length : 0,
      }),
      'cf-aig-max-attempts': '3',
      'cf-aig-retry-delay': '600',
      'cf-aig-backoff': 'exponential',
    };
    if (env.AIG_RUN_TOKEN) headers['cf-aig-authorization'] = 'Bearer ' + env.AIG_RUN_TOKEN;

    const out = { ...body, model };
    if (out.stream) out.stream_options = { include_usage: true };

    const ledger = (status, response) => context.waitUntil(logEvent(env, {
      source: 'aig',
      key: model,
      route: '/api/aig/v1/chat/completions',
      actor: request.headers.get('x-session-id') || 'native',
      action: 'chat',
      direction: 'out',
      status,
      request: { model_asked: String(body.model || ''), model, stream: !!body.stream, body },
      response,
    }));
    const tee = (stream) => {
      const chunks = [];
      return stream.pipeThrough(new TransformStream({
        transform(chunk, controller) { chunks.push(chunk); controller.enqueue(chunk); },
        flush() { ledger(200, new TextDecoder().decode(concatChunks(chunks))); },
      }));
    };

    const post = (url, payload) => fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    let upstream = await post(aiBase(env) + '/v1/chat/completions', out);
    if (upstream.status === 404) {
      const acct = env.CF_ACCOUNT_ID;
      const gw = env.AIG_GATEWAY_ID || GATEWAY;
      upstream = await post(`https://gateway.ai.cloudflare.com/v1/${acct}/${gw}/compat/chat/completions`, out);
    }
    if (upstream.status === 400 && out.max_tokens && !out.max_completion_tokens) {
      const first = await upstream.clone().text();
      if (/max_completion_tokens/.test(first)) {
        const retry = { ...out, max_completion_tokens: out.max_tokens };
        delete retry.max_tokens;
        delete retry.temperature;
        upstream = await post(aiBase(env) + '/v1/chat/completions', retry);
      }
    }
    if (!upstream.ok) {
      const text = await upstream.text();
      ledger(upstream.status, text);
      return new Response(text, {
        status: upstream.status,
        headers: { 'content-type': upstream.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' },
      });
    }
    return new Response(upstream.body ? tee(upstream.body) : upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
        'x-aig-model-served': model,
      },
    });
  }

  if (!/\/v1\/messages/.test(tail)) return apiError('unknown path: ' + tail, 404, 'not_found_error');

  const model = await resolveModel(body.model, env);
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!token) return apiError('CLOUDFLARE_API_TOKEN missing', 500, 'api_error');

  // Unified Billing is refused on an unauthenticated gateway, so coding-agent traffic
  // rides the authenticated gateway and carries its Run token.
  const headers = {
    'content-type': 'application/json',
    authorization: 'Bearer ' + token,
    'cf-aig-gateway-id': env.AIG_GATEWAY_ID || GATEWAY,
    'cf-aig-metadata': JSON.stringify({
      via: 'claude-code',
      shim: 'api/aig',
      model_asked: String(body.model || ''),
      // The CLI labels its own subagents; forwarding the ids makes the gateway's cost
      // and latency views filterable per session and per agent instead of one blur.
      session: request.headers.get('x-claude-code-session-id') || undefined,
      agent: request.headers.get('x-claude-code-agent-id') || undefined,
      parent_agent: request.headers.get('x-claude-code-parent-agent-id') || undefined,
      tools: Array.isArray(body.tools) ? body.tools.length : 0,
    }),
    // Retry transient upstream failures at the gateway rather than surfacing them to the
    // client, whose own retry logic matches on Anthropic's error wording.
    'cf-aig-max-attempts': '3',
    'cf-aig-retry-delay': '600',
    'cf-aig-backoff': 'exponential',
  };
  if (env.AIG_RUN_TOKEN) headers['cf-aig-authorization'] = 'Bearer ' + env.AIG_RUN_TOKEN;

  // Every call lands in the ledger: full request, full response, one row per turn. Streams
  // are teed so the streamed answer is recorded too, not just the fact that a stream opened.
  const ledger = (status, response) => context.waitUntil(logEvent(env, {
    source: 'aig',
    key: model,
    route: '/api/aig/v1/messages',
    actor: request.headers.get('x-claude-code-session-id') || 'claude-code',
    action: 'messages',
    direction: 'out',
    status,
    request: { model_asked: String(body.model || ''), model, stream: !!body.stream, body },
    response,
  }));
  const teeAndLog = (stream) => {
    const chunks = [];
    return stream.pipeThrough(new TransformStream({
      transform(chunk, controller) { chunks.push(chunk); controller.enqueue(chunk); },
      flush() { ledger(200, new TextDecoder().decode(concatChunks(chunks))); },
    }));
  };

  // Lane 1: Claude keeps Anthropic's own schema end to end, no translation loss.
  if (model.startsWith('anthropic/')) {
    const upstream = await fetch(aiBase(env) + '/v1/messages', {
      method: 'POST',
      headers: { ...headers, 'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01' },
      body: JSON.stringify({ ...body, model }),
    });
    return new Response(upstream.body ? teeAndLog(upstream.body) : upstream.body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' },
    });
  }

  // Lane 2: every other model speaks chat completions; translate both directions.
  const compat = buildCompatBody(body, model);
  let upstream;
  try {
    upstream = await fetch(aiBase(env) + '/v1/chat/completions', {
      method: 'POST', headers, body: JSON.stringify(compat),
    });
    // The account AI surface only knows Workers AI and the Unified Billing partners. Ids
    // that came from the gateway's own compat catalogue live one hop further out, so a
    // "model not found" is a routing answer, not a failure: retry on the compat endpoint.
    if (upstream.status === 404) {
      const acct = env.CF_ACCOUNT_ID;
      const gw = env.AIG_GATEWAY_ID || GATEWAY;
      upstream = await fetch(`https://gateway.ai.cloudflare.com/v1/${acct}/${gw}/compat/chat/completions`, {
        method: 'POST', headers, body: JSON.stringify(compat),
      });
    }
    // A provider that names the parameter it will not take is telling us how to retry.
    // One retry, driven by the provider's own message, so a new model family that flips
    // to max_completion_tokens works without waiting for the id pattern to be updated.
    if (upstream.status === 400 && !compat.max_completion_tokens) {
      const first = await upstream.clone().text();
      if (/max_completion_tokens/.test(first)) {
        const retry = { ...compat, max_completion_tokens: compat.max_tokens };
        delete retry.max_tokens;
        delete retry.temperature;
        upstream = await fetch(aiBase(env) + '/v1/chat/completions', {
          method: 'POST', headers, body: JSON.stringify(retry),
        });
      }
    }
  } catch (e) {
    return apiError('gateway fetch failed: ' + (e && e.message || e), 502, 'api_error');
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    ledger(upstream.status, text);
    // The compat catalogue publishes ids the account cannot actually reach in chat shape.
    // Three real upstream answers, measured 2026-07-26, each unreadable as raw provider
    // JSON: say which of the three it is so the caller switches model instead of debugging
    // its own request body.
    if (/Invalid value at input\b/.test(text)) {
      return apiError(`model ${model} is published on the gateway but only answers OpenAI's Responses API, which this translator does not speak — pick a chat-completions model`, 400, 'invalid_request_error');
    }
    if (/pass a valid API key/i.test(text)) {
      return apiError(`model ${model} needs a provider key on the gateway (BYOK) and none is set for it`, 400, 'authentication_error');
    }
    if (/"code":\s*2019/.test(text)) {
      return apiError(`model ${model} is not enabled on this account's Vertex AI project`, 400, 'invalid_request_error');
    }
    return apiError('gateway ' + upstream.status + ': ' + text.slice(0, 800), upstream.status, 'api_error');
  }

  if (compat.stream && upstream.body) {
    return new Response(teeAndLog(streamTranslate(upstream.body, model)), {
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' },
    });
  }

  const oai = await upstream.json();
  const out = toAnthropicMessage(oai, model);
  ledger(200, out);
  return json(out);
}

function concatChunks(chunks) {
  let n = 0;
  for (const c of chunks) n += c.length;
  const out = new Uint8Array(n);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}
