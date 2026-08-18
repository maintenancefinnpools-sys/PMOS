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
    return {updated: 0, unlinked: 0};
  }

  const linked = Array.isArray(state.contacts) ? state.contacts : [];
  const primary = findPmosCustomerEditorPrimaryContact_(customer, linked);
  const additional = linked.filter(function (contact) {
    return !primary || contact.resourceName !== primary.resourceName;
  });
  const allowed = {};
  additional.forEach(function (contact) {
    if (contact.resourceName) allowed[contact.resourceName] = true;
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
  const remainingResources = customer.resourceNames.filter(function (resourceName) {
    return !removeSet[resourceName];
  });
  const unlinked = Object.keys(removeSet).length;
  if (unlinked) writePmosGoogleContactLinks_(customer, remainingResources);

  return {updated: updated, unlinked: unlinked};
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
