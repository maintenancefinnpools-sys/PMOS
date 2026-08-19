/** Follow-up hardening for the customer form enhancement layer. */
(function () {
  if (typeof savePmosCustomerCategorizedNotes_ === 'function') {
    savePmosCustomerCategorizedNotes_ = function(customerId, input) {
      const request = input || {};
      ensurePmosCustomerCategorizedNotes_();
      const record = getPmosCustomerEditorRow_(customerId);
      const values = record.values.slice();
      const has = function(key) { return Object.prototype.hasOwnProperty.call(request, key); };
      const clean = function(value, limit) {
        return String(value == null ? '' : value).trim().slice(0, limit || 10000);
      };
      if (has('generalNotes') || has('notes')) {
        pmosCustomerEditorSetAliases_(
          record.headers,
          values,
          ['Customer Notes'],
          clean(has('generalNotes') ? request.generalNotes : request.notes, 10000)
        );
      }
      if (has('openingNotes')) {
        pmosCustomerEditorSetAliases_(record.headers, values, [PMOS_OPENING_NOTES_HEADER_], clean(request.openingNotes, 10000));
      }
      if (has('closingNotes')) {
        pmosCustomerEditorSetAliases_(record.headers, values, [PMOS_CLOSING_NOTES_HEADER_], clean(request.closingNotes, 10000));
      }
      if (has('maintenanceNotes')) {
        pmosCustomerEditorSetAliases_(record.headers, values, [PMOS_MAINTENANCE_NOTES_HEADER_], clean(request.maintenanceNotes, 10000));
      }
      record.sheet.getRange(record.rowNumber, 1, 1, values.length).setValues([values]);
      SpreadsheetApp.flush();
      return readPmosCustomerCategorizedNotes_(customerId);
    };
  }

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
      var prototype=fieldHostLocal(notes),node,area=document.createElement('textarea');area.id='maintenanceNotes';
      if(prototype&&prototype.matches&&prototype.matches('label')){node=document.createElement('label');node.className=(prototype.className||'full')+' pmos-note-field';node.appendChild(document.createTextNode('Maintenance Notes'));node.appendChild(area)}
      else{node=document.createElement('div');node.className='field wide pmos-note-field';var label=document.createElement('label');label.appendChild(document.createTextNode('Maintenance Notes '));var optional=document.createElement('span');optional.style.cssText='font-weight:400;text-transform:none;letter-spacing:0';optional.textContent='optional';label.appendChild(optional);label.appendChild(area);node.appendChild(label)}
      node.id='maintenanceNotesField';closing.insertAdjacentElement('afterend',node);host=node;existing=area;
      if(window.loaded&&loaded.maintenanceNotes!=null)existing.value=loaded.maintenanceNotes||'';
    }
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
