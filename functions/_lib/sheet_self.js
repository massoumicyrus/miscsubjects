
export function sheetRef(id) { return 'sheet://' + String(id || ''); }

function abs(origin, path) { return String(origin || 'https://miscsubjects.com').replace(/\/$/, '') + path; }

export function sheetSelfPayload(sheet, { origin = 'https://miscsubjects.com', authority = 'none' } = {}) {
  const id = String(sheet.id);
  const api = abs(origin, '/api/sheets/' + encodeURIComponent(id));
  const isPublic = sheet.visibility === 'public';
  const meta = sheet.col_meta || {};
  const view = meta.view || null;
  const auth = 'owner authority (`authorization: Bearer <build key>`) or a token minted for this sheet (`?share=<token>` on the URL or `authorization: Bearer <token>`)';
  const readAuth = isPublic ? 'public — no credential' : auth;
  const op = (opId, method, href, summary, effects, authority, input) => ({
    id: opId, method, href, summary, effects: effects || [], authority, ...(input ? { input_schema: input } : {}),
  });
  return {
    schema: 'miscsubjects/sheet-self/1',
    ref: sheetRef(id),
    kind: view ? 'view_sheet' : 'sheet',
    id,
    title: sheet.title,
    visibility: isPublic ? 'public' : 'private',
    size: { rows: sheet.rows, cols: sheet.cols, used_rows: sheet.used_rows, used_cols: sheet.used_cols, cells: sheet.cell_count },
    updated_at: sheet.updated_at,
    your_authority: authority,
    links: {
      human: abs(origin, '/sheet/' + encodeURIComponent(id)),
      owner_workbook: abs(origin, '/admin/sheets?tab=' + encodeURIComponent(id)),
      json: api,
      self: api + '/self',
      self_markdown: api + '/self?format=markdown',
      values: api + '/values/A1:Z50',
      webhook: api + '/values:append',
      csv: api + '/export.csv',
      environment_object: abs(origin, '/api/environment/objects?ref=' + encodeURIComponent(sheetRef(id))),
      manual: abs(origin, '/api/environment?format=markdown'),
    },
    view: view ? { source: view.source, columns: view.columns, filters: view.filters, where: view.where || '', limit: view.limit, order: view.order,
      note: 'Rows are re-read from the source on every open. Cells are read-only; pinned fields and the source rows are what an edit changes.' } : null,
    pins: Array.isArray(meta.pins) ? meta.pins : [],
    operations: [
      op('read_self', 'GET', api + '/self', 'this payload; ?format=markdown for prose', [], readAuth),
      op('read_meta', 'GET', api, 'title, size, used range, col_meta (view, pins, formats), saved runs', [], readAuth),
      op('read_values', 'GET', api + '/values/{A1:C10}', 'cells in a range as values[][]; open ranges B:D, 2:5, A2:C resolve against the used range', [], readAuth),
      ...(view ? [op('run_view', 'GET', api + '/view?limit=&before=&after=', 'the projection now: columns, rows, per-row object ids and hrefs, resolved pins', [], readAuth)] : []),
      op('history', 'GET', api + '/history/{A1}', 'every value one cell has held, newest first, hash-chained', [], readAuth),
      op('export_csv', 'GET', api + '/export.csv', 'the used range as CSV', [], readAuth),
      op('write_values', 'PUT', api + '/values/{A1}', 'write cells anchored at the address; a value beginning with = is a formula', ['cells change; SHEET_VALUES_SET receipt'], auth,
        { type: 'object', required: ['values'], properties: { values: { type: 'array', items: { type: 'array' } } } }),
      op('append', 'POST', api + '/values:append', 'THE WEBHOOK ADDRESS: appends rows below the used range; any system that can POST JSON with authority lands rows here', ['rows appended; SHEET_VALUES_APPEND receipt'], auth,
        { type: 'object', required: ['values'], properties: { values: { type: 'array', items: { type: 'array' } } } }),
      op('clear', 'POST', api + '/clear', 'empty a range', ['cells cleared; SHEET_CLEAR receipt'], auth, { type: 'object', required: ['range'], properties: { range: { type: 'string' } } }),
      op('batch', 'POST', api + '/batch', 'insert_rows, delete_rows, insert_cols, delete_cols, move_col, move_row', ['dimensions change; SHEET_BATCH receipt'], auth,
        { type: 'object', required: ['requests'], properties: { requests: { type: 'array' } } }),
      op('pin_write', 'POST', api + '/pins', 'write through a pinned object field — directory/<KEY>/<field> edits the directory row itself', ['the underlying object changes; DIR_PATCH or SHEET_PIN_WRITE receipt'], auth,
        { type: 'object', required: ['ref', 'value'], properties: { ref: { type: 'string' }, value: { type: 'string' } } }),
      op('redefine', 'PATCH', api, 'title, size, col_meta ({view, pins, formats}), sort_order, visibility (public|private)', ['the sheet description changes, no source row does; SHEET_PATCH receipt'], 'owner authority only for visibility; otherwise ' + auth,
        { type: 'object', properties: { title: { type: 'string' }, visibility: { type: 'string', enum: ['public', 'private'] }, col_meta: { type: 'object' }, rows: { type: 'integer' }, cols: { type: 'integer' } } }),
      op('run_rows', 'POST', api + '/run-row', 'run up to 20 grid rows through a saved or inline model-run config', ['request/response/text cells written; SHEET_RUN receipt'], auth,
        { type: 'object', properties: { config: { type: 'object' }, config_id: { type: 'string' }, rows: { type: 'array', items: { type: 'integer' } } } }),
      op('delete', 'DELETE', api, 'remove the sheet; rows it projected are untouched', ['sheet removed; SHEET_DELETE receipt'], 'owner authority only'),
    ],
    authority: {
      current: authority,
      public_read: isPublic,
      how: 'Every write, and every read of a private sheet, needs one of: owner authority (`authorization: Bearer <build key>` or `x-terminal-key`), or a share token scoped to this sheet, presented as `?share=<token>` on the URL or `authorization: Bearer <token>`.',
      token_for_this_sheet: 'the owner mints it: GET ' + abs(origin, '/api/dispatch?mint_share=1&scope=sheet:' + encodeURIComponent(id) + '&ttl=86400') + ' — the token operates this sheet and nothing else; hand the token, never the build key',
      inspect_a_token: abs(origin, '/api/dispatch?explain=1&share=<token>'),
      make_public: 'PATCH ' + api + ' {"visibility":"public"} (owner) — reads need no credential; writes still do',
      make_private: 'PATCH ' + api + ' {"visibility":"private"} (owner)',
    },
    receipts: {
      where: 'every operation above is one ledger row, source `sheets`, key SHEET_*, route this sheet\'s path',
      read: abs(origin, '/api/events?source=sheets&q=' + encodeURIComponent(id) + '&limit=50'),
      as_a_sheet: 'POST ' + abs(origin, '/api/sheets') + ' {"title":"receipts","view":{"source":"ledger","filters":[{"field":"route","op":"contains","value":"' + id + '"}],"columns":["ts","key","actor","request_json","response_json"]}}',
    },
    grammar: {
      cell: 'A1 addressing; ranges A1:C10; whole columns B:D; whole rows 2:5; open bottom A2:C',
      formula: 'a value beginning with = is an expression: =SUM(B2:B40), =DISPATCH("KEY", A2), =D1QUERY("SELECT …"), =LLMCALL(A2, B2)',
      view_column_path: 'source column with optional JSON path: descriptor_json.governance.direct, request_json.body.messages[0].content',
    },
  };
}

