import { publicSecret404, publicSecretFinding } from '../_lib/public_secret_guard.js';

const SAFE_PATH = /^[a-z0-9][a-z0-9._\/-]{0,500}$/i;

function pathOf(params) {
  const raw = Array.isArray(params?.path) ? params.path.join('/') : String(params?.path || '');
  return raw.replace(/^\/+/, '');
}

export async function onRequestGet({ env, params }) {
  if (!env.R2) return new Response('not found', { status: 404 });
  const path = pathOf(params);
  if (!path || !SAFE_PATH.test(path) || path.includes('..')) return new Response('not found', { status: 404 });
  const object = await env.R2.get('disclosures/' + path);
  if (!object) return new Response('not found', { status: 404 });
  const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
  // Text disclosures get one final defense-in-depth scan. Binary artifacts are published
  // only after local render/hash/credential QA and are immutable by versioned key.
  if (/^(?:text\/|application\/(?:json|xml))/i.test(contentType)) {
    const text = await object.text();
    if (publicSecretFinding(text, env)) return publicSecret404();
    return new Response(text, { headers: disclosureHeaders(contentType, object.httpEtag) });
  }
  return new Response(object.body, { headers: disclosureHeaders(contentType, object.httpEtag) });
}

function disclosureHeaders(contentType, etag) {
  const headers = new Headers({
    'content-type': contentType,
    'cache-control': 'public, max-age=31536000, immutable',
    'access-control-allow-origin': '*',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; sandbox",
  });
  if (etag) headers.set('etag', etag);
  return headers;
}
