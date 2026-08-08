/**
 * PMOS route planning, pending changes, maps, and route-domain operations.
 * Spreadsheet data is authoritative; this module does not mutate Calendar.
 */
function refreshRouteNumbers() {
  ensureSupportSheets_();
  const result = normalizeRoutesFromPhysicalOrder_(true);
  SpreadsheetApp.getUi().alert(
    'Routes refreshed',
    [
      result.updatedRows + ' row(s) renumbered or relabelled.',
      result.changedLayers.length + ' route layer(s) marked as pending.'
    ].join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function normalizeRoutesFromPhysicalOrder_(markPending) {
  const sheet = getRoutesSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return {updatedRows: 0, changedLayers: []};

  const headers = values[0].map(function (value) { return String(value).trim(); });
  const layerCol = headers.indexOf('Layer');
  const orderCol = headers.indexOf('Stop Order');
  const mapLabelCol = headers.indexOf('Map Label');
  const titleCol = headers.indexOf('Calendar Title');
  const idCol = headers.indexOf('Customer ID');

  if (layerCol < 0 || orderCol < 0 || mapLabelCol < 0 || titleCol < 0) {
    throw new Error('Route sheet needs Layer, Stop Order, Map Label, and Calendar Title columns.');
  }

  const previousSignatures = getStoredRouteSignatures_();
  const counters = {};
  const rowsByLayer = {};
  const orderUpdates = [];
  const mapUpdates = [];
  let updatedRows = 0;

  for (let index = 1; index < values.length; index++) {
    const layer = String(values[index][layerCol] || '').trim();
    const title = String(values[index][titleCol] || '').trim();
    if (!layer || !title) {
      orderUpdates.push([values[index][orderCol]]);
      mapUpdates.push([values[index][mapLabelCol]]);
      continue;
    }

    counters[layer] = (counters[layer] || 0) + 1;
    const order = counters[layer];
    const mapLabel = String(order).padStart(2, '0') + ' - ' + title;
    const key = idCol >= 0 && String(values[index][idCol] || '').trim()
      ? String(values[index][idCol]).trim()
      : title;

    if (!rowsByLayer[layer]) rowsByLayer[layer] = [];
    rowsByLayer[layer].push(key);
    if (Number(values[index][orderCol]) !== order || String(values[index][mapLabelCol]) !== mapLabel) {
      updatedRows++;
    }
    orderUpdates.push([order]);
    mapUpdates.push([mapLabel]);
  }

  if (orderUpdates.length) {
    sheet.getRange(2, orderCol + 1, orderUpdates.length, 1).setValues(orderUpdates);
    sheet.getRange(2, mapLabelCol + 1, mapUpdates.length, 1).setValues(mapUpdates);
  }

  const currentSignatures = {};
  Object.keys(rowsByLayer).forEach(function (layer) {
    currentSignatures[layer] = JSON.stringify(rowsByLayer[layer]);
  });
  const changedLayers = Object.keys(currentSignatures).filter(function (layer) {
    return previousSignatures[layer] != null &&
      previousSignatures[layer] !== currentSignatures[layer];
  });

  if (markPending && changedLayers.length) {
    saveRouteVersion_('Before spreadsheet route edit', snapshotRoutes_());
    changedLayers.forEach(function (layer) {
      addPendingChange_(layer, 0, 'Spreadsheet edit');
    });
    updateSyncStatus_(
      'Route changes pending',
      changedLayers.length + ' route layer(s) changed. Run Calendar Plan Audit when ready.'
    );
  }

  PropertiesService.getDocumentProperties()
    .setProperty('PMOS_ROUTE_SIGNATURES', JSON.stringify(currentSignatures));
  return {updatedRows: updatedRows, changedLayers: changedLayers};
}

function resetRouteBaseline() {
  normalizeRoutesFromPhysicalOrder_(false);
  storeRouteSignatures_();
  clearPendingChanges_();
  updateSyncStatus_('Everything synchronized', 'Route baseline reset.');
  SpreadsheetApp.getUi().alert('PMOS route baseline has been reset.');
}

function storeRouteSignatures_() {
  const signatures = {};
  readRoutesInPhysicalOrder_().forEach(function (route) {
    if (!signatures[route.layer]) signatures[route.layer] = [];
    signatures[route.layer].push(route.key);
  });
  const serialized = {};
  Object.keys(signatures).forEach(function (layer) {
    serialized[layer] = JSON.stringify(signatures[layer]);
  });
  PropertiesService.getDocumentProperties()
    .setProperty('PMOS_ROUTE_SIGNATURES', JSON.stringify(serialized));
}

function getStoredRouteSignatures_() {
  try {
    return JSON.parse(
      PropertiesService.getDocumentProperties().getProperty('PMOS_ROUTE_SIGNATURES') || '{}'
    );
  } catch (error) {
    return {};
  }
}

function showRouteManagerLink() {
  const url = ScriptApp.getService().getUrl();
  if (!url) {
    SpreadsheetApp.getUi().alert(
      'Deploy the project as a web app first: Deploy → New deployment → Web app.'
    );
    return;
  }
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial;padding:16px">' +
      '<h3>PMOS Route Manager</h3>' +
      '<p><a href="' + url + '" target="_blank">Open Route Manager</a></p>' +
    '</div>'
  ).setWidth(360).setHeight(160);
  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Route Manager');
}

/** Compatibility entry: previewing route changes now opens the authoritative audit. */
function previewRouteChangesFromSheet() {
  return showFreshCalendarAuditTaskWindow();
}

/** Compatibility entry: direct application is retired; all Calendar work is reviewed. */
function applyCalendarChangesFromSheet() {
  return showFreshCalendarAuditTaskWindow();
}

function exportAffectedMapLayers() {
  const pending = getPendingChanges_();
  if (!Array.isArray(pending) || pending.length === 0) {
    throw new Error('No pending route changes.');
  }

  const parentFolderName = 'PMOS Map Exports';
  const existingParents = DriveApp.getFoldersByName(parentFolderName);
  const parentFolder = existingParents.hasNext()
    ? existingParents.next()
    : DriveApp.createFolder(parentFolderName);
  const timestamp = Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd HHmm');
  const exportFolder = parentFolder.createFolder('PMOS Map Export ' + timestamp);
  const headers = [
    'Layer', 'Stop Order', 'Map Label', 'Calendar Title', 'Full Name(s)',
    'Full Address', 'Frequency', 'Color Category', 'Entry Information',
    'Customer Notes'
  ];
  const exportedLayers = [];
  const exportedFiles = [];
  const processedLayers = {};

  pending.forEach(function (change) {
    const layer = String(change && change.layer || '').trim();
    if (!layer || processedLayers[layer]) return;
    processedLayers[layer] = true;
    const route = getRoute_(layer);
    const rows = [headers].concat(route.map(function (row) {
      return [
        row.layer,
        row.order,
        String(row.order).padStart(2, '0') + ' - ' + row.title,
        row.title,
        row.fullName,
        row.address,
        row.frequency,
        row.frequency,
        row.entry,
        row.notes
      ];
    }));
    const file = exportFolder.createFile(
      safeFilename_(layer) + '.csv',
      rows.map(csvRow_).join('\r\n'),
      MimeType.CSV
    );
    exportedLayers.push(layer);
    exportedFiles.push({name: file.getName(), url: file.getUrl()});
  });

  if (!exportedFiles.length) {
    exportFolder.setTrashed(true);
    throw new Error('No valid map layers were available to export.');
  }
  return {
    count: exportedFiles.length,
    folderName: exportFolder.getName(),
    folderUrl: exportFolder.getUrl(),
    parentFolderName: parentFolder.getName(),
    parentFolderUrl: parentFolder.getUrl(),
    exportedLayers: exportedLayers,
    exportedFiles: exportedFiles
  };
}

function getOrCreatePmosMapExportFolder_() {
  const folderName = 'PMOS Map Exports';
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

function getRouteManagerData() {
  ensureSupportSheets_();
  normalizeRoutesFromPhysicalOrder_(false);
  const routes = readRoutesInPhysicalOrder_();
  return {
    routeNames: Array.from(new Set(routes.map(function (route) { return route.layer; }))).sort(routeSort_),
    routes: routes,
    pending: getPendingChanges_(),
    versions: listRouteVersions_().slice(0, 25),
    settings: getSettings_()
  };
}

function saveRouteOrder(payload) {
  if (!payload || !payload.layer || !Array.isArray(payload.customerKeys)) {
    throw new Error('Invalid route update.');
  }
  ensureSupportSheets_();
  saveRouteVersion_('Before app route edit', snapshotRoutes_());

  const sheet = getRoutesSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (value) { return String(value).trim(); });
  const layerCol = headers.indexOf('Layer');
  const titleCol = headers.indexOf('Calendar Title');
  const idCol = headers.indexOf('Customer ID');
  const routeRows = [];

  values.slice(1).forEach(function (row) {
    if (String(row[layerCol] || '').trim() === payload.layer) routeRows.push(row);
  });

  const byKey = {};
  routeRows.forEach(function (row) {
    const title = String(row[titleCol] || '').trim();
    const id = idCol >= 0 ? String(row[idCol] || '').trim() : '';
    byKey[id || title] = row;
  });
  const orderedRows = payload.customerKeys
    .map(function (key) { return byKey[String(key)]; })
    .filter(Boolean);
  const firstRouteIndex = values.slice(1)
    .findIndex(function (row) { return String(row[layerCol] || '').trim() === payload.layer; });
  const body = values.slice(1).filter(function (row) {
    return String(row[layerCol] || '').trim() !== payload.layer;
  });
  body.splice(Math.max(firstRouteIndex, 0), 0, ...orderedRows);

  sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getLastColumn()).clearContent();
  if (body.length) sheet.getRange(2, 1, body.length, headers.length).setValues(body);
  normalizeRoutesFromPhysicalOrder_(false);
  addPendingChange_(payload.layer, orderedRows.length, 'App edit');
  storeRouteSignatures_();
  updateSyncStatus_('Route changes pending', payload.layer + ' changed in the app.');
  return {ok: true, route: getRoute_(payload.layer), pending: getPendingChanges_()};
}

