/**
 * Authoritative resumable executor for a validated reviewed Calendar Sync plan.
 *
 * Recurring-series CREATE/UPDATE/DELETE operations use the shared Calendar
 * Registry Transaction History. Every queued operation is idempotent so a
 * worker interrupted after marking a row Running can safely verify/replay it.
 */
const PMOS_REVIEWED_SYNC_STATE = 'PMOS_REVIEWED_CALENDAR_SYNC_STATE_V1';
const PMOS_REVIEWED_SYNC_TRIGGER = 'runReviewedCalendarSyncWorker_';

function initializeReviewedCalendarSyncExecution_() {
  prepareReviewedCalendarSyncWindow_();
  return cloneReviewedCalendarSyncState_(readReviewedCalendarSyncState_());
}

function startReviewedCalendarSyncExecution() {
  let state = readReviewedCalendarSyncState_();
  if (!state || state.status === 'Complete' || !state.planId) {
    state = initializeReviewedCalendarSyncExecution_();
  }
  if (state.status === 'Running' || state.status === 'Scheduled') return state;
  if (state.status === 'Paused on error') {
    throw new Error('Calendar Sync is paused on an error. Review the displayed error before retrying.');
  }

  state.pauseRequested = false;
  state.status = 'Scheduled';
  state.phase = 'Waiting for execution worker';
  state.startedAt = state.startedAt || new Date().toISOString();
  state.updatedAt = new Date().toISOString();
  writeReviewedCalendarSyncState_(state);
  ensureReviewedCalendarSyncTrigger_();
  return cloneReviewedCalendarSyncState_(state);
}

function getReviewedCalendarSyncStatus() {
  const state = readReviewedCalendarSyncState_();
  return state || {
    status: 'Not prepared', phase: '', total: 0, processed: 0, remaining: 0,
    created: 0, updated: 0, deleted: 0, failed: 0, currentOperation: '', lastError: ''
  };
}

