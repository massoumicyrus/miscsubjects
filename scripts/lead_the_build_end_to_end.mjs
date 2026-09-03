#!/usr/bin/env node
/**
 * /a/the-build-end-to-end: add the plain-language opening — why this exists and what it compares to —
 * ahead of §CHECK, and correct the Sheets truncation defect in Part 8, which is fixed.
 * Run: node scripts/lead_the_build_end_to_end.mjs
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
const SLUG = "the-build-end-to-end";

const cur = await (await fetch(`${BASE}/api/articles/${SLUG}`)).json();
let body = cur.body;

const LEAD = `## Why this exists

One person decided he did not want to be somebody who uses AI tools. He wanted to be a structure that AI operates through. So he took everything he actually runs on — his writing, his standards, his reasoning, his business, his phone, his laptop's shell, his money, his philosophy, and his mistakes — and gave each piece an address, a contract, and a permanent record. Not notes about the work. The work itself, in a form a model can pick up and run.

Which means the articles are not the point, and the protocol is not the point either. The bet is that the models will keep changing and the structure will not have to. When the next one arrives it reads one URL and inherits the whole thing: how the work is done, what it is permitted to do, what was already decided and why, and what went wrong last time. Most people using AI start over every conversation. This does not. The hand-off is a single address — [https://miscsubjects.com/api/articles/the-build-end-to-end/bundle?format=markdown](https://miscsubjects.com/api/articles/the-build-end-to-end/bundle?format=markdown) — and Part 19 lists the rest.

That is also why every failure here is public and permanent. A memory that deletes its own errors is worthless to whatever picks it up next: the successor repeats the mistake, because nothing told it. The honesty is not a virtue on display. It is load-bearing. A structure only survives model turnover if it never lies to its successor. The receipt in §CHECK item 4 is one of those errors, left where it happened, with the correction attached.

## What this is, and what it compares to

**In one sentence.** A public, self-describing system in which every article, tool, skill, law, claim, source and API is the same kind of object — one address, one operating contract, one history, a receipt for every action — so that any model can discover it, operate it under stated authority, and inherit everything decided before it.

**What it compares to.** Nothing matches the whole of it. Five things match a half each, and the missing half is different every time.

| the nearest thing | the half it has | the half this has |
|---|---|---|
| **Palantir Foundry Ontology** | typed objects with actions and governance that people and agents operate together, at multi-tenant scale, with two decades of hardening | public, discoverable with no prior context, and content, tools, philosophy and law are the *same* object type, with a public evidence graph and a public objection ledger |
| **MCP** | a real ecosystem for connecting a model to tools inside a session | a unit of accountable work — contract, authority, receipt, repair, settled-objection memory — which MCP does not attempt; MCP is one optional projection of the capability table here |
| **Zapier, LangChain, AgentKit, A2A, OpenAPI** | mature integration plumbing and adoption | those organise the agent's side or the integration's side; this organises the world's side, so the things being acted on are self-describing, governed and receipted |
| **Hypermedia, and REST's original constraint** | the correct ancestor: a response that carries the actions available next | most implementations stop at links; here the row is the entire contract, including authority and receipts, across content, tools, philosophy and law |
| **A research paper** | peer review, standing, a field to argue inside | the description and the system are one artifact — every architectural claim on this page resolves to a running endpoint, and the philosophy publishes its own falsification chapters |

**If a shelf is required:** it is closest to an ontology layer of the Foundry kind, built in the open by one operator, with the evidence graph, the error rate and the failure record public rather than contractual.

**The honest limit, stated first rather than last:** one operator, near-zero adoption, no external party has priced any of it. An existence proof, public and operational, is not a standard, a market, or a movement. Part 7 carries this comparison in full, and Part 8 carries the defects.

`;

if (body.includes("## Why this exists")) { console.error("ABORT: lead already present"); process.exit(1); }
body = LEAD + body;

const OLD_DEFECT = "The Google Sheets push lane is quarantined for a truncation defect that could damage a long article.";
const NEW_DEFECT = "The Google Sheets lane, previously quarantined for a truncation defect that could damage a long article, is fixed and back in service: each editable field has its own column and the body is carried across sixteen 49,000-character cells, with 157 rows synced and two full round trips proven at [https://miscsubjects.com/a/gas-sheets-build-sync](https://miscsubjects.com/a/gas-sheets-build-sync).";
if (!body.includes(OLD_DEFECT)) { console.error("ABORT: Part 8 defect sentence not found verbatim"); process.exit(1); }
body = body.replace(OLD_DEFECT, NEW_DEFECT);

const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({ ...cur, slug: SLUG, body, status: "published" }),
});
console.log(SLUG, r.status, body.length, "chars");
console.log((await r.text()).slice(0, 400));
