/** Google People API integration for Customer Profiles. */
const PMOS_CONTACT_FIELDS_ = 'names,emailAddresses,phoneNumbers,addresses,biographies,externalIds,metadata';
const PMOS_CONTACT_LINK_HEADERS_ = {
  resourceName: 'Google Contact Resource Name',
  etag: 'Google Contact ETag',
  syncedAt: 'Google Contact Last Synced'
};

function getPmosGoogleContactState(customerId) {
  const customer = getPmosCustomerContactRecord_(customerId, false);
  if (customer.resourceName) {
    try {
      const person = People.People.get(customer.resourceName, {personFields: PMOS_CONTACT_FIELDS_});
      return buildPmosGoogleContactState_(customer, person, 'LINKED');
    } catch (error) {
      return {
        status: 'BROKEN_LINK', customerId: customer.customerId,
        message: 'The saved Google Contact link could not be opened. Relink the customer.',
        error: error && error.message ? error.message : String(error), candidates: []
      };
    }
  }
  const candidates = findPmosGoogleContactCandidates_(customer);
  const automaticMatches = candidates.filter(function (candidate) { return candidate.automaticMatch; });
  if (automaticMatches.length === 1) {
    const person = People.People.get(automaticMatches[0].resourceName, {personFields: PMOS_CONTACT_FIELDS_});
    writePmosGoogleContactLink_(customer, person);
    return buildPmosGoogleContactState_(getPmosCustomerContactRecord_(customerId, false), person, 'LINKED');
  }
  return {
    status: candidates.length ? 'CANDIDATES' : 'UNLINKED',
    customerId: customer.customerId,
    message: candidates.length
      ? 'Possible Google Contacts were found. Choose one only after confirming its details.'
      : 'No matching Google Contact was found.',
    candidates: candidates
  };
}

