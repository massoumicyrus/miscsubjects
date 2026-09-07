
// Friendly field names → signal paths. Longest alias wins so "bot score" beats "bot".
export const FIELD_ALIASES = Object.freeze([
  ['country', 'network.country'],
  ['region', 'network.region'],
  ['city', 'network.city'],
  ['asn', 'network.asn'],
  ['network type', 'network.type'],
  ['network', 'network.type'],
  ['isp', 'network.as_org'],
  ['org', 'network.as_org'],
  ['bot score', 'network.bot_score'],
  ['risk', 'network.risk'],
  ['verified bot', 'network.verified_bot'],
  ['connection', 'network.connection_type'],
  ['ip timezone', 'network.ip_timezone'],
  ['device', 'device.class'],
  ['device class', 'device.class'],
  ['browser', 'device.browser'],
  ['os', 'device.os'],
  ['trusted device', 'device.trusted'],
  ['locale', 'device.locale'],
  ['timezone', 'device.timezone'],
  ['tag', 'profile.tags'],
  ['tags', 'profile.tags'],
  ['status', 'profile.status'],
  ['known', 'profile.known'],
  ['customer', 'profile.customer'],
  ['returning', 'profile.returning'],
  ['visit count', 'profile.visit_count'],
  ['segment', 'profile.segments'],
  ['identifier', 'profile.identifier_kinds'],
  ['referrer', 'request.referrer_host'],
  ['path', 'request.path'],
  ['entry', 'request.entry'],
  ['user agent', 'request.user_agent'],
  ['language', 'request.language'],
  ['utm source', 'attribution.utm_source'],
  ['utm medium', 'attribution.utm_medium'],
  ['utm campaign', 'attribution.utm_campaign'],
  ['click id', 'attribution.click_id_present'],
  ['business hour', 'time.business_hhmm'],
  ['jci status', 'history.jci_status'],
]);
const PATH_TO_ALIAS = (() => { const m = {}; for (const [a, p] of FIELD_ALIASES) if (!m[p]) m[p] = a; return m; })();

// Operator words → engine ops. Order matters: multi-word phrases are matched before single words.
const OP_WORDS = [
  ['is not one of', 'not_in'], ['is not in', 'not_in'], ['not one of', 'not_in'], ['not in', 'not_in'],
  ['is one of', 'in'], ['is in', 'in'], ['one of', 'in'],
  ['does not contain', 'not_contains'], ['not contains', 'not_contains'], ["doesn't contain", 'not_contains'],
  ['contains', 'contains'], ['has', 'contains'], ['includes', 'contains'],
  ['is not', '!='], ['not equal to', '!='], ['isnt', '!='], ["isn't", '!='], ['!=', '!='],
  ['is at least', '>='], ['at least', '>='], ['greater than or equal', '>='], ['>=', '>='],
  ['is at most', '<='], ['at most', '<='], ['less than or equal', '<='], ['<=', '<='],
  ['greater than', '>'], ['more than', '>'], ['over', '>'], ['above', '>'], ['>', '>'],
  ['less than', '<'], ['fewer than', '<'], ['under', '<'], ['below', '<'], ['<', '<'],
  ['starts with', 'starts'], ['begins with', 'starts'],
  ['ends with', 'ends'],
  ['matches', 'matches'], ['matching', 'matches'],
  ['is empty', 'empty'], ['is set', 'not_empty'], ['exists', 'exists'], ['is true', 'truthy'],
  ['equals', '='], ['is', '='], ['=', '='], ['==', '='],
];
const OP_TO_WORD = { '=': 'is', '!=': 'is not', in: 'is one of', not_in: 'is not one of', contains: 'contains', not_contains: 'does not contain', '>': 'over', '<': 'under', '>=': 'at least', '<=': 'at most', starts: 'starts with', ends: 'ends with', matches: 'matches', empty: 'is empty', not_empty: 'is set', exists: 'exists', truthy: 'is true' };

function matchField(s) {
  const low = s.trim().toLowerCase();
  let best = null;
  for (const [alias, path] of FIELD_ALIASES) if (low.startsWith(alias) && (!best || alias.length > best.alias.length)) best = { alias, path };
  return best;
}

