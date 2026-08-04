/**
 * Safe Calendar Sync Job Center entry.
 *
 * Initializes the existing shared runtime Job Engine only after the verified,
 * read-only Calendar Plan Audit succeeds. This deliberately bypasses the older
 * Calendar-specific auto-continue engine.
 */
function startVerifiedCalendarSyncJob(autoMode, options) {
  const calendarOptions = normalizeVerifiedCalendarSyncOptions_(options);
  const audit = runPmosCalendarPlanAuditReadOnly_(calendarOptions);

  if (!audit.canSync) {
    throw new Error(
      'Calendar Plan Audit failed with ' + audit.errorCount +
      ' blocking error(s). Calendar Sync was not started.'
    );
  }

  const existing = readPmosJobState_();
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

  let state = existing && existing.type === 'CALENDAR_SYNC'
    ? existing
    : newPmosJobState_('CALENDAR_SYNC');

  const requestedPlanId = audit.planId;
  const canResumeExistingQueue = Boolean(
    state.operationQueueInitialized &&
    state.planId &&
    state.planId === requestedPlanId &&
    Number(state.remaining || 0) > 0
  );

  if (!canResumeExistingQueue) {
    if (state.id) deletePmosJobOperationQueue_(state.id);
    state = newPmosJobState_('CALENDAR_SYNC');
    state.operationQueueInitialized = false;
    state.operationProviderFinalized = false;
    state.processedItems = 0;
    state.originalTotal = 0;
    state.remaining = null;
  }

  state.calendarOptions = calendarOptions;
  state.auditedPlanId = requestedPlanId;
  state.auditedAt = audit.auditedAt || new Date().toISOString();
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
