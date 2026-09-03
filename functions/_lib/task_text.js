// One task row -> one plain-English line. No JSON jibberish reaches a human or a model.
// Used by /api/tasks (server `human` field) and /admin/tasks (render).

export function humanizeTask(bodyOrJob, source, id) {
  let j = bodyOrJob;
  if (typeof j === 'string') {
    const t = j.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try { j = JSON.parse(t); } catch { return t.slice(0, 400); }
    } else {
      return t.slice(0, 400) || ('Task #' + (id ?? ''));
    }
  }
  if (j == null || typeof j !== 'object') return String(j ?? ('Task #' + (id ?? '')));

  const direct = j.title || j.ask || j.item || j.detail || j.body || j.text || j.prompt || j.note;
  const role = j.role || j.phase || source || '';
  const meta = [];
  if (role) meta.push(String(role));
  if (j.slug) meta.push('slug ' + j.slug);
  if (j.model) meta.push('via ' + String(j.model).split('/').pop());
  if (Array.isArray(j.questions) && j.questions.length) meta.push(j.questions.length + ' questions');
  if (j.post_to) meta.push('posts to ' + j.post_to);

  let line;
  if (direct) {
    line = String(direct);
    if (meta.length) line += '  ·  ' + meta.join(' · ');
  } else if (meta.length) {
    line = meta.join(' · ');
  } else {
    line = JSON.stringify(j);
  }
  return line.slice(0, 400);
}
