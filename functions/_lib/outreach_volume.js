// Every outreach draft that still exists anywhere in the database, in one list, grouped by
// business, oldest-to-newest version, with a per-item KEEP / CHANGE / DELETE verdict the owner
// can set and that persists.
//
// Two sources of record, both real rows — nothing reconstructed:
//   1. leads.draft — the draft currently saved on each lead (one per lead; regenerating a lead's
//      draft overwrites this column, so only the latest survives here).
//   2. email_sends where kind='draft-review' — every draft that was ever mailed for review. This
//      is the only place earlier generations of a lead's copy still exist.

const VERDICTS = new Set(['keep', 'change', 'delete', '']);

export async function ensureVerdictTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS draft_verdicts (
       item_key TEXT PRIMARY KEY,
       verdict TEXT NOT NULL,
       note TEXT,
       updated_at TEXT NOT NULL
     )`
  ).run();
}

function parseLeadDraft(raw) {
  try {
    const d = JSON.parse(raw || '{}');
    return { subject: d.subject || '', body: d.body || '', model: d.model || '' };
  } catch {
    return { subject: '', body: String(raw || ''), model: '' };
  }
}

// Review emails carry "To:/Subject:/blank line/body" (current format) or
// "DRAFT for review — Name\nSubject: ...\n-----\nbody\n-----\ntrailer" (July 23 format).
function parseReviewEmail(raw) {
  const text = String(raw || '');
  const dashed = text.split('\n-----\n');
  if (dashed.length >= 2) {
    const head = dashed[0];
    const subject = (head.match(/^Subject:\s*(.*)$/m) || [])[1] || '';
    return { subject, body: dashed[1].trim() };
  }
  const subject = (text.match(/^Subject:\s*(.*)$/m) || [])[1] || '';
  const idx = text.indexOf('\n\n');
  return { subject, body: (idx >= 0 ? text.slice(idx + 2) : text).trim() };
}

function businessFromSubject(s) {
  const m = String(s || '').match(/^(?:Draft\s+\d+\/\d+|DRAFT review):\s*(.+)$/);
  return m ? m[1].trim() : '';
}

function normName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// A draft's "shape": what is left after the business-specific opener, the catalog block, every
// URL and every number are removed. Two drafts written under the same rules collapse to the same
// shape — that is what makes them read as the same email. Clustering on it turns 162 near-identical
// bodies into the handful of actual generations the copy has been through.
function shapeOf(body) {
  const lines = String(body || '').split('\n').map((s) => s.trim()).filter(Boolean)
    .filter((l) => !/^[-•*]/.test(l))
    .filter((l) => !/leoresearch\.com\/shop|miscsubjects\.com\/api\/t\//.test(l))
    .map((l) => l.replace(/https?:\/\/\S+/g, '').replace(/[0-9]+/g, '').toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((l) => l.split(' ').slice(0, 5).join(' '));
  const skeleton = [...new Set(lines.slice(1))].sort().join('|');
  let h = 5381;
  for (let i = 0; i < skeleton.length; i++) h = ((h * 33) ^ skeleton.charCodeAt(i)) >>> 0;
  return { hash: 'g' + h.toString(36), skeleton };
}

function clusterItems(groups) {
  const byHash = new Map();
  for (const g of groups) {
    for (const it of g.items) {
      const { hash } = shapeOf(it.body);
      it.shape = hash;
      if (!byHash.has(hash)) byHash.set(hash, { shape: hash, count: 0, first_ts: it.ts, last_ts: it.ts, items: [] });
      const c = byHash.get(hash);
      c.count++;
      c.items.push({ ...it, business: g.name, city: g.city || '', lead_id: g.lead_id });
      if (String(it.ts) && String(it.ts) < String(c.first_ts)) c.first_ts = it.ts;
      if (String(it.ts) > String(c.last_ts)) c.last_ts = it.ts;
    }
  }
  const clusters = [...byHash.values()];
  for (const c of clusters) {
    c.items.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
    c.exemplar = c.items[0];
    c.businesses = new Set(c.items.map((i) => i.business)).size;
    c.marked = c.items.filter((i) => i.verdict).length;
  }
  clusters.sort((a, b) => String(b.last_ts).localeCompare(String(a.last_ts)));
  clusters.forEach((c, i) => { c.label = 'Shape ' + (i + 1); });
  return clusters;
}

export async function loadVolume(env) {
  await ensureVerdictTable(env);

  const leads = (await env.DB.prepare(
    `SELECT id, name, segment, city, email, website, status, score, draft, created_at
       FROM leads WHERE draft IS NOT NULL AND draft <> '' ORDER BY id`
  ).all()).results || [];

  const reviews = (await env.DB.prepare(
    `SELECT id, lead_id, to_email, subject, body, sent_at
       FROM email_sends WHERE kind = 'draft-review' ORDER BY sent_at`
  ).all()).results || [];

  const verdictRows = (await env.DB.prepare(
    'SELECT item_key, verdict, note, updated_at FROM draft_verdicts'
  ).all()).results || [];
  const verdicts = new Map(verdictRows.map((v) => [v.item_key, v]));

  const groups = new Map();
  const byName = new Map();
  const groupFor = (id, name, meta) => {
    const key = id != null ? 'lead:' + id : 'name:' + normName(name);
    if (!groups.has(key)) {
      groups.set(key, { key, lead_id: id != null ? id : null, name: name || '(unknown business)', items: [], ...meta });
      if (name) byName.set(normName(name), key);
    } else if (meta) {
      Object.assign(groups.get(key), meta);
    }
    return groups.get(key);
  };

  for (const r of leads) {
    const d = parseLeadDraft(r.draft);
    const g = groupFor(r.id, r.name, {
      segment: r.segment, city: r.city, email: r.email, website: r.website,
      status: r.status, score: r.score,
    });
    const key = 'lead:' + r.id;
    g.items.push({
      key,
      source: 'live draft saved on the lead',
      ts: r.created_at || '',
      subject: d.subject,
      body: d.body,
      model: d.model,
      chars: (d.body || '').length,
      verdict: verdicts.get(key)?.verdict || '',
      note: verdicts.get(key)?.note || '',
    });
  }

  for (const s of reviews) {
    const parsed = parseReviewEmail(s.body);
    const bizName = businessFromSubject(s.subject);
    let gkey = s.lead_id != null ? 'lead:' + s.lead_id : byName.get(normName(bizName));
    let g;
    if (gkey && groups.has(gkey)) g = groups.get(gkey);
    else g = groupFor(s.lead_id, bizName || s.subject || '(unknown business)');
    const key = 'send:' + s.id;
    g.items.push({
      key,
      source: 'emailed to you for review',
      ts: s.sent_at || '',
      subject: parsed.subject,
      body: parsed.body,
      model: '',
      chars: (parsed.body || '').length,
      verdict: verdicts.get(key)?.verdict || '',
      note: verdicts.get(key)?.note || '',
    });
  }

  const list = [...groups.values()];
  for (const g of list) {
    g.items.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
    const n = g.items.length;
    g.items.forEach((it, i) => { it.version = n - i; it.of = n; });
    g.latest_ts = g.items[0]?.ts || '';
    g.versions = n;
  }
  list.sort((a, b) => (b.versions - a.versions) || String(b.latest_ts).localeCompare(String(a.latest_ts)));

  const total = list.reduce((n, g) => n + g.items.length, 0);
  const marked = list.reduce((n, g) => n + g.items.filter((i) => i.verdict).length, 0);
  return {
    generated_at: new Date().toISOString(),
    total_drafts: total,
    businesses: list.length,
    from_live_lead_rows: leads.length,
    from_review_emails: reviews.length,
    marked,
    groups: list,
  };
}

export async function setVerdict(env, itemKey, verdict, note) {
  await ensureVerdictTable(env);
  const v = String(verdict || '').toLowerCase();
  if (!VERDICTS.has(v)) return { ok: false, error: 'bad_verdict', allowed: [...VERDICTS] };
  if (!itemKey || !/^(lead|send):/.test(String(itemKey))) return { ok: false, error: 'bad_item_key' };
  const now = new Date().toISOString();
  if (!v && !note) {
    await env.DB.prepare('DELETE FROM draft_verdicts WHERE item_key = ?').bind(itemKey).run();
    return { ok: true, item_key: itemKey, verdict: '', note: '' };
  }
  await env.DB.prepare(
    `INSERT INTO draft_verdicts (item_key, verdict, note, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(item_key) DO UPDATE SET verdict = excluded.verdict, note = excluded.note, updated_at = excluded.updated_at`
  ).bind(itemKey, v, String(note || ''), now).run();
  return { ok: true, item_key: itemKey, verdict: v, note: String(note || ''), updated_at: now };
}
