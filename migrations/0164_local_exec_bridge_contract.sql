-- LOCAL_EXEC bridge contract: /exec expects {cmd,args[]}; LOCAL_EXEC is a whole shell line.
UPDATE directory
SET content = '# WHAT: Run a shell command on the owner Mac.
# WHEN_TO_USE: any file operation, git command, system check, or script execution.
# ARGS: $1 = the shell command (pipes, &&, redirects allowed).
# EX: [LOCAL_EXEC]ls -la ~/Desktop[/LOCAL_EXEC] [LOCAL_EXEC]git status[/LOCAL_EXEC]
{"cmd":"sh","args":["-lc","$1"]}'
WHERE key = 'LOCAL_EXEC';
