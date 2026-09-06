-- 0373: canonical environment descriptors live in directory; history and evidence live in the ledger.
-- Existing execution columns remain intact. `type` still selects the old execution adapter;
-- `object_kind` states what the object is. All human/model projections compile descriptor_json.

ALTER TABLE directory ADD COLUMN object_kind TEXT NOT NULL DEFAULT 'capability';
ALTER TABLE directory ADD COLUMN descriptor_json TEXT;
ALTER TABLE directory ADD COLUMN descriptor_rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE directory ADD COLUMN descriptor_hash TEXT;

ALTER TABLE directory_versions ADD COLUMN descriptor_json TEXT;
ALTER TABLE directory_versions ADD COLUMN descriptor_hash TEXT;

UPDATE directory
   SET object_kind = CASE
     WHEN type='agent' THEN 'agent'
     WHEN category IN ('prompt','prompt_block','agent_prompt') THEN 'prompt'
     ELSE 'capability'
   END
 WHERE descriptor_json IS NULL;

INSERT INTO directory
  (key,type,target,auth,content,updated_at,category,enabled,planner_visible,planner_rank,object_kind,descriptor_json,descriptor_rev,descriptor_hash)
VALUES
  ('ENVIRONMENT','http','GET https://miscsubjects.com/api/environment','','# WHAT: Canonical, recursively self-describing environment root.',datetime('now'),'environment',1,0,1,'environment',
   json_object(
     'ref','environment://miscsubjects','kind','environment','title','miscsubjects environment',
     'summary','One grammar for every page, object, operation, rule, comparable, source, projection, and receipt.',
     'source',json_object('ref','source://functions/api/environment/[[path]].js','read',json_object('method','GET','href','https://github.com/[OWNER_HANDLE]/miscsubjects-pages/blob/main/functions/api/environment/%5B%5Bpath%5D%5D.js')),
     'operations',json_array(
       json_object('id','read','method','GET','href','/api/environment','authority',json_object('public',json('true')),'effects',json_array()),
       json_object('id','manual','method','GET','href','/api/environment?format=markdown','authority',json_object('public',json('true')),'effects',json_array())
     ),
     'governance',json_object('direct',json_array('law://work/W01')),
     'relationships',json_array(json_object('type','recorded_by','target_ref','ledger://environment/changes','basis','Every descriptor mutation and verified operation is recorded.')),
     'representations',json_object('json','/api/environment','markdown','/api/environment?format=markdown','history','/api/environment/changes')
   ),1,'sha256:96b26efd9284359bb1065e3d229471f460622c17cfd394c88e5c12c2a44255dd'),

  ('PAGE_ADMIN','http','GET https://miscsubjects.com/admin','','# WHAT: Root of the authenticated human operating surfaces.',datetime('now'),'page',1,0,5,'page',
   json_object(
     'ref','page://admin','kind','page','title','Admin','summary','Authenticated human projection of the operating environment.',
     'parent_ref','environment://miscsubjects',
     'source',json_object('ref','source://functions/admin/index.js','read',json_object('method','GET','href','https://github.com/[OWNER_HANDLE]/miscsubjects-pages/blob/main/functions/admin/index.js')),
     'operations',json_array(json_object('id','read','method','GET','href','/admin','authority',json_object('owner',json('true')),'effects',json_array())),
     'governance',json_object('direct',json_array('law://design/D08')),
     'relationships',json_array(json_object('type','part_of','target_ref','environment://miscsubjects','basis','The admin is one projection of the environment.')),
     'representations',json_object('human','/admin','machine','/api/environment/objects?ref=page%3A%2F%2Fadmin')
   ),1,'sha256:9fd611d83dbe98574458ff679cd34f12c08fa1031be9d7d4f9e9991311fed004'),

  ('PAGE_ADMIN_SHEETS','http','GET https://miscsubjects.com/admin/sheets','','# WHAT: Arbitrary grid and projection surface over directory and ledger objects.',datetime('now'),'page',1,0,5,'page',
   json_object(
     'ref','page://admin/sheets','kind','page','title','Sheets',
     'summary','Arbitrary cells plus projections of directory current state and ledger evidence.',
     'parent_ref','page://admin',
     'source',json_object('ref','source://functions/admin/sheets/index.js','revision','git:main','read',json_object('method','GET','href','https://github.com/[OWNER_HANDLE]/miscsubjects-pages/blob/main/functions/admin/sheets/index.js')),
     'operations',json_array(
       json_object('id','read','method','GET','href','/admin/sheets','authority',json_object('owner',json('true')),'effects',json_array()),
       json_object('id','list','method','GET','href','/api/sheets','authority',json_object('owner',json('true')),'effects',json_array(),'summary','the sheets contract (public) plus your sheets (with authority); every sheet row carries id and title'),
       json_object('id','create','method','POST','href','/api/sheets','authority',json_object('owner',json('true')),'input_schema',json_object('type','object','required',json_array('title'),'properties',json_object('title',json_object('type','string'),'rows',json_object('type','integer'),'cols',json_object('type','integer'))),'effects',json_array('creates one stored grid; response.open is its link /admin/sheets?tab=<id>; ledger receipt SHEET_CREATE')),
       json_object('id','create_view','method','POST','href','/api/sheets','authority',json_object('owner',json('true')),'input_schema',json_object('type','object','required',json_array('title','view'),'properties',json_object('title',json_object('type','string'),'view',json_object('type','object','required',json_array('source'),'properties',json_object('source',json_object('type','string','enum',json_array('directory','ledger','directory_versions','agent_turns','turn_jobs','pending_deliveries')),'columns',json_object('type','array','items',json_object('type','string'),'description','source column, optionally with a JSON path: descriptor_json.governance.direct, request_json.body.messages[0].content'),'filters',json_object('type','array','items',json_object('type','object','properties',json_object('field',json_object('type','string'),'op',json_object('type','string','enum',json_array('=','!=','contains','starts','in','>','<','>=','<=','empty','not_empty')),'value',json_object('type','string')))),'where',json_object('type','string'),'limit',json_object('type','integer'),'order',json_object('type','string','enum',json_array('asc','desc'))))),'pins',json_object('type','array','items',json_object('type','object','properties',json_object('label',json_object('type','string'),'ref',json_object('type','string','description','directory/<KEY>/<field> | sheet/<id>/<A1> | settings/<key>'))))),'effects',json_array('creates one VIEW sheet whose rows are re-read from the source on every open; stores the description in col_meta.view, never a copy of the rows; response.open is its link; ledger receipt SHEET_CREATE'),'summary','a hybrid view over directory rows (nouns) or ledger events (verbs): choose source, columns by JSON path, filters, pins'),
       json_object('id','view_sources','method','GET','href','/api/sheets/view-sources','authority',json_object('owner',json('true')),'effects',json_array(),'summary','every source a view may read, its columns, JSON columns, filter ops and templates'),
       json_object('id','run_view','method','GET','href','/api/sheets/{id}/view?limit=&before=&after=','authority',json_object('owner',json('true')),'effects',json_array(),'summary','run the projection now: columns, rows, per-row object ids and hrefs, resolved pins'),
       json_object('id','redefine_view','method','PATCH','href','/api/sheets/{id}','authority',json_object('owner',json('true')),'input_schema',json_object('type','object','properties',json_object('title',json_object('type','string'),'col_meta',json_object('type','object','description','{view, formats, pins} — the whole projection description'))),'effects',json_array('changes what the sheet shows, not any source row; ledger receipt SHEET_PATCH')),
       json_object('id','pin_write','method','POST','href','/api/sheets/{id}/pins','authority',json_object('owner',json('true')),'input_schema',json_object('type','object','required',json_array('ref','value'),'properties',json_object('ref',json_object('type','string','description','directory/<KEY>/<field> writes the directory row itself'),'value',json_object('type','string'))),'effects',json_array('edits the underlying object (a directory row field, a cell, a setting); versioned; ledger receipt DIR_PATCH or SHEET_PIN_WRITE')),
       json_object('id','values_read','method','GET','href','/api/sheets/{id}/values/{A1:C10}','authority',json_object('owner',json('true')),'effects',json_array()),
       json_object('id','values_write','method','PUT','href','/api/sheets/{id}/values/{A1}','authority',json_object('owner',json('true')),'input_schema',json_object('type','object','required',json_array('values'),'properties',json_object('values',json_object('type','array','items',json_object('type','array')))),'effects',json_array('writes cells anchored at the address; a value beginning with = is a formula; ledger receipt SHEET_VALUES_SET')),
       json_object('id','append','method','POST','href','/api/sheets/{id}/values:append','authority',json_object('owner',json('true')),'input_schema',json_object('type','object','required',json_array('values'),'properties',json_object('values',json_object('type','array','items',json_object('type','array')))),'effects',json_array('appends rows below the used range; ledger receipt SHEET_VALUES_APPEND'),'summary','the webhook address of a sheet: any system that can POST JSON with the build authority header lands rows here'),
       json_object('id','history','method','GET','href','/api/sheets/{id}/history/{A1}','authority',json_object('owner',json('true')),'effects',json_array(),'summary','every value one cell has held, newest first, hash-chained'),
       json_object('id','export','method','GET','href','/api/sheets/{id}/export.csv','authority',json_object('owner',json('true')),'effects',json_array()),
       json_object('id','delete','method','DELETE','href','/api/sheets/{id}','authority',json_object('owner',json('true')),'effects',json_array('removes the sheet; source rows it projected are untouched; ledger receipt SHEET_DELETE'))
     ),
     'governance',json_object('direct',json_array('law://sheets/S01')),
     'relationships',json_array(
       json_object('type','part_of','target_ref','page://admin','basis','Route hierarchy.'),
       json_object('type','implemented_by','target_ref','source://functions/admin/sheets/index.js','basis','Cloudflare Pages handler.'),
       json_object('type','projects','target_ref','directory://catalog','basis','Directory rows may be projected without copying authority.'),
       json_object('type','projects','target_ref','ledger://events','basis','Ledger fields may be projected by JSON path.')
     ),
     'comparables',json_array(json_object(
       'target_ref','external://google/sheets',
       'dimensions',json_array('arbitrary grid state','programmability','discoverability'),
       'basis','Both expose arbitrary cells through a stable grid grammar; Apps Script supplies a documented programming object model.',
       'similarities',json_array('Cells can contain arbitrary text or structured values.','A small stable grammar can be composed into workflows the product did not predict.'),
       'differences',json_array('This environment projects directory objects and ledger evidence with canonical refs.','Google Sheets uses Apps Script as its adjacent runtime; this environment declares operations on each object.'),
       'sources',json_array('https://developers.google.com/apps-script/guides/sheets','https://developers.google.com/apps-script/reference/spreadsheet/'),
       'status','verified','verified_at','2026-09-05'
     )),
     'representations',json_object('human','/admin/sheets','json','/api/environment/objects?ref=page%3A%2F%2Fadmin%2Fsheets','history','/api/environment/changes')
   ),1,'sha256:c2daab80614015b612a2bfd047eae7b03cb08c6a4357dfdcf8019a266fd2f3b8'),

  ('LAW_WORK_W01','http','GET https://miscsubjects.com/a/agent-work-law','','# WHAT: Work exists only as a canonical task object.',datetime('now'),'law',1,0,10,'law',
   json_object('ref','law://work/W01','kind','law','title','Work exists as an object','summary','Work exists only as a task object; infrastructure, not prose, decides state.','operations',json_array(json_object('id','read','method','GET','href','/api/work','authority',json_object('public',json('true')),'effects',json_array())),'governance',json_object('direct',json_array()),'representations',json_object('human','/a/the-work-object','machine','/api/work','audit','/api/work/audit')),1,'sha256:fcf4c006b518e9a2c3c5151c5326ba9f13b04f69d89bd88e8f8a11b0d5cdc84b'),

  ('LAW_DESIGN_D08','http','GET https://miscsubjects.com/api/articles/design-law','','# WHAT: Location before options.',datetime('now'),'law',1,0,10,'law',
   json_object('ref','law://design/D08','kind','law','title','Location before options','summary','Always show current location, parent category, sibling family, and return path before onward choices.','operations',json_array(json_object('id','read','method','GET','href','/api/articles/design-law','authority',json_object('public',json('true')),'effects',json_array())),'governance',json_object('direct',json_array()),'representations',json_object('human','/a/design-law','machine','/api/articles/design-law')),1,'sha256:efd38cede2f163ba851d366fb8298d622e47692424e20cd92148de28e3d4a98a'),

  ('LAW_SHEETS_S01','http','GET https://miscsubjects.com/api/environment?format=markdown','','# WHAT: Cells remain arbitrary values and projections retain canonical identity.',datetime('now'),'law',1,0,10,'law',
   json_object('ref','law://sheets/S01','kind','law','title','Cells remain arbitrary','summary','A cell may contain arbitrary text, JSON, a formula, or source. A projection retains the underlying object ref; recalculation never causes external effects.','operations',json_array(json_object('id','read','method','GET','href','/api/environment?format=markdown','authority',json_object('public',json('true')),'effects',json_array())),'governance',json_object('direct',json_array()),'representations',json_object('markdown','/api/environment?format=markdown')),1,'sha256:d47d223da1aceac78fb7e2f320e1cc670b7fac060142a2a36fc7480e88b71d77'),

  ('EXTERNAL_GOOGLE_SHEETS','http','GET https://developers.google.com/apps-script/guides/sheets','','# WHAT: External comparable for mutable grid plus documented scripting grammar.',datetime('now'),'external',1,0,1000,'external_system',
   json_object('ref','external://google/sheets','kind','external_system','title','Google Sheets + Apps Script','summary','Mutable grid paired with a documented scripting object model.','operations',json_array(json_object('id','read_docs','method','GET','href','https://developers.google.com/apps-script/guides/sheets','authority',json_object('public',json('true')),'effects',json_array())),'governance',json_object('status','not_applicable'),'representations',json_object('documentation','https://developers.google.com/apps-script/guides/sheets'),'verified_at','2026-09-05'),1,'sha256:10e6f21f55e35d997f33a4c06618e88e3142e93e806ea5d8ada5df56a2e5c3ff'),

  ('DIRECTORY_CATALOG','http','GET https://miscsubjects.com/api/directory','','# WHAT: The directory — every object the environment has, as rows. Nouns.',datetime('now'),'environment',1,0,2,'store',
   json_object(
     'ref','directory://catalog','kind','store','title','Directory (nouns)',
     'summary','Canonical current state. One row = one object: agents, tools, pages, laws, prompts, models, sheets, sources, external systems. Its descriptor_json is the canonical contract this manual is generated from.',
     'parent_ref','environment://miscsubjects',
     'source',json_object('ref','source://functions/api/directory/[key].js','read',json_object('method','GET','href','https://github.com/[OWNER_HANDLE]/miscsubjects-pages/blob/main/functions/api/directory/%5Bkey%5D.js')),
     'schema',json_object('type','object','properties',json_object('key',json_object('type','string'),'type',json_object('type','string','enum',json_array('fn','http','agent','flow')),'object_kind',json_object('type','string'),'content',json_object('type','string','description','the contract a model reads before invoking; agents: the system prompt'),'descriptor_json',json_object('type','object','description','miscsubjects/environment-object/1'),'descriptor_rev',json_object('type','integer'),'descriptor_hash',json_object('type','string'))),
     'operations',json_array(
       json_object('id','list','method','GET','href','/api/directory?type=<fn|http|agent|flow>','authority',json_object('public',json('true')),'effects',json_array(),'summary','every row with its schema; ?format=widgets for the human cards'),
       json_object('id','read','method','GET','href','/api/directory/{key}','authority',json_object('public',json('true')),'effects',json_array(),'summary','one row plus _rest (its exact REST verbs) and _environment (its ref and resolver links)'),
       json_object('id','create','method','POST','href','/api/directory','authority',json_object('owner',json('true')),'input_schema',json_object('type','object','required',json_array('key','type'),'properties',json_object('key',json_object('type','string'),'type',json_object('type','string'),'target',json_object('type','string'),'auth',json_object('type','string'),'content',json_object('type','string'),'category',json_object('type','string'),'object_kind',json_object('type','string'),'descriptor_json',json_object('type','object'))),'effects',json_array('inserts one object row; a descriptor is validated (typed relationships only; related_to refused) and hashed; ledger receipt DIRECTORY_MUTATE')),
       json_object('id','edit','method','PATCH','href','/api/directory/{key}','authority',json_object('owner',json('true')),'input_schema',json_object('type','object','properties',json_object('content',json_object('type','string'),'target',json_object('type','string'),'category',json_object('type','string'),'enabled',json_object('type','integer'),'descriptor_json',json_object('type','object'),'expected_descriptor_rev',json_object('type','integer','description','compare-and-set: the descriptor_rev you read; a moved row answers 409 descriptor_revision_stale and writes nothing'),'agent_model',json_object('type','string'),'agent_temperature',json_object('type','string'))),'concurrency','expected_descriptor_rev','effects',json_array('updates named fields in place; content and descriptor changes append a directory_versions row; ledger receipt DIRECTORY_MUTATE')),
       json_object('id','replace','method','PUT','href','/api/directory/{key}','authority',json_object('owner',json('true')),'input_schema',json_object('type','object','required',json_array('type'),'properties',json_object('type',json_object('type','string'),'target',json_object('type','string'),'auth',json_object('type','string'),'content',json_object('type','string'),'descriptor_json',json_object('type','object'),'expected_descriptor_rev',json_object('type','integer'))),'concurrency','expected_descriptor_rev','effects',json_array('upserts the whole row; ledger receipt DIRECTORY_MUTATE')),
       json_object('id','delete','method','DELETE','href','/api/directory/{key}','authority',json_object('owner',json('true')),'effects',json_array('removes the row; its history stays in directory_versions and the ledger; ledger receipt DIRECTORY_MUTATE')),
       json_object('id','invoke','method','POST','href','/api/dispatch','authority',json_object('owner',json('true')),'input_schema',json_object('type','object','required',json_array('key'),'properties',json_object('key',json_object('type','string'),'body',json_object('type','string','description','pipe-delimited args'))),'effects',json_array('runs the row (fn, http, agent or flow); every call is one ledger row with the raw request and response'),'summary','a row is a verb only when invoked; the ledger receives the receipt'),
       json_object('id','project','method','POST','href','/api/sheets','authority',json_object('owner',json('true')),'input_schema',json_object('type','object','required',json_array('title','view'),'properties',json_object('title',json_object('type','string'),'view',json_object('type','object','properties',json_object('source',json_object('const','directory'),'columns',json_object('type','array','items',json_object('type','string')),'filters',json_object('type','array'))))),'effects',json_array('a new sheet whose rows are these directory rows, re-read on every open; edits go through pins or PATCH /api/directory/{key}'),'summary','view/edit any set of rows on a new sheet: e.g. filters [{field:type,op:=,value:agent}] with columns key, content, descriptor_json.governance.direct')
     ),
     'governance',json_object('direct',json_array('law://coding/hash-lease')),
     'relationships',json_array(
       json_object('type','part_of','target_ref','environment://miscsubjects','basis','The directory is the current-state half of the environment.'),
       json_object('type','recorded_by','target_ref','ledger://events','basis','Every directory mutation and invocation is one ledger row (source=directory or the row key).'),
       json_object('type','implemented_by','target_ref','source://functions/api/directory/[key].js','basis','One control point for every mutation.')
     ),
     'representations',json_object('human','/admin/directory','json','/api/directory','sheet','/admin/sheets (Directory tab)','machine','/api/environment/objects?kind=<kind>','mcp','resources/list on /api/mcp')
   ),1,'sha256:e4e927ad162f1f9afe22e7f480baf9d00b4e04f166e64a7bbb040d18bfa943b1'),

  ('LEDGER_EVENTS','http','GET https://miscsubjects.com/api/events','','# WHAT: The ledger — every action that ever happened, as append-only rows. Verbs.',datetime('now'),'environment',1,0,3,'ledger',
   json_object(
     'ref','ledger://events','kind','ledger','title','Ledger (verbs)',
     'summary','Canonical history and evidence. Every request in and response out — directory mutations, tool calls, model calls, sheet writes, emails — is one row with source, key, action, actor, trace_id, status and the raw payloads. Nothing is overwritten.',
     'parent_ref','environment://miscsubjects',
     'source',json_object('ref','source://functions/_lib/event_log.js','read',json_object('method','GET','href','https://github.com/[OWNER_HANDLE]/miscsubjects-pages/blob/main/functions/_lib/event_log.js')),
     'schema',json_object('type','object','properties',json_object('id',json_object('type','string'),'ts',json_object('type','string'),'source',json_object('type','string'),'key',json_object('type','string'),'action',json_object('type','string'),'actor',json_object('type','string'),'direction',json_object('type','string'),'status',json_object('type','integer'),'trace_id',json_object('type','string'),'route',json_object('type','string'),'request_json',json_object('type','string','description','raw request; project inside it with request_json.<path>'),'response_json',json_object('type','string','description','raw response; project inside it with response_json.<path>'))),
     'operations',json_array(
       json_object('id','list','method','GET','href','/api/events?source=&key=&trace_id=&actor=&q=&limit=','authority',json_object('owner',json('true')),'effects',json_array(),'summary','latest events with previews and a link to each full row'),
       json_object('id','read','method','GET','href','/api/events/{id}','authority',json_object('owner',json('true')),'effects',json_array(),'summary','one event with the full request and response'),
       json_object('id','turn','method','GET','href','/api/ledger?card={trace_id}&format=json','authority',json_object('owner',json('true')),'effects',json_array(),'summary','every row of one connected turn'),
       json_object('id','changes','method','GET','href','/api/environment/changes?after=<ISO-8601>','authority',json_object('public',json('true')),'effects',json_array(),'summary','the environment-relevant slice: descriptor and directory mutations'),
       json_object('id','project','method','POST','href','/api/sheets','authority',json_object('owner',json('true')),'input_schema',json_object('type','object','required',json_array('title','view'),'properties',json_object('title',json_object('type','string'),'view',json_object('type','object','properties',json_object('source',json_object('const','ledger'),'columns',json_object('type','array','items',json_object('type','string')),'filters',json_object('type','array'))))),'effects',json_array('a new sheet whose rows are these ledger events, re-read on every open; read-only because the ledger is append-only'),'summary','view any slice on a new sheet: e.g. filters [{field:key,op:=,value:ROUTER}] with columns ts, actor, request_json.body.messages[0].content, response_json')
     ),
     'governance',json_object('direct',json_array('law://work/W01')),
     'relationships',json_array(
       json_object('type','part_of','target_ref','environment://miscsubjects','basis','The ledger is the history half of the environment.'),
       json_object('type','implemented_by','target_ref','source://functions/_lib/event_log.js','basis','The one write path every receipt goes through.')
     ),
     'representations',json_object('human','/admin/ledger','json','/api/events','sheet','/admin/sheets (Ledger tab)','turns','/api/ledger?view=cards&format=json')
   ),1,'sha256:bdec712e267245815b9a58c0be74f55f1222946efbe2f26caa4328c1e83ccee4'),

  ('LAW_CODING_HASH_LEASE','http','GET https://miscsubjects.com/api/coding-law','','# WHAT: A hash when the work starts, a hash when the work commits.',datetime('now'),'law',1,0,10,'law',
   json_object('ref','law://coding/hash-lease','kind','law','title','Hash lease before a code change','summary','Every change to an executable file declares the hash it read and the hash it leaves; the deploy refuses an unleased change. Directory descriptor edits carry the same idea as expected_descriptor_rev.','operations',json_array(json_object('id','read','method','GET','href','/api/coding-law','authority',json_object('public',json('true')),'effects',json_array())),'governance',json_object('direct',json_array()),'representations',json_object('human','/a/coding-law','machine','/api/coding-law','chain','/api/coding-law/leases')),1,'sha256:fc522175ee59e5583d03efbe7465395b647bebf18a059804a5616b1c55b37ab7')
ON CONFLICT(key) DO UPDATE SET
  object_kind=excluded.object_kind,
  descriptor_json=excluded.descriptor_json,
  descriptor_rev=directory.descriptor_rev+1,
  descriptor_hash=excluded.descriptor_hash,
  updated_at=datetime('now');

CREATE INDEX IF NOT EXISTS idx_directory_object_kind ON directory(object_kind, enabled);
