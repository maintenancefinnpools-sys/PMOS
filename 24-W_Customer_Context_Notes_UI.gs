/** Shared contextual-notes UI/compatibility bridge for Sheets and Web forms. */
const PMOS_CONTEXT_NOTES_ENVELOPE_PREFIX_ = 'PMOS_CONTEXT_NOTES_V1:';

function unpackPmosContextNotesEnvelope_(input) {
  const source = Object.assign({}, input || {});
  const raw = String(source.notes == null ? '' : source.notes);
  if (raw.indexOf(PMOS_CONTEXT_NOTES_ENVELOPE_PREFIX_) !== 0) return source;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(PMOS_CONTEXT_NOTES_ENVELOPE_PREFIX_.length)));
    source.generalNotes = String(parsed.generalNotes || '');
    source.equipmentNotes = String(parsed.equipmentNotes || '');
    source.maintenanceNotes = String(parsed.maintenanceNotes || '');
    source.openingNotes = String(parsed.openingNotes || '');
    source.closingNotes = String(parsed.closingNotes || '');
    source.notes = source.generalNotes;
  } catch (ignored) {}
  return source;
}

function packPmosContextNotesEnvelope_(notes) {
  const source = notes || {};
  return PMOS_CONTEXT_NOTES_ENVELOPE_PREFIX_ + encodeURIComponent(JSON.stringify({
    generalNotes: String(source.generalNotes || source.notes || ''),
    equipmentNotes: String(source.equipmentNotes || ''),
    maintenanceNotes: String(source.maintenanceNotes || ''),
    openingNotes: String(source.openingNotes || ''),
    closingNotes: String(source.closingNotes || '')
  }));
}

(function () {
  if (typeof createPmosAdditionalServiceLocationForAccount === 'function') {
    const base = createPmosAdditionalServiceLocationForAccount;
    createPmosAdditionalServiceLocationForAccount = function(input) {
      const request = unpackPmosContextNotesEnvelope_(input);
      const result = base(request);
      try { result.contextNotes = savePmosCustomerContextNotes_(result.customerId, request); }
      catch (error) { result.contextNoteWarning = error && error.message ? error.message : String(error); }
      return result;
    };
  }

  if (typeof getPmosCustomerEditorData === 'function') {
    const base = getPmosCustomerEditorData;
    getPmosCustomerEditorData = function(customerId) {
      const data = base(customerId);
      const notes = getPmosCustomerContextNotes_(customerId);
      Object.keys(notes).forEach(function(key) { data[key] = notes[key]; });
      data.notes = packPmosContextNotesEnvelope_(data);
      return data;
    };
  }

})();

function pmosCustomerContextNotesUiStyles_() {
  return (
        '.pmos-context-note-field{display:grid;gap:5px;margin-top:9px;color:#6f7d84;font-size:10px;font-weight:900;letter-spacing:.05em;text-transform:uppercase}' +
        '.pmos-context-note-field textarea{width:100%;min-height:68px;padding:8px 9px;border:1px solid #bfcbd1;border-radius:7px;background:#fff;color:#293944;font:inherit;resize:vertical}' +
        '.pmos-context-note-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:9px}' +
        '.pmos-context-profile-notes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}' +
        '.pmos-context-profile-note{padding:10px;border:1px solid #d2dade;border-radius:8px;background:#f7fafb}' +
        '.pmos-context-profile-note b{display:block;color:#6f7d84;font-size:9px;text-transform:uppercase}.pmos-context-profile-note div{margin-top:4px;white-space:pre-wrap;font-size:11px;line-height:1.45}' +
        '@media(max-width:760px){.pmos-context-note-grid,.pmos-context-profile-notes{grid-template-columns:1fr}}'
  );
}

