#!/usr/bin/env node

const BASE = process.env.WORK_BASE || 'https://miscsubjects.com';
const KEY = process.env.TERMINAL_KEY || '';

const RECORDED_CEILING = Number(process.env.CLAIM_CEILING || 147);

const SQL = `SELECT COUNT(*) n FROM articles WHERE published=1
  AND length(COALESCE(body,'')) > 2400
  AND (COALESCE(meta,'') NOT LIKE '%"claims":[{%')`;

async function d1(sql, attempt = 0) {
  try {
    const r = await fetch(`${BASE}/api/dispatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-terminal-key': KEY },
      body: JSON.stringify({ key: 'D1_QUERY', body: sql }),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`dispatch HTTP ${r.status}: ${text.slice(0, 200)}`);
    let j = null;
    try { j = JSON.parse(text); } catch { throw new Error(`dispatch did not return JSON: ${text.slice(0, 200)}`); }
    const result = typeof j.result === 'string' ? JSON.parse(j.result) : j.result;
    if (!Array.isArray(result) || !result.length) throw new Error('dispatch returned no readable rows');
    return result;
  } catch (error) {
    if (attempt >= 4) throw error;
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    return d1(sql, attempt + 1);
  }
}

async function main() {
  if (!KEY) {
    console.error('CLAIM_LAW: no TERMINAL_KEY in this environment, so the corpus cannot be counted. This gate must run with the key — skipping is how 884 accumulated.');
    process.exit(1);
  }

  let rows;
  try { rows = await d1(SQL); } catch (e) {
    console.error('CLAIM_LAW: could not count the corpus —', e.message);
    process.exit(1);
  }
  const n = Number(rows?.[0]?.n);
  if (!Number.isFinite(n)) {
    console.error('CLAIM_LAW: the count query returned nothing readable. A gate that cannot measure the object has told you nothing.');
    process.exit(1);
  }

  // Prove the query discriminates. If it also matches articles that DO carry claims, the count is
  // meaningless and a green result would be an accident.
  const withClaims = Number((await d1(
    `SELECT COUNT(*) n FROM articles WHERE published=1 AND COALESCE(meta,'') LIKE '%"claims":[{%'`,
  ))?.[0]?.n);
  console.log(`CLAIM_LAW: ${withClaims} published articles carry claims, ${n} substantial ones do not (ceiling ${RECORDED_CEILING}).`);
  if (!Number.isFinite(withClaims) || withClaims === 0) {
    console.error('CLAIM_LAW: zero articles matched as carrying claims, which cannot be true. The needle no longer matches how claims are stored — fix the query, do not trust the pass.');
    process.exit(1);
  }

  if (n > RECORDED_CEILING) {
    console.error(`CLAIM_LAW FAILED — claim-less published articles rose from ${RECORDED_CEILING} to ${n}.`);
    console.error('An article without claims has no addressable DIVs, no proof-of-work object, no token-minting surface and nothing to challenge. Add claims to whatever shipped without them. Do not raise the ceiling.');
    process.exit(1);
  }
  if (n < RECORDED_CEILING) {
    console.log(`CLAIM_LAW: ${RECORDED_CEILING - n} repaired since the ceiling was recorded. Lower CLAIM_CEILING to ${n} in scripts/check-article-claims.mjs to lock the gain in.`);
  }
  console.log('CLAIM_LAW: the claim-less count has not risen.');
}

main().catch((e) => { console.error('CLAIM_LAW threw:', e); process.exit(1); });
