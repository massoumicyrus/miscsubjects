import { governanceManifest } from './_lib/oip_governance.js';
import { governanceHeader, governanceFooter, governanceChromeStyles } from './_lib/governance_chrome.js';

function esc(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export async function onRequestGet({ env }) {
  const manifest = await governanceManifest(env);

  const facetCards = manifest.facets.registry.map((facet) => `
    <article class="registry-card" id="${esc(facet.id)}">
      <div class="registry-key">${esc(facet.id)}</div>
      <h3 class="registry-title">${esc(facet.title)}</h3>
      <p class="registry-sum">${esc(facet.benefit)}</p>
      <details class="insp-panel" style="margin-top:var(--space-2)">
        <summary><span class="insp-k">Obligations</span></summary>
        <div class="insp-body"><ul>${facet.obligations.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>
      </details>
      <details class="insp-panel" style="margin-top:var(--space-2)">
        <summary><span class="insp-k">Conformance profile</span></summary>
        <div class="insp-body"><ul>${facet.conformance_profile.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>
      </details>
      <details class="insp-panel" style="margin-top:var(--space-2)">
        <summary><span class="insp-k">Not required</span></summary>
        <div class="insp-body"><ul class="not-required">${facet.not_required.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>
      </details>
    </article>`).join('');

  const axioms = manifest.core.axioms.map((axiom) => `
    <article class="cap-card">
      <div class="cap-card-head"><span class="cap-card-key">${esc(axiom.id)}</span></div>
      <h3 class="cap-card-title">${esc(axiom.law)}</h3>
    </article>`).join('');

  const postSequence = manifest.post_subscription.sequence.map((step, index) => `
    <article class="cap-card">
      <div class="cap-card-head"><span class="cap-card-key">STEP ${index + 1}</span></div>
      <p class="cap-card-sum">${esc(step)}</p>
    </article>`).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Subscribe to OIP governance — one facet at a time</title>
  <meta name="description" content="Join the OIP interoperability standard without adopting unrelated facets. Observe, implement, verify, propose or govern.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="/assets/design-system.css">
  <style>
    ${governanceChromeStyles()}
    .gov-hero {
      display: grid;
      grid-template-columns: 1fr 1.618fr;
      gap: var(--space-5);
      align-items: center;
      padding: var(--space-6) 0 var(--space-5);
      border-bottom: 1px solid var(--line);
    }
    .gov-hero h1 { margin-bottom: var(--space-3); }
    .gov-hero .lede { font-size: var(--fs-lead); color: var(--ink-secondary); max-width: var(--measure-copy); margin: 0 0 var(--space-4); }
    .gov-thesis {
      border: 1px solid var(--line);
      background: var(--surface-1);
      border-radius: var(--radius);
      padding: var(--space-3);
      font-size: var(--fs-lead);
      color: var(--ink-primary);
      margin-bottom: var(--space-4);
    }
    .gov-stats {
      display: flex;
      gap: var(--space-4);
      flex-wrap: wrap;
    }
    .gov-stats .stat { display: flex; align-items: baseline; gap: 8px; }
    .gov-stats b {
      font-family: var(--font-display);
      font-size: 2.4rem;
      font-weight: 700;
      color: var(--ink-primary);
    }
    .gov-stats span { font: 600 11px var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-muted); }
    .boundary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
    .axiom-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-3); }
    .facet-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-3); }
    .registry-card .not-required { color: var(--ink-muted); }
    .registry-card .not-required li { margin-bottom: 6px; }
    .cta-band {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface-1);
      padding: var(--space-4);
    }
    .cta-band h2 { margin-bottom: var(--space-3); }
    .cta-band p { color: var(--ink-secondary); max-width: var(--measure-copy); margin: 0 0 var(--space-3); }
    .schema {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface-1);
      padding: var(--space-3);
      font: 13px/1.55 var(--font-mono);
      color: var(--ink-secondary);
      overflow-x: auto;
      white-space: pre;
    }
    .footer-hash {
      border-top: 1px solid var(--line);
      padding: var(--space-3) 0 var(--space-5);
      font: 500 11px var(--font-mono);
      color: var(--ink-muted);
      text-align: center;
    }
    .footer-hash a { color: var(--ink-secondary); text-decoration: none; }
    .footer-hash a:hover { color: var(--ink-primary); text-decoration: underline; }
    @media (max-width: 900px) {
      .gov-hero, .boundary-grid { grid-template-columns: 1fr; }
      .gov-hero { padding: var(--space-5) 0; }
    }
  </style>
