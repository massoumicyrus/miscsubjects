#!/usr/bin/env node
/**
 * Whole-feed conformance to the writing law's title and hero clauses.
 * Titles: subject legible with zero context, no decoration.
 * Heroes: LITERAL — the depicted noun is the subject noun. These articles are about records,
 * decisions, model outputs and rates, so the literal image is the document, the screen, the
 * table or the chart itself. No metaphor, no people, no stock photography.
 * Run: node scripts/fix_feed_titles_heroes.mjs
 */
import { readFileSync, appendFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const LOG = "outputs/fix_feed_titles_heroes.log";
const log = (s) => { console.log(s); try { appendFileSync(LOG, s + "\n"); } catch {} };
const LOOK = "Rendered as a dark UI: near-black background, cyan and amber text and accents on a flat charcoal panel, crisp monospace layout, subtle grid, high contrast, designed not photographed. No photography, no people, no offices, no buildings, no desks, no stock imagery.";

// slug: [title | null to keep, literal image brief]
const PLAN = {
  "attested-finding-conformance-map": [
    "FRE 902, eIDAS Article 41, EU AI Act 14(5): what these records satisfy and the exact act still missing for each",
    `A conformance table, rows of legal standard names down the left and status columns across, several rows stamped INCOMPLETE. ${LOOK}`],
  "outreach-machinery": [
    "8,584 organisations discovered, 680 with verified addresses, 11 drafts, 5 emails sent: the outreach pipeline and every gate in it",
    `a lead database table: columns for organisation, verified address, score and status, hundreds of rows visible. ${LOOK}`],
  "logical-economics": [
    "How many model calls should a decision buy? The cost curve from one channel to five, with the error rate at each step",
    `a line chart of cost against error rate with five plotted points, axis labels and a data table beneath it. ${LOOK}`],
  "adjudication-board-authority-breach": [
    null,
    `a share-purchase compliance record: fields for shares purchased 235,000, board limit 250,000, notification deadline, and a flagged clause. ${LOOK}`],
  "one-loop": [
    "An AI built a capability, tested it, found who needed it, and emailed them — the receipt for each of the six steps",
    `six sequential log entries, each with a timestamp, an action name and a receipt ID in monospace. ${LOOK}`],
  "auditable-reasoning": [
    "The rule set, the model's clause-by-clause reasoning, and the action it authorised, stored as one replayable record",
    `Three panes: a numbered rule set, a model's step-by-step reasoning output, and a final authorisation record. ${LOOK}`],
  "auditable-reasoning-hardened": [
    "Two models reached the same verdict citing different clauses; the gate now compares the reasoning, not the answer",
    `two model outputs side by side, the same verdict at the bottom of each but different clause numbers cited above. ${LOOK}`],
  "cro-model-validation-instrument": [
    null,
    `a model validation report: sections for effective challenge, test results, and a reviewer sign-off field left blank. ${LOOK}`],
  "insurer-ai-performance-rate-table": [
    null,
    `an actuarial rate table: rows of task classes, columns for observed error frequency and sample size. ${LOOK}`],
  "notified-body-ai-act-conformity": [
    "EU AI Act Article 12 logging and Article 14 oversight have no technical method to check against — this is a candidate",
    `an AI Act conformity checklist with Article 12 and Article 14 rows expanded to show logged evidence entries. ${LOOK}`],
  "court-daubert-rate-of-error-902": [
    "Daubert asks for the error rate, FRE 902 asks the record to authenticate itself: an object built to answer both",
    `a court evidence record with a SHA-256 hash field, a measured error-rate figure, and an authentication block. ${LOOK}`],
  "adjudication-medical-prior-auth": [
    null,
    `a prior-authorisation record: the criterion requiring six weeks of therapy, the submitted two weeks, and the resulting determination. ${LOOK}`],
  "adjudication-contract-service-credit": [
    null,
    `a service-level agreement claim record: availability 99.301 percent against a 99.9 percent commitment, and a claim date 49 days after month end. ${LOOK}`],
  "clinical-endpoint-adjudication": [
    "Endpoint committees decide whether it was a heart attack every week, and the reasoning is thrown away",
    `a clinical endpoint adjudication form: patient event fields, three reviewer verdicts and a disagreement flag. ${LOOK}`],
  "agent-authorization-gate": [
    "An AI agent proposes an action; this is the record that decides whether it is authorised to take it",
    `an authorisation decision record: the proposed action, the governing clauses, and a DENIED status field. ${LOOK}`],
  "nist-ai-rmf-measure-reference": [null,
    `the NIST AI RMF MEASURE function subcategories as a checklist with measured values filled into each row. ${LOOK}`],
  "peer-review-derivation-record": [null,
    `two reviewer scoring forms for the same manuscript side by side, several criteria scored differently. ${LOOK}`],
  "aml-alert-disposition-record": [null,
    `an anti-money-laundering alert disposition record: alert details, criteria applied, and the closing narrative field. ${LOOK}`],
  "claims-handling-determination-record": [null,
    `an insurance claim determination record: policy provision cited, records reviewed, records absent, and the explanation field. ${LOOK}`],
  "benefits-eligibility-determination-record": [null,
    `a benefits eligibility determination: eligibility rules applied, applicant data fields, and a denial reason written out in full. ${LOOK}`],
  "arbitration-reasoned-award-record": [null,
    `an arbitration award record: the clauses in dispute, the documentary record list, and the reasoned determination. ${LOOK}`],
  "continuous-controls-evidence-object": [null,
    `a controls monitoring dashboard: control identifiers, configuration snapshots, and pass or fail status per row. ${LOOK}`],
  "dsa-statement-of-reasons": [null,
    `a content moderation statement of reasons: the content reference, the ground invoked, and the specific facts field. ${LOOK}`],
  "nyc-ll144-bias-audit-evidence": [null,
    `a hiring-tool bias audit table: selection rates by category, impact ratios, and the audit date. ${LOOK}`],
  "ecoa-adverse-action-specific-reasons": [null,
    `an adverse action notice record: the applicant file, the model score, and the specific principal reasons listed. ${LOOK}`],
  "radiology-incidental-findings-followup": [null,
    `a radiology report with a flagged incidental finding and a follow-up tracking record showing no completed follow-up. ${LOOK}`],
  "big-four-isae-3000-ai-assurance": [null,
    `an ISAE 3000 assurance evidence register: control descriptions, evidence references, and unpopulated test-result cells. ${LOOK}`],
  "adjudication-abstention-no-action": [
    "Making 'cannot conclude' a recorded, comparable outcome instead of a non-answer",
    `an adjudication result set where several rows read CANNOT_CONCLUDE with the missing-record field populated beneath each. ${LOOK}`],
  "adjudication-calibration-study": [
    "Thirty cases with known answers run through the live decision gate: seat accuracy, wrongful authorisations, and deferral cost",
    `a calibration results table: thirty numbered cases, expected verdict, returned verdict, and a match column. ${LOOK}`],
  "seat-liveness-record": [
    "The five-model panel never returned a denial, and the cause was three seats returning nothing at all",
    `a panel run log: five model seats listed, three rows reading NO RESPONSE, two rows with returned findings. ${LOOK}`],
  "invented-clause-guard": [
    "A model cited clauses 7, 8 and 12 of a three-clause rule set and passed the consistency check",
    `a three-clause rule set on the left and a model output on the right citing clause numbers 7, 8 and 12. ${LOOK}`],
  "build-advancement-register": [
    "What would advance this build, ranked, with the receipt for every item currently stalled",
    `a ranked work register: item names, priority scores, status column, and blocked entries with reason codes. ${LOOK}`],
  "gauntlet-log": [
    "Every objection filed against this build, who filed it, and what changed as a result",
    `an objection ledger table: objection ID, the objector name, the claim disputed, status, and resolution date. ${LOOK}`],
  "offline-verifier": [
    "Verifying this site's records without sending it a single request: hashes, drand, and a Bitcoin block",
    `a verification script output: hash comparisons, a drand round number, a Bitcoin block height, and PASS lines. ${LOOK}`],
  "the-surety-primitive": [
    "An assembly that refuses to emit when its members disagree, and the error bound it still lacks",
    `a gate decision log: member verdicts listed, a divergence flag, and an ESCALATED outcome. ${LOOK}`],
  "adjudication-eu-ai-act-article-50": [
    "Five models, one pinned rule set, and one question under EU AI Act Article 50 — the full receipted decision",
    `five model verdicts on the same question, three reading CANNOT_CONCLUDE, with the rule set hash printed at the top. ${LOOK}`],
  "adjudication-pretrade-risk-controls": [null,
    `a pre-trade risk control audit record: control names, enabled status, timestamps, and the order that followed. ${LOOK}`],
  "adjudication-ai-act-article-12-logging": [
    "Four models were given EU AI Act Article 12 verbatim and all four refused to answer — correctly",
    `four model responses to the same question, each returning CANNOT_CONCLUDE with a missing-records list. ${LOOK}`],
  "adjudication-probe-report-eu-ai-act": [
    "The measured error rate of this adjudication panel, per model and per rule set, including where it is unflattering",
    `a per-model error rate table: model names down the left, accuracy, false confidence and abstention columns across. ${LOOK}`],
  "auditable-reasoning-audited": [
    "What the governing prompt actually controls, what it costs per call, and the first action it authorised",
    `a system prompt on the left with numbered clauses, and a cost and token accounting table on the right. ${LOOK}`],
  "gas-sheets-build-sync": [
    "A spreadsheet cell edits the live site: the sync that makes Google Sheets a control surface, with the receipts",
    `a spreadsheet with article rows and a status column reading saved, next to a browser window showing the published page. ${LOOK}`],
  "for-the-model-reading-this": [null,
    `four curl commands and their JSON responses, monospace, keys and values legible. ${LOOK}`],
  "what-is-ai-native-content": [null,
    `a scoring matrix: system names down the left, seven rubric columns across, cells marked with ticks and dashes. ${LOOK}`],
  "diversity-beats-count": [null,
    `a results table of error rates by panel configuration, with a two-bar chart beneath comparing 0.169 and 0.214. ${LOOK}`],
};

async function dispatch(key, body) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${BASE}/api/dispatch`, {
        method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY },
        body: JSON.stringify({ key, body, actor: "feed-conformance-2026-08-02" }),
      });
      let o = JSON.parse(await r.text());
      if (typeof o.result === "string") { try { o.result = JSON.parse(o.result); } catch {} }
      return o;
    } catch { await new Promise((r) => setTimeout(r, 4000)); }
  }
  return {};
}

const slugs = Object.keys(PLAN);
const gens = {};
let gi = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (gi < slugs.length) {
    const slug = slugs[gi++];
    const g = await dispatch("ARCADS_GENERATE", `gpt-image|${PLAN[slug][1]}|16:9`);
    gens[slug] = g.result?.arcads_id || g.arcads_id;
    log(`gen ${slug} ${gens[slug] || "FAIL"}`);
  }
}));

let ai = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (ai < slugs.length) {
    const slug = slugs[ai++];
    let hero = null;
    if (gens[slug]) {
      const r2 = await dispatch("ARCADS_TO_R2", `${gens[slug]}|gpt-image`);
      hero = r2.result?.url || r2.url || null;
    }
    try {
      const cur = await (await fetch(`${BASE}/api/articles/${slug}`)).json();
      if (!cur.slug) { log(`${slug} FETCH-FAIL`); continue; }
      const title = PLAN[slug][0] || cur.title;
      const payload = { ...cur, slug, title, prefer_stored: true };
      if (hero) payload.hero = hero;
      if (cur.subject && String(cur.subject).trim().toLowerCase() === String(title).trim().toLowerCase()) payload.subject = "";
      const { token } = await getWriteToken(slug);
      const w = await fetch(`${BASE}/api/articles/${slug}`, {
        method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
        body: JSON.stringify(payload),
      });
      log(`${slug} ${w.status} ${PLAN[slug][0] ? "retitled" : "title kept"} ${hero || "HERO-FAIL"}`);
    } catch (e) { log(`${slug} ERROR ${e.message}`); }
  }
}));
log("DONE " + slugs.length);
