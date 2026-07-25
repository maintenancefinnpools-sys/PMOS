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
