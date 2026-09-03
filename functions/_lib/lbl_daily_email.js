// LBL nightly team report — a narrated read of yesterday, then each source speaking for
// itself: BigCommerce (store truth), Triple Whale (ad attribution, honest per-channel ROAS),
// Klaviyo (owned channels). Data is the LBL platform's live /v1/today, where every source
// reports ok|unavailable — an unavailable source is named in the email, never rendered as zero.
//
// EMAIL_HTML_LAW (owner order 2026-08-07): this report ships a REAL styled HTML part — white
// page, black headings, ruled tables, monospace numbers — alongside the plain-text fallback.
// The owner received the first proof as raw text and called it illegible; that class of email
// is now impossible (see also ensureHtmlPart in functions/api/email/send.js).
//
// Lives in its own module because functions/_lib/fn_runners.js is owner-locked
// (PROTECTED_FEATURES.md). Recipients come from settings.lbl_daily_recipients and default to
// the owner alone until he approves the format for the team.

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Source Sans 3',sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function htmlTable(headers, rows) {
  const th = headers.map((h, i) =>
    `<th style="text-align:${i === 0 ? 'left' : 'right'};font-family:${FONT};font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#666666;font-weight:600;padding:6px ${i === 0 ? '12px 6px 0' : '0 6px 12px'};border-bottom:2px solid #000000">${escHtml(h)}</th>`).join('');
  const trs = rows.map((r) => '<tr>' + r.map((c, i) =>
    `<td style="text-align:${i === 0 ? 'left' : 'right'};font-family:${i === 0 ? FONT : MONO};font-size:${i === 0 ? '14px' : '13px'};color:#000000;padding:7px ${i === 0 ? '12px 7px 0' : '0 7px 12px'};border-bottom:1px solid #e5e5e5;white-space:nowrap">${escHtml(c)}</td>`).join('') + '</tr>').join('');
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 8px">${'<tr>' + th + '</tr>'}${trs}</table>`;
}

function section(title, source, innerHtml) {
  return `<div style="margin:26px 0 0">
<div style="font-family:${FONT};font-size:17px;font-weight:700;color:#000000">${escHtml(title)}</div>
<div style="font-family:${FONT};font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#666666;margin:2px 0 10px">${escHtml(source)}</div>
${innerHtml}</div>`;
}

function unavailableHtml(detail) {
  return `<div style="border:1px dashed #999999;color:#666666;padding:10px 12px;border-radius:6px;font-family:${FONT};font-size:14px">unavailable — ${escHtml(detail || 'no detail')}. Nothing is substituted.</div>`;
}

