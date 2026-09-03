// BUILD LAW — TIME. One source of time for every product timestamp: the server clock,
// represented in America/Los_Angeles (Pacific). No model-, client-, or body-supplied time is
// honored anywhere. Every ledger event, invocation, receipt, token, article, claim, and entry
// is stamped by buildNowIso(). This makes an inaccurate or future-dated timestamp structurally
// impossible: there is no input path for time.
//
// Format: Pacific-offset ISO 8601, e.g. 2026-07-02T19:04:31-07:00. It is a valid absolute
// instant (Date parses it) and its calendar date is the Pacific date, so a reader never
// misreads an evening post as "tomorrow". Offset tracks PST/PDT automatically.

export const BUILD_TZ = "America/Los_Angeles";

function partsInTZ(d) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUILD_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });
  const p = {};
  for (const { type, value } of f.formatToParts(d)) p[type] = value;
  return p;
}

function offsetString(d) {
  const p = partsInTZ(d);
  const asIfUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const diffMin = Math.round((asIfUTC - d.getTime()) / 60000);
  const sign = diffMin >= 0 ? "+" : "-";
  const abs = Math.abs(diffMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

/** The one canonical timestamp. Server clock only, Pacific-offset ISO. Ignores all arguments
 *  except an explicit epoch (used only for deriving a lookback bound, never from model input). */
export function buildNowIso(ms) {
  const d = ms != null ? new Date(ms) : new Date();
  const p = partsInTZ(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offsetString(d)}`;
}

/** Server epoch milliseconds (true instant). */
export function buildNowMs() {
  return Date.now();
}

/** Pacific-offset ISO for a point `hoursAgo` before now — for lookback query bounds. */
export function buildSinceIso(hoursAgo) {
  return buildNowIso(Date.now() - Number(hoursAgo || 0) * 3600 * 1000);
}

/** Pacific-offset ISO for a future instant `sec` seconds from now — for expiry display. */
export function buildFutureIso(sec) {
  return buildNowIso(Date.now() + Number(sec || 0) * 1000);
}

/** HARD LOCK helper: remove any caller-supplied time fields from an inbound body so no write
 *  can carry its own timestamp. Call at every mutating entry point before stamping. */
export function stripClientTime(obj) {
  if (!obj || typeof obj !== "object") return obj;
  for (const k of ["now", "ts", "timestamp", "created_at", "updated_at", "date", "time", "posted_at"]) {
    if (k in obj) delete obj[k];
  }
  return obj;
}
