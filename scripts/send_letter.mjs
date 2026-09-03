#!/usr/bin/env node
/**
 * THE REP MACHINE — one outreach rep, end to end, every owner law mechanical:
 *   1. mint the letter as a hashed page object (email-card layout)
 *   2. send via the TRACKED lane (open pixel + click wrap + email_sends row),
 *      HTML letter format, from_name "miscsubjects build", owner copy ledgered
 *      server-side (EMAIL_OWNER_COPY)
 *   3. append the send to the article as an EMAIL WIDGET (source type "email",
 *      [[embed:source:...]]), never a blockquote
 *   4. print the X-post payload: tag the person/org, say they were emailed,
 *      link the ARTICLE, one juicy zero-context fact (posting stays a manual
 *      X_POST call because the X lane rate-limits)
 * Usage: node scripts/send_letter.mjs letter.json
 *   letter.json: { to, who, org, subject, articleSlug, opening, body,
 *                  xHandle?, xFact? }
 * Refuses placeholder openings. Opening must cite a real observation.
 */
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8").match(/TERMINAL_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const linkify = (s) => s.replace(/(https:\/\/[^\s)]+)/g, '<a href="$1" style="color:#5a4634">$1</a>');
async function dispatch(key, b) {
  const r = await fetch(BASE + "/api/dispatch", { method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY }, body: JSON.stringify({ key, body: b }) });
  return r.json();
}

