/**
 * Account-level additional contacts.
 *
 * The primary account holder remains in the normal customer identity/contact columns.
 * Additional Account Contacts are stored account-wide in the spreadsheet first, then
 * mirrored to linked Google Contacts when that can be done safely.
 */
const PMOS_ACCOUNT_CONTACTS_HEADER_ = 'Account Contacts JSON';

function normalizePmosAccountContacts_(input) {
  const rows = Array.isArray(input) ? input.slice(0, 20) : [];
  return rows.map(function(contact) {
    contact = contact || {};
    const clean = {
      firstName: String(contact.firstName || '').trim().slice(0, 120),
      lastName: String(contact.lastName || '').trim().slice(0, 120),
      role: String(contact.role || contact.relationship || '').trim().slice(0, 160),
      phone: String(contact.phone || '').trim().slice(0, 80),
      email: String(contact.email || '').trim().slice(0, 180),
      notes: String(contact.notes || '').trim().slice(0, 1000),
      resourceName: String(contact.resourceName || '').trim().slice(0, 250)
    };
    const hasValue = ['firstName', 'lastName', 'role', 'phone', 'email', 'notes'].some(function(key) {
      return !!clean[key];
    });
    if (!hasValue) return null;
    if (!clean.firstName || !clean.lastName || !clean.phone) {
      throw new Error('Each additional Account Contact needs a first name, last name, and phone number.');
    }
    if (clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) {
      throw new Error('An Account Contact has an invalid email address.');
    }
    return clean;
  }).filter(Boolean);
}

function ensurePmosAccountContactsTable_() {
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [
    PMOS.CUSTOMERS_SHEET, 'Customers', 'Customer Database', 'Customer List'
  ]);
  if (!sheet) throw new Error('Customers sheet was not found.');
  let table = readPmosHeaderTable_(sheet);
  ensureMaintenanceClientHeaders_(sheet, table, [PMOS_ACCOUNT_CONTACTS_HEADER_]);
  table = readPmosHeaderTable_(sheet);
  return {sheet: sheet, table: table};
}

function getPmosAccountContacts_(customerId) {
  const account = getPmosCustomerAccount_(customerId);
  const source = ensurePmosAccountContactsTable_();
  const idIndex = findHeaderIndex_(source.table.headers, ['Customer ID']);
  const accountIndex = findHeaderIndex_(source.table.headers, ['Account ID']);
  const contactsIndex = findHeaderIndex_(source.table.headers, [PMOS_ACCOUNT_CONTACTS_HEADER_]);
  if (idIndex < 0 || contactsIndex < 0) return [];
  let raw = '';
  source.table.rows.some(function(row) {
    const rowAccountId = accountIndex >= 0
      ? String(row[accountIndex] || row[idIndex] || '').trim()
      : String(row[idIndex] || '').trim();
    if (rowAccountId !== account.accountId) return false;
    const value = String(row[contactsIndex] || '').trim();
    if (!value) return false;
    raw = value;
    return true;
  });
  if (!raw) return [];
  try {
    return normalizePmosAccountContacts_(JSON.parse(raw));
  } catch (error) {
    if (error && /Account Contact/i.test(String(error.message || ''))) throw error;
    throw new Error('Account Contacts could not be read.');
  }
}

function savePmosAccountContacts_(customerId, contacts) {
  const normalized = normalizePmosAccountContacts_(contacts);
  const account = getPmosCustomerAccount_(customerId);
  const source = ensurePmosAccountContactsTable_();
  const idIndex = findHeaderIndex_(source.table.headers, ['Customer ID']);
  const accountIndex = findHeaderIndex_(source.table.headers, ['Account ID']);
  const contactsIndex = findHeaderIndex_(source.table.headers, [PMOS_ACCOUNT_CONTACTS_HEADER_]);
  if (idIndex < 0 || contactsIndex < 0) throw new Error('Customers is missing Account Contact storage.');
  const serialized = normalized.length ? JSON.stringify(normalized) : '';
  source.table.rows.forEach(function(row, index) {
    const rowAccountId = accountIndex >= 0
      ? String(row[accountIndex] || row[idIndex] || '').trim()
      : String(row[idIndex] || '').trim();
    if (rowAccountId !== account.accountId) return;
    source.sheet.getRange(source.table.headerRow + index + 1, contactsIndex + 1).setValue(serialized);
  });
  SpreadsheetApp.flush();
  return normalized;
}

