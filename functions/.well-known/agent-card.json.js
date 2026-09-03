// A2A-COMPATIBLE AGENT CARD (spec Phase 6) — a PROJECTION of the object registry, generated,
// never hand-maintained. Skills point at real skill objects and their evidence endpoints, not
// self-reported strings; the card is signed with the home ES256 key when one is configured.
// The custom /.well-known/agent.json remains for existing integrations; this is the
// ecosystem-standard door (A2A publishes cards at /.well-known/agent-card.json as of v1.0).
import { SKILL_REGISTRY } from '../_lib/skill_registry.js';
import { homePrivateJwk } from '../_lib/oip_federation.js';
import { publicJwkFromPrivate, canonicalJson } from '../_lib/oip_envelope.js';

function b64u(bytes) {
  let s = ''; const u = new Uint8Array(bytes);
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function onRequestGet({ env }) {
  const base = 'https://miscsubjects.com';
  const card = {
    protocolVersion: '1.0',
    name: 'miscsubjects',
    description: 'An execution environment that publishes proven work: governed work objects with infrastructure-run acceptance tests, hash-chained action logs, execution-evidence manifests with per-step raw payloads, reproductions, comparisons, and versioned skills whose promotion is earned by evidence.',
    url: base + '/api/dispatch',
    preferredTransport: 'HTTP+JSON',
    additionalInterfaces: [
      { transport: 'HTTP+JSON', url: base + '/api/dispatch' },
      { transport: 'MCP', url: base + '/api/mcp' },
    ],
    provider: { organization: 'miscsubjects.com', url: base },
    documentationUrl: base + '/llms.txt',
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true },
    securitySchemes: {
      boundedShareToken: {
        type: 'apiKey', in: 'query', name: 'share',
        description: 'Scoped, expiring, budgeted HMAC capability. Mint at ' + base + '/start; every use is receipted; delegation only narrows.',
      },
    },
    security: [{ boundedShareToken: [] }],
    defaultInputModes: ['application/json', 'text/plain'],
    defaultOutputModes: ['application/json'],
    // Skills are the REAL objects: each carries its live object URL and its evidence projection —
    // executions, acceptance outcomes, comparisons — not a self-description.
    skills: SKILL_REGISTRY.skills.map((s) => ({
      id: 'skill:' + s.name,
      name: s.name,
      description: s.description,
      tags: [s.family].filter(Boolean),
      inputModes: ['text/markdown'],
      outputModes: ['text/markdown'],
      // Non-standard but load-bearing extensions, namespaced:
      'x-miscsubjects': {
        object: base + '/api/skills/' + s.name,
        skill_md: base + '/api/skills/' + s.name + '/skill',
        evidence: base + '/api/skills/' + s.name + '/evidence',
      },
    })),
    'x-miscsubjects': {
      proven_work: base + '/api/proven-work',
      work_object: base + '/api/work/bootstrap',
      work_evidence: base + '/api/work-evidence',
      comparisons: base + '/api/comparisons',
      contributions: base + '/api/contributions',
      transparency_chain: base + '/api/chain',
      one_queue: base + '/api/queue',
    },
  };
  // Card signature: ES256 over the canonical card JSON, detached, our documented profile. A2A's
  // JWS profile can replace this at the interop boundary if a partner requires it.
  const jwk = homePrivateJwk(env);
  if (jwk) {
    try {
      const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
      const payload = canonicalJson(card);
      const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(payload));
      card.signatures = [{ protected: { alg: 'ES256', kid: 'oip-home', profile: 'msjc.card-sign.v1: ES256 over RFC8785-style canonical JSON of the card minus signatures' }, signature: b64u(sig), publicJwk: publicJwkFromPrivate(jwk) }];
    } catch {}
  }
  return new Response(JSON.stringify(card, null, 2), {
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' },
  });
}
