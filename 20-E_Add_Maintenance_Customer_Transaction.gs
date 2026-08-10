/**
 * Authoritative Add Maintenance Customer transaction.
 *
 * Spreadsheet data is the only source of truth. This transaction writes the
 * customer and route assignments, refreshes derived customer data, and marks
 * Calendar planning stale. It never mutates Calendar or starts Calendar Sync.
 */
function createMaintenanceCustomer(input) {
  const request = normalizeMaintenanceCustomerRequest_(input || {});
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Another PMOS operation is running. Try again when it finishes.');
  }

  let snapshots = [];
  try {
    const spreadsheet = SpreadsheetApp.getActive();
    const customersSheet = findFirstSheetByName_(spreadsheet, [
      'Customers', 'Customer Database', 'Customer List'
    ]);
    const routeSheet = findFirstSheetByName_(spreadsheet, [
      '4-Week Route Template', 'PMOS 4-Week Route Template', 'Route Template'
    ]);

    if (!customersSheet || !routeSheet) {
      throw new Error('Customers or 4-Week Route Template sheet was not found.');
    }

    snapshots = [
      snapshotMaintenanceSheet_(customersSheet),
      snapshotMaintenanceSheet_(routeSheet)
    ];

    let customerTable = readPmosHeaderTable_(customersSheet);
    let routeTable = readPmosHeaderTable_(routeSheet);

    ensureMaintenanceClientHeaders_(customersSheet, customerTable, [
      'Customer ID', 'Calendar Title', 'Full Address', 'Primary Phone',
      'Email', 'Frequency', 'Service Start Date', 'Customer Notes'
    ]);
    ensureMaintenanceClientHeaders_(routeSheet, routeTable, [
      'Customer ID', 'Calendar Title', 'Layer', 'Stop Order'
    ]);

    customerTable = readPmosHeaderTable_(customersSheet);
    routeTable = readPmosHeaderTable_(routeSheet);
    assertMaintenanceClientNotDuplicate_(
      customerTable,
      request.name,
      request.address,
      request.email
    );

    const customerId = generateNextPmosCustomerId_();
    const sharedValues = buildMaintenanceCustomerSharedValues_(request, customerId);

    appendMappedMaintenanceRow_(customersSheet, customerTable, sharedValues);

    const routeRows = appendMaintenanceCustomerRouteRows_(
      routeSheet,
      routeTable,
      sharedValues,
      request
    );

    SpreadsheetApp.flush();

    const refresh = synchronizeCustomerDatabase_(true);
    const customerRefresh = [
      Number(refresh && refresh.routeRowsUpdated || 0) + ' route row(s) refreshed',
      Number(refresh && refresh.routeRowsCreated || 0) + ' route row(s) created',
      Number(refresh && refresh.routeRowsRemoved || 0) + ' duplicate/orphan row(s) removed'
    ].join('; ') + '.';

    if (typeof clearPmosCalendarAuditSnapshot_ === 'function') {
      clearPmosCalendarAuditSnapshot_();
    }

    return {
      created: true,
      customerId: customerId,
      customerName: request.name,
      frequency: request.frequency,
      effectiveDate: Utilities.formatDate(
        request.effectiveDate,
        PMOS.TIMEZONE,
        'yyyy-MM-dd'
      ),
      routeRows: routeRows,
      calendarStatus: 'PENDING_AUTOMATIC_SYNC',
      summary: [
        'Maintenance customer created.',
        'Customer: ' + request.name,
        'Customer ID: ' + customerId,
        'Frequency: ' + request.frequency,
        'Effective date: ' + Utilities.formatDate(
          request.effectiveDate,
          PMOS.TIMEZONE,
          'yyyy-MM-dd'
        ),
        'Route placement: ' + routeRows.map(function (row) {
          return row.layer + ', stop ' + row.stop;
        }).join('; '),
        customerRefresh,
        '',
        'Starting automatic Calendar synchronization.'
      ].join('\n')
    };
  } catch (error) {
    rollbackMaintenanceSheetSnapshots_(snapshots);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function createMaintenanceCustomerAndAutoSync(input) {
  const result = createMaintenanceCustomer(input);
  try {
    const sync = synchronizeAddedMaintenanceCustomerCalendar_(
      result.customerId,
      result.routeRows.map(function (row) { return row.layer; })
    );
    result.calendarStatus = 'SYNCHRONIZED';
    result.calendarSync = sync;
    result.summary += '\nCalendar synchronized automatically: ' +
      Number(sync.created || 0) + ' created, ' +
      Number(sync.updated || sync.adjusted || 0) + ' updated.';
  } catch (error) {
    result.calendarStatus = 'SYNC_ERROR';
    result.calendarError = String(error && error.message ? error.message : error);
    result.summary += '\n\nThe customer was saved, but automatic Calendar Sync stopped safely:\n' +
      result.calendarError + '\nUse Retry Calendar Sync; do not add the customer again.';
  }
  return result;
}

function synchronizeAddedMaintenanceCustomerCalendar_(customerId, affectedLayers) {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('Automatic Calendar Sync is missing the new Customer ID.');
  const layers = Array.from(new Set((affectedLayers || []).map(function (layer) {
    return String(layer || '').trim();
  }).filter(Boolean)));
  if (!layers.length) throw new Error('Automatic Calendar Sync is missing the affected route layers.');
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Another PMOS operation is using the Calendar. Retry when it finishes.');
  }
  try {
    const built = buildValidatedPmosCalendarSyncPlan_({});
    const planOperations = built.plan && built.plan.operations || [];
    const operations = planOperations.filter(function (operation) {
      const desired = operation && operation.payload && operation.payload.desired || {};
      return layers.indexOf(String(desired.layer || '').trim()) >= 0 &&
        [String(PMOS_OPERATION.CREATE), String(PMOS_OPERATION.UPDATE)]
          .indexOf(String(operation.action || '')) >= 0;
    });
    const newCustomerSeries = (built.desiredSeries || []).filter(function (series) {
      return String(series.customerId || '').trim() === id &&
        layers.indexOf(String(series.layer || '').trim()) >= 0;
    });
    if (newCustomerSeries.length !== layers.length) {
      throw new Error(
        'Automatic Calendar Sync expected one new-client series in each of ' + layers.length +
        ' affected route layer(s), but planned ' + newCustomerSeries.length +
        '. PMOS stopped without applying unrelated Calendar work.'
      );
    }
    const affectedBlockers = planOperations.filter(function (operation) {
      const payload = operation && operation.payload || {};
      const desired = payload.desired || {};
      const current = payload.current || {};
      const layer = String(desired.layer || current.layer || '').trim();
      return layers.indexOf(layer) >= 0 && (
        operation.action === PMOS_OPERATION.ERROR ||
        Boolean(operation.metadata && operation.metadata.blocking)
      );
    });
    if (affectedBlockers.length) {
      throw new Error(
        'The background Calendar audit found ' + affectedBlockers.length +
        ' blocking problem(s) in the affected route layers. PMOS stopped before synchronization.'
      );
    }
    const settings = getRecurringCalendarSettings_();
    const calendar = getExistingConfiguredPmosCalendar_(settings.calendarName);
    if (!operations.length) {
      clearPmosCalendarAuditSnapshot_();
      return {
        created: 0,
        updated: 0,
        affectedLayers: layers.slice(),
        operationCount: 0,
        alreadySynchronized: true
      };
    }
    const preflight = validateReviewedCalendarSyncPreflight_(
      operations, calendar, settings.calendarName
    );
    if (!preflight.valid) throw new Error(preflight.errors.join('\n'));

    const state = {
      id: 'ADD_CLIENT_' + Utilities.getUuid(),
      planId: String(built.plan.id || 'ADD_CLIENT'),
      calendarName: settings.calendarName
    };
    const counts = {created: 0, updated: 0};
    operations.forEach(function (operation) {
      const outcome = executeReviewedCalendarOperation_(operation, state);
      if (outcome.action === 'CREATE') counts.created++;
      else if (outcome.action === 'UPDATE') counts.updated++;
    });
    clearPmosCalendarAuditSnapshot_();
    counts.affectedLayers = layers.slice();
    counts.operationCount = operations.length;
    return counts;
  } finally {
    lock.releaseLock();
  }
}

