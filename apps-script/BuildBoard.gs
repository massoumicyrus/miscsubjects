/**
 * BuildBoard.gs — the build, on the owner's sheet.
 *
 * Sheet: "Lead Outbox + Model Prompt Lab"
 *   https://docs.google.com/spreadsheets/d/<GOOGLE_SHEET_ID>/edit
 *
 * Five tabs, nothing else. No architecture spam.
 *   LEADS         every lead the build found, with the draft letter, newest first
 *   ARTICLES      every article: title, words, url, and the body in one editable cell
 *   MODEL_LAB     pick any model, set any field, type DO=RUN, get the answer back in the row
 *   MODEL_FIELDS  the full REST object: every field you can control, its type and default
 *   EXPLAIN       point at a slug, type DO=RUN, get the article explained field by field
 *
 * How a row acts like a button: put RUN (or SAVE on ARTICLES) in the DO column. A one-minute
 * trigger picks it up, does the work, writes the result into the row, and sets DO to done.
 * Nothing to install, nothing to authorise — this runs inside the already-authorised airunner
 * project. the owner never signs in to anything.
 *
 * Auth: Script Property MISC (the terminal key), the same one Invoke.gs already uses.
 */

var BOARD_SHEET_ID = '<GOOGLE_SHEET_ID>';
var BOARD_BASE = 'https://miscsubjects.com';
var BOARD_CELL_MAX = 49000;   // a Sheets cell holds 50000 chars; leave room for the marker

function boardKey_() {
  var p = PropertiesService.getScriptProperties();
  var k = p.getProperty('MISC') || p.getProperty('TERMINAL_KEY');
  if (!k) throw new Error('Script Property MISC is not set on the airunner project.');
  return k;
}

/**
 * Sets the Script Property this project uses to reach the build. Called once, from the build,
 * so the key is never typed into a Google UI and the owner never touches it.
 */
function boardSetKey(args) {
  var k = String((args && args.key) || '').trim();
  if (k.length < 16) throw new Error('key looks wrong');
  PropertiesService.getScriptProperties().setProperty('MISC', k);
  return { ok: true, set: 'MISC', len: k.length };
}

function boardFetch_(path, opts) {
  var o = opts || {};
  var res = UrlFetchApp.fetch(BOARD_BASE + path, {
    method: o.method || 'get',
    contentType: 'application/json',
    headers: { 'x-terminal-key': boardKey_() },
    payload: o.payload ? JSON.stringify(o.payload) : undefined,
    muteHttpExceptions: true
  });
  var txt = res.getContentText();
  var code = res.getResponseCode();
  if (code !== 200) throw new Error(path + ' -> HTTP ' + code + ': ' + txt.slice(0, 300));
  try { return JSON.parse(txt); }
  catch (e) { throw new Error(path + ' -> unparseable: ' + txt.slice(0, 300)); }
}

/** POST /api/dispatch — run a directory row. Returns the parsed `result` payload. */
function boardDispatch_(key, body) {
  var out = boardFetch_('/api/dispatch', { method: 'post', payload: { key: key, body: body } });
  var r = out && out.result;
  if (typeof r === 'string') { try { return JSON.parse(r); } catch (e) { return { text: r }; } }
  return r || out;
}

function boardSs_() { return SpreadsheetApp.openById(BOARD_SHEET_ID); }

function boardTab_(name, headers) {
  var ss = boardSs_();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clear();
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#1f1f1f').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  return sh;
}

function boardWrite_(sh, rows) {
  if (!rows.length) return 0;
  var w = 0;
  for (var i = 0; i < rows.length; i++) w = Math.max(w, rows[i].length);
  for (var j = 0; j < rows.length; j++) {
    while (rows[j].length < w) rows[j].push('');
    for (var c = 0; c < w; c++) {
      var v = rows[j][c];
      if (typeof v === 'string' && v.length > BOARD_CELL_MAX) {
        rows[j][c] = v.slice(0, BOARD_CELL_MAX) + '\n[TRUNCATED IN SHEET — full text at the url in this row]';
      }
    }
  }
  sh.getRange(2, 1, rows.length, w).setValues(rows);
  return rows.length;
}

