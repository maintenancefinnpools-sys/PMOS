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

function pmosCustomerLifecycleVisibleNotes_(stored, fallback) {
  const source = stored || {};
  const prior = fallback || {};
  const values = {
    generalNotes: source.generalNotes || prior.generalNotes || prior.notes || '',
    equipmentNotes: source.equipmentNotes || prior.equipmentNotes || '',
    maintenanceNotes: source.maintenanceNotes || prior.maintenanceNotes || '',
    openingNotes: source.openingNotes || prior.openingNotes || '',
    closingNotes: source.closingNotes || prior.closingNotes || ''
  };
  return typeof normalizePmosStoredContextNotes_ === 'function'
    ? normalizePmosStoredContextNotes_(values) : values;
}

function pmosAttachCustomerLifecycle_(profile, customerId) {
  const id = String(customerId || profile && profile.customerId || '').trim();
  const result = profile || {};
  if (result._pmosLifecycleComplete === true) {
    return typeof normalizePmosProfileEquipmentForContext_ === 'function'
      ? normalizePmosProfileEquipmentForContext_(result) : result;
  }
  const waterMaintenance = getPmosWaterMaintenanceEditorState_(id);
  const notes = pmosCustomerLifecycleVisibleNotes_(pmosCustomerLifecycleNotes_(id), result);
  result.waterMaintenance = waterMaintenance;
  result.maintenanceStatus = pmosCustomerLifecycleStatus_(waterMaintenance);
  result.accountContacts = pmosCustomerOrderedAccountContacts_(id);
  result.additionalAccountContacts = result.accountContacts.filter(function(contact) { return !contact.primary; });
  result.serviceLocationContacts = typeof getPmosServiceLocationContacts_ === 'function'
    ? getPmosServiceLocationContacts_(id) : (result.serviceLocationContacts || []);
  result.accountBillingAddress = typeof getPmosAccountBillingAddress === 'function'
    ? getPmosAccountBillingAddress(id) : (result.accountBillingAddress || {enabled: false});
  result.generalNotes = notes.generalNotes;
  result.notes = result.generalNotes;
  result.equipmentNotes = notes.equipmentNotes;
  result.maintenanceNotes = notes.maintenanceNotes;
  result.openingNotes = notes.openingNotes;
  result.closingNotes = notes.closingNotes;
  result._pmosLifecycleComplete = true;
  return typeof normalizePmosProfileEquipmentForContext_ === 'function'
    ? normalizePmosProfileEquipmentForContext_(result) : result;
}

