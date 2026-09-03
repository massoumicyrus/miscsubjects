import { logEvent } from '../../_lib/event_log.js';
import { isBuildAuthed } from '../../_lib/admin_session.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/forge', '').replace(/^\//, '');
  const segments = path.split('/').filter(Boolean);

  if (request.method !== 'GET' && !(await isBuildAuthed(request, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized — x-terminal-key or admin session required' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  
  // GET /api/forge — list all forge runs
  if (request.method === 'GET' && segments.length === 0) {
    const r = await env.DB.prepare('SELECT id, topic, slug, stage, model_count, created_at, updated_at, published, final_score FROM forge_runs ORDER BY created_at DESC').all();
    return new Response(JSON.stringify({ runs: r.results || [] }), { headers: { 'content-type': 'application/json' } });
  }
  
  // GET /api/forge/:id — get one run + contributions
  if (request.method === 'GET' && segments.length === 1) {
    const id = segments[0];
    const run = await env.DB.prepare('SELECT * FROM forge_runs WHERE id = ?').bind(id).first();
    if (!run) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    
    const contributions = await env.DB.prepare('SELECT * FROM forge_contributions WHERE run_id = ? ORDER BY created_at ASC').bind(id).all();
    return new Response(JSON.stringify({ run, contributions: contributions.results || [] }), { headers: { 'content-type': 'application/json' } });
  }
  
  // POST /api/forge — create new run
  if (request.method === 'POST' && segments.length === 0) {
    const body = await request.json().catch(() => ({}));
    const topic = body.topic || body.slug || 'untitled';
    const slug = body.slug || topic.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const modelCount = Math.min(parseInt(body.model_count || '3', 10), 10);
    const id = 'fr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const now = new Date().toISOString();
    
    await env.DB.prepare('INSERT INTO forge_runs (id, topic, slug, stage, model_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, topic, slug, 'outline', modelCount, now, now).run();
    
    // Also create the article shell
    await env.DB.prepare('INSERT OR REPLACE INTO articles (slug, title, subject, published, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)')
      .bind(slug, topic, topic, now, now).run();

    await logEvent(env, {
      source: 'forge', key: 'FORGE_CREATE', action: 'create', direction: 'in', status: 200,
      request: body, response: { id, topic, slug, stage: 'outline', model_count: modelCount },
    });

    return new Response(JSON.stringify({ id, topic, slug, stage: 'outline', model_count: modelCount }), { headers: { 'content-type': 'application/json' } });
  }
  
  // POST /api/forge/:id/stage — advance stage
  if (request.method === 'POST' && segments.length === 2 && segments[1] === 'stage') {
    const id = segments[0];
    const body = await request.json().catch(() => ({}));
    const stage = body.stage;
    const validStages = ['outline', 'draft', 'review', 'publish'];
    if (!validStages.includes(stage)) {
      return new Response(JSON.stringify({ error: 'invalid stage', valid: validStages }), { status: 400, headers: { 'content-type': 'application/json' } });
    }
    
    const now = new Date().toISOString();
    await env.DB.prepare('UPDATE forge_runs SET stage = ?, updated_at = ? WHERE id = ?').bind(stage, now, id).run();
    return new Response(JSON.stringify({ id, stage, updated_at: now }), { headers: { 'content-type': 'application/json' } });
  }
  
  // POST /api/forge/:id/contribute — add model contribution
  if (request.method === 'POST' && segments.length === 2 && segments[1] === 'contribute') {
    const id = segments[0];
    const body = await request.json().catch(() => ({}));
    const modelKey = body.model_key || 'unknown';
    const stage = body.stage || 'outline';
    const slotKey = body.slot_key || '';
    const content = body.content || '';
    const ledgerHash = body.ledger_hash || '';
    const now = new Date().toISOString();
    
    const result = await env.DB.prepare('INSERT INTO forge_contributions (run_id, model_key, stage, slot_key, content, ledger_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, modelKey, stage, slotKey, content, ledgerHash, now).run();
    
    return new Response(JSON.stringify({ id: result.meta.last_row_id, run_id: id, model_key: modelKey, stage }), { headers: { 'content-type': 'application/json' } });
  }
  
  // POST /api/forge/:id/accept — accept a contribution
  if (request.method === 'POST' && segments.length === 2 && segments[1] === 'accept') {
    const id = segments[0];
    const body = await request.json().catch(() => ({}));
    const contribId = body.contribution_id;
    
    const contrib = await env.DB.prepare('SELECT * FROM forge_contributions WHERE id = ? AND run_id = ?').bind(contribId, id).first();
    if (!contrib) return new Response(JSON.stringify({ error: 'contribution not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    
    await env.DB.prepare('UPDATE forge_contributions SET accepted = 1 WHERE id = ?').bind(contribId).run();
    
    // Also write to article_slots
    const now = new Date().toISOString();
    const run = await env.DB.prepare('SELECT slug FROM forge_runs WHERE id = ?').bind(id).first();
    if (run && contrib.slot_key) {
      const version = await env.DB.prepare('SELECT MAX(version) as v FROM article_slots WHERE article_slug = ? AND slot_key = ?').bind(run.slug, contrib.slot_key).first();
      const nextVersion = (version?.v || 0) + 1;
      await env.DB.prepare('INSERT INTO article_slots (article_slug, slot_key, content, model, version, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(run.slug, contrib.slot_key, contrib.content, contrib.model_key, nextVersion, now).run();
    }
    
    return new Response(JSON.stringify({ accepted: true, contribution_id: contribId }), { headers: { 'content-type': 'application/json' } });
  }
  
  // POST /api/forge/:id/publish — finalize article
  if (request.method === 'POST' && segments.length === 2 && segments[1] === 'publish') {
    const id = segments[0];
    const now = new Date().toISOString();
    
    const run = await env.DB.prepare('SELECT * FROM forge_runs WHERE id = ?').bind(id).first();
    if (!run) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    
    await env.DB.prepare('UPDATE forge_runs SET stage = ?, published = 1, updated_at = ? WHERE id = ?').bind('publish', now, id).run();
    await env.DB.prepare('UPDATE articles SET published = 1, updated_at = ? WHERE slug = ?').bind(now, run.slug).run();
    
    return new Response(JSON.stringify({ id, published: true, slug: run.slug }), { headers: { 'content-type': 'application/json' } });
  }
  
  return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
}
