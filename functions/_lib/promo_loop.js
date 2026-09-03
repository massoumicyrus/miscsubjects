// Self-promotion loop runners — the build promoting the build.
// Documented publicly at /a/outreach-machinery; governed by the self-promotion skill.
// Three runners, merged into FN_MAP at the dispatch seam:
//   promoClasses     — read the audience-class table (the starting logic, as data).
//   outreachAllocate — the delta equation. Computes priority and volume per class from
//                      recorded inputs, returns the full arithmetic, sends NOTHING.
//                      The dispatch invocation itself is the ledger object.
//   leadsDiscoverOrg — organization discovery for a promo class via live web search,
//                      writing the same leads columns the four existing scrapers write.
// The peptide loop's rows and gates are untouched; these are additive.

import { normalizeDiscoveredCandidates } from './execution_case.js';

const POLICY_VERSION = 'self-promotion-allocation@1.0.0';

// Policy constants — server-owned. A caller may lower the caps, never raise them.
const POLICY = {
  version: POLICY_VERSION,
  channel: 'email', // cold first contact is email only (skill SP03)
  cap_per_day: 10, // small enough that every send is individually reviewable
  cap_per_class_per_day: 4,
  saturation_window_days: 7,
  novelty_norm: 5, // this many new relevant artifacts saturate the novelty term at 1
  prior_default: 0.05, // declared constant, NOT a measured response rate
};

