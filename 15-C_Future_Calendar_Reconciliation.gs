/**
 * PMOS future Calendar reconciliation.
 * Planning and execution remain separate and resumable.
 */

function previewReconcileFutureCalendar(value) {
  const effectiveDate = parseCalendarEffectiveDate_(value);
  const plan = buildCalendarReconciliationPlan_(effectiveDate);
  const counts = countCalendarReconciliationOperations_(plan.operations);
  return {
    effectiveDate: plan.effectiveDate,
    managedOccurrencesToRemove: counts.DELETE,
    recurringSeriesToCreate: counts.CREATE,
    summary: [
      'Effective date: ' + plan.effectiveDate,
      'PMOS-managed future occurrences to remove: ' + counts.DELETE,
      'Future recurring series to create: ' + counts.CREATE,
      '',
      'No Calendar changes were made.'
    ].join('\n')
  };
}

function reconcileFutureCalendar(value, confirmed) {
  if (confirmed !== true) {
    throw new Error('Reconciliation requires explicit confirmation.');
  }
  const effectiveDate = parseCalendarEffectiveDate_(value);
  const plan = buildCalendarReconciliationPlan_(effectiveDate);
  saveCalendarReconciliationPlan_(plan);
  savePmosRuntimeCheckpoint_(PMOS_CALENDAR_CONFIG.RECONCILE.OPERATION, {
    index: 0,
    removed: 0,
    created: 0,
    skipped: 0,
    errors: [],
    effectiveDate: plan.effectiveDate,
    registryCleared: false
  });
  removeFutureCalendarReconciliationContinuation_();
  return runFutureCalendarReconciliation_();
}

function runFutureCalendarReconciliationContinuation() {
  return runFutureCalendarReconciliation_();
}

function buildCalendarReconciliationPlan_(effectiveDate) {
  const calendar = getRecurringCalendar_();
  const horizon = new Date(effectiveDate);
  horizon.setFullYear(
    horizon.getFullYear() + PMOS_CALENDAR_CONFIG.RECONCILE.HORIZON_YEARS
  );

  const deletes = calendar.getEvents(effectiveDate, horizon)
    .filter(isPmosManagedCalendarEvent_)
    .map(function (event) {
      return {
        action: 'DELETE',
        title: String(event.getTitle() || ''),
        start: event.getStartTime().toISOString(),
        end: event.getEndTime().toISOString(),
        descriptionKey: calendarReconcileDescriptionKey_(event.getDescription())
      };
    })
    .sort(compareCalendarReconciliationOperations_);

  const creates = buildRecurringSeriesPlan_()
    .map(function (seriesPlan) {
      return shiftPlanToEffectiveDate_(seriesPlan, effectiveDate);
    })
    .filter(function (seriesPlan) {
      return !seriesPlan.until ||
        seriesPlan.start.getTime() <= seriesPlan.until.getTime();
    })
    .map(function (seriesPlan) {
      return {
        action: 'CREATE',
        title: String(seriesPlan.title || ''),
        seriesPlan: serializeCalendarSeriesPlan_(seriesPlan)
      };
    })
    .sort(compareCalendarReconciliationOperations_);

  return {
    version: 2,
    createdAt: new Date().toISOString(),
    calendarId: calendar.getId(),
    calendarName: calendar.getName(),
    effectiveDate: Utilities.formatDate(
      effectiveDate,
      PMOS.TIMEZONE,
      'yyyy-MM-dd'
    ),
    horizon: horizon.toISOString(),
    operations: deletes.concat(creates)
  };
}

function shiftPlanToEffectiveDate_(plan, effectiveDate) {
  const shifted = Object.assign({}, plan);
  shifted.start = new Date(plan.start);
  shifted.end = new Date(plan.end);
  shifted.until = plan.until ? new Date(plan.until) : null;
  while (shifted.start.getTime() < effectiveDate.getTime()) {
    shifted.start.setDate(shifted.start.getDate() + 28);
    shifted.end.setDate(shifted.end.getDate() + 28);
  }
  shifted.signature = recurringSeriesSignature_(shifted);
  return shifted;
}

