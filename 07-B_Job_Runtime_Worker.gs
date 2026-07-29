/**
 * PMOS runtime-based Job Engine worker.
 *
 * This module supplies the shared execution loop for long-running PMOS jobs.
 * Job-specific adapters provide one safe operation at a time. The worker saves
 * state and checks Pause after every operation, then yields before the Apps
 * Script execution window becomes unsafe.
 */

const PMOS_JOB_RUNTIME_LIMIT_MS = 45 * 1000;
const PMOS_JOB_RUNTIME_SAFETY_MS = 3 * 1000;
const PMOS_JOB_NORMAL_CONTINUATION_MS = 2 * 1000;
const PMOS_JOB_BACKOFF_DELAYS_MS = [
  30 * 1000,
  2 * 60 * 1000,
  5 * 60 * 1000,
  20 * 60 * 1000
];

/**
 * Runs job operations until the runtime budget is nearly exhausted, the job
 * completes, Pause is requested, or Google requires adaptive backoff.
 *
 * executeNextOperation(state) must return an object with these optional fields:
 *   processed: number of successfully completed work items (normally 1)
 *   remaining: remaining work after this operation
 *   complete: whether all work is complete
 *   summary: user-facing progress summary
 *   error: non-throwing operation error
 */
function runPmosRuntimeWorker_(executeNextOperation) {
  if (typeof executeNextOperation !== 'function') {
    throw new Error('A PMOS runtime operation adapter is required.');
  }

  const startedAt = Date.now();
  const deadline =
    startedAt +
    PMOS_JOB_RUNTIME_LIMIT_MS -
    PMOS_JOB_RUNTIME_SAFETY_MS;

  let state = readPmosJobState_();
  if (!state) throw new Error('No active PMOS job.');

  state.status = 'Running';
  state.lastError = '';
  state.lastRunAt = new Date().toISOString();
  state.nextRunAt = '';
  state.workerStartedAt = state.lastRunAt;
  writePmosJobState_(state);

  let operationsThisRun = 0;

  while (Date.now() < deadline) {
    state = readPmosJobState_() || state;

    if (state.status === 'Paused' || !state.autoEnabled && state.pauseRequested) {
      return finalizePmosRuntimePause_(state, operationsThisRun);
    }

    let operationResult;
    try {
      operationResult = executeNextOperation(state) || {};
    } catch (error) {
      return handlePmosRuntimeWorkerError_(
        state,
        error,
        operationsThisRun
      );
    }

    operationsThisRun++;
    state = mergePmosRuntimeOperationResult_(
      readPmosJobState_() || state,
      operationResult,
      operationsThisRun
    );
    writePmosJobState_(state);

    // Re-read persisted state so a Pause request made while the Calendar call
    // was running is honoured before another operation begins.
    const persisted = readPmosJobState_() || state;
    if (persisted.status === 'Paused' || persisted.pauseRequested) {
      return finalizePmosRuntimePause_(persisted, operationsThisRun);
    }

    if (operationResult.complete || Number(state.remaining || 0) === 0) {
      return finalizePmosRuntimeComplete_(state, operationsThisRun);
    }

    if (operationResult.error) {
      return handlePmosRuntimeWorkerError_(
        state,
        new Error(String(operationResult.error)),
        operationsThisRun
      );
    }
  }

  return finalizePmosRuntimeYield_(state, operationsThisRun, startedAt);
}

function mergePmosRuntimeOperationResult_(state, result, operationsThisRun) {
  const processed = Math.max(0, Number(result.processed || 0));
  const remaining = result.remaining == null
    ? state.remaining
    : Math.max(0, Number(result.remaining || 0));

  state.processedItems = Number(state.processedItems || 0) + processed;
  state.remaining = remaining;
  state.originalTotal = Math.max(
    Number(state.originalTotal || 0),
    Number(state.processedItems || 0) + Number(remaining || 0)
  );
  state.operationsThisRun = operationsThisRun;
  state.lastOperationAt = new Date().toISOString();
  state.lastSummary = String(
    result.summary ||
    state.lastSummary ||
    `${state.processedItems} item(s) processed.`
  );
  state.lastError = '';
  state.backoffLevel = Math.max(0, Number(state.backoffLevel || 0) - 1);
  return state;
}

function finalizePmosRuntimePause_(state, operationsThisRun) {
  state.status = 'Paused';
  state.autoEnabled = false;
  state.pauseRequested = false;
  state.nextRunAt = '';
  state.operationsThisRun = operationsThisRun;
  state.lastSummary = operationsThisRun
    ? `Paused after ${operationsThisRun} operation(s) in the current worker run.`
    : 'Paused before another operation began.';
  writePmosJobState_(state);
  removePmosJobTrigger_();
  return getPmosJobStatus();
}

