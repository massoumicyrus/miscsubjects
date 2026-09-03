import { loadExecutionCase, renderExecutionCaseHtml } from '../_lib/execution_case.js';
import { listSends, renderReviewHtml } from '../_lib/execution_case_review.js';
import { isBuildAuthed } from '../_lib/admin_session.js';

function taskIdOf(context) {
  const raw = context.params?.path;
  const parts = Array.isArray(raw) ? raw : String(raw || '').split('/');
  return String(parts[0] || '').toUpperCase();
}

function subOf(context) {
  const raw = context.params?.path;
  const parts = Array.isArray(raw) ? raw : String(raw || '').split('/');
  return String(parts[1] || '').toLowerCase();
}

function page(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=30' },
  });
}

export async function onRequestGet(context) {
  const taskId = taskIdOf(context);
  if (!/^WT-\d{4}$/.test(taskId)) return Response.redirect('https://miscsubjects.com/a/the-run-that-found-you', 302);
  // The owner's exact-review page. Behind the admin session; never cached.
  if (subOf(context) === 'review') {
    if (!(await isBuildAuthed(context.request, context.env))) return page('<h1>Not found</h1>', 404);
    const rows = await listSends(context.env, taskId, null);
    return new Response(renderReviewHtml(taskId, rows), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  try {
    const data = await loadExecutionCase(context.env, taskId);
    if (!data) return page('<h1>Execution case not found</h1>', 404);
    return page(renderExecutionCaseHtml(data));
  } catch (error) {
    const detail = String(error?.message || error).replace(/[<>&]/g, '');
    return page(`<main style="max-width:48rem;margin:4rem auto;font:18px/1.6 sans-serif"><h1>The execution case is not live yet.</h1><p>${detail}</p><p><a href="/a/the-run-that-found-you">Read the article</a></p></main>`, 503);
  }
}

