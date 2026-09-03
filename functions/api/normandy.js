import { normandyMarkdown, readNormandyAssignment, reserveNormandyAssignment } from '../_lib/normandy_contract.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id = url.searchParams.get('assignment');
  // No id (or assignment=new/1) = the arrival path for a model: reserve one empty slot and hand
  // back the contribution contract, instead of leaving arriving models on prose with no intake.
  const assignment = (!id || id === 'new' || id === '1')
    ? await reserveNormandyAssignment(env, url.origin, request.headers.get('user-agent') || '')
    : await readNormandyAssignment(env, url.origin, id);
  if (!assignment) return json({ error: 'unknown assignment' }, 404);
  if (['markdown', 'md', 'text'].includes(String(url.searchParams.get('format') || '').toLowerCase())) {
    return new Response(normandyMarkdown(assignment), { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
  }
  return json(assignment);
}
