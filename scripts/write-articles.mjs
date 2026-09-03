// Writes the real article bodies into content_items via the live PATCH API.
// Each PATCH snapshots a new version automatically. Plain science. No stubs.
const B = 'https://miscsubjects.com/api/content';

const A = {
// ---------- PEPTIDES ----------
'peptide-bpc-157': `BPC-157 is a piece of a protein your own stomach makes. Your gut produces it already.

Used as a peptide, it does one main thing: it grows new blood vessels into damaged tissue. New blood vessels carry blood. Blood is what rebuilds a wound. That is why it is studied for healing.

It works at the spot where it is placed — local, not all over the body.

Most of what we know is from animal studies. There are over 100 published animal and cell studies across tendon, gut, muscle, bone, and nerve. There is no large human trial yet.

So the honest line is two lines. In rats, it repaired tissue and grew blood vessels into the damage. In people, the benefit is reported by users, not proven in a trial. Those are different strengths of evidence. They should not be blurred together.`,

'peptide-tb-500': `TB-500 is a lab-made copy of Thymosin Beta-4, a repair protein found in nearly every cell in your body.

Its job is movement. It moves repair cells to the site of damage faster, and it clears stuck inflammation so repair can start. It works body-wide, following the damage signal, not just at one spot.

Your own production of this protein drops about 60% by age 60. That is part of why healing slows as you get older.

In wound studies, tissue healed 30 to 50% faster with it. That is animal and lab data.

It does not build muscle like a steroid. It maintains and repairs the tissue you already have.`,

'peptide-ara-290': `ARA-290 is a nerve-repair peptide.

It is the strongest one here on human evidence. It has actual human clinical trial data, not only rat studies. It is studied for regrowing damaged nerve fibers and bringing back feeling.

The difference from a nerve-pain drug matters. A pain drug quiets the alarm coming from a damaged nerve. ARA-290 is studied for repairing the nerve itself, so the alarm has less reason to fire.

Repair, not masking.`,

'peptide-semax': `Semax is a brain peptide.

Your brain repairs and protects its own cells using a protein called BDNF — brain-derived neurotrophic factor. Semax raises how much BDNF your brain makes.

More BDNF means more raw material for the brain to repair its connections and protect its neurons.

BDNF drops with age, stress, and toxic exposures. That is exactly when repair slows down. Semax is studied for protecting the brain and for cognitive recovery.`,

'peptide-selank': `Selank is an anxiety peptide.

It is studied as an anxiolytic — it lowers anxiety. Two things make it different from a benzodiazepine like Xanax.

It lowers anxiety without sedation. And it works without the addiction risk benzos carry, through a different pathway in the body.

It does not knock you out. In studies it did not build dependency.`,

'peptide-pt-141': `PT-141 is a sexual-function peptide.

It works on the arousal signal in the brain — not on blood flow in the body. That distinction is the whole point.

Drugs like Viagra work on blood flow. PT-141 works one step earlier, on the brain signal that starts arousal in the first place.

The same mechanism is already FDA-approved under the brand name Vyleesi.`,

'peptide-dsip': `DSIP stands for Delta Sleep Inducing Peptide.

It is studied for bringing on natural deep sleep without the heavy, hungover feeling that drugs like Ambien leave the next morning.

It does not knock you out. It is studied for supporting the brain's own way of starting sleep. In studies it did not show dependency.`,

'peptide-kpv': `KPV is a gut-specific calming peptide.

It lowers inflammation in the gut lining specifically. The important part is what it does not do: it does not shut down your whole immune system the way broad immune-suppressing drugs do.

It calms the local fire in the gut without turning off the body's defenses everywhere else.`,

'peptide-ghk-cu': `GHK-Cu is a tissue-rebuilding peptide your body makes on its own.

Its job is scaffolding. It builds the collagen framework that gives healing tissue its shape and strength. Without enough of that framework, new tissue comes in weak and disorganized and re-injures easily.

Your own production of it drops 60 to 80% with age. That is one reason older skin and tissue heal weaker than they used to.`,

'peptide-thymosin-alpha-1': `Thymosin Alpha-1 is an immune-balancing peptide.

It is studied for supporting immune function — helping the immune system work — rather than suppressing it. That is the opposite of drugs that turn the immune system down.

It tunes the immune system. It does not switch it off.`,

'peptide-nad': `NAD+ is a molecule every cell in your body uses to make energy.

As you age, your levels fall. Lower NAD+ means cells make less energy and repair themselves more slowly.

It sits at the center of the whole degeneration-versus-regeneration question, because energy is what regeneration runs on. If the cell cannot make energy, it cannot rebuild.

Most of the strong data is from animal and lab studies. Human research is still early. So this is emerging evidence, not settled human proof.`,

// ---------- TOPICS 1-57 ----------
'topic-001': `25 million people are on Ozempic, Mounjaro, or Wegovy. These drugs work by slowing the stomach down and shutting off appetite. The side effect: acid and food sit in the stomach longer than they should, and the lining of the stomach and gut gets worn down. That shows up as nausea, vomiting, and a gut wall that erodes over time. It is the number one reported side effect.

BPC-157 is a piece of a protein your stomach already makes. The gut is where it was discovered and where the most research exists. In rat studies, it repaired gut-lining damage and cut gut inflammation by more than half. It does this by growing new blood vessels into the damaged wall — blood supply is what lets the wall rebuild.

Kept honest: this is animal data. In rats, it repaired this kind of damage. In people, the gut benefit is reported by users, not proven in a trial.

The frame: the drug speeds up degeneration of the gut lining. BPC-157 has research on regeneration of that same lining. The connection is the point — not a claim that it fixes the drug.`,

'topic-002': `GLP-1 drugs take weight off, but they do not separate fat from muscle. People lose real muscle along with the fat. Muscle protects joints, holds the spine up, and keeps metabolism running. Lose it and you get joint instability, a slower metabolism, and weakness. This is the loudest complaint about these drugs right now.

TB-500 is a lab-made copy of a repair protein found in nearly every cell. Its job is to move repair cells to tissue faster. In wound studies, tissue healed 30 to 50% faster with it. The mechanism that matters here is cell migration — getting maintenance cells to muscle that is being starved by appetite suppression.

It does not build muscle like a steroid. It maintains and repairs the muscle you already have.

Kept honest: that 30 to 50% is animal and wound-study data, not a human muscle-loss trial.

The frame: the drug accelerates muscle degeneration. TB-500 has muscle-repair research. The article connects those tissues, nothing more.`,

'topic-003': `GLP-1 drugs cause two separate problems at once: gut-lining damage and muscle loss. Two problems from one drug.

The pairing works because the two peptides hit two different tissues with no overlap. BPC-157 has gut-repair research — it grows blood vessels into the worn gut wall. TB-500 has muscle-maintenance research — it moves repair cells to muscle that is wasting. One works locally on the gut. One works body-wide on muscle.

Kept honest: both are mostly animal data. Reported together by users, not proven as a pair in a human trial.

This is the regeneration side of the ledger answering two degeneration problems the drug created. The connection is the asset.`,

'topic-004': `30 million Americans take an NSAID like ibuprofen every day. NSAIDs block an enzyme called COX. That cuts pain — but the same enzyme protects the gut lining and feeds blood to an injury. So an NSAID does two quiet kinds of harm: it wears down the gut with every dose, and it slows the healing of the very injury you took it for. The pain returns because the injury never repaired. The gut gets worse the longer you use it.

BPC-157 does the opposite on both fronts. It grows blood vessels into injured tissue, which speeds repair instead of slowing it. And it has research on repairing gut lining — the exact tissue NSAIDs wear down. In rat studies, it specifically reversed NSAID-caused gut damage. Not damage in general — NSAID damage in particular.

The honest frame is suppression versus repair. The NSAID suppresses. BPC-157 has repair research. That is the whole comparison, at the level of mechanism, on animal data.`,

'topic-005': `15 million people take a proton pump inhibitor — Prilosec, Nexium and the like — for reflux, GERD, or ulcers. They work by shutting off stomach acid. They were designed for 2 to 8 weeks of use. Millions take them for years. Long-term use is linked to poor absorption of magnesium, calcium, and B12, higher fracture risk, kidney problems, and a disrupted gut. The acid is suppressed but the underlying damage is never healed. Stop the drug and the acid comes back worse, because nothing was repaired.

BPC-157 is studied for healing the gut lining itself. Instead of suppressing acid forever, it has research on repairing the wall the acid is wearing down. In rat studies it healed stomach ulcers faster than standard treatment.

The frame: the drug manages the symptom indefinitely. BPC-157 has research on the root tissue. This is animal data, not a human trial — said plainly so the comparison stays honest.`,

'topic-006': `16 million people take Adderall or a similar stimulant. Adderall kills appetite, so users skip meals for hours. Acid then sits in an empty stomach and wears at the lining. Long use also disrupts the gut. Many develop reflux, nausea, and stomach trouble they did not have before — and never connect it to the drug.

It is the same kind of damage as the other gut topics, from a different cause. BPC-157, the protein your stomach already makes, has rat-study research on repairing gut-lining damage and lowering gut inflammation. The acid erosion from an empty stomach is the kind of damage that research covers.

Animal data, reported anecdotally in people. The connection is the gut tissue both the drug and the peptide act on.`,

'topic-007': `There are over 50 million surgeries a year in the US. Surgery fixes the structural problem but creates a new one. The surgical site loses blood flow. Oxygen cannot reach it. That dead zone is where scar tissue forms fast — and scar tissue sticks tendons and nerves together. That is what causes the stiffness, limited movement, and pain months later, even when the surgery itself worked.

BPC-157 grows new blood vessels into damaged tissue. In a post-surgical dead zone, that means research on restoring blood and oxygen before scar tissue locks everything down. In rat studies it sped tendon healing by 70% and built stronger repair — real collagen, not scar.

The mechanism lines up directly with the adhesion problem. Said honestly: that is animal data, and the human benefit is reported by users, not proven in a trial.`,

'topic-008': `About 2 million epidural steroid injections are given each year for back, joint, and disc pain. They lower inflammation at the spot. But repeated injections are linked to faster cartilage breakdown, weakened tendons, and disc degeneration. The injection treats the symptom and degrades the structure over time. Many patients get repeat shots without being told the long-term cost.

BPC-157 is studied for the opposite — tissue repair in tendon, bone, and cartilage. In rat studies it regrew bone denser than normal, healed tendon stronger than untreated controls, and grew new blood vessels into damage.

The frame is direct: the injection drives degeneration of the structure. BPC-157 has regeneration research on those same tissues. Animal data, connected at the tissue level.`,

'topic-009': `Over 60 million Americans live with gut trouble — reflux, IBS, bloating, leaky gut, chronic gut inflammation. Most treatment manages symptoms: antacids, acid blockers, cutting foods. The gut lining itself rarely gets addressed.

BPC-157 was first found in stomach juice. Its most-studied use is gut-lining repair. In rat studies it repaired gut-wall damage and cut inflammation by more than half, by growing blood vessels into the damaged tissue so the lining can rebuild.

This is the broadest gut audience. The honest label stays the same: strong animal data, user reports in people, no large human trial.`,

'topic-010': `About 3 million Americans are diagnosed with inflammatory bowel disease — Crohn's or colitis. The immune system attacks the gut lining and keeps it inflamed. Standard treatment uses immune-suppressing drugs and biologics that turn down the immune response across the whole body. They manage flares but do not rebuild the lining.

BPC-157 has rat-study research on repairing gut lining and lowering gut inflammation without suppressing the immune system. It is a different mechanism — building tissue back rather than switching the attack off. In rat gut studies, inflammation markers dropped by more than half.

Said plainly: animal data, presented next to standard treatment, not as a replacement for it.`,

'topic-011': `12 million people are on benzodiazepines. Coming off them is brutal, and one of the worst parts is the gut — nausea, cramping, no appetite, the gut seizing up. The gut has its own nervous system, and the calming signal benzos provide reaches it too. Take that signal away in withdrawal and the gut spasms and inflames.

BPC-157 has rat-study research on repairing gut lining, lowering gut inflammation, and protecting the GI tract. It does not replace the benzo or treat the withdrawal itself. It is research on supporting the gut tissue that gets battered during the process.

This is animal data, the audience is desperate, and almost nothing honest exists for them. The connection is the gut tissue, stated without overclaiming.`,

'topic-012': `5.7 million Americans are dealing with a herniated disc right now. The soft inside of a disc pushes out and presses on a nerve, causing pain, numbness, and weakness down a limb. The usual options — physical therapy, steroid shots, surgery — either mask the pain or remove the structural cause. None of them repair the nerve that got compressed. That nerve is often left to heal on its own, and frequently does not fully.

ARA-290 is studied specifically for nerve repair, and it has human clinical trial data, not only rat studies. Once the compression is dealt with, the nerve damage remains — and that is the layer ARA-290 research is about: regrowing nerve fibers and restoring function.

The connection is the nerve. The evidence is the strongest of any peptide here, and it is still about the nerve, not the disc.`,

'topic-013': `Sciatica hits roughly 40% of people at some point. It is the same mechanism as a herniated disc — a compressed nerve, usually in the lower back, firing pain down the leg. Different word, different search, often a different person than the one typing "herniated disc," but the same underlying problem.

ARA-290 has human trial data on nerve repair. Where the pain comes from a damaged or compressed nerve, the research is about regrowing the nerve fiber and restoring its signal — not muffling the pain.

The honest line: human data exists for nerve repair generally; sciatica itself is the connected use, stated as a connection, not a cure.`,

'topic-014': `10 million people with diabetes have nerve damage. High blood sugar wrecks the small blood vessels that feed nerves, and the nerves in the hands and feet die slowly — tingling, burning, numbness, then loss of feeling. Standard treatment is pain management with gabapentin, pregabalin, or duloxetine. None of those repair the nerve. They mask the symptoms of a dying nerve.

ARA-290 has human clinical trial data specifically for diabetic nerve damage. Human studies, not rat studies. It is studied for regrowing the damaged fibers and bringing back sensation.

This is the strongest clinical backing of any peptide here for any one condition. Stated plainly, and still kept inside what the research shows.`,

'topic-015': `15 million people take gabapentin or pregabalin (Lyrica) for nerve pain. They work by dampening the nerve's signal — turning down the volume on the pain. They do not repair the nerve. The damage stays. Stop the drug and the pain returns, because nothing was fixed. Long-term use brings its own load: dizziness, weight gain, fog, dependency.

ARA-290 is studied for repairing the nerve itself, with human trial data behind it. Instead of quieting the alarm from a damaged nerve, the research is about regrowing the nerve so the alarm has less reason to sound.

This is the same repair-versus-mask comparison as BPC-157 against NSAIDs, applied to nerves. One silences. The other has repair research.`,

'topic-016': `8 million Americans have carpal tunnel. The median nerve gets squeezed at the wrist — numbness, tingling, a weak hand. Treatment is splints, steroid shots, or surgery to cut the ligament pressing on the nerve. Even after surgery, the nerve damage can stay. The pressure is relieved but the nerve may not fully recover.

ARA-290 has human trial data on nerve regrowth and restoring function. After surgery, or alongside other care, the research speaks to the nerve damage the other options leave behind.

The connection is the nerve. The evidence is human, and it is about repair.`,

'topic-017': `Millions of people come out of surgery with numbness, tingling, or lost feeling near the site, because nerves get cut, stretched, or compressed during the operation. Surgeons say feeling might come back. Often it does not. There is no standard treatment. Patients are told to wait and hope.

ARA-290 is studied for nerve regrowth, and in human trials for diabetic nerve damage it showed nerve fibers being restored. The same mechanism — regrow the connection, restore the signal — is what this completely unaddressed group is left needing.

Stated honestly: the human trial data is for diabetic nerve damage; surgical nerve damage is the connected use, offered as a connection, not a promise.`,

'topic-018': `A herniated disc is really two injuries. The disc tissue is damaged. The nerve it presses on is damaged. Two problems, two tissues.

The pairing splits the work. BPC-157 has research on the tissue around the disc — growing blood vessels, shrinking the dead zone, supporting structural repair. ARA-290 has human trial data on the compressed nerve itself. One addresses the structure. One addresses the nerve.

Two different tissues, two different mechanisms, one pairing. Said plainly: BPC-157 is animal data, ARA-290 has human data, and the article keeps those straight.`,

'topic-019': `Surgery fixes the structural problem and often damages a nerve doing it. The surgical site needs tissue repair. The nerve needs to regrow. Two layers.

BPC-157 has research on healing the surgical site — growing blood vessels, keeping scar tissue from locking things down. ARA-290 has human trial data on regrowing the nerve that got hurt during the procedure. Different targets, different mechanisms, one pairing.

The connection is two tissues damaged in one event, each matched to research on its own repair.`,

'topic-020': `Repeated steroid injections degrade disc tissue over time, and as the structure breaks down, the nerves nearby get compressed by it. The damage compounds.

BPC-157 has research on repairing the degenerating disc tissue. ARA-290 has human trial data on the nerve being squeezed by that degeneration. One addresses the structure that is breaking down. One addresses the nerve caught in it.

This is the degeneration-versus-regeneration frame across two tissues at once — animal data for the structure, human data for the nerve.`,

'topic-021': `Gut trouble is usually two problems stacked: a damaged lining, and inflammation in that lining. Over 60 million Americans live with some version of it.

The pairing addresses both layers. BPC-157 has research on rebuilding the gut wall — new blood vessels, structural repair. KPV has research on calming gut-specific inflammation without shutting down the whole immune system. BPC-157 works on the structure. KPV calms the environment so the structure can hold.

Both are animal-level research, said plainly. The connection is the gut lining and its inflammation, matched to two mechanisms.`,

'topic-022': `For diagnosed Crohn's and colitis, the problem is the same two layers — a damaged lining and relentless inflammation — in about 3 million Americans.

BPC-157 has rat-study research on rebuilding the gut wall. KPV has research on calming gut inflammation locally, without suppressing the body's whole immune system the way standard biologics do. Together they map to the structure and the fire.

This is a more specific audience than general gut health, with the same honest label: animal data, presented next to standard treatment, not over it.`,

'topic-023': `People on long-term acid blockers are stuck suppressing acid forever while the gut never heals. 15 million are on these drugs, many for years past the few weeks they were designed for.

BPC-157 has research on healing the gut wall. KPV has research on calming the gut's inflammation. Together they map to the root the drug only manages — the structure and the inflammation underneath the acid.

The honest frame: the drug suppresses indefinitely; these peptides have repair and calming research on the underlying tissue. Animal data, stated as a connection.`,

'topic-024': `Most injuries are not one clean problem. A herniated disc is damaged disc tissue, plus inflammation blocking repair, plus a compressed nerve. Standard care treats one layer at a time.

The Recovery Stack matches three mechanisms to three layers. BPC-157 grows blood vessels and supports tissue repair. TB-500 clears stuck inflammation and moves repair cells in faster. ARA-290 has human trial data on regrowing nerves. Three bottlenecks, addressed together.

Said plainly: two of the three are animal data, one is human data, and the stack is a connection of mechanisms to layers — not a cure-all.`,

'topic-025': `A herniated disc has three layers of damage at once: the disc tissue, the inflammation around it, and the compressed nerve. Treating one at a time is why recovery stalls.

BPC-157 supports the disc tissue repair. TB-500 clears the inflammation that blocks both tissue and nerve recovery. ARA-290 has human trial data on the nerve. Three mechanisms, three layers, one stack.

The connection is that this is rarely a single-tissue problem — and the research lines up tissue by tissue. Animal data for two, human data for the nerve.`,

'topic-026': `Sciatica is the same three-layer problem as a herniated disc — damaged tissue, inflammation, compressed nerve — reaching the 40% of people who get it at some point. Different search term, same mechanism.

BPC-157 for the tissue, TB-500 for the inflammation, ARA-290 with human trial data for the nerve. Three mechanisms matched to the three layers of one problem.

Stated honestly and kept inside the research: a connection of mechanisms to a multi-layer injury, not a treatment claim.`,

'topic-027': `16 million Americans live with chronic back pain — the number one reason people see a doctor. It is almost never one thing. It is usually tissue degeneration, inflammation, and nerve involvement together.

BPC-157 has research on the tissue, TB-500 on clearing inflammation, ARA-290 has human trial data on the nerve. Three mechanisms for the three things that usually combine in a bad back.

The connection is honest about strength: animal data for two layers, human data for the nerve, presented as mechanism, not promise.`,

'topic-028': `15 million people are on gabapentin. It masks nerve pain. It does not repair the nerve, it does not touch the tissue damage causing the compression, and it does not clear the inflammation.

The Recovery Stack maps to what the drug leaves untouched. ARA-290 has human trial data on repairing the nerve. BPC-157 has research on the tissue. TB-500 has research on clearing the inflammation. The aim of the comparison is the root cause the masking drug steps around.

Said plainly: a connection between what gabapentin does not address and what these peptides have research on — two animal, one human.`,

'topic-029': `Over 10 million people are on opioids, most for pain from an injury that was never repaired. The injury persists. The drug becomes the permanent manager. Taper off and the pain returns, because the cause was never addressed.

The Recovery Stack maps to the cause. BPC-157 has tissue-repair research. TB-500 has inflammation-clearing research. ARA-290 has human trial data on nerve repair. If the underlying tissue and nerve damage is the source of the pain, that is the layer this research speaks to.

This is a high-stakes, honest connection: research on the root, stated as mechanism, never as a claim to replace medical care.`,

'topic-030': `10 million people with diabetes have nerve damage, and it has three parts: damaged blood vessels starving the nerves, inflammation blocking repair, and the dying nerve fibers themselves.

BPC-157 grows new blood vessels — research on restoring the supply line to starving nerves. TB-500 clears inflammation that blocks repair. ARA-290 has human clinical trial data on this exact condition, regrowing the fibers. Three layers of one disease, three mechanisms.

The strongest evidence in the stack is human and points right at diabetic nerve damage. The rest is animal data, kept clearly labeled.`,

'topic-031': `After 40, three things decline at once and that is why healing slows. Blood vessel density drops, so circulation falls. The repair protein behind TB-500 drops about 60%. The collagen-scaffold peptide GHK-Cu drops 60 to 80%. It is not one failure — it is three systems sliding together.

The Aging Stack maps one mechanism to each. BPC-157 has research on rebuilding blood vessels. TB-500 restores the repair signal. GHK-Cu rebuilds the collagen scaffold that gives healing tissue its structure.

Three age-related declines, three regeneration mechanisms — the framework in its plainest form. Animal-level research, stated as connection.`,

'topic-032': `In an aging joint, three things decline together: cartilage, collagen, and circulation. That combination is why joints stiffen and break down with age.

BPC-157 has research on the blood supply, TB-500 on the repair signal, GHK-Cu on the collagen scaffold. The same three-mechanism logic as the general aging stack, aimed at one location.

The connection is that joint decline is multi-system, and the research lines up with each system. Animal data, said plainly.`,

'topic-033': `Your brain repairs and protects itself with a protein called BDNF. BDNF falls with age, stress, and toxic exposure. Less BDNF means slower repair, weaker connections, and decline.

Semax raises how much BDNF the brain makes — it increases the brain's own repair protein. It is studied for protecting neurons and for cognitive recovery.

This is the foundation for the brain topics. The honest label: research-backed mechanism, mostly outside large human trials, stated as what the peptide does, not what it cures.`,

'topic-034': `16 million people take Adderall. It floods the brain with dopamine and norepinephrine. At chronic doses that is hard on the brain — it wears on the dopamine system, which is why tolerance builds and long-term users report dulling, flatness, and dependency. No doctor prescribing Adderall is also prescribing anything to protect the brain.

Semax raises BDNF, the protein the brain uses to protect and repair neurons. It does not interfere with how Adderall works. The research is about protecting the brain from the wear while the stimulant does its job.

The connection: the drug drives a kind of brain degeneration; Semax has research on the brain's own protection and repair. Stated as mechanism.`,

'topic-035': `37 million people take an SSRI. They lift depression by raising serotonin, and they work for that. But the top complaint is emotional blunting — feeling nothing. Not sad, not happy. Flat. That happens because SSRIs change the chemistry but do not rebuild the brain's ability to form new connections.

Semax raises BDNF, which drives the brain's capacity to form and strengthen connections. It speaks to the layer SSRIs miss. The drug handles the chemistry. Semax has research on the structural repair and connection-building that lets range return.

The connection is plain: two different jobs in the brain, matched to two different mechanisms.`,

'topic-036': `40 million people take a statin. The brain is 60% fat and uses cholesterol for its cell membranes and signaling. Some statin users report fog, memory trouble, and trouble concentrating — widely reported, rarely addressed by the prescriber.

Semax raises BDNF, the brain's repair and maintenance protein. If statins are straining the brain's fat metabolism, raising the protein the brain uses to repair and maintain itself is the connected mechanism.

Said honestly: this is a mechanism-level connection on a widely reported problem, not a proven fix. The science is stated, the limits are stated.`,

'topic-037': `There are about 2.8 million traumatic brain injuries a year, and millions living with the aftermath — headaches, fog, mood swings, light sensitivity. The brain repairs damaged connections using BDNF. In many TBI patients there is not enough BDNF for full recovery. Standard advice is rest and wait.

Semax raises BDNF production — more of the exact protein the brain uses to repair connections. It does not heal the concussion. The research is about giving the brain more of the raw material it needs to repair itself.

The connection is the protein. Stated as mechanism, with the honest limit that this is not a proven cure.`,

'topic-038': `Between 3 and 5 million people take Adderall and a benzodiazepine like Xanax at the same time. Adderall causes anxiety; the doctor adds a benzo to counter it. Benzos are addictive, dull cognition, and are dangerous to come off. So people are stuck on a stimulant that causes anxiety and a sedative to mask it.

Selank is studied as an anxiolytic that lowers anxiety without sedation and without addiction risk, through a different pathway than benzos. It does not impair thinking and it did not build dependency in studies. It maps to the Adderall anxiety without the benzo's downside.

The connection is the anxiety; the difference is the mechanism. Stated plainly.`,

'topic-039': `37 million people take an SSRI. Many find the depression eases but anxiety stays — especially social or situational anxiety. The usual answer is adding buspirone, a benzo, or a higher dose. None of those work the way Selank does.

Selank is studied as an anxiolytic through a pathway different from SSRIs and benzos. It adds anxiety relief without sedation, without addiction, and without getting in the way of the SSRI.

The connection: a leftover anxiety the SSRI does not cover, matched to a different mechanism. Said honestly as research, not a guarantee.`,

'topic-040': `Adderall's two biggest downsides are wear on the brain and anxiety. Today the wear is ignored, and the anxiety is masked with an addictive sedative. 16 million people are on the drug.

The pairing covers both. Semax raises BDNF to support the brain against the wear. Selank lowers the anxiety without sedation or addiction. Neither interferes with how Adderall works.

Two downsides, two mechanisms, one pairing. Stated as a connection between the drug's costs and the peptides' research — not a claim to fix the drug.`,

'topic-041': `37 million people take an SSRI, and sexual dysfunction — lost libido, no orgasm, erection trouble — is the number one reason they quit. Doctors have no good answer: lower the dose and depression returns, switch drugs and you start over, or add Viagra, which only moves blood and does nothing for libido or arousal.

PT-141 works on arousal at the brain level, not the blood-flow level. The mechanism is FDA-approved under the brand Vyleesi. For SSRI users the plumbing usually works — it is the brain's arousal signal that is suppressed, and that is the layer PT-141 acts on.

The connection is the brain signal. Stated plainly, with the honest note that this addresses arousal, not the SSRI.`,

'topic-042': `75 million people take blood pressure medication, and beta blockers and diuretics commonly cause sexual dysfunction. It is one of the main reasons people quietly stop taking these drugs — which puts their hearts at risk.

PT-141 works on the arousal signal in the brain, one step before blood flow. Blood pressure drugs hurt sexual function partly through blood flow; PT-141 bypasses that pathway and acts on the brain signal regardless of what the drug is doing downstream.

The connection is mechanism: the drug acts on blood flow, PT-141 acts on the brain. Said honestly as research, aimed at a problem that drives people off needed medication.`,

'topic-043': `The two biggest complaints about SSRIs are sexual dysfunction and breakthrough anxiety. The usual fixes are Viagra, which is the wrong mechanism, and benzos, which are addictive. 37 million people are on SSRIs.

The pairing matches each complaint to the right layer. PT-141 works on brain-level arousal. Selank lowers anxiety without sedation or addiction. Two side effects, two mechanisms, one pairing.

The connection is plain and the limits are plain: research on arousal and on anxiety, stated as mechanism next to the SSRI, not a replacement for it.`,

'topic-044': `Over 5 million Adderall users cannot sleep. The drug is a stimulant. To counter it, doctors reach for Ambien, trazodone, or melatonin. Ambien carries dependency and strange side effects. Trazodone leaves morning grogginess. Melatonin barely touches stimulant-driven insomnia at normal doses.

DSIP — Delta Sleep Inducing Peptide — is studied for bringing on natural deep sleep without the next-day hangover. It does not knock you out; the research is about supporting the brain's own way of starting sleep. In studies it did not build dependency.

The connection is the sleep the stimulant breaks, matched to a peptide studied for natural sleep onset. Stated honestly.`,

'topic-045': `Adderall has three long-term costs: wear on the brain, anxiety, and gut damage. Today they are met with nothing, a benzo, and nothing. 16 million people are on it.

The stack matches each. Semax raises BDNF to support the brain. Selank lowers anxiety without sedation or addiction. BPC-157 has research on repairing the gut lining worn by acid on an empty stomach. None of them interfere with how Adderall works.

Three costs, three mechanisms, one stack. Said plainly, with the evidence labels kept straight — Semax and Selank are research-backed mechanisms, BPC-157 is animal data.`,

'topic-046': `Poor sleep, anxiety, and cognitive decline feed each other. Bad sleep blocks brain repair. Anxiety wrecks both sleep and thinking. Decline speeds up when neither is handled. It is a loop.

The Cognitive Stack maps to the loop. Semax raises BDNF so the brain can repair. DSIP supports natural deep sleep so the brain can use that repair time. Selank lowers anxiety so sleep improves and stress stops dragging on thinking. Three connected problems, three mechanisms that support each other.

The connection is the loop itself. Stated as research-backed mechanism, not a promise to fix cognition.`,

'topic-047': `This is the Cognitive Stack aimed at the Adderall user who cannot sleep, is anxious, and worries about long-term brain effects — over 5 million people.

Semax raises BDNF for the brain. DSIP supports natural deep sleep against stimulant-driven insomnia. Selank lowers the anxiety without sedation or addiction. The three problems are linked, and so are the mechanisms.

Said honestly: a connection between a stimulant's three downstream effects and three peptides studied for sleep, anxiety, and brain support — not a treatment claim.`,

'topic-048': `Over 5 million people take biologics like Humira, Remicade, or Enbrel for autoimmune disease. These drugs work by suppressing specific parts of the immune system. That helps the autoimmune condition but leaves the patient more open to infection, slower to fight illness, and on higher cancer-screening schedules.

Thymosin Alpha-1 is studied for supporting immune function — helping it work — rather than suppressing it. It modulates instead of switching off. In principle the research speaks to supporting the immune capacity biologics reduce, without working against the biologic's job.

The connection is the immune system pulled in two directions. Stated plainly as mechanism, for a small but very motivated group.`,

'topic-049': `GHK-Cu is a peptide your body makes that builds collagen scaffolding — the framework that gives healing tissue its shape and strength. Production drops 60 to 80% with age. Without enough scaffold, new tissue comes in weak, disorganized, and easy to re-injure.

That is the plain reason older people heal with weaker tissue: the raw materials for repair are there, but the framework they organize around is missing.

The research is about that scaffold. Stated as mechanism — what the peptide builds — not as a claim about any one condition.`,

'topic-050': `30 million people take an NSAID daily. Set the two mechanisms side by side. The NSAID blocks the COX enzyme: it cuts pain, wears the gut, and slows the actual repair of the injury. BPC-157 grows blood vessels: it speeds repair, has gut-lining research, and works at the root.

One suppresses. The other has repair research. Same injury, opposite approaches.

That is the whole comparison, at the level of mechanism, on animal data for BPC-157 — said plainly, with no claim that the peptide cures anything.`,

'topic-051': `15 million people are on acid blockers. The comparison is clean. The drug suppresses acid production indefinitely, and the gut never heals. BPC-157 has research on healing the gut lining, so the underlying damage is the target rather than the acid.

One manages the symptom forever. The other has research on the cause.

Stated honestly: BPC-157's gut-repair data is from animal studies, and the comparison stays at the level of mechanism.`,

'topic-052': `15 million people take gabapentin. Side by side: gabapentin dampens the nerve's signal — it masks the pain coming from a damaged nerve. ARA-290 is studied for regrowing the nerve, and it has human trial data.

One silences the alarm. The other has repair research on what set the alarm off.

This is the strongest evidence comparison here, because ARA-290's data is human — and the comparison still stays inside what the research shows.`,

'topic-053': `This is the front door. What peptides actually are. How they differ from drugs, steroids, and supplements. What a structure-and-function explanation means. And how to read evidence honestly — what an animal study shows, what a human trial shows, what "people report it" means.

The point of this piece is the reader's ability to judge everything else on the site. It teaches the evidence ladder before making any connection.

No claims. Just the tools to tell strong evidence from weak, stated plainly.`,

'topic-054': `How to read a peptide study, in plain terms. In the body (in vivo) versus in a dish (in vitro). What a rat study can and cannot tell you. What a human trial adds. What a pile of user reports is worth. How to find studies on PubMed and read an abstract.

This is a trust piece. It hands the reader the same evidence rules the rest of the site runs on, so they can check the work themselves.

The whole value is that it teaches judgment, not conclusions.`,

'topic-055': `What purity and a Certificate of Analysis actually mean. What third-party testing proves. What "made in America" does and does not tell you. How to verify what you are buying, and how that differs from grey-market or overseas sources.

This piece exists to separate verifiable facts from marketing. It gives the reader a checklist they can apply to any seller, including this one.

Stated plainly, with no claim beyond what a test result can support.`,

'topic-056': `BDNF explained, because it sits under every Semax topic. What BDNF is — the protein the brain uses to repair and protect its own cells. What it does. Why it matters. How it falls with age, stress, and toxic exposure. What raises it.

This is the foundation piece for the brain content. Understand BDNF and the Semax connections read clearly.

No claims — just the mechanism, in plain words, so the rest makes sense.`,

'topic-057': `What you can honestly say versus what is actually proven. What an animal study supports. What consistent user reports are worth, and what they are not. Where a structure-and-function statement ends and a medical claim begins.

This piece is the honesty itself, written out. Nobody in this space does it — most either overclaim or say nothing. Stating the limits plainly is the differentiator.

The whole article is one rule applied over and over: say what the evidence supports, label its strength, and stop there.`,
};

const slugs = Object.keys(A);
let ok = 0, fail = 0; const errs = [];
for (const slug of slugs) {
  try {
    const res = await fetch(`${B}/${slug}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body_md: A[slug], status: 'active', change_note: 'real article', created_by: 'operator' }),
    });
    const j = await res.json();
    if (j.item) ok++; else { fail++; errs.push(`${slug}: ${j.error || res.status}`); }
  } catch (e) { fail++; errs.push(`${slug}: ${e.message}`); }
}
console.log(`patched=${ok} failed=${fail} total=${slugs.length}`);
if (errs.length) console.log('errors:\n' + errs.join('\n'));