function runReviewedCalendarSyncWorker_() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) {
    ensureReviewedCalendarSyncTrigger_();
    return;
  }

  try {
    let state = readReviewedCalendarSyncState_();
    if (!state) {
      removeReviewedCalendarSyncTriggers_();
      return;
    }

    if (
      state.pauseRequested === true ||
      ['Complete', 'Paused', 'Paused on error', 'Cancelled'].indexOf(String(state.status || '')) >= 0
    ) {
      removeReviewedCalendarSyncTriggers_();
      return;
    }

    const session = requireActivePmosReviewSession_('CALENDAR');
    if (session.id !== state.sessionId) {
      throw new Error('The active Calendar Review Session changed before synchronization completed.');
    }

    const recovery = recoverPmosCalendarRegistryTransactions_();
    assertNoAmbiguousPmosCalendarRecovery_(recovery);
    resetInterruptedReviewedCalendarQueueRows_(state);

    state = reconcileReviewedCalendarSyncState_(state);
    state.status = 'Running';
    state.phase = 'Applying reviewed Calendar operations';
    state.updatedAt = new Date().toISOString();
    writeReviewedCalendarSyncState_(state);

    const started = Date.now();
    const maxRunMs = 45 * 1000;
    const maxItems = 8;
    let handled = 0;

    while (
      state.cursor < state.total &&
      handled < maxItems &&
      Date.now() - started < maxRunMs
    ) {
      const latest = readReviewedCalendarSyncState_() || state;
      if (latest.pauseRequested === true || String(latest.status || '') === 'Paused') {
        state = latest;
        break;
      }

      const queueItem = readReviewedCalendarSyncQueueItem_(state.cursor);
      if (!queueItem || !queueItem.operation) {
        throw new Error('Calendar Sync queue item ' + state.cursor + ' is missing.');
      }
      if (queueItem.status !== 'Pending') {
        throw new Error(
          'Calendar Sync queue item ' + state.cursor +
          ' is ' + String(queueItem.status || 'blank') +
          ' instead of Pending. PMOS stopped to prevent an unsafe replay.'
        );
      }

      const operation = queueItem.operation;
      const operationLabel = String(
        operation.id || operation.entityId || ('Operation ' + (state.cursor + 1))
      );

      state.currentOperation = operationLabel;
      state.updatedAt = new Date().toISOString();
      writeReviewedCalendarSyncState_(state);
      markReviewedCalendarSyncQueueItem_(
        queueItem.row,
        'Running',
        '',
        queueItem.attempts + 1
      );

      try {
        const outcome = executeReviewedCalendarOperation_(operation, state);
        if (outcome.action === 'CREATE') state.created++;
        else if (outcome.action === 'UPDATE') state.updated++;
        else if (outcome.action === 'DELETE') state.deleted++;

        markReviewedCalendarSyncQueueItem_(
          queueItem.row,
          'Complete',
          '',
          queueItem.attempts + 1
        );
      } catch (operationError) {
        const message = String(
          operationError && operationError.message
            ? operationError.message
            : operationError
        );
        markReviewedCalendarSyncQueueItem_(
          queueItem.row,
          'Error',
          message,
          queueItem.attempts + 1
        );
        throw operationError;
      }

      state.cursor++;
      state.processed++;
      state.remaining = Math.max(0, state.total - state.cursor);
      state.currentOperation = '';
      state.updatedAt = new Date().toISOString();
      writeReviewedCalendarSyncState_(state);
      handled++;
    }

    if (state.pauseRequested === true || String(state.status || '') === 'Paused') {
      state.status = 'Paused';
      state.phase = 'Paused by user';
      state.currentOperation = '';
      state.updatedAt = new Date().toISOString();
      writeReviewedCalendarSyncState_(state);
      removeReviewedCalendarSyncTriggers_();
      return;
    }

    if (state.cursor >= state.total) {
      const completion = verifyReviewedCalendarSyncCompletion_(state);
      if (!completion.complete) throw new Error(completion.message);

      state.processed = completion.completeCount;
      state.remaining = 0;
      state.failed = 0;
      state.status = 'Complete';
      state.phase = 'Synchronization complete';
      state.currentOperation = '';
      state.lastError = '';
      state.completedAt = new Date().toISOString();
      state.updatedAt = state.completedAt;
      writeReviewedCalendarSyncState_(state);
      removeReviewedCalendarSyncTriggers_();
      completePmosReviewSession_();
      return;
    }

    state.status = 'Scheduled';
    state.phase = 'Waiting for next execution pass';
    state.updatedAt = new Date().toISOString();
    writeReviewedCalendarSyncState_(state);
    ensureReviewedCalendarSyncTrigger_();

  } catch (error) {
    const state = readReviewedCalendarSyncState_() || {};
    state.status = 'Paused on error';
    state.phase = 'Stopped safely';
    state.failed = Number(state.failed || 0) + 1;
    state.lastError = String(error && error.message ? error.message : error);
    state.updatedAt = new Date().toISOString();
    writeReviewedCalendarSyncState_(state);
    removeReviewedCalendarSyncTriggers_();
  } finally {
    lock.releaseLock();
  }
}

/**
 * A queue row is marked Running before its mutation begins. If Apps Script is
 * interrupted, all authoritative operations are safe to verify/replay:
 * recurring operations are transaction-backed and review adapters are
 * idempotent. Reset only interrupted Running rows; explicit Error rows remain
 * blocked for operator review.
 */
function resetInterruptedReviewedCalendarQueueRows_(state) {
  const total = Number(state && state.total || 0);
  if (total <= 0) return 0;

  const sheet = ensureReviewedCalendarSyncQueueSheet_();
  if (sheet.getLastRow() < total + 1) return 0;

  const rows = sheet.getRange(
    2,
    1,
    total,
    PMOS_REVIEWED_SYNC_QUEUE_HEADERS.length
  ).getValues();
  let reset = 0;

  rows.forEach(function(row, index) {
    if (String(row[4] || '') !== 'Running') return;
    const attempts = Number(row[5] || 0);
    sheet.getRange(index + 2, 5, 1, 4).setValues([[
      'Pending',
      attempts,
      new Date(),
      'Recovered interrupted worker state; operation will be verified or replayed idempotently.'
    ]]);
    reset++;
  });

  return reset;
}