/** Retired direct Calendar preview. Kept read-only for older web-app callers. */
function previewCalendarChanges() {
  return previewPmosCalendarChangesLegacyShape_();
}

/** Retired direct Calendar mutation. Calendar writes require Review Session approval. */
function applyCalendarChanges() {
  throw new Error(
    'Direct Calendar application has been retired. Run Calendar Plan Audit and approve Calendar Sync Preview.'
  );
}

function readRoutesInPhysicalOrder_() {
  ensureCustomerIds_();
  const routeSheet = getRoutesSheet_();
  const routeValues = routeSheet.getDataRange().getValues();
  const routeHeaders = routeValues[0].map(function (value) { return String(value).trim(); });
  const customers = getCustomerLookup_();

  return routeValues.slice(1)
    .filter(function (row) {
      return row.some(function (value) { return value !== '' && value != null; });
    })
    .map(function (row) {
      const obj = {};
      routeHeaders.forEach(function (header, index) { obj[header] = row[index]; });
      const routeTitle = String(obj['Calendar Title'] || '').trim();
      const routeId = String(obj['Customer ID'] || '').trim();
      const customer = customers.byId[routeId] ||
        customers.byTitle[normalize_(routeTitle)] || {};
      const customerId = String(customer['Customer ID'] || routeId).trim();
      const title = String(customer['Calendar Title'] || routeTitle).trim();
      return {
        key: customerId || title,
        customerId: customerId,
        layer: String(obj.Layer || '').trim(),
        order: Number(obj['Stop Order'] || 0),
        title: title,
        fullName: String(customer['Full Name(s)'] || obj['Full Name(s)'] || title),
        address: String(customer['Full Address'] || obj['Full Address'] || ''),
        frequency: String(customer.Frequency || obj.Frequency || ''),
        entry: buildCustomerEntryInformation_(customer) || String(obj['Entry Information'] || ''),
        notes: String(customer['Customer Notes'] || obj['Customer Notes'] || ''),
        phone: String(customer['Primary Phone'] || ''),
        secondaryPhone: String(customer['Secondary Phone'] || ''),
        email: String(customer.Email || ''),
        sanitization: String(customer['Sanitization Type(s)'] || ''),
        automation: String(customer.Automation || ''),
        yearRound: normalize_(customer['Year Round'] || customer.Season || '').includes('year round') ||
          normalize_(customer['Year Round'] || '') === 'yes'
      };
    })
    .filter(function (row) { return row.layer && row.title; });
}

