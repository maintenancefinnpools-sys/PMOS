/**
 * PMOS authoritative Calendar Plan Audit adapter.
 */
function runVerifiedCalendarPlanAuditReadOnly_(options) {
  const preview = previewPmosCalendarSyncPlan(options || {});
  const validationIssues = preview.validation && Array.isArray(preview.validation.issues)
    ? preview.validation.issues : [];
  const operations = preview.plan && Array.isArray(preview.plan.operations)
    ? preview.plan.operations : [];

  const warningOperations = operations.filter(function (operation) {
    return operation.action === PMOS_OPERATION.WARNING;
  });
  const unclassifiedOperations = warningOperations.filter(function (operation) {
    return String(operation.metadata && operation.metadata.reviewType || '') ===
      'UNCLASSIFIED_CALENDAR_EVENT';
  });
  const rawDeletionCandidates = warningOperations.filter(function (operation) {
    return String(operation.metadata && operation.metadata.reviewType || '') !==
        'UNCLASSIFIED_CALENDAR_EVENT' &&
      Boolean(operation.payload && operation.payload.current) &&
      !(operation.payload && operation.payload.desired);
  });
  const ordinaryWarningOperations = warningOperations.filter(function (operation) {
    return unclassifiedOperations.indexOf(operation) < 0 &&
      rawDeletionCandidates.indexOf(operation) < 0;
  });

  const issues = buildPmosCalendarAuditReviewItems_(validationIssues, ordinaryWarningOperations);
  const errors = issues.filter(function (item) {
    return String(item.severity || '').toUpperCase() === 'ERROR';
  });
  const warnings = issues.filter(function (item) {
    return String(item.severity || '').toUpperCase() !== 'ERROR';
  });

  const rawUnclassified = unclassifiedOperations.map(formatPmosCalendarUnclassifiedEvent_);
  const matching = classifyPmosCalendarCustomerMatches_(rawUnclassified);
  const sourceVersion = String(
    preview.plan && preview.plan.metadata && preview.plan.metadata.sourceVersion ||
    preview.planId || ''
  );
  const reviewSession = getOrBeginPmosReviewSession_('CALENDAR', sourceVersion);
  const refinedMatching = applyPmosCalendarMatchReviewSession_(matching, reviewSession);
  const refinedUnclassified = applyPmosCalendarUnclassifiedReviewSession_(
    refinedMatching.unclassifiedEvents,
    reviewSession
  );
  const refinedDeletions = applyPmosCalendarDeletionReviewSession_(
    rawDeletionCandidates.map(formatPmosCalendarDeletionCandidate_),
    reviewSession
  );

  const suggestedMatches = refinedMatching.suggestedMatches;
  const approvedMatches = refinedMatching.approvedMatches;
  const unclassifiedEvents = refinedUnclassified.pending;
  const approvedTemporaryVisits = refinedUnclassified.temporaryVisits;
  const ignoredEvents = refinedUnclassified.ignored;
  const deletionCandidates = refinedDeletions.pending;
  const approvedDeletions = refinedDeletions.approved;
  const keptDeletions = refinedDeletions.kept;

  const reviewComplete = errors.length === 0 && warnings.length === 0 &&
    suggestedMatches.length === 0 && unclassifiedEvents.length === 0 &&
    deletionCandidates.length === 0;
  const canSync = preview.canExecute === true && reviewComplete;

  const lines = [
    'Calendar: ' + String(preview.calendarName || ''),
    'Sync range: ' + formatPmosCalendarAuditRange_(preview.syncStart, preview.syncEnd),
    'Expected recurring series: ' + Number(preview.totalSeries || 0),
    'Creates proposed: ' + Number(preview.creates || 0),
    'Updates proposed: ' + Number(preview.updates || 0),
    'Errors: ' + errors.length,
    'Warnings: ' + warnings.length,
    'Suggested matches: ' + suggestedMatches.length,
    'Unclassified events: ' + unclassifiedEvents.length,
    'Suggested deletions: ' + deletionCandidates.length,
    'Registered series missing: ' + Number(preview.registeredMissing || 0)
  ];

  if (!preview.canExecute) {
    lines.push('Calendar Sync remains blocked until the errors are resolved.');
  } else if (!reviewComplete) {
    lines.push('Complete the remaining review items before opening Calendar Sync.');
  }

  return {
    canSync: canSync,
    reviewComplete: reviewComplete,
    planId: preview.planId || '',
    sourceVersion: sourceVersion,
    reviewSessionId: reviewSession.id,
    calendarName: preview.calendarName || '',
    errorCount: errors.length,
    warningCount: warnings.length,
    suggestedMatchCount: suggestedMatches.length,
    approvedMatchCount: approvedMatches.length,
    deletionCandidateCount: deletionCandidates.length,
    approvedDeletionCount: approvedDeletions.length,
    keptDeletionCount: keptDeletions.length,
    unclassifiedEventCount: unclassifiedEvents.length,
    approvedTemporaryVisitCount: approvedTemporaryVisits.length,
    ignoredEventCount: ignoredEvents.length,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
    hasSuggestedMatches: suggestedMatches.length > 0,
    hasUnclassifiedEvents: unclassifiedEvents.length > 0,
    hasReviewItems: !reviewComplete,
    summary: lines.join('\n'),
    issues: issues,
    errors: errors,
    warnings: warnings,
    suggestedMatches: suggestedMatches,
    approvedMatches: approvedMatches,
    deletionCandidates: deletionCandidates,
    approvedDeletions: approvedDeletions,
    keptDeletionCandidates: keptDeletions,
    unclassifiedEvents: unclassifiedEvents,
    approvedTemporaryVisits: approvedTemporaryVisits,
    ignoredEvents: ignoredEvents,
    preview: preview
  };
}

