import { isBuildAuthed } from '../_lib/admin_session.js';
import { logEvent } from '../_lib/event_log.js';

const SHEET_ID = '<GOOGLE_SHEET_ID>';
const AIRUNNER = 'https://script.google.com/macros/s/AKfycbx64cVuTOzsWYINX7nlpsflogkubaVmH_0sXhVGJQc2hhnJRJvRb-VaMWTPQnMVBfBcmg/exec';

const TAB_LEADS = 'Leads';
const TAB_ARTICLES = 'ARTICLES';
const TAB_MODELS = 'MODEL_LAB';
const ALLOWED_TABS = [TAB_LEADS, TAB_ARTICLES, TAB_MODELS];
const KEEP_TABS = ['OUTREACH', 'REPLIES', 'MODEL_FIELDS', 'EXPLAIN'];

const CELL = 45000;        // per-cell body slice; Sheets hard limit is 50,000
const BODY_PARTS = 20;     // 20 x 45,000 = 900,000 chars, above the longest article
const ARTICLE_ROWS = 60;   // newest N articles, whole bodies included

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function gas(action, args) {
  const r = await fetch(AIRUNNER, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, args }), redirect: 'follow',
  });
  const text = await r.text();
  try { return JSON.parse(text); }
  catch { return { ok: false, error: 'gas_unparseable', status: r.status, body: text.slice(0, 200) }; }
}

async function all(env, sql) {
  return (await env.DB.prepare(sql).all()).results || [];
}

/** Split a long string across a fixed number of cells. */
function parts(text, n = BODY_PARTS) {
  const s = String(text == null ? '' : text);
  const out = [];
  for (let i = 0; i < n; i++) out.push(s.slice(i * CELL, (i + 1) * CELL));
  return out;
}

function joinParts(row, startIndex, n = BODY_PARTS) {
  let s = '';
  for (let i = 0; i < n; i++) s += String(row[startIndex + i] == null ? '' : row[startIndex + i]);
  return s;
}

const LEADS_HEADERS = [
  'A: type APPROVE or REJECT (text; APPROVE sends this exact letter, REJECT suppresses the address)',
  'result (written by the build)',
  'status (text: new | enriched | drafted | sent | replied | rejected)',
  'fit score (number 0-100; the send gate needs 65+)',
  'business', 'city', 'email', 'phone', 'segment',
  'why this one was picked',
  'subject line', 'the letter',
  'replies received (number)', 'last reply',
  'notes (mx:ok required to send)', 'lead id (number)',
];

async function syncLeads(env) {
  const rows = await all(env,
    `SELECT l.id, l.status, l.score, l.name, l.city, l.email, l.phone, l.segment,
            COALESCE(l.context,'') ctx, COALESCE(l.draft,'') draft, COALESCE(l.notes,'') notes,
            (SELECT COUNT(*) FROM lead_replies r WHERE r.lead_id = l.id AND r.kind='reply') reply_n,
            (SELECT r2.reply_text FROM lead_replies r2 WHERE r2.lead_id = l.id ORDER BY r2.id DESC LIMIT 1) last_reply
       FROM leads l
      WHERE l.status IN ('replied','sent','drafted','enriched','rejected')
      ORDER BY CASE l.status WHEN 'replied' THEN 0 WHEN 'sent' THEN 1 WHEN 'drafted' THEN 2
                             WHEN 'rejected' THEN 3 ELSE 4 END, l.score DESC, l.id DESC
      LIMIT 400`);
  const out = rows.map((l) => {
    let subject = '', letter = String(l.draft || '');
    if (letter.startsWith('{')) {
      try { const d = JSON.parse(letter); subject = String(d.subject || ''); letter = String(d.body || ''); }
      catch { /* shown raw rather than hidden */ }
    }
    return [
      '', '', l.status || '', l.score || 0, l.name || '', l.city || '', l.email || '', l.phone || '',
      l.segment || '', String(l.ctx).slice(0, CELL), subject.slice(0, CELL), letter.slice(0, CELL),
      l.reply_n || 0, String(l.last_reply || '').slice(0, CELL), String(l.notes).slice(0, CELL),
      String(l.id || ''),
    ];
  });
  const res = await gas('sheets_replace_tab', { sheet_id: SHEET_ID, tab: TAB_LEADS, headers: LEADS_HEADERS, rows: out });
  return { rows: out.length, gas: res.ok === true ? 'ok' : res };
}

