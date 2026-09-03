#!/usr/bin/env node
/**
 * Protected-widget guardian.
 *
 * The repo working tree is chronically dirty (agents edit live), so git HEAD is NOT a valid
 * "last-good" baseline. Instead the guardian keeps its OWN snapshot of each locked file in
 * .protected/guard-baseline/ and detects changes BETWEEN snapshots — i.e. "what changed since
 * I last looked / this turn". First sight of a file = snapshot it silently (no alert). A later
 * change = quarantine the new version, ask Grok + Kimi for a verdict, text the owner, and heal on 👍.
 *
 * Modes:
 *   --baseline         snapshot all locked files now (no alerts). Run after authorized work.
 *   --check            alert on any locked file changed since its snapshot (judge + text + pending)
 *   --heal <path>      restore <path> from its snapshot; text; clear pending            (👍)
 *   --adopt <path>     accept the change: snapshot becomes current; clear pending       (👎)
 *   --list             show pending alerts
 *   --quiet            do not send texts (local testing)   --nojudge  skip Grok/Kimi (fast testing)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, copyFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createHash } from "crypto";

const ROOT = "/Users/owner/miscsubjects-pages";
const PHONE = process.env.OWNER_PHONE || "[OWNER_PHONE]";
const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const args = process.argv.slice(2);
const QUIET = args.includes("--quiet") || process.env.GUARD_QUIET === "1";
const NOJUDGE = args.includes("--nojudge");
const MANIFESTS = ["PROTECTED_WIDGETS.md", "PROTECTED_FEATURES.md"];
const BASELINE = join(ROOT, ".protected", "guard-baseline");
const PENDING = join(ROOT, ".protected", "pending");
const QUARANTINE = join(ROOT, ".protected", "quarantine");

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
function uuid() {
  return 'g_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}
async function logEvent(action, path, details, result) {
  const id = uuid();
  const ts = new Date().toISOString();
  const reqPreview = path || action;
  const resPreview = JSON.stringify(result).slice(0, 400);
  const reqJson = JSON.stringify({ path, details }).slice(0, 4000);
  const resJson = JSON.stringify(result).slice(0, 4000);
  const body = [
    'INSERT INTO events (id, ts, source, key, action, direction, status, request_preview, response_preview, request_json, response_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, ts, 'guardian', 'GUARDIAN_EVENT', action, 'internal', '200', reqPreview, resPreview, reqJson, resJson
  ].join('|');
  await disp('LEDGER_EXEC', body);
}
function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  return raw.match(/TERMINAL_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
}
const KEY = loadKey();

async function disp(key, body, ms = 22000) {
  for (let i = 0; i < 3; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(BASE + "/api/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json", "x-terminal-key": KEY },
        body: JSON.stringify({ key, body }),
        signal: ctrl.signal,
      });
      const j = await r.json();
      clearTimeout(t);
      if (j && (j.ok || j.result != null)) return j.result;
    } catch { clearTimeout(t); }
    await sleep(500);
  }
  return null;
}

const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const slug = (p) => p.replace(/[^A-Za-z0-9]+/g, "_");
const abs = (p) => join(ROOT, p);
const snapPath = (p) => join(BASELINE, slug(p));

function lockedFiles() {
  const set = new Set();
  for (const mf of MANIFESTS) {
    let txt = ""; try { txt = readFileSync(join(ROOT, mf), "utf8"); } catch { continue; }
    for (const m of txt.matchAll(/`([^`]+\.(?:js|mjs))`/g)) {
      const p = m[1].trim();
      if (p.includes("/") && existsSync(abs(p))) set.add(p);
    }
  }
  return [...set];
}

async function judge(path, before, after) {
  if (NOJUDGE) return { grok: "(skipped)", kimi: "(skipped)" };
  const prompt = `A PROTECTED file changed since the last snapshot: ${path}\nOld size ${before.length}b, new size ${after.length}b.\nNew head:\n${after.toString("utf8").slice(0, 900)}\n\nYou are a guardian. Is this likely a REGRESSION that should be reverted, or a legitimate change? One line: "REVERT: <why>" or "KEEP: <why>".`;
  const [g, k] = await Promise.allSettled([disp("XAI_CHAT", prompt), disp("ASK_KIMI", prompt)]);
  const val = (r) => (r.status === "fulfilled" && r.value ? String(r.value).slice(0, 200) : "(no verdict)");
  return { grok: val(g), kimi: val(k) };
}

async function notifyEnabled() {
  if (QUIET) return false;
  const v = await disp("KV_GET", "guard_notify");
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

// Owner on/off for the whole guardian (owner order 2026-08-30): KV `guardian_master`.
// '0' / 'off' / 'false' = OFF — check() reports zero drift and does nothing: no snapshot
// diffing, no quarantine, no model judge, no text. Maintenance modes (--baseline, --adopt,
// --heal, --list) keep working so the machinery is ready when he flips it back ON.
// The last successful read is mirrored to .protected/guardian-master so a network failure
// keeps the owner's setting instead of silently re-arming the watch. Flip it at
// /admin/vault (top) or: curl -X PUT "$BASE/api/kv?key=guardian_master" -d 0.
const OFF_VALUES = new Set(["0", "off", "false", "OFF"]);
function mirrorPath() { return join(ROOT, ".protected", "guardian-master"); }
async function masterOn() {
  const v = await disp("KV_GET", "guardian_master");
  if (v != null && String(v).trim() !== "") {
    try { mkdirSync(join(ROOT, ".protected"), { recursive: true }); writeFileSync(mirrorPath(), String(v).trim()); } catch {}
    return !OFF_VALUES.has(String(v).trim());
  }
  try { return !OFF_VALUES.has(readFileSync(mirrorPath(), "utf8").trim()); } catch {}
  return true;
}

async function check() {
  if (!(await masterOn())) {
    console.log(JSON.stringify({ ok: true, guardian: "off", drift: 0, report: [], note: "owner switch guardian_master is OFF — /admin/vault to re-arm" }));
    return;
  }
  const textOn = await notifyEnabled();
  const locked = lockedFiles();
  mkdirSync(BASELINE, { recursive: true });
  const firstSeen = [], drifted = [];
  for (const p of locked) {
    const sp = snapPath(p);
    if (!existsSync(sp)) { copyFileSync(abs(p), sp); firstSeen.push(p); continue; }
    if (sha(readFileSync(abs(p))) !== sha(readFileSync(sp))) drifted.push(p);
  }
  if (!drifted.length) {
    const result = { ok: true, locked: locked.length, first_seen: firstSeen.length, drift: 0 };
    await logEvent('check', null, { first_seen: firstSeen }, result);
    console.log(JSON.stringify(result));
    return;
  }
  mkdirSync(PENDING, { recursive: true }); mkdirSync(QUARANTINE, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const report = [];
  for (const p of drifted) {
    const before = readFileSync(snapPath(p)), after = readFileSync(abs(p));
    copyFileSync(abs(p), join(QUARANTINE, `${slug(p)}.${ts}`)); // never lose the overwrite
    const verdict = await judge(p, before, after);
    writeFileSync(join(PENDING, `${slug(p)}.json`), JSON.stringify({ path: p, ts, verdict }, null, 2));
    const msg = `⛔️ PROTECTED FILE CHANGED\n${p}\n(${before.length}b → ${after.length}b)\n\nGrok: ${verdict.grok}\nKimi: ${verdict.kimi}\n\n👍 or "heal ${p}" → restore.\n👎 or "keep ${p}" → adopt.`;
    let texted = false;
    if (textOn) texted = !!(await disp("SEND_BY_CHANNEL", `blooio|${PHONE}|${msg}`));
    report.push({ path: p, verdict, texted });
  }
  console.log(JSON.stringify({ ok: true, locked: locked.length, drift: drifted.length, report }, null, 2));
  await logEvent('check', null, { drifted }, { ok: true, locked: locked.length, drift: drifted.length, report });
}

async function heal(p) {
  if (!existsSync(snapPath(p))) { console.log(JSON.stringify({ ok: false, error: "no snapshot for " + p })); return; }
  copyFileSync(snapPath(p), abs(p));
  const clean = sha(readFileSync(abs(p))) === sha(readFileSync(snapPath(p)));
  try { rmSync(join(PENDING, `${slug(p)}.json`)); } catch {}
  const result = { ok: true, healed: p, clean };
  if (await notifyEnabled()) await disp("SEND_BY_CHANNEL", `blooio|${PHONE}|✅ HEALED ${p} — restored from guardian snapshot. Clean: ${clean}.`);
  await logEvent('heal', p, {}, result);
  console.log(JSON.stringify(result));
}

async function adopt(p) {
  copyFileSync(abs(p), snapPath(p));
  try { rmSync(join(PENDING, `${slug(p)}.json`)); } catch {}
  const result = { ok: true, adopted: p };
  if (await notifyEnabled()) await disp("SEND_BY_CHANNEL", `blooio|${PHONE}|📌 ADOPTED ${p} — change kept; snapshot updated.`);
  await logEvent('adopt', p, {}, result);
  console.log(JSON.stringify(result));
}

async function baseline() {
  const locked = lockedFiles();
  mkdirSync(BASELINE, { recursive: true });
  for (const p of locked) copyFileSync(abs(p), snapPath(p));
  const result = { ok: true, snapshotted: locked.length, files: locked };
  console.log(JSON.stringify(result));
  await logEvent('baseline', null, {}, result);
}

function list() {
  const items = existsSync(PENDING) ? readdirSync(PENDING).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(PENDING, f), "utf8"))) : [];
  console.log(JSON.stringify({ pending: items }, null, 2));
}

const mode = args.find((a) => a.startsWith("--") && !["--quiet", "--nojudge"].includes(a));
const target = args.find((a) => !a.startsWith("--"));
if (mode === "--baseline") await baseline();
else if (mode === "--heal") await heal(target);
else if (mode === "--adopt") await adopt(target);
else if (mode === "--list") list();
else await check();
