/**
 * Complete account/service-location lifecycle payloads for Sheets + Web.
 *
 * The spreadsheet remains authoritative. These adapters expose the existing account,
 * contact, Water Maintenance, equipment and contextual-note services as one coherent
 * profile/editor contract without creating a second customer model for the Web App.
 */

function pmosCustomerPrimaryAccountContact_(customerId) {
  const account = getPmosCustomerAccount_(customerId);
  let sourceId = String(account.primaryCustomerId || '').trim();
  if (!sourceId && account.locations && account.locations.length) {
    const primary = account.locations.filter(function(location) { return location.primary; })[0] || account.locations[0];
    sourceId = String(primary && primary.customerId || customerId).trim();
  }
  const record = getPmosCustomerEditorRow_(sourceId || customerId);
  const read = function(aliases) {
    const index = findHeaderIndex_(record.headers, aliases);
    return index >= 0 ? String(record.values[index] || '').trim() : '';
  };
  return {
    primary: true,
    firstName: read(['First Name']),
    lastName: read(['Last Name', 'Customer Name', 'Name', 'Customer']),
    role: 'Primary Account Contact',
    phone: read(['Primary Phone', 'Phone Number', 'Phone']),
    email: read(['Email', 'Email Address']),
    notes: '',
    resourceName: ''
  };
}

function pmosCustomerOrderedAccountContacts_(customerId) {
  const primary = pmosCustomerPrimaryAccountContact_(customerId);
  const additional = typeof getPmosAccountContacts_ === 'function'
    ? getPmosAccountContacts_(customerId) : [];
  return [primary].concat((additional || []).map(function(contact) {
    return Object.assign({primary: false}, contact || {});
  }));
}

function pmosCustomerLifecycleNotes_(customerId) {
  if (typeof getPmosCustomerContextNotes_ === 'function') {
    return getPmosCustomerContextNotes_(customerId);
  }
  const runtime = typeof pmosReadCategorizedNotesRuntime_ === 'function'
    ? pmosReadCategorizedNotesRuntime_(customerId)
    : {generalNotes: '', openingNotes: '', closingNotes: '', maintenanceNotes: ''};
  runtime.equipmentNotes = '';
  return runtime;
}

function pmosCustomerLifecycleStatus_(waterMaintenance) {
  const state = waterMaintenance || {};
  if (!state.enabled) return 'Not on Water Maintenance';
  return String(state.status || 'Active').trim() || 'Active';
}

function pmosAttachCustomerLifecycle_(profile, customerId) {
  const id = String(customerId || profile && profile.customerId || '').trim();
  const result = profile || {};
  const waterMaintenance = getPmosWaterMaintenanceEditorState_(id);
  const notes = pmosCustomerLifecycleNotes_(id);
  result.waterMaintenance = waterMaintenance;
  result.maintenanceStatus = pmosCustomerLifecycleStatus_(waterMaintenance);
  result.accountContacts = pmosCustomerOrderedAccountContacts_(id);
  result.additionalAccountContacts = result.accountContacts.filter(function(contact) { return !contact.primary; });
  result.serviceLocationContacts = typeof getPmosServiceLocationContacts_ === 'function'
    ? getPmosServiceLocationContacts_(id) : (result.serviceLocationContacts || []);
  result.accountBillingAddress = typeof getPmosAccountBillingAddress === 'function'
    ? getPmosAccountBillingAddress(id) : (result.accountBillingAddress || {enabled: false});
  result.generalNotes = notes.generalNotes || result.generalNotes || result.notes || '';
  result.notes = result.generalNotes;
  result.equipmentNotes = notes.equipmentNotes || '';
  result.maintenanceNotes = notes.maintenanceNotes || '';
  result.openingNotes = notes.openingNotes || '';
  result.closingNotes = notes.closingNotes || '';
  return typeof normalizePmosProfileEquipmentForContext_ === 'function'
    ? normalizePmosProfileEquipmentForContext_(result) : result;
}

function getPmosCustomerLifecycleProfile(customerId) {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('Customer ID is required.');
  const base = typeof getPmosCustomerAccountProfileRuntime === 'function'
    ? getPmosCustomerAccountProfileRuntime(id)
    : getPmosCustomerAccountProfile(id);
  return pmosAttachCustomerLifecycle_(base, id);
}

function getPmosCustomerLifecycleEditorData(customerId) {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('Customer ID is required.');
  const data = typeof getPmosCustomerAccountEditorDataRuntime === 'function'
    ? getPmosCustomerAccountEditorDataRuntime(id)
    : getPmosCustomerAccountEditorDataWithWaterMaintenance(id);
  data.accountContacts = typeof getPmosAccountContacts_ === 'function' ? getPmosAccountContacts_(id) : [];
  data.orderedAccountContacts = pmosCustomerOrderedAccountContacts_(id);
  data.serviceLocationContacts = typeof getPmosServiceLocationContacts_ === 'function' ? getPmosServiceLocationContacts_(id) : [];
  data.accountBillingAddress = typeof getPmosAccountBillingAddress === 'function'
    ? getPmosAccountBillingAddress(id) : {enabled: false};
  const notes = pmosCustomerLifecycleNotes_(id);
  data.generalNotes = notes.generalNotes || data.generalNotes || data.notes || '';
  data.notes = data.generalNotes;
  data.equipmentNotes = notes.equipmentNotes || '';
  data.maintenanceNotes = notes.maintenanceNotes || '';
  data.openingNotes = notes.openingNotes || '';
  data.closingNotes = notes.closingNotes || '';
  data.waterMaintenance = data.waterMaintenance || getPmosWaterMaintenanceEditorState_(id);
  return typeof normalizePmosProfileEquipmentForContext_ === 'function'
    ? normalizePmosProfileEquipmentForContext_(data) : data;
}

