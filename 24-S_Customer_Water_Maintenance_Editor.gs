/**
 * Water Maintenance enrollment controls for an existing service location.
 *
 * Customer/property data always remains. This module controls only recurring Water
 * Maintenance membership: route-template rows, maintenance state, and managed recurring
 * Calendar series. Active / Paused / Inactive apply only while Water Maintenance is on.
 */
const PMOS_WATER_MAINTENANCE_REMOVE_PREFIX_ = 'PMOS_WATER_MAINTENANCE_REMOVE_';
const PMOS_WATER_MAINTENANCE_REMOVE_HANDLER_ = 'runPmosWaterMaintenanceRemovalSyncWorker_';

function getPmosCustomerAccountEditorDataWithWaterMaintenance(customerId) {
  const data = getPmosCustomerAccountEditorData(customerId);
  data.waterMaintenance = getPmosWaterMaintenanceEditorState_(customerId);
  return data;
}

function getPmosWaterMaintenanceEditorState_(customerId) {
  const record = getPmosCustomerEditorRow_(customerId);
  const routeState = getPmosWaterMaintenanceRouteState_(customerId);
  const read = function(aliases) {
    const index = findHeaderIndex_(record.headers, aliases);
    return index >= 0 ? record.values[index] : '';
  };
  const frequency = String(read(['Frequency', 'Service Frequency']) || '').trim();
  const rawStart = read(['Service Start Date', 'Start Date']);
  const yearRound = String(read(['Year Round', 'Year-Round', 'Season']) || '').trim();
  return {
    enabled: routeState.rows.length > 0 || /^(weekly|twice weekly|bi-?weekly|monthly)$/i.test(frequency),
    routeCount: routeState.rows.length,
    layers: routeState.layers,
    status: String(read(['Status']) || 'Active').trim() || 'Active',
    frequency: frequency,
    serviceStartDate: rawStart && Object.prototype.toString.call(rawStart) === '[object Date]' && !isNaN(rawStart.getTime())
      ? Utilities.formatDate(rawStart, PMOS.TIMEZONE, 'yyyy-MM-dd')
      : String(rawStart || '').trim(),
    yearRound: /yes|year round/i.test(yearRound) ? 'Year Round' : 'Seasonal'
  };
}

function getPmosWaterMaintenanceRouteState_(customerId) {
  const id = String(customerId || '').trim();
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [
    PMOS.ROUTES_SHEET, '4-Week Route Template', 'PMOS 4-Week Route Template', 'Route Template'
  ]);
  if (!sheet) return {sheet: null, table: null, rows: [], layers: []};
  const table = readPmosHeaderTable_(sheet);
  const idIndex = findHeaderIndex_(table.headers, ['Customer ID']);
  const layerIndex = findHeaderIndex_(table.headers, ['Layer', 'Route Layer', 'Route Assignment']);
  if (idIndex < 0) return {sheet: sheet, table: table, rows: [], layers: []};
  const rows = [], layers = [];
  table.rows.forEach(function(row, index) {
    if (String(row[idIndex] || '').trim() !== id) return;
    const layer = layerIndex >= 0 ? String(row[layerIndex] || '').trim() : '';
    rows.push({index: index, row: row.slice(), layer: layer});
    if (layer && layers.indexOf(layer) < 0) layers.push(layer);
  });
  return {sheet: sheet, table: table, rows: rows, layers: layers};
}

function normalizePmosWaterMaintenanceEditorPlacements_(request) {
  let placements = Array.isArray(request.recommendedPlacements) ? request.recommendedPlacements.slice() : [];
  if (placements.length && placements[0] && placements[0].manual === true) {
    placements = buildPmosCustomerEditorManualPlacements_(request.frequency, placements[0]);
  } else if (!placements.length && request.manualRoute) {
    placements = buildPmosCustomerEditorManualPlacements_(request.frequency, request.manualRoute);
  }
  return placements.map(function(item) {
    return {
      week: Math.max(1, Math.min(4, Number(item && item.week || 1))),
      day: String(item && item.day || '').trim(),
      layer: String(item && item.layer || '').trim(),
      position: Math.max(1, Math.floor(Number(item && item.position || 1)))
    };
  }).filter(function(item) { return item.day && item.layer; });
}

