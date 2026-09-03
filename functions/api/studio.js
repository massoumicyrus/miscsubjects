// /api/studio — run ONE model with a system prompt + input. The workbench's engine.
// POST {model, system, input, kind?, slug?, save?}  save = 'comment' | 'body' | 'field:<key>'
// Returns {text} for text models, {url} for image models. Chaining is done client-side
// (feed the output back as the next input with a different model).
import { logRun } from './runs/[[path]].js';
import { logEvent } from '../_lib/event_log.js';
function json(o,s=200){return new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json','access-control-allow-origin':'*'}});}
const now=()=>new Date().toISOString();

async function callText(env,model,system,user){
  if(model.startsWith('@cf/')){
    const r=await env.AI.run(model,{messages:[{role:'system',content:system},{role:'user',content:user}],max_tokens:900});
    const v=r&&(r.response??r.result??''); return typeof v==='string'?v:(v?JSON.stringify(v):'');
  }
  const [prov,...rest]=model.split(':'); const id=rest.join(':');
  if(prov==='gemini'){
    if(!env.GEMINI_API_KEY) return '[skip: no GEMINI_API_KEY]';
    const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent?key=${env.GEMINI_API_KEY}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{parts:[{text:user}]}]})});
    const j=await res.json(); if(!res.ok) return '[skip: gemini '+res.status+']';
    return j?.candidates?.[0]?.content?.parts?.[0]?.text||'';
  }
  const cfg={grok:{url:'https://api.x.ai/v1/chat/completions',key:env.GROK_API_KEY,m:id||'grok-4'},openai:{url:'https://api.openai.com/v1/chat/completions',key:env.OPENAI_API_KEY,m:id||'gpt-4o-mini'},kimi:{url:'https://api.moonshot.ai/v1/chat/completions',key:env.MOONSHOT_API_KEY,m:id||'moonshot-v1-8k'}}[prov];
  if(!cfg) return '[skip: unknown provider '+prov+']';
  if(!cfg.key) return '[skip: no key for '+prov+']';
  const res=await fetch(cfg.url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+cfg.key},body:JSON.stringify({model:cfg.m,messages:[{role:'system',content:system},{role:'user',content:user}]})});
  const j=await res.json().catch(()=>({})); if(!res.ok) return '[skip: '+prov+' '+res.status+' '+(j?.error?.message||'')+']';
  return j?.choices?.[0]?.message?.content||'';
}

async function callImage(env,model,prompt){
  const m=model.startsWith('@cf/')?model:'@cf/black-forest-labs/flux-1-schnell';
  const r=await env.AI.run(m,{prompt});
  let bytes; if(r&&r.image)bytes=Uint8Array.from(atob(r.image),c=>c.charCodeAt(0));
  else if(r instanceof ArrayBuffer)bytes=new Uint8Array(r);
  else if(r&&r.body)bytes=new Uint8Array(await new Response(r.body).arrayBuffer());
  if(!bytes) return null;
  const key='img/studio/'+crypto.randomUUID()+'.png';
  await env.R2.put(key,bytes,{httpMetadata:{contentType:'image/png'}});
  await logEvent(env,{
    source:'studio', key:'STUDIO_IMAGE', action:'generate', direction:'out', status:200,
    request:{model:m,prompt}, response:{r2_key:key,bytes:bytes.length},
  });
  return '/'+key;
}

