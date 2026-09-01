#!/usr/bin/env node
/* Functional contract for the canonical Add Maintenance Customer orchestration. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, '20-E_Add_Maintenance_Customer_Transaction.gs'), 'utf8');
const context = {console};
vm.createContext(context);
vm.runInContext(source, context, {filename: '20-E_Add_Maintenance_Customer_Transaction.gs'});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const calls = [];
context.unpackPmosMaintenanceContactsEnvelope_ = function(input) {
  calls.push('decode');
  return Object.assign({}, input, {decoded: true});
};
context.pmosCustomerNotesRequest_ = function(input) {
  calls.push('notes-request');
  return Object.assign({}, input, {notes: input.generalNotes});
};
context.ensurePmosCustomerCategorizedNotes_ = function() { calls.push('ensure-notes'); };
context.createMaintenanceCustomerCore_ = function(input) {
  calls.push('transaction');
  assert(input.decoded === true, 'The transaction received an undecoded compatibility envelope.');
  assert(input.notes === 'Visible note', 'The transaction did not receive normalized General Notes.');
  return {customerId: 'C-100', warnings: []};
};
context.applyPmosMaintenanceAccountIdentity_ = function(result) {
  calls.push('account-identity');
  result.accountId = 'A-100';
  return result;
};
context.savePmosCustomerCategorizedNotes_ = function(customerId) {
  calls.push('categorized-notes');
  assert(customerId === 'C-100', 'Categorized Notes received the wrong customer.');
};
context.savePmosCustomerContextNotes_ = function(customerId) {
  calls.push('context-notes');
  return {customerId};
};
context.completePmosMaintenanceCustomerContacts_ = function(result) {
  calls.push('contacts');
  result.contactsSaved = true;
  return result;
};

const result = context.createMaintenanceCustomer({generalNotes: 'Visible note'});
assert(
  calls.join('>') === 'decode>notes-request>ensure-notes>transaction>account-identity>categorized-notes>context-notes>contacts',
  `Maintenance pipeline order changed: ${calls.join('>')}`,
);
assert(result.customerId === 'C-100' && result.accountId === 'A-100' && result.contactsSaved,
  'Maintenance pipeline lost a result-stage contribution.');

calls.length = 0;
context.savePmosCustomerContextNotes_ = function() {
  calls.push('context-notes');
  throw new Error('context unavailable');
};
const warningResult = context.createMaintenanceCustomer({generalNotes: 'Visible note'});
assert(warningResult.contactsSaved === true, 'Contact persistence stopped after a contextual-note warning.');
assert(warningResult.warnings.some((warning) => warning.includes('context unavailable')),
  'Contextual-note failure was not preserved as a non-destructive warning.');

for (const name of [
  '20-F_Add_Maintenance_Customer_Account_Compatibility.gs',
  '24-T_Customer_Form_Enhancements.gs',
  '24-V_Customer_Context_Notes.gs',
  '24-W_Customer_Context_Notes_UI.gs',
  '24-X_Add_Maintenance_Contacts.gs',
]) {
  const text = fs.readFileSync(path.join(root, name), 'utf8');
  assert(!/createMaintenanceCustomer\s*=\s*function/.test(text),
    `${name} still replaces the canonical maintenance transaction.`);
}

console.log('Canonical maintenance customer pipeline passed.');
