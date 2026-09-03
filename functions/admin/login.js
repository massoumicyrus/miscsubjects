import { COMMON_STYLE } from './_layout.js';

const BODY = `
<style>
.login-wrap{max-width:420px;margin:48px auto 0}
.login-wrap h1{font-size:22px;margin-bottom:8px}
.login-wrap p{color:var(--ink-soft);font-size:14px;margin-bottom:20px;line-height:1.5}
.login-wrap label{display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:var(--ink-soft)}
.login-wrap input{width:100%;padding:10px 12px;border:1px solid var(--line-strong);border-radius:8px;font-size:14px;font-family:var(--mono)}
.login-wrap button{margin-top:16px;width:100%;padding:10px 14px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer}
.login-wrap button:disabled{opacity:.6;cursor:wait}
.login-wrap .err{color:#c14a4a;font-size:13px;margin-top:12px;min-height:18px}
.login-wrap .hint{font-size:12px;color:var(--muted);margin-top:14px;line-height:1.45}
</style>
<div class="login-wrap">
  <h1>Admin login</h1>
  <p>Enter your owner access key once. This device stays signed in for 60 days (HttpOnly cookie).</p>
  <form id="f" autocomplete="on">
    <label for="key">Owner access key</label>
    <input id="key" name="key" type="password" autocomplete="current-password" placeholder="Owner access key" required autofocus>
    <button type="submit" id="btn">Sign in</button>
    <div id="err" class="err"></div>
    <p class="hint">Browser admin uses this signed session. API and curl examples still show the exact wire header they send.</p>
  </form>
</div>
<script>
(function(){
  var params=new URLSearchParams(location.search);
  var next=params.get('next')||'/admin/directory';
  if(!next.startsWith('/admin')) next='/admin/directory';
  document.getElementById('f').addEventListener('submit',async function(e){
    e.preventDefault();
    var btn=document.getElementById('btn');
    var err=document.getElementById('err');
    var key=document.getElementById('key').value.trim();
    if(!key){ err.textContent='Enter your owner access key.'; return; }
    btn.disabled=true; err.textContent='';
    try{
      var r=await fetch('/api/admin/login',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({key:key})});
      var d=await r.json().catch(function(){ return {}; });
      if(!r.ok){ err.textContent=(d&&d.error)||('Login failed ('+r.status+')'); btn.disabled=false; return; }
      location.href=next;
    }catch(ex){ err.textContent=String(ex); btn.disabled=false; }
  });
})();
</script>
`;

export async function onRequestGet() {
  return new Response(`<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Login — miscsubjects.com</title>
<style>${COMMON_STYLE}</style>
</head>
<body>
<header><div class="brand-row"><div class="brand"><span class="dot"></span>miscsubjects.com</div></div></header>
<main>${BODY}</main>
</body>
</html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