function retryAddedMaintenanceCustomerCalendar(input) {
  input = input || {};
  return synchronizeAddedMaintenanceCustomerCalendar_(
    input.customerId,
    input.affectedLayers || []
  );
}

function normalizeMaintenanceCustomerRequest_(input) {
  const name = String(input.name || '').trim();
  const address = String(input.address || '').trim();
  const phone = String(input.phone || '').trim();
  const email = String(input.email || '').trim();
  const notes = String(input.notes || '').trim();
  const frequency = normalizeMaintenanceFrequency_(input.frequency || 'Weekly');
  const day = normalizeMaintenanceDay_(input.day || 'Monday');
  const secondDay = frequency === 'Twice Weekly'
    ? normalizeMaintenanceDay_(input.secondDay || '')
    : '';
  const effectiveDate = parseMaintenanceStartDate_(
    input.effectiveDate || input.startDate
  );
  const firstWeek = Math.max(1, Math.min(4, Number(input.week || 1)));
  const requestedStop = Math.max(0, Math.floor(Number(input.stop || 0)));
  const calendarTitle = String(input.calendarTitle || name).trim() || name;
  const recommendedPlacements = Array.isArray(input.recommendedPlacements)
    ? input.recommendedPlacements.map(function (placement) {
      return {
        week: Number(placement && placement.week || 0),
        day: String(placement && placement.day || '').trim(),
        layer: String(placement && placement.layer || '').trim(),
        position: Math.max(1, Math.floor(Number(placement && placement.position || 1)))
      };
    }).filter(function (placement) {
      return placement.week >= 1 && placement.week <= 4 && placement.layer;
    })
    : [];

  if (!name) throw new Error('Customer name is required.');
  if (!address) throw new Error('Service address is required.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email address is not valid.');
  }
  if (frequency === 'Twice Weekly' && day === secondDay) {
    throw new Error('Twice-weekly service requires two different weekdays.');
  }

  return Object.freeze({
    name: name,
    address: address,
    phone: phone,
    email: email,
    notes: notes,
    frequency: frequency,
    day: day,
    secondDay: secondDay,
    effectiveDate: effectiveDate,
    firstWeek: firstWeek,
    requestedStop: requestedStop,
    calendarTitle: calendarTitle,
    recommendedPlacements: recommendedPlacements
  });
}

