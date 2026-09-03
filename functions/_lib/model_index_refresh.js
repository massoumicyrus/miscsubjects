// The refresh half of the living leaderboard.
//
// Two kinds of source feed this table and they are not treated alike.
//
// MACHINE-READABLE, re-read on every refresh: OpenRouter's public model endpoint and its
// per-model endpoint list. These give current prices for every model at every venue that
// sells it, which is the fastest-moving and most arbitraged data in the market.
//
// HUMAN-READ, seeded with the date they were read: benchmark leaderboards and first-party
// pricing pages, which are rendered client-side or sit behind keys. These carry the read
// date and the reader, and go stale honestly rather than silently.
//
// Nothing is updated in place. A changed price is a NEW observation and the previous row is
// stamped superseded_by, so the table answers "what did we believe on 4 August" as well as
// "what is true now". That is the difference between a leaderboard and a work object.

import { buildNowIso } from './build_time.js';

const OR_MODELS = 'https://openrouter.ai/api/v1/models';
const OR_ENDPOINTS = (id) => `https://openrouter.ai/api/v1/models/${id}/endpoints`;

// The models whose venue spread is worth re-reading every run. Open-weight models are sold by
// many hosts at very different prices; closed models have one seller and need no endpoint sweep.
const SPREAD_WATCH = [
  'deepseek/deepseek-v4-flash',
  'deepseek/deepseek-v4-pro',
  'z-ai/glm-5.2',
  'moonshotai/kimi-k3',
  'minimax/minimax-m3',
  'qwen/qwen3.7-max',
];

const VENUE_KIND = {
  DeepSeek: 'maker', 'Z.AI': 'maker', 'Moonshot AI': 'maker', Minimax: 'maker', Alibaba: 'maker',
  Cloudflare: 'cloud', Together: 'host', Fireworks: 'host', DeepInfra: 'host', Novita: 'host',
  BaseTen: 'host', CoreWeave: 'host', Parasail: 'host', DigitalOcean: 'cloud', Baidu: 'cloud',
  GMICloud: 'host', StreamLake: 'host', SiliconFlow: 'host', AtlasCloud: 'host', Venice: 'host',
};

function id() {
  return 'mio_' + crypto.randomUUID();
}

async function insert(env, runId, o) {
  await env.DB.prepare(`
    INSERT INTO model_index_observations
      (id, observed_at, event_date, model_key, model_label, maker, weights, metric, metric_family,
       value_num, value_text, unit, venue, venue_kind, precision_note,
       source_url, source_title, source_publisher, source_type, quote,
       evidence_class, method, caveat, superseded_by, run_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?)`)
    .bind(id(), buildNowIso(), o.event_date || null, o.model_key, o.model_label, o.maker || null,
      o.weights || 'unknown', o.metric, o.metric_family, o.value_num == null ? null : o.value_num,
      o.value_text || null, o.unit || null, o.venue || null, o.venue_kind || null, o.precision_note || null,
      o.source_url, o.source_title || null, o.source_publisher || null, o.source_type, o.quote || null,
      o.evidence_class, o.method || null, o.caveat || null, runId).run();
}

// Supersede rather than overwrite: the old belief stays readable, stamped with what replaced it.
async function supersede(env, modelKey, metric, venue, keepRunId) {
  await env.DB.prepare(`
    UPDATE model_index_observations
       SET superseded_by = (SELECT id FROM model_index_observations n
                             WHERE n.model_key = ? AND n.metric = ?
                               AND (n.venue IS ? OR n.venue = ?) AND n.run_id = ?
                             ORDER BY n.observed_at DESC LIMIT 1)
     WHERE model_key = ? AND metric = ? AND (venue IS ? OR venue = ?)
       AND superseded_by IS NULL AND run_id != ?`)
    .bind(modelKey, metric, venue, venue, keepRunId, modelKey, metric, venue, venue, keepRunId).run();
}

