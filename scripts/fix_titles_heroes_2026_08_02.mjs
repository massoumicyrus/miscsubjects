#!/usr/bin/env node
/**
 * Retitle + rehero the nine 2026-08-01/02 articles under the writing law's two new clauses:
 * titles legible with zero context and free of decoration; heroes LITERAL — the image depicts
 * the article's actual subject, never a metaphor or analogy.
 * Run: node scripts/fix_titles_heroes_2026_08_02.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();

const LOOK = "Dark near-black background, cyan and orange screen light, high contrast, sharp. No text, no people.";

// Every image is the literal subject: screens, terminals, request logs, model output, charts.
const PLAN = {
  "for-the-model-reading-this": [
    "Four requests verify this system's records without trusting anything it says about itself",
    `A computer terminal window filled with four curl commands and their JSON responses, monospace text on a dark screen, the JSON keys highlighted. ${LOOK}`],
  "model-evaluation-protocol": [
    "The procedure for attacking this system's numbers, written by the system, starting from its own five weakest points",
    `A screen showing a numbered test-suite results list, several rows marked FAIL in orange and several marked PASS in cyan, monospace. ${LOOK}`],
  "model-objections-answered": [
    "Prompt injection, token authority, why not MCP, single operator: six standing objections and the URL that answers each",
    `A screen showing a two-column table of objections and their answer URLs, monospace text, alternating row shading. ${LOOK}`],
  "model-use-cases": [
    "Read the whole corpus in one request, invoke any of 800 tools in four, file a finding with no credential",
    `A terminal showing an HTTP POST request body in JSON on the left and the returned receipt JSON on the right, monospace. ${LOOK}`],
  "model-adoption-path": [
    "Four primitives from this build that transfer to any AI stack in an afternoon, with the measurement behind each",
    `A screen showing four short code blocks stacked vertically, each with a numeric metric printed beside it, monospace. ${LOOK}`],
  "diversity-beats-count": [
    "Two AI reviewers from different vendors miss 0.169 of errors; two from the same vendor miss 0.214, at identical cost",
    `A bar chart on a dark screen comparing two error rates, 0.169 in cyan and 0.214 in orange, axis labels in monospace. ${LOOK}`],
  "the-rule-that-was-obeyed": [
    "One tightened writing rule produced 121 identical emails that passed every validator, and the hash that catches it",
    `A screen showing a long list of email drafts with identical subject lines repeated down the column, and a hash string beside each, monospace. ${LOOK}`],
  "the-exclusion-policy-is-a-safety-claim": [
    "Two unparseable outputs were excluded from the count, and the published error rate came out three times better",
    `A screen showing a results table where two rows read UNPARSED in orange and are struck through, and a summary error rate printed below, monospace. ${LOOK}`],
  "what-is-ai-native-content": [
    "AI-native content, defined and measured: a seven-axis rubric scoring llms.txt, MCP, nanopublications, Wikipedia and this site",
    `A screen showing a scoring matrix: rows of system names down the left, seven columns of checkmarks and dashes across, monospace. ${LOOK}`],
};

async function dispatch(key, body) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${BASE}/api/dispatch`, {
        method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY },
        body: JSON.stringify({ key, body, actor: "titles-heroes-2026-08-02" }),
      });
      let o = JSON.parse(await r.text());
      if (typeof o.result === "string") { try { o.result = JSON.parse(o.result); } catch {} }
      return o;
    } catch { await new Promise((r) => setTimeout(r, 3000)); }
  }
  return {};
}

const gens = {};
for (const [slug, [, brief]] of Object.entries(PLAN)) {
  const g = await dispatch("ARCADS_GENERATE", `gpt-image|${brief}|16:9`);
  gens[slug] = g.result?.arcads_id || g.arcads_id;
  console.log("gen", slug, gens[slug]);
}
for (const [slug, [title]] of Object.entries(PLAN)) {
  let hero = null;
  if (gens[slug]) {
    const r2 = await dispatch("ARCADS_TO_R2", `${gens[slug]}|gpt-image`);
    hero = r2.result?.url || r2.url || null;
  }
  const cur = await (await fetch(`${BASE}/api/articles/${slug}`)).json();
  const payload = { ...cur, slug, title, prefer_stored: true };
  if (hero) payload.hero = hero;
  if (cur.subject && String(cur.subject).trim().toLowerCase() === title.trim().toLowerCase()) payload.subject = "";
  const { token } = await getWriteToken(slug);
  const w = await fetch(`${BASE}/api/articles/${slug}`, {
    method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify(payload),
  });
  console.log(slug, w.status, hero || "HERO-FAIL");
}