function buildMaintenanceCustomerSharedValues_(request, customerId) {
  return {
    'Customer ID': customerId,
    'Customer Name': request.name,
    'Name': request.name,
    'Customer': request.name,
    'Full Name(s)': request.name,
    'Calendar Title': request.calendarTitle,
    'Address': request.address,
    'Full Address': request.address,
    'Service Address': request.address,
    'Street Address': request.address,
    'Phone': request.phone,
    'Phone Number': request.phone,
    'Primary Phone': request.phone,
    'Email': request.email,
    'Email Address': request.email,
    'Frequency': request.frequency,
    'Service Frequency': request.frequency,
    'Service Start Date': request.effectiveDate,
    'Start Date': request.effectiveDate,
    'Notes': request.notes,
    'Customer Notes': request.notes,
    'Details': request.notes,
    'Status': 'Active'
  };
}

function appendMaintenanceCustomerRouteRows_(
    routeSheet, routeTable, sharedValues, request) {
  const weeks = maintenanceWeeksForFrequency_(
    request.frequency,
    request.firstWeek
  );
  const days = request.frequency === 'Twice Weekly'
    ? [request.day, request.secondDay]
    : [request.day];
  const routeRows = [];

  weeks.forEach(function (week) {
    days.forEach(function (serviceDay) {
      const recommendation = request.recommendedPlacements.find(function (placement) {
        return placement.week === week && placement.day === serviceDay;
      }) || null;
      const layer = resolveMaintenanceLayer_(
        routeTable,
        week,
        serviceDay,
        recommendation && recommendation.layer
      );
      const stop = request.requestedStop ||
        (recommendation && recommendation.position) ||
        nextMaintenanceStopForLayer_(routeTable, layer);

      const rowValues = Object.assign({}, sharedValues, {
        'Layer': layer,
        'Route Layer': layer,
        'Week': week,
        'Rotation Week': week,
        'Day': serviceDay,
        'Weekday': serviceDay,
        'Stop': stop,
        'Stop Order': stop,
        'Order': stop
      });
      const row = mappedMaintenanceRow_(routeTable.headers, rowValues);
      insertMaintenanceRouteRow_(routeTable, row, layer, stop);
      routeRows.push({layer: layer, stop: stop});
    });
  });

  writeMaintenanceRouteTable_(routeSheet, routeTable);

  return routeRows;
}

