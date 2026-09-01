/**
 * Immediate PMOS task dispatcher used by the current Operations / Job Center UI.
 * Calendar Plan Audit owns its separate reviewed workflow.
 */

/** Public HTML-service entry point. */
function runPmosTask(taskType) {
  return runPmosTask_(taskType);
}

function runPmosTask_(taskType) {
  return withSpreadsheetServiceRetry_(function () {
    switch (taskType) {
      case 'CALENDAR_STATUS': {
        const preview = previewPmosCalendarSyncPlan();
        return {summary:[
          'Calendar: ' + String(preview.calendarName || ''),
          'Expected recurring series: ' + Number(preview.totalSeries || 0),
          'Registered series present: ' + Number(preview.registeredPresent || 0),
          'Registered series missing: ' + Number(preview.registeredMissing || 0),
          'Creates proposed: ' + Number(preview.creates || 0),
          'Updates proposed: ' + Number(preview.updates || 0),
          'Warnings: ' + Number(preview.warnings || 0),
          'Unclassified events: ' + Number(preview.unclassifiedEvents || 0)
        ].join('\n')};
      }

      case 'VERIFY_CALENDAR': {
        const result = executeVerifyCalendarJob_();
        return {summary:String(result.summary || '')};
      }

      case 'CUSTOMER_SYNC': {
        const result = synchronizeCustomerDatabase_(true);
        return {summary:[
          'IDs created: ' + Number(result.idsCreated || 0),
          'Route rows updated: ' + Number(result.routeRowsUpdated || 0),
          'Duplicate/orphan route rows removed: ' + Number(result.routeRowsRemoved || 0),
          'Route rows created: ' + Number(result.routeRowsCreated || 0)
        ].join('\n')};
      }

      case 'MAP_EXPORT': {
        const result = exportAffectedMapLayers();
        return {summary:[
          'Layer files exported: ' + Number(result.count || 0),
          'Drive folder: ' + String(result.folderName || '')
        ].join('\n')};
      }

      default:
        throw new Error('Unknown PMOS task: ' + taskType);
    }
  }, 'running ' + taskType);
}

/**
 * Read-only Calendar verification for PMOS Operations.
 * Uses the same canonical planner as Calendar Status / Plan Audit so verification
 * cannot drift into a second interpretation of expected Calendar state.
 */
function executeVerifyCalendarJob_() {
  const preview = previewPmosCalendarSyncPlan();
  const validation = preview.validation || {};
  const hasDiscrepancy = [
    preview.creates,
    preview.updates,
    preview.deletes,
    preview.warnings,
    preview.plannerErrors,
    preview.validationErrors,
    preview.registeredMissing,
    preview.unclassifiedEvents,
    preview.reviewResolutionErrors
  ].some(function(value) {
    return Number(value || 0) > 0;
  });

  const lines = [
    'Verification: ' + (hasDiscrepancy ? 'REVIEW REQUIRED' : 'PASS'),
    'Calendar: ' + String(preview.calendarName || ''),
    'Expected recurring series: ' + Number(preview.totalSeries || 0),
    'Registered series present: ' + Number(preview.registeredPresent || 0),
    'Registered series missing: ' + Number(preview.registeredMissing || 0),
    'Creates needed: ' + Number(preview.creates || 0),
    'Updates needed: ' + Number(preview.updates || 0),
    'Deletes proposed/reviewed: ' + Number(preview.deletes || 0),
    'Unclassified events: ' + Number(preview.unclassifiedEvents || 0),
    'Temporary visits: ' + Number(preview.temporaryVisits || 0),
    'Repair visits: ' + Number(preview.repairVisits || 0),
    'Planner warnings: ' + Number(preview.warnings || 0),
    'Planner errors: ' + Number(preview.plannerErrors || 0),
    'Validation warnings: ' + Number(validation.warningCount || preview.validationWarnings || 0),
    'Validation errors: ' + Number(validation.errorCount || preview.validationErrors || 0),
    'Identity reconciliations: ' + Number(preview.identityReconciliations || 0)
  ];

  lines.push('');
  lines.push(
    hasDiscrepancy
      ? 'Discrepancies were found. Run Calendar Plan Audit to review them. Verify Calendar made no Calendar changes.'
      : 'No schedule, registry, or Calendar discrepancies were detected. Verify Calendar made no Calendar changes.'
  );

  return {
    ok: !hasDiscrepancy,
    summary: lines.join('\n'),
    preview: preview
  };
}

function withSpreadsheetServiceRetry_(operation, operationName) {
  const delays = [0, 600, 1500, 3000];
  let lastError = null;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]) Utilities.sleep(delays[attempt]);
    try {
      return operation();
    } catch (error) {
      lastError = error;
      const message = String(error && error.message ? error.message : error);
      const transient = /Service Spreadsheets failed/i.test(message) ||
        /internal error/i.test(message) ||
        /timed out/i.test(message) ||
        /try again/i.test(message);

      if (!transient || attempt === delays.length - 1) {
        throw new Error(
          (operationName || 'PMOS operation') +
          ' failed after ' + (attempt + 1) +
          ' attempt(s): ' + message
        );
      }
    }
  }

  throw lastError;
}
