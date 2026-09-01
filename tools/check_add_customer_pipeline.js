#!/usr/bin/env node
/* Functional contract for the canonical Add Customer orchestration. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, '24-R_Add_Customer.gs'), 'utf8');
const context = {console};
vm.createContext(context);
vm.runInContext(source, context, {filename: '24-R_Add_Customer.gs'});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const calls = [];
context.unpackPmosContextNotesEnvelope_ = function(input) {
  calls.push('decode');
  return Object.assign({}, input, {decoded: true});
};
context.pmosCustomerNotesRequest_ = function(input) {
  calls.push('notes-request');
  return Object.assign({}, input, {notes: input.generalNotes});
};
context.ensurePmosCustomerCategorizedNotes_ = function() { calls.push('ensure-notes'); };
context.createPmosCustomerAccountCore_ = function(input) {
  calls.push('transaction');
  assert(input.decoded === true, 'The transaction received an undecoded compatibility envelope.');
  assert(input.notes === 'Visible note', 'The transaction did not receive normalized General Notes.');
  return {customerId: 'C-200', warnings: []};
};
context.savePmosCustomerCategorizedNotes_ = function(customerId) {
  calls.push('categorized-notes');
  assert(customerId === 'C-200', 'Categorized Notes received the wrong customer.');
};
context.getPmosCustomerAccountProfile = function(customerId) {
  calls.push('profile');
  return {customerId};
};
context.savePmosCustomerContextNotes_ = function(customerId) {
  calls.push('context-notes');
  return {customerId};
};

const result = context.createPmosCustomerAccount({generalNotes: 'Visible note'});
assert(
  calls.join('>') === 'decode>notes-request>ensure-notes>transaction>categorized-notes>profile>context-notes',
  `Add Customer pipeline order changed: ${calls.join('>')}`,
);
assert(result.profile.customerId === 'C-200' && result.contextNotes.customerId === 'C-200',
  'Add Customer pipeline lost a result-stage contribution.');

calls.length = 0;
context.savePmosCustomerContextNotes_ = function() {
  calls.push('context-notes');
  throw new Error('context unavailable');
};
const warningResult = context.createPmosCustomerAccount({generalNotes: 'Visible note'});
assert(warningResult.profile.customerId === 'C-200', 'Profile hydration stopped after a contextual-note warning.');
assert(warningResult.warnings.some((warning) => warning.includes('context unavailable')),
  'Contextual-note failure was not preserved as a non-destructive warning.');

for (const name of [
  '24-T_Customer_Form_Enhancements.gs',
  '24-V_Customer_Context_Notes.gs',
  '24-W_Customer_Context_Notes_UI.gs',
]) {
  const text = fs.readFileSync(path.join(root, name), 'utf8');
  assert(!/createPmosCustomerAccount\s*=\s*function/.test(text),
    `${name} still replaces the canonical Add Customer transaction.`);
}

console.log('Canonical Add Customer pipeline passed.');
