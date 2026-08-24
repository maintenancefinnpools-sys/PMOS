/**
 * Explicit runtime integration for customer-form refinements.
 *
 * 24-T / 24-U contain the reusable UI and data helpers. This module makes those helpers
 * deterministic at PMOS entry points instead of depending on Apps Script file execution
 * order. It also provides explicit RPC endpoints for categorized notes, per-body
 * equipment notes, solar equipment, account-name presentation, and multi-location flows.
 */

function pmosCustomerRuntimeDisplayName_(firstName, lastName, fallback) {
  const first = String(firstName || '').trim();
  const last = String(lastName || '').trim();
  return [first, last].filter(Boolean).join(' ') || String(fallback || '').trim();
}

function pmosCustomerRuntimeListName_(firstName, lastName, fallback) {
  const first = String(firstName || '').trim();
  const last = String(lastName || '').trim();
  return last && first ? last + ', ' + first : last || first || String(fallback || '').trim();
}

function pmosEnsureCategorizedNotesRuntime_() {
  return ensurePmosCustomerCategorizedNotes_();
}

function pmosReadCategorizedNotesRuntime_(customerId) {
  return readPmosCustomerCategorizedNotes_(customerId);
}

function pmosSaveCategorizedNotesRuntime_(customerId, input) {
  return savePmosCustomerCategorizedNotes_(customerId, input);
}

function pmosNormalizeSolarEquipmentRuntime_(input) {
  if (typeof normalizePmosSolarEquipment_ === 'function') {
    return normalizePmosSolarEquipment_(input);
  }
  return (Array.isArray(input) ? input : []).slice(0, 20).map(function(item) {
    const source = item || {};
    return {
      type: String(source.type || 'OTHER').trim().slice(0, 80),
      make: String(source.make || '').trim().slice(0, 160),
      model: String(source.model || '').trim().slice(0, 180),
      modelNumber: String(source.modelNumber || '').trim().slice(0, 160),
      quantity: String(source.quantity || '').trim().slice(0, 40),
      notes: String(source.notes || '').trim().slice(0, 1000)
    };
  }).filter(function(item) {
    return item.type || item.make || item.model || item.modelNumber || item.quantity || item.notes;
  });
}

function pmosNormalizeBodiesWithRuntimeEnhancements_(input) {
  const rawBodies = Array.isArray(input) ? input : [];
  const bodies = normalizePmosCustomerEditorBodies_(rawBodies);
  bodies.forEach(function(body, index) {
    const raw = rawBodies[index] || {};
    body.equipmentNotes = String(raw.equipmentNotes || '').trim().slice(0, 5000);
    body.heater = Object.assign({}, body.heater || {});
    const solarEquipment = pmosNormalizeSolarEquipmentRuntime_(raw.heater && raw.heater.solarEquipment);
    if (solarEquipment.length || /^solar$/i.test(String(body.heater.type || ''))) {
      body.heater.solarEquipment = solarEquipment;
    }
  });
  return bodies;
}

function pmosPersistBodyEnhancementsRuntime_(customerId, input) {
  const rawBodies = input && Array.isArray(input.bodiesOfWater) ? input.bodiesOfWater : null;
  if (!rawBodies) return null;
  const bodies = pmosNormalizeBodiesWithRuntimeEnhancements_(rawBodies);
  const record = getPmosCustomerEditorRow_(customerId);
  const titleIndex = findHeaderIndex_(record.headers, ['Calendar Title']);
  const firstIndex = findHeaderIndex_(record.headers, ['First Name']);
  const lastIndex = findHeaderIndex_(record.headers, ['Last Name', 'Customer Name', 'Name', 'Customer']);
  const calendarTitle = String(
    titleIndex >= 0 ? record.values[titleIndex] :
      (lastIndex >= 0 ? record.values[lastIndex] : (firstIndex >= 0 ? record.values[firstIndex] : ''))
  ).trim();
  const equipment = buildPmosCustomerEditorEquipmentValues_(bodies, customerId, calendarTitle);
  const values = record.values.slice();
  [
    [['Equipment Summary'], equipment.summary],
    [['Equipment Details JSON'], equipment.detailsJson],
    [['Sanitization Type(s)'], equipment.sanitization],
    [['Automation'], equipment.automation],
    [['Pump'], equipment.pump],
    [['Filter'], equipment.filter],
    [['Heater'], equipment.heater],
    [['Robot(s)', 'Cleaner'], equipment.robots],
    [['Cover'], equipment.cover],
    [['Bodies of Water'], equipment.bodies]
  ].forEach(function(item) {
    pmosCustomerEditorSetAliases_(record.headers, values, item[0], item[1]);
  });
  record.sheet.getRange(record.rowNumber, 1, 1, values.length).setValues([values]);

  const equipmentSheet = migrateMaintenanceCustomerEquipmentStorage_(SpreadsheetApp.getActive(), record.sheet);
  upsertMaintenanceCustomerEquipment_(equipmentSheet, {
    customerId: customerId,
    calendarTitle: calendarTitle,
    equipmentSummary: equipment.summary,
    equipmentDetailsJson: equipment.detailsJson
  });
  SpreadsheetApp.flush();
  return bodies;
}

