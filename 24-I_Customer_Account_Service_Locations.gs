/**
 * Customer Account / Service Location compatibility layer.
 *
 * Each independently serviced property keeps its own Customer ID, so PMOS's
 * existing route, Calendar, status, equipment, and sync identities remain
 * location-specific. Account ID groups those Customer IDs into one account.
 */
function ensurePmosCustomerAccountIds_() {
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [
    PMOS.CUSTOMERS_SHEET, 'Customers', 'Customer Database', 'Customer List'
  ]);
  if (!sheet) throw new Error('Customers sheet was not found.');

  let table = readPmosHeaderTable_(sheet);
  ensureMaintenanceClientHeaders_(sheet, table, [
    'Account ID', 'Service Location Name', 'Primary Service Location'
  ]);
  table = readPmosHeaderTable_(sheet);

  const customerIdIndex = findHeaderIndex_(table.headers, ['Customer ID']);
  const accountIdIndex = findHeaderIndex_(table.headers, ['Account ID']);
  const locationNameIndex = findHeaderIndex_(table.headers, ['Service Location Name']);
  const primaryIndex = findHeaderIndex_(table.headers, ['Primary Service Location']);
  const calendarTitleIndex = findHeaderIndex_(table.headers, ['Calendar Title']);
  const lastNameIndex = findHeaderIndex_(table.headers, ['Last Name', 'Customer Name', 'Name', 'Customer']);
  const fullNameIndex = findHeaderIndex_(table.headers, ['Full Name(s)', 'Full Name']);

  if (customerIdIndex < 0 || accountIdIndex < 0) {
    throw new Error('Customers requires Customer ID and Account ID.');
  }

  let changed = false;
  table.rows.forEach(function(row, index) {
    const customerId = String(row[customerIdIndex] || '').trim();
    if (!customerId) return;
    const rowNumber = table.headerRow + index + 1;

    if (!String(row[accountIdIndex] || '').trim()) {
      sheet.getRange(rowNumber, accountIdIndex + 1).setValue(customerId);
      changed = true;
    }

    let primaryValue = primaryIndex >= 0 ? String(row[primaryIndex] || '').trim() : 'Yes';
    if (primaryIndex >= 0 && !primaryValue) {
      primaryValue = 'Yes';
      sheet.getRange(rowNumber, primaryIndex + 1).setValue(primaryValue);
      changed = true;
    }

    if (locationNameIndex >= 0) {
      const currentName = String(row[locationNameIndex] || '').trim();
      const lastName = lastNameIndex >= 0 ? String(row[lastNameIndex] || '').trim() : '';
      const fullName = fullNameIndex >= 0 ? String(row[fullNameIndex] || '').trim() : '';
      const calendarTitle = calendarTitleIndex >= 0 ? String(row[calendarTitleIndex] || '').trim() : '';
      const isPrimary = String(primaryValue || 'Yes').toLowerCase() !== 'no';
      let defaultName = currentName;

      if (!currentName) {
        defaultName = isPrimary && lastName
          ? lastName + ' Residence'
          : calendarTitle || lastName || fullName || 'Service Location';
      } else if (isPrimary && lastName) {
        const normalizedCurrent = normalize_(currentName);
        const legacyNames = [lastName, fullName, 'Primary'].filter(Boolean).map(normalize_);
        if (normalize_(calendarTitle) === normalize_(lastName)) legacyNames.push(normalize_(calendarTitle));
        if (legacyNames.indexOf(normalizedCurrent) >= 0) defaultName = lastName + ' Residence';
      }

      if (defaultName !== currentName) {
        sheet.getRange(rowNumber, locationNameIndex + 1).setValue(defaultName);
        changed = true;
      }
    }
  });

  if (changed) SpreadsheetApp.flush();
  return readPmosHeaderTable_(sheet);
}