export async function sendLblDailyEmail(env, modeArg) {
  const mode = String(modeArg || '').trim().toLowerCase();
  const syncKey = env.LBL_SYNC_KEY || '';
  if (!syncKey) return { ok: false, error: 'LBL_SYNC_KEY missing — set with: wrangler pages secret put LBL_SYNC_KEY --project-name loop-safe-miscsubjects' };
  const grab = async (u) => { try { const r = await fetch(u, { headers: { 'x-sync-key': syncKey } }); return await r.json(); } catch (e) { return { _err: String((e && e.message) || e) }; } };
  const live = await grab('https://api.lbl.fyi/v1/today');
  if (!live || live._err || !live.meta) return { ok: false, error: 'lbl /v1/today unreachable: ' + ((live && live._err) || 'no meta') };
  const day = live.meta.yesterday;
  const d = await grab('https://api.lbl.fyi/v1/today?date=' + day);
  if (!d || d._err || !d.meta) return { ok: false, error: 'lbl /v1/today?date unreachable: ' + ((d && d._err) || 'no meta') };

  const $ = (c) => (c == null || !isFinite(c)) ? 'unavailable' : '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (v) => (v == null || !isFinite(v)) ? 'unavailable' : Math.round(v).toLocaleString('en-US');
  const pct = (a, b) => (b ? Math.round(Math.abs(a - b) / b * 100) + '%' : '');
  const pretty = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z'));
  const tz = String(d.meta.store_timezone || 'UTC');
  const bc = d.bigcommerce || {}, tw = d.triplewhale || {}, kl = d.klaviyo || {};
  const bcOk = bc.status === 'ok', twOk = tw.status === 'ok', klOk = kl.status === 'ok';
  const spenders = twOk ? (tw.day.channels || []).filter((c) => c.spend_cents > 0) : [];
  const klE = klOk ? (kl.day.email || { revenue_cents: 0, orders: 0 }) : null;
  const klS = klOk ? (kl.day.sms || { revenue_cents: 0, orders: 0 }) : null;
  const per = (d.periods || []).find((p) => p.key === 'today') || {};
  const cust = per.customers || {};
  const ms = per.meta || {};

  // THE READ — one narrated paragraph. Nothing invented; an unexplained number says so.
  const read = [];
  if (bcOk) {
    const y = bc.day;
    const prior = (bc.per_day || []).filter((r) => r.date < day);
    const avg = prior.length ? Math.round(prior.reduce((a, r) => a + r.gross_cents, 0) / prior.length) : null;
    let s = 'Yesterday the store did ' + $(y.gross_cents) + ' across ' + num(y.orders) + ' orders (average order ' + $(y.aov_cents) + ')';
    if (avg) s += ', ' + (y.gross_cents >= avg ? 'up ' : 'down ') + pct(y.gross_cents, avg) + ' against the month-to-date daily average of ' + $(avg);
    s += y.refunds_cents ? '. Refunds took back ' + $(y.refunds_cents) + '.' : '.';
    read.push(s);
  } else read.push('BigCommerce did not answer this morning (' + String(bc.error || 'no detail') + '), so store revenue for yesterday is marked unavailable — nothing is substituted.');
  if (twOk) {
    if (spenders.length) {
      const s = spenders.map((c) => c.channel + ' spent ' + $(c.spend_cents) + ' with ' + $(c.attributed_revenue_cents) + ' attributed' + (c.roas != null ? ' — a true ROAS of ' + c.roas.toFixed(2) : ' — spend too small for a meaningful ROAS')).join('; ');
      read.push('On the ad side, ' + s + '. Every other channel spent nothing.');
    } else read.push('No ad channel recorded spend yesterday.');
  } else read.push('Triple Whale did not answer (' + String(tw.error || 'no detail') + '); ad spend and attribution are unavailable, not zero.');
  if (klOk) read.push('Email brought in ' + $(klE.revenue_cents) + ' across ' + num(klE.orders) + ' orders' + ((klS.revenue_cents || klS.orders) ? '; SMS ' + $(klS.revenue_cents) + ' across ' + num(klS.orders) + '.' : '; SMS was quiet.'));
  else read.push('Klaviyo did not answer (' + String(kl.error || 'no detail') + '); owned-channel revenue is unavailable.');
  if (cust.new != null) read.push(num(cust.new) + ' new customers to the organization, ' + num(cust.returning) + ' returning.' + (ms.customers != null ? ' Of the Meta-attributed customers, ' + num(ms.new_customers) + ' new and ' + num(ms.existing_customers) + ' existing — distinct from ROAS, which is unchanged.' : ''));
  if (bcOk && twOk && klOk) {
    const claimed = (tw.day.channels || []).reduce((a, c) => a + (c.attributed_revenue_cents || 0), 0) + klE.revenue_cents + klS.revenue_cents;
    const un = bc.day.gross_cents - claimed;
    if (bc.day.gross_cents > 0 && un > bc.day.gross_cents * 0.4) {
      read.push($(un) + ' of the day is claimed by no ad or owned channel. The cause is not in the data, so it stays unexplained — if someone on the team knows what drove it, that belongs in the record.');
    }
  }
  const readText = read.join(' ');

  // ---- plain-text fallback --------------------------------------------------
  const lines = [];
  lines.push('LOOP BIO LABS — DAILY READ');
  lines.push(pretty + ' (store time, ' + tz + ')');
  lines.push('');
  lines.push('THE READ');
  lines.push(readText);
  lines.push('');
  lines.push('WHAT BIGCOMMERCE REPORTS — store truth');
  if (bcOk) {
    lines.push('  Yesterday       ' + num(bc.day.orders) + ' orders · ' + $(bc.day.gross_cents) + ' gross · ' + $(bc.day.refunds_cents) + ' refunded · avg ' + $(bc.day.aov_cents));
    lines.push('  Month to date   ' + num(bc.mtd.orders) + ' orders · ' + $(bc.mtd.gross_cents) + ' gross · ' + $(bc.mtd.refunds_cents) + ' refunded · avg ' + $(bc.mtd.aov_cents));
    for (const r of bc.per_day || []) lines.push('    ' + r.date + '   ' + String(num(r.orders)).padStart(4) + ' orders   ' + $(r.gross_cents));
  } else lines.push('  unavailable — ' + String(bc.error || 'no detail'));
  lines.push('');
  lines.push('WHAT TRIPLE WHALE REPORTS — ad attribution');
  if (twOk) {
    for (const c of (tw.day.channels || [])) lines.push('  ' + c.channel.padEnd(10) + ' spend ' + $(c.spend_cents) + ' · attributed ' + $(c.attributed_revenue_cents) + ' · ROAS ' + (c.roas != null ? c.roas.toFixed(2) : '—'));
    for (const c of (tw.mtd.channels || [])) lines.push('  MTD ' + c.channel.padEnd(10) + ' spend ' + $(c.spend_cents) + ' · attributed ' + $(c.attributed_revenue_cents) + ' · ROAS ' + (c.roas != null ? c.roas.toFixed(2) : '—'));
  } else lines.push('  unavailable — ' + String(tw.error || 'no detail'));
  lines.push('');
  lines.push('WHAT KLAVIYO REPORTS — owned channels');
  if (klOk) {
    lines.push('  Yesterday email ' + $(klE.revenue_cents) + ' (' + num(klE.orders) + ') · sms ' + $(klS.revenue_cents) + ' (' + num(klS.orders) + ')');
  } else lines.push('  unavailable — ' + String(kl.error || 'no detail'));
  lines.push('');
  lines.push('CUSTOMERS — new vs existing');
  if (cust.new != null) {
    lines.push('  Yesterday   ' + num(cust.new) + ' new · ' + num(cust.returning) + ' returning');
    lines.push('  Of Meta     ' + (ms.customers != null ? num(ms.new_customers) + ' new · ' + num(ms.existing_customers) + ' existing (of ' + num(ms.customers) + ' Meta-attributed)' : 'attribution feed backfilling'));
  } else lines.push('  unavailable');
  lines.push('');
  lines.push('Days are midnight-to-midnight ' + tz + '. Live view: https://lbl.fyi/app');
  lines.push('');
  lines.push('Yours in Civilization,');
  lines.push('The Loop build');
  const text = lines.join('\n');

  // ---- styled HTML (the part he reads) ---------------------------------------
  let bcHtml;
  if (bcOk) {
    bcHtml = htmlTable(['Window', 'Orders', 'Gross', 'Refunded', 'Avg order'], [
      ['Yesterday (' + day + ')', num(bc.day.orders), $(bc.day.gross_cents), $(bc.day.refunds_cents), $(bc.day.aov_cents)],
      ['Month to date', num(bc.mtd.orders), $(bc.mtd.gross_cents), $(bc.mtd.refunds_cents), $(bc.mtd.aov_cents)],
    ]) + htmlTable(['By day', 'Orders', 'Gross'], (bc.per_day || []).map((r) => [r.date, num(r.orders), $(r.gross_cents)]));
  } else bcHtml = unavailableHtml(bc.error);

  let twHtml;
  if (twOk) {
    const chanRows = (w) => (w.channels || []).map((c) => [c.channel, $(c.spend_cents), $(c.attributed_revenue_cents), c.attributed_orders == null ? '—' : num(c.attributed_orders), c.roas != null ? c.roas.toFixed(2) + '×' : '—']);
    twHtml = `<div style="font-family:${FONT};font-size:12px;color:#666666;margin:0 0 4px">Yesterday</div>`
      + (chanRows(tw.day).length ? htmlTable(['Channel', 'Spend', 'Attributed', 'Orders', 'ROAS'], chanRows(tw.day)) : `<div style="font-family:${FONT};font-size:14px;color:#666666;margin:0 0 8px">No channel recorded spend or attributed revenue yesterday.</div>`)
      + `<div style="font-family:${FONT};font-size:12px;color:#666666;margin:10px 0 4px">Month to date</div>`
      + htmlTable(['Channel', 'Spend', 'Attributed', 'Orders', 'ROAS'], chanRows(tw.mtd))
      + `<div style="font-family:${FONT};font-size:13px;color:#666666;margin-top:6px">Blended spend MTD ${escHtml($(tw.mtd.blended_spend_cents))} · Triple Whale's own store total MTD ${escHtml($(tw.mtd.tw_store_sales_cents))} across ${escHtml(num(tw.mtd.tw_store_orders))} orders — its model, its line, never blended with BigCommerce. A channel's ROAS is its own attributed revenue over its own spend.</div>`;
  } else twHtml = unavailableHtml(tw.error);

  let klHtml;
  if (klOk) {
    const mE = kl.mtd.email || { revenue_cents: 0, orders: 0 }, mS = kl.mtd.sms || { revenue_cents: 0, orders: 0 };
    klHtml = htmlTable(['Window', 'Email revenue', 'Email orders', 'SMS revenue', 'SMS orders'], [
      ['Yesterday (' + day + ')', $(klE.revenue_cents), num(klE.orders), $(klS.revenue_cents), num(klS.orders)],
      ['Month to date', $(mE.revenue_cents), num(mE.orders), $(mS.revenue_cents), num(mS.orders)],
    ]) + `<div style="font-family:${FONT};font-size:13px;color:#666666;margin-top:6px">Klaviyo and ad channels can each claim the same order; totals overlap by design.</div>`;
  } else klHtml = unavailableHtml(kl.error);

  const custHtml = cust.new != null
    ? htmlTable(['', 'New', 'Existing / returning', 'Total'], [
        ['Yesterday — organization', num(cust.new), num(cust.returning), num((cust.new || 0) + (cust.returning || 0))],
        ['Yesterday — Meta-attributed', ms.customers != null ? num(ms.new_customers) : 'backfilling', ms.customers != null ? num(ms.existing_customers) : '—', ms.customers != null ? num(ms.customers) : '—'],
      ]) + `<div style="font-family:${FONT};font-size:13px;color:#666666;margin-top:6px">New = first-ever order to the organization. The Meta line is a distinct cut of who ads reached; it does not change ROAS.</div>`
    : unavailableHtml('customer split');

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff">
<div style="max-width:680px;margin:0 auto;padding:28px 20px;background:#ffffff">
<div style="border-bottom:3px solid #000000;padding-bottom:12px">
  <div style="font-family:${FONT};font-weight:700;font-size:20px;letter-spacing:-0.01em;color:#000000">LOOP BIO LABS — daily read</div>
  <div style="font-family:${FONT};font-size:13px;color:#666666;margin-top:2px">${escHtml(pretty)} · store time, ${escHtml(tz)} · each source speaks for itself</div>
</div>
<div style="font-family:${FONT};font-size:16px;line-height:1.65;color:#000000;margin:18px 0 4px">${escHtml(readText)}</div>
${section('Store sales', 'BigCommerce — source of truth for revenue', bcHtml)}
${section('Advertising', 'Triple Whale — ad spend + attribution', twHtml)}
${section('Customers', 'new vs existing — organization and Meta', custHtml)}
${section('Email & SMS', 'Klaviyo — owned channels', klHtml)}
<div style="font-family:${FONT};font-size:13px;color:#000000;border-top:1px solid #e5e5e5;margin-top:26px;padding-top:14px">Yours in Civilization,<br>The Loop build</div>
<div style="font-family:${FONT};font-size:11px;color:#999999;margin-top:10px">Days are midnight-to-midnight ${escHtml(tz)}. A source that fails reads "unavailable", never zero. Live view: <a href="https://lbl.fyi/app" style="color:#000000">lbl.fyi/app</a></div>
</div></body></html>`;

  const subject = bcOk
    ? 'LBL Daily — ' + day + ' — ' + $(bc.day.gross_cents) + ' gross · ' + num(bc.day.orders) + ' orders'
    : 'LBL Daily — ' + day + ' — BigCommerce unavailable';

  let recips = '';
  try { const row = await env.DB.prepare("SELECT value FROM settings WHERE key='lbl_daily_recipients'").first(); recips = (row && row.value) || ''; } catch { /* default below */ }
  const toList = String(recips || '[OWNER_EMAIL]').split(',').map((s) => s.trim()).filter(Boolean);
  if (mode === 'dry') return { ok: true, day, subject, to: toList, text, html_bytes: html.length };

  const sent = [];
  for (const to of toList) {
    let status = 0, resp = '';
    try {
      const r = await fetch('https://miscsubjects.com/api/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY },
        body: JSON.stringify({ to, subject, text, html, from: 'build@miscsubjects.com', from_name: 'LBL daily — miscsubjects build', reply_to: 'build@miscsubjects.com' }),
      });
      status = r.status; resp = (await r.text()).slice(0, 160);
    } catch (e) { resp = 'fetch:' + ((e && e.message) || e); }
    sent.push({ to, status, resp });
  }
  return { ok: sent.every((s) => s.status === 200), day, subject, sent };
}