function pmosAttachRuntimeCustomerDetails_(profile, customerId) {
  const result = profile || {};
  const account = getPmosCustomerAccount_(customerId);
  result.accountName = pmosCustomerRuntimeDisplayName_(account.firstName, account.lastName, account.accountId);
  result.accountListName = pmosCustomerRuntimeListName_(account.firstName, account.lastName, account.accountId);
  const notes = pmosReadCategorizedNotesRuntime_(customerId);
  result.generalNotes = notes.generalNotes;
  result.notes = notes.generalNotes;
  result.openingNotes = notes.openingNotes;
  result.closingNotes = notes.closingNotes;
  result.maintenanceNotes = notes.maintenanceNotes;
  return result;
}

function getPmosCustomerAccountRuntime(customerId) {
  const account = getPmosCustomerAccount_(customerId);
  account.accountName = pmosCustomerRuntimeDisplayName_(account.firstName, account.lastName, account.accountId);
  account.listName = pmosCustomerRuntimeListName_(account.firstName, account.lastName, account.accountId);
  return account;
}

function getPmosCustomerAccountProfileRuntime(customerId) {
  return pmosAttachRuntimeCustomerDetails_(getPmosCustomerAccountProfile(customerId), customerId);
}

function getPmosCustomerAccountEditorDataRuntime(customerId) {
  return pmosAttachRuntimeCustomerDetails_(getPmosCustomerAccountEditorDataWithWaterMaintenance(customerId), customerId);
}

function createPmosCustomerAccountRuntime(input) {
  const request = Object.assign({}, input || {});
  if (Object.prototype.hasOwnProperty.call(request, 'generalNotes')) request.notes = request.generalNotes;
  pmosEnsureCategorizedNotesRuntime_();
  const result = createPmosCustomerAccount(request);
  pmosSaveCategorizedNotesRuntime_(result.customerId, request);
  pmosPersistBodyEnhancementsRuntime_(result.customerId, request);
  result.profile = getPmosCustomerAccountProfileRuntime(result.customerId);
  return result;
}

function createMaintenanceCustomerAndAutoSyncRuntime(input) {
  const request = Object.assign({}, input || {});
  if (Object.prototype.hasOwnProperty.call(request, 'generalNotes')) request.notes = request.generalNotes;
  pmosEnsureCategorizedNotesRuntime_();
  const result = createMaintenanceCustomerAndAutoSync(request);
  pmosSaveCategorizedNotesRuntime_(result.customerId, request);
  pmosPersistBodyEnhancementsRuntime_(result.customerId, request);
  return result;
}

