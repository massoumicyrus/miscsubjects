import { protocolLawManifest } from '../_lib/protocol_laws.js';

export function onRequestGet() {
  return new Response(JSON.stringify(protocolLawManifest(), null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60',
      'access-control-allow-origin': '*',
      'x-content-type-options': 'nosniff',
    },
  });
}
