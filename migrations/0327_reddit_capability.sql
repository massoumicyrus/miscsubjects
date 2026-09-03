-- Reddit Data API capability: read threads/comments + reply as the owner's account.
-- Runners live in functions/_lib/fn_runners.js (redditSearch/redditThread/redditReply).
-- Activation needs Worker secrets: REDDIT_CLIENT_ID, REDDIT_SECRET (both reads+reply),
-- REDDIT_USERNAME, REDDIT_PASSWORD (reply only). Account already registered for the Data API.

INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,sensitive,enabled,planner_visible,planner_rank,created_at)
VALUES (
  'REDDIT_SEARCH','fn','redditSearch','',
  '# WHAT: Search Reddit for real threads on a topic and return them ready to file as reddit-type sources (native widget).
# WHEN_TO_USE: gathering real Reddit discussion as evidence/sources for an article.
# ARGS: $1=query | $2=subreddit(optional, e.g. Retatrutide) | $3=sort(top|relevance|new) | $4=t(year|month|all)
# RETURNS: {ok,count,sources:[{type:reddit,id,subreddit,author,title,quote,url,stats:{votes,comments},flair}]}
# EX: REDDIT_SEARCH retatrutide|Retatrutide|top|year',
  '2026-07-24 00:00:00','reddit',0,1,1,60,'2026-07-24 00:00:00'
);

INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,sensitive,enabled,planner_visible,planner_rank,created_at)
VALUES (
  'REDDIT_THREAD','fn','redditThread','',
  '# WHAT: Fetch one Reddit thread plus its top comments as reddit-type sources.
# WHEN_TO_USE: citing a specific thread and its comment replies.
# ARGS: $1=thread url or id (t3_... or the /comments/ id) | $2=max_comments(1-25, default 8)
# RETURNS: {ok,post:{...},comments:[{type:reddit,id:t1_...,author,quote,url,stats}]}
# EX: REDDIT_THREAD https://www.reddit.com/r/Retatrutide/comments/xxxx|8',
  '2026-07-24 00:00:00','reddit',0,1,1,61,'2026-07-24 00:00:00'
);

INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,sensitive,enabled,planner_visible,planner_rank,created_at)
VALUES (
  'REDDIT_REPLY','fn','redditReply','',
  '# WHAT: Post ONE comment reply to a specific Reddit thing (thread or comment) AS the owner account.
# WHEN_TO_USE: only when the owner directs a reply to a specific target, under the owner rules. Single-target by design; not for autonomous mass-replying (protects the labeled account from bans).
# ARGS: $1=parent thing id (t3_<post> or t1_<comment>) | $2=reply text
# AUTH: owner-gated (sensitive). Needs REDDIT_USERNAME/REDDIT_PASSWORD + client creds.
# RETURNS: {ok,id,url,body}
# EX: REDDIT_REPLY t3_abc123|Great write-up — sourced our take here.',
  '2026-07-24 00:00:00','reddit',1,1,1,62,'2026-07-24 00:00:00'
);