/**
 * Seed placeholder rows without shifting anyone else's Stop Order. The normal Customer
 * Editor route transaction then removes these placeholders and performs the one real
 * insertion using the selected recommendation, so existing stops move exactly once.
 */
function seedPmosExistingCustomerWaterMaintenanceRoutes_(request, placements) {
  const id = String(request.customerId || '').trim();
  const state = getPmosWaterMaintenanceRouteState_(id);
  if (!state.sheet || !state.table) throw new Error('4-Week Route Template was not found.');
  if (state.rows.length) return state.layers;
  ensureMaintenanceClientHeaders_(state.sheet, state.table, [
    'Customer ID', 'Calendar Title', 'Layer', 'Stop Order', 'Status'
  ]);
  const table = readPmosHeaderTable_(state.sheet);
  const title = String(request.calendarTitle || request.lastName || request.firstName || '').trim();
  placements.forEach(function(placement) {
    table.rows.push(mappedMaintenanceRow_(table.headers, {
      'Customer ID': id,
      'Calendar Title': title,
      'Status': String(request.status || 'Active').trim() || 'Active',
      'Layer': placement.layer,
      'Route Layer': placement.layer,
      'Week': placement.week,
      'Rotation Week': placement.week,
      'Day': placement.day,
      'Weekday': placement.day,
      'Stop': placement.position,
      'Stop Order': placement.position,
      'Order': placement.position
    }));
  });
  writeMaintenanceRouteTable_(state.sheet, table);
  SpreadsheetApp.flush();
  return placements.map(function(item) { return item.layer; }).filter(function(value, index, all) {
    return value && all.indexOf(value) === index;
  });
}

function removePmosWaterMaintenanceRouteRows_(customerId) {
  const state = getPmosWaterMaintenanceRouteState_(customerId);
  if (!state.sheet || !state.table || !state.rows.length) return state.layers;
  const id = String(customerId || '').trim();
  const idIndex = findHeaderIndex_(state.table.headers, ['Customer ID']);
  const layerIndex = findHeaderIndex_(state.table.headers, ['Layer', 'Route Layer', 'Route Assignment']);
  const stopIndexes = pmosCustomerEditorAliasIndexes_(state.table.headers, ['Stop Order', 'Stop', 'Order']);
  const affected = state.layers.slice();
  state.table.rows = state.table.rows.filter(function(row) {
    return String(row[idIndex] || '').trim() !== id;
  });
  affected.forEach(function(layer) {
    let stop = 1;
    state.table.rows.forEach(function(row) {
      if (layerIndex < 0 || String(row[layerIndex] || '').trim() !== layer) return;
      stopIndexes.forEach(function(index) { row[index] = stop; });
      stop++;
    });
  });
  writeMaintenanceRouteTable_(state.sheet, state.table);
  SpreadsheetApp.flush();
  return affected;
}

