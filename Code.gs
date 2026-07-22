/*
PMOS v1.8.8 — PROGRESSIVE COMPARATIVE SIX-DAY SCHEDULER


- Initial search checks six business days and returns the best three dates.
- Each expansion adds six more business days and re-ranks the combined results.
- Selected dates compare six business days before and after.
- Coordinate-based route-centroid pre-ranking avoids unreliable city-name matching.
- Cached route snapshots and geocodes accelerate repeat and expanded searches.
- Address-first flow ranks the best upcoming service dates.
- Date-first flow calculates route placement once an address is available.
- Recommendations use the actual calendar route for each exact date, preserving
  weekly, bi-weekly, monthly, and four-week rotation differences.
- Clicking a recommended date fills the next available visit entry.
- Visit #1 is always visible and Add Another Visit always remains available.
- Successful scheduling clears the form and restores a fresh Visit #1.
- Manual stop placement remains fully supported.
*/


/*
PMOS v1.8.3 — AUTOMATIC ROUTE INSERTION


- First temporary visit date is visible immediately.
- Add Another Visit works entirely in the browser and creates removable date cards.
- Every visit date gets its own automatic route-position recommendation.
- Recommendations refresh after address/date changes with a short debounce.
- Shows route day, customer count, previous/next customer, added travel, rating, and reason.
- Manual stop choices always override the recommendation.
- No arrival-time estimates.
*/


/*
PMOS v1.8.2 — DIALOG & JOB ENGINE STABILITY


Critical fix: HTML-service dialogs now call public Apps Script functions. Functions
ending in an underscore are private and cannot be invoked by google.script.run.
This repairs Job Engine actions, Calendar task windows, Suggest Placement, and
Schedule Visit(s). The short-task window now uses an honest indeterminate bar
instead of freezing at a fictional 78%.
*/


/*
PMOS v1.8.2 FINAL — PROFESSIONAL TASK EXPERIENCE


Included:
- Calendar menu order: Schedule Temporary Visit now appears before Calendar Status.
- Unlimited temporary visit dates through an expandable Add another visit control.
- Advisory best-stop suggestion based on geocoded route addresses and added
  straight-line travel distance.
- Percentage shown beside the Calendar Sync/Rebuild progress bar.
- Automatic retry for transient Google Spreadsheet service failures.
- Safer final job-state and history writes.
- Clear distinction between Calendar work failure and final status-write failure.
- Shared professional PMOS Task Window for Calendar Status, Calendar Plan Audit,
  Verify Calendar, Customer Database Sync, and Map Export.
- Direct update supported from PMOS v1.6.0 through complete Code.gs replacement.
- Job Engine selection repaired with real selectable controls and remembered choice.
- Customer Sync and Map Export removed from the main PMOS menu and kept under Jobs.
*/


/*
PMOS v1.8.0 — CALENDAR WORKSPACE + TEMPORARY VISITS


Calendar-related jobs are separated from the general Jobs list.


PMOS > Calendar now contains:
- Calendar Plan Audit
- Calendar Status
- Calendar Sync
- Calendar Rebuild
- Verify Calendar
- Schedule Temporary Visit


PMOS > Jobs now contains only current non-Calendar jobs:
- Sync Customer Database
- Export Updated Map Layers
- Job History


Temporary visits:
- create one or two standalone Calendar events;
- choose the insertion stop for each date;
- automatically restagger all Calendar visits on that date;
- preserve the alternating 45/60-minute route timing;
- support vacation-maintenance customers without adding recurring series.
*/


/*
PMOS v1.7.1 — MATCHING CALENDAR JOB WINDOWS


Calendar Sync and Calendar Rebuild now open the same PMOS Job Engine window.


Both show:
- Run / Continue
- Auto Continue
- Pause
- progress
- remaining work
- errors
- Job History


The selected job is highlighted automatically. Opening Calendar Rebuild no
longer executes its first deletion batch before the controls appear.
*/


/*
PMOS v1.7.0 — JOB ENGINE FOUNDATION


Fixes:
- Calendar Plan Audit → Open Calendar Sync now launches the sync dialog before
  closing the audit dialog.


Adds one shared Job Engine for currently implemented PMOS work:
- Calendar Sync
- Calendar Rebuild
- Verify Calendar
- Sync Customer Database
- Export Updated Map Layers
- Job History


The Job Engine supports:
- one-batch Run / Continue;
- one-minute Auto Continue for Calendar Sync and Rebuild;
- Pause and later resume;
- persistent job state;
- job completion and error history.


No inventory, billing, or report jobs are exposed because those modules do not
yet exist.
*/


/*
PMOS v1.6.0 — CALENDAR STABILITY RELEASE


Calendar Plan Audit is now mandatory before Sync or Rebuild.


The audit reports:
- exact duplicate customer/layer rows;
- missing Customer IDs and Calendar Titles;
- invalid route layers and weekend assignments;
- duplicate, missing, or stale stop numbers;
- route timing that crosses into the next day;
- unique recurring-series count;
- a customer-frequency-based series estimate.


Safe repairs:
- assign missing Customer IDs;
- renumber stops and rebuild map labels;
- jump directly to the affected spreadsheet row.


Sync and Rebuild are blocked until all audit errors are resolved.
The development-only Test First Series menu item has been removed.
*/


/*
PMOS v1.5.9 COMPLETE REPLACEMENT


Persistent Calendar Auto Continue:
- Continue Sync runs one batch immediately.
- Auto Continue saves the job and runs the next batch every minute.
- The spreadsheet and browser may be closed while the trigger continues.
- Pause Auto Continue removes the trigger without losing completed work.
- The Calendar Series Registry remains the source of completed-series progress.


The visible Recalculate Routes job is intentionally omitted because PMOS
already renumbers stops and rebuilds map labels automatically after route edits.
*/


/*
PMOS v1.5.8 COMPLETE REPLACEMENT


Adds a persistent Calendar sync window:
- Continue Sync: next batch of up to 40 series
- Run Full Sync: automatically continues until finished
- Stop After This Batch: safely pauses automatic continuation


Successful recurring series are stored immediately in the Calendar Series
Registry, so subsequent batches skip completed work.
*/


/*
PMOS v1.5.7 COMPLETE REPLACEMENT


Critical recurring-calendar fix:


The previous compareSeriesPlanToRegistry_() function accidentally stored:
  plan: plan


where "plan" was the entire array of every recurring series.


It should have stored:
  plan: item


for the individual customer/rotation series.


Because createRecurringSeries_() received an array instead of one plan object,
plan.start was undefined and Google Calendar returned:
  Invalid argument: startTime


This version fixes that payload and preserves chronological processing:
Thursday Week 1, Friday Week 1, then Monday Week 2.
*/


/*
PMOS v1.5.6 COMPLETE REPLACEMENT


Corrections:
- recurring-series plan is sorted by actual upcoming start time;
- Thursday Week 1 is processed before future Monday routes;
- Update PMOS forcibly refreshes Installed Version and Current Release;
- failed rebuild state from prior versions is cleared during Update PMOS;
- Test First Series shows the code version and chronological first eight series.
*/


/*
PMOS v1.5.5 COMPLETE REPLACEMENT


Calendar rotation correction:
- Monday July 13, 2026 is defined as Rotation Week 1.
- The first new Calendar visits begin Thursday July 16, 2026.
- Friday July 17 remains Week 1.
- Monday July 20 begins Week 2.
- Monday/Tuesday/Wednesday Week 1 are not created in the past; their next
  occurrences are created four weeks later.
- If today's scheduled route time has already passed, that layer advances
  by a complete 28-day cycle.
*/


/*
PMOS v1.5.4 COMPLETE REPLACEMENT


Fixes repeated "Invalid argument: startTime" after valid diagnostics.


Cause:
The calculated first occurrences were aligned to April 2026 and were already
in the past. Calendar recurring-series creation can reject a past first start.


Fix:
- Preserve the original four-week rotation alignment.
- Advance each series by exact 28-day cycles until its first occurrence is
  today or later.
- Skip seasonal series with no remaining occurrence before November 30.
- Keep year-round customers recurring indefinitely.
*/


/*
PMOS v1.5.3 COMPLETE REPLACEMENT


Fixes "Invalid argument: startTime" by:
- reading the workbook's actual "Rotation Week 1 Monday" setting;
- normalizing all configured dates into the Calendar Year;
- supporting Date objects, spreadsheet serial dates, and text dates;
- accepting route-start times stored as text or a Sheets time value;
- validating every series start/end before calling Calendar;
- adding PMOS → Calendar → Test First Series.


The diagnostic shows the exact first customer, layer, start, end, and until dates.
*/


/*
PMOS v1.5.2 COMPLETE REPLACEMENT


Fixes the recurring-series creation failure in v1.5.1.


Root cause:
setTimeZone() returns EventRecurrence, but until() belongs to RecurrenceRule.
v1.5.1 attempted to call until() on the wrong object, causing every series
creation to fail.


This version keeps separate references to EventRecurrence and RecurrenceRule,
then applies the four-week interval and season end correctly.


It also displays the first Calendar error in the rebuild result.
*/


/*
PMOS v1.5.1 COMPLETE REPLACEMENT
Four-week recurring-series Calendar architecture.


Calendar name:
Water Maintenance Routes


Model:
- Every row in the 4-Week Route Template is one series repeating every 4 weeks.
- Weekly customers normally have four series.
- Biweekly customers normally have two series.
- Monthly customers normally have one series.
- Each rotation week keeps its own stop order and staggered 45/60-minute timing.


Calendar menu:
- Sync Calendar
- Rebuild Calendar
- Calendar Status


Rebuild Calendar is valid for both the first build and future full resets.
It removes PMOS-managed series in batches and recreates the current rotation.
*/


/*
PMOS v1.5.1 COMPLETE REPLACEMENT
Four-week Calendar series model.


Every route-template row becomes one recurring series repeating every four weeks.
Weekly customers have four series, biweekly customers two, and monthly customers one.
The previous event-heavy calendar is left untouched; PMOS creates and syncs
Water Maintenance Routes.
*/


/*
PMOS v1.4.4 COMPLETE REPLACEMENT
Adds authoritative Customers-sheet synchronization, automatic IDs, route propagation, and Calendar/app updates.
*/


/*
PMOS v1.4.3 COMPLETE REPLACEMENT


Built directly from the uploaded PMOS_v1.4.2_Code.gs.


Preserved:
- spreadsheet edits can update Calendar titles, descriptions, locations, and times;
- missing Calendar events can be created;
- obsolete matching events can be removed;
- chemistry catalog and quantity normalization;
- Update Center, Feature Lab, route history, and map exports.


Changed:
- Calendar synchronization processes one pending route layer per run;
- each run stops after 100 Calendar writes or about four minutes;
- pending changes remain until their layer is fully synchronized;
- rerunning Apply Calendar Changes safely continues;
- the result dialog clearly reports remaining work.


This file is intended to replace the current single Code.gs once.
After this version is verified, future PMOS development should use separate modules.
*/


const PMOS_VERSION = '1.9.0';
// Active recurring-calendar rotation anchor:
// Monday July 13, 2026 is Week 1, so the first new visits begin
// Thursday July 16, 2026 in Week 1.
const PMOS_RECURRING_WEEK1_MONDAY = new Date(2026, 6, 13, 12, 0, 0, 0);


const PMOS_MIN_SCHEMA_VERSION = 5;



function showNewMaintenanceClientNotice() {
  SpreadsheetApp.getUi().alert(
    'Schedule New Maintenance Client',
    'This feature will be enabled after the Calendar Job Engine is verified.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function onOpen() {
  const initialized = isPmosInitialized_();


  const menu = SpreadsheetApp.getUi().createMenu('PMOS');


  if (!initialized) {
    menu.addItem('Initialize PMOS', 'initializePmos');
  } else {
    menu
      .addItem('Open Route Manager', 'showRouteManagerLink')
      .addSeparator()
      .addSubMenu(
        SpreadsheetApp.getUi().createMenu('Calendar')
          .addItem('Schedule New Maintenance Client', 'showNewMaintenanceClientNotice')
          .addItem('Schedule Temporary Visit', 'showTemporaryVisitScheduler')
          .addSeparator()
          .addItem('Calendar Plan Audit', 'showCalendarAuditTaskWindow')
          .addItem('Calendar Job Engine', 'showPmosJobEngine')
      )
      .addSeparator()
      .addItem('Route History', 'showRouteHistoryDialog')
      .addItem('Chemistry Catalog', 'showChemistryCatalog')
      .addItem('Feature Lab', 'showFeatureLab')
      .addItem('Update Center', 'showUpdateCenter')
      .addItem('Update PMOS', 'updatePmos');
  }


  menu.addToUi();
}


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
  installOrRefreshTriggers_();
  protectCalculatedColumns_();
  normalizeRoutesFromPhysicalOrder_(false);
  storeRouteSignatures_();


  // A failed rebuild from an earlier code version must not remain stuck in
  // CREATE mode. The next Rebuild Calendar command will start cleanly.
  clearCalendarRebuildState_();


  props.setProperty('PMOS_INITIALIZED', 'true');
  props.setProperty('PMOS_VERSION', PMOS_VERSION);
  props.setProperty('PMOS_SCHEMA_VERSION', String(PMOS_MIN_SCHEMA_VERSION));


  // Rebuild the Update Center contents from the current code constant rather
  // than leaving an older display value in place.
  ensureUpdateCenterSheet_();
  writeUpdateCenterValue_('Installed Version', PMOS_VERSION);
  writeUpdateCenterValue_('Initialization Status', 'Initialized');
  writeUpdateCenterValue_('Last Successful Update', new Date());
  writeUpdateCenterValue_('Current Release', `PMOS v${PMOS_VERSION}`);
  writeUpdateCenterValue_('Pending Migration', 'None');
  writeUpdateCenterValue_(
    'What’s New',
    'Restored Job Engine controls, Calendar Sync/Rebuild access, Map Export execution, and Audit-to-Sync workflow'
  );


  ui.alert(
    'PMOS update complete',
    [
      `PMOS ${PMOS_VERSION} is installed.`,
      '',
      'Recurring-series creation now receives each individual customer plan.',
      'The first eligible route remains Thursday Week 1.',
      'Any failed rebuild state from an older version has been cleared.'
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
  let sheet = ss.getSheetByName('System Backups');


  if (!sheet) {
    sheet = ss.insertSheet('System Backups');
    sheet.appendRow(['Timestamp', 'Label', 'System Settings JSON']);
    sheet.hideSheet();
  }


  sheet.appendRow([new Date(), label, JSON.stringify(settings)]);
}


function ensureUpdateCenterSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName('Update Center');


  if (!sheet) sheet = ss.insertSheet('Update Center');


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
    ['What’s New', 'Calendar reconciliation; missing-event creation; address synchronization; edit detection', '']
  ];


  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 3);
}


function ensureFeatureLabSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName('Feature Lab');


  if (!sheet) sheet = ss.insertSheet('Feature Lab');


  if (sheet.getLastRow() > 1) return;


  const rows = [
    ['Feature', 'Status', 'Description', 'Risk Level'],
    ['Smart Chemistry Suggestions', 'Off', 'Guidance based on visit history', 'Preview'],
    ['Route Optimizer Suggestions', 'Off', 'Suggestions only; never automatic', 'Preview'],
    ['Technician Training Mode', 'Off', 'Additional prompts for newer technicians', 'Preview'],
    ['SpinLab Import', 'Off', 'Future WaterLink/SpinLab testing', 'Experimental'],
    ['Built-in Route Map', 'Off', 'Future planning and tracking map', 'Experimental'],
    ['Direct Calendar Sync', 'On', 'Approved route-time updates', 'Stable'],
    ['Spreadsheet Route Detection', 'On', 'Detect row moves and insertions', 'Stable'],
    ['Route Version History', 'On', 'Restorable route snapshots', 'Stable']
  ];


  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
}


function showUpdateCenter() {
  ensureUpdateCenterSheet_();


  const installed = PropertiesService.getDocumentProperties().getProperty('PMOS_VERSION') || 'Not initialized';
  const initialized = isPmosInitialized_() ? 'Initialized' : 'Not initialized';


  const html = HtmlService.createHtmlOutput(
    `<div style="font-family:Arial;padding:18px">
      <h2>PMOS Update Center</h2>
      <p><b>Installed:</b> ${escapeHtml_(installed)}</p>
      <p><b>Status:</b> ${escapeHtml_(initialized)}</p>
      <p><b>Current release:</b> ${PMOS_VERSION}</p>
      <hr>
      <h3>What’s new</h3>
      <ul>
        <li>One-time Initialize PMOS workflow</li>
        <li>Update PMOS with automatic backup</li>
        <li>Feature Lab switches</li>
        <li>Schema migrations that preserve existing data</li>
      </ul>
      <button onclick="google.script.run.withSuccessHandler(function(){google.script.host.close();}).updatePmos()">Install / Repair Update</button>
    </div>`
  ).setWidth(480).setHeight(420);


  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Update Center');
}


