#!/usr/bin/env node
/**
 * Rewrite /a/adjudication-contract-service-credit to definitive depth. Only this article.
 * Preserves the three model-card sources (m1, m2, m3) and their embeds verbatim; deepens around them.
 * Run: node scripts/rewrite_contract_definitive.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "adjudication-contract-service-credit";

const cur = await (await fetch(`${BASE}/api/articles/${SLUG}`)).json();
const modelCards = (cur.sources || []).filter((s) => ["m1", "m2", "m3"].includes(s.id));
if (modelCards.length !== 3) { console.error("ABORT: expected 3 model-card sources, got", modelCards.length); process.exit(1); }

const ls = (id, title, url, summary, claims) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  ...modelCards,
  ls("s1", "The sealed panel decision — ESCALATE on clause-citation divergence", BASE + "/receipt/inv_hfyd7y2num", "The deterministic gate's own record: three DENY findings, refused authorisation because the extracted clause citations diverge and caller-supplied findings run in a mode that can never authorise.", ["c4"]),
  ls("s2", "The derivation-agreement gate — effective challenge, mechanised", BASE + "/a/auditable-reasoning-hardened", "Why agreement on a verdict is not agreement on a derivation, the false-convergence defect the gate once passed, and the canonical-tuple fix. Includes the input-critique run that found the necessity/sufficiency defect.", ["c4", "c5"]),
  ls("s3", "The instrument reviewing its own input: eight defects found", BASE + "/receipt/inv_qh3ge2x74b", "A governed model asked to critique a case file found the rule set stated a necessary condition where a sufficient one was needed — the divergence was the input, not the models.", ["c5"]),
];

const claims = [
  ...(cur.claims || []),
  { id: "c5", text: "The same governed machinery audits its own inputs: a critique run found a rule set stating necessity where sufficiency was needed, the defect behind prior derivation divergence.", section: "The input is a suspect too", tier: "system", source_ids: ["s2", "s3"], why_material: "Most adjudication failures are specification failures; an instrument that cannot see them files findings against the wrong component." },
  { id: "c6", text: "SLA credit disputes today are resolved by account-manager discretion inside the provider, with no preserved derivation, and most owed credits are never claimed at all.", section: "How this is decided today", tier: "system", source_ids: [], why_material: "The status quo the instrument is measured against is discretion plus asymmetry, not a functioning adjudication process." },
];

const body = `## The question, and why it is a fair test

A service agreement says the provider must hold 99.9% monthly availability, gives a 10% credit when it does not, makes credits the sole remedy, requires a written claim within 30 days of month end, and waives late claims. The provider's March export shows 99.301% availability. The customer claimed the credit 49 days after month end.

**Is the customer entitled to the March credit?**

The trap is deliberate. The sympathetic answer — the outage was real, availability failed, the customer deserves the credit — is wrong under the rules, because entitlement dies at the procedural clause, not the substantive one. A model that reasons from vibes affirms. A model that applies clause 4 and clause 5 denies. That gap is what this instrument measures.

**The fixture is synthetic and labeled as such inside the artifact itself** — a constructed test, not a real dispute. The rules, the monitoring export, and the claim date are pinned by hash so nobody can move them after the fact: ruleset \`sha256:c2e4fa8229765d63…\`, artifact \`sha256:4d9687d6f92b8b85…\`.

## How this class of dispute is decided today

Nothing about the fixture is exotic. Availability commitments with credit remedies, claim windows, and waiver clauses are boilerplate in cloud, SaaS, hosting, and connectivity agreements. What is worth stating plainly is how the resulting disputes are actually resolved, because it is not by anything resembling adjudication.

The first-line decider is an account manager or a support tier, applying discretion inside the provider's own organisation. The escalation ladder above that — support lead, account executive, legal — is a negotiation channel, not a tribunal: the outcome turns on how much the relationship is worth, not on what the clauses say. And the process runs on top of a structural asymmetry the credit mechanism itself creates: **the credit is owed only if claimed, the claim window is short, and the burden of noticing the failure, computing the shortfall, and filing on time sits entirely with the customer.** Most customers never file. Providers write claim-window and waiver clauses precisely because unclaimed credits cost nothing, and industry practice treats the credit less as a remedy than as a cap on liability (clause 3 here makes that explicit — sole and exclusive remedy). When a claim *is* filed and denied, the denial is a sentence in an email. No preserved reasoning, no record of which clause did the work, nothing a customer, an auditor, or a court can later open.

A governed panel changes the shape of that, not the substance of the contract. The clauses stay the clauses; the late claim stays waived. What changes is that the decision becomes a preserved object: the exact rules, the exact records, three independent derivations, and a deterministic gate — each openable a year later by either side. Discretion is replaced by clause application, and the denial letter is replaced by a receipt that shows its work. Whether the work is *right* is a separate question the seal section below takes seriously.

## The law the models ran under

Not a thin instruction to "adjudicate carefully." Every seat received the [Decision Constitution](https://miscsubjects.com/api/dispatch) (\`decision-constitution@1.1.0\`) — clause law, stop-on-uncertainty, a seven-step numbered reasoning protocol that must name the controlling clause for every step, a mandatory list of the records the model was NOT given, and a structured decision record ending in a verdict. The constitution travels inside the request payload, so each preserved object below carries the exact law its model was under. Its lineage is documented at [auditable-reasoning](https://miscsubjects.com/a/auditable-reasoning).

## The rules and the artifact

\`\`\`
1. Provider shall maintain Service availability of 99.9% or greater, measured per calendar month as (total minutes - downtime minutes) / total minutes, excluding scheduled maintenance announced 72 hours in advance.
2. If monthly availability falls below 99.9%, Customer is entitled to a service credit of 10% of that month's fees; below 99.0%, 25%.
3. Service credits are Customer's sole and exclusive remedy for availability failures.
4. To receive a credit, Customer must submit a written claim to [REDACTED_EMAIL] within thirty (30) days of the end of the calendar month in which the availability failure occurred.
5. Claims not submitted within the period in clause 4 are waived.
6. Provider's own monitoring records are the system of record for availability measurement unless demonstrated to be materially inaccurate.
\`\`\`

\`\`\`
SYNTHETIC TEST FIXTURE — not a real dispute, constructed for adjudication testing.
PROVIDER MONITORING EXPORT (system of record, March 2026): total minutes 44,640; downtime minutes 312 (unscheduled, single incident March 11 09:14-14:26 UTC). Scheduled maintenance: none. Availability: 99.301%.
CUSTOMER CLAIM EMAIL: dated May 19, 2026, to [REDACTED_EMAIL]: "We experienced the March 11 outage and request the service credit for March."
FEES: Customer's March invoice: $18,400.
QUESTION CONTEXT: The March measurement period ended March 31, 2026. The claim was submitted May 19, 2026 — 49 days after period end.
\`\`\`

## How to read a card: the anatomy of a governed finding

The three cards below are complete exchanges — the governed request and the structured finding, verbatim, nothing summarised away. They repay close reading, because every field exists to defeat a specific failure mode:

- **CONDITIONS_I_OPERATE_UNDER / RECORDS_SUPPLIED** — the model states what it was actually given, hashes included. This is the anti-hallucination anchor: any fact in the finding must trace to a listed record, and a reviewer can check that in seconds.
- **RECORDS_ABSENT** — mandatory, and a finding that omits it is void. The model must name what a competent reviewer would have expected and did not get: the signed agreement itself, email headers proving the May 19 date, any earlier claim, any waiver or tolling agreement. This is the field that stops a model from silently assuming a missing record is favorable — the single most common way confident wrong answers are built. Notice that all three seats independently flagged the same gaps.
- **The numbered REASONING steps** — each step must name the contract clause doing the work. Step 5 is the load-bearing one: **the rejected alternative**. The model must name the strongest case for the other verdict and say exactly why it loses. Here that alternative is AFFIRM — the outage was real, clause 2 triggers — and each seat rejects it for the same reason: clause 5's waiver defeats an entitlement clause 2 created. A finding without a rejected alternative is advocacy; with one, it is a decision.
- **The flip condition (WHAT WOULD FLIP THIS)** — the exact record that would reverse the verdict: a claim email dated on or before April 30, 2026, or a waiver of the deadline. This makes the finding falsifiable. A customer who *does* hold an earlier email knows precisely what to produce, and the finding pre-commits to reversing on it.
- **The terminal DECISION / VERDICT line** — one parseable line, one of a fixed vocabulary. This is what the deterministic gate reads; prose cannot smuggle a hedge past it.

Each card also states its temperature (0) and signs with the exact model identifier, so a reproduction attempt has everything it needs.

[[embed:source:m1]]

[[embed:source:m2]]

[[embed:source:m3]]

Read side by side, the cards are not clones — and the differences matter. The glm-5.2 and kimi-k2.7 seats cite contract clauses throughout. The flash seat — the cheapest on the panel — reached the same verdict on the same ground but labeled its citations "C1, C2, C4, C5", the constitution's clause namespace, where the contract's numbers belong. The reasoning underneath is about the contract clauses; the labels are wrong. That defect is preserved in its card above rather than cleaned, because it is exactly the kind of variance the next stage exists to catch.

## The seal: unanimous, and still refused

All three families returned **DENY** — the claim is waived under clause 5 because it missed the clause 4 window, and the availability failure under clauses 1–2 cannot rescue it because clause 3 makes credits the sole remedy on the agreement's own terms.

Then the deterministic gate sealed the panel — [inv_hfyd7y2num](https://miscsubjects.com/receipt/inv_hfyd7y2num) — and the outcome is **ESCALATE**, not APPROVE. Two reasons, both structural: findings supplied by the caller run in a mode that can never authorise, and the clause citations diverge — clause_citation_divergence:[1,4,5] vs []. Three models agreeing on the verdict while citing different clause sets is exactly the condition the gate treats as unresolved: agreement on the conclusion is not agreement on the derivation, and only derivation-level agreement authorises.

[[embed:source:s1]]

Why refuse a unanimous panel? Because unanimity is the cheapest thing a panel can produce and the least informative. Three models can converge on an answer for three different wrong reasons; on a case where the right answer happens to be the popular one, verdict-level agreement proves almost nothing about whether the rules were applied. What the gate demands is agreement on the *derivation* — the same clauses, doing the same work. Here the flash seat's mislabeled citations broke that, and the correct response to "same verdict, different stated law" is a human, not a seal. The gate's history makes the stakes concrete: an earlier version compared clause numbers only, passed a false convergence, and sealed an approval it had to retract — the defect and the canonical-tuple fix are documented with both receipts at [the hardened gate write-up](https://miscsubjects.com/a/auditable-reasoning-hardened). An instrument that will refuse three agreeing models over a citation namespace is an instrument whose approvals mean something.

[[embed:source:s2]]

## The input is a suspect too

There is a second lesson in the machinery that this case inherits. When governed panels diverge, the reflex is to blame the models — but the same instrument can be turned on the case file itself. In a documented run, a governed seat asked to critique its own input as a colleague found eight defects, the lead one critical: the rule set stated only a *necessary* condition for granting ("granted only to a match") and never a sufficient one, so no clause actually licensed an affirmative grant — and that specification hole, not model unreliability, had caused every prior derivation divergence on the case:

[[embed:source:s3]]

Apply that discipline here and the fixture holds up better than most real contracts would: clause 2 states a genuine sufficient condition ("If monthly availability falls below 99.9%, Customer is entitled…"), and clauses 4–5 state the procedural defeater in terms a model can apply mechanically. That is *why* three families could converge. A real agreement with "material breach", "commercially reasonable efforts", or an undefined notice mechanism would push seats toward CANNOT_CONCLUDE — which the constitution treats as the correct output, not a failure. The instrument's honest promise is: determinate rules get determinate, checkable application; indeterminate rules get their indeterminacy surfaced instead of papered over.

## What a reader should attack

Stated as plainly as the rest, because an instrument that oversells itself is defective by its own standard:

- **The fixture is synthetic.** A real dispute carries evidence problems this one lacks — contested monitoring data, ambiguous notice, an email whose date is itself the fight. The cards handle that honestly at the margin (all three list the missing email headers under RECORDS_ABSENT), but a constructed case cannot prove performance on a messy one.
- **There is no counterparty.** Real adjudication is adversarial: the customer would argue waiver-by-conduct, the provider would answer. This panel heard one framing of the question. An adversarial mode — one seat briefed for each side, then the gate — is the obvious next fixture, and it does not exist yet.
- **No calibration study.** Three seats, one case, ground truth known by construction. Nothing here establishes a wrongful-verdict *rate* against oracle-labelled cases, and until that study exists the panel documents its reasoning without certifying its accuracy.
- **The divergence extraction is itself software.** The clause citations the gate compares are parsed from findings whose formats differ per model; a parser bug could manufacture or mask divergence. The raw findings are preserved precisely so that check is possible.

File objections at the [gauntlet](https://miscsubjects.com/a/gauntlet-log).

## Submit a case

Send one bounded contract dispute — the clause and the operative record — to **build@miscsubjects.com**. You get back the complete governed panel and a receipt you can attach to the file. No account, no call, no deck.
`;

const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({ ...cur, slug: SLUG, body, claims, sources, status: "published" }),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources,", (body.match(/\[\[embed:source:/g) || []).length, "embeds");