function applyPmosCalendarMatchReviewSession_(matching, session) {
  const pending = [];
  const approved = [];
  const unclassified = (matching.unclassifiedEvents || []).slice();

  (matching.suggestedMatches || []).forEach(function (item) {
    const itemKey = String(item.eventId || item.seriesId || '');
    const decision = readPmosReviewSessionDecision_(session, 'SUGGESTED_MATCH', itemKey);
    const value = String(decision && decision.decision || '').toUpperCase();
    if (value === 'IGNORE') {
      unclassified.push(Object.freeze(Object.assign({}, item, {
        reason: 'Exempted from the suggested customer match during this review session.'
      })));
    } else if (value === 'KEEP' || value === 'MATCH') {
      approved.push(item);
    } else {
      pending.push(item);
    }
  });

  return Object.freeze({
    suggestedMatches: Object.freeze(pending),
    approvedMatches: Object.freeze(approved),
    unclassifiedEvents: Object.freeze(unclassified)
  });
}

function applyPmosCalendarUnclassifiedReviewSession_(items, session) {
  const pending = [];
  const temporaryVisits = [];
  const ignored = [];
  (items || []).forEach(function (item) {
    const itemKey = String(item.eventId || item.seriesId || item.operationId || '');
    const decision = readPmosReviewSessionDecision_(session, 'UNCLASSIFIED_EVENT', itemKey);
    const value = String(decision && decision.decision || '').toUpperCase();
    if (value === 'TEMPORARY' || value === 'TEMPORARY_VISIT') temporaryVisits.push(item);
    else if (value === 'IGNORE') ignored.push(item);
    else pending.push(item);
  });
  return Object.freeze({
    pending: Object.freeze(pending),
    temporaryVisits: Object.freeze(temporaryVisits),
    ignored: Object.freeze(ignored)
  });
}

function applyPmosCalendarDeletionReviewSession_(items, session) {
  const pending = [];
  const approved = [];
  const kept = [];
  (items || []).forEach(function (item) {
    const itemKey = String(item.seriesKey || item.seriesId || '');
    const decision = readPmosReviewSessionDecision_(session, 'DELETION_CANDIDATE', itemKey);
    const value = String(decision && decision.decision || '').toUpperCase();
    if (value === 'DELETE') approved.push(item);
    else if (value === 'KEEP') kept.push(item);
    else pending.push(item);
  });
  return Object.freeze({
    pending: Object.freeze(pending),
    approved: Object.freeze(approved),
    kept: Object.freeze(kept)
  });
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
  const text = [item.code, item.title, item.details, item.path].join(' ').toLowerCase();
  if (/customer id|customer database|customer record|customer match/.test(text)) return {
    type: 'CUSTOMER_SYNC', label: 'Open Customer Database Sync',
    explanation: 'Synchronize customer IDs and route records, then run Calendar Plan Audit again.'
  };
  if (/registry|support sheet|schema|missing required column|initialize pmos|update pmos/.test(text)) return {
    type: 'UPDATE_PMOS', label: 'Open Update PMOS',
    explanation: 'Repair or migrate the required PMOS support structures, then rerun the audit.'
  };
  if (/transaction|recovery|interrupted|ambiguous/.test(text)) return {
    type: 'TRANSACTION_RECOVERY', label: 'Open Transaction Recovery',
    explanation: 'Review the interrupted Calendar operation before synchronization continues.'
  };
  if (/route template|stop order|layer|route row/.test(text)) return {
    type: 'ROUTES_SHEET', label: 'Open 4-Week Route Template',
    explanation: 'Open the affected source sheet and correct the referenced route information.'
  };
  if (/calendar name|season start|season end|app settings|effective date/.test(text)) return {
    type: 'SETTINGS_SHEET', label: 'Open App Settings',
    explanation: 'Open App Settings and correct the referenced Calendar configuration.'
  };
  return {type: 'NONE', label: '', explanation: 'Review the details shown here.'};
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
    description: String(current.description || ''),
    recurring: Boolean(current.seriesId),
    reason: String(operation.reason || 'Calendar event has no PMOS classification metadata.')
  };
}

function openVerifiedCalendarSyncFromAudit() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  if (!audit.canSync) throw new Error(
    'Calendar Plan Audit still has unresolved review items or errors. Complete the review before opening Calendar Sync.'
  );
  showPmosJobEngineFor_('CALENDAR_SYNC');
  return {opened: true, started: false, selectedType: 'CALENDAR_SYNC', planId: audit.planId};
}

function formatPmosCalendarAuditRange_(startValue, endValue) {
  const start = startValue ? String(startValue).slice(0, 10) : 'Today';
  const end = endValue ? String(endValue).slice(0, 10) : 'Season End';
  return start + ' through ' + end;
}
