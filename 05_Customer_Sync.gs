/**
 * PMOS v1.9.0 — Customer synchronization and identity management.
 * Customers sheet is authoritative for customer identity and details.
 */

function synchronizeCustomerDatabase_(markPending) {
  ensureSupportSheets_();
  const idsCreated = ensureCustomerIds_();
  const namesBackfilled = backfillPmosCustomerNameColumns_();
  ensureRouteCustomerIdColumn_();

  const customerLookup = getCustomerLookup_();
  const routeSheet = getRoutesSheet_();
  const values = routeSheet.getDataRange().getValues();
  const headers = values[0].map(v => String(v).trim());

  const idCol = headers.indexOf('Customer ID');
  const layerCol = headers.indexOf('Layer');
  const titleCol = headers.indexOf('Calendar Title');
  const mapLabelCol = headers.indexOf('Map Label');
  const fullNameCol = headers.indexOf('Full Name(s)');
  const addressCol = headers.indexOf('Full Address');
  const frequencyCol = headers.indexOf('Frequency');
  const statusCol = headers.indexOf('Status');
  const entryCol = headers.indexOf('Entry Information');
  const notesCol = headers.indexOf('Customer Notes');

  const changedLayers = new Set();
  const routeRowsToDelete = [];
  const resolvedRouteIdentities = {};
  const unresolvedRouteRows = [];
  let routeRowsUpdated = 0;
  let routeRowsRemoved = 0;

  for (let index = 1; index < values.length; index++) {
    const routeId = String(values[index][idCol] || '').trim();
    const customer = resolvePmosCustomerSyncRouteCustomer_(
      values[index],
      {
        idCol: idCol,
        titleCol: titleCol,
        mapLabelCol: mapLabelCol,
        fullNameCol: fullNameCol,
        addressCol: addressCol
      },
      customerLookup
    );

    // Customers is authoritative. A route row carrying a stable Customer ID
    // that no longer exists is an orphan created by customer deletion; remove
    // every occurrence and mark its layer for Calendar reconciliation.
    if (
      routeId &&
      !customer
    ) {
      const layer = String(values[index][layerCol] || '').trim();
      if (layer) changedLayers.add(layer);
      routeRowsToDelete.push(index + 1);
      routeRowsRemoved++;
      continue;
    }

    if (!customer) {
      const layer = String(values[index][layerCol] || '').trim();
      const routeTitle = readPmosCustomerSyncRouteTitle_(
        values[index], titleCol, mapLabelCol
      );
      const fullName = fullNameCol >= 0
        ? String(values[index][fullNameCol] || '').trim() : '';
      if (layer && (routeId || routeTitle || fullName)) {
        unresolvedRouteRows.push(index + 1);
      }
      continue;
    }

    const layer = String(values[index][layerCol] || '').trim();
    const canonicalId = String(customer['Customer ID'] || routeId || '').trim();
    const routeIdentity = canonicalId && layer
      ? canonicalId + '|' + layer : '';
    if (routeIdentity && resolvedRouteIdentities[routeIdentity]) {
      changedLayers.add(layer);
      routeRowsToDelete.push(index + 1);
      routeRowsRemoved++;
      continue;
    }
    if (routeIdentity) resolvedRouteIdentities[routeIdentity] = index + 1;

    const updates = [
      [idCol, customer['Customer ID']],
      [titleCol, customer['Calendar Title']],
      [fullNameCol, customer['Full Name(s)']],
      [addressCol, customer['Full Address']],
      [frequencyCol, customer['Frequency']],
      [statusCol, String(customer['Status'] || 'Active').trim() || 'Active'],
      [entryCol, buildCustomerEntryInformation_(customer)],
      [notesCol, customer['Customer Notes']]
    ].filter(item => item[0] >= 0);

    let changed = false;
    updates.forEach(([column, value]) => {
      const normalizedValue = value == null ? '' : value;
      if (String(values[index][column] || '') !== String(normalizedValue)) {
        values[index][column] = normalizedValue;
        changed = true;
      }
    });

    if (changed) {
      routeRowsUpdated++;
      const layer = String(values[index][layerCol] || '').trim();
      if (layer) changedLayers.add(layer);
    }
  }

  if (unresolvedRouteRows.length) {
    throw new Error(
      'Customer Sync stopped before creating route rows because existing ' +
      'Route Template row(s) could not be matched to Customers: ' +
      unresolvedRouteRows.slice(0, 20).join(', ') +
      (unresolvedRouteRows.length > 20 ? '…' : '') +
      '. Repair those identities first; PMOS will not append a replacement schedule.'
    );
  }

  if (values.length > 1) {
    routeSheet.getRange(2, 1, values.length - 1, headers.length)
      .setValues(values.slice(1));
  }

  // Delete bottom-up so stored sheet row numbers remain valid.
  routeRowsToDelete.sort(function(left, right) { return right - left; })
    .forEach(function(rowNumber) {
      routeSheet.deleteRow(rowNumber);
    });

  /*
   * Route IDs captured before migration may contain legacy identities. Re-read
   * the route IDs only after canonical IDs have been written back so migrated
   * customers are not mistaken for missing customers and duplicated.
   */
  const currentRouteCustomerIds = new Set(
    readRouteCustomerIdsWithoutCustomerLookup_()
  );

  const creationResult = createMissingRouteRowsFromCustomers_(
    customerLookup.list,
    currentRouteCustomerIds
  );

  creationResult.changedLayers.forEach(layer => changedLayers.add(layer));

  groupPmosRouteRowsByLayerPreservingOrder_();
  normalizeRoutesFromPhysicalOrder_(false);

  if (markPending && changedLayers.size) {
    [...changedLayers].forEach(layer =>
      addPendingChange_(layer, 1, 'Customer database synchronization')
    );

    updateSyncStatus_(
      'Route changes pending',
      `${changedLayers.size} route layer(s) changed from the Customers sheet.`
    );
  }

  const customersSheet = SpreadsheetApp.getActive().getSheetByName(PMOS.CUSTOMERS_SHEET);
  if (!customersSheet) throw new Error(`Missing sheet: ${PMOS.CUSTOMERS_SHEET}`);
  sortMaintenanceCustomersAlphabetically_(customersSheet);

  return {
    idsCreated,
    namesBackfilled,
    routeRowsUpdated,
    routeRowsRemoved,
    routeRowsCreated: creationResult.created,
    changedLayers: [...changedLayers]
  };
}

