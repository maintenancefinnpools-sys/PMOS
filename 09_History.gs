/**
 * PMOS v1.9.0 — Route snapshots and version history.
 * Move-only refactor: public names and operational behavior are preserved.
 */

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


  SpreadsheetApp.getUi().showModelessDialog(html, 'PMOS Route History');
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
