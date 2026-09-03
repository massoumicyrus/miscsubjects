import { buildCapabilityAtlas } from '../_lib/capability_atlas.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const summaryOnly = url.searchParams.get('summary') === '1';
  const atlas = await buildCapabilityAtlas(context.env, context.request.url, { includeCapabilities: !summaryOnly });
  return new Response(JSON.stringify(atlas, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}
