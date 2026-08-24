/**
 * Customer form polish and categorized service notes.
 *
 * This compatibility layer keeps the existing spreadsheet-first customer model intact
 * while standardizing account-name display, note categories, body/equipment notes,
 * solar-heating equipment, manual route controls, and the Add Service Location handoff.
 */
function ensurePmosCustomerCategorizedNotes_() {
  return ensurePmosCustomerContextNotesTable_().table;
}

function readPmosCustomerCategorizedNotes_(customerId) {
  const id = String(customerId || '').trim();
  if (!id) return {generalNotes: '', openingNotes: '', closingNotes: '', maintenanceNotes: ''};
  const notes = getPmosCustomerContextNotes_(id);
  return {
    generalNotes: notes.generalNotes,
    openingNotes: notes.openingNotes,
    closingNotes: notes.closingNotes,
    maintenanceNotes: notes.maintenanceNotes
  };
}

function savePmosCustomerCategorizedNotes_(customerId, input) {
  const request = input || {};
  const has = function(key) { return Object.prototype.hasOwnProperty.call(request, key); };
  const clean = function(value, limit) { return String(value == null ? '' : value).trim().slice(0, limit || 10000); };
  const notes = {};
  if (has('generalNotes') || has('notes')) {
    notes.generalNotes = clean(has('generalNotes') ? request.generalNotes : request.notes, 10000);
  }
  if (has('openingNotes')) {
    notes.openingNotes = clean(request.openingNotes, 10000);
  }
  if (has('closingNotes')) {
    notes.closingNotes = clean(request.closingNotes, 10000);
  }
  if (has('maintenanceNotes')) {
    notes.maintenanceNotes = clean(request.maintenanceNotes, 10000);
  }
  savePmosCustomerContextNotes_(customerId, notes);
  return readPmosCustomerCategorizedNotes_(customerId);
}

function pmosCustomerNotesRequest_(input) {
  const request = Object.assign({}, input || {});
  if (Object.prototype.hasOwnProperty.call(request, 'generalNotes')) request.notes = request.generalNotes;
  return request;
}

function normalizePmosSolarEquipment_(input) {
  return (Array.isArray(input) ? input : []).slice(0, 20).map(function(item) {
    const source = item || {};
    return {
      type: String(source.type || 'OTHER').trim().slice(0, 80),
      make: String(source.make || '').trim().slice(0, 160),
      model: String(source.model || '').trim().slice(0, 180),
      modelNumber: String(source.modelNumber || '').trim().slice(0, 160),
      quantity: String(source.quantity || '').trim().slice(0, 40),
      notes: String(source.notes || '').trim().slice(0, 1000)
    };
  }).filter(function(item) {
    return item.type || item.make || item.model || item.modelNumber || item.quantity || item.notes;
  });
}

function pmosCustomerFormEnhancementStyles_() {
  return '.pmos-note-field textarea,.pmos-equipment-notes textarea,.pmos-solar-equipment-card textarea{min-height:70px;resize:vertical}.pmos-equipment-notes{grid-column:1/-1;margin-top:10px;padding-top:10px;border-top:1px solid #dce5e8}.pmos-equipment-notes label{display:flex;flex-direction:column;gap:5px;color:#6f7d84;font-size:10px;font-weight:900;letter-spacing:.07em;text-transform:uppercase}.pmos-equipment-notes textarea{width:100%;padding:9px 10px;border:1px solid #bfcbd1;border-radius:7px;background:#fff;color:#293944;font:inherit;outline:none}.pmos-solar-panel{display:none;grid-column:1/-1;margin-top:9px;padding:10px;border:1px solid #c9dde6;border-radius:9px;background:#f7fafb}.pmos-solar-panel.open{display:block}.pmos-solar-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.pmos-solar-title{font-size:11px;font-weight:900}.pmos-solar-help{margin-top:4px;color:#687a83;font-size:10px;line-height:1.4}.pmos-solar-add{width:auto;margin-top:9px;padding:7px 9px;border:1px solid #9db6c1;border-radius:7px;background:#fff;color:#0f5470;font:inherit;font-size:11px;font-weight:900}.pmos-solar-list{display:grid;gap:8px;margin-top:9px}.pmos-solar-equipment-card{padding:9px;border:1px solid #d5e0e5;border-radius:8px;background:#fff}.pmos-solar-equipment-head{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-bottom:8px;font-size:11px;font-weight:900}.pmos-solar-equipment-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.pmos-solar-equipment-grid label{display:flex;flex-direction:column;gap:5px;color:#6f7d84;font-size:9px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.pmos-solar-equipment-grid input,.pmos-solar-equipment-grid textarea{width:100%;padding:8px 9px;border:1px solid #bfcbd1;border-radius:7px;background:#fff;color:#293944;font:inherit}.pmos-solar-equipment-grid .wide{grid-column:1/-1}.pmos-customer-contact-divider{height:1px;margin:13px 0;background:#e1e7ea}.pmos-add-location-after-primary{margin-left:7px}@media(max-width:760px){.pmos-solar-equipment-grid{grid-template-columns:1fr}.pmos-solar-equipment-grid .wide{grid-column:auto}.pmos-add-location-after-primary{margin-left:0;margin-top:7px}}';
}

