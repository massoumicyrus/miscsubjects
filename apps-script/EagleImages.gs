/**
 * EagleImages.gs — eagle1–eagle25 review, previews, GPT variations, iMessage.
 */

var EAGLE_SHEET_ID = '<GOOGLE_SHEET_ID>';
var EAGLE_TAB = 'EAGLE_IMAGES';
var EAGLE_PHONE = '[OWNER_PHONE]';
var EAGLE_DEFAULT_PROMPT =
  'Create a new creative variation of this eagle image. Keep the same subject, pose, and overall style. Apply subtle but meaningful changes in lighting, background, or detail.';

var EAGLE_HEAD = [
  'name', 'source_preview', 'ref_url', 'good', 'what_it_is', 'variation_prompt',
  'gen_preview', 'gen_url', 'run', 'text_me', 'status'
];

function eagleSs_() {
  return SpreadsheetApp.openById(EAGLE_SHEET_ID);
}

function eagleSh_() {
  var ss = eagleSs_();
  return ss.getSheetByName(EAGLE_TAB) || ss.insertSheet(EAGLE_TAB);
}

function eagleImgFormula_(url) {
  if (!url) return '';
  return '=IMAGE("' + String(url).replace(/"/g, '') + '",1)';
}

function eagleSetPreviewsOnSheet_(sh) {
  if (!sh) return;
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return;
  var head = data[0];
  var idx = {};
  for (var i = 0; i < head.length; i++) idx[String(head[i])] = i;
  var pairs = [
    ['source_preview', 'ref_url'],
    ['gen_preview', 'gen_url'],
    ['preview_916', 'url_916'],
    ['preview_1x1', 'url_1x1']
  ];
  for (var r = 1; r < data.length; r++) {
    for (var p = 0; p < pairs.length; p++) {
      var prevI = idx[pairs[p][0]];
      var urlI = idx[pairs[p][1]];
      if (prevI == null || urlI == null) continue;
      var url = String(data[r][urlI] || '').trim();
      if (url.indexOf('http') === 0) sh.getRange(r + 1, prevI + 1).setFormula(eagleImgFormula_(url));
    }
  }
  try {
    sh.setRowHeights(2, Math.max(1, data.length - 1), 140);
    for (var c = 0; c < pairs.length; c++) {
      var col = idx[pairs[c][0]];
      if (col != null) sh.setColumnWidth(col + 1, 160);
    }
  } catch (e) {}
}

function eagleSetPreviews(args) {
  var ss = SpreadsheetApp.openById(args.sheet_id || EAGLE_SHEET_ID);
  var sh = ss.getSheetByName(args.tab || EAGLE_TAB);
  if (!sh) return { ok: false, error: 'no EAGLE_IMAGES tab' };
  eagleSetPreviewsOnSheet_(sh);
  return { ok: true, tab: sh.getName(), rows: sh.getLastRow() - 1 };
}

function eagleGetRows(args) {
  var sh = eagleSh_();
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return { ok: true, rows: [] };
  var head = data[0];
  var out = [];
  for (var r = 1; r < data.length; r++) {
    var row = {};
    for (var c = 0; c < head.length; c++) row[String(head[c])] = data[r][c];
    out.push(row);
  }
  return { ok: true, rows: out, sheet_url: eagleSs_().getUrl() + '#gid=' + sh.getSheetId() };
}

