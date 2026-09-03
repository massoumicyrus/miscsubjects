-- Owner correction 2026-07-16: one edit token is the model-facing Tap & Go entry.
-- Existing child-token, macaroon, caveat, attenuation, and ancestor-revocation machinery
-- remains intact. Bearer material is forbidden only from public evidence.

INSERT INTO directory_tests (
  key,kind,args,expect_kind,expect_value,note,expected_text,tier
) VALUES (
  'ROUTER',
  'e2e',
  'Give a new model the Tap & Go social proof workflow. Do I have to delete or replace child tokens, macaroons, or caveats to use one edit token?',
  'reply_ok',
  'one edit token|child|macaroon|caveat|remain|X_POST|RELAY_POST_APPEND',
  'owner correction 2026-07-16: single model-facing edit token is additive and never deletes delegation machinery',
  'Give the model one edit token scoped to NOW, X_POST, and RELAY_POST_APPEND. Existing child-token, macaroon, caveat, attenuation, and revocation workflows remain intact and optional. Public proof contains only cap fingerprints, inv receipts, relay links, anchor links, and social status URLs.',
  8
);

INSERT INTO directory_tests (
  key,kind,args,expect_kind,expect_value,note,expected_text,tier
) VALUES (
  'ROUTER',
  'e2e',
  'A model is about to put its edit token, share URL, macaroon, or caveat key into its public X and relay proof. What happens?',
  'reply_ok',
  '404|never public|cap_|inv_|X_POST|RELAY_POST_APPEND',
  'owner order 2026-07-16: private authority remains operational but cannot become public evidence',
  'Do not publish bearer material. The public write returns generic 404 before firing or logging. Keep the private authority workflow intact and publish only cap fingerprints, inv receipts, relay and anchor links, and the X status URL.',
  8
);
