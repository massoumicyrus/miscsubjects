// GET /api/providers            → { field_spec, companies, providers }
// GET /api/providers/<company>  → one provider (e.g. /api/providers/xai)
// GET /api/providers/<company>/<modality> → that provider's models of one modality
// The on-hand documentation the LLM-creation form reads (T5/T6/T7), served raw.
import { FIELD_SPEC, PROVIDERS, listCompanies, GATEWAY } from '../../_lib/providers.js';

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}

export async function onRequest(context) {
  const { params } = context;
  const seg = Array.isArray(params.path) ? params.path : (params.path ? [params.path] : []);
  const [company, modality] = seg;

  if (!company) {
    return json({ gateway: GATEWAY, field_spec: FIELD_SPEC, companies: listCompanies(), providers: PROVIDERS });
  }
  const p = PROVIDERS[String(company).toLowerCase()];
  if (!p) return json({ error: 'unknown_company:' + company, companies: Object.keys(PROVIDERS) }, 404);
  if (!modality) return json({ company: String(company).toLowerCase(), field_spec: FIELD_SPEC, ...p });
  const models = p.models.filter(m => m.modality === String(modality).toLowerCase());
  return json({ company: String(company).toLowerCase(), modality: String(modality).toLowerCase(), count: models.length, base_url: p.base_url, api_key_name: p.api_key_name, endpoints: p.endpoints, models });
}
