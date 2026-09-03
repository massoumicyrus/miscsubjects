// A CELL THAT RECOMPUTES.
//
// The one thing that separates a spreadsheet from a table is that =A1+B1 changes when A1 does.
// Without it this grid was a log plus a form: every unit of work needed a person or an agent to
// initiate it. With it, one authored expression filled down a column does the work of four
// hundred turns, because the sheet acts when data arrives instead of when someone asks.
//
// Deliberately NOT Excel parity. No charts, no pivots, no volatile functions, no array spilling.
// A small set of functions that matter here, plus references, arithmetic and comparison. The
// scope is "one evaluated call per cell", which is what makes it tractable to keep correct.
//
// The store keeps the computed answer in `value` and the expression in `formula`, so every
// existing reader — workbook, REST, CSV, widgets — sees a plain value and needs no changes.

export const MAX_DEPTH = 8;          // a formula referencing a formula, bounded
export const MAX_FANOUT = 500;       // cells recalculated from one write, bounded

export function isFormula(v) {
  return typeof v === 'string' && v.length > 1 && v[0] === '=';
}

// ── A1 references ────────────────────────────────────────────────────────────────────────────
export function colToNum(letters) {
  let n = 0;
  for (const ch of String(letters).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
export function numToCol(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

const REF = /\$?([A-Z]{1,3})\$?(\d{1,6})/g;

// Every address a formula reads. Used both to evaluate and to know what to recalculate when a
// cell changes — the dependency edge is derived from the text, so nothing has to be declared.
export function referencesOf(formula) {
  const out = [];
  const body = String(formula || '').replace(/"(?:[^"\\]|\\.)*"/g, '""');   // ignore string literals
  const rangeRe = /\$?([A-Z]{1,3})\$?(\d{1,6})\s*:\s*\$?([A-Z]{1,3})\$?(\d{1,6})/g;
  const seen = new Set();
  let m;
  while ((m = rangeRe.exec(body)) !== null) {
    const c1 = colToNum(m[1]), r1 = parseInt(m[2], 10);
    const c2 = colToNum(m[3]), r2 = parseInt(m[4], 10);
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
        const k = r + ':' + c;
        if (!seen.has(k)) { seen.add(k); out.push({ r, c }); }
      }
    }
  }
  const single = body.replace(rangeRe, ' ');
  REF.lastIndex = 0;
  while ((m = REF.exec(single)) !== null) {
    const r = parseInt(m[2], 10), c = colToNum(m[1]);
    const k = r + ':' + c;
    if (!seen.has(k)) { seen.add(k); out.push({ r, c }); }
  }
  return out;
}

// ── tokenizer + parser ───────────────────────────────────────────────────────────────────────
// A plain recursive-descent parser over numbers, strings, refs, ranges, functions and operators.
// Small enough to read in one sitting, which matters more here than covering every case.
function tokenize(src) {
  const t = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '"') {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== '"') { s += src[j] === '\\' ? src[++j] : src[j]; j++; }
      t.push({ k: 'str', v: s }); i = j + 1; continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
      t.push({ k: 'num', v: parseFloat(src.slice(i, j)) }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i; while (j < src.length && /[A-Za-z0-9_.$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      i = j;
      if (src[i] === '(') { t.push({ k: 'fn', v: word.toUpperCase() }); continue; }
      if (src[i] === ':' && /^\$?[A-Z]{1,3}\$?\d+$/i.test(word)) {
        let j2 = i + 1; while (j2 < src.length && /[A-Za-z0-9$]/.test(src[j2])) j2++;
        t.push({ k: 'range', v: word + ':' + src.slice(i + 1, j2) }); i = j2; continue;
      }
      if (/^\$?[A-Z]{1,3}\$?\d+$/i.test(word)) { t.push({ k: 'ref', v: word }); continue; }
      t.push({ k: 'name', v: word }); continue;
    }
    const two = src.slice(i, i + 2);
    if (['<=', '>=', '<>', '!='].includes(two)) { t.push({ k: 'op', v: two }); i += 2; continue; }
    if ('+-*/%^(),<>=&'.includes(ch)) { t.push({ k: ch === ',' ? ',' : 'op', v: ch }); i++; continue; }
    throw new Error('unexpected character ' + JSON.stringify(ch));
  }
  return t;
}

