#!/usr/bin/env node
/*
 * Characterize the complete customer browser assets after each approved UI baseline.
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
  'be5a2e653934932e79786be5d5c8cf70d050a9e1f2c2dcaa4abada13f02df44a',
);
assertHash(
  'Customer equipment script',
  context.pmosCustomerEquipmentEditorScript_(),
  '1d309085109871cb19ae0ca9d4855d5da6f02eef96c17d3d7be78c4e2905f0d1',
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
  ADD_CUSTOMER: 'c360ccb906eb53921a349df8923dace9ffec90b6990699728d72865b806bf868',
  ADD_MAINTENANCE: '898a4d42cc0fb9e896e3fcc3b95f3bc156afb8d6f7172d148edd38e82285b4e2',
  EDITOR: '5b53435f0ee0bd1d086ed42aa9a52ddf095868ef66bc7c87fdacfa184e1c903d',
  LOOKUP: '5b53435f0ee0bd1d086ed42aa9a52ddf095868ef66bc7c87fdacfa184e1c903d',
};
for (const [runtimeContext, expected] of Object.entries(runtimeHashes)) {
  const assets = context.pmosWithRuntimeCustomerFormAssets_(runtimeContext, function() {
    return {
      css: context.pmosCustomerEquipmentEditorStyles_(),
      script: context.pmosCustomerEquipmentEditorScript_(),
    };
  });
  assertHash(`${runtimeContext} runtime styles`, assets.css,
    'be5a2e653934932e79786be5d5c8cf70d050a9e1f2c2dcaa4abada13f02df44a');
  assertHash(`${runtimeContext} runtime script`, assets.script, expected);
}

console.log('Customer asset snapshot clean: complete Sheets/Web scripts and styles are unchanged.');
