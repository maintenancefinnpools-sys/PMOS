/**
 * Retired future Calendar reconciliation adapters.
 *
 * Earlier builds exposed a destructive delete-and-recreate reconciliation path
 * that could bypass the reviewed Calendar Sync workflow. Calendar mutation now
 * belongs exclusively to Calendar Plan Audit -> Review Session -> Sync Preview
 * -> durable reviewed queue -> Job Center.
 */
const PMOS_SYNC_EFFECTIVE_DATE_KEY = 'PMOS_CALENDAR_SYNC_EFFECTIVE_DATE';
const PMOS_RECONCILE_JOB_KEY = 'PMOS_RECONCILE_BATCH_JOB_V1';
const PMOS_RECONCILE_TRIGGER_HANDLER = 'continueBatchedCalendarReconcile';

/** Retained only to clean up state left by older deployments. */
function clearBatchedReconcileTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === PMOS_RECONCILE_TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function clearRetiredBatchedReconcileState_() {
  clearBatchedReconcileTriggers_();
  const properties = PropertiesService.getDocumentProperties();
  properties.deleteProperty(PMOS_RECONCILE_JOB_KEY);
  properties.deleteProperty(PMOS_SYNC_EFFECTIVE_DATE_KEY);
  return true;
}

/**
 * Compatibility entry: opening Calendar Sync from an older UI now opens the
 * authoritative audit instead of starting Calendar mutation.
 */
function startCalendarSyncFromDate(effectiveDate, autoContinue) {
  showFreshCalendarAuditTaskWindow();
  return {
    status: 'REVIEW_REQUIRED',
    effectiveDate: String(effectiveDate || ''),
    autoContinue: false,
    summary:
      'Legacy date-based Calendar Sync has been retired. ' +
      'The reviewed Calendar Plan Audit window was opened instead.'
  };
}

function saveCalendarSyncEffectiveDate(value) {
  const date = parseRepairDate_(value, 'Calendar Sync effective date');
  const text = Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd');
  PropertiesService.getDocumentProperties().setProperty(
    PMOS_SYNC_EFFECTIVE_DATE_KEY,
    text
  );
  return {effectiveDate:text};
}

function getCalendarSyncEffectiveDate_() {
  return PropertiesService.getDocumentProperties().getProperty(
    PMOS_SYNC_EFFECTIVE_DATE_KEY
  ) || Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
}

function startBatchedCalendarReconcile(effectiveDate, autoContinue, confirmed) {
  throw new Error(
    'Reconcile Calendar has been retired because it bypassed the reviewed ' +
    'Calendar Sync safety workflow. Run Calendar Plan Audit instead.'
  );
}

function continueBatchedCalendarReconcile() {
  clearBatchedReconcileTriggers_();
  return getBatchedCalendarReconcileStatus();
}

function pauseBatchedCalendarReconcile() {
  clearBatchedReconcileTriggers_();
  return getBatchedCalendarReconcileStatus();
}

function resumeBatchedCalendarReconcile(autoContinue) {
  throw new Error(
    'The retired Reconcile Calendar job cannot be resumed. Run Calendar Plan Audit instead.'
  );
}

function getBatchedCalendarReconcileStatus() {
  return {
    type: 'RECONCILE_FUTURE',
    label: 'Reconcile Calendar (retired)',
    status: 'Retired',
    phase: 'retired',
    processedItems: 0,
    remaining: 0,
    originalTotal: 0,
    autoContinue: false,
    summary:
      'The destructive future reconciliation pathway is retired. ' +
      'Use Calendar Plan Audit and reviewed Calendar Sync.'
  };
}