function boardTidy_(sh, widths, wrapCols) {
  for (var i = 0; i < widths.length; i++) if (widths[i]) sh.setColumnWidth(i + 1, widths[i]);
  (wrapCols || []).forEach(function (c) {
    sh.getRange(1, c, Math.max(2, sh.getMaxRows()), 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  });
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setVerticalAlignment('top');
}

function boardDoColumn_(sh, col, choices) {
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(choices, true).setAllowInvalid(true).build();
  sh.getRange(2, col, Math.max(2, sh.getMaxRows() - 1), 1).setDataValidation(rule);
  sh.getRange(1, col).setBackground('#8a6d1f');
}

// ---------------------------------------------------------------- LEADS

function boardSyncLeads() {
  // Straight out of D1, ordered so the ones that matter are at the top: sent, then drafted,
  // then the highest-scoring enriched. `draft` is the actual letter; `context` is why the
  // build picked this business.
  var sql =
    "SELECT id, status, score, name, city, email, phone, website, segment, " +
    "COALESCE(context,'') ctx, COALESCE(draft,'') draft, COALESCE(notes,'') notes, created_at " +
    "FROM leads WHERE status IN ('sent','drafted','enriched','rejected') " +
    "ORDER BY CASE status WHEN 'sent' THEN 0 WHEN 'drafted' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END, " +
    "score DESC, id DESC LIMIT 400";
  var leads = boardDispatch_('D1_QUERY', sql);
  if (!Array.isArray(leads)) leads = (leads && leads.results) || [];
  var counts = boardDispatch_('D1_QUERY', 'SELECT status, COUNT(*) n FROM leads GROUP BY status');

  var sh = boardTab_('LEADS', [
    'DO', 'result', 'status', 'score', 'business', 'city', 'email', 'phone', 'segment',
    'why the build picked this one', 'subject', 'the letter it wrote',
    'reply goes to', 'written by', 'notes', 'site', 'lead id'
  ]);
  var rows = (leads || []).map(function (l) {
    // `draft` is stored as a JSON envelope. Split it so the letter reads as a letter.
    var subject = '', body = String(l.draft || ''), replyTo = '', by = '';
    if (body.charAt(0) === '{') {
      try {
        var d = JSON.parse(body);
        subject = String(d.subject || '');
        body = String(d.body || '');
        replyTo = String(d.reply_to || '');
        by = String(d.model || d.by || '');
      } catch (e) {}
    }
    return [
      '', '', l.status || '', l.score || 0, l.name || '', l.city || '', l.email || '', l.phone || '',
      l.segment || '', l.ctx || '', subject, body, replyTo, by,
      l.notes || '', l.website || '', String(l.id || '')
    ];
  });
  var n = boardWrite_(sh, rows);
  boardDoColumn_(sh, 1, ['APPROVE', 'REJECT', 'done']);
  boardTidy_(sh, [80, 260, 90, 55, 240, 120, 230, 130, 130, 380, 260, 700, 190, 240, 220, 220, 70], [10, 12, 15]);
  return { ok: true, tab: 'LEADS', rows: n, by_status: counts };
}

/**
 * DO=APPROVE on a LEADS row sends that letter for real: LEADS_SEND runs every gate the build
 * already enforces (mx, fit score, suppression, identity guard, sending-domain readiness) and
 * bcc's the owner. DO=REJECT suppresses the lead instead. The point of this column is throughput:
 * 688 enriched leads and a 67% open rate were sitting behind one approval at a time in chat.
 */
function boardRunLeads() {
  var sh = boardSs_().getSheetByName('LEADS');
  if (!sh) return { ok: false, error: 'no LEADS tab' };
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, acted: 0 };
  var data = sh.getRange(2, 1, last - 1, 17).getValues();
  var acted = [];
  for (var i = 0; i < data.length; i++) {
    var doCol = String(data[i][0] || '').trim().toUpperCase();
    var leadId = String(data[i][16] || '').trim();
    if (!leadId || (doCol !== 'APPROVE' && doCol !== 'REJECT')) continue;
    var r = i + 2;
    try {
      var res;
      if (doCol === 'APPROVE') {
        res = boardDispatch_('LEADS_SEND', 'CONFIRM|' + leadId + '|build');
      } else {
        res = boardDispatch_('D1_EXEC',
          "INSERT INTO lead_suppressions (email, reason, created_at) VALUES ('" +
          String(data[i][6]).replace(/'/g, "''") + "', 'owner rejected in sheet', datetime('now'))");
      }
      var txt = JSON.stringify(res);
      sh.getRange(r, 2).setValue(txt.slice(0, 400));
      sh.getRange(r, 2).setFontColor(txt.indexOf('"blocked"') >= 0 || txt.indexOf('error') >= 0 ? '#a31111' : '#0b6b2f');
      sh.getRange(r, 1).setValue('done');
      acted.push(leadId + ':' + doCol);
    } catch (e) {
      sh.getRange(r, 2).setValue('ERROR: ' + String(e.message || e));
      sh.getRange(r, 1).setValue('done');
    }
  }
  return { ok: true, acted: acted.length, did: acted };
}

// ---------------------------------------------------------------- REPLIES

/** Every inbound message the build captured, newest first. Replies, bounces, auto-responders. */
function boardSyncReplies() {
  var rows = boardDispatch_('D1_QUERY',
    "SELECT r.id, r.received_at, r.from_email, r.to_email, r.kind, r.subject, r.reply_text, " +
    "r.status, r.lead_id, r.send_id, COALESCE(l.name,'') lead_name " +
    "FROM lead_replies r LEFT JOIN leads l ON l.id = r.lead_id " +
    "ORDER BY r.id DESC LIMIT 300");
  if (!Array.isArray(rows)) rows = (rows && rows.results) || [];
  var sh = boardTab_('REPLIES', [
    'received', 'kind', 'who wrote', 'business', 'to', 'subject', 'what they said',
    'status', 'lead id', 'answers send'
  ]);
  var out = (rows || []).map(function (r) {
    return [
      String(r.received_at || '').slice(0, 16).replace('T', ' '), r.kind || '', r.from_email || '',
      r.lead_name || '', r.to_email || '', r.subject || '', r.reply_text || '',
      r.status || '', r.lead_id == null ? '' : String(r.lead_id), r.send_id || ''
    ];
  });
  var n = boardWrite_(sh, out);
  boardTidy_(sh, [130, 80, 230, 200, 190, 280, 700, 90, 70, 150], [7]);
  return { ok: true, tab: 'REPLIES', rows: n };
}

// ---------------------------------------------------------------- ARTICLES

/**
 * ARTICLES carries EVERY editable field of an article, not just the body, because an article
 * is not a blob of prose — it is a body plus widgets plus a hash-chained source ledger plus
 * atomized claims. Pulling only the body meant the sheet could never insert a widget or add a
 * source, which is most of what editing an article actually is.
 *
 * The default is the 50 newest, fully hydrated on sync: one GET per slug so the widget,
 * source and claim JSON is in the row the moment the tab appears — no PULL step needed to
 * see what an article is made of.
 *
 * The body is split across body_1…body_16 because a Sheets cell holds 50,000 characters and
 * articles here run past 690,000. SAVE concatenates them back in order; nothing is truncated
 * and nothing is lost.
 */
var BOARD_ART_BODY_PARTS = 16;
var BOARD_ART_HEAD = [
  'DO', 'slug', 'title', 'status', 'register', 'words', 'published', 'updated', 'url', 'result',
  'widgets_json', 'sources_json', 'claims_json', 'tags_json', 'style_json',
  'hero', 'images_json', 'category', 'home', 'extra_json'
];
var BOARD_ART_FIXED = BOARD_ART_HEAD.length;   // body_1 starts at BOARD_ART_FIXED + 1

/** Column notes: the schema for the JSON fields, in the sheet, where the editing happens. */
var BOARD_ART_NOTES = {
  widgets_json:
    'A JSON array. Each element is one widget rendered in order under the body.\n' +
    'type=note|callout   {type,title,text}            text is markdown\n' +
    'type=quote          {type,text,cite}\n' +
    'type=stat           {type,value,label}\n' +
    'type=gallery        {type,images:[{url,alt,caption}]}\n' +
    'type=imessage       {type,id,subtitle,messages:[{from:"me"|"them",text}],typing_indicator}\n' +
    'type=whatsapp       {type,chat_name,subtitle,messages:[{from,text,time}]}\n' +
    'type=wikipedia      {type,title,url,body,image,infobox}\n' +
    'type=site_embed     {type,site,institution,title,url,body,date}\n' +
    'type=graph_map      {type,slug,mode,focus}       renders the evidence map iframe\n' +
    'type=llm_agent | audit_trail | user_entry | source\n' +
    'Any widget also takes style:{rotate,offset_x,offset_y,pulse}.\n' +
    'To INSERT one: add an object to this array and set DO=SAVE.',
  sources_json:
    'A JSON array — the hash-chained source ledger. Each:\n' +
    '{id,type,url,title,quote,summary,author,publisher,date,claim_ids:[]}\n' +
    'type is pubmed|clinical_trial|review|medical|reddit|x|youtube|protocol|news|…\n' +
    'prev and hash are computed server-side on SAVE — never write them by hand.\n' +
    'claim_ids link a source to the claims it supports.',
  claims_json:
    'A JSON array — the atomized claims, the primary object of an article. Each:\n' +
    '{id,text,section,tier,source_ids:[],source_status,why_material,extra}\n' +
    'tier is system|study|inference. Every material assertion should be a claim.',
  tags_json: 'JSON array of strings, e.g. ["oip","protocol-specification"].',
  style_json: 'JSON object: {theme,font,measure,accent}. measure is body width in px.',
  images_json: 'JSON array: [{url,alt,caption}].',
  extra_json: 'JSON object. Open passthrough — any field, no migration needed.',
  home: 'TRUE or FALSE — whether it shows on the homepage.',
  status: 'published | retracted | superseded',
  DO: 'PULL re-reads this row from the site. SAVE writes the row back (body + every JSON\n' +
      'field). EXPLAIN writes a field-by-field explanation into the EXPLAIN tab.\n' +
      'A one-minute trigger picks it up and sets DO=done with the outcome in result.'
};

function boardArtHeaders_() {
  var h = BOARD_ART_HEAD.slice();
  for (var i = 1; i <= BOARD_ART_BODY_PARTS; i++) h.push('body_' + i);
  return h;
}

/** Splits a body across the body_N cells. Returns an array of exactly BOARD_ART_BODY_PARTS. */
function boardSplitBody_(body) {
  var s = String(body || ''), out = [];
  for (var i = 0; i < BOARD_ART_BODY_PARTS; i++) {
    out.push(s.slice(i * BOARD_CELL_MAX, (i + 1) * BOARD_CELL_MAX));
  }
  if (s.length > BOARD_CELL_MAX * BOARD_ART_BODY_PARTS) {
    throw new Error('body is ' + s.length + ' chars, past the ' +
      (BOARD_CELL_MAX * BOARD_ART_BODY_PARTS) + ' the sheet can hold — raise BOARD_ART_BODY_PARTS');
  }
  return out;
}

function boardJoinBody_(rowValues) {
  var parts = [];
  for (var i = 0; i < BOARD_ART_BODY_PARTS; i++) parts.push(String(rowValues[BOARD_ART_FIXED + i] || ''));
  return parts.join('');
}

function boardJson_(v) {
  if (v === null || v === undefined || v === '') return '';
  return JSON.stringify(v, null, 0);
}

/**
 * Dates go in as real Date values, not strings, so the sheet's own filter offers
 * "before / after / between" on them. A date written as text can only be filtered
 * as text, which is useless for "everything published this week".
 */
function boardDate_(v) {
  var s = String(v || '');
  if (!s) return '';
  var d = new Date(s);
  return isNaN(d.getTime()) ? s : d;
}

/** Turns one full article object into a sheet row. */
function boardArtRow_(a) {
  var body = String(a.body || '');
  return [
    '', a.slug || '', a.title || '', a.status || '', a.register || '',
    body.split(/\s+/).filter(Boolean).length,
    boardDate_(a.posted_at || a.created_at),
    boardDate_(a.updated_at),
    BOARD_BASE + '/a/' + (a.slug || ''), '',
    boardJson_(a.widgets || []), boardJson_(a.sources || []), boardJson_(a.claims || []),
    boardJson_(a.tags || []), boardJson_(a.style || {}),
    a.hero || '', boardJson_(a.images || []), a.category || '',
    a.home === false ? 'FALSE' : 'TRUE', boardJson_(a.extra || {})
  ].concat(boardSplitBody_(body));
}

function boardSyncArticles(args) {
  var want = (args && args.limit) || 50;
  var list = boardFetch_('/api/articles?slim=1&limit=' + want);
  var slugs = ((list && list.articles) || []).map(function (a) { return a.slug; });

  var rows = [], failed = [];
  for (var i = 0; i < slugs.length; i++) {
    try {
      var got = boardFetch_('/api/articles/' + encodeURIComponent(slugs[i]));
      rows.push(boardArtRow_(got.article || got));
    } catch (e) {
      failed.push(slugs[i] + ': ' + String(e.message || e));
    }
  }

  var sh = boardTab_('ARTICLES', boardArtHeaders_());
  var n = boardWrite_(sh, rows);
  boardDoColumn_(sh, 1, ['PULL', 'SAVE', 'EXPLAIN', 'done']);

  // The schema lives on the header cell, so the person editing a widget can read what a
  // widget is without leaving the sheet.
  var heads = boardArtHeaders_();
  for (var c = 0; c < heads.length; c++) {
    if (BOARD_ART_NOTES[heads[c]]) sh.getRange(1, c + 1).setNote(BOARD_ART_NOTES[heads[c]]);
  }
  var widths = [70, 240, 380, 90, 130, 60, 130, 130, 300, 300, 420, 420, 420, 200, 200, 300, 240, 130, 60, 240];
  for (var b = 0; b < BOARD_ART_BODY_PARTS; b++) widths.push(b === 0 ? 700 : 120);
  boardTidy_(sh, widths, [11, 12, 13, 20, BOARD_ART_FIXED + 1]);

  // Filters. `published` and `updated` are real dates, so the filter menu on those two
  // columns offers before / after / between — which is the only way "show me what went out
  // this week" is answerable in a sheet. Sorted newest-published first.
  if (n) {
    sh.getRange(2, 7, n, 2).setNumberFormat('yyyy-mm-dd hh:mm');
    var existingFilter = sh.getFilter();
    if (existingFilter) existingFilter.remove();
    var range = sh.getRange(1, 1, n + 1, BOARD_ART_FIXED + BOARD_ART_BODY_PARTS);
    range.createFilter();
    sh.getFilter().sort(7, false);
  }

  return {
    ok: true, tab: 'ARTICLES', rows: n, requested: want,
    total_on_site: list && list.total, failed: failed
  };
}

// ---------------------------------------------------------------- DISPATCH

/**
 * DISPATCH is the whole build on one tab: any directory row, run from a cell.
 *
 * The build's universal execution verb is POST /api/dispatch {key, body} — 936 rows, one
 * name each. This tab is that verb with a spreadsheet in front of it: put the key in a cell,
 * the body next to it, set DO=RUN, and the tick writes the response, the HTTP status and the
 * duration back into the row. Anything the build can do is reachable here without a second
 * mechanism being invented for it.
 *
 * Seeded from the live directory, so the tab is also the catalogue.
 */
function boardSyncDispatch(args) {
  var want = (args && args.limit) || 200;
  var rows = boardDispatch_('D1_QUERY',
    "SELECT key, type, category, COALESCE(content,'') content FROM directory " +
    "WHERE enabled=1 ORDER BY category, key LIMIT " + want);
  if (!Array.isArray(rows)) rows = (rows && rows.results) || [];

  var sh = boardTab_('DISPATCH', [
    'DO', 'key', 'type', 'category', 'body (JSON or plain text)', 'result', 'http', 'ms', 'what it does'
  ]);
  var out = rows.map(function (r) {
    // The first line of `content` is the row's own docs — its one-line "what is this".
    var doc = String(r.content || '').split('\n').filter(function (l) {
      return l.trim() && l.trim() !== '#';
    })[0] || '';
    return ['', r.key || '', r.type || '', r.category || '', '', '', '', '',
            doc.replace(/^#\s*/, '').slice(0, 300)];
  });
  var n = boardWrite_(sh, out);
  boardDoColumn_(sh, 1, ['RUN', 'done']);
  sh.getRange(1, 1).setNote(
    'RUN dispatches this row: POST /api/dispatch {key, body}.\n' +
    'body may be JSON or plain text — whatever that row expects.\n' +
    'The tick writes result, http and ms back into the row and sets DO=done.');
  boardTidy_(sh, [70, 300, 90, 160, 420, 700, 60, 70, 460], [5, 6, 9]);
  if (n) {
    var f = sh.getFilter(); if (f) f.remove();
    sh.getRange(1, 1, n + 1, 9).createFilter();
  }
  return { ok: true, tab: 'DISPATCH', rows: n };
}

/** Runs every DISPATCH row flagged RUN. One directory row per sheet row, receipts in place. */
function boardRunDispatch() {
  var sh = boardSs_().getSheetByName('DISPATCH');
  if (!sh) return { ok: false, error: 'no DISPATCH tab — run board_sync_dispatch first' };
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, acted: 0 };
  var data = sh.getRange(2, 1, last - 1, 9).getValues();
  var acted = [];
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim().toUpperCase() !== 'RUN') continue;
    var key = String(data[i][1] || '').trim();
    if (!key) continue;
    var r = i + 2, t0 = Date.now();
    try {
      var raw = String(data[i][4] || '');
      var body = '';
      if (raw.trim()) { try { body = JSON.parse(raw); } catch (e) { body = raw; } }
      var res = UrlFetchApp.fetch(BOARD_BASE + '/api/dispatch', {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-terminal-key': boardKey_() },
        payload: JSON.stringify({ key: key, body: body, actor: 'sheet' }),
        muteHttpExceptions: true
      });
      var txt = res.getContentText();
      sh.getRange(r, 6).setValue(txt.length > BOARD_CELL_MAX ? txt.slice(0, BOARD_CELL_MAX) : txt);
      sh.getRange(r, 7).setValue(res.getResponseCode());
      sh.getRange(r, 8).setValue(Date.now() - t0);
      acted.push(key);
    } catch (e) {
      sh.getRange(r, 6).setValue('ERROR: ' + String(e.message || e));
      sh.getRange(r, 8).setValue(Date.now() - t0);
    }
    sh.getRange(r, 1).setValue('done');
  }
  return { ok: true, acted: acted.length, did: acted };
}

