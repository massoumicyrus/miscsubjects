
import { sha256Hex } from './grants.js';

export const SIGNAL_CATALOG = Object.freeze([
  // request
  { key: 'request.id', group: 'request', type: 'string', sync: 1, source: 'engine', description: 'Per-request id (also the Cloudflare ray when present).' },
  { key: 'request.method', group: 'request', type: 'string', sync: 1, source: 'http', description: 'HTTP method.' },
  { key: 'request.host', group: 'request', type: 'string', sync: 1, source: 'http', description: 'Request host, lowercased.' },
  { key: 'request.path', group: 'request', type: 'string', sync: 1, source: 'http', description: 'URL path.' },
  { key: 'request.entry', group: 'request', type: 'string', sync: 1, source: 'engine', description: 'The routing entry name after /go/, e.g. "acceptance".' },
  { key: 'request.phase', group: 'request', type: 'string', sync: 1, source: 'engine', description: '"visit" for a page request; "post_sms" when policy is re-evaluated after an inbound verification message.' },
  { key: 'request.query', group: 'request', type: 'object', sync: 1, source: 'http', description: 'Query parameters as a map (first value wins). Read one as request.query.<name>.' },
  { key: 'request.referrer', group: 'request', type: 'string', sync: 1, source: 'http', description: 'Referer header.' },
  { key: 'request.referrer_host', group: 'request', type: 'string', sync: 1, source: 'http', description: 'Host of the referrer.' },
  { key: 'request.user_agent', group: 'request', type: 'string', sync: 1, source: 'http', description: 'User-Agent header.' },
  { key: 'request.languages', group: 'request', type: 'array', sync: 1, source: 'http', description: 'Accept-Language codes in preference order (e.g. ["en-us","en"]).' },
  { key: 'request.language', group: 'request', type: 'string', sync: 1, source: 'http', description: 'Primary language, two letters.' },
  { key: 'request.secure', group: 'request', type: 'boolean', sync: 1, source: 'http', description: 'HTTPS.' },
  { key: 'request.headers', group: 'request', type: 'object', sync: 1, source: 'http', description: 'Selected safe headers (accept, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, x-purpose, purpose).' },
  // network
  { key: 'network.ip_hash', group: 'network', type: 'string', sync: 1, source: 'cloudflare', description: 'Keyed hash of the client IP. The raw IP is never stored in a decision.' },
  { key: 'network.ip', group: 'network', type: 'string', sync: 1, source: 'cloudflare', description: 'Client IP — available to rules (cidr op) but redacted before persistence.' },
  { key: 'network.ip_prefix', group: 'network', type: 'string', sync: 1, source: 'cloudflare', description: 'Privacy-preserving prefix: /24 for IPv4, /48 for IPv6.' },
  { key: 'network.visitor_hash', group: 'network', type: 'string', sync: 1, source: 'engine', description: 'The JCI-era stitch hash of the IP (same salt), so imported history and memberships keyed by it match live requests.' },
  { key: 'network.country', group: 'network', type: 'string', sync: 1, source: 'cloudflare', description: 'ISO country from request.cf.country.' },
  { key: 'network.region', group: 'network', type: 'string', sync: 1, source: 'cloudflare', description: 'Region / state (cf.region, cf.regionCode).' },
  { key: 'network.region_code', group: 'network', type: 'string', sync: 1, source: 'cloudflare', description: 'Region code (e.g. CA).' },
  { key: 'network.city', group: 'network', type: 'string', sync: 1, source: 'cloudflare', description: 'City where Cloudflare reports one.' },
  { key: 'network.postal_code', group: 'network', type: 'string', sync: 1, source: 'cloudflare', description: 'Postal code where reported.' },
  { key: 'network.asn', group: 'network', type: 'number', sync: 1, source: 'cloudflare', description: 'Autonomous system number.' },
  { key: 'network.as_org', group: 'network', type: 'string', sync: 1, source: 'cloudflare', description: 'AS organisation name.' },
  { key: 'network.ip_timezone', group: 'network', type: 'string', sync: 1, source: 'cloudflare', description: 'Timezone Cloudflare infers from the IP (cf.timezone).' },
  { key: 'network.colo', group: 'network', type: 'string', sync: 1, source: 'cloudflare', description: 'Cloudflare data centre.' },
  { key: 'network.http_protocol', group: 'network', type: 'string', sync: 1, source: 'cloudflare', description: 'HTTP/1.1, HTTP/2, HTTP/3.' },
  { key: 'network.tls_version', group: 'network', type: 'string', sync: 1, source: 'cloudflare', description: 'TLS version.' },
  { key: 'network.bot_score', group: 'network', type: 'number', sync: 1, source: 'cloudflare-bot-management', description: '1–99 bot score. null unless the zone has Bot Management (Enterprise). Never required.' },
  { key: 'network.verified_bot', group: 'network', type: 'boolean', sync: 1, source: 'cloudflare-bot-management', description: 'Cloudflare verified-bot flag when exposed.' },
  { key: 'network.verified_bot_category', group: 'network', type: 'string', sync: 1, source: 'cloudflare-bot-management', description: 'Verified bot category when exposed.' },
  { key: 'network.bot_hint', group: 'network', type: 'boolean', sync: 1, source: 'ua-heuristic', description: 'Plan-independent fallback: user-agent / header heuristics say automation. Weaker than bot_score.' },
  { key: 'network.bot_signal_source', group: 'network', type: 'string', sync: 1, source: 'engine', description: '"bot_management" when a score exists, else "ua_heuristic".' },
  { key: 'network.risk', group: 'network', type: 'number', sync: 1, source: 'engine', description: '0–100 risk estimate derived from the best available bot signal plus list "score" effects and owner signal policy (traffic_signal_policy effect=score).' },
  { key: 'network.type', group: 'network', type: 'string', sync: 1, source: 'engine+history', description: 'datacenter | vpn | proxy | business | residential_guess | unknown — from cf.asOrganization heuristics, overridden by imported history when present.' },
  { key: 'network.connection_type', group: 'network', type: 'string', sync: 1, source: 'history', description: 'corporate | cable_dsl | cellular | satellite — only from imported history (needs a third-party source to reproduce live).' },
  // device
  { key: 'device.id', group: 'device', type: 'string', sync: 1, source: 'first-party-cookie', description: 'First-party device id issued by this engine (cookie ms_did). Not a fingerprint.' },
  { key: 'device.new', group: 'device', type: 'boolean', sync: 1, source: 'engine', description: 'No device cookie arrived — this is a new or cookie-cleared browser.' },
  { key: 'device.known', group: 'device', type: 'boolean', sync: 1, source: 'store', description: 'The device id exists in traffic_devices.' },
  { key: 'device.trusted', group: 'device', type: 'boolean', sync: 1, source: 'store', description: 'Device marked trusted, not revoked, and trust not expired.' },
  { key: 'device.revoked', group: 'device', type: 'boolean', sync: 1, source: 'store', description: 'Device explicitly revoked.' },
  { key: 'device.trust_expires_at', group: 'device', type: 'string', sync: 1, source: 'store', description: 'When device trust lapses (policy trust_device_days).' },
  { key: 'device.class', group: 'device', type: 'string', sync: 1, source: 'ua+client-hints', description: 'mobile | tablet | desktop | bot | unknown.' },
  { key: 'device.browser', group: 'device', type: 'string', sync: 1, source: 'ua', description: 'Browser family (chrome, safari, firefox, edge, samsung, opera, other).' },
  { key: 'device.browser_version', group: 'device', type: 'string', sync: 1, source: 'ua', description: 'Major browser version.' },
  { key: 'device.os', group: 'device', type: 'string', sync: 1, source: 'ua+client-hints', description: 'ios | android | macos | windows | linux | chromeos | other.' },
  { key: 'device.mobile_hint', group: 'device', type: 'boolean', sync: 1, source: 'client-hints', description: 'sec-ch-ua-mobile said ?1.' },
  { key: 'device.touch', group: 'device', type: 'boolean', sync: 1, source: 'client-cookie', description: 'Touch capability reported by the engine\'s own pages (cookie ms_ch). null until reported.' },
  { key: 'device.viewport_class', group: 'device', type: 'string', sync: 1, source: 'client-cookie', description: 'xs | sm | md | lg | xl from the engine\'s pages. null until reported.' },
  { key: 'device.screen', group: 'device', type: 'string', sync: 1, source: 'client-cookie', description: 'WxH reported by the engine\'s pages. null until reported.' },
  { key: 'device.timezone', group: 'device', type: 'string', sync: 1, source: 'client-cookie', description: 'Visitor-reported IANA timezone (cookie ms_tz). null until reported.' },
  { key: 'device.locale', group: 'device', type: 'string', sync: 1, source: 'client-cookie', description: 'Visitor-reported locale.' },
  { key: 'device.cookies', group: 'device', type: 'boolean', sync: 1, source: 'engine', description: 'A cookie set by the engine came back — cookies work in this browser.' },
  // attribution
  { key: 'attribution.utm_source', group: 'attribution', type: 'string', sync: 1, source: 'query', description: 'utm_source.' },
  { key: 'attribution.utm_medium', group: 'attribution', type: 'string', sync: 1, source: 'query', description: 'utm_medium.' },
  { key: 'attribution.utm_campaign', group: 'attribution', type: 'string', sync: 1, source: 'query', description: 'utm_campaign.' },
  { key: 'attribution.utm_content', group: 'attribution', type: 'string', sync: 1, source: 'query', description: 'utm_content.' },
  { key: 'attribution.utm_term', group: 'attribution', type: 'string', sync: 1, source: 'query', description: 'utm_term.' },
  { key: 'attribution.fbclid', group: 'attribution', type: 'string', sync: 1, source: 'query', description: 'Meta click id.' },
  { key: 'attribution.gclid', group: 'attribution', type: 'string', sync: 1, source: 'query', description: 'Google click id.' },
  { key: 'attribution.ttclid', group: 'attribution', type: 'string', sync: 1, source: 'query', description: 'TikTok click id.' },
  { key: 'attribution.msclkid', group: 'attribution', type: 'string', sync: 1, source: 'query', description: 'Microsoft click id.' },
  { key: 'attribution.click_id_present', group: 'attribution', type: 'boolean', sync: 1, source: 'engine', description: 'Any known click id present.' },
  { key: 'attribution.click_ids', group: 'attribution', type: 'object', sync: 1, source: 'query', description: 'Map of every click id present.' },
  { key: 'attribution.extra', group: 'attribution', type: 'object', sync: 1, source: 'query', description: 'Configured extra query values (ruleset.capture_query_json) — read as attribution.extra.<name>.' },
  { key: 'attribution.referring_domain', group: 'attribution', type: 'string', sync: 1, source: 'http', description: 'Referring domain.' },
  { key: 'attribution.landing_page', group: 'attribution', type: 'string', sync: 1, source: 'http', description: 'This request\'s path + query.' },
  { key: 'attribution.malformed', group: 'attribution', type: 'array', sync: 1, source: 'engine', description: 'Attribution params that were present but unusable (over-long or non-printable).' },
  { key: 'attribution.original', group: 'attribution', type: 'object', sync: 1, source: 'store', description: 'First-touch attribution persisted on the profile (observed, never overwritten by inference).' },
  // time
  { key: 'time.utc', group: 'time', type: 'string', sync: 1, source: 'clock', description: 'Current UTC ISO instant.' },
  { key: 'time.business_tz', group: 'time', type: 'string', sync: 1, source: 'ruleset', description: 'Configured business timezone (ruleset.business_tz).' },
  { key: 'time.business_hhmm', group: 'time', type: 'string', sync: 1, source: 'clock', description: 'HH:MM in the business timezone — use op time_between.' },
  { key: 'time.business_hour', group: 'time', type: 'number', sync: 1, source: 'clock', description: 'Hour 0–23 in the business timezone.' },
  { key: 'time.business_dow', group: 'time', type: 'number', sync: 1, source: 'clock', description: 'Day of week in the business timezone, 0=Sunday.' },
  { key: 'time.business_date', group: 'time', type: 'string', sync: 1, source: 'clock', description: 'YYYY-MM-DD in the business timezone — compare with > < for date ranges.' },
  { key: 'time.visitor_tz', group: 'time', type: 'string', sync: 1, source: 'client-cookie+cloudflare', description: 'Visitor timezone: reported cookie, else Cloudflare\'s cf.timezone.' },
  { key: 'time.visitor_hhmm', group: 'time', type: 'string', sync: 1, source: 'clock', description: 'HH:MM in the visitor timezone.' },
  { key: 'time.visitor_hour', group: 'time', type: 'number', sync: 1, source: 'clock', description: 'Hour 0–23 in the visitor timezone.' },
  { key: 'time.visitor_dow', group: 'time', type: 'number', sync: 1, source: 'clock', description: 'Day of week in the visitor timezone.' },
  // session
  { key: 'session.id', group: 'session', type: 'string', sync: 1, source: 'first-party-cookie', description: 'Session id (cookie ms_sid, 30 minute sliding window).' },
  { key: 'session.new', group: 'session', type: 'boolean', sync: 1, source: 'engine', description: 'First request of this session.' },
  // profile
  { key: 'profile.id', group: 'profile', type: 'string', sync: 1, source: 'store', description: 'Canonical profile id.' },
  { key: 'profile.known', group: 'profile', type: 'boolean', sync: 1, source: 'store', description: 'A deterministic identifier (email, phone, customer id, login) is joined to this profile.' },
  { key: 'profile.customer', group: 'profile', type: 'boolean', sync: 1, source: 'store', description: 'A customer-system identifier or the customer flag is set.' },
  { key: 'profile.account_state', group: 'profile', type: 'string', sync: 1, source: 'store', description: 'Free-form account state from the customer system (active, past_due, banned…).' },
  { key: 'profile.status', group: 'profile', type: 'string', sync: 1, source: 'memberships', description: 'approved | blocked | review | unknown — effective status from traffic_memberships by population precedence (ruleset.status_precedence_json).' },
  { key: 'profile.status_source', group: 'profile', type: 'string', sync: 1, source: 'memberships', description: 'Which population decided the status (manual, sms_verified, customer, trusted_device, rule, approved_history, blocked_history…).' },
  { key: 'profile.memberships', group: 'profile', type: 'array', sync: 1, source: 'memberships', description: 'Every active membership {population, status, subject_kind, source, confidence} for profile, device, phone and visitor hash.' },
  { key: 'profile.tags', group: 'profile', type: 'array', sync: 1, source: 'store', description: 'Tags — use op contains.' },
  { key: 'profile.segments', group: 'profile', type: 'array', sync: 1, source: 'engine', description: 'Ids of every enabled segment whose condition is true for this request (request-time) plus profile-level segments from the snapshot.' },
  { key: 'profile.features', group: 'profile', type: 'object', sync: 1, source: 'snapshot', description: 'Derived customer features from the profile snapshot (ltv, order_count, aov, days_since_purchase, subscription_state, acquisition_channel, ltv_bucket…). Read as profile.features.<name>.' },
  { key: 'profile.snapshot_version', group: 'profile', type: 'number', sync: 1, source: 'snapshot', description: 'Version of the profile snapshot the decision evaluated — stored on the decision so it stays interpretable after the profile changes.' },
  { key: 'profile.visit_count', group: 'profile', type: 'number', sync: 1, source: 'store', description: 'Sessions seen before this one.' },
  { key: 'profile.returning', group: 'profile', type: 'boolean', sync: 1, source: 'store', description: 'Seen before.' },
  { key: 'profile.first_seen', group: 'profile', type: 'string', sync: 1, source: 'store', description: 'First seen timestamp.' },
  { key: 'profile.previous_destinations', group: 'profile', type: 'array', sync: 1, source: 'store', description: 'Last destinations this profile was sent to (newest first).' },
  { key: 'profile.acks', group: 'profile', type: 'object', sync: 1, source: 'store', description: 'Acceptances by policy key → version, for this device (profile.acks.<policy>).' },
  { key: 'profile.experiments', group: 'profile', type: 'object', sync: 1, source: 'store', description: 'Experiment cohorts by experiment id → variant.' },
  { key: 'profile.identifier_kinds', group: 'profile', type: 'array', sync: 1, source: 'store', description: 'Kinds of identifiers joined (email, phone, stripe_customer_id, klaviyo_profile_id, bigcommerce_customer_id, tenant_person, login…).' },
  { key: 'profile.attrs', group: 'profile', type: 'object', sync: 1, source: 'store', description: 'Arbitrary persisted fields, including async enrichment results (profile.attrs.<name>).' },
  { key: 'profile.merged', group: 'profile', type: 'boolean', sync: 1, source: 'store', description: 'This profile was produced by a merge.' },
  // historical evidence (JCI import)
  { key: 'history.jci_status', group: 'history', type: 'string', sync: 1, source: 'jci-import', description: 'approved | blocked | mixed | unknown from the imported JCI decisions for this visitor hash.' },
  { key: 'history.jci_reasons', group: 'history', type: 'array', sync: 1, source: 'jci-import', description: 'Distinct raw JCI reasons recorded for this visitor hash.' },
  { key: 'history.rows', group: 'history', type: 'number', sync: 1, source: 'jci-import', description: 'Number of historical JCI rows for this visitor hash.' },
  { key: 'history.signals', group: 'history', type: 'object', sync: 1, source: 'jci-import', description: 'Normalized dimensions from the latest historical row: network_type, network_risk, automation_indicator, ua_integrity, connection_type, device_type, list_basis, ip_intelligence, geo_policy_match… Read as history.signals.<dim>.' },
  // consistency / geo (reproducible today)
  { key: 'consistency.timezone', group: 'consistency', type: 'string', sync: 1, source: 'engine', description: 'match | mismatch | unknown — visitor-reported timezone (ms_tz) vs the IP timezone Cloudflare reports.' },
  { key: 'consistency.device', group: 'consistency', type: 'string', sync: 1, source: 'engine', description: 'match | mismatch | unknown — client-hint mobile flag vs user-agent device class.' },
  { key: 'geo.expected_country_match', group: 'geo', type: 'boolean', sync: 1, source: 'campaign', description: 'Country is in campaign.expected_countries_json (null when the campaign lists none).' },
  // campaign
  { key: 'campaign.id', group: 'campaign', type: 'string', sync: 1, source: 'ruleset', description: 'Campaign bound to the matched ruleset (traffic_campaigns.ruleset_id).' },
  { key: 'campaign.name', group: 'campaign', type: 'string', sync: 1, source: 'ruleset', description: 'Campaign name.' },
  // turnstile
  { key: 'turnstile.valid', group: 'turnstile', type: 'boolean', sync: 1, source: 'siteverify', description: 'A server-verified Turnstile pass is recorded for this device and is not older than the ruleset\'s turnstile_max_age_s.' },
  { key: 'turnstile.age_s', group: 'turnstile', type: 'number', sync: 1, source: 'siteverify', description: 'Seconds since the last server-verified pass. null if none.' },
  { key: 'turnstile.verified_at', group: 'turnstile', type: 'string', sync: 1, source: 'siteverify', description: 'When the last pass was verified.' },
  { key: 'turnstile.skip', group: 'turnstile', type: 'boolean', sync: 1, source: 'lists', description: 'An allowlist entry with effect skip_challenge matched.' },
  // lists
  { key: 'lists.allow_match', group: 'lists', type: 'boolean', sync: 1, source: 'store', description: 'Any enabled allowlist entry matched.' },
  { key: 'lists.deny_match', group: 'lists', type: 'boolean', sync: 1, source: 'store', description: 'Any enabled denylist entry matched.' },
  { key: 'lists.allow', group: 'lists', type: 'array', sync: 1, source: 'store', description: 'Matched allowlist entry ids.' },
  { key: 'lists.deny', group: 'lists', type: 'array', sync: 1, source: 'store', description: 'Matched denylist entry ids.' },
  { key: 'lists.kinds', group: 'lists', type: 'array', sync: 1, source: 'store', description: 'Kinds of entries that matched (ip, cidr, country, asn, profile, device, identifier, email_domain, tag, ua, referrer).' },
  // buckets
  { key: 'buckets.request', group: 'buckets', type: 'number', sync: 1, source: 'engine', description: 'Random 0–99 for this request only.' },
  { key: 'buckets.device', group: 'buckets', type: 'number', sync: 1, source: 'engine', description: 'Deterministic 0–99 from device id + ruleset salt — stable per browser.' },
  { key: 'buckets.profile', group: 'buckets', type: 'number', sync: 1, source: 'engine', description: 'Deterministic 0–99 from profile id + ruleset salt — stable per person.' },
  // experiment (set during evaluation)
  { key: 'experiment.id', group: 'experiment', type: 'string', sync: 1, source: 'engine', description: 'Experiment assigned by an earlier rule in this evaluation.' },
  { key: 'experiment.variant', group: 'experiment', type: 'string', sync: 1, source: 'engine', description: 'Variant assigned by an earlier rule in this evaluation.' },
  // grant / access
  { key: 'grant.valid', group: 'grant', type: 'boolean', sync: 1, source: 'cookie', description: 'A consumed grant session cookie for this destination is present and unexpired.' },
  { key: 'grant.destination', group: 'grant', type: 'string', sync: 1, source: 'cookie', description: 'Destination the grant session was established for.' },
  // custom
  { key: 'custom', group: 'custom', type: 'object', sync: 1, source: 'rules+remote', description: 'Values set by earlier rule actions ({type:"set"}) or supplied by a remote caller of POST /api/traffic/decide.' },
]);

