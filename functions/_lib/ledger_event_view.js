// Ledger Events view — service labels, PST time, you/agent/did columns.

export const SERVICE_COLOR = {
  blooio: '#9dffb0',
  'grok API': '#ff7bd1',
  'grok-cli': '#ff9ad6',
  'claude-cli': '#f4a09c',
  'codex-cli': '#b7dfc7',
  'misc-cli': '#8ad6ff',
  stripe: '#a3ffb0',
  bridge: '#c0a8ff',
  mcp: '#ffd479',
  router: '#74d7ff',
  cron: '#e8e8e8',
  build: '#a3c2ff',
  wrangler: '#ffae8a',
  'wrangler CLI': '#ffae8a',
  github: '#d4d4d4',
  other: '#dedede',
};

const TZ = 'America/Los_Angeles';

function tryJson(s) {
  try { return JSON.parse(String(s || '')); } catch { return null; }
}

export function serviceLabel(row) {
  const src = String(row.source || '').toLowerCase();
  const key = String(row.key || '').toUpperCase();
  if (src === 'blooio') return 'blooio';
  if (src === 'grok-cli' || src === 'cli-grok') return 'grok-cli';
  if (src === 'grok') return 'grok API';
  if (src === 'claude-code' || src === 'cli-claude') return 'claude-cli';
  if (src === 'codex-cli' || src === 'cli-codex') return 'codex-cli';
  // misc writes tool events as misc-cli and its turns arrive as cli-misc. One agent, one chip.
  if (src === 'misc-cli' || src === 'cli-misc') return 'misc-cli';
  if (src.startsWith('cli-')) return src.slice(4) + ' CLI';
  if (src === 'stripe') return 'stripe';
  if (src === 'bridge') return 'bridge';
  if (src === 'mcp') return 'mcp';
  if (src === 'github') return 'github';
  if (src === '2chat') return '2chat';
  if (src === 'dispatch' || src === '') {
    if (key === 'ROUTER') return 'router';
    if (key === 'TODO_RUN') return 'cron';
    if (key) return key;
    return 'build';
  }
  return src || 'other';
}

export function serviceWhereByLabel(label) {
  const L = String(label || '');
  if (!L || L === 'all') return null;
  if (L === 'blooio') return { clause: 'source = ?', binds: ['blooio'] };
  if (L === 'grok API') return { clause: 'source = ?', binds: ['grok'] };
  if (L === 'grok-cli') return { clause: '(source = ? OR source = ?)', binds: ['grok-cli', 'cli-grok'] };
  if (L === 'claude-cli') return { clause: '(source = ? OR source = ?)', binds: ['claude-code', 'cli-claude'] };
  if (L === 'codex-cli') return { clause: '(source = ? OR source = ?)', binds: ['codex-cli', 'cli-codex'] };
  if (L === 'misc-cli') return { clause: '(source = ? OR source = ?)', binds: ['misc-cli', 'cli-misc'] };
  if (L === 'stripe') return { clause: 'source = ?', binds: ['stripe'] };
  if (L === 'bridge') return { clause: 'source = ?', binds: ['bridge'] };
  if (L === 'mcp') return { clause: 'source = ?', binds: ['mcp'] };
  if (L === 'router') return { clause: '(source = ? AND key = ?)', binds: ['dispatch', 'ROUTER'] };
  if (L === 'cron') return { clause: 'key = ?', binds: ['TODO_RUN'] };
  if (L === 'build') return { clause: '(source = ? AND (key IS NULL OR key = ?))', binds: ['dispatch', ''] };
  if (L === 'github') return { clause: 'source = ?', binds: ['github'] };
  if (L === '2chat') return { clause: 'source = ?', binds: ['2chat'] };
  if (L.endsWith(' CLI')) return { clause: 'source = ?', binds: ['cli-' + L.slice(0, -4).toLowerCase()] };
  if (L === 'other') return null;
  if (L === L.toUpperCase() && /[A-Z0-9_]/.test(L)) {
    return { clause: '(source = ? AND key = ?)', binds: ['dispatch', L] };
  }
  return { clause: 'source = ?', binds: [L.toLowerCase()] };
}

export function svcColorForLabel(label) {
  const L = String(label || '');
  if (SERVICE_COLOR[L]) return SERVICE_COLOR[L];
  const u = L.toUpperCase();
  if (u.startsWith('CLI_')) return '#ffae8a';
  if (u.startsWith('ASK_')) return '#ff7bd1';
  if (u.startsWith('WRANGLER_')) return '#ffae8a';
  if (u.startsWith('CF_')) return '#f48120';
  return SERVICE_COLOR.other;
}

export function buildServiceCounts(rows) {
  const counts = {};
  for (const row of (rows || [])) {
    const label = serviceLabel(row);
    counts[label] = (counts[label] || 0) + (Number(row.n) || 1);
  }
  return counts;
}

export function serviceChipsFromCounts(counts, topN = 14) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  const top = entries.slice(0, topN);
  const rest = entries.slice(topN);
  const otherCount = rest.reduce((s, [, n]) => s + n, 0);
  const chips = [{ id: '', label: 'all', count: total }];
  for (const [label, count] of top) {
    chips.push({ id: label, label, count });
  }
  if (otherCount > 0) chips.push({ id: '__other__', label: 'other', count: otherCount });
  return chips;
}