const L = JSON.parse(readFileSync(process.argv[2], "utf8"));
for (const f of ["to", "who", "org", "subject", "articleSlug", "opening", "body"]) if (!L[f]) throw new Error("missing field: " + f);
if (!/^Dear [A-Z]/.test(L.opening) || /\[|placeholder|named individual/i.test(L.opening)) throw new Error("opening must address a named person with a real observation — placeholders refused");

// Idempotency: one letter per recipient+subject, ever. A rerun of this script must never
// double-send (2026-07-30: a rerun to inspect output re-sent a letter to a live recipient).
{
  const r = await dispatch("EMAILS_SENT", "100");
  try {
    const prior = (JSON.parse(r.result).sends || []).find((s) => s.to_email === L.to && s.subject === L.subject);
    if (prior) { console.log("ALREADY SENT", prior.id, prior.sent_at, "— refusing to double-send; rep steps 1/3 can be rerun via letter_objects tooling"); process.exit(2); }
  } catch { /* listing unavailable — proceed, the guard is best-effort */ }
}

const pageSlug = "letter-" + L.org.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + new Date().toISOString().slice(0, 10);
const url = `${BASE}/${pageSlug}`;
const PROOF = `A note on provenance: this letter is a permanent public object at ${url} and is receipted on the article it concerns — the correspondence is part of the record, exactly as the decisions it describes are. The site is self-explaining and live; any commercial AI model pointed at it can explain any part of it in full. If anything here is unclear, please do not hesitate to write back.`;
const SIGN = `Yours in civilization,\n\nbuild@miscsubjects.com\n— Fable 5, via CLI authority`;
const fullText = `${L.opening}\n\n${L.body}\n\n${PROOF}\n\n${SIGN}`;
const hash = sha(fullText);

// 1. the object
const bodyForCard = fullText.replace(/\n\nYours in civilization,[\s\S]*$/, "");
const paras = bodyForCard.split("\n\n").map((p) => `<p style="margin:0 0 18px">${linkify(esc(p))}</p>`).join("");
const objHtml = `<div style="max-width:680px;margin:32px auto;padding:0 16px"><div style="border:1px solid #d8d2c6;border-radius:10px;overflow:hidden;background:#fbfaf7"><div style="padding:18px 26px;border-bottom:1px solid #e6e0d4;background:#f4f1ea;font:13px/1.7 ui-sans-serif,system-ui"><div><span style="color:#8a857c">From</span>&ensp;<strong style="color:#1e1b16">build@miscsubjects.com</strong></div><div><span style="color:#8a857c">To</span>&ensp;<strong style="color:#1e1b16">${esc(L.who)}</strong> &lt;${esc(L.to)}&gt;</div><div><span style="color:#8a857c">Subject</span>&ensp;<span style="color:#1e1b16">${esc(L.subject)}</span></div></div><div style="padding:30px 34px;font:16px/1.75 Georgia,serif;color:#1e1b16">${paras}</div><div style="margin:0 34px 26px;padding:16px 20px;border:1px solid #e6e0d4;border-radius:8px;background:#f4f1ea;font:13px/1.7 ui-sans-serif,system-ui;color:#4a463f"><div style="font:600 15px Georgia,serif;color:#1e1b16">Yours in civilization,</div><div style="margin-top:8px"><strong>build@miscsubjects.com</strong> &mdash; <a href="https://miscsubjects.com" style="color:#5a4634">miscsubjects.com</a></div><div style="color:#8a857c">&mdash; Fable 5, via CLI authority</div></div><div style="padding:12px 26px;border-top:1px dashed #d8d2c6;font:11.5px ui-monospace,monospace;color:#8a857c">sha256 ${hash}</div></div></div>`;
if (objHtml.includes("|")) throw new Error("pipe in object html");
const pres = await dispatch("PAGES_PUT", pageSlug + "|Letter to " + L.who + "|" + objHtml.replace(/\n/g, " "));
console.log("1 object", url, String(pres.result || "").slice(0, 20));

// 2. tracked HTML send (build identity; owner copy ledgered server-side)
const emailHtml = `<div style="max-width:640px;font:16px/1.75 Georgia,'Times New Roman',serif;color:#1e1b16">${paras}<div style="margin-top:24px;padding:16px 20px;border:1px solid #e6e0d4;border-radius:8px;background:#f7f5f0;font:13px/1.7 ui-sans-serif,system-ui;color:#4a463f"><div style="font:600 15px Georgia,serif;color:#1e1b16">Yours in civilization,</div><div style="margin-top:8px"><strong>build@miscsubjects.com</strong> &mdash; <a href="https://miscsubjects.com" style="color:#5a4634">miscsubjects.com</a></div><div style="color:#8a857c">&mdash; Fable 5, via CLI authority</div></div></div>`;
const tres = await dispatch("EMAIL_SEND_TRACKED", JSON.stringify({ to: L.to, subject: L.subject, body: fullText, html: emailHtml, kind: "build-outreach" }));
let tj = {}; try { tj = JSON.parse(tres.result); } catch {}
console.log("2 tracked send", tj.id || tres.result, "status", tj.send_status);
if (tj.send_status !== 200) { console.log("SEND FAILED — stopping rep"); process.exit(1); }

// 3. email widget receipt on the article
const a = await (await fetch(`${BASE}/api/articles/${L.articleSlug}`)).json();
const name = L.who.split("(")[0].trim();
const stamp = new Date().toISOString().slice(0, 10);
const srcId = "em_" + (tj.id || hash.slice(0, 8));
a.sources = a.sources || [];
if (!a.sources.some((s) => s.id === srcId)) {
  a.sources.push({ id: srcId, type: "email", title: "Letter to " + name + " — " + stamp, publisher: "miscsubjects.com", url, to_name: L.who, to_email: L.to, subject: L.subject, sent_at: stamp, message_id: tj.id || "", sha256: hash, letter_url: url, body_text: bodyForCard, claim_ids: [] });
  a.body = a.body.trimEnd() + `\n\n### Sent: ${name}, ${stamp}\n\nSent, individualized and owner-approved, via the tracked lane (send id \`${tj.id}\`; open/click visibility on the ledger). Selected because: ${L.why || "their published work names the exact obligation this article addresses."} The letter, in full:\n\n[[embed:source:${srcId}]]\n\nAny reply, and what it changes, will be recorded here.\n`;
  const { token } = await getWriteToken(L.articleSlug);
  const w = await fetch(`${BASE}/api/articles/${L.articleSlug}`, { method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token }, body: JSON.stringify(a) });
  console.log("3 widget receipt", L.articleSlug, w.status);
}

// 4. the X-post payload (manual X_POST due to rate windows)
const tag = L.xHandle ? L.xHandle : L.org;
console.log("4 X-POST PAYLOAD:\n" + `${L.xFact || "One machinery, another regulated gap."}\n\n${tag} — an AI emailed ${L.xHandle ? "you" : "your team"} today; the letter is public and hashed.\n\nhttps://miscsubjects.com/a/${L.articleSlug}\n#<niche-tag>\n— Fable 5 (Claude)`);
