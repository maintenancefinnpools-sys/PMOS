/**
 * Activates the runtime-based Job Engine for all queued PMOS jobs.
 *
 * The public Job Engine entry points are preserved, but the runtime worker is
 * now the only execution path. Job types without a registered operation
 * provider fail explicitly instead of falling back to legacy batch execution.
 */

/**
 * Compatibility entry point used by the existing Job Engine UI and menu code.
 * The name is retained until the Job UI is refactored.
 */
function runPmosJobBatch_() {
  const state = readPmosJobState_();
  if (!state) throw new Error('No active PMOS job.');

  return runPmosRuntimeWorker_(executeNextJobOperation_);
}

/**
 * Trigger handler for the runtime worker.
 */
function runPmosJobTrigger_() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) return;

  try {
    const state = readPmosJobState_();
    if (!state || !state.autoEnabled) {
      removePmosJobTrigger_();
      return;
    }

    if (state.nextRunAt) {
      const nextRunTime = new Date(state.nextRunAt).getTime();
      if (Number.isFinite(nextRunTime) && Date.now() < nextRunTime) return;
    }

    runPmosJobBatch_();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Pause requests are persisted and observed by the runtime worker between
 * individual operations.
 */
function pausePmosJob_() {
  const state = readPmosJobState_();
  if (!state) return getPmosJobStatus();

  return requestPmosRuntimePause_();
}