function writePmosNonMaintenanceLocationFields_(request) {
  const record = getPmosCustomerEditorRow_(request.customerId);
  const values = record.values.slice();
  pmosCustomerEditorSetAliases_(record.headers, values,
    ['Full Address', 'Service Address', 'Address', 'Street Address'], String(request.address || '').trim());
  pmosCustomerEditorSetAliases_(record.headers, values, ['Frequency', 'Service Frequency'], '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['Service Start Date', 'Start Date'], '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['Year Round', 'Year-Round'], '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['Season'], '');
  pmosCustomerEditorSetAliases_(record.headers, values, ['Status'], '');
  const details = request.addressDetails || {};
  if (request.addressVerified === true) {
    [
      [['Street'], details.street],
      [['City'], details.city],
      [['Province', 'State'], details.province],
      [['Postal Code', 'Postal/ZIP Code', 'ZIP Code'], details.postalCode],
      [['Country'], details.country],
      [['Latitude', 'Lat'], Number.isFinite(Number(details.lat)) ? Number(details.lat) : ''],
      [['Longitude', 'Lng', 'Long'], Number.isFinite(Number(details.lng)) ? Number(details.lng) : '']
    ].forEach(function(item) {
      if (item[1] == null) return;
      pmosCustomerEditorSetAliases_(record.headers, values, item[0], item[1]);
    });
  }
  record.sheet.getRange(record.rowNumber, 1, 1, values.length).setValues([values]);
  SpreadsheetApp.flush();
}

function savePmosCustomerAccountEditorDataWithWaterMaintenance(input) {
  const request = Object.assign({}, input || {});
  const customerId = String(request.customerId || '').trim();
  if (!customerId) throw new Error('Customer ID is missing. Reload the editor.');
  const before = getPmosWaterMaintenanceEditorState_(customerId);
  const enabled = request.waterMaintenance === true;

  if (enabled) {
    request.status = /^(active|inactive|paused)$/i.test(String(request.status || ''))
      ? String(request.status).replace(/^./, function(ch) { return ch.toUpperCase(); })
      : 'Active';
    if (!/^(weekly|twice weekly|bi-?weekly|monthly)$/i.test(String(request.frequency || ''))) {
      throw new Error('Choose Weekly, Twice Weekly, Bi-Weekly, or Monthly Water Maintenance.');
    }
    if (!before.enabled) {
      const placements = normalizePmosWaterMaintenanceEditorPlacements_(request);
      if (!placements.length) throw new Error('Select a route recommendation before adding this service location to Water Maintenance.');
      if (request.addressVerified !== true) throw new Error('Confirm the service address before adding Water Maintenance.');
      const routeState = getPmosWaterMaintenanceRouteState_(customerId);
      const snapshot = routeState.sheet ? snapshotMaintenanceSheet_(routeState.sheet) : null;
      try {
        seedPmosExistingCustomerWaterMaintenanceRoutes_(request, placements);
        request.recommendedPlacements = placements;
        request.routeChangeRequested = true;
        request.originalFrequency = '';
        const result = savePmosCustomerAccountEditorDataWithLocationContactsAndBilling(request);
        result.maintenanceTransition = 'ENROLLED';
        result.waterMaintenance = getPmosWaterMaintenanceEditorState_(customerId);
        result.profile = getPmosCustomerAccountProfile(customerId);
        return pmosAccountTerminologyState_(result);
      } catch (error) {
        if (snapshot) rollbackMaintenanceSheetSnapshots_([snapshot]);
        throw error;
      }
    }
    const result = savePmosCustomerAccountEditorDataWithLocationContactsAndBilling(request);
    result.waterMaintenance = getPmosWaterMaintenanceEditorState_(customerId);
    return pmosAccountTerminologyState_(result);
  }

  if (before.enabled && request.maintenanceRemovalConfirmed !== true) {
    throw new Error('Water Maintenance removal was not confirmed. Re-open the editor and confirm the removal before saving.');
  }

  const current = getPmosCustomerEditorRow_(customerId);
  const addressIndex = findHeaderIndex_(current.headers, ['Full Address', 'Service Address', 'Address', 'Street Address']);
  const oldAddress = addressIndex >= 0 ? String(current.values[addressIndex] || '').trim() : '';
  const newAddress = String(request.address || '').trim();
  const addressChanged = normalizePmosAddressSearch_(oldAddress) !== normalizePmosAddressSearch_(newAddress);
  if (addressChanged && (request.addressVerified !== true || !request.addressDetails)) {
    throw new Error('Choose and confirm the new service address before saving.');
  }

  const routeState = getPmosWaterMaintenanceRouteState_(customerId);
  const routeSnapshot = routeState.sheet && before.enabled ? snapshotMaintenanceSheet_(routeState.sheet) : null;
  const affectedLayers = before.enabled ? removePmosWaterMaintenanceRouteRows_(customerId) : [];
  const baseRequest = Object.assign({}, request, {
    address: oldAddress,
    addressVerified: true,
    addressDetails: null,
    routeChangeRequested: false,
    recommendedPlacements: [],
    manualRoute: null,
    originalFrequency: before.frequency || '',
    frequency: before.frequency || '',
    status: before.status || 'Active',
    serviceStartDate: before.serviceStartDate || '',
    yearRound: before.yearRound || 'Seasonal'
  });

  try {
    const result = savePmosCustomerAccountEditorDataWithLocationContactsAndBilling(baseRequest);
    writePmosNonMaintenanceLocationFields_(request);
    if (typeof saveAndSyncPmosServiceLocationContacts_ === 'function') {
      try { saveAndSyncPmosServiceLocationContacts_(customerId, request.serviceLocationContacts || []); } catch (ignored) {}
    }
    if (typeof syncPmosAccountHolderGoogleAddress_ === 'function') {
      try { syncPmosAccountHolderGoogleAddress_(customerId); } catch (ignored) {}
    }
    if (typeof clearPmosCalendarAuditSnapshot_ === 'function') clearPmosCalendarAuditSnapshot_();
    if (before.enabled && affectedLayers.length) {
      schedulePmosWaterMaintenanceRemovalCalendarSync_(customerId, affectedLayers);
      result.calendarStatus = 'SCHEDULED';
      result.maintenanceTransition = 'REMOVED';
    } else {
      result.calendarStatus = 'NOT_REQUIRED';
      result.maintenanceTransition = 'UNCHANGED';
    }
    result.waterMaintenance = getPmosWaterMaintenanceEditorState_(customerId);
    result.profile = getPmosCustomerAccountProfile(customerId);
    return pmosAccountTerminologyState_(result);
  } catch (error) {
    if (routeSnapshot) rollbackMaintenanceSheetSnapshots_([routeSnapshot]);
    throw error;
  }
}

function pmosWaterMaintenanceRemovalKey_(customerId) {
  return PMOS_WATER_MAINTENANCE_REMOVE_PREFIX_ + String(customerId || '').trim();
}

function ensurePmosWaterMaintenanceRemovalTrigger_(delayMs) {
  const exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === PMOS_WATER_MAINTENANCE_REMOVE_HANDLER_;
  });
  if (!exists) {
    ScriptApp.newTrigger(PMOS_WATER_MAINTENANCE_REMOVE_HANDLER_).timeBased()
      .after(Math.max(1000, Number(delayMs || 1000))).create();
  }
}

function removePmosWaterMaintenanceRemovalTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === PMOS_WATER_MAINTENANCE_REMOVE_HANDLER_) ScriptApp.deleteTrigger(trigger);
  });
}

function schedulePmosWaterMaintenanceRemovalCalendarSync_(customerId, affectedLayers) {
  const id = String(customerId || '').trim();
  const layers = (affectedLayers || []).map(function(layer) { return String(layer || '').trim(); })
    .filter(function(layer, index, all) { return layer && all.indexOf(layer) === index; });
  if (!id || !layers.length) return;
  const now = new Date().toISOString();
  PropertiesService.getDocumentProperties().setProperty(pmosWaterMaintenanceRemovalKey_(id), JSON.stringify({
    id: 'WATER_MAINTENANCE_REMOVE_' + Utilities.getUuid(),
    planId: 'WATER_MAINTENANCE_REMOVE_' + id + '_' + Date.now(),
    customerId: id,
    affectedLayers: layers,
    status: 'SCHEDULED',
    processed: 0,
    createdAt: now,
    updatedAt: now,
    lastError: ''
  }));
  ensurePmosWaterMaintenanceRemovalTrigger_(1000);
}

function nextPmosWaterMaintenanceRemovalState_() {
  const properties = PropertiesService.getDocumentProperties().getProperties();
  const keys = Object.keys(properties).filter(function(key) {
    return key.indexOf(PMOS_WATER_MAINTENANCE_REMOVE_PREFIX_) === 0;
  }).sort();
  for (let index = 0; index < keys.length; index++) {
    try {
      const state = JSON.parse(properties[keys[index]]);
      if (state && ['SCHEDULED', 'RUNNING'].indexOf(String(state.status || '')) >= 0) return {key: keys[index], state: state};
    } catch (ignored) {}
  }
  return null;
}

