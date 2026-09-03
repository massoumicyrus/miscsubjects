// COMPOSITION: directory-widget — renders a live directory row as an inline card.

import { escapeHtml } from "../representations/html.js";

export function directoryWidget(row) {
  const key = escapeHtml(row.key);
  const what = escapeHtml(
    (row.what || "").slice(0, 120) || String(row.content || "").slice(0, 120),
  );
  return `<article class="dir-widget">
  <div class="dir-widget-key">${key}</div>
  <div class="dir-widget-what">${what}</div>
  <div class="dir-widget-actions">
    <a class="dir-widget-contract" href="/api/directory/${key}">Contract →</a>
    <a class="dir-widget-invoke" href="/api/dispatch?key=${key}">Invoke →</a>
  </div>
</article>`;
}
