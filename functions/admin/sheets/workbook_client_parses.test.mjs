import test from 'node:test';
import assert from 'node:assert/strict';
import { workbookResponse } from './index.js';

test('every script block the workbook serves parses as JavaScript', async () => {
  for (const tab of ['directory', 'ledger', 'turns']) {
    const html = await workbookResponse(tab, '/admin/sheets').text();
    const re = /<script(?: type="[^"]*")?>([\s\S]*?)<\/script>/g;
    let m; let blocks = 0;
    while ((m = re.exec(html))) {
      const code = m[1];
      if (/^\s*[[{]/.test(code)) continue; // JSON data island
      blocks++;
      assert.doesNotThrow(() => new Function(code), 'tab ' + tab + ': a served <script> block does not parse');
    }
    assert.ok(blocks >= 1, 'tab ' + tab + ' served no script');
  }
});
