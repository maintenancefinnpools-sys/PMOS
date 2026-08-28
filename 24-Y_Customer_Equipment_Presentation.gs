/**
 * Presentation/editor completion for shared customer equipment.
 *
 * 1. Rehydrates stored SOLAR_* equipment back into the dedicated Solar controls
 *    instead of rendering generic equipment cards when Customer Editor opens.
 * 2. Replaces internal equipment enum tokens with readable labels in both the
 *    Web App customer profile and the Sheets Customer Lookup profile.
 */
const PMOS_EQUIPMENT_DISPLAY_LABELS_ = {
  CHEMISTRY_AUTOMATION: 'Chemistry Automation',
  EQUIPMENT_AUTOMATION: 'Equipment Automation',
  ACID_TANK: 'Acid Tank',
  CHLORINE_TANK: 'Chlorine Tank',
  PH_PROBE: 'pH Probe',
  ORP_PROBE: 'ORP Probe',
  SOLAR_BOOSTER_PUMP: 'Solar Booster Pump',
  SOLAR_VALVE_ACTUATOR: 'Solar Valve Actuator',
  SOLAR_AUTOMATION: 'Solar Automation',
  SALT_SYSTEM: 'Salt Cell',
  CHLORINE_FEEDER: 'Chlorinator',
  BROMINE_FEEDER: 'Brominator',
  WATER_FEATURE: 'Water Feature',
  OTHER_SANITIZER: 'Other Sanitizer',
  OZONATOR: 'Ozonator',
  UV: 'UV Light',
  ROBOT: 'Robot',
  PUMP: 'Pump',
  FILTER: 'Filter',
  HEATER: 'Heater'
};

function pmosEquipmentDisplayLabelClientScript_() {
  const labels = JSON.stringify(PMOS_EQUIPMENT_DISPLAY_LABELS_);
  return String.raw`
(function(){
  var PMOS_EQUIPMENT_DISPLAY_LABELS=${labels};
  function readableEquipmentText(text){
    var output=String(text==null?'':text);
    Object.keys(PMOS_EQUIPMENT_DISPLAY_LABELS).forEach(function(key){
      output=output.split(key).join(PMOS_EQUIPMENT_DISPLAY_LABELS[key]);
    });
    return output;
  }
  window.pmosRefreshEquipmentDisplayLabels=function(root){
    root=root||document;
    var profile=root.querySelector&&((root.id==='customerProfile'||root.id==='profile')?root:null);
    var targets=[];
    if(profile)targets=[profile];
    else{
      var web=document.getElementById('customerProfile'),sheet=document.getElementById('profile');
      if(web)targets.push(web);if(sheet)targets.push(sheet);
    }
    targets.forEach(function(target){
      var walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT,null,false),node;
      while((node=walker.nextNode())){
        var next=readableEquipmentText(node.nodeValue);
        if(next!==node.nodeValue)node.nodeValue=next;
      }
    });
  };
  function queue(){setTimeout(function(){window.pmosRefreshEquipmentDisplayLabels(document)},0)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue);else queue();
  document.addEventListener('pmos:viewchange',queue);
  if(typeof MutationObserver!=='undefined'){
    ['customerProfile','profile'].forEach(function(id){
      var target=document.getElementById(id);if(target)new MutationObserver(queue).observe(target,{childList:true,subtree:true});
    });
  }
})();
`;
}

(function () {
  if (typeof pmosCustomerEquipmentEditorScript_ === 'function') {
    const baseScript = pmosCustomerEquipmentEditorScript_;
    pmosCustomerEquipmentEditorScript_ = function() {
      return baseScript() + String.raw`
(function(){
  function setSolarField(panel,kind,key,value){
    var option=panel&&panel.querySelector('[data-solar-kind="'+kind+'"]');
    if(!option)return;
    var enabled=option.querySelector('[data-solar-enabled="'+kind+'"]');
    if(enabled){enabled.checked=true;enabled.dispatchEvent(new Event('change',{bubbles:true}))}
    var input=option.querySelector('[data-solar-field="'+key+'"]');
    if(input){input.value=value==null?'':String(value);input.dispatchEvent(new Event('input',{bubbles:true}))}
  }
  function hydrateStoredSolarEquipment(bodyCard,type,details){
    if(!bodyCard)return false;
    var map={SOLAR_BOOSTER_PUMP:{kind:'booster',prefix:'booster'},SOLAR_VALVE_ACTUATOR:{kind:'actuator',prefix:'actuator'},SOLAR_AUTOMATION:{kind:'automation',prefix:'automation'}},config=map[type];
    if(!config)return false;
    var heaterType=bodyCard.querySelector('[data-body-field="heaterType"],[data-equipment-field="heaterType"]');
    if(heaterType){heaterType.value='Solar';heaterType.dispatchEvent(new Event('input',{bubbles:true}));heaterType.dispatchEvent(new Event('change',{bubbles:true}))}
    var panel=bodyCard.querySelector('.pmos-solar-panel');if(!panel)return false;panel.style.display='block';
    details=details||{};
    setSolarField(panel,config.kind,config.prefix+'Make',details.make||details.manufacturer||'');
    setSolarField(panel,config.kind,config.prefix+'Model',details.model||'');
    setSolarField(panel,config.kind,config.prefix+'ModelNumber',details.modelNumber||details.number||'');
    return true;
  }
  if(typeof addEquipment==='function'){
    var baseSolarHydrationAddEquipment=addEquipment;
    addEquipment=function(bodyCard,type,defaults){
      if(hydrateStoredSolarEquipment(bodyCard,String(type||''),defaults||{}))return;
      return baseSolarHydrationAddEquipment(bodyCard,type,defaults);
    };
  }
  function refreshSolarPanels(root){
    Array.prototype.forEach.call((root||document).querySelectorAll('.water-body'),function(card){
      var type=card.querySelector('[data-body-field="heaterType"]'),panel=card.querySelector('.pmos-solar-panel');
      if(type&&panel)panel.style.display=String(type.value||'').trim().toLowerCase()==='solar'?'block':'none';
    });
    Array.prototype.forEach.call((root||document).querySelectorAll('.equipment-card[data-equipment-type="HEATER"]'),function(card){
      var type=card.querySelector('[data-equipment-field="heaterType"]'),panel=card.querySelector('.pmos-solar-panel');
      if(type&&panel)panel.style.display=String(type.value||'').trim().toLowerCase()==='solar'?'block':'none';
    });
  }
  if(typeof prepareWaterBodyOptions==='function'){
    var basePrepareWaterBodyOptionsForSolar=prepareWaterBodyOptions;
    prepareWaterBodyOptions=function(root){var result=basePrepareWaterBodyOptionsForSolar(root);setTimeout(function(){refreshSolarPanels(root||document)},0);return result};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){refreshSolarPanels(document)},0)});else setTimeout(function(){refreshSolarPanels(document)},0);
  document.addEventListener('pmos:viewchange',function(){setTimeout(function(){refreshSolarPanels(document)},0)});
})();
` + pmosEquipmentDisplayLabelClientScript_();
    };
  }

  if (typeof buildPmosCustomerAccountLookupHtml_ === 'function') {
    const baseBuildLookup = buildPmosCustomerAccountLookupHtml_;
    buildPmosCustomerAccountLookupHtml_ = function(mode, initialCustomerId) {
      let html = baseBuildLookup(mode, initialCustomerId);
      const script = pmosEquipmentDisplayLabelClientScript_();
      html = html.replace('</script></body></html>', script + '\n</script></body></html>');
      return html;
    };
  }
})();
