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
  '876a6769464e47439753b6b4a750ef5d232eadc057b57b4d6106cb7e478c6d24',
);
assertHash(
  'Customer equipment script',
  context.pmosCustomerEquipmentEditorScript_(),
  '26f0b5b1cfded81af988179395737e6ce236fb98a1edc5d9b7eaf22ae7043244',
);
assertHash(
  'Account-contact styles',
  context.pmosAccountContactStyles_(),
  '3f33e88ca7f644ba7c25ce157d09035d47e3e67f699aaacbe59de6268594958c',
);
assertHash(
  'Account-contact script',
  context.pmosAccountContactClientScript_(),
  '06f9a4f66312ec82e6ae7949dcc056533ffbc15bd97a11f37636270d059b18b7',
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
  ADD_CUSTOMER: 'e73c2705a87a7bb707627c103d2d64433e680c916625757daaf5ce6b9d284df1',
  ADD_MAINTENANCE: '6db8176c7d8e78ee8a8f4a89c3c2de594cf697596248dc1e407e67bf1b58a52b',
  EDITOR: '27b9ee960e498684ea97b72c722a3f9d78854d18cfff1712fc1a85463f6432a0',
  LOOKUP: '27b9ee960e498684ea97b72c722a3f9d78854d18cfff1712fc1a85463f6432a0',
};
for (const [runtimeContext, expected] of Object.entries(runtimeHashes)) {
  const assets = context.pmosWithRuntimeCustomerFormAssets_(runtimeContext, function() {
    return {
      css: context.pmosCustomerEquipmentEditorStyles_(),
      script: context.pmosCustomerEquipmentEditorScript_(),
    };
  });
  assertHash(`${runtimeContext} runtime styles`, assets.css,
    '876a6769464e47439753b6b4a750ef5d232eadc057b57b4d6106cb7e478c6d24');
  assertHash(`${runtimeContext} runtime script`, assets.script, expected);
}

console.log('Customer asset snapshot clean: complete Sheets/Web scripts and styles are unchanged.');
