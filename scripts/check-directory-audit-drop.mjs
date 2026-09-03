import { readFileSync } from 'node:fs';
import { buildAuditTapGoDropMarkdown } from '../functions/_lib/unified_handoff.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const directory = read('functions/admin/directory/index.js');
const content = read('functions/admin/content-map.js');
const audit = read('functions/build-audit/index.js');
const landscape = read('functions/api/build-landscape.js');
const dispatch = read('functions/api/dispatch.js');
const protocol = read('functions/api/protocol/[[path]].js');
const constitution = read('functions/_lib/article_constitution.js');
const normandy = read('functions/_lib/normandy_contract.js');
const handoff = read('functions/_lib/unified_handoff.js');
const drop = buildAuditTapGoDropMarkdown('https://miscsubjects.com', { short_code: 'AUDIT01', share_token: 'sh.AUDIT.edit.0.TEST', fingerprint: 'cap_audit_test', expires_at: '2099-01-01T00:00:00Z', max_uses: 100 });

const checks = [
  ['DIRECTORY_CONTENT_CREATED_AT', directory.includes("'content' AS category, created_at, updated_at")],
  ['DIRECTORY_AUDIT_ROW', directory.includes("key: 'OPOS_AUDIT_TAP_GO'") && directory.includes("href: '/api/dispatch?tap_go=1&drop=audit'")],
  ['DIRECTORY_RESETS_STALE_FILTERS', directory.includes("elv('dir-use').value = ''") && directory.includes("elv('dir-cat').value = ''")],
  ['DIRECTORY_DEFAULTS_TO_GROUPED_BY_KIND', directory.includes('<option value="" selected>Grouped by kind</option>') && directory.includes("section('Agents', agents)") && directory.includes("section('Tools — HTTP / FN', tools)") && directory.includes("if (sort==='new')")],
  ['DIRECTORY_FILTERS_ALL_VISIBLE_FIELDS', directory.includes("+(r.type||'')+' '+(r.href||'')")],
  ['DIRECTORY_FILTER_PAGINATION', ['DIR_PAGE_SIZE = 200','filterChanged()','changePage(-1)','changePage(1)','matches · showing'].every(x => directory.includes(x))],
  ['DIRECTORY_NORMALIZES_MIXED_TIMESTAMPS', directory.includes("raw.replace(' ','T')") && directory.includes('Date.parse(raw)') && directory.includes('rowTime(a)') && directory.includes('rowTime(b)')],
  ['DIRECTORY_SHOWS_SORTABLE_TIME', directory.includes("toISOString().slice(0,16).replace('T',' ')")],
  ['CONTENT_NEWEST_SECTION', content.includes('Newest added content')],
  ['AUDIT_PAGE_IS_FOUR_COLUMN_VIEW', ['What the field says','What field evidence establishes','What this build says','What build evidence establishes'].every(x => audit.includes(x))],
  ['AUDIT_PAGE_HAS_GRAPH_SURFACES', ['build-landscape','opos-formal-audit/claims','opos-formal-audit/discourse'].every(x => audit.includes(x))],
  ['LANDSCAPE_USES_ARTICLES_AND_TASKS', landscape.includes("slug LIKE 'field-%'") && landscape.includes("source='landscape-research'")],
  ['LANDSCAPE_REQUIRES_SOURCE_CITING_CLAIMS', landscape.includes("op: 'source'") && landscape.includes("op: 'claim'") && landscape.includes('source_ids')],
  ['LANDSCAPE_HAS_OPPOSING_LANE', landscape.includes('opposing_lane') && landscape.includes('voxel-challenge')],
  ['AUDIT_MINTS_GRAPH_RESEARCH_SCOPE', dispatch.includes("auditDrop ? 'rows:VOXEL_EDIT'")],
  ['BATCH_SOURCE_AND_CLAIM_AUTHED', protocol.includes('appendAuth = await voxelAuth(request, env, body, "VOXEL_EDIT", true)')],
  ['ARTICLE_MUTATIONS_SHARE_SCOPED_AUTH', ['draft','sources','atomize','contribute','write','ingest','claim','repair'].every(action => {
    const start = protocol.indexOf(`action === "${action}"`);
    return start >= 0 && protocol.slice(start, start + 420).includes('voxelAuth(request, env, b, "VOXEL_EDIT", true)');
  })],
  ['FLOATING_AUDIT_CONTROL', handoff.includes('id="msc-audit-build">Audit this build</button>')],
  ['FLOATING_CONSOLE_CLEARS_TOP_RIGHT', handoff.includes('right:14px;bottom:14px;top:auto') && handoff.includes('flex-direction:column-reverse')],
  ['FLOATING_MODEL_SPECIFIC_TOKENS', ['chatgpt','claude','grok','gemini','kimi'].every(model => handoff.includes(`data-tapgo="read" data-model="${model}"`) && handoff.includes(`data-tapgo="social" data-model="${model}"`))],
  ['AUDIT_ACCESS_IS_COMPACT', drop.length < 4500],
  ['AUDIT_ACCESS_IS_GRAPH_NATIVE', ['# OPOS NORMANDY COMPARISON SLOT','api/build-landscape','api/protocol/voxel-batch','api/articles/constitution?format=markdown'].every(x => drop.includes(x))],
  ['AUDIT_ACCESS_ZERO_CONTEXT_ASSIGNMENT', ['## WORK THAT STARTS FROM THIS DROP','## WORK ALREADY PRESENT','A slot completes only when','api/articles/constitution?format=markdown'].every(x => drop.includes(x))],
  ['NORMANDY_RESERVES_ONE_SLOT', dispatch.includes('reserveNormandyAssignment') && normandy.includes('normandy_assignments') && normandy.includes('required_slot')],
  ['NORMANDY_REJECTS_REPEAT_ANSWERS', protocol.includes('duplicate_answer') && protocol.includes('duplicate_claim') && protocol.includes('duplicate_sources_only') && drop.includes('Repeating that boundary')],
  ['NORMANDY_USES_ONE_ARTICLE_CONTRACT', constitution.includes('normandy_contract') && constitution.includes('NORMANDY_SLOTS') && protocol.includes('completeNormandyAssignment')],
  ['AUDIT_ACCESS_IS_NOT_A_PROMPT', !/## AUDIT TASK|## RESPONSE SHAPE|complete result|Lead with|Finish with|Evaluate OPOS/i.test(drop)],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) { console.error(JSON.stringify({ ok: false, failed })); process.exit(1); }
console.log(JSON.stringify({ ok: true, graph_native_audit: true, landscape_queue: true, access_chars: drop.length }));
