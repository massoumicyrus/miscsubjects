import assert from 'node:assert/strict';
import test from 'node:test';
import { getPath } from './json_path.js';
test('getPath walks objects and arrays, parses JSON strings, and blanks a missing step', () => {
  const doc = { body: { messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }] }, n: 3 };
  assert.equal(getPath(doc, 'body.messages[1].content'), 'hi');
  assert.equal(getPath(JSON.stringify(doc), '$.body.messages[0].role'), 'system');
  assert.equal(getPath(doc, 'n'), '3');
  assert.equal(getPath(doc, 'body.messages'), JSON.stringify(doc.body.messages));
  assert.equal(getPath(doc, 'body.nope.x'), '');
  assert.equal(getPath('not json', 'a'), '');
  assert.equal(getPath('{"a":{"b":"c"}}', 'a.b'), 'c');
});
