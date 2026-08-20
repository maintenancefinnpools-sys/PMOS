/** Account-ID extension for Add Maintenance Customer. */
(function () {
  if (typeof createMaintenanceCustomer !== 'function') return;
  const baseCreateMaintenanceCustomer = createMaintenanceCustomer;
  createMaintenanceCustomer = function(input) {
    const source = input || {};
    const result = baseCreateMaintenanceCustomer(source);
    const isPrimary = source.primaryServiceLocation === false ? false : true;
    const lastName = String(source.lastName || '').trim();
    const requestedLocationName = String(source.serviceLocationName || '').trim();
    const locationName = requestedLocationName || (isPrimary && lastName ? lastName + ' Residence' : '');
    if (typeof ensurePmosCustomerAccountIds_ === 'function') ensurePmosCustomerAccountIds_();
    if (typeof applyPmosAccountIdentityToCustomerRow_ === 'function') {
      applyPmosAccountIdentityToCustomerRow_(
        result.customerId,
        String(source.accountId || result.customerId).trim(),
        locationName,
        isPrimary
      );
    }
    result.accountId = String(source.accountId || result.customerId).trim();
    result.serviceLocationName = locationName;
    result.primaryServiceLocation = isPrimary;
    return result;
  };
})();
