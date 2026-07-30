/**
 * PMOS Calendar subsystem configuration.
 *
 * Calendar modules must reference this namespace instead of declaring
 * independent PMOS_CALENDAR_* globals in Apps Script's shared namespace.
 */
const PMOS_CALENDAR_CONFIG = Object.freeze({
  EFFECTIVE_DATE_KEY: 'PMOS_CALENDAR_EFFECTIVE_DATE',
  REPAIR_PLAN_KEY: 'PMOS_CALENDAR_REPAIR_PLAN_V1',

  RECONCILE: Object.freeze({
    OPERATION: 'CALENDAR_RECONCILE',
    PLAN_KEY: 'PMOS_CALENDAR_RECONCILE_PLAN_V2',
    PLAN_PARTS_KEY: 'PMOS_CALENDAR_RECONCILE_PLAN_V2_PARTS',
    HORIZON_YEARS: 5,
    HANDLER: 'runFutureCalendarReconciliationContinuation',
    DELAY_MS: 2000,
    PROPERTY_CHUNK: 8000
  })
});