/**
 * An article write is gated: the caller must fetch the live writing law and answer questions
 * whose answers exist only in that text. This does it — the sheet earns the token every save,
 * so a save from a row is held to the same law as a save from anywhere else.
 */
function boardWriteToken_(slug) {
  var ch = boardFetch_('/api/write-gate/challenge?slug=' + encodeURIComponent(slug));
  var clauses = ch.clauses || [];
  var joined = clauses.map(function (c) { return c.id + c.title + c.law; }).join('\n');
  var lawHash = boardSha256_(joined);
  var answers = {};
  (ch.questions || []).forEach(function (q) {
    for (var i = 0; i < clauses.length; i++) {
      if (clauses[i].id === q.clause_id) { answers[q.clause_id] = clauses[i].title; break; }
    }
  });
  var got = boardFetch_('/api/write-gate/answer', {
    method: 'post',
    payload: { challenge_id: ch.challenge_id, law_hash: lawHash, answers: answers }
  });
  if (!got.write_token) throw new Error('write gate refused: ' + JSON.stringify(got).slice(0, 300));
  return got.write_token;
}

function boardSha256_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}

/** DO=PULL fetches the body into the row; DO=SAVE writes the row's body back to the build. */
/** Parses a JSON cell, naming the column in the error so a typo is findable. */
function boardParseCell_(value, columnName, fallback) {
  var s = String(value || '').trim();
  if (!s) return fallback;
  try { return JSON.parse(s); }
  catch (e) { throw new Error(columnName + ' is not valid JSON: ' + String(e.message || e).slice(0, 160)); }
}

