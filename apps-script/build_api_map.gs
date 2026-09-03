/**
 * MiscSubjects BUILD OPERATOR CONSOLE
 *
 * One Apps Script project, one bound Google Sheet, one Build menu.
 * Maps the live API. Lets you ask the build. Logs every request.
 * Pollable. Drive-sync capable. Prompt-test capable.
 *
 * SETUP:
 *   1. Open the bound Google Sheet → Extensions → Apps Script.
 *   2. Ensure this file (and DriveSync.gs, PromptTests.gs) are in the project.
 *   3. Set Script Property: MISC = your terminal key.
 *   4. Reload the Sheet. The Build menu appears.
 *   5. Build → Health check. Then Build → Map everything.
 *
 * REQUIRED SCRIPT PROPERTIES:
 *   MISC — your miscsubjects.com terminal key.
 *
 * OPTIONAL SCRIPT PROPERTIES:
 *   DRIVE_SYNC_FOLDER_ID — Drive folder to sync.
 *   TERMINAL_KEY — fallback for MISC (legacy).
 *
 * RULES:
 *   No hardcoded secrets. Every API call is logged to REST_LOG.
 *   The bound spreadsheet is used by default.
 */

var BASE = 'https://miscsubjects.com';
var KEY = ''; // intentionally empty; Script Property MISC wins
var MAX_CELL = 45000;

/* ────────────────── AUTH / HTTP ────────────────── */

function miscKey_() {
  var p = PropertiesService.getScriptProperties();
  return p.getProperty('MISC') || p.getProperty('TERMINAL_KEY') || KEY;
}

function hdr_() {
  var k = miscKey_();
  if (!k) throw new Error('Missing Script Property MISC');
  return { 'x-terminal-key': k, 'content-type': 'application/json' };
}

function request_(method, path, body) {
  var opt = {
    method: method,
    headers: hdr_(),
    muteHttpExceptions: true
  };
  if (body !== undefined && body !== null) {
    opt.payload = typeof body === 'string' ? body : JSON.stringify(body);
  }
  var start = Date.now();
  var res = UrlFetchApp.fetch(BASE + path, opt);
  var code = res.getResponseCode();
  var text = res.getContentText();
  var json;
  try { json = JSON.parse(text); } catch (e) { json = { _raw: text }; }
  logRequest_(method, BASE + path, opt.payload || '', code, text, Date.now() - start);
  return { ok: code >= 200 && code < 300, code: code, path: path, json: json, text: text, ms: Date.now() - start };
}

function get_(path) { return request_('get', path); }
function post_(path, body) { return request_('post', path, body); }
function patch_(path, body) { return request_('patch', path, body); }
function put_(path, body) { return request_('put', path, body); }
function del_(path) { return request_('delete', path); }

function dispatch_(key, body, shape) {
  var payload = { key: key, body: body == null ? '' : body };
  if (shape) payload.shape = true;
  return post_('/api/dispatch', payload);
}

function dispatchResult_(key, body) {
  var r = dispatch_(key, body, false);
  var out = r.json && r.json.result != null ? r.json.result : r.text;
  if (typeof out === 'string') {
    out = out.replace(/^HTTP\s+\d+\s*:/, '');
    try { return JSON.parse(out); } catch (e) { return out; }
  }
  return out;
}

function logRequest_(method, url, payload, code, text, ms) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('REST_LOG') || ss.insertSheet('REST_LOG');
  sh.appendRow([
    new Date().toISOString(),
    method,
    url,
    String(payload).slice(0, 2000),
    code,
    String(text).slice(0, 3000),
    ms
  ]);
}

/* ────────────────── SHEET HELPERS ────────────────── */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var sh = ss_().getSheetByName(name) || ss_().insertSheet(name);
  sh.clearContents();
  sh.clearFormats();
  return sh;
}

function cell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') v = JSON.stringify(v);
  v = String(v);
  if (v.length > MAX_CELL) return v.slice(0, MAX_CELL) + '\n...[truncated]';
  return v;
}

function row_(arr, n) {
  var out = [];
  for (var i = 0; i < n; i++) out.push(cell_(arr[i]));
  return out;
}

