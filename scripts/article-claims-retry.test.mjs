import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

test('claim-law gate retries one unreadable dispatch result without changing the ceiling', async () => {
  let calls = 0;
  const server = createServer((request, response) => {
    calls++;
    response.setHeader('content-type', 'application/json');
    const rows = calls === 1 ? [] : calls === 2 ? [{ n: 147 }] : [{ n: 1462 }];
    response.end(JSON.stringify({ result: JSON.stringify(rows) }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const child = spawn(process.execPath, ['scripts/check-article-claims.mjs'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, WORK_BASE: `http://127.0.0.1:${port}`, TERMINAL_KEY: 'test-key' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  server.close();
  assert.equal(code, 0, stderr || stdout);
  assert.equal(calls, 3);
  assert.match(stdout, /147 substantial ones do not \(ceiling 147\)/);
});
