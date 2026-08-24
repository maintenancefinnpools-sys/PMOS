/**
 * Customer Account contact-address semantics.
 *
 * The account holder uses the primary service-location address in Google Contacts by
 * default. An optional account billing address overrides that address without changing
 * any service-location address. Billing data is stored account-wide.
 */
const PMOS_ACCOUNT_BILLING_ADDRESS_HEADER_ = 'Account Billing Address JSON';

function normalizePmosAccountBillingAddress_(input) {
  const source = input || {};
  const enabled = source.enabled === true || /^(true|yes|on)$/i.test(String(source.enabled || '').trim());
  const clean = {
    enabled: enabled,
    addressLine1: String(source.addressLine1 || source.street || '').trim().slice(0, 220),
    addressLine2: String(source.addressLine2 || '').trim().slice(0, 220),
    city: String(source.city || '').trim().slice(0, 120),
    province: String(source.province || source.state || '').trim().slice(0, 120),
    postalCode: String(source.postalCode || source.zip || '').trim().slice(0, 40),
    country: String(source.country || 'Canada').trim().slice(0, 120)
  };
  if (clean.enabled && (!clean.addressLine1 || !clean.city || !clean.province || !clean.postalCode || !clean.country)) {
    throw new Error('Complete the account holder billing address, including address, city, province/state, postal/ZIP code, and country.');
  }
  return clean;
}

function ensurePmosAccountBillingAddressTable_() {
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [
    PMOS.CUSTOMERS_SHEET, 'Customers', 'Customer Database', 'Customer List'
  ]);
  if (!sheet) throw new Error('Customers sheet was not found.');
  let table = readPmosHeaderTable_(sheet);
  ensureMaintenanceClientHeaders_(sheet, table, [PMOS_ACCOUNT_BILLING_ADDRESS_HEADER_]);
  table = readPmosHeaderTable_(sheet);
  return {sheet: sheet, table: table};
}

function formatPmosAccountBillingAddress_(billing) {
  const value = normalizePmosAccountBillingAddress_(billing || {});
  if (!value.enabled) return '';
  const street = [value.addressLine1, value.addressLine2].filter(Boolean).join(', ');
  return [street, value.city, value.province, value.postalCode, value.country].filter(Boolean).join(', ');
}

function getPmosAccountBillingAddress_(customerId) {
  const account = getPmosCustomerAccount_(customerId);
  const source = ensurePmosAccountBillingAddressTable_();
  const idIndex = findHeaderIndex_(source.table.headers, ['Customer ID']);
  const accountIndex = findHeaderIndex_(source.table.headers, ['Account ID']);
  const billingIndex = findHeaderIndex_(source.table.headers, [PMOS_ACCOUNT_BILLING_ADDRESS_HEADER_]);
  if (idIndex < 0 || billingIndex < 0) return normalizePmosAccountBillingAddress_({enabled: false});
  let raw = '';
  source.table.rows.some(function(row) {
    const rowAccountId = accountIndex >= 0 ? String(row[accountIndex] || row[idIndex] || '').trim() : String(row[idIndex] || '').trim();
    if (rowAccountId !== account.accountId) return false;
    const candidate = String(row[billingIndex] || '').trim();
    if (!candidate) return false;
    raw = candidate;
    return true;
  });
  if (!raw) return normalizePmosAccountBillingAddress_({enabled: false});
  try {
    return normalizePmosAccountBillingAddress_(JSON.parse(raw));
  } catch (error) {
    throw new Error('The account billing address could not be read.');
  }
}

function getPmosAccountBillingAddress(customerId) {
  return getPmosAccountBillingAddress_(customerId);
}

function savePmosAccountBillingAddress_(customerId, input) {
  const billing = normalizePmosAccountBillingAddress_(input);
  const account = getPmosCustomerAccount_(customerId);
  const source = ensurePmosAccountBillingAddressTable_();
  const idIndex = findHeaderIndex_(source.table.headers, ['Customer ID']);
  const accountIndex = findHeaderIndex_(source.table.headers, ['Account ID']);
  const billingIndex = findHeaderIndex_(source.table.headers, [PMOS_ACCOUNT_BILLING_ADDRESS_HEADER_]);
  if (idIndex < 0 || billingIndex < 0) throw new Error('Customers is missing account billing address storage.');
  const serialized = billing.enabled ? JSON.stringify(billing) : '';
  source.table.rows.forEach(function(row, index) {
    const rowAccountId = accountIndex >= 0 ? String(row[accountIndex] || row[idIndex] || '').trim() : String(row[idIndex] || '').trim();
    if (rowAccountId !== account.accountId) return;
    source.sheet.getRange(source.table.headerRow + index + 1, billingIndex + 1).setValue(serialized);
  });
  SpreadsheetApp.flush();
  return billing;
}

