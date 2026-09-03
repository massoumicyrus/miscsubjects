#!/usr/bin/env node
// LAW: the public research library must list real article counts, not zeros.
// The legacy content_items table is empty; articles live in the articles table.

const PRODUCTION_ORIGIN = 'https://miscsubjects.com';

async function check() {
  let text;
  try {
    const res = await fetch(PRODUCTION_ORIGIN + '/content');
    text = await res.text();
  } catch (e) {
    console.error(JSON.stringify({ ok: false, law: 'CONTENT_COUNTER_LAW', error: e.message }));
    process.exit(1);
  }

  // Match the counts line by its text, not a class name — the markup class was
  // renamed once (library-counts → n) and the class-based match blocked every push.
  const match = text.match(/(\d+\s+primers\s*·\s*\d+\s+research articles\s*·\s*\d+\s+families)/);
  if (!match) {
    console.error(JSON.stringify({ ok: false, law: 'CONTENT_COUNTER_LAW', error: 'counts line not found on /content' }));
    process.exit(1);
  }

  const counts = match[1];
  const zeroPattern = /0\s+primers|0\s+research articles|0\s+families/;
  if (zeroPattern.test(counts)) {
    console.error(JSON.stringify({ ok: false, law: 'CONTENT_COUNTER_LAW', counts, error: 'counters are zero' }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, law: 'CONTENT_COUNTER_LAW', counts }));
}

check();
