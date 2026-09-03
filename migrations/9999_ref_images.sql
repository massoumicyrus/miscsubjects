INSERT INTO assets (id, created_at, category, label, r2_key, url, engine, notes) VALUES
  ('ref-vial-black-bg', datetime('now'), 'reference', 'LEO vial black background', 'img/ref/leo-vial-black-bg.png', 'https://miscsubjects.com/img/ref/leo-vial-black-bg.png', null, 'Uploaded reference image for ad generation'),
  ('ref-vial-glitch-light', datetime('now'), 'reference', 'LEO vial glitch light', 'img/ref/leo-vial-glitch-light.png', 'https://miscsubjects.com/img/ref/leo-vial-glitch-light.png', null, 'Uploaded reference image for ad generation')
  ON CONFLICT(id) DO UPDATE SET url=excluded.url, r2_key=excluded.r2_key, notes=excluded.notes;
