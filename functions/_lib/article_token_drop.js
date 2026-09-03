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
