
const PST_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

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
