import {
  governanceChromeStyles,
  governanceFooter,
  governanceHeader,
} from "../../_lib/governance_chrome.js";

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

function contractSections(content) {
  const sections = [];
  let current = null;
  for (const raw of String(content || "").split("\n")) {
    const match = raw.match(/^#\s*([A-Z][A-Z0-9_ ]*):?\s*(.*)$/);
    if (match) {
      current = { label: match[1].replaceAll("_", " "), lines: [] };
      if (match[2]) current.lines.push(match[2]);
      sections.push(current);
    } else if (raw.trim()) {
      if (!current) {
        current = { label: "Definition", lines: [] };
        sections.push(current);
      }
      current.lines.push(raw.trim());
    }
  }
  return sections;
}

export async function onRequestGet({ env, params }) {
  const key = String(params.key || "").toUpperCase();
  const row = await env.DB.prepare("SELECT * FROM directory WHERE key = ?")
    .bind(key)
    .first();
  if (!row) return new Response("Not found", { status: 404 });
  const siblings = row.category
    ? (await env.DB.prepare(
        "SELECT key, type FROM directory WHERE category = ? AND key <> ? AND enabled <> 0 ORDER BY planner_rank, key LIMIT 12",
      )
        .bind(row.category, key)
        .all()).results || []
    : [];
  const sections = contractSections(row.content);
  const summary =
    sections.find((section) => section.label === "WHAT")?.lines.join(" ") ||
    `${key} is a live capability in the build directory.`;
  const visible = sections
    .filter((section) => ["WHAT", "WHEN TO USE"].includes(section.label))
    .map(
      (section) =>
        `<section class="meaning"><p class="eyebrow">${esc(section.label)}</p><p>${esc(section.lines.join(" "))}</p></section>`,
    )
    .join("");
  const contract = sections
    .filter((section) => !["WHAT", "WHEN TO USE"].includes(section.label))
    .map(
      (section) =>
        `<section><h3>${esc(section.label)}</h3><pre>${esc(section.lines.join("\n"))}</pre></section>`,
    )
    .join("");
  const encoded = encodeURIComponent(key);
  const related = siblings
    .map(
      (item) =>
        `<a href="/a/directory/${encodeURIComponent(item.key)}"><b>${esc(item.key.replaceAll("_", " "))}</b><small>${esc(item.type)} · same ${esc(row.category)} ontology</small></a>`,
    )
    .join("");
  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: key,
    description: summary,
    url: `https://miscsubjects.com/a/directory/${encoded}`,
  }).replace(/</g, "\\u003c");
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(key)} — capability article</title><meta name="description" content="${esc(summary)}"><link rel="canonical" href="https://miscsubjects.com/a/directory/${encoded}"><link rel="alternate" type="application/json" href="/api/directory/${encoded}"><link rel="alternate" type="text/markdown" href="/api/directory/${encoded}?format=skill"><script type="application/ld+json">${structured}</script><style>${governanceChromeStyles()}${STYLE}</style></head><body>${governanceHeader("literature")}<main><nav class="crumb" aria-label="Breadcrumb"><a href="/a/oip">OIP</a><span>→</span><a href="/api/dispatch?map=1">Directory</a><span>→</span><b>${esc(key)}</b></nav><header class="hero"><p class="eyebrow">Directory object · ${esc(row.category || "capability")}</p><h1>${esc(key.replaceAll("_", " "))}</h1><p>${esc(summary)}</p><div class="expressions"><a href="/api/directory/${encoded}?format=skill">Model Skill</a><a class="machine-link" href="/api/directory/${encoded}">Directory JSON</a><a class="machine-link" href="/api/dispatch?key=${encoded}">OIP contract</a></div></header><div class="reading">${visible || `<section class="meaning"><p>${esc(summary)}</p></section>`}<aside><p class="eyebrow">Object identity</p><dl><div><dt>Key</dt><dd>${esc(key)}</dd></div><div><dt>Type</dt><dd>${esc(row.type)}</dd></div><div><dt>Category</dt><dd>${esc(row.category || "uncategorized")}</dd></div><div><dt>Authority</dt><dd>${row.auth ? "owner or scoped capability" : "public contract"}</dd></div></dl></aside></div><details class="contract"><summary><span><small>Model and router layer</small><b>Open the live contract</b></span><em>${sections.length} sections</em></summary><div>${contract || "<p>No additional contract fields.</p>"}<section><h3>Target</h3><pre>${esc(row.type)} · ${esc(row.target || "in-process")}</pre></section></div></details>${related ? `<details class="related"><summary><span><small>Ontology family</small><b>Related ${esc(row.category)} capabilities</b></span><em>${siblings.length} objects</em></summary><div>${related}</div></details>` : ""}<section class="law"><p class="eyebrow">Article-object law</p><h2>This definition is also an article and a Skill.</h2><p>The human expression explains the capability. The Skill directs model behavior. The directory row remains the executable contract. OIP invokes it and receipts prove what happened.</p></section></main>${governanceFooter()}</body></html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=120",
      },
    },
  );
}

