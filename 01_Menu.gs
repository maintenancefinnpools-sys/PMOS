/**
 * PMOS v1.9.0 — Menus and user entry points.
 * Move-only refactor: public names and operational behavior are preserved.
 */

function showNewMaintenanceClientNotice() {
  return showAddMaintenanceClient();
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
          .addItem('Schedule New Maintenance Client', 'showAddMaintenanceClient')
          .addItem('Schedule Temporary Visit', 'showTemporaryVisitScheduler')
          .addSeparator()
          .addItem('Calendar Plan Audit', 'showCalendarAuditTaskWindow')
          .addItem('Calendar Job Engine', 'openPmosJobEngine')
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
