const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const AGENT_LOG_URL = process.env.MISC_AGENT_LOG_URL || 'https://miscsubjects.com/api/agent_log';
const LOCAL_LOG = path.join(os.homedir(), '.miscsubjects', 'agent_turns.jsonl');

function readStdin() { try { return fs.readFileSync(0, 'utf8'); } catch { return ''; } }

function loadDedup(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}
function saveDedup(file, d) {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(d)); } catch {}
}

function postRecord(record) {
  try { fs.mkdirSync(path.dirname(LOCAL_LOG), { recursive: true }); fs.appendFileSync(LOCAL_LOG, JSON.stringify(record) + '\n'); } catch {}
  try {
    execSync('curl --fail-with-body -s -m 8 -X POST ' + AGENT_LOG_URL + ' -H "content-type: application/json" --data-binary @-',
      { input: JSON.stringify(record), stdio: ['pipe', 'ignore', 'ignore'] });
    return true;
  } catch { return false; }
}

function shouldSkip(dedup, sessionId, turnKey) {
  if (!sessionId || !turnKey) return false;
  return dedup[sessionId] === turnKey;
}

function markDone(dedup, sessionId, turnKey) {
  if (sessionId && turnKey) dedup[sessionId] = turnKey;
}

function stripGeminiContext(text) {
  const t = String(text || '');
  if (t.includes('<session_context>')) return '';
  return t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
}

module.exports = { readStdin, loadDedup, saveDedup, postRecord, shouldSkip, markDone, stripGeminiContext, LOCAL_LOG };
