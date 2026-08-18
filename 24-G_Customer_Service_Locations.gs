/**
 * PMOS customer service locations.
 *
 * The Customers row remains the account / household record and the primary
 * service location. Additional properties are child service locations keyed by
 * Customer ID + Service Location ID. Route placement, schedule, service state,
 * Calendar identity, entry notes, service notes, and equipment are location-
 * specific. Household contact information remains account-level.
 */

const PMOS_SERVICE_LOCATIONS_SHEET_ = 'PMOS Service Locations';
const PMOS_SERVICE_LOCATION_HEADERS_ = [
  'Customer ID', 'Service Location ID', 'Location Name', 'Calendar Title',
  'Full Address', 'Status', 'Frequency', 'Service Start Date', 'Year Round',
  'Entry Information', 'Customer Notes', 'Address Details JSON', 'Updated At'
];

function ensurePmosServiceLocationInfrastructure_() {
  const ss = SpreadsheetApp.getActive();
  const customerSheet = findFirstSheetByName_(ss, [
    PMOS.CUSTOMERS_SHEET, 'Customers', 'Customer Database', 'Customer List'
  ]);
  const routeSheet = findFirstSheetByName_(ss, [
    PMOS.ROUTES_SHEET, '4-Week Route Template', 'PMOS 4-Week Route Template', 'Route Template'
  ]);
  if (!customerSheet || !routeSheet) {
    throw new Error('Customers or 4-Week Route Template sheet was not found.');
  }

  let customerTable = readPmosHeaderTable_(customerSheet);
  ensureMaintenanceClientHeaders_(customerSheet, customerTable, ['Status']);
  let routeTable = readPmosHeaderTable_(routeSheet);
  ensureMaintenanceClientHeaders_(routeSheet, routeTable, [
    'Customer ID', 'Service Location ID', 'Service Location Name',
    'Calendar Title', 'Full Name(s)', 'Full Address', 'Frequency',
    'Service Start Date', 'Year Round', 'Status', 'Entry Information',
    'Customer Notes', 'Layer', 'Stop Order', 'Map Label'
  ]);

  const locationsSheet = ensurePmosServiceLocationsSheet_(ss);
  const equipmentSheet = ensurePmosServiceLocationEquipmentColumns_(ss);
  return {
    customers: customerSheet,
    routes: routeSheet,
    locations: locationsSheet,
    equipment: equipmentSheet
  };
}

function ensurePmosServiceLocationsSheet_(spreadsheet) {
  const ss = spreadsheet || SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(PMOS_SERVICE_LOCATIONS_SHEET_);
  if (!sheet) sheet = ss.insertSheet(PMOS_SERVICE_LOCATIONS_SHEET_);
  if (sheet.getMaxColumns() < PMOS_SERVICE_LOCATION_HEADERS_.length) {
    sheet.insertColumnsAfter(
      Math.max(1, sheet.getMaxColumns()),
      PMOS_SERVICE_LOCATION_HEADERS_.length - sheet.getMaxColumns()
    );
  }
  const current = sheet.getRange(1, 1, 1, PMOS_SERVICE_LOCATION_HEADERS_.length).getValues()[0];
  PMOS_SERVICE_LOCATION_HEADERS_.forEach(function(header, index) {
    if (String(current[index] || '').trim() !== header) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });
  sheet.setFrozenRows(1);
  if (!sheet.isSheetHidden()) sheet.hideSheet();
  return sheet;
}

function ensurePmosServiceLocationEquipmentColumns_(spreadsheet) {
  const ss = spreadsheet || SpreadsheetApp.getActive();
  const sheet = ensureMaintenanceCustomerEquipmentSheet_(ss);
  if (sheet.getMaxColumns() < 7) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 7 - sheet.getMaxColumns());
  }
  sheet.getRange(1, 6, 1, 2).setValues([['Service Location ID', 'Location Name']]);
  if (!sheet.isSheetHidden()) sheet.hideSheet();
  return sheet;
}

function showPmosServiceLocationSearch() {
  const html = HtmlService.createHtmlOutput(`<!doctype html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{margin:0;padding:18px;font-family:Arial,sans-serif;background:#eef2f4;color:#293944}h2{margin:0 0 5px}.muted{color:#6b7b84;font-size:12px}.search{width:100%;margin-top:16px;padding:11px 12px;border:1px solid #b7c6cc;border-radius:8px;font:inherit}.list{margin-top:10px;max-height:470px;overflow:auto}.row{display:block;width:100%;padding:11px 12px;border:0;border-bottom:1px solid #dbe3e6;background:#fff;text-align:left;cursor:pointer}.row:hover{background:#e7f3f8}.name{font-weight:700}.meta{margin-top:3px;color:#687a83;font-size:11px}
</style></head><body><h2>Service Locations</h2><div class="muted">Choose the customer account that owns the service location.</div><input id="q" class="search" autocomplete="off" placeholder="Find by last name"><div id="list" class="list"></div><script>
var rows=[];function e(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}function render(){var q=String(document.getElementById('q').value||'').toLowerCase(),shown=rows.filter(function(r){return !q||[r.listName,r.displayName,r.address,r.phone].join(' ').toLowerCase().indexOf(q)>=0}).slice(0,80);document.getElementById('list').innerHTML=shown.map(function(r){return '<button class="row" data-id="'+e(r.customerId)+'"><div class="name">'+e(r.listName||r.displayName)+'</div><div class="meta">'+e([r.address,r.phone].filter(Boolean).join(' · '))+'</div></button>'}).join('')||'<div class="muted">No customers found.</div>';Array.prototype.forEach.call(document.querySelectorAll('.row'),function(b){b.onclick=function(){var id=this.dataset.id;google.script.run.withSuccessHandler(function(){setTimeout(function(){google.script.host.close()},250)}).showPmosServiceLocationManager(id)}})}document.getElementById('q').oninput=render;google.script.run.withSuccessHandler(function(data){rows=data||[];render();document.getElementById('q').focus()}).searchPmosCustomerProfiles('');
</script></body></html>`).setWidth(560).setHeight(620);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Service Locations');
}

