/** Job Center adapter for the reviewed Calendar Sync queue worker. */

/** Public HTML-service endpoint. */
function getReviewedCalendarSyncJobCenterStatus() {
  return runReviewedCalendarJobCenterEndpoint_(
    'getReviewedCalendarSyncJobCenterStatus',
    function () { return getReviewedCalendarSyncJobCenterStatus_(); }
  );
}

/** Public HTML-service endpoint. */
function startReviewedCalendarSyncJobCenterExecution() {
  return runReviewedCalendarJobCenterEndpoint_(
    'startReviewedCalendarSyncJobCenterExecution',
    function () { return startReviewedCalendarSyncJobCenterExecution_(); }
  );
}

/** Public HTML-service endpoint. */
function pauseReviewedCalendarSyncJobCenterExecution() {
  return runReviewedCalendarJobCenterEndpoint_(
    'pauseReviewedCalendarSyncJobCenterExecution',
    function () { return pauseReviewedCalendarSyncJobCenterExecution_(); }
  );
}

/** Public HTML-service endpoint. */
function resumeReviewedCalendarSyncJobCenterExecution() {
  return runReviewedCalendarJobCenterEndpoint_(
    'resumeReviewedCalendarSyncJobCenterExecution',
    function () { return resumeReviewedCalendarSyncJobCenterExecution_(); }
  );
}

function runReviewedCalendarJobCenterEndpoint_(name, callback) {
  try {
    return {
      ok: true,
      endpoint: String(name || ''),
      result: callback()
    };
  } catch (error) {
    return {
      ok: false,
      endpoint: String(name || ''),
      error: String(error && error.message ? error.message : error),
      stack: String(error && error.stack ? error.stack : '')
    };
  }
}

function getReviewedCalendarSyncJobCenterStatus_() {
  const detailed = typeof getReviewedCalendarSyncDetailedStatus === 'function'
    ? getReviewedCalendarSyncDetailedStatus()
    : getReviewedCalendarSyncStatus();
  const status = String(detailed && detailed.status || 'Not prepared');
  return {
    type: 'CALENDAR_SYNC',
    label: 'Calendar Sync',
    status: status,
    originalTotal: Number(detailed && detailed.total || 0),
    remaining: Number(detailed && detailed.remaining || 0),
    processedItems: Number(detailed && detailed.processed || 0),
    created: Number(detailed && detailed.created || 0),
    updated: Number(detailed && detailed.updated || 0),
    deleted: Number(detailed && detailed.deleted || 0),
    attempts: Number(detailed && detailed.attempts || 0),
    retries: Number(detailed && detailed.retries || 0),
    currentOperation: String(detailed && detailed.currentOperation || ''),
    lastError: String(detailed && detailed.lastError || ''),
    lastSummary: buildReviewedCalendarJobCenterSummary_(detailed || {}),
    calendarName: String(detailed && detailed.calendarName || ''),
    reviewedQueue: true
  };
}

function startReviewedCalendarSyncJobCenterExecution_() {
  startReviewedCalendarSyncExecution();
  return getReviewedCalendarSyncJobCenterStatus_();
}

function pauseReviewedCalendarSyncJobCenterExecution_() {
  const state = readReviewedCalendarSyncState_();
  if (!state) return getReviewedCalendarSyncJobCenterStatus_();
  if (['Complete', 'Cancelled', 'Paused on error'].indexOf(String(state.status || '')) >= 0) {
    return getReviewedCalendarSyncJobCenterStatus_();
  }

  state.pauseRequested = true;
  state.status = 'Paused';
  state.phase = 'Paused by user';
  state.updatedAt = new Date().toISOString();
  writeReviewedCalendarSyncState_(state);
  removeReviewedCalendarSyncTriggers_();
  return getReviewedCalendarSyncJobCenterStatus_();
}

function resumeReviewedCalendarSyncJobCenterExecution_() {
  const state = readReviewedCalendarSyncState_();
  if (!state) throw new Error('Calendar Sync has not been prepared. Approve the Calendar Sync Preview first.');
  state.pauseRequested = false;
  if (String(state.status || '') === 'Paused') {
    state.status = 'Prepared';
    state.phase = 'Ready to continue';
    state.updatedAt = new Date().toISOString();
    writeReviewedCalendarSyncState_(state);
  }
  return startReviewedCalendarSyncJobCenterExecution_();
}

function buildReviewedCalendarJobCenterSummary_(state) {
  const lines = [];
  if (state.calendarName) lines.push('Target Calendar: ' + state.calendarName);
  lines.push('Phase: ' + String(state.phase || state.status || 'Not prepared'));
  lines.push(
    'Processed ' + Number(state.processed || 0) +
    ' of ' + Number(state.total || 0) +
    ' • Remaining ' + Number(state.remaining || 0)
  );
  lines.push(
    'Creates ' + Number(state.created || 0) +
    ' • Updates ' + Number(state.updated || 0) +
    ' • Deletes ' + Number(state.deleted || 0)
  );
  if (state.currentOperation) lines.push('Current: ' + state.currentOperation);
  if (state.retries) lines.push('Retries: ' + Number(state.retries || 0));
  return lines.join('\n');
}
