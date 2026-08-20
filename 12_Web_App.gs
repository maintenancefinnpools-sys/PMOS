/**
 * PMOS v1.9.0 — Web application entry point.
 */

/**
 * Development deployment used only to repair/migrate the current development
 * spreadsheet from the obsolete Web App URL. Runtime resolution is stored in
 * Document Properties so production can keep its own deployment after merge.
 */
const PMOS_DEVELOPMENT_WEB_APP_DEPLOYMENT_ID =
  'AKfycbz-dBP_IPG9kQr9-d-PcmZGySJxy3J1epj3yt3YAe6JQcKV8Iyviagys2n-XlkY93jtuw';
const PMOS_OBSOLETE_DEVELOPMENT_WEB_APP_DEPLOYMENT_ID =
  'AKfycbxxLzHWOaVhjh1Dlk9ky_zpSi11FtwCHCSV55-IvvFgBFsuAyRU';

/** Builds the stable /exec URL for a versioned Apps Script Web App deployment. */
function buildPmosWebAppUrlFromDeploymentId_(deploymentId) {
  const id = String(deploymentId || '').trim();
  return id ? 'https://script.google.com/macros/s/' + id + '/exec' : '';
}

/**
 * Stores the Web App deployment for this spreadsheet only.
 * Run once per Apps Script/spreadsheet environment. Updating the SAME deployment
 * to Version 2, 3, 4, etc. does not require running this again because its
 * deployment ID and /exec URL stay the same.
 */
function setPmosWebAppDeploymentId_(deploymentId) {
  const id = String(deploymentId || '').trim();
  if (!id) throw new Error('A PMOS Web App deployment ID is required.');
  const props = PropertiesService.getDocumentProperties();
  props.setProperty('PMOS_WEB_APP_DEPLOYMENT_ID', id);
  // Retire the earlier URL property so it can never override the deployment ID.
  props.deleteProperty('PMOS_WEB_APP_URL');
  return buildPmosWebAppUrlFromDeploymentId_(id);
}

/**
 * One-time compatibility migration for the current PMOS development spreadsheet.
 * The previous menu implementation stored/reported an obsolete development URL.
 * If that exact obsolete deployment is found, replace it with the current stable
 * development deployment. A different configured deployment is never overwritten,
 * which keeps this code safe when merged into the operational Apps Script project.
 */