// -------------------------------------------------------------------- ARTICLES
// Everything the article object holds, in one row, all of it writable. Widgets and every other
// meta field travel as the meta JSON column: that is the actual storage shape, so editing it here
// is editing the article, not a projection of it.
const ARTICLE_HEADERS = [
  'A: type SAVE to write this row back, or PULL to refetch it (text)',
  'result (written by the build)',
  'slug (text; the address /<slug> — changing it creates a new article)',
  'title (text)',
  'subject (text; the register/section this belongs to)',
  'published (number 0 or 1)',
  'updated (read only)',
  'body chars (read only)',
  'live url (read only)',
  'widgets in body (read only count)',
  'meta JSON (text; claims, widgets, sources, slots — the whole meta object, valid JSON only)',
  ...Array.from({ length: BODY_PARTS }, (_, i) => `body_${i + 1} (text; 45,000 chars max per cell — parts are joined in order on SAVE)`),
];

async function syncArticles(env, limit) {
  const n = Math.min(Number(limit) || ARTICLE_ROWS, 200);
  const rows = await all(env,
    `SELECT slug, title, COALESCE(subject,'') subject, COALESCE(published,0) published,
            updated_at, COALESCE(meta,'') meta, COALESCE(body,'') body
       FROM articles ORDER BY updated_at DESC LIMIT ${n}`);
  const out = rows.map((a) => {
    const body = String(a.body || '');
    return [
      '', '', a.slug || '', a.title || '', a.subject || '', a.published ? 1 : 0,
      String(a.updated_at || '').slice(0, 16).replace('T', ' '),
      body.length, 'https://miscsubjects.com/' + (a.slug || ''),
      (body.match(/<div class="[^"]*widget/g) || []).length,
      String(a.meta || '').slice(0, CELL),
      ...parts(body),
    ];
  });
  const res = await gas('sheets_replace_tab', { sheet_id: SHEET_ID, tab: TAB_ARTICLES, headers: ARTICLE_HEADERS, rows: out });
  return { rows: out.length, longest: rows.reduce((m, a) => Math.max(m, String(a.body || '').length), 0), gas: res.ok === true ? 'ok' : res };
}

// ------------------------------------------------------------------- MODEL_LAB
// Every field the call object accepts, with its range stated in the header. One row per model so
// the same prompt across every model is one RUN, not twenty.
const MODEL_HEADERS = [
  'A: type RUN to fire this row (text)',
  'answer (written by the build)',
  'ms · http · tokens (written by the build)',
  'model (text; any id from the list below — the id column of /api/models)',
  'prompt key (text; a directory row name, or blank to use the system column)',
  'system (text; overrides the prompt key for this call only)',
  'input (text; the user message)',
  'temperature (number 0 to 2; blank = provider default)',
  'max_tokens (number 1 to 32000; blank = 2048)',
  'top_p (number 0 to 1; blank = provider default)',
  'top_k (number 1 to 100; blank = provider default)',
  'seed (integer; same seed + same body = repeatable; blank = none)',
  'stop (text; comma-separated stop strings; blank = none)',
  'presence_penalty (number -2 to 2; blank = provider default)',
  'frequency_penalty (number -2 to 2; blank = provider default)',
  'repetition_penalty (number 1 to 2; Workers-AI models only; blank = default)',
  'n (number 1 to 50; answers per row, all in flight at once; blank = 1)',
  'json (text: true or false; true asks for a JSON object; blank = false)',
  'timeout_ms (number 1000 to 60000; blank = 25000)',
  'memory (text; appended under a MEMORY header for this call only)',
];

