// CANONICAL RESOLUTION — one decision per firm (Table Web cold audit, WT-0090).
//
// Discovery ran ~70 queries; the same firm surfaced by many of them, so the raw table held the
// identical organization included in one row and excluded in another, and a garbage email under a
// non-existent TLD stamped "verified_public". Three defects, one shared cause: the passes were never
// reconciled against each other. This resolves them deterministically without deleting the raw
// history (every discovery decision stays; the losers are marked canonical=0):
//
//   1. Group rows into firms by union-find: two rows are the same firm if they share a registrable
//      domain OR a normalized name. (Domain alone missed "Intel Capital" across domain variants;
//      name alone missed "GV" vs "Google Ventures" under the same gv.com.)
//   2. Per firm, an inclusion is valid only when its qualifying quote is on the firm's OWN site
//      (registrable(source) === registrable(official)) — the same bar exclusions already meet.
//   3. The canonical row is the best valid inclusion (prefer one with a syntactically valid public
//      contact, then the longest quote); if none, the firm is excluded, with a reason that says so.
//   4. verified_public requires a contact whose TLD actually exists (isPlausiblePublicEmail); an
//      included firm whose only address is garbage is contact_invalid, never verified.
//
// planResolution is pure and tested; resolveCanonical drives it against D1 so the endpoint and any
// re-run reproduce the exact same assignment from the raw rows.
import { isPlausiblePublicEmail, registrableDomain } from './valid_tld.js';

const THIRD_PARTY = /(?:^|\.)(linkedin\.com|crunchbase\.com|wikipedia\.org|facebook\.com|x\.com|twitter\.com)$/i;

export function normName(name) {
  return String(name || '')
    .replace(/\(.*?\)/g, ' ')
    .toLowerCase()
    .replace(/^\s*the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function thirdParty(url) {
  try { return THIRD_PARTY.test(new URL(url).hostname); } catch { return false; }
}

function effIncludable(r) {
  if (r.decision !== 'included') return false;
  if (!r.official_url || !r.source_url) return false;
  if (thirdParty(r.official_url) || thirdParty(r.source_url)) return false;
  const ql = r.ql != null ? Number(r.ql) : String(r.source_quote || '').length;
  if (ql < 40) return false;
  return registrableDomain(r.source_url) === registrableDomain(r.official_url);
}

const OWN_SITE_REASON = 'Excluded because no qualifying quote was found on the organization’s own official website across discovery; the only supporting sources were third-party. Inclusions are held to the same own-site bar as exclusions.';
const SUPERSEDED_REASON = 'Superseded by the canonical decision for this organization (deduped by firm; the raw discovery decision is preserved here).';

/** Pure resolver. Input: raw candidate rows (need candidate_id, organization_name, official_url,
 *  source_url, decision, contact_email, and ql or source_quote). Output: one assignment per row. */
export function planResolution(rows) {
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let r = x;
    while (parent.get(r) !== r) { parent.set(r, parent.get(parent.get(r))); r = parent.get(r); }
    return r;
  };
  const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const r of rows) {
    find(r.candidate_id);
    const dom = r.official_url ? registrableDomain(r.official_url) : '';
    const nm = normName(r.organization_name);
    if (dom) union(r.candidate_id, 'dom:' + dom);
    if (nm) union(r.candidate_id, 'nm:' + nm);
  }
  const groups = new Map();
  for (const r of rows) {
    const g = find(r.candidate_id);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  }
  const assignments = [];
  for (const g of groups.values()) {
    const winners = g.filter(effIncludable);
    let canon;
    let canonDecision;
    let canonReason = null;
    if (winners.length) {
      canon = winners.reduce((best, r) => {
        const rv = isPlausiblePublicEmail(r.contact_email) ? 1 : 0;
        const bv = isPlausiblePublicEmail(best.contact_email) ? 1 : 0;
        const rq = r.ql != null ? Number(r.ql) : String(r.source_quote || '').length;
        const bq = best.ql != null ? Number(best.ql) : String(best.source_quote || '').length;
        if (rv !== bv) return rv > bv ? r : best;
        if (rq !== bq) return rq > bq ? r : best;
        return r.candidate_id < best.candidate_id ? r : best;
      });
      canonDecision = 'included';
    } else {
      canon = g.slice().sort((a, b) => {
        const ao = a.official_url ? 0 : 1; const bo = b.official_url ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return a.candidate_id < b.candidate_id ? -1 : 1;
      })[0];
      canonDecision = 'excluded';
      if (canon.decision === 'included') canonReason = OWN_SITE_REASON; // was a loose inclusion; flip with reason
    }
    for (const r of g) {
      if (r.candidate_id === canon.candidate_id) {
        let contactStatus;
        let contactValid = null;
        if (canonDecision === 'included') {
          if (isPlausiblePublicEmail(r.contact_email)) { contactStatus = 'verified_public'; contactValid = 1; }
          else if (r.contact_email) { contactStatus = 'contact_invalid'; contactValid = 0; }
          else contactStatus = 'pending';
        } else {
          contactStatus = 'not_sought';
          if (r.contact_email) contactValid = isPlausiblePublicEmail(r.contact_email) ? 1 : 0;
        }
        assignments.push({
          candidate_id: r.candidate_id, canonical: 1, decision: canonDecision,
          decision_reason: canonReason, contact_status: contactStatus, contact_valid: contactValid,
          superseded_reason: null,
        });
      } else {
        assignments.push({
          candidate_id: r.candidate_id, canonical: 0, decision: null,
          decision_reason: null, contact_status: 'superseded', contact_valid: null,
          superseded_reason: SUPERSEDED_REASON,
        });
      }
    }
  }
  const canonRows = assignments.filter((a) => a.canonical);
  return {
    assignments,
    summary: {
      firms: canonRows.length,
      included: canonRows.filter((a) => a.decision === 'included').length,
      excluded: canonRows.filter((a) => a.decision === 'excluded').length,
      verified_public: canonRows.filter((a) => a.contact_status === 'verified_public').length,
      contact_invalid: canonRows.filter((a) => a.contact_status === 'contact_invalid').length,
      superseded_duplicates: assignments.length - canonRows.length,
      raw_decisions: assignments.length,
    },
  };
}

/** Drive the pure plan against D1: read every raw row for the task, compute the assignment, and
 *  write it back in batches. Idempotent — running it twice yields the same canonical set. */
export async function resolveCanonical(env, taskId) {
  if (!/^WT-\d{4}$/.test(String(taskId || ''))) return { error: 'task_id_required' };
  const res = await env.DB.prepare(
    'SELECT candidate_id, organization_name, official_url, source_url, length(source_quote) ql, decision, contact_email FROM execution_case_candidates WHERE task_id=?',
  ).bind(taskId).all();
  const rows = res.results || [];
  if (!rows.length) return { error: 'no_rows', task_id: taskId };
  const { assignments, summary } = planResolution(rows);
  const now = new Date().toISOString();
  let written = 0;
  for (const a of assignments) {
    await env.DB.prepare(
      `UPDATE execution_case_candidates SET
         canonical=?, contact_status=?, contact_valid=?, superseded_reason=?,
         decision=COALESCE(?, decision), decision_reason=COALESCE(?, decision_reason), updated_at=?
       WHERE task_id=? AND candidate_id=?`,
    ).bind(
      a.canonical, a.contact_status, a.contact_valid, a.superseded_reason,
      a.decision, a.decision_reason, now, taskId, a.candidate_id,
    ).run();
    written += 1;
  }
  return { ok: true, task_id: taskId, written, summary };
}
