// Declarative provider/model registry — the single source for the company-aware
// LLM/model creation form (T5/T6) and the models surface (T7). Served read-only at
// GET /api/providers (and /api/providers/<company>). Directory row: PROVIDERS.
//
// EVERY field a model can carry is declared in FIELD_SPEC so the form knows what MUST
// exist vs what CAN exist per company + endpoint. Values are filled where exhibited
// (Anthropic from the Claude API reference; Grok pricing + all endpoints from in-repo
// rows). A null value means "not exhibited here" — fetch the provider's docs_url to
// fill it; it is never a guessed number.

import { CF_CATALOG } from './cf_catalog.js';

// What the form renders. required=MUST, optional=CAN. `applies` scopes a field to
// endpoints/modalities. `values` enumerates the allowed set; `range` gives min/max.
export const FIELD_SPEC = {
  company:        { required: true,  type: 'enum', note: 'Which API. Sets endpoints, api_key_name, model list.' },
  model_id:       { required: true,  type: 'string', note: 'Exact model string sent in the request body.' },
  endpoint:       { required: true,  type: 'enum', note: 'Which API surface. xAI/OpenAI: completions vs responses. Anthropic: messages.' },
  api_key_name:   { required: true,  type: 'string', note: 'Env/secret name holding the bearer key. Never the key itself.' },
  system_prompt:  { required: false, type: 'text', note: 'Plain-text system prompt. Stored in its own field; rendered into the JSON payload at dispatch.' },
  max_output_tokens: { required: false, type: 'int', note: 'Hard per-response ceiling. Capped at the model max_output below.' },
  temperature:    { required: false, type: 'float', applies: 'xai,openai,google', note: 'Sampling. Range per model below. REMOVED on Anthropic Fable5/Opus4.7/4.8 (sending it 400s).' },
  reasoning:      { required: false, type: 'enum', note: 'Reasoning amount. xAI: reasoning_effort low|medium|high|none. Anthropic: thinking adaptive + effort low|medium|high|xhigh|max. OpenAI: reasoning_effort. Google: thinkingBudget.' },
  web_search:     { required: false, type: 'bool', note: 'Provider-native web search/grounding.' },
  response_format:{ required: false, type: 'enum', values: ['text', 'json_object', 'json_schema'], note: 'Structured output constraint.' },
  modality:       { required: true,  type: 'enum', values: ['text', 'image', 'video', 'stt', 'tts'], note: 'What the model produces.' },
};

