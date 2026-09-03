// Unified state-card builder: LEDGER events (chronology) + agent_turns (CLI turns) → one timeline.
import { classify, cardHash } from './ledger_taxonomy.js';
import { cardMatchesService } from './ledger_event_view.js';

function cliActorOf(cmd) {
  const t = String(cmd || '').trim().split(/\s+/)[0] || '';
  const base = t.split('/').pop();
  if (['wrangler', 'gh', 'npm', 'npx', 'clasp', 'git', 'curl', 'python', 'python3', 'node', 'jq', 'sed', 'grep', 'awk'].includes(base)) return base;
  return 'shell';
}

async function agentPromptOf(env, key, cache) {
  if (!key) return '';
  if (cache.has(key)) return cache.get(key);
  let content = '';
  try {
    const row = await env.DB.prepare('SELECT content, type FROM directory WHERE key = ?').bind(key).first();
    if (row && row.type === 'agent') content = String(row.content || '');
  } catch {}
  cache.set(key, content);
  return content;
}

async function dirTypeMap(env) {
  const m = {};
  try {
    const r = await env.DB.prepare('SELECT key, type FROM directory').all();
    for (const row of (r.results || [])) m[row.key] = row.type;
  } catch {}
  return m;
}

function tryJson(s) {
  try { return JSON.parse(String(s || '')); } catch { return null; }
}

// MY MESSAGE / YOUR MESSAGE must be the human/agent TEXT, never the raw JSON envelope
// ({session,cwd,text,...}). Pull the text field out; leave raw payloads to the raw section.
function cleanText(s) {
  const str = String(s == null ? '' : s).trim();
  const j = tryJson(str);
  if (j && typeof j === 'object') {
    const t = j.text ?? j.turn ?? j.message ?? j.reply ?? j.user_input ?? j.assistant_text ?? j.prompt;
    if (t != null && String(t).trim()) return String(t).trim();
  }
  return str;
}

function reText(row, which) {
  return String((which === 'in' ? (row.request_json || row.request_preview) : (row.response_json || row.response_preview)) || '');
}

function plainFromPayload(raw) {
  const j = tryJson(raw);
  if (!j || typeof j !== 'object') return '';
  return String(j.text ?? j.turn ?? j.message ?? j.reply ?? '').trim();
}

function toolsFromJsonList(raw) {
  let list = [];
  try { list = JSON.parse(raw || '[]'); } catch {}
  // Agents also post tools as a plain comma-separated string ("browser, capability").
  // Stored quoted, that parses to a STRING, and .map on it threw — which blanked the
  // ENTIRE cards feed, not just the one card (2026-07-27, first misc-cli turn rows).
  if (typeof list === 'string') list = list.split(',').map((x) => x.trim());
  if (!Array.isArray(list)) return [];
  return list.map((tl) => (typeof tl === 'string' ? tl : (tl.name || tl.tool || tl.key || ''))).filter(Boolean);
}

function toolsFromEvents(events) {
  const out = [];
  for (const e of (events || [])) {
    if (e.source === 'dispatch' && e.key && e.key !== 'ROUTER') out.push(e.key);
    else if (e.action === 'tools/call' && e.key) out.push(e.key);
    else if ((e.action === 'bash' || e.action === 'tool' || e.action === 'edit') && e.key) out.push(e.key);
  }
  return [...new Set(out)];
}

function mergeTools(...lists) {
  return [...new Set(lists.flat().filter(Boolean))];
}

function lastReply(s) {
  const str = String(s || '');
  const re = /\[REPLY\]([\s\S]*?)\[\/REPLY\]/g;
  let m, last = null;
  while ((m = re.exec(str)) !== null) last = m[1];
  if (last == null) {
    const o = str.lastIndexOf('[REPLY]');
    if (o !== -1) last = str.slice(o + 7);
  }
  return last == null ? '' : last.replace(/\[\/?(REASONING|DONE|SELF|REPLY)\]/g, '').replace(/\s+/g, ' ').trim();
}