function createPmosAdditionalServiceLocationRuntime(input) {
  const request = Object.assign({}, input || {});
  if (Object.prototype.hasOwnProperty.call(request, 'generalNotes')) request.notes = request.generalNotes;
  pmosEnsureCategorizedNotesRuntime_();
  let result;
  if (typeof createPmosAdditionalServiceLocationForAccountWithLocationContactsAndBilling === 'function') {
    result = createPmosAdditionalServiceLocationForAccountWithLocationContactsAndBilling(request);
  } else if (typeof createPmosAdditionalServiceLocationForAccountWithLocationContacts === 'function') {
    result = createPmosAdditionalServiceLocationForAccountWithLocationContacts(request);
  } else {
    result = createPmosAdditionalServiceLocationForAccount(request);
  }
  pmosSaveCategorizedNotesRuntime_(result.customerId, request);
  pmosPersistBodyEnhancementsRuntime_(result.customerId, request);
  result.profile = getPmosCustomerAccountProfileRuntime(result.customerId);
  return result;
}

function savePmosCustomerAccountEditorDataRuntime(input) {
  const request = Object.assign({}, input || {});
  if (Object.prototype.hasOwnProperty.call(request, 'generalNotes')) request.notes = request.generalNotes;
  pmosEnsureCategorizedNotesRuntime_();
  const result = savePmosCustomerAccountEditorDataWithWaterMaintenance(request);
  const id = String(result.customerId || request.customerId || '').trim();
  pmosSaveCategorizedNotesRuntime_(id, request);
  pmosPersistBodyEnhancementsRuntime_(id, request);
  result.profile = getPmosCustomerAccountProfileRuntime(id);
  return result;
}

function returnFromPmosCustomerAccountEditorRuntime(customerId, returnContext) {
  showPmosCustomerAccountLookupRuntime(customerId);
}

function pmosRuntimeCustomerBridgeScript_(context) {
  if (context === 'ADD_CUSTOMER') {
    return String.raw`
(function(){
  if(window.__pmosRuntimeAddCustomerBridge)return;window.__pmosRuntimeAddCustomerBridge=true;
  window.createAddCustomer=function(){
    var data=addCustomerPayload();
    if(!data.lastName||!data.firstName){addCustomerSetStatus('First name and last name are required.','error');return}
    if(!data.address||!selectedAddress){addCustomerSetStatus('Choose and confirm a complete service-location address before creating the customer.','error');return}
    if(!data.serviceLocationName){addCustomerSetStatus('Enter a Service Location Name.','error');return}
    var button=byId('saveButton');button.disabled=true;button.textContent='Creating…';addCustomerSetStatus('Creating the customer account and primary service location…','');
    google.script.run.withSuccessHandler(function(result){
      createdCustomerId=result&&result.customerId||'';button.textContent='Complete';byId('openProfileButton').style.display=createdCustomerId?'inline-block':'none';
      var warning=result&&result.warnings&&result.warnings.length?'\n\n'+result.warnings.join('\n'):'';
      addCustomerSetStatus((result&&result.summary||'Customer created.')+warning,result&&result.warnings&&result.warnings.length?'':'success');
    }).withFailureHandler(function(error){button.disabled=false;button.textContent='Create Customer';addCustomerSetStatus(error&&error.message?error.message:String(error),'error')}).createPmosCustomerAccountRuntime(data);
  };
})();
`;
  }
  if (context === 'ADD_MAINTENANCE') {
    return String.raw`
(function(){
  if(window.__pmosRuntimeAddMaintenanceBridge)return;window.__pmosRuntimeAddMaintenanceBridge=true;
  window.saveCustomer=function(){
    var data=formValues();
    if(!data.firstName.trim()||!data.lastName.trim()||!data.address.trim()){byId('status').className='status error';byId('status').textContent='First name, last name, and service address are required.';return}
    if(!selectedAddress){byId('status').className='status error';byId('status').textContent='Choose and confirm a complete address suggestion before creating the client.';return}
    if(data.frequency==='Twice Weekly'&&data.day===data.secondDay){byId('status').className='status error';byId('status').textContent='Twice-weekly service requires two different weekdays.';return}
    byId('saveButton').disabled=true;startClientProgress(true);setClientProgress(1);byId('status').className='status';byId('status').textContent='Creating the client and scheduling automatic Calendar synchronization…';
    google.script.run.withSuccessHandler(function(result){
      savedCustomer=Object.assign({},data,{customerId:result.customerId,affectedLayers:(result.routeRows||[]).map(function(row){return row.layer})});
      byId('saveButton').textContent='Created';
      if(result.calendarStatus==='SYNC_ERROR'){stopClientProgressClock();byId('status').className='status error';byId('status').textContent=result.summary||result.calendarError||'The client was saved, but Calendar Sync could not be scheduled.';byId('retryButton').style.display='inline-block';return}
      byId('status').textContent='Maintenance client created. Automatic Calendar synchronization is scheduled. It is now safe to close this window; work will continue in the background.';pollAddedClientCalendarSync();
    }).withFailureHandler(function(error){stopClientProgressClock();byId('saveButton').disabled=false;byId('status').className='status error';byId('status').textContent=error&&error.message?error.message:String(error)}).createMaintenanceCustomerAndAutoSyncRuntime(data);
  };
})();
`;
  }
  return '';
}

