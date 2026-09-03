/**
 * Invoke.gs — Google Sheets → 100 model replies in one request.
 *
 * Every call goes through POST /api/invoke (invokeJSON). The prompt lives in the directory
 * as a row; the sheet names the row and supplies the inputs. Nothing here embeds a prompt.
 *
 * Auth reuses the Script Property already set for this build (MISC or TERMINAL_KEY),
 * sent as x-terminal-key exactly like build_api_map.gs does.
 *
 * Menu:  Misc → Invoke → Fill column from prompt
 * Cell:  =INVOKE("write a hook for this", "WRITER_AGENT_v5")
 *        =INVOKEALL(A2:A101, "WRITER_AGENT_v5")     one request, one column of answers
 */

var INVOKE_BASE = 'https://miscsubjects.com';
var INVOKE_MAX = 200;      // server cap per request
var INVOKE_CHUNK = 100;    // rows per request when filling a column

function invokeKey_() {
  var p = PropertiesService.getScriptProperties();
  var k = p.getProperty('MISC') || p.getProperty('TERMINAL_KEY');
  if (!k) throw new Error('Set Script Property MISC to the terminal key.');
  return k;
}

/** One POST. `payload` is the invokeJSON call object. Returns the parsed body. */
function invokePost_(payload) {
  var res = UrlFetchApp.fetch(INVOKE_BASE + '/api/invoke', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-terminal-key': invokeKey_() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var body;
  try { body = JSON.parse(res.getContentText()); }
  catch (e) { throw new Error('invoke: unparseable response (' + code + '): ' + res.getContentText().slice(0, 300)); }
  if (code === 401) throw new Error('invoke: unauthorized — check Script Property MISC');
  return body;
}

/**
 * One reply. Custom function.
 * @param {string} input   the user message
 * @param {string} key     directory row holding the system prompt (optional)
 * @param {string} model   model override (optional; kimi|glm|fast|grok|gpt|opus5|sonnet5)
 * @return {string} the reply
 * @customfunction
 */
function INVOKE(input, key, model) {
  if (input == null || input === '') return '';
  var spec = { input: String(input) };
  if (key) spec.key = String(key);
  if (model) spec.model = String(model);
  var out = invokePost_(spec);
  var r = out.results && out.results[0];
  if (!r) return 'ERROR: ' + (out.error || 'no result');
  return r.ok ? r.text : ('ERROR: ' + r.error);
}

/**
 * A whole range in ONE request — every call in flight at once.
 * @param {A2:A101} range  inputs, one per cell
 * @param {string} key     directory row holding the system prompt (optional)
 * @param {string} model   model override (optional)
 * @return {string[][]} one reply per input row
 * @customfunction
 */
function INVOKEALL(range, key, model) {
  var inputs = [];
  var flat = [].concat.apply([], range || []);
  for (var i = 0; i < flat.length; i++) inputs.push(String(flat[i] == null ? '' : flat[i]));
  if (!inputs.length) return [['']];
  if (inputs.length > INVOKE_MAX) throw new Error('invoke: ' + inputs.length + ' rows exceeds the ' + INVOKE_MAX + ' per-request cap — split the range.');

  var spec = { inputs: inputs };
  if (key) spec.key = String(key);
  if (model) spec.model = String(model);
  var out = invokePost_(spec);
  return (out.results || []).map(function (r) { return [r.ok ? r.text : 'ERROR: ' + r.error]; });
}

/**
 * Menu action: read inputs from the selected column, write replies into the next one.
 * Chunks of 100, each chunk one request. Prompts the operator for the directory key.
 */
function fillColumnFromPrompt() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getActiveSheet();
  var sel = sh.getActiveRange();
  var ui = SpreadsheetApp.getUi();

  var ask = ui.prompt('Prompt row', 'Directory key holding the system prompt (blank = model default):', ui.ButtonSet.OK_CANCEL);
  if (ask.getSelectedButton() !== ui.Button.OK) return;
  var key = ask.getResponseText().trim();

  var askModel = ui.prompt('Model', 'Model (blank = the row\'s own model):', ui.ButtonSet.OK_CANCEL);
  if (askModel.getSelectedButton() !== ui.Button.OK) return;
  var model = askModel.getResponseText().trim();

  var values = sel.getValues().map(function (r) { return String(r[0] == null ? '' : r[0]); });
  var outCol = sel.getColumn() + 1;
  var startRow = sel.getRow();
  var started = Date.now();
  var done = 0;

  for (var i = 0; i < values.length; i += INVOKE_CHUNK) {
    var chunk = values.slice(i, i + INVOKE_CHUNK).filter(function (v) { return v !== ''; });
    if (!chunk.length) continue;
    var spec = { inputs: chunk };
    if (key) spec.key = key;
    if (model) spec.model = model;
    var out = invokePost_(spec);
    var replies = (out.results || []).map(function (r) { return [r.ok ? r.text : 'ERROR: ' + r.error]; });
    sh.getRange(startRow + i, outCol, replies.length, 1).setValues(replies);
    done += replies.length;
    ss.toast(done + '/' + values.length + ' · ' + out.ms + 'ms for that batch');
  }
  ss.toast(done + ' replies in ' + (Date.now() - started) + 'ms total', 'Invoke', 8);
}
