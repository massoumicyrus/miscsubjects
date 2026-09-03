// Seed the human-read half of the living model index.
//
// These figures come from leaderboards that render client-side or sit behind an API key, so a
// worker cannot re-read them on a schedule. Each one is stored with the date it was read and
// the reader, and it goes stale visibly rather than silently. The machine-readable half —
// every price at every venue — is re-read by /api/model-index/refresh.

import { execFileSync } from 'node:child_process';

const READ_AT = '2026-08-04';
const RUN = 'run_seed_' + READ_AT;

const AA = 'https://artificialanalysis.ai/leaderboards/models';
const LLMSTATS = 'https://llm-stats.com/benchmarks/swe-bench-verified';
const IFB = 'https://benchlm.ai/benchmarks/aaifbench';
const EQ = 'https://eqbench.com/creative_writing.html';
const OR_RANK = 'https://openrouter.ai/rankings';

const IF_CAVEAT = 'Machine-checkable constraints only. It does not measure whether the model could have done the task, only whether it did what it was told.';
const SWE_CAVEAT = 'Python repositories only, graded by the repository tests. It cannot see whether the model also changed files it was not asked to change.';
const AA_CAVEAT = 'One vendor composite over one task set. Index points are not a linear scale and must never be converted to a percentage.';

const rows = [];
const add = (o) => rows.push(o);

// ---- obedience: AA-IFBench via the BenchLM mirror, 144 models scored
const IFBENCH = [
  ['minimax/minimax-m3', 'MiniMax M3', 'MiniMax', 'open', 82.9],
  ['nvidia/nemotron-3-ultra', 'Nemotron 3 Ultra', 'Nvidia', 'open', 81.4],
  ['x-ai/grok-4.3', 'Grok 4.3', 'xAI', 'closed', 81.3],
  ['qwen/qwen3.7-max', 'Qwen3.7 Max', 'Alibaba', 'closed', 80.5],
  ['xiaomi/mimo-v2.5-pro', 'MiMo-V2.5-Pro', 'Xiaomi', 'closed', 79.9],
  ['openai/gpt-5.2-codex', 'GPT-5.2-Codex', 'OpenAI', 'closed', 77.6],
  ['google/gemini-3.1-pro', 'Gemini 3.1 Pro', 'Google', 'closed', 77.1],
  ['deepseek/deepseek-v4-pro', 'DeepSeek V4 Pro (max)', 'DeepSeek', 'open', 76.5],
  ['moonshotai/kimi-k2.6', 'Kimi K2.6', 'Moonshot', 'open', 76.0],
  ['openai/gpt-5.5', 'GPT-5.5', 'OpenAI', 'closed', 75.9],
  ['z-ai/glm-5.2', 'GLM-5.2', 'Z.AI', 'open', 73.3],
  ['openai/gpt-5.6-sol', 'GPT-5.6 Sol', 'OpenAI', 'closed', 72.7],
  ['openai/gpt-5.6-terra', 'GPT-5.6 Terra', 'OpenAI', 'closed', 71.2],
  ['anthropic/claude-fable-5', 'Claude Fable 5', 'Anthropic', 'closed', 63.5],
  ['moonshotai/kimi-k2.7-code', 'Kimi K2.7 Code', 'Moonshot', 'open', 63.1],
  ['anthropic/claude-opus-4.8', 'Claude Opus 4.8', 'Anthropic', 'closed', 62.2],
  ['anthropic/claude-sonnet-4.6', 'Claude Sonnet 4.6', 'Anthropic', 'closed', 41.2],
];
for (const [k, l, m, w, v] of IFBENCH) {
  add({ model_key: k, model_label: l, maker: m, weights: w, metric: 'aa_ifbench', metric_family: 'obedience',
    value_num: v, unit: 'percent', source_url: IFB, source_title: 'AA-IFBench leaderboard, 144 models',
    source_publisher: 'BenchLM mirror of Artificial Analysis / Ai2 IFBench', source_type: 'benchmark',
    evidence_class: 'measured', method: 'Verifiable output constraints, graded by program. No judge model.',
    caveat: IF_CAVEAT });
}

