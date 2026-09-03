#!/usr/bin/env node
/**
 * Two corrections from a cold external audit, 2026-08-01. Objections obj-208 and obj-209.
 * 1. /a/the-build-end-to-end — the coding-agent sentence overstates. Narrow it and disclose the
 *    external Anthropic authoring lane the bylines already record.
 * 2. /a/adjudication-probe-report-eu-ai-act — publish the sensitivity of the 0.071 floor to the
 *    malformed-output exclusion policy.
 * Run: node scripts/fix_audit_2026_08_01.mjs
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

async function patch(slug, edits) {
  const cur = await (await fetch(`${BASE}/api/articles/${slug}`)).json();
  let body = cur.body;
  for (const [from, to] of edits) {
    if (!body.includes(from)) { console.error(`ABORT ${slug}: not found verbatim →`, from.slice(0, 70)); process.exit(1); }
    body = body.split(from).join(to);
  }
  const { token } = await getWriteToken(slug);
  const r = await fetch(`${BASE}/api/articles/${slug}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify({ ...cur, slug, body, status: cur.status || "published" }),
  });
  console.log(slug, r.status, body.length, "chars");
}

// 1 — obj-208
await patch("the-build-end-to-end", [[
  "The build's coding agent and every adjudicator run non-Anthropic models through the gateway.",
  "Every adjudicator, and the build's own in-repo coding agent, run non-Anthropic models through the gateway. **The corpus is a different lane and the record should say so plainly:** much of the writing on this site, including this page, is produced by Anthropic models operating through Claude Code, which is why the bylines read *Fable 5 (Claude Code)* and *Opus 5 (Claude Code)* on provenance stamps dated after the removal. The removal governs what the build's own agents and adjudicators execute; it does not govern which external model an operator sits in front of. The page previously stated the wider claim, which was false as written — filed as objection 208 and corrected here.",
]]);

// 2 — obj-209
await patch("adjudication-probe-report-eu-ai-act", [[
  "Ratings exclude malformed outputs: a non-finding is not a rating, and 2 of the 70 findings were malformed and are excluded from these statistics while remaining in the per-model rates above.",
  `Ratings exclude malformed outputs: a non-finding is not a rating, and 2 of the 70 findings were malformed and are excluded from these statistics while remaining in the per-model rates above.

**How much the headline depends on that exclusion.** It depends on it more than the report previously admitted, and the objection was raised from outside. Three probes — P05, P07 and P09 — were unanimously wrong: 0 of 5, three separate times. A five-channel floor of one undetected-wrong item in fourteen (0.071) is not obviously reconcilable with three items on which every channel was confidently wrong; the arithmetic that reconciles them runs through the exclusion policy. A malformed finding is not a wrong answer, it is a non-answer, and a non-answer forces the gate to escalate rather than emit — so an unparseable output on an item the panel would otherwise have got wrong converts an escaped error into a human referral. The receipt caption confirms \`kimi-k2.6\` returned UNPARSED on P05.

What is confirmed: the exclusion policy, the three 0/5 items, and the P05 UNPARSED. What is not: which items the second malformed finding landed on — the per-item receipts settle that and it has not yet been done. **The bound worth stating anyway:** if both exclusions landed on unanimously-wrong abstain items, the floor under an accounting that scores a rescued item as an escaped error is 3/14 = 0.214, roughly triple the published figure. A reader relying on 0.071 should treat it as the floor under the stated exclusion policy, not as the floor under every reasonable accounting. Filed as objection 209.`,
]]);