function getPmosCustomerAccount_(customerId) {
  const table = ensurePmosCustomerAccountIds_();
  const idIndex = findHeaderIndex_(table.headers, ['Customer ID']);
  const accountIndex = findHeaderIndex_(table.headers, ['Account ID']);
  const locationNameIndex = findHeaderIndex_(table.headers, ['Service Location Name']);
  const primaryIndex = findHeaderIndex_(table.headers, ['Primary Service Location']);
  const addressIndex = findHeaderIndex_(table.headers, ['Full Address', 'Service Address', 'Address']);
  const titleIndex = findHeaderIndex_(table.headers, ['Calendar Title']);
  const statusIndex = findHeaderIndex_(table.headers, ['Status']);
  const frequencyIndex = findHeaderIndex_(table.headers, ['Frequency', 'Service Frequency']);
  const firstNameIndex = findHeaderIndex_(table.headers, ['First Name']);
  const lastNameIndex = findHeaderIndex_(table.headers, ['Last Name', 'Customer Name', 'Name', 'Customer']);
  const phoneIndex = findHeaderIndex_(table.headers, ['Primary Phone', 'Phone Number', 'Phone']);
  const emailIndex = findHeaderIndex_(table.headers, ['Email', 'Email Address']);

  const requestedId = String(customerId || '').trim().toUpperCase();
  let selected = null;
  table.rows.forEach(function(row) {
    if (String(row[idIndex] || '').trim().toUpperCase() === requestedId) selected = row;
  });
  if (!selected) throw new Error('Customer ID ' + customerId + ' was not found.');

  const accountId = String(selected[accountIndex] || selected[idIndex] || '').trim();
  const locations = table.rows.filter(function(row) {
    return String(row[accountIndex] || row[idIndex] || '').trim() === accountId;
  }).map(function(row) {
    const frequency = frequencyIndex >= 0 ? String(row[frequencyIndex] || '').trim() : '';
    return {
      customerId: String(row[idIndex] || '').trim(),
      accountId: accountId,
      locationName: locationNameIndex >= 0 ? String(row[locationNameIndex] || '').trim() : '',
      primary: primaryIndex < 0 || String(row[primaryIndex] || '').trim().toLowerCase() !== 'no',
      calendarTitle: titleIndex >= 0 ? String(row[titleIndex] || '').trim() : '',
      address: addressIndex >= 0 ? String(row[addressIndex] || '').trim() : '',
      status: statusIndex >= 0 ? String(row[statusIndex] || 'Active').trim() || 'Active' : 'Active',
      frequency: frequency,
      waterMaintenance: !!frequency
    };
  });

  locations.sort(function(a, b) {
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    return String(a.locationName || a.calendarTitle || '').localeCompare(
      String(b.locationName || b.calendarTitle || '')
    );
  });

  const firstName = firstNameIndex >= 0 ? String(selected[firstNameIndex] || '').trim() : '';
  const lastName = lastNameIndex >= 0 ? String(selected[lastNameIndex] || '').trim() : '';
  const accountName = lastName && firstName
    ? lastName + ', ' + firstName
    : lastName || firstName || accountId;
  return {
    accountId: accountId,
    accountName: accountName,
    selectedCustomerId: String(selected[idIndex] || '').trim(),
    firstName: firstName,
    lastName: lastName,
    phone: phoneIndex >= 0 ? String(selected[phoneIndex] || '').trim() : '',
    email: emailIndex >= 0 ? String(selected[emailIndex] || '').trim() : '',
    locations: locations
  };
}

function getPmosCustomerAccount(customerId) {
  return getPmosCustomerAccount_(customerId);
}

function isPmosWaterMaintenanceRequest_(request) {
  if (request && request.waterMaintenance === true) return true;
  return /^(true|yes|on|maintenance)$/i.test(String(request && request.waterMaintenance || '').trim());
}