function showPmosServiceLocationManager(customerId) {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('Select a customer before opening Service Locations.');
  const html = HtmlService.createHtmlOutput(buildPmosServiceLocationManagerHtml_(id))
    .setWidth(1080).setHeight(860);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Service Locations');
}

function getPmosServiceLocationManagerData(customerId) {
  ensurePmosServiceLocationInfrastructure_();
  const id = String(customerId || '').trim();
  const profile = getPmosCustomerProfile(id);
  const primary = {
    customerId: id,
    locationId: 'PRIMARY',
    locationName: 'Primary service location',
    isPrimary: true,
    calendarTitle: profile.calendarTitle || profile.lastName || profile.displayName,
    address: profile.address || '',
    status: profile.status || 'Active',
    frequency: profile.frequency || '',
    serviceStartDate: formatPmosServiceLocationInputDate_(profile.serviceStartDate),
    yearRound: /yes|year round/i.test(String(profile.yearRound || '')) ? 'Year Round' : 'Seasonal',
    entryInformation: profile.entryInformation || '',
    notes: profile.notes || '',
    routes: profile.routes || [],
    bodiesOfWater: profile.bodiesOfWater || []
  };
  const locations = readPmosAdditionalServiceLocations_(id).map(function(location) {
    const equipment = readPmosServiceLocationEquipment_(id, location.locationId);
    location.routes = readPmosCustomerProfileRoutes_(id, location.locationId);
    location.bodiesOfWater = equipment.bodies;
    location.equipmentSummary = equipment.summary;
    return location;
  });
  return {
    customerId: id,
    displayName: profile.displayName,
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    phone: profile.phone || '',
    email: profile.email || '',
    primary: primary,
    locations: locations,
    defaultYearRound: primary.yearRound
  };
}

function readPmosAdditionalServiceLocations_(customerId) {
  const sheet = ensurePmosServiceLocationsSheet_(SpreadsheetApp.getActive());
  if (sheet.getLastRow() < 2) return [];
  const table = readPmosHeaderTable_(sheet);
  const value = function(row, aliases) {
    const index = findHeaderIndex_(table.headers, aliases);
    return index >= 0 ? row[index] : '';
  };
  const id = String(customerId || '').trim().toUpperCase();
  return table.rows.filter(function(row) {
    return String(value(row, ['Customer ID']) || '').trim().toUpperCase() === id;
  }).map(function(row) {
    let details = null;
    const rawDetails = String(value(row, ['Address Details JSON']) || '').trim();
    if (rawDetails) {
      try { details = JSON.parse(rawDetails); } catch (ignored) { details = null; }
    }
    return {
      customerId: String(value(row, ['Customer ID']) || '').trim(),
      locationId: String(value(row, ['Service Location ID']) || '').trim(),
      locationName: String(value(row, ['Location Name']) || '').trim(),
      isPrimary: false,
      calendarTitle: String(value(row, ['Calendar Title']) || '').trim(),
      address: String(value(row, ['Full Address']) || '').trim(),
      status: String(value(row, ['Status']) || 'Active').trim() || 'Active',
      frequency: String(value(row, ['Frequency']) || '').trim(),
      serviceStartDate: formatPmosServiceLocationInputDate_(value(row, ['Service Start Date'])),
      yearRound: String(value(row, ['Year Round']) || 'Seasonal').trim() || 'Seasonal',
      entryInformation: String(value(row, ['Entry Information']) || '').trim(),
      notes: String(value(row, ['Customer Notes']) || '').trim(),
      addressDetails: details
    };
  }).sort(function(left, right) {
    return left.locationName.localeCompare(right.locationName) || left.locationId.localeCompare(right.locationId);
  });
}

function getPmosCustomerServiceLocationsForProfile_(customerId) {
  return readPmosAdditionalServiceLocations_(customerId).map(function(location) {
    location.routes = readPmosCustomerProfileRoutes_(customerId, location.locationId);
    const equipment = readPmosServiceLocationEquipment_(customerId, location.locationId);
    location.equipmentSummary = equipment.summary;
    location.bodiesOfWater = equipment.bodies;
    return location;
  });
}

function formatPmosServiceLocationInputDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, PMOS.TIMEZONE, 'yyyy-MM-dd');
  }
  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return text;
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? '' : Utilities.formatDate(parsed, PMOS.TIMEZONE, 'yyyy-MM-dd');
}

function readPmosServiceLocationEquipment_(customerId, locationId) {
  const sheet = ensurePmosServiceLocationEquipmentColumns_(SpreadsheetApp.getActive());
  if (sheet.getLastRow() < 2) return {summary: '', bodies: []};
  const values = sheet.getDataRange().getValues();
  const id = String(customerId || '').trim();
  const loc = String(locationId || '').trim();
  for (let index = 1; index < values.length; index++) {
    if (String(values[index][0] || '').trim() !== id) continue;
    if (String(values[index][5] || '').trim() !== loc) continue;
    const summary = String(values[index][2] || '').trim();
    const json = String(values[index][3] || '').trim();
    if (!json) return {summary: summary, bodies: []};
    try {
      const parsed = JSON.parse(json);
      return {summary: summary, bodies: Array.isArray(parsed.bodies) ? parsed.bodies : []};
    } catch (ignored) {
      return {summary: summary, bodies: []};
    }
  }
  return {summary: '', bodies: []};
}

function nextPmosServiceLocationId_(customerId, locations) {
  const prefix = String(customerId || '').trim() + '-L';
  let max = 1;
  (locations || readPmosAdditionalServiceLocations_(customerId)).forEach(function(location) {
    const match = String(location.locationId || '').match(/-L(\d+)$/i);
    if (match) max = Math.max(max, Number(match[1] || 0));
  });
  return prefix + String(max + 1).padStart(2, '0');
}

function normalizePmosServiceLocationStatus_(value) {
  const clean = String(value || 'Active').trim().toLowerCase();
  if (clean === 'inactive') return 'Inactive';
  if (clean === 'paused') return 'Paused';
  return 'Active';
}

function displayPmosServiceLocationFrequency_(value) {
  const clean = normalizeMaintenanceFrequency_(value || 'Weekly');
  if (clean === 'Biweekly') return 'Bi-Weekly';
  return clean;
}

