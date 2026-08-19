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

(function () {
  if (typeof savePmosCustomerEditorData === 'function') {
    const baseSavePmosCustomerEditorDataForAccount = savePmosCustomerEditorData;
    savePmosCustomerEditorData = function(input) {
      const result = baseSavePmosCustomerEditorDataForAccount(input);
      result.account = syncPmosAccountSharedCustomerFields_(result.customerId);
      result.profile = getPmosCustomerProfile(result.customerId);
      return result;
    };
  }

  if (typeof createPmosAdditionalServiceLocation === 'function') {
    const baseCreatePmosAdditionalServiceLocation = createPmosAdditionalServiceLocation;
    createPmosAdditionalServiceLocation = function(input) {
      const request = input || {};
      const accountBefore = getPmosCustomerAccount_(request.parentCustomerId);
      const primary = accountBefore.locations.filter(function(location) { return location.primary; })[0] || accountBefore.locations[0];
      const result = baseCreatePmosAdditionalServiceLocation(request);
      if (primary && result && result.customerId) {
        copyPmosAccountGoogleContactLinks_(primary.customerId, result.customerId);
        syncPmosAccountSharedCustomerFields_(primary.customerId);
        result.account = getPmosCustomerAccount_(result.customerId);
      }
      return result;
    };
  }
})();
