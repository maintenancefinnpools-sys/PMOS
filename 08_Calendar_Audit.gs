/**
 * Legacy Calendar Audit compatibility adapters.
 *
 * Calendar Plan Audit ownership now belongs to the Review Session workflow in
 * 21-H / 21-B. These wrappers intentionally do not expose the retired canSync
 * readiness boolean or any direct Calendar mutation path.
 */
function showCalendarPlanAudit() {
  return showFreshCalendarAuditTaskWindow();
}

function openCalendarSyncFromAudit() {
  return openVerifiedCalendarSyncFromAudit();
}

function openCalendarSyncFromAudit_() {
  return openVerifiedCalendarSyncFromAudit();
}

/**
 * Read-only compatibility helper for older diagnostic callers.
 * New code should call runVerifiedCalendarPlanAuditReadOnly_ directly.
 */
function runCalendarPlanAudit_() {
  return runVerifiedCalendarPlanAuditReadOnly_();
}