function buildPmosAccountContactGooglePerson_(contact, customerId, latest) {
  const externalIds = ((latest && latest.externalIds) || []).filter(function(item) {
    return !(item && item.type === 'customer_account' && String(item.value || '') === String(customerId || ''));
  });
  externalIds.push({value: String(customerId || '').trim(), type: 'customer_account'});
  const notes = [];
  if (contact.role) notes.push('Account role: ' + contact.role);
  if (contact.notes) notes.push(contact.notes);
  const person = {
    names: [{givenName: contact.firstName, familyName: contact.lastName}],
    phoneNumbers: contact.phone ? [{value: contact.phone, type: 'mobile'}] : [],
    emailAddresses: contact.email ? [{value: contact.email, type: 'work'}] : [],
    biographies: notes.length ? [{value: notes.join('\n\n'), contentType: 'TEXT_PLAIN'}] : [],
    externalIds: externalIds
  };
  if (latest) {
    person.resourceName = latest.resourceName;
    person.etag = latest.etag;
    person.metadata = latest.metadata;
  }
  return person;
}

function syncPmosAccountContactsToGoogle_(customerId, contacts) {
  let normalized = savePmosAccountContacts_(customerId, contacts);
  const warnings = [];
  let state = null;
  try {
    state = getPmosGoogleContactStateForAccount_(customerId);
    if (state && state.status === 'UNLINKED') {
      state = createPmosGoogleContactForAccount(customerId);
    }
  } catch (error) {
    warnings.push('Primary account holder Google Contact could not be prepared: ' +
      String(error && error.message ? error.message : error));
  }

  const customer = getPmosCustomerContactRecord_(customerId, true);
  if (!customer.resourceNames.length) {
    if (normalized.length) {
      warnings.push('Additional Account Contacts were saved in PMOS but were not sent to Google Contacts because the primary account holder still needs Contact review/linking.');
    }
    return {contacts: normalized, warnings: warnings, googleState: state};
  }

  const resources = customer.resourceNames.slice();
  let people = [];
  try { people = listPmosGoogleContacts_(); }
  catch (error) {
    warnings.push('Google Contacts could not be searched for additional Account Contacts: ' +
      String(error && error.message ? error.message : error));
  }

  normalized = normalized.map(function(contact) {
    try {
      let latest = null;
      if (contact.resourceName) {
        try { latest = People.People.get(contact.resourceName, {personFields: PMOS_CONTACT_FIELDS_}); }
        catch (ignored) { latest = null; }
      }
      if (!latest && people.length) {
        const candidates = findPmosGoogleContactCandidatesFromPeople_({
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone,
          email: contact.email,
          address: ''
        }, people).filter(function(candidate) { return candidate.automaticMatch; });
        if (candidates.length > 1) {
          throw new Error('More than one existing Google Contact matches ' + contact.firstName + ' ' + contact.lastName + '.');
        }
        if (candidates.length === 1) {
          latest = People.People.get(candidates[0].resourceName, {personFields: PMOS_CONTACT_FIELDS_});
        }
      }

      const payload = buildPmosAccountContactGooglePerson_(contact, customerId, latest);
      const saved = latest
        ? People.People.updateContact(payload, latest.resourceName, {
            updatePersonFields: 'names,phoneNumbers,emailAddresses,biographies,externalIds',
            personFields: PMOS_CONTACT_FIELDS_
          })
        : People.People.createContact(payload, {personFields: PMOS_CONTACT_FIELDS_});
      const updated = Object.assign({}, contact, {
        resourceName: String(saved && saved.resourceName || '').trim()
      });
      if (updated.resourceName && resources.indexOf(updated.resourceName) < 0) resources.push(updated.resourceName);
      return updated;
    } catch (error) {
      warnings.push('Account Contact ' + [contact.firstName, contact.lastName].filter(Boolean).join(' ') +
        ' was saved in PMOS but could not be synchronized to Google Contacts: ' +
        String(error && error.message ? error.message : error));
      return contact;
    }
  });

  try {
    writePmosGoogleContactLinks_(customer, resources);
  } catch (error) {
    warnings.push('Google Contact links could not be updated: ' +
      String(error && error.message ? error.message : error));
  }
  savePmosAccountContacts_(customerId, normalized);
  return {contacts: normalized, warnings: warnings, googleState: state};
}

