import { buildStripeSalesReport } from '../_lib/stripe_sales_report.js';
import { dispatch } from './dispatch.js';
import { getMetaOps2chatGroup } from '../_lib/meta_leads.js';

const WA_FROM = '[PHONE]';
const WA_GROUP_FALLBACK = 'WAG845ab708-58da-4867-b714-ea172823d82a';

export async function onRequestGet(context) {
  return handle(context);
}

export async function onRequestPost(context) {
  return handle(context);
}

async function handle(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dry') === '1';

  let report;
  try {
    report = await buildStripeSalesReport(env);
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e) }, 500);
  }

  if (dryRun) {
    return json({ ok: true, dry: true, report });
  }

  let groupId = WA_GROUP_FALLBACK;
  try {
    const stored = await getMetaOps2chatGroup(env);
    if (stored) groupId = String(stored).split('|')[0].trim() || groupId;
  } catch {}

  const body = WA_FROM + '|' + groupId + '|' + report.text;
  let send = null;
  try {
    send = await dispatch(env, 'TWOCHAT_SEND_GROUP', body, { actor: 'stripe-daily' });
  } catch (e) {
    return json({ ok: false, error: 'send failed: ' + String(e && e.message || e), report }, 500);
  }

  return json({
    ok: true,
    sent: true,
    group: groupId,
    report,
    dispatch: { trace: send && send.trace, result: String(send && send.result || '').slice(0, 300) },
  });
}

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}