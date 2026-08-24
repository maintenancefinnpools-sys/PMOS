/** Thin Web adapters for customer lifecycle actions outside the main editor. */
function createPmosWebAdditionalServiceLocation(input) {
  const request = Object.assign({}, input || {});
  let result = typeof createPmosAdditionalServiceLocationRuntime === 'function'
    ? createPmosAdditionalServiceLocationRuntime(request)
    : createPmosAdditionalServiceLocationForAccountWithLocationContactsAndBilling(request);
  const id = String(result && result.customerId || '').trim();
  if (id && typeof savePmosCustomerContextNotes_ === 'function') {
    try {
      savePmosCustomerContextNotes_(id, {
        generalNotes: request.generalNotes != null ? request.generalNotes : request.notes,
        equipmentNotes: request.equipmentNotes,
        maintenanceNotes: request.maintenanceNotes,
        openingNotes: request.openingNotes,
        closingNotes: request.closingNotes
      });
    } catch (error) {
      result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
      result.warnings.push('Service location created, but contextual notes could not be fully saved: ' +
        String(error && error.message ? error.message : error));
    }
  }
  if (id) result.profile = getPmosCustomerLifecycleProfile(id);
  return result;
}

function getPmosWebAccountForServiceLocation(parentCustomerId) {
  const id = String(parentCustomerId || '').trim();
  const account = typeof getPmosCustomerAccountRuntime === 'function'
    ? getPmosCustomerAccountRuntime(id) : getPmosCustomerAccount_(id);
  account.accountContacts = pmosCustomerOrderedAccountContacts_(id);
  account.accountBillingAddress = typeof getPmosAccountBillingAddress === 'function'
    ? getPmosAccountBillingAddress(id) : {enabled: false};
  return account;
}
