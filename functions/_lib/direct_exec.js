import { dispatch } from '../api/dispatch.js';

const MAX_REPLY = 3500;

export async function runDirectExec(env, sender, chat, rest, pfx) {
  const key = pfx.trim() === '/help' ? 'LOCAL_HELP' : 'LOCAL_EXEC';
  let result = '';
  try { result = String((await dispatch(env, key, rest)).result || ''); }
  catch (e) { result = 'ERR:' + (e && e.message || String(e)); }
  await sender(env, chat, formatBridgeResult(result), []);
}

// Bridge results come back as "HTTP 200:{ok,exit,stdout,stderr,duration_ms,...}".
// Show stdout (plus stderr / exit when nonzero), trimmed for SMS.
export function formatBridgeResult(result) {
  const m = String(result).match(/^HTTP (\d+):([\s\S]*)$/);
  if (!m) return String(result).slice(0, MAX_REPLY);
  let j; try { j = JSON.parse(m[2]); } catch { return String(result).slice(0, MAX_REPLY); }
  let out = String(j.stdout || '').trim();
  if (!j.ok || j.exit !== 0 || (!out && j.stderr)) {
    out += (out ? '\n' : '') + '[exit ' + j.exit + (j.killed_by_timeout ? ' · timeout' : '') + ']' +
      (j.stderr ? '\n' + String(j.stderr).trim() : '');
  }
  if (!out) out = '[exit ' + j.exit + ' · no output · ' + j.duration_ms + 'ms]';
  return out.length > MAX_REPLY ? out.slice(0, MAX_REPLY) + '\n…[truncated]' : out;
}

const PREFIXES = ['/t ', '/exec ', '/terminal ', '/run ', '/help '];
export function sniffPrefix(text, from) {
  const phone = String(from || '').replace(/\D/g, '');
  if (!phone.endsWith('[OWNER_PHONE]')) return null;
  const trimmed = String(text || '').trim();
  return PREFIXES.find(p => trimmed.startsWith(p)) || null;
}