function pmosCustomerFormEnhancementScript_() {
  return String.raw`
(function(){
  if(window.__pmosCustomerFormEnhancementsLoaded)return;window.__pmosCustomerFormEnhancementsLoaded=true;
  function q(id){return document.getElementById(id)}
  function text(value){return String(value==null?'':value)}
  function fieldHost(input){if(!input)return null;return input.closest('.field')||input.closest('label')}
  function renameField(input,label){var host=fieldHost(input);if(!host)return;var caption=host.matches('label')?host:host.querySelector('label');if(!caption)return;for(var i=0;i<caption.childNodes.length;i++){if(caption.childNodes[i].nodeType===3&&String(caption.childNodes[i].nodeValue||'').trim()){caption.childNodes[i].nodeValue=label+' ';return}}}
  function makeNoteField(id,label,prototype){var node;if(prototype&&prototype.matches&&prototype.matches('label')){node=document.createElement('label');node.className=(prototype.className||'full')+' pmos-note-field';node.appendChild(document.createTextNode(label));var area=document.createElement('textarea');area.id=id;area.style.font='inherit';node.appendChild(area);return node}node=document.createElement('div');node.className='field wide pmos-note-field';node.innerHTML='<label>'+label+' <span style="font-weight:400;text-transform:none;letter-spacing:0">optional</span><textarea id="'+id+'" style="font:inherit"></textarea></label>';return node}
  function isAddMaintenance(){return !!(q('saveButton')&&q('effectiveDate')&&q('recommendations')&&!q('accountPreview')&&!q('create'))}
  function shouldHaveMaintenanceNotes(){return !!(q('waterMaintenanceToggle')||q('waterMaintenance')||isAddMaintenance())}
  function maintenanceEnabled(){var editor=q('waterMaintenanceToggle'),location=q('waterMaintenance');if(editor)return !!editor.checked;if(location)return !!location.checked;if(isAddMaintenance())return true;var frequency=q('frequency');return !!(frequency&&String(frequency.value||'').trim())}
  function updateMaintenanceNotesVisibility(){var host=q('maintenanceNotesField');if(host)host.style.display=maintenanceEnabled()?'':'none'}
  function installCategorizedNotes(){var notes=q('notes');if(!notes)return;renameField(notes,'General Notes');if(q('openingNotes')){updateMaintenanceNotesVisibility();return}var prototype=fieldHost(notes),parent=prototype&&prototype.parentNode;if(!prototype||!parent)return;var opening=makeNoteField('openingNotes','Opening Notes',prototype),closing=makeNoteField('closingNotes','Closing Notes',prototype);prototype.insertAdjacentElement('afterend',opening);opening.insertAdjacentElement('afterend',closing);if(shouldHaveMaintenanceNotes()){var maintenance=makeNoteField('maintenanceNotes','Maintenance Notes',prototype);maintenance.id='maintenanceNotesField';closing.insertAdjacentElement('afterend',maintenance)}updateMaintenanceNotesVisibility()}
  function applyNotesToPayload(data){data=data||{};var general=q('notes'),opening=q('openingNotes'),closing=q('closingNotes'),maintenance=q('maintenanceNotes');if(general){data.notes=general.value;data.generalNotes=general.value}if(opening)data.openingNotes=opening.value;if(closing)data.closingNotes=closing.value;if(maintenance)data.maintenanceNotes=maintenance.value;return data}
  function hydrateNotes(data){data=data||{};var general=q('notes'),opening=q('openingNotes'),closing=q('closingNotes'),maintenance=q('maintenanceNotes');if(general&&data.generalNotes!=null)general.value=data.generalNotes||'';if(opening)opening.value=data.openingNotes||'';if(closing)closing.value=data.closingNotes||'';if(maintenance)maintenance.value=data.maintenanceNotes||'';updateMaintenanceNotesVisibility()}
  function patchPayloadFunction(name){var original=window[name];if(typeof original!=='function'||original.__pmosCategorizedNotes)return;var wrapped=function(){return applyNotesToPayload(original.apply(this,arguments))};wrapped.__pmosCategorizedNotes=true;window[name]=wrapped}
  function patchFillFunction(){var original=window.fill;if(typeof original!=='function'||original.__pmosCategorizedNotes)return;var wrapped=function(data){var result=original.apply(this,arguments);setTimeout(function(){hydrateNotes(data)},0);return result};wrapped.__pmosCategorizedNotes=true;window.fill=wrapped}
  function ensureEquipmentNotes(card){if(!card||card.querySelector('[data-body-equipment-notes]'))return;var holder=document.createElement('div');holder.className='pmos-equipment-notes';holder.innerHTML='<label>Equipment Notes <span style="font-weight:400;text-transform:none;letter-spacing:0">optional</span><textarea data-body-equipment-notes placeholder="Notes specific to this body of water and its equipment"></textarea></label>';var actions=card.querySelector('.equipment-actions');if(actions&&actions.parentNode)actions.parentNode.insertBefore(holder,actions);else card.appendChild(holder)}
  function solarLabel(type){return{BOOSTER_PUMP:'Booster Pump',VALVE_ACTUATOR:'Valve Actuator',CONTROLLER:'Automation / Controller',OTHER:'Other Equipment'}[type]||'Solar Equipment'}
  function addSolarEquipment(card,type,data){var list=card&&card.querySelector('[data-solar-list]');if(!list)return;data=data||{};var row=document.createElement('div');row.className='pmos-solar-equipment-card';row.setAttribute('data-solar-equipment',type||'OTHER');row.innerHTML='<div class="pmos-solar-equipment-head"><span>'+solarLabel(type)+'</span><button type="button" class="remove-button" data-solar-remove>Remove</button></div><div class="pmos-solar-equipment-grid"><label>Make<input data-solar-field="make"></label><label>Model<input data-solar-field="model"></label><label>Model #<input data-solar-field="modelNumber"></label><label class="pmos-solar-quantity">Quantity<input data-solar-field="quantity" type="number" min="1"></label><label class="wide">Notes<textarea data-solar-field="notes"></textarea></label></div>';['make','model','modelNumber','quantity','notes'].forEach(function(key){var input=row.querySelector('[data-solar-field="'+key+'"]');if(input)input.value=data[key]||''});if(type!=='VALVE_ACTUATOR')row.querySelector('.pmos-solar-quantity').style.display='none';row.querySelector('[data-solar-remove]').onclick=function(){row.remove()};list.appendChild(row)}
  function ensureSolarPanel(card){var panel=card.querySelector('[data-solar-panel]');if(panel)return panel;panel=document.createElement('div');panel.className='pmos-solar-panel';panel.setAttribute('data-solar-panel','true');panel.innerHTML='<div class="pmos-solar-head"><div><div class="pmos-solar-title">Solar heating equipment</div><div class="pmos-solar-help">Solar itself usually does not need a make or model. Add only the equipment that operates or controls the solar system.</div></div></div><select class="pmos-solar-add" data-solar-add><option value="" selected>+ Add Equipment</option><option value="BOOSTER_PUMP">Booster Pump</option><option value="VALVE_ACTUATOR">Valve Actuator</option><option value="CONTROLLER">Automation / Controller</option><option value="OTHER">Other Equipment</option></select><div class="pmos-solar-list" data-solar-list></div>';var grid=card.querySelector('.body-grid');if(grid)grid.appendChild(panel);else card.appendChild(panel);panel.querySelector('[data-solar-add]').onchange=function(){if(!this.value)return;addSolarEquipment(card,this.value,{});this.value=''};return panel}
  function addSolarTypeOption(input){if(!input)return;var listId=input.getAttribute('list'),list=listId&&document.getElementById(listId);if(list&&!Array.prototype.some.call(list.options,function(option){return String(option.value||'').toLowerCase()==='solar'})){var option=document.createElement('option');option.value='Solar';list.appendChild(option)}}
  function configureSolar(card){if(!card)return;var input=card.querySelector('[data-body-field="heaterType"]');if(!input)return;addSolarTypeOption(input);var solar=String(input.value||'').trim().toLowerCase()==='solar',panel=ensureSolarPanel(card);['heaterMake','heaterModel','heaterModelNumber'].forEach(function(key){var field=card.querySelector('[data-body-field="'+key+'"]'),label=field&&field.closest('label');if(label)label.style.display=solar?'none':''});panel.classList.toggle('open',solar)}
  function ensureBody(card){if(!card)return;ensureEquipmentNotes(card);configureSolar(card);var heater=card.querySelector('[data-body-field="heaterType"]');if(heater&&!heater.__pmosSolarWired){heater.__pmosSolarWired=true;heater.addEventListener('input',function(){configureSolar(card)});heater.addEventListener('change',function(){configureSolar(card)})}}
  function collectSolar(card){return Array.prototype.map.call(card.querySelectorAll('[data-solar-equipment]'),function(row){var read=function(key){var input=row.querySelector('[data-solar-field="'+key+'"]');return input?String(input.value||'').trim():''};return{type:row.getAttribute('data-solar-equipment')||'OTHER',make:read('make'),model:read('model'),modelNumber:read('modelNumber'),quantity:read('quantity'),notes:read('notes')}}).filter(function(item){return item.type||item.make||item.model||item.modelNumber||item.quantity||item.notes})}
  function patchBodies(){if(typeof window.addWaterBody==='function'&&!window.addWaterBody.__pmosFormEnhancement){var addBase=window.addWaterBody,addWrapped=function(){var result=addBase.apply(this,arguments),cards=document.querySelectorAll('.water-body'),card=cards[cards.length-1];ensureBody(card);return result};addWrapped.__pmosFormEnhancement=true;window.addWaterBody=addWrapped}if(typeof window.collectWaterBodies==='function'&&!window.collectWaterBodies.__pmosFormEnhancement){var collectBase=window.collectWaterBodies,collectWrapped=function(){var bodies=collectBase.apply(this,arguments)||[],cards=document.querySelectorAll('.water-body');Array.prototype.forEach.call(cards,function(card,index){if(!bodies[index])return;var notes=card.querySelector('[data-body-equipment-notes]');bodies[index].equipmentNotes=notes?String(notes.value||'').trim():'';bodies[index].heater=bodies[index].heater||{};if(String(bodies[index].heater.type||'').toLowerCase()==='solar')bodies[index].heater.solarEquipment=collectSolar(card)});return bodies};collectWrapped.__pmosFormEnhancement=true;window.collectWaterBodies=collectWrapped}if(typeof window.hydrateBodies==='function'&&!window.hydrateBodies.__pmosFormEnhancement){var hydrateBase=window.hydrateBodies,hydrateWrapped=function(bodies){var result=hydrateBase.apply(this,arguments),rows=bodies||[],cards=document.querySelectorAll('.water-body');Array.prototype.forEach.call(cards,function(card,index){ensureBody(card);var body=rows[index]||{},notes=card.querySelector('[data-body-equipment-notes]');if(notes)notes.value=body.equipmentNotes||'';configureSolar(card);var list=card.querySelector('[data-solar-list]');if(list)list.innerHTML='';var solar=body.heater&&body.heater.solarEquipment||[];(solar||[]).forEach(function(item){addSolarEquipment(card,item.type,item)})});return result};hydrateWrapped.__pmosFormEnhancement=true;window.hydrateBodies=hydrateWrapped}Array.prototype.forEach.call(document.querySelectorAll('.water-body'),ensureBody)}
  function mergeAddCustomerContactCards(){if(!q('accountPreview'))return;var sections=document.querySelectorAll('.section-card');if(sections.length<2)return;var identity=sections[0],contacts=sections[1],identityTitle=identity.querySelector('.section-head h3'),identityCopy=identity.querySelector('.section-head p');if(!identityTitle||String(identityTitle.textContent||'').trim()!=='Customer Identity')return;identityTitle.textContent='Customer Contact Info';if(identityCopy)identityCopy.textContent='Account identity and contact information.';var contactHead=contacts.querySelector('.section-head');if(contactHead)contactHead.remove();var divider=document.createElement('div');divider.className='pmos-customer-contact-divider';identity.appendChild(divider);while(contacts.firstChild)identity.appendChild(contacts.firstChild);contacts.remove();if(typeof window.updateAccountPreview==='function'){var preview=function(){var first=String(q('firstName')&&q('firstName').value||'').trim(),last=String(q('lastName')&&q('lastName').value||'').trim(),name=[first,last].filter(Boolean).join(' ')||'—';q('accountPreview').textContent='Account: '+name};window.updateAccountPreview=preview;preview()}}
  function renameCustomerContactSections(){Array.prototype.forEach.call(document.querySelectorAll('.section-head h3,.section'),function(node){var value=String(node.textContent||'').trim().toLowerCase();if(value==='customer & contact information'||value==='account & contact information'||value==='customer information')node.textContent='Customer Contact Info'});var last=q('lastName');if(last)renameField(last,'Last Name')}
  function renameBodyButtons(){Array.prototype.forEach.call(document.querySelectorAll('button'),function(button){if(/add another body of water/i.test(String(button.textContent||'')))button.textContent='+ Add Body of Water'});Array.prototype.forEach.call(document.querySelectorAll('.water-body-helper,.muted'),function(node){if(/enter the main body first, then add another body/i.test(String(node.textContent||'')))node.textContent='Enter the main body first, then add a body of water or specialized equipment only when needed.'})}
  function installAddServiceLocationHandoff(){if(!isAddMaintenance()||q('addServiceLocationAfterPrimary'))return;var addBody=q('addBodyButton');if(!addBody)return;var button=document.createElement('button');button.id='addServiceLocationAfterPrimary';button.type='button';button.className=(addBody.className||'inline-button')+' pmos-add-location-after-primary';button.textContent='+ Add Service Location';addBody.insertAdjacentElement('afterend',button);button.onclick=function(){var started=Date.now(),opened=false;function openWhenReady(){if(opened)return;if(window.savedCustomer&&savedCustomer.customerId){opened=true;button.disabled=true;button.textContent='Opening…';google.script.run.withSuccessHandler(function(){setTimeout(function(){google.script.host.close()},250)}).withFailureHandler(function(error){opened=false;button.disabled=false;button.textContent='+ Add Service Location';var status=q('status');if(status){status.className='status error';status.textContent=error&&error.message?error.message:String(error)}}).showPmosAddServiceLocation(savedCustomer.customerId);return}if(Date.now()-started>120000){clearInterval(timer);button.disabled=false;button.textContent='+ Add Service Location'}else if(Date.now()-started>1800){var save=q('saveButton');if(save&&!save.disabled&&!window.savedCustomer){clearInterval(timer);button.disabled=false;button.textContent='+ Add Service Location'}}}var save=q('saveButton');button.disabled=true;button.textContent='Saving primary customer…';if(window.savedCustomer&&savedCustomer.customerId){openWhenReady();return}if(save&&!save.disabled)save.click();var timer=setInterval(openWhenReady,250);setTimeout(openWhenReady,300)}}
  function installMaintenanceToggleWatcher(){function wire(toggle){if(!toggle||toggle.__pmosNotesWired)return;toggle.__pmosNotesWired=true;toggle.addEventListener('change',function(){setTimeout(updateMaintenanceNotesVisibility,0)});updateMaintenanceNotesVisibility()}wire(q('waterMaintenanceToggle'));wire(q('waterMaintenance'));var observer=new MutationObserver(function(){wire(q('waterMaintenanceToggle'));wire(q('waterMaintenance'));if(!q('maintenanceNotesField')&&q('notes'))installCategorizedNotes()});observer.observe(document.body,{childList:true,subtree:true})}
  function patchEverything(){installCategorizedNotes();patchBodies();patchPayloadFunction('formValues');patchPayloadFunction('addCustomerPayload');patchPayloadFunction('payload');patchPayloadFunction('collect');patchFillFunction();mergeAddCustomerContactCards();renameCustomerContactSections();renameBodyButtons();installAddServiceLocationHandoff();installMaintenanceToggleWatcher();updateMaintenanceNotesVisibility()}
  document.addEventListener('DOMContentLoaded',function(){patchEverything();setTimeout(patchEverything,80);setTimeout(patchEverything,500)});
})();
`;
}

