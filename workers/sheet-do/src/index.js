// loop-safe-sheet-do — one Durable Object per sheet.
//
// The problem this fixes: every sheet shared one D1 table, so the whole build had one writer,
// every read was a network hop, and a page already open could not be told that a cell changed.
//
// SheetDO gives each sheet its own SQLite inside its own object:
//   · single writer per sheet — two messages arriving together cannot collide on a row, and
//     claiming the next row is an atomic local statement rather than a hopeful MAX(r)+1
//   · reads are local disk, not a round trip
//   · WebSocket push, using hibernation so an idle sheet costs nothing while staying connected
//   · values past the inline cap spill to R2 and the cell keeps a pointer, so a raw payload or
//     a full model response never bloats the row store
//
// D1 stays the read surface for everything already built: the DO writes through to it, so the
// workbook, the REST lane and the exports keep working unchanged while writes get fast and safe.

const INLINE_MAX = 24000;        // bytes kept in the cell; past this the value lives in R2
const BROADCAST_PREVIEW = 400;   // cell text pushed to listeners; they refetch for the rest

export class SheetDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;
    state.blockConcurrencyWhile(async () => {
      this.sql.exec(
        'CREATE TABLE IF NOT EXISTS cells (r INTEGER NOT NULL, c INTEGER NOT NULL, value TEXT, ' +
        'r2_key TEXT, bytes INTEGER, updated_at TEXT, updated_by TEXT, PRIMARY KEY (r, c))'
      );
      this.sql.exec(
        'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)'
      );
    });
  }

  j(o, st) {
    return new Response(JSON.stringify(o), {
      status: st || 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  metaGet(k, dflt) {
    const rows = this.sql.exec('SELECT v FROM meta WHERE k = ?', k).toArray();
    return rows.length ? rows[0].v : dflt;
  }

  metaPut(k, v) {
    this.sql.exec('INSERT INTO meta (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', k, String(v));
  }

  sheetId() {
    return this.metaGet('sheet_id', null);
  }

  // ── writes ────────────────────────────────────────────────────────────────────────────
  // cells: [[r, c, value], …]. Returns what was written, after spill.
  async write(cells, actor) {
    const ts = new Date().toISOString();
    const sheetId = this.sheetId();
    const written = [];

    for (const [r, c, raw] of cells) {
      const value = raw == null ? '' : String(raw);
      let stored = value;
      let r2Key = null;

      if (value.length > INLINE_MAX && this.env.R2 && sheetId) {
        r2Key = `sheet-cells/${sheetId}/${r}-${c}-${Date.now().toString(36)}.txt`;
        try {
          await this.env.R2.put(r2Key, value);
          // The cell keeps a readable head plus the pointer, so the grid still shows something
          // meaningful and nothing has to be fetched to know what the cell holds.
          stored = value.slice(0, 2000) + `\n…[${value.length} bytes · r2:${r2Key}]`;
        } catch { r2Key = null; stored = value.slice(0, INLINE_MAX); }
      }

      this.sql.exec(
        'INSERT INTO cells (r,c,value,r2_key,bytes,updated_at,updated_by) VALUES (?,?,?,?,?,?,?) ' +
        'ON CONFLICT(r,c) DO UPDATE SET value=excluded.value, r2_key=excluded.r2_key, ' +
        'bytes=excluded.bytes, updated_at=excluded.updated_at, updated_by=excluded.updated_by',
        r, c, stored, r2Key, value.length, ts, actor || 'do'
      );
      written.push({ r, c, bytes: value.length, r2: r2Key, preview: stored.slice(0, BROADCAST_PREVIEW) });
    }

    // Write through so every surface that reads D1 today keeps working unchanged.
    if (sheetId && this.env.DB) {
      const stmts = written.map((w) => {
        const row = this.sql.exec('SELECT value FROM cells WHERE r=? AND c=?', w.r, w.c).toArray()[0];
        return this.env.DB.prepare(
          'INSERT INTO sheet_cells (sheet_id,r,c,value,updated_at,updated_by) VALUES (?,?,?,?,?,?) ' +
          'ON CONFLICT(sheet_id,r,c) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, updated_by=excluded.updated_by'
        ).bind(sheetId, w.r, w.c, row ? row.value : '', ts, actor || 'do');
      });
      try {
        for (let i = 0; i < stmts.length; i += 50) await this.env.DB.batch(stmts.slice(i, i + 50));
      } catch (e) {
        // A mirror failure must never lose the write: the DO already holds it durably.
        this.metaPut('last_mirror_error', String(e && e.message || e).slice(0, 400));
      }
    }

    this.broadcast({ type: 'cells', ts, cells: written });
    return written;
  }

  // The atomic version of "next free row". One writer, one statement, no race.
  claimRow(maxCol, actor) {
    const rows = this.sql.exec('SELECT MAX(r) AS m FROM cells WHERE c <= ?', maxCol || 64).toArray();
    const next = Math.max(2, Number((rows[0] && rows[0].m) || 1) + 1);
    const ts = new Date().toISOString();
    this.sql.exec(
      'INSERT INTO cells (r,c,value,bytes,updated_at,updated_by) VALUES (?,1,?,?,?,?) ' +
      'ON CONFLICT(r,c) DO UPDATE SET value=excluded.value',
      next, ts, ts.length, ts, actor || 'do'
    );
    return next;
  }

  read(r1, c1, r2, c2) {
    const out = this.sql.exec(
      'SELECT r,c,value,r2_key,bytes FROM cells WHERE r>=? AND r<=? AND c>=? AND c<=? ORDER BY r,c',
      r1, r2, c1, c2
    ).toArray();
    return out;
  }

  // ── live push ─────────────────────────────────────────────────────────────────────────
  broadcast(msg) {
    const text = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      try { ws.send(text); } catch { /* a dead socket is dropped by the runtime */ }
    }
  }

  async webSocketMessage(ws, message) {
    if (String(message) === 'ping') ws.send(JSON.stringify({ type: 'pong', ts: new Date().toISOString() }));
  }

  async webSocketClose(ws, code) {
    try { ws.close(code, 'closed'); } catch {}
  }

  async fetch(request) {
    const url = new URL(request.url);
    const op = url.searchParams.get('op') || 'ping';

    // Hibernatable socket: the object sleeps between messages and the connection survives.
    if (op === 'ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return this.j({ error: 'expected_websocket' }, 426);
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    let body = {};
    if (request.method === 'POST') { try { body = await request.json(); } catch { body = {}; } }
    if (body.sheet_id && !this.sheetId()) this.metaPut('sheet_id', String(body.sheet_id));

    if (op === 'ping') {
      const n = this.sql.exec('SELECT COUNT(*) AS n FROM cells').toArray()[0];
      return this.j({
        ok: true, do: 'SheetDO', sheet_id: this.sheetId(),
        cells: Number(n && n.n) || 0,
        sockets: this.state.getWebSockets().length,
        last_mirror_error: this.metaGet('last_mirror_error', null),
      });
    }

    if (op === 'claim') {
      return this.j({ ok: true, row: this.claimRow(Number(body.max_col) || 64, body.actor) });
    }

    // Claim a row and stamp what arrived, in one round trip. Two calls cost two crossings of the
    // network for work that is local and atomic here — measured at ~600 ms each, on the path a
    // person is waiting on (2026-09-02).
    if (op === 'claim_write') {
      const row = this.claimRow(Number(body.max_col) || 64, body.actor);
      const cells = (Array.isArray(body.cells) ? body.cells : [])
        .map((pair) => [row, Number(pair[0]), String(pair[1] == null ? '' : pair[1])]);
      const written = cells.length ? await this.write(cells, body.actor) : [];
      return this.j({ ok: true, row, written: written.length });
    }

    if (op === 'write') {
      const cells = Array.isArray(body.cells) ? body.cells : [];
      if (!cells.length) return this.j({ error: 'cells_required' }, 400);
      const written = await this.write(cells, body.actor);
      return this.j({ ok: true, written: written.length, cells: written });
    }

    if (op === 'read') {
      const rows = this.read(
        Number(body.r1) || 1, Number(body.c1) || 1,
        Number(body.r2) || 1000, Number(body.c2) || 64
      );
      return this.j({ ok: true, count: rows.length, cells: rows });
    }

    // Pull a spilled value back in full.
    if (op === 'blob') {
      const key = String(url.searchParams.get('key') || body.key || '');
      if (!key || !this.env.R2) return this.j({ error: 'no_key' }, 400);
      const obj = await this.env.R2.get(key);
      if (!obj) return this.j({ error: 'not_found' }, 404);
      return new Response(obj.body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    // Row and column shifts rewrite addresses in D1 wholesale. Rather than replay them, the
    // object drops its copy and re-adopts, so a moved column can never leave a stale cell
    // behind at its old address.
    if (op === 'reset') {
      this.sql.exec('DELETE FROM cells');
      this.metaPut('reset_at', new Date().toISOString());
      const sheetId = String(body.sheet_id || this.sheetId() || '');
      if (sheetId && this.env.DB) {
        const q = await this.env.DB.prepare(
          'SELECT r,c,value,updated_at,updated_by FROM sheet_cells WHERE sheet_id=? ORDER BY r,c'
        ).bind(sheetId).all();
        for (const cell of (q.results || [])) {
          this.sql.exec(
            'INSERT INTO cells (r,c,value,bytes,updated_at,updated_by) VALUES (?,?,?,?,?,?)',
            cell.r, cell.c, cell.value == null ? '' : String(cell.value),
            String(cell.value || '').length, cell.updated_at || new Date().toISOString(), cell.updated_by || 'reset'
          );
        }
        this.broadcast({ type: 'reset', ts: new Date().toISOString() });
        return this.j({ ok: true, reloaded: (q.results || []).length });
      }
      return this.j({ ok: true, reloaded: 0 });
    }

    // One-time backfill from D1 so an existing sheet keeps its history when it moves in here.
    if (op === 'adopt') {
      const sheetId = String(body.sheet_id || this.sheetId() || '');
      if (!sheetId || !this.env.DB) return this.j({ error: 'sheet_id_required' }, 400);
      this.metaPut('sheet_id', sheetId);
      const q = await this.env.DB.prepare(
        'SELECT r,c,value,updated_at,updated_by FROM sheet_cells WHERE sheet_id=? ORDER BY r,c'
      ).bind(sheetId).all();
      let n = 0;
      for (const cell of (q.results || [])) {
        this.sql.exec(
          'INSERT INTO cells (r,c,value,bytes,updated_at,updated_by) VALUES (?,?,?,?,?,?) ' +
          'ON CONFLICT(r,c) DO UPDATE SET value=excluded.value',
          cell.r, cell.c, cell.value == null ? '' : String(cell.value),
          String(cell.value || '').length, cell.updated_at || new Date().toISOString(), cell.updated_by || 'adopt'
        );
        n++;
      }
      this.metaPut('adopted_at', new Date().toISOString());
      return this.j({ ok: true, adopted: n, sheet_id: sheetId });
    }

    return this.j({ error: 'unknown_op', ops: ['ping', 'claim', 'claim_write', 'write', 'read', 'blob', 'adopt', 'ws'] }, 400);
  }
}

// Direct entry, mirroring the directory-do worker: /do/<sheet_id>?op=…
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/do\/([A-Za-z0-9_-]{1,64})$/);
    if (!m) {
      return new Response(JSON.stringify({
        ok: true, worker: 'loop-safe-sheet-do',
        usage: '/do/<sheet_id>?op=ping|claim|claim_write|write|read|blob|adopt|ws',
      }, null, 2), { headers: { 'content-type': 'application/json' } });
    }
    const id = env.SHEET_DO.idFromName(m[1]);
    return env.SHEET_DO.get(id).fetch(request);
  },
};
