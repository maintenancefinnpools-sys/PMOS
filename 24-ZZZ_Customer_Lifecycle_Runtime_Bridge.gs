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
      return pmosAttachCustomerLifecycleEditorData_(baseEditorRuntime(customerId), customerId);
    };
  }

})();

function pmosCustomerLifecycleEquipmentHydrationScript_() {
  return String.raw`
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
}
