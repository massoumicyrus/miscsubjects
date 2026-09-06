// TRAFFIC ENGINE — the condition language, evaluated with an explanation.
//
// A rule's condition is a JSON tree, stored as data in traffic_rules.condition_json and edited
// from the API or a sheet cell. Nothing about a rule's meaning lives in code. Grammar:
//
//   node := { all: [node…] }            every child true            (AND)
//         | { any: [node…] }            at least one child true     (OR)
//         | { not: node }               child false                 (NOT)
//         | { path, op, value? }        one signal compared to one value
//
// `path` reads the normalized signal context ("device.class", "attribution.utm_source",
// "profile.tags", "time.business_hhmm", "lists.deny_match"). Dots walk objects, [n] walks arrays —
// the same path grammar the sheet views use, so one grammar serves the whole build.
//
// Operators (the sheet-view set, plus the few a router needs):
//   =  !=  in  not_in  contains  not_contains  starts  ends  matches  >  <  >=  <=
//   between [lo,hi]  time_between ["08:00","17:00"]  cidr [..]  empty  not_empty  exists  truthy
//
// evaluate() never throws on a malformed leaf: it returns false and names the defect in the trace,
// so a bad rule is visible in every explanation instead of silently taking the whole ruleset down.

export const OPERATORS = Object.freeze([
  '=', '!=', 'in', 'not_in', 'contains', 'not_contains', 'starts', 'ends', 'matches',
  '>', '<', '>=', '<=', 'between', 'time_between', 'cidr', 'empty', 'not_empty', 'exists', 'truthy',
]);

const MAX_DEPTH = 12;
const MAX_REGEX_LEN = 200;

/** Raw path read (keeps numbers, booleans, arrays). Missing step → undefined. */
export function readPath(ctx, path) {
  const steps = String(path || '').replace(/^\$\.?/, '').match(/[^.\[\]]+|\[\d+\]/g) || [];
  let v = ctx;
  for (const raw of steps) {
    if (v == null) return undefined;
    const step = raw.startsWith('[') ? Number(raw.slice(1, -1)) : raw;
    v = v[step];
  }
  return v;
}

function toList(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.startsWith('[')) { try { const a = JSON.parse(t); if (Array.isArray(a)) return a; } catch { /* fallthrough */ } }
    return t.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [value];
}

function norm(v) {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v).trim().toLowerCase();
}

function num(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : NaN;
}

