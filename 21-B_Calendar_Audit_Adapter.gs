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
  const unclassifiedOperations = warningOperations.filter(function (operation) {
    return String(operation.metadata && operation.metadata.reviewType || '') ===
      'UNCLASSIFIED_CALENDAR_EVENT';
  });
  const deletionCandidates = warningOperations.filter(function (operation) {
    return String(operation.metadata && operation.metadata.reviewType || '') !==
        'UNCLASSIFIED_CALENDAR_EVENT' &&
      Boolean(operation.payload && operation.payload.current) &&
      !(operation.payload && operation.payload.desired);
  });
  const ordinaryWarningOperations = warningOperations.filter(function (operation) {
    return unclassifiedOperations.indexOf(operation) < 0 &&
      deletionCandidates.indexOf(operation) < 0;
  });

  const issues = buildPmosCalendarAuditReviewItems_(
    validationIssues,
    ordinaryWarningOperations
  );
  const errors = issues.filter(function (item) {
    return String(item.severity || '').toUpperCase() === 'ERROR';
  });
  const warnings = issues.filter(function (item) {
    return String(item.severity || '').toUpperCase() !== 'ERROR';
  });
  const unclassifiedEvents = unclassifiedOperations.map(
    formatPmosCalendarUnclassifiedEvent_
  );

  const errorCount = errors.length;
  const warningCount = warnings.length;

  const lines = [
    'Calendar: ' + String(preview.calendarName || ''),
    'Sync range: ' + formatPmosCalendarAuditRange_(preview.syncStart, preview.syncEnd),
    'Expected recurring series: ' + Number(preview.totalSeries || 0),
    'Creates proposed: ' + Number(preview.creates || 0),
    'Updates proposed: ' + Number(preview.updates || 0),
    'Errors: ' + errorCount,
    'Warnings: ' + warningCount,
    'Suggested deletions: ' + deletionCandidates.length,
    'Unclassified events: ' + unclassifiedEvents.length,
    'Registered series missing: ' + Number(preview.registeredMissing || 0)
  ];

  if (!preview.canExecute) {
    lines.push('Calendar Sync remains blocked until the errors are resolved.');
  }

  return {
    canSync: preview.canExecute === true,
    planId: preview.planId || '',
    calendarName: preview.calendarName || '',
    errorCount: errorCount,
    warningCount: warningCount,
    deletionCandidateCount: deletionCandidates.length,
    unclassifiedEventCount: unclassifiedEvents.length,
    hasErrors: errorCount > 0,
    hasWarnings: warningCount > 0,
    hasUnclassifiedEvents: unclassifiedEvents.length > 0,
    hasReviewItems: warningCount > 0 || errorCount > 0 ||
      deletionCandidates.length > 0 || unclassifiedEvents.length > 0,
    summary: lines.join('\n'),
    issues: issues,
    errors: errors,
    warnings: warnings,
    deletionCandidates: deletionCandidates.map(formatPmosCalendarDeletionCandidate_),
    unclassifiedEvents: unclassifiedEvents,
    preview: preview
  };
}

function buildPmosCalendarAuditReviewItems_(validationIssues, warningOperations) {
  const items = [];

  (validationIssues || []).forEach(function (issue, index) {
    const item = {
      id: String(issue.operationId || issue.code || 'VALIDATION_' + index),
      severity: String(issue.severity || 'INFO').toUpperCase(),
      code: String(issue.code || ''),
      title: String(issue.code || 'Validation issue').replace(/_/g, ' '),
      details: String(issue.message || 'Calendar validation issue.'),
      operationId: String(issue.operationId || ''),
      path: String(issue.path || ''),
      reviewType: 'VALIDATION'
    };
    item.resolution = recommendPmosCalendarAuditResolution_(item);
    items.push(item);
  });

  (warningOperations || []).forEach(function (operation) {
    const current = operation.payload && operation.payload.current || {};
    const desired = operation.payload && operation.payload.desired || {};
    const item = {
      id: String(operation.id || operation.entityId || ''),
      severity: 'WARNING',
      code: 'CALENDAR_REVIEW',
      title: String(desired.title || current.title || operation.entityId || 'Calendar item'),
      details: String(operation.reason || 'Calendar item requires review.'),
      operationId: String(operation.id || ''),
      seriesKey: String(operation.entityId || ''),
      layer: String(desired.layer || current.layer || ''),
      reviewType: 'WARNING'
    };
    item.resolution = recommendPmosCalendarAuditResolution_(item);
    items.push(item);
  });

  return items;
}

function recommendPmosCalendarAuditResolution_(item) {
  const text = [item.code, item.title, item.details, item.path]
    .join(' ').toLowerCase();

  if (/customer id|customer database|customer record|customer match/.test(text)) {
    return {
      type: 'CUSTOMER_SYNC',
      label: 'Open Customer Database Sync',
      explanation: 'Synchronize customer IDs and route records, then run Calendar Plan Audit again.'
    };
  }
  if (/registry|support sheet|schema|missing required column|initialize pmos|update pmos/.test(text)) {
    return {
      type: 'UPDATE_PMOS',
      label: 'Open Update PMOS',
      explanation: 'Repair or migrate the required PMOS support structures, then rerun the audit.'
    };
  }
  if (/transaction|recovery|interrupted|ambiguous/.test(text)) {
    return {
      type: 'TRANSACTION_RECOVERY',
      label: 'Open Transaction Recovery',
      explanation: 'Review the interrupted Calendar operation before synchronization continues.'
    };
  }
  if (/route template|stop order|layer|route row/.test(text)) {
    return {
      type: 'ROUTES_SHEET',
      label: 'Open 4-Week Route Template',
      explanation: 'Open the affected source sheet and correct the referenced route information.'
    };
  }
  if (/calendar name|season start|season end|app settings|effective date/.test(text)) {
    return {
      type: 'SETTINGS_SHEET',
      label: 'Open App Settings',
      explanation: 'Open App Settings and correct the referenced Calendar configuration.'
    };
  }

  return {
    type: 'NONE',
    label: '',
    explanation: 'Review the details shown here. A guided correction action is not yet available for this issue type.'
  };
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

function formatPmosCalendarUnclassifiedEvent_(operation) {
  const current = operation.payload && operation.payload.current || {};
  return {
    operationId: String(operation.id || ''),
    eventId: String(current.eventId || operation.entityId || ''),
    seriesId: String(current.seriesId || ''),
    title: String(current.title || 'Unclassified Calendar event'),
    start: String(current.start || ''),
    end: String(current.end || ''),
    location: String(current.location || ''),
    recurring: Boolean(current.seriesId),
    reason: String(operation.reason || 'Calendar event has no PMOS classification metadata.')
  };
}

/** Opens Calendar Sync in the Job Center without starting or approving work. */
function openVerifiedCalendarSyncFromAudit() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  if (!audit.canSync) {
    throw new Error(
      'Calendar Plan Audit has ' + audit.errorCount +
      ' error(s). Calendar Sync was not opened.'
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