function parseAtom(text) {
  const f = matchField(text);
  if (!f) return { error: `unknown field in "${text.trim()}" — see the field list` };
  let rest = text.trim().slice(f.alias.length).trim();
  // longest operator phrase first
  let op = null, val = '';
  for (const [word, o] of OP_WORDS) {
    if (rest.toLowerCase() === word || rest.toLowerCase().startsWith(word + ' ') || (['empty', 'not_empty', 'exists', 'truthy'].includes(o) && rest.toLowerCase() === word)) {
      op = o; val = rest.slice(word.length).trim(); break;
    }
  }
  if (!op) { op = '='; val = rest; } // "country US" → equals
  const node = { path: f.path, op };
  if (!['empty', 'not_empty', 'exists', 'truthy'].includes(op)) {
    let v = val.replace(/^["']|["']$/g, '');
    if (['in', 'not_in'].includes(op)) node.value = v.split(/\s*,\s*|\s+or\s+/).map((x) => x.trim()).filter(Boolean);
    else if (/^-?\d+(\.\d+)?$/.test(v)) node.value = Number(v);
    else node.value = v;
  }
  return { node };
}

/** Parse the condition half of a plain rule into a condition tree. Supports " and " / " or ". */
export function parsePlainCondition(text) {
  const t = String(text || '').trim();
  if (!t || /^(any|always|everyone|all traffic)$/i.test(t)) return { node: {} };
  if (/\bor\b/i.test(t) && !/\band\b/i.test(t)) {
    const parts = t.split(/\s+or\s+/i);
    const kids = []; for (const p of parts) { const a = parseAtom(p); if (a.error) return a; kids.push(a.node); }
    return { node: { any: kids } };
  }
  if (/\band\b/i.test(t)) {
    const parts = t.split(/\s+and\s+/i);
    const kids = []; for (const p of parts) { const a = parseAtom(p); if (a.error) return a; kids.push(a.node); }
    return { node: { all: kids } };
  }
  return parseAtom(t);
}

/** Parse the action half → engine actions. `dests` optional for validating "send to <id>". */
export function parsePlainActions(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return { error: 'no action after "then"' };
  if (/^(block|deny|refuse|reject)/.test(t)) return { actions: [{ type: 'deny', message: 'not available' }] };
  if (/^(challenge|verify|turnstile|prove)/.test(t)) return { actions: [{ type: 'require_turnstile' }] };
  if (/^(squeeze|capture|ask to text|text to continue)/.test(t)) return { actions: [{ type: 'outcome', value: 'unknown' }] };
  if (/^(allow|approve|let (them )?through|pass)/.test(t) && !/send/.test(t)) return { actions: [{ type: 'outcome', value: 'approved' }] };
  if (/bypass (the )?squeeze|skip (the )?squeeze|straight to/.test(t)) return { actions: [{ type: 'outcome', value: 'approved' }] };
  const send = t.match(/(?:send|route|go|take (?:them )?)\s*to\s+([a-z0-9_.:-]+)/);
  if (send) return { actions: [{ type: 'destination', id: send[1] }] };
  const tag = t.match(/^tag(?:\s+(?:as|with))?\s+(.+)$/);
  if (tag) return { actions: [{ type: 'tag', add: tag[1].split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean) }] };
  const review = /^(review|hold|flag)/.test(t);
  if (review) return { actions: [{ type: 'outcome', value: 'review' }] };
  return { error: `unknown action "${text.trim()}" — try: block, allow, challenge, squeeze, send to <destination>, tag <x>, review` };
}

/** Full "if <condition> then <action>" → { condition, actions } or { error }. */
export function parsePlainRule(text) {
  const t = String(text || '').trim();
  const m = t.match(/^\s*(?:if\s+)?([\s\S]*?)\s+then\s+([\s\S]+)$/i);
  if (!m) {
    // no "then": treat as a bare action on all traffic, or a bare condition
    const act = parsePlainActions(t);
    if (!act.error) return { condition: {}, actions: act.actions };
    return { error: 'write it as: if <condition> then <action> (e.g. "if country is KP then block")' };
  }
  const cond = parsePlainCondition(m[1]);
  if (cond.error) return cond;
  const act = parsePlainActions(m[2]);
  if (act.error) return act;
  return { condition: cond.node, actions: act.actions };
}

function atomToText(n) {
  const alias = PATH_TO_ALIAS[n.path] || n.path;
  const opw = OP_TO_WORD[n.op] || n.op;
  if (['empty', 'not_empty', 'exists', 'truthy'].includes(n.op)) return `${alias} ${opw}`;
  const v = Array.isArray(n.value) ? n.value.join(', ') : n.value;
  return `${alias} ${opw} ${v}`;
}

/** Render a condition tree back to plain text. */
export function renderPlainCondition(node) {
  if (!node || (typeof node === 'object' && !Array.isArray(node) && !Object.keys(node).length)) return 'any visitor';
  if (Array.isArray(node.all)) return node.all.map(renderPlainCondition).join(' and ');
  if (Array.isArray(node.any)) return node.any.map(renderPlainCondition).join(' or ');
  if (node.not) return 'not (' + renderPlainCondition(node.not) + ')';
  if (node.path) return atomToText(node);
  return 'any visitor';
}

/** Render engine actions back to plain text. */
export function renderPlainActions(actions) {
  const out = [];
  for (const a of actions || []) {
    switch (a.type) {
      case 'deny': out.push('block'); break;
      case 'require_turnstile': out.push('challenge (Turnstile)'); break;
      case 'destination': out.push('send to ' + a.id); break;
      case 'outcome': out.push(a.value === 'approved' ? 'allow' : a.value === 'unknown' ? 'squeeze (text to continue)' : a.value); break;
      case 'tag': out.push('tag ' + [].concat(a.add || []).join(', ')); break;
      case 'require_ack': out.push('require acknowledgement'); break;
      case 'experiment': out.push('run experiment ' + a.id); break;
      default: out.push(a.type);
    }
  }
  return out.join(', ') || '(no action)';
}

/** The plain sentence for a whole stored rule. */
export function ruleToPlain(rule) {
  const cond = typeof rule.condition === 'object' ? rule.condition : (() => { try { return JSON.parse(rule.condition_json || '{}'); } catch { return {}; } })();
  const acts = Array.isArray(rule.actions) ? rule.actions : (() => { try { return JSON.parse(rule.actions_json || '[]'); } catch { return []; } })();
  return `if ${renderPlainCondition(cond)} then ${renderPlainActions(acts)}`;
}
