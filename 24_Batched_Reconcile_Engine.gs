/**
 * Batched future Calendar reconciliation.
 * Contains only reconcile job logic. The Job Engine UI lives in 07-C.
 */
const PMOS_SYNC_EFFECTIVE_DATE_KEY = 'PMOS_CALENDAR_SYNC_EFFECTIVE_DATE';
const PMOS_RECONCILE_JOB_KEY = 'PMOS_RECONCILE_BATCH_JOB_V1';
const PMOS_RECONCILE_BATCH_SIZE = 40;
const PMOS_RECONCILE_TRIGGER_HANDLER = 'continueBatchedCalendarReconcile';

function saveCalendarSyncEffectiveDate(value) {
  const date = parseRepairDate_(value, 'Calendar Sync effective date');
  const text = Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd');
  const properties = PropertiesService.getDocumentProperties();
  properties.setProperty(PMOS_SYNC_EFFECTIVE_DATE_KEY, text);
  properties.setProperty(PMOS_CALENDAR_EFFECTIVE_DATE_KEY, text);
  return {effectiveDate: text};
}

function getCalendarSyncEffectiveDate_() {
  return PropertiesService.getDocumentProperties().getProperty(PMOS_SYNC_EFFECTIVE_DATE_KEY) ||
    Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
}

function startCalendarSyncFromDate(effectiveDate, autoContinue) {
  const saved = saveCalendarSyncEffectiveDate(effectiveDate);
  const result = startPmosJob('CALENDAR_SYNC', Boolean(autoContinue), false) || {};
  result.effectiveDate = saved.effectiveDate;
  result.summary = [
    result.summary || result.lastSummary || 'Calendar Sync started.',
    `Effective date: ${saved.effectiveDate}`,
    autoContinue ? 'Auto Continue is enabled.' : 'Run One Batch mode is enabled.'
  ].join('\n');
  return result;
}

function readBatchedReconcileJob_() {
  const text = PropertiesService.getDocumentProperties().getProperty(PMOS_RECONCILE_JOB_KEY);
  if (!text) return null;
  try { return JSON.parse(text); } catch (error) { return null; }
}

function writeBatchedReconcileJob_(job) {
  PropertiesService.getDocumentProperties().setProperty(PMOS_RECONCILE_JOB_KEY, JSON.stringify(job));
  return job;
}

function clearBatchedReconcileTriggers_() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === PMOS_RECONCILE_TRIGGER_HANDLER) ScriptApp.deleteTrigger(trigger);
  });
}

function scheduleBatchedReconcileContinuation_() {
  clearBatchedReconcileTriggers_();
  ScriptApp.newTrigger(PMOS_RECONCILE_TRIGGER_HANDLER).timeBased().after(60 * 1000).create();
}

function startBatchedCalendarReconcile(effectiveDate, autoContinue, confirmed) {
  if (confirmed !== true) throw new Error('Reconcile Calendar requires confirmation.');
  const date = parseCalendarEffectiveDate_(effectiveDate);
  const dateText = Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd');
  clearBatchedReconcileTriggers_();
  writeBatchedReconcileJob_({
    type: 'RECONCILE_FUTURE', label: 'Reconcile Calendar', status: 'Running', phase: 'delete',
    effectiveDate: dateText, autoContinue: Boolean(autoContinue), created: 0, removed: 0,
    errors: [], planIndex: 0, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    lastSummary: 'Reconcile Calendar initialized.'
  });
  return runBatchedCalendarReconcile_();
}

function continueBatchedCalendarReconcile() {
  clearBatchedReconcileTriggers_();
  return runBatchedCalendarReconcile_();
}

