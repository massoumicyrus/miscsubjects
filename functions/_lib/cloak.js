// Standalone server-side cloaker — fallback when JCI is not configured
// Use on any page: import { cloak } from './cloak.js' and call it in the handler

// PROTECTED — ACTIVE AD CAMPAIGNS DEPEND ON THIS
// DO NOT EDIT BOT SIGNATURES, MONEY PAGE, OR SAFE PAGE WITHOUT EXPLICIT OWNER APPROVAL
// This cloaker is actively used by Meta ads running from multiple ad accounts
// Changing any regex or default URL can break live ad campaigns
// Current money page: https://leoresearch.com/l/meta (set in D1 settings table, key CLOAKER_MONEY_PAGE)
// Current safe page: generic HTML below (customizable via D1 settings table, key CLOAKER_SAFE_PAGE_HTML)
// Admin: https://miscsubjects.com/admin/cloaker

// Known bot / reviewer / crawler signatures
const BLOCKED_UA = [
  /bot/i, /crawler/i, /spider/i, /scrape/i, /headless/i,
  /phantom/i, /selenium/i, /puppeteer/i, /playwright/i,
  /facebookexternalhit|facebookcatalog|facebookbot/i,
  /meta.*crawler|meta.*preview/i,
  /googlebot/i, /bingbot/i, /yahoo/i, /yandex/i,
];

const BLOCKED_IPS = []; // populate from KV if needed
const BLOCKED_ASN = []; // populate from KV if needed

function isBot(request) {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  const cfBot = request.headers.get('cf-bot-management');
  
  // Cloudflare bot score (Enterprise only)
  if (cfBot) {
    try {
      const score = parseInt(cfBot);
      if (score < 30) return true;
    } catch {}
  }
  
  // User-agent checks
  if (!ua || ua.length < 10) return true;
  for (const re of BLOCKED_UA) {
    if (re.test(ua)) return true;
  }
  
  // Header checks
  if (request.headers.get('x-bot')) return true;
  if (request.headers.get('x-purpose') === 'preview') return true;
  
  return false;
}

// Safe page — generic, minimal, no domain leakage
function safePage(options) {
  const html = options?.safePageHtml || '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Loading</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f8f9fa;color:#333;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}</style></head><body><div><p>Loading...</p></div></body></html>';
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// Money page redirect for real humans
function moneyPage(options) {
  const url = options?.moneyPage || 'https://leoresearch.com/l/meta';
  return new Response(null, {
    status: 302,
    headers: {
      'location': url,
      'cache-control': 'no-store',
    },
  });
}

// Main cloak function — returns safePage if bot, moneyPage if real user
export function cloak(request, options) {
  // Bypass for debug
  const url = new URL(request.url);
  if (url.searchParams.get('cloak') === 'off') return null;
  
  if (isBot(request)) {
    return safePage(options);
  }
  return moneyPage(options);
}

// Middleware-style wrapper — use as: export async function onRequest(context) { return cloaked(context, () => realHandler(context)); }
export async function cloaked(context, handler) {
  const blocked = cloak(context.request);
  if (blocked) return blocked;
  return handler();
}