/**
 * SAVE writes the WHOLE row back, not just the body: widgets, sources, claims, tags, style,
 * hero, images, category, home, extra and status all go up in one POST. That is what makes
 * inserting a widget or adding a source a sheet edit rather than a code change.
 *
 * The write is gated exactly like every other write to the build — boardWriteToken_ answers
 * the live writing-law challenge first. A save from a spreadsheet is held to the same law as
 * a save from anywhere else.
 */
function boardRunArticles() {
  var sh = boardSs_().getSheetByName('ARTICLES');
  if (!sh) return { ok: false, error: 'no ARTICLES tab — run board_sync first' };
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, acted: 0 };
  var width = BOARD_ART_FIXED + BOARD_ART_BODY_PARTS;
  var data = sh.getRange(2, 1, last - 1, width).getValues();
  var C = { result: 10, widgets: 11, sources: 12, claims: 13, tags: 14, style: 15,
            hero: 16, images: 17, category: 18, home: 19, extra: 20 };
  var acted = [];

  for (var i = 0; i < data.length; i++) {
    var doCol = String(data[i][0] || '').trim().toUpperCase();
    var slug = String(data[i][1] || '').trim();
    if (!slug || (doCol !== 'PULL' && doCol !== 'SAVE' && doCol !== 'EXPLAIN')) continue;
    var r = i + 2;
    try {
      if (doCol === 'PULL') {
        var a = boardFetch_('/api/articles/' + encodeURIComponent(slug));
        sh.getRange(r, 1, 1, width).setValues([boardArtRow_(a.article || a)]);
        sh.getRange(r, C.result).setValue('pulled ' + String((a.article || a).body || '').length + ' chars');

      } else if (doCol === 'SAVE') {
        var newBody = boardJoinBody_(data[i]);
        if (!newBody.trim()) throw new Error('every body_N cell is empty — PULL first, edit, then SAVE');
        var payload = {
          slug: slug,
          title: String(data[i][2] || ''),
          body: newBody,
          replace: true,
          widgets: boardParseCell_(data[i][C.widgets - 1], 'widgets_json', []),
          sources: boardParseCell_(data[i][C.sources - 1], 'sources_json', []),
          claims: boardParseCell_(data[i][C.claims - 1], 'claims_json', []),
          tags: boardParseCell_(data[i][C.tags - 1], 'tags_json', []),
          style: boardParseCell_(data[i][C.style - 1], 'style_json', {}),
          images: boardParseCell_(data[i][C.images - 1], 'images_json', []),
          extra: boardParseCell_(data[i][C.extra - 1], 'extra_json', {}),
          home: String(data[i][C.home - 1]).toUpperCase() !== 'FALSE'
        };
        if (String(data[i][3] || '').trim()) payload.status = String(data[i][3]).trim();
        if (String(data[i][C.hero - 1] || '').trim()) payload.hero = String(data[i][C.hero - 1]).trim();
        if (String(data[i][C.category - 1] || '').trim()) payload.category = String(data[i][C.category - 1]).trim();

        var wt = boardWriteToken_(slug);
        var put = UrlFetchApp.fetch(BOARD_BASE + '/api/articles/' + encodeURIComponent(slug), {
          method: 'post',
          contentType: 'application/json',
          headers: { 'x-terminal-key': boardKey_(), 'x-write-token': wt },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });
        var code = put.getResponseCode();
        if (code !== 200) throw new Error('HTTP ' + code + ': ' + put.getContentText().slice(0, 200));
        sh.getRange(r, C.result).setValue(
          'saved ' + newBody.length + ' chars · ' + payload.widgets.length + ' widgets · ' +
          payload.sources.length + ' sources · ' + payload.claims.length + ' claims');

      } else {
        boardExplainInto_(slug);
        sh.getRange(r, C.result).setValue('explained — see EXPLAIN tab');
      }
      sh.getRange(r, 1).setValue('done');
      acted.push(slug + ':' + doCol);
    } catch (e) {
      sh.getRange(r, C.result).setValue('ERROR: ' + String(e.message || e));
      sh.getRange(r, 1).setValue('done');
    }
  }
  return { ok: true, acted: acted.length, did: acted };
}

