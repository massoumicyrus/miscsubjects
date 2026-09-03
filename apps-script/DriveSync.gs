/**
 * DriveSync.gs — Drive folder sync for the MiscSubjects operator console.
 *
 * Maps one Google Drive folder into a DRIVE_SYNC tab.
 * Supports sync-to-GitHub and sync-to-Cloudflare via the build API.
 *
 * REQUIRED SCRIPT PROPERTIES:
 *   DRIVE_SYNC_FOLDER_ID — the Drive folder ID to sync.
 *
 * OPTIONAL SCRIPT PROPERTIES:
 *   GITHUB_TOKEN — if syncing to GitHub via /api/file
 *   CF_TOKEN / CF_ACCOUNT — if syncing to Cloudflare via /api/r2
 */

function getDriveSyncFolderId_() {
  return PropertiesService.getScriptProperties().getProperty('DRIVE_SYNC_FOLDER_ID') || '';
}

function populateDriveSync() {
  var folderId = getDriveSyncFolderId_();
  if (!folderId) {
    ss_().toast('Set Script Property DRIVE_SYNC_FOLDER_ID first.');
    return;
  }
  var folder;
  try { folder = DriveApp.getFolderById(folderId); } catch (e) {
    ss_().toast('Cannot open Drive folder: ' + e);
    return;
  }
  var rows = [];
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    rows.push([
      f.getId(),
      f.getName(),
      f.getMimeType(),
      f.getLastUpdated().toISOString(),
      f.getUrl(),
      '', // local_path
      '', // github_path
      '', // cf_path
      'pending',
      ''
    ]);
  }
  write_('DRIVE_SYNC', [
    'drive_id', 'name', 'mime_type', 'updated', 'drive_url',
    'local_path', 'github_path', 'cf_path', 'sync_status', 'sync_response'
  ], rows);
  ss_().toast('Drive Sync populated: ' + rows.length + ' files.');
}

function pollDriveSync() {
  var sh = ss_().getSheetByName('DRIVE_SYNC');
  if (!sh) { ss_().toast('Run Drive Sync: populate first.'); return; }
  var folderId = getDriveSyncFolderId_();
  if (!folderId) { ss_().toast('Set DRIVE_SYNC_FOLDER_ID first.'); return; }
  var folder;
  try { folder = DriveApp.getFolderById(folderId); } catch (e) { return; }
  var filesById = {};
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    filesById[f.getId()] = f.getLastUpdated().toISOString();
  }
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0]);
    var newUpdated = filesById[id];
    if (newUpdated) {
      if (newUpdated !== String(data[i][3])) {
        sh.getRange(i + 1, 4).setValue(newUpdated);
        sh.getRange(i + 1, 9).setValue('stale');
      }
    } else {
      sh.getRange(i + 1, 9).setValue('missing_from_drive');
    }
  }
  ss_().toast('Drive Sync polled.');
}

function syncDriveToGH() {
  var sh = ss_().getSheetByName('DRIVE_SYNC');
  if (!sh) { ss_().toast('Populate DRIVE_SYNC first.'); return; }
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var status = String(data[i][8] || '');
    if (status !== 'synced_gh' && status !== 'synced_both') {
      var fileId = String(data[i][0]);
      var ghPath = String(data[i][6] || '');
      if (!ghPath) continue;
      try {
        var file = DriveApp.getFileById(fileId);
        var content = file.getBlob().getDataAsString();
        var r = put_('/api/file/' + ghPath, { content: content, message: 'Drive sync: ' + file.getName() });
        sh.getRange(i + 1, 9).setValue(r.ok ? 'synced_gh' : 'error');
        sh.getRange(i + 1, 10).setValue(r.ok ? 'OK' : r.text.slice(0, 300));
      } catch (e) {
        sh.getRange(i + 1, 9).setValue('error');
        sh.getRange(i + 1, 10).setValue(String(e).slice(0, 300));
      }
    }
  }
  ss_().toast('Drive → GitHub sync complete.');
}

function syncDriveToCF() {
  ss_().toast('Drive → Cloudflare sync not yet implemented. Set CF_TOKEN / CF_ACCOUNT to enable.');
}

function installDriveSyncTrigger() {
  removeDriveSyncTrigger();
  ScriptApp.newTrigger('pollDriveSync').timeBased().everyMinutes(10).create();
  ss_().toast('Installed 10-minute Drive Sync trigger.');
}

function removeDriveSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'pollDriveSync') {
      ScriptApp.deleteTrigger(triggers[i]); removed++;
    }
  }
  ss_().toast('Removed ' + removed + ' Drive Sync trigger(s).');
}

// Note: put_ is defined in build_api_map.gs.
function put_(path, body) { return request_('put', path, body); }