function linkPmosCustomerGoogleContact(customerId, resourceName) {
  const customer = getPmosCustomerContactRecord_(customerId, true);
  const cleanResource = String(resourceName || '').trim();
  if (!/^people\//.test(cleanResource)) throw new Error('Choose a valid Google Contact.');
  const person = People.People.get(cleanResource, {personFields: PMOS_CONTACT_FIELDS_});
  writePmosGoogleContactLink_(customer, person);
  return buildPmosGoogleContactState_(getPmosCustomerContactRecord_(customerId, false), person, 'LINKED');
}

function createPmosGoogleContact(customerId) {
  const customer = getPmosCustomerContactRecord_(customerId, true);
  if (customer.resourceName) throw new Error('This customer is already linked to a Google Contact.');
  const candidates = findPmosGoogleContactCandidates_(customer);
  if (candidates.length) throw new Error('A matching Google Contact already exists. Link it instead of creating a duplicate.');
  const person = People.People.createContact(buildPmosGooglePerson_(customer, null), {
    personFields: PMOS_CONTACT_FIELDS_
  });
  writePmosGoogleContactLink_(customer, person);
  return buildPmosGoogleContactState_(getPmosCustomerContactRecord_(customerId, false), person, 'LINKED');
}

function previewPmosGoogleContactSync(customerId, direction) {
  const customer = getPmosCustomerContactRecord_(customerId, false);
  if (!customer.resourceName) throw new Error('Link or create a Google Contact first.');
  const person = People.People.get(customer.resourceName, {personFields: PMOS_CONTACT_FIELDS_});
  const state = buildPmosGoogleContactState_(customer, person, 'LINKED');
  const cleanDirection = String(direction || '').toUpperCase();
  if (cleanDirection !== 'PULL' && cleanDirection !== 'PUSH') throw new Error('Choose Pull or Push.');
  return {
    customerId: customer.customerId,
    direction: cleanDirection,
    resourceName: person.resourceName,
    contactName: state.contact.displayName,
    differences: state.differences,
    summary: formatPmosContactDifferenceSummary_(state.differences, cleanDirection)
  };
}

function applyPmosGoogleContactSync(customerId, direction, expectedResourceName) {
  const cleanDirection = String(direction || '').toUpperCase();
  const customer = getPmosCustomerContactRecord_(customerId, true);
  if (!customer.resourceName || customer.resourceName !== String(expectedResourceName || '')) {
    throw new Error('The linked Google Contact changed. Refresh the profile before synchronizing.');
  }
  if (cleanDirection === 'PUSH') return pushPmosCustomerToGoogleContact_(customer);
  if (cleanDirection === 'PULL') return pullGoogleContactToPmosCustomer_(customer);
  throw new Error('Choose Pull or Push.');
}

function unlinkPmosCustomerGoogleContact(customerId) {
  const customer = getPmosCustomerContactRecord_(customerId, true);
  const values = customer.sheet.getRange(customer.rowNumber, 1, 1, customer.headers.length).getValues()[0];
  values[customer.indexes.resourceName] = '';
  values[customer.indexes.etag] = '';
  values[customer.indexes.syncedAt] = '';
  customer.sheet.getRange(customer.rowNumber, 1, 1, values.length).setValues([values]);
  return getPmosGoogleContactState(customerId);
}

function pushPmosCustomerToGoogleContact_(customer) {
  const latest = People.People.get(customer.resourceName, {personFields: PMOS_CONTACT_FIELDS_});
  const payload = buildPmosGooglePerson_(customer, latest);
  const updated = People.People.updateContact(payload, latest.resourceName, {
    updatePersonFields: 'names,emailAddresses,phoneNumbers,addresses,biographies,externalIds',
    personFields: PMOS_CONTACT_FIELDS_
  });
  writePmosGoogleContactLink_(customer, updated);
  return buildPmosGoogleContactState_(getPmosCustomerContactRecord_(customer.customerId, false), updated, 'LINKED');
}

function pullGoogleContactToPmosCustomer_(customer) {
  const person = People.People.get(customer.resourceName, {personFields: PMOS_CONTACT_FIELDS_});
  const contact = normalizePmosGooglePerson_(person);
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const fresh = getPmosCustomerContactRecord_(customer.customerId, true);
    const values = fresh.sheet.getRange(fresh.rowNumber, 1, 1, fresh.headers.length).getValues()[0];
    values[fresh.indexes.firstName] = contact.firstName;
    values[fresh.indexes.lastName] = contact.lastName;
    values[fresh.indexes.address] = contact.address;
    values[fresh.indexes.phone] = contact.phone;
    values[fresh.indexes.email] = contact.email;
    if (fresh.indexes.notes >= 0) values[fresh.indexes.notes] = contact.notes;
    values[fresh.indexes.resourceName] = person.resourceName;
    values[fresh.indexes.etag] = person.etag || '';
    values[fresh.indexes.syncedAt] = new Date();
    fresh.sheet.getRange(fresh.rowNumber, 1, 1, values.length).setValues([values]);
  } finally {
    lock.releaseLock();
  }
  return buildPmosGoogleContactState_(getPmosCustomerContactRecord_(customer.customerId, false), person, 'LINKED');
}

function buildPmosGooglePerson_(customer, latest) {
  const externalIds = ((latest && latest.externalIds) || []).filter(function (item) {
    return !(item && item.type === 'customer' && /^PMOS-/.test(String(item.value || '')));
  });
  externalIds.push({value: customer.customerId, type: 'customer'});
  const person = {
    names: [{givenName: customer.firstName, familyName: customer.lastName}],
    emailAddresses: customer.email ? [{value: customer.email, type: 'work'}] : [],
    phoneNumbers: customer.phone ? [{value: customer.phone, type: 'mobile'}] : [],
    addresses: customer.address ? [{formattedValue: customer.address, type: 'work'}] : [],
    biographies: customer.notes ? [{value: customer.notes, contentType: 'TEXT_PLAIN'}] : [],
    externalIds: externalIds
  };
  if (latest) {
    person.resourceName = latest.resourceName;
    person.etag = latest.etag;
    person.metadata = latest.metadata;
  }
  return person;
}

