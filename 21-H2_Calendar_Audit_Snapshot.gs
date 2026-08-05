/** Durable immutable Calendar audit snapshot used only during one review flow. */
const PMOS_CALENDAR_AUDIT_SNAPSHOT_SHEET = 'PMOS Calendar Audit Snapshot';
const PMOS_CALENDAR_AUDIT_SNAPSHOT_CHUNK = 40000;

function savePmosCalendarAuditSnapshot_(audit) {
  const sheet = ensurePmosCalendarAuditSnapshotSheet_();
  const snapshot = {
    version: 1,
    savedAt: new Date().toISOString(),
    planId: String(audit && audit.planId || ''),
    sourceVersion: String(audit && audit.sourceVersion || ''),
    calendarName: String(audit && audit.calendarName || ''),
    preview: audit && audit.preview || {},
    issues: audit && audit.issues || [],
    errors: audit && audit.errors || [],
    warnings: audit && audit.warnings || [],
    suggestedMatches: audit && audit.suggestedMatches || [],
    unclassifiedEvents: audit && audit.unclassifiedEvents || [],
    deletionCandidates: audit && audit.deletionCandidates || []
  };
  const json = JSON.stringify(snapshot);
  const chunks = [];
  for (let index = 0; index < json.length; index += PMOS_CALENDAR_AUDIT_SNAPSHOT_CHUNK) {
    chunks.push([Math.floor(index / PMOS_CALENDAR_AUDIT_SNAPSHOT_CHUNK) + 1,
      json.slice(index, index + PMOS_CALENDAR_AUDIT_SNAPSHOT_CHUNK)]);
  }
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 2).setValues([['Sequence', 'Snapshot JSON']]);
  if (chunks.length) sheet.getRange(2, 1, chunks.length, 2).setValues(chunks);
  if (!sheet.isSheetHidden()) sheet.hideSheet();
  return {saved: true, chunks: chunks.length, planId: snapshot.planId};
}

function readPmosCalendarAuditSnapshot_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_CALENDAR_AUDIT_SNAPSHOT_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues()
    .filter(function (row) { return row[1] !== ''; })
    .sort(function (left, right) { return Number(left[0] || 0) - Number(right[0] || 0); });
  if (!rows.length) return null;
  try {
    return JSON.parse(rows.map(function (row) { return String(row[1] || ''); }).join(''));
  } catch (error) {
    clearPmosCalendarAuditSnapshot_();
    return null;
  }
}

function clearPmosCalendarAuditSnapshot_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_CALENDAR_AUDIT_SNAPSHOT_SHEET);
  if (sheet) {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, 2).setValues([['Sequence', 'Snapshot JSON']]);
    if (!sheet.isSheetHidden()) sheet.hideSheet();
  }
}

function ensurePmosCalendarAuditSnapshotSheet_() {
  const spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getSheetByName(PMOS_CALENDAR_AUDIT_SNAPSHOT_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(PMOS_CALENDAR_AUDIT_SNAPSHOT_SHEET);
  if (!sheet.isSheetHidden()) sheet.hideSheet();
  return sheet;
}
