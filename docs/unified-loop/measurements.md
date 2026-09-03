# Unified loop measurements

## Measurement 1 — Public capability registry size

| what | command | raw output | derived number |
|---|---|---|---|
| registry payload size (bytes) | `curl -s "https://miscsubjects.com/api/dispatch?registry=1" \
  \| wc -c` | `1608289` | `1608289 bytes` |
| registry row count (as reported by the payload) | `curl -s "https://miscsubjects.com/api/dispatch?registry=1" \
  \| jq '.count'` | `877` | `877 rows (reported by payload field .count)` |
| registry approximate token count (approximate) | `python3 - <<'PY'
bytes_val=1608289
# divisor=4 bytes per token (approximate). Rationale: common rough rule-of-thumb for English/JSON text.
div=4
print(bytes_val/div)
PY` | `402072.25` | `402072.25 tokens (approximate; divisor = 4 bytes/token)` |

## Measurement 2 — Contract size (markdown)

| what | command | raw output | derived number |
|---|---|---|---|
| contract size for `NOW` (bytes) | `curl -s "https://miscsubjects.com/api/dispatch?key=NOW&format=markdown" \
  \| wc -c` | `4423` | `4423 bytes` |
| contract size for `D1_QUERY` (bytes) | `curl -s "https://miscsubjects.com/api/dispatch?key=D1_QUERY&format=markdown" \
  \| wc -c` | `811` | `811 bytes` |
| contract size for `LOCAL_EXEC` (bytes) | `curl -s "https://miscsubjects.com/api/dispatch?key=LOCAL_EXEC&format=markdown" \
  \| wc -c` | `425` | `425 bytes` |
| contract size for `X_POST` (bytes) | `curl -s "https://miscsubjects.com/api/dispatch?key=X_POST&format=markdown" \
  \| wc -c` | `868` | `868 bytes` |
| contract size for `CF_EXEC` (bytes) | `curl -s "https://miscsubjects.com/api/dispatch?key=CF_EXEC&format=markdown" \
  \| wc -c` | `869` | `869 bytes` |

Contract size summary (bytes):

| what | command | raw output | derived number |
|---|---|---|---|
| min/max/median of the 5 contracts (bytes) | `python3 - <<'PY'
import statistics
vals=[4423,811,425,868,869]
vals_sorted=sorted(vals)
print(vals_sorted)
print('min', min(vals_sorted))
print('max', max(vals_sorted))
print('median', statistics.median(vals_sorted))
PY` | ```
[425, 811, 868, 869, 4423]
min 425
max 4423
median 868
``` | `min=425 bytes; max=4423 bytes; median=868 bytes` |

## Measurement 3 — Resolve step payload size

| what | command | raw output | derived number |
|---|---|---|---|
| resolve payload size for ask=`what time is it` (bytes) | `curl -s "https://miscsubjects.com/api/dispatch?ask=what+time+is+it" \
  \| wc -c` | `12332` | `12332 bytes` |

## Measurement 4 — Real comparison + break-even

Measured inputs used in the arithmetic:

| component | command | raw output | derived number |
|---|---|---|---|
| carry-all catalogue size proxy = registry payload (bytes) | `curl -s "https://miscsubjects.com/api/dispatch?registry=1" \| wc -c` | `1608289` | `1608289 bytes` |
| per-capability resolve (bytes) | `curl -s "https://miscsubjects.com/api/dispatch?ask=what+time+is+it" \| wc -c` | `12332` | `12332 bytes` |
| per-capability contract (bytes) | `curl -s "https://miscsubjects.com/api/dispatch?key=D1_QUERY&format=markdown" \| wc -c` | `811` | `811 bytes` |
| per-capability invoke (bytes) | UNVERIFIED (no command run) | UNVERIFIED | `0 bytes (UNVERIFIED)` |
| per-capability receipt (bytes) | UNVERIFIED (no command run) | UNVERIFIED | `0 bytes (UNVERIFIED)` |

### Break-even

1. Carry-all catalogue bytes per message (proxy): `registry_bytes = 1608289`.
2. On-demand bytes per capability use: `per_use_bytes = resolve_bytes + contract_bytes + invoke_bytes + receipt_bytes`.
3. Substitute measured/unverified values: `per_use_bytes = 12332 + 811 + 0 + 0 = 14011`.
4. Solve `N * per_use_bytes > registry_bytes`.
5. `N > 1608289 / 14011`.
6. Compute the ratio:

