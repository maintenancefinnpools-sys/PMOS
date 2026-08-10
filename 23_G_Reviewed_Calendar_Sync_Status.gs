/** Returns live reviewed Calendar Sync status enriched from the durable queue ledger. */
function getReviewedCalendarSyncDetailedStatus() {
  const stored = readReviewedCalendarSyncState_();
  const state = stored ? cloneReviewedCalendarSyncState_(stored) : {
    status: 'Not prepared',
    phase: '',
    total: 0,
    processed: 0,
    remaining: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    failed: 0,
    currentOperation: '',
    lastError: ''
  };

  state.attempts = 0;
  state.retries = 0;
  state.pending = 0;
  state.running = 0;
  state.completeRows = 0;
  state.errorRows = 0;
  state.paused = state.status === 'Paused on error';

  const total = Number(state.total || 0);
  if (!total) return state;

  const sheet = ensureReviewedCalendarSyncQueueSheet_();
  const available = Math.max(0, sheet.getLastRow() - 1);
  const rowCount = Math.min(total, available);
  if (!rowCount) return state;

  const rows = sheet.getRange(
    2,
    1,
    rowCount,
    PMOS_REVIEWED_SYNC_QUEUE_HEADERS.length
  ).getValues();

  rows.forEach(function (row) {
    const status = String(row[4] || '');
    const attempts = Math.max(0, Number(row[5] || 0));
    state.attempts += attempts;
    state.retries += Math.max(0, attempts - 1);
    if (status === 'Pending') state.pending++;
    else if (status === 'Running') state.running++;
    else if (status === 'Complete') state.completeRows++;
    else if (status === 'Error') state.errorRows++;
  });

  if (!state.currentOperation && Number(state.cursor || 0) < total) {
    const next = readReviewedCalendarSyncQueueItem_(Number(state.cursor || 0));
    if (next && next.operation) {
      state.currentOperation = String(
        next.operation.id || next.operation.entityId || next.operationId || ''
      );
      state.currentOperationStatus = String(next.status || '');
    }
  }

  return state;
}
