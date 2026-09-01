/** Account/service-location extensions for Edit Customer. */
(function () {
  if (typeof getPmosCustomerEditorData === 'function') {
    const baseGetPmosCustomerEditorData = getPmosCustomerEditorData;
    getPmosCustomerEditorData = function(customerId) {
      const profile = baseGetPmosCustomerEditorData(customerId);
      const account = getPmosCustomerAccount_(customerId);
      profile.accountId = account.accountId;
      profile.serviceLocations = account.locations;
      profile.selectedServiceLocation = account.locations.filter(function(location) {
        return String(location.customerId) === String(customerId);
      })[0] || null;
      return profile;
    };
  }

  if (typeof savePmosCustomerEditorData === 'function') {
    const baseSavePmosCustomerEditorData = savePmosCustomerEditorData;
    savePmosCustomerEditorData = function(input) {
      const request = input || {};
      const result = baseSavePmosCustomerEditorData(request);
      if (request.serviceLocationName != null || request.accountId) {
        const account = getPmosCustomerAccount_(request.customerId);
        const selected = account.locations.filter(function(location) {
          return String(location.customerId) === String(request.customerId);
        })[0];
        applyPmosAccountIdentityToCustomerRow_(
          request.customerId,
          String(request.accountId || account.accountId).trim(),
          String(request.serviceLocationName != null ? request.serviceLocationName : (selected && selected.locationName || '')).trim(),
          selected ? selected.primary : true
        );
      }
      result.account = getPmosCustomerAccount_(request.customerId);
      return result;
    };
  }
})();
