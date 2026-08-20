/**
 * PMOS customer equipment catalog enhancements.
 *
 * Extends the shared Add Maintenance Client / Edit Customer equipment editor
 * without duplicating its renderer. The base component remains authoritative.
 */
(function () {
  if (typeof pmosCustomerEquipmentEditorScript_ !== 'function') return;
  const baseEquipmentEditorScript = pmosCustomerEquipmentEditorScript_;
  pmosCustomerEquipmentEditorScript_ = function () {
    return baseEquipmentEditorScript() + String.raw`

/* PMOS equipment-model enhancement layer. */
(function(){
  function pmosAppendCatalogItem(unit,make,name,numbers){
    PMOS_EQUIPMENT_CATALOG[unit]=PMOS_EQUIPMENT_CATALOG[unit]||{};
    PMOS_EQUIPMENT_CATALOG[unit][make]=PMOS_EQUIPMENT_CATALOG[unit][make]||[];
    var list=PMOS_EQUIPMENT_CATALOG[unit][make];
    var existing=list.filter(function(item){return String(item.name||'').toLowerCase()===String(name||'').toLowerCase()})[0];
    if(!existing){existing={name:name,numbers:[]};list.push(existing)}
    var seen={};(existing.numbers||[]).forEach(function(item){seen[String(typeof item==='string'?item:item.value).toUpperCase()]=true});
    (numbers||[]).forEach(function(value){var key=String(value||'').toUpperCase();if(key&&!seen[key]){existing.numbers.push(value);seen[key]=true}})
  }

  pmosAppendCatalogItem('pump','Pentair','WhisperFlo Single-Speed',['015583','011511-INT','011512-INT','011527-INT','011528-INT','011529-INT','011530-INT','347926-INT','347927-INT','347928-INT','347929-INT','347930-INT']);
  pmosAppendCatalogItem('pump','Pentair','SuperFlo Single-Speed',['348190','348021-INT','348022-INT','348144-INT','348145-INT','348146-INT','340094-INT','340095-INT','340096-INT','340097-INT','340098-INT']);
  pmosAppendCatalogItem('pump','Pentair','WhisperFloXF Single-Speed',['022007','022008','022009','022010','022011','022012','022013','022017','022018','022019','022026','022027','022028','022032','022033','022034']);
  pmosAppendCatalogItem('pump','Hayward','Super II Pump',['SP3007X102S','SP3007X10AZ','SP3010X15AZ','SP3010X152AZ','SP3015X20AZ','SP3020X25AZ','SP3025X30AZ','SP3030X40AZ']);
  pmosAppendCatalogItem('pump','Hayward','Super Pump Single-Speed',['SP2600X5','SP2605X7','SP2607X10','SP2610X15','SP2615X20','SP2621X25']);
  pmosAppendCatalogItem('pump','Hayward','MaxFlo Single-Speed',['SP2800X5','SP2805X7','SP2807X10','SP2810X15','SP2815X20']);

  if(PMOS_FILTER_MODEL_CATALOG&&PMOS_FILTER_MODEL_CATALOG.Hayward&&PMOS_FILTER_MODEL_CATALOG.Hayward.Sand){
    ['S244TC (24 in · 300 lb)'].forEach(function(value){if(PMOS_FILTER_MODEL_CATALOG.Hayward.Sand.indexOf(value)<0)PMOS_FILTER_MODEL_CATALOG.Hayward.Sand.push(value)})
  }

  var PMOS_HAYWARD_SALT_CONTROLLERS=[
    'AquaRite','AquaRite 100','AquaRite 900','AquaRite S3','AquaRite Pro',
    'AquaPlus','ProLogic','OmniLogic','OmniPL','OmniHub','OmniPL Retrofit',
    'AquaTrol','SwimPure Plus','SmartRite','Low Salt','Sense and Dispense / AquaRite Pro'
  ];
  var PMOS_HAYWARD_SALT_CELLS=[
    {name:'TurboCell 925',numbers:['TCELL925','T-CELL-925','W3T-CELL-925']},
    {name:'TurboCell 940',numbers:['TCELL940','T-CELL-940','W3T-CELL-940']},
    {name:'TurboCell 15',numbers:['T-CELL-15','W3T-CELL-15']},
    {name:'TurboCell 9',numbers:['T-CELL-9','W3T-CELL-9']},
    {name:'TurboCell 3',numbers:['T-CELL-3','W3T-CELL-3']}
  ];

  function pmosNormalizeModelNumber(value){return String(value||'').trim().toUpperCase().replace(/[\s_]/g,'-')}
  function pmosNumberValue(item){return typeof item==='string'?item:(item&&item.value)||''}
  function pmosFindCatalogByNumber(number){
    var target=pmosNormalizeModelNumber(number),found=null;
    if(!target)return null;
    Object.keys(PMOS_EQUIPMENT_CATALOG||{}).some(function(unit){
      var makes=PMOS_EQUIPMENT_CATALOG[unit]||{};
      return Object.keys(makes).some(function(make){
        return (makes[make]||[]).some(function(model){
          var match=(model.numbers||[]).some(function(n){return pmosNormalizeModelNumber(pmosNumberValue(n))===target});
          if(match){found={unit:unit,make:make,model:model.name,modelNumber:pmosNumberValue((model.numbers||[]).filter(function(n){return pmosNormalizeModelNumber(pmosNumberValue(n))===target})[0])};return true}
          return false
        })
      })
    });
    return found
  }

  function pmosSetField(root,selector,value){var el=root&&root.querySelector(selector);if(el&&value!=null)el.value=value;return el}
  function pmosAutofillMainBodyModelNumber(input){
    var card=input.closest('.water-body'),field=input.getAttribute('data-body-field')||'',unit=field.indexOf('heater')===0?'heater':'pump',match=pmosFindCatalogByNumber(input.value);
    if(!card||!match||match.unit!==unit)return;
    pmosSetField(card,'[data-body-field="'+unit+'Make"]',match.make);
    pmosSetField(card,'[data-body-field="'+unit+'Model"]',match.model);
    input.value=match.modelNumber||input.value
  }
  function pmosAutofillEquipmentModelNumber(input){
    var card=input.closest('.equipment-card'),match=pmosFindCatalogByNumber(input.value);if(!card||!match)return;
    var requested=(card.getAttribute('data-equipment-type')||'').toLowerCase();
    if(requested==='pump'&&match.unit!=='pump')return;if(requested==='heater'&&match.unit!=='heater')return;
    pmosSetField(card,'[data-equipment-field="make"]',match.make);pmosSetField(card,'[data-equipment-field="model"]',match.model);input.value=match.modelNumber||input.value
  }
  function pmosAutofillFeatureModelNumber(input){
    var group=input.closest('[data-water-feature-equipment]'),field=input.getAttribute('data-equipment-field')||'',unit=field.indexOf('heater')===0?'heater':'pump',match=pmosFindCatalogByNumber(input.value);if(!group||!match||match.unit!==unit)return;
    pmosSetField(group,'[data-equipment-field="'+unit+'Make"]',match.make);pmosSetField(group,'[data-equipment-field="'+unit+'Model"]',match.model);input.value=match.modelNumber||input.value
  }

  function pmosEnsureHaywardSaltCatalog(card){
    if(!card||card.getAttribute('data-equipment-type')!=='SALT_SYSTEM')return;
    var make=fieldValue(card,'[data-equipment-field="make"]'),model=card.querySelector('[data-equipment-field="model"]'),number=card.querySelector('[data-equipment-field="modelNumber"]');
    if(String(make).toLowerCase()!=='hayward')return;
    if(!PMOS_EQUIPMENT_CATALOG.saltSystem)PMOS_EQUIPMENT_CATALOG.saltSystem={};
    if(!PMOS_EQUIPMENT_CATALOG.saltSystem.Hayward)PMOS_EQUIPMENT_CATALOG.saltSystem.Hayward=[];
    PMOS_HAYWARD_SALT_CELLS.forEach(function(item){
      var existing=PMOS_EQUIPMENT_CATALOG.saltSystem.Hayward.filter(function(x){return String(x.name).toLowerCase()===String(item.name).toLowerCase()})[0];
      if(!existing)PMOS_EQUIPMENT_CATALOG.saltSystem.Hayward.push({name:item.name,numbers:item.numbers.slice()})
    });
    if(model){var dl=document.getElementById(smartListId(model));if(dl)dl.innerHTML=PMOS_HAYWARD_SALT_CELLS.map(function(item){return '<option value="'+esc(item.name)+'">'}).join('')}
    if(number&&model){var selected=PMOS_HAYWARD_SALT_CELLS.filter(function(item){return item.name.toLowerCase()===String(model.value||'').toLowerCase()})[0];if(selected){var ndl=document.getElementById(smartListId(number));if(ndl)ndl.innerHTML=selected.numbers.map(function(value){return '<option value="'+esc(value)+'">'}).join('')}}
  }

  function pmosUpdateHaywardSaltController(card){
    if(!card||card.getAttribute('data-equipment-type')!=='SALT_SYSTEM')return;
    var grid=card.querySelector('.equipment-grid'),make=fieldValue(card,'[data-equipment-field="make"]'),wrap=card.querySelector('[data-hayward-salt-controller]');
    if(String(make).toLowerCase()!=='hayward'){if(wrap)wrap.remove();return}
    pmosEnsureHaywardSaltCatalog(card);
    if(!wrap){
      wrap=document.createElement('label');wrap.setAttribute('data-hayward-salt-controller','true');wrap.textContent='Controller';
      var select=document.createElement('select');select.setAttribute('data-equipment-field','controller');select.innerHTML='<option value="">Select controller</option>'+PMOS_HAYWARD_SALT_CONTROLLERS.map(function(value){return '<option value="'+esc(value)+'">'+esc(value)+'</option>'}).join('');wrap.appendChild(select);grid.appendChild(wrap)
    }
  }

  document.addEventListener('input',function(event){
    var target=event.target;if(!target)return;
    var bodyField=target.getAttribute('data-body-field'),equipmentField=target.getAttribute('data-equipment-field');
    if(bodyField==='pumpModelNumber'||bodyField==='heaterModelNumber')pmosAutofillMainBodyModelNumber(target);
    if(equipmentField==='modelNumber')pmosAutofillEquipmentModelNumber(target);
    if(equipmentField==='pumpModelNumber'||equipmentField==='heaterModelNumber')pmosAutofillFeatureModelNumber(target);
    if(equipmentField==='make'){var salt=target.closest('.equipment-card');if(salt&&salt.getAttribute('data-equipment-type')==='SALT_SYSTEM')pmosUpdateHaywardSaltController(salt)}
    if(equipmentField==='model'){var saltModel=target.closest('.equipment-card');if(saltModel&&saltModel.getAttribute('data-equipment-type')==='SALT_SYSTEM')pmosEnsureHaywardSaltCatalog(saltModel)}
  });
  document.addEventListener('change',function(event){var target=event.target;if(target&&target.getAttribute('data-equipment-field')==='make'){var card=target.closest('.equipment-card');if(card&&card.getAttribute('data-equipment-type')==='SALT_SYSTEM')pmosUpdateHaywardSaltController(card)}});

  var pmosBaseAddEquipment=addEquipment;
  addEquipment=function(bodyCard,type,defaults){pmosBaseAddEquipment(bodyCard,type,defaults);var cards=bodyCard.querySelectorAll('.equipment-card'),card=cards[cards.length-1];if(card&&type==='SALT_SYSTEM')pmosUpdateHaywardSaltController(card)};
  var pmosBaseRenderPrimarySanitizer=renderPrimarySanitizer;
  renderPrimarySanitizer=function(select){pmosBaseRenderPrimarySanitizer(select);var body=select.closest('.water-body'),card=body&&body.querySelector('.primary-sanitizer-card');if(card)pmosUpdateHaywardSaltController(card)};
})();
`;
  };
})();