// ---------------------------------------------------------------- MODEL LAB

function boardSyncModelLab(keep) {
  var models = boardFetch_('/api/models');
  var ids = [].concat(models.text || [], models.image || []).map(function (m) { return m.id; });
  var list = boardDispatch_('D1_QUERY',
    "SELECT key FROM directory WHERE type='agent' OR category='prompt' ORDER BY key LIMIT 400");
  if (!Array.isArray(list)) list = (list && list.results) || [];
  var keys = list.map(function (r) { return r.key; });

  var existing = [];
  if (keep) {
    var old = boardSs_().getSheetByName('MODEL_LAB');
    if (old && old.getLastRow() > 1) existing = old.getRange(2, 1, old.getLastRow() - 1, 14).getValues();
  }

  var sh = boardTab_('MODEL_LAB', [
    'DO', 'model', 'prompt key', 'system (overrides the key)', 'input', 'temperature', 'max_tokens',
    'top_p', 'seed', 'stop', 'n', 'json', 'answer', 'ms · http · tokens'
  ]);
  // One row per model the build can actually call, so the tab IS the model inventory:
  // set DO=RUN on any row and that model answers in place. Nothing to look up elsewhere.
  var seed = existing.length ? existing : ids.map(function (id) {
    return ['', id, '', '', 'One sentence: what is this build?', 0.2, 256, '', '', '', 1, '', '', ''];
  });
  if (!seed.length) seed = [['', 'kimi', 'ASK_KIMI', '', 'One word: capital of Japan?', 0.2, 256, '', '', '', 1, '', '', '']];
  var n = boardWrite_(sh, seed);
  boardDoColumn_(sh, 1, ['RUN', 'done']);
  var mRule = SpreadsheetApp.newDataValidation().requireValueInList(ids.slice(0, 500), true).setAllowInvalid(true).build();
  sh.getRange(2, 2, Math.max(2, sh.getMaxRows() - 1), 1).setDataValidation(mRule);
  if (keys.length) {
    var kRule = SpreadsheetApp.newDataValidation().requireValueInList(keys.slice(0, 500), true).setAllowInvalid(true).build();
    sh.getRange(2, 3, Math.max(2, sh.getMaxRows() - 1), 1).setDataValidation(kRule);
  }
  boardTidy_(sh, [70, 300, 240, 320, 320, 100, 90, 70, 70, 90, 50, 60, 620, 180], [4, 5, 13]);
  return { ok: true, tab: 'MODEL_LAB', rows: n, models: ids.length, prompt_keys: keys.length };
}

