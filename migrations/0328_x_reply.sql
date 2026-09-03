-- X_REPLY: reply to a tweet as the account, using the existing X_POST OAuth1 credentials.
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,sensitive,enabled,planner_visible,planner_rank,created_at)
VALUES (
  'X_REPLY','fn','xReply','',
  '# WHAT: Post ONE reply to a specific tweet as the account (same OAuth1 creds as X_POST).
# WHEN_TO_USE: only when the owner directs a reply to a specific tweet, under the owner rules. Single-target; not autonomous mass-replying.
# ARGS: $1=in_reply_to tweet id or status URL | $2=reply text (<=280)
# RETURNS: {ok,id,url,in_reply_to,text}
# EX: X_REPLY 1899999999999999999|Sourced our take here: https://miscsubjects.com/a/...',
  '2026-07-24 00:00:00','x',1,1,1,63,'2026-07-24 00:00:00'
);