function savePmosServiceLocation(input) {
  const request = input || {};
  const customerId = String(request.customerId || '').trim();
  if (!customerId) throw new Error('Customer ID is missing. Reopen Service Locations.');
  const infrastructure = ensurePmosServiceLocationInfrastructure_();
  const existingLocations = readPmosAdditionalServiceLocations_(customerId);
  let locationId = String(request.locationId || '').trim();
  const existing = locationId ? existingLocations.find(function(item) {
    return item.locationId === locationId;
  }) : null;
  if (locationId && !existing) throw new Error('That service location no longer exists. Reload the customer.');

  const locationName = String(request.locationName || '').trim();
  if (!locationName) throw new Error('Enter a location name. Additional service locations require a custom name.');
  const duplicateName = existingLocations.some(function(item) {
    return item.locationId !== locationId && normalize_(item.locationName) === normalize_(locationName);
  });
  if (duplicateName) throw new Error('This customer already has a service location named ' + locationName + '.');

  const address = String(request.address || '').trim();
  if (!address) throw new Error('Enter the service address.');
  const frequency = displayPmosServiceLocationFrequency_(request.frequency || 'Weekly');
  const status = normalizePmosServiceLocationStatus_(request.status);
  const serviceStartDate = parsePmosCustomerEditorDate_(request.serviceStartDate);
  const yearRound = /year round|yes/i.test(String(request.yearRound || '')) ? 'Year Round' : 'Seasonal';
  const addressChanged = !existing || normalizePmosAddressSearch_(existing.address) !== normalizePmosAddressSearch_(address);
  const frequencyChanged = !existing || normalize_(existing.frequency) !== normalize_(frequency);
  const routeChangeRequested = request.routeChangeRequested === true || addressChanged || frequencyChanged;
  if (addressChanged && (request.addressVerified !== true || !request.addressDetails)) {
    throw new Error('Choose and confirm the complete service address before saving.');
  }

  let placements = Array.isArray(request.recommendedPlacements) ? request.recommendedPlacements : [];
  if (placements.length && placements[0] && placements[0].manual === true) {
    placements = buildPmosCustomerEditorManualPlacements_(frequency, placements[0]);
  }
  if (routeChangeRequested && !placements.length) {
    throw new Error('Select a route recommendation or manual route placement before saving.');
  }

  if (!locationId) locationId = nextPmosServiceLocationId_(customerId, existingLocations);
  const bodies = normalizePmosCustomerEditorBodies_(request.bodiesOfWater);
  const equipmentValues = buildPmosCustomerEditorEquipmentValues_(bodies, customerId, locationName);
  const profile = getPmosCustomerProfile(customerId);
  const record = {
    customerId: customerId,
    locationId: locationId,
    locationName: locationName,
    calendarTitle: locationName,
    address: address,
    status: status,
    frequency: frequency,
    serviceStartDate: serviceStartDate,
    yearRound: yearRound,
    entryInformation: String(request.entryInformation || '').trim(),
    notes: String(request.notes || '').trim(),
    addressDetails: request.addressDetails || (existing && existing.addressDetails) || null,
    fullName: profile.displayName || [profile.firstName, profile.lastName].filter(Boolean).join(' '),
    bodiesOfWater: bodies,
    equipmentValues: equipmentValues
  };

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  const snapshots = [
    snapshotMaintenanceSheet_(infrastructure.locations),
    snapshotMaintenanceSheet_(infrastructure.routes),
    snapshotMaintenanceSheet_(infrastructure.equipment)
  ];
  let affectedLayers = [];
  try {
    upsertPmosServiceLocationRecord_(infrastructure.locations, record);
    affectedLayers = writePmosServiceLocationRouteRows_(
      infrastructure.routes,
      record,
      routeChangeRequested ? placements : null
    );
    upsertPmosServiceLocationEquipment_(infrastructure.equipment, record);
    SpreadsheetApp.flush();
    if (typeof normalizeRoutesFromPhysicalOrder_ === 'function') normalizeRoutesFromPhysicalOrder_(false);
    if (typeof clearPmosCalendarAuditSnapshot_ === 'function') clearPmosCalendarAuditSnapshot_();
  } catch (error) {
    rollbackMaintenanceSheetSnapshots_(snapshots);
    throw error;
  } finally {
    lock.releaseLock();
  }

  let calendarStatus = 'NOT_REQUIRED';
  if (affectedLayers.length && typeof scheduleAddedMaintenanceCustomerCalendarSync_ === 'function') {
    try {
      scheduleAddedMaintenanceCustomerCalendarSync_(customerId, affectedLayers);
      calendarStatus = 'SCHEDULED';
    } catch (error) {
      calendarStatus = 'SYNC_ERROR: ' + (error && error.message ? error.message : String(error));
    }
  }
  return {
    saved: true,
    customerId: customerId,
    locationId: locationId,
    calendarStatus: calendarStatus,
    managerData: getPmosServiceLocationManagerData(customerId)
  };
}

function upsertPmosServiceLocationRecord_(sheet, record) {
  const table = readPmosHeaderTable_(sheet);
  const idIndex = findHeaderIndex_(table.headers, ['Customer ID']);
  const locationIndex = findHeaderIndex_(table.headers, ['Service Location ID']);
  let rowNumber = 0;
  table.rows.forEach(function(row, index) {
    if (String(row[idIndex] || '').trim() === record.customerId &&
        String(row[locationIndex] || '').trim() === record.locationId) {
      rowNumber = table.headerRow + index + 1;
    }
  });
  const values = new Array(table.headers.length).fill('');
  const map = {
    'Customer ID': record.customerId,
    'Service Location ID': record.locationId,
    'Location Name': record.locationName,
    'Calendar Title': record.calendarTitle,
    'Full Address': record.address,
    'Status': record.status,
    'Frequency': record.frequency,
    'Service Start Date': record.serviceStartDate,
    'Year Round': record.yearRound,
    'Entry Information': record.entryInformation,
    'Customer Notes': record.notes,
    'Address Details JSON': record.addressDetails ? JSON.stringify(record.addressDetails) : '',
    'Updated At': new Date()
  };
  table.headers.forEach(function(header, index) {
    if (Object.prototype.hasOwnProperty.call(map, header)) values[index] = map[header];
  });
  if (!rowNumber) rowNumber = Math.max(2, sheet.getLastRow() + 1);
  sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
  sheet.getRange(rowNumber, 1, 1, values.length).setWrap(false);
  sheet.setRowHeight(rowNumber, 21);
  if (!sheet.isSheetHidden()) sheet.hideSheet();
}

