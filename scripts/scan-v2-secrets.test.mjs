import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { scanPaths } from './scan-v2-secrets.mjs';

test('finds credential shapes and exact known secrets without printing secret bytes', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'v2-secret-scan-'));
  const exact = 'owner-secret-value-1234567890';
  await writeFile(path.join(dir, 'bad.txt'), `ANTHROPIC_API_KEY=sk-ant-api03-${'A'.repeat(40)}\nvalue=${exact}\n`);
  const report = await scanPaths([dir], {
    secretValues: [{ name: 'TERMINAL_KEY', value: exact }],
  });
  assert.equal(report.pass, false);
  assert.equal(report.findings.some((finding) => finding.rule === 'anthropic_api_key'), true);
  assert.equal(report.findings.some((finding) => finding.rule === 'known_secret:TERMINAL_KEY'), true);
  assert.equal(JSON.stringify(report).includes(exact), false);
  assert.equal(JSON.stringify(report).includes(`sk-ant-api03-${'A'.repeat(40)}`), false);
});

test('does not flag hashes, placeholders, lockfiles, or binary files', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'v2-secret-clean-'));
  await writeFile(path.join(dir, 'README.md'), `TOKEN=<TOKEN>\nsha256=${'a'.repeat(64)}\n`);
  await writeFile(path.join(dir, 'package-lock.json'), '{"integrity":"sha512-abc"}');
  await writeFile(path.join(dir, 'image.bin'), Buffer.from([0, 1, 2, 0, 255]));
  const report = await scanPaths([dir]);
  assert.equal(report.pass, true);
  assert.deepEqual(report.findings, []);
});
