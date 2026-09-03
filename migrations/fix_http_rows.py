#!/usr/bin/env python3
"""Batch-fix HTTP rows to standard format."""
import json, re, subprocess, sys

# Export all bad HTTP rows
cmd = [
    'npx', 'wrangler', 'd1', 'execute', 'loop-content-spine',
    '--env=production', '--remote',
    '--command=SELECT key, content FROM directory WHERE type = \'http\' AND enabled = 1 AND content NOT LIKE \'# WHAT:%\' AND content NOT LIKE \'#WHAT:%\' ORDER BY key'
]
r = subprocess.run(cmd, cwd='/Users/owner/miscsubjects-pages', capture_output=True, text=True, timeout=120)
raw = r.stdout

# Parse JSON results
m = re.search(r'"results"\s*:\s*(\[.*?\])\s*,\s*"success"', raw, re.DOTALL)
if not m:
    print("Could not parse results")
    print(raw[:500])
    sys.exit(1)

rows = json.loads(m.group(1))
print(f"Found {len(rows)} bad HTTP rows to fix")

updates = []
for row in rows:
    key = row['key']
    content = row['content']
    
    # Skip if already good
    if content.startswith('# WHAT:'):
        continue
    
    lines = content.split('\n')
    first_line = lines[0].strip() if lines else ''
    
    # Remove leading # and whitespace
    desc = first_line.lstrip('#').strip()
    
    # Extract WHAT (first sentence/fragment before Args or when_to_use)
    what = desc
    when_to_use = ''
    args_desc = ''
    
    # Look for WHEN_TO_USE in the description itself
    when_match = re.search(r'WHEN_TO_USE:\s*(.+?)(?:\n|$)', content, re.IGNORECASE)
    if when_match:
        when_to_use = when_match.group(1).strip()
        # Remove it from what
        what = re.sub(r'WHEN_TO_USE:\s*.+?(?:\n|$)', '', what, flags=re.IGNORECASE).strip()
    
    # Look for "when_to_use:" in the description line
    if not when_to_use:
        when_match = re.search(r'when_to_use:\s*(.+?)(?:\.|$)', desc, re.IGNORECASE)
        if when_match:
            when_to_use = when_match.group(1).strip()
            what = re.sub(r'when_to_use:\s*.+?(?:\.|$)', '', what, flags=re.IGNORECASE).strip()
    
    # Look for "Use for..." or "Use when..."
    if not when_to_use:
        use_match = re.search(r'Use\s+(?:for|when|to)\s+(.+?)(?:\.|$)', desc, re.IGNORECASE)
        if use_match:
            when_to_use = use_match.group(1).strip()
            what = re.sub(r'Use\s+(?:for|when|to)\s+.+?(?:\.|$)', '', what, flags=re.IGNORECASE).strip()
    
    # Look for "Arg:" or "Args:" in the description
    args_match = re.search(r'Args?:\s*(.+?)(?:\.|$)', desc, re.IGNORECASE)
    if args_match:
        args_desc = args_match.group(1).strip()
        what = re.sub(r'Args?:\s*.+?(?:\.|$)', '', what, flags=re.IGNORECASE).strip()
    
    # If no when_to_use, derive from key
    if not when_to_use:
        when_to_use = f"you need to {key.lower().replace('_', ' ')}"
    
    # Clean up WHAT
    what = what.rstrip('.').strip()
    if not what:
        what = f"Call {key}"
    
    # Extract actual JSON content (everything after the comment lines)
    json_lines = []
    in_json = False
    for line in lines[1:]:
        stripped = line.strip()
        if stripped.startswith('{') or stripped.startswith('[') or stripped.startswith('"') or '$' in stripped:
            in_json = True
        if in_json or (stripped and not stripped.startswith('#')):
            json_lines.append(line)
    
    actual_content = '\n'.join(json_lines).strip()
    if not actual_content:
        # If no JSON found, the whole thing might be the content
        actual_content = content
    
    # Extract parameter names from content
    param_matches = re.findall(r'\$(\d+\+?)', actual_content)
    params = sorted(set(param_matches), key=lambda x: int(x.rstrip('+')))
    
    # Build EX line
    if params:
        ex_args = '|'.join([f"arg{p.rstrip('+')}" for p in params])
        ex = f"[{key}]{ex_args}[/{key}]"
    else:
        ex = f"[{key}][/{key}]"
    
    # Build new content
    new_content = f"# WHAT: {what}\n# WHEN_TO_USE: {when_to_use}\n# ARGS: {args_desc or 'see content'}\n# EX: {ex}\n{actual_content}"
    
    # Escape for SQL
    escaped_content = new_content.replace("'", "''")
    updates.append(f"UPDATE directory SET content = '{escaped_content}' WHERE key = '{key}';")

# Write migration
sql = "-- 0109: Batch-fix HTTP rows to standard format\n\n" + "\n".join(updates)
with open('/Users/owner/miscsubjects-pages/migrations/0109_http_format_fix.sql', 'w') as f:
    f.write(sql)

print(f"Generated {len(updates)} UPDATE statements")
print(f"Migration written to 0109_http_format_fix.sql")

# Show first 3
for u in updates[:3]:
    print(f"\n{u[:200]}...")