async function syncModels(env, url) {
  const r = await fetch(new URL('/api/models', url.origin), { headers: { 'x-terminal-key': env.TERMINAL_KEY || '' } });
  const cat = await r.json().catch(() => ({ text: [] }));
  const ids = (cat.text || []).map((m) => m.id);
  // One row per model, same prompt, so a single RUN column compares every model at once.
  const rows = ids.map((id) => [
    // 600 tokens, not 64: a reasoning model spends its first few hundred tokens thinking, and a
    // budget that cuts it off mid-thought writes an empty cell that reads as the model saying
    // nothing. The comparison is only fair if every model is allowed to finish.
    '', '', '', id, '', 'Answer in one word.', 'Capital of Japan?',
    0, 600, '', '', '', '', '', '', '', 1, '', 30000, '',
  ]);
  const res = await gas('sheets_replace_tab', { sheet_id: SHEET_ID, tab: TAB_MODELS, headers: MODEL_HEADERS, rows });
  return { rows: rows.length, models: ids.length, gas: res.ok === true ? 'ok' : res };
}

// ------------------------------------------------------------------------ tick

function num(v) { return v === '' || v == null ? undefined : (Number.isFinite(Number(v)) ? Number(v) : undefined); }

async function tick(env, url) {
  const did = { leads: [], articles: [], models: [], explain: [] };

  // EXPLAIN — a slug in column B with RUN in column A is written out part by part below.
  const E = await gas('sheets_get', { sheet_id: SHEET_ID, range: 'EXPLAIN!A1:B400' });
  const eRows = E.values || [];
  for (const [i, row] of eRows.entries()) {
    if (String(row[0] || '').trim().toUpperCase() !== 'RUN') continue;
    const slug = String(row[1] || '').trim();
    if (!slug) continue;
    try {
      const rows = await explainRows(env, url.origin, slug);
      await gas('sheets_append_rows', { sheet_id: SHEET_ID, tab: 'EXPLAIN', rows });
      await gas('sheets_set_range', { sheet_id: SHEET_ID, range: `EXPLAIN!A${i + 1}`, values: [['done']] });
      did.explain.push({ slug, rows: rows.length });
    } catch (e) {
      await gas('sheets_set_range', { sheet_id: SHEET_ID, range: `EXPLAIN!A${i + 1}:C${i + 1}`, values: [['done', slug, 'ERROR: ' + String(e && e.message || e).slice(0, 380)]] });
      did.explain.push({ slug, error: String(e && e.message || e).slice(0, 200) });
    }
  }

  // Leads — APPROVE / REJECT
  const L = await gas('sheets_get', { sheet_id: SHEET_ID, range: TAB_LEADS + '!A2:P401' });
  for (const [i, row] of (L.values || []).entries()) {
    const want = String(row[0] || '').trim().toUpperCase();
    const leadId = String(row[15] || '').trim();
    if (!leadId || (want !== 'APPROVE' && want !== 'REJECT')) continue;
    let result;
    try {
      if (want === 'APPROVE') {
        const r = await fetch(new URL('/api/dispatch', url.origin), {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY || '' },
          body: JSON.stringify({ key: 'LEADS_SEND', body: 'CONFIRM|' + leadId + '|build' }),
        });
        const j = await r.json().catch(() => ({}));
        result = typeof j.result === 'string' ? j.result : JSON.stringify(j.result || j);
      } else {
        await env.DB.prepare("INSERT INTO lead_suppressions (email, reason, created_at) VALUES (?, 'owner rejected in sheet', datetime('now'))").bind(String(row[6] || '')).run();
        await env.DB.prepare("UPDATE leads SET status='rejected' WHERE id=?").bind(Number(leadId)).run();
        result = JSON.stringify({ ok: true, suppressed: row[6] });
      }
    } catch (e) { result = JSON.stringify({ error: String(e && e.message || e) }); }
    await gas('sheets_set_range', { sheet_id: SHEET_ID, range: `${TAB_LEADS}!A${i + 2}:B${i + 2}`, values: [['done', String(result).slice(0, 400)]] });
    did.leads.push({ lead_id: leadId, action: want });
  }

  // Articles — SAVE / PULL
  const lastCol = 11 + BODY_PARTS; // A..K is 11 columns, then the body parts
  const colLetter = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const A = await gas('sheets_get', { sheet_id: SHEET_ID, range: `${TAB_ARTICLES}!A2:${colLetter(lastCol)}${ARTICLE_ROWS + 1}` });
  for (const [i, row] of (A.values || []).entries()) {
    const want = String(row[0] || '').trim().toUpperCase();
    const slug = String(row[2] || '').trim();
    if (!slug || (want !== 'SAVE' && want !== 'PULL')) continue;
    let result;
    try {
      if (want === 'PULL') {
        const a = await env.DB.prepare('SELECT title, COALESCE(subject,\'\') subject, COALESCE(published,0) published, COALESCE(meta,\'\') meta, COALESCE(body,\'\') body FROM articles WHERE slug=?').bind(slug).first();
        if (!a) throw new Error('no article ' + slug);
        const values = [['done', 'pulled ' + String(a.body).length + ' chars', slug, a.title, a.subject, a.published ? 1 : 0]];
        await gas('sheets_set_range', { sheet_id: SHEET_ID, range: `${TAB_ARTICLES}!A${i + 2}:F${i + 2}`, values });
        await gas('sheets_set_range', { sheet_id: SHEET_ID, range: `${TAB_ARTICLES}!K${i + 2}:${colLetter(lastCol)}${i + 2}`, values: [[String(a.meta).slice(0, CELL), ...parts(a.body)]] });
        did.articles.push({ slug, action: 'PULL' });
        continue;
      }
      const body = joinParts(row, 11);
      if (!body.trim()) throw new Error('every body cell is empty — PULL first, edit, then SAVE');
      let meta;
      const metaRaw = String(row[10] || '').trim();
      if (metaRaw) { try { meta = JSON.parse(metaRaw); } catch (e) { throw new Error('meta JSON does not parse: ' + e.message); } }
      // The write gate: earn a token by answering questions only the live writing law can answer.
      const ch = await (await fetch(new URL('/api/write-gate/challenge?slug=' + encodeURIComponent(slug), url.origin), { headers: { 'x-terminal-key': env.TERMINAL_KEY || '' } })).json();
      const clauses = ch.clauses || [];
      const joined = clauses.map((c) => c.id + c.title + c.law).join('\n');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(joined));
      const lawHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
      const answers = {};
      for (const q of ch.questions || []) {
        const c = clauses.find((x) => x.id === q.clause_id);
        if (c) answers[q.clause_id] = c.title;
      }
      const got = await (await fetch(new URL('/api/write-gate/answer', url.origin), {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY || '' },
        body: JSON.stringify({ challenge_id: ch.challenge_id, law_hash: lawHash, answers }),
      })).json();
      if (!got.write_token) throw new Error('write gate refused: ' + JSON.stringify(got).slice(0, 200));
      const put = await fetch(new URL('/api/articles/' + encodeURIComponent(slug), url.origin), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY || '', 'x-write-token': got.write_token },
        body: JSON.stringify({
          slug, title: String(row[3] || ''), subject: String(row[4] || ''),
          published: Number(row[5]) ? 1 : 0, body, replace: true, ...(meta ? { meta } : {}),
        }),
      });
      const text = await put.text();
      if (put.status !== 200) throw new Error('HTTP ' + put.status + ': ' + text.slice(0, 200));
      result = 'saved ' + body.length + ' chars';
      await gas('sheets_set_range', { sheet_id: SHEET_ID, range: `${TAB_ARTICLES}!A${i + 2}:B${i + 2}`, values: [['done', result]] });
      did.articles.push({ slug, action: 'SAVE', chars: body.length });
      continue;
    } catch (e) {
      await gas('sheets_set_range', { sheet_id: SHEET_ID, range: `${TAB_ARTICLES}!A${i + 2}:B${i + 2}`, values: [['done', 'ERROR: ' + String(e && e.message || e).slice(0, 380)]] });
      did.articles.push({ slug, action: want, error: String(e && e.message || e).slice(0, 200) });
    }
  }

  // Models — RUN. Every flagged row goes out in one request, all in flight together.
  const M = await gas('sheets_get', { sheet_id: SHEET_ID, range: `${TAB_MODELS}!A2:T60` });
  const calls = [], atRow = [];
  for (const [i, row] of (M.values || []).entries()) {
    if (String(row[0] || '').trim().toUpperCase() !== 'RUN') continue;
    const c = { label: 'r' + (i + 2) };
    if (row[3]) c.model = String(row[3]);
    if (row[4]) c.key = String(row[4]);
    if (row[5]) c.system = String(row[5]);
    if (row[6] !== '') c.input = String(row[6]);
    const map = { 7: 'temperature', 8: 'max_tokens', 9: 'top_p', 10: 'top_k', 11: 'seed', 13: 'presence_penalty', 14: 'frequency_penalty', 15: 'repetition_penalty', 16: 'n', 18: 'timeout_ms' };
    for (const [idx, field] of Object.entries(map)) { const v = num(row[idx]); if (v !== undefined) c[field] = v; }
    if (row[12]) c.stop = String(row[12]);
    if (String(row[17]).toLowerCase() === 'true') c.json = true;
    if (row[19]) c.memory = String(row[19]);
    calls.push(c); atRow.push(i + 2);
  }
  if (calls.length) {
    const r = await fetch(new URL('/api/invoke', url.origin), {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY || '' },
      body: JSON.stringify({ calls }),
    });
    const out = await r.json().catch(() => ({}));
    for (const [j, res] of (out.results || []).entries()) {
      const rowNo = atRow[j] || Number(String(res.label || '').slice(1));
      if (!rowNo) continue;
      const tok = res.usage && res.usage.total_tokens ? res.usage.total_tokens + ' tok' : '';
      await gas('sheets_set_range', {
        sheet_id: SHEET_ID, range: `${TAB_MODELS}!A${rowNo}:C${rowNo}`,
        values: [['done', res.ok ? String(res.text || '').slice(0, CELL) : 'ERROR: ' + String(res.error || 'failed'), [res.ms + 'ms', res.http || '', tok].filter(String).join(' · ')]],
      });
    }
    did.models.push({ ran: calls.length, ok: out.ok_count, ms: out.ms });
  }
  return did;
}