function pmosCustomerContextNotesUiScript_() {
  return String.raw`
(function(){
  var CONTEXT_PREFIX='PMOS_CONTEXT_NOTES_V1:';
  var PMOS_NOTE_IDS=['notes','acNotes','amNotes','ceNotes','slNotes'];
  var PMOS_SAVE_IDS=['saveButton','acCreateButton','amCreateButton','ceSave','slCreate'];
  function enc(value){return encodeURIComponent(JSON.stringify(value))}
  function dec(value){try{return JSON.parse(decodeURIComponent(value))}catch(error){return null}}
  function noteScope(node){return node&&node.closest&&node.closest('#view-addcustomer,#view-addmaintenance,#ceBackdrop,#slBackdrop,.shell,body')||document.body}
  function noteInput(scope,key){if(!scope)return null;var ids={equipmentNotes:['ceEquipmentNotes','slEquipmentNotes'],maintenanceNotes:['amMaintenanceNotes','ceMaintenanceNotes','slMaintenanceNotes'],openingNotes:['acOpeningNotes','amOpeningNotes','ceOpeningNotes','slOpeningNotes'],closingNotes:['acClosingNotes','amClosingNotes','ceClosingNotes','slClosingNotes']}[key]||[];var generated=scope.querySelector('[data-pmos-context-note="'+key+'"]');if(generated)return generated;for(var i=0;i<ids.length;i++){var node=scope.querySelector('#'+ids[i]);if(node)return node}return null}
  function generalNotes(scope){for(var i=0;i<PMOS_NOTE_IDS.length;i++){var node=scope.querySelector('#'+PMOS_NOTE_IDS[i]);if(node)return node}return null}
  function renameGeneralLabel(textarea){var label=textarea&&textarea.closest('label');if(!label)return;Array.prototype.some.call(label.childNodes,function(node){if(node.nodeType===3&&/customer\s*\/\s*service notes|customer notes|service notes/i.test(node.nodeValue||'')){node.nodeValue='General Notes ';return true}return false})}
  function makeNoteField(label,key){var wrap=document.createElement('label');wrap.className='pmos-context-note-field';wrap.textContent=label;var area=document.createElement('textarea');area.setAttribute('data-pmos-context-note',key);wrap.appendChild(area);return wrap}
  function equipmentHost(scope){return scope.querySelector('.ac-equipment-shell,.am-equipment-shell,.ce-equipment,.sl-equipment')||scope.querySelector('.water-bodies')}
  function installContextNotesFor(textarea){
    if(!textarea||textarea.dataset.pmosContextNotes==='1')return;textarea.dataset.pmosContextNotes='1';var scope=noteScope(textarea);renameGeneralLabel(textarea);if(scope.matches&&scope.matches('#view-addcustomer,#view-addmaintenance,#ceBackdrop,#slBackdrop'))return;
    // Current Sheets editors install explicit categorized fields and per-body Equipment
    // Notes. The envelope UI below is retained only for genuinely legacy forms.
    if(window.__pmosCustomerFormEnhancementsLoaded)return;
    var host=equipmentHost(scope);if(host&&!scope.querySelector('[data-pmos-context-note="equipmentNotes"]')){var equipment=makeNoteField('Equipment Notes','equipmentNotes');equipment.style.margin='10px';host.insertAdjacentElement('afterend',equipment)}
    if(!scope.querySelector('.pmos-context-note-grid')){var grid=document.createElement('div');grid.className='pmos-context-note-grid';grid.appendChild(makeNoteField('Maintenance Notes','maintenanceNotes'));grid.appendChild(makeNoteField('Opening Notes','openingNotes'));grid.appendChild(makeNoteField('Closing Notes','closingNotes'));var label=textarea.closest('label')||textarea;label.insertAdjacentElement('afterend',grid)}
  }
  function installAllContextNotes(){PMOS_NOTE_IDS.forEach(function(id){var node=document.getElementById(id);if(node)installContextNotesFor(node)})}
  function contextObject(scope){var general=generalNotes(scope);function value(key){var node=noteInput(scope,key);return node?String(node.value||''):''}return{generalNotes:general?String(general.value||''):'',equipmentNotes:value('equipmentNotes'),maintenanceNotes:value('maintenanceNotes'),openingNotes:value('openingNotes'),closingNotes:value('closingNotes')}}
  function packForSubmit(button){var scope=noteScope(button),general=generalNotes(scope);if(!general)return;var object=contextObject(scope),visible=object.generalNotes;general.value=CONTEXT_PREFIX+enc(object);setTimeout(function(){if(general.value.indexOf(CONTEXT_PREFIX)===0)general.value=visible},0)}
  function unpackVisible(textarea){var raw=String(textarea&&textarea.value||'');if(raw.indexOf(CONTEXT_PREFIX)!==0)return;var object=dec(raw.slice(CONTEXT_PREFIX.length));if(!object)return;var scope=noteScope(textarea);installContextNotesFor(textarea);textarea.value=object.generalNotes||'';['equipmentNotes','maintenanceNotes','openingNotes','closingNotes'].forEach(function(key){var node=noteInput(scope,key);if(node)node.value=object[key]||''})}
  document.addEventListener('click',function(event){var button=event.target&&event.target.closest&&event.target.closest('button');if(button&&PMOS_SAVE_IDS.indexOf(button.id)>=0)packForSubmit(button)},true);
  function sweep(){installAllContextNotes();PMOS_NOTE_IDS.forEach(function(id){var node=document.getElementById(id);if(node)unpackVisible(node)})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sweep);else sweep();
  document.addEventListener('pmos:viewchange',function(){setTimeout(sweep,0)});setInterval(sweep,350);

  function enhanceWebProfile(){
    if(window.__pmosProfileEnhancementLoaded||window.__pmosCustomerLifecycleProfile)return;
    var profile=document.getElementById('customerProfile');if(!profile)return;Array.prototype.forEach.call(profile.querySelectorAll('*'),function(node){if(node.children.length===0&&String(node.textContent||'').trim()==='Customer Notes')node.textContent='General Notes'});
    var active=profile.querySelector('.customer-location-button.active')||profile.querySelector('.customer-location-button'),customerId=active&&String(active.dataset.customerId||'');if(!customerId)return;var existing=profile.querySelector('[data-pmos-context-profile="'+customerId+'"]');if(existing)return;
    google.script.run.withSuccessHandler(function(notes){if(!notes)return;var entries=[['Maintenance Notes',notes.maintenanceNotes],['Opening Notes',notes.openingNotes],['Closing Notes',notes.closingNotes]].filter(function(item){return String(item[1]||'').trim()});if(!entries.length)return;var current=profile.querySelector('.customer-location-button.active')||profile.querySelector('.customer-location-button');if(!current||String(current.dataset.customerId||'')!==customerId)return;var panel=document.createElement('div');panel.className='customer-section';panel.setAttribute('data-pmos-context-profile',customerId);panel.innerHTML='<div class="customer-section-title">Context Notes</div><div class="pmos-context-profile-notes">'+entries.map(function(item){return '<div class="pmos-context-profile-note"><b>'+esc(item[0])+'</b><div>'+esc(item[1])+'</div></div>'}).join('')+'</div>';profile.appendChild(panel)}).getPmosCustomerContextNotes(customerId)
  }
  if(typeof MutationObserver!=='undefined'){var profile=document.getElementById('customerProfile');if(profile)new MutationObserver(function(){setTimeout(enhanceWebProfile,0)}).observe(profile,{childList:true,subtree:true,attributes:true})}
  document.addEventListener('pmos:viewchange',function(event){if(event.detail&&event.detail.name==='customers')setTimeout(enhanceWebProfile,100)});
})();
`;
}
