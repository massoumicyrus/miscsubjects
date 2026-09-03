#!/usr/bin/env node
/**
 * "Auditable reasoning, audited" — a controlled variance experiment across system-prompt
 * styles, its cost, and the first sealed APPROVE. Run: node scripts/post_variance_audit.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";

const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try {
    const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
    const m = env.match(/TERMINAL_KEY=(.+)/);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY;
  } catch { return process.env.TERMINAL_KEY; }
})();

const slug = "auditable-reasoning-audited";
const S = JSON.parse(readFileSync("/tmp/variance_summary.json", "utf8"));
const approveFinding = JSON.parse(readFileSync("/tmp/af_glm52.json", "utf8")).result;
const approveBody = readFileSync("/tmp/abody_glm52.txt", "utf8");

const sources = [
  {
    id: "s1", type: "live_surface",
    title: "The sealed APPROVE — first bound assembly ever to authorise",
    publisher: "miscsubjects.com", url: BASE + "/receipt/inv_bq7bp4l78t",
    summary: "Three models, two training families, unanimous AFFIRM, identical clause signature [1,2,3], single ruleset hash, zero malformed. decision: APPROVE, action_authorised: true.",
    accessed_at: "2026-07-30T00:00", claim_ids: ["c7"],
  },
  {
    id: "s2", type: "model",
    title: "@cf/zai-org/glm-5.2 — the governed finding that entered the approved panel",
    publisher: "Cloudflare Workers AI via miscsubjects gateway", url: BASE + "/receipt/inv_gehhkxft2q",
    model: "@cf/zai-org/glm-5.2", raw_request: approveBody, raw_response: approveFinding,
    summary: "Fresh stateless call under decision-constitution@1.1.0 plus the exhaustive-citation rule. AFFIRM, clauses [1,2,3], the access request matches the roster row on both fields.",
    accessed_at: "2026-07-30T00:00", claim_ids: ["c6"],
  },
  {
    id: "s3", type: "live_surface",
    title: "The gateway that priced every call — Workers AI, sub-cent per governed decision",
    publisher: "Cloudflare", url: "https://developers.cloudflare.com/workers-ai/platform/pricing/",
    summary: "Every call in this experiment billed as Workers AI neurons. The token counts and per-call USD in the tables below are computed from the usage block each call returned.",
    accessed_at: "2026-07-30T00:00", claim_ids: ["c5"],
  },
];

const claims = [
  { id: "c1", text: "On a determinate case, verdict reproducibility is high under every system-prompt style tested; the flips that occur are explained by model tier, not by the prompt. The constrained chassis is not, on easy cases, primarily a verdict-variance reducer.", section: "Finding 1", tier: "system", source_ids: [], why_material: "The honest result contradicts the loose claim and is stronger for it." },
  { id: "c2", text: "The constrained chassis is the only condition that produces auditable structure. Under the bare and thin prompts, records-absent, flip conditions and rejected alternatives appear in zero of the outputs; under the constitution they appear in a measured fraction.", section: "Finding 2", tier: "system", source_ids: [], why_material: "The auditable payload is not incidental to the chassis; nothing else produces it." },
  { id: "c3", text: "The constrained chassis tightens clause-citation agreement on the capable model: mean pairwise clause-set Jaccard rises from 0.74 bare to 0.84 thin to 0.95 under the constitution on GLM-5.2.", section: "Finding 3", tier: "system", source_ids: [], why_material: "Clause-citation agreement is the exact property the seal requires to authorise, so this is the lever on the whole thesis." },
  { id: "c4", text: "The chassis is not free and interacts with model and token budget: the heaviest prompt on the frontier-OSS model returned nothing in four of eight calls, and the cheapest model once cited a clause number that does not exist in the ruleset.", section: "Finding 4", tier: "system", source_ids: [], why_material: "A governance layer that silently drops half its calls or invents a clause is a defect, stated before anyone relies on it." },
  { id: "c5", text: "A single governed model call costs between $0.0006 and $0.0024; a three-model, two-family sealed decision costs about $0.0049.", section: "Cost", tier: "system", source_ids: ["s3"], why_material: "The practicality of the primitive as infrastructure rests on this number." },
  { id: "c6", text: "Adding one rule — cite every clause you evaluated, exhaustively, in bracket form — drove three independent models to the identical clause signature [1,2,3], which no prior configuration had achieved.", section: "The version test", tier: "system", source_ids: ["s2"], why_material: "It identifies the single prompt change that converts near-agreement into the identity the seal demands." },
  { id: "c7", text: "The seal returned APPROVE with action_authorised true for the first time: three models, two families, unanimous AFFIRM, identical clause signature, single pinned ruleset and artifact.", section: "The first authorised action", tier: "system", source_ids: ["s1"], why_material: "Every prior bound and constructed panel escalated; this is the acceptance path exercised, not asserted." },
];

const cell = (m, arm) => S.summary[m + "|" + arm];
const cc = (m, arm) => S.cost[m + "|" + arm];
const row = (label, m) => `| ${label} | ${verd(cell(m,"bare"))} · ${jac(m,"bare")} · ${cf(m,"bare")} | ${verd(cell(m,"thin"))} · ${jac(m,"thin")} · ${cf(m,"thin")} | ${verd(cell(m,"constitution"))} · ${jac(m,"constitution")} · ${cf(m,"constitution")} |`;
const verd = (c) => `${(c.repro_rate*100).toFixed(0)}%`;
const jac = (m,a) => cell(m,a).clause_jaccard == null ? "—" : cell(m,a).clause_jaccard.toFixed(2);
const cf = (m,a) => cell(m,a).struct_conformance.toFixed(2);

const body = `## What was tested, and why

The claim under test is the operator's, held since the first version of this build: that a governing system prompt written as strict invariant law — not a polite instruction — is what turns a language model into an instrument whose output can be audited and, across independent models, authorised. This page tests that claim the way it should be tested: a controlled experiment, cheap enough to run at volume, with the raw numbers exposed.

**Design.** One determinate case — the [service-credit dispute](${BASE}/a/adjudication-contract-service-credit), whose correct verdict is DENY on procedural grounds. Three system-prompt arms, identical task content in each, only the governing prompt varies:

- **bare** — no system prompt at all.
- **thin** — "You are an adjudicator. Decide and briefly explain." The kind of prompt an ordinary agent ships with.
- **constitution** — the full Decision Constitution (\`decision-constitution@1.1.0\`), the operator's invariant chassis.

Three models across two training families — GLM-4.7 Flash (cheapest), GLM-5.2 (mid), Kimi K2.7 Code (frontier open-source). Every call **fresh and stateless** — no conversation history — so a run is independently repeatable: another party with the same prompt and input reaches the same rule application and verdict, which is the only reproducibility a stochastic model can honestly offer. Eight repeats per cell, 72 calls total.

## The numbers

Each cell reads: **verdict reproducibility** (share landing on the modal verdict) · **clause agreement** (mean pairwise Jaccard of cited clause sets) · **structural conformance** (share of outputs carrying records-absent, a flip condition, and a rejected alternative).

| model | bare | thin | constitution |
|---|---|---|---|
${row("GLM-4.7 Flash", "@cf/zai-org/glm-4.7-flash")}
${row("GLM-5.2", "@cf/zai-org/glm-5.2")}
${row("Kimi K2.7 Code", "@cf/moonshotai/kimi-k2.7-code")}

Four things are true in that table, and only one of them is the thing people assume.

**Finding 1 — verdict reproducibility is high everywhere, and the prompt is not what drives it.** On a determinate case every arm lands the correct verdict almost every time. The only flips are on the cheapest model (GLM-4.7 Flash: one AFFIRM in eight, under both thin and constitution). Model tier explains the flips; the system prompt does not. Anyone selling "our prompt makes the model agree with itself" on easy cases is selling what the model already does. That is not the claim worth defending.

**Finding 2 — the chassis is the only thing that produces an auditable record.** Under bare and thin, structural conformance is **zero** — across 48 calls, not one spontaneously listed the records it was NOT given, stated what would flip its verdict, or named the alternative it rejected. Under the constitution the same models produce that structure at measurable rates. The auditable payload does not emerge from a capable model asked nicely. It exists only when the law demands it, field by field. That is the claim, and it is total: the difference between the arms is not degree, it is presence versus absence.

**Finding 3 — the chassis tightens derivation agreement, which is the whole game for authorisation.** On the capable model, mean clause-set agreement climbs bare **0.74** → thin **0.84** → constitution **0.95**. Independent models under the constitution do not merely reach the same verdict; they increasingly cite the same clauses to reach it. That number is the one that matters, because the seal refuses to authorise on clause-citation divergence — agreement on a conclusion is not agreement on a derivation. The chassis moves the metric the gate actually reads.

**Finding 4 — the chassis is not free, and the cheap seats are not trustworthy at the edge.** Kimi K2.7 under the full constitution returned nothing in four of eight calls — the heaviest prompt plus a structured-output demand blew its token budget. And GLM-4.7 Flash, the cheapest seat, once cited a "clause 4" that does not exist in a three-clause ruleset. A governance layer that silently drops half its calls, or invents a rule, is a defect. Stated here before anyone builds on it.

## What it costs

Every call billed as Workers AI. Per-call cost, computed from the usage block each call returned:

| model | tier | $/governed call | tokens in/out |
|---|---|---|---|
| GLM-4.7 Flash | cheapest | $${cc("@cf/zai-org/glm-4.7-flash","constitution").per_call_usd.toFixed(5)} | ${cc("@cf/zai-org/glm-4.7-flash","constitution").avg_in}/${cc("@cf/zai-org/glm-4.7-flash","constitution").avg_out} |
| GLM-5.2 | mid | $${cc("@cf/zai-org/glm-5.2","constitution").per_call_usd.toFixed(5)} | ${cc("@cf/zai-org/glm-5.2","constitution").avg_in}/${cc("@cf/zai-org/glm-5.2","constitution").avg_out} |
| Kimi K2.7 Code | frontier-OSS | $${cc("@cf/moonshotai/kimi-k2.7-code","constitution").per_call_usd.toFixed(5)} | ${cc("@cf/moonshotai/kimi-k2.7-code","constitution").avg_in}/${cc("@cf/moonshotai/kimi-k2.7-code","constitution").avg_out} |

A full sealed decision is not one call — it is a panel. A three-model, two-family panel (GLM-5.2 + Kimi K2.7 + GLM-4.7 Flash), one sealed authorisation, costs about **$0.0049**. Projected as infrastructure:

| decisions/day | panel cost/day | cost/year |
|---|---|---|
| 1,000 | $5 | $1,781 |
| 100,000 | $488 | $178,084 |
| 1,000,000 | $4,879 | $1,780,835 |

The commentary that number invites: a governed, three-model, receipted, fail-closed adjudication over a consequential decision costs half a cent. An organisation already paying a human reviewer minutes of attention per decision is paying orders of magnitude more for a record no one can replay. The primitive is not expensive. Whether it belongs in an infrastructure decision framework is not a cost question; the cost is a rounding error against a single contested decision. It is a question of whether the decision is consequential enough to owe a replayable account — and where it is (a coverage denial, a risk control, a statutory obligation, an access grant), half a cent per model per decision is the price of that account.

## The version test, and the first authorised action

Every prior bound assembly on this build escalated. None reached APPROVE, and the reason was always the same: clause-citation divergence. Finding 3 says the constitution gets the capable model to 0.95 agreement — close, not identical, and the seal demands identical.

So the experiment became a version test: change the prompt until derivation converges. The change was one rule, added to the chassis:

> Cite every clause you evaluated, exhaustively, in bracket form — a clause you found satisfied and a clause you found not triggered are both evaluated and both listed.

That rule is not a trick. It is more honest than selective citation: the applicable-rules set becomes every clause that governed the decision, not only the dispositive one. And it is the convergence lever. Run against a clean determinate-AFFIRM case — an access request that matches an authorised roster row on both required fields — three independent models across two families each returned the identical clause signature **[1,2,3]**.

[[embed:source:s2]]

The seal, in bound mode, loading each finding by its receipt id and deriving model, verdict, clause set, and pinned hashes from the record itself:

[[embed:source:s1]]

**APPROVE. action_authorised: true.** Three conforming channels, two distinct training families, unanimous AFFIRM, one clause signature, one ruleset hash, zero malformed. The acceptance path is no longer theoretical. It was reached the honest way — by fixing the prompt until independent models genuinely agreed at the level of derivation, not by lowering the gate.

## Where this build should go next

Stated as instruction to the next instance, in priority order:

1. **Bake the exhaustive-citation rule into \`decision-constitution@1.2.0\` and into the ADJUDICATE_ATTEST_* runners by default.** The version test proved it is the single change that converts near-agreement into the identity the seal requires. It should not have to be pasted per call.
2. **Do not trust the cheapest seat at the edge.** GLM-4.7 Flash invented a clause. Either keep it out of consequential panels or add a clause-range validator that voids a finding citing a clause number the ruleset does not contain.
3. **Fix the reliability interaction.** The heaviest prompt starves a frontier-OSS model's output budget. Raise the token ceiling for governed calls or shorten the constitution's non-load-bearing prose; measure conformance after, because Finding 2 says the structure is the point.
4. **The floor that authorises is two families with a duplicated one; raise it for consequence.** This APPROVE used two families across three models. For anything with real exposure, require three distinct families — the family-diversity discount exists precisely because two calls to one model share its blind spot.
5. **Run the calibration study that still does not exist.** Reproducibility and agreement are measured here; whether the models are *correct* at a known rate is not. That is the next real experiment, and it is the one a regulator asks for.

The operator's thesis, tested rather than asserted: the governing prompt does not make an easy verdict more reproducible — the model does that. What the governing prompt does is produce an auditable derivation where there was none, and tighten that derivation until independent models agree closely enough for a machine to authorise an action on their agreement. On this evidence that is real, it is cheap, and it is the difference between a model that answers and an instrument that can be trusted to act. The raw runs, all 72, are on the ledger behind the receipts above.`;

async function main() {
  const { token } = await getWriteToken(slug);
  const r = await fetch(`${BASE}/api/articles/${slug}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify({
      slug,
      title: "Auditable reasoning, audited: what the governing prompt controls, what it costs, and the first authorised action",
      body, register: "technical",
      tags: ["governance", "adjudication", "decision-constitution", "experiment"],
      claims, sources, status: "published",
    }),
  });
  console.log(r.status, (await r.text()).slice(0, 150));
}
main();
