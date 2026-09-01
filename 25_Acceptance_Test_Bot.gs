/**
 * PMOS development acceptance bot.
 *
 * The bot runs real spreadsheet-domain transactions against disposable customer
 * fixtures. It intentionally does not call Calendar or Google Contacts APIs. The
 * configured Calendar name, an explicit per-spreadsheet arm, fixture manifests, and
 * marker verification form four independent barriers against production use.
 */
const PMOS_ACCEPTANCE_RESULTS_SHEET_ = 'PMOS Acceptance Test Results';
const PMOS_ACCEPTANCE_MARKER_PREFIX_ = 'PMOS TEST BOT';
const PMOS_ACCEPTANCE_ARMED_PROPERTY_ = 'PMOS_ACCEPTANCE_TEST_ARMED_V1';
const PMOS_ACCEPTANCE_MANIFEST_PROPERTY_ = 'PMOS_ACCEPTANCE_TEST_FIXTURES_V1';
const PMOS_ACCEPTANCE_LAST_RUN_PROPERTY_ = 'PMOS_ACCEPTANCE_TEST_LAST_RUN_V1';
const PMOS_ACCEPTANCE_SPREADSHEET_RETRY_ATTEMPTS_ = 3;

function showPmosAcceptanceTestBotFromMenu() {
  const ui = pmosAcceptanceSheetUi_();
  const html = HtmlService.createHtmlOutputFromFile('Sheets_Acceptance_Test_Bot')
    .setWidth(760)
    .setHeight(700);
  ui.showModelessDialog(html, 'PMOS Acceptance Test Bot');
  return {opened: true};
}

function getPmosAcceptanceTestBotState() {
  const environment = pmosAcceptanceEnvironment_();
  const manifest = pmosAcceptanceReadJsonProperty_(PMOS_ACCEPTANCE_MANIFEST_PROPERTY_);
  const lastRun = pmosAcceptanceReadJsonProperty_(PMOS_ACCEPTANCE_LAST_RUN_PROPERTY_);
  return {
    spreadsheetName: environment.spreadsheetName,
    calendarName: environment.calendarName,
    developmentTarget: environment.developmentTarget,
    armed: environment.armed,
    pendingFixtureCount: manifest && Array.isArray(manifest.customerIds)
      ? manifest.customerIds.length : 0,
    pendingRunId: manifest && manifest.runId || '',
    lastRun: lastRun || null,
    coverage: [
      'Customer and two-location account creation',
      'Account vs Service Location contact isolation',
      'General, Equipment, Maintenance, Opening and Closing Notes',
      'Equipment, Shape, Volume and cartridge replacement identifiers',
      'Active, Paused and Inactive Water Maintenance persistence',
      'Route-template persistence without Calendar execution',
      'Invalid account and Service Location contact email rejection',
      'Shared profile payload used by Sheets and the Web App'
    ],
    manualChecks: [
      'Visual spacing, card wrapping and responsive two/three-column layout',
      'Clipboard fallback inside the Google Sheets host',
      'One reviewed development Calendar synchronization',
      'One existing complex customer with real historical data'
    ]
  };
}

function armPmosAcceptanceTestBot() {
  const environment = pmosAcceptanceEnvironment_();
  if (!environment.developmentTarget) {
    throw new Error(
      'Acceptance tests can be armed only when App Settings points to a Calendar whose name contains Development, Test, or Sandbox. Current Calendar: ' +
      (environment.calendarName || '(blank)')
    );
  }
  const value = {
    spreadsheetId: environment.spreadsheetId,
    calendarName: environment.calendarName,
    armedAt: new Date().toISOString(),
    armedBy: Session.getActiveUser().getEmail() || ''
  };
  PropertiesService.getDocumentProperties().setProperty(
    PMOS_ACCEPTANCE_ARMED_PROPERTY_,
    JSON.stringify(value)
  );
  return getPmosAcceptanceTestBotState();
}

function disarmPmosAcceptanceTestBot() {
  const properties = PropertiesService.getDocumentProperties();
  const manifest = pmosAcceptanceReadJsonProperty_(PMOS_ACCEPTANCE_MANIFEST_PROPERTY_);
  if (manifest && manifest.customerIds && manifest.customerIds.length) {
    throw new Error('Clean up the pending acceptance-test fixtures before disarming the bot.');
  }
  properties.deleteProperty(PMOS_ACCEPTANCE_ARMED_PROPERTY_);
  return getPmosAcceptanceTestBotState();
}

function runPmosAcceptanceTestBot(options) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    throw new Error('The Acceptance Test Bot is already running. Wait for it to finish.');
  }
  try {
    return runPmosAcceptanceTestBot_(options);
  } finally {
    lock.releaseLock();
  }
}

