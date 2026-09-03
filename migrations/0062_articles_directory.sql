-- 0062_articles_directory.sql — directory row for natural-language article editing.
-- ARTICLES is a target_map row that fans out to /api/articles[/...] endpoints.
-- The compose/judge endpoints internally fire grok-4.3 with prompts pulled from docs.

INSERT OR REPLACE INTO directory(key, type, target, auth, content, category, allowed_categories, seq, enabled, planner_visible, planner_rank, input_schema, examples, updated_at) VALUES
('ARTICLES', 'http',
'target_map:{"list":{"method":"GET","url":"https://miscsubjects.com/api/articles"},"get":{"method":"GET","url":"https://miscsubjects.com/api/articles/$1"},"create":{"method":"POST","url":"https://miscsubjects.com/api/articles","body":"{\"slug\":\"$1\",\"title\":\"$2\",\"subject\":\"$3\"}"},"update":{"method":"PATCH","url":"https://miscsubjects.com/api/articles/$1","body":"{\"title\":\"$2\"}"},"delete":{"method":"DELETE","url":"https://miscsubjects.com/api/articles/$1"},"compose":{"method":"POST","url":"https://miscsubjects.com/api/articles/$1/compose","body":"{\"slot_key\":\"$2\",\"brief\":\"$3\"}"},"judge":{"method":"POST","url":"https://miscsubjects.com/api/articles/$1/judge","body":"{}"},"set":{"method":"POST","url":"https://miscsubjects.com/api/articles/$1/set","body":"{\"slot_key\":\"$2\",\"content\":\"$3\"}"}}',
'',
'# Natural-language editable articles. One row per article in D1. Slots: what_it_is, mechanism, evidence_animal, evidence_human, marketing_vs_evidence, open_questions, disclaimer, custom.
# Public page: https://miscsubjects.com/a/<slug>
# ARGS — first arg is the operation:
#   list                                                      → all articles (slug,title,subject,updated_at)
#   get|<slug>                                                → one article + latest slot versions
#   create|<slug>|<title>|<subject>                           → make a new article shell
#   update|<slug>|<title>                                     → rename
#   delete|<slug>                                             → drop the article + every slot version
#   compose|<slug>|<slot_key>|<brief?>                        → grok-4.3 writes a new version of <slot_key>
#   judge|<slug>                                              → grok-4.3 scores every current slot vs STYLE_TOPOLOGY rubric
#   set|<slug>|<slot_key>|<content>                           → operator overrides slot content (no LLM)
# WHEN_TO_USE: any natural-language article CRUD or "regenerate the X slot of Y", "score the Y article", "create article called X".',
'articles', '', 80, 1, 1, 30,
'{"args":["op","arg1","arg2","arg3"]}',
'[{"args":"list","desc":"List every article"},{"args":"compose|bpc-157|mechanism","desc":"Regenerate the mechanism slot of bpc-157"}]',
strftime('%Y-%m-%dT%H:%M:%SZ','now'));
