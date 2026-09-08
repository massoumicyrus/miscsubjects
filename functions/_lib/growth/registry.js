// GROWTH — provider registry manifest. A slot exists for every relevant network BEFORE credentials.
// Registry presence and implemented capability are separate: each capability is exactly one of
// supported | unverified | unsupported. Only capabilities verified against official docs (or live,
// with receipts) are marked supported; everything else stays unverified until someone verifies it.

const U = 'unverified';
const CAPS = ['account_discovery', 'entity_reads', 'metric_reads', 'backfill', 'webhooks', 'content_history', 'content_publish', 'campaign_mutation', 'budget_mutation', 'bid_mutation', 'status_mutation', 'conversion_upload', 'audience_sync', 'keyword_estimates', 'reach_estimates', 'competitor_ads', 'traffic_estimates', 'placement_data'];
const slot = (id, name, category, channels, over = {}, meta = {}) => ({ id, name, category, channels, caps: Object.fromEntries(CAPS.map((c) => [c, over[c] || U])), ...meta });

export const PROVIDERS = [
  // ---- paid media
  slot('meta_ads', 'Meta Ads', 'paid_media', ['paid_social'], { account_discovery: 'supported', entity_reads: 'supported', metric_reads: 'supported', backfill: 'supported', campaign_mutation: U, budget_mutation: U, bid_mutation: U, status_mutation: U, conversion_upload: U, competitor_ads: U }, { docs_url: 'https://developers.facebook.com/docs/marketing-api/insights', verified_note: 'Marketing API v25.0: insights at account/campaign/adset/ad, date_preset, breakdowns (official docs). Reads verified live through META_ADS_* with receipts at import time. Writes exist as directory rows but are unverified and unused.', adapter_module: 'functions/_lib/growth/adapters/meta.js' }),
  slot('google_ads', 'Google Ads', 'paid_media', ['paid_search', 'display', 'video', 'shopping'], { entity_reads: 'supported', metric_reads: 'supported', conversion_upload: 'supported', budget_mutation: 'supported', bid_mutation: 'supported', status_mutation: 'supported' }, { docs_url: 'https://developers.google.com/google-ads/api/docs/start', verified_note: 'Official overview: GAQL reads (campaigns/ad groups/ads/assets/metrics), offline & click conversion uploads (GCLID), mutate status/budgets/bids; developer token + OAuth 2.0. No credentials in this build → connection not_connected.' }),
  slot('microsoft_ads', 'Microsoft Advertising', 'paid_media', ['paid_search']),
  slot('tiktok_ads', 'TikTok Ads', 'paid_media', ['paid_social']),
  slot('linkedin_ads', 'LinkedIn Ads', 'paid_media', ['paid_social']),
  slot('reddit_ads', 'Reddit Ads', 'paid_media', ['paid_social']),
  slot('pinterest_ads', 'Pinterest Ads', 'paid_media', ['paid_social']),
  slot('snapchat_ads', 'Snapchat Ads', 'paid_media', ['paid_social']),
  slot('x_ads', 'X Ads', 'paid_media', ['paid_social']),
  slot('amazon_ads', 'Amazon Ads', 'paid_media', ['retail_media']),
  slot('walmart_connect', 'Walmart Connect', 'paid_media', ['retail_media']),
  slot('instacart_ads', 'Instacart Ads', 'paid_media', ['retail_media']),
  slot('apple_search_ads', 'Apple Search Ads', 'paid_media', ['app_store']),
  slot('youtube_ads', 'YouTube (Google Ads)', 'paid_media', ['video']),
  slot('dv360', 'Display & Video 360', 'paid_media', ['display', 'video']),
  slot('cm360', 'Campaign Manager 360', 'paid_media', ['display']),
  slot('the_trade_desk', 'The Trade Desk', 'paid_media', ['display', 'video', 'ctv']),
  slot('taboola', 'Taboola', 'paid_media', ['native']),
  slot('outbrain', 'Outbrain', 'paid_media', ['native']),
  slot('mgid', 'MGID', 'paid_media', ['native']),
  slot('propellerads', 'PropellerAds', 'paid_media', ['push', 'pop']),
  slot('zeropark', 'Zeropark', 'paid_media', ['pop', 'push']),
  slot('richads', 'RichAds', 'paid_media', ['push']),
  slot('impact', 'Impact (affiliate)', 'paid_media', ['affiliate']),
  slot('shareasale', 'ShareASale', 'paid_media', ['affiliate']),
  slot('cj', 'CJ Affiliate', 'paid_media', ['affiliate']),
  // ---- analytics
  slot('ga4', 'Google Analytics 4', 'analytics', ['seo', 'direct', 'referral']),
  slot('search_console', 'Google Search Console', 'search', ['seo']),
  slot('merchant_center', 'Google Merchant Center', 'commerce', ['shopping']),
  slot('posthog', 'PostHog', 'analytics', []),
  slot('matomo', 'Matomo', 'analytics', []),
  slot('umami', 'Umami', 'analytics', []),
  slot('miscsubjects_engine', 'miscsubjects traffic engine (first-party)', 'analytics', ['direct', 'referral', 'sms'], { account_discovery: 'supported', entity_reads: 'supported', metric_reads: 'supported', backfill: 'supported', webhooks: 'supported' }, { verified_note: 'First-party: traffic_decisions/events/profiles are the source. evidence_class first_party_observed.', adapter_module: 'functions/_lib/growth/store.js' }),
  // ---- commerce / revenue / cogs
  slot('stripe', 'Stripe', 'commerce', [], { entity_reads: U, metric_reads: U, backfill: U, webhooks: U }, { verified_note: 'STRIPE_SECRET_KEY present in the build (14 call sites). Read adapter is slice 2.' }),
  slot('shopify', 'Shopify', 'commerce', []),
  slot('woocommerce', 'WooCommerce', 'commerce', []),
  slot('bigcommerce', 'BigCommerce', 'commerce', []),
  slot('klaviyo', 'Klaviyo', 'analytics', ['email', 'sms'], { conversion_upload: U }, { verified_note: 'Klaviyo events API used by PROFILE_EVENT_FORWARD (202 observed).' }),
  slot('crm_generic', 'CRM / subscription / refund / COGS source', 'commerce', []),
  // ---- competitive / estimates (consume their APIs; do not rebuild their collection)
  slot('similarweb', 'Similarweb', 'estimates', [], { traffic_estimates: U }),
  slot('semrush', 'Semrush', 'search', [], { keyword_estimates: U, traffic_estimates: U }),
  slot('ahrefs', 'Ahrefs', 'search', [], { keyword_estimates: U }),
  slot('dataforseo', 'DataForSEO', 'search', [], { keyword_estimates: U }),
  slot('sensor_tower', 'Sensor Tower / data.ai', 'competitive', [], { competitor_ads: U, traffic_estimates: U }),
  slot('pathmatics', 'Pathmatics', 'competitive', [], { competitor_ads: U, placement_data: U }),
  slot('adbeat', 'Adbeat', 'competitive', [], { competitor_ads: U, placement_data: U }),
  slot('foreplay', 'Foreplay', 'creative_intel', [], { competitor_ads: U }),
  slot('motion', 'Motion', 'creative_intel', []),
  slot('meta_ad_library', 'Meta Ad Library', 'competitive', ['paid_social'], { competitor_ads: U }, { verified_note: 'META_AD_LIBRARY_SEARCH exists as a directory row; unverified for this spine.' }),
  slot('tiktok_creative_center', 'TikTok Creative Center (Top Ads)', 'competitive', ['paid_social'], { competitor_ads: U }),
];