function runPmosAcceptanceTestBot_(options) {
  const started = new Date();
  const environment = pmosAcceptanceRequireSafeEnvironment_();
  const properties = PropertiesService.getDocumentProperties();
  const pending = pmosAcceptanceReadJsonProperty_(PMOS_ACCEPTANCE_MANIFEST_PROPERTY_);
  if (pending && pending.customerIds && pending.customerIds.length) {
    throw new Error(
      'A previous acceptance run still has ' + pending.customerIds.length +
      ' tracked fixture(s). Use Clean Up Test Fixtures before starting another run.'
    );
  }

  const keepFixtures = !!(options && options.keepFixtures === true);
  const runId = Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase();
  const marker = PMOS_ACCEPTANCE_MARKER_PREFIX_ + ' ' + runId;
  const results = [];
  const manifest = {
    version: 1,
    runId: runId,
    marker: marker,
    spreadsheetId: environment.spreadsheetId,
    calendarName: environment.calendarName,
    createdAt: started.toISOString(),
    customerIds: []
  };
  properties.setProperty(PMOS_ACCEPTANCE_MANIFEST_PROPERTY_, JSON.stringify(manifest));

  let acceptanceCleanupResult = {cleaned: false, removedCustomerIds: [], skippedCustomerIds: []};
  const triggersBefore = pmosAcceptanceTriggerHandlers_();
  try {
    pmosAcceptanceRecord_(results, 'Safety', 'Development target', true,
      environment.developmentTarget, environment.calendarName);
    pmosAcceptanceRecord_(results, 'Safety', 'Spreadsheet arm matches current file', true,
      environment.armed, environment.spreadsheetName);

    pmosAcceptanceRunCoreTestsWithSpreadsheetRetry_(results, manifest);

    const triggersAfter = pmosAcceptanceTriggerHandlers_();
    pmosAcceptanceRecord_(
      results,
      'External safety',
      'No Calendar worker trigger created',
      JSON.stringify(triggersBefore),
      JSON.stringify(triggersAfter),
      'This suite uses spreadsheet-domain transactions only.'
    );
  } catch (error) {
    const fatalMessage = String(error && error.message ? error.message : error);
    pmosAcceptanceRecord_(results, 'Runner', 'Suite completed without fatal error',
      'No fatal error', fatalMessage, fatalMessage);
  } finally {
    try {
      pmosAcceptanceRetryTransientSpreadsheetOperation_(function() {
        pmosAcceptanceDiscoverMarkedCustomerIds_(manifest);
      });
    } catch (error) {
      pmosAcceptanceInfo_(results, 'Cleanup', 'Partial-run fixture discovery needs attention',
        String(error && error.message ? error.message : error));
    }
    if (!keepFixtures) {
      try {
        acceptanceCleanupResult = pmosAcceptanceRetryTransientSpreadsheetOperation_(function() {
          return pmosAcceptanceCleanupManifest_(manifest);
        });
        pmosAcceptanceRecord_(results, 'Cleanup', 'Disposable fixtures removed',
          manifest.customerIds.length, acceptanceCleanupResult.removedCustomerIds.length,
          acceptanceCleanupResult.skippedCustomerIds.length
            ? 'Skipped: ' + acceptanceCleanupResult.skippedCustomerIds.join(', ') : '');
      } catch (error) {
        acceptanceCleanupResult = {
          cleaned: false,
          removedCustomerIds: [],
          skippedCustomerIds: manifest.customerIds.slice()
        };
        pmosAcceptanceRecord_(results, 'Cleanup', 'Disposable fixtures removed',
          manifest.customerIds.length, 'Cleanup error',
          String(error && error.message ? error.message : error));
      }
    } else {
      pmosAcceptanceInfo_(results, 'Cleanup', 'Fixtures retained for manual profile review',
        manifest.customerIds.join(', '));
    }
  }

  const completed = new Date();
  const summary = pmosAcceptanceSummarize_(
    runId,
    started,
    completed,
    results,
    manifest,
    acceptanceCleanupResult,
    keepFixtures
  );
  pmosAcceptanceRetryTransientSpreadsheetOperation_(function() {
    pmosAcceptanceWriteResults_(summary, results);
  });
  properties.setProperty(PMOS_ACCEPTANCE_LAST_RUN_PROPERTY_, JSON.stringify(summary));
  if (!keepFixtures && acceptanceCleanupResult.cleaned) {
    properties.deleteProperty(PMOS_ACCEPTANCE_MANIFEST_PROPERTY_);
  }
  return summary;
}

function pmosAcceptanceRunCoreTestsWithSpreadsheetRetry_(results, manifest) {
  const firstResultIndex = results.length;
  for (let attempt = 1; attempt <= PMOS_ACCEPTANCE_SPREADSHEET_RETRY_ATTEMPTS_; attempt++) {
    try {
      pmosAcceptanceRunValidationTests_(results);
      pmosAcceptanceRunAccountTests_(results, manifest);
      pmosAcceptanceRunMaintenanceStatusTests_(results, manifest);
      return;
    } catch (error) {
      if (!pmosAcceptanceIsTransientSpreadsheetError_(error) ||
          attempt >= PMOS_ACCEPTANCE_SPREADSHEET_RETRY_ATTEMPTS_) {
        throw error;
      }

      // A Spreadsheet service interruption can occur after a transaction has begun.
      // Rediscover marker-owned rows and remove them before retrying the complete phase,
      // so a retry cannot duplicate a customer, equipment row, or Route Template row.
      pmosAcceptanceResetFixturesForRetry_(manifest);
      results.splice(firstResultIndex, results.length - firstResultIndex);
      pmosAcceptanceInfo_(
        results,
        'Runner',
        'Transient Spreadsheet service interruption recovered',
        'Retrying acceptance checks after attempt ' + attempt + ' of ' +
          PMOS_ACCEPTANCE_SPREADSHEET_RETRY_ATTEMPTS_ + ': ' +
          String(error && error.message ? error.message : error)
      );
      Utilities.sleep(attempt * 1000);
    }
  }
}

function pmosAcceptanceResetFixturesForRetry_(manifest) {
  pmosAcceptanceRetryTransientSpreadsheetOperation_(function() {
    pmosAcceptanceDiscoverMarkedCustomerIds_(manifest);
  });
  if (manifest.customerIds.length) {
    const retryCleanupResult = pmosAcceptanceRetryTransientSpreadsheetOperation_(function() {
      return pmosAcceptanceCleanupManifest_(manifest);
    });
    if (!retryCleanupResult.cleaned) {
      throw new Error(
        'Acceptance tests stopped after a temporary Spreadsheet service interruption because ' +
        'partial fixtures could not be safely removed: ' + retryCleanupResult.skippedCustomerIds.join(', ')
      );
    }
  }
  manifest.customerIds = [];
  PropertiesService.getDocumentProperties().setProperty(
    PMOS_ACCEPTANCE_MANIFEST_PROPERTY_,
    JSON.stringify(manifest)
  );
}

function pmosAcceptanceRetryTransientSpreadsheetOperation_(callback) {
  let lastError = null;
  for (let attempt = 1; attempt <= PMOS_ACCEPTANCE_SPREADSHEET_RETRY_ATTEMPTS_; attempt++) {
    try {
      return callback();
    } catch (error) {
      lastError = error;
      if (!pmosAcceptanceIsTransientSpreadsheetError_(error) ||
          attempt >= PMOS_ACCEPTANCE_SPREADSHEET_RETRY_ATTEMPTS_) {
        throw error;
      }
      Utilities.sleep(attempt * 1000);
    }
  }
  throw lastError;
}

function pmosAcceptanceIsTransientSpreadsheetError_(error) {
  const message = String(error && error.message ? error.message : error);
  return /Service Spreadsheets failed while accessing document with id/i.test(message) ||
    /Service timed out:\s*Spreadsheets/i.test(message) ||
    /Internal error.*Spreadsheets/i.test(message);
}

