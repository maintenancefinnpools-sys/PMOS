/**
 * Smart Customer Database Sync.
 * Customers is the source of truth for shared customer fields. The 4-Week Route
 * Template remains the source of truth for scheduling fields.
 */

function runSmartCustomerDatabaseSync() {
  const result = synchronizeCustomerDatabaseSmart_();
  return { summary: formatSmartCustomerSyncSummary_(result), result };
}

function synchronizeCustomerDatabaseSmart_() {
  const ss = SpreadsheetApp.getActive();
  const customersSheet = findFirstSheetByName_(ss, [
    'Customers',
    'Customer Database',
    'Customer List'
  ]);
  const routeSheet = findFirstSheetByName_(ss, [
    '4-Week Route Template',
    'PMOS 4-Week Route Template',
    'Route Template'
  ]);

  if (!customersSheet) throw new Error('Customers sheet was not found.');
  if (!routeSheet) throw new Error('4-Week Route Template sheet was not found.');

  const customerTable = readHeaderTable_(customersSheet);
  const routeTable = readHeaderTable_(routeSheet);
  if (!customerTable.rows.length) throw new Error('The Customers sheet contains no customer records.');

  let customerIdIndex = findHeaderIndex_(customerTable.headers, ['Customer ID', 'CustomerID', 'ID']);
  if (customerIdIndex < 0) {
    customerIdIndex = customerTable.headers.length;
    customersSheet.getRange(customerTable.headerRow, customerIdIndex + 1).setValue('Customer ID');
    customerTable.headers.push('Customer ID');
    customerTable.normalizedHeaders.push(normalizeSyncHeader_('Customer ID'));
    customerTable.rows.forEach(row => row.push(''));
  }

  const routeIdIndex = findHeaderIndex_(routeTable.headers, ['Customer ID', 'CustomerID', 'ID']);
  const customerNameIndex = findHeaderIndex_(customerTable.headers, ['Customer Name', 'Name', 'Customer']);
  const routeNameIndex = findHeaderIndex_(routeTable.headers, ['Customer Name', 'Name', 'Customer']);
  const customerAddressIndex = findHeaderIndex_(customerTable.headers, ['Address', 'Service Address', 'Street Address']);
  const routeAddressIndex = findHeaderIndex_(routeTable.headers, ['Address', 'Service Address', 'Street Address']);

  const result = {
    customersScanned: customerTable.rows.length,
    customerIdsCreated: 0,
    routeRowsScanned: routeTable.rows.length,
    routeRowsUpdated: 0,
    cellsUpdated: 0,
    unmatchedRouteRows: 0,
    duplicateCustomerKeys: 0,
    fieldsUpdated: {},
    warnings: []
  };

  const customerById = {};
  const customerByFallback = {};

  customerTable.rows.forEach((row, rowOffset) => {
    let id = String(row[customerIdIndex] || '').trim();
    if (!id) {
      id = 'CUS-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
      row[customerIdIndex] = id;
      customersSheet.getRange(customerTable.dataStartRow + rowOffset, customerIdIndex + 1).setValue(id);
      result.customerIdsCreated++;
    }

    const idKey = normalizeSyncValue_(id);
    if (customerById[idKey]) result.duplicateCustomerKeys++;
    else customerById[idKey] = row;

    const fallback = makeCustomerFallbackKey_(row, customerNameIndex, customerAddressIndex);
    if (fallback) {
      if (customerByFallback[fallback]) result.duplicateCustomerKeys++;
      else customerByFallback[fallback] = row;
    }
  });

  const excluded = new Set([
    'week', 'rotationweek', 'day', 'weekday', 'stop', 'stoporder', 'order',
    'route', 'routelayer', 'layer', 'routeassignment', 'scheduledate',
    'starttime', 'endtime', 'eventid', 'seriesid', 'calendarid', 'status'
  ]);

  const sharedColumns = [];
  routeTable.headers.forEach((header, routeColumn) => {
    const normalized = normalizeSyncHeader_(header);
    if (!normalized || excluded.has(normalized)) return;
    const customerColumn = customerTable.normalizedHeaders.indexOf(normalized);
    if (customerColumn >= 0) sharedColumns.push({
      header: String(header || '').trim() || customerTable.headers[customerColumn],
      customerColumn,
      routeColumn
    });
  });

  if (!sharedColumns.length) {
    result.warnings.push('No matching customer-information columns were found between Customers and the 4-Week Route Template.');
  }

  const changedRows = new Set();
  routeTable.rows.forEach((routeRow, routeOffset) => {
    let customerRow = null;
    if (routeIdIndex >= 0) {
      const idKey = normalizeSyncValue_(routeRow[routeIdIndex]);
      if (idKey) customerRow = customerById[idKey] || null;
    }
    if (!customerRow) {
      const fallback = makeCustomerFallbackKey_(routeRow, routeNameIndex, routeAddressIndex);
      if (fallback) customerRow = customerByFallback[fallback] || null;
    }
    if (!customerRow) {
      if (routeRow.some(value => String(value || '').trim())) result.unmatchedRouteRows++;
      return;
    }

    sharedColumns.forEach(mapping => {
      const source = customerRow[mapping.customerColumn];
      const current = routeRow[mapping.routeColumn];
      if (valuesEquivalentForSync_(source, current)) return;
      routeRow[mapping.routeColumn] = source;
      changedRows.add(routeOffset);
      result.cellsUpdated++;
      result.fieldsUpdated[mapping.header] = Number(result.fieldsUpdated[mapping.header] || 0) + 1;
    });
  });

  changedRows.forEach(routeOffset => {
    routeSheet.getRange(
      routeTable.dataStartRow + routeOffset,
      1,
      1,
      routeTable.headers.length
    ).setValues([routeTable.rows[routeOffset]]);
  });
  result.routeRowsUpdated = changedRows.size;

  SpreadsheetApp.flush();
  return result;
}

