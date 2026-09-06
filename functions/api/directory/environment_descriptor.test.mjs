import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequestPost } from './index.js';

function request(body) {
  return new Request('https://example.test/api/directory', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-terminal-key': 'owner-test-token' },
    body: JSON.stringify(body),
  });
}

test('directory POST stores a validated descriptor and its content hash with the object row', async () => {
  let written = null;
  const env = {
    TERMINAL_KEY: 'owner-test-token',
    DB: {
      prepare(sql) {
        return {
          bind(...binds) { written = { sql, binds }; return this; },
          async run() { return { success: true }; },
        };
      },
    },
  };
  const descriptor = {
    ref: 'page://admin/example', kind: 'page', title: 'Example',
    operations: [{ id: 'read', method: 'GET', href: '/admin/example' }],
    governance: { direct: [] }, comparables: [], relationships: [],
  };
  const response = await onRequestPost({
    env,
    request: request({
      key: 'PAGE_ADMIN_EXAMPLE', type: 'http', target: 'GET https://example.test/admin/example',
      auth: 'owner', content: '# WHAT: Example page.', object_kind: 'page', descriptor_json: descriptor,
    }),
  });
  assert.equal(response.status, 201);
  assert.match(written.sql, /object_kind, descriptor_json, descriptor_rev, descriptor_hash/);
  assert.equal(written.binds.includes('page'), true);
  assert.equal(written.binds.some((value) => typeof value === 'string' && value.includes('page://admin/example')), true);
  assert.equal(written.binds.some((value) => /^sha256:[a-f0-9]{64}$/.test(String(value))), true);
});

test('directory POST refuses an invalid descriptor before writing', async () => {
  let wrote = false;
  const env = {
    TERMINAL_KEY: 'owner-test-token',
    DB: { prepare() { return { bind() { return this; }, async run() { wrote = true; } }; } },
  };
  const response = await onRequestPost({
    env,
    request: request({
      key: 'PAGE_BAD', type: 'http', target: 'GET https://example.test/bad', auth: 'owner',
      content: '# WHAT: Bad page.', object_kind: 'page',
      descriptor_json: {
        ref: 'page://bad', kind: 'page',
        relationships: [{ type: 'related_to', target_ref: 'external://google/sheets' }],
      },
    }),
  });
  assert.equal(response.status, 422);
  assert.equal(wrote, false);
  const body = await response.json();
  assert.equal(body.error, 'environment_descriptor_refused');
  assert.match(body.details.join('\n'), /related_to/);
});

// ── PUT / PATCH: descriptor edits are compare-and-set on descriptor_rev ─────────────────────────
import { onRequestPatch, onRequestPut } from './[key].js';

function existingRow(overrides = {}) {
  return {
    key: 'PAGE_ADMIN_SHEETS', type: 'http', target: 'GET https://example.test/admin/sheets', auth: 'owner',
    content: '# WHAT: Sheets.', category: 'page', enabled: 1, sensitive: 0, runner: null,
    object_kind: 'page', descriptor_rev: 3, descriptor_hash: 'sha256:old',
    descriptor_json: JSON.stringify({ ref: 'page://admin/sheets', kind: 'page', title: 'Sheets', governance: { direct: ['law://sheets/S01'] } }),
    ...overrides,
  };
}