function pmosRouteManualUiStyles_() {
  return '.pmos-manual-route-toggle{display:inline-block;margin:9px 0;padding:0;border:0;background:transparent;color:#176b90;font:inherit;font-size:11px;font-weight:900;cursor:pointer}';
}

function pmosRouteManualUiScript_() {
  return String.raw`
(function(){
  if(window.__pmosManualRouteUiLoaded)return;window.__pmosManualRouteUiLoaded=true;
  function normalizeToggle(toggle,panel){if(!toggle||!panel)return;var update=function(){var visible=panel.style.display!=='none'&&getComputedStyle(panel).display!=='none';toggle.textContent=visible?'Hide manual placement':'Select manually'};toggle.addEventListener('click',function(){setTimeout(update,0)});update()}
  function setup(){var editor=document.getElementById('manualRouteToggle'),editorPanel=document.getElementById('manualRoutePanel');if(editor&&editorPanel)normalizeToggle(editor,editorPanel);var location=document.getElementById('manualToggle'),locationPanel=document.getElementById('manual');if(location&&locationPanel)normalizeToggle(location,locationPanel);var panels=Array.prototype.slice.call(document.querySelectorAll('.manual'));panels.forEach(function(panel){if(panel.id==='manual'||panel.querySelector('#manualDay'))return;if(!panel.querySelector('#day')||document.getElementById('pmosManualRouteToggle'))return;panel.style.display='none';var toggle=document.createElement('button');toggle.id='pmosManualRouteToggle';toggle.type='button';toggle.className='pmos-manual-route-toggle';toggle.textContent='Select manually';panel.parentNode.insertBefore(toggle,panel);toggle.onclick=function(){var show=panel.style.display==='none';panel.style.display=show?'block':'none';toggle.textContent=show?'Hide manual placement':'Select manually'}})}
  document.addEventListener('DOMContentLoaded',function(){setup();setTimeout(setup,100)});
})();
`;
}