function getPmosAccountPrimaryCustomerId_(customerId) {
  const account = getPmosCustomerAccount_(customerId);
  const primary = account.locations.filter(function(location) { return location.primary; })[0] || account.locations[0];
  if (!primary) throw new Error('The customer account has no primary service location.');
  return primary.customerId;
}

function getPmosAccountHolderGoogleAddress_(customerId) {
  const billing = getPmosAccountBillingAddress_(customerId);
  if (billing.enabled) return formatPmosAccountBillingAddress_(billing);
  const account = getPmosCustomerAccount_(customerId);
  const primary = account.locations.filter(function(location) { return location.primary; })[0] || account.locations[0];
  return primary ? String(primary.address || '').trim() : '';
}

function getPmosAccountHolderContactRecord_(customerId, ensureWritable) {
  const primaryId = getPmosAccountPrimaryCustomerId_(customerId);
  const record = getPmosCustomerContactRecord_(primaryId, ensureWritable === true);
  record.address = getPmosAccountHolderGoogleAddress_(customerId);
  return record;
}

function getPmosGoogleContactStateForAccount_(customerId) {
  const primaryId = getPmosAccountPrimaryCustomerId_(customerId);
  const customer = getPmosAccountHolderContactRecord_(customerId, false);
  if (!customer.resourceNames || !customer.resourceNames.length) {
    return getPmosGoogleContactState(primaryId);
  }
  const people = [];
  const broken = [];
  customer.resourceNames.forEach(function(resourceName) {
    try {
      people.push(People.People.get(resourceName, {personFields: PMOS_CONTACT_FIELDS_}));
    } catch (error) {
      broken.push(resourceName);
    }
  });
  if (!people.length) return getPmosGoogleContactState(primaryId);
  return buildPmosGoogleHouseholdContactState_(customer, people, broken);
}

function linkPmosCustomerGoogleContactForAccount(customerId, resourceName) {
  const primaryId = getPmosAccountPrimaryCustomerId_(customerId);
  const result = linkPmosCustomerGoogleContact(primaryId, resourceName);
  syncPmosAccountSharedCustomerFields_(primaryId);
  syncPmosAccountHolderGoogleAddress_(customerId);
  return getPmosGoogleContactStateForAccount_(customerId) || result;
}

function createPmosGoogleContactForAccount(customerId) {
  const primaryId = getPmosAccountPrimaryCustomerId_(customerId);
  const customer = getPmosAccountHolderContactRecord_(customerId, true);
  const created = People.People.createContact(buildPmosGooglePerson_(customer, null), {personFields: PMOS_CONTACT_FIELDS_});
  writePmosGoogleContactLinks_(customer, [created]);
  syncPmosAccountSharedCustomerFields_(primaryId);
  return getPmosGoogleContactStateForAccount_(customerId);
}

function previewPmosGoogleContactAccountSyncWithAddress_(customerId, direction) {
  const customer = getPmosAccountHolderContactRecord_(customerId, false);
  if (!customer.resourceNames || !customer.resourceNames.length) throw new Error('No Google Contact is linked to this account.');
  const resourceName = customer.resourceNames[0];
  const person = People.People.get(resourceName, {personFields: PMOS_CONTACT_FIELDS_});
  const state = buildPmosGoogleContactState_(customer, person, 'LINKED');
  const action = String(direction || '').toUpperCase();
  state.direction = action;
  state.customerId = String(customerId || '').trim();
  state.resourceName = resourceName;
  state.summary = action === 'PULL'
    ? 'Pull linked Google Contact details into the account contact fields. Service-location addresses will not be changed.'
    : 'Push PMOS account contact details to Google Contacts using the account holder address shown in PMOS.';
  return state;
}

