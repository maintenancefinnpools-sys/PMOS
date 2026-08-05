/**
 * Guarded handoff from Calendar Review into Calendar Sync execution.
 *
 * This window is intentionally separate from the legacy Job Engine. It proves
 * that the active Review Session produces a non-empty executable planner queue
 * before Calendar mutation is allowed.
 */
function openSafeReviewedCalendarSyncPreview_() {
  const prepared = prepareSafeReviewedCalendarSync_();

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}
    h2{margin:0 0 6px}.muted{font-size:13px;color:#6b7280;line-height:1.4}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}
    .card{padding:11px;border-radius:9px;background:#f3f4f6}
    .card b{font-size:20px}.ready{background:#dcfce7;color:#166534}
    .notice{padding:12px;border-radius:9px;background:#eff6ff;color:#1e3a8a;line-height:1.45}
    .details{margin-top:13px;padding:12px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:9px;white-space:pre-wrap;font-size:13px;line-height:1.45}
    .buttons{display:flex;gap:8px;margin-top:16px}
    button{border:0;border-radius:8px;padding:9px 13px;font-weight:700;cursor:pointer}
    .primary{background:#2563eb;color:#fff}.secondary{background:#e5e7eb;color:#111827}
  </style>
</head>
<body>
  <h2>Calendar Sync</h2>
  <div class="muted">Reviewed Calendar plan prepared. No Calendar changes have started.</div>

  <div class="summary">
    <div class="card ready"><b>${prepared.total}</b><br><small>Total operations</small></div>
    <div class="card"><b>${prepared.creates}</b><br><small>Creates</small></div>
    <div class="card"><b>${prepared.updates}</b><br><small>Updates</small></div>
    <div class="card"><b>${prepared.deletes}</b><br><small>Deletes</small></div>
  </div>

  <div class="notice">
    PMOS has validated the reviewed operation queue. The execution worker is
    being connected to this queue before another live Calendar test is allowed.
  </div>

  <div class="details">${escapeHtml_(prepared.summary)}</div>

  <div class="buttons">
    <button class="secondary" onclick="google.script.host.close()">Close</button>
  </div>
</body>
</html>`).setWidth(680).setHeight(470);

  SpreadsheetApp.getUi().showModalDialog(html, 'Reviewed Calendar Sync');
  return prepared;
}

function prepareSafeReviewedCalendarSync_() {
  const session = requireActivePmosReviewSession_('CALENDAR');
  const result = buildValidatedPmosCalendarSyncPlan_({});
  const plan = result && result.plan;

  if (!plan || !Array.isArray(plan.operations)) {
    throw new Error('Calendar Sync could not build the reviewed operation plan.');
  }
  if (!result.canExecute) {
    throw new Error(
      'The reviewed Calendar plan is not executable. Resolve all planner, validation, and review errors before syncing.'
    );
  }

  const executable = plan.operations.filter(isPmosExecutableOperation);
  const counts = executable.reduce(function (accumulator, operation) {
    const action = String(operation && operation.action || '').toUpperCase();
    if (action === String(PMOS_OPERATION.CREATE).toUpperCase()) accumulator.creates++;
    else if (action === String(PMOS_OPERATION.UPDATE).toUpperCase()) accumulator.updates++;
    else if (action === String(PMOS_OPERATION.DELETE).toUpperCase()) accumulator.deletes++;
    return accumulator;
  }, {creates: 0, updates: 0, deletes: 0});

  const total = executable.length;
  const reviewDecisionCount = Object.keys(session.decisions || {}).length;
  if (total === 0) {
    throw new Error(
      'Calendar Sync produced zero executable operations from ' + reviewDecisionCount +
      ' reviewed decision(s). PMOS stopped before making Calendar changes because this would be a false completion.'
    );
  }

  const prepared = {
    sessionId: session.id,
    planId: String(plan.id || ''),
    sourceVersion: String(plan.metadata && plan.metadata.sourceVersion || ''),
    total: total,
    creates: counts.creates,
    updates: counts.updates,
    deletes: counts.deletes,
    reviewDecisionCount: reviewDecisionCount,
    preparedAt: new Date().toISOString()
  };

  PropertiesService.getDocumentProperties().setProperty(
    'PMOS_REVIEWED_CALENDAR_SYNC_PREPARED',
    JSON.stringify(prepared)
  );

  prepared.summary = [
    'Review session: ' + prepared.sessionId,
    'Plan: ' + prepared.planId,
    'Reviewed decisions: ' + prepared.reviewDecisionCount,
    'Executable operations: ' + prepared.total,
    'Creates: ' + prepared.creates,
    'Updates: ' + prepared.updates,
    'Deletes: ' + prepared.deletes
  ].join('\n');

  return prepared;
}