function pmosAccountContactStyles_() {
  return '.account-contact-list{display:grid;gap:9px}.account-contact-row{position:relative;padding:11px;border:1px solid #d5e0e5;border-radius:9px;background:#f7fafb}.account-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.account-contact-grid .wide{grid-column:1/-1}.account-contact-remove{position:absolute;right:8px;top:8px;border:0;background:transparent;color:#7a878d;font-size:17px;cursor:pointer}.account-contact-role{grid-column:1/-1}@media(max-width:760px){.account-contact-grid{grid-template-columns:1fr}.account-contact-grid .wide,.account-contact-role{grid-column:auto}}';
}

function pmosAccountContactClientScript_() {
  return String.raw`
function pmosAccountContactEsc(value){return String(value==null?'':value).replace(/[&<>\"]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]})}
function pmosAccountContactTitleInput(input){if(!input)return;if(window.pmosTitleCaseInput){window.pmosTitleCaseInput(input);return}input.value=String(input.value||'').replace(/(^|[\s'’-])([a-zà-öø-ÿ])/g,function(match,prefix,letter){return prefix+letter.toUpperCase()})}
function pmosAccountContactRow(contact){contact=contact||{};var row=document.createElement('div');row.className='account-contact-row';row.dataset.resourceName=contact.resourceName||'';row.innerHTML='<button type="button" class="account-contact-remove" aria-label="Remove Account Contact">×</button><div class="account-contact-grid"><div class="field"><label>Last name</label><input data-account-contact="lastName" autocomplete="family-name"></div><div class="field"><label>First name</label><input data-account-contact="firstName" autocomplete="given-name"></div><div class="field account-contact-role"><label>Role / relationship <span class="optional">optional</span></label><input data-account-contact="role" placeholder="Spouse, billing contact, account manager…"></div><div class="field"><label>Phone</label><input data-account-contact="phone" autocomplete="tel" inputmode="tel"></div><div class="field"><label>Email <span class="optional">optional</span></label><input data-account-contact="email" type="email" autocomplete="email"></div><div class="field wide"><label>Contact notes <span class="optional">optional</span></label><textarea data-account-contact="notes" placeholder="Preferred communication or account responsibilities…"></textarea></div></div>';['firstName','lastName','role','phone','email','notes'].forEach(function(key){var input=row.querySelector('[data-account-contact="'+key+'"]');if(input)input.value=contact[key]||''});var first=row.querySelector('[data-account-contact="firstName"]'),last=row.querySelector('[data-account-contact="lastName"]'),phone=row.querySelector('[data-account-contact="phone"]');[first,last].forEach(function(input){if(input)input.addEventListener('input',function(){pmosAccountContactTitleInput(input)})});if(phone){if(typeof formatPmosPhoneInput==='function')formatPmosPhoneInput(phone);phone.addEventListener('input',function(){if(typeof formatPmosPhoneInput==='function')formatPmosPhoneInput(phone)})}row.querySelector('.account-contact-remove').onclick=function(){row.remove()};return row}
function pmosRenderAccountContacts(containerId,contacts){var root=document.getElementById(containerId);if(!root)return;root.innerHTML='';(contacts||[]).forEach(function(contact){root.appendChild(pmosAccountContactRow(contact))})}
function pmosAddAccountContact(containerId,contact){var root=document.getElementById(containerId);if(!root)return;var row=pmosAccountContactRow(contact||{});root.appendChild(row);var last=row.querySelector('[data-account-contact="lastName"]');if(last)last.focus()}
function pmosCollectAccountContacts(containerId){var root=document.getElementById(containerId);if(!root)return[];return Array.prototype.map.call(root.querySelectorAll('.account-contact-row'),function(row){var read=function(key){var input=row.querySelector('[data-account-contact="'+key+'"]');return input?String(input.value||'').trim():''};return{firstName:read('firstName'),lastName:read('lastName'),role:read('role'),phone:read('phone'),email:read('email'),notes:read('notes'),resourceName:row.dataset.resourceName||''}}).filter(function(contact){return contact.firstName||contact.lastName||contact.role||contact.phone||contact.email||contact.notes})}
`;
}
