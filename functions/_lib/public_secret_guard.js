const SIGNED_CAPABILITY_RE = /\bsh\.\d{9,12}\.[A-Za-z0-9_:,-]{1,120}\.\d+\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}\b/g;
const SHORT_SHARE_RE = /((?:[?&]|\b)share\s*=\s*["']?|["']share["']\s*[:=]\s*["']?)([a-z0-9]{7})(?=\b|["'&])/gi;
const PROVIDER_SECRET_RES = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g,
  /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}/gi,
  /\b(?:terminal[_-]?key|admin[_-]?(?:key|token)|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|macaroon|caveat[_-]?key)\b\s*[:=]\s*["']?[A-Za-z0-9._~+\/-]{12,}/gi,
];

function envSecrets(env) {
  const found = [];
  try {
    for (const [name, value] of Object.entries(env || {})) {
      if (!/(?:KEY|SECRET|TOKEN|PASSWORD|AUTH|MACAROON|CAVEAT)/i.test(name)) continue;
      if (typeof value !== 'string' || value.length < 8) continue;
      found.push(value);
    }
  } catch {}
  return found;
}

function asText(value) {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value == null ? '' : value); } catch { return String(value || ''); }
}

export function publicSecretFinding(value, env) {
  const text = asText(value);
  if (!text) return null;
  SIGNED_CAPABILITY_RE.lastIndex = 0;
  if (SIGNED_CAPABILITY_RE.test(text)) return { blocked: true, class: 'signed_capability' };
  SHORT_SHARE_RE.lastIndex = 0;
  if (SHORT_SHARE_RE.test(text)) return { blocked: true, class: 'short_share' };
  for (const re of PROVIDER_SECRET_RES) {
    re.lastIndex = 0;
    if (re.test(text)) return { blocked: true, class: 'backend_credential' };
  }
  for (const secret of envSecrets(env)) {
    if (text.includes(secret)) return { blocked: true, class: 'bound_backend_credential' };
  }
  return null;
}

// Public evidence is a revocation boundary, not merely a redaction boundary. When an
// exact signed capability reaches a public-write ingress, revoke that capability before
// returning the deliberately generic 404. Proof ids and fingerprints remain safe.
export async function publicSecretFindingAndRevoke(value, env, context = {}) {
  const finding = publicSecretFinding(value, env);
  if (!finding || finding.class !== 'signed_capability' || !env?.LEDGER) return finding;
  const text = asText(value);
  const tokens = [...new Set(text.match(SIGNED_CAPABILITY_RE) || [])].slice(0, 20);
  const revoked = [];
  try {
    const { capFingerprint, revokeCapability } = await import('./admin_session.js');
    for (const token of tokens) {
      const fingerprint = await capFingerprint(token);
      if (await revokeCapability(env, fingerprint)) revoked.push(fingerprint);
    }
    if (revoked.length) {
      const ts = new Date().toISOString();
      await env.LEDGER.prepare(
        `INSERT INTO events
         (id,ts,build,source,key,route,actor,action,direction,status,request_preview,response_preview,request_size,response_size,request_json,response_json)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        'e_revoke_' + crypto.randomUUID(), ts, 'miscsubjects', 'public-secret-guard',
        'CAP_REVOKE', String(context.route || ''), String(context.actor || 'public-ingress'),
        'credential_live_match_auto_revoke', 'IN', 404,
        'signed capability detected at public evidence ingress', JSON.stringify({ revoked }),
        0, 0, JSON.stringify({ class: finding.class }), JSON.stringify({ revoked }),
      ).run();
    }
  } catch {}
  return { ...finding, revoked };
}

const OWNER_IDENTITY_REPLACEMENTS = [
  [/cc@[OWNER_HANDLE]\.com/gi, '[OWNER_EMAIL]'],
  [/the owner@theloopway\.com/gi, '[OWNER_EMAIL]'],
  [/the owner@dsco\.co/gi, '[OWNER_EMAIL]'],
  [/\/Users\/[OWNER_HANDLE]/gi, '/Users/owner'],
  [/[OWNER_ACCT]/gi, '[OWNER_ACCT]'],
  [/[OWNER_HANDLE]|[OWNER_HANDLE]/gi, '[OWNER_HANDLE]'],
  [/the owner\s+[OWNER_SURNAME]/gi, 'the owner'],
  [/\bOWNER_SURNAME\b/gi, '[OWNER_SURNAME]'],
  [/\bOWNER_FIRST_NAME\b/gi, 'the owner'],
  [/[OWNER_MACHINE][\w.-]*/gi, '[OWNER_MACHINE]'],
];

export function scrubOwnerIdentity(value) {
  let text = String(value == null ? '' : value);
  for (const [re, replacement] of OWNER_IDENTITY_REPLACEMENTS) {
    re.lastIndex = 0;
    text = text.replace(re, replacement);
  }
  return text;
}

function redactString(value, env) {
  let text = String(value == null ? '' : value);
  text = text.replace(SIGNED_CAPABILITY_RE, '<REDACTED_ACCESS_TOKEN>');
  text = text.replace(SHORT_SHARE_RE, (_match, prefix) => prefix + '<REDACTED_ACCESS_TOKEN>');
  for (const re of PROVIDER_SECRET_RES) {
    re.lastIndex = 0;
    text = text.replace(re, '<REDACTED_BACKEND_CREDENTIAL>');
  }
  for (const secret of envSecrets(env)) text = text.split(secret).join('<REDACTED_BACKEND_CREDENTIAL>');
  text = scrubOwnerIdentity(text);
  return text;
}

export function redactPublicSecrets(value, env, depth = 0) {
  if (depth > 10) return '<REDACTED_DEPTH_LIMIT>';
  if (typeof value === 'string') return redactString(value, env);
  if (Array.isArray(value)) return value.map((item) => redactPublicSecrets(item, env, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (/^(?:authorization|x-terminal-key|api-key|x-api-key|cookie|password|secret|token|share)$/i.test(key)) out[key] = '<REDACTED_CREDENTIAL>';
      else out[key] = redactPublicSecrets(item, env, depth + 1);
    }
    return out;
  }
  return value;
}

export function publicSecret404() {
  return new Response(JSON.stringify({ error: 'not_found' }), {
    status: 404,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
