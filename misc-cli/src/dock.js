// The bottom dock: the four rows at the foot of the window that never scroll.
//
//   ────────────────────────────────  rule
//   › what you are typing              input box
//   * running  shell  npm test  3s     activity (or blank when idle)
//   model | $ | tokens                 footer
//
// It works by shrinking the terminal's scrolling region to end above these rows, so every
// line the agent prints scrolls in the region above and can never touch them. The input
// line is edited here in raw mode rather than by readline, because readline assumes it
// owns the bottom of the screen and fights the reserved rows.
const out = process.stdout;
const IN = process.stdin;

const HEIGHT = 4; // rule + input + activity + footer

let on = false;
let text = '';
let cursor = 0;
let activity = null;      // { label, detail, startedAt }
let footerText = () => '';
let onSubmit = () => {};
let onInterrupt = () => {};
let onSteer = null;
let busy = false;
let queued = [];
let timer = null;
let paintScheduled = false;
// The next screen row to print at, counted from the top of the scrolling region. Lines fill
// top-down like a normal transcript; only once the region is full do new lines scroll the
// old ones into scrollback. This is what keeps the reply visible higher up the screen
// instead of pinned to the last row above the dock.
let writeRow = 1;
// A short tail of the transcript, kept so a resize can repaint the screen instead of
// leaving the operator staring at an empty window above the dock.
const tail = [];
const TAIL = 200;
// Where the next transcript line goes. The region fills top-down, then scrolls.
let nextRow = 1;

const ROWS = () => out.rows || 24;
const COLS = () => out.columns || 80;
const dim = (s) => `\x1b[38;5;240m${s}\x1b[0m`;
const white = (s) => `\x1b[38;5;255m${s}\x1b[0m`;

function clip(s, n) {
  return s.length > n ? s.slice(0, Math.max(0, n - 1)) + '…' : s;
}

function activityLine() {
  if (!activity) return busy ? dim('  working…') : '';
  const secs = ((Date.now() - activity.startedAt) / 1000).toFixed(1);
  const frames = ['·', '*', '+', '*'];
  const f = frames[Math.floor(Date.now() / 250) % frames.length];
  return `  ${white(f)} ${dim(activity.label.padEnd(11))}${white(clip(activity.detail || '', COLS() - 34))} ${dim(secs + 's')}`;
}

function paint() {
  if (!on) return;
  const h = ROWS();
  const w = COLS();
  const lines = text.split('\n');
  const shown = lines.length > 1
    ? clip(lines[0], w - 22) + dim(`  +${lines.length - 1} lines`)
    : clip(text, w - 4);
  const q = '';
  out.write(
    '\x1b7' +
    `\x1b[${h - 3};1H\x1b[2K` + dim('─'.repeat(w)) +
    `\x1b[${h - 2};1H\x1b[2K` + white('› ') + shown + q +
    `\x1b[${h - 1};1H\x1b[2K` + activityLine() +
    `\x1b[${h};1H\x1b[2K` + footerText() +
    `\x1b[${h - 2};${3 + Math.min(cursor, w - 4)}H`   // leave the cursor in the input box
  );
}

function schedulePaint() {
  if (paintScheduled) return;
  paintScheduled = true;
  setImmediate(() => { paintScheduled = false; paint(); });
}

// Anything the agent prints goes above the dock. A write cursor fills lines top-down from
// the top of the scrolling region; once the region is full, writing at its bottom row
// scrolls the region, which is what keeps the dock still.
export function print(line = '') {
  if (!on) { console.log(line); return; }
  tail.push(line);
  if (tail.length > TAIL) tail.shift();
  const h = ROWS();
  const bottom = h - HEIGHT;          // last row inside the scrolling region
  if (writeRow > bottom) writeRow = bottom;
  if (writeRow < 1) writeRow = 1;
  // Move to the write row, clear it, write the line. Writing inside the region at its last
  // row makes the terminal scroll the region, preserving the dock.
  out.write(`\x1b[${writeRow};1H\x1b[2K` + line);
  if (writeRow >= bottom) {
    // At the bottom: emit a newline so the terminal scrolls, then stay on the bottom row.
    out.write('\n');
    writeRow = bottom;
  } else {
    writeRow += 1;
  }
  schedulePaint();
}

function region() {
  out.write(`\x1b[1;${Math.max(1, ROWS() - HEIGHT)}r`);
}

// A resize invalidates the scrolling region and leaves the old dock rows painted where
// they no longer belong. Reset the region, wipe the strip, and repaint.
// On resize the dock rows that were painted at absolute positions are now sitting in the
// middle of the new layout, and there is no way to reach back and erase them line by line.
// Clearing the visible screen is the only deterministic fix; scrollback is untouched, so
// the transcript is still there with a scroll up.
function onResize() {
  out.write('\x1b[r');            // release the old region
  out.write('\x1b[2J');           // wipe the visible screen, keep scrollback
  const h = ROWS();
  region();
  out.write('\x1b[1;1H');
  const room = Math.max(0, h - HEIGHT - 1);
  writeRow = 1;
  for (const line of tail.slice(-room)) {
    out.write(line + '\r\n');
    if (writeRow < h - HEIGHT) writeRow += 1;
  }
  paint();
}

export function setActivity(label, detail) {
  activity = label ? { label, detail, startedAt: Date.now() } : null;
  schedulePaint();
}

