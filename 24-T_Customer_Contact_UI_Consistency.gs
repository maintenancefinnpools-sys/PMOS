/**
 * Shared customer/contact UI consistency for Sheets dialogs and the Web App.
 *
 * Keeps the existing PMOS storage schema intact while presenting primary and
 * additional Account Contacts as one ordered card stack. The top card remains
 * backed by the authoritative First/Last/Phone/Email customer columns.
 */
(function () {
  if (typeof pmosAccountContactStyles_ === 'function') {
    const baseAccountContactStyles = pmosAccountContactStyles_;
    pmosAccountContactStyles_ = function () {
      return baseAccountContactStyles() +
        '.account-contact-list{position:relative}' +
        '.account-contact-row{padding-top:28px}' +
        '.account-contact-row[draggable="true"]{cursor:grab}' +
        '.account-contact-row.pmos-dragging{opacity:.52}' +
        '.account-contact-drag{position:absolute;left:9px;top:7px;border:0;background:transparent;color:#667780;font-size:14px;cursor:grab;line-height:1}' +
        '.account-contact-primary{background:#e7ecef;border-color:#b8c7ce}' +
        '.account-contact-primary .account-contact-remove{display:none}' +
        '.account-contact-primary-badge{position:absolute;left:34px;top:6px;padding:2px 7px;border-radius:999px;background:#d3dee3;color:#344c58;font-size:8px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}' +
        '.account-contact-role select,.account-contact-role input{width:100%}';
    };
  }

  if (typeof pmosServiceLocationContactStyles_ === 'function') {
    const baseLocationContactStyles = pmosServiceLocationContactStyles_;
    pmosServiceLocationContactStyles_ = function () {
      return baseLocationContactStyles() +
        '.location-contact-row{padding-top:28px}.location-contact-name-order{display:contents}';
    };
  }

  if (typeof pmosAccountContactClientScript_ === 'function') {
    const baseAccountContactScript = pmosAccountContactClientScript_;
    pmosAccountContactClientScript_ = function () {
      return baseAccountContactScript() + String.raw`
(function(){
  var PMOS_ACCOUNT_ROLE_OPTIONS=[
    'Spouse','Partner','Parent','Child','Sibling','Family Member','Caregiver',
    'Billing Contact','Property Manager','Account Manager','Assistant','Other'
  ];
  var pmosAccountRoleSequence=0;
  var pmosDraggedAccountContactRow=null;

  function pmosTitleCaseValue(value){
    return String(value||'').replace(/(^|[\s'’-])([a-zà-öø-ÿ])/g,function(match,prefix,letter){return prefix+letter.toUpperCase()});
  }
  window.pmosTitleCaseInput=window.pmosTitleCaseInput||function(input){
    if(!input)return;
    var start=input.selectionStart,end=input.selectionEnd,value=String(input.value||''),formatted=pmosTitleCaseValue(value);
    if(formatted===value)return;
    input.value=formatted;
    if(start!=null&&input.setSelectionRange)input.setSelectionRange(start,end);
  };

  function pmosAccountFieldWrap(row,key){
    var input=row&&row.querySelector('[data-account-contact="'+key+'"]');
    return input&&(input.closest('.field')||input.parentElement);
  }
  function pmosAccountReorderNameFields(row){
    var grid=row&&row.querySelector('.account-contact-grid'),last=pmosAccountFieldWrap(row,'lastName'),first=pmosAccountFieldWrap(row,'firstName');
    if(grid&&last&&first){grid.insertBefore(last,first);}
  }
  function pmosConfigureAccountRole(row){
    var input=row&&row.querySelector('[data-account-contact="role"]');if(!input)return;
    var listId='pmosAccountRoles'+(++pmosAccountRoleSequence),list=document.createElement('datalist');
    list.id=listId;list.innerHTML=PMOS_ACCOUNT_ROLE_OPTIONS.map(function(value){return '<option value="'+pmosAccountContactEsc(value)+'"></option>'}).join('');
    input.setAttribute('list',listId);input.placeholder='Select or type another role';input.insertAdjacentElement('afterend',list);
    if(typeof enhanceEditableSelects==='function')enhanceEditableSelects(input.closest('.field')||row);
  }
  function pmosReadAdditionalAccountRow(row){
    function read(key){var input=row.querySelector('[data-account-contact="'+key+'"]');return input?String(input.value||'').trim():''}
    return {firstName:read('firstName'),lastName:read('lastName'),role:read('role'),phone:read('phone'),email:read('email'),notes:read('notes'),resourceName:row.dataset.resourceName||''};
  }
  function pmosWriteAdditionalAccountRow(row,data){
    ['firstName','lastName','role','phone','email','notes'].forEach(function(key){var input=row.querySelector('[data-account-contact="'+key+'"]');if(input)input.value=data&&data[key]||''});
    row.dataset.resourceName=data&&data.resourceName||'';
  }
  function pmosPrimaryCardData(card){
    function read(key){var input=card.querySelector('[data-primary-account-contact="'+key+'"]');return input?String(input.value||'').trim():''}
    return {firstName:read('firstName'),lastName:read('lastName'),phone:read('phone'),email:read('email'),role:'Account Holder',notes:'',resourceName:''};
  }
  function pmosWritePrimaryCard(card,data){
    ['firstName','lastName','phone','email'].forEach(function(key){var input=card.querySelector('[data-primary-account-contact="'+key+'"]');if(!input)return;input.value=data&&data[key]||'';input.dispatchEvent(new Event('input',{bubbles:true}))});
  }
  function pmosPromoteAdditionalAccountRow(row,primary){
    if(!row||!primary||row===primary)return;
    var oldPrimary=pmosPrimaryCardData(primary),promoted=pmosReadAdditionalAccountRow(row);
    pmosWritePrimaryCard(primary,promoted);pmosWriteAdditionalAccountRow(row,oldPrimary);
  }
  function pmosBindAccountRowDrag(row){
    if(!row||row.dataset.pmosDragBound==='1')return;row.dataset.pmosDragBound='1';row.draggable=true;
    if(!row.querySelector('.account-contact-drag')){var drag=document.createElement('button');drag.type='button';drag.className='account-contact-drag';drag.tabIndex=-1;drag.title='Drag to reorder contacts';drag.setAttribute('aria-label','Drag to reorder contacts');drag.textContent='☰';row.insertBefore(drag,row.firstChild)}
    row.addEventListener('dragstart',function(event){pmosDraggedAccountContactRow=row;row.classList.add('pmos-dragging');if(event.dataTransfer)event.dataTransfer.effectAllowed='move'});
    row.addEventListener('dragend',function(){row.classList.remove('pmos-dragging');pmosDraggedAccountContactRow=null});
    row.addEventListener('dragover',function(event){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move'});
    row.addEventListener('drop',function(event){event.preventDefault();var dragged=pmosDraggedAccountContactRow;if(!dragged||dragged===row)return;var root=row.parentElement,primary=root&&root.querySelector('.account-contact-primary');if(!root||!primary)return;if(row===primary){pmosPromoteAdditionalAccountRow(dragged,primary);return}if(dragged===primary){pmosPromoteAdditionalAccountRow(row,primary);return}var rect=row.getBoundingClientRect(),before=event.clientY<rect.top+rect.height/2;root.insertBefore(dragged,before?row:row.nextSibling)});
  }

  var basePmosAccountContactRow=pmosAccountContactRow;
  pmosAccountContactRow=function(contact){
    var row=basePmosAccountContactRow(contact);pmosAccountReorderNameFields(row);pmosConfigureAccountRole(row);pmosBindAccountRowDrag(row);
    var first=row.querySelector('[data-account-contact="firstName"]'),last=row.querySelector('[data-account-contact="lastName"]'),phone=row.querySelector('[data-account-contact="phone"]');
    [first,last].forEach(function(input){if(input)input.addEventListener('input',function(){window.pmosTitleCaseInput(input)})});
    if(phone)phone.addEventListener('input',function(){if(typeof formatPmosPhoneInput==='function')formatPmosPhoneInput(phone)});
    return row;
  };

  var basePmosRenderAccountContacts=pmosRenderAccountContacts;
  pmosRenderAccountContacts=function(containerId,contacts){
    var root=document.getElementById(containerId),primary=root&&root.querySelector('.account-contact-primary');
    if(!primary){basePmosRenderAccountContacts(containerId,contacts);root=document.getElementById(containerId)}
    else{Array.prototype.forEach.call(root.querySelectorAll('.account-contact-row:not(.account-contact-primary)'),function(row){row.remove()});(contacts||[]).forEach(function(contact){root.appendChild(pmosAccountContactRow(contact))})}
    if(root)Array.prototype.forEach.call(root.querySelectorAll('.account-contact-row'),pmosBindAccountRowDrag);
  };

  var basePmosAddAccountContact=pmosAddAccountContact;
  pmosAddAccountContact=function(containerId,contact){
    basePmosAddAccountContact(containerId,contact);var root=document.getElementById(containerId),rows=root&&root.querySelectorAll('.account-contact-row:not(.account-contact-primary)'),row=rows&&rows[rows.length-1];if(row){pmosAccountReorderNameFields(row);pmosConfigureAccountRole(row);pmosBindAccountRowDrag(row);var last=row.querySelector('[data-account-contact="lastName"]');if(last)last.focus()}
  };

  var basePmosCollectAccountContacts=pmosCollectAccountContacts;
  pmosCollectAccountContacts=function(containerId){
    var root=document.getElementById(containerId);if(!root)return[];
    return Array.prototype.map.call(root.querySelectorAll('.account-contact-row:not(.account-contact-primary)'),pmosReadAdditionalAccountRow).filter(function(contact){return contact.firstName||contact.lastName||contact.role||contact.phone||contact.email||contact.notes});
  };

  window.pmosMountPrimaryAccountContactCard=function(config){
    config=config||{};var root=document.getElementById(config.listId);if(!root||root.querySelector('.account-contact-primary'))return;
    var inputs={lastName:document.getElementById(config.lastNameId),firstName:document.getElementById(config.firstNameId),phone:document.getElementById(config.phoneId),email:document.getElementById(config.emailId)};
    if(!inputs.lastName||!inputs.firstName)return;
    var oldWraps=[];Object.keys(inputs).forEach(function(key){var input=inputs[key];if(!input)return;var wrap=input.closest('.field')||input.closest('label');if(wrap)oldWraps.push(wrap)});
    var primary=document.createElement('div');primary.className='account-contact-row account-contact-primary';primary.innerHTML='<span class="account-contact-primary-badge">Primary Account Contact</span><div class="account-contact-grid"></div>';
    var grid=primary.querySelector('.account-contact-grid');
    function addField(label,key,input,wide){if(!input)return;input.setAttribute('data-primary-account-contact',key);var field=document.createElement('div');field.className='field'+(wide?' wide':'');var lab=document.createElement('label');lab.textContent=label;lab.appendChild(input);field.appendChild(lab);grid.appendChild(field)}
    addField('Last name','lastName',inputs.lastName,false);addField('First name','firstName',inputs.firstName,false);addField('Phone','phone',inputs.phone,false);addField('Email','email',inputs.email,false);
    oldWraps.forEach(function(wrap){if(!wrap.closest('.account-contact-primary'))wrap.style.display='none'});
    root.insertBefore(primary,root.firstChild);pmosBindAccountRowDrag(primary);
    [inputs.lastName,inputs.firstName].forEach(function(input){if(input)input.addEventListener('input',function(){window.pmosTitleCaseInput(input)})});
    if(inputs.phone)inputs.phone.addEventListener('input',function(){if(typeof formatPmosPhoneInput==='function')formatPmosPhoneInput(inputs.phone)});
    var host=root.closest('.ac-subsection, .wide, .ce-full, .section-card, .ce-section');if(host){var heading=host.querySelector('h3,.subhead');if(heading&&/additional account contacts/i.test(heading.textContent||''))heading.textContent='Account Contacts'}
    var scope=root.closest('#view-addcustomer,body');if(scope){Array.prototype.forEach.call(scope.querySelectorAll('.ac-section-title,.section-head h3'),function(node){if(/^customer identity$/i.test(String(node.textContent||'').trim())){var section=node.closest('.section-card');if(section)section.style.display='none';else node.style.display='none'}})}
  };

  function mountKnownPrimaryCards(){
    [
      {listId:'acAccountContacts',lastNameId:'acLastName',firstNameId:'acFirstName',phoneId:'acPhone',emailId:'acEmail'},
      {listId:'accountContacts',lastNameId:'lastName',firstNameId:'firstName',phoneId:'phone',emailId:'email'},
      {listId:'ceAccountContacts',lastNameId:'ceLastName',firstNameId:'ceFirstName',phoneId:'cePhone',emailId:'ceEmail'}
    ].forEach(window.pmosMountPrimaryAccountContactCard);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(mountKnownPrimaryCards,0)});else setTimeout(mountKnownPrimaryCards,0);
  document.addEventListener('pmos:viewchange',function(){setTimeout(mountKnownPrimaryCards,0)});
})();
`;
    };
  }

  if (typeof pmosServiceLocationContactClientScript_ === 'function') {
    const baseLocationContactScript = pmosServiceLocationContactClientScript_;
    pmosServiceLocationContactClientScript_ = function () {
      return baseLocationContactScript() + String.raw`
(function(){
  var baseLocationContactRow=pmosLocationContactRow;
  pmosLocationContactRow=function(contact){
    var row=baseLocationContactRow(contact),grid=row.querySelector('.location-contact-grid'),first=row.querySelector('[data-location-contact="firstName"]'),last=row.querySelector('[data-location-contact="lastName"]'),phone=row.querySelector('[data-location-contact="phone"]');
    var firstWrap=first&&(first.closest('.field')||first.parentElement),lastWrap=last&&(last.closest('.field')||last.parentElement);if(grid&&firstWrap&&lastWrap)grid.insertBefore(lastWrap,firstWrap);
    [first,last].forEach(function(input){if(input)input.addEventListener('input',function(){if(window.pmosTitleCaseInput)window.pmosTitleCaseInput(input)})});
    if(phone)phone.addEventListener('input',function(){if(typeof formatPmosPhoneInput==='function')formatPmosPhoneInput(phone)});
    return row;
  };
  var baseAddLocationContact=pmosAddLocationContact;
  pmosAddLocationContact=function(containerId,contact){baseAddLocationContact(containerId,contact);var root=document.getElementById(containerId),rows=root&&root.querySelectorAll('.location-contact-row'),row=rows&&rows[rows.length-1],last=row&&row.querySelector('[data-location-contact="lastName"]');if(last)last.focus()};
})();
`;
    };
  }

  if (typeof pmosCustomerEquipmentEditorStyles_ === 'function') {
    const baseEquipmentStyles = pmosCustomerEquipmentEditorStyles_;
    pmosCustomerEquipmentEditorStyles_ = function () {
      return baseEquipmentStyles() +
        '.check-row input[type="checkbox"],[data-automation-connection] input[type="checkbox"]{width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important;padding:0!important;margin:0!important;flex:0 0 16px!important;appearance:auto!important}' +
        '.chemistry-option,.automation-option{align-self:start}' +
        '.equipment-actions{display:flex!important;flex-direction:row!important;align-items:center!important;gap:7px!important;flex-wrap:wrap!important}' +
        '.equipment-actions select.inline-button{display:inline-block!important;width:auto!important;min-width:0!important;max-width:185px!important;min-height:30px!important;padding:5px 24px 5px 8px!important;font-size:10px!important;flex:0 0 auto!important}' +
        '.pmos-address-search-hint{margin-top:5px;color:#68747a;font-size:9px;font-weight:700;line-height:1.35;min-height:12px}' +
        '.pmos-address-search-hint.searching{color:#0f5470}' +
        '.pmos-address-search-hint.ready{color:#356443}';
    };
  }

  if (typeof pmosCustomerEquipmentEditorScript_ === 'function') {
    const baseEquipmentScript = pmosCustomerEquipmentEditorScript_;
    pmosCustomerEquipmentEditorScript_ = function () {
      return baseEquipmentScript() + String.raw`
(function(){
  function pmosCapitalizeSharedInput(input){if(window.pmosTitleCaseInput)window.pmosTitleCaseInput(input);else{var value=String(input.value||''),formatted=value.replace(/(^|[\s'’-])([a-zà-öø-ÿ])/g,function(m,p,l){return p+l.toUpperCase()});if(formatted!==value)input.value=formatted}}
  function isPmosTitleField(input){
    if(!input||input.tagName!=='INPUT')return false;
    var ac=input.getAttribute('autocomplete'),body=input.getAttribute('data-body-field'),account=input.getAttribute('data-account-contact'),location=input.getAttribute('data-location-contact'),id=String(input.id||'');
    if(ac==='given-name'||ac==='family-name')return true;
    if(body==='name'||account==='firstName'||account==='lastName'||location==='firstName'||location==='lastName')return true;
    return /(serviceLocationName|calendarTitle|LocationName|CalendarTitle)$/i.test(id);
  }
  document.addEventListener('input',function(event){var input=event.target;if(isPmosTitleField(input))pmosCapitalizeSharedInput(input)});

  function installAddressHint(wrapper){
    if(!wrapper||wrapper.dataset.pmosAddressHint==='1')return;var input=wrapper.querySelector('input'),list=wrapper.querySelector('[class*="address-list"], [id$="AddressList"], #addressList');if(!input)return;wrapper.dataset.pmosAddressHint='1';
    var hint=document.createElement('div');hint.className='pmos-address-search-hint';wrapper.insertAdjacentElement('afterend',hint);
    function set(text,mode){hint.textContent=text||'';hint.className='pmos-address-search-hint'+(mode?' '+mode:'')}
    function updateInput(){var q=String(input.value||'').trim();if(!q)set('',null);else if(q.length<3)set('Type 3 characters to search for addresses.',null);else set('Searching for addresses…','searching')}
    input.addEventListener('input',updateInput);input.addEventListener('focus',function(){if(String(input.value||'').trim().length>=3)updateInput()});
    if(list&&typeof MutationObserver!=='undefined'){new MutationObserver(function(){var visible=list.children.length&&getComputedStyle(list).display!=='none';if(visible)set('Address suggestions ready.','ready')}).observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']})}
  }
  function installAddressHints(root){Array.prototype.forEach.call((root||document).querySelectorAll('.address-wrap,.ac-address-wrap,.am-address-wrap,.ce-address-wrap,.sl-address-wrap,.tm-address-wrap'),installAddressHint)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){installAddressHints(document)});else installAddressHints(document);
  document.addEventListener('pmos:viewchange',function(){setTimeout(function(){installAddressHints(document)},0)});
  if(typeof MutationObserver!=='undefined')new MutationObserver(function(){installAddressHints(document)}).observe(document.documentElement||document.body,{childList:true,subtree:true});
})();
`;
    };
  }
})();
