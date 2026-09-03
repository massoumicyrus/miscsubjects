// COMPOSITION: inspector — clean disclosure panels for provenance, ledger, contributions, copy.

import { escapeHtml } from "../representations/html.js";

export function inspectorPanel({
  cls,
  eyebrow,
  title,
  meta,
  open = false,
  children,
}) {
  const e = eyebrow
    ? `<span class="insp-k">${escapeHtml(eyebrow)}</span>`
    : "";
  const m = meta ? `<span class="insp-meta">${escapeHtml(meta)}</span>` : "";
  return `<details class="insp-panel ${cls || ""}"${open ? " open" : ""}>
  <summary>${e}<b>${escapeHtml(title)}</b>${m}</summary>
  <div class="insp-body">${children}</div>
</details>`;
}

export function inspectorRow({ label, value, href }) {
  const val = href
    ? `<a href="${escapeHtml(href)}">${escapeHtml(value)}</a>`
    : escapeHtml(value);
  return `<div class="insp-row"><span class="insp-label">${escapeHtml(label)}</span><span class="insp-value">${val}</span></div>`;
}
