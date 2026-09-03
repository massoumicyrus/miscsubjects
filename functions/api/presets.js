// /api/presets — saved system-prompt presets. GET list, POST add, DELETE ?id=
function json(o,s=200){return new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json','access-control-allow-origin':'*'}});}
const now=()=>new Date().toISOString();
export async function onRequestGet(context){
  const r=await context.env.DB.prepare('SELECT * FROM presets ORDER BY kind,name').all();
  return json({presets:r.results||[]});
}
export async function onRequestPost(context){
  const b=await context.request.json().catch(()=>({}));
  if(!b.name||!b.system_prompt) return json({error:'name and system_prompt required'},400);
  const res=await context.env.DB.prepare('INSERT INTO presets (name,kind,system_prompt,created_at,updated_at) VALUES (?,?,?,?,?)')
    .bind(String(b.name),String(b.kind||'text'),String(b.system_prompt),now(),now()).run();
  return json({added:res.meta?.last_row_id??null,name:b.name});
}
export async function onRequestDelete(context){
  const id=new URL(context.request.url).searchParams.get('id');
  if(!id) return json({error:'id required'},400);
  await context.env.DB.prepare('DELETE FROM presets WHERE id=?').bind(parseInt(id,10)).run();
  return json({deleted:id});
}
