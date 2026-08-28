/**
 * Web App adapter for PMOS Operations / Job Center.
 *
 * This module does not create a second audit, review, or Calendar executor. It
 * exposes the current authoritative PMOS engines in data-oriented form so the
 * Web App can render them without calling Spreadsheet UI dialogs.
 */

function getPmosWebOperationsBootstrap() {
  return {
    definitions: [
      {type:'CALENDAR_STATUS', label:'Calendar Status', description:'View the current relationship between the route plan, registry, and Google Calendar.', mode:'task'},
      {type:'VERIFY_CALENDAR', label:'Verify Calendar', description:'Check the expected schedule, registry, and Calendar for discrepancies without changing Calendar.', mode:'task'},
      {type:'CALENDAR_AUDIT', label:'Calendar Plan Audit', description:'Run a fresh read-only audit, inspect discrepancies, and complete the Review Session.', mode:'audit'},
      {type:'CALENDAR_SYNC', label:'Calendar Sync', description:'Execute only the approved reviewed Calendar queue using resumable processing.', mode:'runtime'},
      {type:'CUSTOMER_SYNC', label:'Customer Database Sync', description:'Create missing customer IDs and refresh route records from Customers.', mode:'task'},
      {type:'MAP_EXPORT', label:'Export Map Layers', description:'Create updated map-layer files for route layers that have changed.', mode:'task'},
      {type:'CALENDAR_REPAIR', label:'Calendar Repair', description:'Inspect repair/recovery status separately from normal Calendar Sync.', mode:'repair'}
    ],
    selectedType: String(PropertiesService.getUserProperties().getProperty('PMOS_LAST_JOB_TYPE') || 'CALENDAR_STATUS'),
    syncStatus: unwrapPmosWebOperationEndpoint_(getReviewedCalendarSyncJobCenterStatus()),
    auditOptions: getPmosCalendarAuditJobCenterOptions(),
    jobHistory: getPmosWebJobHistory(30)
  };
}

function runPmosWebOperationTask(taskType) {
  const type = String(taskType || '').trim().toUpperCase();
  if (['CALENDAR_STATUS','VERIFY_CALENDAR','CUSTOMER_SYNC','MAP_EXPORT'].indexOf(type) < 0) {
    throw new Error('Unsupported Web PMOS task: ' + type);
  }
  rememberPmosJobType(type);
  return runPmosTask(type);
}

function getPmosWebCalendarReviewState() {
  const snapshot = readPmosCalendarAuditSnapshot_();
  if (!snapshot || !isPmosCalendarAuditSnapshotCurrent_(snapshot)) return null;
  return buildPmosWebCalendarReviewState_(rebuildPmosCalendarAuditFromSnapshot_(snapshot));
}

