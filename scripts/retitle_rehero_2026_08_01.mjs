#!/usr/bin/env node
/**
 * Owner order 2026-08-01: new headlines (high-value, self-explaining, plain) and new
 * photorealistic on-subject heroes for the whole visible feed. the-build-end-to-end and
 * attested-finding-image-record-action are owner-approved and exempt; the three articles
 * published today already conform.
 * Run: node scripts/retitle_rehero_2026_08_01.mjs [--titles-only]
 */
import { readFileSync, appendFileSync } from "fs";
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
const TITLES_ONLY = process.argv.includes("--titles-only");
const LOG = join(process.cwd(), "outputs", "retitle_rehero_2026_08_01.log");
const log = (s) => { console.log(s); try { appendFileSync(LOG, s + "\n"); } catch {} };

const PHOTO = "Photorealistic, high-end editorial magazine photography, natural light, shallow depth of field. No text, no logos.";

// slug: [new title or null to keep, hero image brief]
const PLAN = {
  "benefits-eligibility-determination-record": [
    "Your benefits were denied by a rule engine. The law says you're owed reasons — this is the record that produces them",
    `A person at a kitchen table reading an official government denial letter, morning light, coffee cup, worried posture. ${PHOTO}`],
  "continuous-controls-evidence-object": [
    "Compliance checks run every day. Nobody can prove the judgment calls behind them — this record can",
    `A modern security operations center: analyst desks, large wall monitors with system-status dashboards, low blue light. ${PHOTO}`],
  "arbitration-reasoned-award-record": [
    "Arbitration is private, final, and rarely explains itself. Here is how small disputes get written reasons anyway",
    `An empty private mediation room: polished table, two chairs facing each other, a single folder and pen set in the middle. ${PHOTO}`],
  "claims-handling-determination-record": [
    "When AI helps deny an insurance claim, the law demands a reasonable explanation. This file proves one exists",
    `An insurance adjuster with a clipboard inspecting a storm-damaged house roof, ladder against the wall, overcast sky. ${PHOTO}`],
  "peer-review-derivation-record": [
    "Two committees reviewed the same papers and disagreed a quarter of the time — twice. Nothing recorded why, until now",
    `A tall stack of academic manuscripts on a desk, the top page covered in handwritten margin annotations in two different ink colors. ${PHOTO}`],
  "aml-alert-disposition-record": [
    "Banks close millions of money-laundering alerts with a sentence of narrative. Examiners reopen them. This record survives the reopening",
    `A bank compliance office at night: rows of monitors showing transaction lists, one analyst working late. ${PHOTO}`],
  "radiology-incidental-findings-followup": [
    "The scan flagged something. The follow-up never happened. This record proves what was missed, at the moment it mattered",
    `A radiologist alone in a dim reading room studying a chest CT scan on a large diagnostic monitor, face lit by the screen. ${PHOTO}`],
  "nist-ai-rmf-measure-reference": [
    "NIST tells you what to measure in an AI system. Nothing runnable exists to point at — this is a working candidate",
    `A precision metrology lab bench: calibrated instruments, dial gauges and a micrometer laid out in a row on brushed steel. ${PHOTO}`],
  "agent-authorization-gate": [
    "Your AI agent wants to act. Wanting is not permission — this is the gate that decides",
    `A modern office lobby security turnstile with glass barriers closed, one lane lit green and the rest red, nobody passing. ${PHOTO}`],
  "ecoa-adverse-action-specific-reasons": [
    "Denied credit by a model? You are owed the specific reasons — here is how they get produced at the moment of decision",
    `A person at a mailbox holding an opened bank letter, suburban street, late afternoon. ${PHOTO}`],
  "nyc-ll144-bias-audit-evidence": [
    "New York audits hiring algorithms once a year. The other 364 days run on the honor system — this is the record layer for them",
    `A job interview across a conference table: interviewer's hands on a stack of resumes, candidate slightly out of focus opposite. ${PHOTO}`],
  "gas-sheets-build-sync": [
    "A Google Sheet that runs an entire AI system: edit a cell, the site changes, and every change carries a receipt",
    `Close-up over the shoulder of hands on a laptop with a large spreadsheet open, second monitor showing a website, warm desk lamp. ${PHOTO}`],
  "oip": [
    "One kind of URL for everything: every tool, article and law here can be discovered and operated by any model, from one address",
    `A wall of identical labeled archive drawers in a modern records room, one drawer pulled open with light spilling out. ${PHOTO}`],
  "build-advancement-register": [
    "What would actually move this project forward, ranked — with a receipt for every stall",
    `A project war-room wall covered in an organized grid of sticky notes and printed cards, one card being moved by hand. ${PHOTO}`],
  "invented-clause-guard": [
    "An AI cited clauses 7, 8 and 12 of a three-clause contract — and passed the consistency check",
    `A magnifying glass held over a printed contract page, sharp focus on the numbered clauses, desk lamp glare. ${PHOTO}`],
  "seat-liveness-record": [
    "The five-member AI panel could never say no. Three of its five seats were returning nothing",
    `A long boardroom table with five chairs, three of them empty, dramatic window light. ${PHOTO}`],
  "adjudication-calibration-study": [
    "We ran 30 cases with known answers through the decision gate. Here is how often it was right, wrong, and honest about not knowing",
    `A multiple-choice answer sheet being graded with a red pen, some answers marked correct and some crossed out, close-up. ${PHOTO}`],
  "dsa-statement-of-reasons": [
    "Platforms file billions of 'statements of reasons' for takedowns. Almost all are templates — here is one that is not",
    `A content moderator's workstation: dual monitors with queued posts, headphones on the desk, office at dusk. ${PHOTO}`],
  "big-four-isae-3000-ai-assurance": [
    "Auditors are being asked to sign off on AI systems with no evidence to stand on. This is the missing piece",
    `An auditor in a glass-walled office reviewing thick ring binders, laptop open, city skyline behind. ${PHOTO}`],
  "clinical-endpoint-adjudication": [
    "Three doctors disagree on whether it was a heart attack. Trials pay committees to decide — then throw the reasoning away",
    `Three clinicians in a hospital conference room reviewing the same patient chart and ECG printouts, disagreement in body language. ${PHOTO}`],
  "adjudication-contract-service-credit": [
    "The outage was real. The claim was late. Watch three AI models apply the contract, clause by clause",
    `A server room aisle with one rack showing red status lights among green, emergency lighting. ${PHOTO}`],
  "adjudication-medical-prior-auth": [
    "The insurer denied the MRI after two weeks of physical therapy. The rule says six. Watch the decision get made properly",
    `A patient entering an MRI machine, technician at the control window, clinical white light. ${PHOTO}`],
  "court-daubert-rate-of-error-902": [
    "Courts ask expert evidence two questions: what is your error rate, and can the record prove itself. This object answers both",
    `A courtroom exhibit table with labeled evidence folders and a laptop, empty jury box behind, morning light through tall windows. ${PHOTO}`],
  "insurer-ai-performance-rate-table": [
    "Nobody can insure an AI's mistakes without knowing how often it is wrong. This table is that number",
    `An actuary's desk: printed rate tables, a mechanical pencil, and a desktop screen of charts, green banker's lamp. ${PHOTO}`],
  "notified-body-ai-act-conformity": [
    "Europe's AI Act demands logging and human oversight. Certifiers have no technical way to check either — this is one",
    `An inspector with a tablet walking a clean industrial floor, CE-style certification paperwork on a clipboard nearby. ${PHOTO}`],
  "adjudication-abstention-no-action": [
    "The rarest AI skill is saying 'I can't tell.' Here is how it became an official, checkable outcome",
    `An exam desk with a test paper where one answer field is deliberately left blank, pencil set down beside it, invigilation hall bokeh. ${PHOTO}`],
  "cro-model-validation-instrument": [
    "The Fed requires independent validation of models. For large language models no instrument existed — here is one",
    `The Marriner Eccles Federal Reserve building facade in Washington, wide angle, overcast sky. ${PHOTO}`],
  "auditable-reasoning-audited": [
    "We audited our own AI constitution: what it actually controls, what it costs, and the first action it authorized",
    `A dense legal document on a desk under an angled lamp, yellow highlighter marks and a fountain pen resting on it. ${PHOTO}`],
  "auditable-reasoning-hardened": [
    "Two AIs reached the same verdict for different reasons. The gate now catches that — because its first approval was exactly that failure",
    `Two identical signed documents side by side on a desk, a hand holding one up to the light to compare them. ${PHOTO}`],
  "auditable-reasoning": [
    "The rules, the reasoning, and the action — preserved as one object you can replay a year later",
    `A sealed archival evidence box on a steel shelf in a records vault, neatly labeled, single overhead light. ${PHOTO}`],
  "one-loop": [
    "An AI built a capability, proved it works, found who needs it, and wrote to them — with a receipt for every step",
    `A modern robotic assembly line: a single robotic arm passing a finished component down a lit conveyor. ${PHOTO}`],
  "outreach-machinery": [
    "How an AI decides who should hear about it, writes to them, and records why — every gate documented",
    `Inside a mail sorting facility: conveyor of envelopes moving through automated sorters, shallow focus on one envelope. ${PHOTO}`],
  "logical-economics": [
    "How much thinking should a decision buy? The arithmetic of paying for exactly enough AI reasoning",
    `A desk with a mechanical calculator, an open ledger, and a small stack of coins arranged in ascending columns, side light. ${PHOTO}`],
  "adjudication-board-authority-breach": [
    null,
    `A stock trading floor terminal showing a large order ticket on screen, suit-sleeved hand hovering over the keyboard. ${PHOTO}`],
  "adjudication-pretrade-risk-controls": [
    "Were the risk controls on before the algorithm started trading — and can anyone prove it?",
    `A trading-system server cabinet with a prominent physical emergency stop switch, cables neatly bundled, data center light. ${PHOTO}`],
  "adjudication-ai-act-article-12-logging": [
    "We gave four AIs the law verbatim and asked a simple question. All four refused to answer — correctly",
    `An empty courtroom witness stand with a microphone, dust in a shaft of window light. ${PHOTO}`],
  "attested-finding-conformance-map": [
    "Every legal standard this system almost satisfies — and the one missing signature for each",
    `A close-up of a compliance checklist with every box ticked except one, a pen resting beside the empty box. ${PHOTO}`],
  "gauntlet-log": [
    "Nineteen people and models attacked this system in public. Every objection, named and answered",
    `A fencing bout mid-lunge in a competition hall, scoreboard lights blurred behind. ${PHOTO}`],
  "offline-verifier": [
    "A verifier that checks whether this site is honest without ever asking this site anything",
    `A document examiner inspecting a paper under ultraviolet light in a dark forensics lab, the page glowing. ${PHOTO}`],
  "the-surety-primitive": [
    "An AI assembly that locks itself shut the moment its members disagree — and the one number it still needs",
    `A massive circular bank vault door, half open, polished steel, cool light. ${PHOTO}`],
  "adjudication-eu-ai-act-article-50": [
    "Five AIs, one law, one question — and a decision you can replay",
    `A row of European Union flags in front of the Berlaymont building in Brussels, dusk. ${PHOTO}`],
};

