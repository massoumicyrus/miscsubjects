// PRIMITIVE: button — CTA links.

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

export function button({ href, label, ghost = false }) {
  const cls = ghost ? "ds-btn ghost" : "ds-btn";
  return `<a class="${cls}" href="${href}">${escapeHtml(label)}</a>`;
}
