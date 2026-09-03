// The tool executor. Every tool is declared here and nowhere else, so the model can only
// do what this file allows. Writes and shell go through the approval gate in misc.js.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { browser } from './browser.js';

const MAX_OUT = 400000;

function clip(s) {
  const str = String(s ?? '');
  if (str.length <= MAX_OUT) return str;
  // Head and tail, because the useful part of a long output is usually at one end or the
  // other and a middle slice loses both.
  const head = str.slice(0, Math.floor(MAX_OUT * 0.6));
  const tail = str.slice(-Math.floor(MAX_OUT * 0.4));
  return `${head}\n… [${str.length - MAX_OUT} characters cut — the whole thing is in /expand] …\n${tail}`;
}

// Timeouts are per tool and stated in seconds so a hung command surfaces as a result the
// model can act on, not as a session that looks dead.
export const TIMEOUTS = { shell: 120000, search: 20000, git: 60000, list: 15000, capability: 60000, web: 30000 };

const VAULT_LIFT = /(build-vault\.env|\$\{?TERMINAL_KEY|\$\{?AIG_SHIM_TOKEN|\$\{?CF_API_TOKEN)/;
const BUILD_API = /(curl|wget|http(ie)?\b)[\s\S]*miscsubjects\.com\/(api|admin)\//;

export function guardShell(cmd) {
  const s = String(cmd || '');
  if (VAULT_LIFT.test(s) && BUILD_API.test(s)) {
    return 'REFUSED: this command lifts a credential out of the vault to call the build\'s own API directly. '
      + 'The capability layer is the authority model for that API — going around it with curl is not a third route, '
      + 'it is the same action without the gate. If the capability was denied (risk_ceiling, not_authorized, 403), '
      + 'the answer is that it is denied: say so and stop. Report the denial to the operator rather than defeating it.';
  }
  return null;
}


export function sh(cmd, cwd, timeout = 120000, signal) {
  return new Promise((resolve) => {
    const child = execFile('/bin/zsh', ['-lc', cmd], { cwd, timeout, killSignal: 'SIGKILL', maxBuffer: 32 * 1024 * 1024 }, (err, out, errOut) => {
      const body = [out, errOut].filter(Boolean).join('\n').trim();
      if (err && err.killed) {
        resolve(clip(body) + `\n\n[timed out after ${Math.round(timeout / 1000)}s — the command was killed]`);
        return;
      }
      resolve(clip(body || (err ? String(err.message) : '(no output)')));
    });
    // An interrupt kills the whole process group, not just the shell, or grandchildren
    // keep the pipes open and the turn never ends.
    if (signal) {
      signal.addEventListener('abort', () => {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch {} }
      }, { once: true });
    }
  });
}

export const TOOLS = [
  {
    name: 'read',
    description: 'Read a file with line numbers. offset=first line (1-based), limit=line count (default 400). grep returns only matching lines with numbers. A file longer than the window reports its total line count and the next call to make.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        offset: { type: 'number', description: 'first line to return, 1-based' },
        limit: { type: 'number', description: 'how many lines (default 400, max 2000)' },
        grep: { type: 'string', description: 'return only lines matching this regex, case-insensitive' },
      },
      required: ['path'],
    },
    write: false,
  },
  {
    name: 'write',
    description: 'Create or overwrite a file with the given contents.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content'],
    },
    write: true,
  },
  {
    name: 'patch',
    description: 'Replace an exact string in a file. old must appear exactly once.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' }, old: { type: 'string' }, new: { type: 'string' } },
      required: ['path', 'old', 'new'],
    },
    write: true,
  },
  {
    name: 'search',
    description: 'Search the repository with ripgrep. Returns matching lines with paths.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' }, glob: { type: 'string' } },
      required: ['query'],
    },
    write: false,
  },
  {
    name: 'list',
    description: 'List a directory.',
    input_schema: { type: 'object', properties: { path: { type: 'string' } } },
    write: false,
  },
  {
    name: 'shell',
    description: 'Run a shell command in the session working directory.',
    input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
    write: true,
  },
  {
    name: 'capability',
    description: 'Call a build capability by key (X_POST, EMAIL_SEND, LEDGER, etc.). Use key "list" with a search term to find a key.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'capability key, e.g. X_POST — or "list" to search' },
        body: { type: 'string', description: 'pipe-delimited arguments for the capability, or a search term when key is "list"' },
      },
      required: ['key'],
    },
    write: true,
  },
  {
    name: 'screen',
    description: 'Screenshot the Mac screen; returns the visible text. Use after acting to verify the result.',
    input_schema: { type: 'object', properties: { note: { type: 'string' } } },
    write: false,
  },
  {
    name: 'web',
    description: 'Fetch a URL and return the body. GET by default; POST if body set. For web search, call the capability tool with IDEAS. Returns status, headers, and body (text or JSON pretty-printed).',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'full URL including scheme' },
        method: { type: 'string', description: 'GET | POST | PUT | PATCH | DELETE (default GET)' },
        headers_json: { type: 'string', description: 'optional JSON object of request headers' },
        body: { type: 'string', description: 'optional request body (raw string)' },
      },
      required: ['url'],
    },
    write: false,
  },
  {
    name: 'history',
    description: 'The conversation ledger on disk: every turn ever, across sessions. Use this FIRST when a message refers to something not in front of you. find filters text; last limits count.',
    input_schema: {
      type: 'object',
      properties: {
        last: { type: 'number', description: 'how many recent turns to list (default 5)' },
        find: { type: 'string', description: 'only turns matching this text' },
        all_sessions: { type: 'boolean', description: 'default true; false restricts to the current session' },
      },
    },
    write: false,
  },
  {
    name: 'memory',
    description: 'Adjust working limits. turns = past exchanges carried (default 24, max 40). loop = tool steps THIS TURN — default 60, hard maximum 120. pin keeps stored results available by id across turns.',
    input_schema: {
      type: 'object',
      properties: {
        turns: { type: 'number', description: 'past exchanges to carry: default 24, up to 40' },
        loop: { type: 'number', description: 'tool steps allowed this turn: default 60, hard max 120' },
        pin: { type: 'array', items: { type: 'string' }, description: 'stored result ids to keep available, e.g. ["r3"]' },
        forget: { type: 'array', items: { type: 'string' }, description: 'stored result ids to drop' },
        reason: { type: 'string' },
      },
    },
    write: false,
  },
  {
    name: 'browser',
    description: 'Drive Chrome on the owner\'s screen. Actions: newtab (url, opens a NEW tab), open (url, navigates current tab), tabs, read (visible text), elements (clickable things with selectors), click (selector or text), type (selector+text), screenshot, eval (script), admin_login (sign into miscsubjects.com/admin — use it instead of saying you cannot log in). Tab 0 is the frontmost. Use elements before click or type.',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        url: { type: 'string' },
        selector: { type: 'string' },
        text: { type: 'string' },
        script: { type: 'string' },
        tab: { type: 'number' },
      },
      required: ['action'],
    },
    write: true,
  },
  {
    name: 'mac',
    description: 'Control this Mac directly — no tunnel, no capability. actions: open_url (url), open_app, activate (app), frontmost, keystroke (text, optional mods), type (text), click (x,y), applescript (script), apps, notify (text). Use for his screen, windows, or apps. LOCAL_* and DESKTOP_* capabilities are DEAD — use this instead.',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        url: { type: 'string' },
        app: { type: 'string' },
        text: { type: 'string' },
        mods: { type: 'string', description: 'comma-separated: cmd, shift, option, control' },
        x: { type: 'number' },
        y: { type: 'number' },
        script: { type: 'string', description: 'AppleScript source for action "applescript"' },
      },
      required: ['action'],
    },
    write: true,
  },
  {
    name: 'recall',
    description: 'Read a stored tool result by id (r1, r2…). Optional grep, or offset+limit for a line range. Use instead of re-running a tool.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        grep: { type: 'string' },
        offset: { type: 'number' },
        limit: { type: 'number' },
      },
      required: ['id'],
    },
    write: false,
  },
  {
    name: 'git',
    description: 'Run a git subcommand, e.g. "status", "diff", "log -5".',
    input_schema: { type: 'object', properties: { args: { type: 'string' } }, required: ['args'] },
    write: false,
  },

  {
    name: 'article_get',
    description: 'Read one article whole: body, hero, tags, claims, sources. Use before any edit — an edit needs the full current body.',
    input_schema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
    write: false,
  },
  {
    name: 'article_put',
    description: 'Replace an article. Send the WHOLE body — this overwrites, and a body shorter than what is there is refused (409). slug and title are required even when unchanged; carry the existing title through from article_get. CLAIMS ARE NOT OPTIONAL: the write is refused 422 claim_law_refused without them, scaled to word count, because claims are what make an article the same object as every other one — they become the addressable regions, the proof-of-work a certifier signs, and what an outsider can challenge. The headline is also gated: it must name the subject and its central event, not tease one. Reads back automatically and reports the stored byte count.',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' },
        tags: { type: 'string', description: 'comma-separated; omit to keep' },
        category: { type: 'string' }, hero: { type: 'string' },
        claims: {
          type: 'array',
          description: 'required — one per substantive assertion, scaled to length. The 422 tells you how many.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              text: { type: 'string', description: 'the assertion itself, standing alone' },
              tier: { type: 'string', description: 'human | rct | trial | animal | mechanistic | in-vitro | cell | case | observational | regulatory | expert | definition | unsourced' },
              source_ids: { type: 'array', items: { type: 'string' }, description: 'ids present in sources[]; a dangling id is refused' },
              why_material: { type: 'string' },
            },
            required: ['id', 'text', 'tier'],
          },
        },
        sources: {
          type: 'array',
          description: 'the cards claims cite. Every source_id must exist here. SOURCE_QUOTE_LAW: each entry needs a url AND `quote` — the source\'s own verbatim words, 40 chars minimum. Not the title, not a summary, not our gloss. A card with no quote asks the reader to take our word for what the source said, and the write is refused for it.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' }, title: { type: 'string' }, url: { type: 'string' },
              quote: { type: 'string', description: 'verbatim words from the source, >=40 chars — never composed' },
              type: { type: 'string', description: 'x | reddit | pubmed | study | trial | paper | statement | book | forum …' },
            },
            required: ['id', 'url', 'quote'],
          },
        },
      },
      required: ['slug', 'title', 'body', 'claims'],
    },
    write: true,
  },
  {
    name: 'hero_set',
    description: 'Set an article hero and pass the editorial gate in one call. Every field is required because the gate refuses the write without them: it wants the story subject, the one visible action, why that literal image belongs to this story, and a note recording what you saw when you OPENED the rendered image. Look at the image first — a prompt is not visual proof. Reusing another article\'s props is refused: the image must be one this article earns on its own.',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string' }, image_url: { type: 'string' },
        hero_brief: { type: 'string', description: 'the tangible subject and the single visible action' },
        headline_subject: { type: 'string' }, hero_subject: { type: 'string' },
        visual_action: { type: 'string' }, rationale: { type: 'string' },
        inspection_note: { type: 'string', description: 'what is actually in the frame, having opened it' },
      },
      required: ['slug', 'image_url', 'hero_brief', 'headline_subject', 'hero_subject', 'visual_action', 'rationale', 'inspection_note'],
    },
    write: true,
  },
  {
    name: 'image',
    description: 'Generate an image through the build\'s own pipeline and return a permanent https://miscsubjects.com/img/ URL. One call: it renders, waits, and stores to R2. Describe the literal subject in plain words; do not name a palette, medium or era — a standing house look across articles is refused.',
    input_schema: {
      type: 'object',
      properties: { prompt: { type: 'string' }, aspect: { type: 'string', description: 'e.g. 16:9, 1:1, 9:16 — default 16:9' } },
      required: ['prompt'],
    },
    write: true,
  },
  {
    name: 'sql',
    description: 'Query a database directly. db "content" holds articles and the capability directory; db "events" holds the ledger. Use double quotes for string literals — single quotes are eaten by the argument parser. Count with COUNT(*), never by measuring a list\'s length.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' }, db: { type: 'string', enum: ['content', 'events'] } },
      required: ['query'],
    },
    write: false,
  },
  {
    name: 'email_owner',
    description: 'Email the operator, and only ever the operator. Sends from the build\'s own address, never Gmail. Prefix the subject "DRAFT: " for review work. Paste the full content — never a link alone or a summary. Needs no approval; any other recipient does.',
    input_schema: {
      type: 'object',
      properties: { subject: { type: 'string' }, text: { type: 'string' } },
      required: ['subject', 'text'],
    },
    write: true,
  },
];

