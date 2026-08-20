/**
 * Service-location-specific contacts.
 *
 * Account contacts remain shared across the account. These contacts are stored on one
 * service-location Customer ID only and are never propagated to sibling locations.
 */
const PMOS_SERVICE_LOCATION_CONTACTS_HEADER_ = 'Service Location Contacts JSON';

function ensurePmosServiceLocationContactsTable_() {
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [
    PMOS.CUSTOMERS_SHEET, 'Customers', 'Customer Database', 'Customer List'
  ]);
  if (!sheet) throw new Error('Customers sheet was not found.');
  let table = readPmosHeaderTable_(sheet);
  ensureMaintenanceClientHeaders_(sheet, table, [PMOS_SERVICE_LOCATION_CONTACTS_HEADER_]);
  table = readPmosHeaderTable_(sheet);
  return {sheet: sheet, table: table};
}

function normalizePmosServiceLocationContacts_(input) {
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
    if (!clean.firstName && !clean.lastName && !clean.role) {
      throw new Error('Each service location contact needs a name or role.');
    }
    if (clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) {
      throw new Error('A service location contact has an invalid email address.');
    }
    return clean;
  }).filter(Boolean);
}

function getPmosServiceLocationContacts_(customerId) {
  const id = String(customerId || '').trim().toUpperCase();
  if (!id) return [];
  const source = ensurePmosServiceLocationContactsTable_();
  const idIndex = findHeaderIndex_(source.table.headers, ['Customer ID']);
  const contactsIndex = findHeaderIndex_(source.table.headers, [PMOS_SERVICE_LOCATION_CONTACTS_HEADER_]);
  if (idIndex < 0 || contactsIndex < 0) return [];
  for (let index = 0; index < source.table.rows.length; index++) {
    const row = source.table.rows[index];
    if (String(row[idIndex] || '').trim().toUpperCase() !== id) continue;
    const raw = String(row[contactsIndex] || '').trim();
    if (!raw) return [];
    try {
      return normalizePmosServiceLocationContacts_(JSON.parse(raw));
    } catch (error) {
      if (error && /service location contact/i.test(String(error.message || ''))) throw error;
      throw new Error('Service location contacts for ' + customerId + ' could not be read.');
    }
  }
  return [];
}

function getPmosServiceLocationContacts(customerId) {
  return getPmosServiceLocationContacts_(customerId);
}

function savePmosServiceLocationContacts_(customerId, contacts) {
  const id = String(customerId || '').trim().toUpperCase();
  if (!id) throw new Error('Service location contacts are missing Customer ID.');
  const normalized = normalizePmosServiceLocationContacts_(contacts);
  const source = ensurePmosServiceLocationContactsTable_();
  const idIndex = findHeaderIndex_(source.table.headers, ['Customer ID']);
  const contactsIndex = findHeaderIndex_(source.table.headers, [PMOS_SERVICE_LOCATION_CONTACTS_HEADER_]);
  if (idIndex < 0 || contactsIndex < 0) {
    throw new Error('Customers is missing service location contact storage.');
  }
  for (let index = 0; index < source.table.rows.length; index++) {
    if (String(source.table.rows[index][idIndex] || '').trim().toUpperCase() !== id) continue;
    source.sheet.getRange(source.table.headerRow + index + 1, contactsIndex + 1)
      .setValue(normalized.length ? JSON.stringify(normalized) : '');
    SpreadsheetApp.flush();
    return normalized;
  }
  throw new Error('Customer ID ' + customerId + ' was not found while saving service location contacts.');
}

function getPmosServiceLocationContactIdentity_(customerId) {
  const account = getPmosCustomerAccount_(customerId);
  const location = account.locations.filter(function(item) {
    return String(item.customerId) === String(customerId);
  })[0];
  if (!location) throw new Error('The selected service location could not be found.');
  return {
    customerId: String(customerId || '').trim(),
    accountId: account.accountId,
    locationName: String(location.locationName || location.calendarTitle || 'Service Location').trim(),
    address: String(location.address || '').trim()
  };
}

function buildPmosServiceLocationGooglePerson_(contact, identity, latest) {
  const existingExternalIds = latest && Array.isArray(latest.externalIds) ? latest.externalIds.filter(function(item) {
    return String(item && item.type || '') !== 'service_location';
  }) : [];
  existingExternalIds.push({value: identity.customerId, type: 'service_location'});
  const name = contact.firstName || contact.lastName
    ? {givenName: contact.firstName || '', familyName: contact.lastName || ''}
    : {givenName: contact.role || 'Service Location Contact'};
  const noteLines = [];
  if (contact.role) noteLines.push('Role: ' + contact.role);
  noteLines.push('Service location: ' + identity.locationName);
  if (contact.notes) noteLines.push('', contact.notes);
  return {
    names: [name],
    phoneNumbers: contact.phone ? [{value: contact.phone, type: 'mobile'}] : [],
    emailAddresses: contact.email ? [{value: contact.email, type: 'work'}] : [],
    addresses: identity.address ? [{formattedValue: identity.address, type: 'work'}] : [],
    biographies: noteLines.length ? [{value: noteLines.join('\n'), contentType: 'TEXT_PLAIN'}] : [],
    externalIds: existingExternalIds
  };
}

