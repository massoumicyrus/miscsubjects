// Registry-coverage metric — the same honest-number pattern as /api/metrics/grounding,
// applied to the tool registry (owner order, audit 2026-07-24): publish schema/example/
// description coverage and the high-risk-without-schema count, in public, uncached-enough
// to move as the registry improves. If grounding.js is the anti-sealed-canon tripwire,
// this is the anti-guesswork tripwire — every gap here is a call shape a model has to guess.
export async function onRequestGet(context) {
  const { env } = context;
  const rows = (await env.DB.prepare(
    `SELECT key, enabled, sensitive, input_schema, examples, content FROM directory`,
  ).all()).results || [];
  const total = rows.length;
  const active = rows.filter((r) => Number(r.enabled ?? 1) === 1);
  const n = active.length;
  const missingDescription = active.filter((r) => !String(r.content || '').trim()).length;
  const missingSchema = active.filter((r) => !String(r.input_schema || '').trim()).length;
  const missingExamples = active.filter((r) => !String(r.examples || '').trim()).length;
  const highRisk = active.filter((r) => Number(r.sensitive));
  const highRiskMissingSchema = highRisk.filter((r) => !String(r.input_schema || '').trim()).length;
  const keyless = active.filter((r) => !String(r.auth || '').trim());
  const keylessMissingExamples = keyless.filter((r) => !String(r.examples || '').trim()).length;
  const pct = (m) => (n ? Math.round((1 - m / n) * 1000) / 10 : null);
  const body = {
    computed_at: new Date().toISOString(),
    objects_total: total,
    objects_active: n,
    coverage: {
      description_pct: pct(missingDescription),
      input_schema_pct: pct(missingSchema),
      examples_pct: pct(missingExamples),
    },
    gaps: {
      missing_description: missingDescription,
      missing_input_schema: missingSchema,
      missing_examples: missingExamples,
      high_risk_total: highRisk.length,
      high_risk_missing_schema: highRiskMissingSchema,
      keyless_total: keyless.length,
      keyless_missing_examples: keylessMissingExamples,
    },
    gate: {
      enforced_since: '2026-07-24',
      rule: 'PUT/PATCH /api/directory/<key> refuses a write that would newly introduce: sensitive=true with no input_schema, auth=none with no examples, or empty content. A row already non-compliant before this gate shipped can still be patched for unrelated fields — it is not retroactively bricked.',
      note: 'the gap counts above are the pre-gate backlog; the gate stops the backlog from growing, it does not shrink it by itself.',
    },
    method: 'active = enabled != 0; high_risk = sensitive column truthy; keyless = auth column empty. Same predicate the public registry (/api/dispatch?registry=1) and directoryRowToObject() use.',
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'access-control-allow-origin': '*',
    },
  });
}