function runBatchedCalendarReconcile_() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) {
    const busyJob = readBatchedReconcileJob_();
    if (busyJob && busyJob.autoContinue) scheduleBatchedReconcileContinuation_();
    return getBatchedCalendarReconcileStatus();
  }
  try {
    const job = readBatchedReconcileJob_();
    if (!job) throw new Error('No Reconcile Calendar job is initialized.');
    if (['Paused','Complete','Complete with errors','Cancelled'].indexOf(job.status) >= 0) {
      return formatBatchedReconcileStatus_(job);
    }
    const effectiveDate = parseRepairDate_(job.effectiveDate, 'Effective date');
    const preview = buildFutureReconcilePreview_(effectiveDate);
    let processed = 0;

    if (job.phase === 'delete') {
      const remaining = preview.managedOccurrences
        .filter(event => event.getStartTime().getTime() >= effectiveDate.getTime())
        .slice(0, PMOS_RECONCILE_BATCH_SIZE);
      remaining.forEach(event => {
        try { event.deleteEvent(); job.removed++; }
        catch (error) { job.errors.push(`Delete ${event.getTitle()}: ${error}`); }
        processed++;
      });
      if (!remaining.length) {
        clearRecurringSeriesRegistry_();
        job.phase = 'create';
        job.planIndex = 0;
        job.lastSummary = 'Future PMOS events removed. Beginning recurring-series creation.';
      } else {
        job.lastSummary = `Deleted ${processed} future Calendar occurrence(s) in this batch.`;
      }
    }

    if (job.phase === 'create' && processed < PMOS_RECONCILE_BATCH_SIZE) {
      const plans = preview.plans;
      const allowance = PMOS_RECONCILE_BATCH_SIZE - processed;
      const batch = plans.slice(job.planIndex, job.planIndex + allowance);
      batch.forEach(plan => {
        try {
          const series = createRecurringSeries_(preview.calendar, plan);
          upsertSeriesRegistry_(plan, series.getId(), preview.calendar.getName(), 'Current');
          job.created++;
        } catch (error) {
          job.errors.push(`Create ${plan.title}: ${error}`);
        }
        job.planIndex++;
        processed++;
      });
      if (job.planIndex >= plans.length) {
        job.phase = 'complete';
        job.status = job.errors.length ? 'Complete with errors' : 'Complete';
        job.completedAt = new Date().toISOString();
        job.lastSummary = `Reconcile Calendar complete. Removed ${job.removed}; created ${job.created}; errors ${job.errors.length}.`;
        PropertiesService.getDocumentProperties().setProperty(PMOS_CALENDAR_EFFECTIVE_DATE_KEY, job.effectiveDate);
        updateSyncStatus_(job.errors.length ? 'Synchronization error' : 'Everything synchronized', job.lastSummary);
        clearBatchedReconcileTriggers_();
      } else {
        job.lastSummary = `Created ${batch.length} recurring series in this batch. ${plans.length - job.planIndex} remain.`;
      }
    }

    job.updatedAt = new Date().toISOString();
    writeBatchedReconcileJob_(job);
    if (job.autoContinue && job.status === 'Running') scheduleBatchedReconcileContinuation_();
    return formatBatchedReconcileStatus_(job);
  } finally {
    lock.releaseLock();
  }
}

function pauseBatchedCalendarReconcile() {
  const job = readBatchedReconcileJob_();
  if (!job) return {summary: 'No Reconcile Calendar job is active.', status: 'Idle'};
  job.status = 'Paused';
  job.autoContinue = false;
  job.updatedAt = new Date().toISOString();
  job.lastSummary = 'Reconcile Calendar paused.';
  writeBatchedReconcileJob_(job);
  clearBatchedReconcileTriggers_();
  return formatBatchedReconcileStatus_(job);
}

function resumeBatchedCalendarReconcile(autoContinue) {
  const job = readBatchedReconcileJob_();
  if (!job) throw new Error('No paused Reconcile Calendar job was found.');
  if (job.status === 'Complete' || job.status === 'Complete with errors') return formatBatchedReconcileStatus_(job);
  job.status = 'Running';
  job.autoContinue = Boolean(autoContinue);
  job.updatedAt = new Date().toISOString();
  writeBatchedReconcileJob_(job);
  return runBatchedCalendarReconcile_();
}

function getBatchedCalendarReconcileStatus() {
  const job = readBatchedReconcileJob_();
  return job ? formatBatchedReconcileStatus_(job) : {
    type: 'RECONCILE_FUTURE', label: 'Reconcile Calendar', status: 'Idle', phase: 'idle',
    processedItems: 0, remaining: null, originalTotal: 0,
    summary: 'No Reconcile Calendar job is active.'
  };
}

function formatBatchedReconcileStatus_(job) {
  const effectiveDate = parseRepairDate_(job.effectiveDate, 'Effective date');
  const preview = buildFutureReconcilePreview_(effectiveDate);
  const createRemaining = Math.max(0, preview.plans.length - Number(job.planIndex || 0));
  const deleteRemaining = job.phase === 'delete' ? preview.managedOccurrences.length : 0;
  const remaining = deleteRemaining + createRemaining;
  const processedItems = Number(job.removed || 0) + Number(job.created || 0);
  return {
    type: 'RECONCILE_FUTURE', label: 'Reconcile Calendar', status: job.status,
    phase: job.phase, effectiveDate: job.effectiveDate, autoContinue: Boolean(job.autoContinue),
    removed: Number(job.removed || 0), created: Number(job.created || 0),
    errors: (job.errors || []).length, processedItems, remaining,
    originalTotal: processedItems + remaining, lastSummary: job.lastSummary || '',
    summary: [
      'Job: Reconcile Calendar', `Status: ${job.status}`, `Effective date: ${job.effectiveDate}`,
      `Phase: ${job.phase}`, `Future occurrences removed: ${Number(job.removed || 0)}`,
      `Recurring series created: ${Number(job.created || 0)}`, `Remaining work: ${remaining}`,
      `Errors: ${(job.errors || []).length}`, job.lastSummary || ''
    ].filter(Boolean).join('\n')
  };
}