function pmosAttachCustomerLifecycleEditorData_(data, customerId) {
  const result = data || {};
  const id = String(customerId || result.customerId || '').trim();
  if (result._pmosLifecycleComplete === true) {
    return typeof normalizePmosProfileEquipmentForContext_ === 'function'
      ? normalizePmosProfileEquipmentForContext_(result) : result;
  }
  result.accountContacts = typeof getPmosAccountContacts_ === 'function' ? getPmosAccountContacts_(id) : [];
  result.orderedAccountContacts = [{
    primary: true,
    firstName: String(result.firstName || '').trim(),
    lastName: String(result.lastName || '').trim(),
    role: 'Primary Account Contact',
    phone: String(result.phone || '').trim(),
    email: String(result.email || '').trim(),
    notes: '',
    resourceName: ''
  }].concat(result.accountContacts.map(function(contact) {
    return Object.assign({primary: false}, contact || {});
  }));
  result.serviceLocationContacts = typeof getPmosServiceLocationContacts_ === 'function'
    ? getPmosServiceLocationContacts_(id) : (result.serviceLocationContacts || []);
  result.accountBillingAddress = typeof getPmosAccountBillingAddress === 'function'
    ? getPmosAccountBillingAddress(id) : (result.accountBillingAddress || {enabled: false});
  const notes = pmosCustomerLifecycleVisibleNotes_(pmosCustomerLifecycleNotes_(id), result);
  result.generalNotes = notes.generalNotes;
  result.notes = result.generalNotes;
  result.equipmentNotes = notes.equipmentNotes;
  result.maintenanceNotes = notes.maintenanceNotes;
  result.openingNotes = notes.openingNotes;
  result.closingNotes = notes.closingNotes;
  result.waterMaintenance = result.waterMaintenance || getPmosWaterMaintenanceEditorState_(id);
  result._pmosLifecycleComplete = true;
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
  // Build the editor snapshot once. The older compatibility chain repeatedly
  // re-read Customers, Routes, contacts, billing and notes before returning the
  // same values, which made a cold Web App load prone to the 45-second timeout.
  const data = getPmosCustomerAccountEditorData(id);
  data.serviceLocationName = String(data.serviceLocationName || data.locationName || data.calendarTitle || '').trim();
  data.locationName = data.serviceLocationName;
  const routes = Array.isArray(data.routes) ? data.routes : [];
  const frequency = String(data.frequency || '').trim();
  data.waterMaintenance = {
    enabled: routes.length > 0 || /^(weekly|twice weekly|bi-?weekly|monthly)$/i.test(frequency),
    routeCount: routes.length,
    layers: routes.map(function(route) { return String(route.layer || '').trim(); }).filter(function(layer, index, all) { return layer && all.indexOf(layer) === index; }),
    status: String(data.status || 'Active').trim() || 'Active',
    frequency: frequency,
    serviceStartDate: String(data.serviceStartDate || '').trim(),
    yearRound: /yes|year round/i.test(String(data.yearRound || '')) ? 'Year Round' : 'Seasonal'
  };
  data.accountContacts = typeof getPmosAccountContacts_ === 'function' ? getPmosAccountContacts_(id) : [];
  data.orderedAccountContacts = [{
    primary: true,
    firstName: String(data.firstName || '').trim(),
    lastName: String(data.lastName || '').trim(),
    role: 'Primary Account Contact',
    phone: String(data.phone || '').trim(),
    email: String(data.email || '').trim(),
    notes: '',
    resourceName: ''
  }].concat(data.accountContacts.map(function(contact) { return Object.assign({primary: false}, contact || {}); }));
  const notes = pmosCustomerLifecycleVisibleNotes_(data, {});
  data.generalNotes = notes.generalNotes;
  data.notes = notes.generalNotes;
  data.equipmentNotes = notes.equipmentNotes;
  data.maintenanceNotes = notes.maintenanceNotes;
  data.openingNotes = notes.openingNotes;
  data.closingNotes = notes.closingNotes;
  data._pmosLifecycleComplete = true;
  return typeof normalizePmosProfileEquipmentForContext_ === 'function'
    ? normalizePmosProfileEquipmentForContext_(data) : data;
}