/** DO=RUN on MODEL_LAB rows. Every flagged row goes out in ONE /api/invoke request. */
function boardRunModelLab() {
  var sh = boardSs_().getSheetByName('MODEL_LAB');
  if (!sh) return { ok: false, error: 'no MODEL_LAB tab — run board_sync first' };
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, ran: 0 };
  var data = sh.getRange(2, 1, last - 1, 14).getValues();
  var calls = [], rowNos = [];
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim().toUpperCase() !== 'RUN') continue;
    var c = { label: 'row' + (i + 2) };
    if (data[i][1]) c.model = String(data[i][1]);
    if (data[i][2]) c.key = String(data[i][2]);
    if (data[i][3]) c.system = String(data[i][3]);
    if (data[i][4] !== '') c.input = String(data[i][4]);
    if (data[i][5] !== '') c.temperature = Number(data[i][5]);
    if (data[i][6] !== '') c.max_tokens = Number(data[i][6]);
    if (data[i][7] !== '') c.top_p = Number(data[i][7]);
    if (data[i][8] !== '') c.seed = Number(data[i][8]);
    if (data[i][9] !== '') c.stop = String(data[i][9]);
    if (data[i][10] !== '') c.n = Number(data[i][10]);
    if (String(data[i][11]).toLowerCase() === 'true') c.json = true;
    calls.push(c); rowNos.push(i + 2);
  }
  if (!calls.length) return { ok: true, ran: 0, note: 'no row had DO=RUN' };

  var out = boardFetch_('/api/invoke', { method: 'post', payload: { calls: calls } });
  var results = (out && out.results) || [];
  for (var j = 0; j < results.length; j++) {
    var res = results[j];
    var r = rowNos[j] || (parseInt(String(res.label || '').replace('row', ''), 10) || 0);
    if (!r) continue;
    var tok = res.usage && res.usage.total_tokens ? res.usage.total_tokens + ' tok' : '';
    sh.getRange(r, 13).setValue(res.ok ? String(res.text || '') : 'ERROR: ' + String(res.error || 'failed'));
    sh.getRange(r, 14).setValue([res.ms + 'ms', res.http || '', tok].filter(String).join(' · '));
    sh.getRange(r, 13).setFontColor(res.ok ? '#000000' : '#a31111');
    sh.getRange(r, 1).setValue('done');
  }
  return { ok: true, ran: calls.length, ms: out.ms, ok_count: out.ok_count };
}

