import { buildHomeWellKnown } from '../_lib/oip_federation.js';

export async function onRequestGet({ env }) {
  const doc = buildHomeWellKnown(env);
  if (!doc.agents.length) {
    return new Response(JSON.stringify({ error: 'home_signing_key_missing' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify(doc, null, 2), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}