export function makePromoFnMap({ buildNowIso, xaiSearch, pipeJson, enrichLead, enrichBatchBase }) {
  return {
    // Task-scoped front for LEADS_ENRICH_BATCH. $1=count (cap 8), $2=optional work task
    // (e.g. WT-0090). Without a task it delegates to the ambient batch runner unchanged.
    // With one, the claim is scoped to leads bound to that task's included execution-case
    // candidates, so ambient leads can never satisfy a task-bound acceptance count — and
    // candidates whose lead the crawler already resolved sync from the lead row first,
    // because the 0361 triggers only fire on future lead updates. Lives here, not in
    // fn_runners.js: that file is owner-protected, so the task lane extends it by
    // injection instead of edit.
    async leadsEnrichBatchTask(env, countArg, taskArg) {
      const taskId = String(taskArg || '').trim();
      if (!taskId) return enrichBatchBase(env, countArg);
      if (!/^WT-\d{4}$/.test(taskId)) return JSON.stringify({ error: 'task id must look like WT-0090' });
      const n = Math.min(8, Math.max(1, parseInt(countArg || '6', 10) || 6));
      await env.DB.prepare("UPDATE leads SET status='new', enrich_claimed_at=NULL WHERE status='enriching' AND enrich_claimed_at < datetime('now','-15 minutes')").run();
      await env.DB.prepare(
        "UPDATE execution_case_candidates SET contact_status='verified_public', contact_email=(SELECT lower(trim(email)) FROM leads WHERE leads.id=lead_id), contact_source_url=COALESCE(contact_source_url,(SELECT website FROM leads WHERE leads.id=lead_id)), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE task_id=? AND decision='included' AND contact_status='pending' AND lead_id IN (SELECT id FROM leads WHERE email IS NOT NULL AND trim(email)<>'')"
      ).bind(taskId).run();
      await env.DB.prepare(
        "UPDATE execution_case_candidates SET contact_status=(SELECT status FROM leads WHERE leads.id=lead_id), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE task_id=? AND decision='included' AND contact_status='pending' AND lead_id IN (SELECT id FROM leads WHERE status IN ('no_email','no_site'))"
      ).bind(taskId).run();
      const rows = (await env.DB.prepare(
        "UPDATE leads SET status='enriching', enrich_claimed_at=datetime('now') WHERE id IN (SELECT l.id FROM leads l JOIN execution_case_candidates c ON c.lead_id=l.id WHERE c.task_id=? AND c.decision='included' AND c.contact_status='pending' AND l.status='new' AND l.website IS NOT NULL GROUP BY l.id ORDER BY MAX(l.score) DESC, l.id DESC LIMIT ?) RETURNING id"
      ).bind(taskId, n).all()).results || [];
      const done = await Promise.all(rows.map(async (r) => {
        try { const res = JSON.parse(await enrichLead(env, r.id)); return { id: r.id, email: res.email || null, status: res.status }; }
        catch (e) {
          await env.DB.prepare("UPDATE leads SET status='new', enrich_claimed_at=NULL WHERE id=? AND status='enriching'").bind(r.id).run();
          return { id: r.id, error: String(e && e.message || e) };
        }
      }));
      const taskCounts = (await env.DB.prepare(
        "SELECT contact_status, COUNT(*) n FROM execution_case_candidates WHERE task_id=? AND decision='included' GROUP BY contact_status"
      ).bind(taskId).all()).results || [];
      const resolvedCount = done.filter((d) => d.email).length;
      return JSON.stringify({ enriched_this_call: done.length, task_id: taskId, results: done, task_contact_status: taskCounts,
        units: resolvedCount, meter_unit: 'contact resolved', cost_usd: 0,
        cost_basis: 'direct site fetches — no metered third party',
        object_ids: done.filter((d) => d.email).map((d) => 'lead:' + d.id),
        read_object_ids: rows.map((r) => 'lead:' + r.id) });
    },
    // List the audience classes — the starting logic, readable as data. $1 optional key.
    async promoClasses(env, keyArg) {
      const key = String(keyArg || '').trim();
      const rows = key
        ? (await env.DB.prepare('SELECT * FROM promo_classes WHERE key=?').bind(key).all()).results || []
        : (await env.DB.prepare('SELECT * FROM promo_classes ORDER BY fit DESC').all()).results || [];
      return JSON.stringify({ policy: POLICY_VERSION, count: rows.length, classes: rows });
    },

    // The delta equation. $1 = daily cap override (may only LOWER the policy cap).
    // priority(c) = fit · novelty · permission · (1 − saturation) · prior
    // volume(c)   = clamp(round(cap · priority/Σpriority), 0, cap_class)
    // Computes and records. Sends nothing, drafts nothing, selects record ids only.
    async outreachAllocate(env, capArg) {
      const now = buildNowIso();
      const cap = Math.min(POLICY.cap_per_day, Math.max(0, parseInt(capArg || String(POLICY.cap_per_day), 10) || POLICY.cap_per_day));
      const classes = (await env.DB.prepare('SELECT * FROM promo_classes ORDER BY key').all()).results || [];
      if (!classes.length) return JSON.stringify({ policy: POLICY_VERSION, error: 'no promo_classes rows — derive the audience classes first' });

      const windowStart = new Date(Date.now() - POLICY.saturation_window_days * 864e5).toISOString();
      const terms = [];
      for (const c of classes) {
        // fit: the class score, 0-1.
        const fit = Math.min(100, Math.max(0, Number(c.fit) || 0)) / 100;

        // novelty: published artifacts newer than this class's last contact, normalized.
        // Never contacted → everything is new → 1. Zero new relevant material → 0 → no contact.
        let novelty;
        if (!c.last_contact_ts) {
          novelty = 1;
        } else {
          const n = await env.DB.prepare(
            "SELECT COUNT(*) n FROM articles WHERE published=1 AND updated_at > ?"
          ).bind(c.last_contact_ts).first();
          novelty = Math.min(1, (n ? n.n : 0) / POLICY.novelty_norm);
        }

        // permission: email to published organizational addresses. A gate: 0 or 1.
        const permission = POLICY.channel === 'email' ? 1 : 0;

        // saturation: sends to this class's leads in the trailing window, over the window's budget.
        const sat = await env.DB.prepare(
          "SELECT COUNT(*) n FROM email_sends es JOIN leads l ON l.id = es.lead_id WHERE l.segment = ? AND es.kind = 'outreach' AND es.sent_at > ?"
        ).bind(c.key, windowStart).first();
        const satBudget = POLICY.cap_per_class_per_day * POLICY.saturation_window_days;
        const saturation = Math.min(1, (sat ? sat.n : 0) / satBudget);

        // prior: declared constant until real events move it (replies, opt-outs, complaints, verdicts).
        const prior = Number(c.prior) || POLICY.prior_default;

        const priority = fit * novelty * permission * (1 - saturation) * prior;
        terms.push({ key: c.key, name: c.name, fit, novelty, permission, saturation, prior, priority, artifact: c.artifact, thesis: c.thesis });
      }

      const sum = terms.reduce((a, t) => a + t.priority, 0);
      const allocation = [];
      for (const t of terms) {
        const volume = sum > 0 ? Math.min(POLICY.cap_per_class_per_day, Math.max(0, Math.round(cap * t.priority / sum))) : 0;
        // The selected records: this class's drafted-or-enriched leads, best fit first, up to volume.
        // Selection only — nothing is drafted or sent by this runner.
        const rows = volume > 0
          ? (await env.DB.prepare(
              "SELECT id FROM leads WHERE segment = ? AND status IN ('enriched','drafted') AND email IS NOT NULL ORDER BY score DESC, id LIMIT ?"
            ).bind(t.key, volume).all()).results || []
          : [];
        allocation.push({ ...t, volume, selected_lead_ids: rows.map((r) => r.id) });
      }

      return JSON.stringify({
        policy: POLICY_VERSION,
        computed_at: now,
        channel: POLICY.channel,
        cap_requested: cap,
        cap_policy: POLICY.cap_per_day,
        saturation_window_days: POLICY.saturation_window_days,
        terms_equation: 'priority = fit · novelty · permission · (1 − saturation) · prior; volume = clamp(round(cap · priority/Σpriority), 0, ' + POLICY.cap_per_class_per_day + ')',
        allocation,
        total_volume: allocation.reduce((a, x) => a + x.volume, 0),
        sends_performed: 0,
        note: 'Allocation only. Drafting stays behind LEADS_DRAFT_AI gates; sending stays behind LEADS_SEND CONFIRM.',
      });
    },

    // Organization discovery for a promo class. $1=class key, $2=free-text query, $3=count (cap 20),
    // $4=optional work task. When a task is supplied, every model return becomes an execution-case
    // decision row — including malformed and rejected returns. Nothing disappears into a skip count.
    // Live web search for real organizations with verifiable official sites; same leads columns,
    // segment = class key, source = 'org-research'. Contact emails are NEVER guessed here —
    // LEADS_ENRICH finds them on the organization's own site or the row ends no_email.
    async leadsDiscoverOrg(env, classKey, query, countArg, taskIdArg) {
      const seg = String(classKey || '').trim();
      const q = String(query || '').trim();
      const taskId = String(taskIdArg || '').trim();
      if (!seg || !q) return JSON.stringify({ error: 'class key and query required, e.g. leadsDiscoverOrg ai-assurance|AI audit and assurance firms|12' });
      if (taskId && !/^WT-\d{4}$/.test(taskId)) return JSON.stringify({ error: 'task id must look like WT-0090' });
      const cls = await env.DB.prepare('SELECT key FROM promo_classes WHERE key=?').bind(seg).first();
      if (!cls) return JSON.stringify({ error: 'unknown promo class: ' + seg + ' — add it to promo_classes first' });
      if (taskId) {
        const task = await env.DB.prepare('SELECT id,state FROM work_tasks WHERE id=?').bind(taskId).first();
        if (!task) return JSON.stringify({ error: 'work task not found: ' + taskId });
        if (!['leased', 'in_progress'].includes(String(task.state))) return JSON.stringify({ error: 'work task is not active: ' + taskId, state: task.state });
      }
      const n = Math.min(20, Math.max(3, parseInt(countArg || '12', 10) || 12));
      const g = await xaiSearch(env,
        'You are an organization researcher. You output ONLY a strict JSON array, no prose, no markdown fence.',
        'Find ' + n + ' real, currently-operating organizations matching: ' + q + '. ' +
        'Return every candidate you evaluated, including rejected candidates, so exclusions are inspectable. ' +
        'For each return its exact name, official website (its own domain — never LinkedIn/Crunchbase/Wikipedia), headquarters city, ' +
        'the official page URL that supports qualification, a verbatim quote of at least 40 characters from that page, and one concrete qualification reason. ' +
        'If a field cannot be verified, return null rather than inventing it. ' +
        'Output ONLY: [{"name":"...","website":"https://...","city":"...","source_url":"https://...","source_quote":"verbatim words","qualification_reason":"why it matches the query"}]',
        3000);
      if (g.err) return JSON.stringify({ error: 'live search failed: ' + g.err });
      let arr = pipeJson(g.text);
      if (!Array.isArray(arr)) { const mm = String(g.text).match(/\[[\s\S]*\]/); if (mm) { try { arr = JSON.parse(mm[0]); } catch {} } }
      if (!Array.isArray(arr)) return JSON.stringify({ error: 'model did not return a JSON array', raw: String(g.text).slice(0, 200) });
      const decisions = taskId
        ? await normalizeDiscoveredCandidates({ taskId, query: q, returned: arr, now: buildNowIso() })
        : null;
      let inserted = 0, skipped = 0, included = 0, excluded = 0;
      const ids = [];
      const candidateIds = [];
      for (let index = 0; index < arr.length; index++) {
        const b = arr[index];
        const decision = decisions && decisions[index];
        const name = String(decision?.organization_name || b && b.name || '').trim();
        let site = String(decision?.official_url || b && b.website || '').trim();
        const city = String(b && b.city || 'global').trim() || 'global';
        let leadId = null;
        if (!decision || decision.decision === 'included') {
          if (!name || !/^https?:\/\/|^www\./i.test(site) || /linkedin\.|crunchbase\.|wikipedia\./i.test(site)) {
            skipped++;
          } else {
            if (!/^https?:/i.test(site)) site = 'https://' + site;
            try {
              const res = await env.DB.prepare(
                "INSERT INTO leads (created_at,name,segment,city,website,context,source,status,score) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(name,city) DO NOTHING RETURNING id"
              ).bind(buildNowIso(), name, seg, city, site, 'promo-class:' + seg, 'org-research', 'new', 2).all();
              const newId = res.results && res.results[0] && res.results[0].id;
              if (newId) { inserted++; leadId = newId; ids.push(newId); }
              else {
                const existing = await env.DB.prepare('SELECT id FROM leads WHERE name=? AND city=?').bind(name, city).first();
                leadId = existing?.id || null;
                skipped++;
              }
            } catch { skipped++; }
          }
        }
        if (decision) {
          decision.lead_id = leadId;
          included += decision.decision === 'included' ? 1 : 0;
          excluded += decision.decision === 'excluded' ? 1 : 0;
          candidateIds.push(decision.candidate_id);
          await env.DB.prepare(
            `INSERT INTO execution_case_candidates
             (candidate_id,task_id,invocation_id,query_text,query_sha256,organization_name,official_url,source_url,source_quote,
              skill_name,skill_version,skill_hash,decision,decision_reason,lead_id,contact_status,contact_email,contact_email_sha256,
              contact_source_url,created_at,updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
             ON CONFLICT(candidate_id) DO UPDATE SET
               decision=excluded.decision, decision_reason=excluded.decision_reason,
               lead_id=COALESCE(excluded.lead_id,execution_case_candidates.lead_id), updated_at=excluded.updated_at`
          ).bind(
            decision.candidate_id, decision.task_id, decision.invocation_id, decision.query_text, decision.query_sha256,
            decision.organization_name, decision.official_url, decision.source_url, decision.source_quote,
            decision.skill_name, decision.skill_version, decision.skill_hash, decision.decision, decision.decision_reason,
            decision.lead_id, decision.contact_status, decision.contact_email, decision.contact_email_sha256,
            decision.contact_source_url, decision.created_at, decision.updated_at,
          ).run();
        }
      }
      return JSON.stringify({ class: seg, task_id: taskId || null, query: q, model_returned: arr.length, included, excluded, inserted_new: inserted, skipped_dup_or_bad: skipped, lead_ids: ids, candidate_ids: candidateIds, source: 'org-research', cost_usd: 0, note: 'every task-bound return has an inclusion or exclusion row; emails are found only by LEADS_ENRICH on each organization’s own site' });
    },
  };
}
