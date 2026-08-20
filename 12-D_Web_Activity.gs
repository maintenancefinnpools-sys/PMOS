/** Web App adapter for PMOS Activity & History. */

function getPmosWebActivityHistory(limit) {
  const maxRows = Math.max(1, Math.min(200, Number(limit || 75)));
  return {
    jobs: getPmosWebJobHistory(maxRows),
    scheduledWork: getPmosScheduledWorkHistory(maxRows),
    calendarTransactions: getPmosWebCalendarTransactionHistory_(maxRows),
    routeVersions: getPmosWebRouteVersionHistory_(maxRows)
  };
}

function getPmosWebCalendarTransactionHistory_(limit) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_CALENDAR_TRANSACTION_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const count = Math.min(Math.max(1, Number(limit || 75)), sheet.getLastRow() - 1);
  const start = sheet.getLastRow() - count + 1;
  return sheet.getRange(start, 1, count, PMOS_CALENDAR_TRANSACTION_HEADERS.length).getValues()
    .map(function(row, index) {
      return buildPmosCalendarTransactionRecord_(row, start + index);
    })
    .reverse()
    .map(function(record) {
      const after = record.after || {};
      const before = record.before || {};
      return {
        transactionId: record.transactionId,
        jobId: record.jobId,
        planId: record.planId,
        operationId: record.operationId,
        action: record.action,
        seriesKey: record.seriesKey,
        status: record.status,
        title: String(after.title || before.title || record.seriesKey || record.action || 'Calendar transaction'),
        layer: String(after.layer || before.layer || ''),
        customerId: String(after.customerId || before.customerId || ''),
        startedAt: formatPmosWebActivityDate_(record.startedAt),
        completedAt: formatPmosWebActivityDate_(record.completedAt || record.verifiedAt || record.registryAppliedAt || record.calendarAppliedAt),
        sortTime: pmosWebActivityDateMillis_(record.completedAt || record.verifiedAt || record.registryAppliedAt || record.calendarAppliedAt || record.startedAt),
        lastError: record.lastError
      };
    });
}

function getPmosWebRouteVersionHistory_(limit) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.VERSIONS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const count = Math.min(Math.max(1, Number(limit || 75)), sheet.getLastRow() - 1);
  const start = sheet.getLastRow() - count + 1;
  return sheet.getRange(start, 1, count, Math.min(4, sheet.getLastColumn())).getValues()
    .reverse()
    .map(function(row) {
      const date = row[1] instanceof Date ? row[1] : new Date(row[1]);
      return {
        id: String(row[0] || ''),
        timestamp: Number.isFinite(date.getTime()) ? Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd h:mm a') : String(row[1] || ''),
        sortTime: Number.isFinite(date.getTime()) ? date.getTime() : 0,
        label: String(row[2] || '')
      };
    });
}

function formatPmosWebActivityDate_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime())
    ? Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd h:mm a')
    : String(value);
}

function pmosWebActivityDateMillis_(value) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}
