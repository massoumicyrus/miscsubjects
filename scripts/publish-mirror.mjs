#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync, copyFileSync,
} from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { scrubOwnerIdentity } from '../functions/_lib/public_secret_guard.js';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CONFIG_PATH = join(ROOT, 'scripts', 'publish-mirror.config.json');

// ───────────────────────────── arguments ─────────────────────────────
const argv = process.argv.slice(2);
function flag(name) { return argv.includes(name); }
function opt(name, dflt) { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; }
const OUT = resolve(opt('--out', join(ROOT, '.tmp', 'mirror')));
const PUSH = flag('--push');
const REQUIRE_GITLEAKS = flag('--require-gitleaks');
const AS_JSON = flag('--json');
// --keep leaves a FAILED projection on disk for inspection. The push step never runs after a failed
// gate regardless, so this only changes what the operator can look at.
const KEEP_ON_FAIL = flag('--keep');
// --report <path> writes every gate hit (with a short masked context window) to a file, because the
// console summary caps each gate at forty lines and a repair needs the whole list.
const REPORT = opt('--report', null);

function die(code, msg, extra) {
  const body = { ok: false, error: msg, ...(extra || {}) };
  console.error(AS_JSON ? JSON.stringify(body) : `publish-mirror: ${msg}${extra ? '\n' + JSON.stringify(extra, null, 1) : ''}`);
  process.exit(code);
}

if (!existsSync(CONFIG_PATH)) {
  die(2, 'config missing: scripts/publish-mirror.config.json is not in this checkout. This is expected inside a projection — the projection is the output of this script, not a place to run it. Run it from the operating repository.');
}
const CFG = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
if (OUT === ROOT || ROOT.startsWith(OUT + '/')) die(2, '--out must be outside the source repository');

function git(args, cwd = ROOT) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return { ok: r.status === 0, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() };
}

// ───────────────────────────── 1. source listing ─────────────────────────────
const sourceSha = git(['rev-parse', 'HEAD']).out;
const sourceShort = sourceSha.slice(0, 12);
const listed = git(['ls-files', '-z']);
if (!listed.ok) die(2, 'git ls-files failed', { stderr: listed.err });
const tracked = listed.out.split('\0').filter(Boolean);

const excludeRes = CFG.exclude_patterns.map((e) => ({ re: new RegExp(e.re), why: e.why, hits: 0 }));
const rootSet = new Set(CFG.include_root_files);
function selected(path) {
  const isRoot = !path.includes('/');
  if (isRoot ? !rootSet.has(path) : !CFG.include_prefixes.some((p) => path.startsWith(p))) return { keep: false, why: 'not in allow-list' };
  for (const e of excludeRes) if (e.re.test(path)) { e.hits += 1; return { keep: false, why: e.why }; }
  return { keep: true };
}
let kept = [];
const droppedByReason = new Map();
for (const p of tracked) {
  const s = selected(p);
  if (s.keep) kept.push(p);
  else droppedByReason.set(s.why, (droppedByReason.get(s.why) || 0) + 1);
}

const PROFILE = CFG.profile || null;
const profileRules = PROFILE ? (PROFILE.exclude || []).map((r) => ({ re: new RegExp(r.re, r.flags || ''), why: r.why })) : [];
const scopedAllow = PROFILE ? (PROFILE.scoped_allow || []).map((s) => ({ prefix: s.prefix, re: new RegExp(s.re), why: s.why })) : [];
const trackedSet = new Set(tracked);
const droppedByProfile = new Map(); // src path -> why
function migrationIsContent(path) {
  if (!PROFILE?.migrations || !/^migrations\/.*\.sql$/.test(path)) return false;
  const text = readFileSync(join(ROOT, path), 'utf8');
  if (/\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|TRIGGER|VIEW)\b/i.test(text)) return false;
  return Buffer.byteLength(text) > (PROFILE.migrations.data_only_max_bytes || 30000);
}
function profileWhy(path) {
  if (!PROFILE) return null;
  for (const r of profileRules) if (r.re.test(path)) return r.why;
  for (const s of scopedAllow) if (path.startsWith(s.prefix) && !s.re.test(path)) return s.why;
  if (migrationIsContent(path)) return PROFILE.migrations.why;
  return null;
}
if (PROFILE) {
  const next = [];
  for (const p of kept) {
    const why = profileWhy(p);
    if (why) droppedByProfile.set(p, why); else next.push(p);
  }
  kept = next;
}