function buildPmosWebCalendarReviewState_(audit) {
  audit = audit || {};
  let session = loadPmosReviewSession_();
  if (session && session.scope === 'CALENDAR') {
    session.decisions = loadPmosReviewSessionDecisions_(session.id);
  }

  const decisionFor = function(reviewType, itemKey) {
    if (!session || !session.decisions) return '';
    const record = session.decisions[buildPmosReviewDecisionKey_(reviewType, itemKey)] || null;
    return String(record && record.decision || '').toUpperCase();
  };

  const suggestedMatches = (audit.suggestedMatches || []).map(function(item) {
    const key = String(item.eventId || item.seriesId || '');
    return Object.assign({}, item, {
      itemKey: key,
      decision: decisionFor('SUGGESTED_MATCH', key),
      selected: decisionFor('SUGGESTED_MATCH', key) === 'IGNORE'
    });
  });

  const unclassifiedEvents = (audit.unclassifiedEvents || []).map(function(item) {
    const key = String(item.eventId || item.seriesId || item.operationId || '');
    return Object.assign({}, item, {
      itemKey: key,
      decision: decisionFor('UNCLASSIFIED_EVENT', key),
      selected: decisionFor('UNCLASSIFIED_EVENT', key) === 'IGNORE'
    });
  });

  const deletionCandidates = (audit.deletionCandidates || []).map(function(item) {
    const key = String(item.seriesKey || item.seriesId || '');
    return Object.assign({}, item, {
      itemKey: key,
      decision: decisionFor('DELETION_CANDIDATE', key),
      selected: decisionFor('DELETION_CANDIDATE', key) === 'KEEP'
    });
  });

  return {
    planId: String(audit.planId || ''),
    sourceVersion: String(audit.sourceVersion || ''),
    reviewSessionId: String(audit.reviewSessionId || (session && session.id) || ''),
    reviewSessionStatus: String(session && session.status || ''),
    summary: String(audit.summary || ''),
    calendarName: String(audit.calendarName || ''),
    totalSeries: Number(audit.totalSeries || 0),
    creates: Number(audit.creates || 0),
    updates: Number(audit.updates || 0),
    deletes: Number(audit.deletes || 0),
    warningCount: Number((audit.warnings || []).length || audit.warningCount || 0),
    errorCount: Number((audit.errors || []).length || audit.errorCount || 0),
    deletionCandidateCount: Number(audit.deletionCandidateCount || deletionCandidates.length),
    hasErrors: Boolean(audit.hasErrors),
    hasWarnings: Boolean(audit.hasWarnings),
    hasSuggestedMatches: Boolean(audit.hasSuggestedMatches),
    hasUnclassifiedEvents: Boolean(audit.hasUnclassifiedEvents),
    reviewComplete: Boolean(audit.reviewComplete),
    errors: clonePmosWebValue_(audit.errors || []),
    warnings: clonePmosWebValue_(audit.warnings || []),
    seriesDiagnostics: clonePmosWebValue_(audit.seriesDiagnostics || []),
    suggestedMatches: suggestedMatches,
    unclassifiedEvents: unclassifiedEvents,
    deletionCandidates: deletionCandidates
  };
}

function runFreshPmosWebCalendarAudit(options) {
  const submitted = options || {};
  const result = runFreshPmosCalendarAuditFromJobCenter(submitted);
  return {
    // The fresh audit already produced the authoritative result and Review
    // Session. Return only the compact Web review state: returning the entire
    // planner graph as well made large audits exceed the practical HTML-service
    // response size before the browser could display their results.
    reviewState: buildPmosWebCalendarReviewState_(result),
    auditOptions: {
      calendarName: String(result && result.calendarName || submitted.calendarName || ''),
      startDate: String(submitted.startDate || ''),
      endDate: String(submitted.endDate || ''),
      includeStartedToday: Boolean(submitted.includeStartedToday)
    }
  };
}

function savePmosWebCalendarReviewStep(reviewType, selectedIndexes) {
  const type = String(reviewType || '').trim().toUpperCase();
  const indexes = Array.isArray(selectedIndexes) ? selectedIndexes.map(Number) : [];
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  let saved;

  if (type === 'SUGGESTED_MATCH') {
    saved = savePmosCalendarSuggestedMatchDecisionsForSync_(audit.suggestedMatches || [], indexes);
  } else if (type === 'UNCLASSIFIED_EVENT') {
    saved = savePmosCalendarUnclassifiedDecisions(audit.unclassifiedEvents || [], indexes);
  } else if (type === 'DELETION_CANDIDATE') {
    saved = savePmosCalendarDeletionExceptions(audit.deletionCandidates || [], indexes);
  } else {
    throw new Error('Unsupported Calendar review step: ' + type);
  }

  if (!saved || saved.saved !== true) throw new Error('The Calendar review decisions were not saved.');
  return {
    saved: clonePmosWebValue_(saved),
    reviewState: getPmosWebCalendarReviewState()
  };
}

