#!/usr/bin/env node
/*
 * Characterize the complete customer browser assets before consolidation.
 *
 * PMOS historically assembled these assets by repeatedly replacing builder
 * functions at Apps Script load time.  The hashes below intentionally freeze
 * the generated output so that a mechanical consolidation cannot silently
 * omit styling, event wiring, compatibility hydration, or context bridges.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(root)
  .filter((name) => /^24.*\.gs$/.test(name))
  .sort();
const context = {console};
context.window = context;
vm.createContext(context);
for (const name of files) {
  vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, {filename: name});
}

function digest(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function assertHash(label, value, expected) {
  const actual = digest(value);
  if (actual !== expected) {
    throw new Error(`${label} changed: expected ${expected}, received ${actual}`);
  }
}

assertHash(
  'Customer equipment styles',
  context.pmosCustomerEquipmentEditorStyles_(),
  '9951719a80a63289d1ec94a50e4ade81ef71d659e645061fd9251f6a1a3a780a',
);
assertHash(
  'Customer equipment script',
  context.pmosCustomerEquipmentEditorScript_(),
  'e2b9cd7dc91577af67811deed308dc21c017ee87599044c0bef60b20b57933a0',
);
assertHash(
  'Account-contact styles',
  context.pmosAccountContactStyles_(),
  '3f33e88ca7f644ba7c25ce157d09035d47e3e67f699aaacbe59de6268594958c',
);
assertHash(
  'Account-contact script',
  context.pmosAccountContactClientScript_(),
  '1ed9f8e2e48c30de767bcac5404a0aa7ba03e78434a2037b303fb461ba38dc6a',
);
assertHash(
  'Service-location-contact styles',
  context.pmosServiceLocationContactStyles_(),
  '39db954e88a3399d4bab895afe3afae8dd37d0488390ef443c5660a7e7aa3914',
);
assertHash(
  'Service-location-contact script',
  context.pmosServiceLocationContactClientScript_(),
  '5a1178e2674d5b87fe66c45fbc4c39b1f854eb38313627254e311f804764e710',
);

const runtimeHashes = {
  ADD_CUSTOMER: '0d00542913e64f675fa80deef7e05801a7671f5508d6ba4292c8aa8f6696f8af',
  ADD_MAINTENANCE: '8eed2f02db021aad765a76e182746abbd60a8f81a1fb6e02a4ac79494f985b1c',
  EDITOR: 'e0c9b40cea38055d1bb2e673ec46a32abba431152351f330f27a9b279f762714',
  LOOKUP: 'e0c9b40cea38055d1bb2e673ec46a32abba431152351f330f27a9b279f762714',
};
for (const [runtimeContext, expected] of Object.entries(runtimeHashes)) {
  const assets = context.pmosWithRuntimeCustomerFormAssets_(runtimeContext, function() {
    return {
      css: context.pmosCustomerEquipmentEditorStyles_(),
      script: context.pmosCustomerEquipmentEditorScript_(),
    };
  });
  assertHash(`${runtimeContext} runtime styles`, assets.css,
    '9951719a80a63289d1ec94a50e4ade81ef71d659e645061fd9251f6a1a3a780a');
  assertHash(`${runtimeContext} runtime script`, assets.script, expected);
}

console.log('Customer asset snapshot clean: complete Sheets/Web scripts and styles are unchanged.');
