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

export function rawPath(turnId) { return path.join(ROOT, 'raw', `${turnId}.json`); }
export function writeRaw(turnId, payload) { ensureDirs(); try { fs.writeFileSync(rawPath(turnId), JSON.stringify(payload)); return rawPath(turnId); } catch { return null; } }
