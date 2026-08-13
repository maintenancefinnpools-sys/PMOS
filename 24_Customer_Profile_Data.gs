/**
 * Customer Lookup and Customer Profile read adapters.
 *
 * These functions never mutate customer, route, equipment, or Calendar data.
 * Every lookup result and profile load resolves through the canonical Customer ID.
 */

function searchPmosCustomerProfiles(query) {
  const cleanQuery = normalizePmosCustomerSearch_(query);
  const records = readPmosCustomerProfileRecords_();
  return records.filter(function (record) {
    if (!cleanQuery) return true;
    return record.searchText.indexOf(cleanQuery) >= 0;
  }).map(function (record) {
    const lastName = normalizePmosCustomerSearch_(record.lastName);
    const firstName = normalizePmosCustomerSearch_(record.firstName);
    const listName = normalizePmosCustomerSearch_(record.listName);
    let searchRank = 0;
    if (cleanQuery) {
      if (lastName === cleanQuery) searchRank = 500;
      else if (lastName.indexOf(cleanQuery) === 0) searchRank = 400;
      else if (listName.indexOf(cleanQuery) === 0) searchRank = 350;
      else if (firstName.indexOf(cleanQuery) === 0) searchRank = 300;
      else if (record.searchText.indexOf(' ' + cleanQuery) >= 0) searchRank = 200;
      else searchRank = 100;
    }
    return {record: record, searchRank: searchRank};
  }).sort(function (left, right) {
    return right.searchRank - left.searchRank ||
      left.record.lastName.localeCompare(right.record.lastName) ||
      left.record.firstName.localeCompare(right.record.firstName) ||
      left.record.customerId.localeCompare(right.record.customerId);
  }).map(function (match) {
    const record = match.record;
    return {
      customerId: record.customerId,
      displayName: record.displayName,
      listName: record.listName,
      calendarTitle: record.calendarTitle,
      address: record.address,
      phone: record.phone,
      email: record.email,
      status: record.status
    };
  });
}

function getPmosCustomerProfile(customerId) {
  const cleanId = String(customerId || '').trim();
  if (!cleanId) throw new Error('Select a customer before opening the profile.');
  const records = readPmosCustomerProfileRecords_();
  const record = records.find(function (candidate) {
    return candidate.customerId.toUpperCase() === cleanId.toUpperCase();
  });
  if (!record) throw new Error('Customer ID ' + cleanId + ' no longer exists. Refresh the search.');

  const routes = readPmosCustomerProfileRoutes_(record.customerId);
  const equipment = readPmosCustomerProfileEquipment_(record.customerId);
  return {
    customerId: record.customerId,
    displayName: record.displayName,
    firstName: record.firstName,
    lastName: record.lastName,
    calendarTitle: record.calendarTitle,
    address: record.address,
    phone: record.phone,
    email: record.email,
    status: record.status,
    frequency: record.frequency,
    serviceStartDate: record.serviceStartDate,
    yearRound: record.yearRound,
    entryInformation: record.entryInformation,
    notes: record.notes,
    routes: routes,
    equipmentSummary: equipment.summary,
    bodiesOfWater: equipment.bodies
  };
}

function readPmosCustomerProfileRecords_() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = findFirstSheetByName_(spreadsheet, [
    PMOS.CUSTOMERS_SHEET, 'Customer Database', 'Customer List'
  ]);
  if (!sheet) throw new Error('Customers sheet was not found.');
  const table = readPmosHeaderTable_(sheet);
  const idIndex = findHeaderIndex_(table.headers, ['Customer ID']);
  if (idIndex < 0) throw new Error('Customers is missing the Customer ID column.');

  const value = function (row, aliases) {
    const index = findHeaderIndex_(table.headers, aliases);
    return index >= 0 ? row[index] : '';
  };
  return table.rows.map(function (row) {
    const customerId = String(row[idIndex] || '').trim();
    if (!customerId) return null;
    const firstName = String(value(row, ['First Name']) || '').trim();
    const lastName = String(value(row, [
      'Last Name', 'Customer Name', 'Name', 'Customer'
    ]) || '').trim();
    const fallbackName = String(value(row, ['Full Name(s)', 'Full Name']) || '').trim();
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || fallbackName || customerId;
    const listName = lastName && firstName ? lastName + ', ' + firstName : lastName || firstName || fallbackName || customerId;
    const calendarTitle = String(value(row, ['Calendar Title']) || '').trim();
    const address = String(value(row, [
      'Full Address', 'Service Address', 'Address', 'Street Address'
    ]) || '').trim();
    const phone = String(value(row, ['Primary Phone', 'Phone Number', 'Phone']) || '').trim();
    const email = String(value(row, ['Email', 'Email Address']) || '').trim();
    const status = String(value(row, ['Status']) || 'Active').trim() || 'Active';
    const frequency = String(value(row, ['Frequency', 'Service Frequency']) || '').trim();
    const startDate = value(row, ['Service Start Date', 'Start Date']);
    const yearRound = String(value(row, ['Year Round', 'Year-Round', 'Season']) || '').trim();
    const entryInformation = String(value(row, ['Entry Information', 'Entry Notes']) || '').trim();
    const notes = String(value(row, ['Customer Notes', 'Notes', 'Details']) || '').trim();
    return {
      customerId: customerId,
      firstName: firstName,
      lastName: lastName,
      displayName: displayName,
      listName: listName,
      calendarTitle: calendarTitle,
      address: address,
      phone: phone,
      email: email,
      status: status,
      frequency: frequency,
      serviceStartDate: formatPmosCustomerProfileDate_(startDate),
      yearRound: yearRound,
      entryInformation: entryInformation,
      notes: notes,
      searchText: normalizePmosCustomerSearch_([
        customerId, firstName, lastName, displayName, calendarTitle,
        address, phone, email
      ].join(' '))
    };
  }).filter(Boolean).sort(function (left, right) {
    return left.lastName.localeCompare(right.lastName) ||
      left.firstName.localeCompare(right.firstName) ||
      left.customerId.localeCompare(right.customerId);
  });
}