// Stubs. For every kept JavaScript file, every relative import that points at a module the profile
// dropped becomes a stub at that path. A stub exports the same names as the original and throws
// with the module's name when any of them is used, so a reader sees exactly where the tenant code
// was, and the rest of the primitive still parses, loads and runs up to that boundary.
const stubs = new Map(); // dst path -> stub source
function resolveRel(fromPath, spec) {
  const parts = (dirname(fromPath) + '/' + spec).split('/');
  const out = [];
  for (const seg of parts) { if (seg === '..') out.pop(); else if (seg !== '.' && seg !== '') out.push(seg); }
  return out.join('/');
}
function exportNamesOf(src) {
  const names = new Set();
  let hasDefault = false;
  for (const m of src.matchAll(/^\s*export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^\s*export\s+(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^\s*export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const seg = part.trim(); if (!seg) continue;
      const as = seg.split(/\s+as\s+/);
      const exported = (as[1] || as[0]).trim();
      if (exported === 'default') hasDefault = true; else if (/^[A-Za-z_$][\w$]*$/.test(exported)) names.add(exported);
    }
  }
  if (/^\s*export\s+default\b/m.test(src)) hasDefault = true;
  return { names: [...names].sort(), hasDefault, star: /^\s*export\s+\*\s+from/m.test(src) };
}
function stubSource(path, original) {
  const { names, hasDefault, star } = exportNamesOf(original);
  const lines = original.split('\n').length;
  const out = [
    `// STUB. The module that lived here is a tenant integration of the operating repository and is not`,
    `// part of the public primitive. The original (${lines} lines) exported the names below; each one`,
    `// throws with this path when used, so the kernel keeps its shape and a caller sees exactly what`,
    `// is absent. See docs/PUBLISHING.md, section "The primitive profile".`,
    `const excluded = (name) => new Proxy(function excluded() {}, {`,
    `  apply() { throw new Error('excluded from the public primitive: ${path}#' + name); },`,
    `  construct() { throw new Error('excluded from the public primitive: ${path}#' + name); },`,
    `  get(_t, p) { if (p === 'then' || p === Symbol.toPrimitive || p === Symbol.iterator || p === Symbol.toStringTag) return undefined; throw new Error('excluded from the public primitive: ${path}#' + name + '.' + String(p)); },`,
    `});`,
  ];
  for (const n of names) out.push(`export const ${n} = excluded(${JSON.stringify(n)});`);
  if (hasDefault) out.push(`export default excluded("default");`);
  if (star) out.push(`// The original re-exported everything from another module (export * from); those names are not enumerable here.`);
  return out.join('\n') + '\n';
}
if (PROFILE?.stub_excluded_imports) {
  const importRe = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g;
  for (const src of kept) {
    if (!/\.(m?js|cjs)$/.test(src)) continue;
    const text = readFileSync(join(ROOT, src), 'utf8');
    for (const m of text.matchAll(importRe)) {
      const spec = m[1] || m[2] || m[3];
      const target = resolveRel(src, spec);
      if (!droppedByProfile.has(target) || stubs.has(target)) continue;
      if (!trackedSet.has(target)) continue;
      stubs.set(target, stubSource(target, readFileSync(join(ROOT, target), 'utf8')));
    }
  }
}

// ───────────────────────────── 2 + 3. substitution ─────────────────────────────
const binaryExt = new Set(CFG.binary_extensions || []);
// Source and document extensions are always text, whatever bytes they contain: a source file can hold
// a literal NUL byte inside a string, and a byte sniff would class it binary, skip substitution and
// skip the string gate. The sniff decides only for extensions this list does not know.
const textExt = new Set(CFG.text_extensions || ['.js', '.mjs', '.cjs', '.ts', '.json', '.jsonc', '.md', '.txt', '.sql', '.sh', '.yml', '.yaml', '.toml', '.html', '.css', '.svg', '.xml', '.plist', '.gs', '.py', '.csv', '.env.example', '.gitignore']);
function isBinary(path, buf) {
  const ext = extname(path).toLowerCase();
  if (binaryExt.has(ext)) return true;
  if (textExt.has(ext) || textExt.has(path.split('/').pop())) return false;
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i += 1) if (buf[i] === 0) return true;
  return false;
}

const emailRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const ownerDomains = new Set((CFG.owner_email_domains || []).map((d) => d.toLowerCase()));
const allowedDomains = new Set((CFG.allowed_email_domains || []).map((d) => d.toLowerCase()));
const literalRes = (CFG.literal_replacements || []).map(([re, flags, rep]) => [new RegExp(re, flags), rep]);
const phoneRes = (CFG.owner_phone_patterns || []).map(([re, rep]) => [new RegExp(re, 'g'), rep]);
const genericPhone = CFG.generic_phone_pattern ? [new RegExp(CFG.generic_phone_pattern[0], 'g'), CFG.generic_phone_pattern[1]] : null;

const identCtx = CFG.identifier_context_replacement || null;
const identCtxRe = identCtx ? new RegExp(`([A-Za-z0-9_])?(${identCtx.from})(?=([A-Za-z0-9_]))|([A-Za-z0-9_])(${identCtx.from})`, 'gi') : null;
function caseLike(sample, word) {
  if (sample === sample.toUpperCase() && /[A-Z]/.test(sample)) return word.toUpperCase();
  if (/^[A-Z]/.test(sample)) return word[0].toUpperCase() + word.slice(1);
  return word;
}

