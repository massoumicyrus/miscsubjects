// TRAFFIC ENGINE — the experiences the edge renders itself.
//
// Destinations of type redirect/proxy leave the building; everything else is drawn here from data:
// inline destination pages, the one-time acknowledgement, the deny / unavailable / static pages and
// the SMS squeeze page. Every page carries the decision id in its footer so "why did I see this?"
// is one lookup away, and every page sets the client-side signals (timezone, viewport, touch) that
// the normalizer reads on the next request.

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const CLIENT_SIGNAL_SCRIPT = `<script>(function(){try{var tz=Intl.DateTimeFormat().resolvedOptions().timeZone;if(tz)document.cookie='ms_tz='+encodeURIComponent(tz)+';path=/;max-age=31536000;secure;samesite=lax';var vw=innerWidth,vc=vw<480?'xs':vw<768?'sm':vw<1024?'md':vw<1440?'lg':'xl';document.cookie='ms_ch='+encodeURIComponent(JSON.stringify({t:('ontouchstart' in window)?1:0,v:vc,s:screen.width+'x'+screen.height,l:navigator.language||''}))+';path=/;max-age=2592000;secure;samesite=lax'}catch(e){}})();</script>`;

const BASE_CSS = `body{margin:0;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f6f5f1;color:#1a1a1a;min-height:100vh;display:flex;align-items:center;justify-content:center}main{background:#fff;border:1px solid #e3e1da;border-radius:12px;padding:32px;max-width:520px;width:calc(100% - 32px);box-shadow:0 8px 30px rgba(0,0,0,.06)}h1{font-size:24px;margin:0 0 10px;line-height:1.2}p{margin:0 0 16px;color:#444}.btn{display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:600;font-size:17px;border:0;cursor:pointer}.btn.alt{background:#fff;color:#111;border:1px solid #111}.foot{display:block;margin-top:22px;color:#777;font-size:12px;font-family:ui-monospace,Menlo,monospace;word-break:break-all}.tag{display:inline-block;font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:#666;border:1px solid #ddd;border-radius:999px;padding:6px 10px;margin-bottom:14px}img.media{max-width:100%;border-radius:10px;margin:0 0 16px}.muted{color:#777;font-size:14px}`;

