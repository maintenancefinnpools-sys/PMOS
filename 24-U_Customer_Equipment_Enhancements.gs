/**
 * Shared equipment/catalog enhancements used by every PMOS customer form.
 *
 * Extends the common editor rather than creating Sheets/Web variants. Adds
 * broader legacy pump/chlorinator coverage and explicit chemistry-automation
 * accessories.
 */
(function () {
  if (typeof pmosCustomerEquipmentEditorStyles_ === 'function') {
    const baseStyles = pmosCustomerEquipmentEditorStyles_;
    pmosCustomerEquipmentEditorStyles_ = function () {
      return baseStyles() +
        '.chemistry-selectors{display:grid;grid-column:1/-1;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}' +
        '.chemistry-selectors>label,.chemistry-component-row>label,.chemistry-other-equipment{display:flex;flex-direction:column;gap:5px;color:#6f7d84;font-size:11px;font-weight:900;letter-spacing:.07em;text-transform:uppercase}' +
        '.chemistry-equipment-host{grid-column:1/-1;width:100%;box-sizing:border-box}.chemistry-equipment-card{width:100%;margin-top:2px;box-sizing:border-box}' +
        '.chemistry-component-list{display:grid;gap:8px}.chemistry-component-row{display:grid;grid-template-columns:minmax(190px,.8fr) minmax(300px,2fr) minmax(160px,.8fr);gap:10px;align-items:end;padding:9px;border:1px solid #dbeafe;border-radius:8px;background:#f8fafc}' +
        '.chemistry-component-name{align-self:center;color:#293944;font-size:12px;font-weight:900}.chemistry-other-equipment{padding-top:3px}' +
        '@media(max-width:760px){.chemistry-selectors,.chemistry-component-row{grid-template-columns:1fr}}';
    };
  }

  if (typeof pmosCustomerEquipmentEditorScript_ !== 'function') return;
  const baseScript = pmosCustomerEquipmentEditorScript_;
  pmosCustomerEquipmentEditorScript_ = function () {
    return baseScript() + String.raw`
(function(){
  function pmosNormEquipmentNumber(value){return String(value||'').trim().toUpperCase().replace(/[\s_]/g,'-')}
  function pmosCatalogNumberValue(item){return typeof item==='string'?item:(item&&item.value)||''}
  function pmosAppendEquipmentModel(unit,make,name,numbers){
    PMOS_EQUIPMENT_CATALOG[unit]=PMOS_EQUIPMENT_CATALOG[unit]||{};PMOS_EQUIPMENT_CATALOG[unit][make]=PMOS_EQUIPMENT_CATALOG[unit][make]||[];
    var list=PMOS_EQUIPMENT_CATALOG[unit][make],existing=list.filter(function(item){return String(item.name||'').toLowerCase()===String(name||'').toLowerCase()})[0];
    if(!existing){existing={name:name,numbers:[]};list.push(existing)}
    var seen={};(existing.numbers||[]).forEach(function(value){seen[pmosNormEquipmentNumber(pmosCatalogNumberValue(value))]=true});
    (numbers||[]).forEach(function(value){var key=pmosNormEquipmentNumber(pmosCatalogNumberValue(value));if(key&&!seen[key]){existing.numbers.push(value);seen[key]=true}})
  }
  function pmosAppendSanitizerModel(type,make,name,numbers){
    PMOS_SANITIZER_CATALOG[type]=PMOS_SANITIZER_CATALOG[type]||{};PMOS_SANITIZER_CATALOG[type][make]=PMOS_SANITIZER_CATALOG[type][make]||[];
    var list=PMOS_SANITIZER_CATALOG[type][make],existing=list.filter(function(item){return String(item.name||'').toLowerCase()===String(name||'').toLowerCase()})[0];
    if(!existing){existing={name:name,numbers:[]};list.push(existing)}
    var seen={};(existing.numbers||[]).forEach(function(value){seen[pmosNormEquipmentNumber(pmosCatalogNumberValue(value))]=true});
    (numbers||[]).forEach(function(value){var key=pmosNormEquipmentNumber(pmosCatalogNumberValue(value));if(key&&!seen[key]){existing.numbers.push(value);seen[key]=true}})
  }

  /* Hayward MaxFlo XL single-speed family. */
  pmosAppendEquipmentModel('pump','Hayward','MaxFlo XL Single-Speed 0.75 HP',['SP2305X7','SP2305X7EE','SP2305X7EESP']);
  pmosAppendEquipmentModel('pump','Hayward','MaxFlo XL Single-Speed 1.0 HP',['SP2307X10']);
  pmosAppendEquipmentModel('pump','Hayward','MaxFlo XL Single-Speed 1.5 HP',['SP2310X15']);
  pmosAppendEquipmentModel('pump','Hayward','MaxFlo XL Single-Speed 2.0 HP',['SP2315X20']);

  /* Jandy legacy/current single-speed families retained for field identification. */
  pmosAppendEquipmentModel('pump','Jandy','FloPro Single-Speed',['FHPM.75','FHPM1.0','FHPM1.5','FHPM2.0','FHPM2.5']);
  pmosAppendEquipmentModel('pump','Jandy','Stealth SHPF Single-Speed',['SHPF.50','SHPF.75','SHPF1.0','SHPF1.5','SHPF2.0','SHPF3.0','SHPF5.0','SHPF5.0TEFC','SHPF1.0-3PH','SHPF1.5-3PH','SHPF2.0-3PH','SHPF3.0-3PH','SHPF5.0-3PH']);
  pmosAppendEquipmentModel('pump','Jandy','Stealth SHPM Single-Speed',['SHPM.75','SHPM1.0','SHPM1.5','SHPM2.0','SHPM2.5']);

  /* Sta-Rite Max-E-Pro single-speed/legacy identifiers. */
  pmosAppendEquipmentModel('pump','Sta-Rite','Max-E-Pro Single-Speed',['348185','P6E6C-204L-INT','P6E6D-205L-INT','348150-INT','348151-INT','348152-INT','348153-INT']);

  /* Hayward residential and commercial tablet/puck feeders, including legacy commercial sizes. */
  pmosAppendSanitizerModel('CHLORINE_FEEDER','Hayward','CL100 Inline',['CL100','CL100EF']);
  pmosAppendSanitizerModel('CHLORINE_FEEDER','Hayward','CL110 Offline',['CL110']);
  pmosAppendSanitizerModel('CHLORINE_FEEDER','Hayward','CL200 Inline',['CL200','CL200EF','CL2002S']);
  pmosAppendSanitizerModel('CHLORINE_FEEDER','Hayward','CL220 Offline',['CL220','CL220EF']);
  pmosAppendSanitizerModel('CHLORINE_FEEDER','Hayward','Commercial Chemical Feeder 16 lb',['C250EXP','C0250EXPE','C250CF']);
  pmosAppendSanitizerModel('CHLORINE_FEEDER','Hayward','Commercial Chemical Feeder 30 lb',['C500EXP','C0500EXPE','C500CF']);
  pmosAppendSanitizerModel('CHLORINE_FEEDER','Hayward','Commercial Chemical Feeder 50 lb (Legacy)',['C1100CF']);
  pmosAppendSanitizerModel('CHLORINE_FEEDER','Hayward','Commercial Chemical Feeder 70 lb (Legacy)',['C1800CF']);
  pmosAppendSanitizerModel('CHLORINE_FEEDER','Hayward','Commercial Chemical Feeder 90 lb (Legacy)',['C2400CF']);

  function pmosFindSanitizerByTypeNumber(type,value){
    var target=pmosNormEquipmentNumber(value),found=null;if(!target)return null;
    Object.keys(PMOS_SANITIZER_CATALOG[type]||{}).some(function(make){return (PMOS_SANITIZER_CATALOG[type][make]||[]).some(function(model){var modelExact=(model.modelNumbers||[]).filter(function(number){return pmosNormEquipmentNumber(pmosCatalogNumberValue(number))===target})[0],partExact=(model.partNumbers||model.numbers||[]).filter(function(number){return pmosNormEquipmentNumber(pmosCatalogNumberValue(number))===target})[0],exact=modelExact||partExact;if(exact){found={make:make,model:model.name,field:modelExact?'modelNumber':'partNumber',number:pmosCatalogNumberValue(exact)};return true}return false})});return found
  }
  /* Correct reverse lookup inside the sanitizer type selected on the card. */
  document.addEventListener('input',function(event){var input=event.target,field=input&&input.getAttribute('data-equipment-field');if(field!=='modelNumber'&&field!=='partNumber')return;var card=input.closest('.equipment-card'),type=card&&card.getAttribute('data-equipment-type');if(!type||!PMOS_SANITIZER_CATALOG[type])return;var match=pmosFindSanitizerByTypeNumber(type,input.value);if(!match)return;var make=card.querySelector('[data-equipment-field="make"]'),model=card.querySelector('[data-equipment-field="model"]');if(make){make.value=match.make;make.dispatchEvent(new Event('input',{bubbles:true}))}if(model){model.value=match.model;model.dispatchEvent(new Event('input',{bubbles:true}))}var number=card.querySelector('[data-equipment-field="'+match.field+'"]');if(number)number.value=match.number});

  var previousEquipmentTypeLabel=equipmentTypeLabel;
  equipmentTypeLabel=function(type){return {FLOW_CELL:'Flow Cell',ACID_TANK:'Acid Tank',CHLORINE_TANK:'Chlorine Tank',PH_PROBE:'pH Probe',ORP_PROBE:'ORP Probe'}[type]||previousEquipmentTypeLabel(type)};
})();
`;
  };
})();