function cleanupPmosAcceptanceTestFixtures() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    throw new Error('The Acceptance Test Bot is still running. Wait for it to finish before cleanup.');
  }
  try {
    pmosAcceptanceRequireSafeEnvironment_();
    const properties = PropertiesService.getDocumentProperties();
    const manifest = pmosAcceptanceReadJsonProperty_(PMOS_ACCEPTANCE_MANIFEST_PROPERTY_);
    if (!manifest) {
      return {cleaned: true, removedCustomerIds: [], skippedCustomerIds: [], message: 'No tracked test fixtures remain.'};
    }
    pmosAcceptanceRetryTransientSpreadsheetOperation_(function() {
      pmosAcceptanceDiscoverMarkedCustomerIds_(manifest);
    });
    if (!manifest.customerIds.length) {
      properties.deleteProperty(PMOS_ACCEPTANCE_MANIFEST_PROPERTY_);
      return {cleaned: true, removedCustomerIds: [], skippedCustomerIds: [], message: 'No tracked test fixtures remain.'};
    }
    const result = pmosAcceptanceRetryTransientSpreadsheetOperation_(function() {
      return pmosAcceptanceCleanupManifest_(manifest);
    });
    if (result.cleaned) properties.deleteProperty(PMOS_ACCEPTANCE_MANIFEST_PROPERTY_);
    result.message = result.cleaned
      ? 'Removed ' + result.removedCustomerIds.length + ' tracked test fixture(s).'
      : 'Some fixtures could not be removed because their PMOS TEST BOT marker was missing.';
    return result;
  } finally {
    lock.releaseLock();
  }
}

function openPmosAcceptanceTestResults() {
  const sheet = pmosAcceptanceEnsureResultsSheet_();
  pmosAcceptanceSpreadsheet_().setActiveSheet(sheet);
  sheet.getRange('A1').activate();
  SpreadsheetApp.flush();
  return {sheetName: sheet.getName(), sheetId: sheet.getSheetId()};
}

function pmosAcceptanceRunValidationTests_(results) {
  ['Active', 'Paused', 'Inactive'].forEach(function(status) {
    const request = normalizeMaintenanceCustomerRequest_(pmosAcceptanceMaintenanceInput_(
      PMOS_ACCEPTANCE_MARKER_PREFIX_ + ' VALIDATION', status, 1
    ));
    pmosAcceptanceRecord_(results, 'Validation', status + ' status normalization',
      status, request.status);
  });

  pmosAcceptanceExpectError_(results, 'Validation', 'Invalid Account Contact email rejected',
    /invalid email/i, function() {
      normalizePmosAccountContacts_([{
        firstName: 'Invalid', lastName: 'Account', phone: '416-555-0100', email: 'invalid-email'
      }]);
    });
  pmosAcceptanceExpectError_(results, 'Validation', 'Invalid Service Location Contact email rejected',
    /invalid email/i, function() {
      normalizePmosServiceLocationContacts_([{
        firstName: 'Invalid', lastName: 'Location', phone: '416-555-0101', email: 'invalid-email'
      }]);
    });

  const envelope = 'PMOS_CONTEXT_NOTES_V1:' + encodeURIComponent(JSON.stringify({
    generalNotes: 'Decoded General',
    equipmentNotes: 'Decoded Equipment',
    maintenanceNotes: 'Decoded Maintenance',
    openingNotes: 'Decoded Opening',
    closingNotes: 'Decoded Closing'
  }));
  const decoded = normalizePmosStoredContextNotes_({generalNotes: envelope});
  pmosAcceptanceRecord_(results, 'Validation', 'Legacy categorized-note envelope decoded',
    'Decoded General', decoded.generalNotes);
  pmosAcceptanceRecord_(results, 'Validation', 'Decoded Equipment Notes retained',
    'Decoded Equipment', decoded.equipmentNotes);
}

