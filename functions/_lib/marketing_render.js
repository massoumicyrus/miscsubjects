/** Shared HTML render helpers for /admin/marketing — SSR + client refresh must match. */

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function tableHtml(rows, cols) {
  if (!rows || !rows.length) return '<p class="muted">(empty)</p>';
  let h = '<table><thead><tr>' + cols.map((c) => '<th>' + esc(c.label) + '</th>').join('') + '</tr></thead><tbody>';
  for (const r of rows) {
    h += '<tr>' + cols.map((c) => {
      const raw = c.fmt ? c.fmt(r) : r[c.key];
      const cell = c.html ? String(raw == null ? '' : raw) : esc(raw);
      return '<td>' + cell + '</td>';
    }).join('') + '</tr>';
  }
  return h + '</tbody></table>';
}

export function renderAccountsLive(live) {
  if (!live || !live.ok) {
    return '<p class="err">' + esc(JSON.stringify(live?.errors || live || { error: 'meta_live_failed' })) + '</p>';
  }
  return '<p class="ok">' + live.count + ' accounts (business ' + esc(live.business_id) + ')</p>'
    + tableHtml(live.accounts || [], [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'account_status', label: 'Status' },
      { key: 'currency', label: 'Cur' },
      { key: 'id', label: '', html: true, fmt: (row) => '<a href="#" data-act="' + esc(row.id) + '">drill</a>' },
    ]);
}

export function renderAccountsLbl(lbl) {
  if (!lbl || lbl.error) {
    const hint = lbl?.hint ? ' — ' + lbl.hint : '';
    return '<p class="err">' + esc(String(lbl?.error || 'lbl_unavailable')) + esc(hint) + '</p>';
  }
  return tableHtml(lbl.rows || [], [
    { key: 'account_id', label: 'Account' },
    { key: 'account_name', label: 'Name' },
    { key: 'campaigns', label: 'Campaigns' },
    { key: 'ads', label: 'Ads' },
    { key: 'spend_cents', label: 'Spend ¢', fmt: (r) => (Number(r.spend_cents || 0) / 100).toFixed(2) },
    { key: 'purchases', label: 'Purchases' },
  ]);
}

export function renderCreatives(lbl) {
  if (!lbl || lbl.error) return '<p class="err">' + esc(String(lbl.error || 'lbl_creatives_failed')) + '</p>';
  const rows = lbl.rows || [];
  return tableHtml(rows.slice(0, 100), [
    { key: 'headline', label: 'Headline' },
    { key: 'ad_count', label: 'Ads' },
    { key: 'spend_cents', label: 'Spend ¢', fmt: (r) => (Number(r.spend_cents || 0) / 100).toFixed(2) },
    { key: 'link_clicks', label: 'Clicks' },
    { key: 'website_url', label: 'URL' },
  ]);
}

export function renderCloaker(data) {
  if (!data || data.error) return '<p class="err">' + esc(String(data?.error || 'cloaker_failed')) + '</p>';
  const rows = data.rows || data.results || (Array.isArray(data) ? data : []);
  return tableHtml(rows, [
    { key: 'received_at', label: 'Time' },
    { key: 'slug', label: 'Slug' },
    { key: 'classification', label: 'Class' },
    { key: 'country', label: 'Country' },
    { key: 'device', label: 'Device' },
    { key: 'referer', label: 'Referer' },
  ]);
}

export function renderLedgerStrip(events) {
  if (!events || !events.length) return '<p class="muted">No marketing ledger events yet.</p>';
  let h = '<table><thead><tr><th>Time</th><th>Key</th><th>Action</th><th>Status</th><th>Trace</th></tr></thead><tbody>';
  for (const e of events) {
    const trace = e.trace_id ? '<a href="/admin/ledger?trace=' + esc(e.trace_id) + '">' + esc(e.trace_id) + '</a>' : '—';
    h += '<tr><td>' + esc(String(e.ts || '').replace('T', ' ').slice(0, 19))
      + '</td><td>' + esc(e.key) + '</td><td>' + esc(e.action)
      + '</td><td>' + esc(e.status) + '</td><td>' + trace + '</td></tr>';
  }
  return h + '</tbody></table>';
}