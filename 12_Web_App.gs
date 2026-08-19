/**
 * PMOS v1.9.0 — Web application entry point.
 */

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
  const url = ScriptApp.getService().getUrl();
  if (!url) {
    SpreadsheetApp.getUi().alert(
      'PMOS Web App is not deployed yet. In Apps Script, use Deploy → New deployment → Web app, then reopen the PMOS menu.'
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