function getRoute_(layer) {
  return readRoutesInPhysicalOrder_()
    .filter(function (row) { return row.layer === layer; })
    .sort(function (a, b) { return a.order - b.order; });
}

function getRoutesSheet_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.ROUTES_SHEET);
  if (!sheet) throw new Error('Missing sheet: ' + PMOS.ROUTES_SHEET);
  return sheet;
}

function addPendingChange_(layer, changedRows, source) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.PENDING_SHEET);
  const values = sheet.getDataRange().getValues();
  const existingIndex = values.slice(1).findIndex(function (row) {
    return String(row[0]) === layer;
  });
  if (existingIndex >= 0) {
    sheet.getRange(existingIndex + 2, 2, 1, 4)
      .setValues([[new Date(), changedRows, 'Pending', source || '']]);
  } else {
    sheet.appendRow([layer, new Date(), changedRows, 'Pending', source || '']);
  }
}

function getPendingChanges_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.PENDING_SHEET);
  return sheet.getDataRange().getValues().slice(1)
    .filter(function (row) { return String(row[3]) === 'Pending'; })
    .map(function (row) {
      return {
        layer: String(row[0]),
        changedAt: row[1] instanceof Date
          ? Utilities.formatDate(row[1], PMOS.TIMEZONE, 'yyyy-MM-dd h:mm a')
          : String(row[1]),
        changedRows: Number(row[2] || 0),
        source: String(row[4] || '')
      };
    });
}

