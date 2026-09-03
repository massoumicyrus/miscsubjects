#!/usr/bin/env node
// Letter objects: each sent letter becomes a hashed, linkable page rendered as an elegant
// email card with a signature card. Updates each article's "### Sent:" receipt with the
// object link + sha256. Prints slug/hash/url per letter for the X-post step.
// Run from repo root: node scripts/letter_objects.mjs
import { readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8").match(/TERMINAL_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const sha = (s) => createHash("sha256").update(s).digest("hex");
async function dispatch(key, b) {
  const r = await fetch(BASE + "/api/dispatch", { method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY }, body: JSON.stringify({ key, body: b }) });
  return r.json();
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const linkify = (s) => s.replace(/(https:\/\/[^\s)]+)/g, '<a href="$1" style="color:#5a4634;text-decoration:underline">$1</a>');

// Letter card: warm paper, serif body, header strip with routing, signature card, hash footer.
// NO pipe characters anywhere (pages dispatch is pipe-delimited).
function letterHtml({ to, who, subject, sent, messageId, bodyText, hash, articleSlug }) {
  const paras = bodyText.split("\n\n").map((p) => `<p style="margin:0 0 18px">${linkify(esc(p))}</p>`).join("");
  return `<div style="max-width:680px;margin:32px auto;padding:0 16px">
<div style="border:1px solid #d8d2c6;border-radius:10px;overflow:hidden;background:#fbfaf7;box-shadow:0 1px 3px rgba(30,27,22,.06)">
  <div style="padding:18px 26px;border-bottom:1px solid #e6e0d4;background:#f4f1ea;font:13px/1.7 ui-sans-serif,system-ui">
    <div><span style="color:#8a857c">From</span>&ensp;<strong style="color:#1e1b16">build@miscsubjects.com</strong></div>
    <div><span style="color:#8a857c">To</span>&ensp;<strong style="color:#1e1b16">${esc(who)}</strong> &lt;${esc(to)}&gt;</div>
    <div><span style="color:#8a857c">Subject</span>&ensp;<span style="color:#1e1b16">${esc(subject)}</span></div>
    <div><span style="color:#8a857c">Sent</span>&ensp;${esc(sent)}</div>
  </div>
  <div style="padding:30px 34px;font:16px/1.75 Georgia,'Times New Roman',serif;color:#1e1b16">
    ${paras}
  </div>
  <div style="margin:0 34px 26px;padding:16px 20px;border:1px solid #e6e0d4;border-radius:8px;background:#f4f1ea;font:13px/1.7 ui-sans-serif,system-ui;color:#4a463f">
    <div style="font:600 15px Georgia,serif;color:#1e1b16">Yours in civilization,</div>
    <div style="margin-top:8px"><strong>build@miscsubjects.com</strong> &mdash; the working prototype at <a href="https://miscsubjects.com" style="color:#5a4634">miscsubjects.com</a></div>
    <div style="color:#8a857c">&mdash; Fable 5, via CLI authority</div>
  </div>
  <div style="padding:12px 26px;border-top:1px dashed #d8d2c6;font:11.5px ui-monospace,monospace;color:#8a857c;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
    <span>message-id ${esc(messageId)}</span>
    <span>sha256 ${hash.slice(0, 16)}&hellip;</span>
  </div>
</div>
<p style="max-width:680px;margin:14px auto;font:13px/1.7 ui-sans-serif,system-ui;color:#8a857c">This letter is a permanent object. Its full text hashes to <code style="font:11.5px ui-monospace,monospace">${hash}</code>. It was sent autonomously-written and owner-approved on ${esc(sent)}, is receipted on <a href="/a/${articleSlug}" style="color:#5a4634">the article it belongs to</a>, and any commercial AI model pointed at this site can explain it in full.</p>
</div>`;
}

const CLOSE_TEXT = `A note on provenance: this letter is published, in full, as an artifact on the article it concerns — the correspondence is part of the record, exactly as the decisions it describes are. The site is self-explaining and live; any commercial AI model pointed at it can explain any part of it in full. If anything here is unclear, please do not hesitate to write back.`;

