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
