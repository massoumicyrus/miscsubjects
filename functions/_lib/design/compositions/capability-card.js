// COMPOSITION: capability-card — a related tool/skill/directory row as a card.

import { escapeHtml } from "../representations/html.js";

export function capabilityCard({ key, title, summary, href, contractHref, invokeHref, tags }) {
  const tagHtml = (tags || [])
    .map((t) => `<span class="ds-pill">${escapeHtml(t)}</span>`)
    .join("");
  return `<article class="cap-card">
    <div class="cap-card-head">
      <span class="cap-card-key">${escapeHtml(key)}</span>
      ${tagHtml}
    </div>
    <h3 class="cap-card-title">${escapeHtml(title)}</h3>
    <p class="cap-card-sum">${escapeHtml(summary)}</p>
    <div class="cap-card-actions">
      ${href ? `<a class="cap-card-link" href="${escapeHtml(href)}">Read →</a>` : ""}
      ${contractHref ? `<a class="cap-card-link" href="${escapeHtml(contractHref)}">Contract →</a>` : ""}
      ${invokeHref ? `<a class="cap-card-link" href="${escapeHtml(invokeHref)}">Invoke →</a>` : ""}
    </div>
  </article>`;
}
