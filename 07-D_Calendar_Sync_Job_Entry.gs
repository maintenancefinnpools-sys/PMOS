/**
 * Safe Calendar Sync Job Center entry.
 *
 * Initializes the shared runtime Job Engine only after incomplete Calendar
 * transactions are reconciled and the verified Calendar Plan Audit succeeds.
 * Once the immutable operation queue exists, Start / Continue resumes that
 * exact approved queue and never rebuilds the plan after PMOS's own writes.
 */
function startVerifiedCalendarSyncJob(autoMode, options) {
  const existing = readPmosJobState_();

  const canResumeExistingQueue = Boolean(
    existing &&
    existing.type === 'CALENDAR_SYNC' &&
    existing.operationQueueInitialized === true &&
    existing.planId &&
    Number(existing.remaining || 0) > 0 &&
    existing.status !== 'Complete' &&
    existing.status !== 'Cancelled'
  );

  if (canResumeExistingQueue) {
    existing.autoEnabled = Boolean(autoMode);
    existing.pauseRequested = false;
    existing.status = 'Ready';
    existing.lastError = '';
    existing.nextRunAt = '';
    writePmosJobState_(existing);
    removePmosJobTrigger_();
    return runPmosJobBatch_();
  }

  const savedAuditOptions = typeof readPmosCalendarAuditOptions_ === 'function'
    ? readPmosCalendarAuditOptions_()
    : {};
  const calendarOptions = normalizeVerifiedCalendarSyncOptions_(
    Object.assign({}, options || {}, savedAuditOptions || {})
  );

  const recovery = recoverPmosCalendarRegistryTransactions_();
  try {
    assertNoAmbiguousPmosCalendarRecovery_(recovery);
  } catch (error) {
    throw new Error(
      String(error && error.message ? error.message : error) +
      ' Open PMOS → Calendar → Transaction Recovery Review for details.'
    );
  }

  // Review screens reuse the immutable snapshot for speed. Creating the job is
  // the one deliberate point where PMOS rereads Calendar and verifies that the
  // approved decisions still resolve safely before queuing any writes.
  const audit = runVerifiedCalendarPlanAuditReadOnly_(Object.assign({}, calendarOptions, {
    forceFresh: true
  }));

  if (!audit.canSync) {
    throw new Error(
      'Calendar Plan Audit failed with ' + audit.errorCount +
      ' blocking error(s). Calendar Sync was not started.'
    );
  }

  if (
    existing &&
    existing.status !== 'Complete' &&
    existing.status !== 'Cancelled' &&
    existing.type !== 'CALENDAR_SYNC'
  ) {
    throw new Error(
      String(existing.label || existing.type) +
      ' is already active. Pause or complete it before starting Calendar Sync.'
    );
  }

  if (existing && existing.id) deletePmosJobOperationQueue_(existing.id);
  const state = newPmosJobState_('CALENDAR_SYNC');

  state.calendarOptions = calendarOptions;
  state.auditedPlanId = audit.planId;
  state.auditedAt = audit.auditedAt || new Date().toISOString();
  state.recoveryInspected = Number(recovery.inspected || 0);
  state.recoveryFinalized = Number(recovery.finalized || 0);
  state.recoveryRetryRequired = Number(recovery.retryRequired || 0);
  state.autoEnabled = Boolean(autoMode);
  state.pauseRequested = false;
  state.status = 'Ready';
  state.lastError = '';
  state.nextRunAt = '';
  writePmosJobState_(state);

  removePmosJobTrigger_();
  return runPmosJobBatch_();
}

function normalizeVerifiedCalendarSyncOptions_(options) {
  const source = options || {};
  return {
    includeStartedToday: source.includeStartedToday === true,
    startDate: normalizeVerifiedCalendarDateOption_(source.startDate),
    endDate: normalizeVerifiedCalendarDateOption_(source.endDate)
  };
}

function normalizeVerifiedCalendarDateOption_(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? new Date(value) : new Date(String(value));
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Invalid Calendar Sync date: ' + value + '.');
  }
  return date.toISOString();
}