// ---------------------------------------------------------------- MODEL FIELDS

function boardSyncModelFields() {
  var f = boardFetch_('/api/invoke?fields=1');
  var sh = boardTab_('MODEL_FIELDS', ['group', 'field', 'type', 'default', 'what it does']);
  var rows = [];
  (f.core || []).forEach(function (x) { rows.push(['call object', x.name, x.type, x.default, x.note]); });
  (f.sampling_passthrough || []).forEach(function (x) { rows.push(['sampling', x.name, x.type, x.default, x.note]); });
  rows.push(['', '', '', '', 'A field not listed here is not controllable through /api/invoke. Nothing is silently ignored.']);
  var n = boardWrite_(sh, rows);
  boardTidy_(sh, [110, 170, 90, 130, 640], [5]);
  return { ok: true, tab: 'MODEL_FIELDS', rows: n };
}

// ---------------------------------------------------------------- EXPLAIN

var BOARD_EXPLAIN_HEADERS = ['DO', 'slug', 'part', 'value', 'why it exists'];

function boardSyncExplain() {
  var sh = boardTab_('EXPLAIN', BOARD_EXPLAIN_HEADERS);
  boardWrite_(sh, [['RUN', 'build-advancement-register', '', '', 'put a slug here, set DO=RUN']]);
  boardDoColumn_(sh, 1, ['RUN', 'done']);
  boardTidy_(sh, [70, 280, 200, 620, 420], [4, 5]);
  return { ok: true, tab: 'EXPLAIN' };
}

