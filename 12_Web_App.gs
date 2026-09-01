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

  if (legacyUrl) props.deleteProperty('PMOS_WEB_APP_URL');
  return deploymentId;
}

/** Returns the project-specific PMOS Web App URL used by all entry points. */
function getPmosWebAppUrl_() {
  const deploymentId = migratePmosWebAppDeploymentSetting_();
  if (deploymentId) return buildPmosWebAppUrlFromDeploymentId_(deploymentId);
  return String(ScriptApp.getService().getUrl() || '').trim();
}

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.pmosVersion = PMOS_VERSION;

  template.pmosEquipmentEditorStyles =
    typeof pmosCustomerEquipmentEditorStyles_ === 'function'
      ? pmosCustomerEquipmentEditorStyles_()
      : '';
  template.pmosEquipmentEditorScript =
    typeof pmosCustomerEquipmentEditorScript_ === 'function'
      ? pmosCustomerEquipmentEditorScript_()
      : '';
  template.pmosEquipmentProfileStyles =
    typeof pmosCustomerEquipmentProfileStyles_ === 'function'
      ? pmosCustomerEquipmentProfileStyles_()
      : '';
  template.pmosEquipmentProfileScript =
    typeof pmosCustomerEquipmentProfileClientScript_ === 'function'
      ? pmosCustomerEquipmentProfileClientScript_()
      : '';

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
 * Opens a small launcher from the Sheets menu. Browsers frequently block an
 * automatic window.open() triggered after an Apps Script menu callback, so this
 * dialog intentionally requires one direct user action. The launch button receives
 * focus automatically, allowing Enter to open PMOS immediately without a mouse.
 */
function showPmosWebAppLink() {
  const url = getPmosWebAppUrl_();
  if (!url) {
    SpreadsheetApp.getUi().alert(
      'PMOS Web App is not configured. Set the Web App deployment ID for this spreadsheet and reopen the PMOS menu.'
    );
    return;
  }

  const html = HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><base target="_blank"></head>' +
    '<body style="margin:0;font-family:Arial,sans-serif;background:#f7f9fa;color:#293944">' +
      '<div style="padding:22px;text-align:center">' +
        '<h3 style="margin:0 0 8px;font-size:18px">PMOS Web App</h3>' +
        '<p style="margin:0 0 18px;color:#5f6d75;font-size:13px">Press Enter or click below to open PMOS.</p>' +
        '<button id="openPmosButton" type="button" ' +
          'style="padding:11px 18px;border:0;border-radius:8px;background:#0f5470;color:#fff;font-weight:700;font-size:14px;cursor:pointer;outline-offset:3px">' +
          'Open PMOS Web App' +
        '</button>' +
      '</div>' +
      '<script>' +
        'var pmosUrl=' + JSON.stringify(url) + ';' +
        'function openPmos(){' +
          'var opened=window.open(pmosUrl,"_blank");' +
          'if(opened){setTimeout(function(){google.script.host.close();},150);}' +
        '}' +
        'window.addEventListener("load",function(){' +
          'var button=document.getElementById("openPmosButton");' +
          'button.addEventListener("click",openPmos);' +
          'button.focus();' +
        '});' +
      '</script>' +
    '</body></html>'
  ).setWidth(360).setHeight(165);

  SpreadsheetApp.getUi().showModelessDialog(html, 'Open PMOS Web App');
}
