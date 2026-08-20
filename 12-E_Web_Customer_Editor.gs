/** Web App adapter for account-aware Customer editing. */

function getPmosWebCustomerEditorData(customerId) {
  const data = getPmosCustomerAccountEditorData(customerId);
  data.accountContacts = getPmosAccountContacts(customerId);
  data.serviceLocationContacts = getPmosServiceLocationContacts(customerId);
  data.accountBillingAddress = getPmosAccountBillingAddress(customerId);
  return data;
}

function savePmosWebCustomerEditorData(input) {
  const request = Object.assign({}, input || {});
  const customerId = String(request.customerId || '').trim();
  if (!customerId) throw new Error('Customer ID is required.');

  // Validate account contacts before the core customer transaction mutates data.
  const accountContacts = normalizePmosAccountContacts_(request.accountContacts || []);
  const locationName = String(request.serviceLocationName || '').trim();
  if (!locationName) throw new Error('Service Location Name is required.');

  const result = savePmosCustomerAccountEditorDataWithLocationContactsAndBilling(request);
  const warnings = [];

  try {
    updatePmosWebServiceLocationName_(customerId, locationName);
  } catch (error) {
    warnings.push('Customer changes were saved, but Service Location Name could not be updated: ' +
      String(error && error.message ? error.message : error));
  }

  let accountContactResult = {contacts: accountContacts, warnings: []};
  try {
    accountContactResult = syncPmosAccountContactsToGoogle_(customerId, accountContacts);
  } catch (error) {
    // The account contacts were prevalidated. If their PMOS/Google synchronization
    // still fails after the main transaction, report it as a post-save warning.
    warnings.push('Customer changes were saved, but Account Contacts could not be synchronized: ' +
      String(error && error.message ? error.message : error));
  }
  warnings.push.apply(warnings, accountContactResult.warnings || []);

  if (result.contactStatus) warnings.push(String(result.contactStatus));
  result.accountContacts = accountContactResult.contacts || accountContacts;
  result.warnings = warnings.filter(Boolean);
  result.profile = getPmosCustomerAccountProfile(customerId);
  return result;
}

function updatePmosWebServiceLocationName_(customerId, locationName) {
  const record = getPmosCustomerEditorRow_(customerId);
  const index = findHeaderIndex_(record.headers, ['Service Location Name']);
  if (index < 0) throw new Error('Customers is missing Service Location Name.');
  record.sheet.getRange(record.rowNumber, index + 1).setValue(String(locationName || '').trim());
  SpreadsheetApp.flush();
  return String(locationName || '').trim();
}
