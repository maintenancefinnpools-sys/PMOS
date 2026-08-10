/**
 * PMOS App Settings — visible operational configuration.
 */
function ensureAppSettingsSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(PMOS.SETTINGS_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(PMOS.SETTINGS_SHEET);
  }

  const defaults = [
    ['Setting', 'Value', 'Description'],
    ['Calendar Name', PMOS.CALENDAR_NAME, 'Exact Google Calendar name used by Calendar Sync. Change this to switch between Operations and Development.'],
    ['Calendar Year', new Date().getFullYear(), 'Year used for seasonal schedule dates.'],
    ['Season Start', new Date(new Date().getFullYear(), 3, 1), 'First date for seasonal maintenance.'],
    ['Season End', new Date(new Date().getFullYear(), 10, 30), 'Last date for seasonal maintenance.'],
    ['Daily Route Start', '6:00 AM', 'Start time used when calculating route event times.']
  ];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, defaults.length, defaults[0].length).setValues(defaults);
  } else {
    const values = sheet.getDataRange().getValues();
    const existing = new Set(
      values.slice(1).map(row => String(row[0] || '').trim()).filter(Boolean)
    );

    defaults.slice(1).forEach(row => {
      if (!existing.has(row[0])) sheet.appendRow(row);
    });

    if (!String(sheet.getRange(1, 1).getValue() || '').trim()) {
      sheet.getRange(1, 1, 1, 3).setValues([defaults[0]]);
    }
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  sheet.getRange('B3').setNumberFormat('0');
  sheet.getRange('B4:B5').setNumberFormat('yyyy-mm-dd');
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 240);
  sheet.setColumnWidth(3, 520);

  return sheet;
}