function rows_(arr, n) {
  return arr.map(function (r) { return row_(r, n); });
}

function write_(tab, headers, rows) {
  var sh = sheet_(tab);
  var w = headers.length;
  sh.getRange(1, 1, 1, w).setValues([headers]).setFontWeight('bold');
  if (rows && rows.length) {
    sh.getRange(2, 1, rows.length, w).setValues(rows_(rows, w));
  }
  sh.setFrozenRows(1);
  for (var c = 1; c <= w; c++) sh.autoResizeColumn(c);
  return sh;
}

function asRows_(d) {
  return Array.isArray(d) ? d : (d.rows || d.directory || d.data || d.items || d.articles || d.capabilities || d.entries || []);
}

function docLine_(content) {
  var lines = String(content || '').split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('#') === 0) return lines[i].replace(/^#+\s?/, '').slice(0, 200);
  }
  return '';
}

function listFrom_(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  return obj.rows || obj.directory || obj.data || obj.items || obj.articles || obj.capabilities || obj.entries || obj.files || [];
}

/* ────────────────── MENU ────────────────── */

function onOpen() {
  var menu = SpreadsheetApp.getUi().createMenu('Build');
  menu.addItem('Health check', 'healthCheck');
  menu.addItem('Map everything', 'mapEverything');
  menu.addSeparator();
  menu.addItem('Refresh API MAP', 'tabMap');
  menu.addItem('Refresh ARTICLES', 'tabArticles');
  menu.addItem('Refresh TOOLS', 'tabTools');
  menu.addItem('Refresh AGENTS', 'tabAgents');
  menu.addItem('Refresh PAGES', 'tabPages');
  menu.addItem('Refresh CONTENT', 'tabContent');
  menu.addItem('Refresh FILES', 'tabFiles');
  menu.addItem('Refresh TURNS', 'tabTurns');
  menu.addSeparator();
  menu.addItem('Ask the build (type in ASK!B1 first)', 'askBuild');
  menu.addSeparator();
  menu.addItem('Run safe article CRUD test', 'safeArticleCrudTest');
  menu.addSeparator();
  menu.addItem('Install 10-min polling trigger', 'installPollingTrigger');
  menu.addItem('Remove polling trigger', 'removePollingTrigger');
  menu.addSeparator();
  menu.addItem('Drive Sync: populate', 'populateDriveSync');
  menu.addItem('Drive Sync: poll', 'pollDriveSync');
  menu.addItem('Drive Sync: install trigger', 'installDriveSyncTrigger');
  menu.addItem('Drive Sync: remove trigger', 'removeDriveSyncTrigger');
  menu.addSeparator();
  menu.addItem('Prompt Tests: setup tab', 'setupPromptTests');
  menu.addItem('Prompt Tests: run selected', 'runPromptTest');
  menu.addItem('Prompt Tests: run all', 'runAllPromptTests');
  menu.addSeparator();
  menu.addItem('Invoke: fill column from prompt', 'fillColumnFromPrompt');
  menu.addSeparator();
  menu.addItem('Eagles: build sheet', 'eagleBuildSheet');
  menu.addItem('Eagles: generate flagged (run=x)', 'eagleGenerateFlagged');
  menu.addItem('Eagles: text flagged links', 'eagleTextFlagged');
  menu.addToUi();

  SpreadsheetApp.getUi().createMenu('Eagles')
    .addItem('Build / reset EAGLE_IMAGES tab', 'eagleBuildSheet')
    .addItem('Generate variations (good=y, run=x)', 'eagleGenerateFlagged')
    .addItem('Text me the links (text_me=x)', 'eagleTextFlagged')
    .addToUi();
}

/* ────────────────── HEALTH / MAP ────────────────── */

