#!/usr/bin/env node
// WRITE LAW, enforced — PreToolUse guard on Edit/Write/NotebookEdit.
// Before any file edit, claim the file via FILE_CLAIM (KV advisory lock, TTL 90m).
// Same-session re-claims pass silently. DENIED (another session holds it) → exit 2,
// which blocks the tool call and tells the agent who holds the file. Fail-open on
// network errors: the guard must never brick local work when the build is unreachable.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

(function main() {
  let input = {};
  try { input = JSON.parse(readStdin() || '{}'); } catch {}
  const tool = String(input.tool_name || '');
  if (!['Edit', 'Write', 'NotebookEdit'].includes(tool)) process.exit(0);
  const fp = String(input.tool_input?.file_path || input.tool_input?.notebook_path || '');
  if (!fp) process.exit(0);

  const repo = '/Users/owner/miscsubjects-pages';
  if (!fp.startsWith(repo + '/')) process.exit(0);          // guard repo files only
  const rel = fp.slice(repo.length + 1);
  if (rel.startsWith('.claude/') || rel.startsWith('.git/')) process.exit(0);

  const session = String(input.session_id || 'unknown').slice(0, 12);
  const holder = 'claude:' + session;

  let key = '';
  try {
    const envText = fs.readFileSync(path.join(process.env.HOME || '', '.config/grok-bridge.env'), 'utf8');
    key = (envText.match(/^(?:export\s+)?(?:MISC_)?TERMINAL_KEY=["']?([^"'\n]+)/m) || [])[1] || '';
  } catch {}
  if (!key) process.exit(0);                                 // fail-open: no key, no block

  let out = '';
  try {
    const body = encodeURIComponent(['claim', rel, holder, '90'].join('|'));
    out = execSync(
      `curl -s --max-time 6 "https://miscsubjects.com/api/dispatch?invoke=FILE_CLAIM&body=${body}" -H "x-terminal-key: ${key}"`,
      { encoding: 'utf8', timeout: 8000 },
    );
  } catch { process.exit(0); }                               // fail-open on network trouble

  let result = '';
  try { result = String(JSON.parse(out).result || ''); } catch { process.exit(0); }
  if (result.startsWith('DENIED')) {
    console.error('WRITE LAW: ' + result + ' (file: ' + rel + ')');
    process.exit(2);                                         // block the edit, surface the holder
  }
  process.exit(0);
})();
