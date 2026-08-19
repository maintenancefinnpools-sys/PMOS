/**
 * PMOS v1.9.0 — Web application entry point.
 */

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.pmosVersion = PMOS_VERSION;

  return template.evaluate()
    .setTitle(`PMOS ${PMOS_VERSION}`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Opens a small launcher for the deployed PMOS Web App.
 * Kept menu-safe so the Sheets UI can surface the current deployment URL.
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
    '<div style="font-family:Arial,sans-serif;padding:18px">' +
      '<h2 style="margin:0 0 8px">PMOS Web App</h2>' +
      '<p style="margin:0 0 16px;color:#5f6d75;line-height:1.45">Open the Web App for this PMOS deployment.</p>' +
      '<a href="' + safeUrl + '" target="_blank" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#0f5470;color:#fff;text-decoration:none;font-weight:700">Open PMOS Web App</a>' +
    '</div>'
  ).setWidth(390).setHeight(180);

  SpreadsheetApp.getUi().showModelessDialog(html, 'PMOS Web App');
}