function findPmosGoogleContactCandidates_(customer) {
  return findPmosGoogleContactCandidatesFromPeople_(customer, listPmosGoogleContacts_());
}

function findPmosGoogleContactCandidatesFromPeople_(customer, people) {
  const email = normalizePmosContactEmail_(customer.email);
  const phone = normalizePmosContactPhone_(customer.phone);
  const customerFirst = normalizePmosContactName_(customer.firstName);
  const customerFirstSet = normalizePmosContactGivenNameSet_(customer.firstName);
  const customerLast = normalizePmosContactName_(customer.lastName);
  const customerFull = normalizePmosContactName_([customer.firstName, customer.lastName].filter(Boolean).join(' '));
  const customerAddress = normalizePmosContactAddress_(customer.address);
  const customerPostal = extractPmosContactPostalCode_(customer.address);
  const customerStreet = normalizePmosContactStreet_(customer.address);
  return people.map(function (person) {
    const contact = normalizePmosGooglePerson_(person);
    const emailMatch = email && contact.emails.some(function (value) { return normalizePmosContactEmail_(value) === email; });
    const phoneMatch = phone && contact.phones.some(function (value) { return normalizePmosContactPhone_(value) === phone; });
    const contactFirst = normalizePmosContactName_(contact.firstName);
    const contactFirstSet = normalizePmosContactGivenNameSet_(contact.firstName);
    const contactLast = normalizePmosContactName_(contact.lastName);
    const contactFull = normalizePmosContactName_(contact.displayName);
    const exactPartsMatch = customerFirst && customerLast && contactLast === customerLast &&
      (contactFirst === customerFirst || (customerFirstSet && contactFirstSet === customerFirstSet));
    const fullNameMatch = customerFull && (contactFull === customerFull || contactLast === customerFull || customerLast === contactFull);
    const surnameMatch = customerLast && contactLast && customerLast === contactLast;
    const givenNameOverlap = pmosContactNamesOverlap_(customerFirstSet, contactFirstSet);
    const nameMatch = !!(exactPartsMatch || fullNameMatch);
    const nameSuggestion = !!(nameMatch || surnameMatch);
    const addressMatch = customerAddress && contact.addresses.some(function (value) {
      const contactPostal = extractPmosContactPostalCode_(value);
      return normalizePmosContactAddress_(value) === customerAddress ||
        (customerPostal && contactPostal && customerPostal === contactPostal) ||
        (customerStreet && normalizePmosContactStreet_(value) === customerStreet);
    });
    const automaticMatch = !!(emailMatch || phoneMatch || (addressMatch && (nameMatch || (surnameMatch && givenNameOverlap))));
    if (!emailMatch && !phoneMatch && !nameSuggestion && !addressMatch) return null;
    return {
      resourceName: person.resourceName,
      displayName: contact.displayName,
      phone: contact.phone,
      email: contact.email,
      address: contact.address,
      automaticMatch: automaticMatch,
      matchReason: emailMatch && phoneMatch ? 'Exact email and phone' : emailMatch ? 'Exact email' : phoneMatch ? 'Exact phone' :
        automaticMatch ? (nameMatch ? 'Matching name and address' : 'Matching surname, given name, and address') :
        addressMatch ? 'Matching address — confirm before linking' :
          nameMatch ? 'Matching name — confirm before linking' : 'Matching last name — confirm before linking'
    };
  }).filter(Boolean).sort(function (a, b) {
    return a.displayName.localeCompare(b.displayName) || a.resourceName.localeCompare(b.resourceName);
  });
}

