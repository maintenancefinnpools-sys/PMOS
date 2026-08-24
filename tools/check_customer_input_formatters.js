#!/usr/bin/env node
/* Runtime smoke test for Add Customer name and phone input behavior. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const listeners = {};

function element(id) {
  return {
    id,
    value: '',
    selectionStart: 0,
    selectionEnd: 0,
    textContent: '',
    setSelectionRange() {},
    closest(selector) {
      return selector === '#view-addcustomer' ? {} : null;
    },
  };
}

const elements = {
  acFirstName: element('acFirstName'),
  acLastName: element('acLastName'),
  acPhone: element('acPhone'),
  acServiceLocationName: element('acServiceLocationName'),
  acAccountPreview: element('acAccountPreview'),
};

const context = {
  console,
  Promise,
  setTimeout,
  clearTimeout,
  CustomEvent: function CustomEvent() {},
  MouseEvent: function MouseEvent() {},
  document: {
    readyState: 'loading',
    getElementById(id) {
      return elements[id] || null;
    },
    addEventListener(name, handler) {
      (listeners[name] || (listeners[name] = [])).push(handler);
    },
  },
};
context.window = context;
vm.createContext(context);

const equipmentSource = fs.readFileSync(path.join(root, '24-F_Customer_Equipment_Editor_Component.gs'), 'utf8');
vm.runInContext(equipmentSource + '\nthis.pmosEquipmentClient = pmosCustomerEquipmentEditorScript_();', context);
vm.runInContext(context.pmosEquipmentClient, context);

const addCustomer = fs.readFileSync(path.join(root, 'Web_Add_Customer.html'), 'utf8');
const scriptMatch = addCustomer.match(/<script>([\s\S]*?)<\/script>\s*$/);
if (!scriptMatch) throw new Error('Web_Add_Customer.html client script was not found.');
vm.runInContext(scriptMatch[1], context);

const inputHandler = (listeners.input || [])[0];
if (!inputHandler) throw new Error('Add Customer did not register its primary input formatter.');

function type(id, value) {
  const input = elements[id];
  input.value = value;
  input.selectionStart = value.length;
  input.selectionEnd = value.length;
  inputHandler({target: input});
}

type('acFirstName', 'john');
type('acLastName', "o'brien-smith");
type('acPhone', '9055551234');

const actual = {
  firstName: elements.acFirstName.value,
  lastName: elements.acLastName.value,
  phone: elements.acPhone.value,
  serviceLocationName: elements.acServiceLocationName.value,
};
const expected = {
  firstName: 'John',
  lastName: "O'Brien-Smith",
  phone: '(905) 555-1234',
  serviceLocationName: "O'Brien-Smith Residence",
};

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  console.error('Add Customer input formatting failed.');
  console.error('Expected:', expected);
  console.error('Actual:', actual);
  process.exit(1);
}

console.log('Add Customer runtime input formatting clean:', actual);
