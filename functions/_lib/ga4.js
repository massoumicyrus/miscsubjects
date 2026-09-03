/** Google Analytics 4 — settings-driven, default leoresearch property. */

export const GA_DEFAULT_ID = 'G-TTCENZ3CJY';

export async function getGaMeasurementId(env) {
  try {
    const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('ga_measurement_id').first();
    const v = String(row?.value || '').trim();
    if (/^G-[A-Z0-9]+$/i.test(v)) return v.toUpperCase();
  } catch {}
  return GA_DEFAULT_ID;
}

export function ga4HeadHtml(measurementId) {
  const id = String(measurementId || '').trim();
  if (!/^G-[A-Z0-9]+$/i.test(id)) return '';
  const esc = id.replace(/"/g, '');
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${esc}',{send_page_view:true});</script>`;
}

export async function ga4HeadForEnv(env) {
  return ga4HeadHtml(await getGaMeasurementId(env));
}