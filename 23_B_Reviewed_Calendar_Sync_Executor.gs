/** Resumable executor for a validated reviewed Calendar Sync plan. */
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
  if (!lock.tryLock(1000)) return;

  try {
    let state = readReviewedCalendarSyncState_();
    if (!state || ['Complete', 'Paused on error', 'Cancelled'].indexOf(state.status) >= 0) {
      removeReviewedCalendarSyncTriggers_();
      return;
    }

    const session = requireActivePmosReviewSession_('CALENDAR');
    if (session.id !== state.sessionId) {
      throw new Error('The active Calendar Review Session changed before synchronization completed.');
    }

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
      const queueItem = readReviewedCalendarSyncQueueItem_(state.cursor);
      if (!queueItem || !queueItem.operation) {
        throw new Error('Calendar Sync queue item ' + state.cursor + ' is missing.');
      }

      const operation = queueItem.operation;
      const operationLabel = String(
        operation.id || operation.entityId || ('Operation ' + (state.cursor + 1))
      );

      state.currentOperation = operationLabel;
      state.updatedAt = new Date().toISOString();
      writeReviewedCalendarSyncState_(state);
      markReviewedCalendarSyncQueueItem_(queueItem.row, 'Running', '', queueItem.attempts + 1);

      try {
        const outcome = executeReviewedCalendarOperation_(operation);
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
    const queueIndex = Number(rows[index][0]);
    if (queueIndex !== index) {
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
      const action = String(rows[index][2] || '').toUpperCase();
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

function executeReviewedCalendarOperation_(operation) {
  const action = String(operation && operation.action || '').toUpperCase();
  const payload = operation && operation.payload || {};
  const desired = reviveReviewedCalendarSeriesPlan_(payload.desired || null);
  const current = payload.current || {};
  const reviewAction = String(
    operation && operation.metadata && operation.metadata.reviewAction || ''
  ).toUpperCase();

  if (reviewAction && ['MATCH', 'TEMPORARY'].indexOf(reviewAction) >= 0) {
    throw new Error(
      'Review operation ' + reviewAction +
      ' does not yet have a verified Calendar mutation adapter. Operation: ' +
      String(operation.id || operation.entityId || 'unknown')
    );
  }

  const calendar = getRecurringCalendar_();

  if (action === String(PMOS_OPERATION.CREATE).toUpperCase()) {
    if (!desired || !desired.seriesKey || !desired.start || !desired.end) {
      throw new Error('CREATE operation is missing its recurring-series plan.');
    }
    const series = createReviewedRecurringSeries_(calendar, desired);
    upsertReviewedSeriesRegistry_(
      desired,
      series.getId(),
      getRecurringCalendarSettings_().calendarName,
      'Active'
    );
    return {action: 'CREATE', id: series.getId()};
  }

  if (action === String(PMOS_OPERATION.UPDATE).toUpperCase()) {
    if (!desired || !desired.seriesKey) {
      throw new Error('UPDATE operation is missing its desired series plan.');
    }
    const seriesId = String(current.seriesId || current.id || payload.seriesId || '');
    if (!seriesId) throw new Error('UPDATE operation is missing its current Calendar series ID.');
    const series = calendar.getEventSeriesById(seriesId);
    if (!series) throw new Error('Calendar series could not be found for UPDATE: ' + seriesId);
    updateReviewedRecurringSeries_(series, desired);
    upsertReviewedSeriesRegistry_(
      desired,
      series.getId(),
      getRecurringCalendarSettings_().calendarName,
      'Active'
    );
    return {action: 'UPDATE', id: series.getId()};
  }

  if (action === String(PMOS_OPERATION.DELETE).toUpperCase()) {
    const seriesId = String(current.seriesId || current.id || payload.seriesId || '');
    const eventId = String(current.eventId || payload.eventId || '');

    if (seriesId) {
      const series = calendar.getEventSeriesById(seriesId);
      if (series) series.deleteEventSeries();
    } else if (eventId) {
      const event = calendar.getEventById(eventId);
      if (event) event.deleteEvent();
    } else {
      throw new Error('DELETE operation is missing a Calendar event or series ID.');
    }

    deleteReviewedSeriesRegistryRow_(
      String(operation.entityId || current.seriesKey || '')
    );
    return {action: 'DELETE', id: seriesId || eventId};
  }

  throw new Error('Unsupported executable Calendar operation: ' + action);
}

function createReviewedRecurringSeries_(calendar, plan) {
  const series = calendar.createEventSeries(
    plan.title,
    plan.start,
    plan.end,
    buildReviewedFourWeekRecurrence_(plan),
    {description: plan.description || '', location: plan.location || ''}
  );
  series.setTag('PMOS_SERIES_KEY', plan.seriesKey);
  series.setTag('PMOS_CUSTOMER_ID', plan.customerId || '');
  if (plan.color) series.setColor(String(plan.color));
  return series;
}

function updateReviewedRecurringSeries_(series, plan) {
  series.setTitle(plan.title);
  series.setDescription(plan.description || '');
  series.setLocation(plan.location || '');
  series.setRecurrence(buildReviewedFourWeekRecurrence_(plan), plan.start, plan.end);
  series.setTag('PMOS_SERIES_KEY', plan.seriesKey);
  series.setTag('PMOS_CUSTOMER_ID', plan.customerId || '');
  if (plan.color) series.setColor(String(plan.color));
}

function buildReviewedFourWeekRecurrence_(plan) {
  const recurrence = CalendarApp.newRecurrence().setTimeZone(PMOS.TIMEZONE);
  const rule = recurrence.addWeeklyRule().interval(4);
  if (plan.until) rule.until(plan.until);
  return recurrence;
}

function reviveReviewedCalendarSeriesPlan_(plan) {
  if (!plan) return null;
  const copy = Object.assign({}, plan);
  ['start', 'end', 'until'].forEach(function (key) {
    if (copy[key]) copy[key] = new Date(copy[key]);
  });
  return copy;
}

function upsertReviewedSeriesRegistry_(plan, seriesId, calendarName, status) {
  const sheet = ensureRecurringSeriesRegistry_();
  const values = sheet.getDataRange().getValues();
  let rowNumber = 0;

  for (let index = 1; index < values.length; index++) {
    if (String(values[index][0] || '') === String(plan.seriesKey || '')) {
      rowNumber = index + 1;
      break;
    }
  }

  const row = [
    plan.seriesKey,
    plan.customerId || '',
    plan.layer || '',
    seriesId,
    calendarName,
    plan.signature || '',
    new Date(),
    status || 'Active',
    ''
  ];

  if (rowNumber) sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
}

function deleteReviewedSeriesRegistryRow_(seriesKey) {
  if (!seriesKey) return;
  const sheet = ensureRecurringSeriesRegistry_();
  const values = sheet.getDataRange().getValues();
  for (let index = values.length - 1; index >= 1; index--) {
    if (String(values[index][0] || '') === seriesKey) sheet.deleteRow(index + 1);
  }
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
