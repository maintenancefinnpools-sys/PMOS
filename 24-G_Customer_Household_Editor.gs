/** Household-contact loading and editing support for Customer Editor. */
function getPmosCustomerEditorHouseholdContacts(customerId) {
  const customer = getPmosCustomerContactRecord_(customerId, false);
  const state = getPmosGoogleContactState(customerId);
  if (!state || state.status !== 'LINKED') return [];
  const contacts = Array.isArray(state.contacts) ? state.contacts : [];
  const primary = findPmosCustomerEditorPrimaryContact_(customer, contacts);
  return contacts.filter(function (contact) {
    return !primary || contact.resourceName !== primary.resourceName;
  }).map(function (contact) {
    return {
      resourceName: String(contact.resourceName || ''),
      firstName: String(contact.firstName || ''),
      lastName: String(contact.lastName || ''),
      phone: String(contact.phone || ''),
      email: String(contact.email || '')
    };
  });
}

function savePmosCustomerEditorExistingHouseholdContacts(customerId, submittedContacts, removedResourceNames) {
  const customer = getPmosCustomerContactRecord_(customerId, false);
  const state = getPmosGoogleContactState(customerId);
  if (!state || state.status !== 'LINKED') {
    return {updated: 0, unlinked: 0, deleted: 0, protected: 0};
  }

  const linked = Array.isArray(state.contacts) ? state.contacts : [];
  const primary = findPmosCustomerEditorPrimaryContact_(customer, linked);
  const additional = linked.filter(function (contact) {
    return !primary || contact.resourceName !== primary.resourceName;
  });
  const allowed = {};
  const contactByResource = {};
  additional.forEach(function (contact) {
    if (!contact.resourceName) return;
    allowed[contact.resourceName] = true;
    contactByResource[contact.resourceName] = contact;
  });

  const submitted = Array.isArray(submittedContacts) ? submittedContacts : [];
  let updated = 0;
  submitted.forEach(function (contact) {
    const resourceName = String(contact && contact.resourceName || '').trim();
    if (!resourceName || !allowed[resourceName]) {
      throw new Error('A household contact is no longer linked to this customer. Reload the editor and try again.');
    }
    const firstName = String(contact.firstName || '').trim();
    const lastName = String(contact.lastName || '').trim();
    const phone = String(contact.phone || '').trim();
    const email = String(contact.email || '').trim();
    if (!firstName || !lastName || !phone) {
      throw new Error('Each household contact needs a first name, last name, and phone number.');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('A household contact has an invalid email address.');
    }

    const latest = People.People.get(resourceName, {personFields: PMOS_CONTACT_FIELDS_});
    const payload = {
      resourceName: resourceName,
      etag: latest.etag,
      metadata: latest.metadata,
      names: [{givenName: firstName, familyName: lastName}],
      phoneNumbers: [{value: phone, type: 'mobile'}],
      emailAddresses: email ? [{value: email, type: 'home'}] : []
    };
    People.People.updateContact(payload, resourceName, {
      updatePersonFields: 'names,phoneNumbers,emailAddresses',
      personFields: PMOS_CONTACT_FIELDS_
    });
    updated += 1;
  });

  const remove = Array.isArray(removedResourceNames) ? removedResourceNames.map(String) : [];
  const removeSet = {};
  remove.forEach(function (resourceName) {
    resourceName = String(resourceName || '').trim();
    if (resourceName && allowed[resourceName]) removeSet[resourceName] = true;
  });

  let deleted = 0;
  let protectedCount = 0;
  const ui = SpreadsheetApp.getUi();
  Object.keys(removeSet).forEach(function (resourceName) {
    const contact = contactByResource[resourceName] || {};
    const safety = getPmosCustomerEditorContactDeleteSafety_(customerId, resourceName);
    if (!safety.canDelete) {
      protectedCount += 1;
      return;
    }

    const displayName = String(contact.displayName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'this contact');
    const choice = ui.alert(
      'Delete Google Contact?',
      'Remove ' + displayName + ' from this customer.\n\n' +
      'Do you also want to permanently delete this person from Google Contacts?\n\n' +
      'Yes = delete from Google Contacts.\nNo = remove from this customer only.',
      ui.ButtonSet.YES_NO
    );
    if (choice !== ui.Button.YES) return;

    try {
      People.People.deleteContact(resourceName);
      deleted += 1;
    } catch (error) {
      throw new Error(
        'PMOS could not delete ' + displayName + ' from Google Contacts. ' +
        'The contact has not been removed from this customer. ' +
        (error && error.message ? error.message : String(error))
      );
    }
  });

  const remainingResources = customer.resourceNames.filter(function (resourceName) {
    return !removeSet[resourceName];
  });
  const unlinked = Object.keys(removeSet).length;
  if (unlinked) writePmosGoogleContactLinks_(customer, remainingResources);

  return {updated: updated, unlinked: unlinked, deleted: deleted, protected: protectedCount};
}

function getPmosCustomerEditorContactDeleteSafety_(customerId, resourceName) {
  const cleanCustomerId = String(customerId || '').trim();
  const cleanResourceName = String(resourceName || '').trim();
  if (!cleanCustomerId || !cleanResourceName) return {canDelete: false, reason: 'INVALID'};

  const linkedElsewhere = listPmosCustomerContactRecords_().some(function (record) {
    return String(record.customerId || '').trim() !== cleanCustomerId &&
      Array.isArray(record.resourceNames) && record.resourceNames.indexOf(cleanResourceName) >= 0;
  });
  if (linkedElsewhere) return {canDelete: false, reason: 'LINKED_ELSEWHERE'};

  let person;
  try {
    person = People.People.get(cleanResourceName, {personFields: PMOS_CONTACT_FIELDS_});
  } catch (error) {
    return {canDelete: false, reason: 'CONTACT_UNAVAILABLE'};
  }

  const createdForCustomer = (person.externalIds || []).some(function (item) {
    return item && item.type === 'customer' && String(item.value || '').trim() === cleanCustomerId;
  });
  if (!createdForCustomer) return {canDelete: false, reason: 'NOT_PMOS_OWNED'};

  return {canDelete: true, reason: 'PMOS_OWNED'};
}

function findPmosCustomerEditorPrimaryContact_(customer, contacts) {
  const targetEmail = normalizePmosContactEmail_(customer && customer.email || '');
  const targetPhone = normalizePmosContactPhone_(customer && customer.phone || '');
  const targetFirst = normalizePmosContactName_(customer && customer.firstName || '');
  const targetLast = normalizePmosContactName_(customer && customer.lastName || '');
  const targetFull = normalizePmosContactName_(customer && customer.fullName || '');

  return (contacts || []).filter(function (contact) {
    if (targetEmail && normalizePmosContactEmail_(contact.email) === targetEmail) return true;
    if (targetPhone && normalizePmosContactPhone_(contact.phone) === targetPhone) return true;
    const first = normalizePmosContactName_(contact.firstName || '');
    const last = normalizePmosContactName_(contact.lastName || '');
    const full = normalizePmosContactName_(contact.displayName || [contact.firstName, contact.lastName].filter(Boolean).join(' '));
    return (targetFirst && targetLast && first === targetFirst && last === targetLast) ||
      (targetFull && full === targetFull);
  })[0] || null;
}
