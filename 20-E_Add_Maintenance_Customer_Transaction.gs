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

    const equipmentSheet = migrateMaintenanceCustomerEquipmentStorage_(
      spreadsheet,
      customersSheet
    );

    snapshots = [
      snapshotMaintenanceSheet_(customersSheet),
      snapshotMaintenanceSheet_(routeSheet),
      snapshotMaintenanceSheet_(equipmentSheet)
    ];

    let customerTable = readPmosHeaderTable_(customersSheet);
    let routeTable = readPmosHeaderTable_(routeSheet);

    const normalizedCustomerHeaders = customerTable.headers.map(normalizeSyncHeader_);
    const cleanerHeaderIndex = normalizedCustomerHeaders.indexOf(normalizeSyncHeader_('Cleaner'));
    const robotsHeaderIndex = normalizedCustomerHeaders.indexOf(normalizeSyncHeader_('Robot(s)'));
    if (cleanerHeaderIndex >= 0 && robotsHeaderIndex < 0) {
      customersSheet.getRange(customerTable.headerRow, cleanerHeaderIndex + 1).setValue('Robot(s)');
      customerTable = readPmosHeaderTable_(customersSheet);
    }

    ensureMaintenanceClientHeaders_(customersSheet, customerTable, [
      'Customer ID', 'First Name', 'Last Name', 'Calendar Title', 'Full Address', 'Primary Phone',
      'Email', 'Frequency', 'Service Start Date', 'Entry Information',
      'Customer Notes', 'Sanitization Type(s)', 'Automation', 'Pump',
      'Filter', 'Heater', 'Robot(s)', 'Cover', 'Bodies of Water',
      'Year Round'
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
    const equipmentSummary = sharedValues['Equipment Summary'];
    const equipmentDetailsJson = sharedValues['Equipment Details JSON'];
    delete sharedValues['Equipment Summary'];
    delete sharedValues['Equipment Details JSON'];

    appendMappedMaintenanceRow_(customersSheet, customerTable, sharedValues);
    const customerRowNumber = customersSheet.getLastRow();
    customersSheet.getRange(
      customerRowNumber, 1, 1, customersSheet.getLastColumn()
    ).setWrap(false);
    customersSheet.setRowHeight(customerRowNumber, 21);
    upsertMaintenanceCustomerEquipment_(equipmentSheet, {
      customerId: customerId,
      calendarTitle: request.calendarTitle,
      equipmentSummary: equipmentSummary,
      equipmentDetailsJson: equipmentDetailsJson
    });

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
      customerName: request.fullName,
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
        'Customer: ' + request.fullName,
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

function ensureMaintenanceCustomerEquipmentSheet_(spreadsheet) {
  const ss = spreadsheet || SpreadsheetApp.getActive();
  const sheetName = 'PMOS Customer Equipment';
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  const headers = [
    'Customer ID', 'Calendar Title', 'Equipment Summary',
    'Equipment Details JSON', 'Updated At'
  ];
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (headers.some(function (header, index) {
    return String(current[index] || '').trim() !== header;
  })) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.setFrozenRows(1);
  if (!sheet.isSheetHidden()) sheet.hideSheet();
  return sheet;
}

function migrateMaintenanceCustomerEquipmentStorage_(spreadsheet, customersSheet) {
  const ss = spreadsheet || SpreadsheetApp.getActive();
  const customers = customersSheet || findFirstSheetByName_(ss, [
    'Customers', 'Customer Database', 'Customer List'
  ]);
  const equipmentSheet = ensureMaintenanceCustomerEquipmentSheet_(ss);
  if (!customers || customers.getLastRow() < 1) return equipmentSheet;

  const table = readPmosHeaderTable_(customers);
  const idIndex = table.headers.indexOf('Customer ID');
  const titleIndex = table.headers.indexOf('Calendar Title');
  const summaryIndex = table.headers.indexOf('Equipment Summary');
  const detailsIndex = table.headers.indexOf('Equipment Details JSON');
  if (summaryIndex < 0 && detailsIndex < 0) return equipmentSheet;

  const equipmentValues = equipmentSheet.getDataRange().getValues();
  const records = equipmentValues.slice(1).filter(function (row) {
    return String(row[0] || '').trim();
  });
  const byId = {};
  records.forEach(function (row, index) {
    byId[String(row[0] || '').trim()] = index;
  });
  let migrated = false;
  table.rows.forEach(function (row) {
    const customerId = idIndex >= 0 ? String(row[idIndex] || '').trim() : '';
    const summary = summaryIndex >= 0 ? String(row[summaryIndex] || '').trim() : '';
    const details = detailsIndex >= 0 ? String(row[detailsIndex] || '').trim() : '';
    if (!customerId || (!summary && !details)) return;
    const record = [
      customerId,
      titleIndex >= 0 ? String(row[titleIndex] || '').trim() : '',
      summary,
      details,
      new Date()
    ];
    if (Object.prototype.hasOwnProperty.call(byId, customerId)) {
      records[byId[customerId]] = record;
    } else {
      byId[customerId] = records.length;
      records.push(record);
    }
    migrated = true;
  });
  if (migrated) {
    const oldRows = Math.max(0, equipmentSheet.getLastRow() - 1);
    if (oldRows) equipmentSheet.getRange(2, 1, oldRows, 5).clearContent();
    equipmentSheet.getRange(2, 1, records.length, 5).setValues(records);
  }

  const customerRows = Math.max(0, customers.getLastRow() - table.headerRow);
  [summaryIndex, detailsIndex].forEach(function (index) {
    if (index < 0) return;
    if (customerRows) {
      customers.getRange(table.headerRow + 1, index + 1, customerRows, 1)
        .clearContent();
    }
    customers.hideColumns(index + 1);
  });
  if (customerRows) {
    customers.getRange(table.headerRow + 1, 1, customerRows, customers.getLastColumn())
      .setWrap(false);
    customers.setRowHeights(table.headerRow + 1, customerRows, 21);
  }
  return equipmentSheet;
}

function upsertMaintenanceCustomerEquipment_(sheet, record) {
  const equipmentSheet = sheet || ensureMaintenanceCustomerEquipmentSheet_();
  const customerId = String(record && record.customerId || '').trim();
  if (!customerId) throw new Error('Customer equipment storage is missing Customer ID.');
  const values = equipmentSheet.getDataRange().getValues();
  let rowNumber = 0;
  for (let index = 1; index < values.length; index++) {
    if (String(values[index][0] || '').trim() === customerId) {
      rowNumber = index + 1;
      break;
    }
  }
  if (!rowNumber) rowNumber = Math.max(2, equipmentSheet.getLastRow() + 1);
  equipmentSheet.getRange(rowNumber, 1, 1, 5).setValues([[
    customerId,
    String(record.calendarTitle || '').trim(),
    String(record.equipmentSummary || '').trim(),
    String(record.equipmentDetailsJson || '').trim(),
    new Date()
  ]]);
  equipmentSheet.getRange(rowNumber, 1, 1, 5).setWrap(false);
  equipmentSheet.setRowHeight(rowNumber, 21);
  if (!equipmentSheet.isSheetHidden()) equipmentSheet.hideSheet();
}

function createMaintenanceCustomerAndAutoSync(input) {
  const result = createMaintenanceCustomer(input);
  try {
    scheduleAddedMaintenanceCustomerCalendarSync_(
      result.customerId,
      result.routeRows.map(function (row) { return row.layer; })
    );
    result.calendarStatus = 'SCHEDULED';
    result.summary += '\nAutomatic Calendar synchronization is scheduled in the background.';
  } catch (error) {
    result.calendarStatus = 'SYNC_ERROR';
    result.calendarError = String(error && error.message ? error.message : error);
    result.summary += '\n\nThe customer was saved, but automatic Calendar Sync could not be scheduled:\n' +
      result.calendarError + '\nUse Retry Calendar Sync; do not add the customer again.';
  }
  return result;
}

function addedMaintenanceCalendarSyncKey_(customerId) {
  return 'PMOS_ADD_CLIENT_SYNC_' + String(customerId || '').trim();
}

function scheduleAddedMaintenanceCustomerCalendarSync_(customerId, affectedLayers) {
  const id = String(customerId || '').trim();
  const layers = Array.from(new Set((affectedLayers || []).map(function (layer) {
    return String(layer || '').trim();
  }).filter(Boolean)));
  if (!id || !layers.length) {
    throw new Error('Automatic Calendar Sync could not be scheduled without the saved customer and route layers.');
  }
  const now = new Date().toISOString();
  PropertiesService.getDocumentProperties().setProperty(
    addedMaintenanceCalendarSyncKey_(id),
    JSON.stringify({customerId: id, affectedLayers: layers, status: 'SCHEDULED', progress: 2, processedOperations: 0, totalOperations: 0, createdAt: now, updatedAt: now, attempts: 0})
  );
  ScriptApp.newTrigger('runAddedMaintenanceCustomerCalendarSyncWorker_')
    .timeBased().after(1000).create();
}

function runAddedMaintenanceCustomerCalendarSyncWorker_() {
  const claimLock = LockService.getScriptLock();
  if (!claimLock.tryLock(5000)) return;
  const properties = PropertiesService.getDocumentProperties();
  let item;
  let state;
  try {
    const entries = properties.getProperties();
    const prefix = 'PMOS_ADD_CLIENT_SYNC_';
    const pending = Object.keys(entries).map(function (key) {
      if (key.indexOf(prefix) !== 0) return null;
      try {
        const candidate = JSON.parse(entries[key]);
        return candidate && candidate.status === 'SCHEDULED' ? {key: key, state: candidate} : null;
      } catch (ignored) {
        return null;
      }
    }).filter(Boolean).sort(function (left, right) {
      return String(left.state.createdAt || '').localeCompare(String(right.state.createdAt || ''));
    });
    if (!pending.length) return;
    item = pending[0];
    state = item.state;
    state.status = 'RUNNING';
    state.progress = 5;
    state.startedAt = new Date().toISOString();
    state.updatedAt = state.startedAt;
    state.attempts = Number(state.attempts || 0) + 1;
    delete state.error;
    properties.setProperty(item.key, JSON.stringify(state));
  } finally {
    claimLock.releaseLock();
  }
  try {
    const result = synchronizeAddedMaintenanceCustomerCalendar_(
      state.customerId,
      state.affectedLayers,
      function (progress) {
        state.progress = Number(progress.progress || 0);
        state.processedOperations = Number(progress.processedOperations || 0);
        state.totalOperations = Number(progress.totalOperations || 0);
        state.updatedAt = new Date().toISOString();
        properties.setProperty(item.key, JSON.stringify(state));
      }
    );
    state.status = 'COMPLETE';
    state.progress = 100;
    state.result = result;
    state.completedAt = new Date().toISOString();
    state.updatedAt = state.completedAt;
  } catch (error) {
    state.status = 'ERROR';
    state.error = String(error && error.message ? error.message : error);
    state.updatedAt = new Date().toISOString();
  }
  properties.setProperty(item.key, JSON.stringify(state));
}

function getAddedMaintenanceCustomerCalendarSyncStatus(customerId) {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('Calendar Sync status is missing the saved Customer ID.');
  const properties = PropertiesService.getDocumentProperties();
  const key = addedMaintenanceCalendarSyncKey_(id);
  const raw = properties.getProperty(key);
  if (!raw) return {status: 'NOT_FOUND', customerId: id};
  const state = JSON.parse(raw);
  if (state.status === 'RUNNING' && state.startedAt &&
      Date.now() - new Date(state.startedAt).getTime() > 7 * 60 * 1000) {
    state.status = 'ERROR';
    state.error = 'The background Calendar worker exceeded its execution window. Use Retry Calendar Sync; do not add the customer again.';
    state.updatedAt = new Date().toISOString();
    properties.setProperty(key, JSON.stringify(state));
  }
  return state;
}

function synchronizeAddedMaintenanceCustomerCalendar_(customerId, affectedLayers, progressCallback) {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('Automatic Calendar Sync is missing the new Customer ID.');
  const layers = Array.from(new Set((affectedLayers || []).map(function (layer) {
    return String(layer || '').trim();
  }).filter(Boolean)));
  if (!layers.length) throw new Error('Automatic Calendar Sync is missing the affected route layers.');
  const reportProgress = typeof progressCallback === 'function'
    ? progressCallback
    : function () {};
  reportProgress({progress: 8, processedOperations: 0, totalOperations: 0});
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
    reportProgress({
      progress: 25,
      processedOperations: 0,
      totalOperations: operations.length
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
      reportProgress({progress: 100, processedOperations: 0, totalOperations: 0});
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
    reportProgress({
      progress: 30,
      processedOperations: 0,
      totalOperations: operations.length
    });

    const state = {
      id: 'ADD_CLIENT_' + Utilities.getUuid(),
      planId: String(built.plan.id || 'ADD_CLIENT'),
      calendarName: settings.calendarName
    };
    const counts = {created: 0, updated: 0};
    operations.forEach(function (operation, index) {
      const outcome = executeReviewedCalendarOperation_(operation, state);
      if (outcome.action === 'CREATE') counts.created++;
      else if (outcome.action === 'UPDATE') counts.updated++;
      reportProgress({
        progress: 30 + Math.round(65 * (index + 1) / operations.length),
        processedOperations: index + 1,
        totalOperations: operations.length
      });
    });
    clearPmosCalendarAuditSnapshot_();
    reportProgress({
      progress: 100,
      processedOperations: operations.length,
      totalOperations: operations.length
    });
    counts.affectedLayers = layers.slice();
    counts.operationCount = operations.length;
    return counts;
  } finally {
    lock.releaseLock();
  }
}

function retryAddedMaintenanceCustomerCalendar(input) {
  input = input || {};
  scheduleAddedMaintenanceCustomerCalendarSync_(input.customerId, input.affectedLayers || []);
  return {status: 'SCHEDULED', customerId: String(input.customerId || '').trim()};
}

function normalizeMaintenanceCustomerRequest_(input) {
  const firstName = String(input.firstName || '').trim();
  const lastName = String(input.lastName || input.name || '').trim();
  const name = lastName;
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const address = String(input.address || '').trim();
  const addressDetails = input.addressDetails || {};
  const phone = String(input.phone || '').trim();
  const email = String(input.email || '').trim();
  const notes = String(input.notes || '').trim();
  const entryInformation = String(input.entryInformation || '').trim();
  const cleanEquipmentText = function (value) {
    return String(value == null ? '' : value).trim().slice(0, 250);
  };
  const equipmentTypes = {
    PUMP: true, FILTER: true, HEATER: true, WATER_FEATURE: true, CHEMISTRY_AUTOMATION: true,
    EQUIPMENT_AUTOMATION: true, IONIZER: true, OZONATOR: true,
    UV: true, SALT_SYSTEM: true, CHLORINE_FEEDER: true, BROMINE_FEEDER: true,
    OTHER_SANITIZER: true, ROBOT: true, OTHER: true
  };
  const equipmentFields = [
    'purpose', 'make', 'model', 'modelNumber', 'name', 'featureType',
    'pumpMake', 'pumpModel', 'pumpModelNumber', 'filterMake', 'filterModel',
    'automation', 'chlorineSource', 'manufacturer', 'equipmentType',
    'robotType', 'sanitizerType', 'connectedToAutomation', 'actuatorMake',
    'actuatorModel', 'actuatorModelNumber', 'actuatorQuantity', 'filterType', 'filterSize',
    'heaterType', 'heaterMake', 'heaterModel', 'heaterModelNumber',
    'featureEquipmentType', 'featureEquipmentMake', 'featureEquipmentModel',
    'featureEquipmentJson'
  ];
  const rawBodies = Array.isArray(input.bodiesOfWater) ? input.bodiesOfWater.slice(0, 8) : [];
  const bodiesOfWater = rawBodies.map(function (body, bodyIndex) {
    const source = body || {};
    const equipment = (Array.isArray(source.equipment) ? source.equipment : [])
      .slice(0, 20).map(function (item) {
        const type = cleanEquipmentText(item && item.type).toUpperCase();
        if (!equipmentTypes[type]) return null;
        const rawDetails = item && item.details || {};
        const details = {};
        equipmentFields.forEach(function (field) {
          const value = field === 'featureEquipmentJson'
            ? String(rawDetails[field] == null ? '' : rawDetails[field]).trim().slice(0, 10000)
            : cleanEquipmentText(rawDetails[field]);
          if (value) details[field] = value;
        });
        if (type === 'WATER_FEATURE' && details.featureEquipmentJson) {
          try {
            const componentTypes = {PUMP: true, FILTER: true, HEATER: true, OTHER: true};
            const componentFields = [
              'pumpMake', 'pumpModel', 'pumpModelNumber', 'filterMake',
              'filterType', 'filterModel', 'filterSize', 'heaterType', 'heaterMake',
              'heaterModel', 'heaterModelNumber', 'featureEquipmentType',
              'featureEquipmentMake', 'featureEquipmentModel'
            ];
            const parsedComponents = JSON.parse(details.featureEquipmentJson);
            details.featureEquipment = (Array.isArray(parsedComponents) ? parsedComponents : [])
              .slice(0, 12).map(function (component) {
                const componentType = cleanEquipmentText(component && component.type).toUpperCase();
                if (!componentTypes[componentType]) return null;
                const componentDetails = {};
                componentFields.forEach(function (field) {
                  const value = cleanEquipmentText(component && component.details && component.details[field]);
                  if (value) componentDetails[field] = value;
                });
                return {type: componentType, details: componentDetails};
              }).filter(Boolean);
          } catch (ignored) {
            details.featureEquipment = [];
          }
          delete details.featureEquipmentJson;
        }
        if (type === 'WATER_FEATURE' && !details.name && details.featureType) {
          details.name = details.featureType;
        }
        if (type === 'CHEMISTRY_AUTOMATION') {
          details.acidTank = 'Yes';
          details.pHProbe = 'Yes';
          details.orpProbe = 'Yes';
          details.chlorineDelivery = cleanEquipmentText(source.sanitization).toLowerCase() === 'salt'
            ? 'Controlled salt cell'
            : 'Chlorine feed tank';
        }
        return {type: type, details: details};
      }).filter(Boolean);
    const normalizePump = function (unit) {
      const value = unit || {};
      return {
        make: cleanEquipmentText(value.make),
        model: cleanEquipmentText(value.model),
        modelNumber: cleanEquipmentText(value.modelNumber)
      };
    };
    return {
      name: cleanEquipmentText(source.name) || (bodyIndex ? 'Spa' : 'Pool'),
      type: cleanEquipmentText(source.type) || (bodyIndex ? 'Spa' : 'Pool'),
      spaType: cleanEquipmentText(source.spaType),
      equipmentSetup: cleanEquipmentText(source.equipmentSetup),
      unitMake: cleanEquipmentText(source.unitMake),
      unitModel: cleanEquipmentText(source.unitModel),
      location: cleanEquipmentText(source.location),
      sanitization: cleanEquipmentText(source.sanitization),
      pump: normalizePump(source.pump),
      filter: {
        type: cleanEquipmentText(source.filter && source.filter.type),
        make: cleanEquipmentText(source.filter && source.filter.make),
        model: cleanEquipmentText(source.filter && (
          source.filter.model || source.filter.size
        ))
      },
      heater: {
        type: cleanEquipmentText(source.heater && source.heater.type),
        make: cleanEquipmentText(source.heater && source.heater.make),
        model: cleanEquipmentText(source.heater && source.heater.model),
        modelNumber: cleanEquipmentText(source.heater && source.heater.modelNumber)
      },
      cleaner: cleanEquipmentText(source.cleaner),
      cover: typeof source.cover === 'object' && source.cover
        ? {
          type: cleanEquipmentText(source.cover.type),
          winterType: cleanEquipmentText(source.cover.winterType)
        }
        : {type: cleanEquipmentText(source.cover), winterType: ''},
      equipment: equipment
    };
  });
  if (!bodiesOfWater.length) {
    bodiesOfWater.push({
      name: 'Pool', type: 'Pool', location: '', sanitization: cleanEquipmentText(input.sanitization),
      pump: {make: '', model: cleanEquipmentText(input.pump), modelNumber: ''},
      filter: {type: '', make: '', model: cleanEquipmentText(input.filter)},
      heater: {type: '', make: '', model: '', modelNumber: cleanEquipmentText(input.heater)},
      cleaner: cleanEquipmentText(input.cleaner),
      cover: {type: cleanEquipmentText(input.cover), winterType: ''},
      equipment: []
    });
  }
  const mainBody = bodiesOfWater[0];
  const describePump = function (unit) {
    return [unit && unit.make, unit && unit.model, unit && unit.modelNumber].filter(Boolean).join(' · ');
  };
  const control = mainBody.equipment.find(function (item) {
    return item.type === 'EQUIPMENT_AUTOMATION';
  });
  const sanitization = mainBody.sanitization;
  const automation = control
    ? [control.details.manufacturer, control.details.model, control.details.modelNumber]
      .filter(Boolean).join(' · ')
    : cleanEquipmentText(input.automation);
  const pump = describePump(mainBody.pump);
  const filter = [mainBody.filter.type, mainBody.filter.make, mainBody.filter.model]
    .filter(Boolean).join(' · ');
  const heater = [mainBody.heater.type, mainBody.heater.make,
    mainBody.heater.model, mainBody.heater.modelNumber]
    .filter(Boolean).join(' · ');
  const robots = mainBody.equipment.filter(function (item) {
    return item.type === 'ROBOT';
  }).map(function (item) {
    return [item.details.robotType, item.details.make, item.details.model, item.details.modelNumber]
      .filter(Boolean).join(' · ');
  }).filter(Boolean).join('; ') || mainBody.cleaner || cleanEquipmentText(input.robots || input.cleaner);
  const cover = [mainBody.cover.type, mainBody.cover.winterType].filter(Boolean).join(' · ');
  const yearRound = String(input.yearRound || '').trim().toLowerCase() === 'yes';
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
  const calendarTitle = String(input.calendarTitle || lastName).trim() || lastName;
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

  if (!firstName) throw new Error('First name is required.');
  if (!lastName) throw new Error('Last name is required.');
  if (!address) throw new Error('Service address is required.');
  if (input.addressVerified !== true ||
      normalizePmosAddressSearch_(addressDetails.address) !== normalizePmosAddressSearch_(address) ||
      !String(addressDetails.street || '').trim() || !String(addressDetails.city || '').trim() ||
      !String(addressDetails.province || '').trim() || !String(addressDetails.postalCode || '').trim() ||
      !String(addressDetails.country || '').trim() ||
      !Number.isFinite(Number(addressDetails.lat)) || !Number.isFinite(Number(addressDetails.lng))) {
    throw new Error('Select and confirm a complete address suggestion before creating the client.');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email address is not valid.');
  }
  if (frequency === 'Twice Weekly' && day === secondDay) {
    throw new Error('Twice-weekly service requires two different weekdays.');
  }

  return Object.freeze({
    firstName: firstName,
    lastName: lastName,
    fullName: fullName || lastName,
    name: name,
    address: address,
    addressDetails: Object.freeze({
      address: address,
      street: String(addressDetails.street).trim(),
      city: String(addressDetails.city).trim(),
      province: String(addressDetails.province).trim(),
      postalCode: String(addressDetails.postalCode).trim(),
      country: String(addressDetails.country).trim(),
      lat: Number(addressDetails.lat),
      lng: Number(addressDetails.lng),
      placeId: String(addressDetails.placeId || '').trim(),
      source: String(addressDetails.source || '').trim()
    }),
    phone: phone,
    email: email,
    notes: notes,
    entryInformation: entryInformation,
    sanitization: sanitization,
    automation: automation,
    pump: pump,
    filter: filter,
    heater: heater,
    robots: robots,
    cover: cover,
    bodiesOfWater: bodiesOfWater,
    yearRound: yearRound,
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
  const equipmentLabels = {
    PUMP: 'Pump', FILTER: 'Filter', HEATER: 'Heater', WATER_FEATURE: 'Water Feature',
    CHEMISTRY_AUTOMATION: 'Chemistry Automation',
    EQUIPMENT_AUTOMATION: 'Equipment Automation', IONIZER: 'Ionizer',
    OZONATOR: 'Ozonator', UV: 'UV Sanitizer',
    SALT_SYSTEM: 'Salt Chlorine Generator', CHLORINE_FEEDER: 'Chlorinator',
    BROMINE_FEEDER: 'Brominator',
    OTHER_SANITIZER: 'Other Sanitizer',
    ROBOT: 'Robot', OTHER: 'Other Equipment'
  };
  const equipmentSummary = request.bodiesOfWater.map(function (body) {
    const bodyPump = [body.pump.make, body.pump.model, body.pump.modelNumber]
      .filter(Boolean).join(' · ');
    const bodyFilter = [body.filter.make, body.filter.type, body.filter.model || body.filter.size]
      .filter(Boolean).join(' · ');
    const bodyHeater = [body.heater.type, body.heater.make,
      body.heater.model, body.heater.modelNumber]
      .filter(Boolean).join(' · ');
    const bodyCover = [body.cover.type, body.cover.winterType].filter(Boolean).join(' · ');
    const basics = [
      body.sanitization && 'Sanitization: ' + body.sanitization,
      bodyPump && 'Pump: ' + bodyPump,
      bodyFilter && 'Filter: ' + bodyFilter,
      bodyHeater && 'Heater: ' + bodyHeater,
      body.cleaner && 'Robot(s): ' + body.cleaner,
      bodyCover && 'Cover: ' + bodyCover
    ].filter(Boolean);
    (body.equipment || []).forEach(function (item) {
      const details = item.details || {};
      const description = [
        details.name || details.purpose || details.equipmentType ||
          details.robotType || details.sanitizerType,
        details.manufacturer || details.make,
        details.model,
        details.modelNumber
      ].filter(Boolean).join(' · ');
      basics.push((equipmentLabels[item.type] || item.type) + (description ? ': ' + description : ''));
      let featurePumpIndex = 0;
      (details.featureEquipment || []).forEach(function (component) {
        const componentDetails = component.details || {};
        const componentDescription = [
          componentDetails.pumpMake || componentDetails.filterMake || componentDetails.heaterMake ||
            componentDetails.featureEquipmentMake,
          componentDetails.pumpModel || componentDetails.filterType || componentDetails.heaterModel ||
            componentDetails.featureEquipmentModel,
          componentDetails.pumpModelNumber || componentDetails.filterModel ||
            componentDetails.filterSize ||
            componentDetails.heaterModelNumber || componentDetails.featureEquipmentType
        ].filter(Boolean).join(' · ');
        if (component.type === 'PUMP') featurePumpIndex += 1;
        const componentLabel = component.type === 'PUMP'
          ? 'Water Feature Pump ' + featurePumpIndex
          : 'Water Feature ' + component.type.charAt(0) + component.type.slice(1).toLowerCase();
        basics.push(componentLabel + (componentDescription ? ': ' + componentDescription : ''));
      });
    });
    return body.name + (body.location ? ' (' + body.location + ')' : '') + ': ' +
      (basics.join('; ') || 'No equipment entered');
  }).join('\n');
  return {
    'Customer ID': customerId,
    'First Name': request.firstName,
    'Last Name': request.lastName,
    'Customer Name': request.lastName,
    'Name': request.lastName,
    'Customer': request.lastName,
    'Full Name(s)': request.fullName,
    'Calendar Title': request.calendarTitle,
    'Address': request.address,
    'Full Address': request.address,
    'Service Address': request.address,
    'Street Address': request.address,
    'Street': request.addressDetails.street,
    'City': request.addressDetails.city,
    'Province': request.addressDetails.province,
    'Postal Code': request.addressDetails.postalCode,
    'Country': request.addressDetails.country,
    'Latitude': request.addressDetails.lat,
    'Longitude': request.addressDetails.lng,
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
    'Entry Information': request.entryInformation,
    'Sanitization Type(s)': request.sanitization,
    'Automation': request.automation,
    'Pump': request.pump,
    'Filter': request.filter,
    'Heater': request.heater,
    'Robot(s)': request.robots,
    'Cover': request.cover,
    'Bodies of Water': request.bodiesOfWater.map(function (body) {
      const bodyDetails = [body.type, body.spaType, body.equipmentSetup]
        .filter(Boolean).join(' · ');
      const unit = [body.unitMake, body.unitModel].filter(Boolean).join(' ');
      return body.name + (body.location ? ' (' + body.location + ')' : '') +
        (bodyDetails ? ' — ' + bodyDetails : '') + (unit ? ' — ' + unit : '');
    }).join('; '),
    'Equipment Summary': equipmentSummary,
    'Equipment Details JSON': JSON.stringify({version: 1, bodies: request.bodiesOfWater}),
    'Year Round': request.yearRound ? 'Yes' : 'No',
    'Season': request.yearRound ? 'Year Round' : 'Seasonal',
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