function runFutureCalendarReconciliation_() {
  const plan = readCalendarReconciliationPlan_();
  if (!plan || !Array.isArray(plan.operations)) {
    throw new Error('No saved future Calendar reconciliation plan is available.');
  }

  const operationName = PMOS_CALENDAR_CONFIG.RECONCILE.OPERATION;
  const context = createPmosRuntimeContext_(operationName);
  const lock = acquirePmosRuntimeLock_(context, 5000);

  try {
    const calendar = getRecurringCalendar_();
    const checkpoint = readPmosRuntimeCheckpoint_(operationName) || {
      index: 0,
      removed: 0,
      created: 0,
      skipped: 0,
      errors: [],
      effectiveDate: plan.effectiveDate,
      registryCleared: false
    };

    while (
      checkpoint.index < plan.operations.length &&
      !pmosRuntimeShouldYield_(context)
    ) {
      const operation = plan.operations[checkpoint.index];
      try {
        if (operation.action === 'DELETE') {
          executeCalendarReconciliationDelete_(calendar, operation, checkpoint);
        } else if (operation.action === 'CREATE') {
          if (!checkpoint.registryCleared) {
            clearRecurringSeriesRegistry_();
            checkpoint.registryCleared = true;
          }
          executeCalendarReconciliationCreate_(
            calendar,
            operation,
            checkpoint,
            plan.calendarName
          );
        } else {
          throw new Error('Unsupported reconciliation action: ' + operation.action);
        }
      } catch (error) {
        checkpoint.errors.push(
          operation.action + ' ' + String(operation.title || '') + ': ' +
          String(error && error.message ? error.message : error)
        );
      }

      checkpoint.index++;
      savePmosRuntimeCheckpoint_(operationName, checkpoint);
      heartbeatPmosRuntimeOperation_(context);
    }

    if (checkpoint.index < plan.operations.length) {
      scheduleFutureCalendarReconciliationContinuation_(
        PMOS_CALENDAR_CONFIG.RECONCILE.DELAY_MS
      );
      releasePmosRuntimeLock_(lock, context);
      return calendarReconciliationStatus_(checkpoint, plan, 'Waiting');
    }

    removeFutureCalendarReconciliationContinuation_();
    PropertiesService.getDocumentProperties().setProperty(
      PMOS_CALENDAR_CONFIG.EFFECTIVE_DATE_KEY,
      plan.effectiveDate
    );

    const hasErrors = checkpoint.errors.length > 0;
    updateSyncStatus_(
      hasErrors ? 'Synchronization error' : 'Everything synchronized',
      hasErrors
        ? checkpoint.errors.length + ' future reconciliation error(s).'
        : checkpoint.created +
          ' future recurring series created from the effective date.'
    );

    deleteCalendarReconciliationPlan_();
    completePmosRuntimeOperation_(operationName, lock, context);
    return calendarReconciliationStatus_(checkpoint, plan, 'Complete');
  } catch (error) {
    abandonPmosRuntimeOperation_(lock, context);
    throw error;
  }
}

function executeCalendarReconciliationDelete_(calendar, operation, checkpoint) {
  const start = new Date(operation.start);
  assertCalendarMutationIsSafe_(start, false);
  const candidates = calendar
    .getEvents(new Date(start.getTime() - 1000), new Date(start.getTime() + 1000))
    .filter(isPmosManagedCalendarEvent_)
    .filter(function (event) {
      return event.getStartTime().getTime() === start.getTime() &&
        normalize_(event.getTitle()) === normalize_(operation.title) &&
        calendarReconcileDescriptionKey_(event.getDescription()) ===
          operation.descriptionKey;
    });
  if (!candidates.length) {
    checkpoint.skipped++;
    return;
  }
  candidates[0].deleteEvent();
  checkpoint.removed++;
}

function executeCalendarReconciliationCreate_(calendar, operation, checkpoint, calendarName) {
  const seriesPlan = reviveCalendarSeriesPlan_(operation.seriesPlan);
  assertCalendarMutationIsSafe_(seriesPlan.start, false);
  if (calendarReconciliationSeriesExists_(calendar, seriesPlan)) {
    checkpoint.skipped++;
    return;
  }
  const series = createRecurringSeries_(calendar, seriesPlan);
  upsertSeriesRegistry_(
    seriesPlan,
    series.getId(),
    calendarName || calendar.getName(),
    'Current'
  );
  checkpoint.created++;
}

function calendarReconciliationSeriesExists_(calendar, seriesPlan) {
  return calendar
    .getEvents(
      new Date(seriesPlan.start.getTime() - 1000),
      new Date(seriesPlan.start.getTime() + 1000)
    )
    .some(function (event) {
      if (!isPmosManagedCalendarEvent_(event)) return false;
      const description = String(event.getDescription() || '');
      return description.indexOf('PMOS_SERIES_KEY=' + seriesPlan.seriesKey) >= 0 ||
        (
          event.getStartTime().getTime() === seriesPlan.start.getTime() &&
          normalize_(event.getTitle()) === normalize_(seriesPlan.title)
        );
    });
}

function serializeCalendarSeriesPlan_(seriesPlan) {
  const copy = Object.assign({}, seriesPlan);
  copy.start = new Date(seriesPlan.start).toISOString();
  copy.end = new Date(seriesPlan.end).toISOString();
  copy.until = seriesPlan.until ? new Date(seriesPlan.until).toISOString() : null;
  return copy;
}

function reviveCalendarSeriesPlan_(stored) {
  const plan = Object.assign({}, stored);
  plan.start = new Date(stored.start);
  plan.end = new Date(stored.end);
  plan.until = stored.until ? new Date(stored.until) : null;
  return plan;
}