function restorePmosPrimaryPropertyAfterGooglePull_(primaryId, beforeValues) {
  const record = getPmosCustomerEditorRow_(primaryId);
  const after = record.values.slice();
  const merged = beforeValues.slice();
  const accountFieldGroups = [
    ['First Name'],
    ['Last Name', 'Customer Name', 'Name', 'Customer'],
    ['Full Name(s)', 'Full Name'],
    ['Primary Phone', 'Phone Number', 'Phone'],
    ['Email', 'Email Address'],
    ['Customer Notes', 'Notes', 'Details'],
    ['Google Contact Resource Names'],
    ['Google Contact Resource Name'],
    ['Google Contact ETag'],
    ['Google Contact Last Synced']
  ];
  accountFieldGroups.forEach(function(aliases) {
    const sourceIndex = findHeaderIndex_(record.headers, aliases);
    if (sourceIndex < 0) return;
    pmosCustomerEditorSetAliases_(record.headers, merged, aliases, after[sourceIndex]);
  });
  record.sheet.getRange(record.rowNumber, 1, 1, merged.length).setValues([merged]);
  SpreadsheetApp.flush();
}

function applyPmosGoogleContactAccountSyncWithAddress_(customerId, direction, resourceName) {
  const primaryId = getPmosAccountPrimaryCustomerId_(customerId);
  const action = String(direction || '').toUpperCase();
  const customer = getPmosAccountHolderContactRecord_(customerId, true);
  const target = String(resourceName || (customer.resourceNames && customer.resourceNames[0]) || '').trim();
  if (!target) throw new Error('No Google Contact is linked to this account.');
  if (action === 'PULL') {
    const before = getPmosCustomerEditorRow_(primaryId).values.slice();
    applyPmosGoogleContactSync(primaryId, 'PULL', target);
    restorePmosPrimaryPropertyAfterGooglePull_(primaryId, before);
    syncPmosAccountSharedCustomerFields_(primaryId);
    return getPmosGoogleContactStateForAccount_(customerId);
  }
  if (action !== 'PUSH') throw new Error('Google Contact sync direction must be PUSH or PULL.');
  const latest = People.People.get(target, {personFields: PMOS_CONTACT_FIELDS_});
  const update = buildPmosGooglePerson_(customer, latest);
  update.resourceName = latest.resourceName;
  update.etag = latest.etag;
  update.metadata = latest.metadata;
  People.People.updateContact(update, target, {
    updatePersonFields: 'names,emailAddresses,phoneNumbers,addresses,biographies,externalIds',
    personFields: PMOS_CONTACT_FIELDS_
  });
  writePmosGoogleContactLinks_(customer, [People.People.get(target, {personFields: PMOS_CONTACT_FIELDS_})]);
  syncPmosAccountSharedCustomerFields_(primaryId);
  return getPmosGoogleContactStateForAccount_(customerId);
}

function unlinkPmosCustomerGoogleContactForAccount(customerId) {
  const primaryId = getPmosAccountPrimaryCustomerId_(customerId);
  const result = unlinkPmosCustomerGoogleContact(primaryId);
  syncPmosAccountSharedCustomerFields_(primaryId);
  return getPmosGoogleContactStateForAccount_(customerId) || result;
}

function unlinkPmosCustomerGoogleContactPersonForAccount(customerId, resourceName) {
  const primaryId = getPmosAccountPrimaryCustomerId_(customerId);
  const result = unlinkPmosCustomerGoogleContactPerson(primaryId, resourceName);
  syncPmosAccountSharedCustomerFields_(primaryId);
  return getPmosGoogleContactStateForAccount_(customerId) || result;
}

function syncPmosAccountHolderGoogleAddress_(customerId) {
  const primaryId = getPmosAccountPrimaryCustomerId_(customerId);
  const customer = getPmosAccountHolderContactRecord_(customerId, false);
  if (!customer.resourceNames || !customer.resourceNames.length) return {updated: false};
  let target = customer.resourceNames[0];
  try {
    const people = customer.resourceNames.map(function(resourceName) {
      try { return People.People.get(resourceName, {personFields: PMOS_CONTACT_FIELDS_}); }
      catch (ignored) { return null; }
    }).filter(Boolean);
    if (typeof findPmosCustomerEditorPrimaryContact_ === 'function' && people.length) {
      const normalized = people.map(normalizePmosGooglePerson_);
      const primary = findPmosCustomerEditorPrimaryContact_(customer, normalized);
      if (primary && primary.resourceName) target = primary.resourceName;
    }
    const latest = People.People.get(target, {personFields: PMOS_CONTACT_FIELDS_});
    const update = {
      resourceName: latest.resourceName,
      etag: latest.etag,
      metadata: latest.metadata,
      addresses: customer.address ? [{formattedValue: customer.address, type: 'home'}] : []
    };
    People.People.updateContact(update, target, {updatePersonFields: 'addresses', personFields: PMOS_CONTACT_FIELDS_});
    syncPmosAccountSharedCustomerFields_(primaryId);
    return {updated: true, resourceName: target, address: customer.address};
  } catch (error) {
    return {updated: false, error: String(error && error.message ? error.message : error)};
  }
}

