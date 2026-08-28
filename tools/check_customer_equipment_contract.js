#!/usr/bin/env node
/* Runtime contract for shared customer equipment catalogs and chemistry defaults. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = [
  '24-F_Customer_Equipment_Editor_Component.gs',
  '24-U_Customer_Equipment_Enhancements.gs',
].map((name) => fs.readFileSync(path.join(root, name), 'utf8')).join('\n');
const context = {
  console,
  document: {
    addEventListener() {},
    querySelectorAll() { return []; },
  },
};
context.window = context;
vm.createContext(context);
vm.runInContext(
  source + '\nthis.clientSource=pmosCustomerEquipmentEditorScript_();this.editorStyles=pmosCustomerEquipmentEditorStyles_();',
  context,
);
vm.runInContext(context.clientSource, context);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const saltNature2 = context.PMOS_SANITIZER_CATALOG.SALT_SYSTEM.Nature2 || [];
const chlorineNature2 = context.PMOS_SANITIZER_CATALOG.CHLORINE_FEEDER.Nature2 || [];
const pentairFeeders = context.PMOS_SANITIZER_CATALOG.CHLORINE_FEEDER.Pentair || [];

assert(saltNature2.some((item) => (item.partNumbers || []).includes('FSOFT700')), 'Nature2 Fusion Soft 700 is missing.');
assert(saltNature2.some((item) => (item.partNumbers || []).includes('FSOFT1400')), 'Nature2 Fusion Soft 1400 is missing.');
assert(chlorineNature2.some((item) => (item.partNumbers || []).includes('FUSION')), 'Nature2 Fusion chlorine feeder is missing.');
assert(pentairFeeders.some((item) => (item.partNumbers || []).includes('522473')), 'Pentair IntelliChem chlorine tank is missing.');

const sanitizerHtml = context.sanitizerFieldsHtml('CHLORINE_FEEDER', 'test');
assert(sanitizerHtml.includes('data-equipment-field="modelNumber"'), 'Sanitizer model-number field is missing.');
assert(sanitizerHtml.includes('data-equipment-field="partNumber"'), 'Sanitizer part-number field is missing.');
assert(sanitizerHtml.includes('data-sanitizer-model-number style="display:none"'), 'Empty sanitizer model-number fields must start hidden.');
assert(sanitizerHtml.includes('data-sanitizer-part-number style="display:none"'), 'Empty sanitizer part-number fields must start hidden.');
assert(context.editorStyles.includes('.automation-fields>label'), 'Equipment Automation typography is not shared.');
assert(context.editorStyles.includes('.chemistry-fields>label'), 'Chemistry Automation typography is not shared.');
assert(context.editorStyles.includes('.chemistry-component-row'), 'Orderly Chemistry Automation component rows are missing.');
assert(context.editorStyles.includes('.chemistry-component-list{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important'), 'Compact Chemistry Automation layout is not enforced by the core shared renderer.');
assert(context.editorStyles.includes('grid-template-columns:repeat(2,minmax(0,1fr))'), 'Chemistry Automation does not use the compact two-column desktop layout.');
assert(context.clientSource.includes('chemistry-selectors'), 'Compact Chemistry Automation selectors are missing.');
assert(context.clientSource.includes('chemistry-equipment-card'), 'Chemistry Automation equipment card is missing.');
assert(context.editorStyles.includes('.chemistry-equipment-host{grid-column:1/-1;width:100%'), 'Chemistry Automation equipment card is not full width.');
assert(context.clientSource.includes("box.insertAdjacentElement('afterend',host)"), 'Chemistry Automation equipment card is not below both automation selectors.');
assert(context.clientSource.includes("host.style.display=checkbox.checked?'block':'none'"), 'Full-width Chemistry Automation equipment card does not follow its toggle.');
assert(context.clientSource.includes('hydrateChemistryAutomationDetails'), 'Chemistry Automation detail hydration is missing.');
assert(context.clientSource.includes('pmosEnsureCustomerBodyEnhancements'), 'Core equipment renderer does not invoke the shared body enhancements.');
assert(context.clientSource.includes('pmosConfigureSolarHeating'), 'Core equipment renderer does not wire Solar Heating changes.');
assert(context.clientSource.includes('pmosConfigureSharedBody'), 'Shared Pool/Spa equipment inheritance is missing.');
assert(context.clientSource.includes('All equipment shared with Pool'), 'Shared Pool/Spa equipment summary is missing.');
assert(context.clientSource.includes("bodies[index].sanitization=''"), 'Shared spa sanitization is still stored as duplicate equipment data.');
assert(context.clientSource.includes("item.type==='CHEMISTRY_AUTOMATION'||item.type==='EQUIPMENT_AUTOMATION'"), 'Shared spa automation duplication is not filtered from storage.');
assert(context.clientSource.includes('value="VALVE_ACTUATOR">Valve Actuator'), 'Spa-specific Valve Actuator add option is missing.');
assert(!context.clientSource.includes('prepareMainEquipmentPartNumbers'), 'Pump/filter/heater part-number fields should not be added.');
assert(!context.clientSource.includes('automationPartNumber'), 'Equipment Automation should not show a blanket part-number field.');

for (const partNumber of ['521357', '522621', '522622', '522472', '522473', '522186', '522187', '754000310', '521338Z', '521348Z']) {
  assert(context.clientSource.includes(partNumber), `IntelliChem component ${partNumber} is missing.`);
}
assert(context.clientSource.includes("fieldValue(body,'[data-body-field=\"sanitization\"]')!=='Chlorine'"), 'Chlorine chemistry default guard is missing.');
assert(context.clientSource.includes("model.value='IntelliChem Chlorine Tank with Tank-Mounted Pump'"), 'Chlorine tank default is missing.');
assert(!context.clientSource.includes('Choose the chemistry system above; its tanks, probes, flow cell, and dosing equipment appear together below.'), 'Obsolete chemistry helper message is still rendered.');
assert(context.clientSource.includes('function configurePrimaryHeaterType'), 'Core Solar heater refresh hook is missing.');
assert(context.clientSource.includes("'name','modelNumber','pumpMake'"), 'Water-feature generic model-number cleanup is missing.');
assert(context.clientSource.includes('ensureWaterFeatureActuatorFields(card);var label'), 'Water-feature valve actuator details are missing.');
assert(context.clientSource.includes('function pmosSyncFilterModelNumber'), 'Filter model-number dropdown synchronization is missing.');
assert(context.clientSource.includes('pmosFilterModelCode'), 'Filter model-number extraction is missing.');
assert(context.clientSource.includes('pmosWatchDynamicFilterFields'), 'Dynamic service-location filter dropdown initialization is missing.');
assert(context.clientSource.includes("data-body-field=\"shape\""), 'Body shape field is missing.');
assert(context.clientSource.includes("data-body-field=\"volume\""), 'Body volume field is missing.');
assert(context.clientSource.includes("standalone=bodyType==='spa'&&setup==='Self-Contained Unit'"), 'Standalone hot-tub guard is missing.');
assert(context.clientSource.includes("make.value='Floater'"), 'Standalone hot-tub floater default is missing.');
assert(context.clientSource.includes("SD60 (22.5 in · 250 lb)"), 'Pentair SD60 size metadata is not corrected.');
assert(context.clientSource.includes("?'145322':''"), 'Verified Pentair SD60 part number is missing.');
assert(context.clientSource.includes('data-body-field="filterModelNumber"'), 'Main filter model-number field is missing.');
assert(context.clientSource.includes('pmosInstallFilterModelNumber'), 'Added-filter model-number installer is missing.');
assert(context.clientSource.includes("attached.value='Attached Spa'"), 'Attached Spa classification is missing.');
const saltMakes = Object.keys(context.PMOS_SANITIZER_CATALOG.SALT_SYSTEM);
assert(saltMakes.indexOf('Jandy') < saltMakes.indexOf('Sta-Rite') && saltMakes.indexOf('Sta-Rite') < saltMakes.indexOf('Nature2'), 'Nature2 make ordering is incorrect.');

const profileSource = fs.readFileSync(path.join(root, '24-YZ_Customer_Equipment_Profile_Cards.gs'), 'utf8');
const profileContext = {
  console,
  navigator: {},
  setTimeout() {},
  document: {
    addEventListener() {},
    querySelector() { return null; },
  },
};
profileContext.window = profileContext;
vm.createContext(profileContext);
vm.runInContext(
  profileSource + '\nthis.profileClientSource=pmosCustomerEquipmentProfileClientScript_();this.profileStyles=pmosCustomerEquipmentProfileStyles_();',
  profileContext,
);
vm.runInContext(profileContext.profileClientSource, profileContext);
const sampleBodies = [{
  name: 'Pool',
  shape: 'Rectangle',
  volume: '75,000 L',
  sanitization: 'Chlorine',
  filter: {make: 'Pentair', type: 'Sand', model: 'SD60 (22.5 in · 250 lb)'},
  equipment: [{
    type: 'WATER_FEATURE',
    details: {featureType: 'Sheer Descent', actuatorMake: 'Pentair', actuatorModel: 'CVA-24T (180°)', actuatorModelNumber: '263045'},
  }],
}, {
  name: 'Spa', type: 'Spa', spaType: 'Spillover Spa', equipmentSetup: 'Shared with Pool', equipment: [],
}];
const profileHtml = profileContext.pmosRenderEquipmentProfiles(sampleBodies);
for (const token of ['22.5&quot; Diameter · 250 lb Sand', '145322', 'Water Feature: Sheer Descent', '263045', 'Spillover']) {
  assert(profileHtml.includes(token), `Shared equipment profile is missing ${token}.`);
}
assert(profileContext.profileStyles.includes('align-items:start'), 'Equipment cards do not expand independently.');
assert(profileContext.profileStyles.includes('color:#111'), 'Shape and volume badges do not use dark text.');
assert(profileContext.profileClientSource.includes('navigator.clipboard'), 'Clipboard API support is missing.');
assert(profileContext.profileClientSource.includes("document.execCommand('copy')"), 'Clipboard fallback is missing.');
assert(profileContext.profileClientSource.includes('function rawNumber(value)'), 'Copied equipment numbers are not normalized.');
assert(profileContext.profileClientSource.includes('data-pmos-adaptive-grid'), 'Equipment profiles do not opt into adaptive columns.');

console.log('Shared customer equipment contract clean: catalogs, body overview, standalone spa, and chemistry safeguards present.');
