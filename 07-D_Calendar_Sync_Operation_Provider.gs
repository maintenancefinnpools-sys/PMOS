/**
 * Operation-level provider for CALENDAR_SYNC.
 *
 * The plan is calculated once, converted into durable queue rows, and then
 * executed one Calendar mutation at a time by the shared runtime worker.
 */
function getCalendarSyncOperationProvider_() {
  return {
    initialize: initializeCalendarSyncOperationQueue_,
    execute: executeCalendarSyncOperation_,
    summarize: summarizeCalendarSyncOperation_,
    finalize: finalizeCalendarSyncOperations_
  };
}

function initializeCalendarSyncOperationQueue_(state) {
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
  const plan = buildRecurringSeriesPlan_();
  const registry = getSeriesRegistry_();
  const actions = compareSeriesPlanToRegistry_(plan, registry, calendar);

  const operations = actions.map(action => ({
    type: action.action,
    payload: {
      action: action.action,
      seriesKey: action.seriesKey,
      layer: action.layer || '',
      title: action.title || action.seriesKey || '',
      plan: action.plan ? serializeCalendarSeriesPlan_(action.plan) : null
    }
  }));

  const total = replacePmosJobOperationQueue_(
    state.id,
    state.type,
    operations
  );

  state.originalTotal = total;
  state.remaining = total;
  state.processedItems = 0;
  state.calendarName = calendar.getName();
  state.lastSummary = total
    ? `Calendar Sync prepared ${total} operation(s).`
    : 'Calendar is already synchronized.';
  writePmosJobState_(state);

  updateSyncStatus_(
    total ? 'Synchronization in progress' : 'Everything synchronized',
    total
      ? `${total} recurring-series change(s) queued.`
      : `${plan.length} Calendar series are current.`
  );
}

function executeCalendarSyncOperation_(state, operation) {
  const payload = operation.payload || {};
  const action = String(operation.operationType || payload.action || '').toUpperCase();
  const seriesKey = String(payload.seriesKey || '');
  const calendar = getRecurringCalendar_();
  const registry = getSeriesRegistry_();
  const record = registry[seriesKey] || null;

  if (action === 'CREATE') {
    const plan = deserializeCalendarSeriesPlan_(payload.plan);
    const series = createRecurringSeries_(calendar, plan);
    upsertSeriesRegistry_(
      plan,
      series.getId(),
      calendar.getName(),
      'Active'
    );
    return {processed: 1, action: 'CREATE', title: plan.title};
  }

  if (action === 'UPDATE') {
    const plan = deserializeCalendarSeriesPlan_(payload.plan);
    let series = null;

    if (record && record.seriesId) {
      try {
        series = calendar.getEventSeriesById(record.seriesId);
      } catch (error) {
        console.warn(`Could not reload recurring series ${record.seriesId}: ${error}`);
      }
    }

    if (series) {
      updateRecurringSeries_(series, plan);
    } else {
      series = createRecurringSeries_(calendar, plan);
    }

    upsertSeriesRegistry_(
      plan,
      series.getId(),
      calendar.getName(),
      'Active'
    );

    return {
      processed: 1,
      action: series && record && record.seriesId ? 'UPDATE' : 'CREATE',
      title: plan.title
    };
  }

  if (action === 'DELETE') {
    if (record && record.seriesId) {
      const series = calendar.getEventSeriesById(record.seriesId);
      if (series) series.deleteEventSeries();
    }

    deleteSeriesRegistryRow_(seriesKey);
    return {
      processed: 1,
      action: 'DELETE',
      title: String(payload.title || seriesKey)
    };
  }

  throw new Error(`Unsupported Calendar Sync operation: ${action || '(blank)'}.`);
}

function summarizeCalendarSyncOperation_(state, operation, result, remaining) {
  const action = String(result.action || operation.operationType || 'operation');
  const title = String(result.title || operation.payload.title || operation.payload.seriesKey || 'series');
  return `Calendar Sync: ${action} complete for ${title}. ${remaining} operation(s) remain.`;
}

function finalizeCalendarSyncOperations_(state) {
  clearPendingChanges_();
  storeRouteSignatures_();

  const total = Number(state.originalTotal || state.processedItems || 0);
  updateSyncStatus_(
    'Everything synchronized',
    `${total} Calendar change(s) completed.`
  );

  state.lastSummary = total
    ? `Calendar Sync completed ${total} operation(s).`
    : 'Calendar was already synchronized.';
}

function serializeCalendarSeriesPlan_(plan) {
  if (!plan) return null;

  return {
    seriesKey: String(plan.seriesKey || ''),
    customerId: String(plan.customerId || ''),
    layer: String(plan.layer || ''),
    title: String(plan.title || ''),
    startIso: plan.start instanceof Date ? plan.start.toISOString() : String(plan.start || ''),
    endIso: plan.end instanceof Date ? plan.end.toISOString() : String(plan.end || ''),
    untilIso: plan.until instanceof Date ? plan.until.toISOString() : '',
    location: String(plan.location || ''),
    description: String(plan.description || ''),
    color: String(plan.color || ''),
    signature: String(plan.signature || ''),
    row: plan.row || {}
  };
}

function deserializeCalendarSeriesPlan_(payload) {
  if (!payload) throw new Error('Calendar operation is missing its series plan.');

  const start = new Date(payload.startIso);
  const end = new Date(payload.endIso);
  const until = payload.untilIso ? new Date(payload.untilIso) : null;

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new Error(`Invalid Calendar series dates for ${payload.seriesKey || payload.title}.`);
  }

  if (until && !Number.isFinite(until.getTime())) {
    throw new Error(`Invalid recurrence end date for ${payload.seriesKey || payload.title}.`);
  }

  return {
    seriesKey: String(payload.seriesKey || ''),
    customerId: String(payload.customerId || ''),
    layer: String(payload.layer || ''),
    title: String(payload.title || ''),
    start,
    end,
    until,
    location: String(payload.location || ''),
    description: String(payload.description || ''),
    color: String(payload.color || ''),
    signature: String(payload.signature || ''),
    row: payload.row || {}
  };
}