function readPmosCustomerProfileEquipment_(customerId) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('PMOS Customer Equipment');
  if (!sheet || sheet.getLastRow() < 2) return {summary: '', bodies: []};
  const values = sheet.getDataRange().getValues();
  for (let index = 1; index < values.length; index++) {
    if (String(values[index][0] || '').trim() !== customerId) continue;
    const summary = String(values[index][2] || '').trim();
    const json = String(values[index][3] || '').trim();
    if (!json) return {summary: summary, bodies: []};
    try {
      const parsed = JSON.parse(json);
      return {
        summary: summary,
        bodies: Array.isArray(parsed.bodies) ? parsed.bodies : []
      };
    } catch (ignored) {
      return {summary: summary, bodies: []};
    }
  }
  return {summary: '', bodies: []};
}

function readPmosCustomerProfileRoutes_(customerId) {
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [
    PMOS.ROUTES_SHEET, 'PMOS 4-Week Route Template', 'Route Template'
  ]);
  if (!sheet) return [];
  const table = readPmosHeaderTable_(sheet);
  const idIndex = findHeaderIndex_(table.headers, ['Customer ID']);
  const layerIndex = findHeaderIndex_(table.headers, ['Layer', 'Route Layer']);
  const orderIndex = findHeaderIndex_(table.headers, ['Stop Order', 'Route Order', 'Order']);
  if (idIndex < 0 || layerIndex < 0) return [];
  return table.rows.filter(function (row) {
    return String(row[idIndex] || '').trim() === customerId;
  }).map(function (row) {
    const layer = String(row[layerIndex] || '').trim();
    let parsed = {};
    try {
      parsed = typeof parseLayer_ === 'function' ? parseLayer_(layer) : {};
    } catch (ignored) {
      parsed = {};
    }
    return {
      layer: layer,
      week: Number(parsed.week || 0),
      day: String(parsed.day || ''),
      routeArea: derivePmosCustomerRouteArea_(parsed, layer),
      stop: orderIndex >= 0 ? Number(row[orderIndex] || 0) : 0
    };
  }).sort(function (left, right) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const leftDay = days.indexOf(left.day);
    const rightDay = days.indexOf(right.day);
    return left.week - right.week ||
      (leftDay < 0 ? days.length : leftDay) - (rightDay < 0 ? days.length : rightDay) ||
      left.layer.localeCompare(right.layer) || left.stop - right.stop;
  });
}

function derivePmosCustomerRouteArea_(parsedLayer, rawLayer) {
  const parsed = parsedLayer || {};
  const day = String(parsed.day || '').trim();
  const routeDay = String(parsed.routeDay || '').trim();
  if (routeDay && day && normalize_(routeDay) !== normalize_(day)) {
    return routeDay.replace(new RegExp('^' + escapePmosCustomerRegex_(day) + '\\s*[-–—:]?\\s*', 'i'), '').trim();
  }
  const raw = String(rawLayer || '').trim();
  const match = raw.match(/^Week\s+\d+\s+-\s+[^-]+\s+-\s+(.+)$/i);
  return match ? String(match[1] || '').trim() : '';
}

function escapePmosCustomerRegex_(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePmosCustomerSearch_(value) {
  return String(value == null ? '' : value).toLowerCase()
    .replace(/[^a-z0-9@.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatPmosCustomerProfileDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, PMOS.TIMEZONE, 'MMM d, yyyy');
  }
  return String(value).trim();
}
