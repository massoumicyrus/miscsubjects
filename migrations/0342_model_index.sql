-- THE LIVING MODEL LEADERBOARD, as a work object rather than a page.
--
-- Every number about a model on this build is stored as one observation: what was measured,
-- of which model, by whom, on what date, with the URL it came from and the class of evidence
-- it is. Nothing is stored as a bare figure, because a bare figure cannot be audited and
-- cannot be superseded — it can only be overwritten, which destroys the record of what was
-- believed and when.
--
-- The article that reads from this table is a projection of it. The table is the object.

CREATE TABLE IF NOT EXISTS model_index_observations (
  id               TEXT PRIMARY KEY,
  observed_at      TEXT NOT NULL,        -- when THIS build read it (ISO, server clock)
  event_date       TEXT,                 -- when the underlying fact was true / published
  model_key        TEXT NOT NULL,        -- normalised: 'anthropic/claude-opus-5'
  model_label      TEXT NOT NULL,        -- display: 'Claude Opus 5'
  maker            TEXT,                 -- 'Anthropic'
  weights          TEXT,                 -- open | closed | unknown
  metric           TEXT NOT NULL,        -- price_in_usd_per_mtok | swe_bench_verified | aa_ifbench | ...
  metric_family    TEXT NOT NULL,        -- price | capability | obedience | popularity | writing | agentic
  value_num        REAL,
  value_text       TEXT,
  unit             TEXT,                 -- usd_per_mtok | fraction | percent | tokens_per_week | elo | index
  venue            TEXT,                 -- for prices: the seller. 'DeepSeek' | 'Cloudflare' | 'Novita'
  venue_kind       TEXT,                 -- maker | router | cloud | host | benchmark
  precision_note   TEXT,                 -- fp4 | fp8 | unstated — a cheap endpoint is not always the same product

  -- provenance, mandatory
  source_url       TEXT NOT NULL,
  source_title     TEXT,
  source_publisher TEXT,
  source_type      TEXT NOT NULL,        -- first_party_docs | first_party_api | benchmark | press | aggregator
  quote            TEXT,                 -- verbatim words where the source is prose

  -- evidence classification, the site's own taxonomy
  evidence_class   TEXT NOT NULL,        -- measured | reported | vendor_stated | derived | promotional | unresolved
  method           TEXT,                 -- how the number was produced
  caveat           TEXT,                 -- what this number cannot tell you
  superseded_by    TEXT,                 -- id of a later observation that replaces this one
  run_id           TEXT                  -- the refresh run that wrote it
);

CREATE INDEX IF NOT EXISTS idx_mio_model   ON model_index_observations (model_key, metric);
CREATE INDEX IF NOT EXISTS idx_mio_metric  ON model_index_observations (metric, observed_at);
CREATE INDEX IF NOT EXISTS idx_mio_live    ON model_index_observations (superseded_by, metric_family);
CREATE INDEX IF NOT EXISTS idx_mio_run     ON model_index_observations (run_id);

-- One row per refresh, so the leaderboard can say when it last looked and what it found.
CREATE TABLE IF NOT EXISTS model_index_runs (
  run_id        TEXT PRIMARY KEY,
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  sources_ok    INTEGER DEFAULT 0,
  sources_failed INTEGER DEFAULT 0,
  observations  INTEGER DEFAULT 0,
  detail        TEXT
);