function savePmosCustomerLifecycleEditorData(input) {
  const request = Object.assign({}, input || {});
  const customerId = String(request.customerId || '').trim();
  if (!customerId) throw new Error('Customer ID is required.');
  const locationName = String(request.serviceLocationName || '').trim();
  if (!locationName) throw new Error('Service Location Name is required.');

  const beforeMaintenance = getPmosWaterMaintenanceEditorState_(customerId);
  if (!Object.prototype.hasOwnProperty.call(request, 'waterMaintenance')) {
    request.waterMaintenance = !!beforeMaintenance.enabled;
  }
  if (request.waterMaintenance === false && beforeMaintenance.enabled && request.maintenanceRemovalConfirmed !== true) {
    throw new Error('Confirm Water Maintenance removal before saving.');
  }

  const accountContacts = typeof normalizePmosAccountContacts_ === 'function'
    ? normalizePmosAccountContacts_(request.accountContacts || []) : [];
  request.accountContacts = accountContacts;

  let result = typeof savePmosCustomerAccountEditorDataRuntime === 'function'
    ? savePmosCustomerAccountEditorDataRuntime(request)
    : savePmosCustomerAccountEditorDataWithWaterMaintenance(request);
  const warnings = [];

  // Account-wide primary fields are already synchronized by the core account editor.
  // Preserve the exact ordered additional-contact list and mirror it to Google Contacts.
  try {
    const accountResult = syncPmosAccountContactsToGoogle_(customerId, accountContacts);
    result.accountContacts = accountResult.contacts || accountContacts;
    (accountResult.warnings || []).forEach(function(warning) { warnings.push(String(warning)); });
  } catch (error) {
    warnings.push('Customer changes were saved, but Account Contacts could not be synchronized: ' +
      String(error && error.message ? error.message : error));
  }

  if (request.equipmentNotes != null && typeof savePmosCustomerContextNotes_ === 'function') {
    try {
      savePmosCustomerContextNotes_(customerId, {
        generalNotes: request.generalNotes != null ? request.generalNotes : request.notes,
        equipmentNotes: request.equipmentNotes,
        maintenanceNotes: request.maintenanceNotes,
        openingNotes: request.openingNotes,
        closingNotes: request.closingNotes
      });
    } catch (error) {
      warnings.push('Customer changes were saved, but contextual notes could not be fully updated: ' +
        String(error && error.message ? error.message : error));
    }
  }

  if (result.contactStatus) warnings.push(String(result.contactStatus));
  if (result.contextNoteWarning) warnings.push(String(result.contextNoteWarning));
  result.warnings = (result.warnings || []).concat(warnings).filter(Boolean);
  result.profile = getPmosCustomerLifecycleProfile(customerId);
  result.waterMaintenance = getPmosWaterMaintenanceEditorState_(customerId);
  return result;
}

/** Web aliases kept deliberately thin so Web and Sheets share the same domain services. */
function getPmosWebCustomerLifecycleProfile(customerId) {
  return getPmosCustomerLifecycleProfile(customerId);
}

function getPmosWebCustomerLifecycleEditorData(customerId) {
  return getPmosCustomerLifecycleEditorData(customerId);
}

function savePmosWebCustomerLifecycleEditorData(input) {
  return savePmosCustomerLifecycleEditorData(input);
}

function pmosCustomerLifecycleProfileEnhancementScript_() {
  return String.raw`
(function(){
  if(window.__pmosCustomerLifecycleProfile)return;window.__pmosCustomerLifecycleProfile=true;
  function escLife(value){return String(value==null?'':value).replace(/[&<>\"]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]})}
  function contactHtml(contact){var name=[contact.firstName,contact.lastName].filter(Boolean).join(' ')||contact.role||'Contact',role=contact.primary?'Primary Account Contact':(contact.role||'');return '<div class="household-contact-card"><div><div class="household-contact-name">'+escLife(name)+'</div>'+(role?'<div class="result-meta">'+escLife(role)+'</div>':'')+'</div>'+(contact.phone?'<a href="tel:'+escLife(String(contact.phone).replace(/[^0-9+]/g,''))+'">'+escLife(contact.phone)+'</a>':'<span></span>')+(contact.email?'<a href="mailto:'+escLife(contact.email)+'">'+escLife(contact.email)+'</a>':'<span></span>')+'</div>'}
  var baseRender=typeof renderProfile==='function'?renderProfile:null;if(!baseRender)return;
  renderProfile=function(profile){baseRender(profile);profile=profile||{};var content=document.getElementById('content');if(!content)return;
    var existing=content.querySelector('[data-pmos-lifecycle-account-contacts]');if(existing)existing.remove();
    if(profile.accountContacts&&profile.accountContacts.length){var section=document.createElement('div');section.setAttribute('data-pmos-lifecycle-account-contacts','true');section.innerHTML='<div class="section-head"><h3>Account Contacts</h3></div><div class="household-contact-list">'+profile.accountContacts.map(contactHtml).join('')+'</div>';var firstHead=content.querySelector('.section-head');if(firstHead)content.insertBefore(section,firstHead);else content.insertBefore(section,content.firstChild)}
    var badge=document.getElementById('status');if(badge&&profile.maintenanceStatus)badge.textContent=profile.maintenanceStatus;
    if(profile.equipmentNotes){var notes=content.querySelector('.notes');if(notes&&!content.querySelector('[data-pmos-equipment-note]')){var cardNode=document.createElement('div');cardNode.className='card';cardNode.setAttribute('data-pmos-equipment-note','true');cardNode.innerHTML='<div class="label">Equipment Notes</div><div class="value">'+escLife(profile.equipmentNotes)+'</div>';notes.appendChild(cardNode)}}
  };
})();
`;
}
