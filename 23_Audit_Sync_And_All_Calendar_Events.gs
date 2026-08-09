/**
 * Calendar Audit / Sync compatibility navigation.
 *
 * Older public names are retained as redirects only. This file contains no
 * Calendar mutation, Repair overrides, or placement-logic overrides.
 */

function showCalendarPlanAudit() {
  return showFreshCalendarAuditTaskWindow();
}

function runCalendarPlanAudit_() {
  return runVerifiedCalendarPlanAuditReadOnly_();
}

function openCalendarSyncFromAudit() {
  return openVerifiedCalendarSyncFromAudit();
}

function openCalendarSyncFromAudit_() {
  return openVerifiedCalendarSyncFromAudit();
}

function openIntegratedCalendarSyncFromAudit() {
  return openVerifiedCalendarSyncFromAudit();
}

function startCalendarSyncFromAudit() {
  return openVerifiedCalendarSyncFromAudit();
}

function openCalendarSync() {
  return openVerifiedCalendarSyncFromAudit();
}

function showCalendarSync() {
  return openVerifiedCalendarSyncFromAudit();
}

function openPmosCalendarSync() {
  return openVerifiedCalendarSyncFromAudit();
}

/**
 * Effective-date Calendar Sync was retired. Preserve the public callback while
 * forcing callers through a fresh reviewed Audit instead of accepting a date
 * as mutation authority.
 */
function startCalendarSyncWithEffectiveDate(value, autoMode) {
  showFreshCalendarAuditTaskWindow();
  return {
    status:'REVIEW_REQUIRED',
    requestedEffectiveDate:String(value || ''),
    autoMode:false,
    summary:
      'Date-based Calendar Sync is retired. The reviewed Calendar Plan Audit was opened instead.'
  };
}