function previewPmosGoogleContactsMassSync() {
  const customers = listPmosCustomerContactRecords_();
  const people = listPmosGoogleContacts_();
  const peopleByResource = {};
  people.forEach(function (person) { peopleByResource[person.resourceName] = person; });
  const rows = customers.map(function (customer) {
    let person = customer.resourceName ? peopleByResource[customer.resourceName] : null;
    let status = person ? 'READY' : customer.resourceName ? 'BROKEN' : '';
    let matchReason = person ? 'Already linked' : '';
    let candidates = [];
    if (!status) {
      candidates = findPmosGoogleContactCandidatesFromPeople_(customer, people);
      const automatic = candidates.filter(function (candidate) { return candidate.automaticMatch; });
      if (automatic.length === 1) {
        person = peopleByResource[automatic[0].resourceName]; status = 'READY'; matchReason = 'Exact name and address';
      } else status = candidates.length ? 'REVIEW' : 'UNMATCHED';
    }
    const contact = person ? normalizePmosGooglePerson_(person) : null;
    const differences = contact ? comparePmosCustomerAndGoogleContact_(customer, contact) : [];
    return {
      customerId: customer.customerId,
      customerName: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.customerId,
      customerAddress: customer.address, customerPhone: customer.phone, customerEmail: customer.email,
      contactName: contact ? contact.displayName : '', resourceName: person ? person.resourceName : '',
      status: status, matchReason: matchReason,
      explanation: status === 'UNMATCHED' ? 'No name, address, phone, or email match was found.' :
        status === 'REVIEW' ? 'Name suggestions were found, but the address or contact details were not strong enough to link automatically.' :
          status === 'BROKEN' ? 'The previously linked Google Contact is no longer available.' : '',
      differences: differences.map(function (item) { return item.field; }), candidates: candidates.slice(0, 5)
    };
  });
  return {rows: rows,
    ready: rows.filter(function (row) { return row.status === 'READY'; }).length,
    review: rows.filter(function (row) { return row.status === 'REVIEW'; }).length,
    unmatched: rows.filter(function (row) { return row.status === 'UNMATCHED'; }).length,
    broken: rows.filter(function (row) { return row.status === 'BROKEN'; }).length};
}

function applyPmosGoogleContactsMassSyncBatch(direction, selections) {
  const cleanDirection = String(direction || '').toUpperCase();
  if (cleanDirection !== 'PULL' && cleanDirection !== 'PUSH') throw new Error('Choose Pull or Push.');
  const batch = Array.isArray(selections) ? selections.slice(0, 12) : [];
  if (!batch.length) throw new Error('No customers were selected.');
  const results = [];
  batch.forEach(function (selection) {
    const customerId = String(selection.customerId || '').trim();
    const resourceName = String(selection.resourceName || '').trim();
    try {
      let customer = getPmosCustomerContactRecord_(customerId, true);
      if (!customer.resourceName) {
        const candidates = findPmosGoogleContactCandidates_(customer).filter(function (candidate) {
          return candidate.automaticMatch && candidate.resourceName === resourceName;
        });
        if (candidates.length !== 1) throw new Error('The safe match changed; review this customer again.');
        writePmosGoogleContactLink_(customer, People.People.get(resourceName, {personFields: PMOS_CONTACT_FIELDS_}));
        customer = getPmosCustomerContactRecord_(customerId, true);
      }
      if (customer.resourceName !== resourceName) throw new Error('The linked contact changed; review this customer again.');
      if (cleanDirection === 'PULL') pullGoogleContactToPmosCustomer_(customer);
      else pushPmosCustomerToGoogleContact_(customer);
      results.push({customerId: customerId, ok: true});
    } catch (error) {
      results.push({customerId: customerId, ok: false, error: error && error.message ? error.message : String(error)});
    }
  });
  return {direction: cleanDirection, results: results};
}

function listPmosGoogleContacts_() {
  let pageToken = '';
  let results = [];
  do {
    const options = {personFields: PMOS_CONTACT_FIELDS_, pageSize: 1000, sortOrder: 'LAST_NAME_ASCENDING'};
    if (pageToken) options.pageToken = pageToken;
    const response = People.People.Connections.list('people/me', options);
    results = results.concat(response.connections || []);
    pageToken = response.nextPageToken || '';
  } while (pageToken);
  return results;
}

