#!/usr/bin/env node
// Generated projection: .claude/skills/*/SKILL.md → functions/_lib/skill_registry.js
// The SKILL.md files are canonical; this registry is how the site serves them.
// PUBLIC skills only — the leak gate below fails the build rather than publish
// owner or business data. Laws (design/writing/skill) are not duplicated here;
// their canonical objects already serve /a/<slug>.

import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = resolve(root, ".claude/skills");
const OUT = resolve(root, "functions/_lib/skill_registry.js");

// Anything matching this never ships in a public entry. The gate is the law
// (skill-law S04): mechanical enforcement over prose.
const LEAK = /the owner|[OWNER_SURNAME]|dsco\.co|@gmail|\+1415|\+1424|leoresearch|loop bio|blooio|arcads/i;

const PUBLIC = {
  // family, source {repo,url,license}, prevents: real build failures this skill exists to stop.
  "seo-distribution-law": {
    family: "distribution",
    prevents: [
      { date: "2026-08-06", failure: "The IndexNow key file had been served since June with no caller — dead plumbing invisible until a full audit. The homepage carried no Open Graph, Twitter card, or canonical while every article did. The site's perception of distribution best practices lived nowhere, so it could not be scored, audited, or critiqued." },
    ],
  },
  "coding-law": {
    family: "code discipline",
    prevents: [
      { date: "2026-08-05", failure: "Two agents read the same file at the same version, both edited from it, and the second commit erased the first agent's work. Each commit was individually valid, so nothing in git showed the loss. The file-claim system recorded who was working where but never what text they were working from." },
    ],
  },
  "test-driven-development": {
    family: "code discipline",
    source: { repo: "obra/superpowers", url: "https://github.com/obra/superpowers", license: "MIT" },
    prevents: [
      { date: "recurring", failure: "Fixes shipped without a failing test first; the same regressions were re-fixed in later sessions." },
    ],
  },
  "systematic-debugging": {
    family: "code discipline",
    source: { repo: "obra/superpowers", url: "https://github.com/obra/superpowers", license: "MIT" },
    prevents: [
      { date: "2026-07-23", failure: "A source hash-chain broke (broken_at:0) and was patched by guesswork before the root cause — claims growing a source's body without rechaining — was isolated." },
    ],
  },
  "verification-before-completion": {
    family: "code discipline",
    source: { repo: "obra/superpowers", url: "https://github.com/obra/superpowers", license: "MIT" },
    prevents: [
      { date: "2026-07-23", failure: "A page shipped as a blank render error and was declared done; the failure surfaced only when the rendered page was finally opened." },
    ],
  },
  "requesting-code-review": {
    family: "code discipline",
    source: { repo: "obra/superpowers", url: "https://github.com/obra/superpowers", license: "MIT" },
    prevents: [
      { date: "recurring", failure: "Work merged without an independent review pass; defects found by the owner instead of a reviewer." },
    ],
  },
  "receiving-code-review": {
    family: "code discipline",
    source: { repo: "obra/superpowers", url: "https://github.com/obra/superpowers", license: "MIT" },
    prevents: [
      { date: "recurring", failure: "Review feedback implemented blindly or performatively agreed with, instead of verified against the code." },
    ],
  },
  "grill-me": {
    family: "code discipline",
    source: { repo: "mattpocock/skills", url: "https://github.com/mattpocock/skills", license: "MIT" },
    prevents: [
      { date: "recurring", failure: "Requirements accepted at face value; plan holes discovered after the build instead of before it." },
    ],
  },
  "writing-plans": {
    family: "code discipline",
    source: { repo: "obra/superpowers", url: "https://github.com/obra/superpowers", license: "MIT" },
    prevents: [
      { date: "recurring", failure: "Multi-step work delivered out of prerequisite order — a value referenced before the step that produces it." },
    ],
  },
  "executing-plans": {
    family: "code discipline",
    source: { repo: "obra/superpowers", url: "https://github.com/obra/superpowers", license: "MIT" },
    prevents: [
      { date: "recurring", failure: "Concurred plans stalled mid-phase awaiting a go-ahead nobody asked for, instead of executing through every phase." },
    ],
  },
  "using-git-worktrees": {
    family: "code discipline",
    source: { repo: "obra/superpowers", url: "https://github.com/obra/superpowers", license: "MIT" },
    prevents: [
      { date: "2026-07-22", failure: "Seventeen changes stranded on side lines over two months had to be forensically dispositioned; isolated worktrees with a fold-or-disposition exit would have prevented every one." },
    ],
  },
  "finishing-a-development-branch": {
    family: "code discipline",
    source: { repo: "obra/superpowers", url: "https://github.com/obra/superpowers", license: "MIT" },
    prevents: [
      { date: "2026-07-22", failure: "Completed work saved on a side line does not exist for the build until folded into the live line; stranded finished work re-alarmed for weeks." },
    ],
  },
  "dispatching-parallel-agents": {
    family: "code discipline",
    source: { repo: "obra/superpowers", url: "https://github.com/obra/superpowers", license: "MIT" },
    prevents: [
      { date: "2026-07", failure: "Concurrent sessions edited the same shared files and overwrote each other's work; the write-law claim system exists because of it." },
    ],
  },
  "webapp-testing": {
    family: "code discipline",
    source: { repo: "anthropics/skills", url: "https://github.com/anthropics/skills", license: "Apache-2.0" },
    prevents: [
      { date: "recurring", failure: "Features declared working from API responses or source reads while the rendered page was broken; the build's rule that only the rendered view counts came from this failure class." },
    ],
  },
  "writing-skills": {
    family: "the loop",
    source: { repo: "obra/superpowers", url: "https://github.com/obra/superpowers", license: "MIT" },
    prevents: [
      { date: "recurring", failure: "Skills written from imagination — describing what nobody failed at — that no agent could act on under pressure." },
    ],
  },
  "skill-creator": {
    family: "the loop",
    source: { repo: "anthropics/skills", url: "https://github.com/anthropics/skills", license: "Apache-2.0" },
    prevents: [
      { date: "recurring", failure: "Skill edits judged by rereading instead of behavior — no baseline run, no with-skill run, no evidence the edit taught anything." },
    ],
  },
  "article-editing": {
    family: "the loop",
    source: { repo: "this build", url: "/a/writing-law", license: "site" },
    prevents: [
      { date: "2026-07-29", failure: "Models asked to write or edit one article burned most of their turn discovering tools, repairing formats, and choosing between competing write paths; the owner ordered one documented REST contract for every client — studio, curl, agents, Gateway models, Sheets." },
    ],
  },
  "shared-failure-to-skill": {
    family: "the loop",
    source: { repo: "this build", url: "/a/skill-law", license: "site" },
    prevents: [
      { date: "2026-07-22", failure: "The owner had to report the same failure twice; recurring failures were fixed in chat and forgotten instead of converted into a skill plus a mechanical gate." },
    ],
  },
  "shared-rule-capture": {
    family: "the loop",
    source: { repo: "this build", url: "/a/skill-law", license: "site" },
    prevents: [
      { date: "2026-07", failure: "The owner restated the same rule across sessions because corrections were acknowledged conversationally and never written into a durable rule." },
    ],
  },
  "shared-no-new-problems": {
    family: "the loop",
    source: { repo: "this build", url: "/a/skill-law", license: "site" },
    prevents: [
      { date: "recurring", failure: "Fixes that created new failures elsewhere, and fixes that stopped to ask permission the owner had already given." },
    ],
  },
  "shared-say-no": {
    family: "the loop",
    source: { repo: "this build", url: "/a/skill-law", license: "site" },
    prevents: [
      { date: "2026-07-23", failure: "Asked \"any ideas?\", models produced ideas whether or not any were good; asked \"is this A+?\", they appended pattern-matched suggestion tails to passing work. Same day, the first draft of this very rule made a fresh agent suppress a real infinite-loop bug to answer \"Yes.\" — both failure modes are now clauses." },
    ],
  },
  "agent-work-law": {
    family: "the loop",
    source: { repo: "this build", url: "/a/agent-work-law", license: "site" },
    prevents: [
      { date: "2026-08-04", failure: "The project's operating intelligence lived in CLAUDE.md, STATE.md, AGENTS.md and in whichever Claude session was open: the rules, what remained unfinished, assignment, dependency order, and the decision that work was done. A fresh agent could not enter the project, a different model could not continue it, and every owner correction was answered with another line in a file no future agent would read. Work is now a leased task object whose completion is decided by acceptance tests the infrastructure runs." },
    ],
  },
  "self-promotion": {
    family: "the loop",
    source: { repo: "this build", url: "/a/outreach-machinery", license: "site" },
    prevents: [
      { date: "2026-07-06", failure: "Eleven external emails were sent by the outreach machinery before the confirmation gate existed, and the single-send path recorded no tracking rows — activity a promotion system took that its own records understated. Contact decisions are now computed, recorded on the ledger before the send, and gated on owner review." },
      { date: "2026-07-25", failure: "A personalisation rule strict enough to ban every available observation left one legal opener, and 121 drafts converged on the same sentence under the same four-word subject — interchangeable mail produced by ever-stricter rules. Rule changes now version to outreach_rule_versions and re-run the shape clustering to prove no collapse." },
    ],
  },
};
// write-human was evaluated for publication and REJECTED by the leak gate —
// it carries internal pipeline operations. It remains a private local skill.