function inboundOf(s) {
  const i = String(s || '').lastIndexOf('Now:');
  return i === -1 ? '' : String(s).slice(i + 4).trim();
}

function cliCardSource(agent, rawSource) {
  const a = String(agent || '').toLowerCase();
  const s = String(rawSource || '').toLowerCase();
  if (a === 'grok' || s === 'grok-cli') return 'grok-cli';
  if (a === 'claude' || s === 'claude-code') return 'claude-code';
  if (s.startsWith('cli-')) return s;
  return rawSource || 'hook';
}

function evidenceFromCli(tools, cmds, files, source, actor) {
  const events = [];
  let stepN = 0;
  for (const cmd of cmds) {
    const a = cliActorOf(typeof cmd === 'string' ? cmd : (cmd.command || ''));
    events.push({
      step: stepN++, ts: null, source, key: a.toUpperCase(), action: 'bash',
      group: 'cli', category: 'cli', actor: a,
      request: String(typeof cmd === 'string' ? cmd : (cmd.command || '')).slice(0, 800),
      response: '',
    });
  }
  for (const f of files) {
    events.push({
      step: stepN++, ts: null, source, key: 'FILE_EDIT', action: 'edit',
      group: 'tools', category: 'file', actor: 'file',
      request: String(typeof f === 'string' ? f : (f.path || JSON.stringify(f))).slice(0, 400),
      response: '',
    });
  }
  for (const tl of tools) {
    const name = typeof tl === 'string' ? tl : (tl.name || tl.tool || '');
    if (['Bash', 'Edit', 'Write', 'Read'].includes(name)) continue;
    events.push({
      step: stepN++, ts: null, source, key: name, action: 'tool',
      group: 'sources', category: actor, actor,
      request: String(name), response: '',
    });
  }
  return events;
}

async function agentTurnToCard(env, t, promptCache) {
  let tools = [];
  let cmds = [];
  let files = [];
  let tags = [];
  try { tools = JSON.parse(t.tools_json || '[]'); } catch {}
  // A quoted comma string here iterated as characters and produced one-letter tool chips.
  if (typeof tools === 'string') tools = tools.split(',').map((x) => x.trim()).filter(Boolean);
  if (!Array.isArray(tools)) tools = [];
  try { cmds = JSON.parse(t.commands_json || '[]'); } catch {}
  if (!Array.isArray(cmds)) cmds = [];
  try { files = JSON.parse(t.files_json || '[]'); } catch {}
  try { tags = JSON.parse(t.tags_json || '[]'); } catch {}
  const agent = String(t.agent || 'unknown');
  const cardSource = cliCardSource(agent, t.source);
  const events = evidenceFromCli(tools, cmds, files, cardSource, agent);
  const tools_used = mergeTools(
    toolsFromJsonList(t.tools_json),
    toolsFromEvents(events),
    cmds.map((c) => cliActorOf(typeof c === 'string' ? c : (c.command || '')).toUpperCase()).filter((x) => x !== 'SHELL'),
    files.length ? ['FILE_EDIT'] : [],
    t.dispatch_key ? [t.dispatch_key] : [],
  );
  const promptKey = t.dispatch_key || (agent === 'grok' ? 'CLI_GROK_XAI' : agent === 'claude' ? 'CLI_CLAUDE_CODE' : agent === 'kimi' ? 'CLI_KIMI' : null);
  const system_prompt = t.system_prompt || (promptKey ? await agentPromptOf(env, promptKey, promptCache) : '') || null;
  return {
    card_id: 'at_' + t.id,
    trace_id: t.trace_id || null,
    ts: t.ts || '',
    source: cardSource,
    group: 'agents',
    category: 'agent',
    actor: agent,
    input: cleanText(t.user_input),
    output: cleanText(t.assistant_text),
    system_prompt: system_prompt || null,
    routed: t.dispatch_key || agent,
    tools_used,
    n_events: events.length,
    events,
    kind: 'agent_turn',
    meta: {
      id: t.id,
      session: t.session || null,
      cwd: t.cwd || null,
      input_kind: t.input_kind || null,
      n_tools: Number(t.n_tools || tools.length || 0),
      tags,
      audit_verdict: t.audit_verdict || null,
      audit_note: t.audit_note || null,
      dispatch_key: t.dispatch_key || null,
      turn_key: t.turn_key || null,
      r2_stdout_key: t.r2_stdout_key || null,
      prompt_path: t.prompt_path || null,
      assistant_path: t.assistant_path || null,
      user_input_sha256: t.user_input_sha256 || null,
      assistant_sha256: t.assistant_sha256 || null,
    },
    hash: cardHash('at_' + t.id + '|' + (t.user_input || '') + '|' + (t.assistant_text || '')),
  };
}

