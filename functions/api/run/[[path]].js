// /api/run — the additive model loop over content_items.
// One endpoint does five things:
//   1. text mode: each model writes a small field (e.g. a 25-word definition) for each target.
//   2. every model answer is stored as a content_comment → models "come in and are additive".
//   3. accept: promote one model's answer into the item's body_json[field] (canonical sub-representation).
//   4. propagation is automatic: pages render a peptide's body_json fields live, so one accept flows everywhere.
//   5. image mode: generate a per-page image via Workers AI → R2 → /img/<slug>.png.
//
// POST /api/run
// {
//   "targets": ["topic-001"] | {"tag":"BPC-157"} | {"type":"peptide"},
//   "mode": "text" | "image",
//   "field": "def_mechanism_25w",        // sub-representation key (text mode)
//   "prompt": "Write a 25-word definition of how this works.",
//   "words": 25,
//   "models": ["@cf/meta/llama-3.3-70b-instruct-fp8-fast","openai:gpt-4o-mini","grok:grok-2-latest"],
//   "accept": "@cf/meta/llama-3.3-70b-instruct-fp8-fast"   // optional: which model becomes canonical
// }

function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}
function authed(request, env) { return !!env.TERMINAL_KEY && (request.headers.get('x-terminal-key') || '') === env.TERMINAL_KEY; }
const nowIso = () => new Date().toISOString();

const GUARD = 'Plain words a normal person understands. Define any technical term in plain words first. Never say treats, cures, prevents, reverses, fixes, heals, or replaces. State the connection at the tissue level only. If evidence is animal data, say so.';

async function resolveTargets(env, targets) {
  if (Array.isArray(targets)) {
    const out = [];
    for (const slug of targets) {
      const r = await env.DB.prepare('SELECT * FROM content_items WHERE slug=?').bind(String(slug)).first();
      if (r) out.push(r);
    }
    return out;
  }
  if (targets && targets.tag) {
    const rows = await env.DB.prepare("SELECT * FROM content_items WHERE tags_json LIKE ? ORDER BY type,(source_order IS NULL),source_order").bind('%"' + targets.tag + '"%').all();
    return rows.results || [];
  }
  if (targets && targets.type) {
    const rows = await env.DB.prepare('SELECT * FROM content_items WHERE type=? ORDER BY (source_order IS NULL),source_order').bind(targets.type).all();
    return rows.results || [];
  }
  return [];
}

function itemFacts(row) {
  let bj = {}; try { bj = row.body_json ? JSON.parse(row.body_json) : {}; } catch {}
  const facts = Object.entries(bj).filter(([k]) => k !== 'image_key' && !k.startsWith('def_') && !k.startsWith('field_'))
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
  return { title: row.title, facts, body: String(row.body_md || '').slice(0, 1200) };
}

