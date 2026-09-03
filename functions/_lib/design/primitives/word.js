// PRIMITIVE: word — text labels, kickers, eyebrows.

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

export function kicker(text) {
  return `<span class="ds-kicker">${escapeHtml(text)}</span>`;
}

export function eyebrow(text) {
  return `<span class="ds-eyebrow">${escapeHtml(text)}</span>`;
}

export function label(text) {
  return `<span class="ds-label">${escapeHtml(text)}</span>`;
}