function searchPmosGoogleContactsForManualLink(query) {
  const clean = normalizePmosCustomerSearch_(query);
  if (clean.length < 2) throw new Error('Enter at least two characters to search Google Contacts.');
  const terms = clean.split(' ').filter(Boolean);
  return listPmosGoogleContacts_().map(function (person) {
    const contact = normalizePmosGooglePerson_(person);
    const haystack = normalizePmosCustomerSearch_([
      contact.displayName, contact.addresses.join(' '), contact.phones.join(' '), contact.emails.join(' ')
    ].join(' '));
    const matchedTerms = terms.filter(function (term) { return haystack.indexOf(term) >= 0; }).length;
    if (!matchedTerms) return null;
    const startsWithName = normalizePmosCustomerSearch_(contact.displayName).indexOf(clean) === 0;
    return {resourceName: contact.resourceName, displayName: contact.displayName, address: contact.address,
      phone: contact.phone, email: contact.email, score: matchedTerms * 10 + (startsWithName ? 5 : 0)};
  }).filter(Boolean).sort(function (a, b) {
    return b.score - a.score || a.displayName.localeCompare(b.displayName);
  }).slice(0, 25).map(function (contact) { delete contact.score; return contact; });
}

function normalizePmosGooglePerson_(person) {
  const names = person.names || [];
  const primaryName = names.find(function (item) { return item.metadata && item.metadata.primary; }) || names[0] || {};
  const emails = (person.emailAddresses || []).map(function (item) { return String(item.value || '').trim(); }).filter(Boolean);
  const phones = (person.phoneNumbers || []).map(function (item) { return String(item.value || '').trim(); }).filter(Boolean);
  const addresses = (person.addresses || []).map(function (item) {
    return String(item.formattedValue || [item.streetAddress, item.city, item.region, item.postalCode, item.country].filter(Boolean).join(', ')).trim();
  }).filter(Boolean);
  const biographies = (person.biographies || []).map(function (item) { return String(item.value || '').trim(); }).filter(Boolean);
  return {
    resourceName: String(person.resourceName || ''),
    etag: String(person.etag || ''),
    firstName: String(primaryName.givenName || '').trim(),
    lastName: String(primaryName.familyName || '').trim(),
    displayName: String(primaryName.displayName || [primaryName.givenName, primaryName.familyName].filter(Boolean).join(' ') || 'Unnamed contact').trim(),
    email: emails[0] || '', emails: emails,
    phone: phones[0] || '', phones: phones,
    address: addresses[0] || '', addresses: addresses,
    notes: biographies[0] || ''
  };
}

function buildPmosGoogleContactState_(customer, person, status) {
  const contact = normalizePmosGooglePerson_(person);
  return {
    status: status,
    customerId: customer.customerId,
    resourceName: contact.resourceName,
    contact: contact,
    differences: comparePmosCustomerAndGoogleContact_(customer, contact),
    lastSynced: customer.syncedAt ? formatPmosCustomerProfileDate_(customer.syncedAt) : '',
    candidates: []
  };
}

function comparePmosCustomerAndGoogleContact_(customer, contact) {
  const fields = [
    ['First name', 'firstName', function (v) { return normalizePmosCustomerSearch_(v); }],
    ['Last name', 'lastName', function (v) { return normalizePmosCustomerSearch_(v); }],
    ['Phone', 'phone', normalizePmosContactPhone_],
    ['Email', 'email', normalizePmosContactEmail_],
    ['Address', 'address', function (v) { return normalizePmosCustomerSearch_(v); }],
    ['Customer notes', 'notes', function (v) { return String(v || '').trim(); }]
  ];
  return fields.map(function (field) {
    const pmosValue = String(customer[field[1]] || '').trim();
    const googleValue = String(contact[field[1]] || '').trim();
    return field[2](pmosValue) === field[2](googleValue) ? null : {
      field: field[0], key: field[1], pmos: pmosValue, google: googleValue
    };
  }).filter(Boolean);
}

