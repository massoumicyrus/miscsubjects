// /api/models/cloudflare — full Cloudflare Workers AI model catalog in REST JSON shape.
// Proxies the live Cloudflare API when CF_ACCOUNT_ID + CLOUDFLARE_API_TOKEN are present,
// otherwise returns the cached catalog of known-good models.
function json(o, status) {
  return new Response(JSON.stringify(o, null, 2), {
    status: status || 200,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  });
}

const KNOWN = [
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', task: { id: 'text-generation', name: 'Text Generation' }, name: 'Llama 3.3 70B Instruct (FP8)', description: 'Fast FP8 variant of Llama 3.3 70B for general instruction following.', tags: ['text-generation'] },
  { id: '@cf/meta/llama-3.1-8b-instruct-fast', task: { id: 'text-generation', name: 'Text Generation' }, name: 'Llama 3.1 8B Instruct (Fast)', description: 'Fast 8B parameter instruction model.', tags: ['text-generation'] },
  { id: '@cf/meta/llama-3.1-70b-instruct', task: { id: 'text-generation', name: 'Text Generation' }, name: 'Llama 3.1 70B Instruct', description: 'General-purpose 70B instruction model.', tags: ['text-generation'] },
  { id: '@cf/meta/llama-4-scout-17b-16e-instruct', task: { id: 'text-generation', name: 'Text Generation' }, name: 'Llama 4 Scout 17B 16E Instruct', description: 'Multimodal MoE instruction model.', tags: ['text-generation'] },
  { id: '@cf/qwen/qwen2.5-coder-32b-instruct', task: { id: 'text-generation', name: 'Text Generation' }, name: 'Qwen2.5 Coder 32B Instruct', description: 'Code-specialized 32B instruction model.', tags: ['text-generation'] },
  { id: '@cf/qwen/qwq-32b', task: { id: 'text-generation', name: 'Text Generation' }, name: 'QwQ 32B', description: 'Reasoning-focused 32B model.', tags: ['text-generation'] },
  { id: '@cf/meta/llama-3.2-3b-instruct', task: { id: 'text-generation', name: 'Text Generation' }, name: 'Llama 3.2 3B Instruct', description: 'Lightweight on-device instruction model.', tags: ['text-generation'] },
  { id: '@cf/mistralai/mistral-small-3.1-24b-instruct', task: { id: 'text-generation', name: 'Text Generation' }, name: 'Mistral Small 3.1 24B Instruct', description: 'Efficient 24B instruction model from Mistral.', tags: ['text-generation'] },
  { id: '@cf/qwen/qwen3-30b-a3b-fp8', task: { id: 'text-generation', name: 'Text Generation' }, name: 'Qwen3 30B A3B (FP8)', description: 'Mixed-mode thinking model in FP8.', tags: ['text-generation'] },
  { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', task: { id: 'text-generation', name: 'Text Generation' }, name: 'DeepSeek R1 Distill Qwen 32B', description: 'Reasoning model distilled from DeepSeek R1.', tags: ['text-generation'] },
  { id: '@cf/meta/llama-3.2-1b-instruct', task: { id: 'text-generation', name: 'Text Generation' }, name: 'Llama 3.2 1B Instruct', description: 'Tiny instruction model for low-latency tasks.', tags: ['text-generation'] },
  { id: '@cf/black-forest-labs/flux-1-schnell', task: { id: 'text-to-image', name: 'Text-to-Image' }, name: 'FLUX.1 Schnell', description: 'Fast text-to-image generation.', tags: ['text-to-image'] },
  { id: '@cf/stabilityai/stable-diffusion-xl-base-1.0', task: { id: 'text-to-image', name: 'Text-to-Image' }, name: 'Stable Diffusion XL Base 1.0', description: 'Text-to-image diffusion model.', tags: ['text-to-image'] },
];

export async function onRequestGet(context) {
  const { env } = context;
  const accountId = env.CF_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;
  if (accountId && token) {
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search?per_page=1000`, {
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
      });
      const body = await r.json().catch(() => null);
      if (body && body.success) return json(body);
    } catch (e) {}
  }
  return json({ success: true, result: KNOWN, errors: [], messages: [], cached: true });
}