export async function buildTraceCards(env, opts = {}) {
  if (!env.LEDGER) return [];
  const fCard = opts.card_id || '';
  const limit = Math.min(parseInt(opts.limit || '40', 10) || 40, 300);
  const dmap = await dirTypeMap(env);
  const promptCache = new Map();

  if (fCard && (fCard.startsWith('at_') || fCard.startsWith('cc_') || fCard.startsWith('gr_'))) return [];

  const where = ['trace_id IS NOT NULL'];
  const binds = [];
  if (fCard) { where.push('trace_id = ?'); binds.push(fCard); }
  if (opts.trace_id) { where.push('trace_id = ?'); binds.push(opts.trace_id); }
  const sql =
    'SELECT id, ts, source, key, action, direction, status, trace_id, step, ' +
    'request_preview, response_preview, request_json, response_json ' +
    'FROM events WHERE ' + where.join(' AND ') + ' ORDER BY ts DESC LIMIT ?';
  binds.push(Math.min(limit * 16, 4000));
  const r = await env.LEDGER.prepare(sql).bind(...binds).all();
  const byTrace = {};
  for (const row of (r.results || [])) (byTrace[row.trace_id] = byTrace[row.trace_id] || []).push(row);

  const cards = [];
  for (const [tid, steps] of Object.entries(byTrace)) {
    steps.sort((a, b) => String(a.ts).localeCompare(String(b.ts)) || (a.step || 0) - (b.step || 0));
    const events = steps.map((x) => {
      const c = classify({ source: x.source, key: x.key, dirType: dmap[x.key] });
      return {
        id: x.id, ts: x.ts, source: x.source, key: x.key, action: x.action, status: x.status,
        group: c.group, category: c.category, actor: c.actor,
        request: String(reText(x, 'in')).slice(0, 800),
        response: String(reText(x, 'out')).slice(0, 1200),
      };
    });
    const brain = steps.find((x) => x.key === 'ROUTER') || steps.find((x) => dmap[x.key] === 'agent');
    let bMsg = '', bReply = '';
    const bev = steps.find((x) => x.source === 'blooio' && /"router":true/.test(String(x.request_preview || '')));
    if (bev) { const p = tryJson(bev.request_preview); if (p) { bMsg = String(p.turn ?? p.text ?? p.message ?? ''); bReply = String(p.reply ?? ''); } }
    const blooIn = steps.find((x) => x.source === 'blooio' && (x.action === 'turn_in' || x.action === 'message_in'));
    if (blooIn) { const p = plainFromPayload(reText(blooIn, 'in')); if (p) bMsg = bMsg || p; }
    let inMsg = '';
    const mi = steps.find((x) => x.action === 'message_in');
    if (mi) inMsg = plainFromPayload(reText(mi, 'in'));
    const cliIn = steps.find((x) => x.action === 'turn_in' && (x.source === 'grok-cli' || x.source === 'claude-code' || String(x.source || '').startsWith('cli-')));
    if (cliIn) inMsg = inMsg || plainFromPayload(reText(cliIn, 'in'));
    const input = inMsg || bMsg || (brain ? inboundOf(reText(brain, 'in')) : '') || (steps[0] ? plainFromPayload(reText(steps[0], 'in')) || String(reText(steps[0], 'in')).slice(0, 400) : '');
    let cliOut = '';
    const co = steps.find((x) => x.action === 'turn_out' && (x.source === 'grok-cli' || x.source === 'claude-code' || String(x.source || '').startsWith('cli-')));
    if (co) cliOut = plainFromPayload(reText(co, 'out'));
    const blooOut = steps.find((x) => x.source === 'blooio' && x.action === 'turn_out');
    if (blooOut) cliOut = cliOut || plainFromPayload(reText(blooOut, 'out'));
    const output = cliOut || bReply || lastReply(steps.map((x) => reText(x, 'out')).join('\n')) || (steps.length ? plainFromPayload(reText(steps[steps.length - 1], 'out')) || String(reText(steps[steps.length - 1], 'out')).slice(0, 600) : '');
    const tools_used = toolsFromEvents(events);
    let sysPrompt = brain ? await agentPromptOf(env, brain.key, promptCache) : '';
    if (!sysPrompt && cliIn && cliIn.source === 'grok-cli') {
      sysPrompt = await agentPromptOf(env, 'CLI_GROK_XAI', promptCache);
    }
    let cardCat, cardActor, cardGroup;
    if (brain) {
      const c = classify({ source: 'dispatch', key: brain.key, dirType: 'agent' });
      cardCat = c.category; cardActor = c.actor; cardGroup = c.group;
    } else {
      const lead = events.find((e) => e.category !== 'channel') || events[0] || {};
      cardCat = lead.category || 'other';
      cardActor = lead.actor || '';
      cardGroup = lead.group || 'other';
    }
    cards.push({
      card_id: tid,
      trace_id: tid,
      hash: cardHash(tid + '|' + input + '|' + output),
      ts: steps[steps.length - 1].ts,
      source: brain ? 'dispatch' : ((steps[0] && steps[0].source) || ''),
      group: cardGroup,
      category: cardCat,
      actor: cardActor,
      input: cleanText(input),
      output: cleanText(output),
      system_prompt: sysPrompt || null,
      routed: brain ? cardActor : null,
      tools_used,
      n_events: events.length,
      events,
      kind: 'trace',
      meta: {},
    });
  }
  return cards;
}