// ---- coding: SWE-bench Verified via llm-stats, 104 models
const SWE = [
  ['anthropic/claude-fable-5', 'Claude Fable 5', 'Anthropic', 'closed', 0.950],
  ['anthropic/claude-mythos-preview', 'Claude Mythos Preview', 'Anthropic', 'closed', 0.939],
  ['anthropic/claude-opus-4.8', 'Claude Opus 4.8', 'Anthropic', 'closed', 0.886],
  ['anthropic/claude-opus-4.7', 'Claude Opus 4.7', 'Anthropic', 'closed', 0.876],
  ['anthropic/claude-sonnet-5', 'Claude Sonnet 5', 'Anthropic', 'closed', 0.852],
  ['deepseek/deepseek-v4-pro', 'DeepSeek V4 Pro Max', 'DeepSeek', 'open', 0.806],
  ['google/gemini-3.1-pro', 'Gemini 3.1 Pro', 'Google', 'closed', 0.806],
  ['minimax/minimax-m3', 'MiniMax M3', 'MiniMax', 'open', 0.805],
  ['qwen/qwen3.7-max', 'Qwen3.7 Max', 'Alibaba', 'closed', 0.804],
  ['moonshotai/kimi-k2.6', 'Kimi K2.6', 'Moonshot', 'open', 0.802],
  ['openai/gpt-5.2', 'GPT-5.2', 'OpenAI', 'closed', 0.800],
  ['deepseek/deepseek-v4-flash', 'DeepSeek V4 Flash Max', 'DeepSeek', 'open', 0.790],
  ['xiaomi/mimo-v2.5-pro', 'MiMo-V2.5-Pro', 'Xiaomi', 'closed', 0.789],
  ['z-ai/glm-5', 'GLM-5', 'Z.AI', 'open', 0.778],
  ['anthropic/claude-haiku-4.5', 'Claude Haiku 4.5', 'Anthropic', 'closed', 0.733],
];
for (const [k, l, m, w, v] of SWE) {
  add({ model_key: k, model_label: l, maker: m, weights: w, metric: 'swe_bench_verified', metric_family: 'capability',
    value_num: v, unit: 'fraction', source_url: LLMSTATS, source_title: 'SWE-bench Verified leaderboard, 104 models',
    source_publisher: 'llm-stats', source_type: 'benchmark', evidence_class: 'measured',
    method: 'Real GitHub issues; a patch counts only if the repository tests pass.', caveat: SWE_CAVEAT });
}

// ---- reasoning composite + measured cost per task, Artificial Analysis
const AAIDX = [
  ['anthropic/claude-opus-5', 'Claude Opus 5 (max)', 'Anthropic', 'closed', 61, 2.34],
  ['anthropic/claude-opus-5', 'Claude Opus 5 (xhigh)', 'Anthropic', 'closed', 60, 1.80],
  ['anthropic/claude-fable-5', 'Claude Fable 5', 'Anthropic', 'closed', 60, 3.15],
  ['openai/gpt-5.6-sol', 'GPT-5.6 Sol (max)', 'OpenAI', 'closed', 59, 1.23],
  ['anthropic/claude-opus-5', 'Claude Opus 5 (high)', 'Anthropic', 'closed', 59, 1.23],
  ['openai/gpt-5.6-sol', 'GPT-5.6 Sol (xhigh)', 'OpenAI', 'closed', 58, 0.83],
  ['moonshotai/kimi-k3', 'Kimi K3 (max)', 'Moonshot', 'open', 57, 0.86],
  ['openai/gpt-5.6-terra', 'GPT-5.6 Terra (max)', 'OpenAI', 'closed', 55, 0.51],
  ['x-ai/grok-4.5', 'Grok 4.5 (high)', 'xAI', 'closed', 54, 0.36],
  ['z-ai/glm-5.2', 'GLM-5.2 (max)', 'Z.AI', 'open', 51, 0.57],
  ['openai/gpt-5.6-luna', 'GPT-5.6 Luna (max)', 'OpenAI', 'closed', 51, 0.05],
  ['deepseek/deepseek-v4-flash', 'DeepSeek V4 Flash 0731 (max)', 'DeepSeek', 'open', 50, 0.03],
  ['google/gemini-3.6-flash', 'Gemini 3.6 Flash', 'Google', 'closed', 50, 0.56],
  ['qwen/qwen3.7-max', 'Qwen3.7 Max', 'Alibaba', 'closed', 46, 1.08],
  ['minimax/minimax-m3', 'MiniMax M3', 'MiniMax', 'open', 44, 0.14],
  ['deepseek/deepseek-v4-pro', 'DeepSeek V4 Pro (max)', 'DeepSeek', 'open', 44, 0.05],
  ['xiaomi/mimo-v2.5-pro', 'MiMo-V2.5-Pro', 'Xiaomi', 'closed', 42, 0.03],
];
for (const [k, l, m, w, idx, cost] of AAIDX) {
  add({ model_key: k, model_label: l, maker: m, weights: w, metric: 'aa_intelligence_index', metric_family: 'capability',
    value_num: idx, unit: 'index', source_url: AA, source_title: 'Artificial Analysis Intelligence Index',
    source_publisher: 'Artificial Analysis', source_type: 'benchmark', evidence_class: 'measured',
    method: 'Composite of several evaluations at a stated reasoning effort.', caveat: AA_CAVEAT });
  add({ model_key: k, model_label: l, maker: m, weights: w, metric: 'cost_per_task_usd', metric_family: 'price',
    value_num: cost, unit: 'usd', venue: 'Artificial Analysis suite', venue_kind: 'benchmark',
    source_url: AA, source_title: 'Artificial Analysis cost per task',
    source_publisher: 'Artificial Analysis', source_type: 'benchmark', evidence_class: 'measured',
    method: 'Measured token usage on that suite multiplied by list price.',
    caveat: 'The cost of one vendor\'s task mix, not of your work. Closest public analogue to an operating cost and still not one.' });
}

