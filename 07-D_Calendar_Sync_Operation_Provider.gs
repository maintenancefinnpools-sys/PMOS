/**
 * Operation-level provider for CALENDAR_SYNC.
 *
 * Calendar Sync queues one verified immutable plan and executes each operation
 * through an append-only registry transaction.
 */
function getCalendarSyncOperationProvider_() {
  return {
    initialize: initializeCalendarSyncOperationQueue_,
    execute: executeTransactionalCalendarSyncOperation_,
    summarize: summarizeCalendarSyncOperation_,
    finalize: finalizeCalendarSyncOperations_
  };
}

function initializeCalendarSyncOperationQueue_(state) {
  const result = buildValidatedPmosCalendarSyncPlan_(
    state && state.calendarOptions ? state.calendarOptions : {}
  );
  if (!result.canExecute) {
    throw new Error(
      'Calendar Plan Audit failed with ' +
      Number(result.validation && result.validation.errorCount || 0) +
      ' blocking error(s).'
    );
  }

  const plan = result.plan;
  const auditedPlanId = String(state && state.auditedPlanId || '');
  if (!auditedPlanId) {
    throw new Error('Calendar Sync has no audited plan ID. Run Calendar Plan Audit again before starting.');
  }
  if (plan.id !== auditedPlanId) {
    throw new Error(
      'Calendar data changed after the Plan Audit. Expected plan ' + auditedPlanId +
      ', but the current plan is ' + plan.id +
      '. Run Calendar Plan Audit again before starting Calendar Sync.'
    );
  }

  const executable = plan.operations.filter(isPmosExecutableOperation);
  executable.forEach(function (operation) {
    if (
      operation.action === PMOS_OPERATION.DELETE &&
      !(operation.metadata && operation.metadata.deletionApproved === true)
    ) {
      throw new Error('Calendar plan contains an unapproved deletion: ' + operation.entityId + '.');
    }
  });

  const operations = executable.map(function (operation) {
    return {
      type: operation.action,
      payload: {
        planId: plan.id,
        sourceVersion: plan.sourceVersion || '',
        operationId: operation.id,
        action: operation.action,
        seriesKey: operation.entityId,
        deletionApproved: Boolean(
          operation.metadata && operation.metadata.deletionApproved === true
        ),
        desired: serializeCanonicalCalendarSeries_(
          operation.payload && operation.payload.desired
        ),
        current: cloneCalendarOperationPayload_(
          operation.payload && operation.payload.current
        )
      }
    };
  });

  const total = replacePmosJobOperationQueue_(state.id, state.type, operations);
  state.planId = plan.id;
  state.planSourceVersion = plan.sourceVersion || '';
  state.planCreatedAt = plan.createdAt || '';
  state.originalTotal = total;
  state.remaining = total;
  state.processedItems = 0;
  state.calendarName = plan.metadata.calendarName || '';
  state.lastSummary = total
    ? 'Calendar Sync prepared ' + total + ' verified operation(s).'
    : 'Calendar is already synchronized.';
  writePmosJobState_(state);

  updateSyncStatus_(
    total ? 'Synchronization in progress' : 'Everything synchronized',
    total
      ? total + ' verified Calendar operation(s) queued from plan ' + plan.id + '.'
      : Number(plan.metadata.desiredCount || 0) + ' Calendar series are current.'
  );
}

