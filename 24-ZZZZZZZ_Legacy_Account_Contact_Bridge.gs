/**
 * Surface legacy linked household contacts in the modern Account Contacts model.
 *
 * No Google Contact is created or mutated while reading. Existing linked People resources
 * are merged into the PMOS Account Contact rows and become normal PMOS-stored contacts the
 * next time the customer is explicitly saved through the modern editor.
 */
function pmosLegacyAccountContactFromPerson_(person) {
  const contact = normalizePmosGooglePerson_(person || {});
  let notes = String(contact.notes || '').trim();
  let role = '';
  const roleMatch = notes.match(/^Account role:\s*([^\n]+)(?:\n+|$)/i);
  if (roleMatch) {
    role = String(roleMatch[1] || '').trim();
    notes = notes.slice(roleMatch[0].length).trim();
  }
  return {
    firstName: String(contact.firstName || '').trim(),
    lastName: String(contact.lastName || '').trim(),
    role: role,
    phone: String(contact.phone || '').trim(),
    email: String(contact.email || '').trim(),
    notes: notes,
    resourceName: String(person && person.resourceName || '').trim()
  };
}

function pmosAccountContactsLikelySamePerson_(left, right) {
  const leftEmail = normalizePmosContactEmail_(left && left.email);
  const rightEmail = normalizePmosContactEmail_(right && right.email);
  if (leftEmail && rightEmail && leftEmail === rightEmail) return true;
  const leftPhone = normalizePmosContactPhone_(left && left.phone);
  const rightPhone = normalizePmosContactPhone_(right && right.phone);
  if (leftPhone && rightPhone && leftPhone === rightPhone) return true;
  const leftName = normalizePmosContactName_([left && left.firstName, left && left.lastName].filter(Boolean).join(' '));
  const rightName = normalizePmosContactName_([right && right.firstName, right && right.lastName].filter(Boolean).join(' '));
  return !!(leftName && rightName && leftName === rightName);
}

function pmosMergedAccountContactsForLifecycle_(customerId, existingContacts) {
  const source = Array.isArray(existingContacts)
    ? existingContacts
    : (typeof getPmosAccountContacts_ === 'function' ? getPmosAccountContacts_(customerId) : []);
  const saved = source
    .map(function(contact) { return Object.assign({}, contact || {}); });
  let record;
  try { record = getPmosCustomerContactRecord_(customerId, false); }
  catch (ignored) { return saved; }
  const primary = String(record.resourceName || (record.resourceNames || [])[0] || '').trim();
  saved._pmosPrimaryResourceName = primary;
  const additionalResources = (record.resourceNames || []).filter(function(resourceName) {
    return resourceName && resourceName !== primary;
  });
  additionalResources.forEach(function(resourceName) {
    let existing = saved.filter(function(contact) {
      return String(contact.resourceName || '').trim() === resourceName;
    })[0];
    if (existing) return;
    try {
      const person = People.People.get(resourceName, {personFields: PMOS_CONTACT_FIELDS_});
      const legacy = pmosLegacyAccountContactFromPerson_(person);
      existing = saved.filter(function(contact) { return pmosAccountContactsLikelySamePerson_(contact, legacy); })[0];
      if (existing) {
        existing.resourceName = resourceName;
        if (!existing.firstName) existing.firstName = legacy.firstName;
        if (!existing.lastName) existing.lastName = legacy.lastName;
        if (!existing.phone) existing.phone = legacy.phone;
        if (!existing.email) existing.email = legacy.email;
        if (!existing.role) existing.role = legacy.role;
        if (!existing.notes) existing.notes = legacy.notes;
      } else if (legacy.firstName || legacy.lastName || legacy.phone || legacy.email) {
        saved.push(legacy);
      }
    } catch (ignored) {}
  });
  return saved;
}

(function () {
  if (typeof pmosCustomerOrderedAccountContacts_ === 'function') {
    pmosCustomerOrderedAccountContacts_ = function(customerId) {
      const primary = pmosCustomerPrimaryAccountContact_(customerId);
      return [primary].concat(pmosMergedAccountContactsForLifecycle_(customerId).map(function(contact) {
        return Object.assign({primary: false}, contact || {});
      }));
    };
  }

  if (typeof getPmosCustomerAccountEditorDataRuntime === 'function') {
    const baseRuntimeEditor = getPmosCustomerAccountEditorDataRuntime;
    getPmosCustomerAccountEditorDataRuntime = function(customerId) {
      const data = baseRuntimeEditor(customerId);
      const merged = pmosMergedAccountContactsForLifecycle_(customerId, data.accountContacts || []);
      const primary = Object.assign({primary: true}, (data.orderedAccountContacts || [])[0] || {
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'Primary Account Contact',
        phone: data.phone,
        email: data.email,
        notes: ''
      });
      data.primaryAccountContactResourceName = String(merged._pmosPrimaryResourceName || '').trim();
      primary.resourceName = data.primaryAccountContactResourceName;
      data.accountContacts = merged.map(function(contact) {
        return Object.assign({__pmosPrimaryResourceName: data.primaryAccountContactResourceName}, contact || {});
      });
      data.orderedAccountContacts = [primary].concat(merged.map(function(contact) {
        return Object.assign({primary: false}, contact || {});
      }));
      return data;
    };
  }
})();
