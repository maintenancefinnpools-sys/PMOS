/**
 * Shared equipment/catalog enhancements used by every PMOS customer form.
 *
 * Extends the common editor rather than creating Sheets/Web variants. Adds
 * broader legacy pump/chlorinator coverage, explicit chemistry-automation
 * accessories, and solar-heating sub-equipment.
 */
(function () {
  if (typeof pmosCustomerEquipmentEditorStyles_ === 'function') {
    const baseStyles = pmosCustomerEquipmentEditorStyles_;
    pmosCustomerEquipmentEditorStyles_ = function () {
      return baseStyles() +
        '.chemistry-selectors{display:grid;grid-column:1/-1;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}' +
        '.chemistry-selectors>label,.chemistry-component-row>label,.chemistry-other-equipment{display:flex;flex-direction:column;gap:5px;color:#6f7d84;font-size:11px;font-weight:900;letter-spacing:.07em;text-transform:uppercase}' +
        '.chemistry-fields>[data-chemistry-equipment-host]{grid-column:1/-1}.chemistry-equipment-card{margin-top:2px}' +
        '.chemistry-component-list{display:grid;gap:8px}.chemistry-component-row{display:grid;grid-template-columns:minmax(150px,.8fr) repeat(2,minmax(0,1fr));gap:10px;align-items:end;padding:9px;border:1px solid #dbeafe;border-radius:8px;background:#f8fafc}' +
        '.chemistry-component-name{align-self:center;color:#293944;font-size:12px;font-weight:900}.chemistry-other-equipment{padding-top:3px}' +
        '.pmos-solar-panel{grid-column:1/-1;margin:4px 0 0;padding:10px;border:1px solid #c9dde6;border-radius:8px;background:#fff}' +
        '.pmos-solar-title{margin-bottom:8px;color:#293944;font-size:12px;font-weight:900}' +
        '.pmos-solar-options{display:grid;gap:8px}' +
        '.pmos-solar-option{display:grid;gap:7px;padding:9px;border:1px solid #dbeafe;border-radius:8px;background:#f8fafc}' +
        '.pmos-solar-fields{display:none;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}' +
        '.pmos-solar-fields.open{display:grid}' +
        '.pmos-solar-fields label{display:flex;flex-direction:column;gap:4px;color:#6f7d84;font-size:11px;font-weight:900;text-transform:uppercase}' +
        '.pmos-solar-fields input{width:100%;min-height:34px;padding:6px 8px;border:1px solid #bfcbd1;border-radius:7px;background:#fff;color:#293944;font:inherit;font-size:13px}' +
        '@media(max-width:760px){.chemistry-selectors,.chemistry-component-row,.pmos-solar-fields{grid-template-columns:1fr}}';
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

  var PMOS_SOLAR_AUTOMATION_CATALOG={
    Pentair:[
      {name:'SolarTouch Control Only',numbers:['521590']},
      {name:'SolarTouch Drain-Down Valve Package',numbers:['521592']},
      {name:'SolarTouch 3-Way Valve Package',numbers:['521632']},
      {name:'SunTouch Solar Control System (Legacy)',numbers:['520819']},
      {name:'SunTouch Solar with 3-Way Valve (Legacy)',numbers:['520856']},
      {name:'SunTouch Booster Pump Version (Legacy)',numbers:['520857']},
      {name:'SunTouch Single Body Control (Legacy)',numbers:['520859']},
      {name:'SunTouch Pool/Spa Control (Legacy)',numbers:['520820']}
    ],
    'Hayward / Goldline':[{name:'AquaSolar GL-235 (Legacy)',numbers:['GL-235']}]
  };

  function pmosFindEquipmentByNumber(unit,value){
    var target=pmosNormEquipmentNumber(value),found=null;if(!target)return null;
    Object.keys(PMOS_EQUIPMENT_CATALOG[unit]||{}).some(function(make){return (PMOS_EQUIPMENT_CATALOG[unit][make]||[]).some(function(model){var exact=(model.numbers||[]).filter(function(number){return pmosNormEquipmentNumber(pmosCatalogNumberValue(number))===target})[0];if(exact){found={make:make,model:model.name,modelNumber:pmosCatalogNumberValue(exact)};return true}return false})});return found
  }
  function pmosFindSanitizerByTypeNumber(type,value){
    var target=pmosNormEquipmentNumber(value),found=null;if(!target)return null;
    Object.keys(PMOS_SANITIZER_CATALOG[type]||{}).some(function(make){return (PMOS_SANITIZER_CATALOG[type][make]||[]).some(function(model){var modelExact=(model.modelNumbers||[]).filter(function(number){return pmosNormEquipmentNumber(pmosCatalogNumberValue(number))===target})[0],partExact=(model.partNumbers||model.numbers||[]).filter(function(number){return pmosNormEquipmentNumber(pmosCatalogNumberValue(number))===target})[0],exact=modelExact||partExact;if(exact){found={make:make,model:model.name,field:modelExact?'modelNumber':'partNumber',number:pmosCatalogNumberValue(exact)};return true}return false})});return found
  }
  function pmosFindSolarAutomationByNumber(value){
    var target=pmosNormEquipmentNumber(value),found=null;if(!target)return null;Object.keys(PMOS_SOLAR_AUTOMATION_CATALOG).some(function(make){return PMOS_SOLAR_AUTOMATION_CATALOG[make].some(function(model){var exact=(model.numbers||[]).filter(function(number){return pmosNormEquipmentNumber(number)===target})[0];if(exact){found={make:make,model:model.name,modelNumber:exact};return true}return false})});return found
  }

  /* Correct reverse lookup inside the sanitizer type selected on the card. */
  document.addEventListener('input',function(event){var input=event.target,field=input&&input.getAttribute('data-equipment-field');if(field!=='modelNumber'&&field!=='partNumber')return;var card=input.closest('.equipment-card'),type=card&&card.getAttribute('data-equipment-type');if(!type||!PMOS_SANITIZER_CATALOG[type])return;var match=pmosFindSanitizerByTypeNumber(type,input.value);if(!match)return;var make=card.querySelector('[data-equipment-field="make"]'),model=card.querySelector('[data-equipment-field="model"]');if(make){make.value=match.make;make.dispatchEvent(new Event('input',{bubbles:true}))}if(model){model.value=match.model;model.dispatchEvent(new Event('input',{bubbles:true}))}var number=card.querySelector('[data-equipment-field="'+match.field+'"]');if(number)number.value=match.number});

  /* Solar is a heating method, but collector make/model may be freely typed. */
  var baseTypedCatalogModels=typedCatalogModels;
  typedCatalogModels=function(unit,make,type){if(unit==='heater'&&String(type||'').trim().toLowerCase()==='solar')return[];return baseTypedCatalogModels(unit,make,type)};

  function pmosEnsureSolarHeaterOptions(root){
    Array.prototype.forEach.call((root||document).querySelectorAll('datalist[id*="HeaterTypes"],datalist[id*="heaterTypes"]'),function(list){if(!Array.prototype.some.call(list.options,function(option){return String(option.value||'').toLowerCase()==='solar'})){var option=document.createElement('option');option.value='Solar';list.appendChild(option)}});
  }
  function pmosSolarInput(label,key,listHtml){return '<label>'+label+'<input data-solar-field="'+key+'" '+(listHtml||'')+'></label>'}
  function pmosSolarToggleHtml(kind,label,fields){return '<div class="pmos-solar-option" data-solar-kind="'+kind+'"><label class="check-row"><input type="checkbox" data-solar-enabled="'+kind+'"> '+label+'</label><div class="pmos-solar-fields">'+fields+'</div></div>'}
  function pmosSolarAutomationMakes(suffix){return '<datalist id="solarAutomationMakes_'+suffix+'">'+Object.keys(PMOS_SOLAR_AUTOMATION_CATALOG).map(function(make){return '<option value="'+esc(make)+'">'}).join('')+'</datalist>'}
  function pmosPumpMakes(suffix){return '<datalist id="solarPumpMakes_'+suffix+'">'+Object.keys(PMOS_EQUIPMENT_CATALOG.pump||{}).map(function(make){return '<option value="'+esc(make)+'">'}).join('')+'</datalist>'}
  function pmosActuatorMakes(suffix){return '<datalist id="solarActuatorMakes_'+suffix+'">'+Object.keys(PMOS_VALVE_ACTUATOR_CATALOG||{}).map(function(make){return '<option value="'+esc(make)+'">'}).join('')+'</datalist>'}

  function pmosInstallSolarPanel(host){
    if(!host||host.querySelector('.pmos-solar-panel'))return;var grid=host.classList.contains('water-body')?host.querySelector('.body-grid'):host.querySelector('.equipment-grid');if(!grid)return;var suffix='solar_'+Date.now()+'_'+Math.round(Math.random()*100000),panel=document.createElement('div');panel.className='pmos-solar-panel';panel.style.display='none';
    panel.innerHTML='<div class="pmos-solar-title">Solar Heating Equipment</div><div class="pmos-solar-options">'+
      pmosSolarToggleHtml('booster','Booster Pump',pmosSolarInput('Make','boosterMake','list="solarPumpMakes_'+suffix+'"')+pmosSolarInput('Model','boosterModel','list="solarPumpModels_'+suffix+'"')+pmosSolarInput('Model #','boosterModelNumber','list="solarPumpNumbers_'+suffix+'"')+'<datalist id="solarPumpModels_'+suffix+'"></datalist><datalist id="solarPumpNumbers_'+suffix+'"></datalist>'+pmosPumpMakes(suffix))+
      pmosSolarToggleHtml('actuator','Valve Actuator',pmosSolarInput('Make','actuatorMake','list="solarActuatorMakes_'+suffix+'"')+pmosSolarInput('Model','actuatorModel','list="solarActuatorModels_'+suffix+'"')+pmosSolarInput('Model #','actuatorModelNumber','list="solarActuatorNumbers_'+suffix+'"')+'<datalist id="solarActuatorModels_'+suffix+'"></datalist><datalist id="solarActuatorNumbers_'+suffix+'"></datalist>'+pmosActuatorMakes(suffix))+
      pmosSolarToggleHtml('automation','Solar Automation',pmosSolarInput('Make','automationMake','list="solarAutomationMakes_'+suffix+'"')+pmosSolarInput('Model','automationModel','list="solarAutomationModels_'+suffix+'"')+pmosSolarInput('Model #','automationModelNumber','list="solarAutomationNumbers_'+suffix+'"')+'<datalist id="solarAutomationModels_'+suffix+'"></datalist><datalist id="solarAutomationNumbers_'+suffix+'"></datalist>'+pmosSolarAutomationMakes(suffix))+
      '</div>';if(host.classList.contains('water-body')){var coverTitle=Array.prototype.filter.call(grid.querySelectorAll('.unit-title'),function(title){return String(title.textContent||'').trim()==='Covers'})[0];if(coverTitle)grid.insertBefore(panel,coverTitle);else grid.appendChild(panel)}else grid.appendChild(panel);
    Array.prototype.forEach.call(panel.querySelectorAll('[data-solar-enabled]'),function(box){box.addEventListener('change',function(){var fields=box.closest('.pmos-solar-option').querySelector('.pmos-solar-fields');fields.classList.toggle('open',box.checked)})});
    panel.addEventListener('input',pmosSolarPanelInput);
    host.dataset.pmosSolarInstalled='1';
  }
  function pmosSolarPanelInput(event){
    var input=event.target,key=input&&input.getAttribute('data-solar-field');if(!key)return;var option=input.closest('.pmos-solar-option'),make,model,number,list,models,match;
    if(key==='boosterMake'){make=input;model=option.querySelector('[data-solar-field="boosterModel"]');number=option.querySelector('[data-solar-field="boosterModelNumber"]');models=findCatalogMake('pump',make.value);list=document.getElementById(model.getAttribute('list'));if(list)list.innerHTML=models.map(function(item){return '<option value="'+esc(item.name)+'">'}).join('');model.value='';number.value=''}
    if(key==='boosterModel'){make=option.querySelector('[data-solar-field="boosterMake"]');model=input;number=option.querySelector('[data-solar-field="boosterModelNumber"]');models=findCatalogMake('pump',make.value);match=models.filter(function(item){return String(item.name||'').toLowerCase()===String(model.value||'').toLowerCase()})[0];list=document.getElementById(number.getAttribute('list'));if(list)list.innerHTML=(match&&match.numbers||[]).map(function(value){return '<option value="'+esc(pmosCatalogNumberValue(value))+'">'}).join('')}
    if(key==='boosterModelNumber'){match=pmosFindEquipmentByNumber('pump',input.value);if(match){option.querySelector('[data-solar-field="boosterMake"]').value=match.make;option.querySelector('[data-solar-field="boosterModel"]').value=match.model;input.value=match.modelNumber}}
    if(key==='actuatorMake'){models=valveActuatorModels(input.value);model=option.querySelector('[data-solar-field="actuatorModel"]');number=option.querySelector('[data-solar-field="actuatorModelNumber"]');list=document.getElementById(model.getAttribute('list'));if(list)list.innerHTML=models.map(function(item){return '<option value="'+esc(item.name)+'">'}).join('');model.value='';number.value=''}
    if(key==='actuatorModel'){make=option.querySelector('[data-solar-field="actuatorMake"]');models=valveActuatorModels(make.value);match=models.filter(function(item){return String(item.name||'').toLowerCase()===String(input.value||'').toLowerCase()})[0];number=option.querySelector('[data-solar-field="actuatorModelNumber"]');list=document.getElementById(number.getAttribute('list'));if(list)list.innerHTML=(match&&match.numbers||[]).map(function(value){return '<option value="'+esc(value)+'">'}).join('')}
    if(key==='automationMake'){models=PMOS_SOLAR_AUTOMATION_CATALOG[input.value]||[];model=option.querySelector('[data-solar-field="automationModel"]');number=option.querySelector('[data-solar-field="automationModelNumber"]');list=document.getElementById(model.getAttribute('list'));if(list)list.innerHTML=models.map(function(item){return '<option value="'+esc(item.name)+'">'}).join('');model.value='';number.value=''}
    if(key==='automationModel'){make=option.querySelector('[data-solar-field="automationMake"]');models=PMOS_SOLAR_AUTOMATION_CATALOG[make.value]||[];match=models.filter(function(item){return String(item.name||'').toLowerCase()===String(input.value||'').toLowerCase()})[0];number=option.querySelector('[data-solar-field="automationModelNumber"]');list=document.getElementById(number.getAttribute('list'));if(list)list.innerHTML=(match&&match.numbers||[]).map(function(value){return '<option value="'+esc(value)+'">'}).join('')}
    if(key==='automationModelNumber'){match=pmosFindSolarAutomationByNumber(input.value);if(match){option.querySelector('[data-solar-field="automationMake"]').value=match.make;option.querySelector('[data-solar-field="automationModel"]').value=match.model;input.value=match.modelNumber}}
  }
  function pmosConfigureSolarHost(host){if(!host)return;pmosInstallSolarPanel(host);var type=host.classList.contains('water-body')?host.querySelector('[data-body-field="heaterType"]'):host.querySelector('[data-equipment-field="heaterType"]'),panel=host.querySelector('.pmos-solar-panel');if(!type||!panel)return;panel.style.display=String(type.value||'').trim().toLowerCase()==='solar'?'block':'none'}
  function pmosInstallSolarOnBody(body){if(!body)return;pmosEnsureSolarHeaterOptions(body);pmosInstallSolarPanel(body);var type=body.querySelector('[data-body-field="heaterType"]');if(type&&!type.dataset.pmosSolarBound){type.dataset.pmosSolarBound='1';type.addEventListener('input',function(){pmosConfigureSolarHost(body)});type.addEventListener('change',function(){pmosConfigureSolarHost(body)})}pmosConfigureSolarHost(body)}
  window.pmosHydrateSolarEquipmentDetails=function(body,type,details){var config={SOLAR_BOOSTER_PUMP:['booster','booster'],SOLAR_VALVE_ACTUATOR:['actuator','actuator'],SOLAR_AUTOMATION:['automation','automation']}[type],panel=body&&body.querySelector('.pmos-solar-panel');if(!config||!panel)return false;var option=panel.querySelector('[data-solar-kind="'+config[0]+'"]'),enabled=option&&option.querySelector('[data-solar-enabled="'+config[0]+'"]'),fields=option&&option.querySelector('.pmos-solar-fields');if(!option||!enabled||!fields)return false;enabled.checked=true;fields.classList.add('open');Object.keys(details||{}).forEach(function(key){var fieldKey=config[1]+key.charAt(0).toUpperCase()+key.slice(1),input=option.querySelector('[data-solar-field="'+fieldKey+'"]');if(input)input.value=details[key]==null?'':details[key]});pmosConfigureSolarHost(body);return true};

  var previousAddWaterBody=addWaterBody;
  addWaterBody=function(defaultName){previousAddWaterBody(defaultName);var bodies=document.querySelectorAll('.water-body'),body=bodies[bodies.length-1];pmosInstallSolarOnBody(body)};
  var previousAddEquipment=addEquipment;
  addEquipment=function(bodyCard,type,defaults){previousAddEquipment(bodyCard,type,defaults);if(type==='HEATER'){var cards=bodyCard.querySelectorAll('[data-equipment-type="HEATER"]'),card=cards[cards.length-1];pmosEnsureSolarHeaterOptions(card);pmosInstallSolarPanel(card);var heaterType=card&&card.querySelector('[data-equipment-field="heaterType"]');if(heaterType){heaterType.addEventListener('input',function(){pmosConfigureSolarHost(card)});heaterType.addEventListener('change',function(){pmosConfigureSolarHost(card)});pmosConfigureSolarHost(card)}}};

  var previousCollectWaterBodies=collectWaterBodies;
  collectWaterBodies=function(){
    var bodies=previousCollectWaterBodies(),cards=document.querySelectorAll('.water-body');
    bodies.forEach(function(body,index){
      body.equipment=body.equipment||[];var card=cards[index];
      if(!card)return;
      Array.prototype.forEach.call(card.querySelectorAll('.pmos-solar-panel'),function(panel){
        function add(kind,type,keys){var option=panel.querySelector('[data-solar-kind="'+kind+'"]'),enabled=option&&option.querySelector('[data-solar-enabled="'+kind+'"]');if(!enabled||!enabled.checked)return;var details={};keys.forEach(function(key){var input=option.querySelector('[data-solar-field="'+key+'"]');details[key.replace(/^(booster|actuator|automation)/,'').replace(/^./,function(c){return c.toLowerCase()})]=input?String(input.value||'').trim():''});body.equipment.push({type:type,details:details})}
        add('booster','SOLAR_BOOSTER_PUMP',['boosterMake','boosterModel','boosterModelNumber']);
        add('actuator','SOLAR_VALVE_ACTUATOR',['actuatorMake','actuatorModel','actuatorModelNumber']);
        add('automation','SOLAR_AUTOMATION',['automationMake','automationModel','automationModelNumber']);
      });
    });return bodies
  };

  var previousEquipmentTypeLabel=equipmentTypeLabel;
  equipmentTypeLabel=function(type){return {FLOW_CELL:'Flow Cell',ACID_TANK:'Acid Tank',CHLORINE_TANK:'Chlorine Tank',PH_PROBE:'pH Probe',ORP_PROBE:'ORP Probe',SOLAR_BOOSTER_PUMP:'Solar Booster Pump',SOLAR_VALVE_ACTUATOR:'Valve Actuator',SOLAR_AUTOMATION:'Solar Automation'}[type]||previousEquipmentTypeLabel(type)};

  pmosEnsureSolarHeaterOptions(document);
})();
`;
  };
})();
