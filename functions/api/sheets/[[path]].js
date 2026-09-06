
import { isBuildAuthed, tokenAllowsSheet, verifyTokenAnyTransport } from '../../_lib/admin_session.js';
import { sheetSelfMarkdown, sheetSelfPayload } from '../../_lib/sheet_self.js';
import { logEvent } from '../../_lib/event_log.js';
import { runView, resolvePins, writePin, describeSources, instantiateTemplate, normalizeView } from '../../_lib/sheet_views.js';
import {
  listSheets, getSheet, createSheet, patchSheet, deleteSheet,
  getValues, setValues, appendValues, clearRange, batchOps, exportCsv,
  listRunConfigs, saveRunConfig, deleteRunConfig, runRows, cellHistory, parseCellRef,
  MAX_RUN_ROWS_PER_CALL,
} from '../../_lib/sheets_store.js';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// Same auth surface as /api/invoke: `authorization: Bearer <TERMINAL_KEY>` works here because
// the contract above promises it — isBuildAuthed alone only reads x-terminal-key/?tk=/cookie.
async function sheetsAuthed(request, env, url) {
  const keys = [env.TERMINAL_KEY, env.INVOKE_TOKEN, env.AIG_SHIM_TOKEN].filter(Boolean).map(String);
  const m = String(request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  const presented = (m ? m[1].trim() : '') || String(url.searchParams.get('token') || '');
  if (presented && keys.includes(presented)) return true;
  return isBuildAuthed(request, env);
}

async function sheetAuthority(request, env, url, sheet) {
  if (await sheetsAuthed(request, env, url)) return { level: 'owner', token: null };
  const token = await verifyTokenAnyTransport(request, env);
  if (token && sheet && tokenAllowsSheet(token, sheet.id)) return { level: 'token', token };
  if (sheet && sheet.visibility === 'public') return { level: 'public', token };
  return { level: 'none', token };
}
const READ_LANES = new Set(['self', 'view', 'values', 'history', 'export.csv']);
function denied(base, sheet, need) {
  return json({
    error: 'unauthorized', need, sheet: sheet ? sheet.id : null, visibility: sheet ? sheet.visibility : null,
    how_to_fix: need === 'owner' ? 'owner authority: `authorization: Bearer <build key>` or an admin cookie'
      : 'owner authority, or a token scoped to this sheet (`?share=<token>` or `authorization: Bearer <token>`); the owner mints one at ' + base + '/api/dispatch?mint_share=1&scope=sheet:' + (sheet ? sheet.id : '<id>'),
    self: sheet ? base + '/api/sheets/' + sheet.id + '/self' : null, contract: base + '/api/sheets',
  }, 401);
}

function contract(base) {
  return {
    _self: {
      schema: 'miscsubjects/sheets/1',
      what: 'Stored grids with Google-Sheets-shaped addressing. Every cell is A1-addressable over REST; whole tabs are sheets: Directory and Ledger are projections of their own tables, user sheets store cells here.',
      workbook: base + '/admin/sheets',
      auth: 'admin cookie or `authorization: Bearer <TERMINAL_KEY>`; per sheet also a token scoped sheet:<id> (?share= or Bearer), and a PUBLIC sheet reads without any credential',
      every_sheet_is_an_object: {
        ref: 'sheet://<id>', link: base + '/sheet/<id>', self: base + '/api/sheets/<id>/self  (?format=markdown for prose)',
        visibility: 'PATCH ' + base + '/api/sheets/<id> {"visibility":"public"|"private"} (owner) — public: anyone reads at /sheet/<id> and the GET lanes; writes always need authority',
        token_for_one_sheet: 'owner mints GET ' + base + '/api/dispatch?mint_share=1&scope=sheet:<id>&ttl=86400 — operates that sheet only',
        webhook: 'POST ' + base + '/api/sheets/<id>/values:append {"values":[[...]]}',
        environment: base + '/api/environment/objects?ref=sheet%3A%2F%2F<id>',
      },
    },
    values_lane: {
      read: 'GET ' + base + '/api/sheets/<id>/values/A1:C10  → {range, values[][]}',
      read_one: 'GET ' + base + '/api/sheets/<id>/values/B3',
      write: 'PUT ' + base + '/api/sheets/<id>/values/A1  {"values":[["x","y"],["a","b"]]}  (anchored at A1; "" clears a cell)',
      append: 'POST ' + base + '/api/sheets/<id>/values:append  {"values":[["new row"]]}',
      clear: 'POST ' + base + '/api/sheets/<id>/clear  {"range":"A2:C10"}',
      open_ranges: 'B:D (whole columns), 2:5 (whole rows), A2:C (open bottom) all resolve against the used range',
    },
    formula_lane: {
      what: 'A written value beginning with = is an expression. The computed answer is stored in the '
          + 'cell so every reader sees a plain value; the expression is kept beside it and re-evaluated '
          + 'whenever a cell it reads changes. Dependencies are read out of the text, so filling a '
          + 'formula down a column needs no wiring.',
      examples: [
        '=BL2*3                                     arithmetic over references',
        '=SUM(M2:M400)                              ranges',
        '=IF(A2>100,"over","under")                 only the taken branch is evaluated',
        '=DISPATCH("LEADS_ENRICH", A2)              call any directory tool from a cell',
        '=D1QUERY("SELECT COUNT(*) AS n FROM articles")   a live figure, not a stale one',
        '=SEARCH("durable objects", 5)              ranked hits across articles and the directory',
        '=SEARCHCOUNT(BP2)                          how many things match what is in BP2',
        '=TAG(A2)                                   A2 = [KEY]args[/KEY] exactly as an agent writes it; the cell gets the dispatch envelope (ok, ms, trace, cost)',
        '=TAG(A2, "result")                         the raw result payload that tool returned  ·  "verdict" = WORKED/FAILED  ·  "trace" = its ledger trace',
        '=LLMCALL(A2, B2)                           send the REST envelope in A2 with B2 as the message',
        '=LLMCALL(A2, B2, "status")                 the HTTP status of that same call ("text" for the reply, "ms" for the time)',
        '=IMAGE("https://…/thing.png")              the grid draws the picture; the cell still holds the address',
      ],
      functions: ['TAG', 'DISPATCH', 'D1QUERY', 'SEARCH', 'SEARCHCOUNT', 'LLMCALL', 'IMAGE', 'SUM', 'COUNT',
                  'COUNTA', 'AVERAGE', 'MIN', 'MAX', 'ROUND', 'ABS', 'IF', 'AND', 'OR', 'NOT',
                  'CONCAT', 'JOIN', 'LEN', 'LEFT', 'RIGHT', 'MID', 'UPPER', 'LOWER', 'TRIM', 'VALUE'],
      llmcall: 'The envelope is the whole REST request — method, url, headers, body — so the sheet shows '
             + 'exactly what goes down the wire. Authorization stays the literal "Bearer INJECTED_BY_WORKER"; '
             + 'the real credential is swapped in at the wire by host and never lands in a cell. '
             + '{{INPUT}} marks where the message goes; without one, the message replaces the last user turn. '
             + 'One answer is cached for 15 minutes on a hash of what was sent, so the status cell and the '
             + 'payload cell are one paid call, not two.',
      bounds: 'nesting 8 deep, 500 cells recalculated per write, 3 rounds of cascade. An error shows '
            + 'in the cell (#ERROR, #DIV/0, #NAME?) instead of failing the write.',
      not_supported: 'charts, pivots, conditional formatting, array spilling, volatile functions — '
                   + 'they make a document pretty and do nothing for a model',
    },
    history_lane: {
      read: 'GET ' + base + '/api/sheets/<id>/history/U3?limit=50',
      what: 'Every value that address has ever held, newest first, each with the actor, the expression '
          + 'that produced it and the trace of the turn that caused it. Writes append; nothing is '
          + 'overwritten, so a value cannot be edited out of the record.',
      chain: 'each version hashes prev_hash + its payload',
    },
    search_lane: {
      read: 'GET ' + base + '/api/search?q=<words>&limit=10   (keyless)',
      reindex: 'POST ' + base + '/api/search {"reindex":"article"|"directory","offset":0}',
      what: 'Full-text search over every article and every tool definition in one index, ranked, with '
          + 'a snippet. Also reachable from a cell as =SEARCH(...).',
    },
    dimension_lane: {
      batch: 'POST ' + base + '/api/sheets/<id>/batch  {"requests":[{"op":"insert_rows","at":2,"n":1},{"op":"move_col","from":2,"to":5}]}',
      ops: ['insert_rows', 'delete_rows', 'insert_cols', 'delete_cols', 'move_row', 'move_col'],
    },
    run_lane: {
      what: 'Fill columns with model output, one grid row = one call. Configs are stored versions (v1, v2, …) so different settings run side by side into different columns.',
      run: 'POST ' + base + '/api/sheets/<id>/run-row  {"config":{"mode":"template|raw","input_col":"A","request_col":"B","response_col":"C","text_col":"D","model":"grok","prompt":"…{{A}}…{{input}}…","temperature":0.2,"max_tokens":1024},"rows":[2,3,4]}',
      raw_mode: 'mode:"raw" — the input column cell IS the full /api/invoke call object as JSON; request_col gets the exact spec sent, response_col the raw result envelope, text_col the reply text',
      shape: 'add "shape":true to build and write the request specs WITHOUT sending anything',
      max_rows_per_call: MAX_RUN_ROWS_PER_CALL,
      configs: 'GET/POST ' + base + '/api/sheets/<id>/runs · DELETE ' + base + '/api/sheets/<id>/runs/<rid>',
      engine: base + '/api/invoke — aliases (grok|kimi|glm|fast|gpt|opus5|sonnet5) or any gateway model id; every controllable field: GET /api/invoke?fields=1',
    },
    view_lane: {
      what: 'A view sheet is a projection of a source of record — the ledger, the directory or another listed table. '
          + 'It stores a description (source, filters or a raw WHERE, columns with a JSON path and a format), not rows; '
          + 'every open re-reads the source. Add a column, change a filter, pin an object row: all edits to the description, no code.',
      sources: 'GET ' + base + '/api/sheets/view-sources',
      create: 'POST ' + base + '/api/sheets {"template":"blooio_number","param":"[OWNER_PHONE]"}  · or {"title":"…","view":{source, filters, where, columns, order, limit}}',
      run: 'GET ' + base + '/api/sheets/<id>/view?limit=300&before=<ts>',
      column: '{"path":"request_json.body.messages[0].content","header":"system prompt sent","format":"text","w":360} — path = column or column.json.path',
      filter: '{"field":"source","op":"=","value":"blooio"} · field "any" = every text column; ops = != contains starts in > < >= <= empty not_empty',
      formats: ['text', 'json', 'time', 'number', 'link', 'image'],
      pins: 'PATCH /api/sheets/<id> {"col_meta":{"pins":[{"label":"ROUTER system prompt","ref":"directory/ROUTER/content"}]}} — shown above the grid, edits write through: POST /api/sheets/<id>/pins {"ref","value"}',
    },
    sibling_sheets: {
      directory: { grid: base + '/admin/directory', rest: 'GET/POST ' + base + '/api/directory · GET/PUT/PATCH/DELETE ' + base + '/api/directory/<key>' },
      ledger: { grid: base + '/admin/ledger', rest: 'GET ' + base + '/admin/ledger?data=1&limit=100&key=&trace_id=&q= (append-only; no write lane exists)' },
    },
    editing: {
      what: 'The grid edits like Google Sheets: every cell opens an in-place editor on double-click (Enter and F2 too) at its own location; a read-only cell (ledger rows, corpus projections, computed fields) opens the same editor read-only — never a modal; long values overflow into empty neighbor cells and stay editable in place; the editor autosizes to its text. Enter commits down, Shift+Enter up, Tab right, Cmd/Ctrl+Enter commits in place, Alt+Enter inserts a newline, Escape reverts.',
      files_hygiene: 'the Files kind lists build code only — machine artifacts (ledger-mirror/ event mirrors, .protected/ guardian snapshots) are excluded from the corpus feed.',
    },
    url_state: {
      what: 'Every workbook view state is a link. Kind tabs, filters, sorts and the active cell serialize into the URL and a pasted link restores the exact view; every populated cell is an addressable particle of its object.',
      params: {
        tab: 'sheet id (user sheets, turns, forum)',
        kind: 'directory kind tab: agent | tool | flow | content | page | file | other | code',
        sort: '<field>:asc|desc',
        'f.<field>': '<condition>:<needle> — condition filter on one column',
        'v.<field>': 'in:<v1>~~<v2>… or out:<v1>~~<v2>… — value filter on one column',
        id: 'row object id (directory key, ledger event id) — with `field`, addresses one cell',
        field: 'column of the active cell',
        cell: 'A1 address when a row has no object id',
      },
      example: base + '/admin/directory?kind=agent&sort=used:desc&id=ROUTER&field=target',
      formula_bar: 'the bar names the active cell as <object id> · <field>, linked to the object at its own address',
      views: 'Sheet and Classic are two views of the same objects and toggle both ways, top right on each surface; classic pages live at ?view=classic and keep their own state in the URL (tab, q, cat, sort, use, page, id).',
      cache: 'grids repaint from a client-side cache: instant paint, background refresh — the loading screen only appears on a cold first visit.',
    },
    export: 'GET ' + base + '/api/sheets/<id>/export.csv',
  };
}

async function handle(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const base = url.origin;
  const method = request.method.toUpperCase();
  const seg = (Array.isArray(params.path) ? params.path : (params.path ? [params.path] : []))
    .map((s) => decodeURIComponent(String(s)));

  // GET /api/sheets/<id>/live — upgrade straight through to that sheet's durable object, so a
  // change made anywhere reaches an open grid without it polling. Handled before the JSON body
  // read and before the normal auth branch because a websocket carries neither.
  if (seg.length === 2 && seg[1] === 'live' && request.headers.get('Upgrade') === 'websocket') {
    if (!(await sheetsAuthed(request, env, url))) return json({ error: 'unauthorized' }, 401);
    if (!env.SHEET_DO) return json({ error: 'live_unavailable', why: 'SHEET_DO not bound' }, 503);
    const stub = env.SHEET_DO.get(env.SHEET_DO.idFromName(seg[0]));
    return stub.fetch('https://sheet-do/do/' + seg[0] + '?op=ws', {
      headers: { Upgrade: 'websocket', Connection: 'Upgrade' },
    });
  }

  let body = {};
  if (method !== 'GET' && method !== 'HEAD') {
    try { body = await request.json(); } catch { body = {}; }
  }

  // the public contract — every other route requires auth
  if (!seg.length && method === 'GET') {
    // A model that has never seen this build must be able to learn the formula surface from one
    // keyless GET. Documenting it only in comments means it is documented for nobody.
    const doc = contract(base);
    if (await sheetsAuthed(request, env, url)) {
      try {
        doc.sheets = await listSheets(env);
        // which tabs are projections — the grid opens those through /view
        const vm = await env.DB.prepare("SELECT id FROM user_sheets WHERE col_meta LIKE '%\"view\":%'").all();
        const views = new Set((vm.results || []).map((r) => r.id));
        for (const sh of doc.sheets) sh.is_view = views.has(sh.id);
      } catch (e) { doc.sheets_error = String(e?.message || e); }
    }
    return json(doc);
  }

  // Sheet-addressed routes decide authority per sheet (owner / token / public read) below; the
  // workbook-wide routes (list, create, view-sources, unaddressed pins) stay owner-only.
  const sheetAddressed = seg.length >= 1 && !['view-sources', 'pins'].includes(seg[0]);
  let authority = { level: 'none', token: null };
  let sheet = null;
  if (sheetAddressed) {
    sheet = await getSheet(env, seg[0]);
    if (!sheet) return json({ error: 'sheet_not_found', id: seg[0], list: base + '/api/sheets' }, 404);
    authority = await sheetAuthority(request, env, url, sheet);
    const lane = seg[1] || 'meta';
    const isRead = method === 'GET' && (lane === 'meta' || READ_LANES.has(lane));
    const ownerOnly = method === 'DELETE' || (method === 'PATCH' && body && body.visibility != null);
    if (ownerOnly && authority.level !== 'owner') return denied(base, sheet, 'owner');
    if (!isRead && authority.level !== 'owner' && authority.level !== 'token') return denied(base, sheet, 'sheet');
    if (isRead && authority.level === 'none') return denied(base, sheet, 'sheet');
  } else if (!(await sheetsAuthed(request, env, url))) {
    return json({ error: 'unauthorized', how_to_fix: 'admin cookie or `authorization: Bearer <TERMINAL_KEY>`', contract: base + '/api/sheets' }, 401);
  } else {
    authority = { level: 'owner', token: null };
  }

  const actor = authority.level === 'token' ? 'sheet-token:' + (authority.token && authority.token.fingerprint || 'cap') : 'admin';
  const receipt = (key, req, res, status = 200) =>
    context.waitUntil(logEvent(env, {
      source: 'sheets', key, route: url.pathname, actor: authority.level === 'owner' ? 'owner' : actor,
      action: method, direction: 'in', status, request: req, response: res,
    }).catch(() => {}));

  // GET /api/sheets/view-sources — what a projection can read
  if (seg.length === 1 && seg[0] === 'view-sources' && method === 'GET') return json(describeSources());

  // Pins addressed without a sheet: the built-in Directory / Ledger tabs keep their pin lists in
  // the browser, so resolving and writing them cannot depend on a stored sheet.
  if (seg[0] === 'pins' && method === 'POST') {
    if (seg[1] === 'resolve') return json({ ok: true, pins: await resolvePins(env, body.pins) });
    const out = await writePin(env, body.ref, body.value, 'sheet-pin');
    receipt('SHEET_PIN_WRITE', { ref: body.ref, chars: String(body.value == null ? '' : body.value).length }, out, out.error ? 400 : 200);
    return json(out, out.error ? 400 : 200);
  }

  // POST /api/sheets — create (a stored grid, or a view sheet when template/view is given)
  if (!seg.length && method === 'POST') {
    let view = null, title = body.title;
    if (body.template) {
      const inst = instantiateTemplate(String(body.template), body.param);
      if (!inst) return json({ error: 'no_such_template', list: base + '/api/sheets/view-sources' }, 400);
      view = inst.view; title = title || inst.title;
    } else if (body.view && typeof body.view === 'object') {
      view = normalizeView(body.view);
    }
    let sheet = await createSheet(env, { title, rows: view ? 1 : body.rows, cols: view ? view.columns.length : body.cols }, actor);
    if (view) {
      const meta = { ...(sheet.col_meta || {}), view, kind: 'view', freeze: { rows: 1, cols: 0 } };
      if (body.pins) meta.pins = body.pins;
      sheet = await patchSheet(env, sheet.id, { col_meta: meta });
    }
    if (body.visibility != null) {
      const vis = await patchSheet(env, sheet.id, { visibility: body.visibility });
      if (vis && vis.error) return json(vis, 400);
      sheet = vis;
    }
    const created = sheetSelfPayload(sheet, { origin: base, authority: 'owner' });
    receipt('SHEET_CREATE', { title: sheet.title, view: view ? view.source : null, template: body.template || null, visibility: sheet.visibility }, { id: sheet.id }, 201);
    return json({ ok: true, sheet, open: base + '/admin/sheets?tab=' + sheet.id, link: created.links.human, self: created.links.self, webhook: created.links.webhook, _self: created }, 201);
  }

  const id = seg[0];

  // GET /api/sheets/<id>/self — the sheet describing itself (JSON, or ?format=markdown)
  if (seg[1] === 'self' && method === 'GET') {
    const self = sheetSelfPayload(sheet, { origin: base, authority: authority.level === 'none' ? 'none' : authority.level === 'public' ? 'public read' : authority.level });
    if (/^(markdown|md|text)$/i.test(String(url.searchParams.get('format') || ''))) {
      return new Response(sheetSelfMarkdown(self), { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
    }
    return json(self);
  }

  // /api/sheets/<id>
  if (seg.length === 1) {
    if (method === 'GET') {
      const runs = await listRunConfigs(env, id);
      const self = sheetSelfPayload(sheet, { origin: base, authority: authority.level === 'public' ? 'public read' : authority.level });
      if (/^(markdown|md|text)$/i.test(String(url.searchParams.get('format') || ''))) {
        return new Response(sheetSelfMarkdown(self), { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' } });
      }
      return json({ ok: true, sheet, runs, rest: contract(base).values_lane, _self: self });
    }
    if (method === 'PATCH') {
      const updated = await patchSheet(env, id, body);
      if (updated && updated.error) return json(updated, 400);
      receipt('SHEET_PATCH', body, { id, visibility: updated ? updated.visibility : null });
      return json({ ok: true, sheet: updated, _self: sheetSelfPayload(updated, { origin: base, authority: authority.level }) });
    }
    if (method === 'DELETE') {
      await deleteSheet(env, id);
      receipt('SHEET_DELETE', { id, title: sheet.title }, { deleted: true });
      return json({ ok: true, deleted: id });
    }
  }

  // GET /api/sheets/<id>/view — run the projection now
  if (seg[1] === 'view' && method === 'GET') {
    const meta = sheet.col_meta || {};
    const pins = await resolvePins(env, meta.pins);
    if (!meta.view) return json({ ok: true, sheet: sheet.id, view: null, pins, note: 'not a view sheet — PATCH col_meta.view to make it one' });
    const out = await runView(env, meta.view, {
      limit: url.searchParams.get('limit'), before: url.searchParams.get('before'), after: url.searchParams.get('after'),
    });
    return json({ ...out, sheet: sheet.id, title: sheet.title, pins, formats: meta.formats || {} }, out.error ? 400 : 200);
  }

  // POST /api/sheets/<id>/pins — write through one pinned object field
  if (seg[1] === 'pins' && method === 'POST') {
    const out = await writePin(env, body.ref, body.value, 'sheet-pin:' + sheet.id);
    receipt('SHEET_PIN_WRITE', { ref: body.ref, chars: String(body.value == null ? '' : body.value).length }, out, out.error ? 400 : 200);
    return json(out, out.error ? 400 : 200);
  }

  // /api/sheets/<id>/values/<range>
  if (seg[1] === 'values' && seg[2]) {
    if (method === 'GET') {
      const out = await getValues(env, sheet, seg[2]);
      return json(out, out.error ? 400 : 200);
    }
    if (method === 'PUT' || method === 'POST') {
      const out = await setValues(env, sheet, seg[2], body.values, actor);
      receipt('SHEET_VALUES_SET', { range: seg[2], cells: (body.values || []).length }, out, out.error ? 400 : 200);
      return json(out, out.error ? 400 : 200);
    }
  }

  // POST /api/sheets/<id>/values:append
  if (seg[1] === 'values:append' && method === 'POST') {
    const out = await appendValues(env, sheet, body.values, actor);
    receipt('SHEET_VALUES_APPEND', { rows: (body.values || []).length }, out, out.error ? 400 : 200);
    return json(out, out.error ? 400 : 200);
  }

  // POST /api/sheets/<id>/clear
  if (seg[1] === 'clear' && method === 'POST') {
    const out = await clearRange(env, sheet, body.range);
    receipt('SHEET_CLEAR', { range: body.range }, out, out.error ? 400 : 200);
    return json(out, out.error ? 400 : 200);
  }

  // POST /api/sheets/<id>/batch — dimension ops
  if (seg[1] === 'batch' && method === 'POST') {
    const out = await batchOps(env, sheet, body.requests);
    receipt('SHEET_BATCH', body, out, out.error ? 400 : 200);
    return json(out, out.error ? 400 : 200);
  }

  // GET /api/sheets/<id>/export.csv
  // GET /api/sheets/<id>/history/U3 — every value that address has held, newest first, each
  // with the actor and the turn that caused it. A cell stops being a value and becomes an object
  // with a lineage you can open.
  if (seg[1] === 'history' && method === 'GET') {
    const ref = parseCellRef(seg[2] || '');
    if (!ref) return json({ error: 'bad_cell', hint: 'GET /api/sheets/<id>/history/U3' }, 400);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const rows = await cellHistory(env, sheet.id, ref.r, ref.c, limit);
    return json({
      sheet: sheet.id, cell: (seg[2] || '').toUpperCase(), versions: rows.length,
      _self: {
        what: 'Append-only history for one address. The newest version is what the cell holds now.',
        chain: 'each version hashes prev_hash + its payload, so a value cannot be edited out of the record',
      },
      history: rows,
    });
  }

  if (seg[1] === 'export.csv' && method === 'GET') {
    const csv = await exportCsv(env, sheet);
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="' + sheet.title.replace(/[^\w.-]+/g, '_') + '.csv"',
      },
    });
  }

  // /api/sheets/<id>/runs[/<rid>]
  if (seg[1] === 'runs') {
    if (!seg[2] && method === 'GET') return json({ ok: true, runs: await listRunConfigs(env, id) });
    if (!seg[2] && method === 'POST') {
      const out = await saveRunConfig(env, id, body);
      receipt('SHEET_RUN_CONFIG_SAVE', { name: body.name }, out, 201);
      return json(out, 201);
    }
    if (seg[2] && (method === 'PATCH' || method === 'PUT')) {
      const out = await saveRunConfig(env, id, { ...body, id: seg[2] });
      receipt('SHEET_RUN_CONFIG_SAVE', { id: seg[2], name: body.name }, out);
      return json(out);
    }
    if (seg[2] && method === 'DELETE') {
      const out = await deleteRunConfig(env, id, seg[2]);
      receipt('SHEET_RUN_CONFIG_DELETE', { id: seg[2] }, out);
      return json(out);
    }
  }

  // POST /api/sheets/<id>/run-row — the model-run lane
  if (seg[1] === 'run-row' && method === 'POST') {
    let config = body.config || null;
    if (!config && body.config_id) {
      const runs = await listRunConfigs(env, id);
      config = runs.find((r) => r.id === body.config_id)?.config || null;
    }
    if (!config) return json({ error: 'config_required', how_to_fix: 'pass config:{...} or config_id of a saved run config' }, 400);
    const out = await runRows(env, sheet, config, body.rows, { shape: !!body.shape, actor });
    receipt('SHEET_RUN', { rows: body.rows, mode: config.mode, model: config.model || config.key || null, shape: !!body.shape },
      { ok: out.ok, cells_written: out.cells_written, ms: out.ms }, out.error ? 400 : 200);
    return json(out, out.error ? 400 : 200);
  }

  return json({ error: 'no_such_route', method, path: url.pathname, contract: base + '/api/sheets' }, 404);
}

export async function onRequest(context) {
  try {
    return await handle(context);
  } catch (e) {
    return json({ error: 'sheets_route_threw', detail: String(e?.message || e) }, 500);
  }
}
