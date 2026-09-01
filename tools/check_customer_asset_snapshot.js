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
  'eea7b0e303722d8ca528907c2ece93e70b051db236d86436fbb80f47cafcdbbf',
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
  ADD_CUSTOMER: '9eeab0e87fe551e3e84db420fcbb30fe8cff6a2501b6a2024a1aa1d56a22623e',
  ADD_MAINTENANCE: '80ace1802c1e785dbffb301b4929d2fb536d8217f63e8cab5bd7831da267aa83',
  EDITOR: '91b2563d39f943767ebf8141141c7641455f52c38be54f5c8e2c33a12284c529',
  LOOKUP: '91b2563d39f943767ebf8141141c7641455f52c38be54f5c8e2c33a12284c529',
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