function executeTransactionalCalendarSyncOperation_(state, operation) {
  const payload = operation.payload || {};
  const transaction = beginPmosCalendarRegistryTransaction_(
    state,
    operation,
    payload.current || null,
    payload.desired || null
  );

  try {
    const result = executeCalendarSyncMutation_(state, operation);
    const verification = verifyAppliedCalendarSyncOperation_(operation, result);

    markPmosCalendarTransactionApplied_(
      transaction.transactionId,
      verification.seriesId
    );
    markPmosCalendarTransactionRegistryApplied_(
      transaction.transactionId,
      verification.seriesId
    );
    completePmosCalendarRegistryTransaction_(
      transaction.transactionId,
      verification.seriesId
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

function executeCalendarSyncMutation_(state, operation) {
  const payload = operation.payload || {};
  const action = String(operation.operationType || payload.action || '').toUpperCase();
  const seriesKey = String(payload.seriesKey || '');

  if (!payload.planId || payload.planId !== state.planId) {
    throw new Error('Calendar operation does not belong to the active audited plan.');
  }
  if (!payload.operationId) {
    throw new Error('Calendar operation is missing its immutable operation ID.');
  }

  const settings = getRecurringCalendarSettings_();
  const calendar = getExistingConfiguredPmosCalendar_(settings.calendarName);
  const registry = readExistingPmosCalendarRegistry_();
  const record = registry[seriesKey] || null;

  if (action === PMOS_OPERATION.CREATE) {
    const plan = deserializeCanonicalCalendarSeries_(payload.desired);
    const recovered = findExistingPmosRecurringSeries_(calendar, plan, record);
    const series = recovered || createRecurringSeries_(calendar, plan);
    if (recovered) updateRecurringSeries_(series, plan);
    upsertSeriesRegistry_(plan, series.getId(), calendar.getName(), 'Active');
    return {
      processed: 1,
      action: recovered ? 'RECOVER' : 'CREATE',
      title: plan.title,
      seriesId: String(series.getId() || '')
    };
  }

  if (action === PMOS_OPERATION.UPDATE) {
    const plan = deserializeCanonicalCalendarSeries_(payload.desired);
    const series = findExistingPmosRecurringSeries_(calendar, plan, record);
    const performedAction = series ? 'UPDATE' : 'CREATE';
    const finalSeries = series || createRecurringSeries_(calendar, plan);
    if (series) updateRecurringSeries_(series, plan);
    upsertSeriesRegistry_(plan, finalSeries.getId(), calendar.getName(), 'Active');
    return {
      processed: 1,
      action: performedAction,
      title: plan.title,
      seriesId: String(finalSeries.getId() || '')
    };
  }

  if (action === PMOS_OPERATION.DELETE) {
    if (payload.deletionApproved !== true) {
      throw new Error('Calendar deletion is not explicitly approved: ' + seriesKey + '.');
    }
    const current = payload.current || {};
    const approvedSeriesId = String(current.seriesId || '');
    if (!approvedSeriesId) {
      throw new Error('Approved Calendar deletion is missing its verified series ID.');
    }

    let series = null;
    try { series = calendar.getEventSeriesById(approvedSeriesId); }
    catch (error) { series = null; }
    if (series) series.deleteEventSeries();
    deleteSeriesRegistryRow_(seriesKey);
    return {
      processed: 1,
      action: series ? 'DELETE' : 'DELETE_ALREADY_APPLIED',
      title: String(current.title || seriesKey),
      seriesId: ''
    };
  }

  throw new Error('Unsupported Calendar Sync operation: ' + (action || '(blank)') + '.');
}

function verifyAppliedCalendarSyncOperation_(operation, result) {
  const payload = operation.payload || {};
  const action = String(operation.operationType || payload.action || '').toUpperCase();
  const seriesKey = String(payload.seriesKey || '');
  const settings = getRecurringCalendarSettings_();
  const calendar = getExistingConfiguredPmosCalendar_(settings.calendarName);
  const registry = readExistingPmosCalendarRegistry_();
  const record = registry[seriesKey] || null;

  if (action === PMOS_OPERATION.DELETE) {
    const approvedSeriesId = String(payload.current && payload.current.seriesId || '');
    const remainingSeries = readPmosRecurringSeriesById_(calendar, approvedSeriesId);
    if (remainingSeries || record) {
      throw new Error('Calendar deletion could not be verified for ' + seriesKey + '.');
    }
    return { verified: true, seriesId: '' };
  }

  if (!record || !record.seriesId) {
    throw new Error('Calendar registry update could not be verified for ' + seriesKey + '.');
  }
  const series = readPmosRecurringSeriesById_(calendar, record.seriesId);
  if (!series) {
    throw new Error('Calendar series could not be reloaded after synchronization: ' + seriesKey + '.');
  }

  const desired = payload.desired || {};
  if (desired.signature && String(record.signature || '') !== String(desired.signature)) {
    throw new Error('Calendar registry signature does not match the applied plan for ' + seriesKey + '.');
  }
  if (result.seriesId && String(result.seriesId) !== String(record.seriesId)) {
    throw new Error('Calendar operation and registry disagree on the resulting series ID for ' + seriesKey + '.');
  }

  return { verified: true, seriesId: String(record.seriesId || '') };
}

function findExistingPmosRecurringSeries_(calendar, plan, registryRecord) {
  const fromRegistry = readPmosRecurringSeriesById_(
    calendar,
    registryRecord && registryRecord.seriesId
  );
  if (fromRegistry) return fromRegistry;

  const searchStart = new Date(plan.start.getTime());
  searchStart.setDate(searchStart.getDate() - 1);
  searchStart.setHours(0, 0, 0, 0);
  const searchEnd = new Date(plan.start.getTime());
  searchEnd.setDate(searchEnd.getDate() + 35);
  searchEnd.setHours(23, 59, 59, 999);

  const matchesBySeriesId = {};
  calendar.getEvents(searchStart, searchEnd).forEach(function (event) {
    if (!event.isRecurringEvent()) return;
    const metadata = parsePmosCalendarMetadata_(event.getDescription());
    if (String(metadata.PMOS_SERIES_KEY || '') !== String(plan.seriesKey || '')) return;
    const seriesId = readPmosCalendarEventSeriesId_(event);
    if (seriesId) matchesBySeriesId[seriesId] = true;
  });

  const seriesIds = Object.keys(matchesBySeriesId);
  if (seriesIds.length > 1) {
    throw new Error(
      'More than one recurring Calendar series has PMOS series key ' +
      plan.seriesKey + '. Resolve the duplicate before Calendar Sync continues.'
    );
  }
  return seriesIds.length ? readPmosRecurringSeriesById_(calendar, seriesIds[0]) : null;
}

function readPmosRecurringSeriesById_(calendar, seriesId) {
  const id = String(seriesId || '').trim();
  if (!id) return null;
  try { return calendar.getEventSeriesById(id) || null; }
  catch (error) { return null; }
}

function summarizeCalendarSyncOperation_(state, operation, result, remaining) {
  const action = String(result.action || operation.operationType || 'operation');
  const desired = operation.payload && operation.payload.desired || {};
  const current = operation.payload && operation.payload.current || {};
  const title = String(
    result.title || desired.title || current.title ||
    operation.payload.seriesKey || 'series'
  );
  return 'Calendar Sync: ' + action + ' complete for ' + title + '. ' +
    remaining + ' operation(s) remain.';
}

function finalizeCalendarSyncOperations_(state) {
  const verification = buildValidatedPmosCalendarSyncPlan_(
    state && state.calendarOptions ? state.calendarOptions : {}
  );
  const remainingExecutable = verification.plan.operations.filter(isPmosExecutableOperation);
  if (remainingExecutable.length) {
    throw new Error(
      'Calendar Sync execution finished, but verification still finds ' +
      remainingExecutable.length + ' executable change(s).'
    );
  }

  const incompleteTransactions = readRecoverablePmosCalendarTransactions_()
    .filter(function (transaction) {
      return transaction.jobId === String(state && state.id || '') &&
        transaction.status !== 'VERIFIED';
    });
  if (incompleteTransactions.length) {
    throw new Error(
      'Calendar Sync cannot finalize because ' + incompleteTransactions.length +
      ' registry transaction(s) still require recovery.'
    );
  }

  clearPendingChanges_();
  storeRouteSignatures_();
  const total = Number(state.originalTotal || state.processedItems || 0);
  updateSyncStatus_(
    'Everything synchronized',
    total + ' verified Calendar change(s) completed from plan ' +
      String(state.planId || '') + '.'
  );
  state.lastSummary = total
    ? 'Calendar Sync completed and verified ' + total + ' operation(s).'
    : 'Calendar was already synchronized and verified.';
}

function serializeCanonicalCalendarSeries_(record) {
  if (!record) return null;
  return {
    seriesKey: String(record.seriesKey || ''), customerId: String(record.customerId || ''),
    layer: String(record.layer || ''), title: String(record.title || ''),
    startIso: String(record.start || ''), endIso: String(record.end || ''),
    untilIso: String(record.until || ''), location: String(record.location || ''),
    description: String(record.description || ''), color: String(record.color || ''),
    signature: String(record.signature || '')
  };
}

function deserializeCanonicalCalendarSeries_(payload) {
  if (!payload) throw new Error('Calendar operation is missing its desired series.');
  const start = new Date(payload.startIso);
  const end = new Date(payload.endIso);
  const until = payload.untilIso ? new Date(payload.untilIso) : null;
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new Error('Invalid Calendar series dates for ' + String(payload.seriesKey || payload.title || 'unknown series') + '.');
  }
  if (until && !Number.isFinite(until.getTime())) {
    throw new Error('Invalid recurrence end date for ' + String(payload.seriesKey || payload.title || 'unknown series') + '.');
  }
  return {
    seriesKey: String(payload.seriesKey || ''), customerId: String(payload.customerId || ''),
    layer: String(payload.layer || ''), title: String(payload.title || ''),
    start: start, end: end, until: until,
    location: String(payload.location || ''), description: String(payload.description || ''),
    color: String(payload.color || ''), signature: String(payload.signature || ''), row: {}
  };
}

function cloneCalendarOperationPayload_(value) {
  if (value == null || typeof value !== 'object') return value || null;
  if (Array.isArray(value)) return value.map(cloneCalendarOperationPayload_);
  const copy = {};
  Object.keys(value).forEach(function (key) {
    copy[key] = cloneCalendarOperationPayload_(value[key]);
  });
  return copy;
}
