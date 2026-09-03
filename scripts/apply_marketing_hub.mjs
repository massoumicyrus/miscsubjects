#!/usr/bin/env node
/** Apply marketing hub directory + settings rows via miscsubjects REST API. */
import { readFileSync } from 'fs';

const KEY = process.env.TERMINAL_KEY || process.env.MISC;
if (!KEY) { console.error('TERMINAL_KEY required'); process.exit(1); }

const H = { 'content-type': 'application/json', 'x-terminal-key': KEY };
const BASE = 'https://miscsubjects.com';

async function patch(key, body) {
  const r = await fetch(`${BASE}/api/directory/${key}`, { method: 'PATCH', headers: H, body: JSON.stringify(body) });
  const t = await r.text();
  console.log(key, r.status, t.slice(0, 200));
  return r.ok;
}

async function putSetting(key, value, description) {
  const r = await fetch(`${BASE}/api/settings/${key}`, {
    method: 'PUT', headers: H, body: JSON.stringify({ value, description }),
  });
  console.log('settings', key, r.status);
  return r.ok;
}

async function postDirectory(row) {
  const r = await fetch(`${BASE}/api/directory`, { method: 'POST', headers: H, body: JSON.stringify(row) });
  const t = await r.text();
  console.log('POST', row.key, r.status, t.slice(0, 120));
  return r.ok || r.status === 409;
}

const metaTarget = readFileSync(new URL('../migrations/0228_marketing_hub.sql', import.meta.url), 'utf8')
  .match(/target = '(target_map:\{[^']+\})'/)[1];

await patch('META', {
  target: metaTarget,
  content: `# WHAT: Meta Graph API unified entrypoint (Marketing API)
# WHEN_TO_USE: Meta ad accounts, campaigns, adsets, ads, creatives, insights, CAPI
# ARGS: $1=op, $2..$N=args per op
# OPS: me | ad_accounts | owned_ad_accounts | client_ad_accounts | campaigns | adsets | ads | adcreatives | ad_images | insights | capi_post`,
  category: 'meta',
});

await patch('KNOWLEDGE', {
  enabled: 1,
  content: `# KNOWLEDGE — fetch a knowledge card for models
# ARGS: CUSTOMER_FUNNEL | AD_ACCOUNTS | MARKETING_STATE | LEO_RESEARCH | IMAGE_REFERENCE | REACTIONS | BATCH | ARTICLE_LIST
# EX: [KNOWLEDGE]AD_ACCOUNTS[/KNOWLEDGE]`,
});

for (const row of [
  { key: 'LBL_VIEWER_GET', type: 'fn', target: 'lblViewerGet', auth: '', category: 'loopdata', planner_rank: 44, enabled: 1,
    content: `# WHAT: GET lbl.fyi viewer path. Uses LBL_VIEWER_PASS.\n# EX: [LBL_VIEWER_GET]api/meta/creatives[/LBL_VIEWER_GET]\n["$1+"]` },
  { key: 'MARKETING_SNAPSHOT', type: 'fn', target: 'marketingSnapshot', auth: '', category: 'meta', planner_rank: 42, enabled: 1,
    content: `# WHAT: Live Meta + lbl cache + MARKETING_STATE JSON.\n# EX: [MARKETING_SNAPSHOT][/MARKETING_SNAPSHOT]\n[]` },
  { key: 'META_SYNC_BACKFILL', type: 'fn', target: 'metaSyncBackfill', auth: '', category: 'meta', planner_rank: 43, enabled: 1,
    content: `# WHAT: Trigger lbl meta insights backfill. Ledgered.\n# EX: [META_SYNC_BACKFILL][/META_SYNC_BACKFILL]\n[]` },
]) {
  await postDirectory(row);
}

await putSetting('marketing_state', JSON.stringify({
  focus: 'meta_ads_pivot',
  active_work: 'eagle bulk upload eagle1-50 to Meta',
  eagle_folder: '~/Downloads/eagle-1-50',
  naming: { adset: 'eagleNN-adset', ad: 'eagleNN-ad', utm_content: 'eagleNN' },
  funnel: 'ads → justcloakit → tap-to-text → Blooio lead → Regeneration guide reply',
  lbl_viewer: 'https://lbl.fyi',
  admin_tab: 'https://miscsubjects.com/admin/marketing',
}), 'Model-facing marketing focus');

await putSetting('customer_funnel', `CUSTOMER FUNNEL (Meta ads → miscsubjects)
1. Ad click → miscsubjects.com cloaker → leoresearch.com/l/meta (humans) or safe page (bots).
2. Tap-to-text / Health Hacks → iMessage → Blooio.
3. Lead routed to WA grp_98e1acc03a3148f3.
4. Standard reply: Regeneration guide (miscsubjects articles + LeoResearch.com).
5. Owner [OWNER_PHONE] is NOT a lead.
6. JCI clicks: [LBL_VIEWER_GET]api/cloaker-events?limit=50[/LBL_VIEWER_GET]
7. Meta: [MARKETING_SNAPSHOT] or /admin/marketing`, 'Customer funnel for ROUTER');

// automation via dispatch
const auto = await fetch(`${BASE}/api/dispatch`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ key: 'AUTOMATE_ADD', body: 'daily meta insights backfill|1440|META_SYNC_BACKFILL|' }),
});
console.log('AUTOMATE_ADD', auto.status, (await auto.text()).slice(0, 200));

console.log('done');