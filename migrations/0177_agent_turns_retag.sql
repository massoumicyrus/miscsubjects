-- 0177_agent_turns_retag.sql — backfill tags_json on rows inserted before tag-aware API deploy.
UPDATE agent_turns SET tags_json = '["import","unaudited"]'
WHERE tags_json IS NULL AND source = 'import';

UPDATE agent_turns SET tags_json = '["backfill","unaudited","text_only"]'
WHERE tags_json IS NULL AND source = 'backfill' AND COALESCE(n_tools,0) = 0
  AND (files_json IS NULL OR files_json IN ('[]',''));

UPDATE agent_turns SET tags_json = '["backfill","unaudited","tools"]'
WHERE tags_json IS NULL AND source = 'backfill' AND COALESCE(n_tools,0) > 0;

UPDATE agent_turns SET tags_json = '["hook","unaudited","text_only"]'
WHERE tags_json IS NULL AND source = 'hook' AND COALESCE(n_tools,0) = 0;

UPDATE agent_turns SET tags_json = '["hook","unaudited","tools"]'
WHERE tags_json IS NULL AND source = 'hook' AND COALESCE(n_tools,0) > 0;

UPDATE agent_turns SET tags_json = '["dispatch_only","unaudited"]'
WHERE tags_json IS NULL AND source = 'dispatch';

UPDATE agent_turns SET tags_json = tags_json
WHERE tags_json LIKE '%]%'
  AND (
    lower(COALESCE(user_input,'') || COALESCE(assistant_text,'') || COALESCE(commands_json,'') || COALESCE(files_json,'')) LIKE '%rm -rf%'
    OR lower(COALESCE(user_input,'') || COALESCE(assistant_text,'') || COALESCE(commands_json,'')) LIKE '%git reset --hard%'
    OR lower(COALESCE(user_input,'') || COALESCE(assistant_text,'') || COALESCE(commands_json,'')) LIKE '%api/file%'
    OR lower(COALESCE(user_input,'') || COALESCE(assistant_text,'') || COALESCE(commands_json,'')) LIKE '%git push --force%'
  )
  AND tags_json NOT LIKE '%risk%';

-- Append risk/shell/file_edit via replace (SQLite string hack for null-tagged edge cases)
UPDATE agent_turns SET tags_json = substr(tags_json,1,length(tags_json)-1) || ',"risk"]'
WHERE tags_json IS NOT NULL AND tags_json NOT LIKE '%risk%'
  AND (
    lower(COALESCE(user_input,'') || COALESCE(assistant_text,'') || COALESCE(commands_json,'')) LIKE '%rm -rf%'
    OR lower(COALESCE(user_input,'') || COALESCE(assistant_text,'') || COALESCE(commands_json,'')) LIKE '%api/file%'
  );

UPDATE agent_turns SET tags_json = substr(tags_json,1,length(tags_json)-1) || ',"shell"]'
WHERE tags_json IS NOT NULL AND tags_json NOT LIKE '%shell%'
  AND commands_json IS NOT NULL AND commands_json NOT IN ('[]','');

UPDATE agent_turns SET tags_json = substr(tags_json,1,length(tags_json)-1) || ',"file_edit"]'
WHERE tags_json IS NOT NULL AND tags_json NOT LIKE '%file_edit%'
  AND files_json IS NOT NULL AND files_json NOT IN ('[]','');

UPDATE agent_turns SET tags_json = substr(tags_json,1,length(tags_json)-1) || ',"protected"]'
WHERE tags_json IS NOT NULL AND tags_json NOT LIKE '%protected%'
  AND lower(COALESCE(user_input,'') || COALESCE(assistant_text,'') || COALESCE(files_json,'')) LIKE '%_middleware.js%';