export function sheetSelfMarkdown(self) {
  const lines = [
    '# ' + self.title + '  (`' + self.ref + '`)',
    '',
    'A ' + (self.kind === 'view_sheet' ? 'view sheet: a live projection of `' + self.view.source + '`' : 'stored grid') + ', ' + self.visibility + '. Your authority on it right now: ' + self.your_authority + '.',
    '',
    '## Links',
    '',
    ...Object.entries(self.links).map(([k, v]) => '- ' + k + ': ' + v),
    '',
    '## Operations',
    '',
    ...self.operations.map((o) => '- `' + o.id + '`: `' + o.method + ' ' + o.href + '` — ' + o.summary + ' (' + o.authority + ')' + (o.effects.length ? ' → ' + o.effects.join('; ') : '')
      + (o.input_schema ? '\n  - body: ' + JSON.stringify(o.input_schema.properties ? Object.fromEntries(Object.entries(o.input_schema.properties).map(([k, v]) => [k, v.enum ? v.enum.join('|') : v.type])) : {}) : '')),
    '',
    '## Authority',
    '',
    '- ' + self.authority.how,
    '- Token for this sheet only: ' + self.authority.token_for_this_sheet,
    '- Make public: ' + self.authority.make_public,
    '- Make private: ' + self.authority.make_private,
    '',
    '## Receipts',
    '',
    '- ' + self.receipts.where,
    '- Read them: ' + self.receipts.read,
    '- Or as a sheet: `' + self.receipts.as_a_sheet + '`',
    '',
    '## Grammar',
    '',
    ...Object.entries(self.grammar).map(([k, v]) => '- ' + k + ': ' + v),
  ];
  if (self.view) lines.push('', '## View', '', '```json', JSON.stringify(self.view, null, 2), '```');
  if (self.pins.length) lines.push('', '## Pins', '', ...self.pins.map((p) => '- ' + (p.label || p.ref) + ' → `' + p.ref + '`'));
  return lines.join('\n');
}

