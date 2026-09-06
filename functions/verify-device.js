// GET /verify-device?device=dev_… — the human step-up page.
//
// One managed Turnstile widget. On success the page posts the token and the device id to
// /api/device/verify, which validates server-side and stamps the device. The site key is public
// by design and comes from the Pages env (TURNSTILE_SITEKEY); the secret never reaches a page.

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const device = String(u.searchParams.get('device') || '').trim();
  const sitekey = String(env.TURNSTILE_SITEKEY || u.searchParams.get('sitekey') || '').trim();
  const okDevice = /^dev_[0-9a-f]{6,}$/.test(device);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verify this device</title>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>
:root{--ds-bg:#0b0b0c;--ds-ink:#f2f2f0;--ds-dim:#a8a8a3;--ds-line:#2a2a2d;--ds-accent:#e8d5a3;--ds-surface:#151517}
body{margin:0;background:var(--ds-bg);color:var(--ds-ink);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
main{max-width:34rem;margin:8vh auto;padding:0 1.25rem}
h1{font-size:1.5rem;margin:0 0 .5rem}p{color:var(--ds-dim);margin:.25rem 0 1rem}
code{background:var(--ds-surface);border:1px solid var(--ds-line);padding:.1rem .35rem;border-radius:4px;color:var(--ds-ink)}
#out{margin-top:1rem;padding:.9rem 1rem;border:1px solid var(--ds-line);border-radius:8px;background:var(--ds-surface);min-height:1.5rem;white-space:pre-wrap;word-break:break-word}
.ok{border-color:#3c7a4a}.bad{border-color:#8a3a3a}
</style></head><body><main>
<h1>Verify this device</h1>
<p>Device <code>${esc(device || 'none given')}</code>. Completing the check records a human-verification instant on this device. Capabilities that require a recent verification read that instant; nothing else is stored.</p>
${okDevice && sitekey ? `<div class="cf-turnstile" data-sitekey="${esc(sitekey)}" data-callback="onTurnstile" data-theme="dark" data-action="device-stepup"></div>` : `<div id="cfg" class="bad">${!okDevice ? 'Open this page with ?device=dev_… (register a device first with DEVICE_REGISTER).' : 'TURNSTILE_SITEKEY is not configured on this deployment.'}</div>`}
<div id="out">${okDevice && sitekey ? 'Waiting for the challenge…' : ''}</div>
<script>
window.onTurnstile = async function (token) {
  const out = document.getElementById('out');
  out.textContent = 'Verifying server-side…';
  try {
    const r = await fetch('/api/device/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, device_id: ${JSON.stringify(device)} }) });
    const j = await r.json();
    out.className = j.ok ? 'ok' : 'bad';
    out.textContent = j.ok ? ('Verified at ' + j.last_verification + '\\nledger event ' + j.ledger_event_id) : ('Refused: ' + j.error + ' — ' + (j.message || ''));
  } catch (e) { out.className = 'bad'; out.textContent = 'Could not reach /api/device/verify: ' + e.message; }
};
</script></main></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:" } });
}