function showFeatureLab() {
  ensureFeatureLabSheet_();


  const sheet = SpreadsheetApp.getActive().getSheetByName('Feature Lab');
  const rows = sheet.getDataRange().getValues().slice(1);


  const htmlRows = rows.map((row, index) => {
    const checked = String(row[1]).toLowerCase() === 'on' ? 'checked' : '';
    const disabled = String(row[3]).toLowerCase() === 'stable' ? 'disabled' : '';


    return `<div style="border-bottom:1px solid #ddd;padding:10px 0">
      <label style="display:flex;gap:10px;align-items:flex-start">
        <input type="checkbox" ${checked} ${disabled}
          onchange="toggleFeature(${index + 2}, this.checked)">
        <span>
          <b>${escapeHtml_(row[0])}</b><br>
          <small>${escapeHtml_(row[2])} — ${escapeHtml_(row[3])}</small>
        </span>
      </label>
    </div>`;
  }).join('');


  const html = HtmlService.createHtmlOutput(
    `<div style="font-family:Arial;padding:18px">
      <h2>PMOS Feature Lab</h2>
      <p>Optional features can be tested without affecting the stable PMOS core.</p>
      ${htmlRows}
      <script>
        function toggleFeature(row, enabled) {
          google.script.run.setFeatureLabStatus(row, enabled ? 'On' : 'Off');
        }
      </script>
    </div>`
  ).setWidth(560).setHeight(560);


  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Feature Lab');
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


const PMOS = {
  ROUTES_SHEET: '4-Week Route Template',
  CUSTOMERS_SHEET: 'Customers',
  SETTINGS_SHEET: 'App Settings',
  VERSIONS_SHEET: 'Route Versions',
  PENDING_SHEET: 'Pending Route Changes',
  STATUS_SHEET: 'Sync Status',
  CALENDAR_NAME: 'Water Maintenance Routes',
  TIMEZONE: 'America/Toronto',
  CHANGE_TRIGGER_HANDLER: 'handlePmosSheetChange',
  EDIT_TRIGGER_HANDLER: 'handlePmosSheetEdit'
};


function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('PMOS Route Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


/* -------------------------------------------------------------------------- */
/* SPREADSHEET AUTOMATION                                                       */
/* -------------------------------------------------------------------------- */


function setupSpreadsheetAutomation() {
  if (!isPmosInitialized_()) { initializePmos(); return; }


  ensureSupportSheets_();


  installOrRefreshTriggers_();


  protectCalculatedColumns_();
  normalizeRoutesFromPhysicalOrder_(false);
  storeRouteSignatures_();
  updateSyncStatus_('Everything synchronized', 'No unapplied route changes.');


  SpreadsheetApp.getUi().alert(
    'PMOS setup complete',
    [
      'Stop Order and Map Label are now calculated from row position.',
      'Dragging or inserting route rows will be detected.',
      'Use PMOS → Preview Route Changes before applying Calendar updates.'
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


function protectCalculatedColumns_() {
  const sheet = getRoutesSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);


  ['Stop Order', 'Map Label'].forEach(name => {
    const index = headers.indexOf(name);
    if (index < 0) return;


    const range = sheet.getRange(1, index + 1, Math.max(sheet.getMaxRows(), 2), 1);
    const protection = range.protect();
    protection.setDescription(`PMOS calculated column: ${name}`);
    protection.setWarningOnly(true);
  });
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


/* -------------------------------------------------------------------------- */
/* SPREADSHEET MENU ACTIONS                                                     */
/* -------------------------------------------------------------------------- */


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


function exportAffectedMapLayersFromSheet() {
  const result = exportAffectedMapLayers();


  const html = HtmlService.createHtmlOutput(
    `<div style="font-family:Arial;padding:16px">
      <h3>Updated map layers created</h3>
      <p>${result.count} file(s) were created.</p>
      <p><a href="${result.folderUrl}" target="_blank">Open Drive folder</a></p>
    </div>`
  ).setWidth(400).setHeight(190);


  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Map Export');
}


function showRouteHistoryDialog() {
  const versions = listRouteVersions_().slice(0, 20);


  const rows = versions.map(v =>
    `<tr>
      <td style="padding:7px;border-bottom:1px solid #ddd">${escapeHtml_(v.timestamp)}</td>
      <td style="padding:7px;border-bottom:1px solid #ddd">${escapeHtml_(v.label)}</td>
      <td style="padding:7px;border-bottom:1px solid #ddd">
        <button onclick="restore('${v.id}')">Restore</button>
      </td>
    </tr>`
  ).join('');


  const html = HtmlService.createHtmlOutput(
    `<div style="font-family:Arial;padding:12px">
      <h3>Route History</h3>
      <table style="border-collapse:collapse;width:100%">${rows}</table>
      <script>
        function restore(id) {
          if (!confirm('Restore this version?')) return;
          google.script.run.withSuccessHandler(function() {
            google.script.host.close();
          }).restoreRouteVersion(id);
        }
      </script>
    </div>`
  ).setWidth(650).setHeight(500);


  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Route History');
}


/* -------------------------------------------------------------------------- */
/* WEB APP DATA AND ROUTE EDITING                                               */
/* -------------------------------------------------------------------------- */


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


function addCustomerToRoute(payload) {
  if (!payload || !payload.layer || !payload.title) {
    throw new Error('Missing customer information.');
  }


  ensureSupportSheets_();
  saveRouteVersion_('Before adding customer', snapshotRoutes_());


  const sheet = getRoutesSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(v => String(v).trim());
  const row = new Array(headers.length).fill('');


  setByHeader_(row, headers, 'Layer', payload.layer);
  setByHeader_(row, headers, 'Calendar Title', payload.title);
  setByHeader_(row, headers, 'Full Name(s)', payload.fullName || payload.title);
  setByHeader_(row, headers, 'Full Address', payload.address || '');
  setByHeader_(row, headers, 'Frequency', payload.frequency || 'weekly');
  setByHeader_(row, headers, 'Customer ID', payload.customerId || '');


  const layerCol = headers.indexOf('Layer');
  const routeIndexes = [];


  values.slice(1).forEach((existing, index) => {
    if (String(existing[layerCol] || '').trim() === payload.layer) {
      routeIndexes.push(index);
    }
  });


  const afterStop = Math.max(0, Number(payload.afterStop || 0));
  const insertionBodyIndex = routeIndexes.length
    ? routeIndexes[Math.min(afterStop, routeIndexes.length) - 1] + 1
    : values.length - 1;


  sheet.insertRowBefore(insertionBodyIndex + 2);
  sheet.getRange(insertionBodyIndex + 2, 1, 1, headers.length).setValues([row]);


  normalizeRoutesFromPhysicalOrder_(false);
  addPendingChange_(payload.layer, 1, 'Customer added');
  storeRouteSignatures_();
  updateSyncStatus_('Route changes pending', `${payload.title} was added to ${payload.layer}.`);


  return {
    ok: true,
    route: getRoute_(payload.layer),
    pending: getPendingChanges_()
  };
}


/* -------------------------------------------------------------------------- */
/* PREVIEW, CALENDAR, MAPS, HISTORY                                             */
/* -------------------------------------------------------------------------- */


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
  const actions = compareSeriesPlanToRegistry_(plan, registry, calendar);
  const batch = actions.slice(0, 40);


  let created = 0;
  let updated = 0;
  let deleted = 0;
  let errors = 0;
  let firstError = '';


  batch.forEach(item => {
    try {
      if (item.action === 'CREATE') {
        const series = createRecurringSeries_(calendar, item.plan);
        upsertSeriesRegistry_(item.plan, series.getId(), calendar.getName(), 'Active');
        created++;
      } else if (item.action === 'UPDATE') {
        let series = item.series;


        if (!series) {
          series = createRecurringSeries_(calendar, item.plan);
          created++;
        } else {
          updateRecurringSeries_(series, item.plan);
          updated++;
        }


        upsertSeriesRegistry_(item.plan, series.getId(), calendar.getName(), 'Active');
      } else if (item.action === 'DELETE') {
        if (item.series) item.series.deleteEventSeries();
        deleteSeriesRegistryRow_(item.seriesKey);
        deleted++;
      }
    } catch (error) {
      errors++;


      const message = `${item.action} ${item.seriesKey}: ${error}`;
      if (!firstError) firstError = message;


      console.error(message);
      markSeriesRegistryError_(item.seriesKey, String(error));
    }
  });


  const remaining = Math.max(0, actions.length - batch.length) + errors;


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
      firstError || `${errors} recurring-series error(s).`
    );
  } else {
    updateSyncStatus_(
      'Synchronization in progress',
      `${remaining} recurring-series change(s) remain.`
    );
  }


  return {
    created,
    updated,
    deleted,
    errors,
    firstError,
    remaining,
    calendarName: calendar.getName()
  };
}


function markPendingLayerComplete_(layer) {
  const sheet = SpreadsheetApp.getActive()
    .getSheetByName(PMOS.PENDING_SHEET);


  if (!sheet || sheet.getLastRow() < 2) return;


  const values = sheet.getRange(
    2,
    1,
    sheet.getLastRow() - 1,
    5
  ).getValues();


  const rowIndex = values.findIndex(row =>
    String(row[0]) === String(layer) &&
    String(row[3]) === 'Pending'
  );


  if (rowIndex >= 0) {
    sheet.getRange(rowIndex + 2, 1, 1, 5).clearContent();
  }
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


function restoreRouteVersion(versionId) {
  ensureSupportSheets_();
  saveRouteVersion_('Before restoring route version', snapshotRoutes_());


  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.VERSIONS_SHEET);
  const values = sheet.getDataRange().getValues();
  const match = values.slice(1).find(row => String(row[0]) === String(versionId));


  if (!match) throw new Error('Version not found.');


  const snapshot = JSON.parse(match[3]);
  restoreSnapshot_(snapshot);
  normalizeRoutesFromPhysicalOrder_(false);


  const layers = [...new Set(snapshot.rows.map(row => row.Layer).filter(Boolean))];
  layers.forEach(layer => addPendingChange_(layer, 0, 'Version restored'));


  storeRouteSignatures_();
  updateSyncStatus_('Route changes pending', 'A previous route version was restored.');


  return {
    ok: true,
    routes: readRoutesInPhysicalOrder_(),
    pending: getPendingChanges_()
  };
}




/* -------------------------------------------------------------------------- */
/* CUSTOMER DATABASE SYNCHRONIZATION                                           */
/* -------------------------------------------------------------------------- */


function syncCustomerDatabaseFromSheet() {
  const result = synchronizeCustomerDatabase_(true);


  SpreadsheetApp.getUi().alert(
    'Customer database synchronized',
    [
      `${result.idsCreated} Customer ID(s) created.`,
      `${result.routeRowsUpdated} route row(s) refreshed.`,
      `${result.routeRowsCreated} missing route row(s) created.`,
      `${result.changedLayers.length} route layer(s) marked for Calendar synchronization.`,
      '',
      result.changedLayers.length
        ? 'Use PMOS → Preview Route Changes, then Apply Calendar Changes.'
        : 'Everything is already synchronized.'
    ].join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


function synchronizeCustomerDatabase_(markPending) {
  ensureSupportSheets_();
  const idsCreated = ensureCustomerIds_();
  ensureRouteCustomerIdColumn_();


  const customerLookup = getCustomerLookup_();
  const routeSheet = getRoutesSheet_();
  const values = routeSheet.getDataRange().getValues();
  const headers = values[0].map(v => String(v).trim());


  const idCol = headers.indexOf('Customer ID');
  const layerCol = headers.indexOf('Layer');
  const titleCol = headers.indexOf('Calendar Title');
  const fullNameCol = headers.indexOf('Full Name(s)');
  const addressCol = headers.indexOf('Full Address');
  const frequencyCol = headers.indexOf('Frequency');
  const entryCol = headers.indexOf('Entry Information');
  const notesCol = headers.indexOf('Customer Notes');


  const changedLayers = new Set();
  let routeRowsUpdated = 0;


  for (let index = 1; index < values.length; index++) {
    const routeId = String(values[index][idCol] || '').trim();
    const routeTitle = String(values[index][titleCol] || '').trim();
    const customer = customerLookup.byId[routeId] ||
      customerLookup.byTitle[normalize_(routeTitle)];


    if (!customer) continue;


    const updates = [
      [idCol, customer['Customer ID']],
      [titleCol, customer['Calendar Title']],
      [fullNameCol, customer['Full Name(s)']],
      [addressCol, customer['Full Address']],
      [frequencyCol, customer['Frequency']],
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


  if (values.length > 1) {
    routeSheet.getRange(2, 1, values.length - 1, headers.length)
      .setValues(values.slice(1));
  }


  const creationResult = createMissingRouteRowsFromCustomers_(
    customerLookup.list,
    customerLookup.routeCustomerIds
  );


  creationResult.changedLayers.forEach(layer => changedLayers.add(layer));


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


  return {
    idsCreated,
    routeRowsUpdated,
    routeRowsCreated: creationResult.created,
    changedLayers: [...changedLayers]
  };
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
    const hasCustomer = String(values[index][titleCol] || '').trim() ||
      String(values[index][fullNameCol] || '').trim();


    let id = String(values[index][idCol] || '').trim();


    if (hasCustomer && !id) {
      do {
        maxNumber++;
        id = `PMOS-${String(maxNumber).padStart(5, '0')}`;
      } while (existing.has(id));


      existing.add(id);
      created++;
    }


    updates.push([id]);
  }


  if (updates.length) {
    sheet.getRange(2, idCol + 1, updates.length, 1).setValues(updates);
  }


  return created;
}


function ensureRouteCustomerIdColumn_() {
  const sheet = getRoutesSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0].map(v => String(v).trim());


  if (headers.includes('Customer ID')) return;


  const titleCol = headers.indexOf('Calendar Title');
  sheet.insertColumnAfter(titleCol >= 0 ? titleCol + 1 : sheet.getLastColumn());
  sheet.getRange(1, titleCol >= 0 ? titleCol + 2 : sheet.getLastColumn())
    .setValue('Customer ID');
}


function getCustomerLookup_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.CUSTOMERS_SHEET);
  if (!sheet) throw new Error(`Missing sheet: ${PMOS.CUSTOMERS_SHEET}`);


  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(v => String(v).trim());
  const list = [];
  const byId = {};
  const byTitle = {};


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
    });


  const routeCustomerIds = new Set(
    readRouteCustomerIdsWithoutCustomerLookup_()
  );


  return { list, byId, byTitle, routeCustomerIds };
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


  if (customer['Gate Code']) lines.push(`Gate code: ${customer['Gate Code']}`);
  if (customer['Lockbox Code']) lines.push(`Lockbox code: ${customer['Lockbox Code']}`);
  if (customer['Lockbox Location']) lines.push(`Lockbox: ${customer['Lockbox Location']}`);
  if (customer['Entry Notes']) lines.push(String(customer['Entry Notes']));


  return lines.join('\n').trim();
}


function eventMatchesCustomer_(event, row) {
  const description = String(event.getDescription() || '');


  if (row.customerId) {
    const marker = `PMOS_CUSTOMER_ID=${row.customerId}`;
    if (description.includes(marker)) return true;
  }


  return normalize_(event.getTitle()) === normalize_(row.title);
}




/* -------------------------------------------------------------------------- */
/* DATA HELPERS                                                                 */
/* -------------------------------------------------------------------------- */


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


function snapshotRoutes_() {
  const sheet = getRoutesSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);


  return {
    headers,
    rows: values.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => obj[header] = row[index]);
      return obj;
    })
  };
}


function restoreSnapshot_(snapshot) {
  const sheet = getRoutesSheet_();
  sheet.clearContents();
  sheet.getRange(1, 1, 1, snapshot.headers.length).setValues([snapshot.headers]);


  const rows = snapshot.rows.map(obj =>
    snapshot.headers.map(header => obj[header] == null ? '' : obj[header])
  );


  if (rows.length) {
    sheet.getRange(2, 1, rows.length, snapshot.headers.length).setValues(rows);
  }
}


function saveRouteVersion_(label, snapshot) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.VERSIONS_SHEET);
  sheet.appendRow([Utilities.getUuid(), new Date(), label, JSON.stringify(snapshot)]);
}


function listRouteVersions_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.VERSIONS_SHEET);
  return sheet.getDataRange().getValues().slice(1).reverse().map(row => ({
    id: String(row[0]),
    timestamp: row[1] instanceof Date
      ? Utilities.formatDate(row[1], PMOS.TIMEZONE, 'yyyy-MM-dd h:mm a')
      : String(row[1]),
    label: String(row[2])
  }));
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


function sameLocalDate_(left, right) {
  return Utilities.formatDate(left, PMOS.TIMEZONE, 'yyyy-MM-dd') ===
    Utilities.formatDate(right, PMOS.TIMEZONE, 'yyyy-MM-dd');
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


function parseLayer_(layer) {
  const match = String(layer).match(/^Week\s+(\d+)\s+-\s+(.+)$/i);
  if (!match) throw new Error(`Cannot parse layer: ${layer}`);


  return {
    week: Number(match[1]),
    routeDay: match[2],
    day: match[2].split(' - ')[0].trim()
  };
}


function parseTime_(text) {
  const match = String(text).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hours: 6, minutes: 0 };


  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const suffix = match[3].toUpperCase();


  if (suffix === 'PM' && hours !== 12) hours += 12;
  if (suffix === 'AM' && hours === 12) hours = 0;


  return { hours, minutes };
}


function routeSort_(a, b) {
  const left = parseLayer_(a);
  const right = parseLayer_(b);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];


  return left.week - right.week ||
    days.indexOf(left.day) - days.indexOf(right.day) ||
    a.localeCompare(b);
}


function setByHeader_(row, headers, header, value) {
  const index = headers.indexOf(header);
  if (index >= 0) row[index] = value;
}


function normalize_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2011\u2013\u2014-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function csvRow_(row) {
  return row.map(value =>
    `"${String(value == null ? '' : value).replace(/"/g, '""')}"`
  ).join(',');
}


function safeFilename_(value) {
  return String(value)
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_');
}


function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


/* ========================================================================== */
/* PMOS v1.4 CHEMICAL CATALOG + DOSAGE NORMALIZATION                           */
/* ========================================================================== */


const PMOS_CHEMISTRY = {
  PRODUCTS_SHEET: 'Chemical Products',
  USAGE_SHEET: 'Chemical Usage'
};


function getChemicalCatalog() {
  ensureChemicalSheets_();


  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_CHEMISTRY.PRODUCTS_SHEET);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];


  const headers = values[0].map(v => String(v).trim());


  return values.slice(1)
    .filter(row => String(row[headers.indexOf('Active')] || '').toLowerCase() !== 'no')
    .map(row => {
      const obj = {};
      headers.forEach((header, index) => obj[header] = row[index]);


      return {
        category: String(obj['Category'] || ''),
        product: String(obj['Product'] || ''),
        entryUnit: String(obj['Entry Unit'] || ''),
        metricType: String(obj['Metric Type'] || ''),
        metricPerUnit: Number(obj['Metric Per Unit'] || 0),
        metricUnit: String(obj['Metric Unit'] || ''),
        allowFractions: String(obj['Allow Fractions'] || '').toLowerCase() !== 'no',
        notes: String(obj['Notes'] || '')
      };
    })
    .filter(item => item.product)
    .sort((a, b) => a.category.localeCompare(b.category) || a.product.localeCompare(b.product));
}


function previewChemicalDose(productName, amountText) {
  const product = getChemicalCatalog().find(item => item.product === productName);
  if (!product) throw new Error(`Product not found: ${productName}`);


  const parsed = parseFlexibleQuantity_(amountText);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Enter a valid amount such as ½, 1/2, 0.5, 1 1/2, or 1.5.');
  }


  const normalized = normalizeChemicalAmount_(product, parsed);


  return {
    product,
    enteredAmount: String(amountText),
    parsedQuantity: parsed,
    normalizedMetricValue: normalized.metricValue,
    normalizedMetricUnit: normalized.metricUnit,
    displayRecord: normalized.displayRecord
  };
}


function saveChemicalUsage(payload) {
  ensureChemicalSheets_();


  if (!payload || !Array.isArray(payload.items) || !payload.items.length) {
    throw new Error('No chemical products were supplied.');
  }


  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_CHEMISTRY.USAGE_SHEET);
  const catalog = getChemicalCatalog();
  const byName = {};
  catalog.forEach(product => byName[product.product] = product);


  const rows = payload.items.map(item => {
    const product = byName[item.product];
    if (!product) throw new Error(`Unknown product: ${item.product}`);


    const parsed = parseFlexibleQuantity_(item.amount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`Invalid amount for ${item.product}: ${item.amount}`);
    }


    const normalized = normalizeChemicalAmount_(product, parsed);


    return [
      new Date(),
      payload.visitDate || '',
      payload.customerId || '',
      payload.customer || '',
      payload.technician || '',
      product.category,
      product.product,
      String(item.amount),
      product.entryUnit,
      parsed,
      normalized.metricValue,
      normalized.metricUnit,
      normalized.displayRecord,
      item.notes || ''
    ];
  });


  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);


  return {
    ok: true,
    count: rows.length,
    records: rows.map(row => ({
      product: row[6],
      displayRecord: row[12]
    }))
  };
}


function addChemicalProduct(payload) {
  ensureChemicalSheets_();


  const required = ['category','product','entryUnit','metricType','metricPerUnit','metricUnit'];
  required.forEach(field => {
    if (payload[field] === '' || payload[field] == null) {
      throw new Error(`Missing field: ${field}`);
    }
  });


  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_CHEMISTRY.PRODUCTS_SHEET);
  sheet.appendRow([
    payload.category,
    payload.product,
    payload.entryUnit,
    payload.metricType,
    Number(payload.metricPerUnit),
    payload.metricUnit,
    payload.allowFractions === false ? 'No' : 'Yes',
    'Yes',
    payload.notes || ''
  ]);


  return { ok: true };
}