// Raw passthrough: take a full REST request {method,url,headers,body} and inject
// the real provider key from env (by host) before forwarding. Lets the LLM_MATRIX
// sheet hold the complete request and have the Worker supply the Cloudflare-held key.
async function rawProxy(env,raw){
  let {method='POST',url,headers={},body}=raw||{};
  if(!url) return json({error:'raw.url required'},400);
  const u=new URL(url);
  const host=u.hostname;
  const h={...headers};
  if(host==='generativelanguage.googleapis.com'){
    if(!env.GEMINI_API_KEY) return json({status:0,ok:false,payload:'[no GEMINI_API_KEY in Worker]'});
    u.searchParams.set('key',env.GEMINI_API_KEY);
  }else if(host==='api.x.ai'){ h.Authorization='Bearer '+env.GROK_API_KEY; }
  else if(host==='api.openai.com'){ h.Authorization='Bearer '+env.OPENAI_API_KEY; }
  else if(host==='api.moonshot.ai'){ h.Authorization='Bearer '+env.MOONSHOT_API_KEY; }
  else if(host==='api.anthropic.com'){ h['x-api-key']=env.ANTHROPIC_API_KEY; if(!h['anthropic-version'])h['anthropic-version']='2023-06-01'; delete h.Authorization; }
  else if(host==='api.cloudflare.com'){
    h.Authorization='Bearer '+(env.CLOUDFLARE_API_TOKEN||env.CF_API_TOKEN||env.CF_TOKEN);
    if(env.CF_ACCOUNT_ID) u.pathname=u.pathname.replace(/accounts\/[^/]+/,'accounts/'+env.CF_ACCOUNT_ID);
  }else{ return json({error:'host not allowed: '+host},400); }
  const res=await fetch(u.toString(),{method,headers:h,body:typeof body==='string'?body:JSON.stringify(body)});
  const payload=await res.text();
  return json({status:res.status,ok:res.ok,payload});
}

export async function onRequestPost(context){
  const {env,request}=context;
  const b=await request.json().catch(()=>({}));
  if(b.raw){ try{ return await rawProxy(env,b.raw); }catch(e){ return json({status:0,ok:false,payload:'[proxy error] '+e.message}); } }
  if(!b.model) return json({error:'model required'},400);
  const system=String(b.system||'');
  const input=String(b.input||'');
  try{
    if(b.kind==='image'||String(b.model).startsWith('@cf/')&&/flux|stable-diffusion/.test(b.model)){
      const url=await callImage(env,b.model,(system?system+' ':'')+input);
      return url?json({url}):json({error:'no image bytes'},500);
    }
    const text=String(await callText(env,b.model,system,input)).trim();
    await logRun(env,{type:b.run_type||'studio',request:(b.label||'studio')+(b.slug?(' · '+b.slug):''),model:b.model,target:b.slug||null,output:text,status:b.run_status||'done'});
    if(b.slug&&b.save){
      const slug=String(b.slug);
      if(b.save==='comment'){
        await env.DB.prepare('INSERT INTO content_comments(item_slug,model_name,comment_type,comment_md,proposed_patch_json,created_at) VALUES (?,?,?,?,?,?)').bind(slug,b.model,'studio',text,null,now()).run();
      }else if(b.save==='body'){
        const cur=await env.DB.prepare('SELECT * FROM content_items WHERE slug=?').bind(slug).first();
        if(cur){await env.DB.prepare('UPDATE content_items SET body_md=?,updated_at=? WHERE slug=?').bind(text,now(),slug).run();
          const v=await env.DB.prepare('SELECT MAX(version) v FROM content_versions WHERE item_slug=?').bind(slug).first();
          const row=await env.DB.prepare('SELECT * FROM content_items WHERE slug=?').bind(slug).first();
          await env.DB.prepare('INSERT INTO content_versions(item_slug,version,snapshot_json,change_note,created_by,created_at) VALUES (?,?,?,?,?,?)').bind(slug,(v?.v||0)+1,JSON.stringify(row),'studio:'+b.model,'workbench',now()).run();
        }
      }else if(String(b.save).startsWith('field:')){
        const fkey=String(b.save).slice(6);
        const cur=await env.DB.prepare('SELECT body_json FROM content_items WHERE slug=?').bind(slug).first();
        let bj={};try{bj=cur&&cur.body_json?JSON.parse(cur.body_json):{};}catch{}
        bj[fkey]=text;
        await env.DB.prepare('UPDATE content_items SET body_json=?,updated_at=? WHERE slug=?').bind(JSON.stringify(bj),now(),slug).run();
      }
    }
    return json({text,saved:b.save||null});
  }catch(e){return json({error:e.message},500);}
}