function healthCheck() {
  var rows = [];
  rows.push(['script_property_MISC', miscKey_() ? 'OK' : 'MISSING', miscKey_() ? 'MISC or TERMINAL_KEY is set' : 'Set Script Property MISC']);
  rows.push(['base', 'INFO', BASE]);
  var checks = [
    ['manual', '/api/manual?slim=1'],
    ['articles', '/api/articles'],
    ['directory', '/api/directory'],
    ['ledger_turns', '/admin/ledger?turns=1&limit=3'],
    ['inventory', '/api/inventory']
  ];
  for (var i = 0; i < checks.length; i++) {
    try {
      var r = get_(checks[i][1]);
      rows.push([checks[i][0], r.code, r.ok ? 'OK' : cell_(r.text).slice(0, 500)]);
    } catch (e) {
      rows.push([checks[i][0], 'ERROR', String(e)]);
    }
  }
  write_('HEALTH', ['check', 'status', 'detail'], rows);
  ss_().toast('Health check complete.');
}

function mapEverything() {
  healthCheck();
  tabMap();
  tabArticles();
  tabTools();
  tabAgents();
  tabPages();
  tabContent();
  tabFiles();
  tabTurns();
  ss_().toast('Mapped everything.');
}

/* ────────────────── API MAP ────────────────── */

function tabMap() {
  var r = get_('/api/manual?slim=1');
  var j = r.json || {};
  var s = j.surfaces || {};
  var rows = [];
  rows.push(['manual_full', 'GET', BASE + '/api/manual', '', 'Full build manual: every capability, request shape, and test shape.']);
  rows.push(['manual_slim', 'GET', BASE + '/api/manual?slim=1', '', 'Fixed surfaces and counts.']);
  Object.keys(s).sort().forEach(function (name) {
    var x = s[name] || {};
    rows.push([name, x.method || '', x.url || '', x.body ? JSON.stringify(x.body) : '', x.note || '']);
  });
  write_('API MAP', ['surface', 'method', 'url', 'body / args', 'note'], rows);
}

/* ────────────────── ARTICLES ────────────────── */

function tabArticles() {
  var r = get_('/api/articles');
  var arts = (r.json && r.json.articles) || [];
  var rows = arts.map(function (a) {
    return [
      a.slug, a.title, a.subject, a.published, a.created_at, a.updated_at,
      BASE + '/a/' + a.slug,
      'GET ' + BASE + '/api/articles/' + a.slug,
      'PATCH ' + BASE + '/api/articles/' + a.slug + '  {"title":"...","subject":"...","published":true}',
      'POST ' + BASE + '/api/articles/' + a.slug + '/set  {"slot_key":"what_it_is","content":"..."}',
      'POST ' + BASE + '/api/articles/' + a.slug + '/compose  {"slot_key":"what_it_is","brief":"..."}',
      'DELETE ' + BASE + '/api/articles/' + a.slug
    ];
  });
  rows.unshift([
    '<new>', '<title>', '<subject>', true, '', '', '', '', '', '', '',
    'CREATE: POST ' + BASE + '/api/articles  {"slug":"...","title":"...","subject":"...","published":true,"slots":{}}'
  ]);
  write_('ARTICLES', [
    'slug', 'title', 'subject', 'published', 'created', 'updated',
    'public page', 'READ', 'EDIT TITLE/SUBJECT/PUBLISHED', 'SET SLOT',
    'AI COMPOSE SLOT', 'CREATE / DELETE'
  ], rows);
}

/* ────────────────── TOOLS ────────────────── */

function tabTools() {
  var r = get_('/api/directory');
  var all = listFrom_(r.json);
  var rows = all.filter(function (r) { return r.type !== 'agent'; }).map(function (r) {
    return [
      r.key, r.type, r.category || '', String(r.target || '').slice(0, 120), docLine_(r.content),
      'POST ' + BASE + '/api/dispatch  {"key":"' + r.key + '","body":"<args>"}',
      'PATCH ' + BASE + '/api/directory/' + r.key + '  {"content":"..."}',
      'GET ' + BASE + '/api/directory/' + r.key
    ];
  });
  write_('TOOLS', ['key', 'type', 'category', 'target', 'what it does', 'RUN it', 'EDIT it', 'READ it'], rows);
}

/* ────────────────── AGENTS ────────────────── */