// ---- writing
for (const [k, l, m, w, v] of [
  ['anthropic/claude-opus-5', 'Claude Opus 5', 'Anthropic', 'closed', 2430],
  ['moonshotai/kimi-k3', 'Kimi K3', 'Moonshot', 'open', 2340],
  ['openai/gpt-5.6-sol', 'GPT-5.6 Sol', 'OpenAI', 'closed', 2092],
]) {
  add({ model_key: k, model_label: l, maker: m, weights: w, metric: 'eqbench_creative_elo', metric_family: 'writing',
    value_num: v, unit: 'elo', source_url: EQ, source_title: 'EQ-Bench creative writing leaderboard',
    source_publisher: 'EQ-Bench', source_type: 'benchmark', evidence_class: 'measured',
    method: 'Elo from rated pairwise comparisons of prose.',
    caveat: 'Judged rather than executed. The softest metric in this index.' });
}

// ---- popularity
const POP = [
  ['deepseek/deepseek-v4-flash', 'DeepSeek V4 Flash 0423', 'DeepSeek', 'open', 6.92e12],
  ['xiaomi/mimo-v2.5', 'MiMo-V2.5', 'Xiaomi', 'open', 5.10e12],
  ['tencent/hy3', 'Hy3', 'Tencent', 'open', 5.01e12],
  ['openai/gpt-5.6-luna', 'GPT-5.6 Luna', 'OpenAI', 'closed', 2.99e12],
  ['deepseek/deepseek-v4-pro', 'DeepSeek V4 Pro', 'DeepSeek', 'open', 2.97e12],
  ['z-ai/glm-5.2', 'GLM 5.2', 'Z.AI', 'open', 2.89e12],
  ['minimax/minimax-m3', 'MiniMax M3', 'MiniMax', 'open', 1.84e12],
  ['moonshotai/kimi-k3', 'Kimi K3', 'Moonshot', 'open', 1.38e12],
  ['anthropic/claude-opus-5', 'Claude Opus 5', 'Anthropic', 'closed', 1.10e12],
  ['anthropic/claude-sonnet-5', 'Claude Sonnet 5', 'Anthropic', 'closed', 1.02e12],
];
for (const [k, l, m, w, v] of POP) {
  add({ model_key: k, model_label: l, maker: m, weights: w, metric: 'openrouter_tokens_week', metric_family: 'popularity',
    value_num: v, unit: 'tokens_per_week', venue: 'OpenRouter', venue_kind: 'router',
    source_url: OR_RANK, source_title: 'OpenRouter weekly model leaderboard',
    source_publisher: 'OpenRouter', source_type: 'first_party_api', evidence_class: 'measured',
    method: 'Weekly token volume as counted by each upstream provider\'s own tokenizer.',
    caveat: 'Free tiers inflate it, terse models consume fewer tokens for the same work, and tokens are not standard units across providers.' });
}