function savePmosCustomerLifecycleEditorData(input) {
  const request = Object.assign({}, input || {});
  const customerId = String(request.customerId || '').trim();
  if (!customerId) throw new Error('Customer ID is required.');
  const locationName = String(request.serviceLocationName || '').trim();
  if (!locationName) throw new Error('Service Location Name is required.');

  // Keep Calendar identity one-way: renaming a Service Location updates the
  // Calendar title unless the user supplied a different title in this save.
  // Editing Calendar Title never writes back to Service Location Name.
  const identityRecord = getPmosCustomerEditorRow_(customerId);
  const priorLocationIndex = findHeaderIndex_(identityRecord.headers, ['Service Location Name']);
  const priorCalendarIndex = findHeaderIndex_(identityRecord.headers, ['Calendar Title']);
  const priorLocationName = priorLocationIndex >= 0 ? String(identityRecord.values[priorLocationIndex] || '').trim() : '';
  const priorCalendarTitle = priorCalendarIndex >= 0 ? String(identityRecord.values[priorCalendarIndex] || '').trim() : '';
  if (locationName !== priorLocationName && (!String(request.calendarTitle || '').trim() || String(request.calendarTitle || '').trim() === priorCalendarTitle)) {
    request.calendarTitle = locationName;
  }

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
  const priorAccountContacts = typeof getPmosAccountContacts_ === 'function'
    ? getPmosAccountContacts_(customerId) : [];
  request._pmosFastLifecycle = true;
  request._pmosSkipResultProfile = true;

  let result = typeof savePmosCustomerAccountEditorDataRuntime === 'function'
    ? savePmosCustomerAccountEditorDataRuntime(request)
    : savePmosCustomerAccountEditorDataWithWaterMaintenance(request);
  const warnings = [];

  // Account-wide primary fields are already synchronized by the core account editor.
  // Preserve the exact ordered additional-contact list and mirror it to Google Contacts.
  if (JSON.stringify(priorAccountContacts) !== JSON.stringify(accountContacts)) {
    try {
      const accountResult = syncPmosAccountContactsToGoogle_(customerId, accountContacts);
      result.accountContacts = accountResult.contacts || accountContacts;
      (accountResult.warnings || []).forEach(function(warning) { warnings.push(String(warning)); });
    } catch (error) {
      warnings.push('Customer changes were saved, but Account Contacts could not be synchronized: ' +
        String(error && error.message ? error.message : error));
    }
  } else {
    result.accountContacts = priorAccountContacts;
  }

  if (request.equipmentNotes != null && typeof savePmosCustomerContextNotes_ === 'function') {
    try {
      const requestedNotes = {
        generalNotes: request.generalNotes != null ? request.generalNotes : request.notes,
        equipmentNotes: request.equipmentNotes,
        maintenanceNotes: request.maintenanceNotes,
        openingNotes: request.openingNotes,
        closingNotes: request.closingNotes
      };
      const priorNotes = pmosCustomerLifecycleVisibleNotes_(pmosCustomerLifecycleNotes_(customerId), {});
      const normalizedRequestedNotes = pmosCustomerLifecycleVisibleNotes_(requestedNotes, {});
      if (JSON.stringify(priorNotes) !== JSON.stringify(normalizedRequestedNotes)) {
        savePmosCustomerContextNotes_(customerId, requestedNotes);
      }
    } catch (error) {
      warnings.push('Customer changes were saved, but contextual notes could not be fully updated: ' +
        String(error && error.message ? error.message : error));
    }
  }

  if (result.contactStatus) warnings.push(String(result.contactStatus));
  if (result.contextNoteWarning) warnings.push(String(result.contextNoteWarning));
  result.warnings = (result.warnings || []).concat(warnings).filter(Boolean);
  result.verified = true;
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
  function contactKey(contact){var email=String(contact.email||'').trim().toLowerCase(),phone=String(contact.phone||'').replace(/\D/g,''),name=[contact.firstName,contact.lastName].join(' ').toLowerCase().replace(/\s+/g,' ').trim();return email?'e:'+email:phone?'p:'+phone:'n:'+name}
  function contactHtml(contact,kind){var name=[contact.firstName,contact.lastName].filter(Boolean).join(' ')||contact.role||'Contact',role=contact.role&&!contact.primary?contact.role:'',badge=contact.primary?'Primary Contact':kind,colors=contact.primary?'background:#dcefdc;color:#356443;border-color:#b8d8bd':kind==='Service Location Contact'?'background:#f3ead2;color:#6f5718;border-color:#dfce9f':'background:#d9edf6;color:#0f5470;border-color:#a9d3e4',notes=String(contact.notes||'').trim(),summary='<summary class="household-contact-card" style="position:relative;list-style:none;padding-right:'+(notes?'38px':'13px')+'"><div><div class="household-contact-name">'+escLife(name)+' <span style="display:inline-block;margin-left:5px;padding:2px 5px;border:1px solid;border-radius:999px;font-size:8px;font-weight:900;vertical-align:middle;'+colors+'">'+escLife(badge)+'</span></div>'+(role?'<div class="result-meta">'+escLife(role)+'</div>':'')+'</div>'+(contact.phone?'<a href="tel:'+escLife(String(contact.phone).replace(/[^0-9+]/g,''))+'">'+escLife(contact.phone)+'</a>':'<span></span>')+(contact.email?'<a href="mailto:'+escLife(contact.email)+'">'+escLife(contact.email)+'</a>':'<span></span>')+(notes?'<span style="position:absolute;right:14px;top:13px;color:#0f5470;font-weight:900">⌄</span>':'')+'</summary>';return '<details style="background:#f9fafb;border:1px solid #d2dade;border-radius:9px;overflow:hidden">'+summary+(notes?'<div style="padding:10px 13px;border-top:1px solid #d2dade;background:#fff;white-space:pre-wrap"><div class="label">Contact Notes</div>'+escLife(notes)+'</div>':'')+'</details>'}
  function contactSections(profile){var account=Array.isArray(profile.accountContacts)?profile.accountContacts:[],local=Array.isArray(profile.serviceLocationContacts)?profile.serviceLocationContacts:[],primary=account.filter(function(contact,index){return contact.primary||index===0})[0]||null,primaryKey=primary?contactKey(primary):'',seen={},cards=[];if(primary){seen[primaryKey||'primary']=true;cards.push(contactHtml(primary,'Primary Contact'))}account.forEach(function(contact,index){if(contact===primary||contact.primary||index===0)return;var key=contactKey(contact);if(key&&key!==primaryKey&&!seen[key]){seen[key]=true;cards.push(contactHtml(contact,'Account Contact'))}});local.forEach(function(contact){var key=contactKey(contact);if(key&&key!==primaryKey&&!seen[key]){seen[key]=true;cards.push(contactHtml(contact,'Service Location Contact'))}});return cards.length?'<div data-pmos-contacts><div class="section-head"><h3>Contacts</h3></div><div class="household-contact-list">'+cards.join('')+'</div></div>':''}
  function noteCard(label,value){return value?'<div class="card pmos-lifecycle-note"><div class="label">'+escLife(label)+'</div><div style="white-space:pre-wrap">'+escLife(value)+'</div></div>':''}
  function findHead(content,text){return Array.prototype.filter.call(content.querySelectorAll('.section-head h3'),function(head){return String(head.textContent||'').toLowerCase().indexOf(text)>=0})[0]}
  var baseRender=typeof renderProfile==='function'?renderProfile:null;if(!baseRender)return;
  renderProfile=function(profile){baseRender(profile);profile=profile||{};var content=document.getElementById('content');if(!content)return;
    Array.prototype.forEach.call(content.querySelectorAll('[data-pmos-lifecycle-account-contacts],[data-pmos-contacts],#serviceLocationContactsProfile'),function(node){node.remove()});
    var contacts=contactSections(profile);if(contacts){var section=document.createElement('div');section.setAttribute('data-pmos-lifecycle-account-contacts','true');section.innerHTML=contacts;var firstHead=content.querySelector('.section-head');if(firstHead)content.insertBefore(section,firstHead);else content.insertBefore(section,content.firstChild)}
    Array.prototype.forEach.call(content.querySelectorAll('[data-pmos-lifecycle-context-note]'),function(node){node.remove()});
    var maintenanceHead=findHead(content,'maintenance'),equipmentHead=findHead(content,'bodies of water');
    if(profile.maintenanceNotes&&maintenanceHead){var maintenanceNote=document.createElement('div');maintenanceNote.setAttribute('data-pmos-lifecycle-context-note','true');maintenanceNote.innerHTML=noteCard('Maintenance Notes',profile.maintenanceNotes);maintenanceHead.parentNode.insertAdjacentElement('afterend',maintenanceNote)}
    if(profile.equipmentNotes&&equipmentHead){var equipmentNote=document.createElement('div');equipmentNote.setAttribute('data-pmos-lifecycle-context-note','true');equipmentNote.innerHTML=noteCard('Equipment Notes',profile.equipmentNotes);equipmentHead.parentNode.insertAdjacentElement('afterend',equipmentNote)}
    var badge=document.getElementById('status');if(badge&&profile.maintenanceStatus)badge.textContent=profile.maintenanceStatus;
  };
})();
`;
}