function parseFlexibleQuantity_(input) {
  if (input == null) return NaN;


  let text = String(input).trim().toLowerCase();
  if (!text) return NaN;


  const unicodeFractions = {
    '¼': 1 / 4,
    '⅓': 1 / 3,
    '½': 1 / 2,
    '⅔': 2 / 3,
    '¾': 3 / 4,
    '⅛': 1 / 8,
    '⅜': 3 / 8,
    '⅝': 5 / 8,
    '⅞': 7 / 8
  };


  text = text.replace(/,/g, '.');
  text = text.replace(/\b(cups?|litres?|liters?|l|kgs?|kilograms?|bags?|jugs?|blocks?)\b/g, '').trim();


  let unicodeTotal = 0;
  Object.keys(unicodeFractions).forEach(symbol => {
    if (text.includes(symbol)) {
      unicodeTotal += unicodeFractions[symbol];
      text = text.replace(symbol, ' ');
    }
  });


  text = text.replace(/\s+/g, ' ').trim();


  let numericTotal = 0;


  if (text) {
    const mixedMatch = text.match(/^([+-]?\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixedMatch) {
      const whole = Number(mixedMatch[1]);
      const numerator = Number(mixedMatch[2]);
      const denominator = Number(mixedMatch[3]);
      if (!denominator) return NaN;
      numericTotal = whole + numerator / denominator;
    } else {
      const fractionMatch = text.match(/^([+-]?\d+)\s*\/\s*(\d+)$/);
      if (fractionMatch) {
        const numerator = Number(fractionMatch[1]);
        const denominator = Number(fractionMatch[2]);
        if (!denominator) return NaN;
        numericTotal = numerator / denominator;
      } else {
        const value = Number(text);
        if (!Number.isFinite(value)) return NaN;
        numericTotal = value;
      }
    }
  }


  return numericTotal + unicodeTotal;
}


function normalizeChemicalAmount_(product, unitQuantity) {
  const rawMetric = unitQuantity * Number(product.metricPerUnit || 0);
  const metricType = String(product.metricType || '').toLowerCase();
  const sourceUnit = String(product.metricUnit || '');


  if (metricType === 'volume') {
    let litres;


    if (sourceUnit.toLowerCase() === 'ml') {
      litres = rawMetric / 1000;
    } else {
      litres = rawMetric;
    }


    const totalMl = Math.round(litres * 1000);
    const wholeL = Math.floor(totalMl / 1000);
    const ml = totalMl % 1000;


    return {
      metricValue: roundTo_(litres, 6),
      metricUnit: 'L',
      displayRecord: formatLitresMillilitres_(wholeL, ml)
    };
  }


  if (metricType === 'mass') {
    let grams;


    if (sourceUnit.toLowerCase() === 'kg') {
      grams = rawMetric * 1000;
    } else if (sourceUnit.toLowerCase() === 'lb') {
      grams = rawMetric * 453.59237;
    } else {
      grams = rawMetric;
    }


    const roundedGrams = Math.round(grams);
    const kg = Math.floor(roundedGrams / 1000);
    const g = roundedGrams % 1000;


    return {
      metricValue: roundTo_(grams / 1000, 6),
      metricUnit: 'kg',
      displayRecord: formatKilogramsGrams_(kg, g)
    };
  }


  return {
    metricValue: roundTo_(rawMetric, 6),
    metricUnit: sourceUnit || product.entryUnit,
    displayRecord: `${roundTo_(rawMetric, 6)} ${sourceUnit || product.entryUnit}`
  };
}


function formatLitresMillilitres_(litres, millilitres) {
  if (litres && millilitres) return `${litres} L ${millilitres} mL`;
  if (litres) return `${litres} L`;
  return `${millilitres} mL`;
}


function formatKilogramsGrams_(kg, g) {
  if (kg && g) return `${kg} kg ${g} g`;
  if (kg) return `${kg} kg`;
  return `${g} g`;
}


function roundTo_(value, places) {
  const factor = Math.pow(10, places);
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}


function ensureChemicalSheets_() {
  const ss = SpreadsheetApp.getActive();


  let products = ss.getSheetByName(PMOS_CHEMISTRY.PRODUCTS_SHEET);
  if (!products) {
    products = ss.insertSheet(PMOS_CHEMISTRY.PRODUCTS_SHEET);
    products.appendRow([
      'Category','Product','Entry Unit','Metric Type','Metric Per Unit',
      'Metric Unit','Allow Fractions','Active','Notes'
    ]);
  }


  let usage = ss.getSheetByName(PMOS_CHEMISTRY.USAGE_SHEET);
  if (!usage) {
    usage = ss.insertSheet(PMOS_CHEMISTRY.USAGE_SHEET);
    usage.appendRow([
      'Timestamp','Visit Date','Customer ID','Customer','Technician','Category',
      'Product','Entered Amount','Entry Unit','Parsed Unit Quantity',
      'Normalized Metric Value','Normalized Metric Unit','Display Record','Notes'
    ]);
  }
}




function showChemistryCatalog() {
  const html = HtmlService.createHtmlOutput(
    `<div style="font-family:Arial;padding:18px">
      <h2>PMOS Chemistry Catalog</h2>
      <p>Select products in the PMOS app or edit the Chemical Products sheet.</p>
      <p>Accepted amounts include: ¼, 1/4, ½, 0.5, 1 1/2, and decimals.</p>
      <p>PMOS stores normalized records such as 1 L 250 mL or 2 kg 500 g.</p>
      <button onclick="google.script.run.withSuccessHandler(function(){google.script.host.close();}).ensureChemicalSheets_()">Repair Chemistry Sheets</button>
    </div>`
  ).setWidth(480).setHeight(300);


  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Chemistry Catalog');
}










function showCalendarSyncDialog() {
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}
    h2{margin:0 0 6px}.muted{color:#6b7280;font-size:13px}
    .status{margin-top:14px;padding:12px;border-radius:10px;background:#f3f4f6;white-space:pre-line}
    .progress{width:100%;height:14px;background:#e5e7eb;border-radius:8px;overflow:hidden;margin-top:12px}
    .bar{height:100%;width:0;background:#2563eb;transition:width .2s}
    .buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
    button{border:0;border-radius:8px;padding:9px 13px;font-weight:600;cursor:pointer}
    .primary{background:#2563eb;color:white}.secondary{background:#e5e7eb}.danger{background:#fee2e2;color:#991b1b}
    button:disabled{opacity:.5;cursor:default}.error{display:none;margin-top:10px;padding:10px;border-radius:8px;background:#fee2e2;color:#991b1b;white-space:pre-wrap}
  </style>
</head>
<body>
  <h2>PMOS Calendar Sync</h2>
  <div class="muted">Water Maintenance Routes · 40 recurring-series changes per batch</div>
  <div id="status" class="status">Checking Calendar status…</div>
  <div class="progress"><div id="bar" class="bar"></div></div>
  <div id="error" class="error"></div>


  <div class="buttons">
    <button id="nextButton" class="primary" onclick="runOneBatch()">Continue Sync</button>
    <button id="autoButton" class="primary" onclick="startAutoContinue()">Auto Continue</button>
    <button id="pauseButton" class="danger" onclick="pauseAutoContinue()">Pause Auto Continue</button>
    <button class="secondary" onclick="google.script.host.close()">Close</button>
  </div>


<script>
let originalTotal=0;
let running=false;
let pollTimer=null;


function showError(message){
  error.style.display='block';
  error.textContent=message||'Unknown error';
}


function clearError(){
  error.style.display='none';
  error.textContent='';
}


function updateProgress(remaining){
  if(!originalTotal){
    bar.style.width=remaining?'0%':'100%';
    return;
  }
  const completed=Math.max(0,originalTotal-remaining);
  bar.style.width=Math.min(100,Math.round(completed/originalTotal*100))+'%';
}


function renderState(state){
  const total=state.remaining||0;
  if(!originalTotal && state.originalTotal) originalTotal=state.originalTotal;


  status.textContent =
    'Job status: '+state.status+'\\n'+
    'Remaining changes: '+total+'\\n'+
    'Last batch created: '+(state.lastCreated||0)+'\\n'+
    'Last batch updated: '+(state.lastUpdated||0)+'\\n'+
    'Last batch removed: '+(state.lastDeleted||0)+'\\n'+
    'Last batch errors: '+(state.lastErrors||0)+'\\n'+
    (state.nextRunAt ? 'Next automatic batch: '+state.nextRunAt : '');


  updateProgress(total);


  nextButton.disabled=running || state.status==='Running';
  autoButton.disabled=running || state.autoEnabled;
  pauseButton.disabled=!state.autoEnabled;


  if(state.lastError) showError(state.lastError);
  if(!total && state.status==='Complete'){
    status.textContent='Calendar synchronization is complete.\\nAll recurring series are current.';
    updateProgress(0);
  }
}


function refreshState(){
  google.script.run
    .withSuccessHandler(renderState)
    .withFailureHandler(function(e){showError(e&&e.message?e.message:String(e));})
    .getCalendarAutoSyncStatus();
}


function runOneBatch(){
  if(running)return;
  clearError();
  running=true;
  nextButton.disabled=true;
  status.textContent='Synchronizing the next batch…';


  google.script.run
    .withSuccessHandler(function(result){
      running=false;
      refreshState();
    })
    .withFailureHandler(function(e){
      running=false;
      showError(e&&e.message?e.message:String(e));
      refreshState();
    })
    .runCalendarSyncBatchNow();
}


function startAutoContinue(){
  clearError();
  google.script.run
    .withSuccessHandler(function(){
      refreshState();
    })
    .withFailureHandler(function(e){
      showError(e&&e.message?e.message:String(e));
    })
    .startCalendarAutoContinue();
}


function pauseAutoContinue(){
  google.script.run
    .withSuccessHandler(function(){
      refreshState();
    })
    .withFailureHandler(function(e){
      showError(e&&e.message?e.message:String(e));
    })
    .pauseCalendarAutoContinue();
}


refreshState();
pollTimer=setInterval(refreshState,10000);
</script>
</body>
</html>`)
    .setWidth(540)
    .setHeight(540);


  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Calendar Sync');
}










/* ========================================================================== */
/* PMOS v1.7.0 SHARED JOB ENGINE                                               */
/* ========================================================================== */


const PMOS_JOB_STATE_KEY = 'PMOS_ACTIVE_JOB_V1';
const PMOS_JOB_TRIGGER_HANDLER = 'runPmosJobTrigger_';
const PMOS_JOB_HISTORY_SHEET = 'PMOS Job History';


const PMOS_JOB_TYPES = {
  CALENDAR_SYNC: {
    label: 'Calendar Sync',
    description: 'Create, update, and remove recurring Calendar series to match the verified plan.',
    supportsAuto: true
  },
  CALENDAR_REBUILD: {
    label: 'Calendar Rebuild',
    description: 'Delete PMOS-managed recurring series and recreate the verified four-week plan.',
    supportsAuto: true
  },
  VERIFY_CALENDAR: {
    label: 'Verify Calendar',
    description: 'Compare the verified plan, registry, and Calendar and report missing or mismatched series.',
    supportsAuto: false
  },
  CUSTOMER_SYNC: {
    label: 'Sync Customer Database',
    description: 'Generate IDs and propagate current customer information into routes and PMOS.',
    supportsAuto: false
  },
  MAP_EXPORT: {
    label: 'Export Updated Map Layers',
    description: 'Export the currently affected route layers into a new Drive folder.',
    supportsAuto: false
  }
};


function showPmosJobEngine(initialType) {
  ensurePmosJobHistorySheet_();

  const rememberedJobType = PropertiesService.getUserProperties()
    .getProperty('PMOS_LAST_JOB_TYPE') || '';
  const selectedJobType = PMOS_JOB_TYPES[initialType]
    ? initialType
    : (PMOS_JOB_TYPES[rememberedJobType] ? rememberedJobType : 'CALENDAR_SYNC');

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body{font-family:Arial,sans-serif;padding:18px;color:#1f2937;margin:0}
    h2{margin:0 0 5px}.muted{font-size:13px;color:#6b7280}
    .layout{display:grid;grid-template-columns:250px 1fr;gap:14px;margin-top:15px}
    .jobs{display:flex;flex-direction:column;gap:7px}
    .job{width:100%;text-align:left;background:#fff;border:2px solid #e5e7eb;border-radius:9px;padding:10px 11px;cursor:pointer;font:inherit;font-weight:700;color:#1f2937}
    .job:hover{background:#f8fafc}.job.selected{border-color:#2563eb;background:#eff6ff}
    .panel{border:1px solid #e5e7eb;border-radius:10px;padding:14px;background:#fff}
    .panel h3{margin:0 0 8px;font-size:15px}.purpose{min-height:62px;line-height:1.45;color:#374151}
    .status{margin-top:12px;padding:12px;background:#f3f4f6;border-radius:9px;white-space:pre-line;min-height:112px}
    .progress{height:14px;background:#e5e7eb;border-radius:8px;overflow:hidden;margin-top:10px}
    .bar{height:100%;width:0;background:#2563eb;transition:width .2s}
    .buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}
    button.action{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}
    .primary{background:#2563eb;color:#fff}.secondary{background:#e5e7eb;color:#111827}.danger{background:#fee2e2;color:#991b1b}
    button:disabled{opacity:.45;cursor:default}.error{display:none;margin-top:10px;padding:10px;background:#fee2e2;color:#991b1b;border-radius:8px;white-space:pre-wrap}
  </style>
</head>
<body>
  <h2>PMOS Calendar Job Engine</h2>
  <div class="muted">Select an operation, review its purpose, then run it.</div>
  <div class="layout">
    <div class="jobs">
      <button class="job" data-type="CALENDAR_SYNC" onclick="selectJob(this)">Calendar Sync</button>
      <button class="job" data-type="CALENDAR_REBUILD" onclick="selectJob(this)">Calendar Rebuild</button>
      <button class="job" data-type="VERIFY_CALENDAR" onclick="selectJob(this)">Verify Calendar</button>
      <button class="job" data-type="CALENDAR_STATUS" onclick="selectJob(this)">Calendar Status</button>
      <button class="job" data-type="CUSTOMER_SYNC" onclick="selectJob(this)">Customer Database Sync</button>
      <button class="job" data-type="MAP_EXPORT" onclick="selectJob(this)">Export Updated Map Layers</button>
    </div>
    <div class="panel">
      <h3>Purpose</h3>
      <div id="purpose" class="purpose"></div>
      <div id="statusBox" class="status">Loading current status…</div>
      <div class="progress"><div id="progressBar" class="bar"></div></div>
      <div id="errorBox" class="error"></div>
      <div class="buttons">
        <button id="runButton" class="action primary" onclick="runSelected(false)">Run / Continue</button>
        <button id="autoButton" class="action primary" onclick="runSelected(true)">Auto Continue</button>
        <button id="pauseButton" class="action danger" onclick="pauseJob()">Pause</button>
        <button class="action secondary" onclick="refreshState()">Refresh</button>
        <button class="action secondary" onclick="openHistory()">Job History</button>
        <button class="action secondary" onclick="google.script.host.close()">Close</button>
      </div>
    </div>
  </div>
<script>
var selectedType=${JSON.stringify(selectedJobType)};
var currentState={};
var busy=false;
var purposes={
  CALENDAR_SYNC:'Synchronize recurring Google Calendar events with the verified PMOS route plan.',
  CALENDAR_REBUILD:'Remove PMOS-managed recurring events and rebuild them from the current verified route plan.',
  VERIFY_CALENDAR:'Compare PMOS with Google Calendar and report inconsistencies without making changes.',
  CALENDAR_STATUS:'Display the current synchronization status and pending Calendar work.',
  CUSTOMER_SYNC:'Synchronize customer records and propagate current customer information through PMOS.',
  MAP_EXPORT:'Generate updated map-layer export files for routes containing pending changes.'
};
function byId(id){return document.getElementById(id);}
function fail(error){busy=false;showError(error&&error.message?error.message:String(error));updateButtons();}
function showError(message){byId('errorBox').style.display='block';byId('errorBox').textContent=message||'Unknown error';}
function clearError(){byId('errorBox').style.display='none';byId('errorBox').textContent='';}
function selectJob(button){selectedType=button.getAttribute('data-type');renderSelection();google.script.run.rememberPmosJobType(selectedType);}
function renderSelection(){
  var jobs=document.getElementsByClassName('job');
  for(var i=0;i<jobs.length;i++){jobs[i].className='job'+(jobs[i].getAttribute('data-type')===selectedType?' selected':'');}
  byId('purpose').textContent=purposes[selectedType]||'';
  updateButtons();
}
function setBusy(value){busy=value;updateButtons();}
function updateButtons(){
  var active=currentState&&currentState.type&&currentState.status!=='Complete'&&currentState.status!=='Cancelled';
  byId('runButton').disabled=busy||!selectedType;
  byId('autoButton').style.display=(selectedType==='CALENDAR_SYNC'||selectedType==='CALENDAR_REBUILD')?'inline-block':'none';
  byId('autoButton').disabled=busy;
  byId('pauseButton').disabled=busy||!active;
  byId('runButton').textContent=selectedType==='CALENDAR_STATUS'?'Open Status':selectedType==='VERIFY_CALENDAR'?'Run Verification':selectedType==='CUSTOMER_SYNC'?'Run Sync':selectedType==='MAP_EXPORT'?'Export':'Run / Continue';
}
function renderState(state){
  currentState=state||{};
  var percent=currentState.status==='Complete'?100:0;
  if(currentState.originalTotal>0&&currentState.remaining!=null){percent=Math.min(100,Math.round((currentState.originalTotal-currentState.remaining)/currentState.originalTotal*100));}
  byId('progressBar').style.width=percent+'%';
  byId('statusBox').textContent='Job: '+(currentState.label||'No active job')+'\nStatus: '+(currentState.status||'Idle')+'\nCompleted batches: '+(currentState.completedBatches||0)+'\nProcessed items: '+(currentState.processedItems||0)+'\nRemaining: '+(currentState.remaining==null?'—':currentState.remaining)+(currentState.lastSummary?'\nLast result: '+currentState.lastSummary:'');
  if(currentState.lastError){showError(currentState.lastError);}else{clearError();}
  setBusy(false);
}
function renderTask(response){
  byId('progressBar').style.width='100%';
  byId('statusBox').textContent=response&&response.summary?response.summary:'Task complete.';
  setBusy(false);
}
function refreshState(){setBusy(true);google.script.run.withSuccessHandler(renderState).withFailureHandler(fail).getPmosJobStatus();}
function runSelected(autoMode){
  clearError();setBusy(true);
  if(selectedType==='CALENDAR_STATUS'){
    google.script.run.withSuccessHandler(renderTask).withFailureHandler(fail).runPmosTask('CALENDAR_STATUS');return;
  }
  google.script.run.withSuccessHandler(renderState).withFailureHandler(fail).startPmosJob(selectedType,autoMode,false);
}
function pauseJob(){setBusy(true);google.script.run.withSuccessHandler(renderState).withFailureHandler(fail).pausePmosJob();}
function openHistory(){google.script.run.withFailureHandler(fail).showPmosJobHistory();}
renderSelection();refreshState();
</script>
</body>
</html>`)
    .setWidth(820)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Calendar Job Engine');
}




function rememberPmosJobType(type) {
  return rememberPmosJobType_(type);
}


function startPmosJob(type, autoMode, openEngine) {
  return startPmosJob_(type, autoMode, openEngine);
}


function pausePmosJob() {
  return pausePmosJob_();
}


function runPmosTask(taskType) {
  return runPmosTask_(taskType);
}


function suggestTemporaryVisitPlacement(payload) {
  return suggestTemporaryVisitPlacement_(payload);
}


function recommendTemporaryVisitDates(payload) {
  return recommendTemporaryVisitDates_(payload);
}


function scheduleTemporaryVisits(payload) {
  return scheduleTemporaryVisits_(payload);
}


function rememberPmosJobType_(type) {
  if (PMOS_JOB_TYPES[type]) {
    PropertiesService.getUserProperties().setProperty('PMOS_LAST_JOB_TYPE', type);
  }
  return type;
}


function showPmosJobEngineFor_(type) {
  if (!PMOS_JOB_TYPES[type]) {
    throw new Error(`Unknown PMOS job type: ${type}`);
  }


  if (
    type === 'CALENDAR_SYNC' ||
    type === 'CALENDAR_REBUILD'
  ) {
    const audit = runCalendarPlanAudit_();


    if (!audit.canSync) {
      showCalendarPlanAudit();
      return;
    }
  }


  showPmosJobEngine(type);
}


function startCalendarSyncJobFromMenu() {
  showPmosJobEngineFor_('CALENDAR_SYNC');
}
function startCalendarRebuildJobFromMenu() {
  showPmosJobEngineFor_('CALENDAR_REBUILD');
}
function startVerifyCalendarJobFromMenu() {
  showPmosJobEngineFor_('VERIFY_CALENDAR');
}
function startCustomerSyncJobFromMenu() {
  showPmosJobEngineFor_('CUSTOMER_SYNC');
}
function startMapExportJobFromMenu() {
  showPmosJobEngineFor_('MAP_EXPORT');
}


function startPmosJob_(type, autoMode, openEngine) {
  if (!PMOS_JOB_TYPES[type]) {
    throw new Error(`Unknown PMOS job type: ${type}`);
  }


  const existing = readPmosJobState_();


  if (
    existing &&
    existing.status !== 'Complete' &&
    existing.status !== 'Cancelled' &&
    existing.type !== type
  ) {
    throw new Error(
      `${existing.label || existing.type} is already active. Pause or complete it before starting another job.`
    );
  }


  if (
    type === 'CALENDAR_SYNC' ||
    type === 'CALENDAR_REBUILD'
  ) {
    const audit = runCalendarPlanAudit_();
    if (!audit.canSync) {
      showCalendarPlanAudit();
      return getPmosJobStatus();
    }
  }


  let state = existing && existing.type === type
    ? existing
    : newPmosJobState_(type);


  state.autoEnabled =
    Boolean(autoMode) &&
    Boolean(PMOS_JOB_TYPES[type].supportsAuto);
  state.status = 'Ready';
  state.lastError = '';


  if (type === 'CALENDAR_REBUILD' && !getCalendarRebuildState_()) {
    setCalendarRebuildState_({
      phase: 'DELETE',
      startedAt: new Date().toISOString()
    });
  }


  writePmosJobState_(state);


  if (state.autoEnabled) {
    ensurePmosJobTrigger_();
  }


  const result = runPmosJobBatch_();


  if (openEngine) {
    showPmosJobEngine();
  }


  return result;
}


function pausePmosJob_() {
  const state = readPmosJobState_();


  if (!state) return getPmosJobStatus();


  state.autoEnabled = false;
  state.status = 'Paused';
  state.nextRunAt = '';
  writePmosJobState_(state);
  removePmosJobTrigger_();


  return getPmosJobStatus();
}


function getPmosJobStatus() {
  const state = readPmosJobState_();


  if (!state) {
    return {
      type: '',
      label: 'No active job',
      status: 'Idle',
      autoEnabled: false,
      completedBatches: 0,
      processedItems: 0,
      originalTotal: 0,
      remaining: null,
      lastSummary: '',
      lastError: '',
      nextRunAt: ''
    };
  }


  return {
    type: state.type,
    label: state.label,
    status: state.status,
    autoEnabled: Boolean(state.autoEnabled),
    completedBatches: Number(state.completedBatches || 0),
    processedItems: Number(state.processedItems || 0),
    originalTotal: Number(state.originalTotal || 0),
    remaining: state.remaining == null ? null : Number(state.remaining),
    lastSummary: String(state.lastSummary || ''),
    lastError: String(state.lastError || ''),
    nextRunAt: formatCalendarJobDate_(state.nextRunAt)
  };
}


function runPmosJobTrigger_() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) return;


  try {
    const state = readPmosJobState_();


    if (!state || !state.autoEnabled) {
      removePmosJobTrigger_();
      return;
    }


    runPmosJobBatch_();
  } finally {
    lock.releaseLock();
  }
}


function runPmosJobBatch_() {
  let state = readPmosJobState_();
  if (!state) throw new Error('No active PMOS job.');


  state.status = 'Running';
  state.lastError = '';
  state.lastRunAt = new Date().toISOString();
  writePmosJobState_(state);


  let result;


  try {
    result = executePmosJobBatch_(state.type);
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    state.status = 'Paused on error';
    state.autoEnabled = false;
    state.lastError = message;
    state.nextRunAt = '';


    try {
      writePmosJobState_(state);
      removePmosJobTrigger_();
      appendPmosJobHistory_(state, 'ERROR', message);
    } catch (finalizationError) {
      throw new Error(
        `Calendar work stopped or completed, but PMOS could not save the final status. ` +
        `Original result: ${message}. Status-write error: ${finalizationError}`
      );
    }


    throw error;
  }


  state.completedBatches = Number(state.completedBatches || 0) + 1;
  state.processedItems =
    Number(state.processedItems || 0) +
    Number(result.processed || 0);
  state.remaining = result.remaining == null
    ? 0
    : Number(result.remaining);
  state.originalTotal = Math.max(
    Number(state.originalTotal || 0),
    state.processedItems + state.remaining
  );
  state.lastSummary = String(result.summary || '');
  state.lastError = String(result.error || '');


  if (result.complete) {
    state.status = 'Complete';
    state.autoEnabled = false;
    state.nextRunAt = '';
    removePmosJobTrigger_();
    appendPmosJobHistory_(state, 'COMPLETE', state.lastSummary);
  } else if (state.lastError) {
    state.status = 'Paused on error';
    state.autoEnabled = false;
    state.nextRunAt = '';
    removePmosJobTrigger_();
    appendPmosJobHistory_(state, 'ERROR', state.lastError);
  } else if (state.autoEnabled) {
    state.status = 'Waiting';
    state.nextRunAt = new Date(
      Date.now() + 60 * 1000
    ).toISOString();
    ensurePmosJobTrigger_();
  } else {
    state.status = 'Paused';
    state.nextRunAt = '';
  }


  writePmosJobState_(state);
  return getPmosJobStatus();
}


function executePmosJobBatch_(type) {
  switch (type) {
    case 'CALENDAR_SYNC':
      return executeCalendarSyncJobBatch_();


    case 'CALENDAR_REBUILD':
      return executeCalendarRebuildJobBatch_();


    case 'VERIFY_CALENDAR':
      return executeVerifyCalendarJob_();


    case 'CUSTOMER_SYNC':
      return executeCustomerSyncJob_();


    case 'MAP_EXPORT':
      return executeMapExportJob_();


    default:
      throw new Error(`Unsupported PMOS job: ${type}`);
  }
}


function executeCalendarSyncJobBatch_() {
  const result = applyCalendarChanges();


  return {
    processed:
      Number(result.created || 0) +
      Number(result.updated || 0) +
      Number(result.deleted || 0),
    remaining: Number(result.remaining || 0),
    complete:
      Number(result.remaining || 0) === 0 &&
      Number(result.errors || 0) === 0,
    summary:
      `${result.created || 0} created, ` +
      `${result.updated || 0} updated, ` +
      `${result.deleted || 0} removed`,
    error: String(result.firstError || '')
  };
}


function executeCalendarRebuildJobBatch_() {
  if (!getCalendarRebuildState_()) {
    setCalendarRebuildState_({
      phase: 'DELETE',
      startedAt: new Date().toISOString()
    });
  }


  const result = continueCalendarRebuild_();


  return {
    processed:
      Number(result.created || 0) +
      Number(result.updated || 0) +
      Number(result.deleted || 0),
    remaining: Number(result.remaining || 0),
    complete: Boolean(result.complete),
    summary:
      `${result.phase}: ` +
      `${result.deleted || 0} removed, ` +
      `${result.created || 0} created, ` +
      `${result.updated || 0} updated`,
    error: String(result.firstError || '')
  };
}


function executeVerifyCalendarJob_() {
  const audit = runCalendarPlanAudit_();
  const preview = previewCalendarChanges();
  const registry = getSeriesRegistry_();


  const discrepancies =
    Number(preview.creates || 0) +
    Number(preview.updates || 0) +
    Number(preview.deletes || 0);


  const summary = [
    `Audit errors: ${audit.errorCount}`,
    `Audit warnings: ${audit.warningCount}`,
    `Expected series: ${audit.uniqueSeriesCount}`,
    `Registered series: ${Object.keys(registry).length}`,
    `Calendar discrepancies: ${discrepancies}`
  ].join('; ');


  return {
    processed:
      audit.uniqueSeriesCount +
      Object.keys(registry).length,
    remaining: discrepancies,
    complete: true,
    summary,
    error: ''
  };
}


function executeCustomerSyncJob_() {
  const result = synchronizeCustomerDatabase_(true);


  return {
    processed:
      Number(result.idsCreated || 0) +
      Number(result.routeRowsUpdated || 0) +
      Number(result.routeRowsCreated || 0),
    remaining: 0,
    complete: true,
    summary:
      `${result.idsCreated || 0} IDs created, ` +
      `${result.routeRowsUpdated || 0} route rows updated, ` +
      `${result.routeRowsCreated || 0} route rows created`,
    error: ''
  };
}


function executeMapExportJob_() {
  const result = exportAffectedMapLayers();


  return {
    processed: Number(result.count || 0),
    remaining: 0,
    complete: true,
    summary:
      `${result.count || 0} map layer file(s) exported to ${result.folderName}`,
    error: ''
  };
}


function newPmosJobState_(type) {
  const definition = PMOS_JOB_TYPES[type];


  return {
    id: Utilities.getUuid(),
    type,
    label: definition.label,
    status: 'Ready',
    autoEnabled: false,
    createdAt: new Date().toISOString(),
    lastRunAt: '',
    nextRunAt: '',
    completedBatches: 0,
    processedItems: 0,
    originalTotal: 0,
    remaining: null,
    lastSummary: '',
    lastError: ''
  };
}


function readPmosJobState_() {
  const raw = PropertiesService.getDocumentProperties()
    .getProperty(PMOS_JOB_STATE_KEY);


  if (!raw) return null;


  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}


function writePmosJobState_(state) {
  withSpreadsheetServiceRetry_(
    () => {
      PropertiesService.getDocumentProperties()
        .setProperty(PMOS_JOB_STATE_KEY, JSON.stringify(state));
      SpreadsheetApp.flush();
      return true;
    },
    'saving PMOS job progress'
  );
}


function ensurePmosJobTrigger_() {
  const existing = ScriptApp.getProjectTriggers()
    .filter(trigger =>
      trigger.getHandlerFunction() ===
      PMOS_JOB_TRIGGER_HANDLER
    );


  if (!existing.length) {
    ScriptApp.newTrigger(PMOS_JOB_TRIGGER_HANDLER)
      .timeBased()
      .everyMinutes(1)
      .create();
  }
}


function removePmosJobTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter(trigger =>
      trigger.getHandlerFunction() ===
      PMOS_JOB_TRIGGER_HANDLER
    )
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
}


function ensurePmosJobHistorySheet_() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(PMOS_JOB_HISTORY_SHEET);


  if (!sheet) {
    sheet = ss.insertSheet(PMOS_JOB_HISTORY_SHEET);
    sheet.appendRow([
      'Timestamp',
      'Job ID',
      'Job Type',
      'Job Name',
      'Result',
      'Batches',
      'Processed Items',
      'Summary'
    ]);
    sheet.hideSheet();
  }


  return sheet;
}


function appendPmosJobHistory_(state, result, summary) {
  withSpreadsheetServiceRetry_(
    () => {
      const sheet = ensurePmosJobHistorySheet_();
      sheet.appendRow([
        new Date(),
        state.id || '',
        state.type || '',
        state.label || '',
        result || '',
        Number(state.completedBatches || 0),
        Number(state.processedItems || 0),
        summary || ''
      ]);
      SpreadsheetApp.flush();
      return true;
    },
    'writing PMOS Job History'
  );
}


function showPmosJobHistory() {
  const sheet = ensurePmosJobHistorySheet_();
  const rows = sheet.getDataRange().getValues()
    .slice(1)
    .reverse()
    .slice(0, 50);


  const body = rows.length
    ? rows.map(row => `
      <tr>
        <td>${escapeHtml_(formatJobHistoryDate_(row[0]))}</td>
        <td>${escapeHtml_(row[3])}</td>
        <td>${escapeHtml_(row[4])}</td>
        <td>${escapeHtml_(row[5])}</td>
        <td>${escapeHtml_(row[6])}</td>
        <td>${escapeHtml_(row[7])}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="6">No completed jobs yet.</td></tr>';


  const html = HtmlService.createHtmlOutput(`
    <div style="font-family:Arial;padding:16px">
      <h2>PMOS Job History</h2>
      <table style="border-collapse:collapse;width:100%;font-size:13px">
        <thead>
          <tr>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:7px">Time</th>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:7px">Job</th>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:7px">Result</th>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:7px">Batches</th>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:7px">Items</th>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:7px">Summary</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `).setWidth(900).setHeight(560);


  SpreadsheetApp.getUi().showModalDialog(
    html,
    'PMOS Job History'
  );
}


function formatJobHistoryDate_(value) {
  const date = value instanceof Date
    ? value
    : new Date(value);


  if (!Number.isFinite(date.getTime())) return String(value || '');


  return Utilities.formatDate(
    date,
    PMOS.TIMEZONE,
    'yyyy-MM-dd h:mm a'
  );
}








/* ========================================================================== */
/* PMOS v1.8.2 PROFESSIONAL TASK WINDOWS + SERVICE RESILIENCE                  */
/* ========================================================================== */


function showCalendarAuditTaskWindow() {
  showPmosTaskWindow_('CALENDAR_AUDIT', 'Calendar Plan Audit');
}
function showCalendarStatusTaskWindow() {
  showPmosTaskWindow_('CALENDAR_STATUS', 'Calendar Status');
}
function showVerifyCalendarTaskWindow() {
  showPmosTaskWindow_('VERIFY_CALENDAR', 'Verify Calendar');
}
function showCustomerSyncTaskWindow() {
  showPmosTaskWindow_('CUSTOMER_SYNC', 'Sync Customer Database');
}
function showMapExportTaskWindow() {
  showPmosTaskWindow_('MAP_EXPORT', 'Export Updated Map Layers');
}


function showPmosTaskWindow_(taskType, taskTitle) {
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}
    h2{margin:0 0 5px}.muted{font-size:13px;color:#6b7280}
    .stage{margin-top:16px;font-weight:700}
    .barShell{height:16px;background:#e5e7eb;border-radius:9px;overflow:hidden;margin-top:9px;position:relative}
    .bar{height:100%;width:35%;background:#2563eb;position:absolute;animation:move 1.25s infinite ease-in-out;border-radius:9px}
    @keyframes move{0%{left:-35%}100%{left:100%}}
    .elapsed{text-align:right;font-size:13px;margin-top:5px;color:#4b5563}
    .result{margin-top:14px;padding:12px;background:#f3f4f6;border-radius:9px;white-space:pre-line;max-height:330px;overflow:auto}
    .buttons{display:flex;gap:8px;margin-top:14px}
    button{border:0;border-radius:8px;padding:9px 13px;font-weight:600;cursor:pointer}.primary{background:#2563eb;color:white}.secondary{background:#e5e7eb}
    .complete .bar{width:100%;left:0;animation:none}.failed .bar{width:100%;left:0;animation:none}
  </style>
</head>
<body id="body">
  <h2>${escapeHtml_(taskTitle)}</h2>
  <div class="muted">This window remains active while PMOS completes the operation.</div>
  <div id="stage" class="stage">Working…</div>
  <div class="barShell"><div id="bar" class="bar"></div></div>
  <div id="elapsed" class="elapsed">Elapsed: 0s</div>
  <div id="result" class="result">Starting ${escapeHtml_(taskTitle)}…</div>
  <div class="buttons">
    <button id="syncButton" class="primary" style="display:none" onclick="openCalendarSync()">Open Calendar Sync</button>
    <button class="secondary" onclick="google.script.host.close()">Close</button>
  </div>
<script>
const body=document.getElementById('body');
const stage=document.getElementById('stage');
const elapsed=document.getElementById('elapsed');
const result=document.getElementById('result');
const syncButton=document.getElementById('syncButton');
const started=Date.now();
const clock=setInterval(()=>{elapsed.textContent='Elapsed: '+Math.floor((Date.now()-started)/1000)+'s';},1000);
google.script.run
  .withSuccessHandler(function(response){
    clearInterval(clock);body.classList.add('complete');stage.textContent='Complete';
    elapsed.textContent='Duration: '+Math.max(1,Math.round((Date.now()-started)/1000))+'s';
    result.textContent=response.summary||'Task completed.';
    if('${taskType}'==='CALENDAR_AUDIT' && response.canSync){syncButton.style.display='inline-block';}
  })
  .withFailureHandler(function(error){
    clearInterval(clock);body.classList.add('failed');stage.textContent='Needs attention';
    result.textContent=error&&error.message?error.message:String(error);
  })
  .runPmosTask('${taskType}');
function openCalendarSync(){
  syncButton.disabled=true;
  google.script.run
    .withSuccessHandler(function(){google.script.host.close();})
    .withFailureHandler(function(error){syncButton.disabled=false;alert(error&&error.message?error.message:String(error));})
    .openCalendarSyncFromAudit();
}
</script>
</body>
</html>`)
    .setWidth(610)
    .setHeight(540);


  SpreadsheetApp.getUi().showModalDialog(html, taskTitle);
}


function runPmosTask_(taskType) {
  return withSpreadsheetServiceRetry_(
    () => {
      switch (taskType) {
        case 'CALENDAR_AUDIT': {
          const audit = runCalendarPlanAudit_();
          return {
            canSync: Boolean(audit.canSync),
            summary: [
              `Calendar Plan Audit complete.`,
              `Expected recurring series: ${audit.uniqueSeriesCount}`,
              `Blocking errors: ${audit.errorCount}`,
              `Warnings: ${audit.warningCount}`,
              audit.canSync
                ? 'Calendar Sync and Rebuild are permitted.'
                : 'Calendar Sync and Rebuild remain blocked until errors are repaired.'
            ].join('\n')
          };
        }


        case 'CALENDAR_STATUS': {
          const preview = previewCalendarChanges();
          const registry = getSeriesRegistry_();
          return {
            summary: [
              'Calendar Status complete.',
              `Registered recurring series: ${Object.keys(registry).length}`,
              `Creates pending: ${preview.creates || 0}`,
              `Updates pending: ${preview.updates || 0}`,
              `Removals pending: ${preview.deletes || 0}`
            ].join('\n')
          };
        }


        case 'VERIFY_CALENDAR': {
          const result = executeVerifyCalendarJob_();
          return { summary: `Verification complete.\n${result.summary}` };
        }


        case 'CUSTOMER_SYNC': {
          const result = synchronizeCustomerDatabase_(true);
          return {
            summary: [
              'Customer Database Sync complete.',
              `IDs created: ${result.idsCreated || 0}`,
              `Route rows updated: ${result.routeRowsUpdated || 0}`,
              `Route rows created: ${result.routeRowsCreated || 0}`
            ].join('\n')
          };
        }


        case 'MAP_EXPORT': {
          const result = exportAffectedMapLayers();
          return {
            summary: [
              'Map export complete.',
              `Layer files exported: ${result.count || 0}`,
              `Drive folder: ${result.folderName || ''}`
            ].join('\n')
          };
        }


        default:
          throw new Error(`Unknown PMOS task: ${taskType}`);
      }
    },
    `running ${taskType}`
  );
}


function withSpreadsheetServiceRetry_(operation, operationName) {
  const delays = [0, 600, 1500, 3000];
  let lastError = null;


  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]) Utilities.sleep(delays[attempt]);


    try {
      return operation();
    } catch (error) {
      lastError = error;
      const message = String(error && error.message ? error.message : error);
      const transient =
        /Service Spreadsheets failed/i.test(message) ||
        /internal error/i.test(message) ||
        /timed out/i.test(message) ||
        /try again/i.test(message);


      if (!transient || attempt === delays.length - 1) {
        throw new Error(
          `${operationName || 'PMOS operation'} failed after ${attempt + 1} attempt(s): ${message}`
        );
      }
    }
  }


  throw lastError;
}