// A recording D1 stand-in: every statement is captured; reads answer from the one existing row.
function recordingDb(row) {
  const writes = [];
  const db = {
    writes,
    prepare(sql) {
      let binds = [];
      return {
        bind(...b) { binds = b; return this; },
        async first() {
          if (/FROM directory_versions/.test(sql)) return null;
          if (/FROM directory WHERE key/.test(sql)) return row;
          return null;
        },
        async all() { return { results: row ? [row] : [] }; },
        async run() {
          writes.push({ sql, binds });
          // Apply UPDATE ... SET a = ?, b = ? to the row so a re-read sees the effect, as D1 would.
          const m = sql.match(/^UPDATE directory SET (.+) WHERE key = \?$/);
          if (m && row) m[1].split(', ').map((s) => s.split(' = ')[0]).forEach((col, i) => { row[col] = binds[i]; });
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
  };
  return db;
}

function mutation(method, body) {
  return new Request('https://example.test/api/directory/PAGE_ADMIN_SHEETS', {
    method, headers: { 'content-type': 'application/json', 'x-terminal-key': 'owner-test-token' }, body: JSON.stringify(body),
  });
}

const editedDescriptor = {
  ref: 'page://admin/sheets', kind: 'page', title: 'Sheets',
  governance: { direct: ['law://sheets/S01', 'law://design/D08'] },
  operations: [{ id: 'read', method: 'GET', href: '/admin/sheets' }],
};

test('directory PATCH with the current descriptor_rev writes the descriptor, bumps the revision and versions it', async () => {
  const db = recordingDb(existingRow());
  const response = await onRequestPatch({
    env: { TERMINAL_KEY: 'owner-test-token', DB: db }, params: { key: 'PAGE_ADMIN_SHEETS' },
    request: mutation('PATCH', { descriptor_json: editedDescriptor, expected_descriptor_rev: 3 }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.descriptor_rev, 4);
  assert.match(body.descriptor_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(body.ref, 'page://admin/sheets');
  const update = db.writes.find((w) => /^UPDATE directory SET/.test(w.sql));
  assert.ok(update, 'the directory row was updated');
  assert.match(update.sql, /descriptor_json = \?, descriptor_rev = \?, descriptor_hash = \?/);
  assert.equal(update.binds.includes(4), true);
  assert.equal(update.binds.some((v) => typeof v === 'string' && v.includes('law://design/D08')), true);
  const version = db.writes.find((w) => /INSERT INTO directory_versions/.test(w.sql));
  assert.ok(version, 'a directory_versions row was appended');
  assert.match(version.sql, /descriptor_json,descriptor_hash/);
  assert.equal(version.binds.includes(body.descriptor_hash), true);
});

test('directory PATCH with a stale expected_descriptor_rev is refused before any write', async () => {
  const db = recordingDb(existingRow());
  const response = await onRequestPatch({
    env: { TERMINAL_KEY: 'owner-test-token', DB: db }, params: { key: 'PAGE_ADMIN_SHEETS' },
    request: mutation('PATCH', { descriptor_json: editedDescriptor, expected_descriptor_rev: 2 }),
  });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.error, 'descriptor_revision_stale');
  assert.equal(body.current_descriptor_rev, 3);
  assert.equal(body.state_changed, false);
  assert.equal(db.writes.length, 0);
});

test('directory PATCH refuses an invalid descriptor before any write', async () => {
  const db = recordingDb(existingRow());
  const response = await onRequestPatch({
    env: { TERMINAL_KEY: 'owner-test-token', DB: db }, params: { key: 'PAGE_ADMIN_SHEETS' },
    request: mutation('PATCH', { descriptor_json: { ref: 'not a ref', relationships: [{ type: 'related_to', target_ref: 'page://x' }] } }),
  });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.error, 'environment_descriptor_refused');
  assert.equal(db.writes.length, 0);
});

test('directory PUT with a descriptor upserts the descriptor columns and increments the revision', async () => {
  const db = recordingDb(existingRow());
  const response = await onRequestPut({
    env: { TERMINAL_KEY: 'owner-test-token', DB: db }, params: { key: 'PAGE_ADMIN_SHEETS' },
    request: mutation('PUT', { type: 'http', target: 'GET https://example.test/admin/sheets', auth: 'owner', content: '# WHAT: Sheets.', descriptor_json: editedDescriptor }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.descriptor_rev, 4);
  const upsert = db.writes.find((w) => /^INSERT INTO directory/.test(w.sql));
  assert.match(upsert.sql, /object_kind, descriptor_json, descriptor_rev, descriptor_hash/);
  assert.match(upsert.sql, /descriptor_rev=excluded.descriptor_rev/);
});

test('directory PUT without a descriptor keeps the pre-migration statement shape', async () => {
  const db = recordingDb(existingRow({ object_kind: undefined, descriptor_rev: undefined, descriptor_hash: undefined, descriptor_json: undefined }));
  const response = await onRequestPut({
    env: { TERMINAL_KEY: 'owner-test-token', DB: db }, params: { key: 'PAGE_ADMIN_SHEETS' },
    request: mutation('PUT', { type: 'http', target: 'GET https://example.test/admin/sheets', auth: 'owner', content: '# WHAT: Sheets.' }),
  });
  assert.equal(response.status, 200);
  const upsert = db.writes.find((w) => /^INSERT INTO directory/.test(w.sql));
  assert.doesNotMatch(upsert.sql, /descriptor_json/);
});
