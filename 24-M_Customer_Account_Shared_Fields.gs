/** Keep account-level identity/contact fields synchronized across service-location Customer IDs. */
function syncPmosAccountSharedCustomerFields_(customerId) {
  const account = getPmosCustomerAccount_(customerId);
  if (!account.locations || account.locations.length < 2) return account;
  const source = getPmosCustomerEditorRow_(customerId);
  const sharedAliasGroups = [
    ['First Name'],
    ['Last Name', 'Customer Name', 'Name', 'Customer'],
    ['Full Name(s)', 'Full Name'],
    ['Primary Phone', 'Phone Number', 'Phone'],
    ['Email', 'Email Address'],
    ['Google Contact Resource Names'],
    ['Google Contact Resource Name'],
    ['Google Contact ETag'],
    ['Google Contact Last Synced']
  ];
  const sharedValues = sharedAliasGroups.map(function(aliases) {
    const index = findHeaderIndex_(source.headers, aliases);
    return {aliases: aliases, value: index >= 0 ? source.values[index] : ''};
  });

  account.locations.forEach(function(location) {
    if (String(location.customerId) === String(customerId)) return;
    const target = getPmosCustomerEditorRow_(location.customerId);
    const values = target.values.slice();
    sharedValues.forEach(function(field) {
      pmosCustomerEditorSetAliases_(target.headers, values, field.aliases, field.value);
    });
    target.sheet.getRange(target.rowNumber, 1, 1, values.length).setValues([values]);
  });
  SpreadsheetApp.flush();
  return getPmosCustomerAccount_(customerId);
}

function copyPmosAccountGoogleContactLinks_(sourceCustomerId, targetCustomerId) {
  const source = getPmosCustomerEditorRow_(sourceCustomerId);
  const target = getPmosCustomerEditorRow_(targetCustomerId);
  const aliases = [
    ['Google Contact Resource Names'],
    ['Google Contact Resource Name'],
    ['Google Contact ETag'],
    ['Google Contact Last Synced']
  ];
  const values = target.values.slice();
  aliases.forEach(function(group) {
    const sourceIndex = findHeaderIndex_(source.headers, group);
    if (sourceIndex < 0) return;
    pmosCustomerEditorSetAliases_(target.headers, values, group, source.values[sourceIndex]);
  });
  target.sheet.getRange(target.rowNumber, 1, 1, values.length).setValues([values]);
  SpreadsheetApp.flush();
}

function applyPmosAccountContactInput_(customerId, request) {
  const record = getPmosCustomerEditorRow_(customerId);
  const values = record.values.slice();
  const firstName = String(request && request.firstName || '').trim();
  const lastName = String(request && request.lastName || '').trim();
  const phone = String(request && request.phone || '').trim();
  const email = String(request && request.email || '').trim();
  pmosCustomerEditorSetAliases_(record.headers, values, ['First Name'], firstName);
  pmosCustomerEditorSetAliases_(record.headers, values, ['Last Name', 'Customer Name', 'Name', 'Customer'], lastName);
  pmosCustomerEditorSetAliases_(record.headers, values, ['Full Name(s)', 'Full Name'], [firstName, lastName].filter(Boolean).join(' '));
  pmosCustomerEditorSetAliases_(record.headers, values, ['Primary Phone', 'Phone Number', 'Phone'], phone);
  pmosCustomerEditorSetAliases_(record.headers, values, ['Email', 'Email Address'], email);
  record.sheet.getRange(record.rowNumber, 1, 1, values.length).setValues([values]);
  SpreadsheetApp.flush();
}

function validatePmosAccountServiceLocationName_(customerId, requestedName) {
  const account = getPmosCustomerAccount_(customerId);
  const name = String(requestedName || '').trim();
  if (!name) throw new Error('Enter a service location name.');
  const duplicate = account.locations.some(function(location) {
    return String(location.customerId) !== String(customerId) &&
      normalize_(location.locationName || location.calendarTitle) === normalize_(name);
  });
  if (duplicate) throw new Error('This account already has a service location named ' + name + '.');
  return {account: account, name: name};
}

function savePmosCustomerAccountEditorData(input) {
  try {
    const request = input || {};
    const validation = validatePmosAccountServiceLocationName_(request.customerId, request.serviceLocationName);
    const selected = validation.account.locations.filter(function(location) {
      return String(location.customerId) === String(request.customerId);
    })[0];
    const result = savePmosCustomerEditorData(request);
    applyPmosAccountIdentityToCustomerRow_(
      result.customerId,
      validation.account.accountId,
      validation.name,
      selected ? selected.primary : true
    );
    result.account = syncPmosAccountSharedCustomerFields_(result.customerId);
    result.profile = getPmosCustomerAccountProfile(result.customerId);
    return pmosAccountTerminologyState_(result);
  } catch (error) {
    if (error && error.message) error.message = pmosAccountTerminologyText_(error.message);
    throw error;
  }
}

function savePmosCustomerEditorExistingAccountContacts(customerId, contacts, removedResourceNames) {
  try {
    return savePmosCustomerEditorExistingHouseholdContacts(customerId, contacts, removedResourceNames);
  } catch (error) {
    if (error && error.message) error.message = pmosAccountTerminologyText_(error.message);
    throw error;
  }
}

function createPmosAdditionalServiceLocationForAccount(input) {
  try {
    const request = Object.assign({}, input || {}, {suppressInheritedEmailOnCreate: true});
    const accountBefore = getPmosCustomerAccount_(request.parentCustomerId);
    const primary = accountBefore.locations.filter(function(location) { return location.primary; })[0] || accountBefore.locations[0];
    const result = createPmosAdditionalServiceLocation(request);
    if (primary && result && result.customerId) {
      copyPmosAccountGoogleContactLinks_(primary.customerId, result.customerId);
      applyPmosAccountContactInput_(result.customerId, request);
      syncPmosAccountSharedCustomerFields_(result.customerId);
      result.account = getPmosCustomerAccount_(result.customerId);
    }
    return pmosAccountTerminologyState_(result);
  } catch (error) {
    if (error && error.message) error.message = pmosAccountTerminologyText_(error.message);
    throw error;
  }
}
