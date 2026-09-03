import { logEvent } from '../_lib/event_log.js';

const DEFAULT_AUDIT_PROMPT = `You are an audit gate for runtime content changes. You receive a CURRENT value and a PROPOSED value plus optional context. Output strict JSON only, no prose. Shape: {"verdict":"approve"|"reject"|"review","reasons":[string],"diff_summary":string}. approve = safe, on-spec, no regressions. reject = breaks contract, leaks secrets, or contradicts the stated context. review = ambiguous, needs human. Be literal. Do not paraphrase. Do not add fields.`;

async function readSetting(env, key) {
  if (env.KV) {
    const v = await env.KV.get(key);
    if (v !== null && v !== undefined) return v;
  }
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return row?.value ?? null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.GROK_API_KEY) {
    return json({ error: 'GROK_API_KEY secret not set' }, 500);
  }

  let body;
  try { body = await request.json(); } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const { current, proposed, context: ctx, target } = body || {};
  if (current === undefined && proposed === undefined) {
    return json({ error: 'current or proposed required' }, 400);
  }

  const auditPrompt = (await readSetting(env, 'grok_audit_prompt')) || DEFAULT_AUDIT_PROMPT;
  const model = (await readSetting(env, 'grok_audit_model')) || (await readSetting(env, 'grok_model')) || 'grok-4.3';

  const userMessage = JSON.stringify({
    target: target ?? null,
    context: ctx ?? null,
    current: current ?? null,
    proposed: proposed ?? null,
  });

  const grokBody = {
    model,
    messages: [
      { role: 'system', content: auditPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
  };
  const grokRequest = {
    url: 'https://api.x.ai/v1/chat/completions',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <REDACTED>' },
    body: grokBody,
  };

  let responseText = '';
  let parsedVerdict = null;
  try {
    const r = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.GROK_API_KEY}` },
      body: JSON.stringify(grokBody),
    });
    responseText = await r.text();
    try {
      const j = JSON.parse(responseText);
      const content = j?.choices?.[0]?.message?.content;
      if (content) parsedVerdict = JSON.parse(content);
    } catch {}
  } catch (e) {
    responseText = String(e);
  }

  const auditTs = new Date().toISOString();
  // Single ledger: every payload in/out goes to events (LEDGER). The grok_ledger
  // table was removed (migration 0079) — this is the only sink now.
  await logEvent(env, {
    ts: auditTs,
    source: 'grok',
    key: 'GROK_AUDIT',
    action: 'audit',
    direction: 'OUT',
    route: '/grok/audit',
    request: grokRequest,
    response: responseText,
  });

  return json({
    verdict: parsedVerdict,
    raw_response: responseText,
  });
}