export async function buildAgentTurnCards(env, opts = {}) {
  if (!env.DB) return [];
  const limit = Math.min(parseInt(opts.limit || '300', 10) || 300, 5000);
  const promptCache = new Map();
  const binds = [];
  const where = [];
  if (opts.card_id && opts.card_id.startsWith('at_')) {
    where.push('id = ?');
    binds.push(parseInt(opts.card_id.slice(3), 10));
  } else if (opts.card_id && opts.card_id.startsWith('cc_')) {
    try {
      const cc = await env.DB.prepare(
        'SELECT id, ts, session, cwd, user_input, assistant_text, n_tools, tools_json, commands_json, files_json, input_kind, system_prompt, NULL as trace_id, NULL as source, NULL as agent, NULL as audit_verdict, NULL as audit_note, NULL as audit_engine, NULL as r2_stdout_key, NULL as dispatch_key, NULL as tags_json, NULL as turn_key FROM cc_turns WHERE id = ?'
      ).bind(parseInt(opts.card_id.slice(3), 10)).first();
      if (cc) {
        cc.agent = 'claude';
        cc.source = 'claude-code';
        const card = await agentTurnToCard(env, cc, promptCache);
        card.card_id = 'cc_' + cc.id;
        card.hash = cardHash(card.card_id + '|' + (cc.user_input || '') + '|' + (cc.assistant_text || ''));
        return [card];
      }
    } catch {}
    return [];
  } else if (opts.card_id && opts.card_id.startsWith('gr_')) {
    try {
      const gr = await env.DB.prepare(
        'SELECT id, ts, session, cwd, user_input, assistant_text, n_tools, tools_json, commands_json, files_json, input_kind, system_prompt, NULL as trace_id, NULL as source, NULL as agent, NULL as audit_verdict, NULL as audit_note, NULL as audit_engine, NULL as r2_stdout_key, NULL as dispatch_key, NULL as tags_json, turn_key FROM grok_turns WHERE id = ?'
      ).bind(parseInt(opts.card_id.slice(3), 10)).first();
      if (gr) {
        gr.agent = 'grok';
        gr.source = 'grok-cli';
        gr.dispatch_key = 'CLI_GROK_XAI';
        const card = await agentTurnToCard(env, gr, promptCache);
        card.card_id = 'gr_' + gr.id;
        card.hash = cardHash(card.card_id + '|' + (gr.user_input || '') + '|' + (gr.assistant_text || ''));
        return [card];
      }
    } catch {}
    return [];
  }
  if (opts.trace_id) { where.push('trace_id = ?'); binds.push(opts.trace_id); }
  if (opts.session && opts.session !== 'all') { where.push('session = ?'); binds.push(opts.session); }
  const agentFilter = (opts.agent && opts.agent !== 'all') ? opts.agent : ((opts.actor && opts.actor !== 'all') ? opts.actor : '');
  if (agentFilter) { where.push('agent = ?'); binds.push(agentFilter); }
  if (opts.source && opts.source !== 'all') { where.push('source = ?'); binds.push(opts.source); }
  if (opts.tag && opts.tag !== 'all') { where.push('tags_json LIKE ?'); binds.push('%"' + opts.tag + '"%'); }
  let sql = 'SELECT id, ts, agent, source, session, trace_id, cwd, input_kind, user_input, user_input_chars, assistant_text, audit_verdict, audit_note, audit_engine, n_tools, tools_json, commands_json, files_json, r2_stdout_key, dispatch_key, tags_json, turn_key, user_input_sha256, assistant_sha256, prompt_path, assistant_path FROM agent_turns';
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY id DESC LIMIT ?';
  binds.push(limit);
  const r = await env.DB.prepare(sql).bind(...binds).all();
  const cards = [];
  for (const row of (r.results || [])) cards.push(await agentTurnToCard(env, row, promptCache));
  return cards;
}

