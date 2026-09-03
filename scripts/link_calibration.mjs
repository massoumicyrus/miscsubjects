#!/usr/bin/env node
// After the calibration study publishes: point the articles that named it as missing/running
// at the completed study. Surgical, phrase-level, idempotent.
// Run: node scripts/link_calibration.mjs
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8").match(/TERMINAL_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const STUDY = "[the calibration study](/a/adjudication-calibration-study)";

const EDITS = {
  "cro-model-validation-instrument": [
    ["That study — 30 hashed, oracle-labelled cases, a wrongful-authorisation rate — is the named next artifact.",
     `That study — 30 hashed, oracle-labelled cases, a wrongful-authorisation rate — has now been run and published: ${STUDY}. Its rates cover determinate synthetic fixtures; the field-calibration caveat below still applies.`],
  ],
  "insurer-ai-performance-rate-table": [
    ["no study yet certifies correctness against ground truth",
     `correctness against ground truth on determinate synthetic fixtures is now measured in ${STUDY}; no study yet certifies correctness on contested real-world records`],
  ],
  "adjudication-abstention-no-action": [
    ["a suite of oracle-labelled should-abstain and should-not-abstain cases, with measured over- and under-abstention rates, is the named next artifact.",
     `a suite of oracle-labelled should-abstain and should-not-abstain cases, with measured over- and under-abstention rates, has now been run and published: ${STUDY}.`],
  ],
};

for (const [slug, edits] of Object.entries(EDITS)) {
  const a = await (await fetch(`${BASE}/api/articles/${slug}`)).json();
  let changed = false;
  for (const [from, to] of edits) {
    if (a.body.includes(to)) continue;
    if (a.body.includes(from)) { a.body = a.body.replace(from, to); changed = true; }
    else console.log(slug, "PHRASE NOT FOUND:", from.slice(0, 60));
  }
  if (!changed) { console.log(slug, "no change"); continue; }
  const { token } = await getWriteToken(slug);
  const r = await fetch(`${BASE}/api/articles/${slug}`, { method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token }, body: JSON.stringify(a) });
  console.log(slug, r.status);
}
