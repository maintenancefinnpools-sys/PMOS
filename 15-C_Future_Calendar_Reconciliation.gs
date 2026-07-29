/**
 * PMOS future Calendar reconciliation.
 *
 * Planning and execution are deliberately separate. The planner creates a
 * serializable list of future-only DELETE and CREATE operations. The executor
 * processes that immutable plan until the shared runtime deadline, saves one
 * checkpoint index, and resumes through a one-time continuation trigger.
 */

const PMOS_CALENDAR_RECONCILE_OPERATION = 'CALENDAR_RECONCILE';
const PMOS_CALENDAR_RECONCILE_PLAN_KEY = 'PMOS_CALENDAR_RECONCILE_PLAN_V2';
const PMOS_CALENDAR_RECONCILE_PLAN_PARTS_KEY =
  'PMOS_CALENDAR_RECONCILE_PLAN_V2_PARTS';
const PMOS_CALENDAR_RECONCILE_HORIZON_YEARS = 5;
const PMOS_CALENDAR_RECONCILE_HANDLER =
  'runFutureCalendarReconciliationContinuation';
const PMOS_CALENDAR_RECONCILE_DELAY_MS = 2000;
const PMOS_CALENDAR_RECONCILE_PROPERTY_CHUNK = 8000;

/**
 * Public preview entry point retained for the existing PMOS interface.
 * This function performs no Calendar writes.
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

/**
 * Public apply entry point retained for the existing PMOS interface.
 */
function reconcileFutureCalendar(value, confirmed) {
  if (confirmed !== true) {
    throw new Error('Reconciliation requires explicit confirmation.');
  }

  const effectiveDate = parseCalendarEffectiveDate_(value);
  const plan = buildCalendarReconciliationPlan_(effectiveDate);

  saveCalendarReconciliationPlan_(plan);
  savePmosRuntimeCheckpoint_(PMOS_CALENDAR_RECONCILE_OPERATION, {
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

/**
 * Trigger-compatible continuation entry point.
 */
function runFutureCalendarReconciliationContinuation() {
  return runFutureCalendarReconciliation_();
}

/**
 * Pure planning boundary: reads current state and returns serializable work.
 * It does not delete, create, update, checkpoint, lock, or schedule anything.
 */
function buildCalendarReconciliationPlan_(effectiveDate) {
  const calendar = getRecurringCalendar_();
  const horizon = new Date(effectiveDate);
  horizon.setFullYear(
    horizon.getFullYear() + PMOS_CALENDAR_RECONCILE_HORIZON_YEARS
  );

  const deleteOperations = calendar
    .getEvents(effectiveDate, horizon)
    .filter(isPmosManagedCalendarEvent_)
    .map(function (event) {
      return {
        action: 'DELETE',
        title: String(event.getTitle() || ''),
        start: event.getStartTime().toISOString(),
        end: event.getEndTime().toISOString(),
        descriptionKey: calendarReconcileDescriptionKey_(
          event.getDescription()
        )
      };
    })
    .sort(compareCalendarReconciliationOperations_);

  const createOperations = buildRecurringSeriesPlan_()
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
    operations: deleteOperations.concat(createOperations)
  };
}

function shiftPlanToEffectiveDate_(plan, effectiveDate) {
  const shifted = Object.assign({}, plan);
  shifted.start = new Date(plan.start);
  shifted.end = new Date(plan.end);
  shifted.until = plan.until ? new Date(plan.until) : plan.until;

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
    throw new Error(
      'No saved future Calendar reconciliation plan is available.'
    );
  }

  const context = createPmosRuntimeContext_(
    PMOS_CALENDAR_RECONCILE_OPERATION
  );
  const lock = acquirePmosRuntimeLock_(context, 5000);

  try {
    const calendar = getRecurringCalendar_();
    const checkpoint = readPmosRuntimeCheckpoint_(
      PMOS_CALENDAR_RECONCILE_OPERATION
    ) || {
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
          executeCalendarReconciliationDelete_(
            calendar,
            operation,
            checkpoint
          );
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
          throw new Error(
            'Unsupported reconciliation action: ' + operation.action
          );
        }
      } catch (error) {
        checkpoint.errors.push(
          operation.action + ' ' +
          String(operation.title || '') + ': ' +
          String(error && error.message ? error.message : error)
        );
      }

      checkpoint.index++;
      savePmosRuntimeCheckpoint_(
        PMOS_CALENDAR_RECONCILE_OPERATION,
        checkpoint
      );
      heartbeatPmosRuntimeOperation_(context);
    }

    if (checkpoint.index < plan.operations.length) {
      scheduleFutureCalendarReconciliationContinuation_(
        PMOS_CALENDAR_RECONCILE_DELAY_MS
      );
      releasePmosRuntimeLock_(lock, context);
      return calendarReconciliationStatus_(checkpoint, plan, 'Waiting');
    }

    removeFutureCalendarReconciliationContinuation_();
    PropertiesService.getDocumentProperties().setProperty(
      PMOS_CALENDAR_EFFECTIVE_DATE_KEY,
      plan.effectiveDate
    );

    const hasErrors = checkpoint.errors.length > 0;
    updateSyncStatus_(
      hasErrors ? 'Synchronization error' : 'Everything synchronized',
      hasErrors
        ? checkpoint.errors.length +
          ' future reconciliation error(s).'
        : checkpoint.created +
          ' future recurring series created from the effective date.'
    );

    deleteCalendarReconciliationPlan_();
    completePmosRuntimeOperation_(
      PMOS_CALENDAR_RECONCILE_OPERATION,
      lock,
      context
    );

    return calendarReconciliationStatus_(checkpoint, plan, 'Complete');
  } catch (error) {
    abandonPmosRuntimeOperation_(lock, context);
    throw error;
  }
}