/** Shared body overview and standalone-spa behavior used by every customer form. */
(function () {
  if (typeof pmosCustomerEquipmentEditorStyles_ === 'function') {
    const baseStyles = pmosCustomerEquipmentEditorStyles_;
    pmosCustomerEquipmentEditorStyles_ = function () {
      return baseStyles() +
        '.body-grid{grid-template-columns:repeat(5,minmax(0,1fr))}' +
        '.body-overview-field select,.body-overview-field input{min-width:0}' +
        '.body-title,.unit-title{font-size:14px}.equipment-head{font-size:13px}' +
        '.body-grid>label,.equipment-grid>label,.chemistry-fields>label,.automation-fields>label,.spa-details>label,.spa-unit-fields>label,.chemistry-selectors>label,.chemistry-component-row>label,.chemistry-other-equipment,.pmos-equipment-notes label,.pmos-solar-equipment-grid label{font-size:12px}' +
        '.body-grid input,.body-grid select,.equipment-grid input,.equipment-grid select,.chemistry-fields input,.automation-fields input,.automation-fields select,.spa-details input,.spa-details select,.spa-unit-fields input,.pmos-solar-equipment-grid input,.pmos-solar-equipment-grid textarea{font-size:13px}' +
        '.inline-button,.remove-button,.pmos-solar-add{font-size:12px}' +
        '@media(max-width:960px){.body-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}' +
        '@media(max-width:760px){.body-grid{grid-template-columns:1fr}}';
    };
  }

  if (typeof pmosCustomerEquipmentEditorScript_ !== 'function') return;
  const baseScript = pmosCustomerEquipmentEditorScript_;
  pmosCustomerEquipmentEditorScript_ = function () {
    return baseScript() + String.raw`
(function(){
  var PMOS_BODY_SHAPES=['Rectangle','Round','Oval','Kidney','L-Shaped','Roman','Grecian','Lazy L','Figure Eight','Coffin','Free Form','Other'];
  var PMOS_MAKE_ORDER=['Pentair','Hayward','Jandy','Sta-Rite','Nature2'];
  function pmosReorderCatalogMakes(){Object.keys(PMOS_SANITIZER_CATALOG||{}).forEach(function(type){var source=PMOS_SANITIZER_CATALOG[type]||{},ordered={};PMOS_MAKE_ORDER.forEach(function(make){if(source[make])ordered[make]=source[make]});Object.keys(source).forEach(function(make){if(!ordered[make])ordered[make]=source[make]});PMOS_SANITIZER_CATALOG[type]=ordered})}
  function pmosInstallBodyOverview(card){if(!card||card.querySelector('[data-body-field="shape"]'))return;var sanitization=card.querySelector('[data-body-field="sanitization"]'),anchor=sanitization&&sanitization.closest('label');if(!anchor)return;anchor.classList.add('body-overview-field');var shape=document.createElement('label'),volume=document.createElement('label');shape.className='body-overview-field';volume.className='body-overview-field';shape.innerHTML='Shape<select data-body-field="shape"><option value="">Select shape</option>'+PMOS_BODY_SHAPES.map(function(value){return'<option value="'+esc(value)+'">'+esc(value)+'</option>'}).join('')+'</select>';volume.innerHTML='Volume<input data-body-field="volume" inputmode="decimal" placeholder="e.g. 75,000 L">';anchor.insertAdjacentElement('afterend',shape);shape.insertAdjacentElement('afterend',volume)}
  function pmosConfigureStandaloneBody(card){if(!card)return;var bodyType=fieldValue(card,'[data-body-field="name"]').toLowerCase(),setup=fieldValue(card,'[data-body-field="equipmentSetup"]'),standalone=bodyType==='spa'&&setup==='Self-Contained Unit',chemistry=card.querySelector('.chemistry-option'),automation=card.querySelector('.automation-option');[chemistry,automation].forEach(function(option){if(option)option.style.display=standalone?'none':''});if(!standalone)return;var chemistryToggle=card.querySelector('[data-body-field="chemistryEnabled"]'),automationToggle=card.querySelector('[data-body-field="automationEnabled"]');if(chemistryToggle&&chemistryToggle.checked){chemistryToggle.checked=false;toggleChemistryAutomation(chemistryToggle)}if(automationToggle&&automationToggle.checked){automationToggle.checked=false;toggleEquipmentAutomation(automationToggle)}var sanitization=card.querySelector('[data-body-field="sanitization"]');if(sanitization){sanitization.value='Chlorine';renderPrimarySanitizer(sanitization);var primary=card.querySelector('.primary-sanitizer-card'),make=primary&&primary.querySelector('[data-equipment-field="make"]');if(make){make.value='Floater';updateSanitizerModels(make)}}}
  pmosReorderCatalogMakes();
  if(typeof prepareWaterBodyOptions==='function'){var basePrepare=prepareWaterBodyOptions;prepareWaterBodyOptions=function(root){var result=basePrepare.apply(this,arguments);Array.prototype.forEach.call((root||document).querySelectorAll('.water-body'),function(card){pmosInstallBodyOverview(card);pmosConfigureStandaloneBody(card)});return result}}
  if(typeof addWaterBody==='function'){var baseAddBody=addWaterBody;addWaterBody=function(){var result=baseAddBody.apply(this,arguments),cards=document.querySelectorAll('.water-body'),card=cards[cards.length-1];pmosInstallBodyOverview(card);return result}}
  if(typeof configureSpaEquipment==='function'){var baseConfigureSpa=configureSpaEquipment;configureSpaEquipment=function(card){var result=baseConfigureSpa.apply(this,arguments);pmosConfigureStandaloneBody(card);return result}}
  if(typeof collectWaterBodies==='function'){var baseCollect=collectWaterBodies;collectWaterBodies=function(){var bodies=baseCollect.apply(this,arguments)||[],cards=document.querySelectorAll('.water-body');Array.prototype.forEach.call(cards,function(card,index){if(!bodies[index])return;bodies[index].shape=fieldValue(card,'[data-body-field="shape"]');bodies[index].volume=fieldValue(card,'[data-body-field="volume"]')});return bodies}}
  if(typeof hydrateBodies==='function'){var baseHydrate=hydrateBodies;hydrateBodies=function(bodies){var result=baseHydrate.apply(this,arguments),rows=bodies||[],cards=document.querySelectorAll('.water-body');Array.prototype.forEach.call(cards,function(card,index){pmosInstallBodyOverview(card);var body=rows[index]||{},shape=card.querySelector('[data-body-field="shape"]'),volume=card.querySelector('[data-body-field="volume"]');if(shape)shape.value=body.shape||'';if(volume)volume.value=body.volume||'';pmosConfigureStandaloneBody(card)});return result}}
})();
`;
  };
})();