function backfillPmosCustomerNameColumns_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.CUSTOMERS_SHEET);
  if (!sheet) throw new Error(`Missing sheet: ${PMOS.CUSTOMERS_SHEET}`);
  let table = readPmosHeaderTable_(sheet);
  ensureMaintenanceClientHeaders_(sheet, table, ['First Name', 'Last Name']);
  table = readPmosHeaderTable_(sheet);

  const firstNameIndex = findHeaderIndex_(table.headers, ['First Name']);
  const lastNameIndex = findHeaderIndex_(table.headers, ['Last Name']);
  const calendarTitleIndex = findHeaderIndex_(table.headers, ['Calendar Title']);
  const fullNameIndex = findHeaderIndex_(table.headers, ['Full Name(s)', 'Full Name']);
  const bodyRows = Math.max(0, sheet.getLastRow() - table.headerRow);
  if (firstNameIndex < 0 || lastNameIndex < 0 || calendarTitleIndex < 0 || !bodyRows) {
    return 0;
  }

  const values = sheet.getRange(
    table.headerRow + 1,
    1,
    bodyRows,
    sheet.getLastColumn()
  ).getValues();
  let changed = 0;
  values.forEach(function(row) {
    const calendarTitle = String(row[calendarTitleIndex] || '').trim();
    if (!calendarTitle) return;
    const parsed = parsePmosCustomerNames_(
      calendarTitle,
      fullNameIndex >= 0 ? row[fullNameIndex] : ''
    );
    let rowChanged = false;
    if (!String(row[lastNameIndex] || '').trim() && parsed.lastName) {
      row[lastNameIndex] = parsed.lastName;
      rowChanged = true;
    }
    if (!String(row[firstNameIndex] || '').trim() && parsed.firstName) {
      row[firstNameIndex] = parsed.firstName;
      rowChanged = true;
    }
    if (rowChanged) changed++;
  });
  if (!changed) return 0;

  sheet.getRange(table.headerRow + 1, firstNameIndex + 1, bodyRows, 1)
    .setValues(values.map(function(row) { return [row[firstNameIndex]]; }));
  sheet.getRange(table.headerRow + 1, lastNameIndex + 1, bodyRows, 1)
    .setValues(values.map(function(row) { return [row[lastNameIndex]]; }));
  return changed;
}

