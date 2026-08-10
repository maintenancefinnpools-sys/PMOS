/**
 * Shared Operations/Job Center callbacks that are still used by current PMOS UI.
 * This module contains no generic Job Engine runtime or Calendar execution path.
 */

function rememberPmosJobType(type) {
  return rememberPmosJobType_(type);
}

function rememberPmosJobType_(type) {
  const value = String(type || '').trim();
  if (value) {
    PropertiesService.getUserProperties().setProperty('PMOS_LAST_JOB_TYPE', value);
  }
  return value;
}

function ensurePmosJobHistorySheet_() {
  const spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getSheetByName(PMOS_JOB_HISTORY_SHEET);
  if (sheet) return sheet;

  sheet = spreadsheet.insertSheet(PMOS_JOB_HISTORY_SHEET);
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
  return sheet;
}

function formatJobHistoryDate_(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value || '');
  return Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd h:mm a');
}

/** Public wrappers used by current Temporary Visit dialogs. */
function suggestTemporaryVisitPlacement(payload) {
  return suggestTemporaryVisitPlacement_(payload);
}

function recommendTemporaryVisitDates(payload) {
  return recommendTemporaryVisitDates_(payload);
}

function scheduleTemporaryVisits(payload) {
  return scheduleTemporaryVisits_(payload);
}