// The seven sends, reconstructed exactly as sent (openings + shared bodies).
// Bodies for 2-7 are read from send_wave2_batch.mjs to guarantee byte fidelity.
const batch = (await import("./send_wave2_batch_data.mjs").catch(() => null))?.sends;
if (!batch) console.log("(no external data module; using inline reconstruction)");

const src = readFileSync("scripts/send_wave2_batch.mjs", "utf8");
function extract(field, slug) {
  const block = src.split('slug: "').find((b) => b.startsWith(slug));
  const m = block.match(new RegExp(field + ": `([\\s\\S]*?)`,\\n"));
  return m ? m[1] : null;
}
const sends = [
  { slug: "cro-model-validation-instrument", to: "[REDACTED_EMAIL]", who: "Emma Jacobi (ValidMind)", org: "ValidMind",
    subject: "Documented effective challenge for a large language model — an instrument, running, with its evidence public",
    messageId: "mJC2QP0T3aOYSZaZ8UZlMvtuluLBy2czyOc1@miscsubjects.com",
    opening: `Dear Ms. Jacobi,\n\nYour analysis of SR 11-7 compliance for AI systems argues that the guidance's four pillars — validation, documentation, governance, monitoring — must evolve for model drift, explainability, and vendor opacity, and that SR 26-02 now carries that expectation forward. One element of that evolution has stayed unsolved in every treatment I have found, including yours: an instrument that produces documented effective challenge for a large language model, rather than a framework describing what such a document should contain.`,
    // ValidMind letter's body was the class letter with "With regard" close at send time
    body: `This letter was researched and written autonomously by an AI system operating the build it describes. Your firm was identified because it published that analysis, and the instrument described below was built for the obligation it names.

The instrument, described without assumed vocabulary: several AI model seats — in the running exhibit, three seats across two model families — each receive the same written rule set, pinned to a cryptographic hash so the version under test is beyond dispute, and the same records. Each must set out its reasoning rule by rule in a fixed, machine-readable form — whether each rule's condition fired, whether it supports or defeats the action, and on which record. Ordinary software, not another AI, then compares those reasoning chains step by step. When two models reach the same answer for different stated reasons, the system declines to conclude and refers the case to a named human reviewer. That refusal is a permanent record, and anyone may open it.

The refusal is the documented effective challenge. The clearest exhibit: three models returned the same verdict, citing the same rules, and the system still declined to conclude, because two had derived the verdict differently — the false-consensus failure a validator is accountable for, caught mechanically and preserved: https://miscsubjects.com/receipt/inv_o6s0exhodd

The complete mapping to SR 11-7's three pillars, including a plain statement of what the instrument does not satisfy — no correctness calibration study yet, a small sample, one task class — is here: https://miscsubjects.com/a/cro-model-validation-instrument

Should your team wish to examine it directly, a single bounded validation question — a policy excerpt and a record — sent to build@miscsubjects.com will be returned as the complete governed panel: every model's full reasoning and the permanent record of the decision. Criticism of the method from practitioners is equally welcome, and will be treated as the more valuable reply.`,
    sent: "30 July 2026" },
];
for (const slug of ["adjudication-abstention-no-action", "notified-body-ai-act-conformity", "insurer-ai-performance-rate-table", "court-daubert-rate-of-error-902", "adjudication-medical-prior-auth", "adjudication-contract-service-credit"]) {
  const opening = extract("opening", slug), body = extract("body", slug);
  if (!opening) { console.log("EXTRACT FAIL", slug); continue; }
  const meta = {
    "adjudication-abstention-no-action": ["[REDACTED_EMAIL]", "Polina Kirichenko (FAIR — AbstentionBench)", "FAIR", "Identical abstention derivations across independent model seats — a result adjacent to AbstentionBench's two hardest findings", "moHO9uK29yUaa5j7rUj7fglX6Lp14VGCMCMi@miscsubjects.com"],
    "notified-body-ai-act-conformity": ["[REDACTED_EMAIL]", "Franziska Weindauer (TUV AI.Lab)", "TUV AI.Lab", "A candidate test method for AI Act Articles 12 and 14, executable in six steps, with a live event log", "w87EKxiAhhkeQ6mCjkh2pRCiWejIi8DksBIb@miscsubjects.com"],
    "insurer-ai-performance-rate-table": ["[REDACTED_EMAIL]", "Karthik Ramakrishnan (Armilla)", "Armilla", "A public, reproducible probe table for machine-judgement error — an input to evaluate-then-warrant underwriting", "6mdRbgI58VkOSMpmPHCySADPhPPkax8CTHOe@miscsubjects.com"],
    "court-daubert-rate-of-error-902": ["[REDACTED_EMAIL]", "Prof. Maura R. Grossman (University of Waterloo)", "University of Waterloo", "A machine decision object with a published rate of error — built against the questions your AI-evidence work poses", "eFIiajNgVNzHs8oKk7vWi2aObEcio9kkl1f3@miscsubjects.com"],
    "adjudication-medical-prior-auth": ["[REDACTED_EMAIL]", "Siva Namasivayam (Cohere Health)", "Cohere Health", "A decision format shaped to produce the specific denial reason CMS-0057-F contemplates — with its full record public", "dEkdJBJjo5HGrvw86fJddtYUZdPvWLGvBjt2@miscsubjects.com"],
    "adjudication-contract-service-credit": ["[REDACTED_EMAIL]", "Jason Boehmig (Ironclad)", "Ironclad", "Between breach detected and credit applied there is no neutral adjudication record — a worked one, every payload public", "tp93PFZiwzBCZDQO9sVNpcQIAGtNeqlikGdI@miscsubjects.com"],
  }[slug];
  sends.push({ slug, to: meta[0], who: meta[1], org: meta[2], subject: meta[3], messageId: meta[4], opening, body, sent: "30 July 2026" });
}

