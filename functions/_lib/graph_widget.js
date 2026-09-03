// Embeddable evidence map widget for /a/{slug} articles.

import {
  buildArticleGraphContext,
  forwardMapLabel,
  slugDisplayTitle,
} from "./graph_explorer.js";
import { COLORS } from "./design/tokens/core.js";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function graphWidgetStyles(ink, line, accent) {
  const phi = "var(--phi, 1.618)";
  const u = "var(--u, 18px)";
  // Warm editorial theme — same tokens as the rest of the page. No dark surface, no neon.
  ink = COLORS.ink;
  accent = COLORS.accent;
  const soft = COLORS.soft;
  const dim = COLORS.dim;
  const surface = COLORS.surface;
  const raised = COLORS.raised;
  return `
.graph-map-widget{
  margin:calc(${u}*${phi}) 0 calc(${u}*0.618);
  border:1px solid ${line};
  border-radius:calc(${u}*0.618);
  background:${surface};
  overflow:hidden;
}
.graph-map-widget>summary{cursor:pointer;list-style:none;padding:18px 20px;color:${ink};font:700 14px/1.3 var(--font);display:flex;align-items:center;justify-content:space-between;gap:12px}.graph-map-widget>summary::-webkit-details-marker{display:none}.graph-map-widget>summary::after{content:'+';color:${accent};font-size:22px}.graph-map-widget[open]>summary{border-bottom:1px solid ${line}}.graph-map-widget[open]>summary::after{content:'−'}
.gmw-head{
  display:grid;
  grid-template-columns:1fr auto;
  gap:calc(${u}*0.382) calc(${u}*0.618);
  padding:calc(${u}*0.618) calc(${u}*0.72);
  border-bottom:1px solid ${line};
  align-items:end;
}
.gmw-head-main{display:flex;flex-direction:column;gap:calc(${u}*0.22)}
.gmw-kicker{
  font:600 calc(${u}*0.611)/1 ui-sans-serif,system-ui,sans-serif;
  letter-spacing:0.14em;
  text-transform:uppercase;
  color:${accent};
  margin:0;
}
.gmw-title{
  font:700 calc(${u}*0.722)/1.15 ui-sans-serif,system-ui,sans-serif;
  letter-spacing:-0.02em;
  color:${ink};
  margin:0;
}
.gmw-sub{
  font:400 calc(${u}*0.611)/1.45 ui-sans-serif,system-ui,sans-serif;
  color:${soft};
  margin:0;
  max-width:38em;
}
.gmw-open{
  font:600 calc(${u}*0.611)/1 ui-sans-serif,system-ui,sans-serif;
  color:${accent};
  text-decoration:none;
  white-space:nowrap;
}
.gmw-open:hover{text-decoration:underline}
.gmw-frame{
  display:block;width:100%;
  height:min(calc(${u}*${phi}*${phi}*1.15),58vh);
  border:0;background:${raised};
}
.gmw-jump{
  display:flex;flex-wrap:wrap;gap:calc(${u}*0.34) calc(${u}*0.55);
  padding:calc(${u}*0.45) calc(${u}*0.72) calc(${u}*0.55);
  border-top:1px solid ${line};
  background:${surface};
  font:500 calc(${u}*0.611)/1.35 ui-sans-serif,system-ui,sans-serif;
}
.gmw-jump-label{color:${dim};letter-spacing:0.06em;text-transform:uppercase;font-size:calc(${u}*0.55)}
.gmw-jump a{color:${ink};text-decoration:none;border-bottom:1px solid transparent}
.gmw-jump a:hover{border-bottom-color:${accent};color:${accent}}
.gmw-jump .hm{color:${dim};font-size:calc(${u}*0.5)}
`;
}

export async function renderArticleGraphWidget(env, slug, title, ctxIn) {
  const ctx = ctxIn || (await buildArticleGraphContext(env, slug));
  if (!ctx.show) return "";

  const embedUrl =
    `/graph?embed=1&theme=dark&slug=${encodeURIComponent(slug)}` +
    (ctx.mode ? `&mode=${encodeURIComponent(ctx.mode)}` : "") +
    (ctx.selected ? `&focus=${encodeURIComponent(ctx.selected)}` : "");

  const fullUrl =
    `/graph?slug=${encodeURIComponent(slug)}` +
    (ctx.mode ? `&mode=${encodeURIComponent(ctx.mode)}` : "");

  const mapLabel = forwardMapLabel(ctx);
  const topLinks = (ctx.forward || [])
    .slice()
    .sort((a, b) => (b.human || 0) - (a.human || 0))
    .slice(0, 4)
    .map((l) => {
      const label = esc(slugDisplayTitle(l.slug, l.title));
      const hm = l.human ? `<span class="hm"> · ${l.human} human</span>` : "";
      return `<a href="/a/${esc(l.slug)}">${label}${hm}</a>`;
    })
    .join("");

  // Editorial pages get a clean, warm "related articles" block — not an embedded dark canvas.
  // The full interactive map stays one click away for anyone who wants it.
  if (!topLinks) return "";
  return (
    `<details class="graph-map-widget" aria-label="Related articles"><summary>Explore this article's relationships</summary>` +
    `<div class="gmw-head">` +
    `<div class="gmw-head-main">` +
    `<p class="gmw-kicker">${esc(mapLabel)}</p>` +
    `<h2 class="gmw-title">Connected articles</h2>` +
    `<p class="gmw-sub">Where this sits in the evidence graph. Open the full interactive map for the whole neighborhood.</p>` +
    `</div>` +
    `<a class="gmw-open" href="${esc(fullUrl)}" target="_blank" rel="noopener">Full map →</a>` +
    `</div>` +
    `<div class="gmw-jump" aria-label="Connected articles">` +
    `<span class="gmw-jump-label">Related</span>${topLinks}` +
    `</div>` +
    `</details>`
  );
}
