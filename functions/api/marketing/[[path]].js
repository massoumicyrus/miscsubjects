import { buildReadAuthed, buildActAuthed } from '../../_lib/admin_session.js';
import { logEvent } from '../../_lib/event_log.js';
import {
  getMarketingState, setMarketingState, marketingSnapshot,
  marketingAccountsFull, marketingAccountDetail, triggerMetaSync,
} from '../../_lib/marketing_hub.js';
import { lblCloakerEvents, lblMetaCreatives, lblMetaTotals } from '../../_lib/lbl_viewer.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 1), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

async function ledger(env, opts) {
  return logEvent(env, { source: 'marketing', ...opts });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;
  const rawPath = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  const segments = rawPath.split('/').filter(Boolean);
  const route = segments.join('/') || 'snapshot';

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
        'access-control-allow-headers': 'content-type, x-terminal-key',
      },
    });
  }

  const readAuthed = await buildReadAuthed(request, env);
  const actAuthed = await buildActAuthed(request, env);
  if (!readAuthed) {
    const tk = request.headers.get('x-terminal-key');
    if (!env.TERMINAL_KEY || tk !== env.TERMINAL_KEY) {
      await ledger(env, { key: 'MARKETING_API', action: route, direction: 'in', status: 401, route: '/api/marketing/' + route });
      return json({ error: 'unauthorized' }, 401);
    }
  }

  const traceId = 'mktapi_' + Math.random().toString(36).slice(2, 10);

  try {
    if (route === 'snapshot' && method === 'GET') {
      const snap = await marketingSnapshot(env);
      await ledger(env, {
        key: 'MARKETING_SNAPSHOT', action: 'read', direction: 'in', status: 200,
        trace_id: traceId, response: { count: snap.meta_live?.count },
      });
      return json(snap);
    }

    if (route === 'state') {
      if (method === 'GET') {
        const st = await getMarketingState(env);
        await ledger(env, { key: 'MARKETING_STATE', action: 'read', direction: 'in', status: 200, trace_id: traceId });
        return json(st);
      }
      if (method === 'PUT' || method === 'POST') {
        if (!actAuthed) {
          await ledger(env, { key: 'MARKETING_STATE', action: 'write', direction: 'in', status: 403, trace_id: traceId });
          return json({ error: 'forbidden' }, 403);
        }
        const body = await request.json().catch(() => ({}));
        const res = await setMarketingState(env, body);
        await ledger(env, {
          key: 'MARKETING_STATE', action: 'write', direction: 'out', status: 200,
          trace_id: traceId, request: body, response: res,
        });
        return json(res);
      }
    }

    if (route === 'volume' && method === 'GET') {
      const { loadVolume } = await import('../../_lib/outreach_volume.js');
      const data = await loadVolume(env);
      await ledger(env, {
        key: 'OUTREACH_VOLUME', action: 'read', direction: 'in', status: 200,
        trace_id: traceId, response: { total_drafts: data.total_drafts, businesses: data.businesses },
      });
      return json(data);
    }

    if (route === 'volume/verdict' && method === 'POST') {
      const { setVerdict } = await import('../../_lib/outreach_volume.js');
      const body = await request.json().catch(() => ({}));
      const res = await setVerdict(env, body.item_key, body.verdict, body.note);
      await ledger(env, {
        key: 'OUTREACH_VOLUME', action: 'verdict', direction: 'out', status: res.ok ? 200 : 400,
        trace_id: traceId, request: body, response: res,
      });
      return json(res, res.ok ? 200 : 400);
    }

    if (route === 'accounts' && method === 'GET') {
      const data = await marketingAccountsFull(env);
      await ledger(env, {
        key: 'MARKETING_ACCOUNTS', action: 'read', direction: 'in', status: 200,
        trace_id: traceId, response: { live_count: data.live?.count, lbl_error: data.lbl_d1?.error || null },
      });
      return json(data);
    }

    if (route.startsWith('account/') && method === 'GET') {
      const accountId = segments.slice(1).join('/');
      const data = await marketingAccountDetail(env, accountId);
      await ledger(env, {
        key: 'MARKETING_ACCOUNT', action: 'read', direction: 'in', status: 200,
        trace_id: traceId, route: accountId, response: { account_id: accountId },
      });
      return json(data);
    }

    if (route === 'creatives' && method === 'GET') {
      const accountId = new URL(request.url).searchParams.get('account_id');
      if (accountId) {
        const { listAdCreatives, listAdImages } = await import('../../_lib/meta_graph.js');
        const [creatives, images] = await Promise.all([
          listAdCreatives(env, accountId),
          listAdImages(env, accountId),
        ]);
        await ledger(env, {
          key: 'MARKETING_CREATIVES', action: 'read_live', direction: 'in', status: 200,
          trace_id: traceId, route: accountId,
        });
        return json({ account_id: accountId, creatives, images });
      }
      const lbl = await lblMetaCreatives(env);
      await ledger(env, {
        key: 'MARKETING_CREATIVES', action: 'read_lbl', direction: 'in', status: lbl.ok ? 200 : 502,
        trace_id: traceId, response: { ok: lbl.ok, error: lbl.error || null },
      });
      return json({ lbl: lbl.ok ? lbl.data : { error: lbl.error } });
    }

    if (route === 'cloaker' && method === 'GET') {
      const limit = new URL(request.url).searchParams.get('limit') || '50';
      const r = await lblCloakerEvents(env, limit);
      await ledger(env, {
        key: 'MARKETING_CLOAKER', action: 'read', direction: 'in', status: r.ok ? 200 : 502,
        trace_id: traceId, response: { ok: r.ok, error: r.error || null },
      });
      return json(r.ok ? r.data : { error: r.error, rows: [] });
    }

    if (route === 'totals' && method === 'GET') {
      const r = await lblMetaTotals(env);
      await ledger(env, {
        key: 'MARKETING_TOTALS', action: 'read', direction: 'in', status: r.ok ? 200 : 502,
        trace_id: traceId,
      });
      return json(r.ok ? r.data : { error: r.error });
    }

    if (route === 'sync' && method === 'POST') {
      if (!actAuthed) {
        await ledger(env, { key: 'META_SYNC_BACKFILL', action: 'write', direction: 'in', status: 403, trace_id: traceId });
        return json({ error: 'forbidden' }, 403);
      }
      const res = await triggerMetaSync(env, 'admin/marketing');
      await ledger(env, {
        key: 'META_SYNC_BACKFILL', action: 'meta_insights_backfill', direction: 'out',
        status: res.ok ? 200 : 502, trace_id: traceId, response: res.data || res,
      });
      return json(res, res.ok ? 200 : 502);
    }

    // ---- Meta Marketing API + Ads MCP: full operation surface -------------
    if (route === 'meta' || route.startsWith('meta/')) {
      const op = route === 'meta' ? '' : segments.slice(1).join('/');
      const body = method === 'GET'
        ? Object.fromEntries(new URL(request.url).searchParams.entries())
        : await request.json().catch(() => ({}));
      const M = await import('../../_lib/meta_ads.js');
      const G = await import('../../_lib/meta_graph.js');
      const acctFrom = (b) => b.account_id || b.accountId || b.act;
      const rest = (b) => { const { id, account_id, accountId, act, op: _o, params, ...r } = b; return b.params || r; };
      const READ = {
        'accounts': () => G.listAllAdAccounts(env),
        'portfolio': () => M.portfolio(env),
        'businesses': () => M.listBusinesses(env),
        'pages': () => M.listPages(env),
        'account-get': (b) => M.getAdAccount(env, acctFrom(b)),
        'campaigns': (b) => G.listCampaigns(env, acctFrom(b)),
        'adsets': (b) => G.listAdsets(env, acctFrom(b)),
        'ads': (b) => G.listAds(env, acctFrom(b)),
        'creatives': (b) => G.listAdCreatives(env, acctFrom(b)),
        'images': (b) => G.listAdImages(env, acctFrom(b)),
        'videos': (b) => M.listAdVideos(env, acctFrom(b)),
        'object-get': (b) => M.getObject(env, b.id, b.fields),
        'insights': (b) => M.insights(env, b.object_id || acctFrom(b), b),
        'insights-async-create': (b) => M.insightsAsyncCreate(env, b.object_id || acctFrom(b), b),
        'insights-async-status': (b) => M.insightsAsyncStatus(env, b.report_run_id),
        'insights-async-result': (b) => M.insightsAsyncResult(env, b.report_run_id, b),
        'targeting-search': (b) => M.targetingSearch(env, b),
        'targeting-browse': (b) => M.targetingBrowse(env, b),
        'delivery-estimate': (b) => M.deliveryEstimate(env, acctFrom(b), b),
        'catalogs': () => M.listCatalogs(env),
        'catalog-get': (b) => M.getCatalog(env, b.catalog_id),
        'catalog-products': (b) => M.listCatalogProducts(env, b.catalog_id),
        'catalog-product-sets': (b) => M.listCatalogProductSets(env, b.catalog_id),
        'catalog-feeds': (b) => M.listCatalogFeeds(env, b.catalog_id),
        'catalog-diagnostics': (b) => M.catalogDiagnostics(env, b.catalog_id),
        'pixels': (b) => M.listPixels(env, acctFrom(b)),
        'dataset-stats': (b) => M.datasetStats(env, b.pixel_id),
        'audiences': (b) => M.listAudiences(env, acctFrom(b)),
        'studies': () => M.listStudies(env),
        'study-get': (b) => M.getStudy(env, b.study_id),
        'activities': (b) => M.listActivities(env, acctFrom(b), b),
        'mcp-tools': () => M.mcpToolsList(env),
      };
      const WRITE = {
        'campaign-create': (b) => M.createCampaign(env, acctFrom(b), b),
        'campaign-update': (b) => M.updateObject(env, b.campaign_id || b.id, rest(b)),
        'adset-create': (b) => M.createAdset(env, acctFrom(b), b),
        'adset-update': (b) => M.updateObject(env, b.adset_id || b.id, rest(b)),
        'ad-create': (b) => M.createAd(env, acctFrom(b), b),
        'ad-update': (b) => M.updateObject(env, b.ad_id || b.id, rest(b)),
        'creative-create': (b) => M.createAdCreative(env, acctFrom(b), b),
        'status-set': (b) => M.setStatus(env, b.id, b.status),
        'budget-set': (b) => M.setBudget(env, b.id, b),
        'object-delete': (b) => M.deleteObject(env, b.id),
        'catalog-create': (b) => M.createCatalog(env, b),
        'audience-create': (b) => M.createCustomAudience(env, acctFrom(b), b),
        'lookalike-create': (b) => M.createLookalike(env, acctFrom(b), b),
        'mcp-call': (b) => M.mcpToolCall(env, b.name, b.arguments || b.args || {}),
      };
      if (op === '' || op === 'catalog' || op === 'ops') {
        return json({ protocol: 'meta_marketing', read_ops: Object.keys(READ), write_ops: Object.keys(WRITE), note: 'POST /api/marketing/meta/<op> with JSON args. Writes require act auth. Create ops default status PAUSED. mcp-tools/mcp-call proxy https://mcp.facebook.com/ads.' });
      }
      const isWrite = op in WRITE;
      const handler = READ[op] || WRITE[op];
      if (!handler) { await ledger(env, { key: 'META_OP', action: op, direction: 'in', status: 404, route }); return json({ error: 'unknown_meta_op', op, read_ops: Object.keys(READ), write_ops: Object.keys(WRITE) }, 404); }
      if (isWrite && !actAuthed) { await ledger(env, { key: 'META_OP', action: op, direction: 'in', status: 403, trace_id: traceId }); return json({ error: 'forbidden', op, need: 'act_auth' }, 403); }
      const result = await handler(body);
      const status = result && result.ok === false ? (Number.isInteger(result.status) && result.status >= 400 ? result.status : 502) : 200;
      await ledger(env, { key: 'META_OP', action: op, direction: isWrite ? 'out' : 'in', status, trace_id: traceId, request: isWrite ? body : undefined, response: { ok: result?.ok !== false } });
      return json({ op, ...result }, status);
    }

    await ledger(env, { key: 'MARKETING_API', action: 'not_found', direction: 'in', status: 404, route });
    return json({ error: 'not_found', route }, 404);
  } catch (e) {
    await ledger(env, {
      key: 'MARKETING_API', action: route, direction: 'in', status: 500,
      trace_id: traceId, response: { error: String(e?.message || e) },
    });
    return json({ error: String(e?.message || e) }, 500);
  }
}