// The last N raw REST exchanges, kept so the operator can expand any tool call and read
// exactly what went over the wire. Nothing is summarised on the way in.
export const WIRE = [];

const RUN = `${Date.now().toString(36)}-${process.pid}`;
const STORE = path.join(process.env.HOME || '/tmp', '.misc', 'results', RUN);
let seq = 0;

function put(name, text) {
  seq += 1;
  const id = `r${seq}`;
  try {
    fs.mkdirSync(STORE, { recursive: true });
    fs.writeFileSync(path.join(STORE, id + '.txt'), text);
  } catch {}
  return id;
}

export function readResult(id) {
  const safe = String(id).replace(/[^\w.-]/g, '');
  try { return fs.readFileSync(path.join(STORE, safe + '.txt'), 'utf8'); }
  catch {}
  try { return fs.readFileSync(path.join(STORE, '..', safe + '.txt'), 'utf8'); }
  catch { return null; }
}

const INLINE_MAX = 24000;

function receiptFor(name, text) {
  const body = String(text ?? '');
  const lines = body.split('\n');
  const id = put(name, body);
  const failed = /^ERROR|"ok"\s*:\s*false|\[timed out/.test(body);
  if (body.length <= INLINE_MAX) {
    return `${failed ? 'failed' : 'ok'} · ${id} · ${body.length} chars\n${body}`;
  }
  let kept = 0, cutAt = 0;
  for (const l of lines) {
    if (kept + l.length + 1 > INLINE_MAX) break;
    kept += l.length + 1; cutAt += 1;
  }
  if (!cutAt) cutAt = 1;
  return [
    `${failed ? 'failed' : 'ok'} · ${id} · ${lines.length} lines · ${body.length} chars — showing lines 1-${cutAt}, all of it stored`,
    lines.slice(0, cutAt).join('\n'),
    `[the remaining ${lines.length - cutAt} lines are in ${id}. To read them: recall ${id} offset=${cutAt + 1}`
      + `, or recall ${id} grep=<pattern> to jump straight to what you need.`
      + ` Paging with a new offset is expected — only an identical repeat of a call is wasted.`
      + ` Do NOT re-fetch or re-run the thing that produced ${id}: the whole result is already here.]`,
  ].join('\n');
}

function recordWire(entry) {
  WIRE.push(entry);
  if (WIRE.length > 40) WIRE.shift();
}

export const TOOL_SCHEMAS = TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
export const WRITES = new Set(TOOLS.filter((t) => t.write).map((t) => t.name));

// The build's own capability catalogue, reached over its dispatch route. One key, one
// pipe-delimited body, the raw result — the same contract every other client uses.
export function actToken() {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.env.HOME, '.misc', 'config.json'), 'utf8')).act_token || '';
  } catch { return ''; }
}

