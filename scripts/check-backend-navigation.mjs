#!/usr/bin/env node
import { PRIMARY_TABS, shellHtml } from '../functions/admin/_layout.js';

let failures = 0;
const fail = (message) => { console.error(message); failures += 1; };
const html = shellHtml({ activeHref: '/admin/directory', title: 'Navigation proof', body: '<p>proof</p>' });

if (PRIMARY_TABS.length < 16) fail('BACKEND_NAV_TAB_COUNT_REGRESSED ' + PRIMARY_TABS.length);
for (const item of PRIMARY_TABS) {
  const anchor = `href="${item.href}"`;
  if (!html.includes(anchor)) fail('BACKEND_NAV_MISSING ' + item.href);
}
if (/<summary[^>]*>\s*More\s*<\/summary>/i.test(html)) fail('BACKEND_NAV_MORE_PRESENT');
if (/admin-more|admin-menu|compactNavHtml/.test(html)) fail('BACKEND_NAV_COLLAPSE_PRESENT');
if (!/\.tab-row\{[^}]*flex-wrap:wrap/.test(html)) fail('BACKEND_NAV_DESKTOP_WRAP_MISSING');
if (!html.includes('@media(max-width:760px)') || !html.includes('.tab-row{flex-wrap:wrap;overflow:visible')) fail('BACKEND_NAV_MOBILE_WRAP_MISSING');


// FRONT<->BACK ROUND TRIP LOCK (owner order 2026-08-04 — "fix it once and for all and lock
// it in"): every public topbar carries the auth flip (Sign in -> Admin + Sign out via the
// ungated /api/session probe), and the admin shell carries "View site". Losing any of these
// regresses the owner's ability to tab between the front and the back and fails the commit.
import { readFileSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname;
for (const [file, needles] of [
  ['functions/_lib/design_system.js', ['data-ms-auth', "/api/session"]],
  ['functions/_lib/design/compositions/navigation-hub.js', ['data-ms-auth', "/api/session"]],
  ['public/index.html', ['/api/session', 'authBtn']],
  ['functions/api/session.js', ['verifyAdminCookie', 'authed']],
]) {
  let text = '';
  try { text = readFileSync(ROOT + file, 'utf8'); } catch { fail('FRONT_BACK_NAV_FILE_MISSING ' + file); continue; }
  for (const n of needles) if (!text.includes(n)) fail('FRONT_BACK_NAV_REGRESSED ' + file + ' lost ' + n);
}
if (!html.includes('View site')) fail('BACKEND_NAV_VIEW_SITE_MISSING');

// SIGN-OUT + INQUIRY LOCK (owner order 2026-08-04): /admin/logout must exist as a real route
// (the Sign out href on every public topbar died as "Not found"), the gate must exempt it,
// and every public topbar carries the Inquire entry to the inquiry loop (/inquire page +
// /api/inquire endpoint). Losing any of these fails the commit.
for (const [file, needles] of [
  ['functions/admin/logout.js', ['clearSessionCookie', "location: '/'"]],
  ['functions/_lib/admin_session.js', ["'/admin/logout'"]],
  ['functions/inquire.js', ['inq-form', '/api/inquire']],
  ['functions/api/inquire.js', ['injectOwnerBcc', 'inquiries']],
  ['functions/_lib/design_system.js', ['href="/inquire"']],
  ['functions/_lib/design/compositions/navigation-hub.js', ['href="/inquire"']],
  ['public/index.html', ['href="/inquire"']],
]) {
  let text = '';
  try { text = readFileSync(ROOT + file, 'utf8'); } catch { fail('SIGNOUT_INQUIRY_FILE_MISSING ' + file); continue; }
  for (const n of needles) if (!text.includes(n)) fail('SIGNOUT_INQUIRY_REGRESSED ' + file + ' lost ' + n);
}

if (failures) process.exit(1);
console.log(JSON.stringify({ ok: true, visible_tabs: PRIMARY_TABS.length, more_button: false, desktop_wrap: true, mobile_wrap: true }));