export function setBusy(v) {
  busy = v;
  schedulePaint();
}

export function isBusy() { return busy; }

export function install({ footer, submit, interrupt, steer, banner }) {
  if (!out.isTTY) return false;
  footerText = footer;
  onSubmit = submit;
  onInterrupt = interrupt;
  onSteer = steer;
  on = true;

  out.write('\x1b[2J\x1b[1;1H');   // one clean canvas, so nothing is half-scrolled
  region();
  nextRow = 1;
  if (banner) for (const line of String(banner).split('\n')) print(line);
  paint();
  timer = setInterval(paint, 200);
  if (timer.unref) timer.unref();
  out.on('resize', onResize);

  IN.setRawMode?.(true);
  out.write('\x1b[?2004h');   // ask the terminal to bracket pastes
  IN.resume();
  IN.setEncoding('utf8');
  IN.on('data', onKey);

  process.on('exit', remove);
  return true;
}

function submitLine() {
  const line = text.trim();
  text = ''; cursor = 0;
  paint();
  if (!line) return;
  // No queue. If a turn is running the line steers it — it reaches the model before its
  // next step. If nothing is running it starts a turn. Enter always means "send this".
  if (busy && onSteer) {
    onSteer(line);
    print(white('› ') + line + dim('   → steering'));
    schedulePaint();
    return;
  }
  onSubmit(line);
}

// Bracketed paste. Without it, a pasted block arrives as one burst and every newline in
// it reads as Enter — so the first line is sent, the rest is sent as separate messages,
// and the agent is answering fragments. Inside the paste markers, newlines are text.
let pasting = false;
let pasteBuf = '';

function onKey(chunk) {
  let data = String(chunk);
  for (;;) {
    if (!pasting) {
      const start = data.indexOf('\x1b[200~');
      if (start === -1) break;
      keys(data.slice(0, start));
      data = data.slice(start + 6);
      pasting = true;
      pasteBuf = '';
    }
    const end = data.indexOf('\x1b[201~');
    if (end === -1) { pasteBuf += data; paint(); return; }
    pasteBuf += data.slice(0, end);
    data = data.slice(end + 6);
    pasting = false;
    // The whole paste lands in the input as one block, newlines and all. Nothing is sent
    // until Enter, so a multi-line paste is one message.
    text = text.slice(0, cursor) + pasteBuf + text.slice(cursor);
    cursor += pasteBuf.length;
    pasteBuf = '';
  }
  if (pasting) { pasteBuf += data; paint(); return; }
  // Fallback for terminals that do not bracket pastes. The distinction that matters is
  // where the newlines are: a newline in the middle means several lines arrived at once,
  // which is a paste and must not fire off as several messages. A single line that merely
  // ends in Enter is an ordinary line — insert it and send it.
  const body = data.replace(/[\r\n]+$/, '');
  if (/[\r\n]/.test(body)) {
    const block = data.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    text = text.slice(0, cursor) + block + text.slice(cursor);
    cursor += block.length;
    paint();
    return;
  }
  if (body.length > 1 && /[\r\n]$/.test(data)) {
    text = text.slice(0, cursor) + body + text.slice(cursor);
    cursor += body.length;
    submitLine();
    return;
  }
  keys(data);
}

function keys(chunk) {
  for (const ch of chunk) {
    const code = ch.charCodeAt(0);
    if (ch === '\r' || ch === '\n') { submitLine(); continue; }
    if (ch === '\x03') {                       // Ctrl-C
      if (busy) { onInterrupt(); continue; }
      if (text) { text = ''; cursor = 0; paint(); continue; }
      remove(); process.exit(0);
    }
    if (ch === '\x13') {                       // Ctrl-S — steer the running turn
      const line = text.trim();
      text = ''; cursor = 0;
      if (!line) { paint(); continue; }
      if (busy && onSteer) { onSteer(line); print(dim('  steering · ') + white(clip(line, COLS() - 16))); }
      else { onSubmit(line); }
      paint();
      continue;
    }
    if (ch === '\x04') { remove(); process.exit(0); }        // Ctrl-D
    if (ch === '\x7f' || code === 8) {                        // backspace
      if (cursor > 0) { text = text.slice(0, cursor - 1) + text.slice(cursor); cursor--; }
      paint(); continue;
    }
    if (ch === '\x15') { text = text.slice(cursor); cursor = 0; paint(); continue; } // Ctrl-U
    if (ch === '\x01') { cursor = 0; paint(); continue; }                            // Ctrl-A
    if (ch === '\x05') { cursor = text.length; paint(); continue; }                  // Ctrl-E
    if (ch === '\x1b') { continue; }
    if (code < 32) continue;
    text = text.slice(0, cursor) + ch + text.slice(cursor);
    cursor += ch.length;
  }
  paint();
}

export function remove() {
  if (!on) return;
  on = false;
  if (timer) clearInterval(timer);
  IN.setRawMode?.(false);
  out.write('\x1b[?2004l');
  out.write('\x1b[r');
  out.write(`\x1b[${ROWS()};1H\n`);
}

// Wipe the visible screen, reset the write cursor to the top, and repaint the dock.
// Scrollback is untouched, so the transcript is still there with a scroll up.
export function clear() {
  if (!on) return;
  out.write('\x1b[2J');
  writeRow = 1;
  paint();
}
