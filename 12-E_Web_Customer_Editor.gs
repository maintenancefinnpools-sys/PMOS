/** Web App adapter for the complete account/service-location customer lifecycle. */

function getPmosWebCustomerEditorData(customerId) {
  return getPmosWebCustomerLifecycleEditorData(customerId);
}

function savePmosWebCustomerEditorData(input) {
  return savePmosWebCustomerLifecycleEditorData(input);
}

function getPmosWebCustomerProfile(customerId) {
  return getPmosWebCustomerLifecycleProfile(customerId);
}

/**
 * Backward-compatible helper retained for any older Web clients. Service Location Name
 * is normally written by the account-aware editor transaction itself.
 */
function updatePmosWebServiceLocationName_(customerId, locationName) {
  const validation = validatePmosAccountServiceLocationName_(customerId, locationName);
  const account = validation.account;
  const selected = (account.locations || []).filter(function(location) {
    return String(location.customerId) === String(customerId);
  })[0];
  applyPmosAccountIdentityToCustomerRow_(
    customerId,
    account.accountId,
    validation.name,
    selected ? selected.primary : true
  );
  SpreadsheetApp.flush();
  return validation.name;
}