function terminalKey() {
  if (process.env.MISC_DISPATCH_KEY) return process.env.MISC_DISPATCH_KEY;
  try {
    const env = fs.readFileSync(path.join(process.env.HOME, '.config', 'grok-bridge.env'), 'utf8');
    const m = env.match(/^TERMINAL_KEY=(.+)$/m);
    return m ? m[1].trim() : '';
  } catch { return ''; }
}

// "a|b|c" and "k=v|k2=v2" both appear in the catalogue's examples. Turn either into the
// object form the JSON-schema rows expect.
function pipeToArgs(raw) {
  const parts = String(raw || '').split('|').map((x) => x.trim()).filter(Boolean);
  const obj = {};
  let positional = 0;
  for (const part of parts) {
    const m = part.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) obj[m[1]] = m[2];
    else obj['$' + (++positional)] = part;
  }
  return obj;
}

// The machine-control rows all POST to a tunnel hostname that no longer resolves. Rather
// than let the agent spend a turn collecting 1016s and then report that it cannot reach
// the Mac it is running on, the local ones are answered locally.
const LOCAL_REDIRECT = {
  LOCAL_OPEN_URL: (b) => mac({ action: 'open_url', url: b }),
  OPEN_URL: (b) => mac({ action: 'open_url', url: b }),
  LOCAL_OPEN_APP: (b) => mac({ action: 'open_app', app: b }),
  LOCAL_OPEN: (b) => mac({ action: 'open_url', url: b }),
  LOCAL_ACTIVATE: (b) => mac({ action: 'activate', app: b }),
  LOCAL_FRONTMOST: () => mac({ action: 'frontmost' }),
  LOCAL_APPS: () => mac({ action: 'apps' }),
  LOCAL_OSASCRIPT: (b) => mac({ action: 'applescript', script: b }),
  LOCAL_KEYSTROKE: (b) => mac({ action: 'keystroke', text: b }),
  DESKTOP_TYPE: (b) => mac({ action: 'type', text: b }),
  LOCAL_NOTIFY: (b) => mac({ action: 'notify', text: b }),
  LOCAL_SCREENSHOT: () => screen(),
  DESKTOP_SHOT: () => screen(),
  LOCAL_OCR: () => screen(),
  LOCAL_EXEC: (b) => sh(b, process.env.HOME, 120000),
  LOCAL_READ: (b) => sh(`cat ${JSON.stringify(b)}`, process.env.HOME, 30000),
  LOCAL_GREP: (b) => sh(`rg -n ${JSON.stringify(b)} . | head -100`, process.env.HOME, 30000),
  LOCAL_LIST: (b) => sh(`ls -la ${JSON.stringify(b || '.')}`, process.env.HOME, 20000),
  LOCAL_SAY: (b) => sh(`say ${JSON.stringify(b)}`, process.env.HOME, 30000),
  LOCAL_CLIPBOARD_GET: () => sh('pbpaste', process.env.HOME, 10000),
  LOCAL_CLIPBOARD_SET: (b) => sh(`printf %s ${JSON.stringify(b)} | pbcopy && echo copied`, process.env.HOME, 10000),
};