| what | command | raw output | derived number |
|---|---|---|---|
| registry_bytes / per_use_bytes | `python3 - <<'PY'
registry_bytes=1608289
per_use_bytes=12332+811+0+0
print(per_use_bytes)
print(registry_bytes/per_use_bytes)
PY` | ```
14011
114.79880151309443
``` | `N > 114.79880151309443` |

7. Smallest integer `N` that satisfies the inequality:

| what | command | raw output | derived number |
|---|---|---|---|
| break-even integer N | `python3 - <<'PY'
import math
registry_bytes=1608289
per_use_bytes=14011
print('break_even', math.floor(registry_bytes/per_use_bytes)+1)
PY` | `break_even 115` | `115 capabilities per message` |

## Measurement 5 — `/api/proof` capability count

| what | command | raw output | derived number |
|---|------|---|---|
| `/api/proof` raw body | `curl -s https://miscsubjects.com/api/proof` | *(raw JSON; see reproduce section for exact command)* | UNVERIFIED (not parsed here) |
| selected fields from `/api/proof` | `curl -s https://miscsubjects.com/api/proof \
  \| jq '.capabilities, .capability_definitions, .tools, .tool_definitions, .registry'` | ```
892
null
null
null
null
``` | `capabilities = 892 (per /api/proof)` |

Disagreement check (page claim vs measured):

| claim | measured | evidence |
|---|---:|---|
| page: 891 capabilities | 892 capabilities | `curl -s https://miscsubjects.com/api/proof | jq '.capabilities, ...'` output above |
| page: 879 capabilities (break-even prompt) | 892 capabilities | same |
| page: registry row count (implied by “capabilities exposed”) | 877 rows (payload field `.count`) | `curl -s "...registry=1" | jq '.count'` output above |

## What these numbers do not show

1. Byte-to-token conversion uses a divisor (4 bytes/token) that is an approximation. It is not a tokenization measurement.
2. Each measurement is a single run. No distribution, variance, or caching effects are measured.
3. The break-even arithmetic treats `invoke_bytes` and `receipt_bytes` as UNVERIFIED zeros. A non-zero value changes the break-even.

## Reproduce

Run these commands in order:

1. `curl -s "https://miscsubjects.com/api/dispatch?registry=1" | wc -c`
2. `curl -s "https://miscsubjects.com/api/dispatch?registry=1" | jq '.count'`
3. `python3 - <<'PY'
bytes_val=1608289
# divisor=4 bytes per token (approximate). Rationale: common rough rule-of-thumb for English/JSON text.
div=4
print(bytes_val/div)
PY`
4. `curl -s "https://miscsubjects.com/api/dispatch?key=NOW&format=markdown" | wc -c`
5. `curl -s "https://miscsubjects.com/api/dispatch?key=D1_QUERY&format=markdown" | wc -c`
6. `curl -s "https://miscsubjects.com/api/dispatch?key=LOCAL_EXEC&format=markdown" | wc -c`
7. `curl -s "https://miscsubjects.com/api/dispatch?key=X_POST&format=markdown" | wc -c`
8. `curl -s "https://miscsubjects.com/api/dispatch?key=CF_EXEC&format=markdown" | wc -c`
9. `python3 - <<'PY'
import statistics
vals=[4423,811,425,868,869]
vals_sorted=sorted(vals)
print(vals_sorted)
print('min', min(vals_sorted))
print('max', max(vals_sorted))
print('median', statistics.median(vals_sorted))
PY`
10. `curl -s "https://miscsubjects.com/api/dispatch?ask=what+time+is+it" | wc -c`
11. `python3 - <<'PY'
registry_bytes=1608289
per_use_bytes=12332+811+0+0
print(per_use_bytes)
print(registry_bytes/per_use_bytes)
PY`
12. `python3 - <<'PY'
import math
registry_bytes=1608289
per_use_bytes=14011
print('break_even', math.floor(registry_bytes/per_use_bytes)+1)
PY`
13. `curl -s https://miscsubjects.com/api/proof`
14. `curl -s https://miscsubjects.com/api/proof | jq '.capabilities, .capability_definitions, .tools, .tool_definitions, .registry'`

MEASUREMENTS: 5
BREAK_EVEN: 115
DISAGREEMENTS_WITH_THE_PAGE: page says 891 capabilities; /api/proof says 892. page says 879; /api/proof says 892. registry payload says .count=877.
UNVERIFIED: invoke payload bytes. receipt payload bytes. tokenization measured with a real tokenizer.
