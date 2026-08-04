/**
 * PMOS authoritative Calendar Plan Audit adapter.
 *
 * Converts the verified immutable Calendar Sync preview into the compact task-
 * window contract. It performs no writes and does not start Calendar Sync.
 */

function runVerifiedCalendarPlanAuditReadOnly_(options) {
  const preview = previewPmosCalendarSyncPlan(options || {});
  const validationIssues = preview.validation && Array.isArray(preview.validation.issues)
    ? preview.validation.issues
    : [];
  const operations = preview.plan && Array.isArray(preview.plan.operations)
    ? preview.plan.operations
    : [];

  const warningOperations = operations.filter(function (operation) {
    return operation.action === PMOS_OPERATION.WARNING;
  });
  const deletionCandidates = warningOperations.filter(function (operation) {
    return Boolean(operation.payload && operation.payload.current) &&
      !(operation.payload && operation.payload.desired);
  });

  const errorCount = Number(preview.validationErrors || 0) +
    Number(preview.plannerErrors || 0);
  const warningCount = Number(preview.validationWarnings || 0) +
    Number(preview.warnings || 0);

  const lines = [
    'Calendar: ' + String(preview.calendarName || ''),
    'Sync range: ' + formatPmosCalendarAuditRange_(preview.syncStart, preview.syncEnd),
    'Expected recurring series: ' + Number(preview.totalSeries || 0),
    'Creates proposed: ' + Number(preview.creates || 0),
    'Updates proposed: ' + Number(preview.updates || 0),
    'Blocking errors: ' + errorCount,
    'Warnings requiring review: ' + warningCount,
    'Deletion candidates requiring review: ' + deletionCandidates.length,
    'Registered series missing: ' + Number(preview.registeredMissing || 0),
    'Unclassified events requiring review: ' + Number(preview.unclassifiedEvents || 0)
  ];

  if (!preview.canExecute) {
    lines.push('Calendar Sync remains blocked until the blocking errors are resolved.');
  }

  return {
    canSync: preview.canExecute === true,
    planId: preview.planId || '',
    calendarName: preview.calendarName || '',
    errorCount: errorCount,
    warningCount: warningCount,
    deletionCandidateCount: deletionCandidates.length,
    hasReviewItems: warningCount > 0 || errorCount > 0,
    summary: lines.join('\n'),
    issues: buildPmosCalendarAuditReviewItems_(validationIssues, warningOperations),
    deletionCandidates: deletionCandidates.map(formatPmosCalendarDeletionCandidate_),
    preview: preview
  };
}

function buildPmosCalendarAuditReviewItems_(validationIssues, warningOperations) {
  const items = [];

  (validationIssues || []).forEach(function (issue, index) {
    items.push({
      id: String(issue.operationId || issue.code || 'VALIDATION_' + index),
      severity: String(issue.severity || 'INFO'),
      code: String(issue.code || ''),
      title: String(issue.code || 'Validation issue').replace(/_/g, ' '),
      details: String(issue.message || 'Calendar validation issue.'),
      operationId: String(issue.operationId || ''),
      path: String(issue.path || ''),
      reviewType: 'VALIDATION'
    });
  });

  (warningOperations || []).forEach(function (operation) {
    const current = operation.payload && operation.payload.current || {};
    const desired = operation.payload && operation.payload.desired || {};
    items.push({
      id: String(operation.id || operation.entityId || ''),
      severity: 'WARNING',
      code: 'CALENDAR_REVIEW',
      title: String(desired.title || current.title || operation.entityId || 'Calendar item'),
      details: String(operation.reason || 'Calendar item requires review.'),
      operationId: String(operation.id || ''),
      seriesKey: String(operation.entityId || ''),
      layer: String(desired.layer || current.layer || ''),
      reviewType: current && !desired ? 'DELETION_CANDIDATE' : 'WARNING'
    });
  });

  return items;
}

function formatPmosCalendarDeletionCandidate_(operation) {
  const current = operation.payload && operation.payload.current || {};
  return {
    operationId: String(operation.id || ''),
    seriesKey: String(operation.entityId || ''),
    title: String(current.title || operation.entityId || ''),
    layer: String(current.layer || ''),
    seriesId: String(current.seriesId || ''),
    reason: String(operation.reason || 'Series is not present in the current source of truth.')
  };
}

/** Opens Calendar Sync in the Job Center without starting or approving work. */
function openVerifiedCalendarSyncFromAudit() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  if (!audit.canSync) {
    throw new Error(
      'Calendar Plan Audit has ' + audit.errorCount +
      ' blocking error(s). Calendar Sync was not opened.'
    );
  }

  showPmosJobEngineFor_('CALENDAR_SYNC');
  return {
    opened: true,
    started: false,
    selectedType: 'CALENDAR_SYNC',
    planId: audit.planId
  };
}

function formatPmosCalendarAuditRange_(startValue, endValue) {
  const start = startValue ? String(startValue).slice(0, 10) : 'Today';
  const end = endValue ? String(endValue).slice(0, 10) : 'Season End';
  return start + ' through ' + end;
}