function upsertPmosServiceLocationGoogleContact_(contact, identity) {
  let latest = null;
  if (contact.resourceName) {
    try {
      latest = People.People.get(contact.resourceName, {personFields: PMOS_CONTACT_FIELDS_});
    } catch (ignored) {
      latest = null;
    }
  }
  const person = buildPmosServiceLocationGooglePerson_(contact, identity, latest);
  let saved;
  if (latest) {
    person.resourceName = latest.resourceName;
    person.etag = latest.etag;
    person.metadata = latest.metadata;
    saved = People.People.updateContact(person, latest.resourceName, {
      updatePersonFields: 'names,emailAddresses,phoneNumbers,addresses,biographies,externalIds',
      personFields: PMOS_CONTACT_FIELDS_
    });
  } else {
    saved = People.People.createContact(person, {personFields: PMOS_CONTACT_FIELDS_});
  }
  const updated = Object.assign({}, contact);
  updated.resourceName = String(saved && saved.resourceName || contact.resourceName || '').trim();
  return updated;
}

function saveAndSyncPmosServiceLocationContacts_(customerId, contacts) {
  let saved = savePmosServiceLocationContacts_(customerId, contacts);
  const identity = getPmosServiceLocationContactIdentity_(customerId);
  const errors = [];
  saved = saved.map(function(contact) {
    try {
      return upsertPmosServiceLocationGoogleContact_(contact, identity);
    } catch (error) {
      errors.push(String(error && error.message ? error.message : error));
      return contact;
    }
  });
  savePmosServiceLocationContacts_(customerId, saved);
  return {contacts: saved, errors: errors};
}

function createPmosAdditionalServiceLocationForAccountWithLocationContacts(input) {
  const request = input || {};
  const contacts = normalizePmosServiceLocationContacts_(request.serviceLocationContacts);
  const result = createPmosAdditionalServiceLocationForAccount(request);
  const contactResult = saveAndSyncPmosServiceLocationContacts_(result.customerId, contacts);
  result.serviceLocationContacts = contactResult.contacts;
  if (contactResult.errors.length) {
    result.contactStatus = 'Service location saved, but ' + contactResult.errors.length + ' Google Contact update(s) could not be completed.';
  }
  result.profile = getPmosCustomerAccountProfile(result.customerId);
  return result;
}

function savePmosCustomerAccountEditorDataWithLocationContacts(input) {
  const request = input || {};
  const contacts = normalizePmosServiceLocationContacts_(request.serviceLocationContacts);
  const result = savePmosCustomerAccountEditorData(request);
  const contactResult = saveAndSyncPmosServiceLocationContacts_(result.customerId, contacts);
  result.serviceLocationContacts = contactResult.contacts;
  if (contactResult.errors.length) {
    result.contactStatus = [result.contactStatus, contactResult.errors.length + ' service-location Google Contact update(s) could not be completed.'].filter(Boolean).join(' · ');
  }
  result.profile = getPmosCustomerAccountProfile(result.customerId);
  return result;
}

function pmosServiceLocationContactStyles_() {
  return '.location-contacts{display:grid;gap:9px}.location-contact-row{position:relative;padding:11px;border:1px solid #d5e0e5;border-radius:9px;background:#f7fafb}.location-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.location-contact-grid .wide{grid-column:1/-1}.location-contact-remove{position:absolute;right:8px;top:8px;border:0;background:transparent;color:#7a878d;font-size:17px;cursor:pointer}.location-contact-summary{margin-top:8px;padding:9px 10px;border:1px solid #dbe3e7;border-radius:8px;background:#fff}.location-contact-summary-name{font-size:11px;font-weight:900}.location-contact-summary-meta{margin-top:3px;color:#68747a;font-size:10px;line-height:1.45}.location-contact-summary a{color:#0f5470;text-decoration:none}.location-contact-summary a:hover{text-decoration:underline}@media(max-width:760px){.location-contact-grid{grid-template-columns:1fr}.location-contact-grid .wide{grid-column:auto}}';
}

