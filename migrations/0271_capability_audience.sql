-- OIP v1.1 — FEDERATION: audience binding (LEDGER db: loop-shared-events).
-- A capability MAY name the exact remote agent it is minted for (a caveat, ocap/Macaroon style).
-- An audience-bound token is valid ONLY inside a verified oip-message/1 invoke whose signed
-- sender matches the audience (its full agent id, or its domain). Presenting it directly, or
-- forwarding it to any other agent, fails closed. A delegated child may keep or narrow the
-- audience (equal, or from a domain down to one agent in that domain), never widen it.
ALTER TABLE capabilities ADD COLUMN audience TEXT;
CREATE INDEX IF NOT EXISTS capabilities_audience_idx ON capabilities(audience);
