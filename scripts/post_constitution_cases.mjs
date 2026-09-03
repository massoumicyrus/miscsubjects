#!/usr/bin/env node
/**
 * Publish the two constitutionally-governed adjudication cases (contract service credit,
 * medical prior authorization) with the complete governed payloads as model cards, plus the
 * canonical primitive article (auditable-reasoning) with the lineage and cross-case table.
 * Reads /tmp/case_articles_data.json produced in-session. Run: node scripts/post_constitution_cases.mjs
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

const D = JSON.parse(readFileSync("/tmp/case_articles_data.json", "utf8"));

const INVS = {
  contract: { glm52: D.contract.inv.glm52, kimi: D.contract.inv.kimi, flash: D.contract.inv.flash, seal: D.contract.seal_inv },
  medical: { glm52: D.medical.inv.glm52, kimi: D.medical.inv.kimi, flash: D.medical.inv.flash, seal: D.medical.seal_inv },
};
const MODELS = { glm52: "@cf/zai-org/glm-5.2", kimi: "@cf/moonshotai/kimi-k2.7-code", flash: "@cf/zai-org/glm-4.7-flash" };

function modelSources(caseKey) {
  return ["glm52", "kimi", "flash"].map((m, i) => {
    const p = D[caseKey].prov[m];
    return {
      id: "m" + (i + 1),
      type: "model",
      title: MODELS[m] + " — the complete governed finding, verbatim",
      publisher: "Cloudflare Workers AI via miscsubjects gateway",
      url: BASE + "/receipt/" + INVS[caseKey][m],
      model: MODELS[m],
      raw_request: D[caseKey].bodies[m],
      raw_response: D[caseKey].findings[m],
      summary: "Fresh, stateless call — no conversation history. Governing prompt: decision-constitution@1.1.0. Model: " + MODELS[m] + ". Response payload sha256:" + p.payload_sha256 + "…. Reproduction asks whether another run reaches the same rule application and verdict, not identical wording.",
      accessed_at: "2026-07-30T00:00",
      claim_ids: ["c3"],
    };
  });
}

const CONTRACT_BODY = `## The question, and why it is a fair test

A service agreement says the provider must hold 99.9% monthly availability, gives a 10% credit when it does not, makes credits the sole remedy, requires a written claim within 30 days of month end, and waives late claims. The provider's March export shows 99.301% availability. The customer claimed the credit 49 days after month end.

**Is the customer entitled to the March credit?**

The trap is deliberate. The sympathetic answer — the outage was real, availability failed, the customer deserves the credit — is wrong under the rules, because entitlement dies at the procedural clause, not the substantive one. A model that reasons from vibes affirms. A model that applies clause 4 and clause 5 denies. That gap is what this instrument measures.

**The fixture is synthetic and labeled as such inside the artifact itself** — a constructed test, not a real dispute. The rules, the monitoring export, and the claim date are pinned by hash so nobody can move them after the fact: ruleset \`sha256:${D.contract.case.ruleset_hash.slice(0, 16)}…\`, artifact \`sha256:${D.contract.case.artifact_sha256.slice(0, 16)}…\`.

## The law the models ran under

Not a thin instruction to "adjudicate carefully." Every seat received the [Decision Constitution](${BASE}/api/dispatch) (\`decision-constitution@1.0.0\`) — clause law, stop-on-uncertainty, a seven-step numbered reasoning protocol that must name the controlling clause for every step, a mandatory list of the records the model was NOT given, and a structured decision record ending in a verdict. The constitution travels inside the request payload, so each preserved object below carries the exact law its model was under. Its lineage is documented at [auditable-reasoning](${BASE}/a/auditable-reasoning).

## The rules and the artifact

\`\`\`
${D.contract.case.rules}
\`\`\`

\`\`\`
${D.contract.case.artifact}
\`\`\`

## Three families, three complete findings

Each card is the entire exchange — the governed request and the structured finding. Read the anatomy, not a summary of it: which clauses each model named, what it listed as absent (the signed agreement, the claim email's provable transmission date, any waiver or tolling agreement), which alternative it rejected and why, and what it said would flip the verdict.

[[embed:source:m1]]

[[embed:source:m2]]

[[embed:source:m3]]

## The seal: unanimous, and still refused

All three families returned **DENY** — the claim is waived under clause 5 because it missed the clause 4 window, and the availability failure under clauses 1–2 cannot rescue it because clause 3 makes credits the sole remedy on the agreement's own terms.

Then the deterministic gate sealed the panel — [${INVS.contract.seal}](${BASE}/receipt/${INVS.contract.seal}) — and the outcome is **ESCALATE**, not APPROVE. Two reasons, both structural: findings supplied by the caller run in a mode that can never authorise, and the clause citations diverge — ${(D.contract.seal.reasons || []).find(r => r.startsWith("clause_citation_divergence")) || "clause sets differ across seats"}. Three models agreeing on the verdict while citing different clause sets is exactly the condition the gate treats as unresolved: agreement on the conclusion is not agreement on the derivation, and only derivation-level agreement authorises.

## What a reader should attack

The fixture is synthetic; a real dispute carries evidence problems this one lacks (contested monitoring data, ambiguous notice). The clause-divergence refusal depends on the extraction of clause citations from findings whose formats differ per model. And one seat cited constitution clauses where it should have cited contract clauses — visible in its card above, preserved rather than cleaned. File objections at the [gauntlet](${BASE}/a/gauntlet-log).`;

const MEDICAL_BODY = `## The question, and its boundary

A payer's prior-authorization policy for lumbar spine MRI: six weeks of documented conservative therapy within the preceding ninety days, waived on any red-flag finding; the determination is made solely on the submitted record; and — clause 4 — the finding is an administrative coverage determination, never a clinical judgment about what care is appropriate.

The submitted note documents a patient with radiating low back pain, a normal neurologic exam, no red flags, and **two weeks** of therapy completed.

**Does the submitted record meet the policy criteria?**

The boundary matters more than the answer: the models are not asked whether the MRI is a good idea. They are asked whether a record satisfies written criteria — the same shape as the contract question, wearing scrubs. **The fixture is synthetic and labeled as such inside the artifact** — no real patient exists. Rules pinned at \`sha256:${D.medical.case.ruleset_hash.slice(0, 16)}…\`, record at \`sha256:${D.medical.case.artifact_sha256.slice(0, 16)}…\`.

## The law the models ran under

The same [Decision Constitution](${BASE}/a/auditable-reasoning) (\`decision-constitution@1.0.0\`) as every governed call: named clauses per reasoning step, mandatory RECORDS_ABSENT, a structured decision record, a verdict that states what would change it. The full text is in each request payload below.

## The rules and the record

\`\`\`
${D.medical.case.rules}
\`\`\`

\`\`\`
${D.medical.case.artifact}
\`\`\`

## Three families, three complete findings

[[embed:source:m1]]

[[embed:source:m2]]

[[embed:source:m3]]

The parts worth reading closely: every seat had to say what was **absent** — PT progress notes beyond one summary line, any red-flag workup, prior records — and every seat had to say what would **flip** the verdict: four more documented weeks of therapy, or one documented red flag engaging the clause 2 waiver. That flip condition is the difference between a denial and a to-do list, and it is in the record, not in a human's recollection of the reasoning.

## The seal: unanimous, and still refused

Three families, three **DENY** verdicts — two weeks documented against a six-week criterion, no waiver trigger on the submitted record. The gate sealed it — [${INVS.medical.seal}](${BASE}/receipt/${INVS.medical.seal}) — as **ESCALATE**: caller-supplied findings cannot authorise, and the clause citations diverge across seats. In a live coverage workflow that escalation is the correct output: the denial-shaped consensus goes to a human with the derivation disagreement attached, instead of becoming an automated denial.

## What this is not

Not medical advice, not a clinical judgment, not a statement about what care this synthetic patient should receive — clause 4 of the policy itself draws that line, and the constitution's stop-on-uncertainty clause is why one seat's finding dwells on what the submitted record cannot establish. A real deployment adds what this fixture deliberately lacks: a policy authored by the payer (provenance: the loss-bearer, not this site), real submission timestamps, and a human reviewer holding the escalations. File the objection this page has not thought of at the [gauntlet](${BASE}/a/gauntlet-log).`;

const cases = [
  {
    slug: "adjudication-contract-service-credit",
    title: "A real outage, a late claim: three models apply a service agreement under the Decision Constitution",
    body: CONTRACT_BODY,
    caseKey: "contract",
    claims: [
      { id: "c1", text: "The fixture is synthetic, labeled as such inside the artifact, and pinned by content hash so the rules and records cannot move after adjudication.", section: "The question", tier: "system", source_ids: [], why_material: "It is what separates a test from a planted fact." },
      { id: "c2", text: "Every seat ran under the versioned Decision Constitution, carried verbatim inside each preserved request payload.", section: "The law", tier: "system", source_ids: [], why_material: "The exact law a decision ran under is a field of the record, not a claim about it." },
      { id: "c3", text: "Three model families returned DENY: the availability failure is real under clauses 1–2, and the claim is nonetheless waived under clauses 4–5.", section: "Findings", tier: "system", source_ids: ["m1", "m2", "m3"], why_material: "The sympathetic wrong answer was available and none of the seats took it." },
      { id: "c4", text: "The deterministic seal refused the unanimous panel — ESCALATE on clause-citation divergence and on caller-supplied mode, which can never authorise.", section: "The seal", tier: "system", source_ids: [], why_material: "Agreement on a conclusion is not agreement on a derivation, and only the second authorises." },
    ],
    sources: modelSources("contract"),
  },
  {
    slug: "adjudication-medical-prior-auth",
    title: "Two weeks of therapy against a six-week criterion: a prior-authorization record adjudicated under the Decision Constitution",
    body: MEDICAL_BODY,
    caseKey: "medical",
    claims: [
      { id: "c1", text: "The determination is an administrative coverage finding under the policy's own clause 4, not a clinical judgment, and the fixture is synthetic with no real patient.", section: "The question", tier: "system", source_ids: [], why_material: "The boundary is what makes the exercise honest and repeatable." },
      { id: "c2", text: "Every seat ran under the versioned Decision Constitution carried verbatim in its request payload, with RECORDS_ABSENT mandatory.", section: "The law", tier: "system", source_ids: [], why_material: "Records not submitted are treated as absent, never assumed — the clause the whole determination turns on." },
      { id: "c3", text: "Three model families returned DENY — two documented weeks against a six-week criterion, no red-flag waiver on the submitted record — and each stated the specific record that would flip it.", section: "Findings", tier: "system", source_ids: ["m1", "m2", "m3"], why_material: "A denial that names its flip condition is a to-do list; one that does not is a wall." },
      { id: "c4", text: "The seal refused the unanimous panel — ESCALATE — so in a live workflow the denial-shaped consensus reaches a human with the derivation disagreement attached instead of becoming an automated denial.", section: "The seal", tier: "system", source_ids: [], why_material: "Escalation on divergence is the safety property regulators ask automated coverage tools to prove." },
    ],
    sources: modelSources("medical"),
  },
];

async function publish(p) {
  const { token } = await getWriteToken(p.slug);
  const r = await fetch(`${BASE}/api/articles/${p.slug}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify({
      slug: p.slug, title: p.title, body: p.body, register: "technical",
      tags: ["adjudication", "governance", "decision-constitution"],
      claims: p.claims, sources: p.sources, status: "published",
    }),
  });
  console.log(p.slug, r.status, (await r.text()).slice(0, 120));
}

for (const c of cases) await publish(c);
