// Single source of truth for "what is this tool and EXACTLY how do I call it".
// Given one directory row, derive the precise call signature MECHANICALLY from the
// row's own definition — the arg template ($1..$N, $N+), the target / target_map, and
// the leading `#` doc lines. Nothing here is invented: every arg shown is an arg the
// dispatcher (functions/api/dispatch.js) actually substitutes. Used by the row editor
// and by GET /s/<slug> so both show the real signature instead of a generic <args>.
//
// The contract that makes this correct (mirrors dispatch.js):
//   • A tool is emitted as  [KEY]args[/KEY]  (or POST /api/dispatch {"key","body"}).
//   • `args` (the body) is split on "|" into positional args $1, $2, $3 ...
//   • $N   = the Nth pipe-separated arg.
//   • $N+  = args N..end re-joined with "|" (lets the LAST arg carry pipes / JSON).
//   • $PREV = the previous step's output (flows only; not a caller arg).
//   • $NAME (has a letter) = a server-side env var / secret / binding — NOT a caller arg.

const DOC_RE = /^\s*#\s?(.*)$/;

// Leading `#` comment lines = the human description block.
export function docLines(content) {
  const out = [];
  for (const ln of String(content || '').split('\n')) {
    const m = ln.match(DOC_RE);
    if (m) out.push(m[1]);
    else break;
  }
  return out;
}
function stripDocs(content) {
  const lines = String(content || '').split('\n');
  let i = 0;
  while (i < lines.length && /^\s*#/.test(lines[i])) i++;
  return lines.slice(i).join('\n').trim();
}

// Highest positional arg ($N) referenced in a string, and whether a variadic $N+ exists.
function scanPositionals(s) {
  const str = String(s || '');
  let max = 0;
  let variadicAt = 0; // index of the $N+ tail, 0 = none
  const re = /\$\$?(\d+)(\+)?/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
    if (m[2] === '+') { if (!variadicAt || n < variadicAt) variadicAt = n; }
  }
  if (variadicAt && variadicAt > max) max = variadicAt;
  return { max, variadicAt };
}

// Server-side $VARS (env/secret/binding) referenced — has a letter, not $N / $N+ / $PREV.
function scanEnvVars(s) {
  const set = new Set();
  const re = /\$\$?([A-Za-z_][A-Za-z0-9_]*)/g;
  let m;
  while ((m = re.exec(String(s || ''))) !== null) {
    const name = m[1];
    if (name === 'PREV') continue;
    set.add(name);
  }
  return [...set];
}

// Pull human arg names from the doc block, by priority:
//   1) an `INVOKE: [KEY]<a>|<b>[/KEY]` line  → names a, b ...
//   2) `# $N = description` lines            → name+desc for arg N
//   3) `EX: [KEY]a|b[/KEY]` example          → weak names from example values
function argNamesFromDocs(key, docs) {
  const names = {}; // pos -> {name, desc}
  const blob = docs.join('\n');

  const invoke = blob.match(new RegExp('\\[' + key + '\\]([^\\[]*)\\[\\/' + key + '\\]'));
  if (invoke) {
    const parts = invoke[1].split('|');
    parts.forEach((p, i) => {
      const clean = p.trim().replace(/^<|>$/g, '').replace(/[<>]/g, '').trim();
      if (clean && !names[i + 1]) names[i + 1] = { name: clean };
    });
  }
  // Capture every `$N = description` anywhere in the doc block (handles both
  // one-per-line and several on one line separated by ';').
  const argRe = /\$(\d+)\s*(?:=|—|-)\s*([^;\n]+)/g;
  let am;
  while ((am = argRe.exec(blob)) !== null) {
    const pos = parseInt(am[1], 10);
    const desc = am[2].trim();
    names[pos] = { name: (names[pos] && names[pos].name) || ('arg' + pos), desc };
  }
  return names;
}

