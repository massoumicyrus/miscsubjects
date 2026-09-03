-- Tier 9 + graph suite: question-graph populate script tracked in directory_tests kind=graph

INSERT INTO directory_tests (key, kind, args, tier, expect_kind, expect_value, expected_text, note) VALUES
('GRAPH','graph','g1_ask_herniated',1,'graph_step','ask|question_node','ASK creates gap question node on bpc-157','graph: ask herniated disc'),
('GRAPH','graph','g2_ingest_evidence',2,'graph_step','ingest|sources|evidence_node','INGEST adds sources + evidence node linked to question','graph: ingest evidence'),
('GRAPH','graph','g3_ask_after_ingest',3,'graph_step','ask|topology_selftest','ASK again sees ingested SELFTEST evidence in topology','graph: ask after ingest'),
('GRAPH','graph','g4_ask_no_ingest',4,'graph_step','ask_only|no_evidence_growth','ASK only — no new evidence_ingest rows (negative control)','graph: no spurious ingest'),
('GRAPH','graph','g5_fn_ask',5,'graph_step','fn_ask|ARTICLE_ASK','ARTICLE_ASK fn answers from catalogue','graph: fn ask path'),
('GRAPH','graph','g6_fn_ingest',6,'graph_step','fn_ingest|ledger','ARTICLE_INGEST writes bad-outcome anecdote to ledger','graph: fn ingest path');

-- Tier 9 e2e: conversational question-graph tools via ROUTER
INSERT INTO directory_tests (key, kind, args, tier, expect_kind, expect_value, expected_text, note) VALUES
('ROUTER','e2e','bpc-157|what good and bad experiences are logged for BPC-157 in your catalogue?',9,'reply_ok','bpc|ledger|anecdotal|catalogue|experience|question','ARTICLE_ASK from catalogue with gaps or evidence.','t9 graph ask'),
('ROUTER','e2e','how do I paste evidence from Grok into the bpc-157 article ledger?',9,'reply_ok','ingest|ledger|ARTICLE_INGEST|question node|evidence','Explains ingest slug|q:NODE|paste path.','t9 graph ingest howto'),
('ROUTER','e2e','what is on the bpc-157 question graph right now?',9,'reply_ok','question|graph|node|evidence|bpc','Reads question-graph or topology.','t9 graph inspect');