/**
 * Opens Add Customer in Sheets with the same rendered form and inline
 * Add Service Location component used by the PMOS Web App.
 */
function showPmosAddCustomer() {
  migrateMaintenanceCustomerEquipmentStorage_();
  const template = HtmlService.createTemplateFromFile('Sheets_Add_Customer');
  template.pmosEquipmentEditorStyles = pmosCustomerEquipmentEditorStyles_();
  template.pmosEquipmentEditorScript = pmosCustomerEquipmentEditorScript_();
  template.pmosServiceLocationContactStyles = pmosServiceLocationContactStyles_();
  template.pmosServiceLocationContactScript = pmosServiceLocationContactClientScript_();
  template.pmosAccountBillingStyles = pmosAccountBillingAddressStyles_();
  template.pmosAccountBillingScript = pmosAccountBillingAddressClientScript_();
  template.pmosAccountContactStyles = pmosAccountContactStyles_();
  template.pmosAccountContactScript = pmosAccountContactClientScript_();

  const html = template.evaluate()
    .setTitle('Add Customer')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  SpreadsheetApp.getUi().showModelessDialog(html, 'Add Customer');
}