function substitute(text) {
  const counts = {};
  const bump = (k, n) => { if (n) counts[k] = (counts[k] || 0) + n; };
  let t = text;
  for (const [re, rep] of literalRes) {
    let n = 0; t = t.replace(re, (...m) => { n += 1; return rep.replace(/\$(\d)/g, (_, d) => m[Number(d)] ?? ''); }); bump('literal', n);
  }
  {
    let n = 0;
    t = t.replace(emailRe, (m) => {
      const domain = m.split('@')[1].toLowerCase();
      if (allowedDomains.has(domain)) return m;
      n += 1;
      return ownerDomains.has(domain) ? '[OWNER_EMAIL]' : '[REDACTED_EMAIL]';
    });
    bump('email', n);
  }
  if (identCtx) {
    // A bare identifier that IS the name: an all-caps constant (OWNER), a declared binding
    // (const owner = …), a property (.owner), a call (owner(…)). The general sweep would turn these
    // into prose and break the code.
    const f = identCtx.from;
    const rules = [
      new RegExp(`\\b${f.toUpperCase()}\\b`, 'g'),
      new RegExp(`(?<=\\b(?:const|let|var|function|class|async function)\\s+)${f}\\b`, 'gi'),
      new RegExp(`(?<=\\.)${f}\\b`, 'gi'),
      new RegExp(`\\b${f}(?=\\s*[=(])`, 'gi'),
    ];
    let n = 0;
    for (const re of rules) t = t.replace(re, (m) => { n += 1; return caseLike(m, identCtx.to); });
    bump('identifier', n);
  }
  // The site's own owner-identity table runs BEFORE the identifier rule: it knows the home directory,
  // the handles and the full name as whole strings. Run after, the identifier rule would split those
  // strings (the first name inside the handle) and leave the rest for the gate to catch.
  {
    const before = t;
    t = scrubOwnerIdentity(t);
    if (t !== before) bump('owner_identity', 1);
  }
  if (identCtxRe) {
    let n = 0;
    t = t.replace(identCtxRe, (m, pre1, name1, _post, pre2, name2) => {
      n += 1;
      const pre = pre1 ?? pre2 ?? '';
      const name = name1 ?? name2;
      return pre + caseLike(name, identCtx.to);
    });
    bump('identifier', n);
  }
  for (const [re, rep] of phoneRes) { let n = 0; t = t.replace(re, () => { n += 1; return rep; }); bump('phone', n); }
  if (genericPhone) { let n = 0; t = t.replace(genericPhone[0], () => { n += 1; return genericPhone[1]; }); bump('phone', n); }
  // A final general sweep for anything the earlier passes exposed (an email that contained a handle,
  // a name after a placeholder).
  {
    const before = t;
    t = scrubOwnerIdentity(t);
    if (t !== before) bump('owner_identity', 1);
  }
  return { text: t, counts };
}

function projectPath(path) {
  let p = path;
  for (const [from, to] of CFG.path_replacements || []) p = p.split(from).join(to);
  return p;
}

// ───────────────────────────── 3b. diary removal ─────────────────────────────
// The operating repository narrates itself: comments record who ordered a change, on what date, and
// what went wrong the day before. That record belongs to the operation, not to the primitive. A
// comment is removed when it matches the diary pattern; code, strings and regex literals are never
// touched. JavaScript is scanned with a small state machine (strings, template literals with nested
// expressions, regex literals by the usual preceding-token rule, line and block comments). SQL, shell,
// YAML and TOML use full-line comment groups. Every JavaScript file whose comments were altered is
// re-parsed by Node; if it no longer parses, the original is kept and the file is recorded.
const STRIP = PROFILE?.strip_comments || null;
const diaryCommentRe = STRIP ? new RegExp(STRIP.diary_re, STRIP.flags || 'i') : null;
const stripExt = new Set(STRIP?.extensions || []);

function jsComments(src) {
  // Returns [{start, end, text, kind:'line'|'block', fullLine}] in source order.
  const out = [];
  const n = src.length;
  let i = 0;
  let lastSig = ''; // last significant (non-space, non-comment) character
  let lastWord = ''; // last identifier/keyword
  const regexPrev = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', '']);
  const regexWords = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);
  const tmplDepth = []; // stack of ${ depths inside template literals
  const readString = (q) => { i += 1; while (i < n && src[i] !== q) { if (src[i] === '\\') i += 1; if (src[i] === '\n' && q !== '`') break; i += 1; } i += 1; };
  const readTemplate = () => {
    i += 1;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i += 1; return; }
      if (c === '$' && src[i + 1] === '{') { i += 2; tmplDepth.push(1); scanCode(true); continue; }
      i += 1;
    }
  };
  const readRegex = () => {
    i += 1; let cls = false;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '\n') break;
      if (cls) { if (c === ']') cls = false; i += 1; continue; }
      if (c === '[') { cls = true; i += 1; continue; }
      if (c === '/') { i += 1; while (i < n && /[a-z]/i.test(src[i])) i += 1; return; }
      i += 1;
    }
  };
  function scanCode(inTemplateExpr) {
    while (i < n) {
      const c = src[i];
      if (inTemplateExpr && c === '}') {
        const d = tmplDepth[tmplDepth.length - 1];
        if (d <= 1) { tmplDepth.pop(); i += 1; return; }
        tmplDepth[tmplDepth.length - 1] = d - 1; lastSig = c; lastWord = ''; i += 1; continue;
      }
      if (inTemplateExpr && c === '{') { tmplDepth[tmplDepth.length - 1] += 1; lastSig = c; lastWord = ''; i += 1; continue; }
      if (c === '/' && src[i + 1] === '/') {
        const start = i; while (i < n && src[i] !== '\n') i += 1;
        const lineStart = src.lastIndexOf('\n', start - 1) + 1;
        out.push({ start, end: i, text: src.slice(start, i), kind: 'line', fullLine: /^\s*$/.test(src.slice(lineStart, start)) });
        continue;
      }
      if (c === '/' && src[i + 1] === '*') {
        const start = i; const close = src.indexOf('*/', i + 2); i = close < 0 ? n : close + 2;
        const lineStart = src.lastIndexOf('\n', start - 1) + 1;
        const after = src.indexOf('\n', i); const rest = src.slice(i, after < 0 ? n : after);
        out.push({ start, end: i, text: src.slice(start, i), kind: 'block', fullLine: /^\s*$/.test(src.slice(lineStart, start)) && /^\s*$/.test(rest) });
        continue;
      }
      if (c === '"' || c === "'") { readString(c); lastSig = c; lastWord = ''; continue; }
      if (c === '`') { readTemplate(); lastSig = '`'; lastWord = ''; continue; }
      if (c === '/') {
        const isRegex = regexPrev.has(lastSig) || regexWords.has(lastWord);
        if (isRegex) { readRegex(); lastSig = '/'; lastWord = ''; continue; }
        lastSig = c; lastWord = ''; i += 1; continue;
      }
      if (/\s/.test(c)) { i += 1; continue; }
      if (/[A-Za-z_$]/.test(c)) { let j = i; while (j < n && /[\w$]/.test(src[j])) j += 1; lastWord = src.slice(i, j); lastSig = 'a'; i = j; continue; }
      if (/[0-9]/.test(c)) { let j = i; while (j < n && /[\w.]/.test(src[j])) j += 1; lastWord = ''; lastSig = '0'; i = j; continue; }
      lastSig = c; lastWord = ''; i += 1;
    }
  }
  scanCode(false);
  return out;
}