function parse(tokens) {
  let p = 0;
  const peek = () => tokens[p];
  const eat = (k, v) => {
    const t = tokens[p];
    if (!t || (k && t.k !== k) || (v && t.v !== v)) throw new Error('expected ' + (v || k));
    p++; return t;
  };
  function primary() {
    const t = peek();
    if (!t) throw new Error('unexpected end of formula');
    if (t.k === 'num' || t.k === 'str') { p++; return { t: t.k, v: t.v }; }
    if (t.k === 'ref') { p++; return { t: 'ref', v: t.v }; }
    if (t.k === 'range') { p++; return { t: 'range', v: t.v }; }
    if (t.k === 'name') { p++; return { t: 'str', v: t.v }; }
    if (t.k === 'fn') {
      p++; eat('op', '(');
      const args = [];
      if (!(peek() && peek().k === 'op' && peek().v === ')')) {
        args.push(expr());
        while (peek() && peek().k === ',') { p++; args.push(expr()); }
      }
      eat('op', ')');
      return { t: 'call', name: t.v, args };
    }
    if (t.k === 'op' && t.v === '(') { p++; const e = expr(); eat('op', ')'); return e; }
    if (t.k === 'op' && (t.v === '-' || t.v === '+')) { p++; return { t: 'neg', v: primary(), sign: t.v }; }
    throw new Error('unexpected ' + (t.v ?? t.k));
  }
  function binary(next, ops) {
    return function () {
      let left = next();
      while (peek() && peek().k === 'op' && ops.includes(peek().v)) {
        const op = eat('op').v;
        left = { t: 'bin', op, l: left, r: next() };
      }
      return left;
    };
  }
  const pow  = binary(primary, ['^']);
  const mul  = binary(pow, ['*', '/', '%']);
  const add  = binary(mul, ['+', '-', '&']);
  const cmp  = binary(add, ['<', '>', '<=', '>=', '=', '<>', '!=']);
  function expr() { return cmp(); }
  const out = expr();
  if (p !== tokens.length) throw new Error('trailing input in formula');
  return out;
}

export function parseFormula(text) {
  const src = String(text || '').replace(/^=/, '');
  return parse(tokenize(src));
}

// ── evaluation ───────────────────────────────────────────────────────────────────────────────
// `ctx` supplies everything that touches the outside world, so this file stays testable:
//   readCell(r, c) -> string          the current computed value at an address
//   dispatch(key, body) -> string     a directory tool call
//   query(sql) -> array of rows       a read against the content database
//   search(q, limit) -> array of rows full-text search over the corpus
const num = (v) => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v == null ? '' : v).replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const truthy = (v) => {
  if (typeof v === 'boolean') return v;
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return !(s === '' || s === '0' || s === 'false' || s === 'no');
};

async function flatten(node, ctx, depth) {
  // a range evaluates to the list of its cells; everything else to a single value
  if (node.t === 'range') {
    const refs = referencesOf('=' + node.v);
    const out = [];
    for (const { r, c } of refs) out.push(await ctx.readCell(r, c));
    return out;
  }
  return [await evalNode(node, ctx, depth)];
}

