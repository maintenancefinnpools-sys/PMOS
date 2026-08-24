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
assert(context.clientSource.includes('chemistry-selectors'), 'Compact Chemistry Automation selectors are missing.');
assert(context.clientSource.includes('chemistry-equipment-card'), 'Chemistry Automation equipment card is missing.');
assert(context.editorStyles.includes('.chemistry-equipment-host{grid-column:1/-1;width:100%'), 'Chemistry Automation equipment card is not full width.');
assert(context.clientSource.includes("box.insertAdjacentElement('afterend',host)"), 'Chemistry Automation equipment card is not below both automation selectors.');
assert(context.clientSource.includes("host.style.display=checkbox.checked?'block':'none'"), 'Full-width Chemistry Automation equipment card does not follow its toggle.');
assert(context.clientSource.includes('hydrateChemistryAutomationDetails'), 'Chemistry Automation detail hydration is missing.');
assert(!context.clientSource.includes('prepareMainEquipmentPartNumbers'), 'Pump/filter/heater part-number fields should not be added.');
assert(!context.clientSource.includes('automationPartNumber'), 'Equipment Automation should not show a blanket part-number field.');
assert(context.clientSource.includes('grid.insertBefore(panel,coverTitle)'), 'Solar equipment must appear inside the Heater area before Covers.');
assert(context.clientSource.includes('pmosHydrateSolarEquipmentDetails'), 'Saved Solar equipment must reopen inside the Heater card.');

for (const partNumber of ['521357', '522621', '522622', '522472', '522473', '522186', '522187', '754000310', '521338Z', '521348Z']) {
  assert(context.clientSource.includes(partNumber), `IntelliChem component ${partNumber} is missing.`);
}
assert(context.clientSource.includes("fieldValue(body,'[data-body-field=\"sanitization\"]')!=='Chlorine'"), 'Chlorine chemistry default guard is missing.');
assert(context.clientSource.includes("model.value='IntelliChem Chlorine Tank with Tank-Mounted Pump'"), 'Chlorine tank default is missing.');

console.log('Shared customer equipment contract clean: conditional catalog numbers, compact chemistry details, and heater-grouped solar equipment present.');