function createPmosAdditionalServiceLocationForAccountWithLocationContactsAndBilling(input) {
  const request = input || {};
  const hasBilling = Object.prototype.hasOwnProperty.call(request, 'accountBillingAddress');
  const billing = hasBilling ? normalizePmosAccountBillingAddress_(request.accountBillingAddress) : null;
  const result = createPmosAdditionalServiceLocationForAccountWithLocationContacts(request);
  const billingToSave = hasBilling ? billing : getPmosAccountBillingAddress_(result.customerId);
  savePmosAccountBillingAddress_(result.customerId, billingToSave);
  const sync = syncPmosAccountHolderGoogleAddress_(result.customerId);
  if (sync.error) result.contactStatus = [result.contactStatus, 'Account holder Google Contact address could not be updated: ' + sync.error].filter(Boolean).join(' · ');
  result.accountBillingAddress = getPmosAccountBillingAddress_(result.customerId);
  result.profile = getPmosCustomerAccountProfile(result.customerId);
  return result;
}

function savePmosCustomerAccountEditorDataWithLocationContactsAndBilling(input) {
  const request = input || {};
  const hasBilling = Object.prototype.hasOwnProperty.call(request, 'accountBillingAddress');
  const billing = hasBilling ? normalizePmosAccountBillingAddress_(request.accountBillingAddress) : null;
  const result = savePmosCustomerAccountEditorDataWithLocationContacts(request);
  if (hasBilling) savePmosAccountBillingAddress_(result.customerId, billing);
  const sync = syncPmosAccountHolderGoogleAddress_(result.customerId);
  if (sync.error) result.contactStatus = [result.contactStatus, 'Account holder Google Contact address could not be updated: ' + sync.error].filter(Boolean).join(' · ');
  result.accountBillingAddress = getPmosAccountBillingAddress_(result.customerId);
  result.profile = getPmosCustomerAccountProfile(result.customerId);
  return result;
}

function pmosAccountBillingAddressStyles_() {
  return '.billing-link{padding:0;border:0;background:transparent;color:#0f5470;font:inherit;font-size:12px;font-weight:900;cursor:pointer}.billing-intro{margin:5px 0 0;color:#6f7d84;font-size:12px;line-height:1.45}.billing-panel{display:none;margin-top:10px;padding:12px;border:1px solid #cfdce2;border-radius:9px;background:#f7fafb}.billing-panel.open{display:block}.billing-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.billing-grid .wide{grid-column:1/-1}.billing-address-wrap{position:relative}.billing-address-list{display:none;position:absolute;z-index:70;top:calc(100% + 2px);left:0;right:0;max-height:240px;overflow:auto;border:1px solid #aebdc5;border-radius:8px;background:#fff;box-shadow:0 12px 28px rgba(41,57,68,.18)}.billing-address-option{display:block;width:100%;padding:10px 12px;border:0;border-bottom:1px solid #dce5e8;background:#fff;color:#293944;text-align:left;cursor:pointer}.billing-address-option:hover{background:#eef7fb}.billing-address-hint{display:block;min-height:15px;margin-top:5px;color:#6f7d84;font-size:11px;font-weight:600;letter-spacing:0;text-transform:none}.billing-address-confirmed{display:none;margin-top:8px;padding:9px 11px;border:1px solid #b9dbc6;border-left:4px solid #63b989;border-radius:8px;background:#edf7f1;color:#286344;font-size:12px;line-height:1.45}.billing-help{margin:8px 0 0;color:#6f7d84;font-size:11px;line-height:1.45}@media(max-width:760px){.billing-grid{grid-template-columns:1fr}.billing-grid .wide{grid-column:auto}}';
}

