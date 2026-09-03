// Points the WRITER agent (grok-4.3, its stored directory prompt) at every brief in
// the LOOP LABS content map, then publishes each result live via POST /api/articles.
// Run: node scripts/write_all_articles.mjs
// Re-run safe: upsert by slug. Concurrency-limited so Grok isn't hammered.

const BASE = 'https://miscsubjects.com';
const CONCURRENCY = 6;

const BRIEFS = [
  ['BPC-157 for GLP-1 gut damage', 'Audience: 25M+ on Ozempic/Mounjaro/Wegovy. GLP-1 drugs slow gastric emptying and suppress appetite; the lining gets damaged from prolonged exposure to gastric acid that is not moved through normally, causing nausea, vomiting, gastroparesis, erosion of the gut wall — the #1 reported side effect. BPC-157 is derived from a protein in gastric juice; in rat studies it repaired gut lining damage and reduced gut inflammation by over 50% and builds new blood vessels into damaged gut tissue. The gut is where BPC-157 was discovered and most researched.'],
  ['TB-500 for GLP-1 muscle loss', 'Audience: 25M+ on GLP-1 drugs. GLP-1 weight loss does not distinguish fat from muscle; patients lose significant lean muscle alongside fat — joint instability, metabolic slowdown, weakness. TB-500 moves repair cells to muscle tissue faster; in wound studies tissue healed 30-50% faster. Mechanism is cell migration to muscle tissue being starved by appetite suppression. TB-500 maintains and repairs muscle tissue, it does not build muscle like a steroid.'],
  ['Wolverine Stack for GLP-1 full support', 'Audience: 25M+ on GLP-1 drugs. GLP-1 causes gut damage AND muscle loss simultaneously. BPC-157 builds blood vessels into the damaged gut lining, repairs the wall, reduces inflammation. TB-500 moves repair cells to muscle tissue and maintains integrity during stress. One stack, two mechanisms, zero overlap.'],
  ['BPC-157 for NSAIDs', 'Audience: 30M+ daily NSAID users in the US. NSAIDs block COX enzymes that also protect the gut lining and support blood flow to injured tissue, so they reduce pain but damage the gut with every dose and slow healing of the injury. BPC-157 does the opposite: builds new blood vessels into injured tissue and repairs gut lining; in rat studies it specifically reversed NSAID-caused gut damage. Framing: repair vs suppression.'],
  ['BPC-157 for PPI users', 'Audience: 15M on proton pump inhibitors (Prilosec, Nexium). PPIs suppress stomach acid for reflux/GERD/ulcers; designed for 2-8 weeks but taken for years — linked to nutrient malabsorption (magnesium, calcium, B12), bone fracture risk, kidney problems, microbiome disruption; underlying gut damage is never healed. BPC-157 is studied for healing the gut lining itself; in rat studies it healed gastric ulcers faster than standard treatment. Root cause vs symptom.'],
  ['BPC-157 for Adderall gut damage', 'Audience: 16M on Adderall/stimulants in the US. Adderall suppresses appetite; stomach acid sits in an empty stomach and erodes the lining, microbiome disrupts — reflux, nausea, GI issues. BPC-157 repairs gut lining and reduces gut inflammation; derived from gastric juice, from the system being damaged.'],
  ['BPC-157 for post-surgery recovery', 'Audience: 50M+ surgeries per year in the US. Surgery fixes the structural problem but the site loses blood flow; a dead zone forms scar tissue that adheres to tendons and nerves — stiffness, restricted range of motion, pain months later. BPC-157 builds new blood vessels into damaged tissue, restoring blood flow and oxygen before scar tissue locks everything down; in rat studies it accelerated tendon healing by 70% with stronger collagen repair.'],
  ['BPC-157 for corticosteroid injection damage', 'Audience: 2M epidural steroid injections per year in the US. Corticosteroid injections reduce inflammation at the site but repeated injections are linked to accelerated cartilage breakdown, tendon weakening, disc degeneration. BPC-157 is studied for tissue repair — tendons, bone, cartilage; in rat studies regrew bone denser than normal and healed tendons stronger than controls. Mechanism opposes the structural degeneration steroid injections cause.'],
  ['BPC-157 for general gut health', 'Audience: 60M+ Americans with GI issues — reflux, IBS, leaky gut, bloating, chronic gut inflammation. Most treatment is symptom management; the lining rarely gets addressed. BPC-157 was first found in gastric juice; most studied application is gut lining repair; in rat studies repaired gut wall damage and cut inflammation by 50%+.'],
  ['BPC-157 for IBD/Crohns/colitis', 'Audience: 3M diagnosed in the US. In IBD the immune system attacks the gut lining — chronic inflammation; current treatments are immunosuppressants and biologics that suppress system-wide but do not repair the lining. BPC-157 repairs gut lining and reduces gut inflammation without suppressing the immune system; in rat gut studies inflammation markers dropped 50%+.'],
  ['BPC-157 for benzo withdrawal gut support', 'Audience: 12M on benzodiazepines in the US. Benzo withdrawal causes severe GI disruption — nausea, cramping, inability to eat, motility problems; GABA receptors throughout the gut mean withdrawal strips the calming signal, causing spasm and inflammation. BPC-157 repairs gut lining, reduces gut inflammation, showed protective GI effects in rat studies. Supports the gut tissue damaged during withdrawal; does not treat withdrawal directly.'],
  ['ARA-290 for herniated discs', 'Audience: 5.7M Americans with herniated discs. A disc herniates, the interior pushes out and compresses a nearby nerve — pain, numbness, weakness radiating down a limb. Standard care (PT, steroid injections, surgery) does not repair the compressed nerve. ARA-290 is studied specifically for nerve repair and has human clinical trial data; after structural compression is addressed, ARA-290 is studied for repairing the remaining nerve damage.'],
  ['ARA-290 for sciatica', 'Audience: 40% of Americans experience sciatica at some point. Same mechanism as herniated disc — a nerve compressed in the lower back, pain shooting down the leg; different search term and audience. ARA-290 is studied for nerve repair.'],
  ['ARA-290 for diabetic neuropathy', 'Audience: 10M diabetics with nerve damage in the US. High blood sugar damages small blood vessels feeding nerves; nerves in hands and feet die slowly — tingling, numbness, burning, loss of sensation. Current treatment (gabapentin, pregabalin, duloxetine) masks symptoms. ARA-290 has human clinical trial data specifically for diabetic neuropathy — studied for regrowing damaged nerve fibers and restoring sensation. The strongest clinical backing of any peptide here for a specific condition.'],
  ['ARA-290 for gabapentin/Lyrica users', 'Audience: 15M on gabapentin in the US. Gabapentin and pregabalin dampen nerve signaling to reduce the pain signal; they do not repair the nerve, and carry side effects — dizziness, weight gain, cognitive fog, dependency. ARA-290 is studied for repairing the nerve itself so the damage signal stops at the source. Repair vs mask.'],
  ['ARA-290 for carpal tunnel', 'Audience: 8M Americans with carpal tunnel syndrome. The median nerve is compressed in the wrist — numbness, tingling, weakness; splints, steroid injections, or surgery relieve compression but nerve damage can persist. ARA-290 is studied for nerve regrowth and function restoration, post-surgery or standalone.'],
  ['ARA-290 for post-surgical nerve damage', 'Audience: millions of post-surgical patients with residual numbness. Nerves get cut, compressed, or damaged during surgery — numbness, tingling, loss of sensation; there is no standard treatment, patients are told to wait. ARA-290 is studied for nerve regrowth; in human trials for diabetic neuropathy it showed nerve fiber restoration; the same mechanism applies to surgically damaged nerves.'],
  ['BPC + ARA for herniated discs', 'Audience: 5.7M. Herniated disc compresses a nerve; the disc tissue is damaged and the nerve is damaged — two problems. BPC-157 repairs the tissue around the disc (blood vessels, reduces the dead zone, structural damage); ARA-290 repairs the compressed nerve. One fixes the structure, the other the nerve.'],
  ['BPC + ARA for post-surgical nerve damage', 'Audience: millions. Surgery heals the structural issue but damages a nerve; the site needs tissue repair and the nerve needs regrowth. BPC-157 heals the surgical site (blood vessels, prevents scar adhesion); ARA-290 regrows the damaged nerve.'],
  ['BPC + ARA for corticosteroid damage', 'Audience: 2M per year. Repeated steroid injections degrade disc tissue and nearby nerves get compressed by the degeneration. BPC-157 repairs the degenerating disc tissue; ARA-290 repairs the nerve being compressed by it.'],
  ['BPC + KPV for gut repair', 'Audience: 60M+ with GI issues. Gut lining damage plus gut-specific inflammation — two layers. BPC-157 rebuilds the gut wall (new blood vessels, structural repair); KPV calms gut-specific inflammation without suppressing the whole immune system.'],
  ['BPC + KPV for IBD/Crohns/colitis', 'Audience: 3M diagnosed. Gut wall damage plus gut inflammation in a diagnosed condition. BPC-157 rebuilds the gut wall; KPV calms gut-specific inflammation without system-wide immune suppression.'],
  ['BPC + KPV for PPI users', 'Audience: 15M. PPIs suppress acid forever and the gut never heals. BPC-157 heals the gut wall; KPV calms gut inflammation; together they address the root cause so the PPI can eventually be unnecessary.'],
  ['Recovery Stack (BPC + TB + ARA) general intro', 'Audience: broad — complex injuries involving tissue damage, inflammation, and nerve involvement. Most injuries involve more than one type of damage. BPC-157 builds blood vessels and repairs tissue structure; TB-500 clears inflammation and moves repair cells faster; ARA-290 regrows nerves. Three bottlenecks removed simultaneously.'],
  ['Recovery Stack for herniated discs', 'Audience: 5.7M. Disc tissue damage, inflammation blocking repair, and nerve compression. BPC-157 repairs tissue, TB-500 clears the inflammation around the disc that blocks both tissue repair and nerve recovery, ARA-290 regrows the nerve.'],
  ['Recovery Stack for sciatica', 'Audience: 40% of Americans at some point. Same mechanism as the herniated-disc recovery stack — tissue, inflammation, nerve — different search term and ad targeting. BPC-157, TB-500, ARA-290.'],
  ['Recovery Stack for general back pain', 'Audience: 16M Americans with chronic back pain — the #1 reason people see a doctor. Back pain is usually a combination of tissue degeneration, inflammation, and nerve involvement. BPC-157, TB-500, ARA-290 address all three layers.'],
  ['Recovery Stack for gabapentin replacement', 'Audience: 15M. Gabapentin masks nerve pain — does not repair the nerve, the tissue damage causing compression, or the inflammation. ARA-290 repairs the nerve, BPC-157 repairs the tissue, TB-500 clears the inflammation, so the masking drug becomes unnecessary.'],
  ['Recovery Stack for opioid taper support', 'Audience: 10M+ on opioids. Opioids mask pain from injuries that were never repaired; tapering means pain returns because the root cause was never addressed. BPC-157 repairs the tissue, TB-500 clears inflammation, ARA-290 regrows the nerve, reducing the source of pain so opioid need decreases.'],
  ['Recovery Stack for diabetic neuropathy', 'Audience: 10M. Blood vessel damage starves nerves; nerves die — pain, numbness, loss of function. BPC-157 builds new blood vessels restoring the supply line to starving nerves, TB-500 clears inflammation blocking repair, ARA-290 regrows the nerve fibers; ARA-290 has human trial data for this condition.'],
  ['Aging Stack (BPC + TB + GHK-Cu) general intro', 'Audience: everyone over 40. With age, blood vessel density drops (less circulation), TB-500 production drops 60% (weaker repair signal), and GHK-Cu production drops 60-80% (less collagen scaffolding). These three declines are why healing slows with age. BPC rebuilds blood vessels, TB restores the repair signal, GHK-Cu rebuilds the collagen scaffolding.'],
  ['Aging Stack for joint degeneration', 'Audience: everyone over 40 with joint problems. Cartilage, collagen, and circulation all decline in the joint simultaneously. BPC-157, TB-500, and GHK-Cu target the three declines at one location.'],
  ['Semax general intro', 'Audience: broad — brain health and neuroprotection. The brain repairs itself through BDNF, which declines with age, stress, and neurotoxic exposures — slower neural repair, weaker connections, cognitive decline. Semax upregulates BDNF production; studied for neuroprotection and cognitive recovery.'],
  ['Semax for Adderall neuroprotection', 'Audience: 16M on Adderall. Adderall floods the brain with dopamine and norepinephrine; at chronic doses this is neurotoxic, degrading the dopamine system, causing tolerance, cognitive dulling, emotional flatness, dependency. Semax upregulates BDNF which protects neurons from toxicity and supports repair of damaged connections without interfering with Adderalls mechanism.'],
  ['Semax for SSRI emotional blunting', 'Audience: 37M on SSRIs. SSRIs increase serotonin availability and work for depression, but the #1 complaint is emotional blunting — patients feel flat. SSRIs change the chemical environment but do not restore neural plasticity. Semax upregulates BDNF which drives neuroplasticity, addressing the structural repair and connection-forming layer SSRIs miss.'],
  ['Semax for statin brain fog', 'Audience: 40M on statins. Statins lower cholesterol; the brain is 60% fat and relies on cholesterol for membrane integrity and neurotransmitter production; some users report brain fog, memory issues, difficulty concentrating. Semax upregulates BDNF which supports neural repair and cognitive function — a mechanism-level countermeasure.'],
  ['Semax for post-concussion/TBI', 'Audience: 2.8M TBIs per year, cumulative millions living with effects. A concussion damages neurons; the brain repairs via BDNF-driven neuroplasticity but in many TBI patients BDNF is insufficient for full recovery — persistent headaches, brain fog, emotional dysregulation, light sensitivity; current treatment is rest and wait. Semax increases BDNF, giving the brain more raw material to repair itself.'],
  ['Selank for Adderall jitteriness', 'Audience: 3-5M on Adderall + Xanax simultaneously. Adderall causes anxiety; doctors add benzodiazepines (Xanax, Klonopin) which are addictive, impair cognition, and dangerous to withdraw from — a stimulant that causes anxiety and a sedative to counter it. Selank is studied as an anxiolytic that reduces anxiety without sedation and without addiction risk, through a different pathway than benzodiazepines.'],
  ['Selank for SSRI breakthrough anxiety', 'Audience: 37M on SSRIs. Depression improves but anxiety persists — especially situational or social; doctors add buspirone, benzos, or raise the dose. Selank works as an anxiolytic through a mechanism distinct from SSRIs and benzos — anxiety relief without sedation, without addiction, without interfering with the SSRI.'],
  ['Semax + Selank for Adderall users', 'Audience: 16M. Adderalls two biggest side effects are neurotoxicity and anxiety, currently addressed with nothing and with addictive benzos. Semax protects the brain via BDNF; Selank reduces anxiety without sedation or addiction; neither interferes with Adderalls therapeutic effect.'],
  ['PT-141 for SSRI sexual dysfunction', 'Audience: 37M on SSRIs. Sexual dysfunction — loss of libido, inability to orgasm, erectile dysfunction — is the #1 reason people quit SSRIs; Viagra/Cialis only address erection, not libido or arousal. PT-141 works on arousal at the brain level via melanocortin receptors (the mechanism is FDA-approved as Vyleesi), addressing libido and arousal, not just blood flow.'],
  ['PT-141 for blood pressure med sexual dysfunction', 'Audience: 75M on blood pressure medications. Beta blockers and diuretics cause sexual dysfunction, a common reason for non-compliance that raises cardiovascular risk. PT-141 addresses arousal at the brain level, bypassing the vascular pathway entirely regardless of what the blood pressure med does to blood flow.'],
  ['PT-141 + Selank for SSRI users', 'Audience: 37M. The two biggest SSRI complaints are sexual dysfunction and breakthrough anxiety, currently addressed with Viagra (wrong mechanism) and benzos (addictive). PT-141 restores brain-level arousal; Selank reduces anxiety without sedation or addiction.'],
  ['DSIP for Adderall insomnia', 'Audience: 5M+ Adderall users who cant sleep. Adderall disrupts sleep; Ambien has dependency risk and bizarre side effects, trazodone causes morning grogginess, melatonin barely works at therapeutic doses for stimulant-induced insomnia. DSIP (Delta Sleep Inducing Peptide) is studied for inducing natural deep sleep without the sedation hangover, no dependency risk in studies, no morning impairment.'],
  ['Adderall Stack (Semax + Selank + BPC) general intro', 'Audience: 16M. Adderalls three primary long-term side effects are neurotoxicity, anxiety, and gut damage. Semax for neuroprotection via BDNF; Selank for anxiety without sedation or addiction; BPC-157 for gut lining repair from chronic empty-stomach acid exposure. None interfere with Adderalls therapeutic function.'],
  ['Cognitive Stack (Semax + DSIP + Selank) general intro', 'Audience: broad — cognitive decline, poor sleep, and anxiety simultaneously. Bad sleep impairs brain repair; anxiety impairs sleep and cognition; it is a cycle. Semax increases BDNF for brain repair, DSIP restores natural deep sleep so the brain can use that BDNF, Selank reduces anxiety so sleep quality improves.'],
  ['Cognitive Stack for Adderall insomnia', 'Audience: 5M+. Targeted at the Adderall user who cant sleep, is anxious, and worried about long-term brain effects. Semax (BDNF), DSIP (natural deep sleep), Selank (anxiety without sedation).'],
  ['Thymosin Alpha-1 for biologic users', 'Audience: 5M+ on biologics like Humira, Remicade, Enbrel. Biologics suppress specific immune pathways, leaving the patient immunocompromised — more susceptible to infection, slower to fight illness. Thymosin Alpha-1 is studied for immune modulation, supporting immune function without triggering the autoimmune response; it modulates rather than suppresses.'],
  ['GHK-Cu general intro', 'Audience: broad — aging, skin, tissue remodeling. GHK-Cu is a naturally occurring peptide that builds collagen scaffolding — the structural framework that gives healing tissue shape and strength; production drops 60-80% with age. Without sufficient scaffolding, healing tissue is weak, disorganized, prone to re-injury.'],
  ['BPC vs NSAIDs comparison', 'Audience: 30M+ daily NSAID users. Side-by-side mechanism comparison: NSAIDs block COX enzymes — reduce pain, damage gut, slow tissue repair; BPC-157 builds blood vessels — increases repair speed, heals gut, addresses root cause. One suppresses, the other repairs.'],
  ['BPC vs PPIs comparison', 'Audience: 15M. PPIs suppress acid production forever and the gut never heals; BPC-157 heals the gut lining so acid suppression becomes unnecessary. One manages the symptom, the other fixes the cause.'],
  ['ARA vs gabapentin comparison', 'Audience: 15M. Gabapentin dampens nerve signals — masks the pain from a damaged nerve; ARA-290 regrows the nerve. One silences the alarm, the other fixes what set it off.'],
  ['What are peptides — general education', 'Audience: broadest possible, entry point for all traffic. What peptides are; how they differ from drugs, steroids, supplements; structure/function explanation; how to read study data; what animal studies mean; what anecdotal means; how to evaluate claims. Data-first.'],
  ['How to read a peptide study', 'Audience: anyone evaluating peptide claims. In vivo vs in vitro; what rat studies mean; what human trials mean; what anecdotal reports mean; how to find studies on PubMed; how to read an abstract. Trust builder.'],
  ['Peptide purity and COAs', 'Audience: buyers comparing sources. What a Certificate of Analysis is; what third-party testing means; what American-made means; how to verify purity. Differentiates from grey market and overseas sources.'],
  ['BDNF explained', 'Audience: anyone interested in brain health; supports all Semax content. What BDNF is, what it does, why it matters, how it declines, what increases it. Foundation for all neuro-peptide content.'],
  ['Structure/function claims vs clinical proof', 'Audience: skeptics and smart buyers. What you can legally claim; what is actually proven; what animal data means; what consistent anecdotal evidence means. Radical honesty as a brand differentiator.'],
];

