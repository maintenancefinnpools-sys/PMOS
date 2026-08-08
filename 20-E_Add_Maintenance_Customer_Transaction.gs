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

  const appended = [];
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

    let customerTable = readHeaderTable_(customersSheet);
    let routeTable = readHeaderTable_(routeSheet);

    ensureMaintenanceClientHeaders_(customersSheet, customerTable, [
      'Customer ID', 'Calendar Title', 'Full Address', 'Primary Phone',
      'Email', 'Frequency', 'Service Start Date', 'Customer Notes'
    ]);
    ensureMaintenanceClientHeaders_(routeSheet, routeTable, [
      'Customer ID', 'Calendar Title', 'Layer', 'Stop Order'
    ]);

    customerTable = readHeaderTable_(customersSheet);
    routeTable = readHeaderTable_(routeSheet);
    assertMaintenanceClientNotDuplicate_(
      customerTable,
      request.name,
      request.address,
      request.email
    );

    const customerId = generateNextPmosCustomerId_();
    const sharedValues = buildMaintenanceCustomerSharedValues_(request, customerId);

    appendMappedMaintenanceRow_(customersSheet, customerTable, sharedValues);
    appended.push({sheet: customersSheet, row: customersSheet.getLastRow()});

    const routeRows = appendMaintenanceCustomerRouteRows_(
      routeSheet,
      routeTable,
      sharedValues,
      request,
      appended
    );

    SpreadsheetApp.flush();

    let customerRefresh = 'Customer data refresh was not required.';
    try {
      if (typeof synchronizeCustomerDatabaseSmart_ === 'function') {
        const refresh = synchronizeCustomerDatabaseSmart_();
        customerRefresh = Number(refresh && refresh.routeRowsUpdated || 0) +
          ' route row(s) refreshed from Customers.';
      }
    } catch (error) {
      customerRefresh = 'Customer data refresh warning: ' +
        String(error && error.message ? error.message : error);
    }

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
      calendarStatus: 'PENDING_PLAN_AUDIT',
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
        'Calendar was not changed. Run Calendar Plan Audit when ready to review and synchronize this customer.'
      ].join('\n')
    };
  } catch (error) {
    rollbackMaintenanceClientRows_(appended);
    throw error;
  } finally {
    lock.releaseLock();
  }
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
    calendarTitle: calendarTitle
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
    routeSheet, routeTable, sharedValues, request, appended) {
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
      const layer = 'Week ' + week + ' - ' + serviceDay;
      const stop = request.requestedStop ||
        nextMaintenanceStopForLayer_(routeTable, layer);

      if (request.requestedStop) {
        makeRoomForMaintenanceStop_(routeSheet, routeTable, layer, stop);
      }

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
      const row = appendMappedMaintenanceRow_(
        routeSheet,
        routeTable,
        rowValues
      );
      appended.push({sheet: routeSheet, row: routeSheet.getLastRow()});
      routeRows.push({layer: layer, stop: stop});
      routeTable.rows.push(row);
    });
  });

  return routeRows;
}