function finalizePmosRuntimeComplete_(state, operationsThisRun) {
  state.status = 'Complete';
  state.autoEnabled = false;
  state.pauseRequested = false;
  state.remaining = 0;
  state.nextRunAt = '';
  state.completedBatches = Number(state.completedBatches || 0) + 1;
  state.operationsThisRun = operationsThisRun;
  state.completedAt = new Date().toISOString();
  state.backoffLevel = 0;
  writePmosJobState_(state);
  removePmosJobTrigger_();
  appendPmosJobHistory_(state, 'COMPLETE', state.lastSummary || 'Job complete.');
  return getPmosJobStatus();
}

function finalizePmosRuntimeYield_(state, operationsThisRun, startedAt) {
  state.completedBatches = Number(state.completedBatches || 0) + 1;
  state.operationsThisRun = operationsThisRun;
  state.lastWorkerDurationMs = Date.now() - startedAt;

  if (state.autoEnabled) {
    state.status = 'Waiting';
    state.nextRunAt = new Date(
      Date.now() + PMOS_JOB_NORMAL_CONTINUATION_MS
    ).toISOString();
    writePmosJobState_(state);
    schedulePmosRuntimeContinuation_(PMOS_JOB_NORMAL_CONTINUATION_MS);
  } else {
    state.status = 'Paused';
    state.nextRunAt = '';
    writePmosJobState_(state);
    removePmosJobTrigger_();
  }

  return getPmosJobStatus();
}

function handlePmosRuntimeWorkerError_(state, error, operationsThisRun) {
  const message = String(
    error && error.message ? error.message : error || 'Unknown error'
  );

  state.operationsThisRun = operationsThisRun;
  state.lastError = message;

  if (isPmosRetryableCalendarError_(message) && state.autoEnabled) {
    const level = Math.min(
      PMOS_JOB_BACKOFF_DELAYS_MS.length - 1,
      Math.max(0, Number(state.backoffLevel || 0))
    );
    const delay = PMOS_JOB_BACKOFF_DELAYS_MS[level];

    state.backoffLevel = Math.min(
      PMOS_JOB_BACKOFF_DELAYS_MS.length - 1,
      level + 1
    );
    state.status = 'Waiting for Google';
    state.lastSummary =
      'Google temporarily limited the Calendar operation. ' +
      'PMOS saved progress and will retry automatically.';
    state.nextRunAt = new Date(Date.now() + delay).toISOString();
    writePmosJobState_(state);
    schedulePmosRuntimeContinuation_(delay);
    return getPmosJobStatus();
  }

  state.status = 'Paused on error';
  state.autoEnabled = false;
  state.nextRunAt = '';
  writePmosJobState_(state);
  removePmosJobTrigger_();
  appendPmosJobHistory_(state, 'ERROR', message);
  throw error;
}

function isPmosRetryableCalendarError_(message) {
  return (
    /too many changes/i.test(message) ||
    /creating or deleting too many/i.test(message) ||
    /service invoked too many times/i.test(message) ||
    /rate limit/i.test(message) ||
    /quota exceeded/i.test(message) ||
    /user rate limit exceeded/i.test(message) ||
    /calendar usage limits exceeded/i.test(message) ||
    /resource has been exhausted/i.test(message) ||
    /try again later/i.test(message) ||
    /service unavailable/i.test(message) ||
    /internal error/i.test(message) ||
    /timed out/i.test(message) ||
    /timeout/i.test(message)
  );
}

/**
 * Schedules a one-time continuation. Apps Script may round very short delays,
 * but using a one-time trigger avoids retaining the old fixed one-minute loop.
 */
function schedulePmosRuntimeContinuation_(delayMs) {
  removePmosJobTrigger_();
  ScriptApp.newTrigger(PMOS_JOB_TRIGGER_HANDLER)
    .timeBased()
    .after(Math.max(1000, Number(delayMs || 0)))
    .create();
}

/**
 * Records a Pause request without waiting for the current Calendar operation.
 * The runtime worker re-reads this flag before beginning its next operation.
 */
function requestPmosRuntimePause_() {
  const state = readPmosJobState_();
  if (!state) return getPmosJobStatus();

  state.pauseRequested = true;
  state.autoEnabled = false;
  state.status = state.status === 'Running'
    ? 'Pausing'
    : 'Paused';
  state.nextRunAt = '';
  writePmosJobState_(state);
  removePmosJobTrigger_();
  return getPmosJobStatus();
}
