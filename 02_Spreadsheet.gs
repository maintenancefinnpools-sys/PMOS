/**
 * PMOS v1.9.0 — Spreadsheet lifecycle, migrations, triggers, and support sheets.
 * Spreadsheet data remains authoritative and updates preserve operational data.
 */

function initializePmos() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.alert(
    'Initialize PMOS?',
    [
      'PMOS will configure protected calculated columns, route-change detection,',
      'hidden support sheets, version history, Update Center, and Feature Lab.',
      '',
      'Your customer and route data will be preserved.'
    ].join('\n'),
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  createMigrationBackup_('Before PMOS initialization');
  ensureUpdateCenterSheet_();
  ensureFeatureLabSheet_();
  ensureSupportSheets_();
  installOrRefreshTriggers_();
  protectCalculatedColumns_();
  normalizeRoutesFromPhysicalOrder_(false);
  storeRouteSignatures_();

  const props = PropertiesService.getDocumentProperties();
  props.setProperty('PMOS_INITIALIZED', 'true');
  props.setProperty('PMOS_VERSION', PMOS_VERSION);
  props.setProperty('PMOS_SCHEMA_VERSION', String(PMOS_MIN_SCHEMA_VERSION));

  writeUpdateCenterValue_('Installed Version', PMOS_VERSION);
  writeUpdateCenterValue_('Initialization Status', 'Initialized');
  writeUpdateCenterValue_('Last Successful Update', new Date());
  writeUpdateCenterValue_('Pending Migration', 'None');

  updateSyncStatus_('Everything synchronized', 'PMOS initialized successfully.');

  ui.alert(
    'PMOS is ready',
    [
      `Version ${PMOS_VERSION} installed.`,
      'The PMOS menu has been activated.',
      'Stop Order and Map Label are now PMOS-managed calculated fields.'
    ].join('\n'),
    ui.ButtonSet.OK
  );

  onOpen();
}

