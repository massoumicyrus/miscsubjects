function redactText(value) {
  const s = String(value);
  return s
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    // Phone redaction must never fire inside a hex digest: a digit run flanked by hex
    // characters is evidence, not a phone number. A field audit (2026-08-03) caught this
    // regex eating the middle of a sealing SHA-256 — the one value that pins the question.
    .replace(/\+?1?[\s().-]*\d{3}[\s().-]*\d{3}[\s.-]*\d{4}/g, (m, offset, str) => {
      const before = str.slice(Math.max(0, offset - 8), offset);
      const after = str.slice(offset + m.length, offset + m.length + 8);
      if (/[0-9a-f]{4}$/i.test(before) || /^[0-9a-f]{4}/i.test(after)) return m;
      return '[redacted-phone]';
    })
    .replace(/\/Users\/[^/\s"']+/g, '/Users/[redacted]')
    .replace(/((?:authorization)["']?\s*[:=]\s*["']?)(?:Bearer\s+)?([^"',\s}\]]+)/gi, '$1[redacted-secret]')
    .replace(/((?:x-terminal-key)["']?\s*[:=]\s*["']?)([^"',\s}\]]+)/gi, '$1[redacted-secret]')
    .replace(/((?:TERMINAL_KEY|API_KEY|TOKEN|SECRET)\s*=\s*["']?)([^"'\s,;}]+)/g, '$1[redacted-secret]');
}

export function redactProvenWorkValue(value) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactProvenWorkValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactProvenWorkValue(item)]));
  }
  return value;
}

function evaluate(requirements) {
  const rows = Array.isArray(requirements) ? requirements : [];
  const unresolved = rows.filter((row) => String(row?.status || '').toUpperCase() !== 'PASS').map((row) => String(row?.id || 'unnamed'));
  return {
    status: rows.length > 0 && unresolved.length === 0 ? 'PROVEN' : 'PARTIAL',
    declared_requirements: rows.length,
    passed: rows.length - unresolved.length,
    unresolved,
  };
}

export function buildProvenWorkProjection({ slug, manifest, formationRecords = [] }) {
  const cleanManifest = redactProvenWorkValue(manifest || {});
  return {
    _self: {
      schema: 'oip/proven-work-projection/1',
      what: 'One redacted ledger slice for one completed work object.',
      how_to_use: 'Open the manifest and formation records from zero context. Every conclusion resolves to SUPPORTED_BY_RECORD, MISSING_EVIDENCE, or CONTRADICTED_BY_RECORD with cited record ids.',
      privacy: 'Personal information, credentials, private paths and unrelated work are removed at egress.',
    },
    object: 'article:' + String(slug || ''),
    work_id: cleanManifest.work_id || null,
    evaluation: evaluate(cleanManifest.requirements),
    manifest: cleanManifest,
    formation_records: redactProvenWorkValue(formationRecords),
    response_contract: {
      allowed_verdicts: ['SUPPORTED_BY_RECORD', 'MISSING_EVIDENCE', 'CONTRADICTED_BY_RECORD'],
      citation_rule: 'Each verdict names the manifest requirement and the exact formation record, receipt or public representation that supports it.',
      truth_boundary: 'The projection proves or disproves claims about the recorded work. It makes no claim of universal truth.',
    },
  };
}

export function formatProvenWorkDrop({ slug, workId, status, minted }) {
  const proofUrl = `https://miscsubjects.com/api/proven-work/${slug}`;
  return [
    '[PROVEN_WORK_DROP]',
    `work_id: ${workId || 'undeclared'}`,
    `article: https://miscsubjects.com/a/${slug}`,
    `recorded_status: ${status || 'UNPROVEN'}`,
    `fixed_to: GET ${proofUrl}`,
    `scope: ${minted.scope}`,
    `uses: ${minted.max_uses}`,
    `expires_at: ${minted.expires_at}`,
    `fingerprint: ${minted.fingerprint}`,
    `token: ${minted.share_token}`,
    `inspect: ${minted.invoke_url}`,
    `contract: ${minted.explain_url}`,
    'receipt_rule: each inspection returns its own proof.public_receipt, invocation.id and invocation.links.receipt',
    '',
    'Instruction to the receiving model:',
    'Open inspect. Preserve the invocation.id and proof.public_receipt returned by that inspection. Reconstruct the work from the returned manifest, formation records, public representations and declared gaps. Test the claim or question I give you against that record. For each conclusion return exactly one of SUPPORTED_BY_RECORD, MISSING_EVIDENCE, or CONTRADICTED_BY_RECORD, followed by the exact record ids or URLs that justify it. Do not infer unrecorded considerations. Do not treat the recorded status as your verdict.',
    '[/PROVEN_WORK_DROP]',
  ].join('\n');
}
