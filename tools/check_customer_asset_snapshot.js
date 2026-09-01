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
  'e70a2f5ac56ba5b81e30a0ef8b6f14c637b9e67df2615b2d2804aa641851c36e',
);
assertHash(
  'Customer equipment script',
  context.pmosCustomerEquipmentEditorScript_(),
  '9e4516e574a22a3332172cca4ac800b6c0d05bb09bef1d74e2a157548e5bc7e8',
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
  ADD_CUSTOMER: 'c5acbc93c7b917c461974090429304ee1047cc729a13336acd5f955c59e8d5e3',
  ADD_MAINTENANCE: '48c28d0aaf3e283b0de02d32b488c1687262b121db9bd4ff8a735300353ff390',
  EDITOR: 'e734fa0b593c660e5b2ffe53642385d04a79254d569dc90c2edeb0136ca5bd24',
  LOOKUP: 'e734fa0b593c660e5b2ffe53642385d04a79254d569dc90c2edeb0136ca5bd24',
};
for (const [runtimeContext, expected] of Object.entries(runtimeHashes)) {
  const assets = context.pmosWithRuntimeCustomerFormAssets_(runtimeContext, function() {
    return {
      css: context.pmosCustomerEquipmentEditorStyles_(),
      script: context.pmosCustomerEquipmentEditorScript_(),
    };
  });
  assertHash(`${runtimeContext} runtime styles`, assets.css,
    'e70a2f5ac56ba5b81e30a0ef8b6f14c637b9e67df2615b2d2804aa641851c36e');
  assertHash(`${runtimeContext} runtime script`, assets.script, expected);
}

console.log('Customer asset snapshot clean: complete Sheets/Web scripts and styles are unchanged.');