export const SIGNAL_PATHS = Object.freeze(SIGNAL_CATALOG.map((s) => s.key));

const CLICK_IDS = ['fbclid', 'gclid', 'ttclid', 'msclkid', 'dclid', 'twclid', 'li_fat_id', 'sc_click_id', 'irclickid'];
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const SAFE_HEADERS = ['accept', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'sec-ch-ua-model', 'x-purpose', 'purpose', 'save-data', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest', 'dnt', 'sec-gpc'];
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|meta-externalagent|headless|phantom|puppeteer|playwright|selenium|python-requests|python-urllib|curl\/|wget\/|go-http-client|java\/|libwww|httpclient|okhttp|axios|node-fetch|scrapy|lighthouse|pagespeed|pingdom|uptimerobot|preview|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|anthropic|perplexity|ccbot|applebot|bingpreview|yandex|baiduspider|duckduckbot/i;
const HOSTING_ORG = /amazon|aws|google|gcp|microsoft|azure|ovh|hetzner|digitalocean|linode|akamai|vultr|choopa|oracle|alibaba|tencent|contabo|leaseweb|m247|datacamp|servers?\b|hosting|cloud|colo|data ?cent/i;
const VPN_ORG = /vpn|proxy|nord|express ?vpn|mullvad|surfshark|private internet|tor exit/i;
// Same salt as functions/_lib/jci.js so imported history keyed by visitor hash matches live requests.
const JCI_IP_SALT = 'miscsubjects-jci-stitch-v1';

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { out[k] = part.slice(i + 1).trim(); }
  }
  return out;
}