function extractJson(text) {
  if (text == null) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const i = s.indexOf('{');
  const j = s.lastIndexOf('}');
  if (i < 0 || j < 0 || j <= i) return null;
  try { return JSON.parse(s.slice(i, j + 1)); } catch { return null; }
}

async function writeOne(idx, title, brief) {
  const input = `${title}\n\n${brief}`;
  const tag = `[${idx + 1}/${BRIEFS.length}] ${title}`;
  let dr;
  try {
    const r = await fetch(`${BASE}/api/dispatch`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'WRITER', body: input }),
    });
    dr = await r.json();
  } catch (e) { return { tag, ok: false, stage: 'dispatch', err: e.message }; }

  const art = extractJson(dr && dr.result);
  if (!art || !art.title || !art.body) {
    return { tag, ok: false, stage: 'parse', err: String(dr && dr.result || '').slice(0, 200) };
  }
  if (!art.slug) art.slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  try {
    const pr = await fetch(`${BASE}/api/articles`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: art.slug, title: art.title, body: art.body, tags: art.tags || [], model: art.model || 'grok-4.3 (writer)' }),
    });
    const pj = await pr.json();
    if (!pr.ok || pj.error) return { tag, ok: false, stage: 'publish', err: JSON.stringify(pj).slice(0, 200) };
    return { tag, ok: true, slug: pj.slug, url: `${BASE}/${pj.slug}`, cost: dr.cost };
  } catch (e) { return { tag, ok: false, stage: 'publish', err: e.message }; }
}

async function main() {
  const queue = BRIEFS.map((b, i) => ({ i, title: b[0], brief: b[1] }));
  const results = [];
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      const job = queue[next++];
      const res = await writeOne(job.i, job.title, job.brief);
      results.push(res);
      console.log((res.ok ? 'OK   ' : 'FAIL ') + res.tag + (res.ok ? '  -> ' + res.url : '  [' + res.stage + '] ' + res.err));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const ok = results.filter(r => r.ok).length;
  console.log(`\n=== ${ok}/${BRIEFS.length} published ===`);
  for (const r of results.filter(x => !x.ok)) console.log('FAILED: ' + r.tag + ' [' + r.stage + '] ' + r.err);
}
main();
