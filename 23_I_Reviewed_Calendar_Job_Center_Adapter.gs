/** Job Center adapter for the reviewed Calendar Sync queue worker. */
const PMOS_REVIEWED_SYNC_PUBLIC_TRIGGER = 'runReviewedCalendarSyncWorker';
const PMOS_REVIEWED_SYNC_STALE_SCHEDULE_MS = 20000;

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

/** Public installable-trigger entry point. */
function runReviewedCalendarSyncWorker() {
  return runReviewedCalendarSyncWorker_();
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
  repairStaleReviewedCalendarSyncSchedule_();
  const detailed = typeof getReviewedCalendarSyncDetailedStatus === 'function'
    ? getReviewedCalendarSyncDetailedStatus()
    : getReviewedCalendarSyncStatus();
  const status = String(detailed && detailed.status || 'Not prepared');
  return {
    type: 'CALENDAR_SYNC',
    label: 'Calendar Sync',
    status: status,
    phase: String(detailed && detailed.phase || ''),
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
    startedAt: String(detailed && detailed.startedAt || ''),
    updatedAt: String(detailed && detailed.updatedAt || ''),
    completedAt: String(detailed && detailed.completedAt || ''),
    reviewedQueue: true
  };
}

function startReviewedCalendarSyncJobCenterExecution_() {
  startReviewedCalendarSyncExecution();
  armReviewedCalendarSyncPublicTrigger_();
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
  removeReviewedCalendarSyncPublicTriggers_();
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

function repairStaleReviewedCalendarSyncSchedule_() {
  const state = readReviewedCalendarSyncState_();
  if (!state || String(state.status || '') !== 'Scheduled') return false;

  const updatedAt = new Date(state.updatedAt || state.startedAt || 0).getTime();
  const stale = !Number.isFinite(updatedAt) ||
    Date.now() - updatedAt >= PMOS_REVIEWED_SYNC_STALE_SCHEDULE_MS;
  const hasTrigger = ScriptApp.getProjectTriggers().some(function (trigger) {
    const handler = trigger.getHandlerFunction();
    return handler === PMOS_REVIEWED_SYNC_PUBLIC_TRIGGER ||
      handler === PMOS_REVIEWED_SYNC_TRIGGER;
  });

  if (!hasTrigger || stale) {
    armReviewedCalendarSyncPublicTrigger_();
    state.phase = stale
      ? 'Restarting delayed execution worker'
      : 'Starting execution worker';
    state.updatedAt = new Date().toISOString();
    writeReviewedCalendarSyncState_(state);
    return true;
  }
  return false;
}

function armReviewedCalendarSyncPublicTrigger_() {
  removeReviewedCalendarSyncTriggers_();
  removeReviewedCalendarSyncPublicTriggers_();
  ScriptApp.newTrigger(PMOS_REVIEWED_SYNC_PUBLIC_TRIGGER)
    .timeBased()
    .after(1000)
    .create();
}

function removeReviewedCalendarSyncPublicTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === PMOS_REVIEWED_SYNC_PUBLIC_TRIGGER) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
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
