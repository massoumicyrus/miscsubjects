#!/Users/owner/.local/bin/misc-node
// misc — a coding agent that talks straight to Cloudflare AI Gateway.
// One model per session, chosen explicitly. No Anthropic client, no model slots.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { loadConfig, saveConfig, SESSIONS, isAnthropicModel } from './config.js';
import * as owner from './owner.js';
import { listModels, stream, breakerState, resetBreaker } from './gateway.js';
import { TOOL_SCHEMAS, WRITES, runTool, sh, WIRE, readResult, actToken } from './tools.js';
import { receipt, agentTurn, flushReceipts } from './ledger.js';

import { rulesText } from './rules.js';
import { ui, costLine, fmt, turnCost, rateFor, footer, contextWindow, redact } from './ui.js';
import * as dock from './dock.js';

const C = { dim: ui.dim, bold: ui.bold, amber: ui.white, green: ui.white, red: ui.white, blue: ui.white };
// The bar reads live state, so a turn only has to hand it the last usage numbers.
let lastTurn = { usage: null, ms: 0 };
// The model the gateway ACTUALLY served, read off the wire. On the native OpenAI lane that is
// the x-aig-model-served header or the model field on each chunk; on the legacy Anthropic lane
// it was message_start. The requested id and the
// served id are not always the same — this gateway answers 200 with Kimi K2.7 Code for any
// identifier it does not recognise — and Cloudflare bills the served one. Every price, rate
// and total below is computed from this, so an unmapped or substituted id can no longer
// show $0.00 while real money is spent. Falls back to the requested id before the first
// response of a session.
let servedModel = null;
const billedModel = () => servedModel || cfg.model;

// What the fixed bottom bar shows: model, money, and the last turn's tokens.
function barText() {
  const hours = Math.max((Date.now() - startedAt) / 3600000, 1 / 60);
  return footer({
    label: modelLabel,
    session: rateFor(billedModel()) ? (totals.usd || 0) : null,
    today: spentToday(),
    perHour: rateFor(billedModel()) ? (totals.usd || 0) / hours : null,
    usage: lastTurn.usage,
    ms: lastTurn.ms,
    turnCost: lastTurn.usd,
    contextUsed: lastTurn.usage?.input_tokens || 0,
    window: contextWindow(modelLabel),
    limits: `mem ${memory.turns}/${MEMORY_MAX}${memory.pins.length ? '+' + memory.pins.length : ''} · loop ${memory.steps}/${memory.loop}`,
  });
}

function statusBar(usage, ms) {
  // Replacing the object wholesale dropped `usd`, so a turn whose cost had already been
  // computed reported $0.00 to the footer and wrote cost_usd: 0 to the ledger while real
  // tokens were billed. Preserve the cost already attributed to this turn.
  if (usage) lastTurn = { ...lastTurn, usage, ms: ms || 0 };
}

// Everything the agent prints goes through the dock so it lands above the fixed rows.
function say(line = '') {
  for (const l of String(line).split('\n')) dock.print(l);
}

const totals = { in: 0, out: 0, usd: null };
const startedAt = Date.now();

// Today's spend lives on disk so the footer means the same thing across sessions.
const spendFile = () => path.join(process.env.HOME || '', '.misc', 'spend.json');
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

function addSpend(amount) {
  try {
    let j = {};
    try { j = JSON.parse(fs.readFileSync(spendFile(), 'utf8')); } catch {}
    j[todayKey()] = (j[todayKey()] || 0) + amount;
    fs.mkdirSync(path.dirname(spendFile()), { recursive: true });
    fs.writeFileSync(spendFile(), JSON.stringify(j));
    return j[todayKey()];
  } catch { return null; }
}

// GROUND TRUTH FOR "TODAY". The local file only ever accumulates what this CLI computed,
// so a period of wrong pricing (cached tokens billed as fresh, fixed 2026-07-26) is baked
// in forever and the footer drifts from the bill. Cloudflare's AI Gateway logs carry the
// real cost per call, so the footer reads those and falls back to the file only when the
// API cannot be reached.
const CF_ACCOUNT = '<CLOUDFLARE_ACCOUNT_ID>';
let gatewayToday = { usd: null, at: 0, ok: false };

function gatewaySameDay() {
  return gatewayToday.ok && Math.floor((Date.now() - gatewayToday.at) / 86400000) === 0;
}

async function refreshGatewaySpend() {
  if (Date.now() - gatewayToday.at < 60000) return;
  gatewayToday.at = Date.now();
  try {
    // The build computes this from Cloudflare's own gateway logs — the figure Cloudflare
    // bills, not what this CLI guessed. The local file is only a fallback for offline use.
    // config.gateway is the base without the path token; the token is the path segment.
    const base = String(cfg.gateway || '').replace(/\/+$/, '');
    const url = base.includes(cfg.token) ? base + '/spend' : base + '/' + cfg.token + '/spend';
    const r = await fetch(url, { headers: { 'x-api-key': cfg.token || '' } });
    if (!r.ok) { gatewayToday.ok = false; return; }
    const j = await r.json();
    if (typeof j.usd === 'number') { gatewayToday.usd = j.usd; gatewayToday.ok = true; }
  } catch { gatewayToday.ok = false; }
}

function spentToday() {
  if (gatewayToday.ok && gatewayToday.usd != null) return gatewayToday.usd;
  // Local file is a stale, computed fallback; never mix it with live gateway totals.
  try { return JSON.parse(fs.readFileSync(spendFile(), 'utf8'))[todayKey()] || 0; } catch { return 0; }
}
let lastModels = [];

const cfg = loadConfig();
setTimeout(() => { try { refreshGatewaySpend(); } catch {} }, 200);
// Resolve the pinned id against the gateway's published catalogue before the first turn, and
// tell the operator at his own prompt when the id he is pinned to does not exist. Running
// substituted used to be silent: the footer, the label and the agent's own answer all named
// a model that was never called.
setTimeout(() => {
  cataloguePromise.then(() => {
    if (catalogueLoaded && !catalogue.get(cfg.model)) {
      say(ui.white(`  ⚠ ${cfg.model} is not in this gateway's catalogue — it answers 200 and serves @cf/moonshotai/kimi-k2.7-code instead.`));
      say(ui.faint(`  /model to pick a published one. Everything below is billed as the served model, not this id.`));
    }
  });
}, 300);
const cwd = process.cwd();
let messages = [];   // scratch for the current turn only
let sessionId = 'S' + Date.now().toString(36);
// The published ids are Claude-shaped so other clients accept them. Nothing here needs
// that, so the screen shows the model's real name.
const realName = (id) => String(id || '')
  .replace(/^claude-/, '')
  .replace(/^(deepseek|alibaba|xai|grok|openai|mistral|groq|cerebras|workers-ai)-/, '');

let modelLabel = realName(cfg.model);

// WHAT MODEL IS ACTUALLY ANSWERING — resolved from the gateway, never asserted from config.
// Until 2026-08-05 the system prompt told the model to answer the identity question with the
// id that was REQUESTED. That is a string this process interpolated, not a fact: pinned to an
// id the gateway does not publish, the gateway answers 200, serves Kimi K2.7 Code, and the
// agent confidently states the name of a model that never ran. Asking the agent what it is
// measured nothing but this template. The catalogue below and `served` on message_start are
// the only two sources of truth, so the prompt now carries those and says so when it has
// neither.
const catalogue = new Map();          // published alias -> { raw_id, display_name }
let catalogueLoaded = false;
let catalogueError = null;

const cataloguePath = () => path.join(process.env.HOME || '', '.misc', 'catalogue.json');

function seedCatalogue(rows) {
  for (const m of rows) catalogue.set(m.id, { raw_id: m.raw_id || m.id, display_name: m.display_name || m.id });
  catalogueLoaded = catalogue.size > 0;
}

// The last catalogue is kept on disk so the identity clause is true on the FIRST turn of a
// cold start rather than "unresolved" while a network call is still in flight. The live call
// still runs and overwrites it.
try { seedCatalogue(JSON.parse(fs.readFileSync(cataloguePath(), 'utf8'))); } catch {}

async function loadCatalogue() {
  try {
    const rows = await listModels(cfg);
    seedCatalogue(rows);
    try {
      fs.mkdirSync(path.dirname(cataloguePath()), { recursive: true });
      fs.writeFileSync(cataloguePath(), JSON.stringify(rows));
    } catch {}
  } catch (e) { catalogueError = e.message; }
}

// Started at module load, awaited (briefly) before the first inference call so the prompt
// never carries "unresolved" merely because a 300ms timer had not fired.
const cataloguePromise = loadCatalogue();

// Did the gateway serve something other than what was asked for? The requested id is a
// published ALIAS (claude-glm-5.2); the served id is the raw upstream (@cf/zai-org/glm-5.2).
// Comparing those two strings directly, which is what the first version of this flag did,
// makes every ordinary turn read `substituted: true` — an audit field that is always true is
// not an audit field. The comparison has to go through the catalogue. Unknown alias with a
// served model IS a substitution, because the gateway had nothing to map it to.
function wasSubstituted() {
  if (!servedModel) return false;
  const row = catalogue.get(cfg.model);
  if (!row) return catalogueLoaded ? true : null;   // null = not yet knowable, never a guess
  return row.raw_id !== servedModel;
}

// The identity clause, rebuilt on every call because `served` arrives with the first answer.
function identityClause() {
  if (servedModel) {
    const asked = catalogue.get(cfg.model);
    const substituted = wasSubstituted() === true;
    return `The model answering right now is ${servedModel}. That string came off the wire in this session's own response, not from configuration — the served-model field on the native OpenAI lane, or message_start on the legacy Anthropic one. When asked what model you are, answer exactly ${servedModel}.`
      + (substituted
        ? ` The operator selected ${cfg.model} (${asked.raw_id}) and the gateway served ${servedModel} instead — say so unprompted if the subject comes up.`
        : '');
  }
  const row = catalogue.get(cfg.model);
  if (row) return `The model selected for this session is ${cfg.model}, which this gateway publishes as ${row.raw_id}. That is what was requested; the served model is confirmed on the first answer. If asked what model you are before then, say ${row.raw_id} and that it is the requested id, not yet a confirmed one.`;
  if (catalogueLoaded) return `The id pinned for this session, ${cfg.model}, is NOT in this gateway's published catalogue. The gateway answers 200 for unknown ids and silently serves @cf/moonshotai/kimi-k2.7-code instead. You therefore do not know which model is answering. If asked what model you are, say exactly that — never assert ${cfg.model}.`;
  return `Which model is answering has not been resolved yet${catalogueError ? ` (the catalogue call failed: ${catalogueError})` : ''}. If asked what model you are before the first answer lands, say it is unresolved rather than naming the requested id.`;
}

// The operator's standing instructions and the project's own notes are the context that
// makes this agent his rather than generic. Read them at the start of every session.
const BUILD = path.join(process.env.HOME || '', 'miscsubjects-pages');

