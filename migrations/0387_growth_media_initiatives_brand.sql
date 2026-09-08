ALTER TABLE media_initiatives ADD COLUMN brand_id TEXT;
CREATE INDEX IF NOT EXISTS media_initiatives_brand ON media_initiatives(tenant_id, brand_id);