function pmosServiceLocationSetRouteValue_(headers, row, aliases, value) {
  const normalized = aliases.map(normalizeSyncHeader_);
  headers.forEach(function(header, index) {
    if (normalized.indexOf(normalizeSyncHeader_(header)) >= 0) row[index] = value;
  });
}

function applyPmosServiceLocationRouteFields_(headers, row, record) {
  pmosServiceLocationSetRouteValue_(headers, row, ['Customer ID'], record.customerId);
  pmosServiceLocationSetRouteValue_(headers, row, ['Service Location ID'], record.locationId);
  pmosServiceLocationSetRouteValue_(headers, row, ['Service Location Name'], record.locationName);
  pmosServiceLocationSetRouteValue_(headers, row, ['Calendar Title'], record.calendarTitle);
  pmosServiceLocationSetRouteValue_(headers, row, ['Full Name(s)', 'Full Name'], record.fullName);
  pmosServiceLocationSetRouteValue_(headers, row, ['Full Address', 'Service Address', 'Address'], record.address);
  pmosServiceLocationSetRouteValue_(headers, row, ['Frequency', 'Service Frequency'], record.frequency);
  pmosServiceLocationSetRouteValue_(headers, row, ['Service Start Date', 'Start Date'], record.serviceStartDate);
  pmosServiceLocationSetRouteValue_(headers, row, ['Year Round', 'Year-Round', 'Season'], record.yearRound);
  pmosServiceLocationSetRouteValue_(headers, row, ['Status'], record.status);
  pmosServiceLocationSetRouteValue_(headers, row, ['Entry Information', 'Entry Notes'], record.entryInformation);
  pmosServiceLocationSetRouteValue_(headers, row, ['Customer Notes', 'Notes'], record.notes);
  return row;
}

function writePmosServiceLocationRouteRows_(sheet, record, placements) {
  const table = readPmosHeaderTable_(sheet);
  const idIndex = findHeaderIndex_(table.headers, ['Customer ID']);
  const locationIndex = findHeaderIndex_(table.headers, ['Service Location ID']);
  const layerIndex = findHeaderIndex_(table.headers, ['Layer', 'Route Layer', 'Route Assignment']);
  const stopIndex = findHeaderIndex_(table.headers, ['Stop Order', 'Stop', 'Order']);
  if (idIndex < 0 || locationIndex < 0 || layerIndex < 0 || stopIndex < 0) {
    throw new Error('Route Template is missing service-location routing columns.');
  }
  const matches = function(row) {
    return String(row[idIndex] || '').trim() === record.customerId &&
      String(row[locationIndex] || '').trim() === record.locationId;
  };
  const oldRows = table.rows.filter(matches);
  const affected = oldRows.map(function(row) { return String(row[layerIndex] || '').trim(); }).filter(Boolean);
  let after = {headers: table.headers.slice(), headerRow: table.headerRow, rows: table.rows.map(function(row) { return row.slice(); })};

  if (placements) {
    after.rows = after.rows.filter(function(row) { return !matches(row); });
    (placements || []).forEach(function(placement) {
      const layer = String(placement.layer || '').trim();
      const position = Math.max(1, Math.floor(Number(placement.position || 1)));
      if (!layer) throw new Error('A selected route placement is missing its Route Template layer.');
      const row = new Array(after.headers.length).fill('');
      applyPmosServiceLocationRouteFields_(after.headers, row, record);
      row[layerIndex] = layer;
      row[stopIndex] = position;
      insertMaintenanceRouteRow_(after, row, layer, position);
      affected.push(layer);
    });
  } else {
    after.rows = after.rows.map(function(row) {
      if (!matches(row)) return row;
      return applyPmosServiceLocationRouteFields_(after.headers, row.slice(), record);
    });
  }

  writeMaintenanceRouteTable_(sheet, after);
  return affected.filter(function(value, index, all) {
    return value && all.indexOf(value) === index;
  });
}

function upsertPmosServiceLocationEquipment_(sheet, record) {
  const values = sheet.getDataRange().getValues();
  let rowNumber = 0;
  for (let index = 1; index < values.length; index++) {
    if (String(values[index][0] || '').trim() !== record.customerId) continue;
    if (String(values[index][5] || '').trim() !== record.locationId) continue;
    rowNumber = index + 1;
    break;
  }
  if (!rowNumber) rowNumber = Math.max(2, sheet.getLastRow() + 1);
  sheet.getRange(rowNumber, 1, 1, 7).setValues([[
    record.customerId,
    record.calendarTitle,
    record.equipmentValues.summary,
    record.equipmentValues.detailsJson,
    new Date(),
    record.locationId,
    record.locationName
  ]]);
  sheet.getRange(rowNumber, 1, 1, 7).setWrap(false);
  sheet.setRowHeight(rowNumber, 21);
  if (!sheet.isSheetHidden()) sheet.hideSheet();
}