function createPmosAdditionalServiceLocation(input) {
  const request = input || {};
  const parentCustomerId = String(request.parentCustomerId || '').trim();
  if (!parentCustomerId) {
    throw new Error('Select the customer account before adding a service location.');
  }

  const account = getPmosCustomerAccount_(parentCustomerId);
  const primary = account.locations.filter(function(location) { return location.primary; })[0] || account.locations[0];
  if (!primary) throw new Error('The customer account has no primary service location.');

  const locationName = String(request.locationName || request.calendarTitle || '').trim();
  if (!locationName) throw new Error('Additional service locations require a location name.');
  if (account.locations.some(function(location) {
    return normalize_(location.locationName || location.calendarTitle) === normalize_(locationName);
  })) {
    throw new Error('This account already has a service location named ' + locationName + '.');
  }

  const address = String(request.address || '').trim();
  if (!address) throw new Error('Enter the service address.');
  if (account.locations.some(function(location) {
    return normalizePmosAddressSearch_(location.address) === normalizePmosAddressSearch_(address);
  })) {
    throw new Error('That service address is already attached to this customer account.');
  }

  const primaryRecord = getPmosCustomerEditorRow_(primary.customerId);
  const firstIndex = findHeaderIndex_(primaryRecord.headers, ['First Name']);
  const lastIndex = findHeaderIndex_(primaryRecord.headers, ['Last Name', 'Customer Name', 'Name']);
  const phoneIndex = findHeaderIndex_(primaryRecord.headers, ['Primary Phone', 'Phone Number', 'Phone']);
  const emailIndex = findHeaderIndex_(primaryRecord.headers, ['Email', 'Email Address']);
  const primaryEmail = emailIndex >= 0 ? String(primaryRecord.values[emailIndex] || '').trim() : '';
  const waterMaintenance = isPmosWaterMaintenanceRequest_(request);

  const payload = Object.assign({}, request, {
    firstName: String(request.firstName || (firstIndex >= 0 ? primaryRecord.values[firstIndex] : '') || '').trim(),
    lastName: String(request.lastName || (lastIndex >= 0 ? primaryRecord.values[lastIndex] : '') || '').trim(),
    phone: String(request.phone || (phoneIndex >= 0 ? primaryRecord.values[phoneIndex] : '') || '').trim(),
    email: request.suppressInheritedEmailOnCreate
      ? ''
      : String(request.email || primaryEmail || '').trim(),
    address: address,
    calendarTitle: String(request.calendarTitle || locationName).trim(),
    serviceLocationName: locationName,
    accountId: account.accountId,
    primaryServiceLocation: false,
    waterMaintenance: waterMaintenance
  });

  let result;
  if (waterMaintenance) {
    if ((!Array.isArray(payload.recommendedPlacements) || !payload.recommendedPlacements.length) && request.manualRoute) {
      payload.recommendedPlacements = buildPmosCustomerEditorManualPlacements_(
        payload.frequency || 'Weekly',
        request.manualRoute
      );
      payload.day = request.manualRoute.day;
      payload.secondDay = request.manualRoute.secondDay || '';
      payload.week = request.manualRoute.week || 1;
      payload.stop = request.manualRoute.stop || 1;
    }
    if (!Array.isArray(payload.recommendedPlacements) || !payload.recommendedPlacements.length) {
      throw new Error('Choose a route recommendation or manual route placement for Water Maintenance.');
    }
    result = createMaintenanceCustomerAndAutoSync(payload);
    applyPmosAccountIdentityToCustomerRow_(
      result.customerId,
      account.accountId,
      locationName,
      false
    );
    result.waterMaintenance = true;
  } else {
    result = createPmosNonMaintenanceAccountServiceLocation_(payload);
  }

  result.account = getPmosCustomerAccount_(result.customerId);
  return result;
}

