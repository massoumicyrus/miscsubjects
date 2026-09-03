#!/usr/bin/env node
// Add the benefits-eligibility use case to the use-case row in /a/the-build-end-to-end. One edit.
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "the-build-end-to-end";
const cur = await (await fetch(`${BASE}/api/articles/${SLUG}`)).json();
const OLD = "**[ECOA adverse-action reasons](https://miscsubjects.com/a/ecoa-adverse-action-specific-reasons)**";
const NEW = OLD + " · **[Benefits eligibility determination record](https://miscsubjects.com/a/benefits-eligibility-determination-record)**";
if (!cur.body.includes(OLD)) { console.log("anchor not found"); process.exit(1); }
if (cur.body.includes("benefits-eligibility-determination-record")) { console.log("already linked"); process.exit(0); }
const body = cur.body.replace(OLD, NEW);
const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({ ...cur, body }),
});
console.log(SLUG, r.status);
