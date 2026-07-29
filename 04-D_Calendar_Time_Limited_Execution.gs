/**
 * Executes Calendar Sync until the current Apps Script runtime window is nearly
 * exhausted. There is no fixed item count: each completed Calendar operation is
 * checkpointed, and the next invocation rebuilds the remaining action plan.
 */
function applyCalendarChangesUntilDeadline_(context) {
  if (!context) {
    context = createPmosRuntimeContext_('CALENDAR_SYNC');
  }

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

  let created = 0;
  let updated = 0;
  let deleted = 0;
  let errors = 0;
  let firstError = '';
  let attempted = 0;

  const liveJobState = readPmosJobState_();
  const baseProcessed = liveJobState
    ? Number(liveJobState.processedItems || 0)
    : 0;

  for (let index = 0; index < actions.length; index++) {
    if (pmosRuntimeShouldYield_(context)) break;

    const item = actions[index];

    try {
      if (item.action === 'CREATE') {
        const createdSeries = createRecurringSeries_(calendar, item.plan);
        upsertSeriesRegistry_(
          item.plan,
          createdSeries.getId(),
          calendar.getName(),
          'Active'
        );
        created++;

      } else if (item.action === 'UPDATE') {
        let workingSeries = item.series;

        if (!workingSeries) {
          workingSeries = createRecurringSeries_(calendar, item.plan);
          created++;
        } else {
          updateRecurringSeries_(workingSeries, item.plan);
          updated++;
        }

        upsertSeriesRegistry_(
          item.plan,
          workingSeries.getId(),
          calendar.getName(),
          'Active'
        );

      } else if (item.action === 'DELETE') {
        if (item.series) item.series.deleteEventSeries();
        deleteSeriesRegistryRow_(item.seriesKey);
        deleted++;
      }
    } catch (error) {
      errors++;
      const message = `${item.action} ${item.seriesKey}: ${error}`;
      if (!firstError) firstError = message;
      console.error(message);
      markSeriesRegistryError_(item.seriesKey, String(error));
    }

    attempted++;

    const successful = created + updated + deleted;
    const remaining = Math.max(0, actions.length - attempted) + errors;
    const summary =
      'Calendar Sync: ' + attempted + ' operation(s) attempted this run. ' +
      created + ' created, ' + updated + ' updated, ' + deleted +
      ' removed. ' + remaining + ' remain.';

    updatePmosLiveProgress_(
      baseProcessed,
      successful,
      remaining,
      summary
    );

    savePmosRuntimeCheckpoint_('CALENDAR_SYNC', {
      attemptedThisRun: attempted,
      successfulThisRun: successful,
      remaining,
      created,
      updated,
      deleted,
      errors,
      lastSeriesKey: String(item.seriesKey || ''),
      summary
    });

    heartbeatPmosRuntimeOperation_(context);
  }

  const remaining = Math.max(0, actions.length - attempted) + errors;

  if (!remaining) {
    clearPendingChanges_();
    storeRouteSignatures_();
    clearPmosRuntimeCheckpoint_('CALENDAR_SYNC');
    updateSyncStatus_(
      'Everything synchronized',
      `${plan.length} Calendar series are current.`
    );
  } else if (errors) {
    updateSyncStatus_(
      'Synchronization error',
      firstError || `${errors} recurring-series error(s).`
    );
  } else {
    updateSyncStatus_(
      'Synchronization in progress',
      `${remaining} recurring-series change(s) remain.`
    );
  }

  return {
    created,
    updated,
    deleted,
    errors,
    firstError,
    remaining,
    attempted,
    yielded: remaining > 0 && !errors && pmosRuntimeShouldYield_(context),
    calendarName: calendar.getName()
  };
}
