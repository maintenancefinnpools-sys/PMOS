/** Job Center adapter for the reviewed Calendar Sync queue worker. */
const PMOS_REVIEWED_SYNC_PUBLIC_TRIGGER = 'runReviewedCalendarSyncWorker';

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

/**
 * Explicit retry endpoint for a queue paused on error. Recovery is analyzed
 * first; ambiguous transaction state remains blocked. Only then are failed
 * queue rows returned to Pending for idempotent replay.
 */
function retryReviewedCalendarSyncJobCenterExecution() {
  return runReviewedCalendarJobCenterEndpoint_(
    'retryReviewedCalendarSyncJobCenterExecution',
    function () { return retryReviewedCalendarSyncJobCenterExecution_(); }
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
    reviewedQueue: true,
    canRetry: status === 'Paused on error'
  };
}

function startReviewedCalendarSyncJobCenterExecution_() {
  const state = readReviewedCalendarSyncState_();
  if (state && String(state.status || '') === 'Paused on error') {
    throw new Error(
      'Calendar Sync is paused on an error. Use Retry After Recovery so PMOS can verify transaction state before replaying the operation.'
    );
  }
  startReviewedCalendarSyncExecution();

  // Run the first bounded pass immediately while this authorized HTML-service
  // request is active. This avoids waiting on Google's best-effort clock
  // scheduler for ordinary queues. The worker schedules a resumable trigger
  // itself only when operations remain after its safe pass limit.
  runReviewedCalendarSyncWorker_();
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
  if (!state) {
    throw new Error(
      'Calendar Sync has not been prepared. Complete Calendar Plan Audit and approve the Sync Preview first.'
    );
  }
  if (String(state.status || '') === 'Paused on error') {
    throw new Error(
      'Calendar Sync is paused on an error. Use Retry After Recovery instead of Resume.'
    );
  }

  state.pauseRequested = false;
  if (String(state.status || '') === 'Paused') {
    state.status = 'Prepared';
    state.phase = 'Ready to continue';
    state.updatedAt = new Date().toISOString();
    writeReviewedCalendarSyncState_(state);
  }
  return startReviewedCalendarSyncJobCenterExecution_();
}

function retryReviewedCalendarSyncJobCenterExecution_() {
  let state = readReviewedCalendarSyncState_();
  if (!state || !state.planId) {
    throw new Error(
      'Calendar Sync has no prepared reviewed queue. Run Calendar Plan Audit again.'
    );
  }
  if (String(state.status || '') !== 'Paused on error') {
    throw new Error('Calendar Sync is not paused on an error.');
  }

  const session = requireActivePmosReviewSession_('CALENDAR');
  if (String(session.id || '') !== String(state.sessionId || '')) {
    throw new Error(
      'The Calendar Review Session changed after this queue was prepared. Run Calendar Plan Audit again.'
    );
  }

  const recovery = recoverPmosCalendarRegistryTransactions_();
  assertNoAmbiguousPmosCalendarRecovery_(recovery);

  const reset = resetReviewedCalendarErrorRowsForRetry_(state);
  if (!reset) {
    throw new Error(
      'No failed queue operation was available to retry. Run Calendar Plan Audit again if the queue is inconsistent.'
    );
  }

  state = readReviewedCalendarSyncState_() || state;
  state.status = 'Prepared';
  state.phase = 'Recovery verified; ready to retry';
  state.pauseRequested = false;
  state.failed = 0;
  state.lastError = '';
  state.currentOperation = '';
  state.updatedAt = new Date().toISOString();
  writeReviewedCalendarSyncState_(state);

  startReviewedCalendarSyncExecution();

  // Run the first bounded pass immediately while this authorized HTML-service
  // request is active. This avoids waiting on Google's best-effort clock
  // scheduler for ordinary queues. The worker schedules a resumable trigger
  // itself only when operations remain after its safe pass limit.
  runReviewedCalendarSyncWorker_();
  return getReviewedCalendarSyncJobCenterStatus_();
}

function resetReviewedCalendarErrorRowsForRetry_(state) {
  const total = Number(state && state.total || 0);
  if (total <= 0) return 0;

  const sheet = ensureReviewedCalendarSyncQueueSheet_();
  if (sheet.getLastRow() < total + 1) {
    throw new Error('Calendar Sync queue is missing one or more expected rows.');
  }

  const rows = sheet.getRange(
    2,
    1,
    total,
    PMOS_REVIEWED_SYNC_QUEUE_HEADERS.length
  ).getValues();
  let reset = 0;
  let encounteredIncomplete = false;

  for (let index = 0; index < rows.length; index++) {
    const status = String(rows[index][4] || '');
    if (status === 'Complete') {
      if (encounteredIncomplete) {
        throw new Error(
          'Calendar Sync queue contains a Complete row after incomplete work. ' +
          'PMOS will not rewrite the queue automatically.'
        );
      }
      continue;
    }

    encounteredIncomplete = true;
    if (status === 'Running') {
      throw new Error(
        'Calendar Sync queue still contains a Running operation. Run transaction recovery again before retrying.'
      );
    }
    if (status === 'Error') {
      sheet.getRange(index + 2, 5, 1, 4).setValues([[
        'Pending',
        Number(rows[index][5] || 0),
        new Date(),
        'Retry authorized after deterministic recovery analysis.'
      ]]);
      reset++;
    }
  }

  return reset;
}

function repairStaleReviewedCalendarSyncSchedule_() {
  const state = readReviewedCalendarSyncState_();
  if (!state || String(state.status || '') !== 'Scheduled') return false;

  const hasTrigger = ScriptApp.getProjectTriggers().some(function (trigger) {
    const handler = trigger.getHandlerFunction();
    return handler === PMOS_REVIEWED_SYNC_PUBLIC_TRIGGER ||
      handler === PMOS_REVIEWED_SYNC_TRIGGER;
  });

  // Apps Script's after() delay is a minimum, not a firing deadline. Status is
  // polled every two seconds, so replacing an existing trigger on elapsed time
  // can perpetually postpone the worker. Re-arm only when no worker trigger
  // exists; one-shot triggers disappear after firing.
  if (!hasTrigger) {
    armReviewedCalendarSyncPublicTrigger_();
    state.phase = 'Starting execution worker';
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
  if (String(state.status || '') === 'Paused on error') {
    lines.push('Use Retry After Recovery after correcting the reported problem.');
  }
  return lines.join('\n');
}
