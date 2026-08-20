/**
 * Add Customer — simple customer/account creation without recurring maintenance.
 *
 * This workflow shares PMOS customer/account, address, contact, body-of-water, and
 * equipment services, but deliberately performs no route calculation, route placement,
 * maintenance template creation, or recurring Calendar synchronization.
 */
function showPmosAddCustomer() {
  migrateMaintenanceCustomerEquipmentStorage_();
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;700;800;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:'Mulish',Arial,sans-serif;color:#293944;background:#e5eaed}body{padding:18px}.shell{max-width:940px;margin:0 auto}.header{display:flex;align-items:flex-start;gap:14px;margin-bottom:14px}.header-copy h2{margin:0;color:#293944;font-size:23px;font-weight:900}.header-copy p{margin:5px 0 0;color:#68747a;font-size:12px;line-height:1.45}.account-preview{margin-left:auto;max-width:310px;padding:8px 11px;border:1px solid #bfd9e5;border-radius:999px;background:#e4f0f5;color:#0f5470;font-size:11px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.section-card{position:relative;margin-top:11px;padding:15px;background:#f9fafb;border:1px solid #d2dade;border-radius:10px;box-shadow:0 4px 14px rgba(46,56,66,.04)}.section-card:before{content:'';position:absolute;inset:0 auto 0 0;width:4px;border-radius:10px 0 0 10px;background:#0f5470}.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.section-head h3{margin:0;font-size:15px;font-weight:900;color:#293944}.section-head p{margin:3px 0 0;color:#68747a;font-size:10px;line-height:1.4}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px 13px}.wide{grid-column:1/-1}.field label,.grid>label{display:flex;flex-direction:column;gap:5px;color:#6f7d84;font-size:10px;font-weight:900;letter-spacing:.065em;text-transform:uppercase}.field input,.field select,.field textarea,.grid>label input,.grid>label select,.grid>label textarea{width:100%;padding:9px 10px;border:1px solid #bfcbd1;border-radius:7px;background:#fff;color:#293944;font:inherit;outline:none}.field textarea,.grid>label textarea{min-height:74px;resize:vertical}.field input:focus,.field textarea:focus,.grid>label input:focus,.grid>label textarea:focus{border-color:#75c4e5;box-shadow:0 0 0 2px rgba(117,196,229,.18)}.optional{font-weight:400;text-transform:none;letter-spacing:0}.helper{color:#68747a;font-size:10px;line-height:1.45}.subhead{margin:2px 0 8px;color:#293944;font-size:11px;font-weight:900}.address-wrap{position:relative}.address-list{display:none;position:absolute;z-index:70;left:0;right:0;top:100%;max-height:245px;overflow:auto;background:#fff;border:1px solid #94a3b8;border-radius:0 0 8px 8px;box-shadow:0 10px 22px rgba(15,23,42,.18)}.address-option{display:block;width:100%;border:0;border-bottom:1px solid #e2e8f0;background:#fff;padding:10px;text-align:left;cursor:pointer;color:#293944}.address-option:hover,.address-option.active{background:#e4f2f8}.address-main{font-weight:800;font-size:11px}.address-status{display:none;margin-top:7px;padding:8px 10px;border-radius:7px;background:#e7f2f7;color:#0f5470;font-size:10px;font-weight:700}.address-details{display:none;margin-top:8px;padding:9px 10px;border:1px solid #9fd4b4;border-radius:8px;background:#edf7f1;color:#315f42;font-size:10px;line-height:1.5}.contact-action,.inline-button{width:auto;padding:7px 10px;border:1px solid #9db6c1;border-radius:7px;background:#fff;color:#0f5470;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.contact-action:hover,.inline-button:hover{background:#e7f2f7;border-color:#75c4e5}.actions{position:sticky;bottom:0;display:flex;align-items:center;gap:8px;margin-top:14px;padding:12px 0 2px;background:linear-gradient(to bottom,rgba(229,234,237,0),#e5eaed 28%)}.button{border:1px solid #c7d2d8;border-radius:8px;padding:10px 14px;background:#f2f5f6;color:#293944;font:inherit;font-weight:900;cursor:pointer}.button.primary{border-color:#0f5470;background:#0f5470;color:#fff}.button.primary:hover{background:#017db1;border-color:#017db1}.button:disabled{opacity:.55;cursor:default}.status{flex:1;min-height:40px;padding:9px 11px;border:1px solid #d2dade;border-radius:8px;background:#f9fafb;color:#68747a;font-size:10px;line-height:1.4}.status.error{border-color:#e4b2b2;background:#f8e7e7;color:#8c3434}.status.success{border-color:#a8cfb2;background:#e8f3eb;color:#356443}.location-contacts-wrap{margin-top:11px;padding-top:11px;border-top:1px solid #dce5e8}.water-body-shell{margin:0 -15px -1px}.water-body-helper{padding:0 15px 10px}.water-body-actions{padding:0 15px 15px}.smart-input-wrap{position:relative}.smart-picker-button{font-family:inherit}@media(max-width:760px){body{padding:11px}.header{flex-wrap:wrap}.account-preview{margin-left:0}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.actions{flex-wrap:wrap}.status{order:3;flex-basis:100%}}
${pmosCustomerEquipmentEditorStyles_()}
${pmosServiceLocationContactStyles_()}
${pmosAccountBillingAddressStyles_()}
${pmosAccountContactStyles_()}
</style></head><body>
<div class="shell">
  <div class="header">
    <div class="header-copy"><h2>Add Customer</h2><p>Create the customer account and primary service location. Water Maintenance, route placement, and recurring Calendar scheduling are not created here.</p></div>
    <div id="accountPreview" class="account-preview">Account: —</div>
  </div>

  <section class="section-card">
    <div class="section-head"><div><h3>Customer Identity</h3><p>The account name is shown last name first.</p></div></div>
    <div class="grid">
      <div class="field"><label>Last name<input id="lastName" autocomplete="family-name"></label></div>
      <div class="field"><label>First name<input id="firstName" autocomplete="given-name"></label></div>
    </div>
  </section>

  <section class="section-card">
    <div class="section-head"><div><h3>Account Contacts</h3><p>These contacts belong to the account rather than one individual service location.</p></div></div>
    <div class="subhead">Primary account holder</div>
    <div class="grid">
      <div class="field"><label>Phone <span class="optional">optional</span><input id="phone" autocomplete="tel" inputmode="tel"></label></div>
      <div class="field"><label>Email <span class="optional">optional</span><input id="email" type="email" autocomplete="email"></label></div>
      <div class="wide helper">The primary account holder uses the primary service-location address in Google Contacts unless an Account Billing Address is supplied.</div>
      <div class="wide"><div id="addCustomerBillingHost"></div></div>
      <div class="wide" style="padding-top:4px;border-top:1px solid #e1e7ea"><div class="subhead" style="margin-top:9px">Additional Account Contacts</div><div id="accountContacts" class="account-contact-list"></div><button id="addAccountContact" class="contact-action" type="button" style="margin-top:8px">+ Add Account Contact</button></div>
    </div>
  </section>

  <section class="section-card">
    <div class="section-head"><div><h3>Primary Service Location</h3><p>The first property becomes the account's primary service location.</p></div></div>
    <div class="grid">
      <div class="field wide"><label>Service location address<div class="address-wrap"><input id="address" autocomplete="off" placeholder="Begin typing address"><div id="addressList" class="address-list"></div></div><div id="addressStatus" class="address-status"></div><div id="addressDetails" class="address-details"></div></label></div>
      <div class="field wide"><label>Service Location Name<input id="serviceLocationName" placeholder="e.g. Smith Residence"></label><div class="helper" style="margin-top:5px">Defaults to Last Name Residence and can be changed.</div></div>
    </div>
    <div class="location-contacts-wrap">
      <div class="section-head" style="margin-bottom:8px"><div><h3 style="font-size:12px">Service Location Contacts</h3><p>Optional contacts for this property only. Their Google Contacts use this service-location address.</p></div></div>
      <div id="serviceLocationContacts" class="location-contacts"></div>
      <button id="addServiceLocationContact" class="contact-action" type="button" style="margin-top:8px">+ Add Service Location Contact</button>
    </div>
  </section>

  <section class="section-card">
    <div class="section-head"><div><h3>Bodies of Water &amp; Equipment</h3><p>Uses the same equipment component and catalog as the Customer Editor and Add Maintenance Customer.</p></div></div>
    <div class="water-body-shell"><div class="water-body-helper helper">Enter the main body first, then add another body or specialized equipment only when needed.</div><div id="waterBodies" class="water-bodies"></div><div class="water-body-actions"><button id="addBodyButton" type="button" class="inline-button">+ Add Another Body of Water</button></div></div>
  </section>

  <section class="section-card">
    <div class="section-head"><div><h3>Customer Information</h3><p>Entry/access information stays separate from general customer notes.</p></div></div>
    <div class="grid">
      <div class="field wide"><label>Entry Information <span class="optional">optional</span><textarea id="entryInformation"></textarea></label></div>
      <div class="field wide"><label>Customer Notes <span class="optional">optional</span><textarea id="notes"></textarea></label></div>
    </div>
  </section>

  <div class="actions">
    <button id="saveButton" class="button primary" type="button">Create Customer</button>
    <button id="openProfileButton" class="button" type="button" style="display:none">Open Customer Profile</button>
    <button id="cancelButton" class="button" type="button">Cancel</button>
    <div id="status" class="status">Ready.</div>
  </div>
</div>
<script>
var selectedAddress=null,addressTimer=null,addressRequest=0,addressActiveIndex=-1,addressSuggestionCache={},lastAddressItems=[],serviceLocationNameEdited=false,createdCustomerId='';
${pmosCustomerEquipmentEditorScript_()}
${pmosServiceLocationContactClientScript_()}
${pmosAccountBillingAddressClientScript_()}
${pmosAccountContactClientScript_()}
function addCustomerSetStatus(message,type){var box=byId('status');box.className='status'+(type?' '+type:'');box.textContent=message||''}
function addCustomerFormatName(input){var start=input.selectionStart,end=input.selectionEnd,value=String(input.value||''),formatted=value.replace(/(^|[\\s'-])([a-z])/g,function(match,prefix,letter){return prefix+letter.toUpperCase()});if(formatted!==value){input.value=formatted;if(start!=null&&input.setSelectionRange)input.setSelectionRange(start,end)}}
function updateAccountPreview(){var first=String(byId('firstName').value||'').trim(),last=String(byId('lastName').value||'').trim(),name=last&&first?last+', '+first:last||first||'—';byId('accountPreview').textContent='Account: '+name}
function updatePrimaryLocationName(){var last=String(byId('lastName').value||'').trim(),input=byId('serviceLocationName'),suggested=last?last+' Residence':'';if(!serviceLocationNameEdited||!String(input.value||'').trim())input.value=suggested}
function clearAddCustomerAddress(){selectedAddress=null;byId('addressDetails').style.display='none';byId('addressDetails').textContent=''}
function addCustomerAddressStatus(message,error){var box=byId('addressStatus');box.textContent=message||'';box.style.display=message?'block':'none';box.style.background=error?'#f8e7e7':'#e7f2f7';box.style.color=error?'#8c3434':'#0f5470'}
function beginAddCustomerAddressSearch(value){clearTimeout(addressTimer);var q=String(value==null?byId('address').value:value).trim(),key=q.toLowerCase(),request=++addressRequest;if(selectedAddress&&q!==selectedAddress.address)clearAddCustomerAddress();if(q.length<3){hideAddCustomerAddresses();addCustomerAddressStatus(q?'Type at least 3 address characters to see suggestions.':'',false);return}var immediate=addressSuggestionCache[key]||lastAddressItems.filter(function(item){return String(item.address||'').toLowerCase().indexOf(key)>=0});if(immediate.length)renderAddCustomerAddresses(immediate);addCustomerAddressStatus(immediate.length?'Choose the correct complete address.':'Searching for complete Canadian addresses…',false);if(addressSuggestionCache[key])return;addressTimer=setTimeout(function(){google.script.run.withSuccessHandler(function(items){items=items||[];addressSuggestionCache[key]=items;lastAddressItems=items;if(request!==addressRequest)return;renderAddCustomerAddresses(items);addCustomerAddressStatus(items.length?'Choose the correct complete address.':'No complete address matches yet. Continue typing.',false)}).withFailureHandler(function(error){if(request!==addressRequest)return;hideAddCustomerAddresses();addCustomerAddressStatus(error&&error.message?error.message:String(error),true)}).suggestPmosAddresses(q,6)},160)}
function renderAddCustomerAddresses(items){var list=byId('addressList');list.innerHTML='';addressActiveIndex=-1;if(!items.length){hideAddCustomerAddresses();return}(items||[]).forEach(function(item){var button=document.createElement('button');button.type='button';button.className='address-option';button.innerHTML='<div class="address-main">'+esc(item.address)+'</div>';button.addEventListener('mousedown',function(event){event.preventDefault();confirmAddCustomerAddress(item)});list.appendChild(button)});list.style.display='block'}
function confirmAddCustomerAddress(item){hideAddCustomerAddresses();addCustomerAddressStatus('Confirming the selected address…',false);google.script.run.withSuccessHandler(applyAddCustomerResolvedAddress).withFailureHandler(function(error){clearAddCustomerAddress();addCustomerAddressStatus(error&&error.message?error.message:String(error),true)}).confirmPmosSelectedAddress(item)}
function applyAddCustomerResolvedAddress(item){addressRequest++;clearTimeout(addressTimer);selectedAddress=item;byId('address').value=item.address;var box=byId('addressDetails');box.innerHTML='<b>Confirmed address</b><br>'+esc(item.street)+'<br>'+esc(item.city)+', '+esc(item.province)+' '+esc(item.postalCode)+'<br>'+esc(item.country);box.style.display='block';hideAddCustomerAddresses();addCustomerAddressStatus('Address confirmed.',false);setTimeout(function(){byId('serviceLocationName').focus()},0)}
function hideAddCustomerAddresses(){byId('addressList').style.display='none';addressActiveIndex=-1}
function setAddCustomerAddressActive(index){var options=Array.prototype.slice.call(byId('addressList').querySelectorAll('.address-option'));if(!options.length){addressActiveIndex=-1;return}addressActiveIndex=(index+options.length)%options.length;options.forEach(function(option,i){option.classList.toggle('active',i===addressActiveIndex)});options[addressActiveIndex].scrollIntoView({block:'nearest'})}
function handleAddCustomerAddressKey(event){var list=byId('addressList'),options=Array.prototype.slice.call(list.querySelectorAll('.address-option'));if(event.key==='ArrowDown'&&options.length){event.preventDefault();setAddCustomerAddressActive(addressActiveIndex+1)}else if(event.key==='ArrowUp'&&options.length){event.preventDefault();setAddCustomerAddressActive(addressActiveIndex-1)}else if(event.key==='Enter'&&options.length&&addressActiveIndex>=0){event.preventDefault();options[addressActiveIndex].dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))}else if(event.key==='Escape')hideAddCustomerAddresses()}
function addCustomerPayload(){return{firstName:String(byId('firstName').value||'').trim(),lastName:String(byId('lastName').value||'').trim(),phone:String(byId('phone').value||'').trim(),email:String(byId('email').value||'').trim(),address:String(byId('address').value||'').trim(),addressVerified:!!selectedAddress,addressDetails:selectedAddress,serviceLocationName:String(byId('serviceLocationName').value||'').trim(),accountContacts:pmosCollectAccountContacts('accountContacts'),serviceLocationContacts:pmosCollectLocationContacts('serviceLocationContacts'),accountBillingAddress:pmosCollectBillingAddress('addCustomerBilling'),bodiesOfWater:collectWaterBodies(),entryInformation:String(byId('entryInformation').value||'').trim(),notes:String(byId('notes').value||'').trim()}}
function createAddCustomer(){var data=addCustomerPayload();if(!data.lastName||!data.firstName){addCustomerSetStatus('First name and last name are required.','error');return}if(!data.address||!selectedAddress){addCustomerSetStatus('Choose and confirm a complete service-location address before creating the customer.','error');return}if(!data.serviceLocationName){addCustomerSetStatus('Enter a Service Location Name.','error');return}var button=byId('saveButton');button.disabled=true;button.textContent='Creating…';addCustomerSetStatus('Creating the customer account and primary service location…','');google.script.run.withSuccessHandler(function(result){createdCustomerId=result&&result.customerId||'';button.textContent='Complete';byId('openProfileButton').style.display=createdCustomerId?'inline-block':'none';var warning=result&&result.warnings&&result.warnings.length?'\n\n'+result.warnings.join('\n'):'';addCustomerSetStatus((result&&result.summary||'Customer created.')+warning,result&&result.warnings&&result.warnings.length?'':'success')}).withFailureHandler(function(error){button.disabled=false;button.textContent='Create Customer';addCustomerSetStatus(error&&error.message?error.message:String(error),'error')}).createPmosCustomerAccount(data)}
function openCreatedCustomerProfile(){if(!createdCustomerId)return;byId('openProfileButton').disabled=true;google.script.run.withSuccessHandler(function(){setTimeout(function(){google.script.host.close()},200)}).withFailureHandler(function(error){byId('openProfileButton').disabled=false;addCustomerSetStatus(error&&error.message?error.message:String(error),'error')}).showPmosCustomerAccountLookup(createdCustomerId)}
function initializeAddCustomer(){var billingHost=byId('addCustomerBillingHost');if(billingHost){billingHost.innerHTML=pmosBillingPanelHtml('addCustomerBilling');pmosWireBillingPanel('addCustomerBilling')}addWaterBody('Pool');prepareWaterBodyOptions(byId('waterBodies'));var first=byId('firstName'),last=byId('lastName'),phone=byId('phone'),address=byId('address'),location=byId('serviceLocationName');first.addEventListener('input',function(){addCustomerFormatName(first);updateAccountPreview()});last.addEventListener('input',function(){addCustomerFormatName(last);updateAccountPreview();updatePrimaryLocationName()});phone.addEventListener('input',function(){formatPmosPhoneInput(phone)});location.addEventListener('input',function(){serviceLocationNameEdited=true});address.addEventListener('input',function(){beginAddCustomerAddressSearch(address.value)});address.addEventListener('focus',function(){beginAddCustomerAddressSearch(address.value)});address.addEventListener('keydown',handleAddCustomerAddressKey);address.addEventListener('blur',function(){setTimeout(hideAddCustomerAddresses,180)});byId('addAccountContact').addEventListener('click',function(){pmosAddAccountContact('accountContacts',{})});byId('addServiceLocationContact').addEventListener('click',function(){pmosAddLocationContact('serviceLocationContacts',{})});byId('addBodyButton').addEventListener('click',function(){addWaterBody();prepareWaterBodyOptions(byId('waterBodies'))});byId('saveButton').addEventListener('click',createAddCustomer);byId('openProfileButton').addEventListener('click',openCreatedCustomerProfile);byId('cancelButton').addEventListener('click',function(){google.script.host.close()});['lastName','firstName','phone','email','serviceLocationName'].forEach(function(id){byId(id).addEventListener('keydown',function(event){if(event.key!=='Enter')return;event.preventDefault();var order=['lastName','firstName','phone','email','address','serviceLocationName'],index=order.indexOf(id),next=byId(order[index+1]);if(next)next.focus()})});updateAccountPreview();google.script.run.preparePmosAddressSuggestions()}
document.addEventListener('input',function(event){if(!event.target)return;var field=event.target.getAttribute('data-body-field'),equipmentField=event.target.getAttribute('data-equipment-field');if(field==='heaterType'){var card=event.target.closest('.water-body'),make=card&&card.querySelector('[data-body-field="heaterMake"]'),model=card&&card.querySelector('[data-body-field="heaterModel"]');updateHeaterMakeOptions(card,event.target.value,'[data-body-field="heaterMake"]','[data-body-field="heaterModel"]','[data-body-field="heaterModelNumber"]');if(make)updateCatalogModels(make);if(model)updateCatalogNumbers(model)}if(field==='filterMake'||field==='filterType')updateFilterModels(event.target);if(equipmentField==='heaterType'){var equipmentCard=event.target.closest('.equipment-card'),equipmentMake=equipmentCard&&equipmentCard.querySelector('[data-added-catalog-unit="heater"][data-equipment-field="make"]'),equipmentModel=equipmentCard&&equipmentCard.querySelector('[data-added-catalog-unit="heater"][data-equipment-field="model"]'),featureGroup=event.target.closest('[data-water-feature-equipment]'),featureMake=featureGroup&&featureGroup.querySelector('[data-feature-catalog-unit="heater"][data-equipment-field="heaterMake"]'),featureModel=featureGroup&&featureGroup.querySelector('[data-feature-catalog-unit="heater"][data-equipment-field="heaterModel"]');if(equipmentMake){updateHeaterMakeOptions(equipmentCard,event.target.value,'[data-added-catalog-unit="heater"][data-equipment-field="make"]','[data-added-catalog-unit="heater"][data-equipment-field="model"]','[data-equipment-field="modelNumber"]');updateAddedEquipmentModels(equipmentMake)}if(equipmentModel)updateAddedEquipmentNumbers(equipmentModel);if(featureMake){updateHeaterMakeOptions(featureGroup,event.target.value,'[data-feature-catalog-unit="heater"][data-equipment-field="heaterMake"]','[data-feature-catalog-unit="heater"][data-equipment-field="heaterModel"]','[data-equipment-field="heaterModelNumber"]');updateWaterFeatureComponentModels(featureMake)}if(featureModel)updateWaterFeatureComponentNumbers(featureModel)}});
document.addEventListener('mousedown',function(event){var smartWrap=event.target&&event.target.closest&&event.target.closest('.smart-input-wrap');closeAllSmartOptions(smartWrap);if(event.target&&event.target.matches('.equipment-actions select'))hideAddPromptOptions(event.target.closest('.equipment-actions'))});
document.addEventListener('keydown',function(event){if(event.key==='Enter'&&event.target&&event.target.matches('.water-body select')&&!event.target.closest('.equipment-actions')){event.preventDefault();setTimeout(function(){focusNextEquipmentField(event.target)},0)}});
initializeAddCustomer();
</script></body></html>`).setWidth(980).setHeight(820);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Add Customer');
}

function normalizePmosAddCustomerRequest_(input) {
  const source = input || {};
  const firstName = String(source.firstName || '').trim();
  const lastName = String(source.lastName || '').trim();
  const phone = String(source.phone || '').trim();
  const email = String(source.email || '').trim();
  const address = String(source.address || '').trim();
  const details = source.addressDetails || {};
  const locationName = String(source.serviceLocationName || '').trim() || (lastName ? lastName + ' Residence' : '');
  const billing = normalizePmosAccountBillingAddress_(source.accountBillingAddress || {enabled: false});
  const accountContacts = normalizePmosAccountContacts_(source.accountContacts);
  const locationContacts = normalizePmosServiceLocationContacts_(source.serviceLocationContacts);
  const bodies = normalizePmosCustomerEditorBodies_(source.bodiesOfWater);

  if (!firstName) throw new Error('First name is required.');
  if (!lastName) throw new Error('Last name is required.');
  if (!address) throw new Error('Service location address is required.');
  if (!locationName) throw new Error('Service Location Name is required.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email address is not valid.');
  if (source.addressVerified !== true ||
      normalizePmosAddressSearch_(details.address) !== normalizePmosAddressSearch_(address) ||
      !String(details.street || '').trim() || !String(details.city || '').trim() ||
      !String(details.province || '').trim() || !String(details.postalCode || '').trim() ||
      !String(details.country || '').trim() || !Number.isFinite(Number(details.lat)) ||
      !Number.isFinite(Number(details.lng))) {
    throw new Error('Select and confirm a complete address suggestion before creating the customer.');
  }

  return {
    firstName: firstName,
    lastName: lastName,
    phone: phone,
    email: email,
    address: address,
    addressVerified: true,
    addressDetails: {
      address: address,
      street: String(details.street || '').trim(),
      city: String(details.city || '').trim(),
      province: String(details.province || '').trim(),
      postalCode: String(details.postalCode || '').trim(),
      country: String(details.country || '').trim(),
      lat: Number(details.lat),
      lng: Number(details.lng),
      placeId: String(details.placeId || '').trim(),
      source: String(details.source || '').trim()
    },
    serviceLocationName: locationName,
    calendarTitle: lastName,
    accountBillingAddress: billing,
    accountContacts: accountContacts,
    serviceLocationContacts: locationContacts,
    bodiesOfWater: bodies,
    entryInformation: String(source.entryInformation || '').trim().slice(0, 5000),
    notes: String(source.notes || '').trim().slice(0, 10000)
  };
}

function applyPmosConfirmedAddressDetailsToCustomer_(customerId, addressDetails) {
  const details = addressDetails || {};
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [
    PMOS.CUSTOMERS_SHEET, 'Customers', 'Customer Database', 'Customer List'
  ]);
  if (!sheet) throw new Error('Customers sheet was not found.');
  let table = readPmosHeaderTable_(sheet);
  ensureMaintenanceClientHeaders_(sheet, table, [
    'Full Address', 'Service Address', 'Address', 'Street Address', 'Street',
    'City', 'Province', 'Postal Code', 'Country', 'Latitude', 'Longitude'
  ]);
  const record = getPmosCustomerEditorRow_(customerId);
  const values = record.values.slice();
  pmosCustomerEditorSetAliases_(record.headers, values, ['Full Address', 'Service Address', 'Address', 'Street Address'], details.address || '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['Street'], details.street || '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['City'], details.city || '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['Province'], details.province || '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['Postal Code'], details.postalCode || '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['Country'], details.country || '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['Latitude'], details.lat);
  pmosCustomerEditorSetAliases_(record.headers, values, ['Longitude'], details.lng);
  record.sheet.getRange(record.rowNumber, 1, 1, values.length).setValues([values]);
  SpreadsheetApp.flush();
}

function createPmosCustomerAccount(input) {
  const request = normalizePmosAddCustomerRequest_(input);
  const warnings = [];
  const customersSheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [
    PMOS.CUSTOMERS_SHEET, 'Customers', 'Customer Database', 'Customer List'
  ]);
  if (!customersSheet) throw new Error('Customers sheet was not found.');
  const customerTable = readPmosHeaderTable_(customersSheet);
  assertMaintenanceClientNotDuplicate_(customerTable, request.lastName, request.address, request.email);

  const result = createPmosNonMaintenanceAccountServiceLocation_({
    firstName: request.firstName,
    lastName: request.lastName,
    phone: request.phone,
    email: request.email,
    address: request.address,
    serviceLocationName: request.serviceLocationName,
    calendarTitle: request.calendarTitle,
    bodiesOfWater: request.bodiesOfWater,
    entryInformation: request.entryInformation,
    notes: request.notes,
    waterMaintenance: false
  });

  applyPmosAccountIdentityToCustomerRow_(
    result.customerId,
    result.customerId,
    request.serviceLocationName,
    true
  );
  applyPmosConfirmedAddressDetailsToCustomer_(result.customerId, request.addressDetails);

  try {
    savePmosAccountBillingAddress_(result.customerId, request.accountBillingAddress);
  } catch (error) {
    warnings.push('Account Billing Address could not be saved: ' + String(error && error.message ? error.message : error));
  }

  try {
    const accountContactResult = syncPmosAccountContactsToGoogle_(result.customerId, request.accountContacts);
    Array.prototype.push.apply(warnings, accountContactResult.warnings || []);
  } catch (error) {
    try { savePmosAccountContacts_(result.customerId, request.accountContacts); } catch (ignored) {}
    warnings.push('Account Contacts were not fully synchronized: ' + String(error && error.message ? error.message : error));
  }

  try {
    const locationContactResult = saveAndSyncPmosServiceLocationContacts_(
      result.customerId,
      request.serviceLocationContacts
    );
    (locationContactResult.errors || []).forEach(function(message) {
      warnings.push('Service Location Contact Google sync: ' + message);
    });
  } catch (error) {
    try { savePmosServiceLocationContacts_(result.customerId, request.serviceLocationContacts); } catch (ignored) {}
    warnings.push('Service Location Contacts were not fully synchronized: ' + String(error && error.message ? error.message : error));
  }

  try {
    const addressSync = syncPmosAccountHolderGoogleAddress_(result.customerId);
    if (addressSync && addressSync.error) warnings.push('Account holder Google Contact address: ' + addressSync.error);
  } catch (error) {
    warnings.push('Account holder Google Contact address could not be synchronized: ' + String(error && error.message ? error.message : error));
  }

  result.account = getPmosCustomerAccount_(result.customerId);
  result.accountContacts = getPmosAccountContacts_(result.customerId);
  result.serviceLocationContacts = getPmosServiceLocationContacts_(result.customerId);
  result.accountBillingAddress = getPmosAccountBillingAddress_(result.customerId);
  result.warnings = warnings;
  result.summary = 'Customer created: ' + request.lastName + ', ' + request.firstName +
    '\nPrimary service location: ' + request.serviceLocationName +
    '\nNo Water Maintenance route or recurring Calendar events were created.';
  return pmosAccountTerminologyState_(result);
}