function clearPendingChanges_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.PENDING_SHEET);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).clearContent();
  }
}

function updateSyncStatus_(status, details) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.STATUS_SHEET);
  if (!sheet) return;
  sheet.getRange('B2').setValue(status);
  sheet.getRange('C2').setValue(details);
  sheet.getRange('B2').setBackground(
    status === 'Everything synchronized' ? '#D9EAD3' :
    status === 'Route changes pending' ? '#FFF2CC' : '#F4CCCC'
  );
}

function getSettings_() {
  const defaults = {
    calendarName: PMOS.CALENDAR_NAME,
    calendarYear: 2026,
    routeStart: '6:00 AM',
    eventDurationMinutes: 60
  };
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.SETTINGS_SHEET);
  if (!sheet) return defaults;
  const values = sheet.getDataRange().getValues();
  const map = {};
  values.slice(1).forEach(function (row) { map[String(row[0]).trim()] = row[1]; });
  return {
    calendarName: String(map['Calendar Name'] || defaults.calendarName),
    calendarYear: Number(map['Calendar Year'] || defaults.calendarYear),
    routeStart: String(map['Daily Route Start'] || defaults.routeStart),
    eventDurationMinutes: Number(map['Event Duration Minutes'] || defaults.eventDurationMinutes)
  };
}

function getCalendar_() {
  const settings = getSettings_();
  const matches = CalendarApp.getCalendarsByName(settings.calendarName);
  if (!matches.length) throw new Error('Calendar not found: ' + settings.calendarName);
  return matches[0];
}