export const PROVIDERS = {
  anthropic: {
    label: 'Anthropic (Claude)',
    base_url: 'https://api.anthropic.com',
    api_key_name: 'ANTHROPIC_API_KEY',
    auth: 'header:x-api-key + anthropic-version:2023-06-01',
    endpoints: { messages: '/v1/messages', batches: '/v1/messages/batches', files: '/v1/files', count_tokens: '/v1/messages/count_tokens', models: '/v1/models' },
    docs_url: 'https://platform.claude.com/docs/en/about-claude/models/overview',
    on_hand_doc: 'DOCS_GET anthropic',
    reasoning: { param: 'thinking:{type:adaptive} + output_config.effort', values: ['low', 'medium', 'high', 'xhigh', 'max'], note: 'Adaptive thinking only on Fable5/Opus4.7/4.8; budget_tokens REMOVED (400). xhigh = Opus4.7+ only. budget_tokens deprecated-but-works on Opus4.6/Sonnet4.6.' },
    temperature: { supported: false, note: 'temperature/top_p/top_k REMOVED on Fable5/Opus4.8/4.7 (400). Steer via prompt.' },
    cache: { write_5m: '1.25x input', write_1h: '2.0x input', read: '0.1x input', min_prefix_tokens: { 'claude-opus-4-8': 4096, 'claude-fable-5': 2048, 'claude-sonnet-4-6': 2048, 'claude-haiku-4-5': 4096 }, note: 'Prefix match; reads ~0.1x. Verify via usage.cache_read_input_tokens.' },
    models: [
      { model_id: 'claude-fable-5',   modality: 'text', context_window: 1000000, max_output: 128000, input_ppm: 10.00, cached_input_ppm: 1.00, output_ppm: 50.00, reasoning: true, note: 'Most capable. Explicit thinking:{disabled} 400s — omit instead.' },
      { model_id: 'claude-opus-4-8',  modality: 'text', context_window: 1000000, max_output: 128000, input_ppm: 5.00,  cached_input_ppm: 0.50, output_ppm: 25.00, reasoning: true },
      { model_id: 'claude-opus-4-7',  modality: 'text', context_window: 1000000, max_output: 128000, input_ppm: 5.00,  cached_input_ppm: 0.50, output_ppm: 25.00, reasoning: true },
      { model_id: 'claude-sonnet-4-6',modality: 'text', context_window: 1000000, max_output: 64000,  input_ppm: 3.00,  cached_input_ppm: 0.30, output_ppm: 15.00, reasoning: true },
      { model_id: 'claude-haiku-4-5', modality: 'text', context_window: 200000,  max_output: 64000,  input_ppm: 1.00,  cached_input_ppm: 0.10, output_ppm: 5.00,  reasoning: false },
    ],
  },

  xai: {
    label: 'xAI (Grok)',
    base_url: 'https://api.x.ai',
    api_key_name: 'GROK_API_KEY',
    auth: 'bearer:GROK_API_KEY',
    endpoints: { completions: '/v1/chat/completions', responses: '/v1/responses', models: '/v1/models', images: '/v1/images/generations', tts: '/v1/tts', stt: '/v1/stt', videos: '/v1/videos/*' },
    docs_url: 'https://docs.x.ai',
    on_hand_doc: 'DOCS_GET grok',
    reasoning: { param: 'reasoning_effort', values: ['low', 'medium', 'high', 'none', 'default'], note: 'Build law: reasoning_effort=none via [REASONING_SET]none[/REASONING_SET]. Set with REASONING_SET; read with REASONING_GET.' },
    temperature: { supported: true, range: { min: 0, max: 2, default: 1 } },
    cache: { note: 'xAI prompt-cache pricing not exhibited in-repo — verify at docs.x.ai/llms.txt.', write: null, read: null },
    models: [
      // Pricing exhibited from the prior /grok page PRICING_ALL ($ per 1M tokens).
      { model_id: 'grok-4.3',                     modality: 'text', context_window: null, max_output: null, input_ppm: 1.25, output_ppm: 2.50, reasoning: true,  endpoints: ['completions', 'responses'] },
      { model_id: 'grok-build-0.1',               modality: 'text', context_window: null, max_output: null, input_ppm: 1.00, output_ppm: 2.00, reasoning: true,  endpoints: ['completions', 'responses'], note: 'The build brain.' },
      { model_id: 'grok-4.20-multi-agent-0309',   modality: 'text', context_window: null, max_output: null, input_ppm: 1.25, output_ppm: 2.50, reasoning: true,  endpoints: ['completions', 'responses'] },
      { model_id: 'grok-4.20-0309-reasoning',     modality: 'text', context_window: null, max_output: null, input_ppm: 1.25, output_ppm: 2.50, reasoning: true,  endpoints: ['completions', 'responses'] },
      { model_id: 'grok-4.20-0309-non-reasoning', modality: 'text', context_window: null, max_output: null, input_ppm: 1.25, output_ppm: 2.50, reasoning: false, endpoints: ['completions', 'responses'] },
      { model_id: 'grok-image',                   modality: 'image', endpoint: 'images', note: 'POST /v1/images/generations.' },
      { model_id: 'grok-tts',                     modality: 'tts', endpoint: 'tts', voices: ['eve', 'ara', 'rex', 'sal', 'leo'], cost: '$15 / 1M chars', note: 'POST /v1/tts → mp3 bytes. Directory: GROK_TTS.' },
      { model_id: 'grok-stt',                     modality: 'stt', endpoint: 'stt', note: 'POST /v1/stt multipart → transcript. Directory: GROK_STT.' },
      { model_id: 'grok-video',                   modality: 'video', endpoint: 'videos', note: 'Endpoint family /v1/videos/* — async, SDK polls. generation / image→video / reference→video / editing / extension.' },
    ],
  },

  openai: {
    label: 'OpenAI',
    base_url: 'https://api.openai.com',
    api_key_name: 'OPENAI_API_KEY',
    auth: 'bearer:OPENAI_API_KEY',
    endpoints: { completions: '/v1/chat/completions', responses: '/v1/responses', images: '/v1/images/generations', image_edits: '/v1/images/edits', tts: '/v1/audio/speech', stt: '/v1/audio/transcriptions', models: '/v1/models' },
    docs_url: 'https://platform.openai.com/docs/pricing',
    on_hand_doc: 'DOCS_GET openai',
    reasoning: { param: 'reasoning_effort', values: ['minimal', 'low', 'medium', 'high'], note: 'On reasoning models. Verify support per model at docs.' },
    temperature: { supported: true, range: { min: 0, max: 2, default: 1 } },
    cache: { note: 'OpenAI cached-input pricing not exhibited in-repo — verify at platform.openai.com/docs/pricing.', read: null },
    models: [
      // Models referenced in-repo; per-token pricing/limits not exhibited → null, verify at docs_url.
      { model_id: 'gpt-image-1.5',     modality: 'image', endpoint: 'images', note: 'Text→image + edits. fn openaiImage / openaiImageEdit.' },
      { model_id: 'gpt-4o-mini-tts',   modality: 'tts', endpoint: 'tts', voices: ['alloy'], note: 'fn voiceSay; falls back to tts-1.' },
      { model_id: 'tts-1',             modality: 'tts', endpoint: 'tts' },
      { model_id: 'whisper-1',         modality: 'stt', endpoint: 'stt', note: 'fn voiceTranscribe.' },
      { model_id: 'gpt-4o',            modality: 'text', context_window: null, max_output: null, input_ppm: null, output_ppm: null, endpoints: ['completions', 'responses'] },
      { model_id: 'gpt-4o-mini',       modality: 'text', context_window: null, max_output: null, input_ppm: null, output_ppm: null, endpoints: ['completions', 'responses'] },
    ],
  },

  google: {
    label: 'Google (Gemini)',
    base_url: 'https://generativelanguage.googleapis.com',
    api_key_name: 'GEMINI_API_KEY',
    auth: 'query/header:GEMINI_API_KEY',
    endpoints: { generate: '/v1beta/models/{model}:generateContent', stream: '/v1beta/models/{model}:streamGenerateContent', models: '/v1beta/models' },
    docs_url: 'https://ai.google.dev/gemini-api/docs/pricing',
    on_hand_doc: 'DOCS_GET gemini',
    reasoning: { param: 'thinkingConfig.thinkingBudget', values: null, note: 'Thinking budget in tokens on thinking-capable models. Verify at docs.' },
    temperature: { supported: true, range: { min: 0, max: 2, default: 1 } },
    cache: { note: 'Gemini context-cache pricing not exhibited in-repo — verify at ai.google.dev/gemini-api/docs/pricing.', read: null },
    models: [
      // GEMINI_API_KEY not yet set (STATE.md). Model IDs/pricing not exhibited → verify at docs_url before wiring.
      { model_id: 'gemini-flash',  modality: 'text', context_window: null, max_output: null, input_ppm: null, output_ppm: null, note: 'Confirm exact id at docs_url.' },
      { model_id: 'gemini-pro',    modality: 'text', context_window: null, max_output: null, input_ppm: null, output_ppm: null, note: 'Confirm exact id at docs_url.' },
    ],
  },

  moonshot: {
    label: 'Moonshot AI (Kimi)',
    base_url: 'https://api.moonshot.ai',
    api_key_name: 'MOONSHOT_API_KEY',
    auth: 'bearer:MOONSHOT_API_KEY',
    endpoints: { completions: '/v1/chat/completions', models: '/v1/models' },
    docs_url: 'https://platform.moonshot.cn/docs',
    on_hand_doc: 'DOCS_GET moonshot',
    reasoning: { param: null, values: null, note: 'Not exhibited. Verify at docs_url.' },
    temperature: { supported: true, range: { min: 0, max: 1, default: 1 }, note: 'kimi-k2.6 only accepts temperature=1. Sending other values 400s.' },
    cache: { note: 'Cache pricing not exhibited in-repo — verify at platform.moonshot.cn/docs.' },
    models: [
      { model_id: 'kimi-k2.6', modality: 'text', context_window: null, max_output: null, input_ppm: null, output_ppm: null, endpoints: ['completions'] },
      { model_id: 'moonshot-v1-8k', modality: 'text', context_window: null, max_output: null, input_ppm: null, output_ppm: null, endpoints: ['completions'] },
    ],
  },
};

