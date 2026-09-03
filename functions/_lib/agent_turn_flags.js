// Compute filterable issue tags for agent_turns at ingest time.
const HAZARDS = [
  'rm -rf',
  'git reset --hard',
  'git checkout --',
  'git clean -fd',
  'git push --force',
  'api/file',
  'rm -f',
];

const PROTECTED = [
  'functions/_middleware.js',
  'cloaker',
  'protected_features',
  'protected_widgets',
  '.protected/baseline',
];

const WRITE_TOOLS = /^(write|edit|strreplace|writefile|write_file|apply_patch|exec_command|bash|shell)$/i;

function blobOf(rec) {
  const tools = Array.isArray(rec.tools) ? rec.tools : [];
  const cmds = Array.isArray(rec.commands) ? rec.commands : [];
  const files = Array.isArray(rec.files_changed || rec.files) ? (rec.files_changed || rec.files) : [];
  return [
    rec.user_input,
    rec.assistant_text,
    rec.trace_id,
    rec.dispatch_key,
    JSON.stringify(tools),
    JSON.stringify(cmds),
    JSON.stringify(files),
  ].map((v) => String(v || '')).join('\n').toLowerCase();
}

export function computeAgentTurnTags(rec) {
  const tags = new Set();
  const r = rec || {};
  const blob = blobOf(r);
  const tools = Array.isArray(r.tools) ? r.tools : [];
  const files = Array.isArray(r.files_changed || r.files) ? (r.files_changed || r.files) : [];
  const cmds = Array.isArray(r.commands) ? r.commands : [];
  const nTools = Number(r.n_tools || tools.length || 0);

  if (HAZARDS.some((h) => blob.includes(h))) tags.add('risk');
  if (PROTECTED.some((p) => blob.includes(p.toLowerCase()))) tags.add('protected');
  if (files.length || tools.some((t) => WRITE_TOOLS.test(String(t.name || t.tool || '')))) tags.add('file_edit');
  if (nTools > 0) tags.add('tools');
  if (cmds.length) tags.add('shell');
  if (r.trace_id) tags.add('traced');
  if (String(r.source || '') === 'backfill') tags.add('backfill');
  if (String(r.source || '') === 'dispatch') tags.add('dispatch_only');

  const verdict = String(r.audit_verdict || '').toLowerCase();
  if (verdict === 'fail' || verdict === 'reject') tags.add('audit_fail');
  else if (verdict === 'pass' || verdict === 'approve') tags.add('audit_pass');
  else tags.add('unaudited');

  if (String(r.input_kind || '') === 'system_task') tags.add('system');
  if (nTools === 0 && !files.length && !cmds.length && String(r.source || '') !== 'dispatch') tags.add('text_only');

  return [...tags].sort();
}