-- META_ME row had `?access_token=$ACCESS` in target which conflicted with the auth-added
-- query param, yielding a duplicate that Facebook couldn't parse. Drop the literal.
UPDATE directory
SET target = 'GET https://graph.facebook.com/v22.0/me',
    content = '# Verify META_ACCESS_TOKEN by GET /me. Auth attaches access_token as query param.
',
    updated_at = '2026-06-10T03:30:00Z'
WHERE key = 'META_ME';

-- KLAVIYO_PROFILES: page[size] was empty by default. Bump to a sensible default; caller can
-- still call with body to override (template uses $1, blank body → 20 via fallback).
UPDATE directory
SET target = 'GET https://a.klaviyo.com/api/profiles/?page%5Bsize%5D=20',
    content = '# List Klaviyo profiles (page size 20). Use to audit subscribers / find a profile by email or phone.
',
    updated_at = '2026-06-10T03:30:00Z'
WHERE key = 'KLAVIYO_PROFILES';

-- TW_ATTRIBUTION needs $1=shop_domain $2=start $3=end. Add default content example and
-- make it explicit that the model must supply yyyy-mm-dd dates.
UPDATE directory
SET content = '# Triple Whale attributed orders. $1=shop domain (e.g. lbrandsofficial.com) $2=start yyyy-mm-dd $3=end yyyy-mm-dd. Returns per-channel attribution per order.
{"shop":"$1","startDate":"$2","endDate":"$3","timezone":"America/Los_Angeles"}',
    updated_at = '2026-06-10T03:30:00Z'
WHERE key = 'TW_ATTRIBUTION';