function pmosServiceLocationContactClientScript_() {
  return String.raw`
var pmosLocationContactRoleSequence=0;
function pmosLocationContactEsc(value){return String(value==null?'':value).replace(/[&<>\"]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]})}
function pmosLocationContactRow(contact){contact=contact||{};var row=document.createElement('div'),roleListId='pmosLocationContactRoles'+(++pmosLocationContactRoleSequence);row.className='location-contact-row';row.dataset.resourceName=contact.resourceName||'';row.innerHTML='<button type="button" class="location-contact-remove" aria-label="Remove service location contact">×</button><div class="location-contact-grid"><div class="field"><label>First name</label><input data-location-contact="firstName"></div><div class="field"><label>Last name</label><input data-location-contact="lastName"></div><div class="field"><label>Role / relationship</label><input data-location-contact="role" list="'+roleListId+'" placeholder="Select or type another role"><datalist id="'+roleListId+'"><option value="Tenant"></option><option value="Property Manager"></option><option value="Superintendent"></option><option value="Keyholder"></option><option value="Site Contact"></option></datalist></div><div class="field"><label>Phone</label><input data-location-contact="phone" autocomplete="tel" inputmode="tel"></div><div class="field"><label>Email</label><input data-location-contact="email" type="email" autocomplete="email"></div><div class="field wide"><label>Contact notes</label><textarea data-location-contact="notes" placeholder="When to contact them, access responsibilities, preferred communication…"></textarea></div></div>';['firstName','lastName','role','phone','email','notes'].forEach(function(key){var input=row.querySelector('[data-location-contact="'+key+'"]');if(input)input.value=contact[key]||''});row.querySelector('.location-contact-remove').onclick=function(){row.remove()};return row}
function pmosEnhanceLocationContactRows(root){if(typeof enhanceEditableSelects==='function')enhanceEditableSelects(root)}
function pmosRenderLocationContacts(containerId,contacts){var root=document.getElementById(containerId);if(!root)return;root.innerHTML='';(contacts||[]).forEach(function(contact){root.appendChild(pmosLocationContactRow(contact))});pmosEnhanceLocationContactRows(root)}
function pmosAddLocationContact(containerId,contact){var root=document.getElementById(containerId);if(!root)return;var row=pmosLocationContactRow(contact||{});root.appendChild(row);pmosEnhanceLocationContactRows(row);var first=row.querySelector('[data-location-contact="firstName"]');if(first)first.focus()}
function pmosCollectLocationContacts(containerId){var root=document.getElementById(containerId);if(!root)return[];return Array.prototype.map.call(root.querySelectorAll('.location-contact-row'),function(row){var read=function(key){var input=row.querySelector('[data-location-contact="'+key+'"]');return input?String(input.value||'').trim():''};return{firstName:read('firstName'),lastName:read('lastName'),role:read('role'),phone:read('phone'),email:read('email'),notes:read('notes'),resourceName:row.dataset.resourceName||''}}).filter(function(contact){return contact.firstName||contact.lastName||contact.role||contact.phone||contact.email||contact.notes})}
function pmosLocationContactsSummaryHtml(contacts){contacts=contacts||[];if(!contacts.length)return'';return '<div class="section-head"><h3>Service location contacts</h3></div><div>'+contacts.map(function(contact){var name=[contact.firstName,contact.lastName].filter(Boolean).join(' ')||contact.role||'Location contact',role=contact.role&&contact.role!==name?'<div class="location-contact-summary-meta">'+pmosLocationContactEsc(contact.role)+'</div>':'',phone=contact.phone?'<a href="tel:'+pmosLocationContactEsc(String(contact.phone).replace(/[^0-9+]/g,''))+'">'+pmosLocationContactEsc(contact.phone)+'</a>':'',email=contact.email?'<a href="mailto:'+pmosLocationContactEsc(contact.email)+'">'+pmosLocationContactEsc(contact.email)+'</a>':'',meta=[phone,email].filter(Boolean).join(' · '),notes=contact.notes?'<div class="location-contact-summary-meta">'+pmosLocationContactEsc(contact.notes)+'</div>':'';return '<div class="location-contact-summary"><div class="location-contact-summary-name">'+pmosLocationContactEsc(name)+'</div>'+role+(meta?'<div class="location-contact-summary-meta">'+meta+'</div>':'')+notes+'</div>'}).join('')+'</div>'}
`;
}