function stripDiaryJs(src) {
  const comments = jsComments(src);
  if (!comments.length) return { text: src, removed: 0 };
  // Group consecutive full-line // comments into one unit; a block comment is its own unit.
  const units = [];
  for (const c of comments) {
    const prev = units[units.length - 1];
    if (c.kind === 'line' && c.fullLine && prev && prev.kind === 'line' && prev.fullLine && /^\n[ \t]*$/.test(src.slice(prev.end, c.start))) {
      prev.end = c.end; prev.text += '\n' + c.text; continue;
    }
    units.push({ ...c });
  }
  const remove = units.filter((u) => diaryCommentRe.test(u.text));
  if (!remove.length) return { text: src, removed: 0 };
  let out = ''; let pos = 0;
  for (const u of remove) {
    let s = u.start; let e = u.end;
    if (u.fullLine) {
      // take the whole lines, including the trailing newline, so no blank gap is left behind
      s = src.lastIndexOf('\n', s - 1) + 1;
      if (src[e] === '\n') e += 1;
    } else {
      // trailing comment: also drop the spaces that separated it from the code
      while (s > 0 && (src[s - 1] === ' ' || src[s - 1] === '\t')) s -= 1;
    }
    out += src.slice(pos, s); pos = e;
  }
  out += src.slice(pos);
  return { text: out, removed: remove.length };
}

function stripDiaryLines(src, marker) {
  // Full-line comment groups for --, # and similar. Shebangs are never comments here.
  const lines = src.split('\n');
  const isC = (l) => l.trimStart().startsWith(marker) && !l.startsWith('#!');
  const out = []; let removed = 0; let i = 0;
  while (i < lines.length) {
    if (!isC(lines[i])) { out.push(lines[i]); i += 1; continue; }
    let j = i; while (j < lines.length && isC(lines[j])) j += 1;
    const group = lines.slice(i, j);
    if (diaryCommentRe.test(group.join('\n'))) removed += 1; else out.push(...group);
    i = j;
  }
  return { text: out.join('\n'), removed };
}