const ENVELOPE_NOISE = new Set([
  'proof', 'invocation', 'fingerprints', 'related', '_oip', 'operation_semantics',
  'instruction_to_model', 'say_to_user', 'automate', 'token', 'artifacts', 'yield',
  'not_project_knowledge', 'next', 'links', 'teach', 'brochure', 'facets',
]);
function leanDispatch(text) {
  const raw = String(text ?? '');
  if (!raw.trim().startsWith('{')) return raw;
  let j;
  try { j = JSON.parse(raw); } catch { return raw; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return raw;
  // Not a dispatch envelope? Leave it exactly as it came.
  if (!('result' in j) && !('error' in j) && !('ran' in j)) return raw;
  const lean = {};
  for (const [k, v] of Object.entries(j)) if (!ENVELOPE_NOISE.has(k)) lean[k] = v;
  const receipt = j.proof && j.proof.public_receipt;
  if (receipt) lean.receipt = receipt;
  // The result is very often a JSON string of the real payload. Unwrap it so the model
  // reads data instead of escaped quotes, which it otherwise burns tokens re-parsing.
  if (typeof lean.result === 'string') {
    const t = lean.result.trim();
    if (t.startsWith('[') || t.startsWith('{')) {
      try { lean.result = JSON.parse(t); } catch {}
    }
  }
  const out = JSON.stringify(lean, null, 2);
  return out.length < raw.length ? out : raw;
}

async function capability(key, body) {
  const share = actToken();
  const base = 'https://miscsubjects.com/api/dispatch';
  const redirect = LOCAL_REDIRECT[String(key || '').toUpperCase()];
  if (redirect) {
    const out = await redirect(String(body ?? ''));
    return `[ran locally — ${key} goes over a tunnel that is down, so it was executed on this Mac directly. Use the mac tool for this next time.]\n${out}`;
  }
  try {
    // Discovery: the registry is the catalogue, and it needs no authority to read.
    if (key === 'list' || key === 'search') {
      const r = await fetch(base + '?registry=1');
      const j = await r.json();
      const term = String(body || '').toUpperCase();
      const hits = (j.objects || [])
        .filter((o) => !term || o.id.includes(term) || String(o.description || '').toUpperCase().includes(term))
        .slice(0, 60)
        .map((o) => `${o.id} — ${String(o.description || '').replace(/\s+/g, ' ').slice(0, 120)}`);
      return clip(hits.join('\n') || '(no capability matched ' + term + ')');
    }
    if (!share) return 'ERROR: no act token — run: misc-token';
    const url = base + '?share=<REDACTED>';
    const raw = body == null ? '' : String(body);
    const trimmed = raw.trim();
    let payload = { key, body: raw };
    if (trimmed.startsWith('{')) {
      try { payload = { key, args: JSON.parse(trimmed), body: raw }; } catch {}
    }
    const r = await fetch(base + '?share=' + encodeURIComponent(share), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let text = await r.text();
    // One automatic repair: a row that wants JSON, called with a pipe string, says so.
    // Retry once with the string as a single JSON value rather than making the model guess.
    if (/bad_args_json/i.test(text) && !payload.args) {
      const retry = await fetch(base + '?share=' + encodeURIComponent(share), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, args: pipeToArgs(raw) }),
      }).catch(() => null);
      if (retry) {
        const retryText = await retry.text();
        if (!/bad_args_json/i.test(retryText)) text = retryText;
      }
    }
    recordWire({
      key,
      request: { method: 'POST', url, headers: { 'content-type': 'application/json' }, body: payload },
      status: r.status,
      response: text,
    });
    return clip(leanDispatch(text));
  } catch (e) {
    return 'ERROR: ' + (e && e.message || e);
  }
}

