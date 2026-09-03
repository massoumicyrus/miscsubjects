#!/usr/bin/env node
/**
 * Owner decorum law: no punchy-casual closers. Replace "No account, no call, no deck."
 * on every live article that carries it. Only that sentence changes.
 * Run: node scripts/decorum_fix_no_deck.mjs
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

const SLUGS = [
  "nyc-ll144-bias-audit-evidence",
  "ecoa-adverse-action-specific-reasons",
  "agent-authorization-gate",
  "nist-ai-rmf-measure-reference",
  "radiology-incidental-findings-followup",
  "aml-alert-disposition-record",
  "peer-review-derivation-record",
  "claims-handling-determination-record",
  "arbitration-reasoned-award-record",
  "continuous-controls-evidence-object",
  "benefits-eligibility-determination-record",
];

const OLD = "No account, no call, no deck.";
const NEW = "No account is required, and no meeting is necessary.";

for (const slug of SLUGS) {
  const cur = await (await fetch(`${BASE}/api/articles/${slug}`)).json();
  if (!cur.body || !cur.body.includes(OLD)) { console.log(slug, "SKIP — sentence absent"); continue; }
  const body = cur.body.split(OLD).join(NEW);
  const { token } = await getWriteToken(slug);
  const r = await fetch(`${BASE}/api/articles/${slug}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify({ ...cur, slug, body, status: cur.status || "published" }),
  });
  console.log(slug, r.status, body.length, "chars");
}