function updatePmos() {
  if (!isPmosInitialized_()) {
    initializePmos();
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getDocumentProperties();
  const installed = props.getProperty('PMOS_VERSION') || 'Unknown';

  const response = ui.alert(
    'Update PMOS?',
    [
      `Installed version: ${installed}`,
      `Code version: ${PMOS_VERSION}`,
      '',
      'PMOS will refresh its version record, menus, triggers, and support sheets.',
      'Existing customer, route, chemistry, and history data will be preserved.'
    ].join('\n'),
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  createMigrationBackup_(`Before update from ${installed} to ${PMOS_VERSION}`);
  runPmosMigrations_();
  retireLegacyCalendarExecutionState_();
  installOrRefreshTriggers_();
  protectCalculatedColumns_();
  normalizeRoutesFromPhysicalOrder_(false);
  storeRouteSignatures_();

  props.setProperty('PMOS_INITIALIZED', 'true');
  props.setProperty('PMOS_VERSION', PMOS_VERSION);
  props.setProperty('PMOS_SCHEMA_VERSION', String(PMOS_MIN_SCHEMA_VERSION));

  ensureUpdateCenterSheet_();
  writeUpdateCenterValue_('Installed Version', PMOS_VERSION);
  writeUpdateCenterValue_('Initialization Status', 'Initialized');
  writeUpdateCenterValue_('Last Successful Update', new Date());
  writeUpdateCenterValue_('Current Release', `PMOS v${PMOS_VERSION}`);
  writeUpdateCenterValue_('Pending Migration', 'None');
  writeUpdateCenterValue_(
    'What’s New',
    'Reviewed Calendar Audit/Sync workflow, resumable execution, transaction recovery, and route/customer synchronization'
  );

  ui.alert(
    'PMOS update complete',
    [
      `PMOS ${PMOS_VERSION} is installed.`,
      '',
      'Legacy Calendar execution state and obsolete continuation triggers were removed.',
      'Calendar changes continue through Plan Audit, Review Session, Sync Preview, and Job Center.'
    ].join('\n'),
    ui.ButtonSet.OK
  );
}

function runPmosMigrations_() {
  ensureUpdateCenterSheet_();
  ensureFeatureLabSheet_();
  ensureSupportSheets_();

  const props = PropertiesService.getDocumentProperties();
  const schema = Number(props.getProperty('PMOS_SCHEMA_VERSION') || 0);

  if (schema < 1) {
    ensureSupportSheets_();
  }

  if (schema < 2) {
    ensureFeatureLabSheet_();
  }

  if (schema < 3) {
    ensureUpdateCenterSheet_();
  }

  if (schema < 4) {
    ensureChemicalSheets_();
  }

  if (schema < 5) {
    ensureRecurringSeriesRegistry_();
  }
}

function isPmosInitialized_() {
  return PropertiesService.getDocumentProperties().getProperty('PMOS_INITIALIZED') === 'true';
}

function installOrRefreshTriggers_() {
  const ss = SpreadsheetApp.getActive();
  const handlers = [PMOS.CHANGE_TRIGGER_HANDLER, PMOS.EDIT_TRIGGER_HANDLER];

  ScriptApp.getProjectTriggers()
    .filter(trigger => handlers.includes(trigger.getHandlerFunction()))
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(PMOS.CHANGE_TRIGGER_HANDLER)
    .forSpreadsheet(ss)
    .onChange()
    .create();

  ScriptApp.newTrigger(PMOS.EDIT_TRIGGER_HANDLER)
    .forSpreadsheet(ss)
    .onEdit()
    .create();
}

function createMigrationBackup_(label) {
  ensureSupportSheets_();
  saveRouteVersion_(label, snapshotRoutes_());

  const props = PropertiesService.getDocumentProperties();
  const settings = {
    version: props.getProperty('PMOS_VERSION') || '',
    schemaVersion: props.getProperty('PMOS_SCHEMA_VERSION') || '',
    initialized: props.getProperty('PMOS_INITIALIZED') || ''
  };

  const ss = SpreadsheetApp.getActive();
  const existingSheet = ss.getSheetByName('System Backups');
  const sheet = existingSheet || ss.insertSheet('System Backups');

  if (!existingSheet) {
    sheet.appendRow([
      'Timestamp',
      'Label',
      'System Settings JSON'
    ]);
    sheet.hideSheet();
  }

  sheet.appendRow([
    new Date(),
    label,
    JSON.stringify(settings)
  ]);
}

function ensureUpdateCenterSheet_() {
  const ss = SpreadsheetApp.getActive();
  const sheet =
    ss.getSheetByName('Update Center') ||
    ss.insertSheet('Update Center');

  const rows = [
    ['PMOS Update Center', 'Value', 'Details'],
    ['Installed Version', PMOS_VERSION, 'Managed automatically'],
    ['Initialization Status', isPmosInitialized_() ? 'Initialized' : 'Not initialized', ''],
    ['Last Successful Update', '', ''],
    ['Backup Before Updates', 'Enabled', ''],
    ['Current Release', `PMOS v${PMOS_VERSION}`, 'Update Center and Feature Lab'],
    ['Update Channel', 'Stable', ''],
    ['Pending Migration', 'None', ''],
    ['App Deployment URL', ScriptApp.getService().getUrl() || '', ''],
    ['What’s New', 'Reviewed Calendar workflow; resumable execution; transaction recovery; route and customer synchronization', '']
  ];

  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 3);
}

function ensureFeatureLabSheet_() {
  const ss = SpreadsheetApp.getActive();
  const sheet =
    ss.getSheetByName('Feature Lab') ||
    ss.insertSheet('Feature Lab');

  if (sheet.getLastRow() > 1) {
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(4, sheet.getLastColumn())).getValues();
    values.forEach(function(row, index) {
      if (String(row[0] || '').trim() !== 'Direct Calendar Sync') return;
      const targetRow = index + 2;
      sheet.getRange(targetRow, 1).setValue('Reviewed Calendar Sync');
      sheet.getRange(targetRow, 3).setValue('Approved Calendar changes execute only through the reviewed queue.');
      sheet.getRange(targetRow, 4).setValue('Stable');
    });
    return;
  }

  const rows = [
    ['Feature', 'Status', 'Description', 'Risk Level'],
    ['Smart Chemistry Suggestions', 'Off', 'Guidance based on visit history', 'Preview'],
    ['Route Optimizer Suggestions', 'Off', 'Suggestions only; never automatic', 'Preview'],
    ['Technician Training Mode', 'Off', 'Additional prompts for newer technicians', 'Preview'],
    ['SpinLab Import', 'Off', 'Future WaterLink/SpinLab testing', 'Experimental'],
    ['Built-in Route Map', 'Off', 'Future planning and tracking map', 'Experimental'],
    ['Reviewed Calendar Sync', 'On', 'Approved Calendar changes execute only through the reviewed queue.', 'Stable'],
    ['Spreadsheet Route Detection', 'On', 'Detect row moves and insertions', 'Stable'],
    ['Route Version History', 'On', 'Restorable route snapshots', 'Stable']
  ];

  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
}

function setFeatureLabStatus(row, status) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Feature Lab');
  sheet.getRange(Number(row), 2).setValue(status);
}

