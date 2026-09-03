// A WRITE IS NOT DONE BECAUSE THE SERVER SAID 200.
//
// THE VISIBLE FAILURE (2026-08-04). LEADS_SHEET_SYNC reported success and the LEADS_ENRICHED tab
// did not exist. The Apps Script had answered:
//
//     HTTP 200:{"ok":true,"msg":"airunner up","ts":"2026-08-05T03:50:37.061Z"}
//
// That is the web app's health response. It carries ok:true, so every layer above treated it as a
// successful write. The two small tabs in the same flow returned {"ok":true,"tab":"...","rows":7}
// and really were written; the large one silently was not, at 5,000 rows, then 2,000, then 400.
//
// THE LAYER THAT PERMITTED IT. Nothing anywhere stated what a successful sheet write looks like.
// The caller checked the HTTP status and the presence of `ok`, both of which a health probe also
// satisfies. A response that answers a question nobody asked was indistinguishable from a receipt.
//
// THE INVARIANT. A write action must be answered by a response that NAMES WHAT IT WROTE. For a
// sheet write that is the tab and the row count. Anything else — a health payload, an empty body,
// an ok with no subject — is a failure, and is reported as one.
//
// Why this matters beyond one tab: a silent pass is worse than an error. An error gets fixed; a
// silent pass gets believed, and in this case it would have been reported to the owner's team as
// data they could go and read.

/** Actions that change something. Each must come back naming what it changed. */
const WRITE_ACTIONS = new Set([
  'sheets_replace_tab',
  'sheets_append_rows',
  'sheets_write_range',
  'sheets_clear_tab',
  'sheets_create_tab',
  'drive_write_file',
  'tasks_add',
  'calendar_create',
]);

/** The health payload the web app returns when it does not recognise or receive an action. */
function looksLikeHealthResponse(body) {
  return /"msg"\s*:\s*"airunner up"/i.test(body) || /^\s*airunner up\s*$/i.test(body);
}

/**
 * Check an airunner response against what the action promised to do.
 *
 * @param {string} action  the action name that was sent
 * @param {string} body    the raw response body, including any "HTTP nnn:" prefix the caller adds
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function checkAirunnerResponse(action, body) {
  const act = String(action || '').trim();
  const text = String(body == null ? '' : body);
  if (!WRITE_ACTIONS.has(act)) return { ok: true };

  // WHY THIS ONE IS RETRYABLE AND THE OTHERS ARE NOT.
  //
  // Traced 2026-08-05. A POST to the /exec URL is answered 302 → script.googleusercontent.com/macros/echo,
  // which serves the stored output of the execution that already ran and accepts GET only (POST to it
  // is 405). Intermittently the body never reaches doPost: the script's doGet runs instead and answers
  // the health payload. On the same run, `sheets_add_rows` came back with a clean unknown_action while
  // `sheets_append_rows` — a real, larger action in the same script — came back as health. Nothing was
  // wrong with the action; the transport dropped it. So this verdict means "send it again", not
  // "the write is impossible". The caller retries, and the contract still decides.
  if (looksLikeHealthResponse(text)) {
    return {
      ok: false,
      retryable: true,
      error: `airunner_health_response_instead_of_write: "${act}" was answered with the web app's `
        + 'health payload, which means the request body never reached doPost and the action never ran. '
        + 'The transport drops bodies intermittently and more often as they grow, so the caller retries '
        + 'and large writes go in chunks. The response was not a receipt and has not been counted as one.',
    };
  }

  // A partial body: doPost ran, JSON.parse threw part-way through. Same cause, same remedy.
  if (/Unterminated string in JSON|Unexpected end of JSON|SyntaxError[^"]*JSON/i.test(text)) {
    return {
      ok: false,
      retryable: true,
      error: `airunner_body_truncated_in_transit: "${act}" reached doPost with a partial body, which `
        + `threw while parsing. Retry, and split the payload. Response was: ${text.slice(0, 200)}`,
    };
  }

  // A real sheet write names the tab and how many rows landed.
  if (act.startsWith('sheets_')) {
    const named = /"tab"\s*:/.test(text);
    const counted = /"rows"\s*:\s*\d+/.test(text) || /"updated"\s*:\s*\d+/.test(text) || /"cleared"\s*:/.test(text);
    if (!named || !counted) {
      return {
        ok: false,
        error: `airunner_write_unconfirmed: "${act}" returned a response that does not name the tab `
          + 'and the number of rows written. A write is confirmed by what it changed, never by a '
          + `bare ok. Response was: ${text.slice(0, 200)}`,
      };
    }
  }

  if (/"ok"\s*:\s*false/i.test(text) || /"error"\s*:/i.test(text)) {
    return { ok: false, error: `airunner_reported_error: ${text.slice(0, 240)}` };
  }
  return { ok: true };
}

/** How many rows a confirmed sheet write actually landed, for reporting rather than guessing. */
export function rowsWritten(body) {
  const m = String(body || '').match(/"rows"\s*:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}