function pmosAcceptanceRunAccountTests_(results, manifest) {
  const marker = manifest.marker;
  const primaryAddress = pmosAcceptanceAddress_(11);
  const secondaryAddress = pmosAcceptanceAddress_(12);
  const bodies = pmosAcceptanceEquipmentFixture_();
  const primary = createPmosNonMaintenanceAccountServiceLocation_({
    firstName: 'Acceptance',
    lastName: marker,
    phone: '416-555-0111',
    email: 'acceptance.primary@example.com',
    address: primaryAddress.address,
    serviceLocationName: 'Primary Test Pool',
    calendarTitle: marker + ' Primary',
    entryInformation: 'Primary Entry ' + manifest.runId,
    notes: 'Primary General ' + manifest.runId,
    bodiesOfWater: bodies
  });
  pmosAcceptanceTrackFixture_(manifest, primary.customerId);
  applyPmosAccountIdentityToCustomerRow_(primary.customerId, primary.customerId, 'Primary Test Pool', true);
  applyPmosConfirmedAddressDetailsToCustomer_(primary.customerId, primaryAddress);
  pmosPersistBodyEnhancementsRuntime_(primary.customerId, {bodiesOfWater: bodies});
  savePmosCustomerContextNotes_(primary.customerId, {
    generalNotes: 'Primary General ' + manifest.runId,
    equipmentNotes: 'Primary Equipment ' + manifest.runId,
    maintenanceNotes: '',
    openingNotes: 'Primary Opening ' + manifest.runId,
    closingNotes: 'Primary Closing ' + manifest.runId
  });
  savePmosAccountContacts_(primary.customerId, [{
    firstName: 'Alex', lastName: 'Account', role: 'Billing Contact',
    phone: '416-555-0112', email: 'alex.account@example.com', notes: 'Account-wide'
  }]);
  savePmosServiceLocationContacts_(primary.customerId, []);

  const secondary = createPmosNonMaintenanceAccountServiceLocation_({
    accountId: primary.customerId,
    firstName: 'Acceptance',
    lastName: marker,
    phone: '416-555-0111',
    email: '',
    address: secondaryAddress.address,
    serviceLocationName: 'Secondary Test Spa',
    calendarTitle: marker + ' Secondary',
    entryInformation: 'Secondary Entry ' + manifest.runId,
    notes: 'Secondary General ' + manifest.runId,
    bodiesOfWater: [{
      name: 'Standalone Hot Tub', type: 'Standalone Hot Tub', spaType: 'Self-Contained',
      location: 'Outdoor', shape: 'Rectangle', volume: '1,500 L', sanitization: 'Chlorine',
      pump: {}, filter: {}, heater: {}, cover: {}, equipment: []
    }]
  });
  pmosAcceptanceTrackFixture_(manifest, secondary.customerId);
  applyPmosAccountIdentityToCustomerRow_(secondary.customerId, primary.customerId, 'Secondary Test Spa', false);
  applyPmosConfirmedAddressDetailsToCustomer_(secondary.customerId, secondaryAddress);
  savePmosCustomerContextNotes_(secondary.customerId, {
    generalNotes: 'Secondary General ' + manifest.runId,
    equipmentNotes: 'Secondary Equipment ' + manifest.runId,
    maintenanceNotes: '',
    openingNotes: 'Secondary Opening ' + manifest.runId,
    closingNotes: 'Secondary Closing ' + manifest.runId
  });
  savePmosServiceLocationContacts_(secondary.customerId, [{
    firstName: 'Sam', lastName: 'Site', role: 'Property Manager',
    phone: '416-555-0113', email: 'sam.site@example.com', notes: 'Secondary only'
  }]);

  const primaryProfile = getPmosCustomerLifecycleProfile(primary.customerId);
  const secondaryProfile = getPmosCustomerLifecycleProfile(secondary.customerId);
  const primaryEditor = getPmosCustomerLifecycleEditorData(primary.customerId);
  pmosAcceptanceRecord_(results, 'Account lifecycle', 'Two Service Locations grouped under one account',
    2, (primaryProfile.serviceLocations || []).length);
  pmosAcceptanceRecord_(results, 'Contacts', 'Primary Contact is first and separately identified',
    true, !!(primaryProfile.accountContacts && primaryProfile.accountContacts[0] && primaryProfile.accountContacts[0].primary));
  pmosAcceptanceRecord_(results, 'Contacts', 'Additional Account Contact shared across locations',
    'alex.account@example.com', pmosAcceptanceFindContactEmail_(secondaryProfile.accountContacts, 'alex.account@example.com'));
  const additionalAccountContact = pmosAcceptanceFindContact_(
    secondaryProfile.accountContacts,
    'alex.account@example.com'
  );
  pmosAcceptanceRecord_(results, 'Contacts', 'Additional Account Contact notes remain attached',
    'Account-wide', additionalAccountContact && additionalAccountContact.notes);
  pmosAcceptanceRecord_(results, 'Contacts', 'Primary location excludes secondary Service Location Contact',
    0, (primaryProfile.serviceLocationContacts || []).length);
  pmosAcceptanceRecord_(results, 'Contacts', 'Secondary Service Location Contact remains location-scoped',
    'sam.site@example.com', pmosAcceptanceFindContactEmail_(secondaryProfile.serviceLocationContacts, 'sam.site@example.com'));
  const secondaryLocationContact = pmosAcceptanceFindContact_(
    secondaryProfile.serviceLocationContacts,
    'sam.site@example.com'
  );
  pmosAcceptanceRecord_(results, 'Contacts', 'Service Location Contact notes remain attached',
    'Secondary only', secondaryLocationContact && secondaryLocationContact.notes);
  pmosAcceptanceRecord_(results, 'Notes', 'Primary General Notes remain location-scoped',
    'Primary General ' + manifest.runId, primaryProfile.generalNotes);
  pmosAcceptanceRecord_(results, 'Notes', 'Secondary General Notes remain location-scoped',
    'Secondary General ' + manifest.runId, secondaryProfile.generalNotes);
  pmosAcceptanceRecord_(results, 'Notes', 'Equipment Notes remain in the selected location payload',
    'Primary Equipment ' + manifest.runId, primaryProfile.equipmentNotes);
  pmosAcceptanceRecord_(results, 'Notes', 'Opening and Closing Notes hydrate independently',
    'Primary Opening ' + manifest.runId + ' | Primary Closing ' + manifest.runId,
    String(primaryProfile.openingNotes || '') + ' | ' + String(primaryProfile.closingNotes || ''));
  pmosAcceptanceRecord_(results, 'Editor hydration', 'Last Name reaches the complete editor payload',
    marker, primaryEditor.lastName);
  pmosAcceptanceRecord_(results, 'Editor hydration', 'Contacts reach the complete editor payload',
    1, (primaryEditor.accountContacts || []).length);
  pmosAcceptanceRecord_(results, 'Editor hydration', 'Bodies of Water reach the complete editor payload',
    1, (primaryEditor.bodiesOfWater || []).length);
  pmosAcceptanceRecord_(results, 'Editor hydration', 'Service Location Name reaches the complete editor payload',
    'Primary Test Pool', primaryEditor.serviceLocationName || primaryEditor.locationName);

  const editorBody = primaryEditor.bodiesOfWater && primaryEditor.bodiesOfWater[0] || {};
  const editorSanitizer = pmosAcceptanceFindEquipment_(editorBody, 'CHLORINE_FEEDER');
  const editorAutomation = pmosAcceptanceFindEquipment_(editorBody, 'EQUIPMENT_AUTOMATION');
  pmosAcceptanceRecord_(results, 'Editor hydration', 'Primary Sanitization reaches the complete editor payload',
    'Chlorine', editorBody.sanitization);
  pmosAcceptanceRecord_(results, 'Editor hydration', 'Primary Sanitizer make and model reach the editor payload',
    'Pentair 300', [editorSanitizer && editorSanitizer.details && editorSanitizer.details.make, editorSanitizer && editorSanitizer.details && editorSanitizer.details.model].filter(Boolean).join(' '));
  pmosAcceptanceRecord_(results, 'Editor hydration', 'Equipment Automation reaches the complete editor payload',
    'Pentair IntelliCenter', [editorAutomation && editorAutomation.details && (editorAutomation.details.manufacturer || editorAutomation.details.make), editorAutomation && editorAutomation.details && editorAutomation.details.model].filter(Boolean).join(' '));

  const body = primaryProfile.bodiesOfWater && primaryProfile.bodiesOfWater[0] || {};
  pmosAcceptanceRecord_(results, 'Equipment', 'Shape persists into shared profile payload',
    'Rectangle', body.shape);
  pmosAcceptanceRecord_(results, 'Equipment', 'Volume persists into shared profile payload',
    '75,000 L', body.volume);
  pmosAcceptanceRecord_(results, 'Equipment', 'Cartridge filter model persists',
    'CCP420', body.filter && (body.filter.modelNumber || body.filter.model));
  pmosAcceptanceRecord_(results, 'Equipment', 'Replacement cartridge number persists',
    'R173576', body.filter && body.filter.cartridgeSetNumber);
  const actuator = pmosAcceptanceFindEquipment_(body, 'WATER_FEATURE');
  pmosAcceptanceRecord_(results, 'Equipment', 'Water Feature actuator identifier persists',
    '263045', actuator && actuator.details && actuator.details.actuatorModelNumber);
  const featurePump = actuator && actuator.details && (actuator.details.featureEquipment || []).filter(function(item) {
    return item && item.type === 'PUMP';
  })[0];
  pmosAcceptanceRecord_(results, 'Equipment', 'Water Feature pump catalog fields persist',
    'Pentair SuperFlo VST 342002', featurePump && [
      featurePump.details && featurePump.details.pumpMake,
      featurePump.details && featurePump.details.pumpModel,
      featurePump.details && featurePump.details.pumpModelNumber
    ].filter(Boolean).join(' '));

  // Exercise the same transaction used by the Web and Sheets Edit Customer
  // surfaces, then open a brand-new editor snapshot. This catches a successful
  // response that silently loses location or equipment values.
  const editedBodies = JSON.parse(JSON.stringify(primaryEditor.bodiesOfWater || []));
  editedBodies[0].filter = Object.assign({}, editedBodies[0].filter || {}, {
    type: 'Sand', make: 'Pentair', model: 'SD60', modelNumber: 'SD60',
    partNumber: '145322', cartridgeSetNumber: 'SHOULD-NOT-PERSIST'
  });
  editedBodies[0].heater = {
    type: 'Solar', connectedToEquipmentAutomation: true,
    solarEquipment: [{
      type: 'CONTROLLER', make: 'Pentair', model: 'SolarTouch', modelNumber: '521590'
    }]
  };
  const saved = savePmosCustomerLifecycleEditorData({
    customerId: primary.customerId,
    editToken: primaryEditor.editToken,
    firstName: primaryEditor.firstName,
    lastName: primaryEditor.lastName,
    phone: primaryEditor.phone,
    email: primaryEditor.email,
    serviceLocationName: 'Primary Test Pool Verified',
    calendarTitle: primaryEditor.calendarTitle,
    address: primaryEditor.address,
    addressVerified: true,
    addressDetails: null,
    waterMaintenance: false,
    maintenanceRemovalConfirmed: false,
    routeChangeRequested: false,
    recommendedPlacements: [],
    status: '',
    frequency: '',
    serviceStartDate: '',
    yearRound: '',
    entryInformation: primaryEditor.entryInformation,
    notes: primaryEditor.generalNotes || primaryEditor.notes,
    generalNotes: primaryEditor.generalNotes || primaryEditor.notes,
    equipmentNotes: primaryEditor.equipmentNotes,
    maintenanceNotes: primaryEditor.maintenanceNotes,
    openingNotes: primaryEditor.openingNotes,
    closingNotes: primaryEditor.closingNotes,
    bodiesOfWater: editedBodies,
    accountContacts: primaryEditor.accountContacts || [],
    serviceLocationContacts: primaryEditor.serviceLocationContacts || [],
    accountBillingAddress: primaryEditor.accountBillingAddress || {enabled: false}
  });
  const reopened = getPmosCustomerLifecycleEditorData(primary.customerId);
  const reopenedBody = reopened.bodiesOfWater && reopened.bodiesOfWater[0] || {};
  const reopenedSanitizer = pmosAcceptanceFindEquipment_(reopenedBody, 'CHLORINE_FEEDER');
  const reopenedAutomation = pmosAcceptanceFindEquipment_(reopenedBody, 'EQUIPMENT_AUTOMATION');
  pmosAcceptanceRecord_(results, 'Edit save/reopen', 'Save transaction reports verified persistence',
    true, !!(saved && saved.saved && saved.verified));
  pmosAcceptanceRecord_(results, 'Edit save/reopen', 'Service Location Name survives save and reopen',
    'Primary Test Pool Verified', reopened.serviceLocationName || reopened.locationName);
  pmosAcceptanceRecord_(results, 'Edit save/reopen', 'Primary Sanitization survives save and reopen',
    'Chlorine', reopenedBody.sanitization);
  pmosAcceptanceRecord_(results, 'Edit save/reopen', 'Primary Sanitizer survives save and reopen',
    'Pentair 300', [reopenedSanitizer && reopenedSanitizer.details && reopenedSanitizer.details.make, reopenedSanitizer && reopenedSanitizer.details && reopenedSanitizer.details.model].filter(Boolean).join(' '));
  pmosAcceptanceRecord_(results, 'Edit save/reopen', 'Equipment Automation survives save and reopen',
    'Pentair IntelliCenter', [reopenedAutomation && reopenedAutomation.details && (reopenedAutomation.details.manufacturer || reopenedAutomation.details.make), reopenedAutomation && reopenedAutomation.details && reopenedAutomation.details.model].filter(Boolean).join(' '));
  pmosAcceptanceRecord_(results, 'Edit save/reopen', 'Sand filter does not retain a cartridge set number',
    '', reopenedBody.filter && reopenedBody.filter.cartridgeSetNumber || '');
  pmosAcceptanceRecord_(results, 'Edit save/reopen', 'Solar-specific controller survives save and reopen',
    'Pentair SolarTouch 521590', [reopenedBody.heater && reopenedBody.heater.solarEquipment && reopenedBody.heater.solarEquipment[0] && reopenedBody.heater.solarEquipment[0].make, reopenedBody.heater && reopenedBody.heater.solarEquipment && reopenedBody.heater.solarEquipment[0] && reopenedBody.heater.solarEquipment[0].model, reopenedBody.heater && reopenedBody.heater.solarEquipment && reopenedBody.heater.solarEquipment[0] && reopenedBody.heater.solarEquipment[0].modelNumber].filter(Boolean).join(' '));
  pmosAcceptanceRecord_(results, 'Edit save/reopen', 'Solar connection to Equipment Automation survives save and reopen',
    true, !!(reopenedBody.heater && reopenedBody.heater.connectedToEquipmentAutomation));
}

