/**
 * Canonical PMOS customer identity helpers.
 *
 * Existing legacy IDs are preserved. All newly-created Customers receive the
 * PMOS-00001 style used by Customer Sync so new workflows do not introduce a
 * third identity format.
 */
function generateNextPmosCustomerId_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.CUSTOMERS_SHEET);
  if (!sheet) throw new Error('Missing sheet: ' + PMOS.CUSTOMERS_SHEET);

  const values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error(PMOS.CUSTOMERS_SHEET + ' has no header row.');

  const headers = values[0].map(function (value) {
    return String(value || '').trim();
  });
  const idColumn = headers.indexOf('Customer ID');
  if (idColumn < 0) {
    throw new Error(PMOS.CUSTOMERS_SHEET + ' is missing the Customer ID column.');
  }

  const used = {};
  let maximum = 0;
  values.slice(1).forEach(function (row) {
    const id = String(row[idColumn] || '').trim();
    if (!id) return;
    used[id.toUpperCase()] = true;
    const match = id.match(/^PMOS-(\d+)$/i);
    if (match) maximum = Math.max(maximum, Number(match[1]));
  });

  let candidate = '';
  do {
    maximum++;
    candidate = 'PMOS-' + String(maximum).padStart(5, '0');
  } while (used[candidate.toUpperCase()]);

  return candidate;
}
