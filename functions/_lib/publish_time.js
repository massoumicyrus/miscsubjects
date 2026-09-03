// WHEN A THING WAS POSTED, AND WHEN IT WAS LAST CHANGED — one formatter, used everywhere.
//
// Owner, 2026-08-04: "i want articles when updated to go up to newest but for there to be a
// distinction between when things are posted versus updated… there should be a machine readable
// ledger but right now it isn't legible on the homepage. it stops at the calendar date (not the
// time). it should say down to the hour PST 2026.01.01.23.59 PST".
//
// Two separate facts were being collapsed into one. The homepage sorted by updated_at and printed
// updated_at truncated to ten characters, so a page rewritten today and a page first published today
// were indistinguishable, and the time of day — which is the part that makes a feed legible when
// several things land in one day — was thrown away.
//
// The list still orders by last change, because that is what the owner asked for. What changes is
// that the card now says which of the two facts it is showing, and shows it to the minute.

const PST_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

/**
 * `2026.01.01.23.59 PST` — the owner's format, in Pacific time, to the minute.
 *
 * The zone label is computed rather than hard-coded: Los Angeles is PST for part of the year and
 * PDT for the rest, and printing "PST" through the summer would be a wrong timestamp that looks
 * precise. Anyone reconciling a card against the ledger would be an hour out for eight months.
 */
export function pacificStamp(iso) {
  const s = String(iso || '').trim();
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const parts = {};
  for (const p of PST_FORMAT.formatToParts(d)) parts[p.type] = p.value;
  const zone = pacificZoneLabel(d);
  return `${parts.year}.${parts.month}.${parts.day}.${parts.hour}.${parts.minute} ${zone}`;
}

/** PST or PDT, decided by the offset the date actually has in Los Angeles. */
export function pacificZoneLabel(date) {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', timeZoneName: 'short',
  }).formatToParts(date).find((p) => p.type === 'timeZoneName');
  return label ? label.value : 'PT';
}

// A change this long after first publication is a revision of an existing page rather than the tail
// of publishing it. Below this, the two timestamps are the same event: written, then tidied.
const SAME_EVENT_MS = 6 * 60 * 60 * 1000;

/**
 * Which fact the card should state, and how to mark it.
 *
 * @returns {{state:'posted'|'updated', label:string, stamp:string, posted:string, updated:string, dot:'new'|'revised'}}
 */
export function publishState(createdAt, updatedAt) {
  const created = String(createdAt || '').trim();
  const updated = String(updatedAt || created || '').trim();
  const cd = new Date(created);
  const ud = new Date(updated);
  const bothValid = !Number.isNaN(cd.getTime()) && !Number.isNaN(ud.getTime());
  const revised = bothValid && (ud.getTime() - cd.getTime()) > SAME_EVENT_MS;
  return {
    state: revised ? 'updated' : 'posted',
    label: revised ? 'updated' : 'posted',
    stamp: pacificStamp(revised ? updated : created),
    posted: pacificStamp(created),
    updated: pacificStamp(updated),
    dot: revised ? 'revised' : 'new',
  };
}

/** The machine-readable pair, for the JSON projections and for a reader who wants both. */
export function publishLedgerEntry(slug, createdAt, updatedAt) {
  const st = publishState(createdAt, updatedAt);
  return {
    slug,
    state: st.state,
    posted_at: String(createdAt || ''),
    updated_at: String(updatedAt || ''),
    posted_pacific: st.posted,
    updated_pacific: st.updated,
  };
}
