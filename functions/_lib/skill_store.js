
import { buildNowIso } from './build_time.js';
import { logEvent } from './event_log.js';

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The skill's stored head: object row + current version row, or null when unstored. */
export async function getSkillHead(env, name) {
  try {
    const obj = await env.DB.prepare('SELECT * FROM skill_objects WHERE name=?').bind(name).first();
    if (!obj) return null;
    const ver = await env.DB.prepare('SELECT * FROM skill_versions WHERE name=? AND version=?')
      .bind(name, obj.current_version).first();
    return { object: obj, version: ver || null };
  } catch {
    return null; // table not migrated yet — callers fall back to the generated registry
  }
}

export async function listSkillVersions(env, name) {
  try {
    const r = await env.DB.prepare(
      'SELECT version, content_hash, parent_version, change_reason, actor, ts FROM skill_versions WHERE name=? ORDER BY version ASC',
    ).bind(name).all();
    return r.results || [];
  } catch {
    return [];
  }
}

export async function getSkillVersion(env, name, version) {
  try {
    return await env.DB.prepare('SELECT * FROM skill_versions WHERE name=? AND version=?')
      .bind(name, Number(version)).first();
  } catch {
    return null;
  }
}

/**
 * Append a new version of a skill. The only write path (skill_versions is a governed table).
 *
 * CAS discipline copied from the article write path: when the skill already has versions, the
 * caller MUST present expected_hash = content_hash of the current version, or the append is
 * refused 428/409 — the same two-agent-overwrite failure the coding law exists to stop, applied
 * to methods. A first version needs no expected_hash.
 *
 * promote:false appends a CANDIDATE version without moving current_version. Promotion — moving
 * the pointer agents are handed — is a separate act with its own reason, because a proposed
 * method and an adopted method are different states (Phase 4 requires two passing runs between
 * them).
 */
export async function appendSkillVersion(env, name, {
  content, expected_hash, change_reason, formation, actor, fingerprint,
  family, license, source, promote = true,
} = {}) {
  if (!name || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(String(name))) {
    return { ok: false, status: 400, error: 'bad_skill_name', rule: 'lowercase letters, digits, hyphens' };
  }
  if (!content || !String(content).trim()) return { ok: false, status: 400, error: 'content_required' };
  if (!change_reason || !String(change_reason).trim()) {
    return { ok: false, status: 400, error: 'change_reason_required', why: 'A method revision with no stated reason cannot be reviewed, disputed, or learned from.' };
  }
  const now = buildNowIso();
  const contentHash = await sha256Hex(content);
  let head;
  try {
    head = await env.DB.prepare('SELECT * FROM skill_objects WHERE name=?').bind(name).first();
  } catch (e) {
    return { ok: false, status: 503, error: 'skill_store_unavailable', detail: 'skill tables not migrated: ' + String(e?.message || e) };
  }
  let version = 1;
  let parent = null;
  if (head) {
    const cur = await env.DB.prepare('SELECT version, content_hash FROM skill_versions WHERE name=? ORDER BY version DESC LIMIT 1')
      .bind(name).first();
    if (cur) {
      if (!expected_hash) {
        return {
          ok: false, status: 428, error: 'expected_hash_required',
          current_version: cur.version, current_hash: cur.content_hash,
          how_to_fix: 'GET /api/skills/' + name + ', take content_hash, resend with expected_hash.',
        };
      }
      if (String(expected_hash) !== String(cur.content_hash)) {
        return {
          ok: false, status: 409, error: 'hash_mismatch',
          your_base: String(expected_hash), current_hash: cur.content_hash, current_version: cur.version,
          how_to_fix: 'Another writer appended a version after you read. Re-read, redo your change on the new text, resend.',
        };
      }
      if (String(cur.content_hash) === contentHash) {
        return { ok: true, unchanged: true, name, version: cur.version, content_hash: contentHash };
      }
      version = Number(cur.version) + 1;
      parent = Number(cur.version);
    }
  }
  await env.DB.prepare(
    'INSERT INTO skill_versions (name,version,content,content_hash,parent_version,change_reason,formation_json,actor,fingerprint,ts) VALUES (?,?,?,?,?,?,?,?,?,?)',
  ).bind(
    name, version, String(content), contentHash, parent, String(change_reason),
    formation ? JSON.stringify(formation) : null, String(actor || 'build'), fingerprint || null, now,
  ).run();
  if (!head) {
    await env.DB.prepare(
      'INSERT INTO skill_objects (name,family,license,source,current_version,created_at) VALUES (?,?,?,?,?,?)',
    ).bind(name, family || null, license || null, source || null, version, now).run();
  } else if (promote) {
    await env.DB.prepare('UPDATE skill_objects SET current_version=? WHERE name=?').bind(version, name).run();
  }
  await logEvent(env, {
    source: 'skills', key: 'SKILL_VERSION_APPEND', action: promote ? 'append+promote' : 'append_candidate',
    route: '/api/skills/' + name + '/versions', direction: 'IN', actor: String(actor || 'build'),
    request: JSON.stringify({ name, version, content_hash: contentHash, change_reason, formation: formation || null }),
    response: 'ok',
  }).catch(() => {});
  return { ok: true, name, version, content_hash: contentHash, promoted: !head || promote, parent_version: parent };
}