function pmosCustomerProfileEnhancementScript_() {
  let script = String.raw`
(function(){
  if(window.__pmosProfileEnhancementLoaded||typeof renderProfile!=='function')return;window.__pmosProfileEnhancementLoaded=true;
  var baseRenderProfile=renderProfile;
  renderProfile=function(profile){baseRenderProfile(profile);profile=profile||{};var first=String(profile.firstName||'').trim(),last=String(profile.lastName||'').trim(),display=[first,last].filter(Boolean).join(' ')||profile.accountName||profile.displayName;if(document.getElementById('profileName'))document.getElementById('profileName').textContent=display;if(document.getElementById('avatar')&&typeof initials==='function')document.getElementById('avatar').textContent=initials(display);Array.prototype.forEach.call(document.querySelectorAll('.card .label'),function(label){if(String(label.textContent||'').trim().toLowerCase()==='customer notes')label.textContent='General notes'});var content=document.getElementById('content'),notes=content&&content.querySelector('.notes'),extra=[];if(profile.openingNotes)extra.push(card('Opening notes',profile.openingNotes));if(profile.closingNotes)extra.push(card('Closing notes',profile.closingNotes));if(profile.maintenanceNotes&&(profile.frequency||(profile.routes||[]).length))extra.push(card('Maintenance notes',profile.maintenanceNotes));if(extra.length){if(!notes){var head=document.createElement('div');head.className='section-head';head.innerHTML='<h3>Customer details</h3>';notes=document.createElement('div');notes.className='notes';content.insertBefore(head,document.getElementById('editorNote'));content.insertBefore(notes,document.getElementById('editorNote'))}notes.insertAdjacentHTML('beforeend',extra.join(''));notes.classList.toggle('single',notes.children.length===1)}(profile.bodiesOfWater||[]).forEach(function(body){if(!body)return;var title=String(body.name||body.type||''),summary=null;Array.prototype.some.call(content.querySelectorAll('.summary-card'),function(cardNode){var titleNode=cardNode.querySelector('.summary-title');if(titleNode&&String(titleNode.textContent||'')===title){summary=cardNode;return true}return false});if(!summary)return;var details=summary.querySelector('.summary-details');if(!details)return;if(body.equipmentNotes){var note=document.createElement('div');note.className='equipment-item';note.innerHTML='<b>Equipment Notes</b> · '+esc(body.equipmentNotes);details.appendChild(note)}var solar=body.heater&&body.heater.solarEquipment||[];if(solar.length){var list=document.createElement('div');list.className='equipment-list';list.innerHTML=solar.map(function(item){var label={BOOSTER_PUMP:'Booster Pump',VALVE_ACTUATOR:'Valve Actuator',CONTROLLER:'Automation / Controller',OTHER:'Other Equipment'}[item.type]||'Solar Equipment',detailText=[item.make,item.model,item.modelNumber,item.quantity?('Qty '+item.quantity):'',item.notes].filter(Boolean).join(' · ');return '<div class="equipment-item"><b>Solar · '+esc(label)+'</b>'+(detailText?' · '+esc(detailText):'')+'</div>'}).join('');details.appendChild(list)}});if(typeof fitContactValues==='function')fitContactValues()};
})();
`;
  if (typeof pmosCustomerLifecycleProfileEnhancementScript_ === 'function') {
    script += pmosCustomerLifecycleProfileEnhancementScript_();
  }
  return script;
}

