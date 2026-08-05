/** Builds and persists the reviewed queue before the Sync window is displayed. */
const PMOS_REVIEWED_SYNC_QUEUE_SHEET = 'Reviewed Calendar Sync Queue';
const PMOS_REVIEWED_SYNC_QUEUE_HEADERS = Object.freeze([
  'Queue Index',
  'Operation ID',
  'Action',
  'Entity ID',
  'Status',
  'Attempts',
  'Updated At',
  'Error',
  'Operation JSON'
]);

function prepareReviewedCalendarSyncWindow_() {
  const session = requireActivePmosReviewSession_('CALENDAR');
  const result = buildValidatedPmosCalendarSyncPlan_({});
  const plan = result && result.plan;

  if (!plan || !Array.isArray(plan.operations)) {
    throw new Error('Calendar Sync could not build the reviewed operation plan.');
  }
  if (!result.canExecute) {
    throw new Error(
      'The reviewed Calendar plan is not executable. Resolve all planner, validation, and review errors before syncing.'
    );
  }

  const operations = plan.operations.filter(isPmosExecutableOperation);
  if (!operations.length) {
    throw new Error(
      'Calendar Sync produced zero executable operations from ' +
      Object.keys(session.decisions || {}).length +
      ' reviewed decision(s). PMOS stopped before making Calendar changes.'
    );
  }

  clearReviewedCalendarSyncQueue_();

  const counts = {creates: 0, updates: 0, deletes: 0};
  const now = new Date();
  const rows = operations.map(function (operation, index) {
    const action = String(operation && operation.action || '').toUpperCase();
    if (action === String(PMOS_OPERATION.CREATE).toUpperCase()) counts.creates++;
    else if (action === String(PMOS_OPERATION.UPDATE).toUpperCase()) counts.updates++;
    else if (action === String(PMOS_OPERATION.DELETE).toUpperCase()) counts.deletes++;

    const operationJson = JSON.stringify(operation);
    if (operationJson.length > 49000) {
      throw new Error(
        'Calendar Sync operation ' + String(operation.id || index + 1) +
        ' is too large for the durable queue. PMOS stopped before making Calendar changes.'
      );
    }

    return [
      index,
      String(operation.id || ''),
      action,
      String(operation.entityId || ''),
      'Pending',
      0,
      now,
      '',
      operationJson
    ];
  });

  const queueSheet = ensureReviewedCalendarSyncQueueSheet_();
  if (queueSheet.getMaxRows() < rows.length + 1) {
    queueSheet.insertRowsAfter(
      queueSheet.getMaxRows(),
      rows.length + 1 - queueSheet.getMaxRows()
    );
  }
  queueSheet.getRange(2, 1, rows.length, PMOS_REVIEWED_SYNC_QUEUE_HEADERS.length)
    .setValues(rows);

  const state = {
    id: Utilities.getUuid(),
    sessionId: session.id,
    planId: String(plan.id || ''),
    sourceVersion: String(plan.metadata && plan.metadata.sourceVersion || ''),
    status: 'Prepared',
    phase: 'Ready to start',
    total: operations.length,
    cursor: 0,
    processed: 0,
    remaining: operations.length,
    created: 0,
    updated: 0,
    deleted: 0,
    expectedCreates: counts.creates,
    expectedUpdates: counts.updates,
    expectedDeletes: counts.deletes,
    failed: 0,
    currentOperation: '',
    lastError: '',
    startedAt: '',
    updatedAt: now.toISOString(),
    completedAt: ''
  };

  writeReviewedCalendarSyncState_(state);
  SpreadsheetApp.flush();

  return {
    sessionId: state.sessionId,
    planId: state.planId,
    sourceVersion: state.sourceVersion,
    total: state.total,
    creates: counts.creates,
    updates: counts.updates,
    deletes: counts.deletes,
    reviewDecisionCount: Object.keys(session.decisions || {}).length,
    preparedAt: state.updatedAt
  };
}

function ensureReviewedCalendarSyncQueueSheet_() {
  const spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getSheetByName(PMOS_REVIEWED_SYNC_QUEUE_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(PMOS_REVIEWED_SYNC_QUEUE_SHEET);

  const headerWidth = PMOS_REVIEWED_SYNC_QUEUE_HEADERS.length;
  if (sheet.getMaxColumns() < headerWidth) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      headerWidth - sheet.getMaxColumns()
    );
  }

  const currentHeaders = sheet.getRange(1, 1, 1, headerWidth).getValues()[0];
  const needsHeaders = PMOS_REVIEWED_SYNC_QUEUE_HEADERS.some(function (header, index) {
    return String(currentHeaders[index] || '') !== header;
  });

  if (needsHeaders) {
    // Repair only the header row. Never erase queued operations while repairing
    // queue-sheet structure; queue contents are cleared explicitly only when a
    // new reviewed sync is prepared.
    sheet.getRange(1, 1, 1, headerWidth)
      .setValues([PMOS_REVIEWED_SYNC_QUEUE_HEADERS.slice()]);
    sheet.setFrozenRows(1);
  }

  if (!sheet.isSheetHidden()) sheet.hideSheet();
  return sheet;
}