function buildPmosWaterMaintenanceDeleteOperation_(record) {
  const seriesKey = String(record && record.seriesKey || '').trim();
  const seriesId = String(record && record.seriesId || '').trim();
  return {
    id: 'WATER_MAINTENANCE_DELETE|' + seriesKey + '|' + seriesId,
    planner: 'WATER_MAINTENANCE_EDITOR',
    action: PMOS_OPERATION.DELETE,
    entity: PMOS_CALENDAR_SERIES_ENTITY,
    entityId: seriesKey,
    destination: PMOS_CALENDAR_DESTINATION,
    priority: PMOS_OPERATION_PRIORITY.HIGH,
    reason: 'Water Maintenance was explicitly removed for this service location in Customer Editor.',
    payload: {desired: null, current: record},
    metadata: {blocking: false, deletionApproved: true, waterMaintenanceRemoval: true}
  };
}

function executeNextPmosWaterMaintenanceRemoval_(state) {
  const registry = readExistingPmosCalendarRegistry_();
  const id = String(state.customerId || '').trim();
  const layers = Array.isArray(state.affectedLayers) ? state.affectedLayers : [];
  const candidates = Object.keys(registry).map(function(key) { return registry[key]; }).filter(function(record) {
    return String(record.customerId || '').trim() === id && layers.indexOf(String(record.layer || '').trim()) >= 0;
  }).sort(function(left, right) {
    return String(left.seriesKey || '').localeCompare(String(right.seriesKey || ''));
  });
  if (!candidates.length) return {complete: true, deleted: 0, remaining: 0};
  const operation = buildPmosWaterMaintenanceDeleteOperation_(candidates[0]);
  const settings = getRecurringCalendarSettings_();
  const calendar = getExistingConfiguredPmosCalendar_(settings.calendarName);
  const preflight = validateReviewedCalendarSyncPreflight_([operation], calendar, settings.calendarName);
  if (!preflight.valid) throw new Error(preflight.errors.join('\n'));
  executeReviewedCalendarOperation_(operation, {id: state.id, planId: state.planId, calendarName: settings.calendarName});
  return {complete: candidates.length === 1, deleted: 1, remaining: Math.max(0, candidates.length - 1)};
}

function runPmosWaterMaintenanceRemovalSyncWorker_() {
  const scriptLock = LockService.getScriptLock();
  if (!scriptLock.tryLock(1000)) {
    ensurePmosWaterMaintenanceRemovalTrigger_(30000);
    return;
  }
  let item = null;
  try {
    removePmosWaterMaintenanceRemovalTriggers_();
    item = nextPmosWaterMaintenanceRemovalState_();
    if (!item) return;
    const state = item.state;
    state.status = 'RUNNING';
    state.updatedAt = new Date().toISOString();
    PropertiesService.getDocumentProperties().setProperty(item.key, JSON.stringify(state));
    const documentLock = LockService.getDocumentLock();
    if (!documentLock.tryLock(5000)) {
      state.status = 'SCHEDULED';
      PropertiesService.getDocumentProperties().setProperty(item.key, JSON.stringify(state));
      ensurePmosWaterMaintenanceRemovalTrigger_(30000);
      return;
    }
    let outcome;
    try { outcome = executeNextPmosWaterMaintenanceRemoval_(state); }
    finally { documentLock.releaseLock(); }
    state.processed = Number(state.processed || 0) + Number(outcome.deleted || 0);
    state.updatedAt = new Date().toISOString();
    state.lastError = '';
    if (outcome.complete) {
      PropertiesService.getDocumentProperties().deleteProperty(item.key);
    } else {
      state.status = 'SCHEDULED';
      PropertiesService.getDocumentProperties().setProperty(item.key, JSON.stringify(state));
      ensurePmosWaterMaintenanceRemovalTrigger_(30000);
    }
  } catch (error) {
    if (item && item.state) {
      const state = item.state;
      const message = String(error && error.message ? error.message : error);
      const retryable = typeof isTransientReviewedCalendarRateLimit_ === 'function' && isTransientReviewedCalendarRateLimit_(message);
      state.status = retryable ? 'SCHEDULED' : 'ERROR';
      state.lastError = message;
      state.updatedAt = new Date().toISOString();
      PropertiesService.getDocumentProperties().setProperty(item.key, JSON.stringify(state));
      if (retryable) ensurePmosWaterMaintenanceRemovalTrigger_(120000);
    }
  } finally {
    scriptLock.releaseLock();
    if (nextPmosWaterMaintenanceRemovalState_()) ensurePmosWaterMaintenanceRemovalTrigger_(30000);
  }
}

