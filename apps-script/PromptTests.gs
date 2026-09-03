/**
 * PromptTests.gs — Router / agent prompt version testing.
 *
 * Populates a PROMPT_TESTS tab where each row is one test.
 * Runs the test through the build API and captures the trace + reply.
 */

function setupPromptTests() {
  var sh = sheet_('PROMPT_TESTS');
  var headers = [
    'test_name', 'channel', 'message', 'expected_behavior',
    'status', 'trace', 'reply', 'tools_used', 'ledger_json'
  ];
  // Pre-seed a few standard tests
  var rows = [
    ['hello', 'sheet', 'hi', 'conversational greeting', '', '', '', '', ''],
    ['articles_list', 'sheet', 'what articles are on the site?', 'lists articles', '', '', '', '', ''],
    ['article_read', 'sheet', 'what does the bpc-157 article say?', 'reads article content', '', '', '', '', ''],
    ['tool_shape', 'sheet', 'show me the exact REST for LOCAL_EXEC', 'emits shape test result', '', '', '', '', '']
  ];
  write_('PROMPT_TESTS', headers, rows);
  ss_().toast('PROMPT_TESTS tab ready. Fill message column and run a test.');
}

function runPromptTest() {
  var sh = ss_().getSheetByName('PROMPT_TESTS');
  if (!sh) { setupPromptTests(); ss_().toast('PROMPT_TESTS tab created. Run again after filling.'); return; }
  var selection = sh.getActiveCell();
  var row = selection.getRow();
  if (row < 2) { ss_().toast('Select a test row (row 2+).'); return; }
  var vals = sh.getRange(row, 1, 1, 4).getValues()[0];
  var name = String(vals[0] || '');
  var channel = String(vals[1] || 'sheet');
  var msg = String(vals[2] || '').trim();
  var expected = String(vals[3] || '');
  if (!msg) { ss_().toast('No message in selected row. Fill column C and try again.'); return; }

  var input = '[channel ' + channel + ' test · from the owner]\nNow: ' + msg;
  var r = post_('/api/dispatch', { key: 'ROUTER', body: input });
  var out = String((r.json && r.json.result) || r.text || '');
  var m = out.match(/\[REPLY\]([\s\S]*?)\[\/REPLY\]/);
  var reply = m ? m[1].trim() : out.replace(/\[\/?[A-Z_]+\]/g, '').trim();
  var trace = (r.json && r.json.trace) || '';
  var tools = '';
  var ledger = '';
  if (trace) {
    var td = get_('/admin/ledger?turns=1&trace_id=' + encodeURIComponent(trace));
    var t = (td.json && td.json.turns && td.json.turns[0]);
    if (t) {
      tools = (t.tools || []).map(function (x) { return x.key; }).join(', ');
      ledger = JSON.stringify(t);
    }
  }
  sh.getRange(row, 5, 1, 5).setValues([[
    r.ok ? 'ran' : 'error', trace, reply, tools, ledger.slice(0, 3000)
  ]]);
  ss_().toast('Test "' + name + '" ran. See row ' + row + '.');
}

function runAllPromptTests() {
  var sh = ss_().getSheetByName('PROMPT_TESTS');
  if (!sh) { setupPromptTests(); return; }
  var data = sh.getDataRange().getValues();
  var ran = 0;
  for (var i = 1; i < data.length; i++) {
    var msg = String(data[i][2] || '').trim();
    if (!msg) continue;
    var input = '[channel sheet test · from the owner]\nNow: ' + msg;
    var r = post_('/api/dispatch', { key: 'ROUTER', body: input });
    var out = String((r.json && r.json.result) || r.text || '');
    var m = out.match(/\[REPLY\]([\s\S]*?)\[\/REPLY\]/);
    var reply = m ? m[1].trim() : out.replace(/\[\/?[A-Z_]+\]/g, '').trim();
    var trace = (r.json && r.json.trace) || '';
    var tools = '';
    var ledger = '';
    if (trace) {
      var td = get_('/admin/ledger?turns=1&trace_id=' + encodeURIComponent(trace));
      var t = (td.json && td.json.turns && td.json.turns[0]);
      if (t) { tools = (t.tools || []).map(function (x) { return x.key; }).join(', '); ledger = JSON.stringify(t); }
    }
    sh.getRange(i + 1, 5, 1, 5).setValues([[
      r.ok ? 'ran' : 'error', trace, reply, tools, ledger.slice(0, 3000)
    ]]);
    ran++;
  }
  ss_().toast('Ran ' + ran + ' prompt tests. See PROMPT_TESTS tab.');
}
