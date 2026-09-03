const REPO = '[OWNER_HANDLE]/miscsubjects-pages';
const DEFAULT_REF = 'main';

function json(o, s) { return new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } }); }
function authed(request, env) { return !!env.TERMINAL_KEY && (request.headers.get('x-terminal-key') || '') === env.TERMINAL_KEY; }
function pathOf(context) {
  const p = context.params && context.params.path;
  if (Array.isArray(p)) return p.join('/');
  return String(p || '');
}
function ghHeaders(env) {
  return {
    'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
    'User-Agent': 'miscsubjects-build',
    'Accept': 'application/vnd.github+json',
  };
}
function b64encode(s) { return btoa(unescape(encodeURIComponent(s))); }
function b64decode(s) { try { return decodeURIComponent(escape(atob(s.replace(/\n/g, '')))); } catch { return atob(s.replace(/\n/g, '')); } }

async function readMeta(env, path, ref) {
  const url = `https://api.github.com/repos/${REPO}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`;
  const r = await fetch(url, { headers: ghHeaders(env) });
  return { status: r.status, body: await r.text() };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.GITHUB_TOKEN) return json({ error: 'no GITHUB_TOKEN' }, 500);
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  const u = new URL(request.url);
  const ref = u.searchParams.get('ref') || DEFAULT_REF;

  if (u.searchParams.get('list')) {
    const treePath = u.searchParams.get('path') || pathOf(context) || '';
    if (!treePath) {
      const r = await fetch(`https://api.github.com/repos/${REPO}/git/trees/${encodeURIComponent(ref)}?recursive=1`, { headers: ghHeaders(env) });
      const j = JSON.parse(await r.text());
      const entries = (j.tree || []).filter(t => t.type === 'blob').map(t => ({ path: t.path, size: t.size, sha: t.sha }));
      return json({ ref, count: entries.length, entries });
    }
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${encodeURI(treePath)}?ref=${encodeURIComponent(ref)}`, { headers: ghHeaders(env) });
    const body = await r.text();
    return new Response(body, { status: r.status, headers: { 'content-type': 'application/json' } });
  }

  const path = pathOf(context);
  if (!path) return json({ error: 'path required' }, 400);
  const meta = await readMeta(env, path, ref);
  if (meta.status !== 200) return new Response(meta.body, { status: meta.status, headers: { 'content-type': 'application/json' } });
  const j = JSON.parse(meta.body);
  return json({ path: j.path, sha: j.sha, size: j.size, encoding: j.encoding, content: j.encoding === 'base64' ? b64decode(j.content || '') : (j.content || ''), html_url: j.html_url });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  if (!env.GITHUB_TOKEN) return json({ error: 'no GITHUB_TOKEN' }, 500);
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  const path = pathOf(context);
  if (!path) return json({ error: 'path required' }, 400);
  let body; try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const content = body && body.content != null ? String(body.content) : null;
  if (content == null) return json({ error: 'content required' }, 400);
  const ref = (body && body.ref) || DEFAULT_REF;
  let sha = body && body.sha ? String(body.sha) : null;
  if (!sha) {
    const meta = await readMeta(env, path, ref);
    if (meta.status === 200) { try { sha = JSON.parse(meta.body).sha; } catch {} }
  }
  const message = (body && body.message) || `Edit ${path} via /api/file`;
  const payload = { message, content: b64encode(content), branch: ref };
  if (sha) payload.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${encodeURI(path)}`, { method: 'PUT', headers: { ...ghHeaders(env), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const text = await r.text();
  return new Response(text, { status: r.status, headers: { 'content-type': 'application/json' } });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  if (!env.GITHUB_TOKEN) return json({ error: 'no GITHUB_TOKEN' }, 500);
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  const path = pathOf(context);
  if (!path) return json({ error: 'path required' }, 400);
  let body; try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const old_string = body && body.old_string != null ? String(body.old_string) : null;
  const new_string = body && body.new_string != null ? String(body.new_string) : null;
  if (old_string == null || new_string == null) return json({ error: 'old_string and new_string required' }, 400);

  const ref = (body && body.ref) || DEFAULT_REF;
  const meta = await readMeta(env, path, ref);
  if (meta.status !== 200) return new Response(meta.body, { status: meta.status, headers: { 'content-type': 'application/json' } });
  const j = JSON.parse(meta.body);
  const content = j.encoding === 'base64' ? b64decode(j.content || '') : (j.content || '');
  if (!content.includes(old_string)) return json({ error: 'old_string not found in file' }, 400);

  const updated = content.replace(old_string, new_string);
  const message = (body && body.message) || `Patch ${path} via /api/file`;
  const payload = { message, content: b64encode(updated), branch: ref, sha: j.sha };
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${encodeURI(path)}`, { method: 'PUT', headers: { ...ghHeaders(env), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const text = await r.text();
  return new Response(text, { status: r.status, headers: { 'content-type': 'application/json' } });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!env.GITHUB_TOKEN) return json({ error: 'no GITHUB_TOKEN' }, 500);
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  const path = pathOf(context);
  if (!path) return json({ error: 'path required' }, 400);
  let body = {}; try { body = await request.json(); } catch {}
  const ref = (body && body.ref) || DEFAULT_REF;
  let sha = body && body.sha ? String(body.sha) : null;
  if (!sha) {
    const meta = await readMeta(env, path, ref);
    if (meta.status === 200) { try { sha = JSON.parse(meta.body).sha; } catch {} }
  }
  if (!sha) return json({ error: 'cannot resolve current sha' }, 400);
  const message = (body && body.message) || `Delete ${path} via /api/file`;
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${encodeURI(path)}`, { method: 'DELETE', headers: { ...ghHeaders(env), 'Content-Type': 'application/json' }, body: JSON.stringify({ message, sha, branch: ref }) });
  const text = await r.text();
  return new Response(text, { status: r.status, headers: { 'content-type': 'application/json' } });
}
