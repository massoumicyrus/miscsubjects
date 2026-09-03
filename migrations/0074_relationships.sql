-- 0074_relationships.sql — the biological intervention graph. Every entity (drug, condition,
-- tissue, symptom, peptide, audience) connects to others. Once populated, drug×peptide
-- combinations and condition→tissue→peptide chains generate without hand-writing each article.
CREATE TABLE IF NOT EXISTS relationships (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type       TEXT NOT NULL,   -- drug | condition | tissue | symptom | peptide | audience | pathway
  source_id         TEXT NOT NULL,   -- name or slug
  target_type       TEXT NOT NULL,
  target_id         TEXT NOT NULL,
  relationship_type TEXT NOT NULL,   -- causes | associated_with | damages | slows | loads | studied_for | reduces | concern
  evidence_score    INTEGER,         -- 1-10 (10 = strong human evidence)
  note              TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON relationships(target_type, target_id);

INSERT INTO relationships (source_type,source_id,target_type,target_id,relationship_type,evidence_score,note,created_at,updated_at) VALUES
('drug','Adderall','symptom','insomnia','causes',9,'stimulant disrupts sleep onset',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('drug','Adderall','symptom','anxiety','causes',8,'',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('drug','Adderall','tissue','gut lining','damages',6,'empty-stomach acid exposure',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('drug','Adderall','pathway','dopamine','concern',6,'chronic dopaminergic load',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('drug','NSAIDs','tissue','gut lining','damages',8,'COX inhibition erodes mucosa',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('drug','NSAIDs','tissue','injury site','slows',7,'blunts the inflammation repair needs',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('drug','GLP-1','symptom','muscle loss','causes',8,'lean mass lost with fat',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('drug','GLP-1','tissue','body weight','reduces',9,'major weight reduction in trials',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('tissue','body weight','tissue','spine','loads',7,'~4lb spinal/knee load per lb',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('tissue','body weight','tissue','knee','loads',8,'~4x load per step',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('peptide','Semax','pathway','BDNF','studied_for',6,'upregulates BDNF',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('peptide','Semax','tissue','neurons','studied_for',6,'',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('peptide','Selank','symptom','anxiety','studied_for',6,'anxiolytic pathway',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('peptide','BPC-157','tissue','gut lining','studied_for',7,'animal gut-repair data',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('peptide','BPC-157','tissue','tendon','studied_for',7,'animal tendon data',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('peptide','ARA-290','tissue','peripheral nerves','studied_for',8,'human small-fiber trials',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('peptide','TB-500','tissue','muscle','studied_for',6,'repair-cell migration, animal',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now'));
