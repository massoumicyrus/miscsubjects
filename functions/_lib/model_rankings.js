export const MODEL_RANKINGS = {
  read_at: "4 August 2026",
  source_name: "Artificial Analysis",
  inputs: [
    { name: "MiMo-V2.5-Pro", index: 42, obedience: 79.9, cost: 0.03 },
    { name: "DeepSeek V4 Pro", index: 44, obedience: 76.5, cost: 0.05 },
    { name: "MiniMax M3", index: 44, obedience: 82.9, cost: 0.14 },
    { name: "GPT-5.6 Terra", index: 55, obedience: 71.2, cost: 0.51 },
    { name: "GLM 5.2", index: 51, obedience: 73.3, cost: 0.57 },
    { name: "GPT-5.6 Sol", index: 58, obedience: 72.7, cost: 0.83 },
    { name: "Qwen3.7 Max", index: 46, obedience: 80.5, cost: 1.08 },
    { name: "Claude Fable 5", index: 60, obedience: 63.5, cost: 3.15 },
  ],
};

// Obedient Capability per Dollar for one input row. Obedience enters as a fraction so the
// score reads as "obedience-weighted index points per task dollar".
export function oceScore(row) {
  return Math.round((row.index * (row.obedience / 100)) / row.cost);
}

export function modelRankingsFooter() {
  const ranked = MODEL_RANKINGS.inputs
    .map((r) => ({ ...r, oce: oceScore(r) }))
    .sort((a, b) => b.oce - a.oce);
  const rows = ranked
    .map((r, i) => `<span class="machine-url">${i + 1}. ${r.name} <code>${r.oce.toLocaleString("en-US")}</code> = (${r.index} &times; ${r.obedience}%) &divide; $${r.cost.toFixed(2)}</span>`)
    .join("");
  const formula =
    `<span class="machine-url">Obedient capability per dollar: score = (intelligence index &times; obedience) &divide; measured cost per task. Each row shows its own arithmetic.</span>` +
    `<span class="machine-url">Inputs, all read ${MODEL_RANKINGS.read_at} from ${MODEL_RANKINGS.source_name}: intelligence index (their composite evaluation, points), obedience (Ai2 IFBench, % of machine-checked instructions followed), cost per task (USD, measured on their task suite). No other weights.</span>`;
  return `<div><span class="ds-foot-h">Current model rankings</span>${formula}${rows}<a href="/model-index">Live figures, each with its source and read date</a><a href="/a/which-ai-models-are-winning">How this is measured, and what it cost to find out</a></div>`;
}
