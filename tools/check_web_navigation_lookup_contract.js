const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireText(text, needle, label, failures) {
  if (!text.includes(needle)) failures.push(label);
}

const client = read('Client.html');
const index = read('Index.html');
const customers = read('Web_Customers.html');
const operations = read('Web_Pmos_Operations.html');
const profileCards = read('24-YZ_Customer_Equipment_Profile_Cards.gs');
const runtime = read('24-V_Customer_Form_Runtime_Integration.gs');
const failures = [];

requireText(client, 'viewHasNestedSidebar', 'main navigation detects nested sidebars', failures);
requireText(client, "setSidebarCollapsed(true)", 'nested views collapse the main navigation', failures);
requireText(client, "$('appBrand').onclick", 'main logo collapses the main navigation', failures);
requireText(index, 'id="appBrand"', 'main logo is an accessible collapse control', failures);

requireText(customers, "server('searchPmosCustomerAccountProfiles','')", 'customer index loads once without a query filter', failures);
requireText(customers, 'function resolveSearchMatch(query)', 'Customer Lookup resolves Rolodex matches locally', failures);
requireText(customers, "function queueSearch(){rollToQuery", 'Customer Lookup scrolls locally while typing', failures);
requireText(customers, "$('customerBrand').onclick", 'Customer Lookup logo collapses its sidebar', failures);
if (/setTimeout\(\(\)=>loadCustomers/.test(customers)) failures.push('Customer Lookup still delays server searches per keystroke');

requireText(operations, 'class="op-sidebar-toggle"', 'Operations uses the compact corner sidebar control', failures);
requireText(operations, "$('opBrand').addEventListener('click'", 'Operations logo collapses its sidebar', failures);
requireText(profileCards, '#view-customers .pmos-equipment-grid{grid-template-columns:repeat(3', 'wide Web profiles use three equipment columns', failures);
requireText(profileCards, '__pmosEquipmentProfileCardsLoaded', 'shared profile UI has an idempotent runtime marker', failures);
requireText(runtime, 'pmosInjectCustomerEquipmentProfileUi_(output)', 'Sheets runtime explicitly injects the shared equipment profile UI', failures);

if (failures.length) {
  console.error('Web navigation / lookup contract failures:');
  failures.forEach(failure => console.error('- ' + failure));
  process.exit(1);
}

console.log('Web navigation / lookup contract clean: nested menus, Rolodex search, Sheets profile parity, and wide equipment grids present.');
