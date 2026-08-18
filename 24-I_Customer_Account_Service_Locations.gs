/**
 * Customer Account / Service Location compatibility layer.
 *
 * Each service location keeps its own existing Customer ID so routing and
 * Calendar identity remain unchanged. Account ID groups those independently
 * serviceable rows into one customer/account. Existing single-location
 * customers are migrated lazily: Account ID defaults to their Customer ID.
 */
function ensurePmosCustomerAccountIds_() {
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [PMOS.CUSTOMERS_SHEET, 'Customers', 'Customer Database', 'Customer List']);
  if (!sheet) throw new Error('Customers sheet was not found.');
  let table = readPmosHeaderTable_(sheet);
  ensureMaintenanceClientHeaders_(sheet, table, ['Account ID', 'Service Location Name', 'Primary Service Location']);
  table = readPmosHeaderTable_(sheet);
  const customerIdIndex = findHeaderIndex_(table.headers, ['Customer ID']);
  const accountIdIndex = findHeaderIndex_(table.headers, ['Account ID']);
  const primaryIndex = findHeaderIndex_(table.headers, ['Primary Service Location']);
  if (customerIdIndex < 0 || accountIdIndex < 0) throw new Error('Customers requires Customer ID and Account ID.');
  let changed = false;
  table.rows.forEach(function(row, index) {
    const customerId = String(row[customerIdIndex] || '').trim();
    if (!customerId) return;
    if (!String(row[accountIdIndex] || '').trim()) {
      sheet.getRange(table.headerRow + index + 1, accountIdIndex + 1).setValue(customerId);
      changed = true;
    }
    if (primaryIndex >= 0 && !String(row[primaryIndex] || '').trim()) {
      sheet.getRange(table.headerRow + index + 1, primaryIndex + 1).setValue('Yes');
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
      status: statusIndex >= 0 ? String(row[statusIndex] || 'Active').trim() : 'Active',
      frequency: frequencyIndex >= 0 ? String(row[frequencyIndex] || '').trim() : ''
    };
  });
  locations.sort(function(a,b){ return (a.primary === b.primary) ? a.locationName.localeCompare(b.locationName) : (a.primary ? -1 : 1); });
  return {accountId: accountId, selectedCustomerId: String(selected[idIndex] || '').trim(), locations: locations};
}

function createPmosAdditionalServiceLocation(input) {
  const request = input || {};
  const parentCustomerId = String(request.parentCustomerId || '').trim();
  if (!parentCustomerId) throw new Error('Select the customer account before adding a service location.');
  const account = getPmosCustomerAccount_(parentCustomerId);
  const primary = account.locations.filter(function(location){ return location.primary; })[0] || account.locations[0];
  if (!primary) throw new Error('The customer account has no primary service location.');
  const primaryRecord = getPmosCustomerEditorRow_(primary.customerId);
  const firstIndex = findHeaderIndex_(primaryRecord.headers, ['First Name']);
  const lastIndex = findHeaderIndex_(primaryRecord.headers, ['Last Name', 'Customer Name', 'Name']);
  const phoneIndex = findHeaderIndex_(primaryRecord.headers, ['Primary Phone', 'Phone Number', 'Phone']);
  const emailIndex = findHeaderIndex_(primaryRecord.headers, ['Email', 'Email Address']);
  const locationName = String(request.locationName || request.calendarTitle || '').trim();
  if (!locationName) throw new Error('Additional service locations require a location name.');
  const payload = Object.assign({}, request, {
    firstName: String(request.firstName || (firstIndex >= 0 ? primaryRecord.values[firstIndex] : '') || '').trim(),
    lastName: String(request.lastName || (lastIndex >= 0 ? primaryRecord.values[lastIndex] : '') || '').trim(),
    phone: String(request.phone || (phoneIndex >= 0 ? primaryRecord.values[phoneIndex] : '') || '').trim(),
    email: String(request.email || (emailIndex >= 0 ? primaryRecord.values[emailIndex] : '') || '').trim(),
    calendarTitle: locationName,
    serviceLocationName: locationName,
    accountId: account.accountId,
    primaryServiceLocation: false
  });
  return createMaintenanceCustomerAndAutoSync(payload);
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
}