function reconcileReviewedCalendarSyncState_(state) {
  const total = Number(state && state.total || 0);
  if (total <= 0) throw new Error('Calendar Sync queue has no reviewed operations.');

  const sheet = ensureReviewedCalendarSyncQueueSheet_();
  if (sheet.getLastRow() < total + 1) {
    throw new Error('Calendar Sync queue is missing one or more expected rows.');
  }

  const rows = sheet.getRange(
    2,
    1,
    total,
    PMOS_REVIEWED_SYNC_QUEUE_HEADERS.length
  ).getValues();
  const counts = {CREATE: 0, UPDATE: 0, DELETE: 0};
  let completedPrefix = 0;
  let encounteredIncomplete = false;

  for (let index = 0; index < rows.length; index++) {
    if (Number(rows[index][0]) !== index) {
      throw new Error('Calendar Sync queue index mismatch at row ' + (index + 2) + '.');
    }

    const status = String(rows[index][4] || '');
    if (status === 'Complete') {
      if (encounteredIncomplete) {
        throw new Error(
          'Calendar Sync queue contains a Complete row after an incomplete row. ' +
          'PMOS stopped because the execution ledger is out of sequence.'
        );
      }
      completedPrefix++;
      const action = normalizeReviewedCalendarCountAction_(rows[index][2]);
      if (Object.prototype.hasOwnProperty.call(counts, action)) counts[action]++;
      continue;
    }

    encounteredIncomplete = true;
    if (status === 'Running') {
      throw new Error(
        'Calendar Sync queue item ' + index +
        ' is still Running after recovery reconciliation.'
      );
    }
    if (status === 'Error') {
      throw new Error(
        'Calendar Sync queue item ' + index + ' is Error: ' +
        String(rows[index][7] || 'Unknown error')
      );
    }
    if (status !== 'Pending') {
      throw new Error(
        'Calendar Sync queue item ' + index +
        ' has invalid status ' + String(status || 'blank') + '.'
      );
    }
  }

  state.cursor = completedPrefix;
  state.processed = completedPrefix;
  state.remaining = Math.max(0, total - completedPrefix);
  state.created = counts.CREATE;
  state.updated = counts.UPDATE;
  state.deleted = counts.DELETE;
  state.failed = 0;
  state.currentOperation = '';
  state.lastError = '';
  return state;
}

function verifyReviewedCalendarSyncCompletion_(state) {
  const expectedTotal = Number(state && state.total || 0);
  if (expectedTotal <= 0) {
    return {
      complete: false,
      completeCount: 0,
      message: 'Calendar Sync cannot complete because the reviewed queue contains no operations.'
    };
  }

  const sheet = ensureReviewedCalendarSyncQueueSheet_();
  if (sheet.getLastRow() < expectedTotal + 1) {
    return {
      complete: false,
      completeCount: 0,
      message: 'Calendar Sync cannot complete because one or more queue rows are missing.'
    };
  }

  const rows = sheet.getRange(
    2,
    1,
    expectedTotal,
    PMOS_REVIEWED_SYNC_QUEUE_HEADERS.length
  ).getValues();
  const counts = {
    Complete: 0, Pending: 0, Running: 0, Error: 0, Other: 0,
    CREATE: 0, UPDATE: 0, DELETE: 0
  };

  for (let index = 0; index < rows.length; index++) {
    if (Number(rows[index][0]) !== index) {
      return {
        complete: false,
        completeCount: counts.Complete,
        message: 'Calendar Sync queue index mismatch at row ' + (index + 2) + '.'
      };
    }

    const status = String(rows[index][4] || '');
    if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status]++;
    else counts.Other++;

    if (status === 'Complete') {
      const action = normalizeReviewedCalendarCountAction_(rows[index][2]);
      if (Object.prototype.hasOwnProperty.call(counts, action)) counts[action]++;
    }
  }

  const expectedCreates = Number(state.expectedCreates || 0);
  const expectedUpdates = Number(state.expectedUpdates || 0);
  const expectedDeletes = Number(state.expectedDeletes || 0);
  const problems = [];

  if (counts.Complete !== expectedTotal) {
    problems.push(
      counts.Complete + ' of ' + expectedTotal + ' queue rows are Complete' +
      ' (Pending ' + counts.Pending + ', Running ' + counts.Running +
      ', Error ' + counts.Error + ', Other ' + counts.Other + ')'
    );
  }
  if (Number(state.processed || 0) !== expectedTotal) {
    problems.push('processed is ' + Number(state.processed || 0) + ' but total is ' + expectedTotal);
  }
  if (Number(state.remaining || 0) !== 0) {
    problems.push('remaining is ' + Number(state.remaining || 0) + ' instead of 0');
  }
  if (Number(state.failed || 0) !== 0) {
    problems.push('failed is ' + Number(state.failed || 0) + ' instead of 0');
  }
  if (counts.CREATE !== expectedCreates) {
    problems.push('completed creates are ' + counts.CREATE + ' but expected ' + expectedCreates);
  }
  if (counts.UPDATE !== expectedUpdates) {
    problems.push('completed updates are ' + counts.UPDATE + ' but expected ' + expectedUpdates);
  }
  if (counts.DELETE !== expectedDeletes) {
    problems.push('completed deletes are ' + counts.DELETE + ' but expected ' + expectedDeletes);
  }
  if (Number(state.created || 0) !== expectedCreates) {
    problems.push('recorded creates are ' + Number(state.created || 0) + ' but expected ' + expectedCreates);
  }
  if (Number(state.updated || 0) !== expectedUpdates) {
    problems.push('recorded updates are ' + Number(state.updated || 0) + ' but expected ' + expectedUpdates);
  }
  if (Number(state.deleted || 0) !== expectedDeletes) {
    problems.push('recorded deletes are ' + Number(state.deleted || 0) + ' but expected ' + expectedDeletes);
  }

  return {
    complete: problems.length === 0,
    completeCount: counts.Complete,
    message: problems.length
      ? 'Calendar Sync completion verification failed: ' + problems.join('; ') + '.'
      : ''
  };
}

