
export function pageRefFor(pathname) {
  const path = String(pathname || '/admin').split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  return 'page://' + (path || 'admin');
}

export const OBJECT_CONTEXT_MARK = 'data-ms-object-context="1"';

export function objectContextHtml(pathname) {
  const ref = pageRefFor(pathname);
  const q = encodeURIComponent(ref);
  const a = 'style="color:var(--ink-soft,#333);font-size:11px"';
  return `<div class="object-context" ${OBJECT_CONTEXT_MARK} aria-label="This page as an environment object" `
    + `style="display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:6px 24px;font-size:11px;color:var(--muted,#666);border-bottom:1px solid var(--line,#e2e2e2);background:var(--bg,#fff)">`
    + `<code style="font-size:11px;padding:1px 5px">${ref}</code>`
    + `<a ${a} href="/api/environment/objects?ref=${q}">descriptor</a>`
    + `<a ${a} href="/api/environment/governance?ref=${q}">rules that govern this page</a>`
    + `<a ${a} href="/api/environment/comparables?ref=${q}">comparables</a>`
    + `<a ${a} href="/api/environment?format=markdown">manual</a>`
    + `</div>`;
}

// Place the line where the page's own content begins. Idempotent: a page that already carries
// the mark is returned unchanged, so a double pass can never double the line.
export function injectObjectContext(html, pathname) {
  const text = String(html || '');
  if (text.includes(OBJECT_CONTEXT_MARK)) return text;
  const block = objectContextHtml(pathname);
  if (text.includes('</header>')) return text.replace('</header>', block + '</header>');
  if (text.includes('<main>')) return text.replace('<main>', block + '<main>');
  if (text.includes('<body>')) return text.replace('<body>', '<body>' + block);
  return text;
}
