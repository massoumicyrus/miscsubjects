export async function onRequestGet(context) {
  const origin = new URL(context.request.url).origin;
  const r = await (await fetch(origin + '/api/op')).json();
  const links = Object.entries(r.roots).map(([k, v]) => `<li><strong>${k}</strong><br><a href="${v}">${v}</a></li>`).join('');
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OP — Object Protocol</title><style>body{margin:0;background:#fff;color:#000;font:19px/1.6 Georgia,serif}main{width:min(900px,calc(100% - 36px));margin:auto;padding:70px 0}h1{font:900 clamp(54px,12vw,120px)/.85 system-ui,sans-serif;letter-spacing:-.07em;margin:0 0 30px}h2{font:800 32px/1 system-ui,sans-serif}a{color:#000;text-decoration:underline}li{margin:15px 0}code{font:14px ui-monospace,monospace}</style></head><body><main><h1>OP</h1><p><strong>Object Protocol.</strong> ${r.definition}</p><p>${r.compatibility}</p><h2>Invariants</h2><ol>${r.invariants.map(x=>`<li>${x}</li>`).join('')}</ol><h2>Roots</h2><ul>${links}</ul></main></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