(function () {
  if (typeof getPmosCustomerAccount_ === 'function') {
    const baseGetPmosCustomerAccount = getPmosCustomerAccount_;
    getPmosCustomerAccount_ = function(customerId) {
      const account = baseGetPmosCustomerAccount(customerId);
      const firstName = String(account.firstName || '').trim();
      const lastName = String(account.lastName || '').trim();
      account.accountName = [firstName, lastName].filter(Boolean).join(' ') || lastName || firstName || account.accountId;
      return account;
    };
  }

  if (typeof normalizePmosCustomerEditorBodies_ === 'function') {
    const baseNormalizePmosCustomerEditorBodies = normalizePmosCustomerEditorBodies_;
    normalizePmosCustomerEditorBodies_ = function(input) {
      const source = Array.isArray(input) ? input : [];
      const bodies = baseNormalizePmosCustomerEditorBodies(input);
      bodies.forEach(function(body, index) {
        const raw = source[index] || {};
        body.equipmentNotes = String(raw.equipmentNotes || '').trim().slice(0, 5000);
        body.heater = Object.assign({}, body.heater || {});
        const solarEquipment = normalizePmosSolarEquipment_(raw.heater && raw.heater.solarEquipment);
        if (solarEquipment.length || /^solar$/i.test(String(body.heater.type || ''))) {
          body.heater.solarEquipment = solarEquipment;
        }
      });
      return bodies;
    };
  }

  if (typeof getPmosCustomerAccountProfile === 'function') {
    const baseGetPmosCustomerAccountProfile = getPmosCustomerAccountProfile;
    getPmosCustomerAccountProfile = function(customerId) {
      const profile = baseGetPmosCustomerAccountProfile(customerId);
      const notes = readPmosCustomerCategorizedNotes_(customerId);
      profile.generalNotes = notes.generalNotes;
      profile.notes = notes.generalNotes;
      profile.openingNotes = notes.openingNotes;
      profile.closingNotes = notes.closingNotes;
      profile.maintenanceNotes = notes.maintenanceNotes;
      return profile;
    };
  }

  if (typeof getPmosCustomerAccountEditorData === 'function') {
    const baseGetPmosCustomerAccountEditorData = getPmosCustomerAccountEditorData;
    getPmosCustomerAccountEditorData = function(customerId) {
      const data = baseGetPmosCustomerAccountEditorData(customerId);
      const notes = readPmosCustomerCategorizedNotes_(customerId);
      data.generalNotes = notes.generalNotes;
      data.notes = notes.generalNotes;
      data.openingNotes = notes.openingNotes;
      data.closingNotes = notes.closingNotes;
      data.maintenanceNotes = notes.maintenanceNotes;
      return data;
    };
  }

  if (typeof createPmosCustomerAccount === 'function') {
    const baseCreatePmosCustomerAccount = createPmosCustomerAccount;
    createPmosCustomerAccount = function(input) {
      const request = pmosCustomerNotesRequest_(input);
      ensurePmosCustomerCategorizedNotes_();
      const result = baseCreatePmosCustomerAccount(request);
      savePmosCustomerCategorizedNotes_(result.customerId, request);
      result.profile = getPmosCustomerAccountProfile(result.customerId);
      return result;
    };
  }

  if (typeof createMaintenanceCustomer === 'function') {
    const baseCreateMaintenanceCustomer = createMaintenanceCustomer;
    createMaintenanceCustomer = function(input) {
      const request = pmosCustomerNotesRequest_(input);
      ensurePmosCustomerCategorizedNotes_();
      const result = baseCreateMaintenanceCustomer(request);
      savePmosCustomerCategorizedNotes_(result.customerId, request);
      return result;
    };
  }

  if (typeof createPmosAdditionalServiceLocationForAccountWithLocationContactsAndBilling === 'function') {
    const baseCreatePmosAdditionalServiceLocationWithNotes = createPmosAdditionalServiceLocationForAccountWithLocationContactsAndBilling;
    createPmosAdditionalServiceLocationForAccountWithLocationContactsAndBilling = function(input) {
      const request = pmosCustomerNotesRequest_(input);
      ensurePmosCustomerCategorizedNotes_();
      const result = baseCreatePmosAdditionalServiceLocationWithNotes(request);
      savePmosCustomerCategorizedNotes_(result.customerId, request);
      result.profile = getPmosCustomerAccountProfile(result.customerId);
      return result;
    };
  }

  if (typeof savePmosCustomerAccountEditorDataWithWaterMaintenance === 'function') {
    const baseSavePmosCustomerAccountWithNotes = savePmosCustomerAccountEditorDataWithWaterMaintenance;
    savePmosCustomerAccountEditorDataWithWaterMaintenance = function(input) {
      const request = pmosCustomerNotesRequest_(input);
      ensurePmosCustomerCategorizedNotes_();
      const result = baseSavePmosCustomerAccountWithNotes(request);
      savePmosCustomerCategorizedNotes_(result.customerId || request.customerId, request);
      result.profile = getPmosCustomerAccountProfile(result.customerId || request.customerId);
      return result;
    };
  }

  if (typeof pmosCustomerEquipmentEditorStyles_ === 'function') {
    const baseEquipmentStyles = pmosCustomerEquipmentEditorStyles_;
    pmosCustomerEquipmentEditorStyles_ = function() {
      return baseEquipmentStyles() + pmosCustomerFormEnhancementStyles_();
    };
  }

  if (typeof pmosCustomerEquipmentEditorScript_ === 'function') {
    const baseEquipmentScript = pmosCustomerEquipmentEditorScript_;
    pmosCustomerEquipmentEditorScript_ = function() {
      return baseEquipmentScript() + pmosCustomerFormEnhancementScript_();
    };
  }

  if (typeof pmosRouteRecommendationCardStyles_ === 'function') {
    const baseRouteStyles = pmosRouteRecommendationCardStyles_;
    pmosRouteRecommendationCardStyles_ = function() {
      return baseRouteStyles() + pmosRouteManualUiStyles_();
    };
  }

  if (typeof pmosRouteRecommendationCardScript_ === 'function') {
    const baseRouteScript = pmosRouteRecommendationCardScript_;
    pmosRouteRecommendationCardScript_ = function() {
      return baseRouteScript() + pmosRouteManualUiScript_();
    };
  }

  if (typeof pmosAccountTerminologyText_ === 'function') {
    const baseAccountTerminologyText = pmosAccountTerminologyText_;
    pmosAccountTerminologyText_ = function(value) {
      let output = baseAccountTerminologyText(value);
      if (typeof output === 'string' && output.indexOf('id="profileName"') >= 0 &&
          output.indexOf('__pmosProfileEnhancementLoaded') < 0 &&
          output.indexOf('</script></body></html>') >= 0) {
        output = output.replace('</script></body></html>', pmosCustomerProfileEnhancementScript_() + '\n</script></body></html>');
      }
      return output;
    };
  }
})();