function matchCard(card, opts) {
  const fSource = opts.source || '';
  const fCat = opts.category || '';
  const fGroup = opts.group || '';
  const fActor = opts.actor || '';
  const fAgent = opts.agent || '';
  const fQ = (opts.q || '').toLowerCase();
  if (opts.service && opts.service !== 'all' && !cardMatchesService(card, opts.service)) return false;
  if (fAgent && fAgent !== 'all' && card.actor !== fAgent && card.meta?.id == null) return false;
  if (fAgent && fAgent !== 'all' && card.kind === 'agent_turn' && card.actor !== fAgent) return false;
  if (fSource && fSource !== 'all' && card.source !== fSource && !card.events.some((e) => e.source === fSource)) return false;
  if (fCat && card.category !== fCat && !card.events.some((e) => e.category === fCat)) return false;
  if (fGroup && card.group !== fGroup && !card.events.some((e) => e.group === fGroup)) return false;
  if (fActor && card.actor !== fActor && !card.events.some((e) => e.actor === fActor)) return false;
  if (fQ) {
    const hay = (card.input + ' ' + card.output + ' ' + card.events.map((e) => e.key + ' ' + e.request).join(' ') + ' ' + (card.trace_id || '') + ' ' + card.card_id).toLowerCase();
    if (!hay.includes(fQ)) return false;
  }
  return true;
}