async function evalNode(node, ctx, depth) {
  if (depth > MAX_DEPTH) throw new Error('formula nested deeper than ' + MAX_DEPTH);
  switch (node.t) {
    case 'num': case 'str': return node.v;
    case 'neg': {
      const v = await evalNode(node.v, ctx, depth + 1);
      return node.sign === '-' ? -num(v) : num(v);
    }
    case 'ref': {
      const refs = referencesOf('=' + node.v);
      if (!refs.length) return '';
      return await ctx.readCell(refs[0].r, refs[0].c);
    }
    case 'range': {
      const vals = await flatten(node, ctx, depth + 1);
      return vals.join(', ');
    }
    case 'bin': {
      const l = await evalNode(node.l, ctx, depth + 1);
      const r = await evalNode(node.r, ctx, depth + 1);
      switch (node.op) {
        case '+': return num(l) + num(r);
        case '-': return num(l) - num(r);
        case '*': return num(l) * num(r);
        case '/': return num(r) === 0 ? '#DIV/0' : num(l) / num(r);
        case '%': return num(r) === 0 ? '#DIV/0' : num(l) % num(r);
        case '^': return Math.pow(num(l), num(r));
        case '&': return String(l) + String(r);
        case '=': return String(l) === String(r);
        case '<>': case '!=': return String(l) !== String(r);
        case '<': return num(l) < num(r);
        case '>': return num(l) > num(r);
        case '<=': return num(l) <= num(r);
        case '>=': return num(l) >= num(r);
        default: throw new Error('unknown operator ' + node.op);
      }
    }
    case 'call': return callFn(node, ctx, depth);
    default: throw new Error('unknown node ' + node.t);
  }
}

