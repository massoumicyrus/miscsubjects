-- P6 fix: VOXEL_EDIT / VOXEL_MOVE / VOXEL_CONSOLIDATE / VOXEL_CHALLENGE stored an executable
-- template of ["$1+"] plus a literal "\n# WEB_RUNTIME: ..." tail glued after the array. The
-- dispatch http path (functions/api/dispatch.js runHttp) treats content starting with "[" as a
-- JSON body and forwards it verbatim; stripDocs only removes LEADING "#" lines, so the trailing
-- WEB_RUNTIME comment survived. The downstream /api/protocol/voxel-* handlers therefore received
-- ["{caller json}"]\n# WEB_RUNTIME... — a JSON array wrapping the caller object as a string with
-- trailing garbage — and rejected every call with 400 "slug required".
--
-- VOXEL_BATCH was already correct: its executable tail is raw "$1+" (0290), which passes the
-- caller's JSON object through as the HTTP body. This migration makes the other four match:
-- collapse everything from the first newline+["$1+"] onward to a single newline + $1+, preserving
-- the leading "# WHAT / # ARGS / # EX / # TESTS" docstring block that Directory renders.
--
-- $1+ = args[0..] rejoined with "|", so a JSON body containing a pipe is reconstructed losslessly;
-- this fix also neutralizes the pipe-split (P2) for these four rows.
UPDATE directory
SET content = substr(content, 1, instr(content, char(10) || '["$1+"]') - 1) || char(10) || '$1+',
    updated_at = datetime('now')
WHERE key IN ('VOXEL_EDIT','VOXEL_MOVE','VOXEL_CONSOLIDATE','VOXEL_CHALLENGE')
  AND instr(content, char(10) || '["$1+"]') > 0;