function pmosRewriteRuntimeCustomerEndpoints_(html) {
  let output = String(html || '');
  const replacements = [
    ['.getPmosCustomerAccountEditorDataWithWaterMaintenance(', '.getPmosCustomerAccountEditorDataRuntime('],
    ['.getPmosCustomerAccountEditorData(', '.getPmosCustomerAccountEditorDataRuntime('],
    ['.getPmosCustomerAccountProfile(', '.getPmosCustomerAccountProfileRuntime('],
    ['.getPmosCustomerAccount(', '.getPmosCustomerAccountRuntime('],
    ['.savePmosCustomerAccountEditorDataWithWaterMaintenance(', '.savePmosCustomerAccountEditorDataRuntime('],
    ['.savePmosCustomerAccountEditorDataWithLocationContactsAndBilling(', '.savePmosCustomerAccountEditorDataRuntime('],
    ['.savePmosCustomerAccountEditorDataWithLocationContacts(', '.savePmosCustomerAccountEditorDataRuntime('],
    ['.savePmosCustomerAccountEditorData(', '.savePmosCustomerAccountEditorDataRuntime('],
    ['.createPmosAdditionalServiceLocationForAccountWithLocationContactsAndBilling(', '.createPmosAdditionalServiceLocationRuntime('],
    ['.createPmosAdditionalServiceLocationForAccountWithLocationContacts(', '.createPmosAdditionalServiceLocationRuntime('],
    ['.createPmosAdditionalServiceLocationForAccount(', '.createPmosAdditionalServiceLocationRuntime('],
    ['.createPmosAdditionalServiceLocation(', '.createPmosAdditionalServiceLocationRuntime('],
    ['.showPmosCustomerAccountEditor(', '.showPmosCustomerAccountEditorRuntime('],
    ['.showPmosAddServiceLocation(', '.showPmosAddServiceLocationRuntime('],
    ['.showPmosCustomerAccountLookup(', '.showPmosCustomerAccountLookupRuntime('],
    ['.returnFromPmosCustomerAccountEditor(', '.returnFromPmosCustomerAccountEditorRuntime(']
  ];
  replacements.forEach(function(pair) { output = output.split(pair[0]).join(pair[1]); });
  return output;
}

function pmosFinalizeRuntimeCustomerHtml_(html, context) {
  let output = pmosRewriteRuntimeCustomerEndpoints_(html);
  if (context === 'LOOKUP' && output.indexOf('__pmosProfileEnhancementLoaded') < 0 &&
      typeof pmosCustomerProfileEnhancementScript_ === 'function') {
    output = output.replace('</script></body></html>',
      pmosCustomerProfileEnhancementScript_() + '\n</script></body></html>');
  }
  return output;
}