function pmosAccountBillingAddressClientScript_() {
  return String.raw`
var PMOS_BILLING_ADDRESS_STATES=window.PMOS_BILLING_ADDRESS_STATES||{};window.PMOS_BILLING_ADDRESS_STATES=PMOS_BILLING_ADDRESS_STATES;
function pmosBillingPanelHtml(prefix){return '<button id="'+prefix+'Toggle" type="button" class="billing-link">+ Add account holder billing address</button><div class="billing-intro">The primary account holder uses the primary service-location address in Google Contacts unless an Account Billing Address is supplied.</div><div id="'+prefix+'Panel" class="billing-panel"><div class="billing-grid"><div class="field wide"><label>Billing address</label><div class="billing-address-wrap"><input data-billing="addressLine1" autocomplete="off" placeholder="Begin typing address"><div class="billing-address-list" data-billing-address-list></div></div><span class="billing-address-hint" data-billing-address-hint></span><div class="billing-address-confirmed" data-billing-address-confirmed></div></div><div class="field wide"><label>Address line 2 <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label><input data-billing="addressLine2"></div><div class="field"><label>City</label><input data-billing="city"></div><div class="field"><label>Province / State</label><input data-billing="province"></div><div class="field"><label>Postal / ZIP code</label><input data-billing="postalCode"></div><div class="field"><label>Country</label><input data-billing="country" value="Canada"></div></div><div class="billing-help">Select and confirm the billing address so PMOS can autofill the complete postal address.</div><button id="'+prefix+'Clear" type="button" class="billing-link" style="margin-top:9px">Use primary service location instead</button></div>'}
function pmosBillingRunner(name,args,success,failure){var runner=google.script.run.withSuccessHandler(success).withFailureHandler(failure),values=args||[];if(values.length>1)runner[name](values[0],values[1]);else runner[name](values[0])}
function pmosBillingEscape(value){return String(value==null?'':value).replace(/[&<>\"]/g,function(character){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[character]})}
function pmosBillingState(prefix){return PMOS_BILLING_ADDRESS_STATES[prefix]||(PMOS_BILLING_ADDRESS_STATES[prefix]={selected:null,timer:null,request:0})}
function pmosBillingSetHint(panel,text){var hint=panel&&panel.querySelector('[data-billing-address-hint]');if(hint)hint.textContent=text||''}
function pmosBillingHideList(panel){var list=panel&&panel.querySelector('[data-billing-address-list]');if(list){list.style.display='none';list.innerHTML=''}}
function pmosBillingConfirm(prefix,item){var panel=document.getElementById(prefix+'Panel'),state=pmosBillingState(prefix);if(!panel)return;pmosBillingHideList(panel);pmosBillingSetHint(panel,'Confirming selected billing address…');pmosBillingRunner('confirmPmosSelectedAddress',[item],function(resolved){resolved=resolved||{};state.selected=resolved;var values={addressLine1:resolved.street||resolved.addressLine1||resolved.address||'',city:resolved.city||'',province:resolved.province||'',postalCode:resolved.postalCode||'',country:resolved.country||'Canada'};Object.keys(values).forEach(function(key){var input=panel.querySelector('[data-billing="'+key+'"]');if(input)input.value=values[key]});var confirmed=panel.querySelector('[data-billing-address-confirmed]');if(confirmed){confirmed.innerHTML='<b>Confirmed billing address</b><br>'+pmosBillingEscape(resolved.address||[values.addressLine1,values.city,values.province,values.postalCode,values.country].filter(Boolean).join(', '));confirmed.style.display='block'}pmosBillingSetHint(panel,'Address confirmed.');window.pmosBillingTouched=true},function(error){state.selected=null;pmosBillingSetHint(panel,error&&error.message?error.message:String(error))})}
function pmosBillingWireAutocomplete(prefix){var panel=document.getElementById(prefix+'Panel'),input=panel&&panel.querySelector('[data-billing="addressLine1"]'),list=panel&&panel.querySelector('[data-billing-address-list]'),state=pmosBillingState(prefix);if(!input||!list||input.__pmosBillingAutocomplete)return;input.__pmosBillingAutocomplete=true;input.addEventListener('input',function(){clearTimeout(state.timer);state.selected=null;var confirmed=panel.querySelector('[data-billing-address-confirmed]');if(confirmed)confirmed.style.display='none';var query=String(input.value||'').trim(),request=++state.request;if(query.length<3){pmosBillingHideList(panel);pmosBillingSetHint(panel,query?'Type at least 3 characters to search.':'');return}pmosBillingSetHint(panel,'Searching for complete addresses…');state.timer=setTimeout(function(){pmosBillingRunner('suggestPmosAddresses',[query,6],function(items){if(request!==state.request)return;items=items||[];list.innerHTML='';items.forEach(function(item){var button=document.createElement('button');button.type='button';button.className='billing-address-option';button.textContent=item.address||'';button.onmousedown=function(event){event.preventDefault();pmosBillingConfirm(prefix,item)};list.appendChild(button)});list.style.display=items.length?'block':'none';pmosBillingSetHint(panel,items.length?'Choose the correct complete address.':'No complete address matches yet. Continue typing.')},function(error){if(request!==state.request)return;pmosBillingHideList(panel);pmosBillingSetHint(panel,error&&error.message?error.message:String(error))})},140)});input.addEventListener('blur',function(){setTimeout(function(){pmosBillingHideList(panel)},180)})}
function pmosWireBillingPanel(prefix){var toggle=document.getElementById(prefix+'Toggle'),panel=document.getElementById(prefix+'Panel'),clear=document.getElementById(prefix+'Clear');if(!toggle||!panel)return;pmosBillingWireAutocomplete(prefix);toggle.onclick=function(){panel.classList.add('open');toggle.textContent='Account holder billing address';window.pmosBillingTouched=true;var address=panel.querySelector('[data-billing="addressLine1"]');if(address)setTimeout(function(){address.focus()},0)};if(clear)clear.onclick=function(){pmosRenderBillingAddress(prefix,{enabled:false});window.pmosBillingTouched=true}}
function pmosRenderBillingAddress(prefix,billing){billing=billing||{};var panel=document.getElementById(prefix+'Panel'),toggle=document.getElementById(prefix+'Toggle'),state=pmosBillingState(prefix);if(!panel)return;['addressLine1','addressLine2','city','province','postalCode','country'].forEach(function(key){var input=panel.querySelector('[data-billing="'+key+'"]');if(input)input.value=billing[key]||((key==='country')?'Canada':'')});panel.classList.toggle('open',!!billing.enabled);state.selected=billing.enabled?Object.assign({},billing):null;var confirmed=panel.querySelector('[data-billing-address-confirmed]');if(confirmed){confirmed.style.display=billing.enabled?'block':'none';confirmed.innerHTML=billing.enabled?'<b>Saved billing address</b><br>'+[billing.addressLine1,billing.addressLine2,billing.city,billing.province,billing.postalCode,billing.country].filter(Boolean).join(', '):''}pmosBillingSetHint(panel,'');if(toggle)toggle.textContent=billing.enabled?'Account holder billing address':'+ Add account holder billing address'}
function pmosBillingAddressIsConfirmed(prefix){var panel=document.getElementById(prefix+'Panel');return !panel||!panel.classList.contains('open')||!!pmosBillingState(prefix).selected}
function pmosCollectBillingAddress(prefix){var panel=document.getElementById(prefix+'Panel');if(!panel)return{enabled:false};var open=panel.classList.contains('open'),read=function(key){var input=panel.querySelector('[data-billing="'+key+'"]');return input?String(input.value||'').trim():''},state=pmosBillingState(prefix);return{enabled:open,addressLine1:read('addressLine1'),addressLine2:read('addressLine2'),city:read('city'),province:read('province'),postalCode:read('postalCode'),country:read('country'),addressVerified:!open||!!state.selected,addressDetails:state.selected||{}}}
`;
}