function recommendTemporaryVisitDates_(payload) {
  payload = payload || {};
  const address = String(payload.address || '').trim();
  if (!address) throw new Error('Enter the temporary customer address.');


  // The initial search covers six business days so it includes the same
  // weekday next week. Every expansion adds another six business days.
  const startOffset = Math.max(0, Math.floor(Number(payload.startOffsetWorkingDays || 0)));
  const workdayCount = Math.max(1, Math.min(18, Math.floor(Number(payload.workdayCount || 6))));
  const maxResults = Math.max(1, Math.min(10, Number(payload.maxResults || 3)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const calendar = getRecurringCalendar_();
  const geocoder = Maps.newGeocoder();
  const target = geocodePmosAddress_(geocoder, address);
  const candidateDates = [];


  let skippedWorkdays = 0;
  let collectedWorkdays = 0;
  let cursor = new Date(today);
  while (collectedWorkdays < workdayCount) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      if (skippedWorkdays < startOffset) {
        skippedWorkdays++;
      } else {
        candidateDates.push(new Date(cursor));
        collectedWorkdays++;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }


  // Fast layer: load a lightweight route snapshot and rank candidate dates by
  // distance to the route centroid. This is safer than city-name matching and
  // works across municipal boundaries and rural addresses.
  const staged = candidateDates.map(date => {
    const snapshot = getTemporaryRouteSnapshot_(calendar, geocoder, date);
    const centroidDistanceKm = snapshot && snapshot.centroid
      ? pmosHaversineKm_(target, snapshot.centroid)
      : Number.POSITIVE_INFINITY;
    return {date, snapshot, centroidDistanceKm};
  }).filter(item => item.snapshot && item.snapshot.events.length);


  staged.sort((a, b) => {
    if (a.centroidDistanceKm !== b.centroidDistanceKm) return a.centroidDistanceKm - b.centroidDistanceKm;
    return a.date - b.date;
  });


  // Smart layer: perform exact insertion analysis. The snapshots and geocodes
  // are cached, so later expansions and nearby-date checks avoid repeating work.
  const recommendations = staged.map(item =>
    calculateTemporaryPlacementForDate_(calendar, geocoder, target, item.date, 1, item.snapshot)
  ).filter(Boolean);


  recommendations.sort(compareTemporaryVisitRecommendations_);
  return {
    recommendations: recommendations.slice(0, maxResults),
    startOffsetWorkingDays: startOffset,
    workdayCount,
    nextOffsetWorkingDays: startOffset + workdayCount,
    qualityMessage: temporaryRecommendationQualityMessage_(recommendations.slice(0, maxResults))
  };
}


function temporaryRecommendationQualityMessage_(recommendations) {
  if (!recommendations || !recommendations.length) return 'No scheduled weekday routes were available in this window.';
  const bestScore = Number(recommendations[0].score || 0);
  if (bestScore >= 90) return 'Excellent opportunities found nearby.';
  if (bestScore >= 78) return 'Good scheduling opportunities found.';
  return 'No excellent opportunities were found in this six-business-day window. Consider searching six more business days.';
}


function compareTemporaryVisitRecommendations_(a, b) {
  if (Number(a.score || 0) !== Number(b.score || 0)) return Number(b.score || 0) - Number(a.score || 0);
  if (a.addedDistanceKm !== b.addedDistanceKm) return a.addedDistanceKm - b.addedDistanceKm;
  if (a.customerCount !== b.customerCount) return a.customerCount - b.customerCount;
  return a.date.localeCompare(b.date);
}


function calculateTemporaryPlacementForDate_(calendar, geocoder, target, serviceDate, fallbackPosition, suppliedSnapshot) {
  const snapshot = suppliedSnapshot || getTemporaryRouteSnapshot_(calendar, geocoder, serviceDate);
  if (!snapshot || !snapshot.events.length || snapshot.points.filter(Boolean).length < 1) return null;


  const events = snapshot.events;
  const points = snapshot.points;
  let bestPosition = Math.max(1, Number(fallbackPosition || 1));
  let bestAddedDistance = Number.POSITIVE_INFINITY;
  for (let position = 0; position <= events.length; position++) {
    const previous = position > 0 ? points[position - 1] : null;
    const next = position < points.length ? points[position] : null;
    let added = 0;
    if (previous) added += pmosHaversineKm_(previous, target);
    if (next) added += pmosHaversineKm_(target, next);
    if (previous && next) added -= pmosHaversineKm_(previous, next);
    if (added < bestAddedDistance) { bestAddedDistance = added; bestPosition = position + 1; }
  }


  const centroidDistanceKm = snapshot.centroid ? pmosHaversineKm_(target, snapshot.centroid) : bestAddedDistance;
  // Use a deliberately forgiving absolute score. Date-search results are
  // labelled comparatively in the browser after all results found so far are
  // ranked. This absolute label is mainly used for a manually selected date.
  const routeScaleKm = Math.max(12, Math.min(80, events.length * 4));
  const detourRatio = bestAddedDistance / routeScaleKm;
  const distanceScore = Math.max(0, 100 - Math.min(70, detourRatio * 100));
  const continuityScore = Math.max(0, 100 - Math.min(45, centroidDistanceKm * 1.6));
  const loadPenalty = Math.max(0, events.length - 15) * 0.8;
  const score = Math.max(0, Math.min(100, Math.round(distanceScore * 0.68 + continuityScore * 0.32 - loadPenalty)));


  let rating = 'Excellent', ratingClass = 'good', reason = 'Fits naturally into the actual route scheduled for this date.';
  if (bestAddedDistance <= 3) {
    rating = 'Excellent'; ratingClass = 'good'; reason = 'Adds very little travel to the scheduled route.';
  } else if (bestAddedDistance <= 8) {
    rating = 'Very Good'; ratingClass = 'good'; reason = 'A practical insertion with only a modest detour.';
  } else if (bestAddedDistance <= 15) {
    rating = 'Good'; ratingClass = 'fair'; reason = 'Adds some travel but remains a reasonable route option.';
  } else if (bestAddedDistance <= 25) {
    rating = 'Fair'; ratingClass = 'fair'; reason = 'A longer detour, but potentially worthwhile depending on customer availability.';
  } else {
    rating = 'Last Resort'; ratingClass = 'poor'; reason = 'This is the best insertion found for the selected date, but it adds substantial travel.';
  }


  const settings = getRecurringCalendarSettings_();
  const rotationWeek = pmosRotationWeekForDate_(serviceDate, settings.rotationWeek1Start);
  return {
    date: Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'yyyy-MM-dd'),
    displayDate: Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'EEE MMM d, yyyy'),
    dayName: Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'EEEE'),
    rotationWeek,
    customerCount: events.length,
    position: bestPosition,
    previousName: bestPosition > 1 ? events[bestPosition - 2].title : '',
    nextName: bestPosition <= events.length ? events[bestPosition - 1].title : '',
    addedDistanceKm: bestAddedDistance,
    centroidDistanceKm,
    score,
    rating,
    ratingClass,
    reason
  };
}


