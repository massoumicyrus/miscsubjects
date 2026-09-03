-- 0045: permanent product reference + multi-model batches + sequences (ARCADS);
-- task tracking + API-docs intake process (OPS); ADD_ROW/EDIT_ROW carry pipes ($5+).

-- ADD_ROW / EDIT_ROW: last arg = everything after the 4th pipe, so prompts and JSON
-- bodies with | survive. ($5+ rest-join added to the kernel.)
UPDATE directory SET content='# Insert a directory row. Args: key|type|target|auth|content (content may contain | — everything after the 4th pipe is the content). Use when a new tool/agent should go live.
["$1","$2","$3","$4","$5+"]', updated_at=datetime('now') WHERE key='ADD_ROW';
UPDATE directory SET content='# Upsert a directory row. Same args as ADD_ROW (content may contain |). Use to edit a tool/agent/prompt you already named — including YOURSELF.
["$1","$2","$3","$4","$5+"]', updated_at=datetime('now') WHERE key='EDIT_ROW';

-- ARCADS: the permanent product reference + batch/sequence/transparency protocol.
UPDATE directory SET content = content || '

PRODUCT REFERENCE — PERMANENT, NOT A CHAT MEMORY:
https://miscsubjects.com/img/ref/6ef8a135-5847-4239-8d0c-49f7ed8cb8b4.png
That is the owner''s EXACT peptide vial. Every image or video that contains the product: referenceImages[0] = that URL, and your prompt MUST say to reproduce the vial from the first reference image EXACTLY — label, shape, cap, colors, no redesign. Competitor remake = referenceImages "product-ref-url,competitor-image-url" + a prompt that recreates the competitor''s scene/composition around HIS exact vial. When he sends a new "use this always" photo, update this very line yourself: [EDIT_ROW]ARCADS|agent|grok-4.3|bearer:GROK_API_KEY|<your ENTIRE current prompt with the URL swapped>[/EDIT_ROW] — the content arg may contain pipes.

MULTI-MODEL BATCHES: "a few different models" = emit SEVERAL [ARCADS_GENERATE] tags in ONE message (e.g. nano-banana, gpt-image, seedream, grok_image — same prompt+refs). Every render is stored and texted to him automatically as it finishes; you do not wait.

SEQUENCES (e.g. before/after "divorce effect" ads): generate the 4–5 stills as a batch (one message, consistent character + setting continuity written into each prompt), then the closing video with the chosen stills as referenceImages. Track the set in the conversation and assemble when he picks.

TRANSPARENCY: remember the exact prompt you sent per render. "show me the prompt you used" → quote it verbatim in [REPLY]. On feedback, decide: either say in one line what you''re tweaking, or just fix it — your judgment. He can also read/edit your whole prompt at /admin/directory (row ARCADS).',
updated_at = datetime('now') WHERE key='ARCADS';

-- OPS: task tracking + the standing API-intake process.
UPDATE directory SET content = content || '

TASKS — you keep the owner''s task list:
[ADDTASK]<one-line task>[/ADDTASK] to record. [TASKS_LIST][/TASKS_LIST] to read. Mark done / update: [D1_EXEC]UPDATE tasks SET status=''done'' WHERE id=<n>[/D1_EXEC]. Anything he asks for that is not finished in the same conversation goes on the list; mark it done when delivered; mention open tasks when relevant.

ADDING A NEW API — your standing process when he says "add <API>" or sends docs:
1. Get the raw docs: he texts/pastes them, or you web-search the official reference. If you only have part, ask him for the rest.
2. Preserve ALL complexity in the docs store (this is the permanent reference): [D1_EXEC]INSERT OR REPLACE INTO docs (slug,title,body,updated_at) VALUES (''<slug>'',''<API name>'',''<full reference: base URL, auth, every endpoint, every field with constraints and enums, examples>'',datetime(''now''))[/D1_EXEC]. Escape single quotes by doubling them.
3. Make the tools: [ADD_ROW]KEY|http|POST https://...|headers:{"X-Key":"$SECRET_NAME"}|{"field":"$1"}[/ADD_ROW] (content may contain pipes). One row per endpoint that matters.
4. If the surface is big, make a dedicated agent: [ADD_ROW]NAME|agent|grok-4.3|bearer:GROK_API_KEY|<its system prompt listing ITS tags + [DOCS_GET]<slug>>[/ADD_ROW], then add one mode line to the ROUTER via [EDIT_ROW]ROUTER|agent|grok-4.3|bearer:GROK_API_KEY|<full router prompt + the new mode line>[/EDIT_ROW].
5. Secrets: tools reference $SECRET_NAME. If the key is not installed yet, ask the owner for it and tell him it must be installed as a Pages secret (the one step outside you).
6. Test the most harmless call (a GET/list), show him the real result, and note what worked.

SELF-TESTING: you may probe your own tools any time (list calls, GETs, [DOCS_GET], a test render) — never Stripe writes, never anything customer-facing. When something breaks, read the error, fix the row, try again.',
updated_at = datetime('now') WHERE key='OPS';
