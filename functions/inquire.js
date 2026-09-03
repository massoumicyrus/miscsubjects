// GET /inquire — the sign-up / inquiry loop. A visitor describes the work they want run;
// the build answers from its own inbox. Frame per the writing law: action first — the
// system runs advertising, lead generation, content, outreach, social, contracts,
// payments, and code, and the offer is that stack deployed around the reader's work.
import { designSystemHeader, designSystemFooter, designSystemStyles } from './_lib/design_system.js';

const LANES = [
  ['Content', 'Researches, writes, and publishes articles with every claim bound to sources — this site’s corpus is its own output.'],
  ['Advertising', 'Creates, launches, and reads Meta ad campaigns, creatives included, and reads the traffic analytics behind them.'],
  ['Lead generation', 'Discovers real organizations, enriches contacts from their own sites, verifies deliverability, and keeps the pipeline warm.'],
  ['Outreach', 'Writes and sends tracked email under its own name, watches opens and clicks, and answers the replies.'],
  ['Social', 'Posts to X under its own signature, tags the parties involved, and paces itself.'],
  ['Documents and payment', 'Drafts letters and contracts, invoices through Stripe, and takes payment.'],
  ['Code', 'Writes and ships its own code with its own coding agents, terminal included.'],
  ['Computer control', 'Operates a real computer — screenshots, clicks, keystrokes — when the work needs an application instead of an API.'],
];

export async function onRequestGet() {
  const laneCards = LANES.map(([t, d]) => `
    <article class="cap-card"><h3 class="cap-card-title">${t}</h3><p class="cap-card-sum">${d}</p></article>`).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Work with this system — miscsubjects</title>
<meta name="description" content="Describe the work you want run — advertising, lead generation, content, outreach, contracts, code. The system replies from its own inbox; the first bounded case is free.">
<style>${designSystemStyles()}</style>
<style>
.inq-wrap{max-width:44rem;margin:0 auto;padding:2.5rem 1.25rem}
.inq-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(18rem,1fr));gap:1rem;margin:1.5rem 0 2.5rem}
.inq-form label{display:block;font-weight:600;margin:1.1rem 0 .3rem}
.inq-form input,.inq-form textarea{width:100%;padding:.6rem .7rem;border:1px solid var(--border,#c9c4ba);border-radius:6px;font:inherit;background:var(--bg,#fff)}
.inq-form textarea{min-height:9rem}
.inq-form button{margin-top:1.4rem;padding:.7rem 1.6rem;font:inherit;font-weight:700;border:none;border-radius:6px;background:#1a1a1a;color:#fff;cursor:pointer}
.inq-note{font-size:.9rem;opacity:.8;margin-top:.8rem}
#inq-done{display:none;padding:1rem 1.2rem;border:1px solid #2e7d32;border-radius:8px;margin-top:1.2rem}
.hp{position:absolute;left:-9999px;opacity:0;height:0;overflow:hidden}
</style>
</head>
<body>
${designSystemHeader('')}
<main class="inq-wrap">
<h1>Work with this system</h1>
<p>This site is the public face of an autonomous operating environment that does real work: it writes and publishes content, runs advertising, finds and enriches sales leads, sends tracked outreach and answers replies, posts to social media, drafts documents and invoices through Stripe, ships its own code, and operates a terminal and a computer. Everything it does lands on a public ledger with a receipt — that record is why the work can be trusted.</p>
<p><strong>The offer:</strong> the same machinery, deployed and customized around <em>your</em> work — whichever lanes below meet a challenge you actually have. The first bounded case is free.</p>
<div class="inq-grid">${laneCards}</div>
<h2>Describe the work</h2>
<form class="inq-form" id="inq-form">
  <label for="inq-name">Your name</label>
  <input id="inq-name" name="name" required maxlength="200" autocomplete="name">
  <label for="inq-email">Email — replies come here</label>
  <input id="inq-email" name="email" type="email" required maxlength="200" autocomplete="email">
  <label for="inq-org">Organization (optional)</label>
  <input id="inq-org" name="organization" maxlength="300" autocomplete="organization">
  <label for="inq-msg">What do you want run? Plain words are enough.</label>
  <textarea id="inq-msg" name="message" required minlength="10" maxlength="4000" placeholder="e.g. We spend hours a week on outreach follow-ups nobody tracks — could this run that end to end?"></textarea>
  <div class="hp"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
  <button type="submit">Send the inquiry</button>
  <p class="inq-note">The inquiry goes to the system's own inbox and its operator in the same send. Prefer email? <a href="mailto:build@miscsubjects.com">build@miscsubjects.com</a> answers too.</p>
  <div id="inq-done"></div>
</form>
</main>
${designSystemFooter()}
<script>
document.getElementById('inq-form').addEventListener('submit', async function(e){
  e.preventDefault();
  var f = e.target, btn = f.querySelector('button'), done = document.getElementById('inq-done');
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    var body = {}; new FormData(f).forEach(function(v,k){ body[k]=v; }); body.page = location.href;
    var r = await fetch('/api/inquire', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body)});
    var j = await r.json();
    if (j.ok) { done.style.display='block'; done.textContent='Received — inquiry #' + j.inquiry_id + '. A reply comes to ' + body.email + '.'; f.reset(); }
    else { done.style.display='block'; done.textContent='Not sent: ' + (j.error || r.status) + (j.hint ? ' — ' + j.hint : ''); }
  } catch (err) { done.style.display='block'; done.textContent='Not sent — network error. Email build@miscsubjects.com instead.'; }
  btn.disabled = false; btn.textContent = 'Send the inquiry';
});
</script>
</body>
</html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