/** Field-by-field breakdown of one article object, written under the slug. */
function boardExplainInto_(slug) {
  var a = boardFetch_('/api/articles/' + encodeURIComponent(slug));
  var art = a.article || a;
  var body = String(art.body || art.body_md || art.content || '');
  var claims = Array.isArray(art.claims) ? art.claims : [];
  var rows = [
    ['', slug, 'slug', slug, 'the address. /' + slug + ' is the page; every link to it uses this string and nothing else.'],
    ['', slug, 'title', String(art.title || ''), 'the heading on the page and the text in search results.'],
    ['', slug, 'register', String(art.register || 'articles'), 'which register the row belongs to; registers share one table and are filtered by this.'],
    ['', slug, 'created_at', String(art.created_at || ''), 'first write. Never changes.'],
    ['', slug, 'updated_at', String(art.updated_at || ''), 'last write. Changes on every save, including a save from this sheet.'],
    ['', slug, 'body chars', String(body.length), 'the article text in markdown. This is what the page renders.'],
    ['', slug, 'body words', String(body.split(/\s+/).filter(String).length), 'length in words. Short means thin, and thin is a defect.'],
    ['', slug, 'headings', String((body.match(/^#{1,6} /gm) || []).length), 'section count from markdown headings.'],
    ['', slug, 'links', String((body.match(/\]\(/g) || []).length), 'outbound and internal links in the body.'],
    ['', slug, 'widgets', String((body.match(/<div class="[^"]*widget/g) || []).length), 'embedded widget blocks — the visual parts, not prose.'],
    ['', slug, 'claims', String(claims.length), 'graded claims attached to the article; each one carries its own evidence and can be challenged.'],
    ['', slug, 'url', BOARD_BASE + '/' + slug, 'the live page. If this 404s, the row exists but is not published.'],
    ['', slug, 'api', BOARD_BASE + '/api/articles/' + slug, 'the same object as JSON. This is what any model reads.']
  ];
  claims.slice(0, 25).forEach(function (c, i) {
    rows.push(['', slug, 'claim ' + (i + 1) + ' · ' + String(c.grade || c.status || ''),
      String(c.text || c.claim || ''), String(c.evidence || c.source || 'no evidence recorded')]);
  });
  var sh = boardSs_().getSheetByName('EXPLAIN') || boardTab_('EXPLAIN', BOARD_EXPLAIN_HEADERS);
  var start = Math.max(2, sh.getLastRow() + 2);
  sh.getRange(start, 1, rows.length, 5).setValues(rows);
  return rows.length;
}

function boardRunExplain() {
  var sh = boardSs_().getSheetByName('EXPLAIN');
  if (!sh) return { ok: false, error: 'no EXPLAIN tab' };
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, acted: 0 };
  var data = sh.getRange(2, 1, last - 1, 2).getValues();
  var acted = 0;
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim().toUpperCase() !== 'RUN') continue;
    var slug = String(data[i][1] || '').trim();
    if (!slug) continue;
    try { boardExplainInto_(slug); acted++; } catch (e) {
      sh.getRange(i + 2, 5).setValue('ERROR: ' + String(e.message || e));
    }
    sh.getRange(i + 2, 1).setValue('done');
  }
  return { ok: true, acted: acted };
}

// ---------------------------------------------------------------- one entry point

function boardSyncAll() {
  var out = {};
  var steps = [
    ['leads', boardSyncLeads],
    ['articles', function () { return boardSyncArticles({}); }],
    ['model_lab', function () { return boardSyncModelLab(true); }],
    ['model_fields', boardSyncModelFields],
    ['replies', boardSyncReplies],
    ['explain', boardSyncExplain],
    ['dispatch', function () { return boardSyncDispatch({}); }]
  ];
  for (var i = 0; i < steps.length; i++) {
    try { out[steps[i][0]] = steps[i][1](); }
    catch (e) { out[steps[i][0]] = { ok: false, error: String(e.message || e) }; }
  }
  out.sheet = 'https://docs.google.com/spreadsheets/d/' + BOARD_SHEET_ID + '/edit';
  return out;
}

/** The one-minute worker: whatever is flagged, anywhere, gets done. */
function boardTick() {
  var out = {};
  try { out.model_lab = boardRunModelLab(); } catch (e) { out.model_lab = String(e.message || e); }
  try { out.articles = boardRunArticles(); } catch (e) { out.articles = String(e.message || e); }
  try { out.explain = boardRunExplain(); } catch (e) { out.explain = String(e.message || e); }
  try { out.leads = boardRunLeads(); } catch (e) { out.leads = String(e.message || e); }
  try { out.dispatch = boardRunDispatch(); } catch (e) { out.dispatch = String(e.message || e); }
  return out;
}

/** Installs the one-minute trigger. Idempotent. */
function boardInstallTrigger() {
  var found = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'boardTick') { found++; }
  });
  if (!found) ScriptApp.newTrigger('boardTick').timeBased().everyMinutes(1).create();
  return { ok: true, existing: found, installed: found ? 0 : 1 };
}

/**
 * The CHANGE trigger — this is the mechanism. An installable onChange trigger fires on the
 * change itself, with full authorisation, so it may call UrlFetchApp. A flagged row is acted
 * on immediately; there is no minute boundary to wait for. The time-based tick stays
 * installed only as a backstop for anything changed while the script was unavailable.
 */
function boardInstallChangeTrigger() {
  var found = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'boardOnChange') found++;
  });
  if (!found) {
    ScriptApp.newTrigger('boardOnChange').forSpreadsheet(BOARD_SHEET_ID).onChange().create();
  }
  return { ok: true, handler: 'boardOnChange', existing: found, installed: found ? 0 : 1 };
}

/**
 * Fires on the change. onChange carries no range, so every runner is asked; each one returns
 * immediately when nothing on its tab is flagged, so the cost of an unrelated change is a few
 * cell reads and no HTTP.
 */
function boardOnChange(e) {
  if (e && e.changeType && ['EDIT', 'INSERT_ROW', 'OTHER', 'FORMAT'].indexOf(e.changeType) < 0) return;
  return boardTick();
}

/** Removes the onEdit trigger if one was ever installed. onChange is the mechanism. */
function boardRemoveEditTrigger() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'boardOnEdit') { ScriptApp.deleteTrigger(t); removed++; }
  });
  return { ok: true, removed: removed };
}