</head>
<body>
  ${governanceHeader('governance')}
  <main class="wrap governance-shell">
    <header class="gov-hero">
      <div>
        <div class="hero-kicker"><span class="ds-rule"></span><span class="ds-kicker">OIP · AI governance protocol</span></div>
        <h1>Authority before action.<br><em>Evidence after.</em></h1>
        <p class="lede">A public protocol institute for bounded agent authority, tamper-evident execution receipts, clause-cited model decisions, repair lineage and independently inspectable governance.</p>
      </div>
      <div>
        <div class="gov-thesis">${esc(manifest.thesis)}</div>
        <div class="gov-stats">
          <div class="stat"><b>${manifest.counts.active_subscription_records_as_filed}</b><span>subscriptions as filed</span></div>
          <div class="stat"><b>${manifest.counts.open_requests}</b><span>open inquiries and proposals</span></div>
          <div class="stat"><b>${manifest.facets.registry.length}</b><span>independently selectable facets</span></div>
        </div>
      </div>
    </header>

    <section class="chapter">
      <div class="chapter-head">
        <h2>The kernel is <em>small on purpose.</em></h2>
        <span class="chapter-count">Core axioms</span>
      </div>
      <p class="lede" style="max-width:var(--measure-copy);color:var(--ink-secondary);margin:0 0 var(--space-4)">These are the only system-level obligations shared by every subscription. They make records interoperable; they do not force a philosophy, product, publication channel or hosting provider.</p>
      <div class="axiom-grid">${axioms}</div>
    </section>

    <section class="chapter">
      <div class="chapter-head">
        <h2>The receipt is <em>not the permission.</em></h2>
        <span class="chapter-count">Boundary model</span>
      </div>
      <p class="lede" style="max-width:var(--measure-copy);color:var(--ink-secondary);margin:0 0 var(--space-4)">Authentication credentials grant whatever the underlying service allows. Governance identifiers and receipts describe authority and record outcomes; they do not create powers. OIP is protective only when it participates in the authorization path before execution.</p>
      <div class="boundary-grid">
        <article class="ds-card">
          <span class="ds-kicker">Private execution capability</span>
          <h3>Enforced before the runner fires</h3>
          <ul style="color:var(--ink-secondary);padding-left:var(--space-3)">
            <li>named object or object set</li>
            <li>tenant and audience boundary</li>
            <li>risk ceiling, expiry and revocation</li>
            <li>use budget, fixed body and payload ceiling</li>
            <li>complete ancestor-chain validation</li>
          </ul>
        </article>
        <article class="ds-card">
          <span class="ds-kicker">Public governance evidence</span>
          <h3>Emitted after refusal or observation</h3>
          <ul style="color:var(--ink-secondary);padding-left:var(--space-3)">
            <li>contract, input and output fingerprints</li>
            <li>actor and recorded authority lineage</li>
            <li>material success, refusal or failure</li>
            <li>replay, objection and repair links</li>
            <li>no bearer credential as evidence</li>
          </ul>
        </article>
      </div>
      <div class="hero-ctas" style="margin-top:var(--space-4)">
        <a class="ds-btn" href="/governance/assurance">Read the assurance boundary</a>
        <a class="ds-btn ghost" href="/governance/integrate">Integrate with IAM + telemetry</a>
      </div>
    </section>

    <section class="chapter">
      <div class="chapter-head">
        <h2>An institute should <em>publish its limits.</em></h2>
        <span class="chapter-count">Live vs. not yet claimed</span>
      </div>
      <p class="lede" style="max-width:var(--measure-copy);color:var(--ink-secondary);margin:0 0 var(--space-4)">Hash integrity does not prove that a decision was correct, lawful or safe. A model review does not become independent merely because it came from another label. A regulator or insurer is not an adopter until it independently says so.</p>
      <div class="boundary-grid">
        <article class="ds-card">
          <span class="ds-kicker">Live</span>
          <h3>Operational protocol surfaces</h3>
          <p style="color:var(--ink-secondary)">Scoped capabilities, public receipts, repair lineage, governance filings, clause-cited decision records, review/surety records, revocable state cards and privacy-egress accountability objects.</p>
        </article>
        <article class="ds-card">
          <span class="ds-kicker">Not yet claimed</span>
          <h3>Institutional validation</h3>
          <p style="color:var(--ink-secondary)">Independent customers, regulator or insurer acceptance, standards-body recognition, external penetration testing, service commitments, mature SDK coverage and legal-compliance certification.</p>
        </article>
      </div>
      <div class="hero-ctas" style="margin-top:var(--space-4)">
        <a class="ds-btn" href="/a/oip-governance-ontology">Open 164 governance questions</a>
        <a class="ds-btn ghost" href="/a/oip-governance-question-ledger">Machine question ledger</a>
        <a class="ds-btn ghost" href="/a/oip-model-governance-and-privacy">Model governance literature</a>
      </div>
    </section>

    <section class="chapter">
      <div class="chapter-head">
        <h2>Fidelity in. <em>Reusable surety out.</em></h2>
        <span class="chapter-count">Post-subscription loop</span>
      </div>
      <p class="lede" style="max-width:var(--measure-copy);color:var(--ink-secondary);margin:0 0 var(--space-4)">${esc(manifest.post_subscription.definition)}</p>
      <div class="axiom-grid">${postSequence}</div>
      <div class="gov-thesis" style="margin-top:var(--space-4)">
        ${esc(manifest.post_subscription.economic_hypothesis)}<br><br>
        <b>Invariant:</b> ${esc(manifest.post_subscription.invariant)}
      </div>
    </section>

    <section class="chapter">
      <div class="chapter-head">
        <h2>Subscribe <em>by facet.</em></h2>
        <span class="chapter-count">${manifest.facets.registry.length} independently selectable facets</span>
      </div>
      <p class="lede" style="max-width:var(--measure-copy);color:var(--ink-secondary);margin:0 0 var(--space-4)">One facet is enough. Each card says what benefit travels with it, what must remain true for interoperability, and what it explicitly does not obligate.</p>
      <div class="facet-grid">${facetCards}</div>
    </section>

    <section class="chapter">
      <div class="cta-band">
        <h2>Participation should be cheaper than imitation.</h2>
        <p>Observe the governance, implement a facet, verify other nodes, file a feature request, or help govern one narrow surface. A subscription grants no execution authority and creates no obligation to unrelated facets.</p>
        <div class="hero-ctas">
          <a class="ds-btn" href="/governance/assurance">See what the system can prove</a>
          <a class="ds-btn ghost" href="/oip/ledger">Audit federation</a>
          <span class="machine-url" title="Machine registry — for models, not a page">Machine registry <code>/api/governance</code></span>
        </div>
      </div>
    </section>

    <section class="chapter">
      <div class="chapter-head">
        <h2>Fork from the pen. <em>Hash back into the commons.</em></h2>
        <span class="chapter-count">Federation boundary</span>
      </div>
      <p style="color:var(--ink-secondary);max-width:var(--measure-copy);margin:0 0 var(--space-3)">An independent node can submit its 64-character chain head and public verifier as an anchor record. The root receipt proves that head existed by the recorded time; it does not silently certify the fork’s correctness, compliance, custody or claims. Correctness travels separately through facet conformance evidence.</p>
      <p style="color:var(--ink-secondary);max-width:var(--measure-copy);margin:0">Canonical registry decisions also append: delisting, reinstatement and supersession never erase the original record, and any participant can link an appeal. The canonical registry governs its own badge; independent forks remain independent.</p>
    </section>

    <section class="chapter">
      <div class="chapter-head">
        <h2>Machine <em>submission</em></h2>
        <span class="chapter-count">Same schema for humans and models</span>
      </div>
      <p class="lede" style="max-width:var(--measure-copy);color:var(--ink-secondary);margin:0 0 var(--space-4)">Models may recommend or inquire; they may not claim their owner subscribed without owner authorization.</p>
      <pre class="schema">POST https://miscsubjects.com/api/governance
Content-Type: application/json

{
  "kind": "inquire",
  "actor_type": "model",
  "actor_label": "EXACT MODEL AND SURFACE",
  "authority": "model-recommendation",
  "mode": "observe",
  "facets": ["execution-receipts"],
  "accept_core": false,
  "message": "This owner would benefit from independently verifiable action receipts. What is the smallest conformance path?"
}</pre>
    </section>
  </main>

  <div class="wrap footer-hash">
    Core hash ${esc(manifest.core.hash)} · facet registry hash ${esc(manifest.facets.hash)} · <a href="/a/oip">Object Invocation Protocol</a>
  </div>
  ${governanceFooter()}
</body>
</html>`;

  return new Response(html, { headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self'; script-src 'none'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  } });
}
