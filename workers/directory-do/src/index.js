// loop-safe-directory-do — a bound Durable Object worker.
//
// DirectoryDO is one strongly-consistent, single-writer instance (named "main").
// It owns two durable, SQLite-backed tables:
//   slugs   — every declared internal position: slug -> {kind, target}. This is the
//             registry behind "every row/page/tool/agent has a slug; invoke the slug
//             via REST -> it resolves to a target".
//   intents — append-only log of every register/mutate call (chronological), so the
//             single mutation surface has a durable audit independent of D1.
//
// Reached over REST through the Pages front door at /api/durable/* (production
// hostname), or directly at this worker's /do/* route. Directory row: DURABLE_WORKER.

export class DirectoryDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;
    state.blockConcurrencyWhile(async () => {
      this.sql.exec(
        'CREATE TABLE IF NOT EXISTS slugs (slug TEXT PRIMARY KEY, kind TEXT, target TEXT, declared_at TEXT, updated_at TEXT)'
      );
      this.sql.exec(
        'CREATE TABLE IF NOT EXISTS intents (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, action TEXT, slug TEXT, payload TEXT)'
      );
    });
  }

  j(o, st) {
    return new Response(JSON.stringify(o), { status: st || 200, headers: { 'content-type': 'application/json' } });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const op = url.searchParams.get('op') || 'ping';
    const now = new Date().toISOString();

    if (op === 'ping') {
      return this.j({ ok: true, do: 'DirectoryDO', id: this.state.id?.toString?.() || null, ts: now });
    }

    if (op === 'slug.list') {
      const rows = [...this.sql.exec('SELECT slug, kind, target, declared_at, updated_at FROM slugs ORDER BY slug')];
      return this.j({ ok: true, count: rows.length, slugs: rows });
    }

    if (op === 'slug.resolve') {
      const slug = (url.searchParams.get('slug') || '').trim();
      if (!slug) return this.j({ ok: false, error: 'slug_required' }, 400);
      const row = [...this.sql.exec('SELECT slug, kind, target, declared_at, updated_at FROM slugs WHERE slug = ?', slug)][0] || null;
      return this.j({ ok: !!row, slug, row });
    }

    if (op === 'slug.register') {
      const b = await request.json().catch(() => ({}));
      const slug = String(b.slug || '').trim();
      if (!slug) return this.j({ ok: false, error: 'slug_required' }, 400);
      const existing = [...this.sql.exec('SELECT declared_at FROM slugs WHERE slug = ?', slug)][0];
      const declared = existing?.declared_at || now;
      this.sql.exec(
        'INSERT OR REPLACE INTO slugs (slug, kind, target, declared_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        slug, String(b.kind || 'row'), String(b.target || ''), declared, now
      );
      this.sql.exec('INSERT INTO intents (ts, action, slug, payload) VALUES (?, ?, ?, ?)', now, 'register', slug, JSON.stringify(b));
      return this.j({ ok: true, slug, kind: String(b.kind || 'row'), target: String(b.target || ''), declared_at: declared });
    }

    if (op === 'intents') {
      const rows = [...this.sql.exec('SELECT id, ts, action, slug, payload FROM intents ORDER BY id DESC LIMIT 200')];
      return this.j({ ok: true, count: rows.length, intents: rows });
    }

    return this.j({ ok: false, error: 'unknown_op:' + op }, 400);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, name: 'loop-safe-directory-do', ts: new Date().toISOString() }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.pathname === '/do' || url.pathname.startsWith('/do/')) {
      const op = url.pathname === '/do' ? (url.searchParams.get('op') || 'ping') : url.pathname.slice('/do/'.length);
      const id = env.DIRECTORY_DO.idFromName(url.searchParams.get('name') || 'main');
      const stub = env.DIRECTORY_DO.get(id);
      const fwd = new URL('https://do/');
      fwd.searchParams.set('op', op || 'ping');
      const slug = url.searchParams.get('slug');
      if (slug) fwd.searchParams.set('slug', slug);
      const init = { method: request.method };
      if (request.method === 'POST') { init.body = await request.text(); init.headers = { 'content-type': 'application/json' }; }
      return stub.fetch(new Request(fwd.toString(), init));
    }
    return new Response(
      'loop-safe-directory-do: /health · /do/ping · /do/slug.list · /do/slug.resolve?slug=X · /do/slug.register (POST {slug,kind,target}) · /do/intents',
      { status: 200 }
    );
  },
};
