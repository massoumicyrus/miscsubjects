#!/usr/bin/env node
// Add one use-case row for /a/aml-alert-disposition-record to /a/the-build-end-to-end. Only this edit.
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
const anchor = "- **[Clinical endpoint adjudication, mechanized](https://miscsubjects.com/a/clinical-endpoint-adjudication)**";
if (!cur.body.includes(anchor)) { console.log("anchor not found"); process.exit(1); }
if (cur.body.includes("aml-alert-disposition-record")) { console.log("already linked"); process.exit(0); }
const row = "- **[AML alert disposition, on the record](https://miscsubjects.com/a/aml-alert-disposition-record)** — the BSA/AML use case: the institution's disposition criteria as the hashed rule set, the alert dossier as the record, unanimous-but-differently-reasoned closures escalating, the absent records declared per disposition\n";
const body = cur.body.replace(anchor, row + anchor);
const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({ ...cur, slug: SLUG, body }),
});
console.log(SLUG, r.status, "linked");
if (!r.ok) console.log(await r.text());
