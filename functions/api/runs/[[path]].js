// /api/runs — the queue. GET list (?type ?status ?limit), POST log a run, PATCH status.
// Approving a 'condition' run creates the article stub automatically.
function json(o,s=200){return new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json','access-control-allow-origin':'*'}});}
const now=()=>new Date().toISOString();
function slugify(s){return String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);}

export async function logRun(env,r){
  try{ const res=await env.DB.prepare('INSERT INTO runs (type,request,model,target,output,status,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(r.type||'studio',r.request||null,r.model||null,r.target||null,r.output||null,r.status||'done',r.note||null,now(),now()).run();
    return res.meta?.last_row_id??null; }catch(e){ return null; }
}

async function promoteCondition(env,row){
  const title=String(row.output||row.request||'').replace(/^[-*\d.\s]+/,'').split(/[.;\n]/)[0].trim().slice(0,90);
  if(!title) return null;
  const slug='cond-'+slugify(title);
  const exists=await env.DB.prepare('SELECT slug FROM content_items WHERE slug=?').bind(slug).first();
  if(exists) return exists.slug;
  const peptides=row.request?[row.request]:[];
  const bj=JSON.stringify({peptides,tissue:row.target||'',source:'queue',proposed_by:row.model||''});
  await env.DB.prepare('INSERT INTO content_items (slug,type,title,section,body_md,body_json,status,tags_json,source_doc,source_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(slug,'topic',title,'condition','',bj,'active',JSON.stringify(['topic','queued',...peptides]),'queue',null,now(),now()).run();
  return slug;
}

export async function onRequest(context){
  const {request,env}=context;
  const url=new URL(request.url);
  const method=request.method.toUpperCase();
  if(method==='OPTIONS') return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS','access-control-allow-headers':'content-type'}});
  const parts=url.pathname.replace(/\/+$/,'').split('/').filter(Boolean); // api, runs, id?
  const id=parts[2];

  if(!id){
    if(method==='GET'){
      const where=[],binds=[];
      if(url.searchParams.get('type')){where.push('type=?');binds.push(url.searchParams.get('type'));}
      if(url.searchParams.get('status')){where.push('status=?');binds.push(url.searchParams.get('status'));}
      const lim=Math.min(parseInt(url.searchParams.get('limit')||'500',10)||500,2000);
      const sql='SELECT * FROM runs'+(where.length?' WHERE '+where.join(' AND '):'')+' ORDER BY created_at DESC LIMIT '+lim;
      const r=await env.DB.prepare(sql).bind(...binds).all();
      return json({count:(r.results||[]).length,runs:r.results||[]});
    }
    if(method==='POST'){ const b=await request.json().catch(()=>({})); const newId=await logRun(env,b); return json({added:newId}); }
    return json({error:'method not allowed'},405);
  }

  if(method==='PATCH'){
    const b=await request.json().catch(()=>({}));
    const row=await env.DB.prepare('SELECT * FROM runs WHERE id=?').bind(parseInt(id,10)).first();
    if(!row) return json({error:'not found'},404);
    let note=b.note!=null?String(b.note):row.note;
    if(b.status==='approved' && row.type==='condition'){ const slug=await promoteCondition(env,row); if(slug) note=(note?note+' · ':'')+'article: '+slug; }
    await env.DB.prepare('UPDATE runs SET status=?, note=?, updated_at=? WHERE id=?').bind(b.status||row.status,note,now(),parseInt(id,10)).run();
    const out=await env.DB.prepare('SELECT * FROM runs WHERE id=?').bind(parseInt(id,10)).first();
    return json({run:out});
  }
  return json({error:'method not allowed'},405);
}
