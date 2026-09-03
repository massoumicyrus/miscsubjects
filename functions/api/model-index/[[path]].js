// /api/model-index — the machine projection of the living model leaderboard.
//
//   GET  /api/model-index                  the current view: one live row per model per metric
//   GET  /api/model-index?metric=price_in  one metric across every model and venue
//   GET  /api/model-index?model=<key>      everything known about one model, with provenance
//   GET  /api/model-index/observations     the raw observation log, superseded rows included
//   GET  /api/model-index/runs             every refresh, what it read and what failed
//   POST /api/model-index/refresh          re-read the machine-readable sources (keyed)
//
// EVERY NUMBER CARRIES ITS PROVENANCE. There is no route that returns a bare figure. A caller
// that wants to disagree with this leaderboard can fetch the observation, open the source_url,
// read the quote, see the evidence_class and the caveat, and supersede it with its own reading.
// That is the whole point: a leaderboard nobody can audit is a press release.

import { buildNowIso } from '../../_lib/build_time.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,x-terminal-key',
};

const AI_DOOR = {
  see: 'https://miscsubjects.com/model-index',
  note: 'Every figure here is an observation with a source URL, a read date and an evidence class. '
    + 'Disagree by fetching the observation and reading its source, not by trusting this list.',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS },
  });
}

function authed(request, env) {
  const h = String(request.headers.get('authorization') || '');
  const bearer = (h.match(/^Bearer\s+(.+)$/i) || [])[1];
  const presented = (bearer || request.headers.get('x-terminal-key') || '').trim();
  return !!presented && [env.TERMINAL_KEY, env.INVOKE_TOKEN].filter(Boolean).includes(presented);
}

const EVIDENCE_CLASSES = {
  measured: 'A number produced by running something and recording the result. The strongest class here.',
  reported: 'A named third party states it. Attribution required; not independently reproduced by this build.',
  vendor_stated: 'The seller states it about its own product. True as a price, interested as a claim.',
  derived: 'Computed by this build from two or more observations. The inputs are linked.',
  promotional: 'A price that is explicitly temporary. Carries an end date where one is published.',
  unresolved: 'Sources conflict and the evidence does not decide it. The conflict is shown, not averaged.',
};

const METRIC_DEFS = {
  price_in_usd_per_mtok: { family: 'price', unit: 'usd_per_mtok', better: 'lower', what: 'List price for one million input tokens at a named venue.' },
  price_out_usd_per_mtok: { family: 'price', unit: 'usd_per_mtok', better: 'lower', what: 'List price for one million output tokens at a named venue.' },
  cost_per_task_usd: { family: 'price', unit: 'usd', better: 'lower', what: "Measured cost of one vendor's task suite. Not a production task price." },
  price_cached_in_usd_per_mtok: { family: 'price', unit: 'usd_per_mtok', better: 'lower', what: 'Price of one million cache-hit input tokens. In an agent loop most input tokens are replayed context, so this is closer to the real input price than the list price is.' },
  swe_bench_verified: { family: 'capability', unit: 'fraction', better: 'higher', what: 'Share of 500 human-validated real GitHub issues resolved, graded by running the repository tests.' },
  terminal_bench_2_1: { family: 'capability', unit: 'percent', better: 'higher', what: 'Agentic competence in a shell: running commands, reading output, recovering from failure.' },
  aa_intelligence_index: { family: 'capability', unit: 'index', better: 'higher', what: "One vendor's composite of several evaluations. Index points are not a linear scale and are never converted to percentages." },
  aa_ifbench: { family: 'obedience', unit: 'percent', better: 'higher', what: "Ai2's IFBench: machine-checkable output constraints. Measures whether the model did what it was told, not whether it could." },
  eqbench_creative_elo: { family: 'writing', unit: 'elo', better: 'higher', what: 'Elo from rated comparisons of prose. The only judged, rather than executed, metric here.' },
  openrouter_tokens_week: { family: 'popularity', unit: 'tokens_per_week', better: 'higher', what: 'Weekly token volume on one marketplace. Rewards cheap high-throughput work; free tiers inflate it.' },
};

async function currentRows(env, where = '', binds = []) {
  const sql = `SELECT * FROM model_index_observations
               WHERE superseded_by IS NULL ${where}
               ORDER BY metric_family, metric, value_num DESC`;
  const r = await env.DB.prepare(sql).bind(...binds).all();
  return r.results || [];
}

