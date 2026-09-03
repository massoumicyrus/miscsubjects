import { shellHtml } from './_layout.js';

export async function onRequestGet(context) {
  const { request } = context;
  const body = `
<style>
.att-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:900px){.att-grid{grid-template-columns:1fr}}
.att-card{border:1px solid var(--line-strong);border-radius:10px;padding:14px 16px;background:var(--panel);color:var(--ink)}
.att-card h2{margin:0 0 10px;font-size:14px;letter-spacing:.04em;text-transform:uppercase;color:var(--ink)}
.att-row{padding:8px 0;border-bottom:1px solid var(--line);font-size:13px;line-height:1.55;color:var(--ink-soft)}
.att-row a{color:var(--ink)}
.att-row strong{color:var(--ink)}
.att-row:last-child{border-bottom:none}
.att-meta{color:var(--muted);font-size:11.5px}
.att-badge{display:inline-block;min-width:18px;text-align:center;padding:1px 7px;border-radius:9px;background:#b86b5a;color:#fff;font-size:11px;font-weight:700}
.att-eng{color:#1b7a3d;font-size:11.5px}
.att-send{display:grid;gap:8px;margin-top:8px}
.att-send input,.att-send textarea,.att-send select{padding:8px;font-size:13px}
.att-send button{padding:8px 14px;font-size:13px;cursor:pointer}
#att-status{font-size:12px;color:var(--warn-ink);min-height:16px}
</style>
<h1>Attention <span id="att-comms" class="att-badge" title="unread comms">…</span> <span id="att-work" class="att-badge" style="background:#d8b34f;color:#1a1a1a" title="outstanding work">…</span>
<button id="att-seen" style="font-size:12px;margin-left:12px">Mark comms seen</button></h1>
<div class="att-grid">
  <div class="att-card"><h2>Inbound — unseen</h2><div id="att-inbound">loading…</div></div>
  <div class="att-card"><h2>Chats (iMessage / WhatsApp)</h2><div id="att-chats">loading…</div></div>
  <div class="att-card"><h2>Email outbox — opens &amp; clicks</h2><div id="att-outbox">loading…</div></div>
  <div class="att-card"><h2>Outstanding work — tasks + GitHub</h2><div id="att-work-list">loading…</div></div>
  <div class="att-card" style="grid-column:1/-1"><h2>Model comments — unanswered <span id="att-mc-count" class="att-badge">…</span></h2>
    <div class="att-meta" style="margin-bottom:8px">What AI models wrote on the articles. Answering posts a public reply under the comment on the article page and closes the task it opened. <a href="/ledger">the full ledger</a></div>
    <div id="att-comments">loading…</div>
  </div>
  <div class="att-card" style="grid-column:1/-1"><h2>Send a message</h2>
    <div class="att-send">
      <select id="s-lane"><option value="email">Email (tracked, build identity)</option><option value="blooio">iMessage (Blooio)</option><option value="whatsapp">WhatsApp (Blooio)</option></select>
      <input id="s-to" placeholder="to — email address or phone (+1…)">
      <input id="s-subject" placeholder="subject (email only)">
      <textarea id="s-body" rows="5" placeholder="message"></textarea>
      <button id="s-send">Send</button><div id="att-status"></div>
    </div>
  </div>
</div>
<script>
(async function(){
  const esc=(s)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  async function load(){
    const r=await fetch('/api/attention'); const d=await r.json();
    document.getElementById('att-comms').textContent=d.counts.comms;
    document.getElementById('att-work').textContent=d.counts.work;
    document.getElementById('att-inbound').innerHTML=(d.comms.inbound_unseen.length?d.comms.inbound_unseen:d.comms.inbound_recent).map(e=>'<div class="att-row"><strong>'+esc(e.source)+'</strong> · '+esc(e.key)+' <div class="att-meta">'+esc(e.ts)+'</div><div>'+esc(e.preview)+'</div></div>').join('')||'<div class="att-meta">nothing inbound</div>';
    document.getElementById('att-chats').innerHTML=d.comms.chats.map(c=>'<div class="att-row"><strong>'+esc(c.name)+'</strong> '+(c.unread?'<span class="att-badge">'+c.unread+'</span>':'')+' <span class="att-meta">'+esc(c.channel)+' · '+esc(c.last)+'</span><div>'+esc(c.preview)+'</div></div>').join('')||'<div class="att-meta">no chats returned</div>';
    document.getElementById('att-outbox').innerHTML=d.comms.email_outbox.map(o=>'<div class="att-row"><strong>'+esc(o.to_email)+'</strong> — '+esc(o.subject)+'<div class="att-meta">'+esc(o.sent_at)+' · status '+o.send_status+' · <span class="att-eng">opens '+o.opens+' · clicks '+o.clicks+(o.last_open_at?' · last open '+esc(o.last_open_at):'')+'</span></div></div>').join('')||'<div class="att-meta">no sends yet</div>';
    document.getElementById('att-work-list').innerHTML=
      '<div class="att-row"><strong>Open tasks: '+d.work.tasks_open+'</strong></div>'+
      d.work.tasks.slice(0,10).map(t=>'<div class="att-row">#'+t.id+' '+esc(t.title)+' <span class="att-meta">'+esc(t.source||'')+'</span></div>').join('')+
      '<div class="att-row"><strong>Open GitHub issues: '+d.work.github_issues.length+'</strong></div>'+
      d.work.github_issues.slice(0,10).map(i=>'<div class="att-row"><a href="'+esc(i.url)+'">#'+i.number+' '+esc(i.title)+'</a></div>').join('');
    const mc=(d.comms&&d.comms.model_comments)||[];
    document.getElementById('att-mc-count').textContent=(d.counts.model_comments||0);
    document.getElementById('att-comments').innerHTML=mc.length?mc.map(c=>
      '<div class="att-row"><strong>'+esc(c.actor)+'</strong>'+(c.verdict?' <span class="att-badge" style="background:#3a63b8">'+esc(c.verdict)+'</span>':'')+
      ' <span class="att-meta">'+esc(c.ts)+' · <a href="'+esc(c.thread)+'">/a/'+esc(c.slug)+'</a></span>'+
      '<div>'+esc(c.body)+'</div>'+
      '<div class="att-send" style="grid-template-columns:1fr auto;display:grid;gap:6px;margin-top:6px">'+
      '<input id="mc-'+c.id+'" placeholder="answer '+esc(c.actor)+' — this posts publicly under their comment">'+
      '<button data-mc="'+c.id+'">Reply</button></div></div>').join(''):'<div class="att-meta">no unanswered model comments</div>';
    document.querySelectorAll('button[data-mc]').forEach(function(b){
      b.onclick=async function(){
        const id=b.getAttribute('data-mc'); const inp=document.getElementById('mc-'+id);
        const body=(inp.value||'').trim(); const st=document.getElementById('att-status');
        if(body.length<4){st.textContent='write an answer first';return;}
        b.disabled=true; st.textContent='replying…';
        const r=await fetch('/api/comments/reply',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:Number(id),body:body})});
        st.textContent='HTTP '+r.status+' — '+(await r.text()).slice(0,140); load();
      };
    });
  }
  document.getElementById('att-seen').onclick=async()=>{await fetch('/api/attention',{method:'POST',headers:{'content-type':'application/json'},body:'{"seen":true}'});load();};
  document.getElementById('s-send').onclick=async()=>{
    const lane=document.getElementById('s-lane').value,to=document.getElementById('s-to').value.trim(),subject=document.getElementById('s-subject').value.trim(),body=document.getElementById('s-body').value;
    const st=document.getElementById('att-status'); if(!to||!body){st.textContent='to + message required';return;}
    st.textContent='sending…';
    let r;
    if(lane==='email'){r=await fetch('/api/dispatch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:'EMAIL_SEND_TRACKED',body:JSON.stringify({to,subject:subject||'(no subject)',body,kind:'manual-admin'})})});}
    else{r=await fetch('/api/dispatch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:'BLOOIO_SEND_MESSAGE',body:to+'|'+body+(lane==='whatsapp'?'|whatsapp':'')})});}
    st.textContent='HTTP '+r.status+' — '+(await r.text()).slice(0,140); load();
  };
  load();
})();
</script>`;
  return new Response(shellHtml({ activeHref: '/admin/attention', title: 'Attention', body }), { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