// The same sheet in the environment-object grammar (miscsubjects/environment-object/1), so
// GET /api/environment/objects?ref=sheet://<id> answers with the fields every other object has.
export function sheetDescriptor(sheet, { origin = 'https://miscsubjects.com' } = {}) {
  const self = sheetSelfPayload(sheet, { origin });
  return {
    schema_version: 'miscsubjects/environment-object/1',
    ref: self.ref,
    kind: self.kind,
    title: sheet.title,
    summary: (self.view ? 'View sheet over ' + self.view.source + '. ' : 'Stored grid. ') + self.visibility + '. ' + (sheet.cell_count || 0) + ' cells.',
    status: 'active',
    parent_ref: 'page://admin/sheets',
    source: { ref: 'source://functions/api/sheets/[[path]].js', read: { method: 'GET', href: 'https://github.com/[OWNER_HANDLE]/miscsubjects-pages/blob/main/functions/api/sheets/%5B%5Bpath%5D%5D.js' } },
    schema: { type: 'object', properties: { values: { type: 'array', items: { type: 'array' }, description: 'A1-addressed cells' }, col_meta: { type: 'object', description: '{view, pins, formats}' }, visibility: { type: 'string', enum: ['public', 'private'] } } },
    operations: self.operations.map((o) => ({ id: o.id, method: o.method, href: o.href, summary: o.summary, effects: o.effects, authority: o.authority === 'public — no credential' ? { public: true } : { owner: true, sheet_token: true }, ...(o.input_schema ? { input_schema: o.input_schema } : {}) })),
    relationships: [
      { type: 'part_of', target_ref: 'page://admin/sheets', basis: 'One tab of the workbook.' },
      ...(self.view ? [{ type: 'projects', target_ref: self.view.source === 'directory' ? 'directory://catalog' : self.view.source === 'ledger' ? 'ledger://events' : 'store://DB/' + self.view.source, basis: 'Rows are re-read from the source on every open.' }] : []),
      { type: 'recorded_by', target_ref: 'ledger://events', basis: 'Every write is one SHEET_* row.' },
    ],
    governance: { direct: ['law://sheets/S01'] },
    comparables: [],
    representations: { human: self.links.human, owner: self.links.owner_workbook, json: self.links.json, self: self.links.self, markdown: self.links.self_markdown, csv: self.links.csv, webhook: self.links.webhook },
    revision: 1,
    hash: null,
    directory_key: null,
    visibility: self.visibility,
  };
}
