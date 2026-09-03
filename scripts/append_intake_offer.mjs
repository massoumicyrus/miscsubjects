#!/usr/bin/env node
/**
 * Append one concrete intake offer to each use-case article so the article is
 * the intake door, not an explanation. Idempotent: skips if the offer heading exists.
 * Run: node scripts/append_intake_offer.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const OFFERS = {
  "cro-model-validation-instrument": "Send one bounded validation question — your rule set (or the policy text it comes from) and the record under review — to **build@miscsubjects.com**. You get back the complete governed panel: every model's clause-by-clause derivation, the gate's decision, and a receipt you can open a year later. No account, no call, no deck.",
  "insurer-ai-performance-rate-table": "Send one bounded decision you would have to price — the rule set and the record — to **build@miscsubjects.com**. You get back the governed panel, the seal, and the receipt: the exact artifact a specification could mandate. No account, no call, no deck.",
  "notified-body-ai-act-conformity": "Send one bounded conformity question — an Article 12 or Article 14 obligation and a system record to test it against — to **build@miscsubjects.com**. You get back the full event log, every model's derivation, the gate's decision, and a replayable receipt. No account, no call, no deck.",
  "court-daubert-rate-of-error-902": "Send one bounded evidentiary question — the rule text and the record — to **build@miscsubjects.com**. You get back the governed panel, the absence declaration, and a hash-chained receipt. No account, no call, no deck.",
  "adjudication-contract-service-credit": "Send one bounded contract dispute — the clause and the operative record — to **build@miscsubjects.com**. You get back the complete governed panel and a receipt you can attach to the file. No account, no call, no deck.",
  "adjudication-medical-prior-auth": "Send one bounded coverage question — the policy clause and the clinical record — to **build@miscsubjects.com**. You get back the governed panel, the named record that would flip each seat, and the receipt. No account, no call, no deck.",
};
const HEADING = "## Submit a case";
for (const [slug, offer] of Object.entries(OFFERS)) {
  const cur = await (await fetch(`${BASE}/api/articles/${slug}`)).json();
  if (!cur.body) { console.log(slug, "SKIP no body"); continue; }
  if (cur.body.includes(HEADING)) { console.log(slug, "SKIP already has offer"); continue; }
  const body = cur.body.trimEnd() + `\n\n${HEADING}\n\n${offer}\n`;
  const { token } = await getWriteToken(slug);
  const r = await fetch(`${BASE}/api/articles/${slug}`, {
    method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify({ ...cur, slug, body, status: "published" }),
  });
  console.log(slug, r.status);
}