function performPmosWebCalendarIssueResolution(resolutionType, issue) {
  const type = String(resolutionType || '').trim().toUpperCase();
  if (type === 'CUSTOMER_SYNC') return runPmosWebOperationTask('CUSTOMER_SYNC');
  if (type === 'DELETIONS') return {reviewState:getPmosWebCalendarReviewState(), openReviewType:'DELETION_CANDIDATE'};
  if (type === 'TRANSACTION_RECOVERY') {
    return {message:'Transaction Recovery belongs to Calendar Repair / Recovery. Use that PMOS Operations section.'};
  }
  if (type === 'ROUTES_SHEET') {
    return {message:'The issue points to the PMOS Routes sheet. Web editing for this repair path is not enabled; use Route Manager or the development Sheet if correction is required.'};
  }
  if (type === 'SETTINGS_SHEET') {
    return {message:'The issue points to PMOS Settings. Open Settings in the Web App to correct the value.'};
  }
  if (type === 'UPDATE_PMOS') {
    return {message:'This issue requires a PMOS schema/update action. Use the development Sheet Update PMOS command before synchronizing Calendar.'};
  }
  throw new Error('No Web correction action is available for this issue.');
}

function getPmosWebCalendarSyncStatus() {
  return unwrapPmosWebOperationEndpoint_(getReviewedCalendarSyncJobCenterStatus());
}

function startPmosWebCalendarSync() {
  rememberPmosJobType('CALENDAR_SYNC');
  return unwrapPmosWebOperationEndpoint_(startReviewedCalendarSyncJobCenterExecution());
}

function resumePmosWebCalendarSync() {
  return unwrapPmosWebOperationEndpoint_(resumeReviewedCalendarSyncJobCenterExecution());
}

function retryPmosWebCalendarSync() {
  return unwrapPmosWebOperationEndpoint_(retryReviewedCalendarSyncJobCenterExecution());
}

function pausePmosWebCalendarSync() {
  return unwrapPmosWebOperationEndpoint_(pauseReviewedCalendarSyncJobCenterExecution());
}

/**
 * The reviewed Calendar adapter is also used by the Sheet-side Job Center and
 * deliberately returns an {ok, result/error} transport envelope. Web App
 * callers need the status object itself so their controls can read status,
 * remaining, processedItems, and lastError directly.
 */
function unwrapPmosWebOperationEndpoint_(response) {
  if (response && response.ok === false) {
    throw new Error(String(response.error || 'The PMOS operation failed.'));
  }
  if (response && response.ok === true && Object.prototype.hasOwnProperty.call(response, 'result')) {
    return response.result;
  }
  return response;
}

function getPmosWebJobHistory(limit) {
  const maxRows = Math.max(1, Math.min(200, Number(limit || 50)));
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_JOB_HISTORY_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const count = Math.min(maxRows, sheet.getLastRow() - 1);
  const start = sheet.getLastRow() - count + 1;
  const rows = sheet.getRange(start, 1, count, Math.min(8, sheet.getLastColumn())).getValues();
  return rows.reverse().map(function(row) {
    return {
      timestamp: formatJobHistoryDate_(row[0]),
      jobId: String(row[1] || ''),
      jobType: String(row[2] || ''),
      jobName: String(row[3] || ''),
      result: String(row[4] || ''),
      batches: Number(row[5] || 0),
      processedItems: Number(row[6] || 0),
      summary: String(row[7] || '')
    };
  });
}

function getPmosWebCalendarRecoverySummary() {
  const transactionSheet = SpreadsheetApp.getActive().getSheetByName(PMOS_CALENDAR_TRANSACTION_SHEET || 'PMOS Calendar Transactions');
  const history = getPmosWebJobHistory(20);
  return {
    transactionSheetPresent: Boolean(transactionSheet),
    transactionRows: transactionSheet ? Math.max(0, transactionSheet.getLastRow() - 1) : 0,
    recentJobs: history
  };
}

function clonePmosWebValue_(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}