function pmosEnhanceAddServiceLocationWithContacts_(html) {
  let output = String(html || '');
  output = output.replace('</style>', pmosServiceLocationContactStyles_() + '\n</style>');
  output = output.replace(
    '<div class="section"><div class="section-head"><h3>Water Maintenance</h3>',
    '<div class="section"><div class="section-head"><h3>Service location contacts</h3></div><div class="grid"><div class="wide helper">Optional contacts for this property only. These do not replace or change the account contacts. Their Google Contacts use this service location address.</div><div id="serviceLocationContacts" class="wide location-contacts"></div><div class="wide"><button id="addServiceLocationContact" type="button" class="link">+ Add Service Location Contact</button></div></div></div><div class="section"><div class="section-head"><h3>Water Maintenance</h3>'
  );
  output = output.split('.createPmosAdditionalServiceLocationForAccount(')
    .join('.createPmosAdditionalServiceLocationForAccountWithLocationContacts(');
  output = output.replace(
    '</script></body></html>',
    pmosServiceLocationContactClientScript_() + String.raw`
var pmosBaseLocationShowAdd=showAdd;showAdd=function(){pmosBaseLocationShowAdd();pmosRenderLocationContacts('serviceLocationContacts',[])};
var pmosBaseLocationCollect=collect;collect=function(){var data=pmosBaseLocationCollect();data.serviceLocationContacts=pmosCollectLocationContacts('serviceLocationContacts');return data};
var pmosBaseLocationShowLocation=showLocation;showLocation=function(loc){pmosBaseLocationShowLocation(loc);if(!loc||!loc.customerId)return;google.script.run.withSuccessHandler(function(contacts){var card=document.getElementById('summaryCard');if(card&&contacts&&contacts.length)card.insertAdjacentHTML('beforeend',pmosLocationContactsSummaryHtml(contacts))}).getPmosServiceLocationContacts(loc.customerId)};
var pmosAddServiceLocationContactButton=document.getElementById('addServiceLocationContact');if(pmosAddServiceLocationContactButton)pmosAddServiceLocationContactButton.onclick=function(){pmosAddLocationContact('serviceLocationContacts',{})};
</script></body></html>`
  );
  return output;
}

function pmosEnhanceCustomerAccountEditorWithLocationContacts_(html) {
  let output = String(html || '');
  output = output.replace('</style>', pmosServiceLocationContactStyles_() + '\n</style>');
  output = output.replace(
    '<div class="section"><div class="section-head"><h3>Maintenance</h3>',
    '<div class="section"><div class="section-head"><h3>Service location contacts</h3></div><div class="grid"><div class="wide" style="color:#68747a;font-size:11px">Optional contacts attached only to this service location. Their Google Contacts use this location address.</div><div id="serviceLocationContactsEditor" class="wide location-contacts"></div></div><button id="addServiceLocationContactEditor" class="add-link" type="button">+ Add Service Location Contact</button></div><div class="section"><div class="section-head"><h3>Maintenance</h3>'
  );
  output = output.split('.savePmosCustomerAccountEditorData(')
    .join('.savePmosCustomerAccountEditorDataWithLocationContacts(');
  output = output.replace(
    '</script></body></html>',
    pmosServiceLocationContactClientScript_() + String.raw`
var pmosBaseAccountEditorFill=fill;fill=function(data){pmosBaseAccountEditorFill(data);pmosRenderLocationContacts('serviceLocationContactsEditor',data&&data.serviceLocationContacts||[])};
var pmosBaseAccountEditorPayload=payload;payload=function(){var data=pmosBaseAccountEditorPayload();data.serviceLocationContacts=pmosCollectLocationContacts('serviceLocationContactsEditor');return data};
var pmosAddServiceLocationContactEditor=document.getElementById('addServiceLocationContactEditor');if(pmosAddServiceLocationContactEditor)pmosAddServiceLocationContactEditor.onclick=function(){pmosAddLocationContact('serviceLocationContactsEditor',{})};
</script></body></html>`
  );
  return output;
}

function pmosEnhanceCustomerAccountLookupWithLocationContacts_(html) {
  let output = String(html || '');
  output = output.replace('</style>', pmosServiceLocationContactStyles_() + '\n</style>');
  output = output.replace(
    '</script></body></html>',
    pmosServiceLocationContactClientScript_() + String.raw`
var pmosBaseLocationContactsRenderProfile=renderProfile;renderProfile=function(profile){pmosBaseLocationContactsRenderProfile(profile);var contacts=profile&&profile.serviceLocationContacts||[];if(!contacts.length)return;var grid=el('content').querySelector('.contact-grid'),wrap=document.createElement('div');wrap.id='serviceLocationContactsProfile';wrap.innerHTML=pmosLocationContactsSummaryHtml(contacts);if(grid&&grid.parentNode)grid.parentNode.insertBefore(wrap,grid.nextSibling);else el('content').insertAdjacentElement('afterbegin',wrap)};
</script></body></html>`
  );
  return output;
}