// Cloudflare catalogue — every model runnable THROUGH Cloudflare (Workers AI binding for
// @cf/*, AI Gateway gw:<author>/<model> for the rest). Sourced from cf_catalog.js so the
// agent creator and the models directory can offer all of them. See that file's header.
PROVIDERS.cloudflare = {
  label: 'Cloudflare (Workers AI + AI Gateway catalogue)',
  base_url: 'https://api.cloudflare.com · https://gateway.ai.cloudflare.com',
  api_key_name: 'CLOUDFLARE_API_TOKEN',
  auth: '@cf/* → Workers AI binding env.AI.run (no key). Others → AI Gateway (gw: prefix).',
  endpoints: {
    workers_ai: 'env.AI.run("@cf/<author>/<model>")',
    ai_gateway: 'dispatch model id "gw:<author>/<model>" → /accounts/<id>/ai/v1/chat/completions',
    catalogue: 'CF ai_models|<account_id>  (GET /accounts/<id>/ai/models/search)',
  },
  docs_url: 'https://developers.cloudflare.com/ai/models/',
  on_hand_doc: 'CF ai_models|<CLOUDFLARE_ACCOUNT_ID>',
  reasoning: { param: 'per-model', values: null, note: 'Reasoning support is flagged per model in capabilities ("Reasoning").' },
  temperature: { supported: true, note: 'Per provider; Workers AI text models accept temperature.' },
  cache: { note: 'Per provider; AI Gateway adds its own response-cache layer.' },
  models: CF_CATALOG.map(m => ({
    model_id: m.model_id,
    modality: m.modality,
    endpoint: m.run_via === 'workers_ai_binding' ? 'workers_ai' : 'ai_gateway',
    context_window: m.context_window,
    input_ppm: m.input_ppm,
    output_ppm: m.output_ppm,
    hosting: m.hosting,
    author: m.author,
    task: m.task,
    capabilities: m.capabilities,
    flags: m.flags,
    run_via: m.run_via,
    note: m.description,
  })),
};

