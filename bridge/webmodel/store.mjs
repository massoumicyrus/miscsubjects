// The worker's local mirror of session state. D1 is canonical; this file is what lets a
// restarted worker re-attach to a conversation it opened before the crash.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDirs } from './chrome.mjs';

const FILE = path.join(ROOT, 'sessions.json');

export function load() {
  ensureDirs();
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { sessions: {} }; }
}

export function save(db) {
  ensureDirs();
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);   // atomic: a torn write cannot orphan every session
}

export function putSession(s) { const db = load(); db.sessions[s.session_id] = s; save(db); return s; }
export function getSession(id) { return load().sessions[id] || null; }
export function allSessions() { return Object.values(load().sessions); }

// A session left `running` by a crash is not running — nothing holds its lock any more.
export function recoverRunning() {
  const db = load();
  const recovered = [];
  for (const s of Object.values(db.sessions)) {
    if (s.state === 'running') {
      s.state = 'ready';
      s.recovered_at = new Date().toISOString();
      s.last_failure = 'crash_recovered';
      recovered.push(s.session_id);
    }
  }
  if (recovered.length) save(db);
  return recovered;
}

export function idemPath(requestId) { return path.join(ROOT, 'idem', `${String(requestId).replace(/[^\w.-]/g, '_')}.json`); }
export function idemGet(requestId) { if (!requestId) return null; try { return JSON.parse(fs.readFileSync(idemPath(requestId), 'utf8')); } catch { return null; } }
export function idemPut(requestId, result) { if (!requestId) return; try { fs.writeFileSync(idemPath(requestId), JSON.stringify(result)); } catch {} }

// Claimed before the browser is touched, so a retry arriving mid-flight is refused rather than
// typing the same prompt into the same conversation twice.
export function idemClaim(requestId) {
  if (!requestId) return true;
  try { fs.writeFileSync(idemPath(requestId), JSON.stringify({ claimed_at: new Date().toISOString(), state: 'in_flight' }), { flag: 'wx' }); return true; }
  catch { return false; }
}

// Asynchronous turns. The Cloudflare edge in front of the tunnel cuts any origin response held
// longer than 100 seconds, and a real Claude turn takes longer than that. So a send is ACCEPTED
// (the running claim is written here before the browser is touched), runs in the background, and
// the edge polls this record with a bounded deadline. Nothing here is ever overwritten with less
// information than it had.
export function turnPath(turnId) { return path.join(ROOT, 'turns', `${String(turnId).replace(/[^\w.-]/g, '_')}.json`); }
export function turnGet(turnId) { if (!turnId) return null; try { return JSON.parse(fs.readFileSync(turnPath(turnId), 'utf8')); } catch { return null; } }
export function turnPut(turnId, rec) { fs.mkdirSync(path.join(ROOT, 'turns'), { recursive: true }); const tmp = turnPath(turnId) + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(rec)); fs.renameSync(tmp, turnPath(turnId)); }
// A turn left running by a crash did not complete; say so, by name, instead of hanging a poller.
export function recoverTurns() {
  const dir = path.join(ROOT, 'turns'); const out = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      let r; try { r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
      if (r && r.state === 'running') { turnPut(r.turn_id, { ...r, state: 'failed', ok: false, error: 'RESPONSE_CAPTURE_FAILED', message: 'the worker restarted while this turn was running', recovered_at: new Date().toISOString() }); out.push(r.turn_id); }
    }
  } catch {}
  return out;
}

export function rawPath(turnId) { return path.join(ROOT, 'raw', `${turnId}.json`); }
export function writeRaw(turnId, payload) { ensureDirs(); try { fs.writeFileSync(rawPath(turnId), JSON.stringify(payload)); return rawPath(turnId); } catch { return null; } }
