import { processWebhook } from './_lib/webhook_intake.js';
import { logEvent } from './_lib/event_log.js';

async function tg(env, method, body) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  const r = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}),
  });
  const text = await r.text();
  // Ledger guarantee (T11): every payload out is logged raw. Token redacted in the URL.
  try {
    await logEvent(env, {
      source: 'telegram', key: 'SEND_TELEGRAM', action: method, direction: 'OUT', status: r.status,
      request: JSON.stringify({ url: url.replace(/bot[^/]+/, 'bot<REDACTED>'), method: 'POST', body: body || {} }),
      response: text,
    });
  } catch {}
  try { return JSON.parse(text); } catch { return {}; }
}

export async function sendTelegram(env, chat, text, media) {
  try {
    if (Array.isArray(media) && media.length) {
      const items = media.map(u => ({ type: 'photo', media: u }));
      if (items.length === 1) {
        return tg(env, 'sendPhoto', { chat_id: chat, photo: media[0], caption: text || '' });
      }
      if (text) items[0].caption = text;
      return tg(env, 'sendMediaGroup', { chat_id: chat, media: items });
    }
    if (!text) return {};
    return tg(env, 'sendMessage', { chat_id: chat, text });
  } catch (e) { return { error: String(e) }; }
}

export const onRequestPost = (context) => processWebhook(context, 'telegram');

export function onRequestGet() {
  return new Response('telegram webhook receiver — POST /telegram with a Telegram Update payload', { headers: { 'content-type': 'text/plain' } });
}