/** Read-only diagnostic retained for route-vs-calendar inspection. */
function auditCalendarAgainstRoutes_(markPending) {
  const calendar = getCalendar_();
  const settings = getSettings_();
  const year = Number(settings.calendarYear || 2026);
  const events = calendar.getEvents(new Date(year, 0, 1), new Date(year + 1, 0, 1));
  const layers = Array.from(new Set(readRoutesInPhysicalOrder_().map(function (row) { return row.layer; })));
  const mismatched = [];

  layers.forEach(function (layer) {
    const parsed = parseLayer_(layer);
    const route = getRoute_(layer);
    const routeEvents = events.filter(function (event) { return eventMatchesRoute_(event, parsed); });
    const dates = uniqueRouteDates_(routeEvents);
    let mismatch = false;
    dates.forEach(function (date) {
      const dayEvents = routeEvents.filter(function (event) {
        return sameLocalDate_(event.getStartTime(), date);
      });
      route.forEach(function (row) {
        const event = dayEvents.find(function (item) {
          return normalize_(item.getTitle()) === normalize_(row.title);
        });
        if (!event) { mismatch = true; return; }
        const expectedStart = routeTimeForOrder_(date, row.order, settings);
        if (event.getStartTime().getTime() !== expectedStart.getTime()) mismatch = true;
        if (String(event.getLocation() || '').trim() !== String(row.address || '').trim()) mismatch = true;
      });
      dayEvents.forEach(function (event) {
        if (!route.some(function (row) {
          return normalize_(row.title) === normalize_(event.getTitle());
        })) mismatch = true;
      });
    });
    if (routeEvents.length && !dates.length) mismatch = true;
    if (mismatch) {
      mismatched.push(layer);
      if (markPending) addPendingChange_(layer, 0, 'Calendar audit');
    }
  });

  if (markPending && mismatched.length) {
    updateSyncStatus_(
      'Route changes pending',
      mismatched.length + ' route layer(s) differ from Calendar.'
    );
  }
  return mismatched;
}

function uniqueRouteDates_(events) {
  const seen = {};
  events.forEach(function (event) {
    const date = event.getStartTime();
    const key = Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd');
    if (!seen[key]) seen[key] = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  });
  return Object.keys(seen).sort().map(function (key) { return seen[key]; });
}

function buildRouteDescription_(row, parsed) {
  const parts = [];
  if (row.customerId) parts.push('PMOS_CUSTOMER_ID=' + row.customerId);
  if (row.fullName) parts.push(row.fullName);
  if (row.entry) parts.push('', 'ENTRY', row.entry);
  parts.push('', parsed.day + ' • Rotation Week ' + parsed.week);
  if (row.frequency) parts.push(row.frequency);
  if (row.phone) parts.push('', 'PHONE: ' + row.phone);
  if (row.notes) parts.push('', 'NOTES', row.notes);
  return parts.join('\n').trim();
}

function eventMatchesRoute_(event, parsed) {
  const description = normalize_(event.getDescription());
  const day = Utilities.formatDate(event.getStartTime(), PMOS.TIMEZONE, 'EEEE');
  return day === parsed.day && description.includes('rotation week ' + parsed.week);
}

function routeTimeForOrder_(eventDate, order, settings) {
  if (!(eventDate instanceof Date) || !Number.isFinite(eventDate.getTime())) {
    throw new Error('Invalid route date: ' + eventDate);
  }
  const time = parseFlexibleRouteTime_(settings.routeStart);
  const result = new Date(eventDate.getTime());
  result.setHours(time.hours, time.minutes, 0, 0);
  const safeOrder = positiveNumberOrDefault_(order, 1);
  for (let index = 1; index < safeOrder; index++) {
    result.setMinutes(result.getMinutes() + (index % 2 === 1 ? 45 : 60));
  }
  if (!Number.isFinite(result.getTime())) {
    throw new Error(
      'Could not calculate a valid start time from ' + eventDate +
      ', order ' + order + ', and route start ' + settings.routeStart + '.'
    );
  }
  return result;
}
