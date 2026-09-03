/**
 * API_REFERENCE.gs — the whole build, explained, for a reader with zero context.
 *
 * If you are an AI and someone points you at this Apps Script project and asks you to
 * "do something on the site", read this file top to bottom. It is enough. You do not
 * need the repo, and you do not need to ask the owner for anything.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 0. WHAT THE SITE IS
 * ─────────────────────────────────────────────────────────────────────────────
 * miscsubjects.com is a Cloudflare Pages project with ~416 Functions routes.
 * Everything the build can do — every article, page, tool, agent, prompt, HTTP
 * call, and flow — is a ROW in one D1 table called `directory`. 936 rows today.
 * One row = one invocable capability, addressed by its `key`.
 *
 * So there are only really three verbs:
 *   1. LIST what exists          GET  /api/directory   (and GET /api/inventory)
 *   2. RUN one of them           POST /api/dispatch {key, body}
 *   3. CALL a model directly     POST /api/invoke {key, input, model}
 *
 * Everything else in this file is detail on those three.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. AUTH — one key, one header
 * ─────────────────────────────────────────────────────────────────────────────
 * Base URL: https://miscsubjects.com
 * Header:   x-terminal-key: <TERMINAL KEY>   (64 hex chars)
 *
 * In this Apps Script project the key is NEVER hardcoded. It lives in
 * Script Properties under `MISC` (legacy fallback: `TERMINAL_KEY`).
 *   File → Project Settings → Script Properties → MISC = <key>
 * Read it with miscKey_() (build_api_map.gs) or invokeKey_() (Invoke.gs).
 *
 * Outside Apps Script the same key is in ~/.build-vault.env as TERMINAL_KEY,
 * autoloaded by every shell. `~/miscsubjects-pages/ACCESS.md` is the pointer.
 *
 * The key is the ONLY credential. It authorizes every /api/* route below.
 * 401 means the header is missing or wrong — nothing else.
 * /admin/* is the same key, key-only, no accounts, no OAuth.
 *
 * curl shape for every call in this file:
 *   curl -H "x-terminal-key: $TERMINAL_KEY" -H "content-type: application/json" \
 *        -X POST https://miscsubjects.com/api/dispatch -d '{"key":"...","body":{}}'
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. THE THREE FEEDS — GET these and the build is fully operable
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/map
 *   The ontology. Route groups, the directory schema, which Cloudflare bindings
 *   exist, row counts. Self-describing and always current. Start here.
 *
 * GET /api/directory
 *   The invocation table. Every capability, with the schema for adding/editing.
 *   Filters: ?type=agent|http|fn|flow  ?row_num=N  ?format=widgets (HTML cards)
 *   Also: /api/directory/categories , /api/directory/search?q=
 *
 * GET /api/inventory
 *   Every file and object in the build — repo files, R2 objects, KV pairs,
 *   directory rows, pages, articles — each with its read/edit/delete URL+method.
 *   Filter: ?kind=file,r2,kv,directory,page,article
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. THE DIRECTORY ROW — the core schema
 * ─────────────────────────────────────────────────────────────────────────────
 * D1 table `directory`. Fields:
 *   key                 string, primary key, the invocation name (e.g. WRITER_AGENT_v5)
 *   type                fn | http | agent | flow
 *   target              fn:    a name in FN_MAP (server-side function)
 *                       http:  "METHOD url" with $1 placeholders, e.g. "GET https://x/$1"
 *                       agent: a model id
 *                       flow:  "" (the DSL lives in content)
 *   auth                http rows only: "bearer:ENV_VAR" | "headers:{...}" | "query:k=$ENV" | ""
 *   content             fn/http: "# docs\n<arg template>"
 *                       agent:   the system prompt body
 *                       flow:    the DSL
 *   includes            agent rows only: csv of prompt_block keys composed before
 *                       content at runtime (e.g. BLOCK_VOICE,BLOCK_ROUTING)
 *   category            string tag
 *   allowed_categories  csv of categories, or "*"
 *   seq                 int, sort order
 *   enabled             1|0
 *   planner_visible     1|0
 *   planner_rank        int
 *   input_schema        optional JSON string
 *   examples            optional JSON string
 *   row_num             int, computed, 1-based position in the canonical list
 *
 * REST on rows:
 *   list    GET    /api/directory
 *   read    GET    /api/directory/<key>          (+ ?format=widgets)
 *   create  POST   /api/directory {key,type,...} (key+type required) -> 201
 *   update  PUT    /api/directory/<key> {...}    (full upsert)
 *   patch   PATCH  /api/directory/<key> {field:value}   ← use this to edit a prompt
 *   delete  DELETE /api/directory/<key>
 *
 * LAW: a system prompt is NEVER a string in code. It is a directory row, edited by
 * PATCH, versioned in D1. Iterating a prompt = PATCH the row + dispatch. Never
 * rewrite JS and redeploy.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 4. RUNNING THINGS
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/dispatch  {key, body, actor?}
 *   Runs any directory row of any type and returns its result. This is the single
 *   universal execution verb. If you can name the row, you can run it.
 *
 * POST /api/invoke  {key?, input | inputs | messages, model?, system?, memory?,
 *                    includes?, vars?, temperature?, max_tokens?, n?}
 *   One model call, or up to 200 in parallel in one round trip. No agent loop,
 *   no tools, hard timeout. `key` names the directory row holding the system
 *   prompt. This is the ONLY sanctioned way to call a model (law MODEL_CALL_LAW).
 *   Model ids: GET /api/models.
 *
 * POST /api/turn   {…}   inbound message → the ROUTER agent (the conversational lane)
 * POST /blooio           iMessage webhook (Blooio) — how the owner texts the build
 * GET|POST /api/mcp      the whole directory exposed as MCP tools
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 5. EVERY ROUTE GROUP  (GET /api/map for the live list)
 * ─────────────────────────────────────────────────────────────────────────────
 * kernel
 *   POST /api/dispatch                 run any directory row
 *   POST /api/turn                     inbound message -> ROUTER
 *   POST /blooio                       iMessage webhook
 *   GET|POST /api/mcp                  directory as MCP tools
 * directory
 *   GET  /api/directory                list rows + schema
 *   POST /api/directory                create a row
 *   GET|PUT|PATCH|DELETE /api/directory/:key
 *   GET  /api/directory/categories , /api/directory/search
 * assets
 *   GET  /api/inventory                every file/object with read/edit/delete
 *   GET|PUT|DELETE /api/file/*         repo files — a PUT commits to GitHub main
 *   GET|PUT|DELETE /api/r2/*           R2 objects
 *   GET|PUT|DELETE /api/kv             KV pairs
 *   GET|PUT|PATCH|DELETE /api/short/:id  short links
 *   GET|POST /api/store/*              storage worker
 *   ANY  /api/settings/:key            settings rows
 * content
 *   ANY  /api/articles/* , /api/content/* , /api/pages/*     content CRUD
 *   GET|POST /api/presets , /api/relationships , /api/plan , /api/panel , /api/studio
 *   GET  /api/models                   model ids you may pass to /api/invoke
 *   ANY  /api/providers/* , /api/runs/* , /api/run/*
 * agents
 *   POST /api/council , /api/proactive , /grok/audit          multi-model agents
 *   ANY  /api/durable/*                durable resident agents (AgentDO)
 * handoff
 *   GET  /api/model-lane               public model execution lane
 *   GET  /api/relay?social=1           public proof chain
 * ingest  (turn logs, ledger, delivery)
 *   POST /api/cc_log , /api/grok_log , /api/kimi_log , /api/agent_log ,
 *        /api/agent_ledger_sync , /api/agent_audit , /api/cc_audit ,
 *        /api/event_log_ingest , /api/snapshot_ingest , /api/deliver
 * site (public HTML)
 *   GET /                              homepage
 *   GET /:slug                         dynamic page (pages table)
 *   GET /a/:slug                       article
 *   GET /content/:slug , /s/:slug , /img/*
 * admin (key-only HTML cockpit — never expose internals outside /admin)
 *   GET /admin/*   directory, ledger, manual, map, assets, content, pages,
 *                  trace, run, cc, sync
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 6. CLOUDFLARE BINDINGS BEHIND THE ROUTES
 * ─────────────────────────────────────────────────────────────────────────────
 *   DB              D1 — directory, articles, pages, settings, leads
 *   LEDGER          D1 — append-only event ledger (every payload, every source)
 *   KV              KV namespace
 *   R2              object storage (images at /img/*)
 *   AI              Workers AI
 *   DIRECTORY_DO    Durable Object for the directory
 *   TASKS           queue
 *   STORE           storage worker
 *   GITHUB_TOKEN, TERMINAL_KEY, STORE_KEY, CLOUDFLARE_API_TOKEN   secrets
 *
 * Known live defect (2026-08-01): /api/models advertises ids prefixed
 * grok: openai: gemini: kimi: — the invoke lane sends those to Workers AI, which
 * does not have them, and returns "No such model". They need the gateway route.
 * Unprefixed / Workers AI ids answer normally.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 7. DOING IT FROM THIS APPS SCRIPT PROJECT
 * ─────────────────────────────────────────────────────────────────────────────
 * Helpers that already exist here — reuse them, do not write new HTTP code:
 *   build_api_map.gs  request_/get_/post_/put_/patch_/del_   authed fetch + REST_LOG
 *                     healthCheck()     is the key good and the site up
 *                     mapEverything()   writes the whole API map into tabs
 *                     askBuild()        ask the build a question
 *                     tabMap/tabAgents/tabTools/tabArticles/tabPages/tabContent/
 *                     tabFiles/tabTurns   one tab per feed
 *   Invoke.gs         =INVOKE(input, key, model)          one model reply in a cell
 *                     =INVOKEALL(range, key)              a column of replies, 1 request
 *                     fillColumnFromPrompt()              menu-driven bulk fill
 *   BuildBoard.gs     boardSyncAll/boardSyncLeads/boardSyncArticles/boardSyncModelLab
 *                     boardTick()  reads APPROVE/REJECT and acts
 *   Code.gs           sheetsGet/sheetsListTabs/sheetsReplaceTab/sheetsAppendRows,
 *                     driveList/driveGet/driveUpload, tasks*, calendar*  — the
 *                     web-app lane other agents call via APPS_SCRIPT_RUN
 *   WRITE_sheet.gs    generic sheet writer
 *
 * Minimal new call, the whole pattern:
 *
 *   function example() {
 *     var r = post_('/api/dispatch', { key: 'SOME_ROW_KEY', body: { x: 1 } });
 *     Logger.log(r.code);
 *     Logger.log(r.json);
 *   }
 *
 * Every request made through request_() is logged to the REST_LOG tab with the
 * full URL, payload, status, response body and duration. Do not bypass it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 8. RULES THAT ARE NOT NEGOTIABLE
 * ─────────────────────────────────────────────────────────────────────────────
 *  - No hardcoded secrets, ever. Script Property MISC only.
 *  - Prompts live in directory rows, not in code.
 *  - Deploys of the site go through scripts/ship.mjs in ~/miscsubjects-pages.
 *    Never raw `wrangler pages deploy` — it bypasses the anti-overwrite gate.
 *    Run it from the repo root or the Functions bundle is omitted (prod 404/405).
 *  - Internals stay behind /admin. No public route ever serves lead data,
 *    drafts, prompts, or pipeline logic.
 *  - Never delete a tab, row, branch, or ref that the owner did not name.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 8b. DRIVING THIS PROJECT FROM OUTSIDE (the web app lane)
 * ─────────────────────────────────────────────────────────────────────────────
 * This project is deployed as a web app that takes POST {action, args}:
 *   Not written here. Read it with the terminal key:
 *     curl -s "https://miscsubjects.com/api/kv?key=airunner_exec" -H "x-terminal-key: $TERMINAL_KEY"
 *   (That route 401s without the key. /api/settings/<k> does NOT — it serves public reads,
 *    so never store anything sensitive there.)
 *
 * ONE GOTCHA, and it costs twenty minutes if you do not know it: Apps Script
 * answers a POST with a 302 to a script.googleusercontent.com/macros/echo URL,
 * and the body lives at THAT url, fetched with a GET. Follow the redirect as a
 * GET (plain `curl -L`, no --post302) or do it in two steps:
 *
 *   U="https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec"
 *   LOC=$(curl -s -o /dev/null -D - -X POST "$U" \
 *         -H "content-type: application/json" \
 *         -d '{"action":"board_sync_articles","args":{"limit":50}}' \
 *      | grep -i '^location:' | sed 's/^[Ll]ocation: //' | tr -d '\r')
 *   curl -s "$LOC"
 *
 * Actions (Code.gs doPost): ping · board_sync · board_sync_articles ·
 *   board_sync_leads · board_sync_lab · board_sync_fields · board_sync_replies ·
 *   board_tick · board_install · board_set_key · sheets_get · sheets_list_tabs ·
 *   sheets_replace_tab · sheets_append_row(s) · sheets_set_range · drive_list ·
 *   drive_get · drive_search · drive_upload · tasks_* · calendar_* · eagle_*
 *
 * After editing any .gs here: `clasp push -f`, then `clasp deploy` for a new
 * version, then update AIRUNNER in functions/api/board.js to the new id.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 9. THE SHEET
 * ─────────────────────────────────────────────────────────────────────────────
 * Bound spreadsheet: "Lead Outbox + Model Prompt Lab"
 *   <GOOGLE_SHEET_ID>
 * Live tabs:
 *   LEADS      every lead + the drafted letter split into subject and body,
 *              why the build picked it, reply-to, lead id. DO=APPROVE sends
 *              through every gate the build enforces; DO=REJECT suppresses.
 *   ARTICLES   the newest N articles, FULLY hydrated — every editable field is
 *              its own column: widgets_json, sources_json, claims_json,
 *              tags_json, style_json, hero, images_json, category, home,
 *              extra_json, status, register — plus the body split across
 *              body_1…body_16 (49,000 chars each) and rejoined on SAVE.
 *              Each header cell carries a NOTE with that field's schema, so the
 *              widget and source shapes are readable where the editing happens.
 *              DO=PULL re-reads a row, DO=SAVE writes the whole row back
 *              (body AND widgets AND sources AND claims), DO=EXPLAIN writes a
 *              field-by-field explanation into the EXPLAIN tab.
 *              A SAVE answers the live writing-law challenge for a write token
 *              first — the sheet gets no bypass.
 *   MODEL_LAB  one row per callable model, every parameter its own column.
 *              DO=RUN and the answer, latency, status and tokens land in the row.
 * How it all runs: an installable onChange trigger (boardOnChange -> boardTick) fires on
 * the change itself, so a flagged row acts immediately. A one-minute time-driven trigger
 * runs the same function underneath purely as a backstop. onChange = instant; only the
 * time-driven trigger is scheduled, and Google documents its timing as approximate.
 * Install with action board_install_change. Note: triggers fire on a person's edit in the
 * UI, not on writes Apps Script makes to its own spreadsheet.
 * The article documenting this whole lane, end to end, is live at
 *   https://miscsubjects.com/a/gas-sheets-build-sync
 * OUTREACH, REPLIES, MODEL_FIELDS and EXPLAIN rebuild from D1 with one call:
 *   POST /api/board {"restore":1}
 */

/** Returns this reference as text, so an agent can fetch it via the web app. */
function apiReference() {
  return [
    'BASE https://miscsubjects.com',
    'AUTH header x-terminal-key, value from Script Property MISC',
    'FEEDS GET /api/map | GET /api/directory | GET /api/inventory',
    'RUN POST /api/dispatch {key,body} — runs any directory row',
    'MODEL POST /api/invoke {key,input,model} — up to 200 calls in one request',
    'EDIT A PROMPT PATCH /api/directory/<key> {content:"..."}',
    'Read API_REFERENCE.gs in this project for the full schema and route list.'
  ].join('\n');
}
