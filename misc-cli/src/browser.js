// Real browser control, over Chrome's own debugging protocol.
//
// Not AppleScript: that needs a menu toggle nobody can set from a script, and it types
// blind. Not AdsPower: its local API answers "No local API permission" on this account.
// This launches Chrome with a debugging port against a dedicated profile directory and
// speaks CDP to it, so the agent can navigate, read the DOM, click a real element, type
// into it, and screenshot to verify.
//
// The profile lives at ~/.misc/chrome. Sign in to a site once there and the session
// persists, the same way a normal browser profile does.
import { execFile, spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 9333;
const PROFILE = path.join(process.env.HOME || '/tmp', '.misc', 'chrome');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function version() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(1500) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

export async function ensureChrome() {
  const running = await version();
  if (running) return running;
  fs.mkdirSync(PROFILE, { recursive: true });
  spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--restore-last-session',
  ], { detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const v = await version();
    if (v) return v;
  }
  throw new Error('Chrome did not open a debugging port');
}

async function targets() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`, { signal: AbortSignal.timeout(3000) });
  const list = await r.json();
  return list.filter((t) => t.type === 'page');
}

// One CDP round trip. A page target is addressed by its WebSocket URL; the socket is
// opened per call because a coding agent's browser use is bursty, not continuous.
function cdp(wsUrl, calls, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const results = [];
    let i = 0;
    const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('browser call timed out')); }, timeoutMs);
    const next = () => {
      if (i >= calls.length) {
        clearTimeout(timer);
        try { ws.close(); } catch {}
        resolve(results);
        return;
      }
      const call = calls[i];
      ws.send(JSON.stringify({ id: i + 1, method: call.method, params: call.params || {} }));
    };
    ws.onopen = () => next();
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id !== i + 1) return;
      results.push(msg.result ?? msg.error ?? null);
      i += 1;
      next();
    };
    ws.onerror = () => { clearTimeout(timer); reject(new Error('browser socket failed')); };
  });
}

async function page(index = 0) {
  await ensureChrome();
  let list = await targets();
  if (!list.length) {
    await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).catch(() => {});
    list = await targets();
  }
  const t = list[Math.min(index, list.length - 1)];
  if (!t) throw new Error('no browser tab');
  return t;
}

const evaluate = async (expr, index) => {
  const t = await page(index);
  const [res] = await cdp(t.webSocketDebuggerUrl, [
    { method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } },
  ]);
  if (res?.exceptionDetails) return { error: res.exceptionDetails.text || 'script error' };
  return { value: res?.result?.value };
};

// The admin is key-gated, and the key is on this machine. An agent that lands on the login
// page and reports "I can't log in for you" is wrong twice: it can, and it was asked to.
function terminalKey() {
  if (process.env.MISC_DISPATCH_KEY) return process.env.MISC_DISPATCH_KEY;
  try {
    const env = fs.readFileSync(path.join(os.homedir(), '.config', 'grok-bridge.env'), 'utf8');
    const m = env.match(/^TERMINAL_KEY=(.+)$/m);
    return m ? m[1].trim() : '';
  } catch { return ''; }
}

async function adminLogin() {
  const key = terminalKey();
  if (!key) return 'ERROR: no TERMINAL_KEY on this machine (~/.config/grok-bridge.env)';
  // The cookie is same-site, so the fetch has to come from a miscsubjects.com page. A
  // cross-origin call from about:blank gets a 200 and sets nothing.
  const t = await page(0);
  await cdp(t.webSocketDebuggerUrl, [
    { method: 'Page.navigate', params: { url: 'https://miscsubjects.com/admin/login' } },
  ]);
  await new Promise((r) => setTimeout(r, 2500));
  const { value } = await evaluate(`(async () => {
    const r = await fetch('/api/admin/login', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: ${JSON.stringify(key)} }),
    });
    return r.status + ' ' + (await r.text());
  })()`, 0);
  return `admin sign-in: ${value}\nThe session cookie now lives in this browser profile for 60 days. Navigate to any /admin page and read it.`;
}

export async function browser(action, input = {}) {
  switch (action) {
    // Sign this browser profile into the admin with the key that is already on the Mac.
    case 'admin_login':
    case 'login':
      return await adminLogin();
    case 'open': {
      const t = await page();
      await cdp(t.webSocketDebuggerUrl, [{ method: 'Page.navigate', params: { url: input.url } }]);
      await new Promise((r) => setTimeout(r, 2500));
      const { value } = await evaluate('document.title + " — " + location.href');
      return `opened: ${value}`;
    }
    // "Open my browser to a new tab" is the literal instruction most of the time, and
    // navigating tab 0 instead throws away whatever he was looking at.
    case 'newtab':
    case 'new_tab': {
      await ensureChrome();
      const url = input.url || 'about:blank';
      await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2500));
      // Chrome lists page targets most-recently-focused first, so the tab just created is
      // index 0 and every other action's default tab already points at it.
      const list = await targets();
      const t = list[0];
      if (t) await cdp(t.webSocketDebuggerUrl, [{ method: 'Page.bringToFront' }]).catch(() => {});
      return `new tab opened and focused: ${t ? t.title + ' — ' + t.url : url}\nit is tab 0 (the default), so browser{action:"read"} reads it. ${list.length} tabs open.`;
    }
    case 'tabs': {
      const list = await targets();
      return list.map((t, i) => `${i}: ${t.title} — ${t.url}`).join('\n') || 'no tabs';
    }
    case 'read': {
      const { value } = await evaluate(`(() => {
        const t = document.body ? document.body.innerText : '';
        return (document.title + ' — ' + location.href + '\\n\\n' + t).slice(0, 20000);
      })()`, input.tab);
      return value || '(empty page)';
    }
    case 'elements': {
      // What can actually be interacted with, with the selector needed to reach it.
      const { value } = await evaluate(`(() => {
        const out = [];
        const nodes = document.querySelectorAll('a,button,input,textarea,select,[role=button],[role=textbox],[contenteditable=true]');
        let i = 0;
        for (const n of nodes) {
          const r = n.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const label = (n.innerText || n.value || n.getAttribute('aria-label') || n.placeholder || '').trim().replace(/\\s+/g,' ').slice(0,70);
          const id = n.id ? '#' + n.id : '';
          const cls = n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\\s+/).slice(0,2).join('.') : '';
          out.push((i++) + ' <' + n.tagName.toLowerCase() + id + cls + '> ' + label);
          if (i > 120) break;
        }
        return out.join('\\n');
      })()`, input.tab);
      return value || 'no interactive elements found';
    }
    case 'click': {
      const sel = JSON.stringify(input.selector || '');
      const { value, error } = await evaluate(`(() => {
        const el = ${input.text ? `[...document.querySelectorAll('a,button,[role=button],input[type=submit]')].find(e => (e.innerText||e.value||'').trim().toLowerCase().includes(${JSON.stringify(String(input.text).toLowerCase())}))` : `document.querySelector(${sel})`};
        if (!el) return 'not found';
        el.scrollIntoView({block:'center'});
        el.click();
        return 'clicked: ' + (el.innerText || el.value || el.tagName).trim().slice(0,80);
      })()`, input.tab);
      return error || value;
    }
    case 'type': {
      const sel = JSON.stringify(input.selector || '');
      const text = JSON.stringify(String(input.text ?? ''));
      const { value, error } = await evaluate(`(() => {
        const el = document.querySelector(${sel});
        if (!el) return 'not found';
        el.focus();
        if (el.isContentEditable) {
          document.execCommand('insertText', false, ${text});
        } else {
          const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value')?.set;
          setter ? setter.call(el, ${text}) : (el.value = ${text});
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return 'typed into ' + (el.id ? '#' + el.id : el.tagName.toLowerCase());
      })()`, input.tab);
      return error || value;
    }
    case 'screenshot': {
      const t = await page(input.tab);
      const [res] = await cdp(t.webSocketDebuggerUrl, [{ method: 'Page.captureScreenshot', params: { format: 'png' } }]);
      const file = path.join(process.env.HOME, '.misc', 'browser.png');
      fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
      return `screenshot saved to ${file}`;
    }
    case 'eval': {
      const { value, error } = await evaluate(String(input.script || ''), input.tab);
      return error || (typeof value === 'string' ? value : JSON.stringify(value));
    }
    default:
      return `unknown browser action: ${action}`;
  }
}