export function parseUserAgent(ua, hints = {}) {
  const s = String(ua || '');
  const low = s.toLowerCase();
  let browser = 'other', version = '';
  const pick = (re) => { const m = re.exec(s); if (m) { version = m[1]; return true; } return false; };
  if (/edg\//i.test(s) && pick(/Edg\/(\d+)/)) browser = 'edge';
  else if (/samsungbrowser/i.test(s) && pick(/SamsungBrowser\/(\d+)/)) browser = 'samsung';
  else if (/opr\/|opera/i.test(s) && (pick(/OPR\/(\d+)/) || pick(/Opera\/(\d+)/))) browser = 'opera';
  else if (/firefox|fxios/i.test(s) && (pick(/Firefox\/(\d+)/) || pick(/FxiOS\/(\d+)/))) browser = 'firefox';
  else if (/crios/i.test(s) && pick(/CriOS\/(\d+)/)) browser = 'chrome';
  else if (/chrome|chromium/i.test(s) && !/edg\//i.test(s) && (pick(/Chrom(?:e|ium)\/(\d+)/))) browser = 'chrome';
  else if (/safari/i.test(s) && /version\//i.test(s) && pick(/Version\/(\d+)/)) browser = 'safari';
  else if (/safari/i.test(s) && /iphone|ipad/i.test(s)) browser = 'safari';
  let os = 'other';
  const plat = String(hints.platform || '').replace(/"/g, '').toLowerCase();
  if (/iphone|ipad|ipod/.test(low) || plat === 'ios') os = 'ios';
  else if (/android/.test(low) || plat === 'android') os = 'android';
  else if (/cros/.test(low) || plat === 'chromeos') os = 'chromeos';
  else if (/mac os x|macintosh/.test(low) || plat === 'macos') os = 'macos';
  else if (/windows/.test(low) || plat === 'windows') os = 'windows';
  else if (/linux|x11/.test(low) || plat === 'linux') os = 'linux';
  let cls = 'unknown';
  if (!s || s.length < 10 || BOT_UA.test(s)) cls = 'bot';
  else if (/ipad|tablet|kindle|silk|playbook|nexus (7|9|10)/.test(low) || (/android/.test(low) && !/mobile/.test(low))) cls = 'tablet';
  else if (hints.mobile === true || /mobi|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini/.test(low)) cls = 'mobile';
  else if (os !== 'other') cls = 'desktop';
  return { browser, browser_version: version, os, class: cls, bot_hint: cls === 'bot' };
}

function langList(header) {
  return String(header || '').split(',').map((p) => p.split(';')[0].trim().toLowerCase()).filter(Boolean).slice(0, 8);
}

function ipPrefix(ip) {
  const s = String(ip || '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) return s.split('.').slice(0, 3).join('.') + '.0/24';
  if (s.includes(':')) {
    const full = s.split('::');
    const head = (full[0] || '').split(':').filter(Boolean);
    return head.slice(0, 3).join(':') + '::/48';
  }
  return '';
}

const PRINTABLE = /^[\x20-\x7e]{1,256}$/;

function tzParts(date, tz) {
  try {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const p = {};
    for (const x of f.formatToParts(date)) p[x.type] = x.value;
    const hour = Number(p.hour) % 24;
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
    return { hhmm: `${String(hour).padStart(2, '0')}:${p.minute}`, hour, dow, date: `${p.year}-${p.month}-${p.day}`, ok: true };
  } catch {
    return { hhmm: null, hour: null, dow: null, date: null, ok: false };
  }
}

/** Deterministic 0–99 bucket from an id and a salt. */
export async function bucketOf(id, salt) {
  if (!id) return null;
  const h = await sha256Hex(`${salt || ''}|${id}`);
  return parseInt(h.slice(0, 8), 16) % 100;
}

/** The JCI-era visitor stitch hash (24 hex chars) — matches functions/_lib/jci.js hashVisitorIp. */
export async function visitorHashOf(ip) {
  if (!ip) return null;
  return (await sha256Hex(`${ip}|${JCI_IP_SALT}`)).slice(0, 24);
}

/** Plan-independent network class from the AS organisation name. A guess, labelled as one. */
export function classifyNetwork(asOrg) {
  const s = String(asOrg || '');
  if (!s) return 'unknown';
  if (VPN_ORG.test(s)) return 'vpn';
  if (HOSTING_ORG.test(s)) return 'datacenter';
  return 'residential_guess';
}

/** Consistency signals reproducible from current data. */
export function consistencySignals(ctx) {
  const tzReported = ctx.device?.timezone, tzIp = ctx.network?.ip_timezone;
  const timezone = tzReported && tzIp ? (tzReported === tzIp ? 'match' : 'mismatch') : 'unknown';
  const hint = ctx.device?.mobile_hint;
  const cls = ctx.device?.class;
  let device = 'unknown';
  if (hint === true) device = cls === 'mobile' || cls === 'tablet' ? 'match' : 'mismatch';
  else if (hint === false) device = cls === 'desktop' ? 'match' : (cls === 'mobile' ? 'mismatch' : 'unknown');
  return { timezone, device };
}

/**
 * Build the normalized signal context for a request.
 * `stored` carries what identity/store resolution already knows (device, profile, turnstile, acks,
 * memberships, history…). `cfg` is the ruleset (business_tz, capture_query, turnstile_max_age_s,
 * salt). `secret` keys the ip hash. Pure apart from the hashes; no I/O.
 */
export async function normalizeRequest({ request, url, cf, cookies, entry, now, stored = {}, cfg = {}, campaign = null, secret = '', remote = null }) {
  const u = url instanceof URL ? url : new URL(String(url));
  const headers = request?.headers || new Headers();
  const h = (k) => (remote?.headers && remote.headers[k] != null) ? String(remote.headers[k]) : (headers.get ? (headers.get(k) || '') : '');
  cf = cf || request?.cf || remote?.cf || {};
  cookies = cookies || parseCookies(h('cookie'));
  const nowDate = now ? new Date(now) : new Date();
  const ip = remote?.ip || h('cf-connecting-ip') || h('x-real-ip') || (h('x-forwarded-for') || '').split(',')[0].trim() || '';
  const ua = h('user-agent');
  const hints = { mobile: h('sec-ch-ua-mobile') === '?1' ? true : (h('sec-ch-ua-mobile') === '?0' ? false : null), platform: h('sec-ch-ua-platform') };
  const uaInfo = parseUserAgent(ua, hints);
  const query = {};
  for (const [k, v] of u.searchParams) if (!(k in query)) query[k] = v;

  const attribution = { click_ids: {}, extra: {}, malformed: [] };
  for (const k of UTM) { const v = query[k]; if (v == null) { attribution[k] = null; continue; } if (PRINTABLE.test(v)) attribution[k] = v; else { attribution[k] = null; attribution.malformed.push(k); } }
  for (const k of CLICK_IDS) { const v = query[k]; if (v == null) { if (['fbclid', 'gclid', 'ttclid', 'msclkid'].includes(k)) attribution[k] = null; continue; } if (PRINTABLE.test(v)) { attribution.click_ids[k] = v; if (['fbclid', 'gclid', 'ttclid', 'msclkid'].includes(k)) attribution[k] = v; } else { attribution.malformed.push(k); if (['fbclid', 'gclid', 'ttclid', 'msclkid'].includes(k)) attribution[k] = null; } }
  for (const k of (Array.isArray(cfg.capture_query) ? cfg.capture_query : [])) { const v = query[k]; if (v != null) { if (PRINTABLE.test(v)) attribution.extra[k] = v; else attribution.malformed.push(k); } }
  attribution.click_id_present = Object.keys(attribution.click_ids).length > 0;
  const referrer = h('referer');
  let referrer_host = '';
  try { referrer_host = referrer ? new URL(referrer).hostname.toLowerCase() : ''; } catch { referrer_host = ''; }
  attribution.referring_domain = referrer_host;
  attribution.landing_page = u.pathname + (u.search || '');
  attribution.original = stored.original_attribution || null;

  const businessTz = cfg.business_tz || 'America/Los_Angeles';
  const visitorTz = cookies.ms_tz && /^[A-Za-z_]+\/[A-Za-z_\/+-]+$|^UTC$/.test(cookies.ms_tz) ? cookies.ms_tz : (cf.timezone || null);
  const b = tzParts(nowDate, businessTz);
  const v = visitorTz ? tzParts(nowDate, visitorTz) : { hhmm: null, hour: null, dow: null };

  let ch = {};
  try { ch = cookies.ms_ch ? JSON.parse(cookies.ms_ch) : {}; } catch { ch = {}; }
  const deviceId = stored.device?.id || cookies.ms_did || null;
  const languages = langList(h('accept-language'));
  const botScore = cf.botManagement && typeof cf.botManagement.score === 'number' ? cf.botManagement.score : (typeof cf.clientTrustScore === 'number' ? cf.clientTrustScore : null);
  const botSource = botScore != null ? 'bot_management' : 'ua_heuristic';
  const uaBot = uaInfo.bot_hint || h('x-purpose') === 'preview' || h('purpose') === 'prefetch';
  const risk = botScore != null ? Math.max(0, Math.min(100, 100 - botScore)) : (uaBot ? 80 : 20);

  const safeHeaders = {};
  for (const k of SAFE_HEADERS) { const val = h(k); if (val) safeHeaders[k] = val.slice(0, 200); }

  const ipHash = ip ? (await sha256Hex(`${secret}|ip|${ip}`)).slice(0, 32) : null;
  const salt = cfg.salt || cfg.id || '';
  const trustExpired = stored.device?.trust_expires_at ? String(stored.device.trust_expires_at) < new Date(nowDate).toISOString().replace('Z', '') && new Date(stored.device.trust_expires_at).getTime() < nowDate.getTime() : false;
  const hist = stored.history || null;
  const snapshot = stored.profile?.snapshot || {};
  const ctx = {
    request: {
      id: remote?.request_id || h('cf-ray') || cryptoId(),
      method: (remote?.method || request?.method || 'GET').toUpperCase(), phase: remote?.phase || 'visit',
      host: u.hostname.toLowerCase(), path: u.pathname, entry: entry || null, query,
      referrer, referrer_host, user_agent: ua, languages, language: (languages[0] || '').slice(0, 2) || null,
      secure: u.protocol === 'https:', headers: safeHeaders,
    },
    network: {
      ip, ip_hash: ipHash, ip_prefix: ipPrefix(ip), visitor_hash: stored.visitor_hash || (ip ? await visitorHashOf(ip) : null),
      country: cf.country || null, region: cf.region || null, region_code: cf.regionCode || null, city: cf.city || null, postal_code: cf.postalCode || null,
      asn: cf.asn != null ? Number(cf.asn) : null, as_org: cf.asOrganization || null, ip_timezone: cf.timezone || null, colo: cf.colo || null,
      http_protocol: cf.httpProtocol || null, tls_version: cf.tlsVersion || null,
      bot_score: botScore, verified_bot: cf.botManagement ? !!cf.botManagement.verifiedBot : null, verified_bot_category: cf.verifiedBotCategory || null,
      bot_hint: !!uaBot, bot_signal_source: botSource, risk,
      type: hist?.signals?.network_type && !/^unmapped/.test(hist.signals.network_type) ? hist.signals.network_type : classifyNetwork(cf.asOrganization),
      connection_type: hist?.signals?.connection_type || null,
    },
    device: {
      id: deviceId, new: !cookies.ms_did, known: !!stored.device, trusted: !!(stored.device && Number(stored.device.trusted) && !stored.device.revoked_at && !trustExpired), revoked: !!(stored.device && stored.device.revoked_at), trust_expires_at: stored.device?.trust_expires_at || null,
      class: uaInfo.class, browser: uaInfo.browser, browser_version: uaInfo.browser_version, os: uaInfo.os, mobile_hint: hints.mobile,
      touch: ch.t == null ? null : !!ch.t, viewport_class: ch.v || null, screen: ch.s || null, timezone: visitorTz && cookies.ms_tz ? cookies.ms_tz : null, locale: ch.l || null,
      cookies: !!(cookies.ms_did || cookies.ms_sid),
    },
    attribution,
    time: {
      utc: nowDate.toISOString(), business_tz: businessTz, business_hhmm: b.hhmm, business_hour: b.hour, business_dow: b.dow, business_date: b.date,
      visitor_tz: visitorTz, visitor_hhmm: v.hhmm, visitor_hour: v.hour, visitor_dow: v.dow,
    },
    session: { id: cookies.ms_sid || null, new: !cookies.ms_sid },
    profile: {
      id: stored.profile?.id || null, known: !!Number(stored.profile?.known), customer: !!Number(stored.profile?.customer), account_state: stored.profile?.account_state || null,
      status: stored.memberships?.status || 'unknown', status_source: stored.memberships?.source || null, memberships: stored.memberships?.list || [],
      tags: stored.profile?.tags || [], segments: Array.isArray(snapshot.segments) ? [...snapshot.segments] : [], features: snapshot.features || {}, snapshot_version: stored.profile?.version ?? snapshot.version ?? null,
      visit_count: stored.profile?.visit_count || 0, returning: (stored.profile?.visit_count || 0) > 0 || !!stored.device,
      first_seen: stored.profile?.first_seen || null, previous_destinations: stored.previous_destinations || [], acks: stored.acks || {},
      experiments: stored.experiments || {}, identifier_kinds: stored.identifier_kinds || [], attrs: stored.profile?.attrs || {}, merged: !!stored.profile?.merged,
    },
    history: hist ? { jci_status: hist.jci_status, jci_reasons: hist.jci_reasons || [], rows: hist.rows || 0, signals: hist.signals || {} } : { jci_status: 'unknown', jci_reasons: [], rows: 0, signals: {} },
    consistency: { timezone: 'unknown', device: 'unknown' },
    geo: { expected_country_match: null },
    campaign: { id: campaign?.id || null, name: campaign?.name || null },
    turnstile: { valid: false, age_s: null, verified_at: null, skip: false },
    lists: { allow_match: false, deny_match: false, allow: [], deny: [], kinds: [] },
    buckets: { request: Math.floor(Math.random() * 100), device: await bucketOf(deviceId, salt), profile: await bucketOf(stored.profile?.id, salt) },
    experiment: { id: null, variant: null },
    grant: { valid: false, destination: null },
    custom: Object.assign({}, remote?.custom || {}),
  };
  ctx.consistency = consistencySignals(ctx);
  if (campaign) {
    let expected = [];
    try { expected = JSON.parse(campaign.expected_countries_json || '[]'); } catch { expected = []; }
    if (Array.isArray(expected) && expected.length) ctx.geo.expected_country_match = expected.map((c) => String(c).toUpperCase()).includes(String(ctx.network.country || '').toUpperCase());
  }
  if (stored.turnstile && stored.turnstile.verified_at) {
    const age = Math.max(0, Math.floor((nowDate.getTime() - Number(stored.turnstile.verified_at)) / 1000));
    const maxAge = Number(cfg.turnstile_max_age_s || 86400);
    ctx.turnstile = { valid: age <= maxAge, age_s: age, verified_at: new Date(Number(stored.turnstile.verified_at)).toISOString(), skip: false };
  }
  if (stored.grant && stored.grant.destination) ctx.grant = { valid: true, destination: stored.grant.destination };
  return ctx;
}

function cryptoId() {
  try { return 'r_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16); } catch { return 'r_' + Math.random().toString(36).slice(2, 14); }
}

/** Strip anything that must not be persisted (raw IP) and cap size before storing signals. */
export function persistableSignals(ctx) {
  const c = JSON.parse(JSON.stringify(ctx));
  if (c.network) delete c.network.ip;
  return c;
}
