/**
 * PMOS Calendar-specific plan safety validation.
 *
 * Adds Calendar policy checks to the generic immutable-plan validator without
 * changing the generic validation module. This module performs no writes.
 */

const PMOS_CALENDAR_VALIDATION_CODE = Object.freeze({
  DELETE_APPROVAL_REQUIRED: 'CALENDAR_DELETE_APPROVAL_REQUIRED',
  DELETE_CURRENT_RECORD_REQUIRED: 'CALENDAR_DELETE_CURRENT_RECORD_REQUIRED',
  DELETE_SERIES_ID_REQUIRED: 'CALENDAR_DELETE_SERIES_ID_REQUIRED'
});

/**
 * Validates Calendar-specific safety requirements and returns an immutable
 * report. Every Calendar DELETE must carry explicit approval metadata and a
 * concrete current series identity.
 */
function validatePmosCalendarPlanSafety_(plan) {
  const issues = [];
  const operations = plan && Array.isArray(plan.operations)
    ? plan.operations
    : [];

  operations.forEach(function (operation) {
    if (!operation || operation.action !== PMOS_OPERATION.DELETE) return;

    if (!operation.metadata || operation.metadata.deletionApproved !== true) {
      issues.push({
        severity: PMOS_VALIDATION_SEVERITY.ERROR,
        code: PMOS_CALENDAR_VALIDATION_CODE.DELETE_APPROVAL_REQUIRED,
        message: 'Calendar deletion requires explicit user approval.',
        operationId: operation.id || null,
        path: 'metadata.deletionApproved'
      });
    }

    const current = operation.payload && operation.payload.current;
    if (!current || typeof current !== 'object') {
      issues.push({
        severity: PMOS_VALIDATION_SEVERITY.ERROR,
        code: PMOS_CALENDAR_VALIDATION_CODE.DELETE_CURRENT_RECORD_REQUIRED,
        message: 'Calendar deletion requires the current Calendar-series record.',
        operationId: operation.id || null,
        path: 'payload.current'
      });
      return;
    }

    if (!current.seriesId) {
      issues.push({
        severity: PMOS_VALIDATION_SEVERITY.ERROR,
        code: PMOS_CALENDAR_VALIDATION_CODE.DELETE_SERIES_ID_REQUIRED,
        message: 'Calendar deletion requires a verified recurring-series ID.',
        operationId: operation.id || null,
        path: 'payload.current.seriesId'
      });
    }
  });

  const errors = issues.filter(function (issue) {
    return issue.severity === PMOS_VALIDATION_SEVERITY.ERROR;
  });
  const warnings = issues.filter(function (issue) {
    return issue.severity === PMOS_VALIDATION_SEVERITY.WARNING;
  });

  return freezePmosValidationValue_({
    version: 1,
    planId: plan && plan.id ? plan.id : null,
    valid: errors.length === 0,
    executable: errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    issues: issues
  });
}

/** Combines generic and Calendar-specific validation reports. */
function combinePmosCalendarValidationReports_(genericReport, calendarReport) {
  const generic = genericReport || {};
  const calendar = calendarReport || {};
  const issues = []
    .concat(Array.isArray(generic.issues) ? generic.issues : [])
    .concat(Array.isArray(calendar.issues) ? calendar.issues : []);
  const errors = issues.filter(function (issue) {
    return issue.severity === PMOS_VALIDATION_SEVERITY.ERROR;
  });
  const warnings = issues.filter(function (issue) {
    return issue.severity === PMOS_VALIDATION_SEVERITY.WARNING;
  });

  return freezePmosValidationValue_({
    version: 1,
    planId: generic.planId || calendar.planId || null,
    valid: errors.length === 0,
    executable: errors.length === 0 &&
      generic.executable !== false &&
      calendar.executable !== false,
    errorCount: errors.length,
    warningCount: warnings.length,
    issues: issues,
    generic: generic,
    calendar: calendar,
    operations: Array.isArray(generic.operations) ? generic.operations : []
  });
}