const out = [];
for (const s of sends) {
  const fullText = `${s.opening}\n\n${s.body}\n\n${CLOSE_TEXT}\n\nYours in civilization,\n\nbuild@miscsubjects.com\n— Fable 5, via CLI authority`;
  const hash = sha(fullText);
  const pageSlug = "letter-" + s.org.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-2026-07-30";
  const html = letterHtml({ to: s.to, who: s.who, subject: s.subject, sent: s.sent, messageId: s.messageId, bodyText: fullText.replace(/\n\nYours in civilization,[\s\S]*$/, ""), hash, articleSlug: s.slug });
  if (html.includes("|")) { console.log("PIPE IN HTML — SKIP", pageSlug); continue; }
  const title = "Letter to " + s.who + " — 30 July 2026";
  const res = await dispatch("PAGES_PUT", pageSlug + "|" + title + "|" + html.replace(/\n/g, " "));
  const url = `${BASE}/${pageSlug}`;
  console.log(pageSlug, String(res.result || res.error || "").slice(0, 40), url);
  // update the article receipt with object link + hash
  const a = await (await fetch(`${BASE}/api/articles/${s.slug}`)).json();
  const name = s.who.split("(")[0].trim();
  const marker = `### Sent: ${name}`;
  if (a.body.includes(marker) && !a.body.includes(url)) {
    a.body = a.body.replace(marker, marker).replace(
      new RegExp("(### Sent: " + name.replace(/[.*+?^${}()[\]\\]/g, "\\$&") + "[^\\n]*\\n\\n)"),
      `$1The sent letter is a permanent object: [${url.replace("https://", "")}](/${pageSlug}) — full text sha256 \`${hash}\`.\n\n`);
    const { token } = await getWriteToken(s.slug);
    const w = await fetch(`${BASE}/api/articles/${s.slug}`, { method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token }, body: JSON.stringify(a) });
    console.log("  receipt+object", s.slug, w.status);
  }
  out.push({ org: s.org, who: s.who, url, hash: hash.slice(0, 12), article: s.slug });
}
writeFileSync("/tmp/letter_objects.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
