/**
 * Add Customer — simple customer/account creation without recurring maintenance.
 *
 * This workflow shares PMOS customer/account, address, contact, body-of-water, and
 * equipment services, but deliberately performs no route calculation, route placement,
 * maintenance template creation, or recurring Calendar synchronization.
 */
function normalizePmosAddCustomerRequest_(input) {
  const source = input || {};
  const firstName = String(source.firstName || '').trim();
  const lastName = String(source.lastName || '').trim();
  const phone = String(source.phone || '').trim();
  const email = String(source.email || '').trim();
  const address = String(source.address || '').trim();
  const details = source.addressDetails || {};
  const locationName = String(source.serviceLocationName || '').trim() || (lastName ? lastName + ' Residence' : '');
  const billing = normalizePmosAccountBillingAddress_(source.accountBillingAddress || {enabled: false});
  const accountContacts = normalizePmosAccountContacts_(source.accountContacts);
  const locationContacts = normalizePmosServiceLocationContacts_(source.serviceLocationContacts);
  const bodies = normalizePmosCustomerEditorBodies_(source.bodiesOfWater);

  if (!firstName) throw new Error('First name is required.');
  if (!lastName) throw new Error('Last name is required.');
  if (!address) throw new Error('Service location address is required.');
  if (!locationName) throw new Error('Service Location Name is required.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email address is not valid.');
  if (source.addressVerified !== true ||
      normalizePmosAddressSearch_(details.address) !== normalizePmosAddressSearch_(address) ||
      !String(details.street || '').trim() || !String(details.city || '').trim() ||
      !String(details.province || '').trim() || !String(details.postalCode || '').trim() ||
      !String(details.country || '').trim() || !Number.isFinite(Number(details.lat)) ||
      !Number.isFinite(Number(details.lng))) {
    throw new Error('Select and confirm a complete address suggestion before creating the customer.');
  }

  return {
    firstName: firstName,
    lastName: lastName,
    phone: phone,
    email: email,
    address: address,
    addressVerified: true,
    addressDetails: {
      address: address,
      street: String(details.street || '').trim(),
      city: String(details.city || '').trim(),
      province: String(details.province || '').trim(),
      postalCode: String(details.postalCode || '').trim(),
      country: String(details.country || '').trim(),
      lat: Number(details.lat),
      lng: Number(details.lng),
      placeId: String(details.placeId || '').trim(),
      source: String(details.source || '').trim()
    },
    serviceLocationName: locationName,
    calendarTitle: lastName,
    accountBillingAddress: billing,
    accountContacts: accountContacts,
    serviceLocationContacts: locationContacts,
    bodiesOfWater: bodies,
    entryInformation: String(source.entryInformation || '').trim().slice(0, 5000),
    notes: String(source.notes || '').trim().slice(0, 10000)
  };
}

function applyPmosConfirmedAddressDetailsToCustomer_(customerId, addressDetails) {
  const details = addressDetails || {};
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [
    PMOS.CUSTOMERS_SHEET, 'Customers', 'Customer Database', 'Customer List'
  ]);
  if (!sheet) throw new Error('Customers sheet was not found.');
  let table = readPmosHeaderTable_(sheet);
  ensureMaintenanceClientHeaders_(sheet, table, [
    'Full Address', 'Service Address', 'Address', 'Street Address', 'Street',
    'City', 'Province', 'Postal Code', 'Country', 'Latitude', 'Longitude'
  ]);
  const record = getPmosCustomerEditorRow_(customerId);
  const values = record.values.slice();
  pmosCustomerEditorSetAliases_(record.headers, values, ['Full Address', 'Service Address', 'Address', 'Street Address'], details.address || '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['Street'], details.street || '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['City'], details.city || '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['Province'], details.province || '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['Postal Code'], details.postalCode || '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['Country'], details.country || '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['Latitude'], details.lat);
  pmosCustomerEditorSetAliases_(record.headers, values, ['Longitude'], details.lng);
  record.sheet.getRange(record.rowNumber, 1, 1, values.length).setValues([values]);
  SpreadsheetApp.flush();
}

function createPmosCustomerAccount(input) {
  const request = normalizePmosAddCustomerRequest_(input);
  const warnings = [];
  const customersSheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [
    PMOS.CUSTOMERS_SHEET, 'Customers', 'Customer Database', 'Customer List'
  ]);
  if (!customersSheet) throw new Error('Customers sheet was not found.');
  const customerTable = readPmosHeaderTable_(customersSheet);
  assertMaintenanceClientNotDuplicate_(customerTable, request.lastName, request.address, request.email);

  const result = createPmosNonMaintenanceAccountServiceLocation_({
    firstName: request.firstName,
    lastName: request.lastName,
    phone: request.phone,
    email: request.email,
    address: request.address,
    serviceLocationName: request.serviceLocationName,
    calendarTitle: request.calendarTitle,
    bodiesOfWater: request.bodiesOfWater,
    entryInformation: request.entryInformation,
    notes: request.notes,
    waterMaintenance: false
  });

  applyPmosAccountIdentityToCustomerRow_(
    result.customerId,
    result.customerId,
    request.serviceLocationName,
    true
  );
  applyPmosConfirmedAddressDetailsToCustomer_(result.customerId, request.addressDetails);

  try {
    savePmosAccountBillingAddress_(result.customerId, request.accountBillingAddress);
  } catch (error) {
    warnings.push('Account Billing Address could not be saved: ' + String(error && error.message ? error.message : error));
  }

  try {
    const accountContactResult = syncPmosAccountContactsToGoogle_(result.customerId, request.accountContacts);
    Array.prototype.push.apply(warnings, accountContactResult.warnings || []);
  } catch (error) {
    try { savePmosAccountContacts_(result.customerId, request.accountContacts); } catch (ignored) {}
    warnings.push('Account Contacts were not fully synchronized: ' + String(error && error.message ? error.message : error));
  }

  try {
    const locationContactResult = saveAndSyncPmosServiceLocationContacts_(
      result.customerId,
      request.serviceLocationContacts
    );
    (locationContactResult.errors || []).forEach(function(message) {
      warnings.push('Service Location Contact Google sync: ' + message);
    });
  } catch (error) {
    try { savePmosServiceLocationContacts_(result.customerId, request.serviceLocationContacts); } catch (ignored) {}
    warnings.push('Service Location Contacts were not fully synchronized: ' + String(error && error.message ? error.message : error));
  }

  try {
    const addressSync = syncPmosAccountHolderGoogleAddress_(result.customerId);
    if (addressSync && addressSync.error) warnings.push('Account holder Google Contact address: ' + addressSync.error);
  } catch (error) {
    warnings.push('Account holder Google Contact address could not be synchronized: ' + String(error && error.message ? error.message : error));
  }

  result.account = getPmosCustomerAccount_(result.customerId);
  result.accountContacts = getPmosAccountContacts_(result.customerId);
  result.serviceLocationContacts = getPmosServiceLocationContacts_(result.customerId);
  result.accountBillingAddress = getPmosAccountBillingAddress_(result.customerId);
  result.warnings = warnings;
  result.summary = 'Customer created: ' + request.lastName + ', ' + request.firstName +
    '\nPrimary service location: ' + request.serviceLocationName +
    '\nNo Water Maintenance route or recurring Calendar events were created.';
  return pmosAccountTerminologyState_(result);
}
