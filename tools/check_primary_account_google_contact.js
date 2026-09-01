#!/usr/bin/env node
/* Functional contract for creating or matching an unlinked promoted Primary Account Contact. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const calls = [];
const context = {
  console,
  PMOS_CONTACT_FIELDS_: 'names',
  People: {People: {
    get(resourceName) {
      calls.push(['get', resourceName]);
      return {resourceName};
    },
    createContact() {
      calls.push(['create']);
      return {resourceName: 'people/new-primary'};
    },
  }},
};
context.getPmosAccountHolderContactRecord_ = () => ({
  customerId: 'C-1',
  resourceNames: ['people/old-primary', 'people/additional'],
});
context.findPmosGoogleContactCandidates_ = () => [];
context.buildPmosGooglePerson_ = () => ({names: []});
context.writePmosGoogleContactLinks_ = (customer, people) => {
  calls.push(['write', people.map((item) => typeof item === 'string' ? item : item.resourceName)]);
};
context.syncPmosAccountSharedCustomerFields_ = (customerId) => calls.push(['sync', customerId]);

vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(root, '24-ZZZZ_Account_Contact_Primary_Link_Integrity.gs'), 'utf8'),
  context,
);

let result = context.pmosEnsurePrimaryAccountGoogleResource_('C-1');
if (!result.created || result.resourceName !== 'people/new-primary') {
  throw new Error('The unlinked promoted Primary Account Contact was not created.');
}
const write = calls.find((call) => call[0] === 'write');
const expectedResources = ['people/new-primary', 'people/old-primary', 'people/additional'];
if (!write || JSON.stringify(write[1]) !== JSON.stringify(expectedResources)) {
  throw new Error('Creating the promoted Primary Account Contact discarded or reordered existing links.');
}

calls.length = 0;
context.findPmosGoogleContactCandidates_ = () => [{automaticMatch: true, resourceName: 'people/matched'}];
result = context.pmosEnsurePrimaryAccountGoogleResource_('C-1');
if (result.created || result.resourceName !== 'people/matched' || !calls.some((call) => call[0] === 'get')) {
  throw new Error('An exact existing Google Contact match was not reused for the promoted Primary.');
}

console.log('Promoted Primary Google Contact create/match contract passed.');
