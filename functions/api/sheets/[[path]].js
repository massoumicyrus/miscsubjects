
import { isBuildAuthed } from '../../_lib/admin_session.js';
import { logEvent } from '../../_lib/event_log.js';
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

function contract(base) {
  return {
    _self: {
      schema: 'miscsubjects/sheets/1',
      what: 'Stored grids with Google-Sheets-shaped addressing. Every cell is A1-addressable over REST; whole tabs are sheets: Directory and Ledger are projections of their own tables, user sheets store cells here.',
      workbook: base + '/admin/sheets',
      auth: 'admin cookie or `authorization: Bearer <TERMINAL_KEY>` — this contract is the only public read',
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
        '=LLMCALL(A2, B2)                           send the REST envelope in A2 with B2 as the message',
        '=LLMCALL(A2, B2, "status")                 the HTTP status of that same call ("text" for the reply, "ms" for the time)',
        '=IMAGE("https://…/thing.png")              the grid draws the picture; the cell still holds the address',
      ],
      functions: ['DISPATCH', 'D1QUERY', 'SEARCH', 'SEARCHCOUNT', 'LLMCALL', 'IMAGE', 'SUM', 'COUNT',
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
      try { doc.sheets = await listSheets(env); } catch (e) { doc.sheets_error = String(e?.message || e); }
    }
    return json(doc);
  }

  if (!(await sheetsAuthed(request, env, url))) {
    return json({ error: 'unauthorized', how_to_fix: 'admin cookie or `authorization: Bearer <TERMINAL_KEY>`', contract: base + '/api/sheets' }, 401);
  }

  const actor = 'admin';
  const receipt = (key, req, res, status = 200) =>
    context.waitUntil(logEvent(env, {
      source: 'sheets', key, route: url.pathname, actor: 'sheets-api',
      action: method, direction: 'in', status, request: req, response: res,
    }).catch(() => {}));

  // POST /api/sheets — create
  if (!seg.length && method === 'POST') {
    const sheet = await createSheet(env, body, actor);
    receipt('SHEET_CREATE', { title: body.title }, { id: sheet.id }, 201);
    return json({ ok: true, sheet }, 201);
  }

  const id = seg[0];
  const sheet = await getSheet(env, id);
  if (!sheet) return json({ error: 'sheet_not_found', id, list: base + '/api/sheets' }, 404);

  // /api/sheets/<id>
  if (seg.length === 1) {
    if (method === 'GET') {
      const runs = await listRunConfigs(env, id);
      return json({ ok: true, sheet, runs, rest: contract(base).values_lane });
    }
    if (method === 'PATCH') {
      const updated = await patchSheet(env, id, body);
      receipt('SHEET_PATCH', body, { id });
      return json({ ok: true, sheet: updated });
    }
    if (method === 'DELETE') {
      await deleteSheet(env, id);
      receipt('SHEET_DELETE', { id, title: sheet.title }, { deleted: true });
      return json({ ok: true, deleted: id });
    }
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