function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim();
  }
  return { meta, body: text.slice(m[0].length) };
}

async function walkFiles(dir, base = "") {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = base ? base + "/" + entry.name : entry.name;
    if (entry.isDirectory()) out.push(...(await walkFiles(join(dir, entry.name), rel)));
    else {
      const s = await stat(join(dir, entry.name));
      out.push({ path: rel, bytes: s.size });
    }
  }
  return out;
}

const dirs = (await readdir(SKILLS_DIR, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const skills = [];
let privateCount = 0;
for (const name of dirs) {
  if (["design-law", "writing-law", "skill-law", "oip"].includes(name)) continue; // canonical pages exist at /a/<slug>
  const config = PUBLIC[name];
  if (!config) {
    privateCount++;
    continue;
  }
  const skillPath = join(SKILLS_DIR, name, "SKILL.md");
  const raw = await readFile(skillPath, "utf8").catch(() => null);
  if (raw == null) throw new Error(`public skill missing SKILL.md: ${name}`);
  const { meta, body } = parseFrontmatter(raw);
  const description = meta.description || "";
  const gateTarget = `${name}\n${description}\n${body}`;
  if (LEAK.test(gateTarget)) {
    throw new Error(`leak gate: public skill '${name}' matches the private-data pattern — not published`);
  }
  const files = await walkFiles(join(SKILLS_DIR, name));
  const hasLicense = files.some((f) => /^LICENSE(\.txt)?$/i.test(f.path));
  skills.push({
    name,
    family: config.family,
    description,
    body,
    raw,
    files,
    has_license_file: hasLicense,
    source: config.source,
    prevents: config.prevents,
    canonical_source: `.claude/skills/${name}/SKILL.md`,
    sibling: `.agents/skills/${name}/SKILL.md`,
  });
}

skills.sort((a, b) => (a.family + a.name).localeCompare(b.family + b.name));

const module_ = `// GENERATED by scripts/sync_skill_pages.mjs — do not edit by hand.
// Canonical sources are the SKILL.md files in .claude/skills (synced to .agents/skills).
// Public entries passed the leak gate; ${privateCount} operational skills are private and not listed.

export const SKILL_REGISTRY = ${JSON.stringify(
  { generated_at: new Date().toISOString(), private_count: privateCount, skills },
  null,
  2,
)};

export function skillByName(name) {
  const n = String(name || "").toLowerCase();
  return SKILL_REGISTRY.skills.find((s) => s.name === n) || null;
}
`;

await writeFile(OUT, module_, "utf8");
const verify = await readFile(OUT, "utf8");
if (!verify.includes("SKILL_REGISTRY")) throw new Error("registry write failed verification");
console.log(
  `skill registry: ${skills.length} public skills, ${privateCount} private (unlisted) → ${OUT.slice(root.length + 1)}`,
);
for (const s of skills) console.log(`  ${s.family} · ${s.name} (${s.files.length} files)`);