export function mergeIntoFlows(traceCards, agentCards) {
  const byTrace = new Map();

  for (const root of traceCards) {
    byTrace.set(root.trace_id, { trace_id: root.trace_id, ts: root.ts, root, children: [] });
  }

  for (const child of agentCards) {
    const tid = child.trace_id;
    if (tid) {
      if (!byTrace.has(tid)) {
        byTrace.set(tid, {
          trace_id: tid,
          ts: child.ts,
          root: {
            card_id: tid,
            trace_id: tid,
            ts: child.ts,
            source: 'linked',
            group: 'agents',
            category: 'agent',
            actor: 'flow',
            input: '',
            output: '',
            system_prompt: null,
            routed: null,
            n_events: 0,
            events: [],
            kind: 'trace_stub',
            meta: {},
            hash: cardHash(tid),
          },
          children: [],
        });
      }
      const flow = byTrace.get(tid);
      flow.children.push(child);
      if (String(child.ts) > String(flow.ts)) flow.ts = child.ts;
      flow.children.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    } else {
      byTrace.set('solo:' + child.card_id, {
        trace_id: null,
        ts: child.ts,
        root: child,
        children: [],
      });
    }
  }

  for (const flow of byTrace.values()) {
    if (flow.root.kind === 'trace' && flow.children.length) {
      flow.root.meta = { ...flow.root.meta, child_turns: flow.children.length };
    }
  }

  return [...byTrace.values()].sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
}

export async function buildUnifiedCards(env, opts = {}) {
  const limit = Math.min(parseInt(opts.limit || '40', 10) || 40, 500);
  const traceCards = await buildTraceCards(env, opts);
  const agentCards = await buildAgentTurnCards(env, { ...opts, limit: Math.max(limit * 4, 200) });
  const flows = mergeIntoFlows(traceCards, agentCards)
    .filter((flow) => matchCard(flow.root, opts) || flow.children.some((c) => matchCard(c, opts)));

  const cards = [];
  for (const flow of flows) {
    if (flow.root.kind === 'agent_turn') {
      cards.push(flow.root);
    } else if (flow.root.kind === 'trace_stub') {
      for (const c of flow.children) cards.push(c);
    } else if (flow.root.kind === 'trace' && !flow.root.input && !flow.root.output && flow.children.length) {
      for (const c of flow.children) cards.push(c);
    } else {
      cards.push(flow.root);
      for (const c of flow.children) cards.push(c);
    }
  }
  let filtered = cards.filter((c) => matchCard(c, opts));
  // Cron (TODO_RUN) buries the real agent turns — drop it unless explicitly kept (hide_noise='0').
  if (opts.hide_noise !== '0') {
    filtered = filtered.filter((c) => String(c.routed || c.actor || c.key || '') !== 'TODO_RUN' && c.category !== 'cron');
  }
  filtered.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  const timeline = filtered.slice(0, limit);

  // `flows` is the internal trace-grouping scratch; nothing downstream reads it and it is
  // ~97% of the payload (1.7MB for 24 cards). Keep it out of the response so the turns view
  // is not re-pulling a megabyte of dead weight every refresh.
  return { count: timeline.length, cards: timeline };
}

export async function fetchTraceEvents(env, traceId, limit = 500) {
  if (!env.LEDGER || !traceId) return [];
  const r = await env.LEDGER.prepare(
    'SELECT id, ts, source, key, action, direction, status, trace_id, step, request_preview, response_preview, request_json, response_json FROM events WHERE trace_id = ? ORDER BY ts ASC, step ASC LIMIT ?'
  ).bind(traceId, Math.min(limit, 2000)).all();
  return r.results || [];
}

export async function fetchRecentEvents(env, opts = {}) {
  if (!env.LEDGER) return [];
  const limit = Math.min(parseInt(opts.limit || '100', 10) || 100, 500);
  const binds = [];
  const where = [];
  if (opts.source) { where.push('source = ?'); binds.push(opts.source); }
  if (opts.trace_id) { where.push('trace_id = ?'); binds.push(opts.trace_id); }
  if (opts.q) {
    where.push('(key LIKE ? OR action LIKE ? OR request_preview LIKE ? OR response_preview LIKE ?)');
    const like = '%' + opts.q + '%';
    binds.push(like, like, like, like);
  }
  const sql =
    'SELECT id, ts, source, key, action, direction, status, trace_id, step, request_preview, response_preview FROM events ' +
    (where.length ? 'WHERE ' + where.join(' AND ') + ' ' : '') +
    'ORDER BY ts DESC LIMIT ?';
  binds.push(limit);
  const r = await env.LEDGER.prepare(sql).bind(...binds).all();
  return r.results || [];
}