function formatPmosContactDifferenceSummary_(differences, direction) {
  if (!differences.length) return 'PMOS and Google Contacts already match.';
  const source = direction === 'PULL' ? 'Google' : 'PMOS';
  const destination = direction === 'PULL' ? 'PMOS' : 'Google Contacts';
  return source + ' will replace these fields in ' + destination + ':\n\n' + differences.map(function (item) {
    const from = direction === 'PULL' ? item.google : item.pmos;
    const to = direction === 'PULL' ? item.pmos : item.google;
    return item.field + ':\n  Current: ' + (to || '(blank)') + '\n  New: ' + (from || '(blank)');
  }).join('\n\n');
}

function writePmosGoogleContactLink_(customer, person) {
  const fresh = getPmosCustomerContactRecord_(customer.customerId, true);
  const values = fresh.sheet.getRange(fresh.rowNumber, 1, 1, fresh.headers.length).getValues()[0];
  values[fresh.indexes.resourceName] = person.resourceName || '';
  values[fresh.indexes.etag] = person.etag || '';
  values[fresh.indexes.syncedAt] = new Date();
  fresh.sheet.getRange(fresh.rowNumber, 1, 1, values.length).setValues([values]);
}

function getPmosCustomerContactRecord_(customerId, ensureWritableColumns) {
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [PMOS.CUSTOMERS_SHEET, 'Customer Database', 'Customer List']);
  if (!sheet) throw new Error('Customers sheet was not found.');
  if (ensureWritableColumns) ensurePmosGoogleContactHeaders_(sheet);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (value) { return String(value || '').trim(); });
  const index = function (aliases, required) {
    const found = findHeaderIndex_(headers, aliases);
    if (required && found < 0) throw new Error('Customers is missing ' + aliases[0] + '.');
    return found;
  };
  const indexes = {
    id: index(['Customer ID'], true), firstName: index(['First Name'], true),
    lastName: index(['Last Name', 'Customer Name', 'Name', 'Customer'], true),
    address: index(['Full Address', 'Service Address', 'Address', 'Street Address'], true),
    phone: index(['Primary Phone', 'Phone Number', 'Phone'], true),
    email: index(['Email', 'Email Address'], true),
    notes: index(['Customer Notes', 'Notes', 'Details'], false),
    resourceName: index([PMOS_CONTACT_LINK_HEADERS_.resourceName], false),
    etag: index([PMOS_CONTACT_LINK_HEADERS_.etag], false),
    syncedAt: index([PMOS_CONTACT_LINK_HEADERS_.syncedAt], false)
  };
  const cleanId = String(customerId || '').trim();
  for (let row = 1; row < values.length; row++) {
    if (String(values[row][indexes.id] || '').trim().toUpperCase() !== cleanId.toUpperCase()) continue;
    const value = function (key) { return indexes[key] >= 0 ? values[row][indexes[key]] : ''; };
    return {
      sheet: sheet, headers: headers, indexes: indexes, rowNumber: row + 1,
      customerId: cleanId,
      firstName: String(value('firstName') || '').trim(), lastName: String(value('lastName') || '').trim(),
      address: String(value('address') || '').trim(), phone: String(value('phone') || '').trim(),
      email: String(value('email') || '').trim(), notes: String(value('notes') || '').trim(),
      resourceName: String(value('resourceName') || '').trim(),
      etag: String(value('etag') || '').trim(), syncedAt: value('syncedAt')
    };
  }
  throw new Error('Customer ID ' + cleanId + ' was not found.');
}

