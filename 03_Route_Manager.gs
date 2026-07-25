/**
 * PMOS v1.9.0 — Route planning, pending changes, maps, and route-domain operations.
 * Move-only refactor: public names and operational behavior are preserved.
 */

function refreshRouteNumbers() {
  ensureSupportSheets_();
  const result = normalizeRoutesFromPhysicalOrder_(true);


  SpreadsheetApp.getUi().alert(
    'Routes refreshed',
    [
      `${result.updatedRows} row(s) renumbered or relabelled.`,
      `${result.changedLayers.length} route layer(s) marked as pending.`
    ].join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function normalizeRoutesFromPhysicalOrder_(markPending) {
  const sheet = getRoutesSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { updatedRows: 0, changedLayers: [] };


  const headers = values[0].map(v => String(v).trim());
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


  for (let i = 1; i < values.length; i++) {
    const layer = String(values[i][layerCol] || '').trim();
    const title = String(values[i][titleCol] || '').trim();


    if (!layer || !title) {
      orderUpdates.push([values[i][orderCol]]);
      mapUpdates.push([values[i][mapLabelCol]]);
      continue;
    }


    counters[layer] = (counters[layer] || 0) + 1;
    const order = counters[layer];
    const mapLabel = `${String(order).padStart(2, '0')} - ${title}`;
    const key = idCol >= 0 && String(values[i][idCol] || '').trim()
      ? String(values[i][idCol]).trim()
      : title;


    if (!rowsByLayer[layer]) rowsByLayer[layer] = [];
    rowsByLayer[layer].push(key);


    if (Number(values[i][orderCol]) !== order || String(values[i][mapLabelCol]) !== mapLabel) {
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
  Object.keys(rowsByLayer).forEach(layer => {
    currentSignatures[layer] = JSON.stringify(rowsByLayer[layer]);
  });


  const changedLayers = Object.keys(currentSignatures).filter(layer =>
    previousSignatures[layer] != null &&
    previousSignatures[layer] !== currentSignatures[layer]
  );


  if (markPending && changedLayers.length) {
    saveRouteVersion_('Before spreadsheet route edit', snapshotRoutes_());


    changedLayers.forEach(layer => {
      addPendingChange_(layer, 0, 'Spreadsheet edit');
    });


    updateSyncStatus_(
      'Route changes pending',
      `${changedLayers.length} route layer(s) changed. Preview and apply when ready.`
    );
  }


  PropertiesService.getDocumentProperties()
    .setProperty('PMOS_ROUTE_SIGNATURES', JSON.stringify(currentSignatures));


  return { updatedRows, changedLayers };
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
  readRoutesInPhysicalOrder_().forEach(route => {
    if (!signatures[route.layer]) signatures[route.layer] = [];
    signatures[route.layer].push(route.key);
  });


  PropertiesService.getDocumentProperties()
    .setProperty('PMOS_ROUTE_SIGNATURES', JSON.stringify(
      Object.fromEntries(Object.entries(signatures).map(([layer, keys]) => [layer, JSON.stringify(keys)]))
    ));
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
    `<div style="font-family:Arial;padding:16px">
      <h3>PMOS Route Manager</h3>
      <p><a href="${url}" target="_blank">Open Route Manager</a></p>
    </div>`
  ).setWidth(360).setHeight(160);


  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Route Manager');
}

function previewRouteChangesFromSheet() {
  const result = previewCalendarChanges();
  const details = result.details.length
    ? result.details.map(d => `${d.action}: ${d.layer} — ${d.title}`).join('\n')
    : 'No recurring-series changes are required.';


  SpreadsheetApp.getUi().alert(
    'PMOS Calendar preview',
    [
      `Calendar: ${result.calendarName}`,
      `${result.totalSeries} recurring series are expected.`,
      `${result.creates} to create`,
      `${result.updates} to update`,
      `${result.deletes} to remove`,
      '',
      details
    ].join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function applyCalendarChangesFromSheet() {
  const audit = runCalendarPlanAudit_();


  if (!audit.canSync) {
    showCalendarPlanAudit();
    return;
  }


  showPmosJobEngineFor_('CALENDAR_SYNC');
}

function exportAffectedMapLayers() {
  const pending = getPendingChanges_();

  if (!Array.isArray(pending) || pending.length === 0) {
    throw new Error('No pending route changes.');
  }

  // Create or locate the permanent parent folder once.
  const parentFolderName = 'PMOS Map Exports';
  const existingParents = DriveApp.getFoldersByName(parentFolderName);

  const parentFolder = existingParents.hasNext()
    ? existingParents.next()
    : DriveApp.createFolder(parentFolderName);

  // Create one timestamped folder for this entire export run.
  const timestamp = Utilities.formatDate(
    new Date(),
    PMOS.TIMEZONE,
    'yyyy-MM-dd HHmm'
  );

  const exportFolderName = `PMOS Map Export ${timestamp}`;
  const exportFolder = parentFolder.createFolder(exportFolderName);

  const headers = [
    'Layer',
    'Stop Order',
    'Map Label',
    'Calendar Title',
    'Full Name(s)',
    'Full Address',
    'Frequency',
    'Color Category',
    'Entry Information',
    'Customer Notes'
  ];

  const exportedLayers = [];
  const exportedFiles = [];
  const processedLayers = new Set();

  pending.forEach(change => {
    const layer = String(change && change.layer || '').trim();

    // Prevent duplicate files when the pending list contains
    // more than one change record for the same layer.
    if (!layer || processedLayers.has(layer)) {
      return;
    }

    processedLayers.add(layer);

    const route = getRoute_(layer);

    const rows = [headers].concat(
      route.map(row => [
        row.layer,
        row.order,
        `${String(row.order).padStart(2, '0')} - ${row.title}`,
        row.title,
        row.fullName,
        row.address,
        row.frequency,
        row.frequency,
        row.entry,
        row.notes
      ])
    );

    const fileName = `${safeFilename_(layer)}.csv`;

    const file = exportFolder.createFile(
      fileName,
      rows.map(csvRow_).join('\r\n'),
      MimeType.CSV
    );

    exportedLayers.push(layer);
    exportedFiles.push({
      name: file.getName(),
      url: file.getUrl()
    });
  });

  if (exportedFiles.length === 0) {
    exportFolder.setTrashed(true);
    throw new Error('No valid map layers were available to export.');
  }

  return {
    count: exportedFiles.length,
    folderName: exportFolder.getName(),
    folderUrl: exportFolder.getUrl(),
    parentFolderName: parentFolder.getName(),
    parentFolderUrl: parentFolder.getUrl(),
    exportedLayers,
    exportedFiles
  };
}


function getOrCreatePmosMapExportFolder_() {
  const folderName = 'PMOS Map Exports';
  const folders = DriveApp.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(folderName);
}

function getRouteManagerData() {
  ensureSupportSheets_();
  normalizeRoutesFromPhysicalOrder_(false);


  const routes = readRoutesInPhysicalOrder_();
  const routeNames = [...new Set(routes.map(r => r.layer))].sort(routeSort_);


  return {
    routeNames,
    routes,
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
  const headers = values[0].map(v => String(v).trim());


  const layerCol = headers.indexOf('Layer');
  const titleCol = headers.indexOf('Calendar Title');
  const idCol = headers.indexOf('Customer ID');


  const routeRows = [];
  const otherRows = [];


  values.slice(1).forEach(row => {
    const layer = String(row[layerCol] || '').trim();
    if (layer === payload.layer) routeRows.push(row);
    else otherRows.push(row);
  });


  const byKey = {};
  routeRows.forEach(row => {
    const title = String(row[titleCol] || '').trim();
    const id = idCol >= 0 ? String(row[idCol] || '').trim() : '';
    byKey[id || title] = row;
  });


  const orderedRows = payload.customerKeys
    .map(key => byKey[String(key)])
    .filter(Boolean);


  const firstRouteIndex = values.slice(1)
    .findIndex(row => String(row[layerCol] || '').trim() === payload.layer);


  const body = values.slice(1).filter(row => String(row[layerCol] || '').trim() !== payload.layer);
  body.splice(Math.max(firstRouteIndex, 0), 0, ...orderedRows);


  sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getLastColumn()).clearContent();


  if (body.length) {
    sheet.getRange(2, 1, body.length, headers.length).setValues(body);
  }


  normalizeRoutesFromPhysicalOrder_(false);
  addPendingChange_(payload.layer, orderedRows.length, 'App edit');
  storeRouteSignatures_();
  updateSyncStatus_('Route changes pending', `${payload.layer} changed in the app.`);


  return {
    ok: true,
    route: getRoute_(payload.layer),
    pending: getPendingChanges_()
  };
}

function previewCalendarChanges() {
  ensureSupportSheets_();
  synchronizeCustomerDatabase_(true);
  ensureRecurringSeriesRegistry_();


  const calendar = getRecurringCalendar_();
  const plan = buildRecurringSeriesPlan_();
  const registry = getSeriesRegistry_();
  const actions = compareSeriesPlanToRegistry_(plan, registry, calendar);


  return {
    calendarName: calendar.getName(),
    totalSeries: plan.length,
    creates: actions.filter(a => a.action === 'CREATE').length,
    updates: actions.filter(a => a.action === 'UPDATE').length,
    deletes: actions.filter(a => a.action === 'DELETE').length,
    affectedRoutes: [...new Set(actions.map(a => a.layer).filter(Boolean))].length,
    affectedEvents: actions.length,
    details: actions.slice(0, 30)
  };
}

function updatePmosLiveProgress_(
  baseProcessed,
  processedThisBatch,
  remaining,
  summary
) {
  const state = readPmosJobState_();

  if (!state) {
    return;
  }

  state.status = 'Running';

  state.processedItems =
    Number(baseProcessed || 0) +
    Number(processedThisBatch || 0);

  state.remaining = Math.max(
    0,
    Number(remaining || 0)
  );

  state.originalTotal = Math.max(
    Number(state.originalTotal || 0),
    state.processedItems + state.remaining
  );

  state.lastSummary = String(summary || '');
  state.lastError = '';

  writePmosJobState_(state);
}


function applyCalendarChanges() {
  const audit = runCalendarPlanAudit_();

  if (!audit.canSync) {
    throw new Error(
      `Calendar Plan Audit failed with ${audit.errorCount} blocking error(s).`
    );
  }

  ensureSupportSheets_();
  synchronizeCustomerDatabase_(true);
  ensureRecurringSeriesRegistry_();

  const calendar = getRecurringCalendar_();
  const plan = buildRecurringSeriesPlan_();
  const registry = getSeriesRegistry_();

  const actions = compareSeriesPlanToRegistry_(
    plan,
    registry,
    calendar
  );

  const batch = actions.slice(0, 40);

  let created = 0;
  let updated = 0;
  let deleted = 0;
  let errors = 0;
  let firstError = '';

  const liveJobState = readPmosJobState_();

  const baseProcessed = liveJobState
    ? Number(liveJobState.processedItems || 0)
    : 0;

  const totalAtBatchStart = actions.length;

  batch.forEach(function (item, index) {
    try {
      if (item.action === 'CREATE') {
        const createdSeries = createRecurringSeries_(
          calendar,
          item.plan
        );

        upsertSeriesRegistry_(
          item.plan,
          createdSeries.getId(),
          calendar.getName(),
          'Active'
        );

        created++;

      } else if (item.action === 'UPDATE') {
        let workingSeries = item.series;

        if (!workingSeries) {
          workingSeries = createRecurringSeries_(
            calendar,
            item.plan
          );

          created++;

        } else {
          updateRecurringSeries_(
            workingSeries,
            item.plan
          );

          updated++;
        }

        upsertSeriesRegistry_(
          item.plan,
          workingSeries.getId(),
          calendar.getName(),
          'Active'
        );

      } else if (item.action === 'DELETE') {
        if (item.series) {
          item.series.deleteEventSeries();
        }

        deleteSeriesRegistryRow_(
          item.seriesKey
        );

        deleted++;
      }

    } catch (error) {
      errors++;

      const message =
        `${item.action} ${item.seriesKey}: ${error}`;

      if (!firstError) {
        firstError = message;
      }

      console.error(message);

      markSeriesRegistryError_(
        item.seriesKey,
        String(error)
      );
    }

    const attemptedThisBatch = index + 1;

    const successfulThisBatch =
      created +
      updated +
      deleted;

    const liveRemaining =
      Math.max(
        0,
        totalAtBatchStart - attemptedThisBatch
      ) +
      errors;

    const shouldPublishProgress =
      attemptedThisBatch % 5 === 0 ||
      attemptedThisBatch === batch.length;

    if (shouldPublishProgress) {
      updatePmosLiveProgress_(
        baseProcessed,
        successfulThisBatch,
        liveRemaining,
        'Calendar Sync: ' +
          attemptedThisBatch +
          ' of ' +
          batch.length +
          ' items processed in this batch. ' +
          created +
          ' created, ' +
          updated +
          ' updated, ' +
          deleted +
          ' removed.'
      );
    }
  });

  const remaining =
    Math.max(
      0,
      actions.length - batch.length
    ) +
    errors;

  if (!remaining) {
    clearPendingChanges_();
    storeRouteSignatures_();

    updateSyncStatus_(
      'Everything synchronized',
      `${plan.length} Calendar series are current.`
    );

  } else if (errors) {
    updateSyncStatus_(
      'Synchronization error',
      firstError ||
        `${errors} recurring-series error(s).`
    );

  } else {
    updateSyncStatus_(
      'Synchronization in progress',
      `${remaining} recurring-series change(s) remain.`
    );
  }

  return {
    created: created,
    updated: updated,
    deleted: deleted,
    errors: errors,
    firstError: firstError,
    remaining: remaining,
    calendarName: calendar.getName()
  };
}

  function exportAffectedMapLayers() {
    const pending = getPendingChanges_();
    if (!pending.length) throw new Error('No pending route changes.');


  const folder = DriveApp.createFolder(
    `PMOS Updated Map Layers ${Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd HHmm')}`
  );


  pending.forEach(change => {
    const route = getRoute_(change.layer);
    const headers = [
      'Layer', 'Stop Order', 'Map Label', 'Calendar Title', 'Full Name(s)',
      'Full Address', 'Frequency', 'Color Category',
      'Entry Information', 'Customer Notes'
    ];


    const rows = [headers].concat(route.map(row => [
      row.layer,
      row.order,
      `${String(row.order).padStart(2, '0')} - ${row.title}`,
      row.title,
      row.fullName,
      row.address,
      row.frequency,
      row.frequency,
      row.entry,
      row.notes
    ]));


    folder.createFile(
      safeFilename_(change.layer) + '.csv',
      rows.map(csvRow_).join('\r\n'),
      MimeType.CSV
    );
  });


  return { folderName: folder.getName(), folderUrl: folder.getUrl(), count: pending.length };
}

function readRoutesInPhysicalOrder_() {
  ensureCustomerIds_();


  const routeSheet = getRoutesSheet_();
  const routeValues = routeSheet.getDataRange().getValues();
  const routeHeaders = routeValues[0].map(v => String(v).trim());
  const customers = getCustomerLookup_();


  return routeValues.slice(1)
    .filter(row => row.some(value => value !== '' && value != null))
    .map(row => {
      const obj = {};
      routeHeaders.forEach((header, index) => obj[header] = row[index]);


      const routeTitle = String(obj['Calendar Title'] || '').trim();
      const routeId = String(obj['Customer ID'] || '').trim();
      const customer = customers.byId[routeId] ||
        customers.byTitle[normalize_(routeTitle)] ||
        {};


      const customerId = String(customer['Customer ID'] || routeId).trim();
      const title = String(customer['Calendar Title'] || routeTitle).trim();


      return {
        key: customerId || title,
        customerId,
        layer: String(obj['Layer'] || '').trim(),
        order: Number(obj['Stop Order'] || 0),
        title,
        fullName: String(customer['Full Name(s)'] || obj['Full Name(s)'] || title),
        address: String(customer['Full Address'] || obj['Full Address'] || ''),
        frequency: String(customer['Frequency'] || obj['Frequency'] || ''),
        entry: buildCustomerEntryInformation_(customer) ||
          String(obj['Entry Information'] || ''),
        notes: String(customer['Customer Notes'] || obj['Customer Notes'] || ''),
        phone: String(customer['Primary Phone'] || ''),
        secondaryPhone: String(customer['Secondary Phone'] || ''),
        email: String(customer['Email'] || ''),
        sanitization: String(customer['Sanitization Type(s)'] || ''),
        automation: String(customer['Automation'] || ''),
        yearRound: normalize_(customer['Year Round'] || customer['Season'] || '').includes('year round') || normalize_(customer['Year Round'] || '') === 'yes'
      };
    })
    .filter(row => row.layer && row.title);
}

function getRoute_(layer) {
  return readRoutesInPhysicalOrder_()
    .filter(row => row.layer === layer)
    .sort((a, b) => a.order - b.order);
}

function getRoutesSheet_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.ROUTES_SHEET);
  if (!sheet) throw new Error(`Missing sheet: ${PMOS.ROUTES_SHEET}`);
  return sheet;
}

function addPendingChange_(layer, changedRows, source) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.PENDING_SHEET);
  const values = sheet.getDataRange().getValues();
  const existingIndex = values.slice(1).findIndex(row => String(row[0]) === layer);


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
    .filter(row => String(row[3]) === 'Pending')
    .map(row => ({
      layer: String(row[0]),
      changedAt: row[1] instanceof Date
        ? Utilities.formatDate(row[1], PMOS.TIMEZONE, 'yyyy-MM-dd h:mm a')
        : String(row[1]),
      changedRows: Number(row[2] || 0),
      source: String(row[4] || '')
    }));
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
  values.slice(1).forEach(row => map[String(row[0]).trim()] = row[1]);


  return {
    calendarName: String(map['Calendar Name'] || defaults.calendarName),
    calendarYear: Number(map['Calendar Year'] || defaults.calendarYear),
    routeStart: String(map['Daily Route Start'] || defaults.routeStart),
    eventDurationMinutes: Number(
      map['Event Duration Minutes'] || defaults.eventDurationMinutes
    )
  };
}

function getCalendar_() {
  const settings = getSettings_();
  const matches = CalendarApp.getCalendarsByName(settings.calendarName);
  if (!matches.length) throw new Error(`Calendar not found: ${settings.calendarName}`);
  return matches[0];
}

function auditCalendarAgainstRoutes_(markPending) {
  const calendar = getCalendar_();
  const settings = getSettings_();
  const year = Number(settings.calendarYear || 2026);
  const events = calendar.getEvents(new Date(year, 0, 1), new Date(year + 1, 0, 1));
  const layers = [...new Set(readRoutesInPhysicalOrder_().map(row => row.layer))];
  const mismatched = [];


  layers.forEach(layer => {
    const parsed = parseLayer_(layer);
    const route = getRoute_(layer);
    const routeEvents = events.filter(event => eventMatchesRoute_(event, parsed));
    const dates = uniqueRouteDates_(routeEvents);
    let mismatch = false;


    dates.forEach(date => {
      const dayEvents = routeEvents.filter(event => sameLocalDate_(event.getStartTime(), date));
      route.forEach(row => {
        const event = dayEvents.find(item => normalize_(item.getTitle()) === normalize_(row.title));
        if (!event) { mismatch = true; return; }
        const expectedStart = routeTimeForOrder_(date, row.order, settings);
        if (event.getStartTime().getTime() !== expectedStart.getTime()) mismatch = true;
        if (String(event.getLocation() || '').trim() !== String(row.address || '').trim()) mismatch = true;
      });
      dayEvents.forEach(event => {
        if (!route.some(row => normalize_(row.title) === normalize_(event.getTitle()))) mismatch = true;
      });
    });


    if (routeEvents.length && !dates.length) mismatch = true;
    if (mismatch) {
      mismatched.push(layer);
      if (markPending) addPendingChange_(layer, 0, 'Calendar audit');
    }
  });


  if (markPending && mismatched.length) {
    updateSyncStatus_('Route changes pending', `${mismatched.length} route layer(s) differ from Calendar.`);
  }
  return mismatched;
}

function uniqueRouteDates_(events) {
  const seen = {};
  events.forEach(event => {
    const date = event.getStartTime();
    const key = Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd');
    if (!seen[key]) seen[key] = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  });
  return Object.keys(seen).sort().map(key => seen[key]);
}

function buildRouteDescription_(row, parsed) {
  const parts = [];


  if (row.customerId) parts.push(`PMOS_CUSTOMER_ID=${row.customerId}`);
  if (row.fullName) parts.push(row.fullName);
  if (row.entry) parts.push('', 'ENTRY', row.entry);
  parts.push('', `${parsed.day} • Rotation Week ${parsed.week}`);
  if (row.frequency) parts.push(row.frequency);
  if (row.phone) parts.push('', `PHONE: ${row.phone}`);
  if (row.notes) parts.push('', 'NOTES', row.notes);


  return parts.join('\n').trim();
}

function eventMatchesRoute_(event, parsed) {
  const description = normalize_(event.getDescription());
  const day = Utilities.formatDate(event.getStartTime(), PMOS.TIMEZONE, 'EEEE');
  return day === parsed.day && description.includes(`rotation week ${parsed.week}`);
}

function routeTimeForOrder_(eventDate, order, settings) {
  if (!(eventDate instanceof Date) || !Number.isFinite(eventDate.getTime())) {
    throw new Error(`Invalid route date: ${eventDate}`);
  }


  const time = parseFlexibleRouteTime_(settings.routeStart);
  const result = new Date(eventDate.getTime());


  result.setHours(time.hours, time.minutes, 0, 0);


  const safeOrder = positiveNumberOrDefault_(order, 1);


  for (let index = 1; index < safeOrder; index++) {
    result.setMinutes(
      result.getMinutes() +
      (index % 2 === 1 ? 45 : 60)
    );
  }


  if (!Number.isFinite(result.getTime())) {
    throw new Error(
      `Could not calculate a valid start time from ${eventDate}, ` +
      `order ${order}, and route start ${settings.routeStart}.`
    );
  }


  return result;
}

function myFunction() {
  
}
