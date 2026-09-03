export function registryHygieneViolation({ sensitive, auth, input_schema, examples, content }) {
  if (!String(content || '').trim()) {
    return {
      code: 'missing_description',
      fix: 'content (the docstring: # WHAT / # ARGS / # EX) is required — a tool a model cannot understand is not a capability.',
    };
  }
  if (Number(sensitive) && !String(input_schema || '').trim()) {
    return {
      code: 'high_risk_missing_schema',
      fix: 'sensitive:true (risk:high) objects require input_schema — a model must not have to guess the call shape for a high-risk action.',
    };
  }
  if (!String(auth || '').trim() && !String(examples || '').trim()) {
    return {
      code: 'keyless_missing_examples',
      fix: 'auth:none objects require at least one example — these are the ones strangers will call.',
    };
  }
  return null;
}