function pmosBillingAddressEditorBlock_(prefix) {
  return '<div class="wide" style="margin-top:2px"><div id="' + prefix + 'Host"></div></div>';
}

function pmosEnhanceAddServiceLocationWithBillingAddress_(html) {
  let output = String(html || '');
  output = output.replace('</style>', pmosAccountBillingAddressStyles_() + '\n</style>');
  output = output.replace(
    '<div class="wide helper">These are account-level contact fields. Changes made here apply to the account, not only this service location.</div>',
    '<div class="wide helper">These are account-level contact fields. Changes made here apply to the account, not only this service location.</div>' + pmosBillingAddressEditorBlock_('serviceLocationBilling')
  );
  output = output.split('.createPmosAdditionalServiceLocationForAccountWithLocationContacts(')
    .join('.createPmosAdditionalServiceLocationForAccountWithLocationContactsAndBilling(');
  output = output.replace(
    '</script></body></html>',
    pmosAccountBillingAddressClientScript_() + String.raw`
window.pmosBillingLoaded=false;window.pmosBillingTouched=false;var pmosBillingHost=document.getElementById('serviceLocationBillingHost');if(pmosBillingHost){pmosBillingHost.innerHTML=pmosBillingPanelHtml('serviceLocationBilling');pmosWireBillingPanel('serviceLocationBilling');pmosBillingHost.addEventListener('input',function(){window.pmosBillingTouched=true})}
var pmosBaseBillingShowAdd=showAdd;showAdd=function(){pmosBaseBillingShowAdd();window.pmosBillingLoaded=false;window.pmosBillingTouched=false;google.script.run.withSuccessHandler(function(billing){window.pmosBillingLoaded=true;pmosRenderBillingAddress('serviceLocationBilling',billing||{enabled:false})}).getPmosAccountBillingAddress(parentCustomerId)};
var pmosBaseBillingCollect=collect;collect=function(){var data=pmosBaseBillingCollect();if(window.pmosBillingLoaded||window.pmosBillingTouched)data.accountBillingAddress=pmosCollectBillingAddress('serviceLocationBilling');return data};
</script></body></html>`
  );
  return output;
}

