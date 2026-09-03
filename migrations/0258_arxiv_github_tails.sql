INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at) VALUES
('ARXIV_PAPER', 'fn', 'arxivState', '',
'# WHAT: The arXiv paper as a live object. The paper "The Document Is the Receipt" lives at github.com/[OWNER_HANDLE]/oip (private) and is written only by ARXIV_GROW. Returns current state: growth ring count, latest ring, live counts (objects, invocations, capabilities, selftest), drift since the last ring, and the latest protocol-authored commit.
# WHEN_TO_USE: the owner asks "paper state", "how big is the paper", "when did the paper last grow", "show the arxiv object", "has the paper drifted".
# ARGS: none.
# EX: [ARXIV_PAPER][/ARXIV_PAPER]
[]', 'oip', 20, 1, 1, datetime('now')),
('ARXIV_GROW', 'fn', 'arxivGrow', '',
'# WHAT: Regenerate the arXiv paper from live state. Reads paper/template.tex + paper/rings.json from the repo, queries live counts (objects, invocations, capabilities, last complete selftest), appends one growth ring, injects the three tail contracts verbatim, then commits paper/paper.tex + paper/rings.json + README.md + oip.json — each commit message carries this trace id. CI compiles the PDF on the paper.tex push. This fn is the only writer of the generated files.
# WHEN_TO_USE: the owner says "grow the paper", "regenerate the arxiv", "add a ring", "refresh the paper". Also fired daily by launchd com.owner.oip.arxiv-grow on the Mac.
# ARGS: none.
# EX: [ARXIV_GROW][/ARXIV_GROW]
[]', 'oip', 20, 1, 1, datetime('now')),
('GITHUB_TAIL', 'fn', 'githubTail', '',
'# WHAT: The GitHub repository as a live object. Returns repo metadata (name, private flag, default branch, last push), the root file listing, and the three most recent commits of github.com/[OWNER_HANDLE]/oip. Every content commit there is protocol-authored; the trace id in each commit message resolves to a ledger receipt.
# WHEN_TO_USE: the owner asks "show the repo", "github tail", "what is in the oip repo", "last repo commit", "is the repo still private".
# ARGS: none.
# EX: [GITHUB_TAIL][/GITHUB_TAIL]
[]', 'oip', 20, 1, 1, datetime('now'));