function calendarReconcileDescriptionKey_(description) {
  const text = String(description || '');
  const markers = [
    'PMOS_SERIES_KEY=',
    'PMOS_CUSTOMER_ID=',
    'PMOS_TEMP_VISIT=',
    'PMOS_HISTORY_REPAIR='
  ];
  for (let index = 0; index < markers.length; index++) {
    const line = text.split('\n').find(function (candidate) {
      return candidate.indexOf(markers[index]) === 0;
    });
    if (line) return line;
  }
  return '';
}

function compareCalendarReconciliationOperations_(left, right) {
  const leftTime = left.start || (left.seriesPlan && left.seriesPlan.start) || '';
  const rightTime = right.start || (right.seriesPlan && right.seriesPlan.start) || '';
  if (leftTime < rightTime) return -1;
  if (leftTime > rightTime) return 1;
  return String(left.title || '').localeCompare(String(right.title || ''));
}

function countCalendarReconciliationOperations_(operations) {
  return operations.reduce(function (counts, operation) {
    if (counts[operation.action] == null) counts[operation.action] = 0;
    counts[operation.action]++;
    return counts;
  }, {DELETE: 0, CREATE: 0});
}

function calendarReconciliationStatus_(checkpoint, plan, status) {
  const total = plan.operations.length;
  const processed = Math.min(checkpoint.index, total);
  const firstError = checkpoint.errors.length ? checkpoint.errors[0] : '';
  return {
    status: status,
    effectiveDate: plan.effectiveDate,
    processed: processed,
    remaining: Math.max(0, total - processed),
    removed: checkpoint.removed,
    created: checkpoint.created,
    skipped: checkpoint.skipped,
    errors: checkpoint.errors.length,
    firstError: firstError,
    summary: [
      status === 'Complete'
        ? 'Future-only reconciliation complete.'
        : 'Future-only reconciliation saved and will continue.',
      'Historical events before ' + plan.effectiveDate +
        ' were not intentionally changed.',
      'Operations processed: ' + processed + ' of ' + total,
      'Future occurrences removed: ' + checkpoint.removed,
      'Recurring series created: ' + checkpoint.created,
      'Skipped as already complete: ' + checkpoint.skipped,
      'Errors: ' + checkpoint.errors.length,
      firstError ? 'First error: ' + firstError : ''
    ].filter(Boolean).join('\n')
  };
}

function saveCalendarReconciliationPlan_(plan) {
  deleteCalendarReconciliationPlan_();
  const props = PropertiesService.getDocumentProperties();
  const text = JSON.stringify(plan);
  const chunkSize = PMOS_CALENDAR_CONFIG.RECONCILE.PROPERTY_CHUNK;
  const parts = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    parts.push(text.slice(index, index + chunkSize));
  }
  parts.forEach(function (part, index) {
    props.setProperty(
      PMOS_CALENDAR_CONFIG.RECONCILE.PLAN_KEY + '_' + index,
      part
    );
  });
  props.setProperty(
    PMOS_CALENDAR_CONFIG.RECONCILE.PLAN_PARTS_KEY,
    String(parts.length)
  );
  return plan;
}

function readCalendarReconciliationPlan_() {
  const props = PropertiesService.getDocumentProperties();
  const count = Number(
    props.getProperty(PMOS_CALENDAR_CONFIG.RECONCILE.PLAN_PARTS_KEY) || 0
  );
  if (!count) return null;
  let text = '';
  for (let index = 0; index < count; index++) {
    const part = props.getProperty(
      PMOS_CALENDAR_CONFIG.RECONCILE.PLAN_KEY + '_' + index
    );
    if (part == null) return null;
    text += part;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function deleteCalendarReconciliationPlan_() {
  const props = PropertiesService.getDocumentProperties();
  const count = Number(
    props.getProperty(PMOS_CALENDAR_CONFIG.RECONCILE.PLAN_PARTS_KEY) || 0
  );
  for (let index = 0; index < count; index++) {
    props.deleteProperty(PMOS_CALENDAR_CONFIG.RECONCILE.PLAN_KEY + '_' + index);
  }
  props.deleteProperty(PMOS_CALENDAR_CONFIG.RECONCILE.PLAN_PARTS_KEY);
}

function scheduleFutureCalendarReconciliationContinuation_(delayMs) {
  removeFutureCalendarReconciliationContinuation_();
  ScriptApp.newTrigger(PMOS_CALENDAR_CONFIG.RECONCILE.HANDLER)
    .timeBased()
    .after(Math.max(1000, Number(delayMs || 0)))
    .create();
}

function removeFutureCalendarReconciliationContinuation_() {
  ScriptApp.getProjectTriggers()
    .filter(function (trigger) {
      return trigger.getHandlerFunction() ===
        PMOS_CALENDAR_CONFIG.RECONCILE.HANDLER;
    })
    .forEach(function (trigger) {
      ScriptApp.deleteTrigger(trigger);
    });
}
