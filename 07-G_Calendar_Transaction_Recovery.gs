/**
 * Deterministic recovery for incomplete Calendar registry transactions.
 *
 * Recovery never guesses. It finalizes operations only when live Calendar and
 * registry state prove the intended result. Operations whose Calendar change
 * was not applied remain retryable through the idempotent operation queue.
 * Ambiguous or conflicting state blocks Calendar Sync for manual review.
 */

function recoverPmosCalendarRegistryTransactions_() {
  const transactions = readRecoverablePmosCalendarTransactions_();
  if (!transactions.length) {
    return {
      inspected: 0,
      finalized: 0,
      retryRequired: 0,
      manualReview: 0,
      issues: []
    };
  }

  const settings = getRecurringCalendarSettings_();
  const calendar = getExistingConfiguredPmosCalendar_(settings.calendarName);
  const registry = readExistingPmosCalendarRegistry_();
  const result = {
    inspected: transactions.length,
    finalized: 0,
    retryRequired: 0,
    manualReview: 0,
    issues: []
  };

  transactions.forEach(function (transaction) {
    const resolution = resolvePmosCalendarTransaction_(
      transaction,
      calendar,
      registry
    );

    if (resolution.status === 'FINALIZED') result.finalized++;
    else if (resolution.status === 'RETRY_REQUIRED') result.retryRequired++;
    else {
      result.manualReview++;
      result.issues.push(resolution);
    }
  });

  return result;
}

function resolvePmosCalendarTransaction_(transaction, calendar, registry) {
  const action = String(transaction.action || '').toUpperCase();
  const seriesKey = String(transaction.seriesKey || '');

  if (!seriesKey) {
    return manualPmosCalendarRecovery_(
      transaction,
      'Transaction is missing its PMOS series key.'
    );
  }

  if (action === PMOS_OPERATION.DELETE || action === 'DELETE') {
    return resolvePmosCalendarDeleteTransaction_(transaction, calendar, registry);
  }

  if (
    action === PMOS_OPERATION.CREATE || action === 'CREATE' ||
    action === PMOS_OPERATION.UPDATE || action === 'UPDATE'
  ) {
    return resolvePmosCalendarUpsertTransaction_(transaction, calendar, registry);
  }

  return manualPmosCalendarRecovery_(
    transaction,
    'Unsupported transaction action: ' + (action || '(blank)') + '.'
  );
}

function resolvePmosCalendarUpsertTransaction_(transaction, calendar, registry) {
  const desiredPayload = transaction.after;
  if (!desiredPayload) {
    return manualPmosCalendarRecovery_(
      transaction,
      'Transaction has no intended Calendar series state.'
    );
  }

  let desired;
  try {
    desired = deserializeCanonicalCalendarSeries_(desiredPayload);
  } catch (error) {
    return manualPmosCalendarRecovery_(transaction, error.message);
  }

  const registryRecord = registry[transaction.seriesKey] || null;
  let series;
  try {
    series = findExistingPmosRecurringSeries_(calendar, desired, registryRecord);
  } catch (error) {
    return manualPmosCalendarRecovery_(transaction, error.message);
  }

  if (!series) {
    // Calendar did not receive the intended change. The normal idempotent queue
    // may safely execute this operation again.
    return {
      status: 'RETRY_REQUIRED',
      transactionId: transaction.transactionId,
      operationId: transaction.operationId,
      seriesKey: transaction.seriesKey,
      reason: 'No matching Calendar series exists; retry the queued operation.'
    };
  }

  const seriesId = String(series.getId() || '');
  if (!seriesId) {
    return manualPmosCalendarRecovery_(
      transaction,
      'Matching Calendar series has no readable series ID.'
    );
  }

  // Calendar proves that the series exists. Rebuild or correct the registry
  // row from the immutable intended state, then verify both sides.
  upsertSeriesRegistry_(
    desired,
    seriesId,
    calendar.getName(),
    'Active'
  );
  markPmosCalendarTransactionApplied_(transaction.transactionId, seriesId);
  markPmosCalendarTransactionRegistryApplied_(transaction.transactionId, seriesId);

  const refreshedRegistry = readExistingPmosCalendarRegistry_();
  const refreshed = refreshedRegistry[transaction.seriesKey] || null;
  if (
    !refreshed ||
    String(refreshed.seriesId || '') !== seriesId ||
    String(refreshed.signature || '') !== String(desired.signature || '')
  ) {
    return manualPmosCalendarRecovery_(
      transaction,
      'Calendar series exists, but the rebuilt registry row could not be verified.'
    );
  }

  completePmosCalendarRegistryTransaction_(transaction.transactionId, seriesId);
  return {
    status: 'FINALIZED',
    transactionId: transaction.transactionId,
    operationId: transaction.operationId,
    seriesKey: transaction.seriesKey,
    seriesId: seriesId,
    reason: 'Existing Calendar series and rebuilt registry row were verified.'
  };
}

function resolvePmosCalendarDeleteTransaction_(transaction, calendar, registry) {
  const seriesId = String(
    transaction.resultSeriesId ||
    transaction.previousSeriesId ||
    transaction.before && transaction.before.seriesId ||
    ''
  );

  let series = null;
  if (seriesId) series = readPmosRecurringSeriesById_(calendar, seriesId);

  if (series) {
    return {
      status: 'RETRY_REQUIRED',
      transactionId: transaction.transactionId,
      operationId: transaction.operationId,
      seriesKey: transaction.seriesKey,
      reason: 'Approved Calendar series still exists; retry the idempotent deletion.'
    };
  }

  if (registry[transaction.seriesKey]) {
    deleteSeriesRegistryRow_(transaction.seriesKey);
  }

  const refreshedRegistry = readExistingPmosCalendarRegistry_();
  if (refreshedRegistry[transaction.seriesKey]) {
    return manualPmosCalendarRecovery_(
      transaction,
      'Calendar series is absent, but its registry row could not be removed.'
    );
  }

  markPmosCalendarTransactionApplied_(transaction.transactionId, seriesId);
  markPmosCalendarTransactionRegistryApplied_(transaction.transactionId, seriesId);
  completePmosCalendarRegistryTransaction_(transaction.transactionId, seriesId);

  return {
    status: 'FINALIZED',
    transactionId: transaction.transactionId,
    operationId: transaction.operationId,
    seriesKey: transaction.seriesKey,
    seriesId: seriesId,
    reason: 'Calendar deletion and registry removal were verified.'
  };
}

function manualPmosCalendarRecovery_(transaction, reason) {
  const message = String(reason || 'Calendar transaction requires manual review.');
  try {
    failPmosCalendarRegistryTransaction_(transaction.transactionId, message);
  } catch (error) {
    // Preserve the original recovery issue if the history sheet itself cannot
    // be updated.
  }
  return {
    status: 'MANUAL_REVIEW',
    transactionId: transaction.transactionId,
    operationId: transaction.operationId,
    seriesKey: transaction.seriesKey,
    reason: message
  };
}

function assertNoAmbiguousPmosCalendarRecovery_(recovery) {
  const result = recovery || recoverPmosCalendarRegistryTransactions_();
  if (!Number(result.manualReview || 0)) return result;

  const first = result.issues && result.issues[0] || {};
  throw new Error(
    Number(result.manualReview || 0) +
    ' Calendar transaction(s) require manual review before synchronization can continue. ' +
    String(first.seriesKey ? 'First series: ' + first.seriesKey + '. ' : '') +
    String(first.reason || '')
  );
}
