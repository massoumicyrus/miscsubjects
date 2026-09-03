// Seeds the ad skeleton into body_json.ad for the priority conditions (merges, keeps existing fields).
// The ad fields name no peptide and show no vial — they are creative + market data.
const B = 'https://miscsubjects.com/api/content';
const ADS = {
'topic-027': { // back pain
  audience_size: 16000000, search_volume: null, social_volume: null, cpc_usd: null,
  commercial_intent: 9, emotional_intensity: 10, visual_transformation_score: 9, ad_safety_score: 9,
  monetization_score: 8, wholesale_score: 7, white_label_score: 7, opportunity: 9.4,
  before_state: ["can't bend to tie his shoes","braces on the doorframe just to stand up","stopped picking up his kid","wakes up stiff, dreads the morning"],
  after_state: ["ties both shoes standing","lifts the kid overhead","out of the car with no wince","sleeps through the night"],
  angles: { transformation:"The 50-year-old who couldn't tie his own shoes — 90 days later.", curiosity:"Why your back 'flares up' and then never fully heals (it isn't your muscles).", frustration:"A steroid shot and a shrug. Here's what the shot quietly makes worse.", identity:"Dads who refuse to be the one who can't get on the floor anymore." },
  visual: { ai_video:"Open: a man in his 50s frozen halfway bent over a pair of sneakers in a quiet hallway, morning light. He gives up and sits. Cut to the same hallway weeks later — he ties both shoes standing, grabs a bag, scoops up a laughing kid. No on-screen text until the end card: 'Movement is the medicine your back forgot.' Documentary tone, handheld, natural light. No product, no bottle.", before_images:["hands fumbling laces, can't reach","wince gripping the doorframe to rise"], after_images:["tying shoes upright","carrying a child on his shoulders"], broll:["empty bed shot from the floor","getting out of a sedan slowly","later: walking a dog at dusk, easy stride"] } },
'peptide-tirzepatide': { // weight: fat -> fit (his flagship)
  audience_size: 100000000, search_volume: null, social_volume: null, cpc_usd: null,
  commercial_intent: 10, emotional_intensity: 9, visual_transformation_score: 10, ad_safety_score: 8,
  monetization_score: 10, wholesale_score: 8, white_label_score: 9, opportunity: 9.6,
  before_state: ["winded tying his shoes","always at the edge of the group photo","turns down the hike","only photographed from behind"],
  after_state: ["lean and energetic, front and center","tucked-in shirt","leading the hike","in every photo now"],
  angles: { transformation:"From the back of every photo to the front of it.", curiosity:"The 4-pounds rule: what every pound you carry does to your knees and back with each step.", frustration:"Twenty years of diets failed you. It was never about willpower.", identity:"People who got their body — and their knees and back — back." },
  visual: { ai_video:"Open: a heavier man hovering at the edge of every group photo, waving off the hike, sitting it out. Quiet. Cut: months later — lean, leading the same hike, front of the photo, taking the stairs two at a time, knees fine. End card: 'Less weight. Less wear. More life.' No product, no vial, no drug named. Warm, real, golden-hour.", before_images:["edge of a group photo, half-turned away","declining at the trailhead"], after_images:["front and center, arms up at a summit","two-at-a-time up stairs"], broll:["shirt fitting right in a mirror","kids racing him up a hill, he keeps up"] } },
'topic-026': { // sciatica
  audience_size: 40000000, commercial_intent: 9, emotional_intensity: 9, visual_transformation_score: 8, ad_safety_score: 9, monetization_score: 8, wholesale_score: 7, white_label_score: 7, opportunity: 8.7,
  before_state: ["electric shock down the leg every time he stands","using a cane at 45","calls out of work, can't sit at a desk"],
  after_state: ["walks the dog pain-free","sits through a whole movie","back on the bike"],
  angles: { transformation:"He needed a cane at 45. Watch him walk now.", curiosity:"Why the pain shoots down your LEG when the problem is in your back.", frustration:"Painkillers turned the volume down. They never found the pinched wire.", identity:"People who refused the surgery and got their walk back." },
  visual: { ai_video:"A man limping with a cane, gritting through each step. Cut: the cane leaning unused against a wall; he walks briskly, then rides a bike. End card: 'The nerve was the problem. Not the painkiller.' No product.", before_images:["leaning on a cane mid-stride, grimace"], after_images:["cane abandoned against a wall","riding a bike, relaxed"], broll:["clutching the low back standing from a chair","later: easy walk through a park"] } },
'topic-002': { // GLP-1 muscle loss
  audience_size: 25000000, commercial_intent: 9, emotional_intensity: 8, visual_transformation_score: 8, ad_safety_score: 9, monetization_score: 9, wholesale_score: 8, white_label_score: 8, opportunity: 8.8,
  before_state: ["lost 40 lbs but looks deflated","winded on the stairs even though he's thinner","arms gone soft, face gaunt"],
  after_state: ["lean and strong","carries the groceries in one trip","fills out the shirt again"],
  angles: { transformation:"She lost the weight. Then she lost her strength. Here's how she got it back.", curiosity:"The thing the shot takes that nobody warns you about — and it isn't fat.", frustration:"The scale went down. So did your muscle. They called it a win.", identity:"People on the shot who refuse to end up weak." },
  visual: { ai_video:"A woman thinner but slumped and tired, clothes hanging off her. Cut: same woman, posture up, lifting, energetic, glowing. End card: 'Lose the fat. Keep the engine.' No product.", before_images:["loose clothes, tired posture"], after_images:["strong stance, fitted clothes"], broll:["struggling up a flight of stairs","later: carrying all the groceries at once"] } },
'topic-040': { // Adderall focus + calm
  audience_size: 16000000, commercial_intent: 9, emotional_intensity: 9, visual_transformation_score: 7, ad_safety_score: 8, monetization_score: 8, wholesale_score: 6, white_label_score: 7, opportunity: 9.0,
  before_state: ["focused but vibrating with anxiety","jaw clenched, can't sit still","crashes at 4pm into irritability"],
  after_state: ["calm and focused","relaxed shoulders, even voice","steady all day, no crash"],
  angles: { transformation:"Focused — without the jaw-clench and the 4pm crash.", curiosity:"Why your focus pill makes you anxious, and what the anxiety is telling you.", frustration:"A stimulant that causes anxiety, then a sedative to mask it. That's the whole plan?", identity:"High-performers who want the focus without feeling like a live wire." },
  visual: { ai_video:"Split energy: a person jittery, tapping, jaw tight, eyes darting at a desk. Cut: same person calm, present, shoulders down, laughing with a coworker, still sharp. End card: 'Focus shouldn't cost you your calm.' No product.", before_images:["clenched jaw, tense at a laptop"], after_images:["relaxed, mid-laugh, still working"], broll:["leg bouncing under a desk","later: steady hands, slow exhale"] } },
'topic-044': { // Adderall insomnia
  audience_size: 16000000, commercial_intent: 8, emotional_intensity: 8, visual_transformation_score: 7, ad_safety_score: 8, monetization_score: 7, wholesale_score: 6, white_label_score: 6, opportunity: 8.1,
  before_state: ["3am, eyes open, heart still going","scrolling because sleep won't come","exhausted but wired"],
  after_state: ["asleep by 11, no morning fog","wakes up rested","phone face-down across the room"],
  angles: { transformation:"Wired at 3am to asleep by 11.", curiosity:"Why a focus drug keeps you staring at the ceiling at 3am.", frustration:"The sleeping pill knocked you out and left you foggy. That isn't sleep.", identity:"People who got real rest back without trading it for grogginess." },
  visual: { ai_video:"A face lit only by a phone in a dark room, wide awake, 3:11am on the clock. Cut: dark room, asleep, then soft morning light, awake and clear-eyed, phone untouched across the room. End card: 'Real sleep, not sedation.' No product.", before_images:["phone-lit face in the dark, eyes open"], after_images:["asleep, peaceful","morning light, rested"], broll:["clock reading 3:11","later: making coffee, unhurried"] } },
'topic-014': { // diabetic neuropathy
  audience_size: 10000000, commercial_intent: 9, emotional_intensity: 9, visual_transformation_score: 7, ad_safety_score: 9, monetization_score: 8, wholesale_score: 7, white_label_score: 7, opportunity: 8.3,
  before_state: ["can't feel his own feet","burning that keeps him up at night","afraid of falling"],
  after_state: ["feels the grass again","sleeps without the burning","walks with confidence"],
  angles: { transformation:"He couldn't feel his feet. Watch him walk on grass again.", curiosity:"Why diabetic nerve pain gets worse even when your sugar is controlled.", frustration:"Gabapentin numbed the alarm. It never touched the wire.", identity:"People who wanted their feet back, not just the volume turned down." },
  visual: { ai_video:"Careful, fearful steps, a hand always on the wall. Cut: barefoot on grass, eyes closed, a small smile feeling the ground. End card: 'A nerve can be more than just numbed.' No product.", before_images:["hand on wall, testing each step"], after_images:["barefoot on grass, at ease"], broll:["staring at feet that won't respond","later: walking a beach, steady"] } },
'topic-067': { // plantar fasciitis
  audience_size: 2000000, commercial_intent: 8, emotional_intensity: 8, visual_transformation_score: 8, ad_safety_score: 9, monetization_score: 7, wholesale_score: 6, white_label_score: 6, opportunity: 7.9,
  before_state: ["the stabbing first step out of bed","limping to the bathroom every morning","gave up running"],
  after_state: ["first step, no pain","morning run is back","stands all day at work, fine"],
  angles: { transformation:"The first step out of bed used to drop him. Not anymore.", curiosity:"Why your heel screams on the very first step every morning.", frustration:"Orthotics and rest cushioned it. They never rebuilt it.", identity:"Runners who got their mornings back." },
  visual: { ai_video:"A foot hits the floor first thing in the morning — a flinch, a grab for the wall, a hobble. Cut: weeks later, feet swing out of bed, a clean first step, lacing running shoes, out the door into dawn. End card: 'The first step shouldn't hurt.' No product.", before_images:["flinch on first step, hand on wall"], after_images:["clean step out of bed","lacing shoes at the door"], broll:["hobbling to the bathroom","later: running at sunrise"] } },
};

let ok=0, fail=0; const errs=[];
for (const [slug, ad] of Object.entries(ADS)) {
  try {
    const res = await fetch(`${B}/${slug}`, { method:'PATCH', headers:{'content-type':'application/json'}, body: JSON.stringify({ body_json: { ad }, change_note:'ad skeleton', created_by:'operator' }) });
    const j = await res.json();
    if (j.item && j.item.body_json && j.item.body_json.ad) ok++; else { fail++; errs.push(slug+': '+(j.error||res.status)); }
  } catch(e){ fail++; errs.push(slug+': '+e.message); }
}
console.log(`ad-skeletons patched=${ok} failed=${fail}`);
if (errs.length) console.log(errs.join('\n'));
