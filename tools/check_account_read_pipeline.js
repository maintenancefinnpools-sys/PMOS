#!/usr/bin/env node
/* Functional contract for canonical account profile/editor read orchestration. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, '24-L_Customer_Profile_Account_Integration.gs'), 'utf8');
const context = {console};
vm.createContext(context);
vm.runInContext(source, context, {filename: '24-L_Customer_Profile_Account_Integration.gs'});
function assert(value, message) { if (!value) throw new Error(message); }

const calls = [];
context.getPmosCustomerAccountProfileCore_ = () => { calls.push('profile-core'); return {}; };
context.getPmosCustomerAccountEditorDataCore_ = () => { calls.push('editor-core'); return {}; };
context.readPmosCustomerCategorizedNotes_ = () => {
  calls.push('categorized');
  return {generalNotes: 'categorized', equipmentNotes: 'equipment-a', maintenanceNotes: 'm-a', openingNotes: 'o-a', closingNotes: 'c-a'};
};
context.getPmosCustomerContextNotes_ = () => {
  calls.push('context');
  return {generalNotes: 'context', equipmentNotes: 'equipment-b', maintenanceNotes: 'm-b', openingNotes: 'o-b', closingNotes: 'c-b'};
};
context.normalizePmosProfileEquipmentForContext_ = (value) => {
  calls.push('normalize');
  value.normalized = true;
  return value;
};
context.packPmosContextNotesEnvelope_ = (value) => { calls.push('pack'); return `packed:${value.generalNotes}`; };

const profile = context.getPmosCustomerAccountProfile('C-400');
assert(calls.join('>') === 'profile-core>categorized>context>normalize', `Profile read order changed: ${calls.join('>')}`);
assert(profile.generalNotes === 'context' && profile.equipmentNotes === 'equipment-b' && profile.normalized,
  'Profile read lost contextual-note or normalization behavior.');

calls.length = 0;
const editor = context.getPmosCustomerAccountEditorData('C-400');
assert(calls.join('>') === 'editor-core>categorized>context>normalize>pack', `Editor read order changed: ${calls.join('>')}`);
assert(editor.generalNotes === 'context' && editor.notes === 'packed:context' && editor.normalized,
  'Editor read lost note-envelope or normalization behavior.');

for (const name of ['24-T_Customer_Form_Enhancements.gs', '24-V_Customer_Context_Notes.gs', '24-W_Customer_Context_Notes_UI.gs']) {
  const text = fs.readFileSync(path.join(root, name), 'utf8');
  assert(!/getPmosCustomerAccount(Profile|EditorData)\s*=\s*function/.test(text), `${name} still replaces a canonical account read.`);
}
console.log('Canonical account read pipelines passed.');
