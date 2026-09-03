-- 0114: Remove TOOLS_SEARCH references from agent prompts (TOOLS_SEARCH does not exist as a directory row)

-- 1. Fix OPS
UPDATE directory SET content = REPLACE(content, '[TOOLS_SEARCH]<keyword>|20[/TOOLS_SEARCH]', '[DIR_LIST][/DIR_LIST]') WHERE key = 'OPS';
UPDATE directory SET content = REPLACE(content, '[TOOLS_SEARCH]<best-keyword>|20[/TOOLS_SEARCH]', '[DIR_LIST][/DIR_LIST]') WHERE key = 'OPS';

-- 2. Fix TOOLKIT
UPDATE directory SET content = REPLACE(content, '[TOOLS_SEARCH]<keyword>|20[/TOOLS_SEARCH]', '[DIR_LIST][/DIR_LIST]') WHERE key = 'TOOLKIT';

-- 3. Fix INTENT
UPDATE directory SET content = REPLACE(content, '[TOOLS_SEARCH]deploy|5[/TOOLS_SEARCH]', '[DIR_LIST][/DIR_LIST]') WHERE key = 'INTENT';

-- 4. Fix CODE_AUDIT
UPDATE directory SET content = REPLACE(content, '[TOOLS_SEARCH]<keyword>|10[/TOOLS_SEARCH]', '[DIR_LIST][/DIR_LIST]') WHERE key = 'CODE_AUDIT';

-- 5. Fix CC_MIRROR
UPDATE directory SET content = REPLACE(content, '[TOOLS_SEARCH]<capability keyword>|10[/TOOLS_SEARCH]', '[DIR_LIST][/DIR_LIST]') WHERE key = 'CC_MIRROR';