function normalizeReviewedCalendarCountAction_(value) {
  const action = String(value || '').toUpperCase();
  return action === String(PMOS_OPERATION.MERGE || 'MERGE').toUpperCase()
    ? 'UPDATE'
    : action;
}

function executeReviewedCalendarOperation_(operation, state) {
  const action = String(operation && operation.action || '').toUpperCase();
  const reviewAction = String(
    operation && operation.metadata && operation.metadata.reviewAction || ''
  ).toUpperCase();
  const calendar = getRecurringCalendar_();

  if (reviewAction === 'MATCH') {
    return executeReviewedCalendarMatchOperation_(operation, calendar);
  }
  if (reviewAction === 'TEMPORARY') {
    return executeReviewedCalendarTemporaryOperation_(operation, calendar);
  }
  if (reviewAction === 'DELETE') {
    return executeReviewedCalendarDeleteOperation_(operation, calendar);
  }

  if (
    action === String(PMOS_OPERATION.CREATE).toUpperCase() ||
    action === String(PMOS_OPERATION.UPDATE).toUpperCase() ||
    action === String(PMOS_OPERATION.DELETE).toUpperCase() ||
    action === String(PMOS_OPERATION.MERGE || 'MERGE').toUpperCase()
  ) {
    return executeTransactionalReviewedRecurringOperation_(state, operation, calendar);
  }

  throw new Error('Unsupported executable Calendar operation: ' + action);
}