export async function promoteSkillVersion(env, name, version, { actor, force = false, force_reason } = {}) {
  const v = await getSkillVersion(env, name, version);
  if (!v) return { ok: false, status: 404, error: 'version_not_found', name, version };
  const head = await env.DB.prepare('SELECT current_version FROM skill_objects WHERE name=?').bind(name).first();
  if (!head) return { ok: false, status: 404, error: 'skill_not_found', name };
  if (Number(head.current_version) === Number(version)) return { ok: true, unchanged: true, name, current_version: Number(version) };
  let evidence = { accepted_runs: 0, reproduction_runs: 0, tasks: [] };
  try {
    const needle = `"skill":"${name}"`;
    const vneedle = `"skill_version":${Number(version)}`;
    const rows = (await env.DB.prepare(
      `SELECT DISTINCT a.task_id, t.kind FROM work_actions a JOIN work_tasks t ON t.id = a.task_id
        WHERE a.result='accepted' AND (a.input LIKE ? OR a.evidence LIKE ?) AND (a.input LIKE ? OR a.evidence LIKE ?)`,
    ).bind(`%${needle}%`, `%${needle}%`, `%${vneedle}%`, `%${vneedle}%`).all()).results || [];
    evidence = {
      accepted_runs: rows.length,
      reproduction_runs: rows.filter((r) => r.kind === 'reproduction').length,
      tasks: rows.map((r) => r.task_id),
    };
  } catch {}
  const earned = evidence.accepted_runs >= 2 && evidence.reproduction_runs >= 1;
  if (!earned && !force) {
    return {
      ok: false, status: 412, error: 'promotion_not_earned',
      required: 'two infrastructure-accepted runs under this version, at least one a reproduction (POST /api/work/task/<id>/reproduce)',
      evidence,
      force: 'owner may pass force:true with force_reason — the force is recorded on the ledger',
    };
  }
  if (force && !earned && !String(force_reason || '').trim()) {
    return { ok: false, status: 400, error: 'force_reason_required', why: 'A promotion that skips the evidence rule must say why, on the record.' };
  }
  await env.DB.prepare('UPDATE skill_objects SET current_version=? WHERE name=?').bind(Number(version), name).run();
  await logEvent(env, {
    source: 'skills', key: 'SKILL_PROMOTE', action: earned ? 'promote_earned' : 'promote_forced',
    route: '/api/skills/' + name + '/promote', direction: 'IN', actor: String(actor || 'owner'),
    request: JSON.stringify({ name, version: Number(version), evidence, force: !earned, force_reason: force_reason || null }),
    response: 'ok',
  }).catch(() => {});
  return { ok: true, name, current_version: Number(version), basis: earned ? evidence : { forced: true, reason: String(force_reason || '') } };
}

/**
 * The evidence projection of one skill (Phase 1 ships the shape; Phases 2-4 fill it).
 * Everything here is computed from records — work_actions whose input/evidence JSON cites
 * {skill, skill_version, skill_hash}, plus version-pinned comments. No stored score exists.
 */
export async function skillEvidence(env, name) {
  const versions = await listSkillVersions(env, name);
  const out = { name, versions: [], comments_open: 0, note: 'Every row is computed from work_actions and skill_version_comments. No votes, no installs, no stored score.' };
  try {
    const c = await env.DB.prepare(
      "SELECT COUNT(*) n FROM skill_version_comments WHERE name=? AND status='open'",
    ).bind(name).first();
    out.comments_open = Number(c?.n || 0);
  } catch {}
  for (const v of versions) {
    let executions = 0, accepted = 0, refused = 0;
    try {
      // A work action executed under a skill carries {"skill":name,"skill_version":v} inside its
      // input or evidence JSON (the lease hands the pin out; the submit records it). LIKE over the
      // serialized JSON is deliberate: no new columns, no chain change, historical rows unaffected.
      const needle = `"skill":"${name}"`;
      const vneedle = `"skill_version":${v.version}`;
      const r = await env.DB.prepare(
        `SELECT action, result FROM work_actions WHERE (input LIKE ? OR evidence LIKE ?) AND (input LIKE ? OR evidence LIKE ?)`,
      ).bind(`%${needle}%`, `%${needle}%`, `%${vneedle}%`, `%${vneedle}%`).all();
      for (const row of r.results || []) {
        executions += 1;
        if (row.result === 'accepted') accepted += 1;
        if (row.result === 'refused') refused += 1;
      }
    } catch {}
    // Comparisons that put this exact version on either side of an experiment — how a method
    // claim gets a grade above OUTCOME_OBSERVED. The ref vocabulary is 'skill:<name>@<version>'.
    let comparisons = [];
    try {
      const ref = `skill:${name}@${v.version}`;
      const r = await env.DB.prepare(
        'SELECT id, metric, design, delta, replicates, superseded_by, created_at FROM comparisons WHERE (baseline_ref=? OR variant_ref=?) ORDER BY created_at DESC LIMIT 20',
      ).bind(ref, ref).all();
      comparisons = (r.results || []).map((c) => ({
        id: c.id, metric: c.metric, design: c.design, delta: c.delta,
        superseded_by: c.superseded_by || null, url: '/api/comparisons/' + c.id,
      }));
    } catch {}
    out.versions.push({
      version: v.version, content_hash: v.content_hash, parent_version: v.parent_version,
      change_reason: v.change_reason, ts: v.ts,
      executions, accepted, refused,
      comparisons,
    });
  }
  return out;
}
