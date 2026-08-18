/**
 * Customer Account / Service Location compatibility layer.
 *
 * Each independently serviced property keeps its own Customer ID, so PMOS's
 * existing route, Calendar, status, equipment, and sync identities remain
 * unchanged. Account ID groups those Customer IDs into one household/account.
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
    if (primaryIndex >= 0 && !String(row[primaryIndex] || '').trim()) {
      sheet.getRange(rowNumber, primaryIndex + 1).setValue('Yes');
      changed = true;
    }
    if (locationNameIndex >= 0 && !String(row[locationNameIndex] || '').trim()) {
      const defaultName = [calendarTitleIndex, lastNameIndex, fullNameIndex]
        .map(function(column) { return column >= 0 ? String(row[column] || '').trim() : ''; })
        .filter(Boolean)[0] || 'Primary';
      sheet.getRange(rowNumber, locationNameIndex + 1).setValue(defaultName);
      changed = true;
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
    return {
      customerId: String(row[idIndex] || '').trim(),
      accountId: accountId,
      locationName: locationNameIndex >= 0 ? String(row[locationNameIndex] || '').trim() : '',
      primary: primaryIndex < 0 || String(row[primaryIndex] || '').trim().toLowerCase() !== 'no',
      calendarTitle: titleIndex >= 0 ? String(row[titleIndex] || '').trim() : '',
      address: addressIndex >= 0 ? String(row[addressIndex] || '').trim() : '',
      status: statusIndex >= 0 ? String(row[statusIndex] || 'Active').trim() || 'Active' : 'Active',
      frequency: frequencyIndex >= 0 ? String(row[frequencyIndex] || '').trim() : ''
    };
  });

  locations.sort(function(a, b) {
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    return String(a.locationName || a.calendarTitle || '').localeCompare(
      String(b.locationName || b.calendarTitle || '')
    );
  });

  return {
    accountId: accountId,
    selectedCustomerId: String(selected[idIndex] || '').trim(),
    firstName: firstNameIndex >= 0 ? String(selected[firstNameIndex] || '').trim() : '',
    lastName: lastNameIndex >= 0 ? String(selected[lastNameIndex] || '').trim() : '',
    phone: phoneIndex >= 0 ? String(selected[phoneIndex] || '').trim() : '',
    email: emailIndex >= 0 ? String(selected[emailIndex] || '').trim() : '',
    locations: locations
  };
}

function getPmosCustomerAccount(customerId) {
  return getPmosCustomerAccount_(customerId);
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

  const payload = Object.assign({}, request, {
    firstName: String(request.firstName || (firstIndex >= 0 ? primaryRecord.values[firstIndex] : '') || '').trim(),
    lastName: String(request.lastName || (lastIndex >= 0 ? primaryRecord.values[lastIndex] : '') || '').trim(),
    phone: String(request.phone || (phoneIndex >= 0 ? primaryRecord.values[phoneIndex] : '') || '').trim(),
    email: String(request.email || (emailIndex >= 0 ? primaryRecord.values[emailIndex] : '') || '').trim(),
    address: address,
    calendarTitle: locationName,
    serviceLocationName: locationName,
    accountId: account.accountId,
    primaryServiceLocation: false
  });

  const result = createMaintenanceCustomerAndAutoSync(payload);
  result.account = getPmosCustomerAccount_(result.customerId);
  return result;
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
