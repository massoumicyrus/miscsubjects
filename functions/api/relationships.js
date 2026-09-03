// /api/relationships — read/write the intervention graph.
// GET  /api/relationships            all
// GET  /api/relationships?source=Adderall   edges from a node
// GET  /api/relationships?target=anxiety     edges into a node
// POST /api/relationships {source_type,source_id,target_type,target_id,relationship_type,evidence_score,note}
function json(o,s=200){return new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json','access-control-allow-origin':'*'}});}
const now=()=>new Date().toISOString();

export async function onRequestGet(context){
  const { env, request } = context;
  const u=new URL(request.url);
  const where=[],binds=[];
  if(u.searchParams.get('source')){where.push('source_id = ?');binds.push(u.searchParams.get('source'));}
  if(u.searchParams.get('target')){where.push('target_id = ?');binds.push(u.searchParams.get('target'));}
  if(u.searchParams.get('type')){where.push('relationship_type = ?');binds.push(u.searchParams.get('type'));}
  const sql='SELECT * FROM relationships'+(where.length?' WHERE '+where.join(' AND '):'')+' ORDER BY source_type,source_id';
  const r=await env.DB.prepare(sql).bind(...binds).all();
  return json({ count:(r.results||[]).length, edges:r.results||[] });
}

export async function onRequestPost(context){
  const { env, request } = context;
  const b=await request.json().catch(()=>({}));
  for(const k of ['source_type','source_id','target_type','target_id','relationship_type']) if(!b[k]) return json({error:'missing '+k},400);
  const res=await env.DB.prepare('INSERT INTO relationships (source_type,source_id,target_type,target_id,relationship_type,evidence_score,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(b.source_type,b.source_id,b.target_type,b.target_id,b.relationship_type,b.evidence_score??null,b.note??null,now(),now()).run();
  return json({ added: res.meta?.last_row_id ?? null });
}