// ---- first-party prices that a worker cannot scrape reliably
const FIRST_PARTY = [
  ['openai/gpt-5.6-luna', 'GPT-5.6 Luna', 'OpenAI', 'closed', 0.20, 1.20, 'OpenAI', 'https://developers.openai.com/api/docs/models', 'vendor_stated', 'Cut 80% on 2026-07-30.'],
  ['openai/gpt-5.6-terra', 'GPT-5.6 Terra', 'OpenAI', 'closed', 2.00, 12.00, 'OpenAI', 'https://developers.openai.com/api/docs/models', 'vendor_stated', 'Cut 20% on 2026-07-30.'],
  ['openai/gpt-5.6-sol', 'GPT-5.6 Sol', 'OpenAI', 'closed', 5.00, 30.00, 'OpenAI', 'https://developers.openai.com/api/docs/models', 'vendor_stated', 'Not cut; reported 2.5x faster instead.'],
  ['anthropic/claude-opus-5', 'Claude Opus 5', 'Anthropic', 'closed', 5.00, 25.00, 'Anthropic', 'https://platform.claude.com/docs/en/about-claude/pricing', 'vendor_stated', 'Cache hits bill at 10% of base input; Batch API is 50% off.'],
  ['anthropic/claude-fable-5', 'Claude Fable 5', 'Anthropic', 'closed', 10.00, 50.00, 'Anthropic', 'https://platform.claude.com/docs/en/about-claude/pricing', 'vendor_stated', 'The most expensive model in this index.'],
  ['anthropic/claude-haiku-4.5', 'Claude Haiku 4.5', 'Anthropic', 'closed', 1.00, 5.00, 'Anthropic', 'https://platform.claude.com/docs/en/about-claude/pricing', 'vendor_stated', ''],
  ['deepseek/deepseek-v4-flash', 'DeepSeek V4 Flash', 'DeepSeek', 'open', 0.14, 0.28, 'DeepSeek', 'https://api-docs.deepseek.com/quick_start/pricing', 'vendor_stated', 'Doubles during Beijing peak hours, 09:00-12:00 and 14:00-18:00. Cache hit input is $0.0028.'],
  ['deepseek/deepseek-v4-pro', 'DeepSeek V4 Pro', 'DeepSeek', 'open', 0.435, 0.87, 'DeepSeek', 'https://api-docs.deepseek.com/quick_start/pricing', 'vendor_stated', 'Doubles during Beijing peak hours. Six major hosts charge 4x this.'],
  ['z-ai/glm-5.2', 'GLM 5.2', 'Z.AI', 'open', 1.40, 4.40, 'Z.AI', 'https://docs.z.ai/guides/overview/pricing', 'vendor_stated', 'Novita sells the same weights for 60% less.'],
  ['moonshotai/kimi-k3', 'Kimi K3', 'Moonshot', 'open', 3.00, 15.00, 'Moonshot AI', 'https://platform.moonshot.ai/docs/pricing/chat', 'vendor_stated', 'Cache hit input is $0.30. Requests to the international platform are processed in China.'],
];
for (const [k, l, m, w, pin, pout, venue, src, cls, caveat] of FIRST_PARTY) {
  const base = { model_key: k, model_label: l, maker: m, weights: w, venue, venue_kind: 'maker',
    source_url: src, source_title: `${venue} published pricing`, source_publisher: venue,
    source_type: 'first_party_docs', evidence_class: cls,
    method: 'Read from the maker\'s own published pricing page.', caveat };
  add({ ...base, metric: 'price_in_usd_per_mtok', metric_family: 'price', value_num: pin, unit: 'usd_per_mtok' });
  add({ ...base, metric: 'price_out_usd_per_mtok', metric_family: 'price', value_num: pout, unit: 'usd_per_mtok' });
}

// promotional: the one that has a published end date
for (const [metric, v] of [['price_in_usd_per_mtok', 2.00], ['price_out_usd_per_mtok', 10.00]]) {
  add({ model_key: 'anthropic/claude-sonnet-5', model_label: 'Claude Sonnet 5', maker: 'Anthropic', weights: 'closed',
    metric, metric_family: 'price', value_num: v, unit: 'usd_per_mtok', venue: 'Anthropic', venue_kind: 'maker',
    source_url: 'https://aws.amazon.com/bedrock/pricing/', source_title: 'Bedrock pricing states the promotional rate and its end date',
    source_publisher: 'Amazon Web Services', source_type: 'first_party_docs', evidence_class: 'promotional',
    quote: 'IMPORTANT: Claude Sonnet 5 promotional launch pricing of $2/$10 per million input/output tokens is in effect through August 31, 2026, after which the standard pricing of $3/$15 per',
    method: 'Read from the cloud marketplace listing, which publishes the expiry the maker\'s page does not foreground.',
    caveat: 'Expires 2026-08-31 and reverts to $3/$15. Any cost model built on this rate has 27 days of validity from the read date.' });
}

const esc = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const stmts = rows.map((o) => `INSERT INTO model_index_observations
 (id, observed_at, event_date, model_key, model_label, maker, weights, metric, metric_family,
  value_num, value_text, unit, venue, venue_kind, precision_note,
  source_url, source_title, source_publisher, source_type, quote,
  evidence_class, method, caveat, superseded_by, run_id)
 VALUES (${esc('mio_seed_' + Math.random().toString(36).slice(2, 12))}, ${esc(READ_AT + 'T00:00:00.000Z')}, NULL,
 ${esc(o.model_key)}, ${esc(o.model_label)}, ${esc(o.maker)}, ${esc(o.weights)}, ${esc(o.metric)}, ${esc(o.metric_family)},
 ${o.value_num == null ? 'NULL' : o.value_num}, NULL, ${esc(o.unit)}, ${esc(o.venue)}, ${esc(o.venue_kind)}, NULL,
 ${esc(o.source_url)}, ${esc(o.source_title)}, ${esc(o.source_publisher)}, ${esc(o.source_type)}, ${esc(o.quote)},
 ${esc(o.evidence_class)}, ${esc(o.method)}, ${esc(o.caveat)}, NULL, ${esc(RUN)});`);

console.log(`-- ${rows.length} seed observations, read ${READ_AT}`);
console.log(stmts.join('\n'));