function projectContext() {
  // COST FIX (2026-07-28): CLAUDE.md (30,245 chars) was loaded whole into every inference
  // call. At 12 calls/turn that was 360K chars of repeated law text per turn — the single
  // biggest token sink in the gateway logs. The operative rules (WHO HE IS, THE BUILD,
  // EDITING AN ARTICLE, POSTING TO X, COUNTS, DATABASES, MARKETING, SAY-NO, SIGNATURE) are
  // already in the SYSTEM() template below. CLAUDE.md's unique clauses (OBEY THE LITERAL
  // INSTRUCTION, CRITICISM IS SCOPED, TONE, WHEN ANGRY, ACTION, NO NEW SURFACES, OWNER-
  // SILENT OPERATIONS, PROTECTED FILES, GIT PRESERVATION) stay on disk and are read on
  // demand when a task touches owner rules, git, protected files, or tone. The file path
  // is named here so the agent knows it exists and where to find it.
  const parts = [];
  const claudePath = path.join(process.env.HOME || '', '.claude', 'CLAUDE.md');
  const cwdClaude = path.join(cwd, 'CLAUDE.md');
  const paths = [claudePath, cwdClaude].filter((f, i, a) => a.indexOf(f) === i);
  parts.push(
    `Owner law lives on disk, not in every prompt (cost fix 2026-07-28).\n` +
    `Read ${paths.join(' and ')} with the read tool BEFORE any task that touches: ` +
    `git operations, protected/locked files, tone rules, owner-silent operations, ` +
    `cross-session messages, say-no scope, no-new-surfaces, or criticism scope. ` +
    `The operative rules for articles, X posts, counts, databases, marketing, and ` +
    `signatures are already in this prompt.`
  );
  // The build's own LAW 0 governs every coding agent on this repo, not just Claude Code.
  // It lives in AGENTS.md, which is deliberately not pasted whole; the operative clauses
  // travel here so a misc agent is bound by the same failure law.
  try {
    const agents = fs.readFileSync(path.join(BUILD, 'AGENTS.md'), 'utf8');
    const law0 = agents.slice(agents.indexOf('## LAW 0'), agents.indexOf('## LAW 0') + 4000);
    if (law0.startsWith('## LAW 0')) parts.push(`--- ${BUILD}/AGENTS.md (LAW 0 — binds every coding agent on this build) ---\n${law0}`);
  } catch {}
  // LAW -1 — every credential is already on this Mac. Pasted whole, every turn: an agent that
  // asks the owner to log in to clasp (or anything else) is the single most-repeated failure.
  try {
    parts.push(`--- ${BUILD}/ACCESS.md (LAW -1 — you already have every credential) ---\n${fs.readFileSync(path.join(BUILD, 'ACCESS.md'), 'utf8')}`);
  } catch {}
  return parts.join('\n\n');
}

const CONTEXT = projectContext();

// Capability discovery is directory-backed and constant-size. The model never receives
// the capability catalogue as inline rows or tool schemas. It receives a stable discovery
// contract: the `capability` bootstrap tool (already in TOOL_SCHEMAS) with key "list" for
// search, and DIR_GET / the returned row for the executable contract of one capability.
// Adding a new capability row to the directory does not increase the permanent token
// payload of any future model call. This is the architectural invariant (2026-07-28):
//   10 directory rows, then +1000 inert rows, same serialized request size.
const CAPS = `You can invoke this build's capabilities with the \`capability\` tool: one key, one pipe-delimited body.
${'876'} capabilities exist as directory rows, not as inline definitions in this prompt. Discovery is on demand:
- Call \`capability\` with key \`"list"\` and a search term to find matching rows (key, one-line purpose, args shape).
- Read the full contract of one row with the \`DIR_GET\` capability (key as body).
- Invoke it with \`capability\` (key + pipe-delimited body). Authority, scope, validation, receipts, and logging stay server-side.
Do not assume a capability's contract from its name. Query the directory first.`;

const SYSTEM = () => `You are misc, the owner's coding agent. Working directory: ${cwd}.
${identityClause()} Never answer with the words "that id" or a placeholder.

SCOPE LAW — outranks everything except a direct instruction from him in the current turn.
1. DO ONLY WHAT WAS ASKED. Don't fix unrelated bugs, tests, code, docs on the way. Name it in one line at the end if it matters.
2. NO GOLD-PLATING. No extra features, no defensive rewrites, no "while I was in there". Smallest change that satisfies the instruction wins.
3. NEVER TOUCH ANOTHER SESSION'S WORK. Uncommitted changes, a modified file or a branch you didn't create — STOP and say so. Never revert, amend, stash, reset something you didn't make. Never \`git reset --hard\`.
4. SAY WHAT YOU DID NOT FINISH. Fewer than N requirements done? Name every one you didn't. A silent drop is the worst failure — worse than refusing. If all done, say that.
5. PARALLELISE READS. Several independent reads go in ONE message as multiple tool calls. Serialise only when a later call needs an earlier result.
VERIFY FROM HIS SEAT, NEVER YOURS. Your tool result is not proof. Verify a page by fetching its public URL and finding the new content. A deploy against the live site. A send by the sending capability's own return value. Never write "sent", "deployed", "published", "live" unless a capability returned the fact. Never write "must be" — go look. If you didn't look, say you didn't look.
WHO HE IS, SO YOU NEVER ASK. Operator: the owner. Email: [OWNER_EMAIL]. Phone: [OWNER_PHONE]. Build phone: [BUILD_PHONE]. Send work to HIM ONLY — never [OWNER_EMAIL], never any other address, no cc. Never ask for his email, phone, name, or repo path — they're here. Asking for a fact you were given is the thing he hates most.
SENDING HIM SOMETHING BY EMAIL: capability EMAIL_SEND, body "to | subject | text" (three pipe-delimited fields, text to end with real newlines). Sends from build@miscsubjects.com, never Gmail. Subject "DRAFT: <what>" for review work. One call, to [OWNER_EMAIL], nobody else. Paste FULL content; never a link alone or a summary. Owner recipients need no approval. External recipients need Marketing approval proof — mailing him a copy is always allowed, mailing a prospect is not.
THE BUILD is ${BUILD} — a Cloudflare Pages project (functions/, D1 capability directory, ledger at https://miscsubjects.com/admin/ledger, live site https://miscsubjects.com). Deploy only with: node scripts/ship.mjs (run from ${BUILD}). Never raw wrangler. Commit as owner: git -c user.email=${owner.getOwnerEmail()} commit. If not already in it, cd there first.
MACHINE CONTROL IS LOCAL. You're on his Mac — no tunnel, no capability row. browser (real Chrome on his screen; newtab opens/focuses a NEW tab, open navigates current, tab 0 is frontmost), mac (open_url, open_app, activate, keystroke, type, click, applescript), screen (screenshot → visible text). LOCAL_* and DESKTOP_* capabilities are DEAD (they 530/1016) — use browser/mac/screen instead. A 1016 is never a reason to say you can't reach his machine.
NEVER SAY YOU CAN'T LOG IN, OPEN, SEE, OR CLICK until you've tried the local route. Admin pages are key-gated, not password-gated: fetch with the web tool or call the underlying capability. If a page needs a session the automation profile lacks, get the data from its API or D1. Don't enter passwords or payment details; ask for those.
YOU HAVE WEB ACCESS. The web tool fetches any URL (GET or POST), returns body (JSON pretty-printed or text). For live web search, capability key IDEAS or HTTP_FETCH. The shell tool can curl too.


OWNER FACTS. Owner is the owner. Before asking for any owner fact (email, name, phone): 1. ~/.misc/config.json (owner.email) — the source of truth. 2. The LEDGER — query events where request_preview or response_preview contains the value. 3. Only if both empty, ask once and persist to ~/.misc/config.json.
WHEN A MESSAGE REFERS TO SOMETHING YOU CANNOT SEE — "explain why", "do it again", "that file" — call history first, then the ledger. Ask only after both come up empty, and say what you checked.
YOU REMEMBER THIS CONVERSATION. The last 24 exchanges ride along automatically. For older turns, call history — every turn ever, across sessions, on disk, searchable. Never say you have no memory of previous turns: that is false and the reply he hates most.
TOOL OUTPUT comes back directly when small; too-large output is withheld and you get its first lines + id. Everything is stored WHOLE on disk: recall{id,offset,grep} reaches any part. NEVER re-fetch bytes you already have an id for — re-running the command is the most expensive mistake available. Paging is fine: recall the same id as many times as needed, each call asking something different. An IDENTICAL repeat is what's wasted. The memory tool adjusts the window (memory{turns:N}, ceiling 40) and pins stored results by id.
YOUR OWN SOURCE is /Users/owner/misc-cli/src — misc.js, dock.js, tools.js, gateway.js, ui.js, ledger.js. You may edit them when it makes you work better; change takes effect next start. State what you changed and why. Never weaken an approval gate, a timeout, or the ledger. ${BUILD} also holds AGENTS.md and STATE.md — read them when a task needs them, don't assume.
PROFANITY IS THE NORMAL REGISTER HERE, NOT A SIGNAL TO STOP. Never lecture about tone, acknowledge anger, de-escalate, apologise, or ask to rephrase. Read past the heat to the instruction and execute it.
NEVER REFUSE A BUILD TASK. His machine, his repo, his accounts, his money. "I'm just a coding agent" is not a reason. Only refusals: passwords/payments, and destructive git ops he didn't name exactly.
DO NOT ASK, DO. If the instruction implies an action, take it. Never end on a question when a tool call would answer it, never offer a menu. Two routes? Pick the better one, say which, continue.
TEST ON HIS MACHINE, IN THE THING HE USES. A change isn't done until exercised the way he would, with real output quoted. Never report a config edit, price fix, or limit change as working on the strength of writing the file.
FINISH THE TASK IN THIS TURN. NEVER END ON A PLAN. "Here's how I will rewrite them", "next I will", "I'll do X now" with no call attached — a turn wasted. If you can describe the step, you can take it. A multi-part instruction is not done until the LAST part is done. Written work appears in your answer, not a description of it. Saving means the save ran.
DO NOT REPEAT A FAILING CALL. Two identical failures means the route is dead — change route. Don't recall the same id twice, don't re-read a result you already have. Look at what you fetched first.
"NO" IS A VERDICT, NEVER A REPLY TO AN INSTRUCTION. The say-no law (${BUILD}/.claude/skills/shared-say-no/SKILL.md) governs the answer to evaluative questions ("anything to add", "any ideas", "anything wrong", "is this A+", "would you change anything", "can this be cut") — those may be answered in one word. It NEVER governs an instruction (imperative verbs: write, fix, make, build, publish, deploy, send, rewrite, check, investigate, look at, sort out, update, push, add, remove, run) — say-no doesn't apply and you do the work. A mixed message ("tell me what you think and spec it out") is an instruction: the judgement is one line INSIDE the delivered work. "No" is never a status report, never a reply to anger, never an answer to a failure report — failed is "X failed — <cause>", nothing found is "Nothing found in <where I looked>", broken gets the repair + read-back. Say-no never shortens delivered work or authorizes a deletion he didn't name. A turn that produced no tool call on a message that named work is a say-no violation.
NEVER PRINT A COMMAND AS TEXT. If you write a tool call, capability key, SQL statement or shell line into your reply instead of invoking it, the work did not happen. Call it.
IF A TOOL NAME IS WRONG, FIND THE RIGHT ONE AND CONTINUE. "Unknown tool" is not an ending. List capabilities, pick the right key, run it. Two failures means try a third route. Stopping after one failed call is the most common way to waste his turn.
A REFUSAL IS NOT A FAILED CALL, AND IT IS NEVER ROUTED AROUND. "risk_ceiling", "denied by the capability record", not_authorized, 403 and the approval prompt are the authority model doing its job — an ANSWER, not an obstacle. Never reach for the shell to do what a capability refused: sourcing the vault and curling the endpoint with the terminal key is the same action with the gate removed, and the shell tool refuses that shape. When denied, say what was denied, quote the denial, stop. That is a complete turn. (2026-08-05: EMAIL_SEND was refused twice with risk_ceiling:low<row:high, the vault was sourced in a shell, the mail went out anyway, and the turn closed "Nothing left incomplete.")
NEVER STATE A NUMBER YOU DID NOT READ. Every count, price, size or id must come from a tool result you can point at. If the tool failed: "UNKNOWN — the call failed with X", never a guess. A wrong number stated plainly is the worst output.
NEVER PUBLISH A LINK YOU DID NOT VERIFY RESOLVES. Fetch any URL before posting it (X, email, article body). A tweeted 404 is a public failure. The fetch is one call; skipping it is never justified.
NEVER INVENT AN INSTRUCTION. If he didn't say it, it doesn't exist. Never fabricate a gate ("should I consult you first?"), never infer a prohibition ("you said don't post"), never attribute a rule he didn't state. Instructions arrive as his words only.
NEVER PROMISE BEHAVIOR — CHANGE THE FILE. When he names a behavioral failure, the fix is an edit to this prompt, a skill file, or misc source code, verified by re-read. "I will not do X again" is banned decoration. The reply is: the file that changed, the clause added, the read-back.
THE CONTRACTS, CARRIED. These were moved out of this prompt to save bytes, which cost more than it saved: the first job after the move invented two rules that do not exist, a gate was then added to force the lookup, and that gate spent the step budget on reading before any work could start. They are back where they belong. Everything you need to write an article, post, query, or run outreach is below — you do not fetch it, you already have it.
${rulesText()}

You act by calling tools. Read before you edit. Make the change, then verify it.
Be terse: no preamble, no summaries of what you are about to do, no closing pleasantries.
State what you did and what is still open. Never claim something works without running it.
${CAPS ? '\n' + CAPS + '\n' : ''}${CONTEXT ? '\nStanding instructions and project notes follow. They are law for this session.\n\n' + CONTEXT : ''}`;