function parsePmosCustomerNames_(calendarTitle, fullName) {
  const title = String(calendarTitle || '').trim();
  const full = String(fullName || '').trim();
  const qualifierMatch = title.match(/\s*\(([^()]*)\)\s*$/);
  const qualifier = qualifierMatch ? String(qualifierMatch[1] || '').trim() : '';
  const lastName = qualifierMatch
    ? title.slice(0, qualifierMatch.index).trim()
    : title;
  if (qualifier) return {firstName: qualifier, lastName: lastName};
  if (!full || !lastName) return {firstName: '', lastName: lastName};

  const escapedLastName = escapePmosNamePattern_(lastName);
  let firstName = full;
  const suffixPattern = new RegExp('\\s+' + escapedLastName + '\\s*$', 'i');
  const prefixPattern = new RegExp('^\\s*' + escapedLastName + '\\s*[,\\-–—:]\\s*', 'i');
  if (suffixPattern.test(firstName)) {
    firstName = firstName.replace(suffixPattern, '');
  } else if (prefixPattern.test(firstName)) {
    firstName = firstName.replace(prefixPattern, '');
  } else if (lastName.indexOf('/') >= 0) {
    lastName.split('/').map(function(value) { return value.trim(); }).filter(Boolean)
      .forEach(function(surname) {
        firstName = firstName.replace(
          new RegExp('(^|\\s)' + escapePmosNamePattern_(surname) + '(?=\\s|$)', 'ig'),
          '$1'
        );
      });
  }
  firstName = firstName
    .replace(/\s*[/,;:\-–—]+\s*$/g, '')
    .replace(/^\s*[/,;:\-–—]+\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalize_(firstName) === normalize_(full)) firstName = '';
  return {firstName: firstName, lastName: lastName};
}

function escapePmosNamePattern_(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readPmosCustomerSyncRouteTitle_(row, titleCol, mapLabelCol) {
  const title = titleCol >= 0 ? String(row[titleCol] || '').trim() : '';
  if (title) return title;
  const mapLabel = mapLabelCol >= 0 ? String(row[mapLabelCol] || '').trim() : '';
  return mapLabel.replace(/^\s*\d+\s*[\-\u2013\u2014]\s*/, '').trim();
}

function resolvePmosCustomerSyncRouteCustomer_(row, columns, lookup) {
  const source = columns || {};
  const routeId = source.idCol >= 0 ? String(row[source.idCol] || '').trim() : '';
  const routeTitle = readPmosCustomerSyncRouteTitle_(
    row,
    source.titleCol,
    source.mapLabelCol
  );
  const fullName = source.fullNameCol >= 0
    ? String(row[source.fullNameCol] || '').trim() : '';
  const address = source.addressCol >= 0
    ? String(row[source.addressCol] || '').trim() : '';
  return lookup.byId[routeId] ||
    lookup.byTitle[normalize_(routeTitle)] ||
    lookup.byFullName[normalize_(fullName)] ||
    lookup.byAddress[normalize_(address)] ||
    null;
}

/** Group route layers while preserving the human-defined order inside each layer. */
function groupPmosRouteRowsByLayerPreservingOrder_() {
  const sheet = getRoutesSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 3) return false;
  const headers = values[0].map(function(value) { return String(value).trim(); });
  const layerCol = headers.indexOf('Layer');
  if (layerCol < 0) return false;

  const layerOrder = [];
  const groups = {};
  const unlayered = [];
  values.slice(1).forEach(function(row) {
    const layer = String(row[layerCol] || '').trim();
    if (!layer) {
      unlayered.push(row);
      return;
    }
    if (!groups[layer]) {
      groups[layer] = [];
      layerOrder.push(layer);
    }
    groups[layer].push(row);
  });
  const grouped = [];
  layerOrder.forEach(function(layer) {
    Array.prototype.push.apply(grouped, groups[layer]);
  });
  Array.prototype.push.apply(grouped, unlayered);

  const before = JSON.stringify(values.slice(1));
  const after = JSON.stringify(grouped);
  if (before === after) return false;
  sheet.getRange(2, 1, grouped.length, headers.length).setValues(grouped);
  return true;
}