function pmosWaterMaintenanceEditorStyles_() {
  return '.water-maintenance-head{align-items:center}.water-maintenance-title p{margin:3px 0 0;color:#68747a;font-size:10px;line-height:1.4}.water-maintenance-toggle{display:inline-flex;align-items:center;gap:9px;color:#52656e;font-size:10px;font-weight:900;cursor:pointer;user-select:none}.water-maintenance-switch{position:relative;width:44px;height:24px;display:inline-block}.water-maintenance-switch input{position:absolute;opacity:0;width:0;height:0}.water-maintenance-slider{position:absolute;inset:0;border-radius:999px;background:#aebbc1;transition:.18s}.water-maintenance-slider:before{content:"";position:absolute;width:18px;height:18px;left:3px;top:3px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2);transition:.18s}.water-maintenance-switch input:checked+.water-maintenance-slider{background:#0f5470}.water-maintenance-switch input:checked+.water-maintenance-slider:before{transform:translateX(20px)}.water-maintenance-switch input:focus+.water-maintenance-slider{box-shadow:0 0 0 3px rgba(1,125,177,.16)}.water-maintenance-off{padding:13px 16px;color:#68747a;font-size:11px;line-height:1.5}.water-maintenance-state-row{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding-bottom:2px}.water-maintenance-removal-note{display:none;margin:0 16px 14px;padding:9px 11px;border:1px solid #e0c2a5;border-radius:8px;background:#fbf3e8;color:#77522d;font-size:10px;line-height:1.45}.water-maintenance-removal-note.show{display:block}.service-location-editor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:15px}.service-location-editor-grid .wide{grid-column:1/-1}@media(max-width:700px){.water-maintenance-state-row,.service-location-editor-grid{grid-template-columns:1fr}.service-location-editor-grid .wide{grid-column:auto}}';
}