function createPmosNonMaintenanceAccountServiceLocation_(request) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Another PMOS operation is running. Try again when it finishes.');
  }

  let snapshots = [];
  try {
    const spreadsheet = SpreadsheetApp.getActive();
    const customersSheet = findFirstSheetByName_(spreadsheet, [
      PMOS.CUSTOMERS_SHEET, 'Customers', 'Customer Database', 'Customer List'
    ]);
    if (!customersSheet) throw new Error('Customers sheet was not found.');

    const equipmentSheet = migrateMaintenanceCustomerEquipmentStorage_(spreadsheet, customersSheet);
    snapshots = [
      snapshotMaintenanceSheet_(customersSheet),
      snapshotMaintenanceSheet_(equipmentSheet)
    ];

    let customerTable = readPmosHeaderTable_(customersSheet);
    ensureMaintenanceClientHeaders_(customersSheet, customerTable, [
      'Customer ID', 'First Name', 'Last Name', 'Full Name(s)', 'Calendar Title',
      'Full Address', 'Primary Phone', 'Email', 'Status', 'Frequency',
      'Service Start Date', 'Entry Information', 'Customer Notes',
      'Sanitization Type(s)', 'Automation', 'Pump', 'Filter', 'Heater',
      'Robot(s)', 'Cover', 'Bodies of Water', 'Year Round',
      'Account ID', 'Service Location Name', 'Primary Service Location'
    ]);
    customerTable = readPmosHeaderTable_(customersSheet);

    const customerId = generateNextPmosCustomerId_();
    const bodies = normalizePmosCustomerEditorBodies_(request.bodiesOfWater);
    const equipment = buildPmosCustomerEditorEquipmentValues_(
      bodies,
      customerId,
      String(request.calendarTitle || request.serviceLocationName || request.lastName || '').trim()
    );
    const fullName = [request.firstName, request.lastName].filter(Boolean).join(' ');
    const values = {
      'Customer ID': customerId,
      'First Name': String(request.firstName || '').trim(),
      'Last Name': String(request.lastName || '').trim(),
      'Full Name(s)': fullName,
      'Calendar Title': String(request.calendarTitle || request.serviceLocationName || request.lastName || '').trim(),
      'Full Address': String(request.address || '').trim(),
      'Primary Phone': String(request.phone || '').trim(),
      'Email': String(request.email || '').trim(),
      'Status': 'Active',
      'Frequency': '',
      'Service Start Date': '',
      'Entry Information': String(request.entryInformation || '').trim(),
      'Customer Notes': String(request.notes || '').trim(),
      'Sanitization Type(s)': equipment.sanitization,
      'Automation': equipment.automation,
      'Pump': equipment.pump,
      'Filter': equipment.filter,
      'Heater': equipment.heater,
      'Robot(s)': equipment.robots,
      'Cover': equipment.cover,
      'Bodies of Water': equipment.bodies,
      'Year Round': '',
      'Account ID': String(request.accountId || customerId).trim(),
      'Service Location Name': String(request.serviceLocationName || '').trim(),
      'Primary Service Location': 'No'
    };

    appendMappedMaintenanceRow_(customersSheet, customerTable, values);
    const customerRowNumber = customersSheet.getLastRow();
    customersSheet.getRange(customerRowNumber, 1, 1, customersSheet.getLastColumn()).setWrap(false);
    customersSheet.setRowHeight(customerRowNumber, 21);
    upsertMaintenanceCustomerEquipment_(equipmentSheet, {
      customerId: customerId,
      calendarTitle: values['Calendar Title'],
      equipmentSummary: equipment.summary,
      equipmentDetailsJson: equipment.detailsJson
    });
    sortMaintenanceCustomersAlphabetically_(customersSheet);
    SpreadsheetApp.flush();

    return {
      created: true,
      customerId: customerId,
      customerName: fullName,
      waterMaintenance: false,
      calendarStatus: 'NOT_REQUIRED',
      summary: 'Service location created without Water Maintenance.'
    };
  } catch (error) {
    rollbackMaintenanceSheetSnapshots_(snapshots);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function applyPmosAccountIdentityToCustomerRow_(customerId, accountId, locationName, primary) {
  const record = getPmosCustomerEditorRow_(customerId);
  const accountIndex = findHeaderIndex_(record.headers, ['Account ID']);
  const nameIndex = findHeaderIndex_(record.headers, ['Service Location Name']);
  const primaryIndex = findHeaderIndex_(record.headers, ['Primary Service Location']);
  const values = record.values.slice();
  if (accountIndex >= 0) values[accountIndex] = String(accountId || customerId).trim();
  if (nameIndex >= 0) values[nameIndex] = String(locationName || '').trim();
  if (primaryIndex >= 0) values[primaryIndex] = primary === false ? 'No' : 'Yes';
  record.sheet.getRange(record.rowNumber, 1, 1, values.length).setValues([values]);
  SpreadsheetApp.flush();
}