function ensureCustomerIds_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.CUSTOMERS_SHEET);
  if (!sheet) throw new Error(`Missing sheet: ${PMOS.CUSTOMERS_SHEET}`);

  const values = sheet.getDataRange().getValues();
  if (!values.length) return 0;

  const headers = values[0].map(v => String(v).trim());
  let idCol = headers.indexOf('Customer ID');

  if (idCol < 0) {
    sheet.insertColumnBefore(1);
    sheet.getRange(1, 1).setValue('Customer ID');
    return ensureCustomerIds_();
  }

  const titleCol = headers.indexOf('Calendar Title');
  const fullNameCol = headers.indexOf('Full Name(s)');
  const existing = new Set();
  let maxNumber = 0;

  values.slice(1).forEach(row => {
    const id = String(row[idCol] || '').trim();
    if (!id) return;
    existing.add(id);
    const match = id.match(/(\d+)$/);
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
  });

  const updates = [];
  let created = 0;

  for (let index = 1; index < values.length; index++) {
    const hasCustomer =
      String(values[index][titleCol] || '').trim() ||
      String(values[index][fullNameCol] || '').trim();

    const currentId = String(values[index][idCol] || '').trim();

    const id = (() => {
      if (!hasCustomer || currentId) {
        return currentId;
      }

      let generatedId;

      do {
        maxNumber++;
        generatedId = `PMOS-${String(maxNumber).padStart(5, '0')}`;
      } while (existing.has(generatedId));

      existing.add(generatedId);
      created++;

      return generatedId;
    })();

    updates.push([id]);
  }

  if (updates.length) {
    sheet.getRange(2, idCol + 1, updates.length, 1).setValues(updates);
  }

  return created;
}

function ensureRouteCustomerIdColumn_() {
  const sheet = getRoutesSheet_();
  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0].map(v => String(v).trim());

  let titleCol = headers.indexOf('Calendar Title');
  if (titleCol < 0) {
    const mapLabelCol = headers.indexOf('Map Label');
    const insertAfter = mapLabelCol >= 0 ? mapLabelCol + 1 : sheet.getLastColumn();
    sheet.insertColumnAfter(insertAfter);
    sheet.getRange(1, insertAfter + 1).setValue('Calendar Title');
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0].map(v => String(v).trim());
    titleCol = headers.indexOf('Calendar Title');
  }

  if (!headers.includes('Customer ID')) {
    sheet.insertColumnAfter(titleCol + 1);
    sheet.getRange(1, titleCol + 2).setValue('Customer ID');
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0].map(v => String(v).trim());
  }

  if (!headers.includes('Status')) {
    sheet.insertColumnAfter(sheet.getLastColumn());
    sheet.getRange(1, sheet.getLastColumn()).setValue('Status');
  }
}

function getCustomerLookup_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.CUSTOMERS_SHEET);
  if (!sheet) throw new Error(`Missing sheet: ${PMOS.CUSTOMERS_SHEET}`);

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(v => String(v).trim());
  const list = [];
  const byId = {};
  const byTitle = {};
  const byFullName = {};
  const byAddress = {};

  values.slice(1)
    .filter(row => row.some(value => value !== '' && value != null))
    .forEach(row => {
      const customer = {};
      headers.forEach((header, index) => customer[header] = row[index]);

      const id = String(customer['Customer ID'] || '').trim();
      const title = String(customer['Calendar Title'] || '').trim();

      if (!title && !customer['Full Name(s)']) return;

      list.push(customer);
      if (id) byId[id] = customer;
      if (title) byTitle[normalize_(title)] = customer;
      indexUniquePmosCustomerSyncValue_(
        byFullName,
        customer['Full Name(s)'],
        customer
      );
      indexUniquePmosCustomerSyncValue_(
        byAddress,
        customer['Full Address'],
        customer
      );
    });

  const routeCustomerIds = new Set(
    readRouteCustomerIdsWithoutCustomerLookup_()
  );

  return { list, byId, byTitle, byFullName, byAddress, routeCustomerIds };
}

