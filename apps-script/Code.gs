// airunner web app — the Apps Script side of the bridge.
// Web-app URL:  not written here — GET /api/kv?key=airunner_exec with the terminal key
// Script ID:    <APPS_SCRIPT_ID>
// Default Sheet:<GOOGLE_SHEET_ID>
//
// POST {action, args} → handler. Returns JSON.
// Enable Advanced Services:  Tasks API. (Apps Script editor → Services → Tasks API)

var DEFAULT_SHEET_ID = '<GOOGLE_SHEET_ID>';

function doGet(e) {
  return json({ ok: true, msg: 'airunner up', ts: new Date().toISOString() });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = String(body.action || '');
    var args = body.args || {};
    var result;
    switch (action) {
      case 'ping':                result = { ok: true, ts: new Date().toISOString() }; break;

      case 'sheets_replace_tab':  result = sheetsReplaceTab(args); break;
      case 'sheets_append_row':   result = sheetsAppendRow(args); break;
      case 'sheets_append_rows':  result = sheetsAppendRows(args); break;
      case 'sheets_get':          result = sheetsGet(args); break;
      case 'sheets_list_tabs':    result = sheetsListTabs(args); break;
      case 'sheets_set_range':    result = sheetsSetRange(args); break;
      case 'sheets_create':       result = sheetsCreate(args); break;
      case 'sheets_chart':        result = sheetsChart(args); break;

      // The build on the owner's sheet — five tabs, row-as-button. See BuildBoard.gs.
      case 'board_set_key':      result = boardSetKey(args); break;
      case 'board_sync':          result = boardSyncAll(); break;
      case 'board_sync_leads':    result = boardSyncLeads(); break;
      case 'board_sync_articles': result = boardSyncArticles(args); break;
      case 'board_sync_lab':      result = boardSyncModelLab(args && args.keep !== false); break;
      case 'board_sync_fields':   result = boardSyncModelFields(); break;
      case 'board_sync_replies': result = boardSyncReplies(); break;
      case 'board_sync_dispatch': result = boardSyncDispatch(args); break;
      case 'board_run_dispatch':  result = boardRunDispatch(); break;
      case 'board_tick':          result = boardTick(); break;
      case 'board_install_change': result = boardInstallChangeTrigger(); break;
      case 'board_remove_edit':    result = boardRemoveEditTrigger(); break;
      case 'board_install':       result = boardInstallTrigger(); break;

      case 'drive_list':          result = driveList(args); break;
      case 'drive_get':           result = driveGet(args); break;
      case 'drive_search':        result = driveSearch(args); break;

      case 'tasks_list':          result = tasksList(args); break;
      case 'tasks_add':           result = tasksAdd(args); break;
      case 'tasks_lists_all':     result = tasksListsAll(args); break;
      case 'tasks_delete':        result = tasksDelete(args); break;
      case 'tasks_delete_all':    result = tasksDeleteAll(args); break;
      case 'tasks_patch':         result = tasksPatch(args); break;

      case 'calendar_list':       result = calendarList(args); break;
      case 'calendar_create':     result = calendarCreate(args); break;

      case 'drive_upload':        result = driveUpload(args); break;
      case 'drive_mkdir':         result = driveMkdir(args); break;
      case 'drive_move':          result = driveMove(args); break;
      case 'drive_move_query':    result = driveMoveQuery(args); break;
      case 'eagle_import_one':    result = eagleImportOne(args); break;
      case 'eagle_build_sheet':   eagleBuildSheet(); result = { ok: true, tab: 'EAGLE_IMAGES' }; break;
      case 'eagle_generate':      eagleGenerateFlagged(); result = { ok: true }; break;
      case 'eagle_text':          eagleTextFlagged(); result = { ok: true }; break;
      case 'eagle_open':          result = eagleOpenSheet(); break;
      case 'eagle_set_previews':  result = eagleSetPreviews(args); break;
      case 'eagle_update_row':    result = eagleUpdateRow(args); break;
      case 'eagle_get_rows':      result = eagleGetRows(args); break;

      default: result = { ok: false, error: 'unknown_action:' + action };
    }
    return json(result);
  } catch (err) {
    return json({ ok: false, error: String(err && err.stack || err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheetsReplaceTab(args) {
  var ss = SpreadsheetApp.openById(args.sheet_id || DEFAULT_SHEET_ID);
  var tab = args.tab;
  if (!tab) throw new Error('tab required');
  var sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
  sh.clear();
  var headers = args.headers || [];
  var rows = args.rows || [];
  if (headers.length) sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  if (rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  sh.setFrozenRows(headers.length ? 1 : 0);
  sheetImagePreviews_(sh, headers);
  return { ok: true, tab: tab, rows: rows.length };
}

/** Set =IMAGE() in preview columns from matching url columns. */
function sheetImagePreviews_(sh, headers) {
  if (!sh || !headers || !headers.length) return;
  var idx = {};
  for (var i = 0; i < headers.length; i++) idx[String(headers[i])] = i;
  var pairs = [
    ['source_preview', 'ref_url'],
    ['gen_preview', 'gen_url'],
    ['preview_916', 'url_916'],
    ['preview_1x1', 'url_1x1']
  ];
  var last = sh.getLastRow();
  if (last < 2) return;
  var data = sh.getRange(2, 1, last, headers.length).getValues();
  for (var r = 0; r < data.length; r++) {
    for (var p = 0; p < pairs.length; p++) {
      var prevI = idx[pairs[p][0]];
      var urlI = idx[pairs[p][1]];
      if (prevI == null || urlI == null) continue;
      var url = String(data[r][urlI] || '').trim();
      if (url.indexOf('http') === 0) {
        sh.getRange(r + 2, prevI + 1).setFormula('=IMAGE("' + url.replace(/"/g, '') + '",1)');
      }
    }
  }
  try {
    sh.setRowHeights(2, Math.max(1, data.length), 140);
    for (var c = 0; c < pairs.length; c++) {
      var col = idx[pairs[c][0]];
      if (col != null) sh.setColumnWidth(col + 1, 160);
    }
  } catch (e) {}
}

function sheetsAppendRow(args) {
  var ss = SpreadsheetApp.openById(args.sheet_id || DEFAULT_SHEET_ID);
  var tab = args.tab || 'LOG';
  var sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
  sh.appendRow(args.values || []);
  return { ok: true, tab: tab };
}

function sheetsAppendRows(args) {
  var ss = SpreadsheetApp.openById(args.sheet_id || DEFAULT_SHEET_ID);
  var tab = args.tab;
  if (!tab) throw new Error('tab required');
  var sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
  var rows = args.rows || [];
  if (!rows.length) return { ok: true, tab: tab, rows: 0 };
  var width = 0;
  for (var i = 0; i < rows.length; i++) if (rows[i].length > width) width = rows[i].length;
  for (var j = 0; j < rows.length; j++) while (rows[j].length < width) rows[j].push('');
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, width).setValues(rows);
  return { ok: true, tab: tab, rows: rows.length, last_row: sh.getLastRow() };
}

/**
 * Resolves a range against a NAMED tab. Without this, ss.getRange("A1:B2") silently resolves
 * against whatever sheet happens to be active, so a caller asking for DISPATCH could be handed
 * ARTICLES with no error and no way to tell. A wrong-sheet read that looks successful is worse
 * than a failure, so an unknown tab now throws.
 */
function tabRange_(ss, tab, range) {
  if (!tab) return ss.getRange(range);
  var sh = ss.getSheetByName(tab);
  if (!sh) throw new Error('no tab named "' + tab + '" — tabs are: ' +
    ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
  return sh.getRange(range);
}

function sheetsGet(args) {
  var ss = SpreadsheetApp.openById(args.sheet_id || DEFAULT_SHEET_ID);
  var range = args.range;
  if (!range) throw new Error('range required');
  var r = tabRange_(ss, args.tab, range);
  return { ok: true, tab: args.tab || r.getSheet().getName(), range: range, values: r.getValues() };
}

/** Write a rectangle of values into any sheet. args: {sheet_id, range, values:[[...]]} */
function sheetsSetRange(args) {
  var ss = SpreadsheetApp.openById(args.sheet_id || DEFAULT_SHEET_ID);
  if (!args.range) throw new Error('range required');
  var vals = args.values || [];
  if (!vals.length) throw new Error('values required');
  var r = tabRange_(ss, args.tab, args.range);
  r.setValues(vals);
  return { ok: true, tab: args.tab || r.getSheet().getName(), range: args.range, rows: vals.length };
}

function sheetsListTabs(args) {
  var ss = SpreadsheetApp.openById(args.sheet_id || DEFAULT_SHEET_ID);
  return { ok: true, url: ss.getUrl(), tabs: ss.getSheets().map(function (s) { return { name: s.getName(), gid: s.getSheetId(), rows: s.getLastRow(), cols: s.getLastColumn() }; }) };
}

function driveList(args) {
  var iter;
  if (args.folder_id) iter = DriveApp.getFolderById(args.folder_id).getFiles();
  else iter = DriveApp.searchFiles(args.q || 'trashed = false');
  var out = [];
  while (iter.hasNext() && out.length < 100) {
    var f = iter.next();
    out.push({ id: f.getId(), name: f.getName(), mime: f.getMimeType(), updated: f.getLastUpdated().toISOString(), url: f.getUrl() });
  }
  return { ok: true, count: out.length, files: out };
}

function driveSearch(args) {
  var iter = DriveApp.searchFiles(args.q || 'trashed = false');
  var out = [];
  while (iter.hasNext() && out.length < (args.limit || 50)) {
    var f = iter.next();
    out.push({ id: f.getId(), name: f.getName(), mime: f.getMimeType(), updated: f.getLastUpdated().toISOString() });
  }
  return { ok: true, files: out };
}

function driveGet(args) {
  var f = DriveApp.getFileById(args.file_id);
  return { ok: true, name: f.getName(), mime: f.getMimeType(), updated: f.getLastUpdated().toISOString(), text: f.getBlob().getDataAsString() };
}

function driveUpload(args) {
  return eagleImportOne({ name: args.name, base64: args.base64 });
}

/** Create a folder. args: {name, parent_id?}. Returns the existing one if a child of that
 *  name is already there, so calling this twice never leaves two folders with one name. */
function driveMkdir(args) {
  var name = args.name;
  if (!name) throw new Error('name required');
  var parent = args.parent_id ? DriveApp.getFolderById(args.parent_id) : DriveApp.getRootFolder();
  var have = parent.getFoldersByName(name);
  if (have.hasNext()) { var e = have.next(); return { ok: true, id: e.getId(), name: name, created: false, url: e.getUrl() }; }
  var f = parent.createFolder(name);
  return { ok: true, id: f.getId(), name: name, created: true, url: f.getUrl() };
}

/** Move files into a folder. args: {file_ids: [..], folder_id}. A bound Apps Script project
 *  has no Drive parent of its own — moving its container sheet moves the script with it. */
function driveMove(args) {
  var ids = args.file_ids || (args.file_id ? [args.file_id] : []);
  if (!ids.length) throw new Error('file_ids required');
  var dest = DriveApp.getFolderById(args.folder_id);
  var moved = [], failed = [];
  for (var i = 0; i < ids.length; i++) {
    try { var f = DriveApp.getFileById(ids[i]); f.moveTo(dest); moved.push({ id: ids[i], name: f.getName() }); }
    catch (e) { failed.push({ id: ids[i], error: String(e && e.message || e) }); }
  }
  return { ok: failed.length === 0, moved: moved.length, failed: failed, files: moved };
}

/** Move everything a Drive query matches. args: {q, folder_id, limit?}. Use for sweeps
 *  ("every sheet whose name starts X into the archive") so the caller never has to page ids. */
function driveMoveQuery(args) {
  if (!args.q) throw new Error('q required');
  var dest = DriveApp.getFolderById(args.folder_id);
  var iter = DriveApp.searchFiles(args.q);
  var limit = args.limit || 500;
  var moved = [], failed = [];
  while (iter.hasNext() && moved.length < limit) {
    var f = iter.next();
    if (f.getId() === args.folder_id) continue;
    try { var n = f.getName(); f.moveTo(dest); moved.push({ id: f.getId(), name: n }); }
    catch (e) { failed.push({ id: f.getId(), error: String(e && e.message || e) }); }
  }
  return { ok: true, moved: moved.length, failed: failed, more: iter.hasNext(), files: moved.slice(0, 50) };
}

function tasksList(args) {
  var lists = (Tasks.Tasklists.list().items) || [];
  var lid = args.list_id || (lists[0] && lists[0].id);
  if (!lid) return { ok: false, error: 'no_task_lists' };
  var items = ((Tasks.Tasks.list(lid).items) || []).map(function (t) {
    return { id: t.id, title: t.title, status: t.status, due: t.due || null, notes: t.notes || null };
  });
  return { ok: true, list_id: lid, items: items };
}

function tasksAdd(args) {
  var lists = (Tasks.Tasklists.list().items) || [];
  var lid = args.list_id || (lists[0] && lists[0].id);
  if (!lid) return { ok: false, error: 'no_task_lists' };
  var t = Tasks.Tasks.insert({ title: args.title || 'Untitled', notes: args.notes || '' }, lid);
  return { ok: true, id: t.id, list_id: lid };
}

function tasksListsAll(args) {
  var lists = (Tasks.Tasklists.list().items) || [];
  return { ok: true, lists: lists.map(function (l) { return { id: l.id, title: l.title, updated: l.updated || null }; }) };
}

function tasksDelete(args) {
  var lists = (Tasks.Tasklists.list().items) || [];
  var lid = args.list_id || (lists[0] && lists[0].id);
  if (!lid) return { ok: false, error: 'no_task_lists' };
  if (!args.id) return { ok: false, error: 'no_task_id' };
  Tasks.Tasks.remove(lid, args.id);
  return { ok: true, list_id: lid, id: args.id };
}

function tasksDeleteAll(args) {
  var lists = (Tasks.Tasklists.list().items) || [];
  var lid = args.list_id || (lists[0] && lists[0].id);
  if (!lid) return { ok: false, error: 'no_task_lists' };
  var items = (Tasks.Tasks.list(lid, { maxResults: 100, showCompleted: true, showHidden: true }).items) || [];
  var deleted = [];
  for (var i = 0; i < items.length; i++) {
    try { Tasks.Tasks.remove(lid, items[i].id); deleted.push({ id: items[i].id, title: items[i].title }); } catch (e) {}
  }
  return { ok: true, list_id: lid, count: deleted.length, deleted: deleted };
}

function tasksPatch(args) {
  var lists = (Tasks.Tasklists.list().items) || [];
  var lid = args.list_id || (lists[0] && lists[0].id);
  if (!lid) return { ok: false, error: 'no_task_lists' };
  if (!args.id) return { ok: false, error: 'no_task_id' };
  var patch = {};
  if (args.title != null) patch.title = String(args.title);
  if (args.notes != null) patch.notes = String(args.notes);
  if (args.status != null) patch.status = String(args.status);
  if (args.due != null) patch.due = String(args.due);
  var t = Tasks.Tasks.patch(patch, lid, args.id);
  return { ok: true, id: t.id, list_id: lid, title: t.title };
}

function calendarList(args) {
  var cal = CalendarApp.getCalendarById(args.calendar_id || 'primary');
  var startD = args.start ? new Date(args.start) : new Date();
  var endD = new Date(startD.getTime() + 7 * 24 * 3600 * 1000);
  var events = cal.getEvents(startD, endD).slice(0, 50).map(function (e) {
    return { id: e.getId(), title: e.getTitle(), start: e.getStartTime().toISOString(), end: e.getEndTime().toISOString() };
  });
  return { ok: true, events: events };
}

function calendarCreate(args) {
  var cal = CalendarApp.getCalendarById(args.calendar_id || 'primary');
  var e = cal.createEvent(args.title, new Date(args.start), new Date(args.end));
  return { ok: true, id: e.getId() };
}

// ---------------------------------------------------------------------------
// Sheets: create a new spreadsheet, and plot a native chart on a tab.
// Added 2026-09-02. Before this, the build could write cells but could not
// make a new workbook or draw anything — every "plot it on a sheet" request
// ended in a pasted table. These two actions close that gap.
// ---------------------------------------------------------------------------

// sheets_create {title, folder_id?, tabs?:[names]} -> {sheet_id, url, tabs}
function sheetsCreate(args) {
  if (!args || !args.title) throw new Error('sheets_create: title required');
  var ss = SpreadsheetApp.create(String(args.title));
  var id = ss.getId();
  if (args.folder_id) {
    var f = DriveApp.getFileById(id);
    DriveApp.getFolderById(String(args.folder_id)).addFile(f);
    DriveApp.getRootFolder().removeFile(f);
  }
  var made = [];
  var tabs = args.tabs || [];
  for (var i = 0; i < tabs.length; i++) {
    var name = String(tabs[i]);
    if (i === 0) { ss.getSheets()[0].setName(name); }
    else { ss.insertSheet(name); }
    made.push(name);
  }
  return { sheet_id: id, url: ss.getUrl(), tabs: made.length ? made : [ss.getSheets()[0].getName()] };
}

// sheets_chart {sheet_id, tab, type?, range:"A1:C500", title?, anchor_row?, anchor_col?,
//               x_title?, y_title?, series_colors?:[], replace?:true, log_scale?:false}
// type: LINE (default) | COLUMN | BAR | AREA | SCATTER | PIE | COMBO
function sheetsChart(args) {
  if (!args || !args.sheet_id) throw new Error('sheets_chart: sheet_id required');
  if (!args.tab)   throw new Error('sheets_chart: tab required');
  if (!args.range) throw new Error('sheets_chart: range required');
  var ss = SpreadsheetApp.openById(String(args.sheet_id));
  var sh = ss.getSheetByName(String(args.tab));
  if (!sh) throw new Error('sheets_chart: no such tab: ' + args.tab);

  if (args.replace !== false) {
    var old = sh.getCharts();
    for (var i = 0; i < old.length; i++) sh.removeChart(old[i]);
  }

  var types = {
    LINE: Charts.ChartType.LINE, COLUMN: Charts.ChartType.COLUMN,
    BAR: Charts.ChartType.BAR, AREA: Charts.ChartType.AREA,
    SCATTER: Charts.ChartType.SCATTER, PIE: Charts.ChartType.PIE,
    COMBO: Charts.ChartType.COMBO
  };
  var t = types[String(args.type || 'LINE').toUpperCase()] || Charts.ChartType.LINE;

  var b = sh.newChart().setChartType(t)
            .addRange(sh.getRange(String(args.range)))
            .setPosition(Number(args.anchor_row || 2), Number(args.anchor_col || 8), 0, 0)
            .setOption('width',  Number(args.width  || 900))
            .setOption('height', Number(args.height || 420))
            .setOption('useFirstColumnAsDomain', true)
            .setOption('legend', { position: 'bottom' });

  if (args.title)   b.setOption('title', String(args.title));
  if (args.x_title) b.setOption('hAxis', { title: String(args.x_title) });
  var v = {};
  if (args.y_title)   v.title = String(args.y_title);
  if (args.log_scale) v.logScale = true;
  if (args.y_title || args.log_scale) b.setOption('vAxis', v);
  if (args.series_colors) b.setOption('colors', args.series_colors);

  sh.insertChart(b.build());
  return { ok: true, tab: args.tab, range: args.range, type: String(args.type || 'LINE').toUpperCase(),
           charts_on_tab: sh.getCharts().length, url: ss.getUrl() };
}