function getTemporaryRouteSnapshot_(calendar, geocoder, serviceDate) {
  const dateKey = Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'yyyyMMdd');
  const cache = CacheService.getScriptCache();
  const cacheKey = `PMOS_ROUTE_${dateKey}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (ignored) {}
  }


  const dayStart = new Date(serviceDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(serviceDate); dayEnd.setHours(23, 59, 59, 999);
  const calendarEvents = calendar.getEvents(dayStart, dayEnd)
    .filter(event => !event.isAllDayEvent())
    .sort((a, b) => a.getStartTime() - b.getStartTime());


  const events = calendarEvents.map(event => ({
    title: event.getTitle(),
    location: String(event.getLocation() || '').trim(),
    start: event.getStartTime().getTime()
  }));
  const points = events.map(event => event.location ? geocodePmosAddress_(geocoder, event.location, true) : null);
  const validPoints = points.filter(Boolean);
  const centroid = validPoints.length ? {
    lat: validPoints.reduce((sum, point) => sum + point.lat, 0) / validPoints.length,
    lng: validPoints.reduce((sum, point) => sum + point.lng, 0) / validPoints.length
  } : null;
  const snapshot = {events, points, centroid};
  try { cache.put(cacheKey, JSON.stringify(snapshot), 900); } catch (ignored) {}
  return snapshot;
}


function invalidateTemporaryRouteSnapshot_(serviceDate) {
  const dateKey = Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'yyyyMMdd');
  CacheService.getScriptCache().remove(`PMOS_ROUTE_${dateKey}`);
}


function pmosRotationWeekForDate_(date, week1Monday) {
  const target = new Date(date); target.setHours(0,0,0,0);
  const anchor = new Date(week1Monday); anchor.setHours(0,0,0,0);
  const days = Math.floor((target.getTime() - anchor.getTime()) / 86400000);
  const weeks = Math.floor(days / 7);
  return ((weeks % 4) + 4) % 4 + 1;
}


function suggestTemporaryVisitPlacement_(payload) {
  payload = payload || {};
  const address = String(payload.address || '').trim();
  const dates = Array.isArray(payload.dates) ? payload.dates.filter(Boolean) : [];
  if (!address) throw new Error('Enter the temporary customer address.');
  if (!dates.length) throw new Error('Choose at least one visit date.');


  const serviceDate = parseTemporaryVisitDate_(dates[0]);
  const calendar = getRecurringCalendar_();
  const geocoder = Maps.newGeocoder();
  const target = geocodePmosAddress_(geocoder, address);
  let selected = calculateTemporaryPlacementForDate_(
    calendar,
    geocoder,
    target,
    serviceDate,
    Number(payload.stopPosition || 1)
  );


  if (!selected) {
    const dayName = Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'EEEE');
    selected = {
      date: Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'yyyy-MM-dd'),
      displayDate: Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'EEE MMM d, yyyy'),
      dayName,
      customerCount: 0,
      position: 1,
      previousName: '',
      nextName: '',
      addedDistanceKm: 0,
      rating: 'Excellent',
      ratingClass: 'good',
      reason: 'There are no other timed visits on this date.'
    };
  }


  // A selected date remains authoritative. PMOS only offers nearby weekday
  // alternatives when another date within six working days either direction
  // has a more efficient route.
  const alternatives = [];
  if (payload.includeNearby !== false) {
    for (let offset = -6; offset <= 6; offset++) {
      if (offset === 0) continue;
      const candidateDate = addWorkingDays_(serviceDate, offset);
      const candidate = calculateTemporaryPlacementForDate_(calendar, geocoder, target, candidateDate, 1);
      if (!candidate) continue;
      candidate.savingsKm = Math.max(0, Number(selected.addedDistanceKm || 0) - Number(candidate.addedDistanceKm || 0));
      alternatives.push(candidate);
    }
    alternatives.sort(compareTemporaryVisitRecommendations_);
  }


  selected.nearbyAlternatives = alternatives.slice(0, 3);
  selected.selectedDateIsBest = !selected.nearbyAlternatives.length ||
    Number(selected.nearbyAlternatives[0].addedDistanceKm) >= Number(selected.addedDistanceKm);
  return selected;
}


function addWorkingDays_(date, amount) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const direction = amount < 0 ? -1 : 1;
  let remaining = Math.abs(Math.floor(amount));
  while (remaining > 0) {
    result.setDate(result.getDate() + direction);
    if (result.getDay() !== 0 && result.getDay() !== 6) remaining--;
  }
  return result;
}


function geocodePmosAddress_(geocoder, address, allowFailure) {
  try {
    const normalizedAddress = String(address || '').trim();
    const cache = CacheService.getScriptCache();
    const digest = Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, normalizedAddress.toLowerCase())
    ).replace(/=+$/, '');
    const cacheKey = `PMOS_GEO_${digest}`;
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);


    const response = geocoder.geocode(normalizedAddress);
    const result = response &&
      response.results &&
      response.results[0];


    if (!result) {
      if (allowFailure) return null;
      throw new Error(`Address could not be located: ${address}`);
    }


    const location = result.geometry.location;
    const point = {
      lat: Number(location.lat),
      lng: Number(location.lng)
    };
    cache.put(cacheKey, JSON.stringify(point), 21600);
    return point;
  } catch (error) {
    if (allowFailure) return null;
    throw error;
  }
}


function pmosHaversineKm_(a, b) {
  const toRadians = degrees => degrees * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);


  const value =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);


  return 2 * earthRadiusKm * Math.asin(Math.sqrt(value));
}




/* ========================================================================== */
/* PMOS v1.8.0 TEMPORARY / VACATION VISITS                                    */
/* ========================================================================== */


const PMOS_TEMP_VISIT_MARKER = 'PMOS_TEMP_VISIT=true';


function showTemporaryVisitScheduler() {
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}h2{margin:0 0 6px}.muted{font-size:13px;color:#6b7280;margin-bottom:14px}
    label{display:block;font-weight:600;margin:10px 0 4px}input,textarea{width:100%;box-sizing:border-box;padding:9px;border:1px solid #d1d5db;border-radius:7px}
    textarea{min-height:72px;resize:vertical}.visitCard{border:1px solid #d1d5db;border-radius:10px;padding:12px;margin:9px 0;background:#fff}
    .visitHead{display:flex;justify-content:space-between;align-items:center;gap:8px}.visitTitle{font-weight:700}.visitGrid{display:grid;grid-template-columns:1fr 120px;gap:10px}
    .recommendation{margin-top:10px;padding:10px;border-radius:8px;background:#f3f4f6;white-space:pre-line;font-size:13px}.working{color:#4b5563}.good{background:#dcfce7;color:#166534}.fair{background:#fef3c7;color:#92400e}.poor{background:#fee2e2;color:#991b1b}
    .nearby{margin-top:9px;border-top:1px solid rgba(107,114,128,.25);padding-top:8px}.nearbyTitle{font-weight:700;margin-bottom:5px}.nearbyOption{display:block;width:100%;text-align:left;background:rgba(255,255,255,.75);border:1px solid rgba(107,114,128,.3);margin:5px 0;padding:8px;border-radius:7px}.nearbyOption:hover{background:white}.nearbyMeta{font-size:12px;margin-top:2px}
    .dateSuggestions{display:none;margin-top:10px;border:1px solid #d1d5db;border-radius:10px;padding:10px;background:#f9fafb}.dateSuggestions h3{font-size:14px;margin:0 0 8px}.dateOption{width:100%;text-align:left;background:white;border:1px solid #d1d5db;margin:5px 0;padding:9px;border-radius:8px}.dateOption:hover{background:#eff6ff}.dateMeta{font-size:12px;color:#6b7280;margin-top:2px}.searchMore{width:100%;margin-top:8px;background:#e0e7ff;color:#3730a3}
    .buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}button{border:0;border-radius:8px;padding:10px 14px;font-weight:600;cursor:pointer}.primary{background:#2563eb;color:white}.secondary{background:#e5e7eb}.small{padding:7px 9px}
    button:disabled{opacity:.5;cursor:default}.status{display:none;margin-top:12px;padding:10px;border-radius:8px;background:#f3f4f6;white-space:pre-line}.error{background:#fee2e2;color:#991b1b}.success{background:#dcfce7;color:#166534}
  </style>
</head>
<body>
  <h2>Schedule Temporary Maintenance Visits</h2>
  <div class="muted">Enter an address for the three best dates in the next 6 business days. Extend the timeline only when needed. Selecting a date also checks nearby weekdays.</div>
  <label>Calendar title / surname</label><input id="titleInput" placeholder="Example: Smith">
  <label>Full name</label><input id="fullNameInput" placeholder="Optional">
  <label>Address</label><input id="addressInput" placeholder="Street address, city, province">
  <div id="dateSuggestions" class="dateSuggestions"></div>
  <label>Phone</label><input id="phoneInput" placeholder="Optional">
  <label>Visit dates</label><div id="visitsContainer"></div>
  <button id="addVisitButton" type="button" class="secondary small">+ Add Another Visit</button>
  <label>Entry instructions / notes</label><textarea id="notesInput" placeholder="Gate code, access details, special instructions..."></textarea>
  <div class="buttons"><button id="scheduleButton" type="button" class="primary">Schedule Visit(s)</button><button id="closeButton" type="button" class="secondary">Close</button></div>
  <div id="statusBox" class="status"></div>
<script>
(function(){
  var titleInput=document.getElementById('titleInput'),fullNameInput=document.getElementById('fullNameInput'),addressInput=document.getElementById('addressInput'),phoneInput=document.getElementById('phoneInput'),visitsContainer=document.getElementById('visitsContainer'),notesInput=document.getElementById('notesInput'),statusBox=document.getElementById('statusBox'),dateSuggestions=document.getElementById('dateSuggestions'),scheduleButton=document.getElementById('scheduleButton'),addVisitButton=document.getElementById('addVisitButton');
  var visitCounter=0,placementTimer=null,dateTimer=null,requestSequence=0,dateRequestSequence=0;
  var searchOffset=0,allDateOptions=[],lastQualityMessage='',batchCompleted=0,batchTotal=0,batchErrors=0;


  function showStatus(message,kind){statusBox.style.display='block';statusBox.className='status '+(kind||'');statusBox.textContent=message;}
  function setBusy(value){scheduleButton.disabled=value;addVisitButton.disabled=value;}
  function renumber(){var cards=visitsContainer.querySelectorAll('.visitCard');for(var i=0;i<cards.length;i++){cards[i].querySelector('.visitTitle').textContent='Visit #'+(i+1);cards[i].querySelector('.removeVisit').style.display=cards.length>1?'inline-block':'none';}}
  function addVisit(value){
    visitCounter++;var card=document.createElement('div');card.className='visitCard';card.setAttribute('data-id',String(visitCounter));
    card.innerHTML='<div class="visitHead"><div class="visitTitle"></div><button type="button" class="secondary small removeVisit">Remove</button></div><div class="visitGrid"><div><label>Date</label><input class="visitDate" type="date" value="'+(value||'')+'"></div><div><label>Stop</label><input class="visitStop" type="number" min="1" value="1"></div></div><div class="recommendation working">Enter an address and choose a date to calculate placement.</div>';
    visitsContainer.appendChild(card);
    card.querySelector('.removeVisit').addEventListener('click',function(){card.remove();renumber();queuePlacementSuggestions();});
    card.querySelector('.visitDate').addEventListener('change',function(){card.setAttribute('data-manual','false');queuePlacementSuggestions();});
    card.querySelector('.visitDate').addEventListener('input',function(){card.setAttribute('data-manual','false');queuePlacementSuggestions();});
    card.querySelector('.visitStop').addEventListener('input',function(){card.setAttribute('data-manual','true');updateManualMessage(card);});
    renumber();if(value)queuePlacementSuggestions();return card;
  }
  function updateManualMessage(card){var rec=card.querySelector('.recommendation'),stop=card.querySelector('.visitStop').value||'1';if(card.getAttribute('data-suggested')){rec.firstChild.textContent='Manual placement selected: stop '+stop+'\\nSuggested stop remains '+card.getAttribute('data-suggested')+'. PMOS will respect your manual choice.';rec.className='recommendation fair';}}
  function queuePlacementSuggestions(){clearTimeout(placementTimer);placementTimer=setTimeout(refreshPlacementSuggestions,500);}
  function queueDateRecommendations(){clearTimeout(dateTimer);dateTimer=setTimeout(function(){searchOffset=0;allDateOptions=[];lastQualityMessage='';refreshDateRecommendations(false);},700);queuePlacementSuggestions();}
  function refreshPlacementSuggestions(){var address=addressInput.value.trim(),cards=visitsContainer.querySelectorAll('.visitCard');for(var i=0;i<cards.length;i++){var card=cards[i],date=card.querySelector('.visitDate').value,rec=card.querySelector('.recommendation');if(!address||!date){rec.textContent='Enter an address and choose a date to calculate placement.';rec.className='recommendation working';continue;}requestPlacement(card,address,date);}}
  function requestPlacement(card,address,date){
    var rec=card.querySelector('.recommendation'),token=++requestSequence;card.setAttribute('data-request',String(token));rec.textContent='Calculating placement and checking nearby weekdays…';rec.className='recommendation working';
    google.script.run.withSuccessHandler(function(result){
      if(card.getAttribute('data-request')!==String(token))return;card.setAttribute('data-suggested',String(result.position));if(card.getAttribute('data-manual')!=='true')card.querySelector('.visitStop').value=result.position;
      var lines=[result.dayName+' route',result.customerCount+' scheduled visit(s)','Suggested stop: #'+result.position];if(result.previousName||result.nextName)lines.push('Between: '+(result.previousName||'Route start')+' and '+(result.nextName||'Route end'));if(typeof result.addedDistanceKm==='number')lines.push('Approximate added travel: +'+result.addedDistanceKm.toFixed(1)+' km');lines.push(result.rating+' placement',result.reason||result.explanation||'');
      rec.innerHTML='';var summary=document.createElement('div');summary.textContent=lines.filter(Boolean).join('\\n');rec.appendChild(summary);rec.className='recommendation '+(result.ratingClass||'good');
      renderNearbyAlternatives(card,rec,result);if(card.getAttribute('data-manual')==='true')updateManualMessage(card);
    }).withFailureHandler(function(error){if(card.getAttribute('data-request')!==String(token))return;rec.textContent='Placement could not be calculated. You can still enter a stop manually.\\n'+(error&&error.message?error.message:String(error));rec.className='recommendation poor';}).suggestTemporaryVisitPlacement({address:address,dates:[date],stopPosition:Number(card.querySelector('.visitStop').value||1),includeNearby:true});
  }
  function renderNearbyAlternatives(card,rec,result){
    var alternatives=result.nearbyAlternatives||[],selectedDistance=Number(result.addedDistanceKm||0),better=[];for(var i=0;i<alternatives.length;i++){if(Number(alternatives[i].addedDistanceKm)+0.1<selectedDistance)better.push(alternatives[i]);}
    var box=document.createElement('div');box.className='nearby';var title=document.createElement('div');title.className='nearbyTitle';
    if(!better.length){title.textContent='Your selected date is already the best nearby option.';box.appendChild(title);rec.appendChild(box);return;}
    title.textContent='Better dates near your selection';box.appendChild(title);
    better.slice(0,3).forEach(function(option){var button=document.createElement('button');button.type='button';button.className='nearbyOption';var savings=Math.max(0,selectedDistance-Number(option.addedDistanceKm||0));button.innerHTML='<b>'+option.displayDate+' — save about '+savings.toFixed(1)+' km</b><div class="nearbyMeta">Week '+option.rotationWeek+' • +'+option.addedDistanceKm.toFixed(1)+' km • stop #'+option.position+'</div>';button.addEventListener('click',function(){card.querySelector('.visitDate').value=option.date;card.setAttribute('data-manual','false');queuePlacementSuggestions();});box.appendChild(button);});rec.appendChild(box);
  }
  function applyComparativeRatings(){
    if(!allDateOptions.length)return;var bestDistance=Number(allDateOptions[0].addedDistanceKm||0),bestScore=Number(allDateOptions[0].score||0);
    allDateOptions.forEach(function(option,index){var distance=Number(option.addedDistanceKm||0),gap=distance-bestDistance,scoreGap=bestScore-Number(option.score||0);
      if(index===0){option.displayRating=distance<=8?'Excellent':'Best Available';option.displayClass='good';option.displayReason='Best option found in the searched dates.';}
      else if(index===1){option.displayRating=(gap<=4||scoreGap<=8)?'Very Good':'Good';option.displayClass=gap<=8?'good':'fair';option.displayReason='One of the strongest alternatives found so far.';}
      else {option.displayRating=(gap<=8||scoreGap<=15)?'Good':'Fair';option.displayClass='fair';option.displayReason='Third-best option among the dates searched so far.';}
    });
  }
  function mergeDateOptions(options){var byDate={};allDateOptions.concat(options||[]).forEach(function(option){byDate[option.date]=option;});allDateOptions=Object.keys(byDate).map(function(key){return byDate[key];});allDateOptions.sort(function(a,b){if(Number(a.score||0)!==Number(b.score||0))return Number(b.score||0)-Number(a.score||0);if(a.addedDistanceKm!==b.addedDistanceKm)return a.addedDistanceKm-b.addedDistanceKm;if(a.customerCount!==b.customerCount)return a.customerCount-b.customerCount;return a.date.localeCompare(b.date);});allDateOptions=allDateOptions.slice(0,3);applyComparativeRatings();}
  function finishProgressiveBatch(token,requestedOffset){if(token!==dateRequestSequence||batchCompleted<batchTotal)return;searchOffset=requestedOffset+6;lastQualityMessage=allDateOptions.length?'Recommendations are ranked against the other dates searched, not by a rigid kilometre cutoff.':'';if(batchErrors)lastQualityMessage+=(lastQualityMessage?' ':'')+batchErrors+' day(s) could not be analyzed.';renderDateRecommendations(false);}
  function renderDateRecommendations(working){
    dateSuggestions.innerHTML='<h3>Best upcoming dates</h3>';if(working){dateSuggestions.innerHTML+='<div class="muted">Searching day '+Math.min(batchCompleted+1,batchTotal)+' of '+batchTotal+'. Results update as each day finishes.</div>';}else if(lastQualityMessage){dateSuggestions.innerHTML+='<div class="muted">'+lastQualityMessage+'</div>';}if(!allDateOptions.length){dateSuggestions.innerHTML+='<div class="muted">'+(working?'Checking the first route…':'No weekday routes were available to compare.')+'</div>';}
    allDateOptions.forEach(function(option){var button=document.createElement('button');button.type='button';button.className='dateOption';button.innerHTML='<b>'+option.displayDate+' — '+(option.displayRating||option.rating)+'</b><div class="dateMeta">Week '+option.rotationWeek+' • '+option.customerCount+' visits • +'+option.addedDistanceKm.toFixed(1)+' km • suggested stop #'+option.position+'</div><div class="dateMeta">'+(option.displayReason||option.reason)+'</div>';button.addEventListener('click',function(){selectRecommendedDate(option.date);});dateSuggestions.appendChild(button);});
    var more=document.createElement('button');more.type='button';more.className='searchMore';more.disabled=!!working;more.textContent=working?'Searching '+batchCompleted+' of '+batchTotal+' business days…':'Search 6 More Business Days';more.addEventListener('click',function(){refreshDateRecommendations(true);});dateSuggestions.appendChild(more);
  }
  function refreshDateRecommendations(expand){
    var address=addressInput.value.trim(),token=++dateRequestSequence;if(address.length<6){dateSuggestions.style.display='none';dateSuggestions.innerHTML='';return;}dateSuggestions.style.display='block';var requestedOffset=expand?searchOffset:0;batchCompleted=0;batchTotal=6;batchErrors=0;lastQualityMessage='';renderDateRecommendations(true);
    for(var dayIndex=0;dayIndex<6;dayIndex++)(function(offset){
      google.script.run.withSuccessHandler(function(result){if(token!==dateRequestSequence)return;mergeDateOptions((result&&result.recommendations)||[]);batchCompleted++;renderDateRecommendations(batchCompleted<batchTotal);finishProgressiveBatch(token,requestedOffset);}).withFailureHandler(function(){if(token!==dateRequestSequence)return;batchErrors++;batchCompleted++;renderDateRecommendations(batchCompleted<batchTotal);finishProgressiveBatch(token,requestedOffset);}).recommendTemporaryVisitDates({address:address,startOffsetWorkingDays:requestedOffset+offset,workdayCount:1,maxResults:1});
    })(dayIndex);
  }
  function selectRecommendedDate(date){var cards=visitsContainer.querySelectorAll('.visitCard'),target=null;for(var i=0;i<cards.length;i++){if(!cards[i].querySelector('.visitDate').value){target=cards[i];break;}}if(!target)target=addVisit('');target.querySelector('.visitDate').value=date;target.setAttribute('data-manual','false');queuePlacementSuggestions();}
  function payload(){var cards=visitsContainer.querySelectorAll('.visitCard'),visits=[];for(var i=0;i<cards.length;i++){var date=cards[i].querySelector('.visitDate').value;if(date)visits.push({date:date,stopPosition:Number(cards[i].querySelector('.visitStop').value||1)});}return{title:titleInput.value.trim(),fullName:fullNameInput.value.trim(),address:addressInput.value.trim(),phone:phoneInput.value.trim(),visits:visits,dates:visits.map(function(v){return v.date;}),notes:notesInput.value.trim()};}
  function resetForm(){titleInput.value='';fullNameInput.value='';addressInput.value='';phoneInput.value='';notesInput.value='';visitsContainer.innerHTML='';dateSuggestions.style.display='none';dateSuggestions.innerHTML='';visitCounter=0;searchOffset=0;allDateOptions=[];lastQualityMessage='';batchCompleted=0;batchTotal=0;batchErrors=0;addVisit('');titleInput.focus();}
  function scheduleVisits(){var data=payload();if(!data.title){showStatus('Enter a Calendar title or surname.','error');return;}if(!data.address){showStatus('Enter the service address.','error');return;}if(!data.visits.length){showStatus('Choose at least one visit date.','error');return;}setBusy(true);showStatus('Creating '+data.visits.length+' temporary visit(s) and restaggering the selected route(s)…','');google.script.run.withSuccessHandler(function(result){setBusy(false);showStatus(result.created+' temporary visit(s) created.\\n'+result.adjusted+' event time(s) adjusted.\\n\\nReady for the next customer.','success');resetForm();setTimeout(function(){statusBox.style.display='none';},3000);}).withFailureHandler(function(error){setBusy(false);showStatus('Unable to schedule visits:\\n'+(error&&error.message?error.message:String(error)),'error');}).scheduleTemporaryVisits(data);}
  addVisitButton.addEventListener('click',function(){addVisit('');});scheduleButton.addEventListener('click',scheduleVisits);document.getElementById('closeButton').addEventListener('click',function(){google.script.host.close();});addressInput.addEventListener('input',queueDateRecommendations);addressInput.addEventListener('change',queueDateRecommendations);addVisit('');
})();
</script>
</body>
</html>`).setWidth(700).setHeight(860);
  SpreadsheetApp.getUi().showModalDialog(html, 'Schedule Temporary Visits');
}


