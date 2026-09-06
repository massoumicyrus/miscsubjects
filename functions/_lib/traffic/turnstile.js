// TRAFFIC ENGINE — Cloudflare Turnstile as a policy-controlled signal.
//
// browser widget → token → MANDATORY server-side siteverify → signed first-party cookie (ms_tsv)
// that carries the verification instant and the device id. Rules read turnstile.valid / age_s;
// nothing trusts client-side completion. Tokens are single-use and short-lived, so the cookie is
// the durable record and its age is what "challenge again after N seconds" reasons about.
//
// Plan: Turnstile Free (managed widget). Nothing here needs Enterprise (ephemeral ids, pre-clearance).
// The secret key lives only in the Pages env var TURNSTILE_SECRET_KEY — never in profile data, never
// in a decision row, never in the Ledger.

import { signCookie } from './grants.js';

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_CSP = "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:";

/** Server-side validation. Returns { ok, hostname, challenge_ts, action, cdata, error_codes, status }. */
export async function verifyTurnstile(env, { token, remoteip = null, idempotencyKey = null, fetchImpl = fetch } = {}) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, error_codes: ['secret_not_configured'], status: 0 };
  if (!token || typeof token !== 'string' || token.length > 2048) return { ok: false, error_codes: ['missing-input-response'], status: 0 };
  const body = new FormData();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteip) body.set('remoteip', remoteip);
  if (idempotencyKey) body.set('idempotency_key', idempotencyKey);
  try {
    const r = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body });
    const j = await r.json().catch(() => ({}));
    return { ok: !!j.success, hostname: j.hostname || null, challenge_ts: j.challenge_ts || null, action: j.action || null, cdata: j.cdata || null, error_codes: j['error-codes'] || [], status: r.status };
  } catch (e) {
    return { ok: false, error_codes: ['siteverify_unreachable:' + String(e.message || e)], status: 0 };
  }
}

/** The signed cookie value recording a verified pass for one device. */
export async function turnstileCookieValue(secret, { deviceId, verifiedAtMs = Date.now(), hostname = null }) {
  return signCookie(secret, { t: verifiedAtMs, d: deviceId, h: hostname });
}

/** Challenge page: renders the managed widget and posts the token to the engine for siteverify. */
export function renderChallengePage({ sitekey, returnTo, decisionId, reason = '', title = 'One quick check', message = 'Confirm you are a person to continue.', csrf = '' }) {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{margin:0;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f6f5f1;color:#1a1a1a;display:flex;min-height:100vh;align-items:center;justify-content:center}main{background:#fff;border:1px solid #e3e1da;border-radius:12px;padding:32px;max-width:440px;width:calc(100% - 32px);box-shadow:0 8px 30px rgba(0,0,0,.06)}h1{font-size:22px;margin:0 0 8px}p{margin:0 0 20px;color:#444}.w{min-height:65px}small{display:block;margin-top:18px;color:#777;font-size:12px;font-family:ui-monospace,Menlo,monospace;word-break:break-all}#err{color:#a11;display:none;margin-top:12px}</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__tsLoad" async defer></script></head>
<body><main><h1>${esc(title)}</h1><p>${esc(message)}</p><div id="w" class="w"></div><div id="err">Verification did not complete. Reload to try again.</div>
<small>decision ${esc(decisionId)}${reason ? ' · ' + esc(reason) : ''}</small></main>
<script>
(function(){try{var tz=Intl.DateTimeFormat().resolvedOptions().timeZone;if(tz)document.cookie='ms_tz='+encodeURIComponent(tz)+';path=/;max-age=31536000;secure;samesite=lax';var vw=innerWidth,vc=vw<480?'xs':vw<768?'sm':vw<1024?'md':vw<1440?'lg':'xl';document.cookie='ms_ch='+encodeURIComponent(JSON.stringify({t:('ontouchstart' in window)?1:0,v:vc,s:screen.width+'x'+screen.height,l:navigator.language||''}))+';path=/;max-age=2592000;secure;samesite=lax'}catch(e){}})();
window.__tsLoad=function(){turnstile.render('#w',{sitekey:${JSON.stringify(sitekey)},action:'traffic_engine',cData:${JSON.stringify(String(decisionId || '').slice(0, 255))},callback:function(token){fetch('/api/traffic/turnstile/verify',{method:'POST',headers:{'content-type':'application/json','x-requested-with':'traffic-engine'},body:JSON.stringify({token:token,return_to:${JSON.stringify(returnTo)},decision_id:${JSON.stringify(decisionId)},csrf:${JSON.stringify(csrf)}})}).then(function(r){return r.json()}).then(function(j){if(j.ok&&j.redirect){location.replace(j.redirect)}else{document.getElementById('err').style.display='block';document.getElementById('err').textContent='Verification refused: '+((j.error_codes||[]).join(', ')||j.error||'unknown')}}).catch(function(){document.getElementById('err').style.display='block'})},'error-callback':function(){document.getElementById('err').style.display='block'}})};
</script></body></html>`;
}