function eagleUpdateRow(args) {
  var name = String(args.name || '').trim().replace(/\.png$/i, '');
  if (!name) return { ok: false, error: 'name required' };
  var sh = eagleSh_();
  var data = sh.getDataRange().getValues();
  var head = data[0];
  var idx = {};
  for (var i = 0; i < head.length; i++) idx[String(head[i])] = i;
  var rowNum = -1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idx.name]) === name) { rowNum = r + 1; break; }
  }
  if (rowNum < 0) return { ok: false, error: 'unknown eagle: ' + name };

  if (args.good != null) sh.getRange(rowNum, idx.good + 1).setValue(String(args.good).toLowerCase() === 'y' ? 'y' : 'n');
  if (args.what_it_is != null) sh.getRange(rowNum, idx.what_it_is + 1).setValue(String(args.what_it_is));
  if (args.variation_prompt != null) sh.getRange(rowNum, idx.variation_prompt + 1).setValue(String(args.variation_prompt));
  if (args.run != null) sh.getRange(rowNum, idx.run + 1).setValue(String(args.run).toLowerCase() === 'x' ? 'x' : '');
  if (args.gen_url != null) {
    sh.getRange(rowNum, idx.gen_url + 1).setValue(String(args.gen_url));
    if (idx.gen_preview != null) sh.getRange(rowNum, idx.gen_preview + 1).setFormula(eagleImgFormula_(args.gen_url));
  }
  if (args.url_916 != null) {
    sh.getRange(rowNum, idx.url_916 + 1).setValue(String(args.url_916));
    if (idx.preview_916 != null) sh.getRange(rowNum, idx.preview_916 + 1).setFormula(eagleImgFormula_(args.url_916));
  }
  if (args.url_1x1 != null) {
    sh.getRange(rowNum, idx.url_1x1 + 1).setValue(String(args.url_1x1));
    if (idx.preview_1x1 != null) sh.getRange(rowNum, idx.preview_1x1 + 1).setFormula(eagleImgFormula_(args.url_1x1));
  }
  if (args.good_916 != null) sh.getRange(rowNum, idx.good_916 + 1).setValue(String(args.good_916).toLowerCase() === 'y' ? 'y' : 'n');
  if (args.good_1x1 != null) sh.getRange(rowNum, idx.good_1x1 + 1).setValue(String(args.good_1x1).toLowerCase() === 'y' ? 'y' : 'n');
  if (args.ref_url != null) {
    sh.getRange(rowNum, idx.ref_url + 1).setValue(String(args.ref_url));
    if (idx.source_preview != null) sh.getRange(rowNum, idx.source_preview + 1).setFormula(eagleImgFormula_(args.ref_url));
  }
  if (args.status != null) sh.getRange(rowNum, idx.status + 1).setValue(String(args.status));
  return { ok: true, name: name, row: rowNum };
}

function eagleStoreRef_(exportUrl) {
  var out = dispatchResult_('STORE_REF_IMAGE', String(exportUrl || ''));
  if (typeof out === 'string') { try { out = JSON.parse(out); } catch (e) {} }
  return out && out.url ? out.url : '';
}

function eagleWrite_(headers, rows) {
  var sh = eagleSh_();
  sh.clearContents();
  sh.clearFormats();
  var w = headers.length;
  sh.getRange(1, 1, 1, w).setValues([headers]).setFontWeight('bold');
  if (rows && rows.length) sh.getRange(2, 1, rows.length, w).setValues(rows_(rows, w));
  sh.setFrozenRows(1);
  for (var c = 1; c <= w; c++) sh.autoResizeColumn(c);
  eagleSetPreviewsOnSheet_(sh);
  return sh;
}

function eagleBuildSheet() {
  var rows = [];
  for (var n = 1; n <= 25; n++) {
    rows.push(['eagle' + n, '', '', 'n', '', EAGLE_DEFAULT_PROMPT, '', '', '', '', 'waiting for sync']);
  }
  var sh = eagleWrite_(EAGLE_HEAD, rows);
  sh.getRange(2, 4, 26, 4).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['y', 'n'], true).build());
  sh.getRange(2, 9, 26, 9).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['x', ''], true).build());
  sh.getRange(2, 10, 26, 10).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['x', ''], true).build());
  sh.setColumnWidth(5, 280);
  sh.setColumnWidth(6, 360);
  eagleSs_().toast('EAGLE_IMAGES ready.');
}

