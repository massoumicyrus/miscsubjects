// tag_calls — the one place that knows how a model's tagged output is read.
//
// The router in api/dispatch.js parses `[KEY]body[/KEY]` out of model text and executes it.
// Anything else that wants to show, log or replay what a model emitted must read it the SAME
// way, or the record it publishes stops matching what actually ran. This module holds that
// grammar so a second reader never drifts from the executor.
//
// Grammar, exactly as the router applies it:
// - `[KEY]body[/KEY]` with an optional ` as <name>` binding suffix
// - KEY is upper-snake and strict: `[ WORLD_MAP ]` is malformed output, never a silent call
// - META tags are protocol, not tools: they are read, never dispatched
// - text inside [REPLY], [REASONING] and [AUDIO] is inert — a tag quoted in a reply is prose

export const TAG_RE = /\[([A-Z_][A-Z0-9_]*)\]([\s\S]*?)\[\/\1\](?:\s+as\s+(\w+))?/g;

export const META_TAGS = new Set([
  'DONE', 'SELF', 'LOOP', 'REASONING', 'TOOL_CHOICE', 'DECISION', 'BATCH', 'REPLY', 'AUDIO',
  // A model is allowed to decide that nothing needs saying. [NOREPLY] ends the turn with the
  // row fully written and no message sent — which is different from failing to produce a reply,
  // and the two used to be indistinguishable: an empty turn sent "I finished but did not form a
  // reply" to the person (2026-09-02).
  'NOREPLY',
]);

const INERT_TAGS = ['REPLY', 'REASONING', 'AUDIO'];

function blankSameLength(match) {
  return ' '.repeat(String(match || '').length);
}

// Blank out inert regions so offsets are preserved and a tag quoted inside a reply is not run.
// An unclosed inert tag blanks to end of text: a half-written reply must not leak a live call.
export function executableTagSurface(text) {
  let out = String(text || '').replace(/\[(REPLY|REASONING|AUDIO)\][\s\S]*?\[\/\1\]/g, blankSameLength);
  for (const tag of INERT_TAGS) {
    const open = out.lastIndexOf('[' + tag + ']');
    const close = out.lastIndexOf('[/' + tag + ']');
    if (open !== -1 && close < open) {
      out = out.slice(0, open) + ' '.repeat(out.length - open);
    }
  }
  return out;
}

// Every executable tag in the text, in order. `dir` (optional) enables bare-tag recovery for a
// known key when the model forgot the closer.
export function collectExecutableTags(text, dir) {
  const scan = executableTagSurface(text);
  const tags = [];
  TAG_RE.lastIndex = 0;
  let m;
  while ((m = TAG_RE.exec(scan)) !== null) tags.push({ key: m[1], body: m[2], bind: m[3] });
  if (tags.length) return tags;

  let bm;
  const bare = /\[([A-Z_][A-Z0-9_]{2,})\]/g;
  while ((bm = bare.exec(scan)) !== null) {
    const k = bm[1];
    if (META_TAGS.has(k)) continue;
    if (dir && dir[k]) {
      tags.push({ key: k, body: '', bind: null });
      break;
    }
  }
  return tags;
}

// The tool tags only — what a reader should show as "this turn called these".
export function toolTags(text, dir) {
  return collectExecutableTags(text, dir).filter((t) => !META_TAGS.has(t.key));
}

// Last occurrence of one section, unwrapped. Last, not first: on a multi-loop turn the final
// block is the one that decided the turn.
export function section(text, tag) {
  const re = new RegExp('\\[' + tag + '\\]([\\s\\S]*?)\\[\\/' + tag + '\\]', 'g');
  let last = null;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) last = m[1];
  return last == null ? '' : last.trim();
}

// Every occurrence of one section, in order — a turn that looped three times has three
// [REASONING] blocks and the audit record wants all of them.
export function sections(text, tag) {
  const re = new RegExp('\\[' + tag + '\\]([\\s\\S]*?)\\[\\/' + tag + '\\]', 'g');
  const out = [];
  let m;
  while ((m = re.exec(String(text || ''))) !== null) out.push(m[1].trim());
  return out;
}

// The DECISION line a reasoning block must end with, per the REASON agent's protocol.
// Returns {verb, detail} or null when the block did not close with one.
export function decisionOf(reasoningBlock) {
  const m = String(reasoningBlock || '').match(/DECISION:\s*(TOOL|REPLY|LOOP|ERROR)\s*(?:[—\-–:]\s*)?([\s\S]*)$/i);
  if (!m) return null;
  return { verb: m[1].toUpperCase(), detail: String(m[2] || '').trim().split('\n')[0].slice(0, 400) };
}

// Everything a log row needs from one model turn, read the way the router reads it.
export function readTurn(text, dir) {
  const raw = String(text == null ? '' : text);
  const reasoning = sections(raw, 'REASONING');
  const last = reasoning.length ? reasoning[reasoning.length - 1] : '';
  return {
    raw,
    reasoning,
    reasoning_text: reasoning.join('\n\n---\n\n'),
    decision: decisionOf(last),
    tools: toolTags(raw, dir).map((t) => ({ key: t.key, body: t.body, bind: t.bind || null })),
    reply: section(raw, 'REPLY'),
    loop: section(raw, 'LOOP') || section(raw, 'SELF'),
    done: section(raw, 'DONE'),
  };
}
