/** Apply Account-ID and primary-location identity after the maintenance transaction. */
function applyPmosMaintenanceAccountIdentity_(result, input) {
    const source = input || {};
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
}