export async function serviceWhereClause(env, service) {
  const svc = String(service || '');
  if (!svc) return null;
  if (svc === '__other__') {
    if (!env.LEDGER) return null;
    let r;
    try { r = await env.LEDGER.prepare('SELECT source, key, n FROM events_stats').all(); }
    catch { r = await env.LEDGER.prepare('SELECT source, key, COUNT(*) AS n FROM events GROUP BY source, key').all(); }
    const chips = serviceChipsFromCounts(buildServiceCounts(r.results || []));
    const topIds = chips.filter((c) => c.id && c.id !== '' && c.id !== '__other__').map((c) => c.id);
    const parts = [];
    const binds = [];
    for (const label of topIds) {
      const w = serviceWhereByLabel(label);
      if (w) { parts.push('(' + w.clause + ')'); binds.push(...w.binds); }
    }
    if (!parts.length) return null;
    return { clause: 'NOT (' + parts.join(' OR ') + ')', binds };
  }
  return serviceWhereByLabel(svc);
}

export function formatTs(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts || '').slice(0, 19);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).formatToParts(d);
  const pick = (t) => (parts.find((p) => p.type === t) || {}).value || '';
  return pick('month') + '/' + pick('day') + ' ' + pick('hour') + ':' + pick('minute') + ':' + pick('second') + ' ' + pick('timeZoneName');
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

export function parseEventPayload(row) {
  const action = String(row.action || '');
  const dir = String(row.direction || '').toUpperCase();
  const req = String(row.request_preview || '');
  const res = String(row.response_preview || '');
  const key = String(row.key || '');
  const reqJ = tryJson(req);
  const resJ = tryJson(res);
  let you = '';
  let agent = '';
  let did = '';

  if (action === 'turn_in' || (dir === 'IN' && reqJ && reqJ.text != null)) {
    you = String(reqJ?.text ?? req);
  } else if (action === 'turn_out' || (dir === 'OUT' && resJ && resJ.text != null)) {
    agent = String(resJ?.text ?? res);
  } else if (action === 'message_in') {
    you = String(reqJ?.text ?? req);
  }

  if (reqJ && reqJ.turn) {
    you = you || String(reqJ.turn);
    if (reqJ.reply) agent = agent || String(reqJ.reply);
  }

  if (!you) {
    const nowIdx = req.lastIndexOf('Now:');
    if (nowIdx >= 0) you = req.slice(nowIdx + 4).trim();
  }

  if (!agent) {
    agent = lastReply(res);
    if (!agent && resJ?.text != null) agent = String(resJ.text);
    if (!agent && dir === 'OUT' && action !== 'http' && action !== 'fn') agent = res;
  }

  if (key === 'TODO_RUN') {
    did = 'cron · no open tasks';
  } else if (action === 'http' || row.route === 'http') {
    did = key + ' · HTTP call';
    if (!you && req && req.length < 120) you = req;
    if (!agent && res && res.startsWith('HTTP ')) agent = res.slice(0, 200);
  } else if (action === 'tools/call') {
    did = key + ' · MCP tool';
    if (!you && req) you = req.slice(0, 200);
  } else if (action === 'exec_complete') {
    const cmd = reqJ?.request?.cmd || reqJ?.kind || 'exec';
    const args = Array.isArray(reqJ?.request?.args) ? reqJ.request.args.join(' ') : '';
    did = 'bridge · ' + cmd + (args ? ' ' + args : '');
    if (!agent && resJ?.stdout) agent = String(resJ.stdout).slice(0, 200);
  } else if (action === 'fn' || row.route === 'fn') {
    did = key + ' · function';
    if (!agent && resJ) agent = JSON.stringify(resJ).slice(0, 200);
  } else if (key) {
    did = key + (action ? ' · ' + action : '');
  } else {
    did = action || '—';
  }

  const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  return {
    you_said: clean(you, 320),
    agent_said: clean(agent, 320),
    agent_did: clean(did, 140),
  };
}

export function enrichEventRow(row) {
  const service = serviceLabel(row);
  const payload = parseEventPayload(row);
  return {
    ...row,
    service,
    time_short: formatTs(row.ts),
    you_said: payload.you_said,
    agent_said: payload.agent_said,
    agent_did: payload.agent_did,
  };
}

export function cardMatchesService(card, service) {
  const svc = String(service || '');
  if (!svc) return true;
  if (svc === '__other__') return false;
  // Agent-turn cards (Claude Code / Grok CLI / Kimi) carry the agent in `actor`, not a CLI `source`
  // (e.g. source 'hook', actor 'grok'). Match those by actor so the pinned agent chips filter them.
  const actor = String(card.actor || '').toLowerCase();
  if (svc === 'grok-cli' && actor === 'grok') return true;
  if (svc === 'claude-cli' && (actor === 'claude' || String(card.source || '') === 'claude-code')) return true;
  if (svc === 'codex-cli' && (actor === 'codex' || ['codex-cli', 'cli-codex'].includes(String(card.source || '')))) return true;
  if (svc === 'kimi-cli' && actor === 'kimi') return true;
  if (svc === 'misc-cli' && (actor === 'misc' || ['misc-cli', 'cli-misc'].includes(String(card.source || '')))) return true;
  const label = serviceLabel({ source: card.source, key: card.routed || card.key || card.actor || '' });
  return label === svc;
}