function scheduleTemporaryVisits_(payload) {
  payload = payload || {};


  const title = String(payload.title || '').trim();
  const address = String(payload.address || '').trim();
  const visitRequests = Array.isArray(payload.visits) && payload.visits.length
    ? payload.visits.map(item => ({
        date: String(item.date || '').trim(),
        stopPosition: Math.max(1, Math.floor(Number(item.stopPosition || 1)))
      })).filter(item => item.date)
    : (Array.isArray(payload.dates)
        ? payload.dates.map(value => ({date: String(value || '').trim(), stopPosition: Math.max(1, Math.floor(Number(payload.stopPosition || 1)))})).filter(item => item.date)
        : [String(payload.date1 || '').trim(), String(payload.date2 || '').trim()].filter(Boolean).map(value => ({date:value, stopPosition:Math.max(1, Math.floor(Number(payload.stopPosition || 1)))})));
  const dateStrings = visitRequests.map(item => item.date);


  if (!title) {
    throw new Error('Enter a Calendar title or customer surname.');
  }


  if (!address) {
    throw new Error('Enter the service address.');
  }


  if (!dateStrings.length) {
    throw new Error('Choose at least one visit date.');
  }


  const calendar = getRecurringCalendar_();
  const settings = getRecurringCalendarSettings_();
  let created = 0;
  let adjusted = 0;
  const details = [];


  visitRequests.forEach(visitRequest => {
    const dateString = visitRequest.date;
    const stopPosition = visitRequest.stopPosition;
    const serviceDate = parseTemporaryVisitDate_(dateString);


    if (
      serviceDate.getDay() === 0 ||
      serviceDate.getDay() === 6
    ) {
      throw new Error(
        `${dateString} is a weekend. Temporary maintenance visits currently support Monday–Friday.`
      );
    }


    const dayStart = new Date(serviceDate);
    dayStart.setHours(0, 0, 0, 0);


    const dayEnd = new Date(serviceDate);
    dayEnd.setHours(23, 59, 59, 999);


    const existingEvents = calendar.getEvents(dayStart, dayEnd)
      .filter(event => !event.isAllDayEvent())
      .sort((a, b) =>
        a.getStartTime().getTime() -
        b.getStartTime().getTime()
      );


    const safePosition = Math.min(
      stopPosition,
      existingEvents.length + 1
    );


    const placeholderStart = routeTimeForOrder_(
      serviceDate,
      safePosition,
      settings
    );
    const placeholderEnd = new Date(
      placeholderStart.getTime() +
      settings.eventDurationMinutes * 60000
    );


    const description = buildTemporaryVisitDescription_(payload);


    const newEvent = calendar.createEvent(
      title,
      placeholderStart,
      placeholderEnd,
      {
        location: address,
        description
      }
    );


    const orderedEvents = existingEvents.slice();
    orderedEvents.splice(safePosition - 1, 0, newEvent);


    orderedEvents.forEach((event, index) => {
      const newStart = routeTimeForOrder_(
        serviceDate,
        index + 1,
        settings
      );
      const newEnd = new Date(
        newStart.getTime() +
        settings.eventDurationMinutes * 60000
      );


      if (
        event.getStartTime().getTime() !== newStart.getTime() ||
        event.getEndTime().getTime() !== newEnd.getTime()
      ) {
        event.setTime(newStart, newEnd);
        adjusted++;
      }
    });


    created++;
    details.push(
      `${Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'EEEE, MMMM d')} — inserted as stop ${safePosition}`
    );
    invalidateTemporaryRouteSnapshot_(serviceDate);
  });


  return {
    created,
    adjusted,
    details
  };
}


function parseTemporaryVisitDate_(value) {
  const match = String(value || '').match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );


  if (!match) {
    throw new Error(`Invalid visit date: ${value}`);
  }


  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0
  );


  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid visit date: ${value}`);
  }


  return date;
}


function buildTemporaryVisitDescription_(payload) {
  const lines = [
    'Temporary / vacation maintenance visit',
    PMOS_TEMP_VISIT_MARKER
  ];


  if (payload.fullName) {
    lines.push(`Customer: ${payload.fullName}`);
  }


  if (payload.phone) {
    lines.push(`Phone: ${payload.phone}`);
  }


  if (payload.notes) {
    lines.push('', String(payload.notes));
  }


  lines.push('', `PMOS_TEMP_VISIT_ID=${Utilities.getUuid()}`);


  return lines.join('\n');
}




/* ========================================================================== */
/* PMOS v1.6.0 CALENDAR PLAN AUDIT                                             */
/* ========================================================================== */


function showCalendarPlanAudit() {
  const audit = runCalendarPlanAudit_();


  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}
    h2{margin:0 0 6px}.muted{color:#6b7280;font-size:13px}
    .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}
    .card{padding:10px;border-radius:9px;background:#f3f4f6}
    .good{background:#dcfce7;color:#166534}.bad{background:#fee2e2;color:#991b1b}
    .warn{background:#fef3c7;color:#92400e}
    .issue{border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:10px 0}
    .issue h4{margin:0 0 6px}.meta{font-size:13px;white-space:pre-line;color:#4b5563}
    button{border:0;border-radius:7px;padding:8px 11px;font-weight:600;cursor:pointer;margin:7px 5px 0 0}
    .primary{background:#2563eb;color:white}.secondary{background:#e5e7eb}.danger{background:#fee2e2;color:#991b1b}
    .footer{position:sticky;bottom:0;background:white;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:14px}
  </style>
</head>
<body>
  <h2>Calendar Plan Audit</h2>
  <div class="muted">Nothing is written to Google Calendar during this audit.</div>


  <div class="summary">
    <div class="card"><b>${audit.customerCount}</b><br><small>customers</small></div>
    <div class="card"><b>${audit.uniqueSeriesCount}</b><br><small>unique series</small></div>
    <div class="card ${audit.canSync ? 'good' : 'bad'}"><b>${audit.errorCount}</b><br><small>blocking errors</small></div>
    <div class="card ${audit.warningCount ? 'warn' : 'good'}"><b>${audit.warningCount}</b><br><small>warnings</small></div>
    <div class="card"><b>${audit.routeRowCount}</b><br><small>route rows</small></div>
    <div class="card"><b>${audit.expectedByFrequency.total}</b><br><small>frequency estimate</small></div>
  </div>


  <div>
    ${audit.issues.length ? audit.issues.map(issue => `
      <div class="issue">
        <h4>${escapeHtmlClient_(issue.title)}</h4>
        <div class="meta">${escapeHtmlClient_(issue.details)}</div>
        ${issue.row ? `<button class="secondary" onclick="openRow(${issue.row})">Go to row ${issue.row}</button>` : ''}
        ${issue.fix === 'REN_NUMBER' ? `<button class="primary" onclick="renumber()">Renumber stops</button>` : ''}
        ${issue.fix === 'ASSIGN_IDS' ? `<button class="primary" onclick="assignIds()">Assign missing IDs</button>` : ''}
      </div>
    `).join('') : `<div class="card good"><b>Calendar plan verified.</b><br>No blocking errors were found.</div>`}
  </div>


  <div class="footer">
    <button class="secondary" onclick="refreshAudit()">Run Audit Again</button>
    ${audit.canSync ? `<button class="primary" onclick="openSync()">Open Calendar Sync</button>` : ''}
    <button class="secondary" onclick="google.script.host.close()">Close</button>
  </div>


<script>
function escapeHtmlClient_(value){
  return String(value||'').replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function openRow(row){
  google.script.run.activateRouteRow(row);
}
function renumber(){
  google.script.run.withSuccessHandler(refreshAudit).auditFixRouteNumbers();
}
function assignIds(){
  google.script.run.withSuccessHandler(refreshAudit).auditFixCustomerIds();
}
function refreshAudit(){
  google.script.host.close();
  google.script.run.showCalendarPlanAudit();
}
function openSync(){
  google.script.run
    .withSuccessHandler(function(){
      google.script.host.close();
    })
    .withFailureHandler(function(error){
      alert(error && error.message ? error.message : String(error));
    })
    .openCalendarSyncFromAudit();
}
</script>
</body>
</html>`)
    .setWidth(760)
    .setHeight(680);


  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Calendar Plan Audit');
}