function tabAgents() {
  var r = get_('/api/directory?type=agent');
  var all = listFrom_(r.json);
  var rows = all.map(function (r) {
    return [
      r.key, r.target || '', r.auth || '',
      String(r.content || '').replace(/\n/g, ' ').slice(0, 240),
      'PATCH ' + BASE + '/api/directory/' + r.key + '  {"content":"<new prompt>"}',
      'PATCH ' + BASE + '/api/directory/' + r.key + '  {"target":"grok-4.3"}',
      'PATCH ' + BASE + '/api/directory/' + r.key + '  {"auth":"bearer:GROK_API_KEY"}',
      'POST ' + BASE + '/api/dispatch  {"key":"' + r.key + '","body":"<message>"}',
      'GET ' + BASE + '/api/directory/' + r.key
    ];
  });
  write_('AGENTS', [
    'key', 'model', 'key var', 'prompt preview', 'EDIT PROMPT', 'SET MODEL',
    'SET AUTH', 'RUN it', 'READ full prompt'
  ], rows);
}

/* ────────────────── PAGES ────────────────── */

function tabPages() {
  var r = get_('/api/pages');
  var pages = listFrom_(r.json);
  var rows = pages.map(function (p) {
    return [
      p.slug, p.title, p.version || '', p.updated_at || '', BASE + '/' + p.slug,
      'GET ' + BASE + '/api/pages/' + p.slug,
      'PATCH ' + BASE + '/api/pages/' + p.slug + '  {"title":"...","body_html":"..."}',
      'PUT ' + BASE + '/api/pages/' + p.slug + '  {"title":"...","body_html":"..."}',
      'DELETE ' + BASE + '/api/pages/' + p.slug
    ];
  });
  rows.unshift([
    'homepage', 'static homepage', '', '', BASE + '/',
    'GET ' + BASE + '/api/file/public/index.html',
    'PUT ' + BASE + '/api/file/public/index.html  {"content":"...","message":"edit homepage"}',
    '', ''
  ]);
  write_('PAGES', [
    'slug', 'title', 'version', 'updated', 'public url', 'READ', 'EDIT', 'CREATE/REPLACE', 'DELETE'
  ], rows);
}

/* ────────────────── CONTENT ────────────────── */

function tabContent() {
  var r = get_('/api/content?limit=3000');
  var items = (r.json && r.json.items) || listFrom_(r.json);
  var rows = items.map(function (c) {
    return [
      c.slug, c.type, c.title, c.section || '', c.status || '', c.updated_at || '',
      c.tags ? JSON.stringify(c.tags) : '',
      'GET ' + BASE + '/api/content/' + c.slug,
      'PATCH ' + BASE + '/api/content/' + c.slug + '  {"body_md":"..."}',
      'POST ' + BASE + '/api/content  {"slug":"...","type":"...","title":"...","body_md":"...","tags":[]}',
      'DELETE ' + BASE + '/api/content/' + c.slug
    ];
  });
  write_('CONTENT', [
    'slug', 'type', 'title', 'section', 'status', 'updated', 'tags',
    'READ', 'EDIT', 'CREATE', 'DELETE'
  ], rows);
}

/* ────────────────── FILES ────────────────── */

function tabFiles() {
  var fl = dispatchResult_('FILE_LIST', '');
  var entries = (fl && fl.entries) || [];
  var rows = entries.map(function (f) {
    return [
      f.path, f.size || '',
      'GET ' + BASE + '/api/file/' + f.path,
      'PUT ' + BASE + '/api/file/' + f.path + '  {"content":"...","message":"..."}',
      'DELETE ' + BASE + '/api/file/' + f.path
    ];
  });
  write_('FILES', ['path', 'size', 'READ', 'EDIT/CREATE (commits to main)', 'DELETE'], rows);
}

/* ────────────────── TURNS ────────────────── */

function tabTurns() {
  var r = get_('/admin/ledger?turns=1&limit=200');
  var turns = (r.json && r.json.turns) || [];
  var rows = turns.map(function (t) {
    return [
      t.ts, t.channel || '', t.message || '',
      (t.tools || []).map(function (x) { return x.key; }).join(', '),
      t.routed || '', t.reply || '', t.trace_id || '',
      'GET ' + BASE + '/admin/ledger?turns=1&trace_id=' + encodeURIComponent(t.trace_id || ''),
      'GET ' + BASE + '/admin/trace?trace=' + encodeURIComponent(t.trace_id || '')
    ];
  });
  write_('TURNS', [
    'when', 'channel', 'you texted', 'tools it ran', 'routed to', 'build replied',
    'trace', 'TURN JSON', 'RAW TRACE'
  ], rows);
}