function pmosWithRuntimeCustomerFormAssets_(context, callback) {
  const equipmentStylesBase = pmosCustomerEquipmentEditorStyles_;
  const equipmentScriptBase = pmosCustomerEquipmentEditorScript_;
  const routeStylesBase = typeof pmosRouteRecommendationCardStyles_ === 'function'
    ? pmosRouteRecommendationCardStyles_ : null;
  const routeScriptBase = typeof pmosRouteRecommendationCardScript_ === 'function'
    ? pmosRouteRecommendationCardScript_ : null;
  const terminologyBase = typeof pmosAccountTerminologyText_ === 'function'
    ? pmosAccountTerminologyText_ : null;

  pmosCustomerEquipmentEditorStyles_ = function() {
    let css = equipmentStylesBase();
    if (typeof pmosCustomerFormEnhancementStyles_ === 'function' && css.indexOf('.pmos-solar-panel') < 0) {
      css += pmosCustomerFormEnhancementStyles_();
    }
    return css;
  };
  pmosCustomerEquipmentEditorScript_ = function() {
    let script = equipmentScriptBase();
    if (typeof pmosCustomerFormEnhancementScript_ === 'function' &&
        script.indexOf('__pmosCustomerFormEnhancementsLoaded') < 0) {
      script += pmosCustomerFormEnhancementScript_();
    }
    script = pmosRewriteRuntimeCustomerEndpoints_(script);
    script += pmosRuntimeCustomerBridgeScript_(context);
    return script;
  };

  if (routeStylesBase) {
    pmosRouteRecommendationCardStyles_ = function() {
      let css = routeStylesBase();
      if (typeof pmosRouteManualUiStyles_ === 'function' && css.indexOf('.pmos-manual-route-toggle') < 0) {
        css += pmosRouteManualUiStyles_();
      }
      return css;
    };
  }
  if (routeScriptBase) {
    pmosRouteRecommendationCardScript_ = function() {
      let script = routeScriptBase();
      if (typeof pmosRouteManualUiScript_ === 'function' && script.indexOf('__pmosManualRouteUiLoaded') < 0) {
        script += pmosRouteManualUiScript_();
      }
      script = pmosRewriteRuntimeCustomerEndpoints_(script);
      return script;
    };
  }
  if (terminologyBase) {
    pmosAccountTerminologyText_ = function(value) {
      return pmosFinalizeRuntimeCustomerHtml_(terminologyBase(value), context);
    };
  }

  try {
    return callback();
  } finally {
    pmosCustomerEquipmentEditorStyles_ = equipmentStylesBase;
    pmosCustomerEquipmentEditorScript_ = equipmentScriptBase;
    if (routeStylesBase) pmosRouteRecommendationCardStyles_ = routeStylesBase;
    if (routeScriptBase) pmosRouteRecommendationCardScript_ = routeScriptBase;
    if (terminologyBase) pmosAccountTerminologyText_ = terminologyBase;
  }
}

function showPmosCustomerAccountLookupRuntime(initialCustomerId) {
  const htmlText = pmosWithRuntimeCustomerFormAssets_('LOOKUP', function() {
    return pmosFinalizeRuntimeCustomerHtml_(
      buildPmosCustomerAccountLookupHtml_('LOOKUP', initialCustomerId),
      'LOOKUP'
    );
  });
  const html = HtmlService.createHtmlOutput(htmlText).setWidth(1180).setHeight(780);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Customer Lookup');
}

function showPmosCustomerAccountEditorRuntime(customerId, returnContext) {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('Select a customer before opening the editor.');
  const context = returnContext === 'PROFILE' ? 'PROFILE' : 'EDITOR_SEARCH';
  const htmlText = pmosWithRuntimeCustomerFormAssets_('EDITOR', function() {
    return pmosFinalizeRuntimeCustomerHtml_(
      buildPmosCustomerAccountEditorHtml_(id, context),
      'EDITOR'
    );
  });
  const html = HtmlService.createHtmlOutput(htmlText).setWidth(980).setHeight(760);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Edit Customer Information');
}

function showPmosAddCustomerRuntime() {
  return pmosWithRuntimeCustomerFormAssets_('ADD_CUSTOMER', function() {
    return showPmosAddCustomer();
  });
}

function showAddMaintenanceCustomerRuntime() {
  return pmosWithRuntimeCustomerFormAssets_('ADD_MAINTENANCE', function() {
    return showAddMaintenanceClientV2();
  });
}

function showPmosAddServiceLocationRuntime(customerId) {
  return pmosWithRuntimeCustomerFormAssets_('SERVICE_LOCATION', function() {
    return showPmosAddServiceLocation(customerId);
  });
}

function showPmosTemporaryMaintenanceRuntime() {
  return pmosWithRuntimeCustomerFormAssets_('TEMPORARY', function() {
    return showTemporaryVisitSchedulerV3();
  });
}
