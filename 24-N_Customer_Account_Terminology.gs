/** User-facing terminology helpers for Customer Accounts. */
function pmosAccountTerminologyText_(value) {
  if (value == null) return value;
  return String(value)
    .replace(/household pool profile/gi, 'customer account')
    .replace(/household contacts/gi, 'additional contacts')
    .replace(/household contact/gi, 'additional contact')
    .replace(/household name/gi, 'account name')
    .replace(/relink this household/gi, 'relink this account')
    .replace(/this household/gi, 'this account');
}

function pmosAccountTerminologyState_(value) {
  if (!value || typeof value !== 'object') return value;
  ['message', 'matchReason', 'explanation', 'summary', 'contactStatus'].forEach(function(key) {
    if (typeof value[key] === 'string') value[key] = pmosAccountTerminologyText_(value[key]);
  });
  if (Array.isArray(value.rows)) value.rows.forEach(pmosAccountTerminologyState_);
  if (Array.isArray(value.candidates)) value.candidates.forEach(pmosAccountTerminologyState_);
  if (Array.isArray(value.results)) value.results.forEach(pmosAccountTerminologyState_);
  if (Array.isArray(value.contacts)) value.contacts.forEach(pmosAccountTerminologyState_);
  return value;
}

function getPmosGoogleContactAccountState(customerId) {
  return pmosAccountTerminologyState_(getPmosGoogleContactState(customerId));
}

function previewPmosGoogleContactAccountSync(customerId, direction) {
  return pmosAccountTerminologyState_(previewPmosGoogleContactSync(customerId, direction));
}

function applyPmosGoogleContactAccountSync(customerId, direction, resourceName) {
  return pmosAccountTerminologyState_(applyPmosGoogleContactSync(customerId, direction, resourceName));
}