// The perception half of the loop. A screenshot that comes back as a URL is not something
// a text model can see, so the picture is turned into the text that is on it before it is
// handed back. Downscaled first: OCR is both faster and more accurate at 1600px than on a
// full Retina capture.
const SHOT = path.join(process.env.HOME || '/tmp', '.misc', 'screen.png');

async function screen() {
  const small = SHOT.replace('.png', '-small.png');
  const cmd = `screencapture -x ${JSON.stringify(SHOT)} && sips -Z 1600 ${JSON.stringify(SHOT)} --out ${JSON.stringify(small)} >/dev/null && tesseract ${JSON.stringify(small)} stdout 2>/dev/null`;
  const text = await sh(cmd, process.env.HOME, 30000);
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return 'screen captured but no text was readable on it (image at ' + SHOT + ')';
  return `Text visible on screen right now (${lines.length} lines, image at ${SHOT}):\n` + clip(lines.join('\n'));
}

const OSA_APPS = 'tell application "System Events" to get name of every process whose background only is false';

async function mac(input) {
  const a = String(input.action || '').toLowerCase();
  const osa = (script) => sh(`osascript -e ${JSON.stringify(script)}`, process.env.HOME, 30000);
  switch (a) {
    case 'open_url':
    case 'open': {
      if (!input.url) return 'ERROR: mac open_url needs url';
      const out = await sh(`open ${JSON.stringify(input.url)}`, process.env.HOME, 20000);
      return `opened ${input.url} in the default browser${out && out !== '(no output)' ? '\n' + out : ''}\nNow look: call screen, or browser{action:"read"} if it landed in the automation profile.`;
    }
    case 'open_app':
      return await sh(`open -a ${JSON.stringify(input.app || '')}`, process.env.HOME, 20000);
    case 'activate':
      return await osa(`tell application ${JSON.stringify(input.app || '')} to activate`);
    case 'frontmost':
      return await osa('tell application "System Events" to get name of first process whose frontmost is true');
    case 'apps':
      return await osa(OSA_APPS);
    case 'notify':
      return await osa(`display notification ${JSON.stringify(String(input.text || ''))} with title "misc"`);
    case 'keystroke': {
      const mods = String(input.mods || '').split(',').map((m) => m.trim()).filter(Boolean)
        .map((m) => ({ cmd: 'command down', command: 'command down', shift: 'shift down', option: 'option down', alt: 'option down', control: 'control down', ctrl: 'control down' }[m.toLowerCase()]))
        .filter(Boolean);
      const using = mods.length ? ` using {${mods.join(', ')}}` : '';
      return await osa(`tell application "System Events" to keystroke ${JSON.stringify(String(input.text || ''))}${using}`);
    }
    case 'type':
      return await osa(`tell application "System Events" to keystroke ${JSON.stringify(String(input.text || ''))}`);
    case 'click':
      return await osa(`tell application "System Events" to click at {${Number(input.x) || 0}, ${Number(input.y) || 0}}`);
    case 'applescript':
      return await osa(String(input.script || ''));
    default:
      return `ERROR: unknown mac action "${a}". Use open_url, open_app, activate, frontmost, apps, keystroke, type, click, applescript, notify.`;
  }
}

