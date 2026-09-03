// PRIMITIVE: disclosure — details/summary wrapper.

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

export function disclosure({ summary, children, open = false, cls = "" }) {
  return `<details class="ds-disclosure ${cls}"${open ? " open" : ""}>
  <summary>${summary}</summary>
  <div class="ds-disclosure-body">${children}</div>
</details>`;
}

export function disclosureSummary({ eyebrow, title, meta }) {
  const e = eyebrow ? `<span class="ds-disclosure-k">${escapeHtml(eyebrow)}</span>` : "";
  const m = meta ? `<span class="ds-disclosure-meta">${escapeHtml(meta)}</span>` : "";
  return `<span class="ds-disclosure-summary">${e}<b>${escapeHtml(title)}</b>${m}</span>`;
}