function pmosWaterMaintenanceEditorClientScript_() {
  return String.raw`
var pmosWaterMaintenanceInitial=false,pmosWaterMaintenanceRemovalConfirmed=false,pmosWaterMaintenanceUiBuilt=false;
function pmosWaterField(node){while(node&&node!==document.body){if(node.classList&&node.classList.contains('field'))return node;node=node.parentNode}return null}
function pmosMoveWaterField(id,target,wide){var input=document.getElementById(id),field=pmosWaterField(input);if(!field||!target)return null;if(wide)field.classList.add('wide');else field.classList.remove('wide');target.appendChild(field);return field}
function pmosWrapWaterField(label,node){var field=document.createElement('div');field.className='field';var caption=document.createElement('label');caption.textContent=label;field.appendChild(caption);field.appendChild(node);return field}
function pmosBuildWaterMaintenanceUi(){
  if(pmosWaterMaintenanceUiBuilt)return;pmosWaterMaintenanceUiBuilt=true;
  var status=document.getElementById('customerStatus'),season=document.getElementById('yearRound');if(!status||!season)return;
  var maintenance=status.closest('.section');if(!maintenance)return;maintenance.id='waterMaintenanceSection';
  var head=maintenance.querySelector('.section-head'),grid=maintenance.querySelector('.grid');if(!head||!grid)return;
  var address=document.getElementById('address'),start=document.getElementById('serviceStartDate'),startField=pmosWaterField(start),oldCombined=startField&&startField.parentNode;
  var service=document.createElement('div');service.className='section';service.id='serviceLocationEditorSection';service.innerHTML='<div class="section-head"><h3>Service location</h3></div><div id="serviceLocationEditorGrid" class="service-location-editor-grid"></div>';maintenance.parentNode.insertBefore(service,maintenance);
  var serviceGrid=document.getElementById('serviceLocationEditorGrid');pmosMoveWaterField('address',serviceGrid,true);pmosMoveWaterField('serviceLocationName',serviceGrid,false);pmosMoveWaterField('calendarTitle',serviceGrid,false);
  if(startField){startField.classList.remove('wide');if(oldCombined&&oldCombined!==grid&&oldCombined!==maintenance)grid.insertBefore(startField,grid.firstChild);if(oldCombined&&oldCombined.children.length===0)oldCombined.remove()}
  var stateRow=document.createElement('div');stateRow.className='water-maintenance-state-row';grid.insertBefore(stateRow,grid.firstChild);stateRow.appendChild(pmosWrapWaterField('Maintenance status',status));stateRow.appendChild(pmosWrapWaterField('Service season',season));if(startField)stateRow.appendChild(startField);
  head.classList.add('water-maintenance-head');head.innerHTML='<div class="water-maintenance-title"><h3>Water Maintenance</h3><p>Recurring water-maintenance service for this location.</p></div><label class="water-maintenance-toggle"><span id="waterMaintenanceToggleText">Off</span><span class="water-maintenance-switch"><input id="waterMaintenanceToggle" type="checkbox" role="switch" aria-label="Water Maintenance"><span class="water-maintenance-slider"></span></span></label>';
  var off=document.createElement('div');off.id='waterMaintenanceOffMessage';off.className='water-maintenance-off';off.textContent='This service location is not enrolled in recurring Water Maintenance.';head.insertAdjacentElement('afterend',off);
  var warning=document.createElement('div');warning.id='waterMaintenanceRemovalNote';warning.className='water-maintenance-removal-note';warning.textContent='Water Maintenance will be removed when you save. The customer, service location, contacts, equipment, notes, and history will be retained.';maintenance.appendChild(warning);
  var frequency=document.getElementById('frequency');if(frequency)Array.prototype.slice.call(frequency.options).forEach(function(option){if(String(option.value||option.text||'').toLowerCase()==='on request')option.remove()});
  document.getElementById('waterMaintenanceToggle').addEventListener('change',pmosWaterMaintenanceToggleChanged);
}
function pmosShowWaterMaintenance(enabled){var grid=document.querySelector('#waterMaintenanceSection>.grid'),off=document.getElementById('waterMaintenanceOffMessage'),text=document.getElementById('waterMaintenanceToggleText'),warning=document.getElementById('waterMaintenanceRemovalNote');if(grid)grid.style.display=enabled?'grid':'none';if(off)off.style.display=enabled?'none':'block';if(text)text.textContent=enabled?'On':'Off';if(warning)warning.classList.toggle('show',!enabled&&pmosWaterMaintenanceInitial&&pmosWaterMaintenanceRemovalConfirmed);if(!enabled){var route=document.getElementById('routeBox');if(route)route.style.display='none'}}
function pmosWaterToday(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function pmosWaterMaintenanceToggleChanged(){var toggle=document.getElementById('waterMaintenanceToggle'),enabled=!!toggle.checked;if(!enabled&&pmosWaterMaintenanceInitial){var ok=confirm('Are you sure you want to remove this service location from Water Maintenance?\n\nSaving this change will remove its recurring route schedule and managed recurring Calendar events. The customer, property information, contacts, equipment, notes, and history will be retained.');if(!ok){toggle.checked=true;pmosWaterMaintenanceRemovalConfirmed=false;pmosShowWaterMaintenance(true);return}pmosWaterMaintenanceRemovalConfirmed=true}else if(enabled){pmosWaterMaintenanceRemovalConfirmed=false}pmosShowWaterMaintenance(enabled);if(enabled&&!pmosWaterMaintenanceInitial){var status=document.getElementById('customerStatus'),frequency=document.getElementById('frequency'),start=document.getElementById('serviceStartDate');if(status&&!status.value)status.value='Active';if(frequency&&!frequency.value)frequency.value='Weekly';if(start&&!start.value)start.value=pmosWaterToday();setTimeout(function(){if(typeof changeRoute==='function')changeRoute()},60)}}
function pmosWaterMaintenanceFill(data){fill(data);pmosBuildWaterMaintenanceUi();var state=data&&data.waterMaintenance||{},toggle=document.getElementById('waterMaintenanceToggle');pmosWaterMaintenanceInitial=!!state.enabled;pmosWaterMaintenanceRemovalConfirmed=false;if(toggle)toggle.checked=pmosWaterMaintenanceInitial;if(state.status&&document.getElementById('customerStatus'))document.getElementById('customerStatus').value=state.status;if(state.frequency&&document.getElementById('frequency'))document.getElementById('frequency').value=editorFrequencyValue(state.frequency,data&&data.routes||[]);if(state.serviceStartDate&&document.getElementById('serviceStartDate'))document.getElementById('serviceStartDate').value=state.serviceStartDate;if(document.getElementById('yearRound'))document.getElementById('yearRound').value=state.yearRound||'Seasonal';pmosShowWaterMaintenance(pmosWaterMaintenanceInitial)}
var pmosBaseWaterMaintenancePayload=payload;payload=function(){var data=pmosBaseWaterMaintenancePayload(),toggle=document.getElementById('waterMaintenanceToggle');data.waterMaintenance=!!(toggle&&toggle.checked);data.maintenanceRemovalConfirmed=pmosWaterMaintenanceRemovalConfirmed;if(!data.waterMaintenance){data.status='';data.frequency='';data.serviceStartDate='';data.yearRound=''}return data};
`;
}