function writeUpdateCenterValue_(label, value) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Update Center');
  if (!sheet) return;

  const labels = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().flat();
  const index = labels.findIndex(cell => String(cell) === label);

  if (index >= 0) {
    sheet.getRange(index + 1, 2).setValue(value);
  }
}

function setupSpreadsheetAutomation() {
  if (!isPmosInitialized_()) {
    initializePmos();
    return;
  }

  ensureSupportSheets_();
  installOrRefreshTriggers_();
  protectCalculatedColumns_();
  normalizeRoutesFromPhysicalOrder_(false);
  storeRouteSignatures_();

  const pending = getPendingChanges_();
  if (pending.length) {
    updateSyncStatus_(
      'Route changes pending',
      pending.length + ' route layer(s) still have unapplied changes.'
    );
  } else {
    updateSyncStatus_('Everything synchronized', 'No unapplied route changes.');
  }

  SpreadsheetApp.getUi().alert(
    'PMOS setup complete',
    [
      'Stop Order and Map Label are now calculated from row position.',
      'Dragging or inserting route rows will be detected.',
      'Use PMOS → Calendar → Calendar Plan Audit to review Calendar changes.'
    ].join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function handlePmosSheetChange(e) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) return;

  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet) return;

    ensureSupportSheets_();

    if (sheet.getName() === PMOS.CUSTOMERS_SHEET) {
      synchronizeCustomerDatabase_(true);
      return;
    }

    if (sheet.getName() === PMOS.ROUTES_SHEET) {
      normalizeRoutesFromPhysicalOrder_(true);
    }
  } finally {
    lock.releaseLock();
  }
}

function handlePmosSheetEdit(e) {
  const range = e && e.range;
  const sheet = range ? range.getSheet() : SpreadsheetApp.getActiveSheet();
  if (!sheet || (range && range.getRow() < 2)) return;

  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) return;

  try {
    ensureSupportSheets_();

    if (sheet.getName() === PMOS.CUSTOMERS_SHEET) {
      synchronizeCustomerDatabase_(true);
      return;
    }

    if (sheet.getName() !== PMOS.ROUTES_SHEET) return;

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const layerCol = headers.indexOf('Layer');
    const affectedLayers = new Set();

    if (layerCol >= 0 && range) {
      const firstRow = Math.max(2, range.getRow());
      const lastRow = range.getLastRow();
      sheet.getRange(firstRow, layerCol + 1, lastRow - firstRow + 1, 1)
        .getValues()
        .forEach(row => {
          const layer = String(row[0] || '').trim();
          if (layer) affectedLayers.add(layer);
        });
    }

    normalizeRoutesFromPhysicalOrder_(true);
    affectedLayers.forEach(layer => addPendingChange_(layer, 1, 'Spreadsheet route edit'));

    if (affectedLayers.size) {
      updateSyncStatus_(
        'Route changes pending',
        `${affectedLayers.size} route layer(s) contain edited routing information.`
      );
    }
  } finally {
    lock.releaseLock();
  }
}

function protectCalculatedColumns_() {
  const sheet = getRoutesSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const managedPrefix = 'PMOS calculated column: ';
  const managedNames = ['Stop Order', 'Map Label'];
  const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);

  // Remove only protections previously created by PMOS for these calculated
  // columns. User-created protections and protections on unrelated ranges are
  // deliberately left untouched.
  protections.forEach(function(protection) {
    const description = String(protection.getDescription() || '');
    if (description.indexOf(managedPrefix) !== 0) return;
    const managedName = description.slice(managedPrefix.length);
    if (managedNames.indexOf(managedName) < 0) return;
    protection.remove();
  });

  managedNames.forEach(function(name) {
    const index = headers.indexOf(name);
    if (index < 0) return;

    const range = sheet.getRange(1, index + 1, Math.max(sheet.getMaxRows(), 2), 1);
    const protection = range.protect();
    protection.setDescription(managedPrefix + name);
    protection.setWarningOnly(true);
  });
}

function ensureSupportSheets_() {
  const ss = SpreadsheetApp.getActive();

  if (!ss.getSheetByName(PMOS.VERSIONS_SHEET)) {
    const sheet = ss.insertSheet(PMOS.VERSIONS_SHEET);
    sheet.appendRow(['Version ID', 'Timestamp', 'Label', 'Snapshot JSON']);
    sheet.hideSheet();
  }

  if (!ss.getSheetByName(PMOS.PENDING_SHEET)) {
    const sheet = ss.insertSheet(PMOS.PENDING_SHEET);
    sheet.appendRow(['Layer', 'Changed At', 'Changed Rows', 'Status', 'Source']);
    sheet.hideSheet();
  }
}
