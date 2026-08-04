/**
 * PMOS authoritative Calendar Plan Audit adapter.
 *
 * Converts the verified immutable Calendar Sync preview into the compact task-
 * window contract. It performs no writes and does not start Calendar Sync.
 */

function runVerifiedCalendarPlanAuditReadOnly_(options) {
  const preview = previewPmosCalendarSyncPlan(options || {});
  const issues = preview.validation && Array.isArray(preview.validation.issues)
    ? preview.validation.issues
    : [];

  const lines = [
    'Calendar Plan Audit complete.',
    'No spreadsheet or Calendar changes were made.',
    'Calendar: ' + String(preview.calendarName || ''),
    'Sync range: ' + formatPmosCalendarAuditRange_(preview.syncStart, preview.syncEnd),
    'Expected recurring series: ' + Number(preview.totalSeries || 0),
    'Creates proposed: ' + Number(preview.creates || 0),
    'Updates proposed: ' + Number(preview.updates || 0),
    'Approved deletions: ' + Number(preview.deletes || 0),
    'Review warnings: ' + Number(preview.warnings || 0),
    'Registered series present: ' + Number(preview.registeredPresent || 0),
    'Registered series missing: ' + Number(preview.registeredMissing || 0),
    'Temporary visits preserved: ' + Number(preview.temporaryVisits || 0),
    'Repair visits preserved: ' + Number(preview.repairVisits || 0),
    'Unclassified events requiring review: ' + Number(preview.unclassifiedEvents || 0),
    'Blocking validation errors: ' + Number(preview.validationErrors || 0),
    'Validation warnings: ' + Number(preview.validationWarnings || 0),
    preview.canExecute
      ? 'Calendar Sync may be opened for review. No work has started.'
      : 'Calendar Sync remains blocked until the reported issues are resolved.'
  ];

  if (issues.length) {
    lines.push('', 'First issues:');
    issues.slice(0, 10).forEach(function (issue) {
      lines.push(
        '- ' + String(issue.severity || 'INFO') + ': ' +
        String(issue.message || issue.code || 'Calendar validation issue')
      );
    });
  }

  return {
    canSync: preview.canExecute === true,
    planId: preview.planId || '',
    calendarName: preview.calendarName || '',
    errorCount: Number(preview.validationErrors || 0) + Number(preview.plannerErrors || 0),
    warningCount: Number(preview.validationWarnings || 0) + Number(preview.warnings || 0),
    summary: lines.join('\n'),
    preview: preview
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
    planId: audit.planId,
    summary: 'Calendar Sync opened in the PMOS Job Center. No synchronization has started.'
  };
}

function formatPmosCalendarAuditRange_(startValue, endValue) {
  const start = startValue ? String(startValue).slice(0, 10) : 'Today';
  const end = endValue ? String(endValue).slice(0, 10) : 'Season End';
  return start + ' through ' + end;
}
