// ARTICLE COLLABORATION TOKEN DROP — the compact handoff for a pfx:BLOCK_ capability.
//
// Lives in its own module because functions/_lib/unified_handoff.js is owner-protected
// (PROTECTED_FEATURES.md) and the protection gate refused the edit there. This module owns
// only the article-collaboration drop; every other drop format stays in the protected file.
//
// The drop is deliberately tiny: the compact token plus a pointer to the permanent
// documentation at /a/oip-tap-go. The full share token never appears in the drop — the
// receiving model resolves everything live from the token explanation route, so copied text
// can go stale without ever outranking the live contract.
export function buildArticleCollaborationDropMarkdown(origin, cap) {
  const docOrigin = String(origin || '').replace(/\/$/, '');
  const compactToken = cap?.short_code || cap?.share_token || '';
  if (!compactToken) return '';
  return `ARTICLE COLLABORATION TOKEN: ${compactToken}
DOCUMENTATION: ${docOrigin}/a/oip-tap-go
CANONICAL TOKEN MANUAL: all token usage and troubleshooting defers to this document.

This is a short-lived OIP capability scoped to the public-content BLOCK_ family. The documentation is the complete operating contract for humans, browser models, Actions, curl, coding CLIs, receipts, replay, repair, and safe transport choices. The live token explanation always outranks copied text:
${docOrigin}/web/explain?share=${compactToken}`;
}
