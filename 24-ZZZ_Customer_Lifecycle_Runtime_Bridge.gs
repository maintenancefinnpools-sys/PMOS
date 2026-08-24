/** Ensure generated Sheets customer windows receive the same lifecycle payloads as Web. */
(function () {
  if (typeof getPmosCustomerAccountProfileRuntime === 'function') {
    const baseProfileRuntime = getPmosCustomerAccountProfileRuntime;
    getPmosCustomerAccountProfileRuntime = function(customerId) {
      return pmosAttachCustomerLifecycle_(baseProfileRuntime(customerId), customerId);
    };
  }

  if (typeof getPmosCustomerAccountEditorDataRuntime === 'function') {
    const baseEditorRuntime = getPmosCustomerAccountEditorDataRuntime;
    getPmosCustomerAccountEditorDataRuntime = function(customerId) {
      const data = baseEditorRuntime(customerId);
      const id = String(customerId || data.customerId || '').trim();
      data.accountContacts = typeof getPmosAccountContacts_ === 'function' ? getPmosAccountContacts_(id) : [];
      data.orderedAccountContacts = pmosCustomerOrderedAccountContacts_(id);
      data.serviceLocationContacts = typeof getPmosServiceLocationContacts_ === 'function'
        ? getPmosServiceLocationContacts_(id) : (data.serviceLocationContacts || []);
      data.accountBillingAddress = typeof getPmosAccountBillingAddress === 'function'
        ? getPmosAccountBillingAddress(id) : (data.accountBillingAddress || {enabled: false});
      const notes = pmosCustomerLifecycleNotes_(id);
      data.generalNotes = notes.generalNotes || data.generalNotes || data.notes || '';
      data.notes = data.generalNotes;
      data.equipmentNotes = notes.equipmentNotes || '';
      data.maintenanceNotes = notes.maintenanceNotes || '';
      data.openingNotes = notes.openingNotes || '';
      data.closingNotes = notes.closingNotes || '';
      data.waterMaintenance = data.waterMaintenance || getPmosWaterMaintenanceEditorState_(id);
      return data;
    };
  }

  if (typeof pmosCustomerEquipmentEditorScript_ === 'function') {
    const baseEquipmentScript = pmosCustomerEquipmentEditorScript_;
    pmosCustomerEquipmentEditorScript_ = function() {
      return baseEquipmentScript() + String.raw`
(function(){
  if(window.__pmosLifecycleEquipmentNoteHydration)return;window.__pmosLifecycleEquipmentNoteHydration=true;
  function hydrateLifecycleNote(data){
    if(!data)return;
    var field=document.querySelector('[data-pmos-context-note="equipmentNotes"]');
    if(field)field.value=data.equipmentNotes||'';
  }
  function patch(){
    if(typeof window.fill==='function'&&!window.fill.__pmosLifecycleNotes){
      var base=window.fill,wrapped=function(data){var result=base.apply(this,arguments);setTimeout(function(){hydrateLifecycleNote(data)},0);return result};
      wrapped.__pmosLifecycleNotes=true;window.fill=wrapped;
    }
    if(typeof window.pmosWaterMaintenanceFill==='function'&&!window.pmosWaterMaintenanceFill.__pmosLifecycleNotes){
      var waterBase=window.pmosWaterMaintenanceFill,waterWrapped=function(data){var result=waterBase.apply(this,arguments);setTimeout(function(){hydrateLifecycleNote(data)},0);return result};
      waterWrapped.__pmosLifecycleNotes=true;window.pmosWaterMaintenanceFill=waterWrapped;
    }
  }
  document.addEventListener('DOMContentLoaded',function(){patch();setTimeout(patch,80);setTimeout(patch,400)});
})();
`;
    };
  }
})();
