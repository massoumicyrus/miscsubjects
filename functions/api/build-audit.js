import { buildAuditDropMarkdown, buildAuditMarkdown, buildAuditRecord } from '../_lib/build_audit.js';

export async function onRequestGet(context) {
  const record = await buildAuditRecord(context.env, context.request.url);
  const url = new URL(context.request.url);
  const format = url.searchParams.get('format');

  if (format === 'drop') {
    return new Response(buildAuditDropMarkdown(record), {
      headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
    });
  }
  if (format === 'markdown' || format === 'md') {
    return new Response(buildAuditMarkdown(record), {
      headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
    });
  }
  return new Response(JSON.stringify(record, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
  });
}
