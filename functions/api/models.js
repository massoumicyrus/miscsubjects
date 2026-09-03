// /api/models — every model wired into the workbench. CF models run with no key.
// External ones show whether their key is present on this deployment.
function json(o){return new Response(JSON.stringify(o),{headers:{'content-type':'application/json','access-control-allow-origin':'*'}});}

const CF_TEXT = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct-fast',
  '@cf/meta/llama-3.1-70b-instruct',
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/qwen/qwen2.5-coder-32b-instruct',
  '@cf/qwen/qwq-32b',
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/qwen/qwen3-30b-a3b-fp8',
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  '@cf/meta/llama-3.2-1b-instruct',
];
const CF_WORKERS_AI_EXTRA = [
  ['@cf/moonshotai/kimi-k2.7-code','Kimi K2.7 Code (Workers AI, 262k)'],
  ['@cf/moonshotai/kimi-k2.6','Kimi K2.6 (Workers AI, 262k)'],
  ['@cf/zai-org/glm-5.2','GLM-5.2 (Workers AI, 262k)'],
  ['@cf/zai-org/glm-4.7-flash','GLM-4.7 Flash (Workers AI, cheapest)'],
];

// Gateway catalogue ids, verified against this account's published list. Written exactly as the
// gateway writes them — provider/model, never provider:model, which no lane can route.
// google-ai-studio is in the gateway catalogue but answers "Please pass a valid API key" on this
// account, so it is not listed: a model in this list is a model that answers.
const CATALOGUE = [
  ['moonshotai/kimi-k3','Kimi K3 (catalogue, 1M)'],
  ['xai/grok-4.5','Grok 4.5'],
  ['openai/gpt-5.5','GPT-5.5'],
  ['minimax/m3','MiniMax M3'],
];

// Catalogue ids this account cannot get an answer out of. Kept named, with the reason, so nobody
// re-adds them and calls the result a model failure:
//   google-ai-studio/*  400 "Please pass a valid API key" — no Google key on this account.
//   anthropic/*         200 with tokens billed and the content key stripped by the gateway's
//                       OpenAI translation: {role:"assistant", refusal:null} and nothing else.
const NOT_REACHABLE = ['google-ai-studio/*', 'anthropic/*'];

const CF_IMAGE = ['@cf/black-forest-labs/flux-1-schnell','@cf/stabilityai/stable-diffusion-xl-base-1.0'];

export async function onRequestGet(context){
  const env=context.env;
  const text=[];
  for(const m of CF_TEXT) text.push({id:m,label:m.replace('@cf/',''),provider:'cloudflare',ready:true});
  for(const [id,label] of CF_WORKERS_AI_EXTRA) text.push({id,label,provider:'cloudflare',ready:true});
  // Catalogue models. These bill through Unified Billing on the account token — no provider key
  // of ours is involved, so `ready` is true for all of them. Every id here is the id the gateway
  // itself publishes, which is the id /api/invoke sends: a model listed here is a model that runs.
  for(const [id,label] of CATALOGUE) text.push({id,label,provider:id.split('/')[0],ready:true});
  const image=[];
  for(const m of CF_IMAGE) image.push({id:m,label:m.replace('@cf/',''),provider:'cloudflare',ready:true});
  image.push({id:'grok:image',label:'Grok image',provider:'xai',ready:!!env.GROK_API_KEY});
  image.push({id:'arcads:generate',label:'ArcAds',provider:'arcads',ready:!!env.ARCADS_API_KEY});
  return json({text,image,not_reachable:NOT_REACHABLE});
}
