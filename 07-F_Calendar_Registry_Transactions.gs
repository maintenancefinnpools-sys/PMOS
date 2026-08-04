/**
 * Calendar registry transaction and history foundation.
 *
 * The active Calendar Series Registry remains the current-state index. This
 * append-only history records what PMOS intended, what Calendar reported, and
 * whether the resulting registry state was verified.
 */

const PMOS_CALENDAR_TRANSACTION_SHEET = 'Calendar Registry History';
const PMOS_CALENDAR_TRANSACTION_HEADERS = [
  'Transaction ID',
  'Job ID',
  'Plan ID',
  'Operation ID',
  'Action',
  'Series Key',
  'Status',
  'Previous Series ID',
  'Result Series ID',
  'Previous Signature',
  'Result Signature',
  'Before JSON',
  'After JSON',
  'Started At',
  'Calendar Applied At',
  'Registry Applied At',
  'Verified At',
  'Completed At',
  'Last Error'
];

function beginPmosCalendarRegistryTransaction_(state, operation, current, desired) {
  const operationId = String(operation && operation.payload && operation.payload.operationId || '');
  if (!operationId) throw new Error('Calendar transaction requires an operation ID.');

  const sheet = ensurePmosCalendarTransactionSheet_();
  const existing = findPmosCalendarTransactionByOperation_(sheet, operationId);
  if (existing) return existing.record;

  const transactionId = Utilities.getUuid();
  const before = clonePmosCalendarTransactionValue_(current || null);
  const after = clonePmosCalendarTransactionValue_(desired || null);
  const row = [
    transactionId,
    String(state && state.id || ''),
    String(state && state.planId || ''),
    operationId,
    String(operation.operationType || operation.payload.action || ''),
    String(operation.payload.seriesKey || ''),
    'STARTED',
    String(before && before.seriesId || ''),
    '',
    String(before && before.signature || ''),
    String(after && after.signature || ''),
    JSON.stringify(before),
    JSON.stringify(after),
    new Date(),
    '',
    '',
    '',
    '',
    ''
  ];
  sheet.appendRow(row);
  return buildPmosCalendarTransactionRecord_(row, sheet.getLastRow());
}

function markPmosCalendarTransactionApplied_(transactionId, seriesId) {
  updatePmosCalendarTransaction_(transactionId, function (row) {
    row[6] = 'CALENDAR_APPLIED';
    row[8] = String(seriesId || '');
    row[14] = new Date();
    row[18] = '';
  });
}

function markPmosCalendarTransactionRegistryApplied_(transactionId, seriesId) {
  updatePmosCalendarTransaction_(transactionId, function (row) {
    row[6] = 'REGISTRY_APPLIED';
    row[8] = String(seriesId || row[8] || '');
    row[15] = new Date();
    row[18] = '';
  });
}

function completePmosCalendarRegistryTransaction_(transactionId, seriesId) {
  updatePmosCalendarTransaction_(transactionId, function (row) {
    row[6] = 'VERIFIED';
    row[8] = String(seriesId || row[8] || '');
    row[16] = new Date();
    row[17] = new Date();
    row[18] = '';
  });
}

function failPmosCalendarRegistryTransaction_(transactionId, error) {
  updatePmosCalendarTransaction_(transactionId, function (row) {
    row[6] = 'FAILED';
    row[18] = String(error && error.message ? error.message : error || 'Unknown error');
  });
}

function readRecoverablePmosCalendarTransactions_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_CALENDAR_TRANSACTION_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, PMOS_CALENDAR_TRANSACTION_HEADERS.length)
    .getValues()
    .map(function (row, index) {
      return buildPmosCalendarTransactionRecord_(row, index + 2);
    })
    .filter(function (record) {
      return ['STARTED', 'CALENDAR_APPLIED', 'REGISTRY_APPLIED', 'FAILED']
        .indexOf(record.status) >= 0;
    });
}