async function callFn(node, ctx, depth) {
  const name = node.name;
  const argVals = async () => {
    const out = [];
    for (const a of node.args) out.push(await evalNode(a, ctx, depth + 1));
    return out;
  };
  const argCells = async () => {
    const out = [];
    for (const a of node.args) out.push(...(await flatten(a, ctx, depth + 1)));
    return out;
  };

  switch (name) {
    // --- the reason this exists: a cell that calls the build ---------------------------------
    case 'DISPATCH': {
      // =DISPATCH("LEADS_ENRICH", A2) — one authored expression, filled down, is the work of a
      // column of agent turns.
      const a = await argVals();
      if (!ctx.dispatch) return '#NO_DISPATCH';
      const key = String(a[0] || '').trim();
      if (!key) return '#NO_KEY';
      const body = a.length > 1 ? String(a[1] == null ? '' : a[1]) : '';
      return await ctx.dispatch(key, body);
    }
    case 'LLMCALL': {
      // =LLMCALL(A2,B2)          the response payload, whole
      // =LLMCALL(A2,B2,"status") the HTTP status
      // =LLMCALL(A2,B2,"text")   just the assistant's words
      // A2 is the full REST envelope; B2 is the message to put to the model. Both are cells you
      // can read and edit, which is the point: the request is not hidden behind a tool name.
      const a = await argVals();
      if (!ctx.llm) return '#NO_LLM';
      const req = String(a[0] == null ? '' : a[0]);
      if (!req.trim()) return '';
      const msg = a.length > 1 ? String(a[1] == null ? '' : a[1]) : '';
      if (!msg.trim()) return '';
      const want = a.length > 2 ? String(a[2] == null ? '' : a[2]) : '';
      return await ctx.llm(req, msg, want);
    }
    case 'IMAGE': {
      // =IMAGE("https://…") — the grid draws the picture instead of the address. The cell still
      // holds the URL, so every other reader (CSV, the REST lane, a model) sees a usable link.
      const a = await argVals();
      return String(a[0] == null ? '' : a[0]).trim();
    }
    case 'D1QUERY': {
      const a = await argVals();
      if (!ctx.query) return '#NO_QUERY';
      const rows = await ctx.query(String(a[0] || ''));
      if (!rows || !rows.length) return '';
      const first = rows[0];
      const keys = Object.keys(first);
      // scalar when the query returns one column, otherwise a compact record
      return keys.length === 1 ? String(first[keys[0]] ?? '') : JSON.stringify(first);
    }
    case 'SEARCH': {
      const a = await argVals();
      if (!ctx.search) return '#NO_SEARCH';
      const hits = await ctx.search(String(a[0] || ''), a.length > 1 ? num(a[1]) : 5);
      if (!hits || !hits.length) return '';
      return hits.map((h) => `${h.kind}:${h.ref}`).join(' | ');
    }
    case 'SEARCHCOUNT': {
      const a = await argVals();
      if (!ctx.search) return '#NO_SEARCH';
      const hits = await ctx.search(String(a[0] || ''), 200);
      return (hits || []).length;
    }

    // --- arithmetic and logic over ranges ----------------------------------------------------
    case 'SUM':     return (await argCells()).reduce((s, v) => s + num(v), 0);
    case 'COUNT':   return (await argCells()).filter((v) => String(v ?? '').trim() !== '' && Number.isFinite(parseFloat(v))).length;
    case 'COUNTA':  return (await argCells()).filter((v) => String(v ?? '').trim() !== '').length;
    case 'AVERAGE': {
      const nums = (await argCells()).map(num).filter((n) => Number.isFinite(n));
      return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : '';
    }
    case 'MIN': { const n = (await argCells()).map(num); return n.length ? Math.min(...n) : ''; }
    case 'MAX': { const n = (await argCells()).map(num); return n.length ? Math.max(...n) : ''; }
    case 'ROUND': { const a = await argVals(); const d = a.length > 1 ? num(a[1]) : 0; const f = Math.pow(10, d); return Math.round(num(a[0]) * f) / f; }
    case 'ABS':  return Math.abs(num((await argVals())[0]));
    case 'IF': {
      // only the taken branch is evaluated: an untaken DISPATCH must not fire
      const cond = truthy(await evalNode(node.args[0], ctx, depth + 1));
      const branch = cond ? node.args[1] : node.args[2];
      return branch === undefined ? (cond ? true : false) : await evalNode(branch, ctx, depth + 1);
    }
    case 'AND': return (await argCells()).every(truthy);
    case 'OR':  return (await argCells()).some(truthy);
    case 'NOT': return !truthy((await argVals())[0]);

    // --- text --------------------------------------------------------------------------------
    case 'CONCAT': case 'CONCATENATE': return (await argCells()).map((v) => String(v ?? '')).join('');
    case 'JOIN': { const a = await argVals(); const sep = String(a[0] ?? ''); const rest = []; for (const x of node.args.slice(1)) rest.push(...(await flatten(x, ctx, depth + 1))); return rest.map((v) => String(v ?? '')).join(sep); }
    case 'LEN':   return String((await argVals())[0] ?? '').length;
    case 'LEFT':  { const a = await argVals(); return String(a[0] ?? '').slice(0, a.length > 1 ? num(a[1]) : 1); }
    case 'RIGHT': { const a = await argVals(); const n = a.length > 1 ? num(a[1]) : 1; const s = String(a[0] ?? ''); return n ? s.slice(-n) : ''; }
    case 'MID':   { const a = await argVals(); return String(a[0] ?? '').slice(Math.max(0, num(a[1]) - 1), Math.max(0, num(a[1]) - 1) + num(a[2])); }
    case 'UPPER': return String((await argVals())[0] ?? '').toUpperCase();
    case 'LOWER': return String((await argVals())[0] ?? '').toLowerCase();
    case 'TRIM':  return String((await argVals())[0] ?? '').trim();
    case 'TEXT':  return String((await argVals())[0] ?? '');
    case 'VALUE': return num((await argVals())[0]);
    default: return '#NAME? ' + name;
  }
}

// Evaluate one formula. Never throws: a broken formula shows its reason in the cell, the way a
// spreadsheet does, rather than failing the whole write.
export async function evaluate(formula, ctx, depth = 0) {
  try {
    const ast = parseFormula(formula);
    const v = await evalNode(ast, ctx, depth);
    if (v === true) return 'TRUE';
    if (v === false) return 'FALSE';
    if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 1e10) / 1e10) : '#NUM';
    return String(v == null ? '' : v);
  } catch (e) {
    return '#ERROR ' + String(e && e.message || e).slice(0, 120);
  }
}