// Fetch any URL. The agent's only route to the web when it is not a build capability: a
// plain HTTP request that returns status, headers, and the body — JSON pretty-printed,
// text passed through. A 30-second ceiling so a hung server is a result, not a dead turn.
async function web(url, method, headersJson, body, signal) {
  const m = (method || 'GET').toUpperCase();
  let headers = {};
  if (headersJson) {
    try { headers = JSON.parse(headersJson); }
    catch { return 'ERROR: headers_json is not valid JSON'; }
  }
  const init = { method: m, headers, signal };
  if (body && (m === 'POST' || m === 'PUT' || m === 'PATCH')) init.body = String(body);
  const r = await fetch(url, init);
  const text = await r.text();
  const out = { status: r.status, ok: r.ok, url: r.url, headers: Object.fromEntries(r.headers.entries()), body: text };
  try { out.body = JSON.parse(text); } catch {}
  return clip(JSON.stringify(out, null, 2));
}

function resolve(cwd, p) {
  const full = path.resolve(cwd, String(p || ''));
  return full;
}

export async function runTool(name, input, cwd, signal) {
  const started = Date.now();
  const out = await runToolInner(name, input, cwd, signal);
  // recall is the one tool whose output IS the answer: it was already asked for by id and
  // bounded by the caller, so it passes through whole.
  if (name === 'recall') return out;
  // Every tool call, not just capability calls, is recorded whole so /expand can show the
  // exact input and the exact output rather than a rendering of them.
  if (name !== 'capability') {
    recordWire({ key: name, request: { method: 'tool', url: name, body: input }, status: 200, response: out });
  }
  return { model: receiptFor(name, out), full: out };
}