export const CAPABILITY_COLUMNS = CAPS.map((c) => 'cap_' + c);

/** Upsert every slot into the providers table (idempotent). Returns counts. */
export async function seedProviders(env, tenant, now) {
  let created = 0, updated = 0;
  for (const p of PROVIDERS) {
    const existing = await env.DB.prepare('SELECT id FROM providers WHERE tenant_id=? AND id=?').bind(tenant, p.id).first();
    const capVals = CAPS.map((c) => p.caps[c]);
    if (existing) {
      await env.DB.prepare(`UPDATE providers SET name=?, category=?, channels_json=?, ${CAPS.map((c) => 'cap_' + c + '=?').join(', ')}, docs_url=?, verified_note=?, adapter_module=?, updated_at=? WHERE tenant_id=? AND id=?`)
        .bind(p.name, p.category, JSON.stringify(p.channels), ...capVals, p.docs_url || null, p.verified_note || null, p.adapter_module || null, now, tenant, p.id).run();
      updated++;
    } else {
      await env.DB.prepare(`INSERT INTO providers (id, tenant_id, name, category, channels_json, ${CAPS.map((c) => 'cap_' + c).join(', ')}, docs_url, verified_at, verified_note, adapter_module, created_at, updated_at) VALUES (?,?,?,?,?,${CAPS.map(() => '?').join(',')},?,?,?,?,?,?)`)
        .bind(p.id, tenant, p.name, p.category, JSON.stringify(p.channels), ...capVals, p.docs_url || null, p.verified_note ? now : null, p.verified_note || null, p.adapter_module || null, now, now).run();
      created++;
    }
  }
  return { created, updated, total: PROVIDERS.length };
}

/** Connection state for the providers that have credentials in this build (names only, never values). */
export function knownConnections(env) {
  const has = (k) => !!env[k];
  return [
    { provider_id: 'meta_ads', external_account_id: null, label: 'Meta (build token)', state: has('META_ACCESS_TOKEN') || has('META_CAPI_TOKEN') ? 'authorized' : 'not_connected', scopes: ['read'], secret_ref: 'META_ACCESS_TOKEN' },
    { provider_id: 'google_ads', external_account_id: null, label: 'Google Ads', state: 'not_connected', scopes: [], secret_ref: null },
    { provider_id: 'stripe', external_account_id: null, label: 'Stripe', state: has('STRIPE_SECRET_KEY') ? 'authorized' : 'not_connected', scopes: ['read'], secret_ref: 'STRIPE_SECRET_KEY' },
    { provider_id: 'klaviyo', external_account_id: null, label: 'Klaviyo', state: has('KLAVIYO_API_KEY') || has('KLAVIYO_PRIVATE_KEY') ? 'authorized' : 'not_connected', scopes: ['read'], secret_ref: 'KLAVIYO_API_KEY' },
    { provider_id: 'miscsubjects_engine', external_account_id: 't_root', label: 'first-party engine', state: 'authorized', scopes: ['read'], secret_ref: null },
  ];
}
