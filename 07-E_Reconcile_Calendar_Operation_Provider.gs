/**
 * Operation-level provider for RECONCILE_FUTURE.
 *
 * Reconciliation deliberately replaces every registered future recurring
 * series with the current PMOS plan. Deletes are queued first, followed by
 * creates, and the shared runtime worker executes one mutation at a time.
 */
function getReconcileCalendarOperationProvider_() {
  return {
    initialize: initializeReconcileCalendarOperationQueue_,
    execute: executeReconcileCalendarOperation_,
    summarize: summarizeReconcileCalendarOperation_,
    finalize: finalizeReconcileCalendarOperations_
  };
}

function initializeReconcileCalendarOperationQueue_(state) {
  const audit = runCalendarPlanAudit_();
  if (!audit.canSync) {
    throw new Error(
      `Calendar Plan Audit failed with ${audit.errorCount} blocking error(s).`
    );
  }

  ensureSupportSheets_();
  synchronizeCustomerDatabase_(true);
  ensureRecurringSeriesRegistry_();

  const calendar = getRecurringCalendar_();
  const registry = getSeriesRegistry_();
  const plan = buildRecurringSeriesPlan_();
  const operations = [];

  Object.keys(registry).forEach(seriesKey => {
    const record = registry[seriesKey] || {};
    operations.push({
      type: 'DELETE_SERIES',
      payload: {
        seriesKey,
        seriesId: String(record.seriesId || ''),
        layer: String(record.layer || ''),
        title: seriesKey
      }
    });
  });

  plan.forEach(item => {
    operations.push({
      type: 'CREATE_SERIES',
      payload: {
        seriesKey: item.seriesKey,
        layer: item.layer || '',
        title: item.title || item.seriesKey,
        plan: serializeCalendarSeriesPlan_(item)
      }
    });
  });

  const total = replacePmosJobOperationQueue_(
    state.id,
    state.type,
    operations
  );

  state.originalTotal = total;
  state.remaining = total;
  state.processedItems = 0;
  state.calendarName = calendar.getName();
  state.reconcileDeleteTotal = Object.keys(registry).length;
  state.reconcileCreateTotal = plan.length;
  state.lastSummary = total
    ? `Reconcile Calendar prepared ${total} operation(s).`
    : 'No Calendar series require reconciliation.';
  writePmosJobState_(state);

  updateSyncStatus_(
    total ? 'Calendar reconciliation in progress' : 'Everything synchronized',
    total
      ? `${state.reconcileDeleteTotal} removal(s) and ${state.reconcileCreateTotal} creation(s) queued.`
      : 'No recurring Calendar series require reconciliation.'
  );
}

function executeReconcileCalendarOperation_(state, operation) {
  const payload = operation.payload || {};
  const action = String(operation.operationType || '').toUpperCase();
  const seriesKey = String(payload.seriesKey || '');
  const calendar = getRecurringCalendar_();

  if (action === 'DELETE_SERIES') {
    const registry = getSeriesRegistry_();
    const record = registry[seriesKey] || null;
    const seriesId = String(
      (record && record.seriesId) || payload.seriesId || ''
    );

    if (seriesId) {
      try {
        const series = calendar.getEventSeriesById(seriesId);
        if (series) series.deleteEventSeries();
      } catch (error) {
        // A missing series is already reconciled from the Calendar side.
        if (!/not found|does not exist|invalid event/i.test(String(error))) {
          throw error;
        }
      }
    }

    deleteSeriesRegistryRow_(seriesKey);
    return {
      processed: 1,
      action: 'DELETE',
      title: String(payload.title || seriesKey)
    };
  }

  if (action === 'CREATE_SERIES') {
    const plan = deserializeCalendarSeriesPlan_(payload.plan);
    const registry = getSeriesRegistry_();
    const existing = registry[plan.seriesKey] || null;

    // This makes a resumed operation safe when Calendar creation succeeded but
    // queue completion was interrupted before the operation row was updated.
    if (existing && existing.seriesId && existing.signature === plan.signature) {
      return {
        processed: 1,
        action: 'CREATE',
        title: plan.title,
        alreadyComplete: true
      };
    }

    const series = createRecurringSeries_(calendar, plan);
    upsertSeriesRegistry_(
      plan,
      series.getId(),
      calendar.getName(),
      'Active'
    );

    return {
      processed: 1,
      action: 'CREATE',
      title: plan.title
    };
  }

  throw new Error(
    `Unsupported Reconcile Calendar operation: ${action || '(blank)'}.`
  );
}

function summarizeReconcileCalendarOperation_(state, operation, result, remaining) {
  const action = String(result.action || operation.operationType || 'operation');
  const payload = operation.payload || {};
  const title = String(result.title || payload.title || payload.seriesKey || 'series');
  return `Reconcile Calendar: ${action} complete for ${title}. ${remaining} operation(s) remain.`;
}

function finalizeReconcileCalendarOperations_(state) {
  clearPendingChanges_();
  storeRouteSignatures_();

  // Remove legacy transitional state if it exists in an upgraded deployment.
  if (typeof clearCalendarRebuildState_ === 'function') {
    clearCalendarRebuildState_();
  }

  const created = Number(state.reconcileCreateTotal || 0);
  const removed = Number(state.reconcileDeleteTotal || 0);

  updateSyncStatus_(
    'Everything synchronized',
    `${created} recurring Calendar series reconciled; ${removed} previous series removed.`
  );

  state.lastSummary =
    `Reconcile Calendar complete: ${removed} removed and ${created} created.`;
}
