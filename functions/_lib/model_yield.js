// Per-model yield — $/claim and tok/claim under disclosed constraint envelopes.

/** USD per million tokens [input, output] — disclosed pricing for yield comparison. */
export const MODEL_PRICING_PPM = {
  "grok-4.3": [1.25, 2.5],
  "grok/grok-4.3": [1.25, 2.5],
  "grok-build-0.1": [1.0, 2.0],
  "kimi/moonshot-v1-8k": [0.15, 0.15],
  "gemini/gemini-2.5-flash": [0.075, 0.3],
  "gemini/gemini-2.0-flash-lite": [0.075, 0.3],
  "openai/gpt-4o": [2.5, 10.0],
  "openai/gpt-4o-mini": [0.15, 0.6],
  "system/reflex": [0, 0],
  "ingest:deterministic": [0, 0],
  "fill-slots": [0, 0],
};

export function normalizeModelId(model) {
  const m = String(model || "unknown").trim();
  if (MODEL_PRICING_PPM[m]) return m;
  const tail = m.split("/").pop();
  for (const [k, v] of Object.entries(MODEL_PRICING_PPM)) {
    if (k.endsWith("/" + tail) || k === tail) return k;
  }
  return m;
}

export function estimateModelCost(model, tokensIn, tokensOut) {
  const id = normalizeModelId(model);
  const ppm = MODEL_PRICING_PPM[id];
  const ti = Number(tokensIn || 0);
  const to = Number(tokensOut || 0);
  if (!ppm) return 0;
  return (ti * ppm[0] + to * ppm[1]) / 1e6;
}

export function materialOutputsFromPass(entry) {
  const p = entry?.payload || {};
  const ids = [];
  for (const id of p.claims_added || []) ids.push(String(id));
  if (p.challenge_id) ids.push(String(p.challenge_id));
  if (p.claim_ids) for (const id of p.claim_ids) ids.push(String(id));
  return [...new Set(ids.filter(Boolean))];
}

export function yieldMetricsForPass(entry) {
  const ti = Number(entry.tokens_in || 0);
  const to = Number(entry.tokens_out || 0);
  const cost =
    entry.cost != null && entry.cost > 0
      ? Number(entry.cost)
      : estimateModelCost(entry.model, ti, to);
  const outputs = materialOutputsFromPass(entry);
  const material = outputs.length > 0 || entry.payload?.material !== false;
  const tokens = ti + to;
  return {
    pass_id: entry.id,
    model: entry.model,
    action: entry.action,
    role: entry.role,
    ts: entry.ts,
    tokens_in: ti,
    tokens_out: to,
    tokens_total: tokens,
    cost_usd: Math.round(cost * 1e8) / 1e8,
    outputs,
    output_count: outputs.length,
    material,
    usd_per_output: outputs.length ? Math.round((cost / outputs.length) * 1e6) / 1e6 : null,
    tokens_per_output: outputs.length ? Math.round(tokens / outputs.length) : null,
    waste: !material && tokens > 0,
  };
}

export function summarizeArticleYield(meta) {
  const contributions = Array.isArray(meta.contributions) ? meta.contributions : [];
  const energy = Array.isArray(meta.energy_spent) ? meta.energy_spent : [];
  const byModel = {};
  let totalCost = 0;
  let totalTokens = 0;
  let totalOutputs = 0;
  let wasteCost = 0;

  for (const c of contributions) {
    const y = yieldMetricsForPass(c);
    totalCost += y.cost_usd;
    totalTokens += y.tokens_total;
    totalOutputs += y.output_count;
    const m = y.model || "unknown";
    if (!byModel[m]) {
      byModel[m] = {
        model: m,
        passes: 0,
        cost_usd: 0,
        tokens_total: 0,
        outputs: 0,
        waste_passes: 0,
      };
    }
    byModel[m].passes++;
    byModel[m].cost_usd += y.cost_usd;
    byModel[m].tokens_total += y.tokens_total;
    byModel[m].outputs += y.output_count;
    if (y.waste) byModel[m].waste_passes++;
  }

  for (const e of energy) {
    const c = Number(e.cost || estimateModelCost(e.model, e.tokens_in, e.tokens_out));
    wasteCost += c;
    totalCost += c;
    totalTokens += Number(e.tokens_in || 0) + Number(e.tokens_out || 0);
  }

  const models = Object.values(byModel).map((m) => ({
    ...m,
    cost_usd: Math.round(m.cost_usd * 1e6) / 1e6,
    usd_per_output:
      m.outputs > 0 ? Math.round((m.cost_usd / m.outputs) * 1e6) / 1e6 : null,
  }));

  return {
    passes: contributions.length,
    energy_spent_rows: energy.length,
    total_cost_usd: Math.round(totalCost * 1e6) / 1e6,
    waste_cost_usd: Math.round(wasteCost * 1e6) / 1e6,
    total_tokens: totalTokens,
    material_outputs: totalOutputs,
    usd_per_output:
      totalOutputs > 0 ? Math.round((totalCost / totalOutputs) * 1e6) / 1e6 : null,
    models: models.sort((a, b) => b.outputs - a.outputs || a.cost_usd - b.cost_usd),
    constraints: {
      constitution: "/api/articles/constitution",
      collaborate_schema: "POST /api/protocol/collaborate",
      pricing_ppm: MODEL_PRICING_PPM,
    },
  };
}