function pmosEnhanceCustomerAccountEditorWithWaterMaintenance_(html) {
  let output = String(html || '');
  if (output.indexOf('id="customerStatus"') < 0 || output.indexOf('id="frequency"') < 0) return output;
  if (output.indexOf('PMOS_WATER_MAINTENANCE_EDITOR') >= 0) return output;
  output = output.replace('</style>', pmosWaterMaintenanceEditorStyles_() + '\n</style>');
  output = output.split('.savePmosCustomerAccountEditorDataWithLocationContactsAndBilling(')
    .join('.savePmosCustomerAccountEditorDataWithWaterMaintenance(');
  output = output.split('.getPmosCustomerAccountEditorData(customerId)')
    .join('.getPmosCustomerAccountEditorDataWithWaterMaintenance(customerId)');
  output = output.replace(
    '.withSuccessHandler(fill).withFailureHandler(function(e){setStatus(e&&e.message?e.message:String(e),true)}).getPmosCustomerAccountEditorDataWithWaterMaintenance(customerId)',
    '.withSuccessHandler(pmosWaterMaintenanceFill).withFailureHandler(function(e){setStatus(e&&e.message?e.message:String(e),true)}).getPmosCustomerAccountEditorDataWithWaterMaintenance(customerId)'
  );
  output = output.replace('</script></body></html>',
    '\n/* PMOS_WATER_MAINTENANCE_EDITOR */\n' + pmosWaterMaintenanceEditorClientScript_() + '\n</script></body></html>');
  return output;
}
