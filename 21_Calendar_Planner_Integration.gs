/**
 * PMOS Calendar planner integration.
 *
 * This orchestration layer reads the existing desired plan and registry, builds
 * the immutable Calendar Sync plan, validates it, and exposes a legacy-shaped
 * preview. It performs no Calendar, spreadsheet, property, or trigger writes.
 */

/** Builds and validates the current immutable Calendar Sync plan. */
function buildValidatedPmosCalendarSyncPlan_() {
  const settings = getRecurringCalendarSettings_();
  const desiredSeries = buildRecurringSeriesPlan_();
  const currentRegistry = readExistingPmosCalendarRegistry_();

  const plan = buildPmosCalendarSyncPlan(desiredSeries, currentRegistry, {
    calendarName: settings.calendarName,
    sourceVersion: buildPmosCalendarSourceVersion_(desiredSeries, currentRegistry),
    allowDeletes: true,
    includeSkips: false
  });

  const validation = validatePmosPlan(plan, {
    validateCustomers: false
  });

  const plannerErrors = plan.operations.filter(function (operation) {
    return operation.action === PMOS_OPERATION.ERROR ||
      Boolean(operation.metadata && operation.metadata.blocking);
  });

  return Object.freeze({
    plan: plan,
    validation: validation,
    canExecute: validation.executable && plannerErrors.length === 0,
    plannerErrorCount: plannerErrors.length
  });
}

/**
 * Reads the active Calendar Series Registry without creating or repairing it.
 * Initialization and repair belong to explicit maintenance workflows.
 */
function readExistingPmosCalendarRegistry_() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = spreadsheet && spreadsheet.getSheetByName('Calendar Series Registry');

  if (!sheet) {
    throw new Error(
      'Calendar Series Registry is missing. Run Initialize PMOS or Update PMOS before previewing Calendar Sync.'
    );
  }

  const values = sheet.getDataRange().getValues();
  if (!values.length) {
    throw new Error(
      'Calendar Series Registry is empty. Run Update PMOS to repair its structure before previewing Calendar Sync.'
    );
  }

  const expectedHeaders = [
    'Series Key',
    'Customer ID',
    'Layer',
    'Series ID',
    'Calendar Name',
    'Signature',
    'Last Sync',
    'Status',
    'Error'
  ];
  const actualHeaders = values[0].map(function (value) {
    return String(value || '').trim();
  });
  const missingHeaders = expectedHeaders.filter(function (header) {
    return actualHeaders.indexOf(header) < 0;
  });

  if (missingHeaders.length) {
    throw new Error(
      'Calendar Series Registry is missing required columns: ' +
      missingHeaders.join(', ') +
      '. Run Update PMOS before previewing Calendar Sync.'
    );
  }

  const column = {};
  expectedHeaders.forEach(function (header) {
    column[header] = actualHeaders.indexOf(header);
  });

  const registry = {};
  values.slice(1).forEach(function (row, index) {
    const seriesKey = String(row[column['Series Key']] || '').trim();
    if (!seriesKey) return;

    registry[seriesKey] = {
      row: index + 2,
      seriesKey: seriesKey,
      customerId: String(row[column['Customer ID']] || ''),
      layer: String(row[column.Layer] || ''),
      seriesId: String(row[column['Series ID']] || ''),
      calendarName: String(row[column['Calendar Name']] || ''),
      signature: String(row[column.Signature] || ''),
      status: String(row[column.Status] || ''),
      error: String(row[column.Error] || '')
    };
  });

  return registry;
}

/**
 * Public preview for the new immutable Calendar planning pipeline.
 * The existing previewCalendarChanges() remains untouched until executor
 * migration, allowing safe side-by-side verification.
 */
function previewPmosCalendarSyncPlan() {
  const result = buildValidatedPmosCalendarSyncPlan_();
  const plan = result.plan;
  const summary = summarizePmosCalendarSyncPlan(plan);
  const executable = plan.operations.filter(isPmosExecutableOperation);

  return Object.freeze({
    planId: plan.id,
    calendarName: plan.metadata.calendarName || '',
    totalSeries: Number(plan.metadata.desiredCount || 0),
    creates: Number(summary.counts[PMOS_OPERATION.CREATE] || 0),
    updates: Number(summary.counts[PMOS_OPERATION.UPDATE] || 0),
    deletes: Number(summary.counts[PMOS_OPERATION.DELETE] || 0),
    skips: Number(summary.counts[PMOS_OPERATION.SKIP] || 0),
    warnings: Number(summary.counts[PMOS_OPERATION.WARNING] || 0),
    plannerErrors: Number(summary.counts[PMOS_OPERATION.ERROR] || 0),
    validationErrors: Number(result.validation.errorCount || 0),
    validationWarnings: Number(result.validation.warningCount || 0),
    canExecute: result.canExecute,
    affectedRoutes: countPmosCalendarAffectedRoutes_(executable),
    affectedEvents: executable.length,
    details: plan.operations.slice(0, 30).map(formatPmosCalendarPreviewOperation_),
    validation: result.validation,
    plan: plan
  });
}

/** Returns a compact preview matching the existing Calendar UI contract. */
function previewPmosCalendarChangesLegacyShape_() {
  const preview = previewPmosCalendarSyncPlan();
  return {
    calendarName: preview.calendarName,
    totalSeries: preview.totalSeries,
    creates: preview.creates,
    updates: preview.updates,
    deletes: preview.deletes,
    affectedRoutes: preview.affectedRoutes,
    affectedEvents: preview.affectedEvents,
    details: preview.details,
    planId: preview.planId,
    canExecute: preview.canExecute,
    validationErrors: preview.validationErrors,
    validationWarnings: preview.validationWarnings,
    plannerErrors: preview.plannerErrors
  };
}

function formatPmosCalendarPreviewOperation_(operation) {
  const desired = operation.payload && operation.payload.desired;
  const current = operation.payload && operation.payload.current;
  const record = desired || current || {};
  return {
    id: operation.id,
    action: operation.action,
    seriesKey: operation.entityId,
    layer: record.layer || '',
    title: record.title || operation.entityId || '',
    reason: operation.reason || '',
    changedFields: operation.payload && operation.payload.changedFields
      ? operation.payload.changedFields.slice()
      : []
  };
}

function countPmosCalendarAffectedRoutes_(operations) {
  const routes = {};
  operations.forEach(function (operation) {
    const desired = operation.payload && operation.payload.desired;
    const current = operation.payload && operation.payload.current;
    const layer = (desired && desired.layer) || (current && current.layer);
    if (layer) routes[layer] = true;
  });
  return Object.keys(routes).length;
}

function buildPmosCalendarSourceVersion_(desiredSeries, currentRegistry) {
  const desiredSignatures = (desiredSeries || []).map(function (series) {
    return String(series.seriesKey || '') + ':' + String(series.signature || '');
  }).sort();

  const registryValues = Array.isArray(currentRegistry)
    ? currentRegistry
    : Object.keys(currentRegistry || {}).sort().map(function (key) {
        return Object.assign({ seriesKey: key }, currentRegistry[key] || {});
      });

  const currentSignatures = registryValues.map(function (series) {
    return String(series.seriesKey || series['Series Key'] || '') + ':' +
      String(series.signature || series.Signature || '');
  }).sort();

  return 'CALENDAR_SOURCE_' + pmosCalendarHash_(JSON.stringify({
    desired: desiredSignatures,
    current: currentSignatures
  }));
}