function insertMaintenanceRouteRow_(routeTable, newRow, layer, stop) {
  const layerIndex = findHeaderIndex_(routeTable.headers, [
    'Layer', 'Route Layer', 'Route Assignment'
  ]);
  const stopIndex = findHeaderIndex_(routeTable.headers, ['Stop Order', 'Stop', 'Order']);
  const normalizedLayer = normalizeSyncValue_(layer);
  let insertIndex = routeTable.rows.length;
  let lastLayerIndex = -1;

  routeTable.rows.forEach(function (row, index) {
    if (normalizeSyncValue_(row[layerIndex]) !== normalizedLayer) return;
    lastLayerIndex = index;
    const current = Number(row[stopIndex] || 0);
    if (current >= stop && insertIndex === routeTable.rows.length) insertIndex = index;
    if (Number.isFinite(current) && current >= stop) row[stopIndex] = current + 1;
  });
  if (insertIndex === routeTable.rows.length && lastLayerIndex >= 0) {
    insertIndex = lastLayerIndex + 1;
  }
  routeTable.rows.splice(insertIndex, 0, newRow);
}

function writeMaintenanceRouteTable_(sheet, table) {
  const firstBodyRow = table.headerRow + 1;
  const existingBodyRows = Math.max(0, sheet.getLastRow() - table.headerRow);
  if (existingBodyRows) {
    sheet.getRange(firstBodyRow, 1, existingBodyRows, table.headers.length).clearContent();
  }
  if (table.rows.length) {
    sheet.getRange(firstBodyRow, 1, table.rows.length, table.headers.length)
      .setValues(table.rows);
  }
}

function snapshotMaintenanceSheet_(sheet) {
  const range = sheet.getDataRange();
  return {
    sheet: sheet,
    values: range.getValues(),
    formulas: range.getFormulasR1C1(),
    rows: range.getNumRows(),
    columns: range.getNumColumns()
  };
}

function rollbackMaintenanceSheetSnapshots_(snapshots) {
  (snapshots || []).forEach(function (snapshot) {
    try {
      const sheet = snapshot.sheet;
      const clearRows = Math.max(sheet.getLastRow(), snapshot.rows);
      const clearColumns = Math.max(sheet.getLastColumn(), snapshot.columns);
      if (clearRows && clearColumns) {
        sheet.getRange(1, 1, clearRows, clearColumns).clearContent();
      }
      sheet.getRange(1, 1, snapshot.rows, snapshot.columns).setValues(snapshot.values);
      snapshot.formulas.forEach(function (row, rowIndex) {
        row.forEach(function (formula, columnIndex) {
          if (formula) sheet.getRange(rowIndex + 1, columnIndex + 1).setFormulaR1C1(formula);
        });
      });
    } catch (ignored) {}
  });
  SpreadsheetApp.flush();
}