function returnsFromDocs(docs) {
  for (const d of docs) {
    const m = d.match(/\b[Rr]eturns?\b[:\s]+(.+)$/);
    if (m) return m[1].trim().replace(/\s+#.*$/, '');
  }
  return null;
}
function exampleFromDocs(docs) {
  for (const d of docs) {
    const m = d.match(/^(?:EX|Example|EXAMPLE)\b[:\s]+(.+)$/);
    if (m) return m[1].trim();
  }
  return null;
}

function parseTargetMap(target) {
  const t = String(target || '');
  if (!t.startsWith('target_map:')) return null;
  try { return JSON.parse(t.slice('target_map:'.length)); } catch { return null; }
}

// Build the [KEY]a|b|c[/KEY] signature string from an ordered arg list.
function sig(key, args) {
  const inner = args.map(a => a.variadic ? '<' + a.name + ' …>' : '<' + a.name + '>').join('|');
  return '[' + key + ']' + inner + '[/' + key + ']';
}

export function deriveInvoke(row) {
  const key = String(row.key);
  const type = String(row.type || '');
  const target = String(row.target || '');
  const docs = docLines(row.content);
  const named = argNamesFromDocs(key, docs);
  const envFromAuth = String(row.auth || '').replace(/^.*?:/, '').trim();

  const out = {
    key, type,
    what: docs,                       // verbatim human description (the leading # lines)
    args: [],                         // [{pos,name,desc,variadic}]
    ops: null,                        // for target_map rows: [{op, sig, extra:[names]}]
    envVars: [],                      // server-side $VARS this row needs (secrets/bindings)
    returns: returnsFromDocs(docs),
    example: exampleFromDocs(docs),
    tag: null,                        // the canonical [KEY]...[/KEY] signature
    rest: 'POST https://miscsubjects.com/api/dispatch  {"key":"' + key + '","body":"<the | -joined args below>"}',
    slug: 'POST https://miscsubjects.com/s/' + key + '  {"body":"<the | -joined args below>"}',
  };

  const map = parseTargetMap(target);
  if (map) {
    // First caller arg is always the operation name. Each op may take more positionals.
    out.ops = Object.keys(map).sort().map(op => {
      const spec = map[op];
      const blob = JSON.stringify(spec || {});
      const { max, variadicAt } = scanPositionals(blob);
      // $1 inside an op maps to the SECOND caller arg ($1 of op-body == caller $2),
      // because the dispatcher strips the op then re-numbers the remainder from $1.
      const extra = [];
      for (let i = 1; i <= max; i++) extra.push((variadicAt && i >= variadicAt) ? '<arg' + i + ' …>' : '<arg' + i + '>');
      const s = '[' + key + ']' + [op, ...extra].join('|') + '[/' + key + ']';
      return { op, sig: s, extraArgs: max, variadic: !!variadicAt };
    });
    out.args = [{ pos: 1, name: 'op', desc: 'one of: ' + out.ops.map(o => o.op).join(', '), variadic: false }];
    out.tag = '[' + key + ']<op>|<args for that op>[/' + key + ']';
    out.envVars = scanEnvVars(target).filter(v => /^[A-Z]/.test(v));
    if (envFromAuth && /^[A-Z]/.test(envFromAuth)) out.envVars = [...new Set([...out.envVars, envFromAuth])];
    if (!out.returns) out.returns = 'HTTP <status>: <response body> from the matched URL.';
    return out;
  }

  // Non-map: scan target URL + the body template (content minus docs) for $N / $N+ / $VARS.
  const bodyTemplate = stripDocs(row.content);
  const combined = target + '\n' + bodyTemplate;
  const { max, variadicAt } = scanPositionals(combined);
  for (let i = 1; i <= max; i++) {
    const meta = named[i] || {};
    out.args.push({
      pos: i,
      name: meta.name || ('arg' + i),
      desc: meta.desc || '',
      variadic: !!(variadicAt && i >= variadicAt),
    });
  }
  out.envVars = scanEnvVars(combined).filter(v => /^[A-Z]/.test(v));
  if (envFromAuth && /^[A-Z]/.test(envFromAuth)) out.envVars = [...new Set([...out.envVars, envFromAuth])];

  out.tag = out.args.length ? sig(key, out.args) : '[' + key + '][/' + key + ']  (no caller args)';

  if (!out.returns) {
    if (type === 'fn') out.returns = "the function's result (JSON or text), or ERR:... on failure.";
    else if (type === 'http') out.returns = 'HTTP <status>: <response body>.';
    else if (type === 'flow') out.returns = "the final step's output.";
  }
  if (!out.example && out.args.length) {
    out.example = '[' + key + ']' + out.args.map(a => a.name).join('|') + '[/' + key + ']';
  }
  return out;
}

// Plain-text block for a <pre>. `esc` is the caller's HTML-escaper (identity for non-HTML).
export function renderInvokeText(spec, esc) {
  const e = esc || (s => s);
  const L = [];
  if (spec.what.length) { for (const d of spec.what) L.push(e(d)); L.push(''); }
  L.push('CALL IT:  ' + e(spec.tag));
  if (spec.args.length) {
    L.push('');
    L.push('ARGS (pipe-separated, in order):');
    for (const a of spec.args) {
      const tail = a.variadic ? '  (everything after here — may contain | )' : '';
      L.push('  $' + a.pos + '  ' + e(a.name) + (a.desc ? '  — ' + e(a.desc) : '') + tail);
    }
  } else {
    L.push('');
    L.push('ARGS: none — emit the tag empty.');
  }
  if (spec.ops) {
    L.push('');
    L.push('OPERATIONS ($1 = the op name; then that op\'s args):');
    for (const o of spec.ops) L.push('  ' + e(o.sig));
  }
  if (spec.envVars.length) {
    L.push('');
    L.push('SERVER SECRETS used (NOT caller args, supplied by the worker): ' + spec.envVars.map(e).join(', '));
  }
  L.push('');
  L.push('RETURNS:  ' + e(spec.returns || '(undocumented)'));
  if (spec.example) { L.push(''); L.push('EXAMPLE:  ' + e(spec.example)); }
  L.push('');
  L.push('Same call over REST:');
  L.push('  ' + e(spec.rest));
  L.push('  ' + e(spec.slug));
  return L.join('\n');
}