function pmosAcceptanceRunMaintenanceStatusTests_(results, manifest) {
  ['Active', 'Paused', 'Inactive'].forEach(function(status, index) {
    const created = createMaintenanceCustomer(
      pmosAcceptanceMaintenanceInput_(manifest.marker + ' ' + status, status, index + 1)
    );
    pmosAcceptanceTrackFixture_(manifest, created.customerId);
    const state = getPmosWaterMaintenanceEditorState_(created.customerId);
    const profile = getPmosCustomerLifecycleProfile(created.customerId);
    pmosAcceptanceRecord_(results, 'Water Maintenance', status + ' saved in Customers',
      status, state.status);
    pmosAcceptanceRecord_(results, 'Water Maintenance', status + ' remains enrolled',
      true, state.enabled);
    pmosAcceptanceRecord_(results, 'Water Maintenance', status + ' creates one Monthly route row',
      1, state.routeCount);
    pmosAcceptanceRecord_(results, 'Water Maintenance', status + ' appears in shared profile payload',
      status, profile.maintenanceStatus);
    pmosAcceptanceRecord_(results, 'Water Maintenance', status + ' Maintenance Notes hydrate in profile',
      'Maintenance Notes ' + status, profile.maintenanceNotes);
    const routeState = getPmosWaterMaintenanceRouteState_(created.customerId);
    const routeStatusIndex = routeState.table
      ? findHeaderIndex_(routeState.table.headers, ['Status']) : -1;
    const actualRouteStatus = routeState.rows.length && routeStatusIndex >= 0
      ? String(routeState.rows[0].row[routeStatusIndex] || '').trim() : '';
    pmosAcceptanceRecord_(results, 'Water Maintenance', status + ' saved in Route Template',
      status, actualRouteStatus);
  });
}

