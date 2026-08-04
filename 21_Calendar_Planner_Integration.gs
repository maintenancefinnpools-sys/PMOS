/**
 * PMOS Calendar planner integration.
 *
 * Reads existing PMOS source data, builds an immutable Calendar Sync plan, and
 * validates it. Preview performs no Calendar, customer-data, registry, support-
 * structure, trigger, or job-state writes.
 */

function buildValidatedPmosCalendarSyncPlan_() {
  const settings = getRecurringCalendarSettings_();
  const desiredSeries = buildRecurringSeriesPlan_(readExistingPmosCalendarRoutes_);
  const currentRegistry = readExistingPmosCalendarRegistry_();

  const plan = buildPmosCalendarSyncPlan(desiredSeries, currentRegistry, {
    calendarName: settings.calendarName,
    sourceVersion: buildPmosCalendarSourceVersion_(desiredSeries, currentRegistry),
    allowDeletes: true,
    includeSkips: false
  });

  const genericValidation = validatePmosPlan(plan, {
    validateCustomers: false
  });
  const calendarValidation = validatePmosCalendarPlanSafety_(plan);
  const validation = combinePmosCalendarValidationReports_(
    genericValidation,
    calendarValidation
  );

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

/** Reads route and customer sources without repairing or modifying either. */
function readExistingPmosCalendarRoutes_() {
  const spreadsheet = SpreadsheetApp.getActive();
  const routeSheet = spreadsheet.getSheetByName(PMOS.ROUTES_SHEET);
  const customerSheet = spreadsheet.getSheetByName(PMOS.CUSTOMERS_SHEET);

  if (!routeSheet) {
    throw new Error('Missing required route source sheet: ' + PMOS.ROUTES_SHEET + '.');
  }
  if (!customerSheet) {
    throw new Error('Missing required customer source sheet: ' + PMOS.CUSTOMERS_SHEET + '.');
  }

  const routeValues = routeSheet.getDataRange().getValues();
  const customerValues = customerSheet.getDataRange().getValues();
  if (!routeValues.length || !routeValues[0].length) {
    throw new Error(PMOS.ROUTES_SHEET + ' has no header row.');
  }
  if (!customerValues.length || !customerValues[0].length) {
    throw new Error(PMOS.CUSTOMERS_SHEET + ' has no header row.');
  }

  const routeHeaders = routeValues[0].map(pmosCalendarHeader_);
  const customerHeaders = customerValues[0].map(pmosCalendarHeader_);
  const requiredRouteHeaders = ['Layer', 'Stop Order', 'Calendar Title'];
  const missingRouteHeaders = requiredRouteHeaders.filter(function (header) {
    return routeHeaders.indexOf(header) < 0;
  });
  if (missingRouteHeaders.length) {
    throw new Error(
      PMOS.ROUTES_SHEET + ' is missing required column(s): ' +
      missingRouteHeaders.join(', ') + '.'
    );
  }

  const customersById = {};
  const customersByTitle = {};
  customerValues.slice(1).forEach(function (row) {
    if (!pmosCalendarRowHasData_(row)) return;
    const customer = pmosCalendarRowObject_(customerHeaders, row);
    const customerId = String(customer['Customer ID'] || '').trim();
    const title = String(customer['Calendar Title'] || '').trim();
    const fullName = String(customer['Full Name(s)'] || '').trim();
    if (!title && !fullName) return;
    if (customerId) customersById[customerId] = customer;
    if (title) customersByTitle[normalize_(title)] = customer;
  });

  return routeValues.slice(1)
    .filter(pmosCalendarRowHasData_)
    .map(function (row) {
      const route = pmosCalendarRowObject_(routeHeaders, row);
      const routeTitle = String(route['Calendar Title'] || '').trim();
      const routeId = String(route['Customer ID'] || '').trim();
      const customer = customersById[routeId] ||
        customersByTitle[normalize_(routeTitle)] || {};
      const customerId = String(customer['Customer ID'] || routeId).trim();
      const title = String(customer['Calendar Title'] || routeTitle).trim();
      const yearRoundText = customer['Year Round'] || customer.Season || '';

      return {
        key: customerId || title,
        customerId: customerId,
        layer: String(route.Layer || '').trim(),
        order: Number(route['Stop Order'] || 0),
        title: title,
        fullName: String(customer['Full Name(s)'] || route['Full Name(s)'] || title),
        address: String(customer['Full Address'] || route['Full Address'] || ''),
        frequency: String(customer.Frequency || route.Frequency || ''),
        entry: buildCustomerEntryInformation_(customer) ||
          String(route['Entry Information'] || ''),
        notes: String(customer['Customer Notes'] || route['Customer Notes'] || ''),
        phone: String(customer['Primary Phone'] || ''),
        secondaryPhone: String(customer['Secondary Phone'] || ''),
        email: String(customer.Email || ''),
        sanitization: String(customer['Sanitization Type(s)'] || ''),
        automation: String(customer.Automation || ''),
        yearRound: normalize_(yearRoundText).indexOf('year round') >= 0 ||
          normalize_(customer['Year Round'] || '') === 'yes'
      };
    })
    .filter(function (row) {
      return row.layer && row.title;
    });
}

/** Reads the Calendar Series Registry without creating or repairing it. */
function readExistingPmosCalendarRegistry_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Calendar Series Registry');
  if (!sheet) {
    throw new Error(
      'Missing Calendar Series Registry. Run Initialize PMOS or Update PMOS before previewing Calendar Sync.'
    );
  }

  const values = sheet.getDataRange().getValues();
  if (!values.length) {
    throw new Error(
      'Calendar Series Registry has no header row. Run Update PMOS to repair support structures.'
    );
  }

  const headers = values[0].map(pmosCalendarHeader_);
  const requiredHeaders = [
    'Series Key', 'Customer ID', 'Layer', 'Series ID',
    'Calendar Name', 'Signature', 'Status'
  ];
  const missingHeaders = requiredHeaders.filter(function (header) {
    return headers.indexOf(header) < 0;
  });
  if (missingHeaders.length) {
    throw new Error(
      'Calendar Series Registry is missing required column(s): ' +
      missingHeaders.join(', ') + '. Run Update PMOS to repair support structures.'
    );
  }

  const indexes = {};
  headers.forEach(function (header, index) { indexes[header] = index; });
  const registry = {};

  values.slice(1).forEach(function (row, index) {
    const seriesKey = String(row[indexes['Series Key']] || '').trim();
    if (!seriesKey) return;
    registry[seriesKey] = {
      row: index + 2,
      seriesKey: seriesKey,
      customerId: String(row[indexes['Customer ID']] || ''),
      layer: String(row[indexes.Layer] || ''),
      seriesId: String(row[indexes['Series ID']] || ''),
      calendarName: String(row[indexes['Calendar Name']] || ''),
      signature: String(row[indexes.Signature] || ''),
      status: String(row[indexes.Status] || '')
    };
  });

  return registry;
}

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

function pmosCalendarHeader_(value) {
  return String(value || '').trim();
}

function pmosCalendarRowHasData_(row) {
  return row.some(function (value) { return value !== '' && value != null; });
}

function pmosCalendarRowObject_(headers, row) {
  const object = {};
  headers.forEach(function (header, index) { object[header] = row[index]; });
  return object;
}
