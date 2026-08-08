/**
 * Retired future Calendar reconciliation compatibility adapters.
 *
 * This module previously contained a second Calendar writer that deleted
 * managed future occurrences, cleared the recurring registry, and recreated
 * series. That bypassed the reviewed Calendar Sync queue and transaction
 * history, so execution is permanently disabled.
 */

function previewReconcileFutureCalendar(value) {
  const effectiveDate = parseCalendarEffectiveDate_(value);
  return {
    status: 'Retired',
    effectiveDate: Utilities.formatDate(effectiveDate, PMOS.TIMEZONE, 'yyyy-MM-dd'),
    managedOccurrencesToRemove: 0,
    recurringSeriesToCreate: 0,
    summary:
      'Future-only reconciliation has been retired. No Calendar changes were made. ' +
      'Run Calendar Plan Audit to review the current Calendar against PMOS.'
  };
}

function reconcileFutureCalendar(value, confirmed) {
  throw new Error(
    'Future-only reconciliation has been retired because it bypassed the reviewed ' +
    'Calendar Sync safety workflow. Run Calendar Plan Audit instead.'
  );
}

/** Legacy trigger entry. It only removes obsolete continuation/state. */
function runFutureCalendarReconciliationContinuation() {
  clearRetiredFutureCalendarReconciliationState_();
  return {
    status: 'Retired',
    summary: 'Removed obsolete future Calendar reconciliation continuation state.'
  };
}

function clearRetiredFutureCalendarReconciliationState_() {
  removeFutureCalendarReconciliationContinuation_();
  deleteCalendarReconciliationPlan_();
  clearPmosRuntimeCheckpoint_('CALENDAR_RECONCILE');
  return true;
}

function deleteCalendarReconciliationPlan_() {
  const properties = PropertiesService.getDocumentProperties();
  const partsKey = 'PMOS_CALENDAR_RECONCILE_PLAN_V2_PARTS';
  const planKey = 'PMOS_CALENDAR_RECONCILE_PLAN_V2';
  const count = Number(properties.getProperty(partsKey) || 0);

  for (let index = 0; index < count; index++) {
    properties.deleteProperty(planKey + '_' + index);
  }
  properties.deleteProperty(partsKey);
}

function removeFutureCalendarReconciliationContinuation_() {
  ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return trigger.getHandlerFunction() ===
        'runFutureCalendarReconciliationContinuation';
    })
    .forEach(function(trigger) {
      ScriptApp.deleteTrigger(trigger);
    });
}
