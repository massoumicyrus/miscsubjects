#!/usr/bin/env node
/**
 * CODING_LAW (owner order 2026-08-05) — a hash to start, a hash to commit.
 *
 * Every code file being shipped must be covered by a committed lease whose recorded new_sha equals
 * that file's current contents. The lease is what records the version the editing agent read, and
 * without it a commit that silently erased another agent's work is indistinguishable from one that
 * did not.
 *
 * This gate is where the law is felt. It runs in the pre phase of every deploy: an unleased code
 * change fails the ship, names the file, and prints the two calls that fix it.
 *
 * Scope: the executable surface only (functions/, scripts/, migrations/, workers/, apps-script/,
 * skills, schema.sql, wrangler.toml). Articles are excluded — the article write path already refuses
 * a stale body_hash.
 *
 * NO OVERRIDES (owner order 2026-08-06). This gate used to honour three environment variables:
 * CODING_LAW_BASE chose which host answered for the chain, CODING_LAW_RANGE chose which commits were
 * examined, and CODING_LAW_BOOTSTRAP turned an unreachable chain into a pass. Every one of them was
 * settable by the same agent the gate exists to constrain, so the law held only for an agent that
 * chose to be held. They are gone. There is no flag, no env var, and no argument that makes this gate
 * pass a file it would otherwise fail.
 *
 * Run: node scripts/check-coding-law.mjs
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { inCodingLawScope, CODING_LAW_SCOPE } from "../functions/_lib/coding_law_object.js";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
// Fixed. A gate whose source of truth is caller-selectable can be pointed at a chain the caller
// serves itself.
const BASE = "https://miscsubjects.com";
// sha256 of zero bytes — the lawful base for a file being created.
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function git(...args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return { ok: r.status === 0, out: String(r.stdout || "").trim(), err: String(r.stderr || "").trim() };
}

function sha256File(path) {
  const full = join(ROOT, path);
  if (!existsSync(full)) return null;
  return createHash("sha256").update(readFileSync(full)).digest("hex");
}

// The files this deploy carries: everything changed against the remote main, plus anything
// uncommitted in the tree. A deploy ships the working tree, so both count.
function changedFiles() {
  // Fixed. A caller that chooses the range chooses what is examined; CODING_LAW_RANGE="HEAD..HEAD"
  // made every committed change invisible to this gate.
  const range = git("rev-parse", "--verify", "origin/main").ok ? "origin/main..HEAD" : "HEAD~1..HEAD";
  const committed = git("diff", "--name-only", range);
  const working = git("diff", "--name-only", "HEAD");
  const untracked = git("ls-files", "--others", "--exclude-standard");
  const all = [...committed.out.split("\n"), ...working.out.split("\n"), ...untracked.out.split("\n")]
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(all)].filter(inCodingLawScope).filter((p) => existsSync(join(ROOT, p)));
}

const files = changedFiles();
if (!files.length) {
  console.log(JSON.stringify({ ok: true, law: "CODING_LAW", examined: 0, checked: "no code files in this deploy's diff — nothing to lease" }));
  process.exit(0);
}

// The chain. A file is covered when some committed lease's new_sha equals the file's current hash.
let leases = [];
try {
  const r = await fetch(`${BASE}/api/coding-law/leases?state=committed&limit=200`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  leases = (await r.json()).leases || [];
} catch (e) {
  // A gate that cannot read the record must fail loudly, not skip. A silent skip here is precisely
  // how check-receipt-adoption sat broken for weeks.
  // No bootstrap escape. The endpoint has been live since 2026-08-05; a one-time flag that outlives
  // its one time is just an override with a story attached.
  console.error(`CODING_LAW FAIL — could not read the lease chain at ${BASE}/api/coding-law/leases: ${e.message}`);
  console.error("  The chain must answer before code ships. There is no flag that skips this.");
  process.exit(1);
}

const covered = new Map();
for (const lease of leases) {
  for (const f of lease.files || []) {
    if (!f?.new_sha) continue;
    if (!covered.has(f.path)) covered.set(f.path, []);
    covered.get(f.path).push({
      sha: f.new_sha.toLowerCase(),
      base: String(f.base_sha || "").toLowerCase(),
      lease: lease.id,
      agent: lease.agent,
      at: lease.committed_at,
    });
  }
}

// A DECLARED BASE MUST BE A VERSION THAT ACTUALLY EXISTED.
//
// The hole, used by this file's own author on 2026-08-06: base_sha was never checked against
// anything. For a path with no prior committed lease the endpoint says "any base clears", so the
// laundering is to edit the file first, hash the RESULT, and declare that as the base you read. The
// commit then matches trivially and the law records a version nobody ever held.
//
// Two checks close it, and both are computable here because this is the one place with the git
// history in hand:
//
//   base_sha === new_sha        The file did not change under your lease. Either you declared the
//                               edited state as your base, or the file did not belong in the lease.
//                               There is no third case, and neither is lawful.
//
// A FILE YOU ARE CREATING HAS A BASE, AND IT IS EMPTY. The first version of this check made new files
// unleasable: there is no prior version to hash, so every honest attempt collided with the rule above.
// A law that cannot be obeyed is worse than none — it teaches the next agent to launder rather than
// comply, which is the exact behaviour being closed here. So the base for a file that does not exist
// yet is the sha256 of nothing, e3b0c442…b855, which is what you in fact read. It cannot be misused
// for an existing file: for a tracked path the history check still applies, and for an untracked path
// an empty base still differs from the result.
//
//   base_sha unknown to git     For a TRACKED file, the base you claim to have read must be the
//                               sha256 of some version of that path that exists in history. If no
//                               commit ever produced those bytes, you did not read them.
//
// Untracked files are exempt from the second check only — nothing about a file that has never been
// committed can be found in history — but the first check still applies to them, which is precisely
// what would have caught the 2026-08-06 laundering.
function historicalSha256s(path, limit = 60) {
  const log = git("log", `-${limit}`, "--format=%H", "--", path);
  if (!log.ok || !log.out) return new Set();
  const out = new Set();
  for (const commit of log.out.split("\n").filter(Boolean)) {
    const blob = spawnSync("git", ["show", `${commit}:${path}`], { cwd: ROOT, encoding: "buffer" });
    if (blob.status !== 0 || !blob.stdout) continue;
    out.add(createHash("sha256").update(blob.stdout).digest("hex"));
  }
  return out;
}

const forged = [];
for (const path of files) {
  const rows = covered.get(path) || [];
  const now = sha256File(path);
  const relevant = rows.filter((r) => r.sha === now);
  if (!relevant.length) continue;                       // handled below as unleased/stale
  const tracked = git("ls-files", "--error-unmatch", path).ok;
  const history = tracked ? historicalSha256s(path) : null;
  for (const r of relevant) {
    if (!r.base) {
      forged.push({ path, lease: r.lease, agent: r.agent, why: "the lease recorded no base version at all" });
      continue;
    }
    if (r.base === EMPTY_SHA256) continue;             // a declared new file: the base is nothing, correctly
    if (r.base === r.sha) {
      forged.push({ path, lease: r.lease, agent: r.agent, why: "base_sha equals new_sha — the file did not change under this lease, so the base is the edited state, not the version that was read" });
      continue;
    }
    if (history && history.size && !history.has(r.base)) {
      forged.push({ path, lease: r.lease, agent: r.agent, why: `base_sha ${r.base.slice(0, 12)}… matches no version of this path in git history — that content was never committed, so it was never read` });
    }
  }
}

const unleased = [];
const stale = [];
for (const path of files) {
  const now = sha256File(path);
  if (!now) continue;
  const rows = covered.get(path) || [];
  if (!rows.length) { unleased.push({ path, sha: now }); continue; }
  if (!rows.some((r) => r.sha === now)) {
    stale.push({ path, sha: now, last: rows[0] });
  }
}

const bad = [...unleased, ...stale];
if (forged.length) {
  console.error(`CODING_LAW FAIL — ${forged.length} lease record(s) declare a base version that was never read.`);
  for (const f of forged) console.error(`  ${f.path}  (${f.lease} by ${f.agent})\n    ${f.why}`);
  console.error("");
  console.error("The base_sha is the whole point of the law: it is the version you held before you edited.");
  console.error("Take it BEFORE the first edit — shasum -a 256 <path> on the file as you read it — open the");
  console.error("lease, then edit. A base taken after the edit records a version nobody ever had.");
  process.exit(1);
}

if (bad.length) {
  console.error(`CODING_LAW FAIL — ${bad.length} of ${files.length} changed code file(s) are not covered by a committed lease.`);
  for (const u of unleased) console.error(`  unleased  ${u.path}`);
  for (const s of stale) console.error(`  changed since its lease  ${s.path} (last committed ${s.last.sha.slice(0, 12)}… by ${s.last.agent})`);
  console.error("");
  console.error("A lease records the version you read before you edited. Without it, a commit that erased another agent's work looks identical to one that did not. Fix it with the two calls:");
  console.error("");
  console.error(`  curl -s -X POST ${BASE}/api/coding-law/start -H 'content-type: application/json' \\`);
  console.error(`    -d '{"agent":"<you>","intent":"<one line>","files":[${bad.slice(0, 3).map((b) => `{"path":"${b.path}","base_sha":"<sha of what you read>"}`).join(",")}]}'`);
  console.error("");
  console.error(`  curl -s -X POST ${BASE}/api/coding-law/commit -H 'content-type: application/json' \\`);
  console.error(`    -d '{"lease_id":"lease_…","files":[${bad.slice(0, 3).map((b) => `{"path":"${b.path}","new_sha":"${b.sha.slice(0, 12)}…"}`).join(",")}]}'`);
  console.error("");
  console.error("Do not edit this gate, do not add an exemption for your paths, do not bypass. The law: https://miscsubjects.com/a/coding-law");
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  law: "CODING_LAW",
  examined: files.length,
  scope: CODING_LAW_SCOPE,
  overrides: "none — no env var, flag or argument can make this gate pass a file it would otherwise fail",
  checked: `${files.length} changed code file(s) each covered by a committed lease whose new_sha matches its current contents and whose base_sha is a version that actually existed`,
}));