function executeTransactionalReviewedRecurringOperation_(state, operation, calendar) {
  const payload = operation && operation.payload || {};
  const rawAction = String(operation && operation.action || '').toUpperCase();
  const action = rawAction === String(PMOS_OPERATION.MERGE || 'MERGE').toUpperCase()
    ? 'UPDATE'
    : rawAction;
  const desired = reviveReviewedCalendarSeriesPlan_(payload.desired || null);
  const current = payload.current || {};
  const operationId = String(operation && operation.id || '').trim();
  const seriesKey = String(
    desired && desired.seriesKey ||
    current.seriesKey ||
    operation && operation.entityId || ''
  ).trim();

  if (!state || !state.id || !state.planId) {
    throw new Error('Calendar Sync transaction is missing active reviewed job state.');
  }
  if (!operationId) {
    throw new Error('Calendar Sync operation is missing its immutable operation ID.');
  }
  if (!seriesKey) {
    throw new Error('Calendar Sync recurring operation is missing its PMOS series key.');
  }

  const transactionOperation = {
    operationType: action,
    payload: {
      operationId: operationId,
      action: action,
      seriesKey: seriesKey
    }
  };
  const transaction = beginPmosCalendarRegistryTransaction_(
    state,
    transactionOperation,
    current || null,
    desired || null
  );

  try {
    if (String(transaction.status || '') === 'VERIFIED') {
      const verified = verifyReviewedRecurringOperationApplied_(
        action,
        desired,
        current,
        seriesKey,
        calendar
      );
      return {
        action: action,
        id: verified.seriesId || String(current.seriesId || ''),
        recovered: true,
        transactionId: transaction.transactionId
      };
    }

    let result;
    if (action === 'CREATE') {
      result = applyReviewedRecurringCreate_(
        desired,
        seriesKey,
        calendar,
        transaction.transactionId
      );
    } else if (action === 'UPDATE') {
      result = applyReviewedRecurringUpdate_(
        desired,
        current,
        seriesKey,
        calendar,
        transaction.transactionId
      );
    } else if (action === 'DELETE') {
      result = applyReviewedRecurringDelete_(
        current,
        seriesKey,
        calendar,
        transaction.transactionId
      );
    } else {
      throw new Error('Unsupported recurring Calendar transaction action: ' + action + '.');
    }

    const verified = verifyReviewedRecurringOperationApplied_(
      action,
      desired,
      current,
      seriesKey,
      calendar
    );
    completePmosCalendarRegistryTransaction_(
      transaction.transactionId,
      verified.seriesId
    );

    result.transactionId = transaction.transactionId;
    result.verified = true;
    return result;
  } catch (error) {
    try {
      failPmosCalendarRegistryTransaction_(transaction.transactionId, error);
    } catch (historyError) {
      console.error('Could not record Calendar transaction failure: ' + historyError);
    }
    throw error;
  }
}

function applyReviewedRecurringCreate_(desired, seriesKey, calendar, transactionId) {
  if (!desired || !desired.start || !desired.end) {
    throw new Error('CREATE operation is missing its recurring-series plan.');
  }
  desired.seriesKey = seriesKey;

  const registry = getSeriesRegistry_();
  const existingRecord = registry[seriesKey] || null;
  let series = findExistingPmosRecurringSeries_(calendar, desired, existingRecord);
  const recovered = Boolean(series);

  if (series) updateRecurringSeries_(series, desired);
  else series = createRecurringSeries_(calendar, desired);

  const seriesId = String(series.getId() || '');
  markPmosCalendarTransactionApplied_(transactionId, seriesId);
  upsertSeriesRegistry_(
    desired,
    seriesId,
    calendar.getName(),
    'Active',
    transactionId
  );
  markPmosCalendarTransactionRegistryApplied_(transactionId, seriesId);

  return {action:'CREATE', id:seriesId, recoveredExistingSeries:recovered};
}

function applyReviewedRecurringUpdate_(desired, current, seriesKey, calendar, transactionId) {
  if (!desired || !desired.start || !desired.end) {
    throw new Error('UPDATE operation is missing its desired recurring-series plan.');
  }
  desired.seriesKey = seriesKey;

  const seriesId = String(current.seriesId || current.id || '').trim();
  if (!seriesId) {
    throw new Error('UPDATE operation is missing its current Calendar series ID.');
  }

  const series = readPmosRecurringSeriesById_(calendar, seriesId);
  if (!series) {
    throw new Error('Calendar series could not be found for UPDATE: ' + seriesId);
  }

  updateRecurringSeries_(series, desired);
  markPmosCalendarTransactionApplied_(transactionId, seriesId);
  upsertSeriesRegistry_(
    desired,
    seriesId,
    calendar.getName(),
    'Active',
    transactionId
  );
  markPmosCalendarTransactionRegistryApplied_(transactionId, seriesId);

  return {action:'UPDATE', id:seriesId};
}

function applyReviewedRecurringDelete_(current, seriesKey, calendar, transactionId) {
  const seriesId = String(current.seriesId || current.id || '').trim();
  if (!seriesId) {
    throw new Error('DELETE operation is missing its exact Calendar series ID.');
  }

  const series = readPmosRecurringSeriesById_(calendar, seriesId);
  if (series) series.deleteEventSeries();
  markPmosCalendarTransactionApplied_(transactionId, seriesId);

  if (typeof deleteReviewedSeriesRegistryRowExact_ === 'function') {
    deleteReviewedSeriesRegistryRowExact_(seriesKey, seriesId);
  } else {
    deleteSeriesRegistryRow_(seriesKey);
  }
  markPmosCalendarTransactionRegistryApplied_(transactionId, seriesId);

  return {action:'DELETE', id:seriesId, alreadyAbsent:!series};
}