function formatSmartCustomerSyncSummary_(result) {
  const fieldLines = Object.keys(result.fieldsUpdated)
    .sort()
    .map(name => `• ${name}: ${result.fieldsUpdated[name]}`);

  return [
    'Customer Database Sync complete.',
    '',
    `Customers scanned: ${result.customersScanned}`,
    `Customer IDs created: ${result.customerIdsCreated}`,
    `Route rows scanned: ${result.routeRowsScanned}`,
    `Route rows updated: ${result.routeRowsUpdated}`,
    `Individual fields updated: ${result.cellsUpdated}`,
    `Unmatched route rows: ${result.unmatchedRouteRows}`,
    result.duplicateCustomerKeys ? `Duplicate customer matches detected: ${result.duplicateCustomerKeys}` : '',
    fieldLines.length ? `\nFields changed:\n${fieldLines.join('\n')}` : '\nNo customer-information changes were required.',
    result.warnings.length ? `\nWarnings:\n${result.warnings.map(w => `• ${w}`).join('\n')}` : '',
    '',
    'Run Calendar Sync next to update future Google Calendar events from the refreshed 4-Week Route Template.'
  ].filter(line => line !== '').join('\n');
}

function findFirstSheetByName_(ss, names) {
  for (let index = 0; index < names.length; index++) {
    const sheet = ss.getSheetByName(names[index]);
    if (sheet) return sheet;
  }
  const normalizedNames = names.map(normalizeSyncHeader_);
  return ss.getSheets().find(sheet => normalizedNames.indexOf(normalizeSyncHeader_(sheet.getName())) >= 0) || null;
}

function readHeaderTable_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error(`${sheet.getName()} is empty.`);
  let headerRowIndex = 0;
  let bestScore = -1;
  const scanRows = Math.min(values.length, 10);
  for (let row = 0; row < scanRows; row++) {
    const score = values[row].filter(value => String(value || '').trim()).length;
    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = row;
    }
  }
  const headers = values[headerRowIndex].map(value => String(value || '').trim());
  return {
    headers,
    normalizedHeaders: headers.map(normalizeSyncHeader_),
    rows: values.slice(headerRowIndex + 1).filter(row => row.some(value => String(value || '').trim())),
    headerRow: headerRowIndex + 1,
    dataStartRow: headerRowIndex + 2
  };
}

function findHeaderIndex_(headers, candidates) {
  const normalized = headers.map(normalizeSyncHeader_);
  for (let index = 0; index < candidates.length; index++) {
    const match = normalized.indexOf(normalizeSyncHeader_(candidates[index]));
    if (match >= 0) return match;
  }
  return -1;
}

function normalizeSyncHeader_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeSyncValue_(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function makeCustomerFallbackKey_(row, nameIndex, addressIndex) {
  const name = nameIndex >= 0 ? normalizeSyncValue_(row[nameIndex]) : '';
  const address = addressIndex >= 0 ? normalizeSyncValue_(row[addressIndex]) : '';
  if (!name && !address) return '';
  return `${name}|${address}`;
}

function valuesEquivalentForSync_(left, right) {
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  if (left instanceof Date || right instanceof Date) return String(left) === String(right);
  return normalizeSyncValue_(left) === normalizeSyncValue_(right);
}
