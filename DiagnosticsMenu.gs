/* ========================================================================== */
/* PMOS DIAGNOSTICS MENU                                                      */
/* ========================================================================== */

/**
 * Installs a spreadsheet-open trigger that adds a dedicated diagnostics menu.
 * Run this function once after the file is added to Apps Script.
 */
function installPmosDiagnosticsMenu() {
  const spreadsheet = SpreadsheetApp.getActive();
  if (!spreadsheet) {
    throw new Error('No active PMOS spreadsheet is available.');
  }

  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'showPmosDiagnosticsMenu_')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('showPmosDiagnosticsMenu_')
    .forSpreadsheet(spreadsheet)
    .onOpen()
    .create();

  showPmosDiagnosticsMenu_();

  SpreadsheetApp.getUi().alert(
    'PMOS Diagnostics Menu Installed',
    'The PMOS Diagnostics menu is now available and will be restored whenever the spreadsheet opens.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Adds a separate, non-invasive diagnostics menu without modifying PMOS logic.
 */
function showPmosDiagnosticsMenu_() {
  SpreadsheetApp.getUi()
    .createMenu('PMOS Diagnostics')
    .addItem('System Health', 'showPmosSystemHealth')
    .addToUi();
}

/**
 * Removes the diagnostics-menu trigger if the menu is no longer wanted.
 */
function uninstallPmosDiagnosticsMenu() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'showPmosDiagnosticsMenu_')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  SpreadsheetApp.getUi().alert(
    'PMOS Diagnostics Menu Removed',
    'Refresh the spreadsheet to remove the menu from the current browser session.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