const EXPLAIN_HEADERS = ['A: type RUN (text)', 'slug', 'part', 'value', 'why it exists'];

/** Field-by-field breakdown of one article object. Written under the slug on the EXPLAIN tab. */
async function explainRows(env, origin, slug) {
  const a = await env.DB.prepare(
    `SELECT slug, title, COALESCE(subject,'') subject,
            COALESCE(created_at,'') created_at, COALESCE(updated_at,'') updated_at,
            COALESCE(published,0) published, COALESCE(body,'') body, COALESCE(meta,'') meta
       FROM articles WHERE slug=?`).bind(slug).first();
  if (!a) throw new Error('no article ' + slug);
  const body = String(a.body);
  // Claims are not a table: they ride inside the article's own meta JSON, which is the same field
  // the ARTICLES tab exposes in column K. Read them where they actually live.
  let claims = [];
  try {
    const m = JSON.parse(String(a.meta) || '{}');
    if (Array.isArray(m.claims)) claims = m.claims.slice(0, 25);
  } catch { claims = []; }
  const rows = [
    ['', slug, 'slug', slug, 'the address. /a/' + slug + ' is the page; every link to it uses this string and nothing else.'],
    ['', slug, 'title', String(a.title || ''), 'the heading on the page and the text in search results.'],
    ['', slug, 'subject', String(a.subject), 'the one-line description a model reads before the body.'],
    ['', slug, 'published', a.published ? '1' : '0', '0 means the row exists but the page 404s.'],
    ['', slug, 'created_at', String(a.created_at), 'first write. Never changes.'],
    ['', slug, 'updated_at', String(a.updated_at), 'last write. Changes on every save, including a save from this sheet.'],
    ['', slug, 'body chars', String(body.length), 'the article text in markdown. This is what the page renders.'],
    ['', slug, 'body words', String(body.split(/\s+/).filter(Boolean).length), 'length in words. Short means thin, and thin is a defect.'],
    ['', slug, 'headings', String((body.match(/^#{1,6} /gm) || []).length), 'section count from markdown headings.'],
    ['', slug, 'links', String((body.match(/\]\(/g) || []).length), 'outbound and internal links in the body.'],
    ['', slug, 'widgets', String((body.match(/<div class="[^"]*widget/g) || []).length), 'embedded widget blocks — the visual parts, not prose.'],
    ['', slug, 'meta chars', String(String(a.meta).length), 'the meta JSON: hero, widgets, receipts. Editable in column K of ARTICLES.'],
    ['', slug, 'claims', String(claims.length), 'graded claims attached to the article; each carries its own evidence and can be challenged.'],
    ['', slug, 'url', origin + '/a/' + slug, 'the live page. If this 404s, the row exists but is not published.'],
    ['', slug, 'api', origin + '/api/articles/' + slug, 'the same object as JSON. This is what any model reads.'],
  ];
  claims.forEach((c, i) => rows.push(['', slug, 'claim ' + (i + 1) + ' · ' + String(c.grade || c.status || ''),
    String(c.text || c.claim || '').slice(0, CELL),
    String(c.evidence || c.source || 'no evidence recorded').slice(0, CELL)]));
  return rows;
}

async function restore(env, url) {
  const done = {};
  const origin = url ? url.origin : 'https://miscsubjects.com';

  // OUTREACH — the leads board under the name it had before.
  const leadRows = await all(env,
    `SELECT id, status, score, name, city, email, phone, segment, COALESCE(draft,'') draft,
            COALESCE(notes,'') notes FROM leads
      WHERE status IN ('replied','sent','drafted','enriched','rejected')
      ORDER BY score DESC, id DESC LIMIT 400`);
  done.OUTREACH = (await gas('sheets_replace_tab', {
    sheet_id: SHEET_ID, tab: 'OUTREACH',
    headers: ['status', 'fit score (number 0-100)', 'business', 'city', 'email', 'phone', 'segment',
      'subject line', 'the letter', 'notes', 'lead id (number)'],
    rows: leadRows.map((l) => {
      let subject = '', letter = String(l.draft || '');
      if (letter.startsWith('{')) {
        try { const d = JSON.parse(letter); subject = String(d.subject || ''); letter = String(d.body || ''); }
        catch { /* shown raw rather than hidden */ }
      }
      return [l.status || '', l.score || 0, l.name || '', l.city || '', l.email || '', l.phone || '',
        l.segment || '', subject.slice(0, CELL), letter.slice(0, CELL), String(l.notes).slice(0, CELL), String(l.id)];
    }),
  })).ok === true;

  // MODEL_FIELDS — every field controllable on a model call, read from the live contract so the
  // tab and the endpoint can never disagree.
  const f = await (await fetch(new URL('/api/invoke?fields=1', origin), {
    headers: { 'x-terminal-key': env.TERMINAL_KEY || '' },
  })).json().catch(() => ({}));
  const fieldRows = [];
  for (const x of (f.core || [])) fieldRows.push(['call object', x.name, x.type, String(x.default), x.note]);
  for (const x of (f.sampling_passthrough || [])) fieldRows.push(['sampling', x.name, x.type, String(x.default), x.note]);
  fieldRows.push(['', '', '', '', 'A field not listed here is not controllable through /api/invoke. Nothing is silently ignored.']);
  done.MODEL_FIELDS = (await gas('sheets_replace_tab', {
    sheet_id: SHEET_ID, tab: 'MODEL_FIELDS',
    headers: ['group', 'field', 'type', 'default', 'what it does'], rows: fieldRows,
  })).ok === true;

  // EXPLAIN — one article already broken down, and the row that breaks down the next one.
  const newest = await env.DB.prepare(
    "SELECT slug FROM articles WHERE COALESCE(published,0)=1 ORDER BY COALESCE(updated_at,created_at) DESC LIMIT 1").first();
  const explain = [['', newest ? newest.slug : '', '', '',
    'put a slug in column B, type RUN in column A, and the build writes that article part by part below']];
  if (newest) explain.push(...(await explainRows(env, origin, newest.slug)));
  done.EXPLAIN = (await gas('sheets_replace_tab', {
    sheet_id: SHEET_ID, tab: 'EXPLAIN', headers: EXPLAIN_HEADERS, rows: explain,
  })).ok === true;

  const replies = await all(env,
    `SELECT r.received_at, r.kind, r.from_email, COALESCE(l.name,'') lead_name, r.to_email,
            COALESCE(r.subject,'') subject, COALESCE(r.reply_text,'') reply_text, r.status,
            r.lead_id, COALESCE(r.send_id,'') send_id
       FROM lead_replies r LEFT JOIN leads l ON l.id = r.lead_id ORDER BY r.id DESC LIMIT 300`);
  done.REPLIES = (await gas('sheets_replace_tab', {
    sheet_id: SHEET_ID, tab: 'REPLIES',
    headers: ['received', 'kind (reply | auto | bounce | bulk)', 'who wrote', 'business', 'to',
      'subject', 'what they said', 'status', 'lead id', 'answers send'],
    rows: replies.map((r) => [String(r.received_at || '').slice(0, 16).replace('T', ' '), r.kind, r.from_email,
      r.lead_name, r.to_email, r.subject, String(r.reply_text).slice(0, CELL), r.status,
      r.lead_id == null ? '' : String(r.lead_id), r.send_id]),
  })).ok === true;
  return { restored: done, note: 'OUTREACH, MODEL_FIELDS, EXPLAIN and REPLIES rewritten from D1 and the live field contract.' };
}

/** Empty every tab that is not one of the three. Nothing is created here, ever. */
async function purge() {
  const list = await gas('sheets_list_tabs', { sheet_id: SHEET_ID });
  const emptied = [];
  for (const t of (list.tabs || [])) {
    if (ALLOWED_TABS.includes(t.name) || KEEP_TABS.includes(t.name)) continue;
    const r = await gas('sheets_replace_tab', { sheet_id: SHEET_ID, tab: t.name, headers: ['emptied — this tab was created in error and holds nothing'], rows: [] });
    emptied.push({ tab: t.name, ok: r.ok === true });
  }
  return { emptied, allowed: ALLOWED_TABS, note: 'A tab can only be deleted from Apps Script; emptied here until that session is available.' };
}

async function handle(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!(await isBuildAuthed(request, env))) return json({ error: 'unauthorized' }, 401);

  let body = {};
  if (request.method === 'POST') body = await request.json().catch(() => ({}));
  const want = (k) => body[k] ?? url.searchParams.get(k);

  const out = { sheet: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`, tabs: ALLOWED_TABS };
  const started = Date.now();
  try {
    if (want('purge')) out.purge = await purge();
    if (want('restore')) out.restore = await restore(env, url);
    if (want('sync')) {
      out.leads = await syncLeads(env);
      out.articles = await syncArticles(env, want('articles'));
      out.models = await syncModels(env, url);
    }
    if (want('tick')) out.tick = await tick(env, url);
    if (!want('sync') && !want('tick') && !want('purge')) {
      out.what = 'POST {"sync":1} rewrites the three tabs. {"tick":1} runs what you typed in column A. {"purge":1} empties any other tab.';
    }
  } catch (e) { out.error = String(e && e.message || e); }
  out.ms = Date.now() - started;
  await logEvent(env, {
    source: 'board', key: 'BOARD_SYNC', action: want('tick') ? 'tick' : 'sync', direction: 'out',
    status: out.error ? 500 : 200, request: { sync: !!want('sync'), tick: !!want('tick'), purge: !!want('purge') }, response: out,
  });
  return json(out, out.error ? 500 : 200);
}

export const onRequestGet = handle;
export const onRequestPost = handle;