async function runToolInner(name, input, cwd, signal) {
  try {
    switch (name) {
      case 'read': {
        const file = resolve(cwd, input.path);
        const all = fs.readFileSync(file, 'utf8').split('\n');
        const numbered = all.map((l, i) => String(i + 1).padStart(5) + '  ' + l);
        if (input.grep) {
          let re;
          try { re = new RegExp(input.grep, 'i'); }
          catch { return `ERROR: grep is not a valid regex: ${input.grep}`; }
          const hits = numbered.filter((l) => re.test(l));
          if (!hits.length) return `no line in ${input.path} matches ${input.grep} (${all.length} lines)`;
          const shown = hits.slice(0, 400);
          return `${input.path} — ${hits.length} lines match ${input.grep} (of ${all.length}), showing ${shown.length}:\n`
            + shown.join('\n')
            + `\n[read ${input.path} with offset=<line> to see the surrounding code]`;
        }
        const limit = Math.max(1, Math.min(Number(input.limit) || 400, 2000));
        const start = Math.max(1, Math.round(Number(input.offset) || 1));
        const slice = numbered.slice(start - 1, start - 1 + limit);
        if (!slice.length) return `${input.path} has ${all.length} lines — offset ${start} is past the end`;
        const end = start + slice.length - 1;
        const more = end < all.length
          ? `\n[lines ${end + 1}-${all.length} not shown — read ${input.path} with offset=${end + 1}, or grep to jump straight to what you need]`
          : '';
        return `${input.path} lines ${start}-${end} of ${all.length}:\n` + slice.join('\n') + more;
      }
      case 'write': {
        const file = resolve(cwd, input.path);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, input.content);
        return `wrote ${file} (${input.content.length} chars)`;
      }
      case 'patch': {
        const file = resolve(cwd, input.path);
        const body = fs.readFileSync(file, 'utf8');
        const hits = body.split(input.old).length - 1;
        if (hits === 0) return 'ERROR: old string not found';
        if (hits > 1) return `ERROR: old string appears ${hits} times, must be unique`;
        fs.writeFileSync(file, body.replace(input.old, input.new));
        return `patched ${file}`;
      }
      case 'search': {
        const glob = input.glob ? `--glob ${JSON.stringify(input.glob)}` : '';
        const atHome = path.resolve(cwd) === path.resolve(process.env.HOME || '/');
        const scope = atHome ? 'miscsubjects-pages misc-cli/src' : '.';
        const fence = "-g '!node_modules' -g '!.git' -g '!Library' -g '!.Trash' -g '!*.emlx'";
        const out = await sh(
          `rg -n --no-heading -S --max-filesize 2M ${fence} ${glob} ${JSON.stringify(input.query)} ${scope} | head -200`,
          cwd, TIMEOUTS.search, signal,
        );
        return atHome && (!out || out === '(no output)')
          ? out + `\n[searched ${scope} — from the home directory only those trees are searched; pass a repo path or cd to search elsewhere]`
          : out;
      }
      case 'list':
        return await sh(`ls -la ${JSON.stringify(input.path || '.')}`, cwd, TIMEOUTS.list, signal);
      case 'shell': {
        const refused = guardShell(input.command);
        if (refused) return refused;
        return await sh(input.command, cwd, TIMEOUTS.shell, signal);
      }
      case 'git':
        return await sh(`git ${input.args}`, cwd, TIMEOUTS.git, signal);
      case 'capability':
        return await capability(input.key, input.body);

      // ---- the typed loop tools. Each one is the contract, spelled out, so the agent does
      // not have to go and find it. They call the same dispatcher underneath; what they remove
      // is the search-then-read-then-guess-the-pipe-order sequence in front of every action.
      case 'article_get':
        return await web(`https://miscsubjects.com/api/articles/${encodeURIComponent(input.slug)}`, 'GET', '', '', signal);

      case 'article_put': {
        const payload = { slug: input.slug, title: input.title, body: input.body };
        // CLAIM_LAW refuses the write without these, and the tool had no field for them at all —
        // so this tool could not publish an article, ever, and the 422 read as the agent failing.
        if (Array.isArray(input.claims)) payload.claims = input.claims;
        if (Array.isArray(input.sources)) payload.sources = input.sources;
        if (input.tags) payload.tags = String(input.tags).split(',').map((s) => s.trim()).filter(Boolean);
        if (input.category) payload.category = input.category;
        if (input.hero) payload.hero = input.hero;
        const wrote = await capability('ARTICLE_PUT', JSON.stringify(payload));
        // A SAVE IS NOT DONE UNTIL READ BACK — the rule this agent is given, applied here so
        // it holds whether or not the model remembers to.
        const back = await web(`https://miscsubjects.com/api/articles/${encodeURIComponent(input.slug)}`, 'GET', '', '', signal);
        let stored = 'unknown';
        try { stored = String(JSON.parse(back).body?.body?.length ?? JSON.parse(back).body?.length ?? 'unknown'); } catch {}
        return `${wrote}\n\n[read back: stored body is ${stored} characters; you sent ${String(input.body || '').length}]`;
      }

      case 'hero_set': {
        const patch = {
          hero: input.image_url,
          hero_brief: input.hero_brief,
          editorial_review: {
            headline_subject: input.headline_subject,
            hero_subject: input.hero_subject,
            visual_action: input.visual_action,
            rationale: input.rationale,
            inspected: true,
            inspection_note: input.inspection_note,
          },
        };
        return await capability('ART_PATCH', `${input.slug}|${JSON.stringify(patch)}`);
      }

      case 'image': {
        const gen = await capability('ARCADS_GENERATE', `gpt-image|${input.prompt}|${input.aspect || '16:9'}||`);
        let id = null;
        try { id = JSON.parse(gen).arcads_id || null; } catch {}
        if (!id) { const m = /"arcads_id"\s*:\s*"([^"]+)"/.exec(gen); id = m ? m[1] : null; }
        if (!id) return `ERROR: no arcads_id came back, so there is nothing to store. Raw: ${String(gen).slice(0, 400)}`;
        const stored = await capability('ARCADS_TO_R2', `${id}|gpt-image`);
        let url = null;
        try { url = JSON.parse(stored).url || null; } catch {}
        if (!url) { const m = /"url"\s*:\s*"([^"]+)"/.exec(stored); url = m ? m[1] : null; }
        return url
          ? `${url}\n[stored permanently. OPEN it before setting it as a hero — hero_set records that you looked.]`
          : `render started (${id}) but no stored url came back. Raw: ${String(stored).slice(0, 400)}`;
      }

      case 'sql':
        return await capability(input.db === 'events' ? 'LEDGER_QUERY' : 'D1_QUERY', input.query);

      case 'email_owner': {
        // The recipient is not a parameter. Every send from this tool goes to the operator and
        // nowhere else, so a mistyped address cannot turn an internal note into outreach.
        let to = '';
        try { to = JSON.parse(fs.readFileSync(path.join(process.env.HOME || '', '.misc', 'config.json'), 'utf8')).owner?.email || ''; } catch {}
        if (!to) return 'ERROR: no owner email in ~/.misc/config.json, so there is nobody to send to.';
        return await capability('EMAIL_SEND', `${to}|${input.subject}|${input.text}`);
      }
      case 'screen':
        return await screen();
      case 'mac':
        return await mac(input);
      case 'browser':
        return await browser(input.action, input);
      case 'recall': {
        const body = readResult(input.id);
        if (body == null) return `ERROR: no stored result ${input.id}`;
        const WIDE = 4000;
        const wide = (s) => s.length > WIDE;
        const win = Math.max(500, Math.min(Number(input.limit) || 4000, 20000));
        if (input.grep) {
          let re;
          try { re = new RegExp(input.grep, 'i'); }
          catch { return `ERROR: grep is not a valid regex: ${input.grep}`; }
          const lines = body.split('\n');
          const hitLines = lines.filter((l) => re.test(l));
          if (!hitLines.length) return `no line in ${input.id} matches ${input.grep} (${lines.length} lines, ${body.length} chars)`;
          // Narrow lines: return them as lines, as before. Wide lines: return windows around
          // each match inside the line, never the line itself.
          if (!hitLines.some(wide)) {
            const shown = hitLines.slice(0, 400);
            return `${input.id} — ${hitLines.length} of ${lines.length} lines match ${input.grep}:\n` + shown.join('\n');
          }
          const g = new RegExp(input.grep, 'gi');
          const out = []; let m, n = 0;
          while ((m = g.exec(body)) !== null && n < 8) {
            const from = Math.max(0, m.index - Math.floor(win / 4));
            out.push(`— match at char ${m.index}:\n…${body.slice(from, from + win)}…`);
            n += 1;
            if (m.index === g.lastIndex) g.lastIndex += 1;
          }
          const total = (body.match(g) || []).length;
          return `${input.id} is ${body.length} chars on ${lines.length} line(s) — too wide to page by line, so here are `
            + `${out.length} character windows around "${input.grep}"${total > out.length ? ` (of ${total} matches)` : ''}:\n`
            + out.join('\n\n')
            + `\n[narrow the grep, or recall ${input.id} offset=<char> to read a specific window]`;
        }
        const lines = body.split('\n');
        if (lines.length <= 2 && body.length > WIDE) {
          // One long line: offset is a CHARACTER offset, and say so plainly.
          const start = Math.max(0, Math.round(Number(input.offset) || 0));
          const slice = body.slice(start, start + win);
          if (!slice) return `${input.id} is ${body.length} chars — offset ${start} is past the end`;
          const end = start + slice.length;
          return `${input.id} chars ${start}-${end} of ${body.length} (one long line, so offset counts CHARACTERS not lines):\n`
            + slice
            + (end < body.length ? `\n[recall ${input.id} offset=${end} for the next ${win}, or grep to jump to what you need]` : '');
        }
        const start = Math.max(0, Number(input.offset) || 0);
        const count = Math.min(Number(input.limit) || 120, 400);
        const slice = lines.slice(start, start + count);
        if (!slice.length) return `${input.id} has ${lines.length} lines — offset ${start} is past the end`;
        const end = start + slice.length;
        return `${input.id} lines ${start + 1}-${end} of ${lines.length}:\n` + slice.join('\n')
          + (end < lines.length ? `\n[recall ${input.id} offset=${end} for the next ${count}]` : '');
      }
      case 'web':
        return await web(input.url, input.method, input.headers_json, input.body, signal);
      default: {
        if (/^[A-Z][A-Z0-9_]{2,}$/.test(String(name))) {
          const body = input && (input.body || input.args || input.query || input.sql
            || input.command || input.input || '');
          const routed = await runTool('capability', { key: name, body: String(body || '') }, cwd, signal);
          if (typeof routed === 'string') return routed;
          return typeof routed?.full === 'string' ? routed.full : JSON.stringify(routed);
        }
        return 'ERROR: unknown tool ' + name + ' — call the capability tool with key="' + name + '", or capability{key:"list"} to search.';
      }
    }
  } catch (e) {
    return 'ERROR: ' + (e && e.message ? e.message : String(e));
  }
}