function listPmosCustomerContactRecords_() {
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [PMOS.CUSTOMERS_SHEET, 'Customer Database', 'Customer List']);
  if (!sheet) throw new Error('Customers sheet was not found.');
  ensurePmosGoogleContactHeaders_(sheet);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (value) { return String(value || '').trim(); });
  const index = function (aliases, required) {
    const found = findHeaderIndex_(headers, aliases);
    if (required && found < 0) throw new Error('Customers is missing ' + aliases[0] + '.');
    return found;
  };
  const indexes = {
    id: index(['Customer ID'], true), firstName: index(['First Name'], true),
    lastName: index(['Last Name', 'Customer Name', 'Name', 'Customer'], true),
    address: index(['Full Address', 'Service Address', 'Address', 'Street Address'], true),
    phone: index(['Primary Phone', 'Phone Number', 'Phone'], true), email: index(['Email', 'Email Address'], true),
    notes: index(['Customer Notes', 'Notes', 'Details'], false),
    resourceName: index([PMOS_CONTACT_LINK_HEADERS_.resourceName], false),
    etag: index([PMOS_CONTACT_LINK_HEADERS_.etag], false), syncedAt: index([PMOS_CONTACT_LINK_HEADERS_.syncedAt], false)
  };
  return values.slice(1).map(function (row, offset) {
    const value = function (key) { return indexes[key] >= 0 ? row[indexes[key]] : ''; };
    const customerId = String(value('id') || '').trim();
    if (!customerId) return null;
    return {sheet: sheet, headers: headers, indexes: indexes, rowNumber: offset + 2, customerId: customerId,
      firstName: String(value('firstName') || '').trim(), lastName: String(value('lastName') || '').trim(),
      address: String(value('address') || '').trim(), phone: String(value('phone') || '').trim(),
      email: String(value('email') || '').trim(), notes: String(value('notes') || '').trim(),
      resourceName: String(value('resourceName') || '').trim(), etag: String(value('etag') || '').trim(),
      syncedAt: value('syncedAt')};
  }).filter(Boolean);
}

function ensurePmosGoogleContactHeaders_(sheet) {
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (value) { return String(value || '').trim(); });
  const missing = Object.keys(PMOS_CONTACT_LINK_HEADERS_).map(function (key) { return PMOS_CONTACT_LINK_HEADERS_[key]; }).filter(function (header) {
    return findHeaderIndex_(headers, [header]) < 0;
  });
  if (!missing.length) return;
  sheet.getRange(1, lastColumn + 1, 1, missing.length).setValues([missing]);
}

function normalizePmosContactEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePmosContactName_(value) {
  return normalizePmosCustomerSearch_(String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and '))
    .replace(/\b(mr|mrs|ms|miss|dr)\b/g, '').replace(/\s+/g, ' ').trim();
}

function normalizePmosContactGivenNameSet_(value) {
  return normalizePmosContactName_(value).split(' ').filter(function (part) {
    return part && part !== 'and';
  }).filter(function (part, index, parts) { return parts.indexOf(part) === index; }).sort().join(' ');
}

function pmosContactNamesOverlap_(left, right) {
  const leftParts = String(left || '').split(' ').filter(Boolean);
  const rightParts = String(right || '').split(' ').filter(Boolean);
  return leftParts.some(function (part) {
    return rightParts.some(function (other) {
      return other === part || (part.length === 1 && other.charAt(0) === part) || (other.length === 1 && part.charAt(0) === other);
    });
  });
}

function normalizePmosContactPhone_(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length > 10 && digits.charAt(0) === '1' ? digits.slice(1) : digits;
}

function normalizePmosContactAddress_(value) {
  return normalizePmosCustomerSearch_(value)
    .replace(/\b(canada|ontario|on)\b/g, '')
    .replace(/\b(drive|drv)\b/g, 'dr').replace(/\b(street)\b/g, 'st')
    .replace(/\b(road)\b/g, 'rd').replace(/\b(avenue)\b/g, 'ave')
    .replace(/\b(boulevard)\b/g, 'blvd').replace(/\b(court)\b/g, 'ct')
    .replace(/\b(crescent)\b/g, 'cres').replace(/\b(lane)\b/g, 'ln')
    .replace(/\b(place)\b/g, 'pl').replace(/\b(highway)\b/g, 'hwy')
    .replace(/\s+/g, ' ').trim();
}

function extractPmosContactPostalCode_(value) {
  const match = String(value || '').toUpperCase().match(/\b([A-Z]\d[A-Z])\s?(\d[A-Z]\d)\b/);
  return match ? match[1] + match[2] : '';
}

function normalizePmosContactStreet_(value) {
  const firstLine = String(value || '').split(',')[0];
  return normalizePmosContactAddress_(firstLine).replace(/\b(unit|suite|apt|apartment)\s*[a-z0-9-]+\b/g, '').trim();
}
