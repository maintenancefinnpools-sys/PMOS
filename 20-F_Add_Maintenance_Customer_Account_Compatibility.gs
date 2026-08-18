/** Account-ID extension for Add Maintenance Customer. */
(function () {
  if (typeof createMaintenanceCustomer !== 'function') return;
  const baseCreateMaintenanceCustomer = createMaintenanceCustomer;
  createMaintenanceCustomer = function(input) {
    const source = input || {};
    const result = baseCreateMaintenanceCustomer(source);
    if (typeof ensurePmosCustomerAccountIds_ === 'function') ensurePmosCustomerAccountIds_();
    if (typeof applyPmosAccountIdentityToCustomerRow_ === 'function') {
      applyPmosAccountIdentityToCustomerRow_(
        result.customerId,
        String(source.accountId || result.customerId).trim(),
        String(source.serviceLocationName || '').trim(),
        source.primaryServiceLocation === false ? false : true
      );
    }
    result.accountId = String(source.accountId || result.customerId).trim();
    result.serviceLocationName = String(source.serviceLocationName || '').trim();
    result.primaryServiceLocation = source.primaryServiceLocation === false ? false : true;
    return result;
  };
})();
