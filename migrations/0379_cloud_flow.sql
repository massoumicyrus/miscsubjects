-- 0379 — a flow that crosses the substrate boundary with no flow-level cloud code
--
-- The claim being made concrete: once cloud execution is an ordinary capability,
-- composition is free. This flow takes a value from one existing capability,
-- feeds it to a command running in a Cloudflare container, and feeds THAT result
-- to a third capability — with nothing cloud-specific anywhere in the flow.

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,runner,execution,updated_at,created_at,enabled,planner_visible,planner_rank)
VALUES ('CLOUD_FLOW_PROOF','flow','','',
'# WHAT: Proof that cloud execution composes like any other capability.
# STEP 1 reads the clock. STEP 2 runs a command in a container that consumes step 1 via $PREV.
# STEP 3 upper-cases what the container printed, so the whole chain is visible in one result. No cloud-specific flow code exists.
NOW:
> CLOUD_EXEC: printf "flow-carried %s" "$PREV" | tr a-z A-Z
> UPPER: $PREV',
'cloud','edge','cloud','2026-09-06','2026-09-06',1,1,23);