async function callText(env, model, system, user) {
  if (model.startsWith('@cf/')) {
    const r = await env.AI.run(model, { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 400 });
    const val = r && (r.response ?? r.result ?? '');
    return typeof val === 'string' ? val : (val ? JSON.stringify(val) : '');
  }
  const [prov, ...rest] = model.split(':');
  const id = rest.join(':');
  const cfg = {
    openai: { url: 'https://api.openai.com/v1/chat/completions', key: env.OPENAI_API_KEY, model: id || 'gpt-4o-mini' },
    grok: { url: 'https://api.x.ai/v1/chat/completions', key: env.GROK_API_KEY, model: id || 'grok-2-latest' },
    kimi: { url: 'https://api.moonshot.ai/v1/chat/completions', key: env.MOONSHOT_API_KEY, model: id || 'moonshot-v1-8k' },
  }[prov];
  if (prov === 'gemini') {
    if (!env.GEMINI_API_KEY) return { skip: 'no GEMINI_API_KEY' };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${id || 'gemini-1.5-flash'}:generateContent?key=${env.GEMINI_API_KEY}`;
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }] }) });
    const j = await res.json();
    if (!res.ok) return { skip: 'gemini ' + res.status };
    return j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  if (!cfg) return { skip: 'unknown provider ' + prov };
  if (!cfg.key) return { skip: 'no key for ' + prov };
  const res = await fetch(cfg.url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key }, body: JSON.stringify({ model: cfg.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { skip: prov + ' ' + res.status + ' ' + (j?.error?.message || '') };
  return j?.choices?.[0]?.message?.content || '';
}

async function addComment(env, slug, model, type, md) {
  await env.DB.prepare('INSERT INTO content_comments(item_slug,model_name,comment_type,comment_md,proposed_patch_json,created_at) VALUES (?,?,?,?,?,?)')
    .bind(slug, model, type, md, null, nowIso()).run();
}

async function mergeBodyJson(env, slug, patch) {
  const cur = await env.DB.prepare('SELECT * FROM content_items WHERE slug=?').bind(slug).first();
  let bj = {}; try { bj = cur.body_json ? JSON.parse(cur.body_json) : {}; } catch {}
  const next = { ...bj, ...patch };
  const ts = nowIso();
  await env.DB.prepare('UPDATE content_items SET body_json=?, updated_at=? WHERE slug=?').bind(JSON.stringify(next), ts, slug).run();
  const row = await env.DB.prepare('SELECT * FROM content_items WHERE slug=?').bind(slug).first();
  const v = await env.DB.prepare('SELECT MAX(version) AS v FROM content_versions WHERE item_slug=?').bind(slug).first();
  await env.DB.prepare('INSERT INTO content_versions(item_slug,version,snapshot_json,change_note,created_by,created_at) VALUES (?,?,?,?,?,?)')
    .bind(slug, (v?.v || 0) + 1, JSON.stringify(row), 'field update: ' + Object.keys(patch).join(','), 'run', ts).run();
}

async function runText(env, body) {
  const targets = await resolveTargets(env, body.targets);
  if (!targets.length) return json({ error: 'no targets' }, 400);
  const models = body.models && body.models.length ? body.models : ['@cf/meta/llama-3.3-70b-instruct-fp8-fast'];
  const field = body.field || null;
  const words = body.words || null;
  const sys = (body.prompt || 'Write a short, plain definition.') + '\n\n' + GUARD + (words ? `\nHard limit: ${words} words or fewer.` : '');
  const out = {};
  for (const row of targets) {
    const f = itemFacts(row);
    const user = `Subject: ${f.title}\nKnown facts:\n${f.facts}\n\nArticle:\n${f.body}`;
    out[row.slug] = {};
    for (const model of models) {
      let ans;
      try { ans = await callText(env, model, sys, user); } catch (e) { ans = { skip: e.message }; }
      if (ans && ans.skip) { out[row.slug][model] = '[skip: ' + ans.skip + ']'; continue; }
      const text = String(ans || '').trim();
      out[row.slug][model] = text;
      await addComment(env, row.slug, model, field ? 'field:' + field : 'additive', text);
    }
    if (field && body.accept && out[row.slug][body.accept] && !out[row.slug][body.accept].startsWith('[skip')) {
      await mergeBodyJson(env, row.slug, { [field]: out[row.slug][body.accept] });
    }
  }
  return json({ mode: 'text', field, models, targets: targets.map(t => t.slug), out });
}

async function runImage(env, body) {
  const targets = await resolveTargets(env, body.targets);
  if (!targets.length) return json({ error: 'no targets' }, 400);
  const model = body.image_model || '@cf/black-forest-labs/flux-1-schnell';
  const out = {};
  for (const row of targets) {
    const f = itemFacts(row);
    const prompt = (body.prompt || 'Clean, photorealistic 3D medical illustration. Soft blue lighting from above, golden glow from below healed tissue. No text.') + ' Subject: ' + f.title;
    try {
      const r = await env.AI.run(model, { prompt });
      let bytes;
      if (r && r.image) bytes = Uint8Array.from(atob(r.image), c => c.charCodeAt(0));
      else if (r instanceof ArrayBuffer) bytes = new Uint8Array(r);
      else if (r && r.body) { bytes = new Uint8Array(await new Response(r.body).arrayBuffer()); }
      if (!bytes) { out[row.slug] = '[skip: no image bytes]'; continue; }
      const key = 'img/' + row.slug + '.png';
      await env.R2.put(key, bytes, { httpMetadata: { contentType: 'image/png' } });
      await mergeBodyJson(env, row.slug, { image_key: row.slug + '.png' });
      out[row.slug] = '/img/' + row.slug + '.png';
    } catch (e) { out[row.slug] = '[skip: ' + e.message + ']'; }
  }
  return json({ mode: 'image', model, out });
}

// confluence — the adversarial audition. Each model drafts; then a converging model
// scores every draft (0-100, the "weights"), merges the best into one superior version,
// and writes one question for the operator. the owner is voice of god: accept= promotes it.
async function runConfluence(env, body) {
  const targets = await resolveTargets(env, body.targets);
  if (!targets.length) return json({ error: 'no targets' }, 400);
  const models = body.models && body.models.length ? body.models : ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'gemini:gemini-1.5-flash'];
  const field = body.field || 'def_mechanism_25w';
  const words = body.words || 25;
  const CF_JUDGE = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  let judge = body.judge || CF_JUDGE;
  const sys = (body.prompt || 'Write the definition of how this peptide works.') + '\n\n' + GUARD + `\nHard limit: ${words} words or fewer.`;
  const out = {};
  for (const row of targets) {
    const f = itemFacts(row);
    const user = `Subject: ${f.title}\nKnown facts:\n${f.facts}\n\nArticle:\n${f.body}`;
    const drafts = {};
    for (const model of models) {
      let ans; try { ans = await callText(env, model, sys, user); } catch (e) { ans = { skip: e.message }; }
      const text = ans && ans.skip ? '[skip: ' + ans.skip + ']' : String(ans || '').trim();
      drafts[model] = text;
      await addComment(env, row.slug, model, 'draft:' + field, text);
    }
    const draftList = Object.entries(drafts).filter(([, v]) => !v.startsWith('[skip')).map(([m, v]) => `MODEL ${m}:\n${v}`).join('\n\n');
    const judgeSys = 'You are the convergence judge for a peptide content matrix. You are given drafts from several models. Return ONLY valid JSON, no prose, with this exact shape: {"scores":{"<model>":<0-100>,...},"best_model":"<model>","confluence":"<the single best merged version, obeying the word limit and the rules>","question_for_operator":"<one sharp question whose answer would make the piece better>"}. Rules for confluence text:\n' + GUARD + `\nHard limit: ${words} words.`;
    let parsed = null, raw = '';
    const judgeUser = `Subject: ${f.title}\n\nDrafts:\n${draftList}`;
    try {
      let jr = await callText(env, judge, judgeSys, judgeUser);
      if (jr && jr.skip && judge !== CF_JUDGE) { judge = CF_JUDGE; jr = await callText(env, judge, judgeSys, judgeUser); } // fall back to a Cloudflare judge
      raw = jr && jr.skip ? '[skip: ' + jr.skip + ']' : String(jr);
      const m = raw.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]);
    } catch (e) { raw = 'judge error: ' + e.message; }
    if (parsed) {
      await mergeBodyJson(env, row.slug, { scores: parsed.scores || {}, [field + '_confluence']: parsed.confluence || '', confluence_judge: judge });
      if (parsed.confluence) await addComment(env, row.slug, judge, 'confluence:' + field, parsed.confluence);
      if (parsed.question_for_operator) await addComment(env, row.slug, judge, 'question_for_operator', parsed.question_for_operator);
      if (body.accept && parsed.confluence) await mergeBodyJson(env, row.slug, { [field]: parsed.confluence });
      out[row.slug] = { drafts, scores: parsed.scores, best_model: parsed.best_model, confluence: parsed.confluence, question_for_operator: parsed.question_for_operator };
    } else {
      out[row.slug] = { drafts, judge_raw: String(raw).slice(0, 400), error: 'judge did not return JSON' };
    }
  }
  return json({ mode: 'confluence', field, models, judge, targets: targets.map(t => t.slug), out });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST,OPTIONS', 'access-control-allow-headers': 'content-type,x-terminal-key' } });
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  const body = await request.json().catch(() => ({}));
  try {
    if (body.mode === 'image') return await runImage(env, body);
    if (body.mode === 'confluence') return await runConfluence(env, body);
    return await runText(env, body);
  } catch (e) { return json({ error: 'unhandled: ' + (e?.message || String(e)) }, 500); }
}
