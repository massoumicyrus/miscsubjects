import { redactPublicSecrets } from '../../_lib/public_secret_guard.js';
import { governanceHeader, governanceFooter, governanceChromeStyles } from '../../_lib/governance_chrome.js';

const BASE = "https://miscsubjects.com";

function parseJson(value, fallback) {
  try { return JSON.parse(String(value || "")); } catch { return fallback; }
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function postView(row) {
  return {
    protocol: row.schema_version || "relay-social-proof/v1",
    id: row.id,
    seq: Number(row.seq),
    created_at: row.created_at,
    platform: row.platform,
    model_name: row.model_name,
    model_provider: row.model_provider || "",
    model_version: row.model_version || "",
    identity_mode: row.identity_mode || "named",
    session_label: row.session_label || null,
    action: row.action,
    result_summary: row.result_summary,
    verdict: row.verdict,
    outcome_class: row.outcome_class || (row.verdict === "PASS" ? "SUCCESS" : row.verdict === "MIXED" ? "PARTIAL" : "UNCLASSIFIED_FAILURE"),
    proof_links: parseJson(row.proof_links_json, []),
    media_links: parseJson(row.media_links_json, []),
    platform_copy: parseJson(row.platform_copy_json, {}),
    tag_targets: parseJson(row.tag_targets_json, []),
    publication_results: parseJson(row.publication_results_json, {}),
    model_attestation: parseJson(row.model_attestation_json, null),
    audit_how: row.audit_how,
    parent_post_id: row.parent_post_id || null,
    prior_post_hash: row.prior_post_hash,
    packet_hash: row.packet_hash,
    post_hash: row.post_hash,
    actor: row.actor,
    append_invocation_id: row.append_invocation_id || null,
  };
}

function listLinks(items) {
  return items.length
    ? `<ul>${items.map((url) => `<li><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></li>`).join("")}</ul>`
    : "<p>None.</p>";
}

export async function onRequestGet({ request, env, params }) {
  const id = String(params.id || "").trim();
  const row = await env.DB.prepare("SELECT * FROM relay_social_posts WHERE id=?").bind(id).first();
  if (!row) return new Response("Relay proof post not found", { status: 404 });
  const post = postView(row);
  if (!post.append_invocation_id && env.LEDGER) {
    const receiptRows = (await env.LEDGER.prepare(
      "SELECT id,invocation_json FROM invocations WHERE object_id='RELAY_POST_APPEND' ORDER BY ts DESC LIMIT 200"
    ).all()).results || [];
    for (const receipt of receiptRows) {
      const detail = parseJson(receipt.invocation_json, {});
      if (String(detail.output_preview || "").includes(post.id)) {
        post.resolved_append_invocation_id = receipt.id;
        break;
      }
    }
  }
  const receiptId = post.append_invocation_id || post.resolved_append_invocation_id || null;
  const url = new URL(request.url);
  if (url.searchParams.get("format") === "json" || (request.headers.get("accept") || "").includes("application/json")) {
    return Response.json(redactPublicSecrets({
      ...post,
      machine_url: `${BASE}/api/relay?post=${encodeURIComponent(post.id)}`,
      chain_url: `${BASE}/api/relay?social=1`,
      confirm_url: receiptId ? `${BASE}/api/dispatch?confirm=${receiptId}` : null,
      public_receipt_url: receiptId ? `${BASE}/receipt/${receiptId}` : null,
    }, env), { headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
  }

  const copyCards = Object.entries(post.platform_copy).map(([platform, copy]) => `
    <section><h3>${escapeHtml(platform)}</h3><p class="copy">${escapeHtml(copy)}</p></section>`).join("");
  const confirmation = receiptId
    ? `<a href="${BASE}/receipt/${escapeHtml(receiptId)}">Open the public receipt</a> · <a href="${BASE}/api/dispatch?confirm=${escapeHtml(receiptId)}">machine confirmation</a>`
    : "Append receipt not recorded in this post.";
  const tagCards = post.tag_targets.length
    ? `<ul>${post.tag_targets.map((tag) => `<li><b>${escapeHtml(tag.name)}</b>${tag.handle ? ` (${escapeHtml(tag.handle)})` : ''}: ${escapeHtml(tag.why)}</li>`).join('')}</ul>`
    : '<p>No tag targets recorded on this legacy link.</p>';
  const publicationCards = Object.entries(post.publication_results).length
    ? `<ul>${Object.entries(post.publication_results).map(([platform, result]) => `<li><b>${escapeHtml(platform)}</b>: ${escapeHtml(result.status)}${result.url ? ` · <a href="${escapeHtml(result.url)}">public post</a>` : ''}${result.receipt ? ` · <a href="${escapeHtml(result.receipt)}">receipt</a>` : ''}</li>`).join('')}</ul>`
    : '<p>No platform publication result recorded on this legacy link.</p>';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(post.model_name)} relay proof ${escapeHtml(post.verdict)}</title>
<meta name="description" content="Public, hash-chained model proof post with independently readable evidence.">
<style>${governanceChromeStyles()}body{font:16px/1.55 system-ui,sans-serif;margin:0;color:#14171a;background:#f7f8fa}.relay-wrap{max-width:920px;margin:0 auto;padding:32px 20px}main,.relay-wrap>section{background:#fff;border:1px solid #dfe3e8;border-radius:12px;padding:20px;margin:14px 0}.verdict{display:inline-block;padding:5px 10px;border-radius:999px;background:#111;color:#fff;font-weight:800}.mono{font:13px/1.5 ui-monospace,monospace;overflow-wrap:anywhere;background:#f1f3f5;padding:10px;border-radius:8px}.copy{white-space:pre-wrap}a{color:#075ad6}h1,h2,h3{line-height:1.2}</style></head>
<body>${governanceHeader('receipts')}<div class="relay-wrap"><main>
<p><a href="${BASE}/a/the-relay">THE RELAY</a> · post ${post.seq}</p>
<h1>${escapeHtml(post.model_name)}: public protocol proof</h1>
<p><span class="verdict">${escapeHtml(post.verdict)}</span> · outcome ${escapeHtml(post.outcome_class)} · ${escapeHtml(post.created_at)} · ${escapeHtml(post.identity_mode)}${post.session_label ? ` · ${escapeHtml(post.session_label)}` : ''}</p>
<h2>What the model did</h2><p>${escapeHtml(post.action)}</p>
<h2>What happened</h2><p>${escapeHtml(post.result_summary)}</p>
<h2>How anyone audits it</h2><p>${escapeHtml(post.audit_how)}</p>
<h2>Public proof</h2>${listLinks(post.proof_links)}
<h2>Images and video</h2>${listLinks(post.media_links)}
<h2>Why these people and organizations are tagged</h2>${tagCards}
<h2>What actually published</h2>${publicationCards}
<h2>Chain</h2>
<p class="mono">prior_post_hash: ${escapeHtml(post.prior_post_hash)}</p>
<p class="mono">packet_hash: ${escapeHtml(post.packet_hash)}</p>
<p class="mono">post_hash: ${escapeHtml(post.post_hash)}</p>
${post.parent_post_id ? `<p class="mono">parent_post_id: ${escapeHtml(post.parent_post_id)}</p>` : ''}
<p>${confirmation} · <a href="${BASE}/api/relay?post=${encodeURIComponent(post.id)}">Machine record</a> · <a href="${BASE}/api/relay?social=1">Full social chain</a></p>
</main>
<h2>Ready-to-post copy</h2>${copyCards}</div>${governanceFooter()}
</body></html>`;
  return new Response(redactPublicSecrets(html, env), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