function openCalendarSyncFromAudit() {
  return openCalendarSyncFromAudit_();
}

function activateRouteRow(rowNumber) {
  return activateRouteRow_(rowNumber);
}

function auditFixRouteNumbers() {
  return auditFixRouteNumbers_();
}

function auditFixCustomerIds() {
  return auditFixCustomerIds_();
}


function openCalendarSyncFromAudit_() {
  const audit = runCalendarPlanAudit_();


  if (!audit.canSync) {
    throw new Error(
      `Calendar Plan Audit still has ${audit.errorCount} blocking error(s).`
    );
  }


  showPmosJobEngineFor_('CALENDAR_SYNC');
  return true;
}


function runCalendarPlanAudit_() {
  ensureSupportSheets_();
  ensureCustomerIds_();
  ensureRouteCustomerIdColumn_();


  const sheet = getRoutesSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(value => String(value || '').trim());


  const column = {};
  headers.forEach((header, index) => column[header] = index);


  const requiredHeaders = [
    'Layer',
    'Stop Order',
    'Calendar Title',
    'Customer ID'
  ];


  const issues = [];
  requiredHeaders.forEach(header => {
    if (column[header] == null) {
      issues.push({
        severity: 'ERROR',
        code: 'MISSING_COLUMN',
        title: `Missing required column: ${header}`,
        details: `Add the ${header} column to the 4-Week Route Template.`,
        row: 0,
        fix: ''
      });
    }
  });


  if (issues.length) {
    return finalizeCalendarAudit_(issues, 0, 0, 0, {
      weekly: 0, biweekly: 0, monthly: 0, twiceWeeklyExtra: 0, total: 0
    });
  }


  const rows = [];
  const customerIds = new Set();
  const uniqueSeries = new Map();
  const layers = new Map();


  for (let index = 1; index < values.length; index++) {
    const raw = values[index];
    if (!raw.some(value => value !== '' && value != null)) continue;


    const layer = String(raw[column['Layer']] || '').trim();
    const title = String(raw[column['Calendar Title']] || '').trim();
    const customerId = String(raw[column['Customer ID']] || '').trim();
    const orderRaw = raw[column['Stop Order']];
    const order = Number(orderRaw);
    const rowNumber = index + 1;


    if (!layer && !title && !customerId) continue;


    const parsed = safeParseLayerForAudit_(layer);
    const row = {
      rowNumber,
      layer,
      title,
      customerId,
      order,
      parsed
    };
    rows.push(row);


    if (customerId) customerIds.add(customerId);


    if (!customerId) {
      issues.push({
        severity: 'ERROR',
        code: 'MISSING_ID',
        title: `Missing Customer ID — ${title || 'unnamed customer'}`,
        details: `${layer || 'No layer'}\nSpreadsheet row ${rowNumber}`,
        row: rowNumber,
        fix: 'ASSIGN_IDS'
      });
    }


    if (!title) {
      issues.push({
        severity: 'ERROR',
        code: 'MISSING_TITLE',
        title: 'Missing Calendar Title',
        details: `${layer || 'No layer'}\nSpreadsheet row ${rowNumber}`,
        row: rowNumber,
        fix: ''
      });
    }


    if (!parsed.valid) {
      issues.push({
        severity: 'ERROR',
        code: 'INVALID_LAYER',
        title: `Invalid route layer — ${layer || 'blank'}`,
        details: `Row ${rowNumber}\nExpected a layer containing Week 1–4 and Monday–Friday.`,
        row: rowNumber,
        fix: ''
      });
    } else if (parsed.day === 'Saturday' || parsed.day === 'Sunday') {
      issues.push({
        severity: 'ERROR',
        code: 'WEEKEND_LAYER',
        title: `Weekend service layer — ${layer}`,
        details: `${title}\nRow ${rowNumber}\nWeekend service is not currently enabled.`,
        row: rowNumber,
        fix: ''
      });
    }


    if (!Number.isFinite(order) || order < 1 || Math.floor(order) !== order) {
      issues.push({
        severity: 'ERROR',
        code: 'INVALID_STOP',
        title: `Invalid stop number — ${title || layer}`,
        details: `Found: ${orderRaw}\nRow ${rowNumber}`,
        row: rowNumber,
        fix: 'REN_NUMBER'
      });
    }


    if (parsed.valid) {
      if (!layers.has(layer)) layers.set(layer, []);
      layers.get(layer).push(row);
    }


    const key = `${customerId || normalize_(title)}|${layer}`;
    if (uniqueSeries.has(key)) {
      const first = uniqueSeries.get(key);
      issues.push({
        severity: 'ERROR',
        code: 'DUPLICATE_SERIES',
        title: `Duplicate route entry — ${title}`,
        details: `${layer}\nRows ${first.rowNumber} and ${rowNumber}\nRemove one duplicate row or correct its route assignment.`,
        row: rowNumber,
        fix: ''
      });
    } else {
      uniqueSeries.set(key, row);
    }
  }


  layers.forEach((layerRows, layer) => {
    const seenOrders = new Map();
    const sorted = layerRows.slice().sort((a, b) => a.rowNumber - b.rowNumber);


    sorted.forEach((row, index) => {
      const expectedOrder = index + 1;


      if (seenOrders.has(row.order)) {
        issues.push({
          severity: 'ERROR',
          code: 'DUPLICATE_STOP',
          title: `Duplicate stop ${row.order} — ${layer}`,
          details: `Rows ${seenOrders.get(row.order)} and ${row.rowNumber}`,
          row: row.rowNumber,
          fix: 'REN_NUMBER'
        });
      } else {
        seenOrders.set(row.order, row.rowNumber);
      }


      if (row.order !== expectedOrder) {
        issues.push({
          severity: 'WARNING',
          code: 'STOP_SEQUENCE',
          title: `Stop sequence needs refresh — ${layer}`,
          details: `Row ${row.rowNumber} is stop ${row.order}; expected ${expectedOrder} from physical row order.`,
          row: row.rowNumber,
          fix: 'REN_NUMBER'
        });
      }
    });


    const settings = getRecurringCalendarSettings_();
    const parsed = safeParseLayerForAudit_(layer);


    if (parsed.valid && layerRows.length) {
      const lastStop = Math.max(
        ...layerRows.map(row => Number.isFinite(row.order) ? row.order : 1)
      );
      const sampleDate = new Date(2026, 6, 13, 12, 0, 0, 0);
      sampleDate.setDate(sampleDate.getDate() + (parsed.week - 1) * 7 + parsed.dayOffset);
      const start = routeTimeForOrder_(sampleDate, lastStop, settings);


      if (start.getDay() !== sampleDate.getDay()) {
        issues.push({
          severity: 'ERROR',
          code: 'TIME_OVERFLOW',
          title: `Route time crosses into the next day — ${layer}`,
          details: `Last stop ${lastStop} calculates to ${Utilities.formatDate(start, PMOS.TIMEZONE, 'EEEE h:mm a')}.\nReduce route length or adjust timing.`,
          row: layerRows[layerRows.length - 1].rowNumber,
          fix: ''
        });
      }
    }
  });


  const frequencyEstimate = estimateSeriesByFrequency_();
  const routeRowCount = rows.length;
  const uniqueSeriesCount = uniqueSeries.size;


  if (
    frequencyEstimate.total > 0 &&
    uniqueSeriesCount > frequencyEstimate.total + 8
  ) {
    issues.push({
      severity: 'ERROR',
      code: 'SERIES_COUNT_HIGH',
      title: 'Calculated series count is unexpectedly high',
      details:
        `Unique route series: ${uniqueSeriesCount}\n` +
        `Frequency-based estimate: ${frequencyEstimate.total}\n` +
        `Review duplicate route assignments and customer frequencies.`,
      row: 0,
      fix: ''
    });
  }


  return finalizeCalendarAudit_(
    issues,
    customerIds.size,
    routeRowCount,
    uniqueSeriesCount,
    frequencyEstimate
  );
}


function finalizeCalendarAudit_(
  issues,
  customerCount,
  routeRowCount,
  uniqueSeriesCount,
  expectedByFrequency
) {
  const errors = issues.filter(issue => issue.severity === 'ERROR');
  const warnings = issues.filter(issue => issue.severity === 'WARNING');


  return {
    canSync: errors.length === 0,
    customerCount,
    routeRowCount,
    uniqueSeriesCount,
    expectedByFrequency,
    errorCount: errors.length,
    warningCount: warnings.length,
    issues: errors.concat(warnings).slice(0, 150),
    auditedAt: new Date().toISOString()
  };
}


function estimateSeriesByFrequency_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.CUSTOMERS_SHEET);
  if (!sheet) {
    return {
      weekly: 0,
      biweekly: 0,
      monthly: 0,
      twiceWeeklyExtra: 0,
      total: 0
    };
  }


  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(value => String(value || '').trim());
  const frequencyCol = headers.indexOf('Frequency');
  const daysCol = headers.indexOf('Route Day(s)');
  const titleCol = headers.indexOf('Calendar Title');
  const fullNameCol = headers.indexOf('Full Name(s)');


  const result = {
    weekly: 0,
    biweekly: 0,
    monthly: 0,
    twiceWeeklyExtra: 0,
    total: 0
  };


  values.slice(1).forEach(row => {
    const hasCustomer =
      (titleCol >= 0 && String(row[titleCol] || '').trim()) ||
      (fullNameCol >= 0 && String(row[fullNameCol] || '').trim());


    if (!hasCustomer) return;


    const frequency = normalize_(
      frequencyCol >= 0 ? row[frequencyCol] : ''
    );
    const days = daysCol >= 0
      ? parseCustomerDays_(row[daysCol]).length
      : 1;
    const serviceDays = Math.max(1, days);


    if (frequency.includes('weekly')) {
      result.weekly++;
      result.total += 4 * serviceDays;
      if (serviceDays > 1) {
        result.twiceWeeklyExtra += 4 * (serviceDays - 1);
      }
    } else if (
      frequency.includes('biweekly') ||
      frequency.includes('bi-weekly') ||
      frequency.includes('2 week')
    ) {
      result.biweekly++;
      result.total += 2 * serviceDays;
    } else if (
      frequency.includes('monthly') ||
      frequency.includes('4 week')
    ) {
      result.monthly++;
      result.total += 1 * serviceDays;
    }
  });


  return result;
}


function safeParseLayerForAudit_(layer) {
  const text = String(layer || '');
  const weekMatch = text.match(/Week\s*([1-4])/i);
  const days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
  ];
  const day = days.find(value =>
    text.toLowerCase().includes(value.toLowerCase())
  ) || '';


  const offsets = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6
  };


  return {
    valid: Boolean(weekMatch && day),
    week: weekMatch ? Number(weekMatch[1]) : 0,
    day,
    dayOffset: offsets[day] == null ? 0 : offsets[day]
  };
}


function activateRouteRow_(rowNumber) {
  const sheet = getRoutesSheet_();
  const row = Math.max(2, Number(rowNumber || 2));
  sheet.activate();
  sheet.getRange(row, 1).activate();
}


function auditFixRouteNumbers_() {
  return normalizeRoutesFromPhysicalOrder_(true);
}


function auditFixCustomerIds_() {
  const idsCreated = ensureCustomerIds_();
  synchronizeCustomerDatabase_(true);
  return {idsCreated};
}




/* ========================================================================== */
/* PMOS v1.5.9 PERSISTENT CALENDAR AUTO-CONTINUE                              */
/* ========================================================================== */


const PMOS_CALENDAR_AUTO_JOB = 'PMOS_CALENDAR_AUTO_JOB';
const PMOS_CALENDAR_AUTO_HANDLER = 'runCalendarAutoContinueTrigger';


function getCalendarAutoSyncStatus() {
  const props = PropertiesService.getDocumentProperties();
  const stored = readCalendarAutoJob_();
  const preview = previewCalendarChanges();
  const remaining =
    preview.creates +
    preview.updates +
    preview.deletes;


  const state = stored || {};


  if (!remaining && state.status !== 'Running') {
    state.status = 'Complete';
    state.autoEnabled = false;
    state.remaining = 0;
    state.nextRunAt = '';
    writeCalendarAutoJob_(state);
    removeCalendarAutoTrigger_();
  } else {
    state.remaining = remaining;
    state.originalTotal = Math.max(
      Number(state.originalTotal || 0),
      remaining
    );
  }


  return {
    status: state.status || 'Paused',
    autoEnabled: Boolean(state.autoEnabled),
    originalTotal: Number(state.originalTotal || remaining),
    remaining,
    lastCreated: Number(state.lastCreated || 0),
    lastUpdated: Number(state.lastUpdated || 0),
    lastDeleted: Number(state.lastDeleted || 0),
    lastErrors: Number(state.lastErrors || 0),
    lastError: String(state.lastError || ''),
    lastRunAt: formatCalendarJobDate_(state.lastRunAt),
    nextRunAt: formatCalendarJobDate_(state.nextRunAt)
  };
}


function startCalendarAutoContinue() {
  const preview = previewCalendarChanges();
  const remaining =
    preview.creates +
    preview.updates +
    preview.deletes;


  if (!remaining) {
    const complete = {
      status: 'Complete',
      autoEnabled: false,
      originalTotal: 0,
      remaining: 0,
      lastCreated: 0,
      lastUpdated: 0,
      lastDeleted: 0,
      lastErrors: 0,
      lastError: '',
      lastRunAt: new Date().toISOString(),
      nextRunAt: ''
    };
    writeCalendarAutoJob_(complete);
    removeCalendarAutoTrigger_();
    return complete;
  }


  const state = readCalendarAutoJob_() || {};
  state.status = 'Waiting';
  state.autoEnabled = true;
  state.originalTotal = Math.max(
    Number(state.originalTotal || 0),
    remaining
  );
  state.remaining = remaining;
  state.lastError = '';
  state.nextRunAt = new Date(
    Date.now() + 60 * 1000
  ).toISOString();


  writeCalendarAutoJob_(state);
  ensureCalendarAutoTrigger_();


  return getCalendarAutoSyncStatus();
}


function pauseCalendarAutoContinue() {
  const state = readCalendarAutoJob_() || {};
  state.status = 'Paused';
  state.autoEnabled = false;
  state.nextRunAt = '';
  writeCalendarAutoJob_(state);
  removeCalendarAutoTrigger_();
  return getCalendarAutoSyncStatus();
}


function runCalendarSyncBatchNow() {
  const state = readCalendarAutoJob_() || {};
  state.status = 'Running';
  state.lastError = '';
  writeCalendarAutoJob_(state);


  const result = applyCalendarChanges();
  const remaining = Number(result.remaining || 0);


  state.lastCreated = Number(result.created || 0);
  state.lastUpdated = Number(result.updated || 0);
  state.lastDeleted = Number(result.deleted || 0);
  state.lastErrors = Number(result.errors || 0);
  state.lastError = String(result.firstError || '');
  state.lastRunAt = new Date().toISOString();
  state.remaining = remaining;


  if (!remaining) {
    state.status = 'Complete';
    state.autoEnabled = false;
    state.nextRunAt = '';
    removeCalendarAutoTrigger_();
  } else if (result.errors) {
    state.status = 'Paused on error';
    state.autoEnabled = false;
    state.nextRunAt = '';
    removeCalendarAutoTrigger_();
  } else if (state.autoEnabled) {
    state.status = 'Waiting';
    state.nextRunAt = new Date(
      Date.now() + 60 * 1000
    ).toISOString();
  } else {
    state.status = 'Paused';
    state.nextRunAt = '';
  }


  writeCalendarAutoJob_(state);
  return result;
}


function runCalendarAutoContinueTrigger() {
  const lock = LockService.getDocumentLock();


  if (!lock.tryLock(1000)) return;


  try {
    const state = readCalendarAutoJob_();


    if (!state || !state.autoEnabled) {
      removeCalendarAutoTrigger_();
      return;
    }


    runCalendarSyncBatchNow();
  } finally {
    lock.releaseLock();
  }
}


function ensureCalendarAutoTrigger_() {
  const existing = ScriptApp.getProjectTriggers()
    .filter(trigger =>
      trigger.getHandlerFunction() ===
      PMOS_CALENDAR_AUTO_HANDLER
    );


  if (existing.length) return;


  ScriptApp.newTrigger(PMOS_CALENDAR_AUTO_HANDLER)
    .timeBased()
    .everyMinutes(1)
    .create();
}


function removeCalendarAutoTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter(trigger =>
      trigger.getHandlerFunction() ===
      PMOS_CALENDAR_AUTO_HANDLER
    )
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
}


function readCalendarAutoJob_() {
  const raw = PropertiesService.getDocumentProperties()
    .getProperty(PMOS_CALENDAR_AUTO_JOB);


  if (!raw) return null;


  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}


function writeCalendarAutoJob_(state) {
  PropertiesService.getDocumentProperties()
    .setProperty(
      PMOS_CALENDAR_AUTO_JOB,
      JSON.stringify(state || {})
    );
}


function formatCalendarJobDate_(value) {
  if (!value) return '';


  const date = new Date(value);


  if (!Number.isFinite(date.getTime())) {
    return '';
  }


  return Utilities.formatDate(
    date,
    PMOS.TIMEZONE,
    'yyyy-MM-dd h:mm:ss a'
  );
}




/* ========================================================================== */
/* PMOS v1.5.1 CALENDAR ADMINISTRATION                                        */
/* ========================================================================== */


const PMOS_CALENDAR_REBUILD_STATE = 'PMOS_CALENDAR_REBUILD_STATE';


function rebuildCalendarFromSheet() {
  const audit = runCalendarPlanAudit_();


  if (!audit.canSync) {
    showCalendarPlanAudit();
    return;
  }


  showPmosJobEngineFor_('CALENDAR_REBUILD');
}