function pmosAcceptanceMaintenanceInput_(name, status, week) {
  const address = pmosAcceptanceAddress_(30 + Number(week || 1));
  const placement = pmosAcceptanceRoutePlacement_(
    Math.max(1, Math.min(4, Number(week || 1)))
  );
  return {
    firstName: 'Acceptance',
    lastName: String(name || PMOS_ACCEPTANCE_MARKER_PREFIX_),
    phone: '416-555-0199',
    email: '',
    address: address.address,
    addressVerified: true,
    addressDetails: address,
    serviceLocationName: 'Status ' + status,
    calendarTitle: String(name || PMOS_ACCEPTANCE_MARKER_PREFIX_),
    status: status,
    frequency: 'Monthly',
    day: placement.day,
    week: Math.max(1, Math.min(4, Number(week || 1))),
    stop: 0,
    recommendedPlacements: [placement],
    effectiveDate: Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd'),
    yearRound: 'No',
    entryInformation: 'Acceptance bot only',
    notes: 'Maintenance status fixture',
    maintenanceNotes: 'Maintenance Notes ' + status,
    bodiesOfWater: pmosAcceptanceEquipmentFixture_()
  };
}

function pmosAcceptanceRoutePlacement_(week) {
  const sheet = findFirstSheetByName_(pmosAcceptanceSpreadsheet_(), [
    PMOS.ROUTES_SHEET, '4-Week Route Template', 'PMOS 4-Week Route Template', 'Route Template'
  ]);
  if (!sheet) throw new Error('Acceptance tests require the 4-Week Route Template.');
  const table = readPmosHeaderTable_(sheet);
  const layerIndex = findHeaderIndex_(table.headers, ['Layer', 'Route Layer', 'Route Assignment']);
  if (layerIndex < 0) throw new Error('Acceptance tests require the Route Template Layer column.');
  const placement = table.rows.map(function(row) {
    const candidate = String(row[layerIndex] || '').trim();
    if (!candidate) return null;
    try {
      const parsed = parseLayer_(candidate);
      if (Number(parsed.week) !== Number(week) ||
          ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].indexOf(String(parsed.day || '')) < 0) {
        return null;
      }
      return {layer: candidate, day: String(parsed.day)};
    } catch (ignored) {
      return null;
    }
  }).filter(Boolean)[0];
  if (!placement) {
    throw new Error('No development Route Template layer exists for Week ' + week + '.');
  }
  return {
    week: Number(week),
    day: placement.day,
    layer: placement.layer,
    position: nextMaintenanceStopForLayer_(table, placement.layer)
  };
}

function pmosAcceptanceEquipmentFixture_() {
  return [{
    name: 'Pool',
    type: 'Pool',
    location: 'Outdoor',
    shape: 'Rectangle',
    volume: '75,000 L',
    sanitization: 'Chlorine',
    pump: {
      make: 'Pentair', model: 'SuperFlo VST', modelNumber: '342002', partNumber: '342002'
    },
    filter: {
      type: 'Cartridge', make: 'Pentair', model: 'Clean & Clear Plus 420',
      modelNumber: 'CCP420', partNumber: '160301', cartridgeSetNumber: 'R173576'
    },
    heater: {
      type: 'Natural Gas', make: 'Pentair', model: 'MasterTemp',
      modelNumber: '400', partNumber: '460736'
    },
    cover: {type: 'Auto Cover', winterType: 'Safety Cover'},
    equipment: [{
      type: 'CHLORINE_FEEDER',
      details: {make: 'Pentair', model: '300', modelNumber: 'R171016', partNumber: 'R171016'}
    }, {
      type: 'EQUIPMENT_AUTOMATION',
      details: {manufacturer: 'Pentair', model: 'IntelliCenter'}
    }, {
      type: 'CHEMISTRY_AUTOMATION',
      details: {manufacturer: 'Pentair', model: 'IntelliChem', modelNumber: '521357'}
    }, {
      type: 'WATER_FEATURE',
      details: {
        name: 'Sheer Descent', actuatorMake: 'Pentair', actuatorModel: 'CVA-24T',
        actuatorModelNumber: '263045',
        featureEquipmentJson: JSON.stringify([{
          type: 'PUMP',
          details: {pumpMake: 'Pentair', pumpModel: 'SuperFlo VST', pumpModelNumber: '342002'}
        }])
      }
    }]
  }];
}

function pmosAcceptanceAddress_(number) {
  const street = String(number) + ' Test Bot Lane';
  const address = street + ', Toronto, ON M4B 1B3, Canada';
  return {
    address: address,
    street: street,
    city: 'Toronto',
    province: 'Ontario',
    postalCode: 'M4B 1B3',
    country: 'Canada',
    lat: 43.7000 + Number(number || 0) / 100000,
    lng: -79.4000 - Number(number || 0) / 100000,
    placeId: 'PMOS_TEST_' + String(number),
    source: 'PMOS Acceptance Test Bot'
  };
}

function pmosAcceptanceTrackFixture_(manifest, customerId) {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('The acceptance bot created a fixture without a Customer ID.');
  if (manifest.customerIds.indexOf(id) < 0) manifest.customerIds.push(id);
  PropertiesService.getDocumentProperties().setProperty(
    PMOS_ACCEPTANCE_MANIFEST_PROPERTY_,
    JSON.stringify(manifest)
  );
}

function pmosAcceptanceDiscoverMarkedCustomerIds_(manifest) {
  if (!pmosAcceptanceManifestHasValidMarker_(manifest)) return;
  manifest.customerIds = Array.isArray(manifest.customerIds) ? manifest.customerIds : [];
  const spreadsheet = pmosAcceptanceSpreadsheet_();
  const candidates = [
    findFirstSheetByName_(spreadsheet, [
      PMOS.CUSTOMERS_SHEET, 'Customers', 'Customer Database', 'Customer List'
    ]),
    findFirstSheetByName_(spreadsheet, [
      PMOS.ROUTES_SHEET, '4-Week Route Template', 'PMOS 4-Week Route Template', 'Route Template'
    ]),
    spreadsheet.getSheetByName('PMOS Customer Equipment')
  ];
  const seenSheets = {};
  candidates.filter(Boolean).forEach(function(sheet) {
    const sheetId = String(sheet.getSheetId());
    if (seenSheets[sheetId]) return;
    seenSheets[sheetId] = true;
    const table = readPmosHeaderTable_(sheet);
    const idIndex = findHeaderIndex_(table.headers, ['Customer ID']);
    if (idIndex < 0) return;
    table.rows.forEach(function(row) {
      const rowText = row.map(function(value) { return String(value || ''); }).join(' | ');
      const id = String(row[idIndex] || '').trim();
      if (id && rowText.indexOf(manifest.marker) >= 0 && manifest.customerIds.indexOf(id) < 0) {
        manifest.customerIds.push(id);
      }
    });
  });
  PropertiesService.getDocumentProperties().setProperty(
    PMOS_ACCEPTANCE_MANIFEST_PROPERTY_,
    JSON.stringify(manifest)
  );
}

