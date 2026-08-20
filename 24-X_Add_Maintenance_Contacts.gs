/**
 * Account/Service Location Contacts for Add Maintenance Customer in Sheets + Web.
 *
 * The existing maintenance form payload has no contact arrays, so this module uses
 * a short-lived client payload envelope in the existing notes field. The server
 * unwraps it before normal customer creation, then saves the contacts through the
 * same authoritative Account Contact and Service Location Contact services used by
 * Add Customer and Customer Editor.
 */
const PMOS_MAINTENANCE_CONTACT_ENVELOPE_PREFIX_ = 'PMOS_MAINT_CONTACTS_V1:';

function unpackPmosMaintenanceContactsEnvelope_(input) {
  let request = Object.assign({}, input || {});
  if (typeof unpackPmosContextNotesEnvelope_ === 'function') {
    request = unpackPmosContextNotesEnvelope_(request);
  }
  let raw = String(request.notes == null ? '' : request.notes);
  if (raw.indexOf(PMOS_MAINTENANCE_CONTACT_ENVELOPE_PREFIX_) !== 0 &&
      String(request.generalNotes || '').indexOf(PMOS_MAINTENANCE_CONTACT_ENVELOPE_PREFIX_) === 0) {
    raw = String(request.generalNotes || '');
  }
  if (raw.indexOf(PMOS_MAINTENANCE_CONTACT_ENVELOPE_PREFIX_) !== 0) return request;
  try {
    const parsed = JSON.parse(decodeURIComponent(
      raw.slice(PMOS_MAINTENANCE_CONTACT_ENVELOPE_PREFIX_.length)
    ));
    request.accountContacts = Array.isArray(parsed.accountContacts) ? parsed.accountContacts : [];
    request.serviceLocationContacts = Array.isArray(parsed.serviceLocationContacts)
      ? parsed.serviceLocationContacts : [];
    request.notes = String(parsed.notes || '');
    request.generalNotes = request.notes;
    if (typeof unpackPmosContextNotesEnvelope_ === 'function') {
      request = unpackPmosContextNotesEnvelope_(request);
    }
  } catch (ignored) {}
  return request;
}