function shape(row) {
  return {
    model: { key: row.model_key, label: row.model_label, maker: row.maker, weights: row.weights },
    metric: row.metric,
    metric_family: row.metric_family,
    what_it_measures: (METRIC_DEFS[row.metric] || {}).what || null,
    value: row.value_num != null ? row.value_num : row.value_text,
    unit: row.unit,
    venue: row.venue ? { name: row.venue, kind: row.venue_kind, precision: row.precision_note } : null,
    evidence: {
      class: row.evidence_class,
      class_means: EVIDENCE_CLASSES[row.evidence_class] || null,
      method: row.method,
      caveat: row.caveat,
    },
    provenance: {
      source_url: row.source_url,
      title: row.source_title,
      publisher: row.source_publisher,
      source_type: row.source_type,
      quote: row.quote,
      event_date: row.event_date,
      read_at: row.observed_at,
    },
    observation_id: row.id,
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequest({ request, env, params }) {
  const url = new URL(request.url);
  const seg = (params.path || []).join('/');

  if (request.method === 'POST' && seg === 'refresh') {
    if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
    const { refreshModelIndex } = await import('../../_lib/model_index_refresh.js');
    return json(await refreshModelIndex(env));
  }

  if (seg === 'sources') {
    let rows = [];
    let error = null;
    try {
      const r = await env.DB.prepare(
        'SELECT * FROM model_index_sources ORDER BY lane, name').all();
      rows = r.results || [];
    } catch (e) { error = String(e && e.message ? e.message : e); }
    return json({
      _ai_door: AI_DOOR,
      _self: {
        what: 'The definitive sources registry: every surface this index reads from, and every '
          + 'surface a model should read to answer the same questions itself. Lanes: capability '
          + '(what models can do), price (what they cost, machine-readable preferred), usage '
          + '(what developers actually pick), practice (how the labs say to run agents), trends '
          + '(where new work appears first).',
        how_to_use: 'Fetch machine_endpoint where present; it is verified by this build and '
          + 'stamped verified_at with the HTTP status it returned. A retired row names why it died.',
        registry_is_appendable: 'A missing source is a defect. Propose one by inspecting this '
          + 'article and signing the proof object with the URL and the lane it belongs in.',
      },
      error,
      count: rows.length,
      live: rows.filter((r) => !r.retired_at).length,
      sources: rows,
    });
  }

  if (seg === 'runs') {
    const r = await env.DB.prepare('SELECT * FROM model_index_runs ORDER BY started_at DESC LIMIT 50').all();
    return json({ _ai_door: AI_DOOR, runs: r.results || [] });
  }

  if (seg === 'observations') {
    const limit = Math.min(Number(url.searchParams.get('limit') || 500), 2000);
    const r = await env.DB.prepare(
      'SELECT * FROM model_index_observations ORDER BY observed_at DESC LIMIT ?').bind(limit).all();
    return json({
      _ai_door: AI_DOOR,
      note: 'The raw log, superseded rows included. Nothing here is ever deleted or overwritten.',
      count: (r.results || []).length,
      observations: (r.results || []).map(shape),
    });
  }

  // default: the current view
  const model = url.searchParams.get('model');
  const metric = url.searchParams.get('metric');
  const family = url.searchParams.get('family');
  let where = '';
  const binds = [];
  if (model) { where += ' AND model_key = ?'; binds.push(model); }
  if (metric) { where += ' AND metric = ?'; binds.push(metric); }
  if (family) { where += ' AND metric_family = ?'; binds.push(family); }

  let rows = [];
  let error = null;
  try { rows = await currentRows(env, where, binds); }
  catch (e) { error = String(e && e.message ? e.message : e); }

  const lastRun = await env.DB.prepare('SELECT * FROM model_index_runs ORDER BY started_at DESC LIMIT 1')
    .first().catch(() => null);

  return json({
    _ai_door: AI_DOOR,
    _self: {
      what: 'A living leaderboard of language models held as observations, not as a table of figures. '
        + 'Each row is one measurement of one model on one metric from one named source on one date.',
      human_projection: 'https://miscsubjects.com/model-index',
      machine_projection: 'https://miscsubjects.com/api/model-index',
      raw_log: 'https://miscsubjects.com/api/model-index/observations',
      refresh_history: 'https://miscsubjects.com/api/model-index/runs',
      sources_registry: 'https://miscsubjects.com/api/model-index/sources',
      append_only: 'A changed figure is a new observation; the old one is marked superseded and kept.',
    },
    evidence_classes: EVIDENCE_CLASSES,
    metrics: METRIC_DEFS,
    last_refresh: lastRun || null,
    error,
    count: rows.length,
    observations: rows.map(shape),
  });
}
