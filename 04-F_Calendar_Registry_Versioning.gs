/**
 * Versioned active Calendar registry foundation.
 *
 * The active registry is a rebuildable current-state index. Stable object IDs
 * survive Calendar series recreation, while versions advance only when the
 * managed series identity or signature changes.
 */
const PMOS_CALENDAR_REGISTRY_SHEET = 'Calendar Series Registry';
const PMOS_CALENDAR_REGISTRY_HEADERS = [
  'Series Key','Customer ID','Layer','Series ID','Calendar Name','Signature',
  'Last Sync','Status','Error','PMOS Object ID','Current Version',
  'Last Verified','Last Transaction ID'
];

function ensureVersionedRecurringSeriesRegistry_() {
  const spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getSheetByName(PMOS_CALENDAR_REGISTRY_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(PMOS_CALENDAR_REGISTRY_SHEET);
    sheet.getRange(1,1,1,PMOS_CALENDAR_REGISTRY_HEADERS.length)
      .setValues([PMOS_CALENDAR_REGISTRY_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.hideSheet();
    return sheet;
  }
  migrateRecurringSeriesRegistrySchema_(sheet);
  if (!sheet.isSheetHidden()) sheet.hideSheet();
  return sheet;
}

function migrateRecurringSeriesRegistrySchema_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(),1);
  const existing = sheet.getRange(1,1,1,lastColumn).getValues()[0]
    .map(function(value){ return String(value || '').trim(); });
  PMOS_CALENDAR_REGISTRY_HEADERS.forEach(function(header,index){
    const current = existing[index] || '';
    if (current && current !== header) {
      throw new Error(
        PMOS_CALENDAR_REGISTRY_SHEET + ' has an unexpected header in column ' +
        (index + 1) + ': expected "' + header + '", found "' + current + '".'
      );
    }
    if (!current) sheet.getRange(1,index + 1).setValue(header);
  });
  if (sheet.getLastRow() < 2) return;
  const rowCount = sheet.getLastRow() - 1;
  const width = PMOS_CALENDAR_REGISTRY_HEADERS.length;
  const rows = sheet.getRange(2,1,rowCount,width).getValues();
  let changed = false;
  rows.forEach(function(row){
    if (!String(row[0] || '').trim()) return;
    if (!String(row[9] || '').trim()) { row[9] = Utilities.getUuid(); changed = true; }
    const version = Number(row[10] || 0);
    if (!Number.isFinite(version) || version < 1) { row[10] = 1; changed = true; }
    if (!row[11] && row[6]) { row[11] = row[6]; changed = true; }
  });
  if (changed) sheet.getRange(2,1,rowCount,width).setValues(rows);
}

function resolvePmosRegistryIdentity_(existingRecord, plan, seriesId) {
  const existing = existingRecord || null;
  const objectId = existing && existing.objectId
    ? String(existing.objectId)
    : String(plan && plan.objectId || Utilities.getUuid());
  const changed = !existing ||
    String(existing.seriesId || '') !== String(seriesId || '') ||
    String(existing.signature || '') !== String(plan && plan.signature || '') ||
    String(existing.seriesKey || '') !== String(plan && plan.seriesKey || '');
  const currentVersion = existing
    ? Math.max(1,Number(existing.currentVersion || 1))
    : 0;
  return {
    objectId: objectId,
    currentVersion: changed ? currentVersion + 1 : Math.max(1,currentVersion)
  };
}

function preparePmosRegistryPlanIdentity_(plan, existingRecord, seriesId) {
  if (!plan) throw new Error('Calendar series plan is required for registry identity.');
  if (plan.objectId && Number(plan.currentVersion || 0) >= 1) {
    return {objectId:String(plan.objectId),currentVersion:Number(plan.currentVersion)};
  }
  const identity = resolvePmosRegistryIdentity_(existingRecord,plan,seriesId);
  plan.objectId = identity.objectId;
  plan.currentVersion = identity.currentVersion;
  return identity;
}

function readPmosRegistryTransactionIdForOperation_(operationId) {
  if (!operationId) return '';
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_CALENDAR_TRANSACTION_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return '';
  const found = findPmosCalendarTransactionByOperation_(sheet,operationId);
  return found && found.record ? String(found.record.transactionId || '') : '';
}