function pmosAcceptanceCleanupManifest_(manifest) {
  const environment = pmosAcceptanceRequireSafeEnvironment_();
  if (String(manifest.spreadsheetId || '') !== environment.spreadsheetId) {
    throw new Error('The tracked fixtures belong to a different spreadsheet. Cleanup stopped.');
  }
  if (!pmosAcceptanceManifestHasValidMarker_(manifest)) {
    throw new Error('The fixture manifest is missing the required PMOS TEST BOT marker. Cleanup stopped.');
  }
  const ids = (manifest.customerIds || []).map(function(id) {
    return String(id || '').trim();
  }).filter(Boolean);
  const spreadsheet = pmosAcceptanceSpreadsheet_();
  const customerSheet = findFirstSheetByName_(spreadsheet, [
    PMOS.CUSTOMERS_SHEET, 'Customers', 'Customer Database', 'Customer List'
  ]);
  if (!customerSheet) throw new Error('Customers sheet was not found during test cleanup.');
  const customerTable = readPmosHeaderTable_(customerSheet);
  const customerIdIndex = findHeaderIndex_(customerTable.headers, ['Customer ID']);
  if (customerIdIndex < 0) throw new Error('Customers is missing Customer ID during test cleanup.');

  const allowed = {};
  const skipped = [];
  ids.forEach(function(id) {
    const row = customerTable.rows.filter(function(candidate) {
      return String(candidate[customerIdIndex] || '').trim() === id;
    })[0];
    if (!row) {
      allowed[id] = true;
      return;
    }
    const rowText = row.map(function(value) { return String(value || ''); }).join(' | ');
    if (rowText.indexOf(manifest.marker) >= 0 && rowText.indexOf(PMOS_ACCEPTANCE_MARKER_PREFIX_) >= 0) {
      allowed[id] = true;
    } else {
      skipped.push(id);
    }
  });

  const removableIds = Object.keys(allowed);
  pmosAcceptanceRemoveRowsByCustomerId_(findFirstSheetByName_(spreadsheet, [
    PMOS.ROUTES_SHEET, '4-Week Route Template', 'PMOS 4-Week Route Template', 'Route Template'
  ]), removableIds, false);
  pmosAcceptanceRemoveRowsByCustomerId_(spreadsheet.getSheetByName('PMOS Customer Equipment'), removableIds, true);
  pmosAcceptanceRemoveRowsByCustomerId_(customerSheet, removableIds, true);
  SpreadsheetApp.flush();
  if (typeof clearPmosCalendarAuditSnapshot_ === 'function') clearPmosCalendarAuditSnapshot_();
  return {
    cleaned: skipped.length === 0,
    removedCustomerIds: removableIds,
    skippedCustomerIds: skipped
  };
}

function pmosAcceptanceRemoveRowsByCustomerId_(sheet, customerIds, deletePhysicalRows) {
  if (!sheet || !customerIds || !customerIds.length || sheet.getLastRow() < 1) return;
  const table = readPmosHeaderTable_(sheet);
  const idIndex = findHeaderIndex_(table.headers, ['Customer ID']);
  if (idIndex < 0) return;
  const wanted = {};
  customerIds.forEach(function(id) { wanted[String(id || '').trim()] = true; });
  if (deletePhysicalRows) {
    const rows = [];
    table.rows.forEach(function(row, index) {
      if (wanted[String(row[idIndex] || '').trim()]) rows.push(table.headerRow + index + 1);
    });
    rows.sort(function(left, right) { return right - left; }).forEach(function(rowNumber) {
      sheet.deleteRow(rowNumber);
    });
    return;
  }
  const retained = table.rows.filter(function(row) {
    return !wanted[String(row[idIndex] || '').trim()];
  });
  writeMaintenanceRouteTable_(sheet, {
    headers: table.headers,
    headerRow: table.headerRow,
    rows: retained
  });
}

function pmosAcceptanceEnvironment_() {
  const spreadsheet = pmosAcceptanceSpreadsheet_();
  const spreadsheetId = spreadsheet.getId();
  const calendarName = pmosAcceptanceCalendarName_();
  const productionNames = {
    'water maintenance routes': true,
    '1 - water maintenance routes': true
  };
  const normalizedCalendar = String(calendarName || '').trim().toLowerCase();
  const blockedProductionTarget = !!productionNames[normalizedCalendar] ||
    /\b(production|operational)\b/i.test(String(calendarName || ''));
  const developmentTarget = !blockedProductionTarget &&
    /\b(development|test|sandbox)\b/i.test(String(calendarName || ''));
  const armed = pmosAcceptanceReadJsonProperty_(PMOS_ACCEPTANCE_ARMED_PROPERTY_);
  const armMatches = !!(armed &&
    String(armed.spreadsheetId || '') === spreadsheetId &&
    String(armed.calendarName || '') === calendarName);
  return {
    spreadsheetId: spreadsheetId,
    spreadsheetName: spreadsheet.getName(),
    calendarName: calendarName,
    developmentTarget: developmentTarget,
    armed: developmentTarget && armMatches
  };
}

function pmosAcceptanceRequireSafeEnvironment_() {
  const environment = pmosAcceptanceEnvironment_();
  if (!environment.developmentTarget) {
    throw new Error(
      'Acceptance Test Bot refused to run. App Settings must target a Development, Test, or Sandbox Calendar; production Calendar names are blocked.'
    );
  }
  if (!environment.armed) {
    throw new Error('Acceptance Test Bot is not armed for this exact spreadsheet and Calendar setting.');
  }
  return environment;
}