function migratePmosWebAppDeploymentSetting_() {
  const props = PropertiesService.getDocumentProperties();
  let deploymentId = String(props.getProperty('PMOS_WEB_APP_DEPLOYMENT_ID') || '').trim();
  const legacyUrl = String(props.getProperty('PMOS_WEB_APP_URL') || '').trim();

  if (!deploymentId && legacyUrl) {
    const match = legacyUrl.match(/\/macros\/s\/([^/]+)\/exec(?:[?#].*)?$/i);
    if (match) deploymentId = String(match[1] || '').trim();
  }

  if (!deploymentId || deploymentId === PMOS_OBSOLETE_DEVELOPMENT_WEB_APP_DEPLOYMENT_ID) {
    deploymentId = PMOS_DEVELOPMENT_WEB_APP_DEPLOYMENT_ID;
    props.setProperty('PMOS_WEB_APP_DEPLOYMENT_ID', deploymentId);
  }

  // The old full-URL property is no longer authoritative.
  if (legacyUrl) props.deleteProperty('PMOS_WEB_APP_URL');
  return deploymentId;
}

/** Returns the project-specific PMOS Web App URL used by all entry points. */
function getPmosWebAppUrl_() {
  const deploymentId = migratePmosWebAppDeploymentSetting_();
  if (deploymentId) return buildPmosWebAppUrlFromDeploymentId_(deploymentId);

  // Last-resort compatibility only. Normal PMOS operation should resolve from
  // PMOS_WEB_APP_DEPLOYMENT_ID instead of ScriptApp.getService().getUrl().
  return String(ScriptApp.getService().getUrl() || '').trim();
}

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.pmosVersion = PMOS_VERSION;

  // Reuse the authoritative customer equipment editor in the Web App. These
  // helpers are extended by the equipment enhancement/fix modules at load time,
  // so the Web App receives the same current catalogs and behavior as Sheets.
  template.pmosEquipmentEditorStyles =
    typeof pmosCustomerEquipmentEditorStyles_ === 'function'
      ? pmosCustomerEquipmentEditorStyles_()
      : '';
  template.pmosEquipmentEditorScript =
    typeof pmosCustomerEquipmentEditorScript_ === 'function'
      ? pmosCustomerEquipmentEditorScript_()
      : '';

  // Account Contacts, service-location contacts, and billing address are also
  // shared component generators. Rendering their client helpers once in the Web
  // App keeps Add Customer aligned with the Sheets Customer Editor architecture.
  template.pmosServiceLocationContactStyles =
    typeof pmosServiceLocationContactStyles_ === 'function'
      ? pmosServiceLocationContactStyles_()
      : '';
  template.pmosServiceLocationContactScript =
    typeof pmosServiceLocationContactClientScript_ === 'function'
      ? pmosServiceLocationContactClientScript_()
      : '';
  template.pmosAccountBillingStyles =
    typeof pmosAccountBillingAddressStyles_ === 'function'
      ? pmosAccountBillingAddressStyles_()
      : '';
  template.pmosAccountBillingScript =
    typeof pmosAccountBillingAddressClientScript_ === 'function'
      ? pmosAccountBillingAddressClientScript_()
      : '';
  template.pmosAccountContactStyles =
    typeof pmosAccountContactStyles_ === 'function'
      ? pmosAccountContactStyles_()
      : '';
  template.pmosAccountContactScript =
    typeof pmosAccountContactClientScript_ === 'function'
      ? pmosAccountContactClientScript_()
      : '';

  return template.evaluate()
    .setTitle(`PMOS ${PMOS_VERSION}`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Performs the same lightweight preparation used when Add Customer is opened
 * from Sheets, without introducing Web-only customer storage or migration logic.
 */
function preparePmosWebAddCustomer() {
  if (typeof migrateMaintenanceCustomerEquipmentStorage_ === 'function') {
    migrateMaintenanceCustomerEquipmentStorage_();
  }
  if (typeof preparePmosAddressSuggestions === 'function') {
    preparePmosAddressSuggestions();
  }
  return {ready: true};
}

/**
 * Opens the deployed PMOS Web App from the Sheets menu.
 * Apps Script menu items invoke server functions, so a transient HTML bridge opens
 * the Web App in a new tab and immediately closes itself. If the browser blocks the
 * new tab, the bridge remains visible with a normal fallback link.
 */
function showPmosWebAppLink() {
  const url = getPmosWebAppUrl_();
  if (!url) {
    SpreadsheetApp.getUi().alert(
      'PMOS Web App is not configured. Set the Web App deployment ID for this spreadsheet and reopen the PMOS menu.'
    );
    return;
  }

  const safeUrl = escapeHtml_(url);
  const html = HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><base target="_blank"></head>' +
    '<body style="font-family:Arial,sans-serif;padding:18px;color:#293944">' +
      '<div id="fallback" style="display:none">' +
        '<h3 style="margin:0 0 8px">PMOS Web App</h3>' +
        '<p style="margin:0 0 14px;color:#5f6d75">Your browser blocked the new tab. Use the link below.</p>' +
        '<a href="' + safeUrl + '" target="_blank" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#0f5470;color:#fff;text-decoration:none;font-weight:700">Open PMOS Web App</a>' +
      '</div>' +
      '<script>' +
        'window.addEventListener("load",function(){' +
          'var opened=window.open(' + JSON.stringify(url) + ',"_blank");' +
          'if(opened){setTimeout(function(){google.script.host.close();},100);}' +
          'else{document.getElementById("fallback").style.display="block";}' +
        '});' +
      '</script>' +
    '</body></html>'
  ).setWidth(400).setHeight(175);

  SpreadsheetApp.getUi().showModelessDialog(html, 'Opening PMOS Web App…');
}
