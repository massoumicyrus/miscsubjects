import {
  appendGovernanceRecord,
  getGovernanceRecord,
  governanceManifest,
} from '../../_lib/oip_governance.js';
import { isBuildAuthed, tokenAllowsKey, verifyShareTokenValue } from '../../_lib/admin_session.js';
import {
  appendDecision,
  appendReview,
  appendStateCard,
  appendStandard,
  certifierHistory,
  computeSurety,
  getDecision,
  getStateCard,
  getStandard,
  listDecisions,
  listReviews,
  listStandards,
  modelGovernanceManifest,
  revokeStateCard,
} from '../../_lib/model_governance.js';
import {
  appendCitationValidation,
  getCitationValidation,
  listCitationValidations,
  resolveGate,
  getGateResolution,
  oracleConformance,
} from '../../_lib/compliance_oracle.js';

const json = (value, status = 200) => new Response(JSON.stringify(value, null, 2), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'x-content-type-options': 'nosniff',
  },
});

async function rateGate(env, request) {
  if (!env.KV) return true;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const ipHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 20);
  const hour = new Date().toISOString().slice(0, 13);
  const key = `governance-rate:${hour}:${ipHash}`;
  const count = Number(await env.KV.get(key) || 0);
  if (count >= 5) return false;
  await env.KV.put(key, String(count + 1), { expirationTtl: 7200 });
  return true;
}

async function rowAuthed(request, env, keys) {
  if (await isBuildAuthed(request, env)) return true;
  const raw = (request.headers.get('authorization') || '').replace(/^bearer\s+/i, '').trim();
  if (!raw) return false;
  const token = await verifyShareTokenValue(env, raw);
  return !!token && keys.some((key) => tokenAllowsKey(token, key));
}

export async function onRequestGet({ env, params, request }) {
  const parts = Array.isArray(params.path) ? params.path : String(params.path || '').split('/').filter(Boolean);
  if (!parts.length || parts[0] === 'facets' || parts[0] === 'schema') return json(await governanceManifest(env));
  if (parts[0] === 'model') return json(modelGovernanceManifest);
  if (parts[0] === 'standards') {
    if (parts[1]) {
      const standard = await getStandard(env, parts[1]);
      return standard ? json({ protocol: 'OIP', kind: 'standard', standard }) : json({ error: 'not_found' }, 404);
    }
    return json(await listStandards(env));
  }
  if (parts[0] === 'decisions') {
    if (parts[1]) {
      const decision = await getDecision(env, parts[1]);
      if (!decision) return json({ error: 'not_found' }, 404);
      return json({ protocol: 'OIP', kind: 'decision_record', decision, reviews: await listReviews(env, decision.id), surety: await computeSurety(env, decision.id), citation_validations: await listCitationValidations(env, decision.id) });
    }
    return json(await listDecisions(env, new URL(request.url).searchParams.get('standard_id')));
  }
  if (parts[0] === 'citation-validation' && parts[1]) {
    const validation = await getCitationValidation(env, parts[1]);
    return validation ? json({ protocol: 'OIP', kind: 'citation_validation', citation_validation: validation }) : json({ error: 'not_found' }, 404);
  }
  if (parts[0] === 'citation-validations') {
    const decisionId = new URL(request.url).searchParams.get('decision_id');
    if (!decisionId) return json({ error: 'decision_id query parameter required' }, 400);
    return json({ protocol: 'OIP', kind: 'citation_validations', decision_id: decisionId, validations: await listCitationValidations(env, decisionId) });
  }
  if (parts[0] === 'gate' && parts[1]) {
    const resolution = await getGateResolution(env, parts[1]);
    return resolution ? json(resolution) : json({ error: 'not_found' }, 404);
  }
  if (parts[0] === 'oracle' && parts[1] === 'conformance') {
    return json(await oracleConformance(env));
  }
  if (parts[0] === 'surety' && parts[1]) {
    const result = await computeSurety(env, parts[1]);
    return json(result, result.status === 404 ? 404 : 200);
  }
  if (parts[0] === 'cards' && parts[1]) {
    const card = await getStateCard(env, parts[1]);
    return card ? json({ protocol: 'OIP', kind: 'bounded_state_card', card }) : json({ error: 'not_found' }, 404);
  }
  if (parts[0] === 'certifiers' && parts[1]) {
    const result = await certifierHistory(env, decodeURIComponent(parts.slice(1).join('/')));
    return json(result, result.status || 200);
  }
  if (parts[0] === 'record' && parts[1]) {
    const record = await getGovernanceRecord(env, parts[1]);
    return record ? json({ protocol: 'OIP', kind: 'governance_record', record }) : json({ error: 'not_found' }, 404);
  }
  return json({ error: 'not_found' }, 404);
}