function shell({ title, body, tag = '', decisionId = '', extraHead = '', foot = '' }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>${BASE_CSS}</style>${extraHead}</head><body><main>${tag ? `<span class="tag">${esc(tag)}</span>` : ''}${body}<small class="foot">decision ${esc(decisionId)}${foot ? ' · ' + foot : ''}</small></main>${CLIENT_SIGNAL_SCRIPT}</body></html>`;
}

/** Substitute {{path}} tokens from the decision/ctx into destination html. Only whitelisted paths. */
export function fillTemplate(html, decision) {
  const map = { decision_id: decision.decision_id, destination: decision.destination_id, experience: decision.experience, reason: decision.reason, profile_id: decision.profile_id, device_id: decision.device_id, ruleset: decision.ruleset_id, revision: decision.ruleset_revision, variant: decision.experiment?.variant || '', experiment: decision.experiment?.id || '' };
  return String(html || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => esc(map[k] ?? ''));
}

export function renderInlineDestination(dest, decision) {
  if (dest.html) return shell({ title: dest.name || dest.id, body: fillTemplate(dest.html, decision), tag: dest.name || dest.id, decisionId: decision.decision_id, foot: esc(dest.id) });
  return shell({ title: dest.name || dest.id, tag: 'destination', decisionId: decision.decision_id, foot: esc(dest.id), body: `<h1>${esc(dest.name || dest.id)}</h1><p>You reached destination <b>${esc(dest.id)}</b>${decision.experiment?.variant ? ` as variant <b>${esc(decision.experiment.variant)}</b>` : ''}.</p><p class="muted">${esc(decision.reason)}</p>` });
}

export function renderAckPage({ decision, meta, returnTo, csrf }) {
  const title = meta.title || 'Before you continue';
  const html = meta.html || `<p>Please confirm you have read and accept the terms for <b>${esc(meta.policy)}</b> (version ${esc(meta.version)}).</p>`;
  return shell({ title, tag: 'one-time acknowledgement', decisionId: decision.decision_id, foot: `${esc(meta.policy)}@${esc(meta.version)}`, body: `<h1>${esc(title)}</h1>${html}
<form method="post" action="/api/traffic/ack"><input type="hidden" name="policy" value="${esc(meta.policy)}"><input type="hidden" name="version" value="${esc(meta.version)}"><input type="hidden" name="decision_id" value="${esc(decision.decision_id)}"><input type="hidden" name="return_to" value="${esc(returnTo)}"><input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="trust_device" value="${meta.trust_device === false ? '0' : '1'}"><button class="btn" type="submit">I accept and continue</button></form>
<p class="muted" style="margin-top:14px">This device will remember your acceptance${meta.trust_device === false ? '' : ' and be marked as trusted'}; a new or revoked device is asked again, and a new version of the terms is asked again.</p>` });
}

export function renderDenyPage(decision, message) {
  return shell({ title: 'Not available', tag: 'access denied', decisionId: decision.decision_id, body: `<h1>Not available</h1><p>${esc(message || 'This destination is not available for this request.')}</p>` });
}

export function renderUnavailablePage(decision, status = 503) {
  return shell({ title: status === 404 ? 'No route' : 'Temporarily unavailable', tag: status === 404 ? 'no ruleset' : 'fail closed', decisionId: decision.decision_id, body: `<h1>${status === 404 ? 'No route configured here' : 'Temporarily unavailable'}</h1><p>${esc(decision.reason || '')}</p>` });
}

export function renderStaticPage(decision, html) {
  if (html) return String(html).includes('<html') ? String(html) : shell({ title: 'Notice', body: fillTemplate(html, decision), decisionId: decision.decision_id });
  return renderUnavailablePage(decision, 503);
}

/** Squeeze page: pre-populated SMS/iMessage composer link, tap beacon, verification polling. */
export function renderSqueezePage({ page, campaign, code, decision, phone, channel, message, statusUrl, tapUrl }) {
  const media = Array.isArray(page.media) ? page.media : [];
  const smsHref = `sms:${encodeURIComponent(phone)}?&body=${encodeURIComponent(message)}`;
  const body = `${media[0]?.url ? `<img class="media" src="${esc(media[0].url)}" alt="${esc(media[0].alt || '')}">` : ''}
<h1>${esc(page.headline || 'Text us to continue')}</h1>${page.body_html || ''}
<p><a class="btn" id="cta" href="${esc(smsHref)}">${esc(page.cta_text || 'Text to continue')}</a></p>
<p class="muted">Your message will read <b>${esc(message)}</b> — send it exactly as shown and this page will continue on its own.</p>
<div id="done" hidden>${page.completion_html || '<p>Thanks — you are verified.</p>'}</div>
<div id="fallback" hidden>${page.fallback_html || `<p>If your messaging app did not open, text <b>${esc(message)}</b> to <b>${esc(phone)}</b>.</p>`}</div>`;
  const script = `<script>(function(){var code=${JSON.stringify(code)};var cta=document.getElementById('cta');var tapped=false;cta.addEventListener('click',function(){tapped=true;try{navigator.sendBeacon(${JSON.stringify(tapUrl)},JSON.stringify({code:code,kind:'cta_tap'}))}catch(e){};setTimeout(function(){document.getElementById('fallback').hidden=false},2500)});var n=0;function poll(){n++;fetch(${JSON.stringify(statusUrl)}+'&_='+n,{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(j){if(j&&j.status==='verified'){document.getElementById('done').hidden=false;cta.style.display='none';if(j.next_url){setTimeout(function(){location.replace(j.next_url)},900)}return}if(j&&j.status==='expired'){document.getElementById('fallback').innerHTML='<p>This code expired. Reload the page for a new one.</p>';document.getElementById('fallback').hidden=false;return}if(n<400)setTimeout(poll,tapped?2000:4000)}).catch(function(){if(n<400)setTimeout(poll,5000)})}setTimeout(poll,3000)})();</script>`;
  return shell({ title: page.headline || campaign?.name || 'Continue by text', tag: campaign?.name || 'campaign', decisionId: decision.decision_id, foot: `${esc(page.id)} v${esc(page.version)} · code ${esc(code)}`, body, extraHead: '' }).replace('</body>', script + '</body>');
}