(function () {
  if (typeof createMaintenanceCustomer === 'function') {
    const baseCreateMaintenanceCustomer = createMaintenanceCustomer;
    createMaintenanceCustomer = function(input) {
      const request = unpackPmosMaintenanceContactsEnvelope_(input);
      const accountContacts = typeof normalizePmosAccountContacts_ === 'function'
        ? normalizePmosAccountContacts_(request.accountContacts || []) : [];
      const locationContacts = typeof normalizePmosServiceLocationContacts_ === 'function'
        ? normalizePmosServiceLocationContacts_(request.serviceLocationContacts || []) : [];
      const result = baseCreateMaintenanceCustomer(request);
      result.warnings = Array.isArray(result.warnings) ? result.warnings : [];

      if (typeof syncPmosAccountContactsToGoogle_ === 'function') {
        try {
          const accountResult = syncPmosAccountContactsToGoogle_(result.customerId, accountContacts);
          result.accountContacts = accountResult.contacts || accountContacts;
          (accountResult.warnings || []).forEach(function(warning) { result.warnings.push(warning); });
        } catch (error) {
          result.warnings.push('Maintenance customer was saved, but Account Contacts could not be synchronized: ' +
            String(error && error.message ? error.message : error));
        }
      }

      if (typeof saveAndSyncPmosServiceLocationContacts_ === 'function') {
        try {
          const locationResult = saveAndSyncPmosServiceLocationContacts_(result.customerId, locationContacts);
          result.serviceLocationContacts = locationResult.contacts || locationContacts;
          if (locationResult.errors && locationResult.errors.length) {
            result.warnings.push(locationResult.errors.length +
              ' Service Location Contact Google update(s) could not be completed.');
          }
        } catch (error) {
          result.warnings.push('Maintenance customer was saved, but Service Location Contacts could not be synchronized: ' +
            String(error && error.message ? error.message : error));
        }
      }
      return result;
    };
  }

  if (typeof pmosCustomerEquipmentEditorStyles_ === 'function') {
    const baseStyles = pmosCustomerEquipmentEditorStyles_;
    pmosCustomerEquipmentEditorStyles_ = function() {
      return baseStyles() +
        '.pmos-maint-contact-section{grid-column:1/-1;display:grid;gap:9px;margin-top:4px;padding-top:12px;border-top:1px solid #d9e1e5}' +
        '.pmos-maint-contact-section h3{margin:0;color:#293944;font-size:13px;font-weight:900}' +
        '.pmos-maint-contact-section p{margin:0;color:#68747a;font-size:10px;line-height:1.45}' +
        '.pmos-maint-contact-list{display:grid;gap:9px}' +
        '.pmos-maint-contact-card{position:relative;padding:28px 11px 11px;border:1px solid #d5e0e5;border-radius:9px;background:#f7fafb}' +
        '.pmos-maint-contact-card.primary{background:#e7ecef;border-color:#b8c7ce}' +
        '.pmos-maint-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}' +
        '.pmos-maint-contact-grid .wide{grid-column:1/-1}' +
        '.pmos-maint-contact-grid label{display:grid;gap:5px;color:#6f7d84;font-size:10px;font-weight:900;letter-spacing:.05em;text-transform:uppercase}' +
        '.pmos-maint-contact-grid input,.pmos-maint-contact-grid select,.pmos-maint-contact-grid textarea{width:100%;min-height:38px;padding:8px 9px;border:1px solid #bfcbd1;border-radius:7px;background:#fff;color:#293944;font:inherit}' +
        '.pmos-maint-contact-grid textarea{min-height:62px;resize:vertical}' +
        '.pmos-maint-contact-badge{position:absolute;left:34px;top:6px;padding:2px 7px;border-radius:999px;background:#d3dee3;color:#344c58;font-size:8px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}' +
        '.pmos-maint-contact-drag{position:absolute;left:9px;top:6px;border:0;background:transparent;color:#667780;font-size:14px;cursor:grab;line-height:1}' +
        '.pmos-maint-contact-remove{position:absolute;right:8px;top:5px;border:0;background:transparent;color:#7a878d;font-size:17px;cursor:pointer}' +
        '.pmos-maint-contact-add{justify-self:start;width:auto!important;min-height:30px!important;padding:6px 9px!important;border:1px solid #9db6c1!important;border-radius:7px!important;background:#fff!important;color:#0f5470!important;font:inherit!important;font-size:10px!important;font-weight:900!important;cursor:pointer}' +
        '.pmos-maint-contact-card.pmos-dragging{opacity:.52}' +
        '@media(max-width:760px){.pmos-maint-contact-grid{grid-template-columns:1fr}.pmos-maint-contact-grid .wide{grid-column:1}}';
    };
  }

  if (typeof pmosCustomerEquipmentEditorScript_ !== 'function') return;
  const baseScript = pmosCustomerEquipmentEditorScript_;
  pmosCustomerEquipmentEditorScript_ = function() {
    return baseScript() + String.raw`
(function(){
  var MAINT_CONTACT_PREFIX='PMOS_MAINT_CONTACTS_V1:';
  var draggedMaintAccountCard=null;
  var maintRoleSequence=0;
  var ACCOUNT_ROLES=['Spouse','Partner','Parent','Child','Sibling','Family Member','Caregiver','Billing Contact','Property Manager','Account Manager','Assistant','Other'];
  var LOCATION_ROLES=['Tenant','Property Manager','Superintendent','Keyholder','Site Contact','Caregiver','Family Member','Other'];

  function titleInput(input){if(!input)return;if(window.pmosTitleCaseInput)window.pmosTitleCaseInput(input);else input.value=String(input.value||'').replace(/(^|[\s'’-])([a-zà-öø-ÿ])/g,function(m,p,l){return p+l.toUpperCase()})}
  function formatMaintPhone(input){if(!input)return;if(typeof formatPmosPhoneInput==='function'){formatPmosPhoneInput(input);return}var digits=String(input.value||'').replace(/\D/g,'').slice(0,10),value='';if(digits.length)value='('+digits.slice(0,3);if(digits.length>=3)value+=') '+digits.slice(3,6);if(digits.length>=6)value+=' - '+digits.slice(6,10);input.value=value}
  function maintenanceScope(){return document.getElementById('view-addmaintenance')||(document.getElementById('frequency')&&document.getElementById('recommendations')&&document.getElementById('saveButton')?document.body:null)}
  function ids(scope){var web=!!(scope&&scope.id==='view-addmaintenance');return web?{last:'amLastName',first:'amFirstName',phone:'amPhone',email:'amEmail',notes:'amNotes',save:'amCreateButton'}:{last:'lastName',first:'firstName',phone:'phone',email:'email',notes:'notes',save:'saveButton'}}
  function escMaint(value){return String(value==null?'':value).replace(/[&<>\"]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]})}
  function roleOptions(values){return values.map(function(value){return '<option value="'+escMaint(value)+'">'+escMaint(value)+'</option>'}).join('')}
  function field(label,key,type,options){var control=type==='select'?'<select data-maint-contact="'+key+'"><option value="">Select</option>'+roleOptions(options||[])+'</select>':type==='textarea'?'<textarea data-maint-contact="'+key+'"></textarea>':'<input data-maint-contact="'+key+'" '+(key==='email'?'type="email" autocomplete="email"':key==='phone'?'autocomplete="tel" inputmode="tel"':'')+'>';return '<label class="'+(type==='textarea'?'wide':'')+'">'+label+control+'</label>'}
  function makeAdditionalCard(kind){var card=document.createElement('div'),account=kind==='account';card.className='pmos-maint-contact-card';card.dataset.contactKind=kind;card.draggable=account;card.innerHTML=(account?'<button type="button" class="pmos-maint-contact-drag" aria-label="Drag to reorder contacts">☰</button>':'')+'<button type="button" class="pmos-maint-contact-remove" aria-label="Remove contact">×</button><div class="pmos-maint-contact-grid">'+field('Last name','lastName','input')+field('First name','firstName','input')+field('Role / relationship','role','select',account?ACCOUNT_ROLES:LOCATION_ROLES)+field('Phone','phone','input')+field('Email','email','input')+field('Contact Notes','notes','textarea')+'</div>';card.querySelector('.pmos-maint-contact-remove').onclick=function(){card.remove()};var last=card.querySelector('[data-maint-contact="lastName"]'),first=card.querySelector('[data-maint-contact="firstName"]'),phone=card.querySelector('[data-maint-contact="phone"]');[last,first].forEach(function(input){input.addEventListener('input',function(){titleInput(input)})});phone.addEventListener('input',function(){formatMaintPhone(phone)});if(account)bindAccountDrag(card);return card}
  function readCard(card){function read(key){var input=card.querySelector('[data-maint-contact="'+key+'"]');return input?String(input.value||'').trim():''}return{firstName:read('firstName'),lastName:read('lastName'),role:read('role'),phone:read('phone'),email:read('email'),notes:read('notes')}}
  function writeCard(card,data){['firstName','lastName','role','phone','email','notes'].forEach(function(key){var input=card.querySelector('[data-maint-contact="'+key+'"]');if(input)input.value=data&&data[key]||''})}
  function readPrimary(card){function read(key){var input=card.querySelector('[data-maint-primary="'+key+'"]');return input?String(input.value||'').trim():''}return{firstName:read('firstName'),lastName:read('lastName'),role:'Account Holder',phone:read('phone'),email:read('email'),notes:''}}
  function writePrimary(card,data){['firstName','lastName','phone','email'].forEach(function(key){var input=card.querySelector('[data-maint-primary="'+key+'"]');if(!input)return;input.value=data&&data[key]||'';input.dispatchEvent(new Event('input',{bubbles:true}))})}
  function swapPrimary(primary,additional){var old=readPrimary(primary),next=readCard(additional);writePrimary(primary,next);writeCard(additional,old)}
  function bindAccountDrag(card){if(!card||card.dataset.dragBound==='1')return;card.dataset.dragBound='1';card.addEventListener('dragstart',function(event){draggedMaintAccountCard=card;card.classList.add('pmos-dragging');if(event.dataTransfer)event.dataTransfer.effectAllowed='move'});card.addEventListener('dragend',function(){card.classList.remove('pmos-dragging');draggedMaintAccountCard=null});card.addEventListener('dragover',function(event){event.preventDefault()});card.addEventListener('drop',function(event){event.preventDefault();var dragged=draggedMaintAccountCard;if(!dragged||dragged===card)return;var list=card.parentElement,primary=list&&list.querySelector('.primary');if(!list||!primary)return;if(card===primary){swapPrimary(primary,dragged);return}if(dragged===primary){swapPrimary(primary,card);return}var rect=card.getBoundingClientRect(),before=event.clientY<rect.top+rect.height/2;list.insertBefore(dragged,before?card:card.nextSibling)})}
  function makePrimaryCard(idSet){var card=document.createElement('div');card.className='pmos-maint-contact-card primary';card.draggable=true;card.innerHTML='<button type="button" class="pmos-maint-contact-drag" aria-label="Drag to reorder contacts">☰</button><span class="pmos-maint-contact-badge">Primary Account Contact</span><div class="pmos-maint-contact-grid"></div>';var grid=card.querySelector('.pmos-maint-contact-grid');[['Last name','lastName',idSet.last],['First name','firstName',idSet.first],['Phone','phone',idSet.phone],['Email','email',idSet.email]].forEach(function(config){var input=document.getElementById(config[2]);if(!input)return;input.setAttribute('data-maint-primary',config[1]);var old=input.closest('label');if(old)old.style.display='none';var label=document.createElement('label');label.textContent=config[0];label.appendChild(input);grid.appendChild(label)});bindAccountDrag(card);return card}
  function sectionBefore(scope,needle){var candidates=scope.querySelectorAll('.am-section-title,.section');for(var i=0;i<candidates.length;i++){if(String(candidates[i].textContent||'').toLowerCase().indexOf(needle)>=0)return candidates[i]}return null}
  function installMaintenanceContacts(){var scope=maintenanceScope();if(!scope||scope.querySelector('[data-pmos-maint-contacts]'))return;var idSet=ids(scope),last=document.getElementById(idSet.last),first=document.getElementById(idSet.first);if(!last||!first)return;var section=document.createElement('div');section.className='pmos-maint-contact-section';section.setAttribute('data-pmos-maint-contacts','true');section.innerHTML='<h3>Account Contacts</h3><p>The top card is the primary Account Contact and supplies the customer identity. Drag another Account Contact to the top to make that person primary.</p><div class="pmos-maint-contact-list" data-maint-account-list></div><button type="button" class="pmos-maint-contact-add" data-add-maint-account>+ Add Account Contact</button><h3 style="margin-top:7px">Service Location Contacts</h3><p>Optional contacts for this property only.</p><div class="pmos-maint-contact-list" data-maint-location-list></div><button type="button" class="pmos-maint-contact-add" data-add-maint-location>+ Add Service Location Contact</button>';var anchor=sectionBefore(scope,'maintenance schedule')||sectionBefore(scope,'additional client details');if(anchor)anchor.parentNode.insertBefore(section,anchor);else scope.appendChild(section);var list=section.querySelector('[data-maint-account-list]');list.appendChild(makePrimaryCard(idSet));section.querySelector('[data-add-maint-account]').onclick=function(){var card=makeAdditionalCard('account');list.appendChild(card);var focus=card.querySelector('[data-maint-contact="lastName"]');if(focus)focus.focus()};section.querySelector('[data-add-maint-location]').onclick=function(){var target=section.querySelector('[data-maint-location-list]'),card=makeAdditionalCard('location');target.appendChild(card);var focus=card.querySelector('[data-maint-contact="lastName"]');if(focus)focus.focus()}}
  function collectContacts(scope,kind){var selector=kind==='account'?'[data-maint-account-list] .pmos-maint-contact-card:not(.primary)':'[data-maint-location-list] .pmos-maint-contact-card';return Array.prototype.map.call(scope.querySelectorAll(selector),readCard).filter(function(contact){return contact.firstName||contact.lastName||contact.role||contact.phone||contact.email||contact.notes})}
  function normalizeVisibleNotes(raw){var value=String(raw||'');if(value.indexOf('PMOS_CONTEXT_NOTES_V1:')===0){try{var parsed=JSON.parse(decodeURIComponent(value.slice('PMOS_CONTEXT_NOTES_V1:'.length)));return String(parsed.generalNotes||'')}catch(ignored){}}if(value.indexOf(MAINT_CONTACT_PREFIX)===0){try{var contact=JSON.parse(decodeURIComponent(value.slice(MAINT_CONTACT_PREFIX.length)));return normalizeVisibleNotes(contact.notes||'')}catch(ignored){}}return value}
  function packMaintenanceContacts(button){var scope=maintenanceScope();if(!scope||!scope.contains(button))return;var idSet=ids(scope);if(button.id!==idSet.save)return;var notes=document.getElementById(idSet.notes);if(!notes)return;var previous=String(notes.value||''),payload={notes:previous,accountContacts:collectContacts(scope,'account'),serviceLocationContacts:collectContacts(scope,'location')};notes.value=MAINT_CONTACT_PREFIX+encodeURIComponent(JSON.stringify(payload));var visible=normalizeVisibleNotes(previous);setTimeout(function(){if(String(notes.value||'').indexOf(MAINT_CONTACT_PREFIX)===0||String(notes.value||'').indexOf('PMOS_CONTEXT_NOTES_V1:')===0)notes.value=visible},0)}
  document.addEventListener('click',function(event){var button=event.target&&event.target.closest&&event.target.closest('button');if(button)packMaintenanceContacts(button)},true);
  function sweep(){installMaintenanceContacts()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sweep);else sweep();document.addEventListener('pmos:viewchange',function(event){if(!event.detail||event.detail.name==='addmaintenance')setTimeout(sweep,0)});setInterval(sweep,500);
})();
`;
  };
})();
