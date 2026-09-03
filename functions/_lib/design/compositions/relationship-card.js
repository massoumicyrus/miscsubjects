// COMPOSITION: relationship-card — featured/index cards for article feeds.

import { escapeHtml } from "../representations/html.js";

export function featuredCard({ index, href, kicker, title, meta, tags }) {
  const num = String(index + 1).padStart(2, "0");
  const tagHtml = (tags || [])
    .slice(0, 3)
    .map((t) => `<span class="ds-pill">#${escapeHtml(t)}</span>`)
    .join("");
  return `<a class="featured" href="${escapeHtml(href)}">
    <span class="fnum" aria-hidden="true">${num}</span>
    <span>
      <span class="fk">${escapeHtml(kicker)}</span>
      <span class="ft">${escapeHtml(title)}</span>
      <span class="fm">${escapeHtml(meta)}</span>
      ${tagHtml ? `<span class="ftags">${tagHtml}</span>` : ""}
      <span class="read">Read the piece →</span>
    </span>
  </a>`;
}

export function indexCard({ index, href, title, meta }) {
  const num = String(index + 1).padStart(2, "0");
  return `<li>
    <a href="${escapeHtml(href)}">
      <span class="in">${num}</span>
      <span class="it">${escapeHtml(title)}</span>
      <span class="arrow" aria-hidden="true">→</span>
      <span class="im">${escapeHtml(meta)}</span>
    </a>
  </li>`;
}

export function indexList(cards) {
  return `<ol class="idx">${cards.join("")}</ol>`;
}