function indexUniquePmosCustomerSyncValue_(index, value, customer) {
  const key = normalize_(value);
  if (!key) return;
  if (!Object.prototype.hasOwnProperty.call(index, key)) {
    index[key] = customer;
    return;
  }
  // Null marks an ambiguous exact value so it can never be used to guess.
  index[key] = null;
}

function readRouteCustomerIdsWithoutCustomerLookup_() {
  const sheet = getRoutesSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(v => String(v).trim());
  const idCol = headers.indexOf('Customer ID');

  if (idCol < 0) return [];

  return values.slice(1)
    .map(row => String(row[idCol] || '').trim())
    .filter(Boolean);
}

function createMissingRouteRowsFromCustomers_(customers, routeCustomerIds) {
  const sheet = getRoutesSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0].map(v => String(v).trim());

  const existingLayers = [...new Set(
    sheet.getDataRange().getValues().slice(1)
      .map(row => String(row[headers.indexOf('Layer')] || '').trim())
      .filter(Boolean)
  )];

  const newRows = [];
  const changedLayers = new Set();

  customers.forEach(customer => {
    const id = String(customer['Customer ID'] || '').trim();
    if (!id || routeCustomerIds.has(id)) return;

    const days = parseCustomerDays_(customer['Route Day(s)']);
    const weeks = parseCustomerWeeks_(
      customer['Rotation Week(s)'],
      customer['Frequency']
    );

    if (!days.length || !weeks.length) return;

    weeks.forEach(week => {
      days.forEach(day => {
        const matches = existingLayers.filter(layer => {
          const parsed = parseLayer_(layer);
          return parsed.week === week && parsed.day === day;
        });

        if (matches.length !== 1) return;

        const row = new Array(headers.length).fill('');
        setByHeader_(row, headers, 'Layer', matches[0]);
        setByHeader_(row, headers, 'Customer ID', id);
        setByHeader_(row, headers, 'Calendar Title', customer['Calendar Title']);
        setByHeader_(row, headers, 'Full Name(s)', customer['Full Name(s)']);
        setByHeader_(row, headers, 'Full Address', customer['Full Address']);
        setByHeader_(row, headers, 'Frequency', customer['Frequency']);
        setByHeader_(row, headers, 'Color Category', customer['Frequency']);
        setByHeader_(row, headers, 'Entry Information', buildCustomerEntryInformation_(customer));
        setByHeader_(row, headers, 'Customer Notes', customer['Customer Notes']);

        newRows.push(row);
        changedLayers.add(matches[0]);
      });
    });
  });

  if (newRows.length) {
    sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      newRows.length,
      headers.length
    ).setValues(newRows);
  }

  return { created: newRows.length, changedLayers: [...changedLayers] };
}

function parseCustomerDays_(value) {
  const valid = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return valid.filter(day =>
    String(value || '').toLowerCase().includes(day.toLowerCase())
  );
}

function parseCustomerWeeks_(value, frequency) {
  const text = String(value || '').trim();
  const explicit = [...text.matchAll(/[1-4]/g)].map(match => Number(match[0]));

  if (explicit.length) return [...new Set(explicit)];

  const normalizedFrequency = normalize_(frequency);

  if (normalizedFrequency.includes('weekly')) return [1, 2, 3, 4];
  if (normalizedFrequency.includes('monthly') || normalizedFrequency.includes('4 week')) return [1];

  return [];
}

function buildCustomerEntryInformation_(customer) {
  const lines = [];

  if (customer['Entry Information']) lines.push(String(customer['Entry Information']));
  if (customer['Gate Code']) lines.push(`Gate code: ${customer['Gate Code']}`);
  if (customer['Lockbox Code']) lines.push(`Lockbox code: ${customer['Lockbox Code']}`);
  if (customer['Lockbox Location']) lines.push(`Lockbox: ${customer['Lockbox Location']}`);
  if (customer['Entry Notes']) lines.push(String(customer['Entry Notes']));

  return lines.join('\n').trim();
}