export async function onRequestPost({ env, request, params }) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 16384) return json({ error: 'payload_too_large' }, 413);
  const parts = Array.isArray(params.path) ? params.path : String(params.path || '').split('/').filter(Boolean);
  if (parts[0] === 'citation-validation') {
    if (!(await rowAuthed(request, env, ['CITATION_VALIDATION']))) return json({ error: 'scope_required', required_rows: ['CITATION_VALIDATION'] }, 403);
    let cvBody; try { cvBody = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
    const result = await appendCitationValidation(env, cvBody);
    return json(result, Number.isInteger(result.status) ? result.status : (result.error ? 400 : 201));
  }
  if (parts[0] === 'gate') {
    if (!(await rowAuthed(request, env, ['COMPLIANCE_GATE']))) return json({ error: 'scope_required', required_rows: ['COMPLIANCE_GATE'] }, 403);
    let gateBody; try { gateBody = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
    const actor = gateBody?.actor ? String(gateBody.actor).slice(0, 200) : 'gate-caller';
    const result = await resolveGate(env, gateBody, actor);
    return json(result, Number.isInteger(result.status) ? result.status : (result.error ? 400 : 201));
  }
  const protectedRowPath = ['standards', 'decisions', 'reviews', 'surety', 'cards', 'certifiers'].includes(parts[0]);
  if (!protectedRowPath && !await rateGate(env, request)) return json({ error: 'rate_limited', retry: 'next UTC hour' }, 429);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (['standards', 'decisions', 'reviews', 'surety', 'cards', 'certifiers'].includes(parts[0])) {
    const needed = parts[0] === 'standards' ? ['STANDARD_REGISTER']
      : parts[0] === 'decisions' ? ['DECISION_RECORD']
        : parts[0] === 'reviews' ? ['REVIEW_RECORD']
          : parts[0] === 'surety' ? ['SURETY_RECORD']
            : parts[0] === 'certifiers' ? ['CERTIFIER_HISTORY']
              : parts[1] === 'revoke' ? ['STATE_CARD_REVOKE'] : ['STATE_CARD_CERTIFY'];
    if (!(await rowAuthed(request, env, needed))) return json({ error: 'scope_required', required_rows: needed }, 403);
    let result;
    if (parts[0] === 'standards') result = await appendStandard(env, body);
    else if (parts[0] === 'decisions') result = await appendDecision(env, body);
    else if (parts[0] === 'reviews') result = await appendReview(env, body);
    else if (parts[0] === 'surety') result = await computeSurety(env, body?.decision_id);
    else if (parts[0] === 'certifiers') result = await certifierHistory(env, body?.certifier_label);
    else if (parts[1] === 'revoke') result = await revokeStateCard(env, body);
    else result = await appendStateCard(env, body);
    const transportStatus = Number.isInteger(result.status) ? result.status : (result.ok === false || result.error ? 400 : 201);
    return json(result, transportStatus);
  }
  const result = await appendGovernanceRecord(env, body, { actor: body?.actor_label || 'public-governance', ownerAuthed: false });
  return json(result, result.status || (result.ok ? 201 : 400));
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,x-terminal-key,authorization',
      'access-control-max-age': '86400',
    },
  });
}
