/** User-facing terminology compatibility for Customer Accounts. */
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
  if (Array.isArray(value.rows)) {
    value.rows.forEach(function(row) { pmosAccountTerminologyState_(row); });
  }
  if (Array.isArray(value.candidates)) {
    value.candidates.forEach(function(candidate) { pmosAccountTerminologyState_(candidate); });
  }
  if (Array.isArray(value.results)) {
    value.results.forEach(function(result) { pmosAccountTerminologyState_(result); });
  }
  return value;
}

(function () {
  if (typeof buildPmosCustomerLookupHtml_ === 'function') {
    const baseBuildCustomerLookupAccountTerminology = buildPmosCustomerLookupHtml_;
    buildPmosCustomerLookupHtml_ = function() {
      return pmosAccountTerminologyText_(baseBuildCustomerLookupAccountTerminology.apply(this, arguments));
    };
  }

  if (typeof buildPmosCustomerEditorHtml_ === 'function') {
    const baseBuildCustomerEditorAccountTerminology = buildPmosCustomerEditorHtml_;
    buildPmosCustomerEditorHtml_ = function() {
      return pmosAccountTerminologyText_(baseBuildCustomerEditorAccountTerminology.apply(this, arguments));
    };
  }

  if (typeof buildPmosGoogleContactsMassSyncHtml_ === 'function') {
    const baseBuildGoogleContactsMassAccountTerminology = buildPmosGoogleContactsMassSyncHtml_;
    buildPmosGoogleContactsMassSyncHtml_ = function() {
      return pmosAccountTerminologyText_(baseBuildGoogleContactsMassAccountTerminology.apply(this, arguments));
    };
  }

  if (typeof getPmosGoogleContactState === 'function') {
    const baseGetGoogleContactStateAccountTerminology = getPmosGoogleContactState;
    getPmosGoogleContactState = function() {
      return pmosAccountTerminologyState_(baseGetGoogleContactStateAccountTerminology.apply(this, arguments));
    };
  }

  if (typeof previewPmosGoogleContactsMassSync === 'function') {
    const basePreviewGoogleContactsMassAccountTerminology = previewPmosGoogleContactsMassSync;
    previewPmosGoogleContactsMassSync = function() {
      return pmosAccountTerminologyState_(basePreviewGoogleContactsMassAccountTerminology.apply(this, arguments));
    };
  }

  if (typeof savePmosCustomerEditorData === 'function') {
    const baseSaveCustomerEditorAccountTerminology = savePmosCustomerEditorData;
    savePmosCustomerEditorData = function() {
      try {
        return pmosAccountTerminologyState_(baseSaveCustomerEditorAccountTerminology.apply(this, arguments));
      } catch (error) {
        if (error && error.message) error.message = pmosAccountTerminologyText_(error.message);
        throw error;
      }
    };
  }

  if (typeof savePmosCustomerEditorExistingHouseholdContacts === 'function') {
    const baseSaveExistingAccountContacts = savePmosCustomerEditorExistingHouseholdContacts;
    savePmosCustomerEditorExistingHouseholdContacts = function() {
      try {
        return baseSaveExistingAccountContacts.apply(this, arguments);
      } catch (error) {
        if (error && error.message) error.message = pmosAccountTerminologyText_(error.message);
        throw error;
      }
    };
  }
})();
