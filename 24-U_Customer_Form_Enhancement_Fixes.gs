/** Follow-up hardening for the customer form enhancement layer. */
(function () {
  /* The maintenance transaction has its own normalizer. Preserve the new per-body fields
     after that normalizer has validated and sanitized the rest of the request. */
  if (typeof normalizeMaintenanceCustomerRequest_ === 'function') {
    const baseNormalizeMaintenanceCustomerRequest = normalizeMaintenanceCustomerRequest_;
    normalizeMaintenanceCustomerRequest_ = function(input) {
      const normalized = baseNormalizeMaintenanceCustomerRequest(input || {});
      const rawBodies = Array.isArray(input && input.bodiesOfWater) ? input.bodiesOfWater : [];
      const bodies = (normalized.bodiesOfWater || []).map(function(body, index) {
        const raw = rawBodies[index] || {};
        const clean = Object.assign({}, body);
        clean.equipmentNotes = String(raw.equipmentNotes || '').trim().slice(0, 5000);
        clean.heater = Object.assign({}, body.heater || {});
        const solarEquipment = normalizePmosSolarEquipment_(raw.heater && raw.heater.solarEquipment);
        if (solarEquipment.length || /^solar$/i.test(String(clean.heater.type || ''))) {
          clean.heater.solarEquipment = solarEquipment;
        }
        return clean;
      });
      return Object.freeze(Object.assign({}, normalized, {bodiesOfWater: bodies}));
    };
  }

  if (typeof pmosCustomerEquipmentEditorScript_ === 'function') {
    const baseCustomerEquipmentEditorScript = pmosCustomerEquipmentEditorScript_;
    pmosCustomerEquipmentEditorScript_ = function() {
      return baseCustomerEquipmentEditorScript() + String.raw`
(function(){
  if(window.__pmosLateMaintenanceNotesFix)return;window.__pmosLateMaintenanceNotesFix=true;
  function byIdLocal(id){return document.getElementById(id)}
  function maintenanceContext(){return !!(byIdLocal('waterMaintenanceToggle')||byIdLocal('waterMaintenance')||(byIdLocal('saveButton')&&byIdLocal('effectiveDate')&&byIdLocal('recommendations')&&!byIdLocal('accountPreview')&&!byIdLocal('create')))}
  function maintenanceIsOn(){var editor=byIdLocal('waterMaintenanceToggle'),location=byIdLocal('waterMaintenance');if(editor)return !!editor.checked;if(location)return !!location.checked;return maintenanceContext()}
  function fieldHostLocal(input){return input&&(input.closest('.field')||input.closest('label'))}
  function ensureLateMaintenanceNotes(){
    var notes=byIdLocal('notes'),opening=byIdLocal('openingNotes'),closing=byIdLocal('closingNotes');
    if(!notes||!opening||!closing||!maintenanceContext())return;
    var existing=byIdLocal('maintenanceNotes'),host=byIdLocal('maintenanceNotesField');
    if(!existing){
      var prototype=fieldHostLocal(notes),node,area=document.createElement('textarea');area.id='maintenanceNotes';area.style.font='inherit';
      if(prototype&&prototype.matches&&prototype.matches('label')){node=document.createElement('label');node.className=(prototype.className||'full')+' pmos-note-field';node.appendChild(document.createTextNode('Maintenance Notes'));node.appendChild(area)}
      else{node=document.createElement('div');node.className='field wide pmos-note-field';var label=document.createElement('label');label.appendChild(document.createTextNode('Maintenance Notes '));var optional=document.createElement('span');optional.style.cssText='font-weight:400;text-transform:none;letter-spacing:0';optional.textContent='optional';label.appendChild(optional);label.appendChild(area);node.appendChild(label)}
      node.id='maintenanceNotesField';closing.insertAdjacentElement('afterend',node);host=node;existing=area;
      if(window.loaded&&loaded.maintenanceNotes!=null)existing.value=loaded.maintenanceNotes||'';
    }
    var maintenanceGrid=document.querySelector('#waterMaintenanceSection>.grid');
    if(host&&maintenanceGrid&&host.parentNode!==maintenanceGrid)maintenanceGrid.appendChild(host);
    if(host)host.style.display=maintenanceIsOn()?'':'none';
  }
  function wireToggle(id){var toggle=byIdLocal(id);if(!toggle||toggle.__pmosLateNotesWired)return;toggle.__pmosLateNotesWired=true;toggle.addEventListener('change',function(){setTimeout(ensureLateMaintenanceNotes,0)})}
  function refresh(){wireToggle('waterMaintenanceToggle');wireToggle('waterMaintenance');ensureLateMaintenanceNotes()}
  document.addEventListener('DOMContentLoaded',function(){refresh();setTimeout(refresh,100);setTimeout(refresh,600)});
  new MutationObserver(refresh).observe(document.documentElement,{childList:true,subtree:true});
})();
`;
    };
  }

})();
