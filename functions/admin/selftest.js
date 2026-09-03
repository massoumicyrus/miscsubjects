import { shellHtml } from './_layout.js';

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function onRequestGet({ env }) {
  const qs = (await env.DB.prepare("SELECT id,tier,args AS q,expected_text AS expected,last_actual,last_passed FROM directory_tests WHERE kind='e2e' ORDER BY tier, id").all()).results || [];
  const runs = (await env.DB.prepare('SELECT run_id,build_version,ts,total,passed,score,note FROM selftest_runs ORDER BY ts DESC LIMIT 50').all()).results || [];
  const ver = (await env.DB.prepare("SELECT value FROM settings WHERE key='build_version'").first())?.value || 'v1';
  const completeRuns = runs.filter(r => r.note === 'complete');
  const partialRuns = runs.filter(r => r.note !== 'complete');
  const lastComplete = completeRuns[0] || null;
  const latestPartialRun = runs.find(r => r.note === 'batched') || null;
  const kv = async (k, d) => { try { return (await env.KV.get(k)) || d; } catch { return d; } };
  const memWin = await kv('agent_memory_window', '3');
  const toolLoops = await kv('agent_tool_loops', '12');
  const reasoning = await kv('ROUTER_reasoning_effort', await kv('grok_reasoning_effort', 'none'));
  const masterOn = (await kv('selftest_master', '0')) === '1';
  const selftestOn = masterOn && (await kv('selftest_autorun', '0')) === '1';

  const masterBanner = masterOn
    ? '<div class="on">MASTER ON — self-test may run (autorun still separate). Agents cannot flip this via KV.</div>'
    : '<div class="off">MASTER OFF (vault lock) — no self-test, no sibling trigger, no agent re-arm. Toggle ON only with confirm phrase ENABLE SELFTEST.</div>';
  const autorunBanner = selftestOn
    ? '<div class="warn">AUTORUN ON — recurring loop active. Turn OFF when done.</div>'
    : '<div class="muted-banner">AUTORUN OFF — one-shot Run/Graph only when master is ON.</div>';

  const rowsHtml = qs.map(q => {
    const r = q.last_passed == null ? '<span class="d none">—</span>' : (q.last_passed ? '<span class="d pass">PASS</span>' : '<span class="d fail">FAIL</span>');
    return '<tr><td class="q">' + esc(q.q) + '</td><td class="e">' + esc(q.expected) + '</td><td class="a">' + esc(q.last_actual || '') + '</td><td>' + r + '</td><td><button class="del" data-id="' + q.id + '">×</button></td></tr>';
  }).join('');
  const completeRunsHtml = completeRuns.slice(0, 12).map(r => '<tr><td>' + esc(r.build_version) + '</td><td>' + esc(r.ts) + '</td><td>' + esc(r.run_id || '') + '</td><td>' + r.passed + '/' + r.total + '</td><td>' + r.score + '%</td></tr>').join('') || '<tr><td colspan="5">no complete runs yet</td></tr>';
  const partialRunsHtml = partialRuns.slice(0, 12).map(r => '<tr><td>' + esc(r.note || 'partial') + '</td><td>' + esc(r.ts) + '</td><td>' + esc(r.run_id || '') + '</td><td>' + r.passed + '/' + r.total + '</td><td>' + r.score + '%</td></tr>').join('') || '<tr><td colspan="5">no partial runs</td></tr>';

  const BODY = '<div class="stp">'
    + '<h1>Self-Test</h1>'
    + '<p class="subtitle">Identity law: ButterCup ([PHONE]) sends every TEST question; Pepper ([BUILD_PHONE]) sends every answer. ROUTER runs in-process only — it never posts to the group.</p>'
    + '<div class="toggles">'
    + '<div class="tog">'
    + '<div class="tog-label">MASTER (vault lock)</div>'
    + '<button type="button" id="master" class="tog-btn ' + (masterOn ? 'is-on' : 'is-off') + '" data-on="' + (masterOn ? '1' : '0') + '">' + (masterOn ? 'ON' : 'OFF') + '</button>'
    + '<div class="tog-hint">OFF = nothing runs. ON requires typing <code>ENABLE SELFTEST</code>. Agents cannot re-enable via KV/Codex.</div>'
    + '</div>'
    + '<div class="tog">'
    + '<div class="tog-label">AUTORUN (recurring)</div>'
    + '<button type="button" id="autorun" class="tog-btn ' + (selftestOn ? 'is-on' : 'is-off') + '" data-on="' + (selftestOn ? '1' : '0') + '"' + (masterOn ? '' : ' disabled') + '>' + (selftestOn ? 'ON' : 'OFF') + '</button>'
    + '<div class="tog-hint">Requires master ON. ON requires typing <code>ENABLE SELFTEST AUTORUN</code>.</div>'
    + '</div>'
    + '<button type="button" id="kill" class="kill">Kill all loops + force MASTER OFF</button>'
    + '</div>'
    + masterBanner
    + autorunBanner
    + '<div class="head">'
    + '<div class="stat"><div class="n">' + esc(ver) + '</div><div class="l">build version</div></div>'
    + '<div class="stat"><div class="n">' + (lastComplete ? lastComplete.score + '%' : '—') + '</div><div class="l">last complete score</div></div>'
    + '<div class="stat"><div class="n">' + (latestPartialRun ? latestPartialRun.total + '/' + qs.length : '—') + '</div><div class="l">latest partial</div></div>'
    + '<div class="stat"><div class="n">' + qs.length + '</div><div class="l">questions</div></div>'
    + '<div class="stat"><div class="n">' + esc(reasoning) + '</div><div class="l">reasoning</div></div>'
    + '<div class="stat"><div class="n">' + esc(memWin) + '</div><div class="l">memory turns</div></div>'
    + '<div class="stat"><div class="n">' + esc(toolLoops) + '</div><div class="l">tool loops</div></div>'
    + '<button id="run" class="run"' + (masterOn ? '' : ' disabled title="MASTER OFF"') + '>Run self-test in group</button>'
    + '<button id="graph" class="run graph"' + (masterOn ? '' : ' disabled title="MASTER OFF"') + '>Run graph populate</button><span id="prog" class="prog"></span>'
    + '</div>'
    + '<div class="wl">Whitelist (build replies only to): <code>[OWNER_PHONE]</code> — owner-only. Audit group: <code>grp_d21e1ea99f8a4ea0</code></div>'
    + '<table class="t"><thead><tr><th>Question</th><th>Expected</th><th>Actual (last run)</th><th>Result</th><th></th></tr></thead><tbody id="rows">' + rowsHtml + '</tbody></table>'
    + '<div class="add"><h3>Add a question</h3>'
    + '<input id="nq" placeholder="question (how do I ...)"><input id="ne" placeholder="expected answer (plain English)"><input id="nm" placeholder="relevance regex (optional, e.g. curl|post)">'
    + '<button id="addb">Add</button></div>'
    + '<h3>Complete build scoreboard</h3><table class="t"><thead><tr><th>version</th><th>when</th><th>run</th><th>passed</th><th>score</th></tr></thead><tbody>' + completeRunsHtml + '</tbody></table>'
    + '<h3>Partial / graph runs</h3><table class="t"><thead><tr><th>state</th><th>when</th><th>run</th><th>passed</th><th>score</th></tr></thead><tbody>' + partialRunsHtml + '</tbody></table>'
    + '</div>'
    + '<style>'
    + '.stp{max-width:1100px}.head{display:flex;align-items:center;gap:22px;margin:14px 0;flex-wrap:wrap}'
    + '.stat{text-align:center}.stat .n{font-size:26px;font-weight:800}.stat .l{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}'
    + '.off{background:#ffe0e0;color:#8b0000;border:1px solid #c1121f;border-radius:8px;padding:10px 14px;margin:10px 0;font-weight:700}'
    + '.on{background:#dff5e1;color:#1a7f37;border:1px solid #1a7f37;border-radius:8px;padding:10px 14px;margin:10px 0;font-weight:700}'
    + '.warn{background:#fff3cd;color:#856404;border:1px solid #ffc107;border-radius:8px;padding:10px 14px;margin:10px 0;font-weight:700}'
    + '.muted-banner{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:10px 0;color:var(--ink-soft)}'
    + '.toggles{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;margin:16px 0;padding:14px;border:2px solid var(--line-strong);border-radius:10px;background:var(--panel)}'
    + '.tog{flex:1;min-width:220px}.tog-label{font:700 12px var(--sans);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}'
    + '.tog-btn{font:800 18px var(--sans);border:0;border-radius:8px;padding:12px 28px;cursor:pointer;min-width:100px}'
    + '.tog-btn.is-off{background:#c1121f;color:#fff}.tog-btn.is-on{background:#1a7f37;color:#fff}'
    + '.tog-btn:disabled{opacity:.4;cursor:not-allowed}.tog-hint{font-size:12px;color:var(--ink-soft);margin-top:8px;line-height:1.4}'
    + '.kill{background:#111;color:#fff;border:0;border-radius:8px;padding:12px 16px;font-weight:700;cursor:pointer;align-self:center}'
    + '.run{margin-left:auto;background:var(--accent);color:#fff;border:0;border-radius:8px;padding:10px 18px;font-weight:700;cursor:pointer}'
    + '.run:disabled{opacity:.45;cursor:not-allowed}'
    + '.run.graph{margin-left:8px;background:#20558a}'
    + '.prog{font:13px var(--mono);color:var(--muted)}'
    + '.wl{font-size:13px;color:var(--ink-soft);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin-bottom:14px}'
    + '.t{width:100%;border-collapse:collapse;margin:8px 0 24px;font-size:13px}'
    + '.t th{text-align:left;border-bottom:2px solid var(--line-strong);padding:6px 8px;font-size:11px;text-transform:uppercase;color:var(--muted)}'
    + '.t td{border-bottom:1px solid var(--line);padding:8px;vertical-align:top}'
    + '.q{font-weight:600;width:22%}.e{color:var(--ink-soft);width:24%}.a{color:var(--muted);width:36%;white-space:pre-wrap}'
    + '.d{font:11px var(--mono);font-weight:800;padding:2px 6px;border-radius:4px}.pass{background:#dff5e1;color:#1a7f37}.fail{background:#ffe0e0;color:#c1121f}.none{background:#eee;color:#999}'
    + '.add{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:24px}'
    + '.add input{display:block;width:100%;margin:6px 0;padding:8px;border:1px solid var(--line-strong);border-radius:6px}'
    + '.del{background:none;border:1px solid var(--line-strong);border-radius:5px;padding:2px 9px;cursor:pointer}'
    + '</style>'
    + '<script>(function(){'
    + 'var prog=document.getElementById("prog");'
    + 'async function api(b){var r=await fetch("/api/selftest",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b),credentials:"same-origin"});return r.json();}'
    + 'function paintTog(btn,on){btn.dataset.on=on?"1":"0";btn.textContent=on?"ON":"OFF";btn.className="tog-btn "+(on?"is-on":"is-off");}'
    + 'document.getElementById("master").onclick=async function(){var on=this.dataset.on==="1";'
    + 'if(on){if(!confirm("Turn MASTER OFF? Stops all self-test paths."))return;'
    + 'var res=await api({action:"set_master",value:"0"});prog.textContent=res.error||"master OFF";location.reload();return;}'
    + 'var phrase=prompt("Type ENABLE SELFTEST to turn MASTER ON (vault lock).");'
    + 'if(phrase===null)return;var res=await api({action:"set_master",value:"1",confirm:phrase});'
    + 'if(res.error){prog.textContent=res.error+": "+(res.reason||res.phrase||"");return;}'
    + 'location.reload();};'
    + 'document.getElementById("autorun").onclick=async function(){if(this.disabled)return;var on=this.dataset.on==="1";'
    + 'if(on){if(!confirm("Turn AUTORUN OFF?"))return;var res=await api({action:"set_autorun",value:"0"});prog.textContent=res.error||"autorun OFF";location.reload();return;}'
    + 'var phrase=prompt("Type ENABLE SELFTEST AUTORUN to turn recurring loop ON.");'
    + 'if(phrase===null)return;var res=await api({action:"set_autorun",value:"1",confirm:phrase});'
    + 'if(res.error){prog.textContent=res.error+": "+(res.reason||res.phrase||"");return;}'
    + 'location.reload();};'
    + 'document.getElementById("kill").onclick=async function(){if(!confirm("Kill all loops + force MASTER OFF?"))return;'
    + 'prog.textContent="killing...";var res=await api({action:"kill"});prog.textContent=res.killed?"killed + master OFF":JSON.stringify(res);setTimeout(function(){location.reload();},800);};'
    + 'document.getElementById("run").onclick=async function(){if(this.disabled){prog.textContent="MASTER OFF — enable first";return;}this.disabled=true;var off=0,rid=null,done=false,total=0,pass=0;'
    + 'while(!done){prog.textContent="running "+off+"...";var res=await api({action:"run",limit:1,offset:off,run_id:rid,fresh_run:!rid&&off===0,manual:true});'
    + 'if(res.error){prog.textContent="error: "+res.error;this.disabled=false;return;}'
    + 'if(res.skipped){prog.textContent=res.reason||"skipped";this.disabled=false;return;}'
    + 'rid=res.run_id;off=res.next_offset;done=res.done;total=res.of;pass=res.passed_so_far;'
    + 'prog.textContent=pass+"/"+res.tested_so_far+" passed ("+res.score+"%) — watch the group chat";}'
    + 'prog.textContent="done — "+pass+"/"+total+" passed. reloading...";setTimeout(function(){location.reload();},1500);};'
    + 'document.getElementById("graph").onclick=async function(){if(this.disabled){prog.textContent="MASTER OFF — enable first";return;}this.disabled=true;prog.textContent="graph populate...";'
    + 'var res=await api({action:"graph_run",notify:true,manual:true});if(res.error){prog.textContent="error: "+res.error;this.disabled=false;return;}'
    + 'if(res.skipped){prog.textContent=res.reason||"skipped";this.disabled=false;return;}'
    + 'prog.textContent="graph "+res.passed+"/"+res.total+" ("+res.score+"%) — watch group";setTimeout(function(){location.reload();},2000);};'
    + 'document.getElementById("addb").onclick=async function(){var q=document.getElementById("nq").value.trim();if(!q)return;'
    + 'await api({action:"add",q:q,expected:document.getElementById("ne").value,match:document.getElementById("nm").value});location.reload();};'
    + 'document.getElementById("rows").addEventListener("click",async function(e){var b=e.target.closest(".del");if(!b)return;'
    + 'if(!confirm("delete this question?"))return;await api({action:"delete",id:parseInt(b.dataset.id,10)});location.reload();});'
    + '})();</script>';

  return new Response(shellHtml({ activeHref: '/admin/selftest', title: 'Self-Test', body: BODY }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
