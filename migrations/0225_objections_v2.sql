-- 0225 — DB. Objection ledger v2: Book X attack fields + answer/relitigation machinery.
ALTER TABLE oip_objections ADD COLUMN exact_claim TEXT;
ALTER TABLE oip_objections ADD COLUMN attack_type TEXT;
ALTER TABLE oip_objections ADD COLUMN minimum_patch TEXT;
ALTER TABLE oip_objections ADD COLUMN relitigation_of INTEGER;
