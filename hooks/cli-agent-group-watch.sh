#!/usr/bin/env bash
# Live team-room view for a CLI agent group transcript.
# Usage: hooks/cli-agent-group-watch.sh /path/to/group_dir
set -euo pipefail

GROUP_DIR="${1:?group dir}"
TRANSCRIPT="$GROUP_DIR/transcript.md"
META="$GROUP_DIR/meta.json"

echo "=== CLI AGENT TEAM ROOM ==="
if [ -f "$META" ]; then
  node -e '
    const fs = require("fs");
    const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    console.log("Group:", m.group_id);
    console.log("Topic:", m.topic);
    console.log("Team:", (m.agents || []).join(", "));
    console.log("Mode:", m.mode, "| delivery:", m.delivery);
    console.log("");
  ' "$META" 2>/dev/null || cat "$META"
fi
echo "Watching: $TRANSCRIPT"
echo "(Ctrl+C to stop watching — agents keep running)"
echo ""

touch "$TRANSCRIPT"
tail -n 200 -f "$TRANSCRIPT"