function eagleImportOne(args) {
  var name = String(args.name || '').trim();
  var base64 = String(args.base64 || '');
  if (!name || !base64) return { ok: false, error: 'name and base64 required' };
  var folderId = PropertiesService.getScriptProperties().getProperty('EAGLE_DRIVE_FOLDER_ID') || '';
  var refUrl = '';
  if (folderId) {
    try {
      var folder = DriveApp.getFolderById(folderId);
      var filename = name.match(/\.png$/i) ? name : name + '.png';
      var blob = Utilities.newBlob(Utilities.base64Decode(base64), 'image/png', filename);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      refUrl = eagleStoreRef_('https://drive.google.com/uc?export=download&id=' + file.getId());
    } catch (e) {}
  }
  if (!refUrl && args.ref_url) refUrl = String(args.ref_url);
  return eagleUpdateRow({ name: name.replace(/\.png$/i, ''), ref_url: refUrl, status: 'synced' });
}

function eagleGenerateFlagged() {
  var sh = eagleSh_();
  if (sh.getLastRow() < 2) { eagleSs_().toast('Build sheet first.'); return; }
  var data = sh.getDataRange().getValues();
  var head = data[0];
  var idx = {};
  for (var i = 0; i < head.length; i++) idx[String(head[i])] = i;
  var n = 0;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idx.run] || '').toLowerCase() !== 'x') continue;
    if (String(data[r][idx.good] || '').toLowerCase() !== 'y') {
      sh.getRange(r + 1, idx.status + 1).setValue('mark good=y first');
      sh.getRange(r + 1, idx.run + 1).setValue('');
      continue;
    }
    var ref = String(data[r][idx.ref_url] || '').trim();
    if (!ref) {
      sh.getRange(r + 1, idx.status + 1).setValue('missing ref_url');
      sh.getRange(r + 1, idx.run + 1).setValue('');
      continue;
    }
    var prompt = String(data[r][idx.variation_prompt] || EAGLE_DEFAULT_PROMPT).trim();
    var what = String(data[r][idx.what_it_is] || '').trim();
    if (what) prompt = what + '. ' + prompt;
    sh.getRange(r + 1, idx.status + 1).setValue('generating…');
    SpreadsheetApp.flush();
    try {
      var out = dispatchResult_('OPENAI_IMAGE_EDIT', prompt + '|' + ref + '|1024x1024');
      if (typeof out === 'string') { try { out = JSON.parse(out); } catch (e) {} }
      var url = out && out.url ? out.url : String(out || '');
      if (url.indexOf('http') === 0) {
        eagleUpdateRow({ name: String(data[r][idx.name]), gen_url: url, status: 'done' });
        dispatchResult_('SEND_IMAGE_BLOOIO', EAGLE_PHONE + '|' + String(data[r][idx.name]) + ' variation|' + url);
        n++;
      } else {
        sh.getRange(r + 1, idx.status + 1).setValue(String(url).slice(0, 300));
      }
    } catch (e) {
      sh.getRange(r + 1, idx.status + 1).setValue('error: ' + String(e).slice(0, 200));
    }
    sh.getRange(r + 1, idx.run + 1).setValue('');
  }
  eagleSs_().toast('Generated ' + n + ' variation(s).');
}

function eagleTextFlagged() {
  var sh = eagleSh_();
  var data = sh.getDataRange().getValues();
  var head = data[0];
  var idx = {};
  for (var i = 0; i < head.length; i++) idx[String(head[i])] = i;
  var sent = 0;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idx.text_me] || '').toLowerCase() !== 'x') continue;
    var name = String(data[r][idx.name] || '');
    var url = String(data[r][idx.gen_url] || data[r][idx.ref_url] || '').trim();
    if (!url) {
      sh.getRange(r + 1, idx.status + 1).setValue('nothing to text');
      sh.getRange(r + 1, idx.text_me + 1).setValue('');
      continue;
    }
    try {
      dispatchResult_('SEND_IMAGE_BLOOIO', EAGLE_PHONE + '|' + name + '|' + url);
      sh.getRange(r + 1, idx.status + 1).setValue('texted');
      sent++;
    } catch (e) {
      sh.getRange(r + 1, idx.status + 1).setValue('text fail');
    }
    sh.getRange(r + 1, idx.text_me + 1).setValue('');
  }
  eagleSs_().toast('Texted ' + sent + ' image(s).');
}

function eagleOpenSheet() {
  var sh = eagleSh_();
  return { ok: true, url: eagleSs_().getUrl() + '#gid=' + sh.getSheetId() };
}