function pmosAcceptanceCalendarName_() {
  const sheet = pmosAcceptanceSpreadsheet_().getSheetByName(PMOS.SETTINGS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return String(PMOS.CALENDAR_NAME || '').trim();
  const values = sheet.getDataRange().getValues();
  for (let index = 1; index < values.length; index++) {
    if (String(values[index][0] || '').trim() === 'Calendar Name') {
      return String(values[index][1] || '').trim();
    }
  }
  return String(PMOS.CALENDAR_NAME || '').trim();
}

function pmosAcceptanceTriggerHandlers_() {
  return ScriptApp.getProjectTriggers().map(function(trigger) {
    return trigger.getHandlerFunction();
  }).sort();
}

function pmosAcceptanceFindContactEmail_(contacts, expected) {
  const match = pmosAcceptanceFindContact_(contacts, expected);
  return match ? String(match.email || '').toLowerCase() : '';
}

function pmosAcceptanceFindContact_(contacts, expectedEmail) {
  const target = String(expectedEmail || '').toLowerCase();
  return (contacts || []).filter(function(contact) {
    return String(contact && contact.email || '').toLowerCase() === target;
  })[0] || null;
}

function pmosAcceptanceManifestHasValidMarker_(manifest) {
  if (!manifest) return false;
  const runId = String(manifest.runId || '').trim().toUpperCase();
  const marker = String(manifest.marker || '').trim().toUpperCase();
  return /^[A-F0-9]{10}$/.test(runId) &&
    marker === PMOS_ACCEPTANCE_MARKER_PREFIX_ + ' ' + runId;
}

function pmosAcceptanceFindEquipment_(body, type) {
  return ((body && body.equipment) || []).filter(function(item) {
    return String(item && item.type || '') === String(type || '');
  })[0] || null;
}

function pmosAcceptanceRecord_(results, area, test, expected, actual, details) {
  const pass = String(expected) === String(actual);
  results.push({
    area: area,
    test: test,
    expected: expected,
    actual: actual,
    result: pass ? 'PASS' : 'FAIL',
    details: String(details || '')
  });
  return pass;
}

function pmosAcceptanceInfo_(results, area, test, details) {
  results.push({area: area, test: test, expected: '', actual: '', result: 'INFO', details: String(details || '')});
}

function pmosAcceptanceExpectError_(results, area, test, expectedPattern, callback) {
  let actual = 'No error';
  let errorMatched = false;
  try {
    callback();
  } catch (error) {
    actual = String(error && error.message ? error.message : error);
    errorMatched = expectedPattern.test(actual);
  }
  results.push({
    area: area,
    test: test,
    expected: String(expectedPattern),
    actual: actual,
    result: errorMatched ? 'PASS' : 'FAIL',
    details: ''
  });
}

function pmosAcceptanceSummarize_(runId, started, completed, results, manifest, cleanup, keepFixtures) {
  const passed = results.filter(function(row) { return row.result === 'PASS'; }).length;
  const failed = results.filter(function(row) { return row.result === 'FAIL'; }).length;
  const info = results.filter(function(row) { return row.result === 'INFO'; }).length;
  return {
    runId: runId,
    startedAt: started.toISOString(),
    completedAt: completed.toISOString(),
    durationSeconds: Math.round((completed.getTime() - started.getTime()) / 100) / 10,
    passed: passed,
    failed: failed,
    info: info,
    status: failed ? 'FAILED' : 'PASSED',
    fixturesRetained: keepFixtures || !cleanup.cleaned,
    fixtureCustomerIds: (keepFixtures || !cleanup.cleaned) ? manifest.customerIds.slice() : [],
    message: failed
      ? failed + ' acceptance check(s) failed. Open the results sheet for exact expected and actual values.'
      : passed + ' automated acceptance checks passed.'
  };
}

function pmosAcceptanceEnsureResultsSheet_() {
  const spreadsheet = pmosAcceptanceSpreadsheet_();
  let resultsSheet = spreadsheet.getSheetByName(PMOS_ACCEPTANCE_RESULTS_SHEET_);
  if (!resultsSheet) {
    resultsSheet = spreadsheet.insertSheet(PMOS_ACCEPTANCE_RESULTS_SHEET_);
  }
  const headers = [
    'Run ID', 'Started At', 'Area', 'Test', 'Expected', 'Actual', 'Result', 'Details'
  ];
  if (resultsSheet.getLastRow() === 0) {
    resultsSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  resultsSheet.setFrozenRows(1);
  resultsSheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#293944')
    .setFontColor('#ffffff');
  [130, 155, 150, 330, 180, 180, 80, 360].forEach(function(width, index) {
    resultsSheet.setColumnWidth(index + 1, width);
  });
  return resultsSheet;
}

function pmosAcceptanceWriteResults_(summary, results) {
  const sheet = pmosAcceptanceEnsureResultsSheet_();
  pmosAcceptanceRemoveExistingResultRows_(sheet, summary.runId);
  const started = new Date(summary.startedAt);
  const rows = results.map(function(row) {
    return [
      summary.runId,
      started,
      row.area,
      row.test,
      String(row.expected == null ? '' : row.expected),
      String(row.actual == null ? '' : row.actual),
      row.result,
      row.details
    ];
  });
  if (!rows.length) return;
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(startRow, 2, rows.length, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setVerticalAlignment('top');
  sheet.getRange(startRow, 4, rows.length, 5).setWrap(true);
  rows.forEach(function(row, index) {
    const resultCell = sheet.getRange(startRow + index, 7);
    if (row[6] === 'PASS') resultCell.setBackground('#dff3e4').setFontColor('#245b36');
    if (row[6] === 'FAIL') resultCell.setBackground('#fde2e2').setFontColor('#8b1d1d');
    if (row[6] === 'INFO') resultCell.setBackground('#e8f1f5').setFontColor('#315668');
  });
}

function pmosAcceptanceRemoveExistingResultRows_(sheet, runId) {
  const target = String(runId || '').trim();
  if (!target || sheet.getLastRow() < 2) return;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const rows = [];
  values.forEach(function(row, index) {
    if (String(row[0] || '').trim() === target) rows.push(index + 2);
  });
  rows.sort(function(left, right) { return right - left; }).forEach(function(rowNumber) {
    sheet.deleteRow(rowNumber);
  });
}

function pmosAcceptanceSpreadsheet_() {
  const spreadsheet = SpreadsheetApp.getActive();
  if (!spreadsheet) {
    throw new Error(
      'Acceptance Test Bot could not find its bound spreadsheet. Open it from the PMOS menu in the development Google Sheet.'
    );
  }
  return spreadsheet;
}

function pmosAcceptanceSheetUi_() {
  pmosAcceptanceSpreadsheet_();
  try {
    return SpreadsheetApp.getUi();
  } catch (error) {
    throw new Error(
      'Acceptance Test Bot must be opened from PMOS → PMOS Settings inside the development Google Sheet. ' +
      'The current execution does not have a spreadsheet UI context.'
    );
  }
}

function pmosAcceptanceReadJsonProperty_(key) {
  const raw = PropertiesService.getDocumentProperties().getProperty(key);
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch (ignored) { return null; }
}