function pmosEnhanceCustomerAccountEditorWithBillingAddress_(html) {
  let output = String(html || '');
  output = output.replace('</style>', pmosAccountBillingAddressStyles_() + '\n</style>');
  output = output.replace(
    '<button id="addContact" class="add-link" type="button">+ Add Contact</button></div>',
    '<button id="addContact" class="add-link" type="button">+ Add Contact</button><div style="padding:0 15px 15px"><div id="accountBillingEditorHost"></div></div></div>'
  );
  output = output.split('.savePmosCustomerAccountEditorDataWithLocationContacts(')
    .join('.savePmosCustomerAccountEditorDataWithLocationContactsAndBilling(');
  output = output.replace(
    '</script></body></html>',
    pmosAccountBillingAddressClientScript_() + String.raw`
var pmosAccountBillingEditorHost=document.getElementById('accountBillingEditorHost');if(pmosAccountBillingEditorHost){pmosAccountBillingEditorHost.innerHTML=pmosBillingPanelHtml('accountBillingEditor');pmosWireBillingPanel('accountBillingEditor')}
var pmosBaseBillingEditorFill=fill;fill=function(data){pmosBaseBillingEditorFill(data);pmosRenderBillingAddress('accountBillingEditor',data&&data.accountBillingAddress||{enabled:false})};
var pmosBaseBillingEditorPayload=payload;payload=function(){var data=pmosBaseBillingEditorPayload();data.accountBillingAddress=pmosCollectBillingAddress('accountBillingEditor');return data};
</script></body></html>`
  );
  return output;
}

function pmosEnhanceCustomerAccountLookupWithBillingAddress_(html) {
  let output = String(html || '');
  output = output.replace('</style>', pmosAccountBillingAddressStyles_() + '\n</style>');
  output = output.replace(
    '</script></body></html>',
    pmosAccountBillingAddressClientScript_() + String.raw`
var pmosBaseBillingRenderProfile=renderProfile;renderProfile=function(profile){pmosBaseBillingRenderProfile(profile);var billing=profile&&profile.accountBillingAddress||{};if(!billing.enabled)return;var grid=el('content').querySelector('.contact-grid'),card=document.createElement('div');card.className='card';card.innerHTML='<div class="label">Account billing address</div><div class="value">'+esc([billing.addressLine1,billing.addressLine2,billing.city,billing.province,billing.postalCode,billing.country].filter(Boolean).join(', '))+'</div>';if(grid&&grid.parentNode)grid.parentNode.insertBefore(card,grid.nextSibling);else el('content').insertAdjacentElement('afterbegin',card)};
</script></body></html>`
  );
  return output;
}
