#!/usr/bin/env python3
"""Batch-fix fn rows to standard WHAT/WHEN_TO_USE/ARGS/EX format."""

import json, re, textwrap

# Parse the exported wrangler output
with open('/tmp/fn_bad_rows.txt') as f:
    raw = f.read()

# Extract JSON objects from the output
# The output is a mix of wrangler banner text and JSON
# Find the JSON array inside
m = re.search(r'\[\s*\{[^[]*"results"\s*:\s*(\[[^\]]*\])', raw, re.DOTALL)
if not m:
    # Try to find the raw JSON array
    m = re.search(r'"results"\s*:\s*(\[.*\])', raw, re.DOTALL)

if not m:
    print("Could not parse JSON from output")
    print("First 500 chars:", raw[:500])
    exit(1)

# Actually, let's just parse the whole thing as JSON after finding the array
# The wrangler output has JSON embedded in it
json_start = raw.find('[')
json_end = raw.rfind(']')
if json_start == -1 or json_end == -1:
    print("Could not find JSON array")
    exit(1)

# Try to parse - might need to find the right brackets
# The first [ is the start of the main array, but we need the results array
# Let's find the results array
results_match = re.search(r'"results"\s*:\s*(\[.*?\])\s*,\s*"success"', raw, re.DOTALL)
if not results_match:
    print("Could not find results array")
    exit(1)

results_json = results_match.group(1)
rows = json.loads(results_json)

print(f"Found {len(rows)} bad fn rows to fix")

updates = []
for row in rows:
    key = row['key']
    content = row['content']
    
    # Skip rows that are already in good format (shouldn't happen, but safety)
    if content.startswith('# WHAT:'):
        continue
    
    # Skip the __append_test__ row (it's special)
    if key == '__append_test__':
        continue
    
    # Skip SHARED_LAW (it's special, long text)
    if key == 'SHARED_LAW':
        continue
    
    # Parse the content
    lines = content.split('\n')
    
    # First line is usually the description
    first_line = lines[0] if lines else ''
    
    # Remove leading # and whitespace
    desc = first_line.lstrip('#').strip()
    
    # Try to split into WHAT and WHEN_TO_USE
    # Look for patterns like "Use for..." or "when_to_use:"
    what = desc
    when_to_use = ''
    args_desc = ''
    
    # Check if description contains "Args:" or "args:"
    args_match = re.search(r'Args:\s*(.+?)(?:\.|$)', desc, re.IGNORECASE)
    if args_match:
        args_desc = args_match.group(1).strip()
        # Remove the Args: part from WHAT
        what = re.sub(r'Args:\s*.+?(?:\.|$)', '', desc, flags=re.IGNORECASE).strip()
        # Clean up trailing punctuation
        what = what.rstrip('.').strip()
    
    # Check for "when_to_use:" in the description
    when_match = re.search(r'when_to_use:\s*(.+?)(?:\.|$)', desc, re.IGNORECASE)
    if when_match:
        when_to_use = when_match.group(1).strip()
        what = re.sub(r'when_to_use:\s*.+?(?:\.|$)', '', what, flags=re.IGNORECASE).strip()
    
    # Look for "Use for..." or "Use when..." in the description
    if not when_to_use:
        use_match = re.search(r'Use\s+(?:for|when|to)\s+(.+?)(?:\.|$)', desc, re.IGNORECASE)
        if use_match:
            when_to_use = use_match.group(1).strip()
            what = re.sub(r'Use\s+(?:for|when|to)\s+.+?(?:\.|$)', '', what, flags=re.IGNORECASE).strip()
    
    # If still no when_to_use, derive from the key name
    if not when_to_use:
        when_to_use = f"you need to {key.lower().replace('_', ' ')}"
    
    # Clean up WHAT
    what = what.rstrip('.').strip()
    if not what:
        what = f"Execute {key}"
    
    # Extract args from the actual content (JSON array or object)
    # Find the JSON part (last line or lines after the comment)
    json_lines = []
    in_json = False
    for line in lines[1:]:
        stripped = line.strip()
        if stripped.startswith('[') or stripped.startswith('{'):
            in_json = True
        if in_json:
            json_lines.append(line)
    
    actual_content = '\n'.join(json_lines).strip()
    
    # Extract parameter names from the JSON content
    # Look for "$1", "$2", etc.
    param_matches = re.findall(r'\$(\d+\+?)', actual_content)
    params = sorted(set(param_matches), key=lambda x: int(x.rstrip('+')))
    
    # Build ARGS description
    if not args_desc:
        if params:
            args_desc = ' | '.join([f"${p.rstrip('+')}" for p in params])
        else:
            args_desc = 'none'
    
    # Build EX line
    if params:
        ex_args = '|'.join([f"arg{p.rstrip('+')}" for p in params])
        ex = f"[{key}]{ex_args}[/{key}]"
    else:
        ex = f"[{key}][/{key}]"
    
    # Build new content
    new_content = f"# WHAT: {what}\n# WHEN_TO_USE: {when_to_use}\n# ARGS: {args_desc}\n# EX: {ex}\n{actual_content}"
    
    # Escape for SQL
    escaped_content = new_content.replace("'", "''")
    
    updates.append(f"UPDATE directory SET content = '{escaped_content}' WHERE key = '{key}';")

# Write the migration SQL
sql = "-- 0108: Batch-fix fn rows to standard format\n\n" + "\n".join(updates)

with open('/Users/owner/miscsubjects-pages/migrations/0108_fn_format_fix.sql', 'w') as f:
    f.write(sql)

print(f"Generated {len(updates)} UPDATE statements")
print(f"Migration written to 0108_fn_format_fix.sql")
print(f"Total size: {len(sql)} bytes")

# Show first 3 examples
for u in updates[:3]:
    print(f"\n{u[:200]}...")