const STYLE = `
main{width:min(76rem,calc(100% - 40px));margin:auto;padding:56px 0 120px}.crumb{display:flex;gap:10px;align-items:center;color:var(--ds-dim);font:12px/1.4 var(--font-mono)}.crumb a{color:var(--ds-soft);text-decoration:none}.hero{padding:clamp(60px,9vw,120px) 0 var(--space-5);border-bottom:1px solid var(--ds-line)}.eyebrow{font:700 var(--fs-eye)/1 var(--font-mono);letter-spacing:var(--track-eye);text-transform:uppercase;color:var(--ds-accent)}.hero h1{max-width:12ch;margin:18px 0;font-size:var(--fs-display);line-height:.9}.hero>p:not(.eyebrow){max-width:46rem;color:var(--ds-soft);font-size:var(--fs-lead);line-height:1.55}.expressions{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.expressions a{padding:11px 15px;border:1px solid var(--ds-line);border-radius:999px;color:var(--ds-ink);text-decoration:none}.expressions a:first-child{background:var(--ds-accent);color:#080b0f;border-color:var(--ds-accent);font-weight:700}.reading{display:grid;grid-template-columns:1.618fr 1fr;gap:var(--space-5);padding:var(--space-5) 0}.meaning{padding-bottom:var(--space-4)}.meaning p:not(.eyebrow){max-width:42rem;font-size:var(--fs-h3);line-height:1.55}.reading aside{align-self:start;padding:var(--space-4);border:1px solid var(--ds-line);border-radius:18px;background:var(--ds-surface)}dl{margin:20px 0 0}dl div{display:flex;justify-content:space-between;gap:20px;padding:12px 0;border-bottom:1px solid var(--ds-line)}dt{color:var(--ds-dim)}dd{margin:0;text-align:right}.contract,.related{border:1px solid var(--ds-line);border-radius:18px;background:var(--ds-surface)}.contract>summary,.related>summary{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px;cursor:pointer;list-style:none}.contract summary span,.related summary span{display:grid;gap:5px}.contract summary small,.contract summary em,.related summary small,.related summary em{color:var(--ds-dim);font:11px/1.4 var(--font-mono);font-style:normal}.contract>div{padding:0 22px 22px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.contract section{min-width:0}.contract h3{font-size:15px}.contract pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;border-radius:12px;background:var(--ds-void);color:var(--ds-soft);font:12px/1.7 var(--font-mono)}.related{margin-top:18px}.related>div{padding:0 22px 22px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.related a{display:grid;gap:5px;padding:14px;border:1px solid var(--ds-line);border-radius:12px;color:var(--ds-ink);text-decoration:none}.related small{color:var(--ds-dim);font:11px/1.4 var(--font-mono)}.law{margin-top:var(--space-5);padding:var(--space-5);border-top:3px solid var(--ds-accent);border-radius:18px;background:var(--ds-surface)}.law h2{font-size:var(--fs-h2);max-width:18ch}.law p:last-child{max-width:44rem;color:var(--ds-soft);line-height:var(--lh-body)}@media(max-width:760px){main{width:min(100% - 32px,76rem)}.reading,.contract>div,.related>div{grid-template-columns:1fr}.hero h1{font-size:clamp(44px,15vw,70px)}}`;
