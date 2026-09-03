-- OIP v0.9 — resource attenuation: an enforceable per-invocation payload ceiling.
-- Zero means unlimited. A delegated child inherits or narrows its parent's ceiling.
ALTER TABLE capabilities ADD COLUMN max_body_bytes INTEGER DEFAULT 0;

