/**
 * PMOS v1.9.0 — Menus and user entry points.
 */

function onOpen() {
  const initialized = isPmosInitialized_();
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('PMOS');

  if (!initialized) {
    menu.addItem('Initialize PMOS', 'initializePmos');
  } else {
    menu
      .addSubMenu(
        ui.createMenu('Customers')
          .addItem('Add Customer', 'showPmosAddCustomer')
          .addItem('Add Maintenance Customer', 'showAddMaintenanceClientV2')
          .addItem('Customer Lookup / Profiles', 'showPmosCustomerAccountLookup')
      )
      .addSeparator()
      .addSubMenu(
        ui.createMenu('Scheduling')
          .addItem('Temporary Maintenance', 'showTemporaryVisitSchedulerV3')
          .addItem('Service Call', 'showPmosServiceCallScheduler')
          .addItem('Opening / Closing', 'showPmosOpeningClosingScheduler')
      )
      .addSeparator()
      .addItem('Job Center', 'openPmosJobEngine')
      .addSubMenu(
        ui.createMenu('PMOS Settings')
          .addItem('App Settings', 'openPmosAppSettings')
          .addItem('Routing Settings', 'showPmosRoutingSettings')
          .addItem('Google Contacts Mass Sync', 'showPmosGoogleContactsMassSync')
          .addSeparator()
          .addItem('Chemistry Catalog', 'showChemistryCatalog')
          .addItem('Feature Lab', 'showFeatureLab')
          .addSeparator()
          .addItem('Update Permissions', 'updatePmosPermissions')
      )
      .addSeparator()
      .addSubMenu(
        ui.createMenu('Activity & History')
          .addItem('Job History', 'showPmosJobHistoryWindow')
          .addItem('Route History', 'showRouteHistoryDialog')
          .addItem('Transaction Recovery Review', 'showCalendarTransactionRecoveryReview')
      )
      .addSubMenu(
        ui.createMenu('Updates')
          .addItem('Update PMOS', 'updatePmos')
          .addItem('Update Center', 'showUpdateCenter')
      )
      .addSeparator()
      .addItem('Route Manager', 'showRouteManagerLink');
  }

  menu.addToUi();
}

/**
 * Menu-safe placeholders for workflows that are intentionally represented in the
 * navigation before their dedicated creation/scheduling screens are implemented.
 */
function showPmosAddCustomer() {
  showPmosPlannedMenuFeature_(
    'Add Customer',
    'The non-maintenance customer creation workflow is not implemented yet. Use Add Maintenance Customer for recurring maintenance customers.'
  );
}

function showPmosServiceCallScheduler() {
  showPmosPlannedMenuFeature_(
    'Service Call',
    'The dedicated Service Call scheduler is not implemented yet.'
  );
}

function showPmosOpeningClosingScheduler() {
  showPmosPlannedMenuFeature_(
    'Opening / Closing',
    'The dedicated Opening / Closing scheduler is not implemented yet.'
  );
}

function showPmosPlannedMenuFeature_(title, message) {
  SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
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
      <p><b>Current code version:</b> ${PMOS_VERSION}</p>
      <hr>
      <p style="font-size:13px;line-height:1.5">
        <b>Update PMOS</b> applies PMOS migrations, refreshes triggers, support sheets,
        permissions-related setup, and version records after new script code has already
        been pulled or deployed into this Apps Script project.
      </p>
      <p style="font-size:13px;line-height:1.5">
        It does <b>not</b> currently pull source code directly from the PMOS GitHub
        <code>main</code> branch.
      </p>
      <hr>
      <h3>Update maintenance</h3>
      <ul>
        <li>Automatic backup before migrations</li>
        <li>Schema migrations that preserve existing data</li>
        <li>Trigger and support-sheet refresh</li>
        <li>Version and initialization-state refresh</li>
      </ul>
      <button onclick="google.script.run.withSuccessHandler(function(){google.script.host.close();}).updatePmos()">Update PMOS</button>
    </div>`
  ).setWidth(500).setHeight(500);

  SpreadsheetApp.getUi().showModelessDialog(html, 'PMOS Update Center');
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

  SpreadsheetApp.getUi().showModelessDialog(html, 'PMOS Feature Lab');
}