function verifyReviewedRecurringOperationApplied_(
    action, desired, current, seriesKey, calendar) {
  const registry = getSeriesRegistry_();

  if (action === 'DELETE') {
    const seriesId = String(current && (current.seriesId || current.id) || '').trim();
    if (readPmosRecurringSeriesById_(calendar, seriesId)) {
      throw new Error('Calendar deletion could not be verified for ' + seriesKey + '.');
    }
    if (registry[seriesKey]) {
      throw new Error('Calendar registry deletion could not be verified for ' + seriesKey + '.');
    }
    return {verified:true, seriesId:''};
  }

  const record = registry[seriesKey] || null;
  if (!record || !record.seriesId) {
    throw new Error('Calendar registry update could not be verified for ' + seriesKey + '.');
  }
  const series = readPmosRecurringSeriesById_(calendar, record.seriesId);
  if (!series) {
    throw new Error('Calendar series could not be reloaded after synchronization: ' + seriesKey + '.');
  }
  if (
    desired && desired.signature &&
    String(record.signature || '') !== String(desired.signature || '')
  ) {
    throw new Error('Calendar registry signature does not match the reviewed plan for ' + seriesKey + '.');
  }

  return {verified:true, seriesId:String(record.seriesId || '')};
}

function reviveReviewedCalendarSeriesPlan_(plan) {
  if (!plan) return null;
  const copy = Object.assign({}, plan);
  ['start', 'end', 'until'].forEach(function (key) {
    if (copy[key]) copy[key] = new Date(copy[key]);
  });
  return copy;
}

function ensureReviewedCalendarSyncTrigger_() {
  removeReviewedCalendarSyncTriggers_();
  ScriptApp.newTrigger(PMOS_REVIEWED_SYNC_TRIGGER).timeBased().after(1000).create();
}

function removeReviewedCalendarSyncTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === PMOS_REVIEWED_SYNC_TRIGGER) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function readReviewedCalendarSyncQueueItem_(index) {
  const sheet = ensureReviewedCalendarSyncQueueSheet_();
  const row = Number(index) + 2;
  if (row > sheet.getLastRow()) return null;

  const values = sheet.getRange(
    row,
    1,
    1,
    PMOS_REVIEWED_SYNC_QUEUE_HEADERS.length
  ).getValues()[0];

  if (Number(values[0]) !== Number(index)) return null;

  let operation = null;
  try {
    operation = JSON.parse(String(values[8] || ''));
  } catch (error) {
    throw new Error('Calendar Sync queue item ' + index + ' contains invalid operation JSON.');
  }

  return {
    row: row,
    index: Number(values[0]),
    operationId: String(values[1] || ''),
    action: String(values[2] || ''),
    entityId: String(values[3] || ''),
    status: String(values[4] || ''),
    attempts: Number(values[5] || 0),
    error: String(values[7] || ''),
    operation: operation
  };
}

function markReviewedCalendarSyncQueueItem_(row, status, error, attempts) {
  const sheet = ensureReviewedCalendarSyncQueueSheet_();
  sheet.getRange(row, 5, 1, 4).setValues([[
    String(status || ''),
    Number(attempts || 0),
    new Date(),
    String(error || '')
  ]]);
}

function clearReviewedCalendarSyncQueue_() {
  removeReviewedCalendarSyncTriggers_();
  PropertiesService.getDocumentProperties().deleteProperty(PMOS_REVIEWED_SYNC_STATE);

  const sheet = ensureReviewedCalendarSyncQueueSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(
      2,
      1,
      lastRow - 1,
      PMOS_REVIEWED_SYNC_QUEUE_HEADERS.length
    ).clearContent();
  }
}

function readReviewedCalendarSyncState_() {
  const raw = PropertiesService.getDocumentProperties().getProperty(PMOS_REVIEWED_SYNC_STATE);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function writeReviewedCalendarSyncState_(state) {
  PropertiesService.getDocumentProperties().setProperty(
    PMOS_REVIEWED_SYNC_STATE,
    JSON.stringify(state)
  );
}

function cloneReviewedCalendarSyncState_(state) {
  return state == null ? state : JSON.parse(JSON.stringify(state));
}
