// COMPOSITION: chapter — section rhythm with head, body, optional count.

import { escapeHtml } from "../representations/html.js";

export function chapter({ id, title, count, children }) {
  const countEl = count
    ? `<span class="chapter-count">${escapeHtml(count)}</span>`
    : "";
  return `
<section class="chapter" ${id ? `id="${escapeHtml(id)}"` : ""}>
  <div class="chapter-head">
    <h2>${title}</h2>
    ${countEl}
  </div>
  <div class="chapter-body">
    ${children}
  </div>
</section>`;
}
