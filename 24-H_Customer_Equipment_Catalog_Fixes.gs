/**
 * Follow-up compatibility layer for the equipment model enhancements.
 * Keeps sanitizer data in PMOS_SANITIZER_CATALOG, restores controller values,
 * and broadens reverse model-number recognition across sanitizer equipment.
 */
function pmosCustomerEquipmentCatalogFixScript_() {
  return String.raw`
(function(){
  function normalizeEquipmentNumber(value){return String(value||'').trim().toUpperCase().replace(/[\s_]/g,'-')}
  function numberValue(item){return typeof item==='string'?item:(item&&item.value)||''}
  function appendSanitizer(type,make,name,numbers){
    PMOS_SANITIZER_CATALOG[type]=PMOS_SANITIZER_CATALOG[type]||{};
    PMOS_SANITIZER_CATALOG[type][make]=PMOS_SANITIZER_CATALOG[type][make]||[];
    var list=PMOS_SANITIZER_CATALOG[type][make],existing=list.filter(function(item){return String(item.name||'').toLowerCase()===String(name||'').toLowerCase()})[0];
    if(!existing){existing={name:name,numbers:[]};list.push(existing)}
    var seen={};(existing.numbers||[]).forEach(function(value){seen[normalizeEquipmentNumber(numberValue(value))]=true});
    (numbers||[]).forEach(function(value){var key=normalizeEquipmentNumber(numberValue(value));if(key&&!seen[key]){existing.numbers.push(value);seen[key]=true}})
  }

  /* Current and field-encountered Hayward salt-cell variants. */
  appendSanitizer('SALT_SYSTEM','Hayward','TurboCell 925',['TCELL925','T-CELL-925','W3T-CELL-925']);
  appendSanitizer('SALT_SYSTEM','Hayward','TurboCell 940',['TCELL940','T-CELL-940','W3T-CELL-940']);
  appendSanitizer('SALT_SYSTEM','Hayward','AquaRite TurboCell 3',['T-CELL-3','W3T-CELL-3']);
  appendSanitizer('SALT_SYSTEM','Hayward','AquaRite TurboCell 9',['T-CELL-9','W3T-CELL-9']);
  appendSanitizer('SALT_SYSTEM','Hayward','AquaRite TurboCell 15',['T-CELL-15','W3T-CELL-15']);

  /* Larger-capacity Hayward puck/tablet feeders used beyond the CL200/CL220 family. */
  appendSanitizer('CHLORINE_FEEDER','Hayward','Commercial Chemical Feeder 7 kg',['C0250EXPE']);
  appendSanitizer('CHLORINE_FEEDER','Hayward','Commercial Chemical Feeder 13 kg',['C0500EXPE','C500EXP']);
  appendSanitizer('CHLORINE_FEEDER','Hayward','CL200 2-inch Inline',['CL2002S']);

  /* The base enhancement accidentally grouped these known two-speed XF SKUs with single-speed. */
  if(PMOS_EQUIPMENT_CATALOG&&PMOS_EQUIPMENT_CATALOG.pump&&PMOS_EQUIPMENT_CATALOG.pump.Pentair){
    PMOS_EQUIPMENT_CATALOG.pump.Pentair.forEach(function(item){
      if(String(item.name||'')!=='WhisperFloXF Single-Speed')return;
      item.numbers=(item.numbers||[]).filter(function(value){return ['022007','022008','022026'].indexOf(String(value))<0})
    })
  }

  function findSanitizerByNumber(value){
    var target=normalizeEquipmentNumber(value),found=null;if(!target)return null;
    Object.keys(PMOS_SANITIZER_CATALOG||{}).some(function(type){
      var makes=PMOS_SANITIZER_CATALOG[type]||{};
      return Object.keys(makes).some(function(make){
        return (makes[make]||[]).some(function(model){
          var exact=(model.numbers||[]).filter(function(number){return normalizeEquipmentNumber(numberValue(number))===target})[0];
          if(exact){found={type:type,make:make,model:model.name,modelNumber:numberValue(exact)};return true}
          return false
        })
      })
    });return found
  }

  function autofillSanitizerNumber(input){
    var card=input&&input.closest('.equipment-card');if(!card)return;
    var type=card.getAttribute('data-equipment-type')||'',match=findSanitizerByNumber(input.value);if(!match||match.type!==type)return;
    var make=card.querySelector('[data-equipment-field="make"]'),model=card.querySelector('[data-equipment-field="model"]');
    if(make){make.value=match.make;make.dispatchEvent(new Event('input',{bubbles:true}))}
    if(model){model.value=match.model;model.dispatchEvent(new Event('input',{bubbles:true}))}
    input.value=match.modelNumber||input.value;
    if(type==='SALT_SYSTEM'&&String(match.make).toLowerCase()==='hayward'&&typeof pmosUpdateHaywardSaltController==='function')pmosUpdateHaywardSaltController(card)
  }

  document.addEventListener('input',function(event){
    var input=event.target;if(!input||input.getAttribute('data-equipment-field')!=='modelNumber')return;
    var card=input.closest('.equipment-card'),type=card&&card.getAttribute('data-equipment-type');
    if(type==='SALT_SYSTEM'||type==='CHLORINE_FEEDER'||type==='BROMINE_FEEDER'||type==='IONIZER'||type==='OZONATOR'||type==='UV'||type==='OTHER_SANITIZER')autofillSanitizerNumber(input)
  });

  /* Ensure the Hayward salt dropdown is populated from the authoritative sanitizer catalog. */
  document.addEventListener('input',function(event){
    var make=event.target;if(!make||make.getAttribute('data-equipment-field')!=='make')return;
    var card=make.closest('.equipment-card');if(!card||card.getAttribute('data-equipment-type')!=='SALT_SYSTEM'||String(make.value||'').toLowerCase()!=='hayward')return;
    var model=card.querySelector('[data-equipment-field="model"]'),list=model&&document.getElementById(smartListId(model));
    if(list)list.innerHTML=sanitizerModels('SALT_SYSTEM','Hayward').map(function(item){return '<option value="'+esc(item.name)+'">'}).join('')
  });

  /* The 24-G wrapper creates Controller after base defaults are applied; restore it here for Edit Customer. */
  var previousAddEquipment=addEquipment;
  addEquipment=function(bodyCard,type,defaults){
    previousAddEquipment(bodyCard,type,defaults);
    if(type!=='SALT_SYSTEM'||!defaults||!defaults.controller)return;
    var cards=bodyCard.querySelectorAll('[data-equipment-type="SALT_SYSTEM"]'),card=cards[cards.length-1],controller=card&&card.querySelector('[data-equipment-field="controller"]');
    if(controller)controller.value=defaults.controller
  };
})();
`;
}
