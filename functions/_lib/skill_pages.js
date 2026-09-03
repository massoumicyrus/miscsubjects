// SKILLS FRONT — the loop's public face. One identity per skill:
// human page (/skills/<name>), machine object (/api/skills/<name>),
// raw SKILL.md (/api/skills/<name>/skill), downloadable folder (?bundle=1).
// Canonical source stays the SKILL.md file in both runtime trees; these pages
// render the registry projection and never fork the content.

import { SKILL_REGISTRY, skillByName } from "./skill_registry.js";

export { SKILL_REGISTRY, skillByName };

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function safeHref(url) {
  const u = String(url || "").trim();
  if (/^https?:\/\//i.test(u) || u.startsWith("/")) return u;
  return null;
}

// Minimal, escape-first markdown for skill bodies: headings, fenced code,
// inline code/bold/italic/links, lists, tables, quotes, rules, paragraphs.
export function skillMarkdownToHtml(md) {
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let para = [];
  let list = null; // 'ul' | 'ol'
  let quote = [];
  let code = null; // {lang, lines}
  let table = null; // rows[]

  const inline = (t) => {
    let s = esc(t);
    s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const href = safeHref(url);
      return href ? `<a href="${esc(href)}">${label}</a>` : label;
    });
    return s;
  };
  const flushPara = () => {
    if (para.length) {
      html += `<p>${inline(para.join(" "))}</p>`;
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      html += `</${list}>`;
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      html += `<blockquote>${quote.map(inline).join("<br>")}</blockquote>`;
      quote = [];
    }
  };
  const flushTable = () => {
    if (table && table.length) {
      const [head, ...rest] = table;
      const body = rest.filter((r) => !/^[\s|:-]+$/.test(r.join("")));
      html +=
        `<div class="sk-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` +
        `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    }
    table = null;
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
    flushTable();
  };

  for (const lineRaw of lines) {
    const line = lineRaw;
    if (code) {
      if (/^```/.test(line.trim())) {
        html += `<pre class="sk-code"><code>${esc(code.lines.join("\n"))}</code></pre>`;
        code = null;
      } else code.lines.push(line);
      continue;
    }
    const t = line.trim();
    if (/^```/.test(t)) {
      flushAll();
      code = { lang: t.slice(3).trim(), lines: [] };
      continue;
    }
    if (!t) {
      flushAll();
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    if (h) {
      flushAll();
      const level = Math.min(h[1].length + 1, 5); // skill h1 → page h2
      html += `<h${level}>${inline(h[2])}</h${level}>`;
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(t)) {
      flushAll();
      html += "<hr>";
      continue;
    }
    if (t.startsWith("|") && t.endsWith("|")) {
      flushPara();
      flushList();
      flushQuote();
      const cells = t.slice(1, -1).split("|").map((c) => c.trim());
      (table = table || []).push(cells);
      continue;
    }
    if (t.startsWith(">")) {
      flushPara();
      flushList();
      flushTable();
      quote.push(t.replace(/^>\s?/, ""));
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(t);
    const ol = /^\d+\.\s+(.*)$/.exec(t);
    if (ul || ol) {
      flushPara();
      flushQuote();
      flushTable();
      const kind = ul ? "ul" : "ol";
      if (list !== kind) {
        flushList();
        html += `<${kind}>`;
        list = kind;
      }
      html += `<li>${inline((ul || ol)[1])}</li>`;
      continue;
    }
    flushList();
    flushQuote();
    flushTable();
    para.push(t);
  }
  flushAll();
  if (code) html += `<pre class="sk-code"><code>${esc(code.lines.join("\n"))}</code></pre>`;
  return html;
}

export const SKILL_FAMILY_ORDER = ["laws", "the loop", "code discipline", "craft"];

export function skillFamilies() {
  const map = new Map();
  for (const s of SKILL_REGISTRY.skills) {
    if (!map.has(s.family)) map.set(s.family, []);
    map.get(s.family).push(s);
  }
  return map;
}

export const SKILLS_PAGE_STYLE = `
main{width:min(78rem,calc(100% - 40px));margin:auto}
.sk-hero{padding:clamp(70px,10vw,130px) 0 var(--space-4);border-bottom:1px solid var(--ds-line)}
.eyebrow{font:700 var(--fs-eye)/1 var(--font-mono);letter-spacing:var(--track-eye);text-transform:uppercase;color:var(--ds-accent)}
.sk-hero h1{max-width:16ch;margin:var(--space-3) 0;font-size:var(--fs-display);line-height:var(--lh-display)}
.sk-hero .lead{max-width:48rem;font-size:var(--fs-lead);line-height:1.55;color:var(--ds-soft)}
.sk-loopline{margin-top:var(--space-3);font:600 13px/1.6 var(--font-mono);color:var(--ds-dim)}
.sk-family{padding:var(--space-5) 0;border-top:1px solid var(--ds-line)}
.sk-family>header{display:flex;align-items:baseline;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-4)}
.sk-family h2{margin:0;font-size:var(--fs-h2)}
.sk-family .count{font:700 11px/1 var(--font-mono);color:var(--ds-dim);letter-spacing:.08em;text-transform:uppercase}
.sk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:var(--space-3)}
.sk-card{display:flex;flex-direction:column;gap:10px;padding:var(--space-3);border:1px solid var(--ds-line);border-radius:14px;background:var(--ds-surface)}
.sk-card h3{margin:0;font-size:var(--fs-h3)}
.sk-card h3 a{color:inherit;text-decoration:none}
.sk-card h3 a:hover{color:var(--ds-accent)}
.sk-card .desc{margin:0;color:var(--ds-soft);font-size:14px;line-height:1.55;flex:1}
.sk-card .prevented{margin:0;padding-top:10px;border-top:1px dashed var(--ds-line);color:var(--ds-dim);font-size:12.5px;line-height:1.5}
.sk-card .prevented b{color:var(--ds-soft)}
.sk-card .meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font:600 11px/1 var(--font-mono);color:var(--ds-dim)}
.sk-card .meta .pill{border:1px solid var(--ds-line);border-radius:999px;padding:4px 9px}
.sk-card .links{display:flex;flex-wrap:wrap;gap:12px;font-size:13px}
.sk-card .links a{color:var(--ds-accent);text-decoration:none;font-weight:700}
.sk-card .links a:hover{text-decoration:underline}
.sk-provenance{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--space-3);margin:var(--space-4) 0;padding:var(--space-4);border:1px solid var(--ds-line);border-radius:16px;background:var(--ds-surface)}
.sk-provenance div{display:grid;gap:6px}
.sk-provenance dt{font:700 10px/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ds-dim)}
.sk-provenance dd{margin:0;font-size:14px;line-height:1.55;color:var(--ds-soft)}
.sk-provenance dd a{color:var(--ds-accent)}
.sk-prevented-panel{margin:var(--space-4) 0;padding:var(--space-4);border-left:3px solid var(--ds-accent);background:var(--ds-surface);border-radius:0 14px 14px 0}
.sk-prevented-panel .eyebrow{margin-bottom:8px;display:block}
.sk-prevented-panel p{margin:6px 0;max-width:52rem;color:var(--ds-soft);line-height:1.6}
.sk-prevented-panel p b{color:var(--ds-ink)}
.sk-body{padding:var(--space-4) 0 var(--space-5);max-width:52rem}
.sk-body h2{font-size:var(--fs-h2);margin:var(--space-4) 0 var(--space-2)}
.sk-body h3{font-size:var(--fs-h3);margin:var(--space-3) 0 var(--space-2)}
.sk-body h4,.sk-body h5{margin:var(--space-3) 0 8px}
.sk-body p,.sk-body li{color:var(--ds-soft);line-height:1.65;font-size:var(--fs-body)}
.sk-body li{margin:6px 0}
.sk-body code{font:600 .85em/1 var(--font-mono);background:var(--ds-raised);border:1px solid var(--ds-line);border-radius:6px;padding:1px 6px}
.sk-body pre.sk-code{overflow-x:auto;padding:var(--space-3);background:var(--ds-raised);border:1px solid var(--ds-line);border-radius:12px}
.sk-body pre.sk-code code{background:none;border:0;padding:0;font-weight:500;line-height:1.6}
.sk-body blockquote{margin:var(--space-3) 0;padding:10px var(--space-3);border-left:3px solid var(--ds-line);color:var(--ds-dim)}
.sk-body .sk-table{overflow-x:auto}
.sk-body table{border-collapse:collapse;width:100%;font-size:14px}
.sk-body th,.sk-body td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--ds-line);vertical-align:top}
.sk-body th{font:700 11px/1.3 var(--font-mono);text-transform:uppercase;letter-spacing:.06em;color:var(--ds-dim)}
.sk-files{margin:0 0 var(--space-5);padding:var(--space-3);border:1px dashed var(--ds-line);border-radius:12px}
.sk-files summary{cursor:pointer;font:700 12px/1 var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ds-dim)}
.sk-files ul{list-style:none;margin:10px 0 0;padding:0;font:500 13px/1.9 var(--font-mono);color:var(--ds-soft)}
.sk-traverse{display:flex;flex-wrap:wrap;gap:10px;padding:0 0 clamp(80px,10vw,140px)}
.sk-traverse a{display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border:1px solid var(--ds-line);border-radius:999px;color:var(--ds-soft);text-decoration:none;font-size:13px;font-weight:700}
.sk-traverse a:hover{border-color:var(--ds-accent);color:var(--ds-accent)}
.machine-url{display:inline-flex;align-items:center;gap:6px;color:var(--ds-dim);font:12px/1.5 var(--font-body)}
.machine-url code{font:600 12px/1.5 var(--font-mono);color:var(--ds-soft);background:var(--ds-raised);border:1px dashed var(--ds-line);border-radius:6px;padding:1px 6px}
.sk-private-note{color:var(--ds-dim);font-size:13px;padding:var(--space-3) 0 clamp(60px,8vw,100px)}
@media(max-width:760px){.sk-grid{grid-template-columns:1fr}}
`;