/* ────────────────── ASK ────────────────── */

function askBuild() {
  var sh = ss_().getSheetByName('ASK') || ss_().insertSheet('ASK');
  if (!String(sh.getRange('A1').getValue()).match(/Type your message/)) {
    sh.clear();
    sh.getRange('A1').setValue('Type your message to the build in B1, then run Build → Ask the build').setFontWeight('bold');
    sh.getRange('A2').setValue('Reply:'); sh.getRange('A3').setValue('Tools it ran:'); sh.getRange('A4').setValue('Trace:');
    sh.autoResizeColumn(1); sh.autoResizeColumn(2);
    ss_().toast('ASK tab ready — type a message in B1 and run Ask the build again.');
    return;
  }
  var msg = String(sh.getRange('B1').getValue() || '').trim();
  if (!msg) { ss_().toast('Type a message in B1 first.'); return; }
  var input = '[channel sheet 1:1 · from the owner (owner)]\nNow: ' + msg;
  var r = post_('/api/dispatch', { key: 'ROUTER', body: input });
  var out = String((r.json && r.json.result) || r.text || '');
  var m = out.match(/\[REPLY\]([\s\S]*?)\[\/REPLY\]/);
  var reply = m ? m[1].trim() : out.replace(/\[\/?[A-Z_]+\]/g, '').trim();
  sh.getRange('B2').setValue(cell_(reply));
  sh.getRange('B4').setValue((r.json && r.json.trace) || '');
  if (r.json && r.json.trace) {
    var td = get_('/admin/ledger?turns=1&trace_id=' + encodeURIComponent(r.json.trace));
    var t = (td.json && td.json.turns && td.json.turns[0]);
    if (t) sh.getRange('B3').setValue((t.tools || []).map(function (x) { return x.key; }).join(', '));
  }
  ss_().toast('Asked the build. See ASK!B2 for the reply.');
}

/* ────────────────── POLLING ────────────────── */

function installPollingTrigger() {
  removePollingTrigger();
  ScriptApp.newTrigger('mapEverything').timeBased().everyMinutes(10).create();
  ss_().toast('Installed 10-minute polling trigger.');
}

function removePollingTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'mapEverything') {
      ScriptApp.deleteTrigger(triggers[i]); removed++;
    }
  }
  ss_().toast('Removed ' + removed + ' polling trigger(s).');
}

/* ────────────────── SAFE CRUD TEST ────────────────── */

function safeArticleCrudTest() {
  var slug = 'gas-test-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  var title1 = 'GAS Test Article';
  var title2 = 'GAS Test Article Updated';
  var rows = [];
  try {
    var create = post_('/api/articles', {
      slug: slug, title: title1, subject: 'GAS API test',
      published: false,
      slots: { what_it_is: 'Temporary test article created by Google Apps Script.' }
    });
    rows.push(['create', create.code, create.text]);

    var read1 = get_('/api/articles/' + slug);
    rows.push(['read_after_create', read1.code, read1.text]);

    var patch = patch_('/api/articles/' + slug, { title: title2, subject: 'GAS API test updated', published: false });
    rows.push(['patch_title', patch.code, patch.text]);

    var setSlot = post_('/api/articles/' + slug + '/set', {
      slot_key: 'mechanism',
      content: 'This slot was set by Google Apps Script as a harmless API test.'
    });
    rows.push(['set_slot', setSlot.code, setSlot.text]);

    var read2 = get_('/api/articles/' + slug);
    rows.push(['read_after_patch', read2.code, read2.text]);

    var del = del_('/api/articles/' + slug);
    rows.push(['delete', del.code, del.text]);

    var read3 = get_('/api/articles/' + slug);
    rows.push(['read_after_delete_should_404', read3.code, read3.text]);
  } catch (e) {
    rows.push(['error', 'ERROR', String(e && e.stack || e)]);
  }
  write_('CRUD TEST', ['step', 'status', 'response'], rows);
  ss_().toast('Safe article CRUD test complete. See CRUD TEST tab.');
}
