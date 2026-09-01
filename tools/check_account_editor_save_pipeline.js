#!/usr/bin/env node
/* Functional contract for the canonical account-editor save orchestration. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, '24-M_Customer_Account_Shared_Fields.gs'), 'utf8');
const context = {console};
vm.createContext(context);
vm.runInContext(source, context, {filename: '24-M_Customer_Account_Shared_Fields.gs'});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const calls = [];
context.unpackPmosContextNotesEnvelope_ = function(input) {
  calls.push('decode');
  return Object.assign({}, input, {decoded: true});
};
context.savePmosCustomerAccountEditorDataCore_ = function(input) {
  calls.push('save');
  assert(input.decoded === true, 'The save received an undecoded compatibility envelope.');
  return {customerId: 'C-300'};
};
context.savePmosCustomerContextNotes_ = function(customerId, input) {
  calls.push('context-notes');
  assert(customerId === 'C-300' && input.decoded, 'Context Notes received the wrong save request.');
  return {customerId};
};
context.getPmosCustomerAccountProfile = function(customerId) {
  calls.push('profile');
  return {customerId};
};
context.normalizePmosProfileEquipmentForContext_ = function(profile) {
  calls.push('normalize-profile');
  return Object.assign({}, profile, {normalized: true});
};

const result = context.savePmosCustomerAccountEditorData({notes: 'Visible note'});
assert(calls.join('>') === 'decode>save>context-notes>profile>normalize-profile',
  `Account editor save order changed: ${calls.join('>')}`);
assert(result.contextNotes.customerId === 'C-300' && result.profile.normalized === true,
  'Account editor save lost a result-stage contribution.');

calls.length = 0;
context.savePmosCustomerContextNotes_ = function() {
  calls.push('context-notes');
  throw new Error('context unavailable');
};
const warningResult = context.savePmosCustomerAccountEditorData({notes: 'Visible note'});
assert(calls.includes('profile'), 'Profile hydration stopped after a contextual-note warning.');
assert(warningResult.contextNoteWarning.includes('context unavailable'),
  'Contextual-note failure was not preserved as a non-destructive warning.');

for (const name of ['24-V_Customer_Context_Notes.gs', '24-W_Customer_Context_Notes_UI.gs']) {
  const text = fs.readFileSync(path.join(root, name), 'utf8');
  assert(!/savePmosCustomerAccountEditorData\s*=\s*function/.test(text),
    `${name} still replaces the canonical account-editor save.`);
}

console.log('Canonical account-editor save pipeline passed.');
