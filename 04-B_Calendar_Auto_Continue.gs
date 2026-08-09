/**
 * Legacy Calendar trigger/state retirement shim.
 *
 * Current Calendar Sync executes only through the reviewed durable queue.
 * These handlers remain solely so triggers left by older PMOS builds can fire
 * once, delete themselves, clear obsolete state, and never mutate Calendar.
 */
function runCalendarAutoContinueTrigger() {
  retireLegacyCalendarExecutionState_();
}

function runFutureCalendarReconciliationContinuation() {
  retireLegacyCalendarExecutionState_();
  return {
    status: 'Retired',
    summary: 'Removed obsolete future Calendar reconciliation continuation state.'
  };
}

function continueBatchedCalendarReconcile() {
  retireLegacyCalendarExecutionState_();
  return retiredCalendarReconcileStatus_();
}

function pauseBatchedCalendarReconcile() {
  retireLegacyCalendarExecutionState_();
  return retiredCalendarReconcileStatus_();
}

/** Old generic Job Engine trigger entry: cleanup only. */
function runPmosJobTrigger_() {
  retireLegacyCalendarExecutionState_();
}

function retireLegacyCalendarAutoContinue_() {
  return retireLegacyCalendarExecutionState_();
}

function retireLegacyCalendarExecutionState_() {
  const legacyHandlers = {
    runCalendarAutoContinueTrigger: true,
    runFutureCalendarReconciliationContinuation: true,
    continueBatchedCalendarReconcile: true,
    runPmosJobTrigger_: true
  };

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (legacyHandlers[trigger.getHandlerFunction()]) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  const properties = PropertiesService.getDocumentProperties();
  [
    'PMOS_CALENDAR_AUTO_JOB',
    'PMOS_CALENDAR_REBUILD_STATE',
    'PMOS_RECONCILE_BATCH_JOB_V1',
    'PMOS_CALENDAR_SYNC_EFFECTIVE_DATE',
    'PMOS_ACTIVE_JOB_V1',
    'PMOS_RUNTIME_ACTIVE_OPERATION_V1',
    'PMOS_RUNTIME_CHECKPOINT_V1_CALENDAR_RECONCILE'
  ].forEach(function(key) {
    properties.deleteProperty(key);
  });

  const partsKey = 'PMOS_CALENDAR_RECONCILE_PLAN_V2_PARTS';
  const planKey = 'PMOS_CALENDAR_RECONCILE_PLAN_V2';
  const count = Number(properties.getProperty(partsKey) || 0);
  for (let index = 0; index < count; index++) {
    properties.deleteProperty(planKey + '_' + index);
  }
  properties.deleteProperty(partsKey);

  return true;
}

function retiredCalendarReconcileStatus_() {
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