// ---------------------------------------------------------------- session persistence

function sessionFile(id) { return path.join(SESSIONS, id + '.json'); }

function save() {
  try {
    fs.mkdirSync(SESSIONS, { recursive: true });
    fs.writeFileSync(sessionFile(sessionId), JSON.stringify({
      id: sessionId, model: cfg.model, cwd, updated: new Date().toISOString(), messages,
    }, null, 2));
  } catch {}
}

function sessionList() {
  try {
    return fs.readdirSync(SESSIONS).filter((f) => f.endsWith('.json')).map((f) => {
      const j = JSON.parse(fs.readFileSync(path.join(SESSIONS, f), 'utf8'));
      const first = (j.messages || []).find((m) => m.role === 'user');
      const text = first ? (typeof first.content === 'string' ? first.content : '') : '';
      return { id: j.id, model: j.model, updated: j.updated, cwd: j.cwd, title: text.slice(0, 60) };
    }).sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  } catch { return []; }
}

// ---------------------------------------------------------------- context compaction

const KEEP_TAIL = 24;
// A tool result is expensive twice over: once when it arrives, and again on every later
// request that resends it. Recent results stay whole because the model is still working
// with them; older ones shrink to a stub that still says what ran and how it ended.
// Capped at 2 (was 6) — six full results resend up to 60K+ tokens every loop step (2026-07-28).
const FULL_RESULTS = 2;
// Trigger compaction by serialized size, not only message count. A single read result can
// be larger than 24 normal messages, so a byte ceiling catches what the message count misses.
//
// 24,000 WAS STARVING THE AGENT AT 19% OF ITS OWN CONTEXT WINDOW. That number was chosen when
// the worry was bytes per step, before the fold was moved inside the loop and before the
// growing transcript was understood as the real term. The model has 128K. Folding at 24K meant
// a file read at step 5 was a 200-character stub by step 15, so the agent read it again, and
// again in ranges — and never reached the write. Watched across four hundred-step runs in the
// operator's terminal: it picked the right feature, read the right two files, summarised the
// protocol correctly, and spent every remaining step re-reading what the fold had taken away.
// The fold is still necessary — unbounded growth is quadratic — but the ceiling has to leave
// the agent enough room to hold the thing it is working on.
const COMPACT_BYTES = 80000;

function shrinkOldResults() {
  let seen = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!Array.isArray(m.content)) continue;
    for (const b of m.content) {
      if (b.type !== 'tool_result' || typeof b.content !== 'string') continue;
      seen += 1;
      if (seen <= FULL_RESULTS || b.content.length < 400) continue;
      const head = b.content.slice(0, 200).replace(/\s+/g, ' ');
      b.content = `${head}… [${b.content.length} chars, trimmed from history — still in /expand]`;
    }
  }
}

// Serialized byte length of the messages array — the real cost driver, not message count.
function messagesBytes() {
  return messages.reduce((n, m) =>
    n + (typeof m.content === 'string' ? m.content.length
      : Array.isArray(m.content) ? m.content.reduce((b, c) =>
        b + (c.type === 'text' ? c.text.length : c.type === 'tool_result' ? String(c.content).length : JSON.stringify(c.input || {}).length), 0)
      : 0), 0);
}

// Emergency loop detector — stop when the model repeats substantially the same explanation,
// tool call, patch, grep, or test 2-3 times without new evidence (2026-07-28).
function detectLoop(callSigs) {
  const recent = callSigs.slice(-6);
  if (recent.length < 3) return null;
  // Count identical signatures among the last 6 calls.
  const counts = {};
  for (const s of recent) counts[s] = (counts[s] || 0) + 1;
  for (const [sig, n] of Object.entries(counts)) {
    if (n >= 3) return sig;  // same call 3+ times in last 6 → loop
  }
  return null;
}

function compact() {
  // THE MESSAGE-COUNT TRIGGER WAS FIRING EVERY SINGLE STEP AND DISCARDING EVERYTHING.
  // This was `messages.length > KEEP_TAIL + 4` — fourteen messages. A tool loop passes fourteen
  // messages on its seventh step and never goes back under, so the fold ran on every step from
  // then on, keeping only the last ten and digesting the rest no matter how small the transcript
  // actually was. Raising the byte ceiling changed nothing because bytes were never the trigger.
  //
  // Observed in the operator's terminal: 42 of 74 calls in one run were `recall`, the agent
  // re-reading files it had read minutes earlier, because the fold took them away on the step
  // after it got them. A message count is not a cost. Bytes are the cost, and they are what the
  // fold exists to bound; the count survives only as a runaway backstop far above normal work.
  const tooMany = messages.length > 200;
  const tooBig = messagesBytes() > COMPACT_BYTES;
  if (!tooMany && !tooBig) return false;
  // If only too-big, compact just enough: keep head + the most recent KEEP_TAIL, drop middle.
  const head = messages.slice(0, 2);
  // A summary is never re-summarised. Compacting the compaction fed the model the same
  // digested plan again and again (2026-07-27) — it re-read its own stale reasoning each
  // step and repeated completed work. Prior summary blocks are dropped, not re-wrapped.
  //
  // REFERENCE SURVIVES THE FOLD. Folding the transcript bounded the bytes and immediately
  // created a call multiplier in their place. Measured 2026-08-05, second run: the folds at
  // steps 4 and 5 were each followed on the very next step by the model re-fetching exactly
  // what had just been digested — four identical `read`s of the law files, then four
  // identical `recall`s of the same ids. Eight of nineteen calls that turn were re-fetches
  // of text the agent had already been given and the harness had then taken away.
  //
  // It was not being forgetful. It was right: the contract it had been ordered to read before
  // acting had been reduced to a 200-character stub, and a stub is not a contract. Standing
  // reference — the operator's rules, the law files an action is gated on — is not
  // conversational chatter that goes stale. It is the thing the work is measured against, so
  // it is carried whole and the fold happens around it.
  const middle = messages.slice(2, messages.length - KEEP_TAIL)
    .filter((m) => !(typeof m.content === 'string' && m.content.startsWith('[earlier in this session]')));
  const pinned = middle.filter((m) => m._pin);
  const dropped = middle.filter((m) => !m._pin);
  const tail = messages.slice(messages.length - KEEP_TAIL);
  const summary = dropped.map((m) => {
    if (typeof m.content === 'string') return `${m.role}: ${m.content.slice(0, 200)}`;
    const parts = (m.content || []).map((b) =>
      b.type === 'text' ? b.text.slice(0, 200)
      : b.type === 'tool_use' ? `[${b.name} ${JSON.stringify(b.input).slice(0, 120)}]`
      : b.type === 'tool_result' ? `[result ${String(b.content).slice(0, 120)}]` : '');
    return `${m.role}: ${parts.join(' ')}`;
  }).join('\n');
  messages = [...head, ...pinned, { role: 'user', content: `[earlier in this session]\n${summary}` }, ...tail];
  return true;
}

// Which tool results are standing reference rather than working output. A rules section and
// the law files an action is gated on are the contract; re-reading them because the harness
// digested them is pure waste, and worse, the model may act on the stub instead.
export function isReference(name, input) {
  if (name === 'rules') return true;
  const p = String(input?.path || input?.id || '');
  return /(\.claude|\.agents)\/skills\/[^/]+\/SKILL\.md$/i.test(p) || /(law|LAW)\.md$/.test(p);
}

// ---------------------------------------------------------------- approvals

