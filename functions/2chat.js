import { dispatch } from './api/dispatch.js';
import { processWebhook } from './_lib/webhook_intake.js';

const TWOCHAT_FROM = '[PHONE]';

export async function send2chat(env, chat, text, imgs) {
  try {
    const body = (text || '') + (Array.isArray(imgs) && imgs.length ? '\n' + imgs.join('\n') : '');
    if (!body.trim()) return '';
    const dest = String(chat || '');
    const key = dest.startsWith('WAG') ? 'TWOCHAT_SEND_GROUP' : 'TWOCHAT_SEND';
    const r = await dispatch(env, key, `${TWOCHAT_FROM}|${dest}|${body}`);
    return String(r.result || '');
  } catch (e) { return String(e); }
}

export const onRequestPost = (context) => processWebhook(context, '2chat');

export function onRequestGet() {
  return new Response('2chat webhook receiver — POST /2chat with the 2chat payload shape', { headers: { 'content-type': 'text/plain' } });
}