function hhmmToMin(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function ipToBigInt(ip) {
  const s = String(ip || '').trim();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) {
    const p = s.split('.').map(Number);
    if (p.some((x) => x < 0 || x > 255)) return null;
    return { v: 4, n: BigInt(((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]) };
  }
  if (s.includes(':')) {
    const halves = s.split('::');
    if (halves.length > 2) return null;
    const head = halves[0] ? halves[0].split(':') : [];
    const tail = halves[1] ? halves[1].split(':') : [];
    const fill = 8 - head.length - tail.length;
    if (fill < 0 || (halves.length === 1 && fill !== 0)) return null;
    const parts = [...head, ...Array(fill).fill('0'), ...tail];
    let n = 0n;
    for (const h of parts) {
      if (!/^[0-9a-f]{1,4}$/i.test(h)) return null;
      n = (n << 16n) + BigInt(parseInt(h, 16));
    }
    return { v: 6, n };
  }
  return null;
}

/** True when `ip` is inside any CIDR in `cidrs` ("203.0.113.0/24", "2001:db8::/32", bare IPs). */
export function ipInCidrs(ip, cidrs) {
  const a = ipToBigInt(ip);
  if (!a) return false;
  for (const c of toList(cidrs)) {
    const [base, bitsRaw] = String(c).split('/');
    const b = ipToBigInt(base);
    if (!b || b.v !== a.v) continue;
    const total = a.v === 4 ? 32 : 128;
    const bits = bitsRaw == null ? total : Number(bitsRaw);
    if (!Number.isInteger(bits) || bits < 0 || bits > total) continue;
    const shift = BigInt(total - bits);
    if ((a.n >> shift) === (b.n >> shift)) return true;
  }
  return false;
}

function compareLeaf(leaf, ctx) {
  const op = String(leaf.op || '=');
  if (!OPERATORS.includes(op)) return { ok: false, error: 'unknown_op:' + op };
  if (!leaf.path) return { ok: false, error: 'path_required' };
  const observed = readPath(ctx, leaf.path);
  const expected = leaf.value;
  let result = false;
  switch (op) {
    case 'exists': result = observed !== undefined; break;
    case 'empty': result = observed == null || observed === '' || (Array.isArray(observed) && observed.length === 0); break;
    case 'not_empty': result = !(observed == null || observed === '' || (Array.isArray(observed) && observed.length === 0)); break;
    case 'truthy': result = !!observed && observed !== 'false' && observed !== '0'; break;
    case '=':
      result = Array.isArray(observed) ? observed.map(norm).includes(norm(expected)) : norm(observed) === norm(expected);
      break;
    case '!=':
      result = Array.isArray(observed) ? !observed.map(norm).includes(norm(expected)) : norm(observed) !== norm(expected);
      break;
    case 'in': {
      const set = toList(expected).map(norm);
      result = Array.isArray(observed) ? observed.some((o) => set.includes(norm(o))) : set.includes(norm(observed));
      break;
    }
    case 'not_in': {
      const set = toList(expected).map(norm);
      result = Array.isArray(observed) ? !observed.some((o) => set.includes(norm(o))) : !set.includes(norm(observed));
      break;
    }
    case 'contains':
      result = Array.isArray(observed) ? observed.map(norm).includes(norm(expected)) : norm(observed).includes(norm(expected));
      break;
    case 'not_contains':
      result = Array.isArray(observed) ? !observed.map(norm).includes(norm(expected)) : !norm(observed).includes(norm(expected));
      break;
    case 'starts': result = norm(observed).startsWith(norm(expected)); break;
    case 'ends': result = norm(observed).endsWith(norm(expected)); break;
    case 'matches': {
      const src = String(expected ?? '');
      if (!src || src.length > MAX_REGEX_LEN) return { ok: false, error: 'regex_too_long_or_empty', observed };
      try { result = new RegExp(src, 'i').test(observed == null ? '' : (typeof observed === 'object' ? JSON.stringify(observed) : String(observed))); }
      catch (e) { return { ok: false, error: 'bad_regex:' + e.message, observed }; }
      break;
    }
    case '>': result = num(observed) > num(expected); break;
    case '<': result = num(observed) < num(expected); break;
    case '>=': result = num(observed) >= num(expected); break;
    case '<=': result = num(observed) <= num(expected); break;
    case 'between': {
      const [lo, hi] = toList(expected);
      const n = num(observed);
      result = Number.isFinite(n) && n >= num(lo) && n <= num(hi);
      break;
    }
    case 'time_between': {
      const [lo, hi] = toList(expected);
      const t = hhmmToMin(observed), a = hhmmToMin(lo), b = hhmmToMin(hi);
      if ([t, a, b].some((x) => !Number.isFinite(x))) { result = false; break; }
      result = a <= b ? (t >= a && t <= b) : (t >= a || t <= b); // overnight windows wrap
      break;
    }
    case 'cidr': result = ipInCidrs(observed, expected); break;
    default: return { ok: false, error: 'unknown_op:' + op };
  }
  return { ok: true, result, observed: observed === undefined ? null : observed };
}

export function evaluate(node, ctx, depth = 0) {
  if (node == null || (typeof node === 'object' && !Array.isArray(node) && Object.keys(node).length === 0)) {
    return { result: true, trace: { kind: 'always', result: true } };
  }
  if (depth > MAX_DEPTH) return { result: false, trace: { kind: 'error', error: 'condition_too_deep', result: false } };
  if (typeof node === 'string') {
    try { node = JSON.parse(node); } catch { return { result: false, trace: { kind: 'error', error: 'condition_not_json', result: false } }; }
    return evaluate(node, ctx, depth);
  }
  if (Array.isArray(node)) return evaluate({ all: node }, ctx, depth); // a bare list is an AND
  if (Array.isArray(node.all)) {
    const children = node.all.map((c) => evaluate(c, ctx, depth + 1));
    const result = children.every((c) => c.result);
    return { result, trace: { kind: 'all', result, children: children.map((c) => c.trace) } };
  }
  if (Array.isArray(node.any)) {
    const children = node.any.map((c) => evaluate(c, ctx, depth + 1));
    const result = children.some((c) => c.result);
    return { result, trace: { kind: 'any', result, children: children.map((c) => c.trace) } };
  }
  if (node.not !== undefined) {
    const child = evaluate(node.not, ctx, depth + 1);
    return { result: !child.result, trace: { kind: 'not', result: !child.result, children: [child.trace] } };
  }
  const cmp = compareLeaf(node, ctx);
  if (!cmp.ok) return { result: false, trace: { kind: 'leaf', path: node.path, op: node.op, value: node.value ?? null, observed: cmp.observed ?? null, result: false, error: cmp.error } };
  return { result: cmp.result, trace: { kind: 'leaf', path: node.path, op: node.op || '=', value: node.value ?? null, observed: cmp.observed, result: cmp.result } };
}

export function referencedPaths(node, out = new Set()) {
  if (node == null) return out;
  if (typeof node === 'string') { try { node = JSON.parse(node); } catch { return out; } }
  if (Array.isArray(node)) { node.forEach((n) => referencedPaths(n, out)); return out; }
  if (Array.isArray(node.all)) node.all.forEach((n) => referencedPaths(n, out));
  else if (Array.isArray(node.any)) node.any.forEach((n) => referencedPaths(n, out));
  else if (node.not !== undefined) referencedPaths(node.not, out);
  else if (node.path) out.add(String(node.path));
  return out;
}

/** Structural validation for a write path: returns [] or a list of defects with node paths. */
export function validateCondition(node, catalogPaths = null, at = '$', out = []) {
  if (node == null) return out;
  if (typeof node === 'string') { try { node = JSON.parse(node); } catch { out.push({ at, error: 'condition_not_json' }); return out; } }
  if (Array.isArray(node)) { node.forEach((n, i) => validateCondition(n, catalogPaths, `${at}[${i}]`, out)); return out; }
  if (typeof node !== 'object') { out.push({ at, error: 'node_must_be_object' }); return out; }
  if (Array.isArray(node.all)) { node.all.forEach((n, i) => validateCondition(n, catalogPaths, `${at}.all[${i}]`, out)); return out; }
  if (Array.isArray(node.any)) { node.any.forEach((n, i) => validateCondition(n, catalogPaths, `${at}.any[${i}]`, out)); return out; }
  if (node.not !== undefined) { validateCondition(node.not, catalogPaths, `${at}.not`, out); return out; }
  if (Object.keys(node).length === 0) return out;
  if (!node.path) out.push({ at, error: 'path_required' });
  const op = String(node.op || '=');
  if (!OPERATORS.includes(op)) out.push({ at, error: 'unknown_op:' + op, allowed: OPERATORS });
  if (catalogPaths && node.path) {
    const p = String(node.path);
    const known = catalogPaths.some((k) => k === p || p.startsWith(k + '.') || p.startsWith(k + '['));
    if (!known) out.push({ at, warning: 'path_not_in_signal_catalog', path: p });
  }
  return out;
}