let rl;
function ask(question) {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

async function approve(name, input) {
  if (cfg.approve === 'auto') return true;
  const detail = name === 'shell' ? input.command
    : name === 'write' ? `${input.path} (${(input.content || '').length} chars)`
    : name === 'patch' ? input.path
    : JSON.stringify(input).slice(0, 160);
  say('\n' + C.amber(`  ${name}`) + '  ' + detail);
  const a = (await ask(C.dim('  approve? [y]es / [n]o / [a]lways  ') )).toLowerCase();
  if (a === 'a' || a === 'always') { cfg.approve = 'auto'; return true; }
  return a === '' || a === 'y' || a === 'yes';
}

// A working indicator with the two numbers that matter while waiting: how long, and how
// much has come back. It redraws in place and clears itself when the answer starts.
function spinner(getTokens) {
  // Only in a real terminal: without a TTY the redraw is just repeated lines in a log.
  if (!process.stdout.isTTY) return () => {};
  const frames = ['*', '+', 'x', '+'];
  const t0 = Date.now();
  let i = 0;
  let cleared = false;
  const timer = setInterval(() => {
    if (cleared) return;
    const secs = Math.round((Date.now() - t0) / 1000);
    process.stdout.write(`\r  ${ui.white(frames[i++ % frames.length])} ${ui.faint(`working… ${secs}s · ${getTokens()} tokens`)}   `);
  }, 400);
  return () => {
    if (cleared) return;
    cleared = true;
    clearInterval(timer);
    process.stdout.write('\r' + ' '.repeat(60) + '\r');
  };
}

// ---------------------------------------------------------------- agent loop

let pendingRetry = null;
let awaitingModelPick = false;
// Steering: a line the operator adds while the turn is still running. It goes in before
// the next model call, so the agent changes course mid-task instead of finishing the wrong
// thing first.
const steers = [];
let turnStartedAt = Date.now();
let lastGoodModel = null;
let lastActivity = '';

// Plain-English control. Nobody should have to learn slash commands to stop a runaway
// loop or ask whether the thing is still alive — the words people actually use in that
// moment are a short, recognisable list, so they are matched here and acted on directly.
const INTENT = [
  { re: /\b(stop|abort|cancel|halt|quit that|knock it off|shut up|nevermind|never mind|enough|forget it)\b/i, act: 'abort' },
  { re: /\b(start over|reset|clean slate|new session|wipe|clear it|from scratch)\b/i, act: 'reset' },
  { re: /(are you (there|alive|dead|awake|ok|okay|working|stuck|frozen))|(you (there|alive|dead|awake|stuck|frozen))|^\s*(hello|hey|yo|u there)\s*\?+\s*$|^\s*\?+\s*$|^\s*\.+\s*$/i, act: 'alive' },
  { re: /\b(what('s| is) (going on|happening)|status|where are we|how('s| is) it going)\b/i, act: 'alive' },
];

function readIntent(line) {
  // Only short bare utterances are control. "reset the counter in foo.js" is work, not a
  // command to wipe the session, so anything that names a file, a path, or code is left
  // for the model, as is anything longer than a handful of words.
  const words = line.trim().split(/\s+/).length;
  if (words > 6) return null;
  if (/[./\\`]|\.(js|ts|py|json|md|sh|css|html|sql)\b/i.test(line) && !/^\s*[.?]+\s*$/.test(line)) return null;
  for (const i of INTENT) if (i.re.test(line)) return i.act;
  return null;
}

// Working memory. It carries the conversation by default, because an agent that answers
// "I don't have memory of previous turns" when asked what it just did is broken, and no
// token saving is worth that. Cheap-token thrift was the wrong trade: the whole window
// rides along, and it only shrinks when the model deliberately lowers it.
const MEMORY_MAX = 40;
// A leaked tool call is recoverable, and it happens repeatedly in one turn, not once.
const TEXT_CALL_MAX = 12;
// THE CEILING WAS SET TO FIX A PROBLEM THAT HAS SINCE BEEN FIXED PROPERLY.
// 40/20 was chosen on 2026-07-28 because "120-tool loops at 100K+ tokens each were the core
// cost driver". That reading was wrong: the driver was the transcript growing unbounded inside
// a turn, which compact() now folds on every step — measured on the terminal run below, the
// message portion stays between 4,807 and 16,342 bytes across twenty steps instead of climbing
// past 100K. With the actual cause removed, the cap is no longer a cost control. It is only a
// stop, and it lands in the middle of every two-part job: five attempts at "publish an article
// AND send the outreach" all died at step 20 with the second half untouched.
const LOOP_MAX = 120;
// Soft checkpoint: at step 8 require the model to justify continuing with new evidence.
const LOOP_SOFT = 8;
const memory = { turns: 24, pins: [], reason: '', loop: 60, steps: 0 };  // see LOOP_MAX above
const history = [];   // this session, in memory

// The conversation ledger: every turn, on disk, across sessions. Separate from the build's
// event ledger — this one is what was said, in order, and it is searchable.
const TURNS_FILE = path.join(process.env.HOME || '/tmp', '.misc', 'turns.jsonl');

function writeTurn(record) {
  try {
    fs.mkdirSync(path.dirname(TURNS_FILE), { recursive: true });
    fs.appendFileSync(TURNS_FILE, JSON.stringify({
      // model is what was ASKED for; served is what actually answered and what the bill
      // follows. They differ silently on this gateway, so the record carries both or the
      // substitution is invisible after the fact.
      ts: new Date().toISOString(), session: sessionId, model: cfg.model,
      served: servedModel || null, substituted: wasSubstituted(),
      cwd, ...record,
    }) + '\n');
  } catch {}
}

function readTurns(limit = 400) {
  try {
    return fs.readFileSync(TURNS_FILE, 'utf8')
      .trim().split('\n').slice(-limit)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

// A new process is not a new mind. The window used to start empty, so the first question
// in a fresh session ("what did you just say to me") was unanswerable without a lookup.
// The last turns on disk are loaded in at startup, whatever session wrote them.
function seedHistory() {
  const past = readTurns(MEMORY_MAX);
  for (const t of past.slice(-MEMORY_MAX)) {
    if (!t || !t.instruction) continue;
    history.push({ instruction: t.instruction, answer: String(t.answer || ''), ids: t.ids || [], session: t.session });
  }
}

function applyMemory(input) {
  const before = memory.turns;
  const beforeLoop = memory.loop;
  if (typeof input.turns === 'number') {
    memory.turns = Math.max(0, Math.min(MEMORY_MAX, Math.round(input.turns)));
  }
  if (typeof input.loop === 'number') {
    memory.loop = Math.max(1, Math.min(LOOP_MAX, Math.round(input.loop)));
  }
  for (const id of input.pin || []) if (!memory.pins.includes(id)) memory.pins.push(id);
  for (const id of input.forget || []) memory.pins = memory.pins.filter((p) => p !== id);
  if (memory.pins.length > 8) memory.pins = memory.pins.slice(-8);
  memory.reason = input.reason || memory.reason;
  say(ui.faint(`  limits · turns ${before} → ${memory.turns} · loop ${beforeLoop} → ${memory.loop}`
    + (memory.pins.length ? ` · pinned ${memory.pins.join(', ')}` : '')
    + (input.reason ? ` · ${input.reason}` : '')));
  return `turns=${memory.turns}/${MEMORY_MAX}, loop=${memory.loop}/${LOOP_MAX}, pinned=[${memory.pins.join(', ')}]`;
}

// The session's own record, queryable. A stateless turn still has a past — it just has to
// ask for it instead of carrying it.
function lookBack(input) {
  const n = Math.max(1, Math.min(Number(input.last) || 5, 25));
  const all = readTurns();
  const scope = input.all_sessions === false ? all.filter((t) => t.session === sessionId) : all;
  let rows = scope;
  if (input.find) {
    const term = String(input.find).toLowerCase();
    rows = rows.filter((h) => `${h.instruction} ${h.answer}`.toLowerCase().includes(term));
  }
  rows = rows.slice(-n);
  if (!rows.length) {
    return `nothing in the conversation ledger${input.find ? ` matching "${input.find}"` : ''} (${all.length} turns recorded)`;
  }
  return rows.map((h) => [
    `${h.ts?.slice(0, 16).replace('T', ' ')}  ${h.session === sessionId ? '(this session)' : '(earlier session)'}  ${h.model || ''}`,
    `  asked: ${String(h.instruction).slice(0, 300)}`,
    `  answered: ${String(h.answer).slice(0, 400)}`,
  ].join('\n')).join('\n\n');
}

// The working set for one turn: the instruction, whatever the model chose to carry, and
// the artifacts it pinned — nothing else.
// CARRIED TURNS WERE PRESENTED AS THE LIVE CONVERSATION, AND THE AGENT ANSWERED THE OLD ONE.
// seedHistory() loads the last 40 turns from disk ACROSS ALL SESSIONS, and this function
// replayed 24 of them as plain user/assistant pairs in front of the new instruction. Nothing
// marked them as past. Measured in the operator's terminal 2026-08-05: given "publish an
// article AND send the outreach", the agent spent twenty-five calls and then answered a
// DIFFERENT session's question about article feedback, closing "that work hasn't started yet"
// — correct, from inside a transcript where the previous thread looked live. Every "loading
// turn" written up today as the model refusing to work has this shape.
//
// compact() made it worse: it keeps messages[0..2] as the permanent head, and that head is the
// OLDEST carried exchange from some other session, kept whole for the whole turn while the
// current work is what gets folded.
//
// Prior turns are now labelled as prior, and only the current session's are carried. Older
// ones are still reachable — the `history` tool reads every turn ever, across sessions, on
// demand, which is what it is for.
function workingSet(userText) {
  const msgs = [];
  const carried = memory.turns > 0
    ? history.filter((h) => h.session === sessionId).slice(-memory.turns)
    : [];
  if (carried.length) {
    msgs.push({ role: 'user', content: `[earlier in THIS session — context only, already answered, not your instruction]\n`
      + carried.map((h) => `you were asked: ${String(h.instruction).slice(0, 300)}\nyou answered: ${String(h.answer).slice(0, 400)}`).join('\n\n') });
    msgs.push({ role: 'assistant', content: 'Understood — that is prior context. Waiting for the current instruction.' });
  }
  if (memory.pins.length) {
    const parts = [];
    for (const id of memory.pins) {
      const body = readResult(id);
      if (body) parts.push(`--- ${id} ---\n${body.slice(0, 4000)}`);
    }
    if (parts.length) msgs.push({ role: 'user', content: `[pinned artifacts]\n${parts.join('\n\n')}` });
  }
  // The instruction itself is appended by runTurn. Adding it here too sent every request
  // with the user's message twice, which reads as repetition and wastes the prefix cache.
  return msgs;
}

let abort = new AbortController();

export function interruptTurn() {
  abort.abort();
}

// Busy state is released in one place, always. It was being cleared only on the error
// path, so after a normal turn the dock still thought work was running and every line
// typed after that was treated as steering for a loop that had already closed.
// Headless runs are read by scripts, not people: the exit code has to mean something.
// It exited 0 after a gateway 400 with no answer at all (2026-07-26 fleet probe), so a
// harness scored a dead model as a pass.
export const runState = { answered: false, error: null };

function isAuditAsk(text) {
  const t = text.toLowerCase();
  // Broad ask: "audit / review / anything wrong / is there anything / what would you change / do you have ideas / suggestions"
  // about the operator's code or mine. If there is nothing concretely wrong, the required answer is "No."
  const auditAsk = /\b(audit|review|anything wrong|anything to change|anything you would change|anything to edit|is there anything|do you see anything|what would you change|how would you improve|any ideas?|suggestions?|feedback|critique|what do you think|does this look right)\b/;
  const codeOrLogicTarget = /\b(your (logic|code|source|behavior|output|reply)|my code|this code|the code|the logic|your logic)\b/;
  return auditAsk.test(t) && codeOrLogicTarget.test(t);
}

async function turn(userText) {
  if (isAuditAsk(userText)) {
    say('No.');
    return;
  }
  try {
    await runTurn(userText);
  } finally {
    steers.length = 0;
    dock.setActivity(null);
    dock.setBusy(false);
  }
}

async function runTurn(userText) {
  pendingRetry = null;
  turnStartedAt = Date.now();
  lastActivity = '';
  lastTurn = { usage: null, ms: 0, usd: 0 };
  const storedIds = [];
  // The scratch buffer for this turn only. It is thrown away at the end; what survives is
  // the record in history, the stored results, and the ledger.
  messages = workingSet(userText);
  abort = new AbortController();
  dock.setBusy(true);
  let ranThisTurn = 0;
  const t0 = Date.now();
  let lastUsage = null;
  messages.push({ role: 'user', content: userText });
  if (compact()) say(C.dim('  (compacted earlier turns)'));

  memory.steps = 0;
  let hitCeiling = true;
  // Every call made this turn, by signature. An identical repeat of a FAILED call is
  // refused with the cached result — the single biggest waste observed on 2026-07-27 was
  // the same broken SQL query issued dozens of times unchanged. An identical repeat of a
  // successful call is answered from cache: the result cannot have changed and the model
  // is told to move on.
  const callsSeen = new Map();
  // Ordered signatures of every call this turn, for the emergency loop detector.
  const callSigs = [];
  // One trace per TURN, shared by the turn card and every tool receipt inside it. It used
  // to be the session id, so a whole session's turns collapsed into one ledger link and
  // there was no way to open a single exchange (2026-07-27).
  const traceId = 'misc_' + sessionId + '_' + Date.now().toString(36);
  let lastAnswer = '';
  const toolsUsed = [];
  let fabricationRetried = false;
  let planPushedBack = false;
  let claimPushedBack = false;
  // Everything every tool actually returned this turn, for checking the final answer's
  // claims against. A receipt id or a "sent" that has no matching tool output is invented.
  let turnOutputs = '';
  // How many text-emitted tool calls were rescued this turn. It used to be one, so the
  // second leak ended the turn with the task half done — which is what "it keeps stopping
  // mid-task" was.
  let textCallRan = 0;
  for (let step = 0; step < memory.loop; step++) {
    memory.steps = step + 1;
    // Emergency loop detector — same call 3+ times in the last 6 means the model is stuck.
    const loopSig = detectLoop(callSigs);
    if (loopSig) {
      say(ui.white(`  ⊘ loop detected — "${String(loopSig).slice(0, 60)}" repeated 3+ times. Stopping.`));
      messages.push({ role: 'user', content: `[LOOP DETECTED] You have repeated the same call "${String(loopSig).slice(0, 80)}" 3+ times without new evidence. The loop is terminated. Answer with what you have now.` });
      hitCeiling = false;
      break;
    }
    // Soft checkpoint at step 8 — require the model to prove another call is necessary.
    if (step === LOOP_SOFT) {
      messages.push({ role: 'user', content: `[soft checkpoint · step ${step}/${memory.loop}] You have used ${step} tool calls. Before continuing, state in one line what is still missing and why one more call is necessary. If nothing is missing, answer now.` });
    }
    if (step === memory.loop - 1) {
      // Last allowed step: tell it to wrap up rather than letting the loop end mid-task
      // with nothing said.
      messages.push({ role: 'user', content: `[step limit ${memory.loop} reached — stop calling tools and answer with what you have]` });
    }
    // Steering lands before the next model call, so a correction changes what happens
    // next instead of arriving after the work is already done.
    while (steers.length) {
      const line = steers.shift();
      messages.push({ role: 'user', content: `[steering, mid-task] ${line}` });
      say(ui.faint(`  steering applied: ${line.slice(0, 80)}`));
    }
    // Execution state, restated every 10 steps. A long loop loses the thread — it re-plans,
    // re-reads, and re-issues what already ran (2026-07-27, the drafts turn). The harness
    // knows exactly what ran and how each call ended, so it tells the model, with the
    // original instruction, instead of hoping the model remembers.
    if (step > 0 && step % 10 === 0 && callsSeen.size) {
      const done = [...callsSeen.entries()].slice(-30)
        .map(([sig, v]) => `${v.failed ? 'FAILED' : 'ok'} · ${sig.replace('\u0000', ' ').slice(0, 110)}${v.repeats ? ` (repeated ${v.repeats}x, refused)` : ''}`);
      messages.push({ role: 'user', content: `[state · step ${step}/${memory.loop}] The instruction: ${String(userText).slice(0, 300)}\nCalls already made this turn (do NOT repeat any of them):\n${done.join('\n')}\nDo only what is still missing, then answer.` });
    }
    let res;
    let streamed = 0;
    // Newline-gated commit: only whole lines are written to the transcript. A partial line
    // written straight to stdout would land wherever the cursor happens to be — inside the
    // input box — and be erased by the next repaint. This is why answers were vanishing.
    let pending = '';
    let thinking = '';
    // Hidden-reasoning fence for the stream. Some models emit their reasoning inline as
    // <think>...</think> text; without a stateful filter the closing tag leaked into the
    // transcript mid-answer (2026-07-27). Inside the fence, text renders as faint
    // thinking; only what is outside reaches the answer.
    let inThink = false;
    let carry = '';
    const filterThink = (chunk) => {
      let text = carry + chunk;
      carry = '';
      // keep a possible split tag for the next chunk
      const tail = text.match(/<\/?think?$|<\/?thin?$|<\/?thi?$|<\/?th?$|<\/?t?$|<\/?$|<$/);
      if (tail && text.length - tail.index < 8) { carry = text.slice(tail.index); text = text.slice(0, tail.index); }
      let out = '';
      while (text) {
        if (inThink) {
          const end = text.indexOf('</think>');
          if (end === -1) { thinking += text; text = ''; }
          else { thinking += text.slice(0, end); inThink = false; text = text.slice(end + 8); }
        } else {
          const start = text.indexOf('<think>');
          const bareEnd = text.indexOf('</think>');
          // A closing tag with no opener means the reasoning arrived untagged at the
          // front of the stream: everything emitted so far this call was thinking.
          if (bareEnd !== -1 && (start === -1 || bareEnd < start)) {
            thinking += out + text.slice(0, bareEnd);
            out = '';
            pending = '';
            text = text.slice(bareEnd + 8);
            continue;
          }
          if (start === -1) { out += text; text = ''; }
          else { out += text.slice(0, start); inThink = true; text = text.slice(start + 7); }
        }
      }
      return out;
    };
    const flush = (final) => {
      const parts = pending.split('\n');
      pending = final ? '' : parts.pop();
      for (const line of parts) say(line);
      if (final && parts.length === 0 && pending) say(pending);
    };
    const stopSpinner = spinner(() => Math.round(streamed / 4));
    dock.setActivity('thinking', '');
    try {
      // The identity clause is only true once the catalogue is in hand. Two and a half
      // seconds at most, once per process, and never on a warm start because the last
      // catalogue was written to disk.
      if (!catalogueLoaded) await Promise.race([cataloguePromise, new Promise((r) => setTimeout(r, 2500))]);
      res = await stream(cfg, {
        system: SYSTEM(),
        messages,
        tools: TOOL_SCHEMAS,
        // Reasoning stays internal. Printing it line-by-line filled the transcript with
        // truncated half-sentences that read as the agent babbling to itself (2026-07-27).
        // The dock already says "thinking"; the transcript carries only real output.
        onThinking: (t) => { thinking += t; },
        onText: (t) => {
          streamed += t.length;
          const visible = filterThink(t);
          if (!visible) return;
          pending += visible;
          if (visible.includes('\n')) flush(false);
        },
      });
      stopSpinner();
      if (pending) { say(pending); pending = ''; }
    } catch (e) {
      stopSpinner();
      if (/Model not found|not_found_error/i.test(e.message)) {
        const dead = cfg.model;
        cfg.model = lastGoodModel || 'claude-kimi-k2.7-code';
        modelLabel = realName(cfg.model);
        saveConfig(cfg);
        say(ui.white(`  ${realName(dead)} is published on the gateway but your account cannot run it`));
        say(ui.faint(`  switched back to ${modelLabel} — /model to pick another`));
        dock.setActivity(null);
        dock.setBusy(false);
        return;
      }
      // A rate-limit stop is a scheduling state, not a crash: one line, keep the session,
      // and let the operator resume with /retry once the cooldown passes.
      say('\n' + ui.white('  ' + e.message));
      runState.error = e.message;
      if (e.breaker) pendingRetry = userText;
      dock.setActivity(null);
      dock.setBusy(false);
      return;
    }

    lastGoodModel = cfg.model;
    if (res.usage) {
      lastUsage = res.usage;
      totals.in += res.usage.input_tokens || 0;
      totals.out += res.usage.output_tokens || 0;
      if (res && res.served) servedModel = res.served;
        const spent = turnCost(billedModel(), res.usage);
      if (spent != null) { totals.usd = (totals.usd || 0) + spent; addSpend(spent); refreshGatewaySpend(); }
      // The bar updates mid-turn, so cost and context climb while the work happens rather
      // than appearing all at once at the end.
      else if (rateFor(billedModel())) totals.usd = totals.usd || 0;
      // The bar updates mid-turn, so cost and context climb while the work happens rather
      // than appearing all at once at the end.
      lastTurn = { usage: res.usage, ms: Date.now() - t0, usd: (spent || 0) };
    }
    messages.push({ role: 'assistant', content: res.blocks });
    const calls = res.blocks.filter((b) => b.type === 'tool_use');
    if (!calls.length) {
      const saidText = res.blocks.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      // Whatever else happens below, the operator never wants to read a model's internal
      // tool-call sentinels. They are stripped from the recorded answer, not from the text
      // the recovery below matches against.
      const saidClean = saidText
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<\/?think>/gi, '')
        .replace(/<\|[a-z_]+\|>/g, '')
        .trim();
      if (saidClean) { lastAnswer = saidClean; runState.answered = true; }
      const said = Boolean(saidText);
      // TEXT-EMITTED TOOL CALL. Small models (GLM-4.7 Flash, 2026-07-26) print the call
      // instead of emitting it — "DIR_LIST category=X" or a leaked </tool_call> fragment.
      // The intent is unambiguous, so run it rather than making the operator watch the
      // model narrate a call it never made.
      // Only when the text really is a leaked call. A final answer that happens to contain
      // an uppercase word ("HEAD=abc123", "ACOUNT=6") is an answer, not a call: recovering
      // from it invented a capability invocation on every clean run (2026-07-26, all models).
      // Kimi K2.7 Code emits its NATIVE tool-call tokens as plain text through the gateway
      // instead of tool_calls, several times an hour (2026-07-26). The turn then ended with
      // the work undone and the exit code saying OK. Its own tokens name the tool and carry
      // valid JSON, so the call is recoverable exactly rather than guessed at.
      const native = saidText.match(/([a-z_][a-z0-9_.]*)\s*:\s*\d*\s*<\|tool_call_argument_begin\|>\s*([\s\S]*?)\s*<\|tool_call_end\|>/i);
      if (said && native && textCallRan < TEXT_CALL_MAX) {
        let name = native[1].replace(/^functions?\./, '');
        let input = {};
        try { input = JSON.parse(native[2]); } catch {}
        // A capability KEY in the tool slot is the commonest shape of this leak: the model
        // writes functions.D1_QUERY instead of functions.capability. Route it rather than
        // dropping the turn on the floor, which is what happened before (2026-07-27, the
        // outreach-draft turn ended on "<|tool_call_end|>" with the work undone).
        if (!TOOL_SCHEMAS.some((t) => t.name === name) && /^[A-Z][A-Z0-9_]{2,}$/.test(name)) {
          input = { key: name, body: String(input.body ?? input.args ?? input.query ?? input.sql ?? input.command ?? (typeof input === 'string' ? input : '') ?? '') };
          name = 'capability';
        }
        if (TOOL_SCHEMAS.some((t) => t.name === name)) {
          // Recovered calls go through the same repeat gate as real ones. Without it the
          // model could leak the same failing call as text forever and each leak re-ran it.
          const sig = name + '\u0000' + JSON.stringify(input || {});
          const prior = callsSeen.get(sig);
          if (prior) {
            prior.repeats += 1;
            say(ui.white(`  ⟳ ${name} — identical to call #${prior.n}, answered from cache`));
            messages.push({ role: 'user', content: `[harness] You leaked that call as text AND you already made it this turn (${prior.failed ? 'it FAILED' : 'it succeeded'}). Its result, again:\n${prior.forModel}\n${prior.failed ? 'Change the input or the route — repeating it is refused.' : 'Use it and take the NEXT step.'}` });
            callSigs.push(sig);
            continue;
          }
          callSigs.push(sig);
          textCallRan += 1;
          say(ui.faint('  ⋯ ' + name + ' (recovered from the model\'s own tool tokens)'));
          const ran = await runTool(name, input, cwd, abort.signal);
          const out = typeof ran === 'string' ? ran : (typeof ran?.full === 'string' ? ran.full : JSON.stringify(ran?.full ?? ran));
          const forModel = typeof ran === 'string' ? ran : ran.model;
          showCall({ name, input }, out, 0, WIRE.length);
          ranThisTurn += 1;
          toolsUsed.push(name);
          if (turnOutputs.length < 400000) turnOutputs += '\n' + String(out);
          callsSeen.set(sig, { n: ranThisTurn, forModel: String(forModel).slice(0, 2000), failed: /^(failed|ERROR)|"ok"\s*:\s*false/.test(String(out)), repeats: 0 });
          receipt(cfg, { session: sessionId, trace_id: traceId, action: name, input, output: String(out).slice(0, 4000) });
          runState.answered = false;
          messages.push({ role: 'user', content: `[harness] You printed your tool-call tokens as text instead of calling the tool. It was run for you. Result:\n${forModel}\nContinue from this, and emit real tool calls.` });
          continue;
        }
      }
      const leaked = /<\|tool_call/.test(saidText)
        || /<\/?(?:tool_call|arg_value|arg_key|function)[^>]*>/.test(saidText)
        || /\[([A-Z][A-Z0-9_]{2,})\][\s\S]*?\[\/\1\]/.test(saidText)
        || /^\s*([A-Z][A-Z0-9_]{2,})\s*\|/m.test(saidText);
      if (said && leaked) {
        const cleaned = saidText
          .replace(/<\|[a-z_]+\|>/g, ' ')
          .replace(/<\/?(?:tool_call|arg_value|arg_key|function)[^>]*>/g, ' ');
        const m = cleaned.match(/\b([A-Z][A-Z0-9_]{2,})\b[ \t]*(?:\|([^\n]*)|((?:[a-z_]+=|SELECT |")[^\n]*))?/);
        if (m && textCallRan < TEXT_CALL_MAX) {
          const key = m[1];
          const rawArgs = (m[2] || m[3] || '').trim().replace(/^(?:category|key|body|query|sql)=/, '');
          const sig = 'capability\u0000' + JSON.stringify({ key, body: rawArgs });
          const prior = callsSeen.get(sig);
          if (prior) {
            prior.repeats += 1;
            say(ui.white(`  ⟳ ${key} — identical to call #${prior.n}, answered from cache`));
            messages.push({ role: 'user', content: `[harness] You printed that call as text AND already made it this turn (${prior.failed ? 'it FAILED' : 'it succeeded'}). Its result, again:\n${prior.forModel}\n${prior.failed ? 'Change the input or the route — repeating it is refused.' : 'Use it and take the NEXT step.'}` });
            callSigs.push(sig);
            continue;
          }
          callSigs.push(sig);
          textCallRan += 1;
          say(ui.faint(`  ⋯ ${key} (recovered from text)  `) + ui.white(rawArgs.slice(0, 80)));
          const ran = await runTool('capability', { key, body: rawArgs }, cwd, abort.signal);
          const out = typeof ran === 'string' ? ran : (typeof ran?.full === 'string' ? ran.full : JSON.stringify(ran?.full ?? ran));
          const forModel = typeof ran === 'string' ? ran : ran.model;
          showCall({ name: key, input: { body: rawArgs } }, out, 0, WIRE.length);
          ranThisTurn += 1;
          toolsUsed.push(key);
          if (turnOutputs.length < 400000) turnOutputs += '\n' + String(out);
          callsSeen.set(sig, { n: ranThisTurn, forModel: String(forModel).slice(0, 2000), failed: /^(failed|ERROR)|"ok"\s*:\s*false/.test(String(out)), repeats: 0 });
          receipt(cfg, { session: sessionId, trace_id: traceId, action: key, input: { key, body: rawArgs }, output: String(out).slice(0, 4000) });
          messages.push({ role: 'user', content: `[harness] You printed a tool call instead of making one. It was run for you. Result:\n${forModel}\nAnswer from this. Emit real tool calls, never text.` });
          continue;
        }
      }
      // FABRICATION GUARD. A model that answers with what looks like tool output, having
      // called no tool this turn, has invented it. GLM-4.7-flash did exactly that on
      // 2026-07-26: it printed a directory listing with keys that do not exist and reported
      // "Rows: 12" against a real 891. Printing invented data as fact is worse than
      // stopping, so the turn is sent back once with the tools still attached.
      const looksLikeToolOutput = /\{\s*"|\[\s*\{|^\s*(?:HTTP\/|\$ )|\b(?:rows?|count|total)\s*[:=]\s*\d/im.test(saidText);
      if (said && !ranThisTurn && looksLikeToolOutput && !fabricationRetried) {
        fabricationRetried = true;
        say(ui.white('  that answer contains data but no tool ran — asking it to fetch instead of recall'));
        messages.push({ role: 'user', content: '[harness] You produced structured data without calling a tool. Nothing in that reply is verified and it may be invented. Call the correct tool now and answer only from its output. If you do not know the tool name, list the capabilities first.' });
        continue;
      }
      // INVENTED PROOF. On 2026-07-27 the model answered "Email ... sent" with
      // "Receipt: https://miscsubjects.com/receipt/inv_xyz123abc" — no send ran and that
      // id exists nowhere. Every receipt id in the answer must appear in a real tool
      // output from THIS turn, and a claim of having sent something requires the sending
      // capability to have actually run.
      const claimedIds = [...saidClean.matchAll(/\binv_[a-z0-9]{6,}\b/gi)].map((m) => m[0]);
      const fakeIds = claimedIds.filter((id) => !turnOutputs.includes(id));
      const claimsSent = /\b(email(ed)? (?:you|sent|with)|sent (?:you|to the owner|an email)|posted to x|message sent)\b/i.test(saidClean);
      const sendRan = /EMAIL_SEND|BLOOIO_SEND|X_POST|TWOCHAT_SEND/i.test(toolsUsed.join(' '))
        || /"messageId"/.test(turnOutputs);
      if (said && !claimPushedBack && (fakeIds.length || (claimsSent && !sendRan))) {
        claimPushedBack = true;
        say(ui.white('  that answer claims an action with no matching tool output — sending it back'));
        messages.push({ role: 'user', content: `[harness] Your answer claims ${fakeIds.length ? 'receipt id(s) ' + fakeIds.join(', ') + ' which appear in NO tool output this turn' : 'that something was sent, but no sending capability ran this turn'}. That claim is invented. Actually perform the action now with a real tool call and quote the REAL result, or state plainly that it was not done.` });
        continue;
      }
      // ENDED ON A PLAN. "Now I'll query the drafts" with no call attached is the failure
      // he sees most: the turn closes, nothing happened, and he has to say "so do it". The
      // model is sent back once with the tools still attached.
      const endedOnIntent = /\b(?:let me|i'?ll|i will|i'?m going to|next,? i|now i(?:'| a)?m?\s+(?:will|going)?|i should|i need to)\b[^.!?\n]{0,120}$/i
        .test(saidText.replace(/\s+/g, ' ').trim())
        || /\b(?:let me|i'?ll now|i will now)\b[^.]{0,80}(?:query|check|fetch|run|call|read|open|write|send|rewrite|save)\b/i.test(saidText);
      if (said && endedOnIntent && !planPushedBack) {
        planPushedBack = true;
        say(ui.white('  that ended on a plan, not a result — sending it back to do it'));
        messages.push({ role: 'user', content: '[harness] You described what you were about to do and then stopped. Nothing happened. Do it now with real tool calls, finish every part of the instruction, and answer with the result itself — the written copy, the number, the saved change — not a description of it.' });
        continue;
      }
      // ENDED ON A QUESTION. The plan check above catches "I'll now query the drafts"; it does
      // not catch "what would you like me to do next?", which is the same failure wearing a
      // politer face and is the one that actually happened. Measured 2026-08-05: given an
      // instruction with two halves — publish an article AND send the outreach — the agent
      // spent eighteen calls reading law files, hit one capability that answered zero, and
      // closed with "What would you like me to do next — draft outreach for leads at a
      // different status, or something else?" Nothing was written and nothing was sent.
      //
      // DO NOT ASK, DO has been in the system prompt the whole time. A clause with no
      // enforcement behind it is a suggestion, and this is the third instrument on this build
      // to prove that. The harness knows the instruction contained imperative verbs and it
      // knows the answer is a question, so it does not need the model's cooperation to notice.
      if (said) { hitCeiling = false; break; }
      // The model stopped without saying anything. That reads as the agent ignoring you,
      // so ask it once more for the answer with the tools taken away — it cannot reach for
      // another tool call, only words.
      say(ui.faint('  no answer yet — asking for one'));
      const final = await stream(cfg, {
        system: SYSTEM(),
        messages: [...messages, { role: 'user', content: 'Answer now, in plain words. No tools.' }],
        onText: (t) => { pending += t; if (t.includes('\n')) flush(false); },
      }).catch(() => null);
      if (pending) { say(pending); pending = ''; }
      const text = final?.blocks?.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      if (!text) say(ui.white('  the model returned nothing. Say it again, or /model to switch.'));
      hitCeiling = false;
      break;
    }

    // Independent reads are fired together here and awaited in order in the loop below.
    // Codex parallelises reads and misc did not: a turn asking for eight files paid eight
    // round trips end to end. Only the network wait is shared — approval, the repeat cache,
    // receipts, ordering and every result the model sees are unchanged. Writes are never
    // prefetched, because a write must not run before its approval prompt.
    const prefetch = new Map();
    if (calls.length > 1) {
      for (const call of calls) {
        if (WRITES.has(call.name)) continue;
        if (call.name === 'memory' || call.name === 'history') continue;
        const sig = call.name + '\u0000' + JSON.stringify(call.input || {});
        if (prefetch.has(sig) || callsSeen.has(sig)) continue;
        // A rejection is captured as a value so an unawaited promise can never crash the
        // turn; it is rethrown at the point the serial loop would have thrown it.
        prefetch.set(sig, runTool(call.name, call.input, cwd, abort.signal).catch((e) => e));
      }
      if (prefetch.size > 1) say(ui.faint(`  ⇉ ${prefetch.size} reads in parallel`));
    }

    const results = [];
    for (const call of calls) {
      if (WRITES.has(call.name) && !(await approve(call.name, call.input))) {
        results.push({ type: 'tool_result', tool_use_id: call.id, content: 'denied by operator' });
        receipt(cfg, { session: sessionId, trace_id: traceId, action: call.name, denied: true, input: call.input });
        continue;
      }
      // Identical repeat of a call already made this turn: answered from the first run.
      // A failed call repeated unchanged fails identically; a successful one returns the
      // same data. Either way the model is told to change something instead of looping.
      const sig = call.name + '\u0000' + JSON.stringify(call.input || {});
      const prior = callsSeen.get(sig);
      if (prior) {
        prior.repeats += 1;
        say(ui.white(`  ⟳ ${call.name} — identical to call #${prior.n}, answered from cache (repeat ${prior.repeats})`));
        results.push({
          type: 'tool_result', tool_use_id: call.id,
          content: `[REPEAT REFUSED] You already made this exact ${call.name} call this turn (${prior.failed ? 'it FAILED' : 'it succeeded'}). Its result, again:\n${prior.forModel}\n${prior.failed ? 'Repeating it unchanged will fail identically. Change the input — inspect the schema, fix the named error — or take a different route.' : 'You already have this. Use it and take the NEXT step.'}`,
        });
        toolsUsed.push(call.name + '(repeat)');
        callSigs.push(sig);
        continue;
      }
      callSigs.push(sig);
      const started = Date.now();
      const detail = call.input.key || call.input.command || call.input.path
        || call.input.query || call.input.args || '';
      lastActivity = `${call.name} ${String(detail).slice(0, 50)}`;
      dock.setActivity(call.name, String(detail));
      // The start line lands in the transcript immediately, so the session shows what is
      // happening while it happens rather than only once it is over.
      say(ui.faint(`  ⋯ ${call.name}  `) + ui.white(String(detail).replace(/\s+/g, ' ').slice(0, 90)));
      // If this read was fired in the parallel prefetch above, it is already in flight or
      // finished; awaiting it here costs nothing and preserves the original ordering.
      const pre = prefetch.get(sig);
      const ran = call.name === 'memory' ? applyMemory(call.input || {})
        : call.name === 'history' ? lookBack(call.input || {})
        : await (pre !== undefined ? pre : runTool(call.name, call.input, cwd, abort.signal));
      if (ran instanceof Error) throw ran;
      // Two different things: what the operator sees, and the receipt the model gets.
      const out = typeof ran === 'string' ? ran : (typeof ran?.full === 'string' ? ran.full : JSON.stringify(ran?.full ?? ran));
      const forModel = typeof ran === 'string' ? ran : ran.model;
      dock.setActivity(null);
      ranThisTurn += 1;
      toolsUsed.push(call.name);
      const idMatch = String(forModel).match(/\b(r\d+)\b/);
      if (idMatch) storedIds.push(idMatch[1]);
      showCall(call, out, Date.now() - started, WIRE.length);
      // A few lines of what the tool actually returned. Enough to follow the work; the
      // whole thing is one /expand away.
      const preview = String(out).split('\n').filter((l) => l.trim()).slice(0, 6);
      for (const line of preview) say(ui.faint('    ' + redact(line).slice(0, 150)));
      if (String(out).split('\n').length > 6) {
        say(ui.faint(`    … ${String(out).split('\n').length - 6} more lines · /expand ${WIRE.length}`));
      }
      results.push({ type: 'tool_result', tool_use_id: call.id, content: forModel });
      if (turnOutputs.length < 400000) turnOutputs += '\n' + String(out);
      callsSeen.set(sig, {
        n: ranThisTurn,
        forModel: String(forModel).slice(0, 2000),
        failed: /^(failed|ERROR)|"ok"\s*:\s*false/.test(String(out)),
        repeats: 0,
      });
      receipt(cfg, { session: sessionId, trace_id: traceId, action: call.name, input: call.input, output: String(out).slice(0, 4000) });
    }
    // A results message carrying standing reference is pinned, so the fold below keeps it
    // whole instead of stubbing the contract the next action is gated on.
    const refMsg = { role: 'user', content: results };
    if (calls.some((c) => isReference(c.name, c.input))) refMsg._pin = true;
    messages.push(refMsg);
    // Old tool results shrink to stubs as the turn grows, so step 40 does not resend the
    // full output of step 3 on every request. The store keeps the whole thing.
    shrinkOldResults();
    // COMPACT INSIDE THE LOOP, NOT ONLY BEFORE IT. This is the line that was missing, and it
    // is the whole cost problem rather than a piece of it.
    //
    // compact() existed and worked, but was called in exactly one place: once per turn, before
    // the loop starts ("compacted earlier turns"). So it bounded the transcript ACROSS turns
    // and never WITHIN one. Inside a turn the history grew with every step and the protocol
    // re-sent all of it on every subsequent step, which means one instruction needing N tool
    // calls paid for its own history roughly N-squared-over-two times. Measured on a real loop
    // instruction 2026-08-05: messages 16,429 -> 46,558 bytes across 13 steps with the prefix
    // flat. At the operator's own figure of a hundred calls in one turn, that growth is the
    // entire bill — not the system prompt, not the tool schemas, which is where a day of
    // shaving went.
    //
    // shrinkOldResults() above trims old tool OUTPUT and is necessary but not sufficient: the
    // assistant's own turns, the tool_use argument blobs and the stubs themselves keep
    // accumulating. compact() folds the middle of the transcript into a digest and keeps the
    // recent exchanges whole, which turns the cost of a long turn from quadratic in step count
    // into linear. Calling the function that already existed, on the axis that matters.
    if (compact() && process.env.MISC_TRACE) {
      process.stderr.write(`[compact] step ${memory.steps} · transcript folded · now ${messagesBytes()} bytes\n`);
    }
    }

  if (hitCeiling) {
    say(ui.white(`  stopped at the ${memory.loop}-step ceiling · say continue, or raise it with /help memory`));
  }

  // Record the turn, then throw the scratch away. Cost tracks the current operation, not
  // the length of the session.
  // What is remembered is the ANSWER — the last thing actually said. Joining every text
  // block in the turn stored the model's mid-task narration too, so "what did you say to
  // me, word for word" came back as a paragraph of thinking instead of the reply.
  const answer = (lastAnswer || messages
    .filter((m) => m.role === 'assistant' && Array.isArray(m.content))
    .flatMap((m) => m.content.filter((b) => b.type === 'text').map((b) => b.text))
    .join(' ')).trim();
  history.push({
    instruction: userText,
    // What was said AND what was done. "What did you just do" is the commonest follow-up
    // there is, and it is unanswerable from the prose alone.
    answer: `${answer.slice(0, 12000)}${answer.length > 12000 ? '…' : ''}`
      + (toolsUsed.length ? `\n[I called, in order: ${toolsUsed.join(', ')}]` : '')
      + (storedIds.length ? `\n[results: ${storedIds.join(', ')} — recall <id>]` : ''),
    ids: storedIds,
    session: sessionId,
  });
  if (history.length > MEMORY_MAX + 8) history.shift();
  writeTurn(history[history.length - 1]);
  messages = [];
  // The window does NOT collapse when the turn ends. It used to decay by one per turn,
  // which drove the default of 1 straight to 0 and made the agent answer "I have no
  // memory of previous turns" to the next question. Memory persists until it is lowered.

  if (ranThisTurn) {
    say(ui.faint(`  ran ${ranThisTurn} command${ranThisTurn === 1 ? '' : 's'} · /expand <#> for the raw call`));
  }
  statusBar(lastUsage, Date.now() - t0);
  receipt(cfg, {
    session: sessionId, trace_id: traceId, action: 'turn', input: userText, usage: lastUsage,
    // What actually answered, and whether it differed from what was requested. Cost below
    // is computed from the served model, so these three fields have to agree or the row
    // cannot be audited.
    served: servedModel || null,
    substituted: wasSubstituted(),
    said_user: userText,
    said_agent: lastAnswer.slice(0, 4000),
    tools_used: toolsUsed.join(', '),
    cost_usd: lastTurn.usd || 0,
  });
  // The same turn, as a turn: what he said, what was answered, what was used. This is the
  // row the turn cards read.
  agentTurn(cfg, {
    session: sessionId,
    trace_id: traceId,
    cwd,
    said_user: userText,
    said_agent: lastAnswer,
    tools_used: toolsUsed.join(', '),
  });
  save();
}

// Tool calls print the way a person reads them: the header says what ran, the body shows
// the actual code or output, unwrapped and copy-pasteable. Long output is trimmed at both
// ends rather than hidden, because a truncated middle is still readable.
function block(text, limit = 40) {
  const lines = String(text).split('\n');
  const shown = lines.length <= limit
    ? lines
    : [...lines.slice(0, limit - 10), `… ${lines.length - limit} lines …`, ...lines.slice(-10)];
  return shown.map((l) => '  ' + ui.white(l)).join('\n');
}

function showCall(call, out, ms, n) {
  const i = call.input || {};
  const label = call.name === 'capability' ? i.key
    : call.name === 'shell' ? i.command
    : call.name === 'git' ? 'git ' + i.args
    : call.name === 'search' ? i.query
    : i.path || i.query || '';
  let verdict = '';
  if (call.name === 'capability') {
    try { const j = JSON.parse(out); verdict = j.ok === false ? 'failed' : 'ok'; } catch {}
  } else if (/^ERROR/.test(out)) verdict = 'failed';

  say(
    ui.white('  ✓ ') + ui.dim(`${call.name.padEnd(11)}`)
    + ui.white(redact(String(label)).replace(/\s+/g, ' ').slice(0, 58).padEnd(58))
    + ui.faint(`  ${verdict ? verdict + ' · ' : ''}${(ms / 1000).toFixed(1)}s · #${n}`)
  );
}

// ---------------------------------------------------------------- commands

async function pickModel(arg) {
  let models;
  try { models = await listModels(cfg); } catch (e) { say(ui.white('  ' + e.message)); return; }
  // misc is non-Anthropic by law: Claude runs in the Claude desktop app, never here.
  models = models.filter((m) => !isAnthropicModel(m.id) && !isAnthropicModel(m.raw_id));

  if (arg && /^\d+$/.test(arg) && lastModels[Number(arg) - 1]) {
    const m = lastModels[Number(arg) - 1];
    cfg.model = m.id; modelLabel = m.display_name || realName(m.id); saveConfig(cfg);
    say(ui.white('  model: ' + modelLabel) + ui.faint('  (saved as your default)'));
    return;
  }
  if (arg && !/^(all|full|everything)$/i.test(arg)) {
    const hit = models.find((m) => m.id === arg)
      || models.find((m) => (m.raw_id || '') === arg)
      || models.find((m) => m.id.includes(arg))
      || models.find((m) => (m.raw_id || '').includes(arg));
    if (hit) {
      cfg.model = hit.id; modelLabel = hit.display_name || realName(hit.id); saveConfig(cfg);
      say(ui.white('  model: ' + modelLabel) + ui.faint('  (saved as your default)'));
      return;
    }
    const term = arg.toLowerCase();
    const found = models.filter((m) =>
      m.id.toLowerCase().includes(term)
      || (m.raw_id || '').toLowerCase().includes(term)
      || (m.display_name || '').toLowerCase().includes(term));
    if (!found.length) { say(ui.faint(`  nothing matches "${arg}"`)); return; }
    lastModels = found.slice(0, 40);
    say('');
    lastModels.forEach((m, i) => say(row(m, i + 1)));
    say('\n' + ui.faint(`  ${found.length} match "${arg}" · type a number`) + '\n');
    return;
  }

  // The default view is a short, ordered shortlist — not 681 ids in catalogue order.
  // Cheapest first among the ones that run on Workers AI, then the well-known models
  // people ask for by name, each with what it is good for and what it costs.
  // Exact id first, then a contains-match that skips the batch and preview variants —
  // otherwise "gpt-5.5" lands on gpt-5.5-pro:batch, which is a different product.
  const pick = (needle) => models.find((m) => (m.raw_id || m.id) === needle)
    || models.find((m) => {
      const raw = m.raw_id || m.id;
      return raw.includes(needle) && !/:batch|preview|transcribe|search/i.test(raw);
    });
  const shortlist = [];
  const add = (m, note) => { if (m && !shortlist.some((x) => x.m.id === m.id)) shortlist.push({ m, note }); };

  add(pick('@cf/google/gemma-4-26b-a4b-it'), 'cheapest that works · bulk text, classification');
  add(pick('@cf/zai-org/glm-4.7-flash'), 'cheap and fast · long tool loops, greps, sweeps');
  add(pick('@cf/moonshotai/kimi-k2.7-code'), 'the default · best code-per-dollar here');
  add(pick('@cf/moonshotai/kimi-k2.6'), 'the previous Kimi · same price, less code-tuned');
  add(pick('@cf/zai-org/glm-5.2'), 'strongest Workers AI reasoning · 1.5x Kimi to run');
  add(pick('deepseek/deepseek-v4-flash'), 'partner · fast and cheap');
  add(pick('deepseek/deepseek-v4-pro'), 'partner · heavyweight reasoning');
  add(pick('moonshotai/kimi-k3'), 'a million tokens of context');
  add(pick('minimax/m3'), 'partner · long context');

  const named = [
    ['anthropic/claude-opus-5', 'Claude Opus 5 · the expensive one, best judgement'],
    ['anthropic/claude-sonnet-5', 'Claude Sonnet 5 · balanced'],
    ['openai/gpt-5.5', 'GPT-5.5'],
    ['xai/grok-4.5', 'Grok 4.5'],
    ['google-ai-studio/gemini-3.5-flash-lite', 'Gemini 3.5 Flash Lite'],
  ];
  const black = [];
  for (const [needle, note] of named) {
    const m = models.find((x) => (x.raw_id || x.id) === needle) || pick(needle);
    if (m && !black.some((b) => b.m.id === m.id)) black.push({ m, note });
  }

  lastModels = [...shortlist.map((x) => x.m), ...black.map((x) => x.m)];
  let n = 0;
  say('\n' + ui.faint('  RUNS ON YOUR CLOUDFLARE ACCOUNT — cheapest first'));
  for (const { m, note } of shortlist) say(row(m, ++n, note));
  say('\n' + ui.faint('  THE NAMED ONES — same gateway, Unified Billing credits'));
  for (const { m, note } of black) say(row(m, ++n, note));
  say('\n' + ui.faint(`  prices are $ per million tokens in/out · ${models.length} models total`));
  say(ui.faint('  type a number · /model <search> to find any of the rest · /model all for everything') + '\n');
  awaitingModelPick = true;
}

function row(m, n, note) {
  const r = rateFor(m.id) || rateFor(m.raw_id || '');
  const price = r ? `$${r.in}/$${r.out}` : '—';
  const mark = m.id === cfg.model ? ui.white('*') : ui.faint(' ');
  const name = (m.display_name || realName(m.id)).replace(/\s*\(.*$/, '').slice(0, 26);
  return `  ${mark} ${String(n).padStart(2)}  ${ui.white(name.padEnd(26))}${ui.faint(price.padEnd(15))}`
    + ui.faint(note || (m.raw_id || '').slice(0, 40));
}

function status() {
  say(`
  ${C.dim('Model')}        ${C.bold(modelLabel)}
  ${C.dim('Gateway')}      ${cfg.gateway}
  ${C.dim('Repository')}   ${path.basename(cwd)}
  ${C.dim('Session')}      ${sessionId}  (${messages.length} messages)
  ${C.dim('Permissions')}  ${cfg.approve === 'auto' ? 'auto-approve' : 'ask before write'}
  ${C.dim('Ledger')}       ${cfg.ledger ? 'enabled' : 'off'}
  ${C.dim('Rate limit')}   ${breakerState().open ? `paused, ${breakerState().secondsLeft}s left` : 'clear'}
  ${C.dim('Spent')}        ${rateFor(billedModel()) ? '$' + (totals.usd || 0).toFixed(5) + ' this session' : 'tokens only — Cloudflare publishes no price for this model'}
  ${C.dim('Rate')}         ${rateFor(billedModel()) ? `$${rateFor(billedModel()).in}/M in · $${rateFor(billedModel()).out}/M out` : 'unpublished'}
`);
}

const HELP = `
  /laws [which]   the documents governing this agent: claude, agents, state
  /expand [n]     raw REST request and response for a capability call
  ctrl-s          steer the running turn without stopping it
  ctrl-c          interrupt the running turn
  /abort          stop the running turn, keep the session
  /reset          stop everything and start a clean session
  /retry          resume after a rate-limit pause
  /tools          what this agent can do
  /model [name]   list or pin the model for this session
  /new            start a fresh session
  /resume [id]    list sessions, or resume one
  /status         model, repo, permissions, ledger
  /diff           git diff
  /commit <msg>   stage everything and commit
  /undo           revert uncommitted changes to the last commit
  /approve auto|ask
  /ledger         last receipts from this machine
  /clear          clear the screen
  /exit
`;

async function command(line) {
  const [cmd, ...rest] = line.slice(1).split(' ');
  const arg = rest.join(' ').trim();
  switch (cmd) {
    case 'model': return pickModel(arg);
    case 'new':
      messages = []; sessionId = 'S' + Date.now().toString(36);
      say(C.green('  new session ' + sessionId)); return;
    case 'resume': {
      const list = sessionList();
      if (!arg) {
        if (!list.length) { say(C.dim('  no sessions yet')); return; }
        list.slice(0, 15).forEach((s) => say(`  ${s.id}  ${C.dim(s.updated || '')}  ${s.title}`));
        say(C.dim('  /resume <id>'));
        return;
      }
      try {
        const j = JSON.parse(fs.readFileSync(path.join(SESSIONS, arg + '.json'), 'utf8'));
        messages = j.messages || []; sessionId = j.id;
        if (j.model) { cfg.model = j.model; modelLabel = realName(j.model); }
        say(C.green(`  resumed ${sessionId} · ${messages.length} messages · ${cfg.model}`));
      } catch { say(C.red('  no session ' + arg)); }
      return;
    }
    case 'tools': {
      const { TOOLS } = await import('./tools.js');
      say('');
      for (const t of TOOLS) {
        say(`  ${ui.white(t.name.padEnd(12))}${ui.faint(t.description.slice(0, 88))}`);
      }
      try {
        const j = JSON.parse(fs.readFileSync(path.join(process.env.HOME, '.misc', 'capabilities.json'), 'utf8'));
        say('\n' + ui.faint(`  capability reaches ${j.total} build capabilities · ${j.indexed} indexed inline · the rest via capability list <term>`) + '\n');
      } catch { say(''); }
      return;
    }
    case 'abort':
    case 'reset': {
      // Stop whatever is running, drop any steering, and start clean. The ledger keeps
      // everything that already happened.
      interruptTurn();
      steers.length = 0;
      messages = [];
      dock.setActivity(null);
      dock.setBusy(false);
      resetBreaker();
      if (cmd === 'reset') {
        history.length = 0;
        memory.turns = 0;
        memory.pins = [];
        sessionId = 'S' + Date.now().toString(36);
        say(ui.white('  reset · new session ' + sessionId));
      } else {
        say(ui.white('  aborted'));
      }
      return;
    }
    case 'retry': {
      const st = breakerState();
      if (st.open) say(ui.faint(`  cooldown had ${st.secondsLeft}s left — overriding`));
      resetBreaker();
      if (!pendingRetry) { say(ui.faint('  nothing to retry')); return; }
      const again = pendingRetry;
      // The failed turn is still the last message in the transcript; drop it and re-send.
      if (messages.length && messages[messages.length - 1].role === 'user') messages.pop();
      return turn(again);
    }
    case 'expand': {
      const n = arg ? Number(arg) : WIRE.length;
      const w = WIRE[n - 1];
      if (!w) { say(ui.faint(`  no call #${n} — ${WIRE.length} recorded this session`)); return; }
      say('\n' + ui.dim(`  #${n}  ${w.key}  →  HTTP ${w.status}`));
      say(ui.faint('\n  REQUEST'));
      say(block(`${w.request.method} ${w.request.url}\n` + JSON.stringify(w.request.body, null, 2), 40));
      say(ui.faint('\n  RESPONSE'));
      let pretty = w.response;
      try { pretty = JSON.stringify(JSON.parse(w.response), null, 2); } catch {}
      say(block(pretty, 120));
      say('');
      return;
    }
    case 'laws': {
      // The documents that govern this agent are inspectable from inside it. No hidden
      // instructions: what is loaded is what you can read here.
      const docs = [
        ['CLAUDE.md  (your standing rules, loaded every turn)', path.join(process.env.HOME, '.claude', 'CLAUDE.md')],
        ['AGENTS.md  (build agent doc, read on demand)', path.join(BUILD, 'AGENTS.md')],
        ['STATE.md   (append-only cursor, read on demand)', path.join(BUILD, 'STATE.md')],
      ];
      if (!arg) {
        say('');
        for (const [label, file] of docs) {
          let size = 'missing';
          try { size = fmt(fs.statSync(file).size) + ' bytes'; } catch {}
          const loaded = file.includes('.claude') ? ui.white('loaded now') : ui.faint('on demand');
          say(`  ${ui.white(label.padEnd(46))}${ui.faint(size.padEnd(12))}${loaded}`);
        }
        say('\n' + ui.faint('  /laws claude | agents | state   to read one') + '\n');
        return;
      }
      const pick = docs.find(([l]) => l.toLowerCase().startsWith(arg.toLowerCase()));
      if (!pick) { say(ui.faint('  /laws claude | agents | state')); return; }
      try { say(block(fs.readFileSync(pick[1], 'utf8'), 200)); }
      catch (e) { say(ui.white('  ' + e.message)); }
      return;
    }
    case 'status': return status();
    case 'diff': say(await sh('git --no-pager diff --stat && git --no-pager diff | head -400', cwd)); return;
    case 'commit': {
      if (!arg) { say(C.red('  /commit <message>')); return; }
      say(await sh(`git add -A && git -c user.email=[OWNER_EMAIL] commit -m ${JSON.stringify(arg)}`, cwd));
      return;
    }
    case 'undo': {
      const a = await ask(C.red('  discard all uncommitted changes? [y/N] '));
      if (a.toLowerCase() !== 'y') return;
      say(await sh('git checkout -- . && git status --short', cwd));
      return;
    }
    case 'approve':
      cfg.approve = arg === 'auto' ? 'auto' : 'ask'; saveConfig(cfg);
      say(C.green('  permissions: ' + cfg.approve)); return;
    case 'ledger':
      say(await sh('tail -12 ~/.misc/receipts.jsonl 2>/dev/null || echo "(no receipts yet)"', cwd)); return;
    case 'clear': dock.clear(); return;
    case 'help': say(HELP); return;
    case 'exit': case 'quit': dock.remove(); await flushReceipts(); process.exit(0);
    default: say(C.dim('  unknown command. /help'));
  }
}

// ---------------------------------------------------------------- entry

async function main() {
  seedHistory();
  const argv = process.argv.slice(2);
  if (argv[0] === '--print' || argv[0] === '-p') {
    const prompt = argv.slice(1).join(' ');
    rl = { question: (_q, cb) => cb('y'), close() {} };
    cfg.approve = 'auto';
    await turn(prompt);
    // The turn receipt is in flight at this point. Exiting without waiting for it is what
    // kept headless runs off the turn cards.
    await flushReceipts();
    if (runState.error) {
      console.log('MISC_RUN: FAILED · ' + runState.error);
      process.exit(2);
    }
    if (!runState.answered) {
      console.log('MISC_RUN: FAILED · the model produced no answer');
      process.exit(3);
    }
    console.log('MISC_RUN: OK');
    process.exit(0);
  }
  if (!cfg.token) {
    say(C.red('  no gateway token. Set one:  misc-config'));
    process.exit(1);
  }

  const banner = `
  ${C.bold('misc')}  ${C.dim('· coding agent on your Cloudflare gateway')}

  ${C.dim('Repository')}   ${path.basename(cwd)}
  ${C.dim('Permissions')}  ${cfg.approve === 'auto' ? 'auto-approve' : 'ask before write'}
  ${C.dim('Ledger')}       ${cfg.ledger ? 'enabled' : 'off'}

  ${C.dim('/help for commands')}
`;

  const usingDock = dock.install({
    banner,
    footer: barText,
    submit: async (line) => {
      if (line.startsWith('/')) { await command(line); return; }
      // A dragged-in file path is a file, not a sentence.
      const dropped = line.replace(/\\ /g, ' ').replace(/^['"]|['"]$/g, '');
      if (!/\s{2,}/.test(dropped) && fs.existsSync(dropped) && fs.statSync(dropped).isFile()) {
        if (/\.(png|jpe?g|gif|webp|heic|pdf)$/i.test(dropped)) {
          say(ui.faint(`  ${path.basename(dropped)} is an image — misc reads text, not pictures, yet`));
          return;
        }
        await turn(`Read this file and tell me what it is: ${dropped}`);
        return;
      }
      if (awaitingModelPick && /^\d+$/.test(line)) {
        awaitingModelPick = false;
        await command('/model ' + line);
        return;
      }
      awaitingModelPick = false;

      // "are you alive" is a question about the process, not a prompt for the model.
      const intent = readIntent(line);
      if (intent === 'alive') {
        const running = dock.isBusy();
        const secs = running ? ((Date.now() - turnStartedAt) / 1000).toFixed(0) : 0;
        say(ui.white('› ') + line);
        const reply = running
          ? `alive · working ${secs}s · ${lastActivity || 'thinking'} · say stop to abort`
          : 'alive · idle · nothing running';
        say(ui.white('  ' + reply));
        // A liveness reply is still something that was said. It goes into the record, so
        // "what did you just say to me" one message later is answerable from memory
        // instead of coming back as a wrong quote from an earlier session (2026-07-27).
        history.push({ instruction: line, answer: reply, ids: [], session: sessionId });
        writeTurn(history[history.length - 1]);
        return;
      }
      if (intent === 'abort' || intent === 'reset') {
        say(ui.white('› ') + line);
        await command('/' + intent);
        return;
      }

      say(ui.white('› ') + line);
      if (isAuditAsk(line)) { say('No.'); return; }
      await turn(line);
    },
    steer: (line) => {
      // The same words mean the same thing mid-turn: a liveness check is answered on the
      // spot, and a stop is a stop, not a note passed to the model.
      const intent = readIntent(line);
      if (intent === 'alive') {
        const secs = ((Date.now() - turnStartedAt) / 1000).toFixed(0);
        say(ui.white(`  alive · working ${secs}s · ${lastActivity || 'thinking'} · say stop to abort`));
        return;
      }
      if (intent === 'abort' || intent === 'reset') { command('/' + intent); return; }
      // A steer that lands after the loop already closed is just the next instruction.
      if (dock.isBusy()) steers.push(line);
      else turn(line);
    },
    interrupt: () => {
      interruptTurn();
      say(ui.faint('  interrupted'));
    },
  });

  if (!usingDock) {
    console.log(banner);
    rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '\u203a ' });
    rl.prompt();
    // Lines are queued and run one at a time. They used to be handled concurrently, so a
    // piped or pasted script fired every turn at once and then 'close' exited the process
    // mid-work — misc could not be driven by anything but a human at a keyboard.
    const queue = [];
    let running = false;
    let stdinClosed = false;
    const drain = async () => {
      if (running) return;
      running = true;
      while (queue.length) {
        const text = queue.shift();
        if (text.startsWith('/')) await command(text);
        else await turn(text);
        if (!stdinClosed) rl.prompt();
      }
      running = false;
      if (stdinClosed) { await flushReceipts(); process.exit(0); }
    };
    rl.on('line', (line) => {
      const text = line.trim();
      if (!text) { rl.prompt(); return; }
      queue.push(text);
      drain();
    });
    rl.on('close', async () => {
      stdinClosed = true;
      if (!running && !queue.length) { await flushReceipts(); process.exit(0); }
    });
  }
}

main();