export function listCompanies() {
  return Object.keys(PROVIDERS).map(k => ({ company: k, label: PROVIDERS[k].label, api_key_name: PROVIDERS[k].api_key_name, model_count: PROVIDERS[k].models.length }));
}

// ── The ONE Cloudflare AI Gateway — durable facts (verified against AIG_LIST + CF docs
// 2026-07-21). This is the single source the /admin/directory/models + /new pages render,
// so the answers ("what models, how billing, which have web search") live in the surface.
export const GATEWAY = {
  id: 'cloud-kernel',
  account_id: '<CLOUDFLARE_ACCOUNT_ID>',
  // One endpoint for every provider/model. model field = "provider/model".
  compat_url: 'https://gateway.ai.cloudflare.com/v1/<CLOUDFLARE_ACCOUNT_ID>/cloud-kernel/compat/chat/completions',
  gateway_auth: 'unauthenticated — provider bearer key only (BYOK). Live now.',
  // The "default" gateway is authenticated + Unified-Billing capable but needs the owner to
  // enable it in the dashboard (valid AI-Gateway token OR auth off, then load credits).
  // Once done, flip CF_AIG_ID + GATEWAY.id to "default" (one line each).
  upgrade_target: 'default',
  dispatch_prefix: 'gw:provider/model  (e.g. gw:anthropic/claude-opus-4-8)',
  // Every provider the compat endpoint proxies. You can run ANY model these publish.
  compat_providers: [
    'anthropic', 'openai', 'groq', 'mistral', 'cohere', 'perplexity', 'workers-ai',
    'google-ai-studio', 'google-vertex-ai', 'xai', 'deepseek', 'cerebras', 'baseten', 'parallel',
  ],
  // Billing modes:
  //  unified   = Cloudflare bills you (load credits in dashboard). No provider key. +5% on
  //              credit purchases, per-token cost passed through with NO markup.
  //  byok      = Bring Your Own Key. Provider bills you; the gateway only observes/caches.
  //  neurons   = Workers AI (@cf/*). Billed by Cloudflare as Neurons. No key.
  billing: {
    unified_providers: ['openai', 'anthropic', 'google-ai-studio', 'google-vertex-ai', 'xai', 'groq'],
    unified_fee: '5% on credit purchases; per-token rates identical to going direct',
    zdr_available: ['openai', 'anthropic'],
    enable: 'Cloudflare dashboard → AI → AI Gateway → default → load credits + toggle a provider to Unified Billing',
  },
  // Web search is PROVIDER-NATIVE and passes through the gateway. Cloudflare itself does
  // NOT add web search. (CF "AI Search"/AutoRAG searches YOUR documents, not the web.)
  web_search: {
    cloudflare_native: false,
    providers: {
      xai:              { supported: true,  how: 'tools:[{type:web_search}, {type:x_search}] via /v1/responses' },
      openai:           { supported: true,  how: 'tools:[{type:web_search}] (Responses API)' },
      anthropic:        { supported: true,  how: 'tools:[{type:web_search_20250305}]' },
      'google-ai-studio':{ supported: true, how: 'tools:[{google_search:{}}] grounding' },
      perplexity:       { supported: true,  how: 'search-grounded by default (sonar models)' },
      groq:             { supported: false, how: 'no native web search' },
      'workers-ai':     { supported: false, how: 'use AutoRAG over your own data, not the web' },
    },
  },
};