function ensurePmosCalendarTransactionSheet_() {
  const spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getSheetByName(PMOS_CALENDAR_TRANSACTION_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(PMOS_CALENDAR_TRANSACTION_SHEET);
    sheet.getRange(1, 1, 1, PMOS_CALENDAR_TRANSACTION_HEADERS.length)
      .setValues([PMOS_CALENDAR_TRANSACTION_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.hideSheet();
    return sheet;
  }

  const headers = sheet.getRange(1, 1, 1, PMOS_CALENDAR_TRANSACTION_HEADERS.length)
    .getValues()[0].map(function (value) { return String(value || '').trim(); });
  const valid = PMOS_CALENDAR_TRANSACTION_HEADERS.every(function (header, index) {
    return headers[index] === header;
  });
  if (!valid) throw new Error(PMOS_CALENDAR_TRANSACTION_SHEET + ' has an unexpected schema.');
  if (!sheet.isSheetHidden()) sheet.hideSheet();
  return sheet;
}

function updatePmosCalendarTransaction_(transactionId, mutator) {
  const sheet = ensurePmosCalendarTransactionSheet_();
  const found = findPmosCalendarTransactionById_(sheet, transactionId);
  if (!found) throw new Error('Calendar registry transaction was not found: ' + transactionId + '.');
  const row = found.values.slice();
  mutator(row);
  sheet.getRange(found.rowNumber, 1, 1, row.length).setValues([row]);
  return buildPmosCalendarTransactionRecord_(row, found.rowNumber);
}

function findPmosCalendarTransactionByOperation_(sheet, operationId) {
  if (sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, PMOS_CALENDAR_TRANSACTION_HEADERS.length)
    .getValues();
  for (let index = rows.length - 1; index >= 0; index--) {
    if (String(rows[index][3] || '') === String(operationId || '')) {
      return { rowNumber: index + 2, values: rows[index], record: buildPmosCalendarTransactionRecord_(rows[index], index + 2) };
    }
  }
  return null;
}

function findPmosCalendarTransactionById_(sheet, transactionId) {
  if (sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, PMOS_CALENDAR_TRANSACTION_HEADERS.length)
    .getValues();
  for (let index = rows.length - 1; index >= 0; index--) {
    if (String(rows[index][0] || '') === String(transactionId || '')) {
      return { rowNumber: index + 2, values: rows[index] };
    }
  }
  return null;
}

function buildPmosCalendarTransactionRecord_(row, rowNumber) {
  return {
    rowNumber: rowNumber,
    transactionId: String(row[0] || ''),
    jobId: String(row[1] || ''),
    planId: String(row[2] || ''),
    operationId: String(row[3] || ''),
    action: String(row[4] || ''),
    seriesKey: String(row[5] || ''),
    status: String(row[6] || ''),
    previousSeriesId: String(row[7] || ''),
    resultSeriesId: String(row[8] || ''),
    previousSignature: String(row[9] || ''),
    resultSignature: String(row[10] || ''),
    before: parsePmosCalendarTransactionJson_(row[11]),
    after: parsePmosCalendarTransactionJson_(row[12]),
    startedAt: pmosCalendarTransactionDate_(row[13]),
    calendarAppliedAt: pmosCalendarTransactionDate_(row[14]),
    registryAppliedAt: pmosCalendarTransactionDate_(row[15]),
    verifiedAt: pmosCalendarTransactionDate_(row[16]),
    completedAt: pmosCalendarTransactionDate_(row[17]),
    lastError: String(row[18] || '')
  };
}

function parsePmosCalendarTransactionJson_(value) {
  try { return JSON.parse(String(value || 'null')); }
  catch (error) { return null; }
}

function pmosCalendarTransactionDate_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : String(value);
}

function clonePmosCalendarTransactionValue_(value) {
  if (value == null || typeof value !== 'object') return value == null ? null : value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(clonePmosCalendarTransactionValue_);
  const copy = {};
  Object.keys(value).sort().forEach(function (key) {
    copy[key] = clonePmosCalendarTransactionValue_(value[key]);
  });
  return copy;
}
