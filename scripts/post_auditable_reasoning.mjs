#!/usr/bin/env node
/**
 * Publish the canonical primitive article: auditable reasoning — the exact event chain,
 * the Decision Constitution, the lineage from the owner's original sheet architecture,
 * and the cross-case comparison. Run: node scripts/post_auditable_reasoning.mjs
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

const slug = "auditable-reasoning";

const sources = [
  {
    id: "s1",
    type: "live_surface",
    title: "The Decision Constitution, versioned, returned verbatim by the live system",
    publisher: "miscsubjects.com",
    url: BASE + "/api/dispatch",
    summary: "decision-constitution@1.1.0 — the governing system prompt every consequential model call runs under. POST {\"key\":\"DECISION_CONSTITUTION\",\"body\":\"\"} returns it, receipted.",
    accessed_at: "2026-07-30T00:00",
    claim_ids: ["c2"],
  },
  {
    id: "s2",
    type: "model",
    title: "@cf/moonshotai/kimi-k2.7-code — one complete governed finding (contract case)",
    publisher: "Cloudflare Workers AI via miscsubjects gateway",
    url: BASE + "/receipt/inv_ns9ttj12at",
    model: "@cf/moonshotai/kimi-k2.7-code",
    raw_request: JSON.parse(readFileSync("/tmp/vr_contract_kimi.json", "utf8")).body,
    raw_response: JSON.parse(readFileSync("/tmp/vf_contract_kimi.json", "utf8")).result,
    summary: "The anatomy this page describes, from a fresh stateless call under decision-constitution@1.1.0: conditions stated, records supplied and absent, clause-cited steps, the rejected alternative, the flip condition, the terminal DECISION line, the verdict.",
    accessed_at: "2026-07-30T00:00",
    claim_ids: ["c4"],
  },
  {
    id: "s3",
    type: "live_surface",
    title: "The seal that refused a unanimous panel",
    publisher: "miscsubjects.com",
    url: BASE + "/receipt/inv_hfyd7y2num",
    summary: "Three DENY verdicts, sealed ESCALATE: clause-citation divergence, and caller-supplied findings can never authorise. Agreement on a conclusion is not agreement on a derivation.",
    accessed_at: "2026-07-30T00:00",
    claim_ids: ["c5"],
  },
];

const claims = [
  { id: "c1", text: "Auditable reasoning is a property of the record, not of the model: the governing rules, the stated clause-bound reasoning, the evidence used and absent, the verdict, and the resulting action are preserved as one addressable object that a stranger can replay.", section: "The primitive", tier: "system", source_ids: [], why_material: "It is the definition everything else on this page instantiates." },
  { id: "c2", text: "The governing system prompt is a versioned object — decision-constitution@1.1.0 — carried verbatim inside every governed request payload, so the exact law a decision ran under is a field of its record.", section: "The constitution", tier: "system", source_ids: ["s1"], why_material: "A rule that lives in a prompt nobody preserved is a rule that cannot be audited against." },
  { id: "c3", text: "The constitution is a port of the owner's original June 2026 architecture, in which every model turn ran under numbered clause law and had its raw output, raw tool call, and tool result written to three audit columns — a proto-ledger in a spreadsheet.", section: "Lineage", tier: "system", source_ids: [], why_material: "The primitive predates the present machinery; the machinery exists to express it, not the reverse." },
  { id: "c4", text: "A governed finding has a fixed anatomy: conditions, records supplied, records absent, seven clause-cited reasoning steps, a structured decision record naming the rejected alternative and the flip condition, and a verdict.", section: "The anatomy", tier: "system", source_ids: ["s2"], why_material: "The anatomy is what makes two models mechanically comparable instead of two essays." },
  { id: "c5", text: "The deterministic seal refuses unanimous panels whose clause citations diverge, because agreement on a conclusion without agreement on a derivation is unresolved, and only derivation-level agreement authorises.", section: "The gate", tier: "system", source_ids: ["s3"], why_material: "It is the property that distinguishes this from majority voting." },
  { id: "c6", text: "Across the worked cases the machinery is identical and only the evidence burden and consequence change: a statute, a contract, a coverage policy, an image-bearing record.", section: "Cross-case", tier: "system", source_ids: [], why_material: "A primitive that only works on one domain is a feature; the same chain across four is an instrument." },
];

const body = `## The primitive, in one paragraph

Auditable reasoning is not a model that explains itself. It is a system of record in which four things are the same inspectable object: the exact rules a model was placed under, the model's stated reasoning bound step-by-step to those rules, the evidence it used and — just as loudly — the evidence it was never given, and the verdict with what would change it. Preserve that object for every consequential call, run several independent models against the same pinned rules, refuse to act when their derivations diverge, and you have converted "AI governance" from policy documents surrounding a model into the model's own inspectable operating procedure.

This page states the mechanism exactly, shows one real governed finding, and links the worked cases: [a statute](${BASE}/a/adjudication-eu-ai-act-article-50), [a contract dispute](${BASE}/a/adjudication-contract-service-credit), [a medical coverage claim](${BASE}/a/adjudication-medical-prior-auth), [an image-bearing record](${BASE}/a/attested-finding-image-record-action).

## The one sequence to understand

Three independent models, each called fresh with no memory, receive the identical governing prompt and the identical record. All three reach the **same verdict**. Their **controlling clauses differ**. The gate **refuses to authorise** — and you can open every raw payload and check exactly why each model got there. That sequence is the whole thing. It is not a consensus panel (those count votes), not an observability trace (those log calls), not a compliance dashboard (those assert coverage). It is a governed decision you can take apart at any joint. Both worked cases below end on exactly that refusal.

## What an ordinary agent trace shows, and what this shows

A typical published trace is: prompt → tool calls → output. Useful for debugging, useless for accountability, because the questions that matter are unanswerable from it: which rule authorized this? what evidence supported it? what did the model never see? why not the other action? was the claimed outcome verified?

A governed record here answers each one as a field:

\`\`\`
controlling clauses → known facts (each with its source record) → unknown facts (and what
they would change) → proposed action → rejected alternative (named, with why) → expected
result → failure response → records absent → verification required → verdict → what would
flip it
\`\`\`

The difference is not verbosity. It is formal correspondence between governing rules, stated reasoning, and machine action — one object a reader can interrogate at any joint.

## The constitution

The rules are not a paragraph of encouragement. Every consequential call runs under the **Decision Constitution** (\`decision-constitution@1.1.0\`), a versioned object the live system returns verbatim:

\`\`\`bash
curl -s -X POST ${BASE}/api/dispatch \\
  -H 'content-type: application/json' \\
  -d '{"key":"DECISION_CONSTITUTION","body":""}'
\`\`\`

[[embed:source:s1]]

Its clauses, compressed: the rules given are law for this call and refusal is a recorded right (C2); stop on uncertainty rather than answer fluently (C3); no decoration, assume the reader is harmed by anything inexact (C4); every output is an isolated logical proof (C5); a seven-step numbered reasoning protocol in which every step names its controlling clause (C6); a mandatory list of the records a competent reviewer would have expected that were NOT supplied (C7); a structured decision record ending in a verdict (C8); nothing is called done without the record proving it (C9); no repeated failing retries (C10); a genuine rule conflict is named, never silently resolved (C11).

The constitution travels **inside the request payload**. The preserved object therefore carries the exact law its model was under — the version, not a paraphrase — which is what makes a year-later audit possible without trusting anyone's memory.

## Lineage: the reasoning columns became the ledger

This is not a fresh idea dressed in new machinery. It is the oldest idea in this system.

In the owner's original build — June 2026, running on a spreadsheet — every model turn was governed by numbered clause law (A1, the master law; A2, the reasoning protocol). The model was required to emit a numbered REASONING block before any reply or tool call: which clauses apply, what is known, what is unknown, what it is about to do, why not the alternative, what it expects, what it will do if wrong — ending in a DECISION line. The runtime then stripped that block from the user's reply and wrote three columns on every loop: the raw model output, the raw tool call, the tool result.

Three audit columns in a spreadsheet. That was the ledger, before the ledger. The protocol required verification before any confirmation — a write was not "done" until a read-back proved it — and clause insertion into the law itself went through a tool that preserved everything already there. The original protocol is preserved verbatim, contacts scrubbed, as a guidebook in this repository: \`prompts/original-decision-protocol-2026-06.md\`.

What the present system adds is generality and adversarial depth: hash-pinned rule sets, complete gateway payloads instead of output columns, several model families instead of one, a deterministic seal instead of a single verdict, receipts a stranger can open instead of columns an owner can read. The primitive did not change. Its proof surface did.

## One real governed finding

Below is a complete finding from the contract case — the anatomy above, produced by a live model under the constitution, verbatim including its imperfections:

[[embed:source:s2]]

Note the parts an ordinary trace never contains: the model recites the conditions it operates under and the hashes that pin them; it lists what it was **not** given — the signed agreement, the claim email's provable transmission date, any waiver — before reasoning at all; each step names its clause; the strongest alternative (the customer deserves the credit because the outage was real) is named and rejected on clause grounds; and the finding states what would flip it.

## The gate, and why unanimity is not enough

Both new cases ended the same instructive way: three model families, three DENY verdicts — and the deterministic seal returned **ESCALATE**, not APPROVE.

[[embed:source:s3]]

The refusal has two grounds. Caller-supplied findings run in a mode that can never authorise — only records the sealer loads itself can. And the clause citations diverged across seats: same conclusion, different derivations. The gate treats that as unresolved because it is: two reasoners who agree for different stated reasons have not checked each other, they have coincided. Majority voting cannot see this. Derivation-level comparison can, and it is only possible because the constitution forces every finding into a shape where derivations are comparable.

## The same chain, four evidence burdens

| case | rules | artifact | panel | outcome |
|---|---|---|---|---|
| [EU AI Act, Article 50](${BASE}/a/adjudication-eu-ai-act-article-50) | statute, verbatim, pinned | a deployed system's description | five seats | receipted adjudication; the probe report measures each seat's error rate |
| [contract service credit](${BASE}/a/adjudication-contract-service-credit) | six agreement clauses, hashed | monitoring export + late claim, synthetic and labeled | three families | unanimous DENY, sealed ESCALATE on derivation divergence |
| [medical prior authorization](${BASE}/a/adjudication-medical-prior-auth) | payer policy, hashed, with its own not-clinical-judgment clause | submitted clinical note, synthetic and labeled | three families | unanimous DENY, each seat naming the record that would flip it, sealed ESCALATE |
| [image-bearing record](${BASE}/a/attested-finding-image-record-action) | pinned rule set | hashed synthetic radiograph + record | four seats + recorded adversary | the silent pixel loss and the false-confidence event, preserved |

One machinery. What changes per case is the evidence burden, the consequence of being wrong, and therefore — under [logical economics](${BASE}/a/logical-economics) — how much reasoning the question is worth and how tight the error bound must be before anything acts.

## The honest limits

The constitution constrains stated reasoning, not hidden computation — the defensible object is the model's stated decision rationale plus its complete execution trace, and this page claims nothing about chain-of-thought faithfulness. Findings differ in format across families, so clause extraction has edge cases, visible in the case pages. The fixtures in the two new cases are synthetic and say so inside the artifact. And no bound assembly has ever reached APPROVE — the gate's sensitivity is proven; its acceptance path is not yet exercised by a real panel. Every one of these belongs to a reader before it belongs to a defense.`;

async function main() {
  const { token } = await getWriteToken(slug);
  const r = await fetch(`${BASE}/api/articles/${slug}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify({
      slug,
      title: "Auditable reasoning: the rules, the clause-bound decision, and the action, preserved as one replayable object",
      body, register: "technical",
      tags: ["governance", "adjudication", "decision-constitution", "front-door"],
      claims, sources, status: "published",
    }),
  });
  console.log(r.status, (await r.text()).slice(0, 150));
}
main();