function continueCalendarRebuild_() {
  ensureRecurringSeriesRegistry_();


  const state = getCalendarRebuildState_() || {phase: 'DELETE'};
  const calendar = getRecurringCalendar_();


  if (state.phase === 'DELETE') {
    const registry = getSeriesRegistry_();
    const keys = Object.keys(registry);
    const batch = keys.slice(0, 40);


    let deleted = 0;
    let errors = 0;
    let firstError = '';


    batch.forEach(key => {
      const record = registry[key];


      try {
        if (record.seriesId) {
          const series = calendar.getEventSeriesById(record.seriesId);
          if (series) series.deleteEventSeries();
        }


        deleteSeriesRegistryRow_(key);
        deleted++;
      } catch (error) {
        errors++;
        if (!firstError) firstError = String(error);
        console.error(`Rebuild delete ${key}: ${error}`);


        try {
          deleteSeriesRegistryRow_(key);
        } catch (ignored) {}
      }
    });


    const remainingDelete = Math.max(0, keys.length - batch.length);


    if (remainingDelete > 0) {
      return {
        phase: 'Deleting old recurring series',
        deleted,
        errors,
        firstError,
        remaining: remainingDelete,
        complete: false
      };
    }


    clearRecurringSeriesRegistry_();


    setCalendarRebuildState_({
      phase: 'CREATE',
      startedAt: state.startedAt || new Date().toISOString()
    });
  }


  const syncResult = applyCalendarChanges();


  if (!syncResult.remaining && !syncResult.errors) {
    clearCalendarRebuildState_();


    return {
      phase: 'Creating recurring series',
      created: syncResult.created,
      updated: syncResult.updated,
      deleted: syncResult.deleted,
      errors: syncResult.errors,
      firstError: syncResult.firstError || '',
      remaining: 0,
      complete: true
    };
  }


  return {
    phase: 'Creating recurring series',
    created: syncResult.created,
    updated: syncResult.updated,
    deleted: syncResult.deleted,
    errors: syncResult.errors,
    firstError: syncResult.firstError || '',
    remaining: syncResult.remaining,
    complete: false
  };
}


function showCalendarStatus() {
  const ui = SpreadsheetApp.getUi();
  const preview = previewCalendarChanges();
  const registry = getSeriesRegistry_();
  const rebuild = getCalendarRebuildState_();


  const lines = [
    'Calendar: Water Maintenance Routes',
    `${preview.totalSeries} recurring series expected`,
    `${Object.keys(registry).length} series registered`,
    `${preview.creates} to create`,
    `${preview.updates} to update`,
    `${preview.deletes} to remove`,
    `Rebuild status: ${rebuild ? rebuild.phase : 'Not running'}`
  ];


  ui.alert('PMOS Calendar Status', lines.join('\n'), ui.ButtonSet.OK);
}


function clearRecurringSeriesRegistry_() {
  const sheet = ensureRecurringSeriesRegistry_();
  if (sheet.getLastRow() > 1) {
    sheet.getRange(
      2,
      1,
      sheet.getLastRow() - 1,
      sheet.getLastColumn()
    ).clearContent();
  }
}


function getCalendarRebuildState_() {
  const raw = PropertiesService.getDocumentProperties()
    .getProperty(PMOS_CALENDAR_REBUILD_STATE);


  if (!raw) return null;


  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}


function setCalendarRebuildState_(state) {
  PropertiesService.getDocumentProperties()
    .setProperty(PMOS_CALENDAR_REBUILD_STATE, JSON.stringify(state));
}


function clearCalendarRebuildState_() {
  PropertiesService.getDocumentProperties()
    .deleteProperty(PMOS_CALENDAR_REBUILD_STATE);
}






function parseSettingDateForYear_(value, year, fallback) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return new Date(
      year,
      value.getMonth(),
      value.getDate(),
      12,
      0,
      0,
      0
    );
  }


  if (typeof value === 'number' && Number.isFinite(value)) {
    // Google Sheets normally returns Date objects, but this also supports
    // spreadsheet serial values if a date column is formatted unexpectedly.
    const spreadsheetEpoch = new Date(Date.UTC(1899, 11, 30));
    const serialDate = new Date(
      spreadsheetEpoch.getTime() +
      value * 86400000
    );


    return new Date(
      year,
      serialDate.getUTCMonth(),
      serialDate.getUTCDate(),
      12,
      0,
      0,
      0
    );
  }


  const text = String(value || '').trim();


  if (text) {
    const monthDay = text.match(
      /^(?:[A-Za-z]+\s+)?([A-Za-z]+)\s+(\d{1,2})(?:,\s*\d{4})?$/
    );


    const parsed = new Date(text);


    if (Number.isFinite(parsed.getTime())) {
      return new Date(
        year,
        parsed.getMonth(),
        parsed.getDate(),
        12,
        0,
        0,
        0
      );
    }


    const numeric = text.match(
      /^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-]\d{2,4})?$/
    );


    if (numeric) {
      return new Date(
        year,
        Number(numeric[1]) - 1,
        Number(numeric[2]),
        12,
        0,
        0,
        0
      );
    }
  }


  const safeFallback =
    fallback instanceof Date &&
    Number.isFinite(fallback.getTime())
      ? fallback
      : new Date(year, 0, 1);


  return new Date(
    year,
    safeFallback.getMonth(),
    safeFallback.getDate(),
    12,
    0,
    0,
    0
  );
}


function parseFlexibleRouteTime_(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return {
      hours: value.getHours(),
      minutes: value.getMinutes()
    };
  }


  const text = String(value || '').trim();
  const match = text.match(
    /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i
  );


  if (!match) {
    return {hours: 6, minutes: 0};
  }


  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const suffix = String(match[3] || '').toUpperCase();


  if (suffix === 'PM' && hours !== 12) hours += 12;
  if (suffix === 'AM' && hours === 12) hours = 0;


  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return {hours: 6, minutes: 0};
  }


  return {hours, minutes};
}


function positiveNumberOrDefault_(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? number
    : fallback;
}


function validateRecurringCalendarSettings_(settings) {
  const values = [
    ['Rotation Week 1 Monday', settings.rotationWeek1Start],
    ['Season Start', settings.seasonStart],
    ['Season End', settings.seasonEnd]
  ];


  values.forEach(item => {
    if (
      !(item[1] instanceof Date) ||
      !Number.isFinite(item[1].getTime())
    ) {
      throw new Error(
        `${item[0]} is not a valid date in App Settings.`
      );
    }
  });


  if (
    settings.seasonEnd.getTime() <
    settings.seasonStart.getTime()
  ) {
    throw new Error(
      'Season End occurs before Season Start in App Settings.'
    );
  }
}


function assertValidSeriesDates_(
  row,
  parsed,
  start,
  end,
  seasonEnd
) {
  const prefix =
    `${row.title} — ${row.layer}`;


  if (
    !(start instanceof Date) ||
    !Number.isFinite(start.getTime())
  ) {
    throw new Error(
      `${prefix}: invalid start time (${start}).`
    );
  }


  if (
    !(end instanceof Date) ||
    !Number.isFinite(end.getTime())
  ) {
    throw new Error(
      `${prefix}: invalid end time (${end}).`
    );
  }


  if (end.getTime() <= start.getTime()) {
    throw new Error(
      `${prefix}: end time must be after start time.`
    );
  }


  if (
    seasonEnd instanceof Date &&
    Number.isFinite(seasonEnd.getTime()) &&
    start.getTime() > endOfDay_(seasonEnd).getTime()
  ) {
    throw new Error(
      `${prefix}: first occurrence ${formatDiagnosticDate_(start)} ` +
      `is after the season end ${formatDiagnosticDate_(seasonEnd)}.`
    );
  }
}


function formatDiagnosticDate_(date) {
  return Utilities.formatDate(
    date,
    PMOS.TIMEZONE,
    'yyyy-MM-dd h:mm a'
  );
}


function testFirstRecurringSeries() {
  const ui = SpreadsheetApp.getUi();


  try {
    const settings = getRecurringCalendarSettings_();
    const plan = buildRecurringSeriesPlan_();


    if (!plan.length) {
      throw new Error(
        'No remaining route occurrences were found inside the season.'
      );
    }


    const earliest = plan.slice(0, 8).map((item, index) =>
      `${index + 1}. ${item.layer} — ${item.title}: ${formatDiagnosticDate_(item.start)}`
    );


    ui.alert(
      'Recurring-series diagnostic',
      [
        `Code version: ${PMOS_VERSION}`,
        'Rotation Week 1 Monday: July 13, 2026',
        'First eligible build day: Thursday, July 16, 2026',
        '',
        'Earliest upcoming series in actual Calendar order:',
        ...earliest,
        '',
        `Calendar: ${settings.calendarName}`
      ].join('\n'),
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert(
      'Recurring-series diagnostic failed',
      String(error),
      ui.ButtonSet.OK
    );
  }
}




/* ========================================================================== */
/* PMOS v1.5 FOUR-WEEK RECURRING CALENDAR ENGINE                              */
/* ========================================================================== */


function ensureRecurringSeriesRegistry_() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName('Calendar Series Registry');
  if (!sheet) {
    sheet = ss.insertSheet('Calendar Series Registry');
    sheet.appendRow(['Series Key','Customer ID','Layer','Series ID','Calendar Name','Signature','Last Sync','Status','Error']);
    sheet.hideSheet();
  }
  return sheet;
}


function getRecurringCalendar_() {
  const settings = getRecurringCalendarSettings_();
  const matches = CalendarApp.getCalendarsByName(settings.calendarName);
  if (matches.length) return matches[0];
  return CalendarApp.createCalendar(settings.calendarName, {
    summary: 'PMOS four-week recurring maintenance routes',
    timeZone: PMOS.TIMEZONE
  });
}


function getRecurringCalendarSettings_() {
  const base = getSettings_();
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.SETTINGS_SHEET);
  const values = sheet ? sheet.getDataRange().getValues() : [];
  const map = {};


  values.slice(1).forEach(row => {
    map[String(row[0] || '').trim()] = row[1];
  });


  const year = Number(base.calendarYear || map['Calendar Year'] || 2026);


  return {
    calendarName: 'Water Maintenance Routes',
    calendarYear: year,


    // Deliberately use the new active rotation anchor rather than the old
    // April season anchor. Monday July 13 is Week 1, which makes
    // Thursday July 16 the first future Week 1 service day.
    rotationWeek1Start: new Date(
      PMOS_RECURRING_WEEK1_MONDAY.getTime()
    ),


    seasonStart: parseSettingDateForYear_(
      map['Season Start'],
      year,
      new Date(year, 3, 1)
    ),
    seasonEnd: parseSettingDateForYear_(
      map['Season End'],
      year,
      new Date(year, 10, 30)
    ),
    eventDurationMinutes: positiveNumberOrDefault_(
      base.eventDurationMinutes,
      60
    ),
    routeStart: base.routeStart || map['Daily Route Start'] || '6:00 AM'
  };
}


function parseSettingDate_(value, fallback) {
  const fallbackDate = fallback instanceof Date
    ? new Date(fallback)
    : new Date();


  return parseSettingDateForYear_(
    value,
    fallbackDate.getFullYear(),
    fallbackDate
  );
}


function buildRecurringSeriesPlan_() {
  const settings = getRecurringCalendarSettings_();
  validateRecurringCalendarSettings_(settings);


  const plans = [];


  readRoutesInPhysicalOrder_().forEach(row => {
    const parsed = parseLayer_(row.layer);
    const firstDate = firstOccurrenceForLayer_(
      parsed,
      settings,
      row.yearRound
    );


    // Seasonal customers whose next aligned occurrence is beyond season end
    // have no remaining visit this season and should not create a series.
    if (
      !row.yearRound &&
      firstDate.getTime() > endOfDay_(settings.seasonEnd).getTime()
    ) {
      return;
    }


    const order = positiveNumberOrDefault_(row.order, 1);
    const start = routeTimeForOrder_(firstDate, order, settings);
    const end = new Date(
      start.getTime() +
      settings.eventDurationMinutes * 60000
    );


    assertValidSeriesDates_(
      row,
      parsed,
      start,
      end,
      row.yearRound ? null : settings.seasonEnd
    );


    const until = row.yearRound
      ? null
      : endOfDay_(settings.seasonEnd);


    const seriesKey =
      `${row.customerId || normalize_(row.title)}|${row.layer}`;


    const description =
      buildRouteDescription_(row, parsed) +
      `\n\nPMOS_SERIES_KEY=${seriesKey}`;


    const plan = {
      seriesKey,
      customerId: row.customerId || '',
      layer: row.layer,
      title: row.title,
      start,
      end,
      until,
      location: row.address || '',
      description,
      color: calendarColorForFrequency_(row.frequency),
      row
    };


    plan.signature = recurringSeriesSignature_(plan);
    plans.push(plan);
  });


  plans.sort((a, b) =>
    a.start.getTime() - b.start.getTime() ||
    a.layer.localeCompare(b.layer) ||
    a.row.order - b.row.order
  );


  return plans;
}


function firstOccurrenceForLayer_(parsed, settings, yearRound) {
  const dayOffsets = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6
  };


  if (!Object.prototype.hasOwnProperty.call(dayOffsets, parsed.day)) {
    throw new Error(
      `Unsupported route weekday "${parsed.day}" in ${parsed.routeDay}.`
    );
  }


  const date = new Date(settings.rotationWeek1Start.getTime());
  date.setHours(12, 0, 0, 0);
  date.setDate(
    date.getDate() +
    (parsed.week - 1) * 7 +
    dayOffsets[parsed.day]
  );


  // Use the actual current moment—not merely midnight—so a route whose
  // start time has already passed today advances by a full 28-day cycle.
  const now = new Date();
  const routeStart = parseFlexibleRouteTime_(settings.routeStart);


  date.setHours(routeStart.hours, routeStart.minutes, 0, 0);


  while (date.getTime() <= now.getTime()) {
    date.setDate(date.getDate() + 28);
  }


  // Return the service date; routeTimeForOrder_ will apply the exact
  // staggered time for each stop.
  date.setHours(12, 0, 0, 0);
  return date;
}


function endOfDay_(date) {
  const result = new Date(date);
  result.setHours(23,59,59,999);
  return result;
}


function buildFourWeekRecurrence_(plan) {
  // setTimeZone() returns EventRecurrence, while until() belongs to
  // the RecurrenceRule returned by addWeeklyRule(). Keep both references.
  const recurrence = CalendarApp.newRecurrence()
    .setTimeZone(PMOS.TIMEZONE);


  const weeklyRule = recurrence
    .addWeeklyRule()
    .interval(4);


  if (plan.until) {
    weeklyRule.until(plan.until);
  }


  return recurrence;
}


function createRecurringSeries_(calendar, plan) {
  const series = calendar.createEventSeries(
    plan.title, plan.start, plan.end, buildFourWeekRecurrence_(plan),
    {description: plan.description, location: plan.location}
  );
  series.setTag('PMOS_SERIES_KEY', plan.seriesKey);
  series.setTag('PMOS_CUSTOMER_ID', plan.customerId || '');
  if (plan.color) series.setColor(plan.color);
  return series;
}


function updateRecurringSeries_(series, plan) {
  series.setTitle(plan.title);
  series.setDescription(plan.description);
  series.setLocation(plan.location);
  series.setRecurrence(buildFourWeekRecurrence_(plan), plan.start, plan.end);
  series.setTag('PMOS_SERIES_KEY', plan.seriesKey);
  series.setTag('PMOS_CUSTOMER_ID', plan.customerId || '');
  if (plan.color) series.setColor(plan.color);
}


function calendarColorForFrequency_(frequency) {
  const normalized = normalize_(frequency);
  if (normalized.includes('monthly') || normalized.includes('4 week')) return '3'; // Grape
  if (normalized.includes('biweekly') || normalized.includes('bi weekly')) return '9'; // Blueberry
  return '7'; // Peacock / weekly
}


function recurringSeriesSignature_(plan) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify({
      title: plan.title, start: plan.start.toISOString(), end: plan.end.toISOString(),
      until: plan.until ? plan.until.toISOString() : '', location: plan.location,
      description: plan.description, color: plan.color
    })
  ));
}


function getSeriesRegistry_() {
  const sheet = ensureRecurringSeriesRegistry_();
  const values = sheet.getDataRange().getValues();
  const map = {};
  values.slice(1).forEach((row,index) => {
    if (!row[0]) return;
    map[String(row[0])] = {
      row: index + 2, seriesKey: String(row[0]), customerId: String(row[1] || ''),
      layer: String(row[2] || ''), seriesId: String(row[3] || ''),
      calendarName: String(row[4] || ''), signature: String(row[5] || ''),
      status: String(row[7] || '')
    };
  });
  return map;
}


function compareSeriesPlanToRegistry_(plan, registry, calendar) {
  const expected = {};
  const actions = [];


  // The incoming plan is already sorted chronologically.
  // Preserve that exact order for CREATE and UPDATE actions.
  plan.forEach(item => {
    expected[item.seriesKey] = true;


    const record = registry[item.seriesKey];


    if (!record || !record.seriesId) {
      actions.push({
        action: 'CREATE',
        seriesKey: item.seriesKey,
        layer: item.layer,
        title: item.title,
        plan: item
      });
      return;
    }


    let series = null;


    try {
      series = calendar.getEventSeriesById(record.seriesId);
    } catch (error) {
      console.warn(
        `Could not read recurring series ${record.seriesId}: ${error}`
      );
    }


    if (!series || record.signature !== item.signature) {
      actions.push({
        action: 'UPDATE',
        seriesKey: item.seriesKey,
        layer: item.layer,
        title: item.title,
        plan: item,
        series
      });
    }
  });


  // Obsolete registry entries are deleted after creates/updates.
  Object.keys(registry).forEach(key => {
    if (expected[key]) return;


    const record = registry[key];
    let series = null;


    try {
      series = calendar.getEventSeriesById(record.seriesId);
    } catch (error) {
      console.warn(
        `Could not read obsolete recurring series ${record.seriesId}: ${error}`
      );
    }


    actions.push({
      action: 'DELETE',
      seriesKey: key,
      layer: record.layer,
      title: key,
      series
    });
  });


  return actions;
}


function upsertSeriesRegistry_(plan, seriesId, calendarName, status) {
  const sheet = ensureRecurringSeriesRegistry_();
  const registry = getSeriesRegistry_();
  const row = [plan.seriesKey, plan.customerId, plan.layer, seriesId, calendarName, plan.signature, new Date(), status, ''];
  if (registry[plan.seriesKey]) sheet.getRange(registry[plan.seriesKey].row,1,1,row.length).setValues([row]);
  else sheet.appendRow(row);
}


function deleteSeriesRegistryRow_(seriesKey) {
  const sheet = ensureRecurringSeriesRegistry_();
  const registry = getSeriesRegistry_();
  if (registry[seriesKey]) sheet.deleteRow(registry[seriesKey].row);
}


function markSeriesRegistryError_(seriesKey, error) {
  const registry = getSeriesRegistry_();
  const sheet = ensureRecurringSeriesRegistry_();
  if (registry[seriesKey]) {
    sheet.getRange(registry[seriesKey].row,8,1,2).setValues([['Error', error]]);
  }
}