function executeCalendarReconciliationDelete_(
  calendar,
  operation,
  checkpoint
) {
  const start = new Date(operation.start);
  assertCalendarMutationIsSafe_(start, false);

  const windowStart = new Date(start.getTime() - 1000);
  const windowEnd = new Date(start.getTime() + 1000);
  const candidates = calendar.getEvents(windowStart, windowEnd)
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

function executeCalendarReconciliationCreate_(
  calendar,
  operation,
  checkpoint,
  calendarName
) {
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
  const windowStart = new Date(seriesPlan.start.getTime() - 1000);
  const windowEnd = new Date(seriesPlan.start.getTime() + 1000);
  const signature = String(
    seriesPlan.signature || recurringSeriesSignature_(seriesPlan)
  );

  return calendar.getEvents(windowStart, windowEnd).some(function (event) {
    if (!isPmosManagedCalendarEvent_(event)) return false;
    const description = String(event.getDescription() || '');
    return description.indexOf('PMOS_SERIES_KEY=' + signature) >= 0 ||
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
  copy.until = seriesPlan.until
    ? new Date(seriesPlan.until).toISOString()
    : null;
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

  for (let i = 0; i < markers.length; i++) {
    const line = text.split('\n').find(function (candidate) {
      return candidate.indexOf(markers[i]) === 0;
    });
    if (line) return line;
  }
  return '';
}

function compareCalendarReconciliationOperations_(left, right) {
  const leftTime = left.start ||
    (left.seriesPlan && left.seriesPlan.start) || '';
  const rightTime = right.start ||
    (right.seriesPlan && right.seriesPlan.start) || '';

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
  const firstError = checkpoint.errors.length
    ? checkpoint.errors[0]
    : '';

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
  const parts = [];

  for (
    let index = 0;
    index < text.length;
    index += PMOS_CALENDAR_RECONCILE_PROPERTY_CHUNK
  ) {
    parts.push(text.slice(
      index,
      index + PMOS_CALENDAR_RECONCILE_PROPERTY_CHUNK
    ));
  }

  parts.forEach(function (part, index) {
    props.setProperty(
      PMOS_CALENDAR_RECONCILE_PLAN_KEY + '_' + index,
      part
    );
  });
  props.setProperty(
    PMOS_CALENDAR_RECONCILE_PLAN_PARTS_KEY,
    String(parts.length)
  );
  return plan;
}

function readCalendarReconciliationPlan_() {
  const props = PropertiesService.getDocumentProperties();
  const count = Number(
    props.getProperty(PMOS_CALENDAR_RECONCILE_PLAN_PARTS_KEY) || 0
  );
  if (!count) return null;

  let text = '';
  for (let index = 0; index < count; index++) {
    const part = props.getProperty(
      PMOS_CALENDAR_RECONCILE_PLAN_KEY + '_' + index
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
    props.getProperty(PMOS_CALENDAR_RECONCILE_PLAN_PARTS_KEY) || 0
  );

  for (let index = 0; index < count; index++) {
    props.deleteProperty(
      PMOS_CALENDAR_RECONCILE_PLAN_KEY + '_' + index
    );
  }
  props.deleteProperty(PMOS_CALENDAR_RECONCILE_PLAN_PARTS_KEY);
}

function scheduleFutureCalendarReconciliationContinuation_(delayMs) {
  removeFutureCalendarReconciliationContinuation_();
  ScriptApp.newTrigger(PMOS_CALENDAR_RECONCILE_HANDLER)
    .timeBased()
    .after(Math.max(1000, Number(delayMs || 0)))
    .create();
}

function removeFutureCalendarReconciliationContinuation_() {
  ScriptApp.getProjectTriggers()
    .filter(function (trigger) {
      return trigger.getHandlerFunction() ===
        PMOS_CALENDAR_RECONCILE_HANDLER;
    })
    .forEach(function (trigger) {
      ScriptApp.deleteTrigger(trigger);
    });
}
