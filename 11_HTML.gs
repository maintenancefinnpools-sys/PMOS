/**
 * PMOS v1.9.0 — HTML templating utilities.
 */

/**
 * Includes an Apps Script HTML file inside a template.
 * @param {string} filename HTML filename without the extension.
 * @return {string} File contents.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Returns safe, non-sensitive values used to initialize the web-app shell.
 * Existing route data remains loaded through getRouteManagerData().
 * @return {Object}
 */
function getPmosWebAppBootstrap() {
  const props = PropertiesService.getDocumentProperties();
  return {
    version: PMOS_VERSION,
    initialized: isPmosInitialized_(),
    schemaVersion: props.getProperty('PMOS_SCHEMA_VERSION') || '',
    spreadsheetName: SpreadsheetApp.getActive().getName(),
    timezone: PMOS.TIMEZONE,
    deploymentUrl: typeof getPmosWebAppUrl_ === 'function'
      ? getPmosWebAppUrl_()
      : (ScriptApp.getService().getUrl() || '')
  };
}
