// Maps candidate conditions for every peptide into the queue (status pending) so the owner
// approves/denies each. Also logs the demand-API recommendation + setup steps.
const C='https://miscsubjects.com/api/content', S='https://miscsubjects.com/api/studio', R='https://miscsubjects.com/api/runs';
const PEPTIDES=["BPC-157","TB-500","ARA-290","Semax","Selank","PT-141","DSIP","KPV","GHK-Cu","Thymosin Alpha-1","Retatrutide","Tirzepatide","NAD+"];
const MODELS=["grok:grok-4","openai:gpt-4o-mini","@cf/meta/llama-3.3-70b-instruct-fp8-fast"];

const existing=(await (await fetch(C+'?type=topic')).json()).items.map(i=>i.title.toLowerCase());
const seen=new Set(existing);
let added=0;
for(let i=0;i<PEPTIDES.length;i++){
  const pep=PEPTIDES[i], model=MODELS[i%MODELS.length];
  const system=`List 6 specific health conditions, injuries, aging processes, or drug side-effects where ${pep}'s published tissue/pathway research plausibly applies. Output ONLY a plain list, one condition per line, no numbering, no preamble, at most 6 lines. Avoid generic repeats of: ${existing.slice(0,40).join(', ')}.`;
  let text='';
  try{ const r=await (await fetch(S,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,system,input:pep,run_type:'condition_scan',run_status:'info',label:'scan '+pep})})).json(); text=r.text||''; }catch(e){ continue; }
  const lines=text.split('\n').map(l=>l.replace(/^[-*\d.\)\s]+/,'').trim()).filter(l=>l.length>=4&&l.length<=90);
  for(const cond of lines.slice(0,6)){
    const key=cond.toLowerCase();
    if(seen.has(key))continue; seen.add(key);
    await fetch(R,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'condition',request:pep,model,output:cond,status:'pending'})});
    added++;
  }
  console.log(pep,'('+model.split(/[:/]/).pop()+'):',lines.length,'conditions');
}
// demand-API pipeline into the queue
await fetch(R,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'demand_api',request:'How to wire real demand data (Google volume + CPC, TikTok, X)',model:'panel',output:'DataForSEO Keywords Data API = Google monthly search volume + CPC. TikTok Research API (or Apify TikTok scraper) = TikTok interest. X/Twitter API v2 = X interest.',status:'pending'})});
await fetch(R,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'setup',request:'Get DataForSEO key',model:'the owner',output:'Sign up at dataforseo.com -> Dashboard -> API Access -> copy login+password. Give me both; I wire search_volume + CPC columns.',status:'pending',note:'where: dataforseo.com'})});
await fetch(R,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'setup',request:'Get TikTok Research API access',model:'the owner',output:'Apply at developers.tiktok.com (Research API). Or skip approval and use Apify TikTok scraper token from apify.com.',status:'pending',note:'where: developers.tiktok.com or apify.com'})});
console.log('pending conditions added:',added);