const MD = PROFILE?.markdown_filter || null;
const diaryMdRe = MD ? new RegExp(MD.diary_re, MD.flags || 'i') : null;
function filterMarkdown(src) {
  // Blank-line-delimited blocks. In a list block each item (its bullet line plus any continuation
  // lines) is judged on its own; any other block that matches is dropped whole; fenced code is never
  // touched. Placeholders left by identity substitution are then written as words, because a document
  // is read by people and a bracketed token is not a word.
  const blocks = src.split(/\n{2,}/);
  const out = []; let removed = 0; let inFence = false;
  const bullet = /^\s*([-*+]|\d+\.)\s/;
  for (const b of blocks) {
    const fences = (b.match(/^```/gm) || []).length;
    if (inFence || fences) { out.push(b); if (fences % 2) inFence = !inFence; continue; }
    const lines = b.split('\n');
    if (bullet.test(lines[0])) {
      const items = [];
      for (const l of lines) { if (bullet.test(l) || !items.length) items.push([l]); else items[items.length - 1].push(l); }
      const keep = items.filter((it) => !diaryMdRe.test(it.join('\n')));
      removed += items.length - keep.length;
      if (keep.length) out.push(keep.flat().join('\n'));
      continue;
    }
    if (diaryMdRe.test(b)) { removed += 1; continue; }
    out.push(b);
  }
  let text = out.join('\n\n').replace(/\n{3,}/g, '\n\n');
  for (const [token, words] of Object.entries(PROFILE?.markdown_placeholders || {})) text = text.split(token).join(words);
  return { text, removed };
}

const phraseRules = (PROFILE?.string_phrase_replacements?.rules || []).map(([re, flags, rep]) => [new RegExp(re, flags || 'g'), rep]);

const JSON_T = PROFILE?.json_transforms || {};
function transformJson(path, text) {
  const how = JSON_T[path];
  if (!how) return null;
  const j = JSON.parse(text);
  if (how === 'drop_quoted_words') {
    for (const e of j.entries || []) for (const k of PROFILE.json_drop_keys || []) delete e[k];
    j._what = 'Every named failure mode of the build as one mechanical entry. scripts/check-failure-vault.mjs enforces each entry on every commit (pre-commit) and every deploy (protected-features chain). An entry names the files and the strings they must contain so the failure cannot recur silently.';
    return JSON.stringify(j, null, 2) + '\n';
  }
  if (how === 'prune_missing_gates') {
    delete j._why;
    return JSON.stringify(j, null, 2) + '\n'; // entries are pruned after the file list is final, below
  }
  return null;
}

function nodeParses(text) {
  const r = spawnSync('node', ['--input-type=module', '--check'], { input: text, encoding: 'utf8' });
  return { ok: r.status === 0, err: String(r.stderr || '').split('\n').slice(0, 3).join(' ').trim() };
}

// Fresh output directory, always. A stale projection with a failed gate must never survive.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const files = []; // {src, dst, bytes, binary, subs}
let totalBytes = 0;
const substituted = [];
const commentStripSkipped = [];
for (const src of kept) {
  const buf = readFileSync(join(ROOT, src));
  const dst = projectPath(src);
  const binary = isBinary(src, buf);
  let outBuf = buf;
  let subs = {};
  if (!binary) {
    const r = substitute(buf.toString('utf8'));
    let text = r.text;
    subs = r.counts;
    let ext = extname(src).toLowerCase();
    // An extensionless executable with a shebang (git hooks) is a shell file for comment purposes.
    if (!ext && text.startsWith('#!')) ext = '.sh';
    if (PROFILE) {
      const jt = transformJson(src, text);
      if (jt !== null) { text = jt; subs.json_transform = 1; }
      else if (stripExt.has(ext) && /\.(m?js|cjs)$/.test(src)) {
        const s = stripDiaryJs(text);
        if (s.removed) {
          const check = nodeParses(s.text);
          if (check.ok || !nodeParses(text).ok) { text = s.text; subs.diary_comments = s.removed; }
          else { commentStripSkipped.push({ path: dst, why: check.err }); }
        }
      } else if (stripExt.has(ext) && ext === '.sql') {
        const s = stripDiaryLines(text, '--'); if (s.removed) { text = s.text; subs.diary_comments = s.removed; }
      } else if (stripExt.has(ext)) {
        const s = stripDiaryLines(text, '#'); if (s.removed) { text = s.text; subs.diary_comments = s.removed; }
      } else if (ext === '.md' && diaryMdRe) {
        const s = filterMarkdown(text);
        if (s.removed) subs.diary_paragraphs = s.removed;
        if (s.text !== text) { text = s.text; subs.markdown_words = 1; }
      }
      // Narrative markers that live inside strings and values, in every text file.
      if (phraseRules.length) {
        let n = 0;
        for (const [re, rep] of phraseRules) text = text.replace(re, () => { n += 1; return rep; });
        if (n) subs.diary_phrases = n;
      }
    }
    outBuf = Buffer.from(text, 'utf8');
    if (Object.keys(subs).length) substituted.push({ path: dst, substitutions: subs });
  }
  const full = join(OUT, dst);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, outBuf);
  totalBytes += outBuf.length;
  files.push({ src, dst, bytes: outBuf.length, binary });
}

// Stubs are written after the real files so a stub can never overwrite a kept module.
for (const [target, original] of stubs) {
  const dst = projectPath(target);
  const full = join(OUT, dst);
  mkdirSync(dirname(full), { recursive: true });
  const source = substitute(original).text; // the original path and export names may carry identifiers
  writeFileSync(full, source);
  const bytes = Buffer.byteLength(source);
  totalBytes += bytes;
  files.push({ src: target, dst, bytes, binary: false, stub: true });
}

// gates.manifest.json names every gate script; the profile may have dropped some. Prune the manifest
// to the scripts that exist in the projection so ship.mjs and check-gates-wired.mjs agree.
let prunedGates = [];
if (PROFILE && JSON_T['scripts/gates.manifest.json'] === 'prune_missing_gates') {
  const mp = join(OUT, 'scripts', 'gates.manifest.json');
  if (existsSync(mp)) {
    const j = JSON.parse(readFileSync(mp, 'utf8'));
    for (const name of Object.keys(j.gates || {})) {
      if (!existsSync(join(OUT, 'scripts', name))) { prunedGates.push(name); delete j.gates[name]; }
    }
    const text = JSON.stringify(j, null, 2) + '\n';
    writeFileSync(mp, text);
    const f = files.find((x) => x.dst === 'scripts/gates.manifest.json');
    if (f) { totalBytes += Buffer.byteLength(text) - f.bytes; f.bytes = Buffer.byteLength(text); }
  }
}

// ───────────────────────────── 4. gates on the output ─────────────────────────────
const gates = [];
const failures = [];
function gate(name, examined, hits, note) {
  const ok = hits.length === 0;
  gates.push({ name, examined, hits: hits.length, ok, ...(note ? { note } : {}) });
  if (!ok) failures.push({ gate: name, hits: hits.slice(0, 40), more: Math.max(0, hits.length - 40), _all: hits.slice(40) });
}
function lineOf(text, idx) { return text.slice(0, idx).split('\n').length; }
// A window around a match for the report, with the match itself masked. Enough to find the line and
// see the shape of what survived; never the string the gate exists to keep out.
function contextOf(text, idx, len) {
  const before = text.slice(Math.max(0, idx - 28), idx).replace(/\s+/g, ' ');
  const after = text.slice(idx + len, idx + len + 28).replace(/\s+/g, ' ');
  return `${before}«${'#'.repeat(Math.min(len, 12))}»${after}`;
}

// 4a. forbidden strings after substitution — identity and secret patterns. Reports file:line and
// what class matched; never the matched text.
{
  const rules = CFG.forbidden_after_redaction.map((r) => ({ re: new RegExp(r.re, (r.flags || '') + 'g'), what: r.what, textOnly: !!r.text_only }));
  const hits = [];
  let examined = 0;
  for (const f of files) {
    examined += 1;
    // Binary files are scanned too, as raw bytes: an ASCII identity string inside a font, an image
    // comment or a file wrongly classed as binary is still an identity string. Only text files were
    // substituted, so a hit here on a binary file names a file that must be excluded.
    const buf = readFileSync(join(OUT, f.dst));
    const text = f.binary ? buf.toString('latin1') : buf.toString('utf8');
    for (const rule of rules) {
      if (rule.textOnly && f.binary) continue; // a brand word inside a font's glyph table is noise, not a leak
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(text))) {
        hits.push(`${f.dst}:${lineOf(text, m.index)} ${rule.what}${f.binary ? ' (binary file: exclude it)' : ''} :: ${contextOf(text, m.index, m[0].length)}`);
        if (m.index === rule.re.lastIndex) rule.re.lastIndex += 1;
      }
    }
  }
  gate('forbidden_strings', examined, hits);
}

// 4b. paths — no identity in a path either.
{
  const rules = CFG.forbidden_after_redaction.filter((r) => /name|handle|phone|home/.test(r.what)).map((r) => new RegExp(r.re, r.flags || ''));
  const hits = files.filter((f) => rules.some((re) => re.test(f.dst))).map((f) => f.dst);
  gate('paths', files.length, hits);
}

// 4c. real vault values. Local only: the vault is on the operator's machine and nowhere else. Every
// value of twelve characters or more is searched for as an exact string. A secret value present in
// the output is a defect in the source that this script refuses to launder — fix the file. An
// identifier value present means the config lacks a substitution for it.
{
  const vaultPath = String(CFG.vault?.path || '').replace(/^~/, homedir());
  if (vaultPath && existsSync(vaultPath)) {
    const identRe = new RegExp(CFG.vault.identifier_key_pattern || '$^');
    // Resource NAMES that are deployable configuration, not credentials: the Pages project name and
    // the D1 database names live in wrangler.toml and are required to understand the deploy. They are
    // exempt by key name here; a value that looks like a credential is never exempt whatever its key.
    const publicNames = new Set(CFG.vault.public_identifier_keys || []);
    const values = [];
    for (const raw of readFileSync(vaultPath, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const eq = line.indexOf('=');
      const key = line.slice(0, eq).replace(/^export\s+/, '').trim();
      const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (val.length < (CFG.vault.min_len || 12) || /^https?:\/\//.test(val) || val.startsWith('/') || val.startsWith('~')) continue;
      if (publicNames.has(key) && new RegExp(CFG.vault.public_identifier_shape || '^[a-z0-9][a-z0-9-]*$').test(val)) continue;
      values.push({ key, val, kind: identRe.test(key) ? 'identifier' : 'secret' });
    }
    const byKey = new Map();
    let examined = 0;
    for (const f of files) {
      if (f.binary) continue;
      examined += 1;
      const text = readFileSync(join(OUT, f.dst), 'utf8');
      for (const v of values) {
        if (!text.includes(v.val)) continue;
        if (!byKey.has(v.key)) byKey.set(v.key, { kind: v.kind, files: [] });
        byKey.get(v.key).files.push(f.dst);
      }
    }
    const hits = [];
    for (const [key, v] of byKey) hits.push(`vault key ${key} (${v.kind}) present in ${v.files.length} files: ${v.files.slice(0, 8).join(', ')}${v.files.length > 8 ? ' …' : ''}`);
    gate('vault_values', examined, hits, `${values.length} vault values searched for (${publicNames.size} public resource names exempt)`);
  } else {
    gates.push({ name: 'vault_values', examined: 0, hits: 0, ok: true, skipped: 'no vault on this machine (CI); the pattern gates and gitleaks still ran' });
  }
}

// 4d. size limits.
{
  const max = CFG.limits?.max_file_bytes || 2_000_000;
  const hits = files.filter((f) => f.bytes > max).map((f) => `${f.dst} ${f.bytes} bytes > ${max}`);
  if (totalBytes > (CFG.limits?.max_total_bytes || 120_000_000)) hits.push(`total ${totalBytes} bytes exceeds limit`);
  gate('size', files.length, hits);
}

// 4d2. syntax — every JavaScript file in the projection, stubs and stripped files included, must
// parse as an ES module. A primitive that does not parse is not a primitive.
if (PROFILE?.gates?.syntax) {
  const hits = [];
  let examined = 0;
  for (const f of files) {
    if (!/\.(m?js|cjs)$/.test(f.dst) || f.binary) continue;
    examined += 1;
    const r = nodeParses(readFileSync(join(OUT, f.dst), 'utf8'));
    if (!r.ok) hits.push(`${f.dst}: ${r.err.slice(0, 160)}`);
  }
  gate('syntax', examined, hits, `${stubs.size} stubs included`);
}

// 4d3. diary — after comment removal nothing may still say who ordered what. Strings are scanned
// too: a narrative that survived inside a string literal is still narrative.
if (PROFILE?.gates?.diary_re) {
  const re = new RegExp(PROFILE.gates.diary_re, (PROFILE.gates.flags || 'i') + 'g');
  const hits = [];
  let examined = 0;
  for (const f of files) {
    if (f.binary) continue;
    examined += 1;
    const text = readFileSync(join(OUT, f.dst), 'utf8');
    re.lastIndex = 0; let m;
    while ((m = re.exec(text))) { hits.push(`${f.dst}:${lineOf(text, m.index)} :: ${contextOf(text, m.index, m[0].length)}`); if (m.index === re.lastIndex) re.lastIndex += 1; }
  }
  gate('diary', examined, hits);
}

// 4e. gitleaks over the projection directory, when available. Its ruleset is independent of ours,
// which is the point: two detectors written by different people. Known non-secrets it flags (an
// IndexNow key, which the protocol publishes; a redaction test fixture; an auth spec that names an
// environment variable) are allow-listed by regex WITH A STATED REASON in the config, and the same
// allow-list is written into the projection as .gitleaks.toml so any later scan of the mirror reaches
// the same verdict for the same reasons.
{
  const allow = CFG.gitleaks_allowlist?.regexes || [];
  const toml = [
    '# Generated by scripts/publish-mirror.mjs. Known non-secrets and why each is not a credential.',
    '[extend]', 'useDefault = true', '',
    '[allowlist]',
    'regexTarget = "line"',
    'regexes = [',
    ...allow.map((a) => `  # ${a.why}\n  '''${a.re}''',`),
    ']', '',
  ].join('\n');
  writeFileSync(join(OUT, '.gitleaks.toml'), toml);
  files.push({ src: '(generated)', dst: '.gitleaks.toml', bytes: Buffer.byteLength(toml), binary: false });
  const which = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  if (which.status === 0) {
    const report = join(OUT, '..', `gitleaks-${sourceShort}.json`);
    const r = spawnSync('gitleaks', ['dir', OUT, '--no-banner', '--redact', '--exit-code', '3', '--config', join(OUT, '.gitleaks.toml'), '--report-format', 'json', '--report-path', report], { encoding: 'utf8' });
    let findings = [];
    try { findings = JSON.parse(readFileSync(report, 'utf8') || '[]'); } catch { findings = []; }
    rmSync(report, { force: true });
    const hits = findings.map((x) => `${String(x.File || '').replace(OUT + '/', '')}:${x.StartLine} ${x.RuleID}`);
    if (r.status !== 0 && r.status !== 3) hits.push(`gitleaks exited ${r.status}: ${String(r.stderr || '').split('\n').slice(-3).join(' ')}`);
    gate('gitleaks', files.length, hits, which.stdout.trim());
  } else if (REQUIRE_GITLEAKS) {
    gate('gitleaks', 0, ['gitleaks is required (--require-gitleaks) and not installed']);
  } else {
    gates.push({ name: 'gitleaks', examined: 0, hits: 0, ok: true, skipped: 'gitleaks not installed here' });
  }
}

// ───────────────────────────── 5. manifest, or refusal ─────────────────────────────
const manifest = {
  _what: 'This repository is a generated projection of a private operating repository. Every file here was produced by scripts/publish-mirror.mjs from the source commit below, with identity substituted and gates run against the output. See docs/PUBLISHING.md.',
  source: { repository: 'the private operating repository', commit: sourceSha },
  generated_at: new Date().toISOString(),
  files: files.length,
  bytes: totalBytes,
  tracked_in_source: tracked.length,
  dropped: Object.fromEntries([...droppedByReason.entries()].sort((a, b) => b[1] - a[1])),
  substituted_files: substituted.length,
  substitutions: substituted.sort((a, b) => a.path.localeCompare(b.path)),
  profile: PROFILE ? {
    name: PROFILE.name,
    what: PROFILE._what,
    dropped_by_profile: Object.fromEntries([...droppedByProfile.values()].reduce((m, why) => m.set(why, (m.get(why) || 0) + 1), new Map())),
    dropped_paths: [...droppedByProfile.keys()].sort(),
    stubbed_modules: [...stubs.keys()].sort(),
    comments_removed: substituted.reduce((n, s) => n + (s.substitutions.diary_comments || 0), 0),
    markdown_blocks_removed: substituted.reduce((n, s) => n + (s.substitutions.diary_paragraphs || 0), 0),
    narrative_phrases_removed: substituted.reduce((n, s) => n + (s.substitutions.diary_phrases || 0), 0),
    // Residue the mechanical pass cannot judge: strings that still carry a date. Reported, not gated,
    // because a date in a string is often data (a default, a fixture, a version) rather than narrative.
    dated_strings_remaining: files.filter((f) => !f.binary && !/\.sql$/.test(f.dst)).reduce((n, f) => n + (readFileSync(join(OUT, f.dst), 'utf8').match(/\b20[0-9]{2}-[0-9]{2}-[0-9]{2}\b/g) || []).length, 0),
    comment_strip_skipped: commentStripSkipped,
    gates_pruned_from_manifest: prunedGates,
  } : null,
  stubbed_modules_count: stubs.size,
  gates,
  all_gates_ok: gates.every((g) => g.ok),
  content_hash: null,
};

if (REPORT) {
  const full = failures.map((f) => ({ gate: f.gate, hits: gates.find((g) => g.name === f.gate)?.hits, listed: f.hits.concat(f._all || []) }));
  writeFileSync(REPORT, JSON.stringify({ source_commit: sourceSha, gates, failures: full }, null, 1) + '\n');
}
if (failures.length) {
  if (KEEP_ON_FAIL) console.error(`publish-mirror: gates failed; projection KEPT at ${OUT} for inspection (--keep)`);
  else rmSync(OUT, { recursive: true, force: true });
  const body = { ok: false, source_commit: sourceSha, gates, failures: failures.map((f) => ({ gate: f.gate, hits: f.hits, more: f.more })), note: KEEP_ON_FAIL ? 'projection kept for inspection; the push step did not run' : 'projection deleted; nothing was written that can be pushed', report: REPORT || null };
  console.error(AS_JSON ? JSON.stringify(body) : JSON.stringify(body, null, 1));
  process.exit(1);
}

// A content hash over every projected path+bytes lets a reader prove two projections are identical.
{
  const h = createHash('sha256');
  for (const f of [...files].sort((a, b) => a.dst.localeCompare(b.dst))) {
    h.update(f.dst); h.update('\0'); h.update(readFileSync(join(OUT, f.dst))); h.update('\0');
  }
  manifest.content_hash = h.digest('hex');
}
// The manifest names dropped paths and stubbed modules; those names pass through the same
// substitution as every other text so the manifest cannot carry what the tree does not.
const manifestText = substitute(JSON.stringify(manifest, null, 1)).text + '\n';
writeFileSync(join(OUT, 'PROJECTION.json'), manifestText);

// ───────────────────────────── 6. push ─────────────────────────────
let pushed = null;
if (PUSH) {
  const remote = opt('--remote', CFG.mirror.https_remote);
  const branch = CFG.mirror.branch || 'main';
  const work = resolve(OUT, '..', 'mirror-git');
  const author = ['-c', 'user.name=miscsubjects projection', '-c', 'user.email=build@miscsubjects.com'];
  if (!existsSync(join(work, '.git'))) {
    rmSync(work, { recursive: true, force: true });
    mkdirSync(work, { recursive: true });
    const c = git(['clone', '--quiet', '--branch', branch, '--single-branch', remote, work], resolve(OUT, '..'));
    if (!c.ok) {
      // An empty repository has no branch to clone yet.
      const i = git(['init', '--quiet', '-b', branch, work], resolve(OUT, '..'));
      if (!i.ok) die(2, 'could not prepare mirror clone', { stderr: i.err });
      git(['remote', 'add', 'origin', remote], work);
    }
  } else {
    git(['remote', 'set-url', 'origin', remote], work);
    git(['fetch', '--quiet', 'origin', branch], work);
    if (git(['rev-parse', '--verify', `origin/${branch}`], work).ok) git(['reset', '--hard', '--quiet', `origin/${branch}`], work);
  }
  // Replace the tree: everything except .git goes, then the projection comes in.
  for (const entry of readdirSync(work)) if (entry !== '.git') rmSync(join(work, entry), { recursive: true, force: true });
  const copyTree = (from, to) => {
    for (const entry of readdirSync(from)) {
      const s = join(from, entry); const d = join(to, entry);
      if (statSync(s).isDirectory()) { mkdirSync(d, { recursive: true }); copyTree(s, d); } else { mkdirSync(dirname(d), { recursive: true }); copyFileSync(s, d); }
    }
  };
  copyTree(OUT, work);
  git(['add', '-A'], work);
  const status = git(['status', '--porcelain'], work).out;
  if (!status) {
    pushed = { changed: false, note: 'mirror already matches this projection' };
  } else {
    const msg = `projection of ${sourceShort} (${files.length} files, ${gates.filter((g) => g.ok && !g.skipped).length} gates passed)`;
    const c = git([...author, 'commit', '--quiet', '-m', msg], work);
    if (!c.ok) die(2, 'mirror commit failed', { stderr: c.err });
    const p = git(['push', '--quiet', '-u', 'origin', branch], work);
    if (!p.ok) die(2, 'mirror push failed', { stderr: p.err.replace(/https?:\/\/[^@\s]+@/g, 'https://<redacted>@') });
    pushed = { changed: true, commit: git(['rev-parse', 'HEAD'], work).out, remote: remote.replace(/https?:\/\/[^@\s]+@/g, 'https://<redacted>@'), files_changed: status.split('\n').length };
  }
}

// ───────────────────────────── 7. announce ─────────────────────────────
// --announce puts the manifest on the build's own public surface so the work object's acceptance
// tests, and any reader, can see the current projection state without access to either repository:
//   <public_url_prefix>latest.json  and  <public_url_prefix><source sha12>.json
// Needs TERMINAL_KEY in the environment; refuses clearly without it. The manifest carries paths and
// counts only, never a substituted string.
let announced = null;
if (flag('--announce')) {
  const key = process.env.TERMINAL_KEY || '';
  if (!key) die(2, '--announce needs TERMINAL_KEY in the environment');
  if (!CFG.announce?.api) die(2, 'config has no announce.api');
  manifest.mirror = pushed && pushed.changed ? { commit: pushed.commit } : (pushed ? { note: pushed.note } : null);
  // A flat key as well: the site's JSON door re-serialises this document on the way out, so a reader
  // (or an acceptance test) must not depend on nesting or whitespace to find the mirror commit.
  manifest.mirror_commit = pushed && pushed.changed ? pushed.commit : null;
  const body = substitute(JSON.stringify(manifest, null, 1)).text + '\n';
  const put = async (name) => {
    const r = await fetch(CFG.announce.api + CFG.announce.r2_key_prefix + name, {
      method: 'PUT', headers: { 'x-terminal-key': key, 'content-type': 'application/json' }, body,
    });
    return { name, status: r.status, url: CFG.announce.public_url_prefix + name };
  };
  announced = [await put(`${sourceShort}.json`), await put('latest.json')];
  const bad = announced.filter((a) => a.status !== 200);
  if (bad.length) die(2, 'manifest announce failed', { announced });
}

const summary = {
  ok: true,
  source_commit: sourceSha,
  out: OUT,
  files: files.length,
  bytes: totalBytes,
  dropped: manifest.dropped,
  profile: PROFILE ? { name: PROFILE.name, dropped: droppedByProfile.size, stubs: stubs.size, comments_removed: manifest.profile.comments_removed, markdown_blocks_removed: manifest.profile.markdown_blocks_removed, strip_skipped: commentStripSkipped.length, gates_pruned: prunedGates.length } : null,
  substituted_files: substituted.length,
  gates: gates.map((g) => `${g.name}: ${g.ok ? 'ok' : 'FAIL'} (examined ${g.examined}${g.skipped ? ', skipped: ' + g.skipped : ''})`),
  content_hash: manifest.content_hash,
  pushed,
  announced,
};
console.log(AS_JSON ? JSON.stringify(summary) : JSON.stringify(summary, null, 1));