export async function refreshModelIndex(env) {
  const runId = 'run_' + crypto.randomUUID();
  const startedAt = buildNowIso();
  await env.DB.prepare('INSERT INTO model_index_runs (run_id, started_at) VALUES (?,?)')
    .bind(runId, startedAt).run();

  let okCount = 0, failCount = 0, written = 0;
  const detail = [];

  // ---- 1. every model OpenRouter sells, at OpenRouter's own price
  try {
    const data = (await (await fetch(OR_MODELS)).json()).data || [];
    for (const m of data) {
      const p = m.pricing || {};
      const pin = Number(p.prompt) * 1e6;
      const pout = Number(p.completion) * 1e6;
      if (!isFinite(pin) || !isFinite(pout) || (pin <= 0 && pout <= 0)) continue;
      const base = {
        model_key: m.id, model_label: m.name || m.id,
        maker: String(m.id).split('/')[0], weights: 'unknown',
        venue: 'OpenRouter', venue_kind: 'router',
        source_url: OR_MODELS, source_title: 'OpenRouter public model endpoint',
        source_publisher: 'OpenRouter', source_type: 'first_party_api',
        evidence_class: 'measured',
        method: 'Read directly from the router\'s public pricing endpoint on the date shown.',
        caveat: 'A router price, not the maker\'s price, and it can carry an unannounced promotion.',
      };
      await insert(env, runId, { ...base, metric: 'price_in_usd_per_mtok', metric_family: 'price', value_num: pin, unit: 'usd_per_mtok' });
      await insert(env, runId, { ...base, metric: 'price_out_usd_per_mtok', metric_family: 'price', value_num: pout, unit: 'usd_per_mtok' });
      written += 2;
    }
    okCount++; detail.push(`openrouter_models ok, ${data.length} models`);
  } catch (e) { failCount++; detail.push('openrouter_models FAILED: ' + e.message); }

  // ---- 2. the venue spread: same weights, every host, its own price and precision
  for (const mid of SPREAD_WATCH) {
    try {
      const d = (await (await fetch(OR_ENDPOINTS(mid))).json()).data || {};
      const eps = d.endpoints || [];
      for (const e of eps) {
        const p = e.pricing || {};
        const pin = Number(p.prompt) * 1e6;
        const pout = Number(p.completion) * 1e6;
        if (!isFinite(pin) || !isFinite(pout)) continue;
        const venue = e.provider_name || 'unknown';
        const base = {
          model_key: mid, model_label: d.name || mid, maker: String(mid).split('/')[0], weights: 'open',
          venue, venue_kind: VENUE_KIND[venue] || 'host', precision_note: e.quantization || 'unstated',
          source_url: OR_ENDPOINTS(mid), source_title: `OpenRouter endpoint list for ${mid}`,
          source_publisher: 'OpenRouter', source_type: 'first_party_api',
          evidence_class: 'measured',
          method: 'Read from the router\'s per-model endpoint list, which names every host serving these weights.',
          caveat: 'A cheaper endpoint is often quantised. No benchmark score on this page was measured on a quantised endpoint.',
        };
        await insert(env, runId, { ...base, metric: 'price_in_usd_per_mtok', metric_family: 'price', value_num: pin, unit: 'usd_per_mtok' });
        await insert(env, runId, { ...base, metric: 'price_out_usd_per_mtok', metric_family: 'price', value_num: pout, unit: 'usd_per_mtok' });
        written += 2;
      }
      okCount++; detail.push(`endpoints ${mid} ok, ${eps.length} venues`);
    } catch (e) { failCount++; detail.push(`endpoints ${mid} FAILED: ` + e.message); }
  }

  // ---- 2.5 verify the sources registry is alive: fetch each live source and stamp what
  // happened. A registry whose links are never re-checked decays into a list of beliefs.
  try {
    const reg = await env.DB.prepare(
      'SELECT id, url, machine_endpoint FROM model_index_sources WHERE retired_at IS NULL').all();
    const rows = reg.results || [];
    const checks = await Promise.allSettled(rows.map(async (s) => {
      const target = s.machine_endpoint || s.url;
      const res = await fetch(target, { headers: { 'user-agent': 'miscsubjects-model-index/1.0' }, redirect: 'follow' });
      return { id: s.id, status: res.status };
    }));
    let verified = 0;
    for (const c of checks) {
      if (c.status !== 'fulfilled') continue;
      await env.DB.prepare('UPDATE model_index_sources SET verified_at=?, verified_status=? WHERE id=?')
        .bind(buildNowIso(), c.value.status, c.value.id).run();
      verified++;
    }
    okCount++; detail.push(`sources_registry verified ${verified}/${rows.length}`);
  } catch (e) { detail.push('sources_registry verify FAILED: ' + e.message); }

  // ---- 3. supersede everything this run replaced, per model+metric+venue
  try {
    await env.DB.prepare(`
      UPDATE model_index_observations
         SET superseded_by = 'superseded_by_run:' || ?
       WHERE superseded_by IS NULL
         AND run_id != ?
         AND metric_family = 'price'
         AND EXISTS (SELECT 1 FROM model_index_observations n
                      WHERE n.run_id = ?
                        AND n.model_key = model_index_observations.model_key
                        AND n.metric = model_index_observations.metric
                        AND IFNULL(n.venue,'') = IFNULL(model_index_observations.venue,''))`)
      .bind(runId, runId, runId).run();
  } catch (e) { detail.push('supersede FAILED: ' + e.message); }

  const finishedAt = buildNowIso();
  await env.DB.prepare(
    'UPDATE model_index_runs SET finished_at=?, sources_ok=?, sources_failed=?, observations=?, detail=? WHERE run_id=?')
    .bind(finishedAt, okCount, failCount, written, detail.join(' | '), runId).run();

  return { ok: failCount === 0, run_id: runId, started_at: startedAt, finished_at: finishedAt,
    sources_ok: okCount, sources_failed: failCount, observations_written: written, detail };
}