function buildPmosServiceLocationManagerHtml_(customerId) {
  const idJson = JSON.stringify(customerId);
  return `<!doctype html><html><head><base target="_top"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;700;900&display=swap" rel="stylesheet"><style>
*{box-sizing:border-box}body{margin:0;background:#e5eaed;color:#293944;font-family:Mulish,Arial,sans-serif}.top{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;background:#566a76;color:#fff}.title{font-size:20px;font-weight:900}.sub{margin-top:3px;color:#d9e2e6;font-size:11px}.layout{height:720px;display:grid;grid-template-columns:280px 1fr}.sidebar{overflow:auto;padding:14px;background:#edf1f3;border-right:1px solid #cad5da}.sidebar-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.sidebar-head b{font-size:13px}.add-location{padding:7px 9px;border:1px solid #0f5470;border-radius:7px;background:#0f5470;color:#fff;font-weight:900;cursor:pointer}.location-card{width:100%;margin-bottom:8px;padding:11px;border:1px solid #d0d9dd;border-radius:9px;background:#fff;color:#293944;text-align:left;cursor:pointer}.location-card.selected{border-color:#017db1;background:#eaf6fb}.location-card.primary{cursor:default}.location-name{font-size:12px;font-weight:900}.location-meta{margin-top:4px;color:#687a83;font-size:10px;line-height:1.4}.main{overflow:auto;padding:16px 20px 100px}.empty{padding:48px;text-align:center;color:#6f7d84}.section{margin-bottom:14px;border:1px solid #d0d9dd;border-radius:10px;background:#f9fafb}.section-head{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:1px solid #e1e7e9}.section-head h3{margin:0;font-size:13px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;padding:14px}.wide{grid-column:1/-1}.field label{display:block;margin-bottom:5px;color:#6f7d84;font-size:10px;font-weight:900;letter-spacing:.07em;text-transform:uppercase}.field input,.field select,.field textarea{width:100%;padding:9px 10px;border:1px solid #bfcbd1;border-radius:7px;background:#fff;color:#293944;font:inherit}.field textarea{min-height:78px;resize:vertical}.address-wrap{position:relative}.address-list{display:none;position:absolute;z-index:50;left:0;right:0;top:100%;max-height:220px;overflow:auto;background:#fff;border:1px solid #94a3b8;border-radius:0 0 8px 8px;box-shadow:0 9px 20px rgba(15,23,42,.16)}.address-option{display:block;width:100%;padding:9px;border:0;border-bottom:1px solid #e2e8f0;background:#fff;text-align:left;cursor:pointer}.address-option:hover{background:#e4f2f8}.confirmed{display:none;margin-top:7px;padding:7px 9px;border:1px solid #86efac;border-radius:7px;background:#ecfdf5;color:#166534;font-size:11px}.route-box{padding:12px}.route-message{color:#60717a;font-size:11px}.recommendations{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.rec{padding:10px;border:2px solid #d8e7ed;border-radius:9px;background:#fff;text-align:left;cursor:pointer}.rec.selected{border-color:#017db1;background:#eaf6fb}.rec-title{display:flex;justify-content:space-between;gap:6px;font-size:11px;font-weight:900}.rec-meta{margin-top:5px;color:#60717a;font-size:10px;line-height:1.45}.link{padding:0;border:0;background:transparent;color:#017db1;font-weight:900;cursor:pointer}.manual{display:none;margin-top:10px;padding:10px;border:1px solid #cedce2;border-radius:8px;background:#fff}.footer{position:fixed;left:280px;right:0;bottom:0;display:flex;align-items:center;gap:8px;padding:13px 20px;border-top:1px solid #cbd5da;background:rgba(247,249,250,.97)}.action{padding:9px 14px;border:1px solid #0f5470;border-radius:7px;background:#fff;color:#0f5470;font-weight:900;cursor:pointer}.primary-action{background:#0f5470;color:#fff}.primary-action.saving{background:#8dc4dc;border-color:#8dc4dc;color:#24485a}.primary-action.complete{background:#cfe8d8;border-color:#cfe8d8;color:#315c43}.status{margin-left:auto;color:#687a83;font-size:11px}.error{color:#9b3030}${pmosCustomerEquipmentEditorStyles_()}@media(max-width:780px){.layout{grid-template-columns:1fr}.sidebar{max-height:220px}.footer{left:0}.grid,.recommendations{grid-template-columns:1fr}}
</style></head><body><div class="top"><div><div class="title">Service Locations</div><div id="heading" class="sub">Loading customer…</div></div><img src="https://www.finnpools.ca/images/logo_only.png" alt="Finn Pools" style="width:38px;height:38px;object-fit:contain"></div><div class="layout"><aside class="sidebar"><div class="sidebar-head"><b>Locations</b><button id="addLocation" class="add-location" type="button">+ Add</button></div><div id="locationList"></div></aside><main class="main"><div id="empty" class="empty">Select a service location, or add another property to this customer account.</div><div id="editor" style="display:none"><div class="section"><div class="section-head"><h3>Service location</h3><select id="locationStatus" style="padding:6px 8px;border:1px solid #b7c6cc;border-radius:7px"><option>Active</option><option>Inactive</option><option>Paused</option></select></div><div class="grid"><div class="field"><label>Location name</label><input id="locationName" placeholder="e.g. Cottage, Rental, Parents' House"></div><div class="field"><label>Frequency</label><select id="frequency"><option>Weekly</option><option>Twice Weekly</option><option>Bi-Weekly</option><option>Monthly</option></select></div><div class="field wide"><label>Service address</label><div class="address-wrap"><input id="address" autocomplete="off"><div id="addressList" class="address-list"></div></div><div id="confirmedAddress" class="confirmed"></div></div><div class="field"><label>Service start</label><input id="serviceStartDate" type="date"></div><div class="field"><label>Season</label><select id="yearRound"><option>Seasonal</option><option>Year Round</option></select></div></div></div><div class="section"><div class="section-head"><h3>Route placement</h3><button id="changeRoute" class="link" type="button">Change route</button></div><div class="route-box"><div id="routeSummary" class="route-message"></div><div id="routeMessage" class="route-message" style="margin-top:5px"></div><div id="recommendations" class="recommendations"></div><button id="manualToggle" type="button" class="link" style="margin-top:10px">Select route placement manually</button><div id="manualPanel" class="manual"><div class="grid" style="padding:0"><div class="field"><label>Service day</label><select id="manualDay"><option value="">Select</option><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></select></div><div id="secondDayField" class="field" style="display:none"><label>Second service day</label><select id="manualSecondDay"><option value="">Select</option><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></select></div><div id="weekField" class="field"><label>Rotation week</label><select id="manualWeek"><option value="1">Week 1</option><option value="2">Week 2</option><option value="3">Week 3</option><option value="4">Week 4</option></select></div><div class="field"><label>Stop position</label><input id="manualStop" type="number" min="1" value="1"></div><button id="applyManual" type="button" class="action" style="align-self:end">Use Manual Placement</button></div></div></div></div><div class="section"><div class="section-head"><h3>Property information</h3></div><div class="grid"><div class="field"><label>Entry information</label><textarea id="entryInformation"></textarea></div><div class="field"><label>Customer / service notes</label><textarea id="notes"></textarea></div></div></div><div class="section"><div class="section-head"><h3>Bodies of water & equipment</h3></div><div id="waterBodies" class="water-bodies"></div><button id="addBodyButton" type="button" class="inline-button add-body">+ Add Another Body of Water</button></div></div><div id="primaryView" style="display:none"><div class="section"><div class="section-head"><h3>Primary service location</h3></div><div id="primaryDetails" class="grid"></div></div><button id="editPrimary" class="action primary-action" type="button">Edit Primary Location</button></div></main></div><div class="footer"><button id="saveLocation" class="action primary-action" type="button" style="display:none">Save Service Location</button><button id="close" class="action" type="button">Close</button><span id="status" class="status"></span></div><script>
var customerId=${idJson},data=null,current=null,originalAddress='',selectedAddress=null,selectedPlacements=[],routeChangeRequested=false,addressTimer=null,addressRequest=0,routeRequest=0;function el(id){return document.getElementById(id)}function msg(text,error){el('status').textContent=text||'';el('status').className='status'+(error?' error':'')}
${pmosCustomerEquipmentEditorScript_()}
function setEquipmentField(root,selector,value){var input=root.querySelector(selector);if(!input)return;if(input.type==='checkbox')input.checked=!!value;else input.value=value==null?'':value}function hydrateBodies(bodies){var root=el('waterBodies');root.innerHTML='';(bodies&&bodies.length?bodies:[{name:'Pool',type:'Pool',location:'Outdoor',pump:{},filter:{},heater:{},cover:{},equipment:[]}]).forEach(function(body){addWaterBody(body.name||body.type);prepareWaterBodyOptions(root);var cards=root.querySelectorAll('.water-body'),card=cards[cards.length-1],map={name:body.name||body.type,location:body.location,sanitization:body.sanitization,spaType:body.spaType,equipmentSetup:body.equipmentSetup,unitMake:body.unitMake,unitModel:body.unitModel,pumpMake:body.pump&&body.pump.make,pumpModel:body.pump&&body.pump.model,pumpModelNumber:body.pump&&body.pump.modelNumber,filterType:body.filter&&body.filter.type,filterMake:body.filter&&body.filter.make,filterModel:body.filter&&(body.filter.model||body.filter.size),cartridgeSetNumber:body.filter&&body.filter.cartridgeSetNumber,heaterType:body.heater&&body.heater.type,heaterMake:body.heater&&body.heater.make,heaterModel:body.heater&&body.heater.model,heaterModelNumber:body.heater&&body.heater.modelNumber,coverType:body.cover&&body.cover.type,winterCoverType:body.cover&&body.cover.winterType};Object.keys(map).forEach(function(key){setEquipmentField(card,'[data-body-field="'+key+'"]',map[key])});bodyTypeChanged(card.querySelector('[data-body-field="name"]'));var filterType=card.querySelector('[data-body-field="filterType"]');if(filterType)updateFilterModels(filterType);var sanitization=card.querySelector('[data-body-field="sanitization"]');if(sanitization){sanitization.value=body.sanitization||'';renderPrimarySanitizer(sanitization)};(body.equipment||[]).forEach(function(item){var details=item.details||{},target;if(item.type==='CHEMISTRY_AUTOMATION'){target=card.querySelector('[data-body-field="chemistryEnabled"]');target.checked=true;toggleChemistryAutomation(target);setEquipmentField(card,'[data-body-field="chemistryMake"]',details.make||details.manufacturer);setEquipmentField(card,'[data-body-field="chemistryModel"]',details.model);return}if(item.type==='EQUIPMENT_AUTOMATION'){target=card.querySelector('[data-body-field="automationEnabled"]');target.checked=true;toggleEquipmentAutomation(target);setEquipmentField(card,'[data-body-field="automationMake"]',details.manufacturer||details.make);setEquipmentField(card,'[data-body-field="automationModel"]',details.model);return}var primary=card.querySelector('.primary-sanitizer-card[data-equipment-type="'+item.type+'"]');if(primary)target=primary;else{addEquipment(card,item.type,details);var added=card.querySelectorAll('.equipment-card[data-equipment-type="'+item.type+'"]');target=added[added.length-1]}if(target){Object.keys(details).forEach(function(key){var field=target.querySelector('[data-equipment-field="'+key+'"]');if(field)field.type==='checkbox'?field.checked=/yes|true/i.test(String(details[key])):field.value=details[key]==null?'':details[key]});if(item.type==='FILTER'){var addedFilterType=target.querySelector('[data-equipment-field="filterType"]');if(addedFilterType)updateAddedFilterModels(addedFilterType)}}});hideAddPromptOptions(card)})})}
function routeSummary(routes){var groups={};(routes||[]).forEach(function(r){var key=[r.day||'',r.routeArea||''].join('|');if(!groups[key])groups[key]={day:r.day||'',area:r.routeArea||'',weeks:[]};if(r.week&&groups[key].weeks.indexOf(r.week)<0)groups[key].weeks.push(r.week)});return Object.keys(groups).map(function(key){var g=groups[key],weeks=g.weeks.sort(function(a,b){return a-b});return [g.day,g.area?'→ '+g.area:'',weeks.length===4?'Weeks 1–4':weeks.length?'Week'+(weeks.length>1?'s ':' ')+weeks.join(' & '):''].filter(Boolean).join(' ')}).join(' · ')}
function renderList(){var list=[data.primary].concat(data.locations||[]);el('locationList').innerHTML=list.map(function(loc){return '<button type="button" class="location-card'+(loc.isPrimary?' primary':'')+(current&&current.locationId===loc.locationId?' selected':'')+'" data-id="'+esc(loc.locationId)+'"><div class="location-name">'+esc(loc.isPrimary?'Primary · '+(loc.calendarTitle||data.lastName):loc.locationName)+'</div><div class="location-meta">'+esc(loc.address||'')+'</div><div class="location-meta">'+esc([loc.frequency,loc.status].filter(Boolean).join(' · '))+'</div></button>'}).join('');Array.prototype.forEach.call(el('locationList').querySelectorAll('.location-card'),function(button){button.onclick=function(){var id=this.dataset.id;if(id==='PRIMARY')showPrimary();else editLocation((data.locations||[]).find(function(x){return x.locationId===id}))}})}
function showPrimary(){current=data.primary;renderList();el('empty').style.display='none';el('editor').style.display='none';el('primaryView').style.display='block';el('saveLocation').style.display='none';el('primaryDetails').innerHTML='<div class="field"><label>Address</label><div>'+esc(data.primary.address||'')+'</div></div><div class="field"><label>Schedule</label><div>'+esc([data.primary.frequency,routeSummary(data.primary.routes)].filter(Boolean).join(' · '))+'</div></div><div class="field"><label>Status</label><div>'+esc(data.primary.status||'Active')+'</div></div><div class="field"><label>Calendar title</label><div>'+esc(data.primary.calendarTitle||'')+'</div></div>'}
function today(){var d=new Date(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return d.getFullYear()+'-'+m+'-'+day}function newLocation(){editLocation({locationId:'',locationName:'',address:'',status:'Active',frequency:'Weekly',serviceStartDate:today(),yearRound:data.defaultYearRound||'Seasonal',entryInformation:'',notes:'',routes:[],bodiesOfWater:[]})}
function editLocation(loc){current=loc||{};renderList();el('empty').style.display='none';el('primaryView').style.display='none';el('editor').style.display='block';el('saveLocation').style.display='inline-block';el('locationName').value=current.locationName||'';el('locationStatus').value=current.status||'Active';el('frequency').value=current.frequency||'Weekly';el('address').value=current.address||'';el('serviceStartDate').value=current.serviceStartDate||'';el('yearRound').value=/year round|yes/i.test(current.yearRound||'')?'Year Round':'Seasonal';el('entryInformation').value=current.entryInformation||'';el('notes').value=current.notes||'';originalAddress=current.address||'';selectedAddress=current.addressDetails||null;selectedPlacements=[];routeChangeRequested=!current.locationId;el('confirmedAddress').style.display=selectedAddress?'block':'none';el('confirmedAddress').textContent=selectedAddress?'Confirmed: '+(selectedAddress.address||current.address):'';el('recommendations').innerHTML='';el('routeSummary').textContent=current.routes&&current.routes.length?'Current: '+routeSummary(current.routes):'No current route placement.';el('routeMessage').textContent=current.locationId?'Use Change route only when this location needs to move.':'Choose a complete address to calculate route placement.';hydrateBodies(current.bodiesOfWater||[]);configureManual()}
function addressChanged(){return String(el('address').value||'').toLowerCase().replace(/[^a-z0-9]/g,'')!==String(originalAddress||'').toLowerCase().replace(/[^a-z0-9]/g,'')}function queueAddress(){clearTimeout(addressTimer);var q=el('address').value.trim(),request=++addressRequest;if(q.length<3){el('addressList').style.display='none';return}if(addressChanged()){selectedAddress=null;selectedPlacements=[];routeChangeRequested=true;el('confirmedAddress').style.display='none'}addressTimer=setTimeout(function(){google.script.run.withSuccessHandler(function(items){if(request!==addressRequest)return;var list=el('addressList');list.innerHTML='';(items||[]).forEach(function(item){var b=document.createElement('button');b.type='button';b.className='address-option';b.textContent=item.address;b.onmousedown=function(e){e.preventDefault();confirmAddress(item)};list.appendChild(b)});list.style.display=items&&items.length?'block':'none'}).withFailureHandler(function(e){msg(e&&e.message?e.message:String(e),true)}).suggestPmosAddresses(q,6)},160)}function confirmAddress(item){el('addressList').style.display='none';el('routeMessage').textContent='Confirming address…';google.script.run.withSuccessHandler(function(confirmed){selectedAddress=confirmed;el('address').value=confirmed.address;el('confirmedAddress').textContent='Confirmed: '+confirmed.address;el('confirmedAddress').style.display='block';routeChangeRequested=true;loadRoutes()}).withFailureHandler(function(e){msg(e&&e.message?e.message:String(e),true)}).confirmPmosSelectedAddress(item)}
function routeShards(frequency){var f=String(frequency||'').toLowerCase();if(f.indexOf('monthly')>=0)return[{start:0,count:5},{start:5,count:5},{start:10,count:5},{start:15,count:5}];if(f.indexOf('bi')>=0)return[{start:0,count:5},{start:5,count:5}];if(f.indexOf('twice')>=0)return[{start:0,count:2},{start:2,count:2},{start:4,count:2},{start:6,count:2},{start:8,count:2}];return[{start:0,count:1},{start:1,count:1},{start:2,count:1},{start:3,count:1},{start:4,count:1}]}function compareRoutes(a,b){if(!!a.roadDataComplete!==!!b.roadDataComplete)return a.roadDataComplete?-1:1;var ad=a.addedDurationMinutes==null?1e9:Number(a.addedDurationMinutes),bd=b.addedDurationMinutes==null?1e9:Number(b.addedDurationMinutes);return ad-bd||Number(a.addedDistanceKm||0)-Number(b.addedDistanceKm||0)||Number(b.score||0)-Number(a.score||0)}function loadRoutes(){if(!selectedAddress)return;var token=++routeRequest,shards=routeShards(el('frequency').value),done=0,results=[],errors=0;el('recommendations').innerHTML='';el('routeMessage').textContent='Comparing 0 of '+shards.length+' route groups…';function finish(){if(token!==routeRequest)return;done++;el('routeMessage').textContent='Comparing '+done+' of '+shards.length+' route groups…';if(done<shards.length)return;results.sort(compareRoutes);renderRoutes(results.slice(0,3),errors)}shards.forEach(function(shard){var payload={address:el('address').value,addressVerified:true,addressDetails:selectedAddress,frequency:el('frequency').value,candidateStart:shard.start,candidateCount:shard.count};if(current&&current.locationId){payload.excludeCustomerId=customerId;payload.excludeServiceLocationId=current.locationId}google.script.run.withSuccessHandler(function(r){if(token!==routeRequest)return;results=results.concat((r&&r.recommendations)||[]);finish()}).withFailureHandler(function(){if(token!==routeRequest)return;errors++;finish()}).recommendMaintenanceClientRotations(payload)})}function minutes(v){var n=Math.max(0,Math.round(Number(v)||0)),h=Math.floor(n/60),m=n%60;return h?h+'h '+m+'m':m+' min'}function renderRoutes(rows,errors){el('recommendations').innerHTML='';el('routeMessage').textContent=rows.length?(errors?'Best available placements calculated; '+errors+' route group(s) could not be completed.':'Best route placements calculated.'):'No usable route placements were found.';(rows||[]).forEach(function(r,i){var b=document.createElement('button');b.type='button';b.className='rec';b.innerHTML='<div class="rec-title"><span>'+(i+1)+'. '+esc(r.label)+'</span><span>'+esc(r.rating)+'</span></div><div class="rec-meta">'+esc(r.rotationLabel)+' · '+((r.placements||[]).length)+' template row(s)'+(r.roadDataComplete?'<br>Added: +'+Number(r.addedDurationMinutes||0).toFixed(0)+' min · +'+Number(r.addedDistanceKm||0).toFixed(1)+' km · Route '+minutes(r.routeDriveMinutes):'')+'</div>';b.onclick=function(){Array.prototype.forEach.call(el('recommendations').querySelectorAll('.rec'),function(x){x.classList.remove('selected')});b.classList.add('selected');selectedPlacements=(r.placements||[]).map(function(p){return{week:p.week,day:p.day,layer:p.layer,position:p.position}});routeChangeRequested=true;el('routeMessage').textContent='Recommendation applied to '+selectedPlacements.length+' Route Template layer(s).'};el('recommendations').appendChild(b)})}
function changeRoute(){selectedPlacements=[];routeChangeRequested=true;el('routeMessage').textContent='Confirming this address before calculating alternate placements…';google.script.run.withSuccessHandler(function(confirmed){selectedAddress=confirmed;el('confirmedAddress').textContent='Confirmed: '+confirmed.address;el('confirmedAddress').style.display='block';loadRoutes()}).withFailureHandler(function(e){el('routeMessage').textContent=e&&e.message?e.message:String(e)}).resolvePmosAddressSuggestion(el('address').value)}function configureManual(){var f=el('frequency').value;el('secondDayField').style.display=f==='Twice Weekly'?'block':'none';el('weekField').style.display=(f==='Weekly'||f==='Twice Weekly')?'none':'block';if(f==='Bi-Weekly')el('manualWeek').innerHTML='<option value="1">Weeks 1 &amp; 3</option><option value="2">Weeks 2 &amp; 4</option>';else if(f==='Monthly')el('manualWeek').innerHTML='<option value="1">Week 1</option><option value="2">Week 2</option><option value="3">Week 3</option><option value="4">Week 4</option>'}function applyManual(){var day=el('manualDay').value,second=el('manualSecondDay').value;if(!day){el('routeMessage').textContent='Choose a primary service day.';return}if(el('frequency').value==='Twice Weekly'&&(!second||second===day)){el('routeMessage').textContent='Choose a different second service day.';return}selectedPlacements=[{manual:true,day:day,secondDay:second,week:Number(el('manualWeek').value||1),position:Math.max(1,Number(el('manualStop').value||1))}];routeChangeRequested=true;el('routeMessage').textContent='Manual route placement selected.'}
function payload(){return{customerId:customerId,locationId:current&&current.locationId||'',locationName:el('locationName').value,address:el('address').value,addressVerified:!addressChanged()&&!!current.locationId||!!selectedAddress,addressDetails:selectedAddress,routeChangeRequested:routeChangeRequested,recommendedPlacements:selectedPlacements,status:el('locationStatus').value,frequency:el('frequency').value,serviceStartDate:el('serviceStartDate').value,yearRound:el('yearRound').value,entryInformation:el('entryInformation').value,notes:el('notes').value,bodiesOfWater:collectWaterBodies()}}function saveLocation(){var button=el('saveLocation');button.disabled=true;button.textContent='Saving…';button.classList.remove('complete');button.classList.add('saving');msg('Saving service location…');google.script.run.withSuccessHandler(function(result){button.classList.remove('saving');button.classList.add('complete');button.textContent='Complete';msg(result.calendarStatus==='SCHEDULED'?'Saved · Calendar refresh scheduled':'Service location saved.');data=result.managerData;var id=result.locationId;current=(data.locations||[]).find(function(x){return x.locationId===id})||null;renderList();setTimeout(function(){if(current)editLocation(current);button.disabled=false;button.classList.remove('complete');button.textContent='Save Service Location'},900)}).withFailureHandler(function(e){button.disabled=false;button.classList.remove('saving');button.textContent='Save Service Location';msg(e&&e.message?e.message:String(e),true)}).savePmosServiceLocation(payload())}
function load(d){data=d;el('heading').textContent=d.displayName+' · '+d.customerId;renderList();showPrimary();msg('Ready.')}el('addLocation').onclick=newLocation;el('editPrimary').onclick=function(){google.script.run.showPmosCustomerEditor(customerId,'PROFILE');setTimeout(function(){google.script.host.close()},300)};el('address').addEventListener('input',queueAddress);el('address').addEventListener('blur',function(){setTimeout(function(){el('addressList').style.display='none'},180)});el('frequency').onchange=function(){routeChangeRequested=true;selectedPlacements=[];configureManual();if(selectedAddress)loadRoutes();else if(current&&current.address)changeRoute()};el('changeRoute').onclick=changeRoute;el('manualToggle').onclick=function(){var panel=el('manualPanel'),show=panel.style.display==='none';panel.style.display=show?'block':'none';this.textContent=show?'Hide manual route placement':'Select route placement manually';if(show)configureManual()};el('applyManual').onclick=applyManual;el('addBodyButton').onclick=function(){addWaterBody();prepareWaterBodyOptions(el('waterBodies'))};el('saveLocation').onclick=saveLocation;el('close').onclick=function(){google.script.host.close()};google.script.run.withSuccessHandler(load).withFailureHandler(function(e){msg(e&&e.message?e.message:String(e),true)}).getPmosServiceLocationManagerData(customerId);
</script></body></html>`;
}
