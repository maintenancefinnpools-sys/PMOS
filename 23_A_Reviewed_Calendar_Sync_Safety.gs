/**
 * Guarded handoff from Calendar Sync Preview into the reviewed, durable
 * Calendar Sync executor.
 *
 * IMPORTANT: reviewed Calendar work must never be handed to the generic legacy
 * Job Engine. The reviewed queue prepared in 23_C is the authoritative ledger
 * and 23_B is the only executor allowed to consume it.
 */
function openSafeReviewedCalendarSyncPreview_() {
  const prepared = prepareReviewedCalendarSyncWindow_();
  showReviewedCalendarSyncExecutionWindow_(prepared);
  return prepared;
}

/** Compatibility helper retained for callers that only need preparation totals. */
function prepareSafeReviewedCalendarSync_() {
  const state = readReviewedCalendarSyncState_();
  if (state && state.status === 'Prepared') {
    return {
      sessionId: state.sessionId,
      planId: state.planId,
      sourceVersion: state.sourceVersion,
      calendarName: state.calendarName,
      total: state.total,
      creates: Number(state.expectedCreates || 0),
      updates: Number(state.expectedUpdates || 0),
      deletes: Number(state.expectedDeletes || 0),
      preflightWarnings: Array.isArray(state.preflightWarnings)
        ? state.preflightWarnings.slice()
        : [],
      preparedAt: state.updatedAt
    };
  }
  return prepareReviewedCalendarSyncWindow_();
}

/**
 * Displays a non-blocking execution monitor. Start only schedules the worker;
 * the browser call returns immediately and polls durable state every 2 seconds.
 */
function showReviewedCalendarSyncExecutionWindow_(prepared) {
  const snapshot = prepared || prepareSafeReviewedCalendarSync_();
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    * { box-sizing: border-box; }
    body { margin:0; padding:18px; font-family:Arial,sans-serif; color:#1f2937; }
    h2 { margin:0 0 6px; }
    .muted { color:#6b7280; font-size:13px; line-height:1.45; }
    .summary { margin:14px 0; padding:12px; background:#f3f4f6; border-radius:9px; line-height:1.5; white-space:pre-line; }
    .progress { height:14px; overflow:hidden; background:#e5e7eb; border-radius:8px; }
    .bar { width:0; height:100%; background:#2563eb; transition:width .25s ease; }
    .error { display:none; margin-top:10px; padding:10px; color:#991b1b; background:#fee2e2; border-radius:8px; white-space:pre-wrap; }
    .buttons { display:flex; gap:8px; margin-top:14px; }
    button { padding:9px 12px; border:0; border-radius:8px; font-weight:700; cursor:pointer; }
    .primary { color:white; background:#2563eb; }
    .secondary { color:#111827; background:#e5e7eb; }
    button:disabled { opacity:.45; cursor:default; }
  </style>
</head>
<body>
  <h2>Reviewed Calendar Sync</h2>
  <div class="muted">Only the reviewed, preflight-validated operation queue will be executed.</div>
  <div id="summary" class="summary">Prepared ${Number(snapshot.total || 0)} operation(s).\nCreates: ${Number(snapshot.creates || 0)}  Updates: ${Number(snapshot.updates || 0)}  Deletes: ${Number(snapshot.deletes || 0)}</div>
  <div class="progress"><div id="bar" class="bar"></div></div>
  <div id="error" class="error"></div>
  <div class="buttons">
    <button id="start" class="primary" onclick="startSync()">Start Sync</button>
    <button class="secondary" onclick="refresh()">Refresh</button>
    <button class="secondary" onclick="google.script.host.close()">Close</button>
  </div>
<script>
  var polling = false;
  function el(id){ return document.getElementById(id); }
  function message(error){ return error && error.message ? error.message : String(error || 'Unknown error'); }
  function fail(error){ el('error').style.display='block'; el('error').textContent=message(error); el('start').disabled=false; }
  function render(state){
    state = state || {};
    var total = Number(state.total || 0);
    var processed = Number(state.processed || 0);
    var percent = total > 0 ? Math.round(processed / total * 100) : 0;
    if (state.status === 'Complete') percent = 100;
    el('bar').style.width = Math.max(0,Math.min(100,percent)) + '%';
    var lines = [
      'Status: ' + String(state.status || 'Not prepared'),
      'Phase: ' + String(state.phase || ''),
      'Progress: ' + processed + ' / ' + total + ' (' + percent + '%)',
      'Remaining: ' + Number(state.remaining || 0),
      'Created: ' + Number(state.created || 0),
      'Updated: ' + Number(state.updated || 0),
      'Deleted: ' + Number(state.deleted || 0)
    ];
    if (state.currentOperation) lines.push('Current operation: ' + state.currentOperation);
    el('summary').textContent = lines.join('\\n');
    if (state.lastError) { el('error').style.display='block'; el('error').textContent=state.lastError; }
    else { el('error').style.display='none'; el('error').textContent=''; }
    el('start').disabled = state.status === 'Running' || state.status === 'Scheduled' || state.status === 'Complete';
  }
  function refresh(){
    if (polling) return;
    polling = true;
    google.script.run
      .withSuccessHandler(function(state){ polling=false; render(state); })
      .withFailureHandler(function(error){ polling=false; fail(error); })
      .getReviewedCalendarSyncStatus();
  }
  function startSync(){
    el('start').disabled=true;
    el('error').style.display='none';
    google.script.run
      .withSuccessHandler(function(state){ render(state); })
      .withFailureHandler(fail)
      .startReviewedCalendarSyncExecution();
  }
  refresh();
  setInterval(refresh, 2000);
</script>
</body>
</html>`).setWidth(650).setHeight(470);

  SpreadsheetApp.getUi().showModalDialog(html, 'Reviewed Calendar Sync');
}