async function dispatch(key, body) {
  const r = await fetch(`${BASE}/api/dispatch`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": KEY },
    body: JSON.stringify({ key, body, actor: "retitle-rehero-2026-08-01" }),
    redirect: "follow",
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t.slice(0, 400), http: r.status }; }
}

async function processSlug(slug) {
  const [newTitle, brief] = PLAN[slug];
  let hero = null;
  if (!TITLES_ONLY) {
    const gen = await dispatch("ARCADS_GENERATE", `gpt-image|${brief}|16:9`);
    const id = gen.arcads_id || gen.result?.arcads_id;
    if (!id) { log(`${slug} GEN-FAIL ${JSON.stringify(gen).slice(0, 200)}`); }
    else {
      const r2 = await dispatch("ARCADS_TO_R2", `${id}|gpt-image`);
      hero = r2.url || r2.result?.url || null;
      if (!hero) log(`${slug} R2-FAIL ${JSON.stringify(r2).slice(0, 200)}`);
    }
  }
  const cur = await (await fetch(`${BASE}/api/articles/${slug}`)).json();
  if (!cur.slug) { log(`${slug} FETCH-FAIL`); return; }
  const payload = { ...cur, slug };
  if (newTitle) payload.title = newTitle;
  if (hero) payload.hero = hero;
  if (cur.subject && String(cur.subject).trim().toLowerCase() === String(payload.title).trim().toLowerCase()) payload.subject = "";
  const { token } = await getWriteToken(slug);
  const r = await fetch(`${BASE}/api/articles/${slug}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify(payload),
  });
  log(`${slug} ${r.status} title=${newTitle ? "NEW" : "kept"} hero=${hero || "kept"}`);
}

const slugs = Object.keys(PLAN);
const POOL = 4;
let i = 0;
await Promise.all(Array.from({ length: POOL }, async () => {
  while (i < slugs.length) { const s = slugs[i++]; try { await processSlug(s); } catch (e) { log(`${s} ERROR ${e.message}`); } }
}));
log("DONE " + slugs.length + " slugs");
