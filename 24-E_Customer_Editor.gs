/** Transactional customer information editor. */
function showPmosCustomerEditor(customerId, returnContext) {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('Select a customer before opening the editor.');
  const context = returnContext === 'PROFILE' ? 'PROFILE' : 'EDITOR_SEARCH';
  const html = HtmlService.createHtmlOutput(buildPmosCustomerEditorHtml_(id, context)).setWidth(980).setHeight(760);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Edit Customer Information');
}

function getPmosCustomerEditorData(customerId) {
  const profile = getPmosCustomerProfile(customerId);
  const record = getPmosCustomerEditorRow_(customerId);
  const dateIndex = findHeaderIndex_(record.headers, ['Service Start Date', 'Start Date']);
  const rawDate = dateIndex >= 0 ? record.values[dateIndex] : '';
  profile.serviceStartDate = rawDate && Object.prototype.toString.call(rawDate) === '[object Date]' && !isNaN(rawDate.getTime())
    ? Utilities.formatDate(rawDate, PMOS.TIMEZONE, 'yyyy-MM-dd') : String(rawDate || '').trim();
  profile.editToken = pmosCustomerEditorToken_(record.values);
  return profile;
}

function savePmosCustomerEditorData(input) {
  const request = input || {};
  const customerId = String(request.customerId || '').trim();
  if (!customerId) throw new Error('Customer ID is missing. Reload the editor.');
  const firstName = String(request.firstName || '').trim();
  const lastName = String(request.lastName || '').trim();
  if (!firstName && !lastName) throw new Error('Enter at least one customer or household name.');
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  let changedCalendarFields = false;
  let affectedLayers = [];
  let contactsToCreate = [];
  try {
    const record = getPmosCustomerEditorRow_(customerId);
    if (String(request.editToken || '') !== pmosCustomerEditorToken_(record.values)) {
      throw new Error('This customer changed after the editor opened. Close it, review the latest profile, and try again.');
    }
    const before = record.values.slice();
    const values = record.values.slice();
    const oldAddressIndex = findHeaderIndex_(record.headers, ['Full Address', 'Service Address', 'Address', 'Street Address']);
    const oldFrequencyIndex = findHeaderIndex_(record.headers, ['Frequency', 'Service Frequency']);
    const oldAddress = oldAddressIndex >= 0 ? String(before[oldAddressIndex] || '').trim() : '';
    const newAddress = String(request.address || '').trim();
    const addressChanged = normalizePmosAddressSearch_(oldAddress) !== normalizePmosAddressSearch_(newAddress);
    const oldFrequency = String(request.originalFrequency || (oldFrequencyIndex >= 0 ? before[oldFrequencyIndex] : '') || '').trim();
    const newFrequency = String(request.frequency || '').trim();
    const frequencyChanged = !!oldFrequency && /^(weekly|twice weekly|bi-?weekly|monthly)$/i.test(newFrequency) && normalizePmosAddressSearch_(oldFrequency) !== normalizePmosAddressSearch_(newFrequency);
    const routeChangeRequested = request.routeChangeRequested === true || frequencyChanged;
    const repositionRoute = addressChanged || routeChangeRequested;
    if (addressChanged && (!request.addressDetails || request.addressVerified !== true)) {
      throw new Error('Choose and confirm the new address, then select a route recommendation before saving.');
    }
    const recommendedPlacements = Array.isArray(request.recommendedPlacements) ? request.recommendedPlacements : [];
    if (repositionRoute && !recommendedPlacements.length) {
      throw new Error('Select a new route placement before saving.');
    }
    const requestedContacts = Array.isArray(request.additionalContacts) ? request.additionalContacts.map(function (contact) {
      return {firstName: String(contact && contact.firstName || '').trim(), lastName: String(contact && contact.lastName || '').trim(), phone: String(contact && contact.phone || '').trim(), email: String(contact && contact.email || '').trim()};
    }) : [];
    requestedContacts.forEach(function (contact) {
      if (!contact.firstName || !contact.lastName || !contact.phone) throw new Error('Each added contact needs a first name, last name, and phone number.');
      if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) throw new Error('An added household contact has an invalid email address.');
    });
    contactsToCreate = requestedContacts;
    const fields = {
      firstName: {aliases: ['First Name'], value: firstName},
      lastName: {aliases: ['Last Name', 'Customer Name', 'Name', 'Customer'], value: lastName},
      fullName: {aliases: ['Full Name(s)', 'Full Name'], value: [firstName, lastName].filter(Boolean).join(' ')},
      calendarTitle: {aliases: ['Calendar Title'], value: String(request.calendarTitle || lastName || firstName).trim()},
      address: {aliases: ['Full Address', 'Service Address', 'Address', 'Street Address'], value: newAddress},
      phone: {aliases: ['Primary Phone', 'Phone Number', 'Phone'], value: String(request.phone || '').trim()},
      email: {aliases: ['Email', 'Email Address'], value: String(request.email || '').trim()},
      status: {aliases: ['Status'], value: String(request.status || 'Active').trim() || 'Active'},
      frequency: {aliases: ['Frequency', 'Service Frequency'], value: String(request.frequency || '').trim()},
      serviceStartDate: {aliases: ['Service Start Date', 'Start Date'], value: parsePmosCustomerEditorDate_(request.serviceStartDate)},
      yearRound: {aliases: ['Year Round', 'Year-Round', 'Season'], value: String(request.yearRound || '').trim()},
      entryInformation: {aliases: ['Entry Information', 'Entry Notes'], value: String(request.entryInformation || '').trim()},
      notes: {aliases: ['Customer Notes', 'Notes', 'Details'], value: String(request.notes || '').trim()}
    };
    Object.keys(fields).forEach(function (key) {
      pmosCustomerEditorSetAliases_(record.headers, values, fields[key].aliases, fields[key].value);
    });
    const watched = ['calendarTitle', 'address', 'frequency', 'serviceStartDate', 'yearRound', 'status'];
    changedCalendarFields = watched.some(function (key) {
      const indexes = pmosCustomerEditorAliasIndexes_(record.headers, fields[key].aliases);
      return indexes.some(function (index) { return String(before[index] == null ? '' : before[index]) !== String(values[index] == null ? '' : values[index]); });
    });
    const routePlan = preparePmosCustomerEditorRouteRows_(customerId, fields, repositionRoute ? recommendedPlacements : []);
    const equipmentPlan = preparePmosCustomerEditorEquipmentTitle_(customerId, fields.calendarTitle.value);
    affectedLayers = routePlan.layers;
    try {
      record.sheet.getRange(record.rowNumber, 1, 1, values.length).setValues([values]);
      routePlan.updates.forEach(function (update) {
        update.sheet.getRange(update.rowNumber, 1, 1, update.after.length).setValues([update.after]);
      });
      if (routePlan.fullTable) writeMaintenanceRouteTable_(routePlan.fullTable.sheet, routePlan.fullTable.after);
      if (equipmentPlan) equipmentPlan.sheet.getRange(equipmentPlan.rowNumber, 2).setValue(equipmentPlan.after);
      SpreadsheetApp.flush();
    } catch (error) {
      record.sheet.getRange(record.rowNumber, 1, 1, before.length).setValues([before]);
      routePlan.updates.forEach(function (update) {
        update.sheet.getRange(update.rowNumber, 1, 1, update.before.length).setValues([update.before]);
      });
      if (routePlan.fullTable) writeMaintenanceRouteTable_(routePlan.fullTable.sheet, routePlan.fullTable.before);
      if (equipmentPlan) equipmentPlan.sheet.getRange(equipmentPlan.rowNumber, 2).setValue(equipmentPlan.before);
      SpreadsheetApp.flush();
      throw error;
    }
    if (typeof clearPmosCalendarAuditSnapshot_ === 'function') clearPmosCalendarAuditSnapshot_();
  } finally {
    lock.releaseLock();
  }
  let calendarStatus = 'NOT_REQUIRED';
  if (changedCalendarFields && affectedLayers.length && typeof scheduleAddedMaintenanceCustomerCalendarSync_ === 'function') {
    try { scheduleAddedMaintenanceCustomerCalendarSync_(customerId, affectedLayers); calendarStatus = 'SCHEDULED'; }
    catch (error) { calendarStatus = 'SYNC_ERROR: ' + (error && error.message ? error.message : String(error)); }
  }
  let contactStatus = '';
  if (contactsToCreate.length) {
    try { createPmosCustomerEditorHouseholdContacts_(customerId, contactsToCreate); contactStatus = contactsToCreate.length + ' household contact(s) created'; }
    catch (error) { contactStatus = 'Customer saved, but household contacts could not be created: ' + (error && error.message ? error.message : String(error)); }
  }
  return {saved: true, customerId: customerId, profile: getPmosCustomerProfile(customerId), calendarStatus: calendarStatus, contactStatus: contactStatus};
}

function getPmosCustomerEditorRow_(customerId) {
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [PMOS.CUSTOMERS_SHEET, 'Customer Database', 'Customer List']);
  if (!sheet) throw new Error('Customers sheet was not found.');
  const table = readPmosHeaderTable_(sheet);
  const idIndex = findHeaderIndex_(table.headers, ['Customer ID']);
  if (idIndex < 0) throw new Error('Customers is missing Customer ID.');
  const id = String(customerId || '').trim().toUpperCase();
  for (let index = 0; index < table.rows.length; index++) {
    if (String(table.rows[index][idIndex] || '').trim().toUpperCase() === id) {
      return {sheet: sheet, headers: table.headers, values: table.rows[index].slice(), rowNumber: table.headerRow + index + 1};
    }
  }
  throw new Error('Customer ID ' + customerId + ' was not found.');
}

function pmosCustomerEditorToken_(values) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(values));
  return Utilities.base64EncodeWebSafe(bytes);
}

function pmosCustomerEditorAliasIndexes_(headers, aliases) {
  const normalized = aliases.map(normalizeSyncHeader_);
  return headers.map(function (header, index) {
    return normalized.indexOf(normalizeSyncHeader_(header)) >= 0 ? index : -1;
  }).filter(function (index) { return index >= 0; });
}

function pmosCustomerEditorSetAliases_(headers, row, aliases, value) {
  pmosCustomerEditorAliasIndexes_(headers, aliases).forEach(function (index) { row[index] = value; });
}

function parsePmosCustomerEditorDate_(value) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Service start date must use YYYY-MM-DD.');
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function preparePmosCustomerEditorRouteRows_(customerId, fields, recommendedPlacements) {
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [PMOS.ROUTES_SHEET, 'PMOS 4-Week Route Template', 'Route Template']);
  if (!sheet) return {layers: [], updates: [], fullTable: null};
  const table = readPmosHeaderTable_(sheet);
  const originalRows = table.rows.map(function (row) { return row.slice(); });
  const idIndex = findHeaderIndex_(table.headers, ['Customer ID']);
  const layerIndex = findHeaderIndex_(table.headers, ['Layer', 'Route Layer']);
  if (idIndex < 0) return {layers: [], updates: [], fullTable: null};
  const layers = [];
  const updates = [];
  table.rows.forEach(function (row, index) {
    if (String(row[idIndex] || '').trim() !== customerId) return;
    const before = row.slice();
    ['calendarTitle', 'address', 'frequency', 'serviceStartDate', 'yearRound', 'status'].forEach(function (key) {
      pmosCustomerEditorSetAliases_(table.headers, row, fields[key].aliases, fields[key].value);
    });
    updates.push({sheet: sheet, rowNumber: table.headerRow + index + 1, before: before, after: row.slice()});
    if (layerIndex >= 0 && String(row[layerIndex] || '').trim()) layers.push(String(row[layerIndex]).trim());
  });
  if (recommendedPlacements && recommendedPlacements.length) {
    const layerIndex = findHeaderIndex_(table.headers, ['Layer', 'Route Layer', 'Route Assignment']);
    const weekIndex = findHeaderIndex_(table.headers, ['Week', 'Rotation Week']);
    const dayIndex = findHeaderIndex_(table.headers, ['Day', 'Weekday']);
    const stopIndexes = pmosCustomerEditorAliasIndexes_(table.headers, ['Stop Order', 'Stop', 'Order']);
    updates.forEach(function (update) {
      const week = weekIndex >= 0 ? Number(update.after[weekIndex] || 0) : 0;
      const day = dayIndex >= 0 ? String(update.after[dayIndex] || '').trim() : '';
      const placement = recommendedPlacements.find(function (item) { return Number(item.week) === week && String(item.day || '') === day; });
      if (!placement) return;
      if (layerIndex >= 0) update.after[layerIndex] = String(placement.layer || update.after[layerIndex]);
      stopIndexes.forEach(function (stopIndex) { update.after[stopIndex] = Math.max(1, Number(placement.position || 1)); });
      if (String(placement.layer || '').trim()) layers.push(String(placement.layer).trim());
    });
    const beforeTable = {headers: table.headers.slice(), headerRow: table.headerRow, rows: originalRows};
    const movingRows = recommendedPlacements.map(function (placement) {
      const source = updates.find(function (update) {
        return (weekIndex < 0 || Number(update.after[weekIndex] || 0) === Number(placement.week || 0)) &&
          (dayIndex < 0 || String(update.after[dayIndex] || '') === String(placement.day || ''));
      }) || updates[0];
      if (!source) return null;
      const row = source.after.slice();
      if (layerIndex >= 0) row[layerIndex] = String(placement.layer || row[layerIndex]);
      if (weekIndex >= 0) row[weekIndex] = Number(placement.week || row[weekIndex] || 0);
      if (dayIndex >= 0) row[dayIndex] = String(placement.day || row[dayIndex] || '');
      stopIndexes.forEach(function (stopIndex) { row[stopIndex] = Math.max(1, Number(placement.position || 1)); });
      return row;
    }).filter(Boolean);
    const remainingRows = table.rows.filter(function (row) { return String(row[idIndex] || '').trim() !== customerId; }).map(function (row) { return row.slice(); });
    const counters = {};
    remainingRows.forEach(function (row) {
      const layer = layerIndex >= 0 ? String(row[layerIndex] || '') : '';
      counters[layer] = (counters[layer] || 0) + 1;
      stopIndexes.forEach(function (stopIndex) { row[stopIndex] = counters[layer]; });
    });
    const afterTable = {headers: table.headers.slice(), headerRow: table.headerRow, rows: remainingRows};
    movingRows.forEach(function (row) {
      const layer = layerIndex >= 0 ? String(row[layerIndex] || '') : '';
      const stop = stopIndexes.length ? Math.max(1, Number(row[stopIndexes[0]] || 1)) : 1;
      insertMaintenanceRouteRow_(afterTable, row, layer, stop);
    });
    return {layers: layers.filter(function (value, index, all) { return all.indexOf(value) === index; }), updates: [], fullTable: {sheet: sheet, before: beforeTable, after: afterTable}};
  }
  return {layers: layers.filter(function (value, index, all) { return all.indexOf(value) === index; }), updates: updates, fullTable: null};
}

function createPmosCustomerEditorHouseholdContacts_(customerId, contacts) {
  const customer = getPmosCustomerContactRecord_(customerId, true);
  const created = contacts.map(function (contact) {
    const person = {names: [{givenName: contact.firstName, familyName: contact.lastName}], phoneNumbers: [{value: contact.phone, type: 'mobile'}],
      addresses: customer.address ? [{formattedValue: customer.address, type: 'home'}] : [],
      emailAddresses: contact.email ? [{value: contact.email, type: 'home'}] : [],
      externalIds: [{value: customer.customerId, type: 'customer'}]};
    return People.People.createContact(person, {personFields: PMOS_CONTACT_FIELDS_});
  });
  writePmosGoogleContactLinks_(customer, customer.resourceNames.concat(created));
}

function preparePmosCustomerEditorEquipmentTitle_(customerId, calendarTitle) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('PMOS Customer Equipment');
  if (!sheet || sheet.getLastRow() < 2) return null;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (let index = 0; index < values.length; index++) {
    if (String(values[index][0] || '').trim() === customerId) {
      return {sheet: sheet, rowNumber: index + 2, before: values[index][1], after: calendarTitle};
    }
  }
  return null;
}

function returnFromPmosCustomerEditor(customerId, returnContext) {
  if (returnContext === 'PROFILE') showPmosCustomerSearchWindow_('LOOKUP', customerId);
  else showEditCustomerInformationSearch();
}

function buildPmosCustomerEditorHtmlLegacy_(customerId, returnContext) {
  const idJson = JSON.stringify(customerId), contextJson = JSON.stringify(returnContext);
  return `<!doctype html><html><head><base target="_top"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;700;900&display=swap" rel="stylesheet"><style>
*{box-sizing:border-box}body{margin:0;background:#e5eaed;color:#293944;font-family:Mulish,Arial,sans-serif}.top{display:flex;align-items:center;justify-content:space-between;padding:20px 25px;background:#566a76;color:#fff}.title{font-size:21px;font-weight:900}.sub{margin-top:3px;color:#d8e2e6;font-size:11px}.body{height:626px;overflow:auto;padding:20px 25px 100px}.section{margin-bottom:15px;border:1px solid #d0d9dd;border-radius:11px;background:#f9fafb;box-shadow:0 4px 15px rgba(42,55,64,.04)}.section h3{margin:0;padding:14px 16px;border-bottom:1px solid #e1e7e9;font-size:14px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:15px}.wide{grid-column:1/-1}.field label{display:block;margin-bottom:5px;color:#6f7d84;font-size:10px;font-weight:900;letter-spacing:.07em;text-transform:uppercase}.field input,.field select,.field textarea{width:100%;padding:10px 11px;border:1px solid #bfcbd1;border-radius:7px;background:#fff;color:#293944;font:inherit;outline:none}.field input:focus,.field select:focus,.field textarea:focus{border-color:#017db1;box-shadow:0 0 0 3px rgba(1,125,177,.13)}textarea{min-height:88px;resize:vertical}.context{padding:0 16px 15px;color:#64737b;font-size:11px;line-height:1.5}.footer{position:fixed;left:0;right:0;bottom:0;display:flex;align-items:center;gap:9px;padding:14px 25px;border-top:1px solid #cbd5da;background:rgba(247,249,250,.97)}button{padding:10px 15px;border:1px solid #0f5470;border-radius:7px;background:#fff;color:#0f5470;font-weight:900;cursor:pointer}button.primary{background:#0f5470;color:#fff}.status{margin-left:auto;color:#66757d;font-size:11px}.error{color:#9b3030}@media(max-width:700px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}}
</style></head><body><div class="top"><div><div class="title">Edit Customer Information</div><div id="heading" class="sub">Loading customer…</div></div><img src="https://www.finnpools.ca/images/logo_only.png" alt="Finn Pools" style="width:42px;height:42px;object-fit:contain"></div><div class="body"><div class="section"><h3>Customer & contact information</h3><div class="grid"><div class="field"><label>First name(s)</label><input id="firstName"></div><div class="field"><label>Last name / household</label><input id="lastName"></div><div class="field wide"><label>Service address</label><input id="address"></div><div class="field"><label>Phone</label><input id="phone"></div><div class="field"><label>Email</label><input id="email" type="email"></div><div class="field"><label>Calendar title</label><input id="calendarTitle"></div><div class="field"><label>Status</label><select id="customerStatus"><option>Active</option><option>Inactive</option><option>Paused</option></select></div></div></div><div class="section"><h3>Maintenance</h3><div class="grid"><div class="field"><label>Frequency</label><select id="frequency"><option value=""></option><option>Weekly</option><option>Bi-Weekly</option><option>Monthly</option><option>On Request</option></select></div><div class="field"><label>Service start date</label><input id="serviceStartDate" type="date"></div><div class="field"><label>Season</label><select id="yearRound"><option value=""></option><option>Seasonal</option><option>Year Round</option><option>Yes</option><option>No</option></select></div><div class="field"><label>Current route placement</label><input id="routeSummary" disabled></div></div><div class="context">Route placement is shown for context. The route-placement editor will use the Route Intelligence workflow rather than accepting unsafe free-form route text.</div></div><div class="section"><h3>Property information</h3><div class="grid"><div class="field"><label>Entry information</label><textarea id="entryInformation"></textarea></div><div class="field"><label>Customer notes</label><textarea id="notes"></textarea></div></div></div><div class="section"><h3>Bodies of water & equipment</h3><div id="equipmentContext" class="context" style="padding-top:15px">Loading equipment…</div></div></div><div class="footer"><button id="save" class="primary">Save Changes</button><button id="cancel">Cancel</button><span id="saveStatus" class="status">Loading…</span></div><script>
var customerId=${idJson},returnContext=${contextJson},editToken='',loaded=null;function el(id){return document.getElementById(id)}function setStatus(message,error){el('saveStatus').textContent=message;el('saveStatus').className='status'+(error?' error':'')}function fill(data){loaded=data;editToken=data.editToken;el('heading').textContent=data.displayName+' · '+data.customerId;['firstName','lastName','address','phone','email','calendarTitle','frequency','serviceStartDate','yearRound','entryInformation','notes'].forEach(function(id){el(id).value=data[id]||''});el('customerStatus').value=data.status||'Active';el('routeSummary').value=(data.routes||[]).map(function(r){return [r.week?'Week '+r.week:'',r.day,r.routeArea].filter(Boolean).join(' ')}).join(' · ');var bodies=data.bodiesOfWater||[];el('equipmentContext').innerHTML=bodies.length?bodies.map(function(body){return '<div style="padding:8px 0;border-bottom:1px solid #e2e7e9"><b>'+escapeHtml(body.name||body.type||'Body of water')+'</b><div style="margin-top:3px">'+escapeHtml([body.type,body.sanitization].filter(Boolean).join(' · '))+'</div></div>'}).join(''):'No structured equipment details are stored for this customer.';setStatus('Ready.')}function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}function payload(){return{customerId:customerId,editToken:editToken,firstName:el('firstName').value,lastName:el('lastName').value,address:el('address').value,phone:el('phone').value,email:el('email').value,calendarTitle:el('calendarTitle').value,status:el('customerStatus').value,frequency:el('frequency').value,serviceStartDate:el('serviceStartDate').value,yearRound:el('yearRound').value,entryInformation:el('entryInformation').value,notes:el('notes').value}}function finishReturn(){google.script.run.withFailureHandler(function(error){setStatus(error&&error.message?error.message:String(error),true)}).returnFromPmosCustomerEditor(customerId,returnContext);setTimeout(function(){google.script.host.close()},350)}el('save').addEventListener('click',function(){this.disabled=true;setStatus('Saving changes…');google.script.run.withSuccessHandler(function(result){setStatus(result.calendarStatus==='SCHEDULED'?'Saved · Calendar refresh scheduled':'Saved');setTimeout(finishReturn,550)}).withFailureHandler(function(error){el('save').disabled=false;setStatus(error&&error.message?error.message:String(error),true)}).savePmosCustomerEditorData(payload())});el('cancel').addEventListener('click',finishReturn);google.script.run.withSuccessHandler(fill).withFailureHandler(function(error){setStatus(error&&error.message?error.message:String(error),true)}).getPmosCustomerEditorData(customerId);
</script></body></html>`;
}

function buildPmosCustomerEditorHtml_(customerId, returnContext) {
  const idJson = JSON.stringify(customerId), contextJson = JSON.stringify(returnContext);
  return `<!doctype html><html><head><base target="_top"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;700;900&display=swap" rel="stylesheet"><style>
*{box-sizing:border-box}body{margin:0;background:#e5eaed;color:#293944;font-family:Mulish,Arial,sans-serif}.top{display:flex;align-items:center;justify-content:space-between;padding:20px 25px;background:#566a76;color:#fff}.title{font-size:21px;font-weight:900}.sub{margin-top:3px;color:#d8e2e6;font-size:11px}.body{height:626px;overflow:auto;padding:20px 25px 110px}.section{margin-bottom:15px;border:1px solid #d0d9dd;border-radius:11px;background:#f9fafb;box-shadow:0 4px 15px rgba(42,55,64,.04)}.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid #e1e7e9}.section h3{margin:0;font-size:14px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:15px}.wide{grid-column:1/-1}.field label{display:block;margin-bottom:5px;color:#6f7d84;font-size:10px;font-weight:900;letter-spacing:.07em;text-transform:uppercase}.field input,.field select,.field textarea{width:100%;padding:10px 11px;border:1px solid #bfcbd1;border-radius:7px;background:#fff;color:#293944;font:inherit;outline:none}.field input:focus,.field select:focus,.field textarea:focus{border-color:#017db1;box-shadow:0 0 0 3px rgba(1,125,177,.13)}textarea{min-height:88px;resize:vertical}.add-link{display:inline-block;margin:0 15px 14px;border:0;background:transparent;color:#017db1;font-weight:900;cursor:pointer}.contact-row{position:relative;grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px;border:1px solid #d5e2e8;border-radius:9px;background:#eef5f8}.contact-row .remove{position:absolute;right:8px;top:7px;border:0;background:transparent;color:#77868d;cursor:pointer}.contact-email{display:none}.address-wrap{position:relative}.address-list{display:none;position:absolute;z-index:20;left:0;right:0;top:100%;max-height:210px;overflow:auto;border:1px solid #9cb0ba;border-radius:0 0 8px 8px;background:#fff;box-shadow:0 10px 20px rgba(30,45,55,.16)}.address-option{display:block;width:100%;padding:10px;border:0;border-bottom:1px solid #e2e8ea;background:#fff;text-align:left;cursor:pointer}.address-option:hover{background:#e4f2f8}.route-view{display:flex;align-items:center;gap:8px}.route-view input{flex:1}.route-change{flex:0 0 auto;padding:9px 12px;border:1px solid #0f5470;border-radius:7px;background:#fff;color:#0f5470;font-weight:900;cursor:pointer}.route-box{display:none;grid-column:1/-1;padding:12px;border:1px solid #acd2e2;border-radius:9px;background:#eef7fb}.route-message{font-size:11px;line-height:1.45}.recommendations{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.rec{padding:11px;border:2px solid #d8e7ed;border-radius:10px;background:#fff;color:#293944;text-align:left;cursor:pointer}.rec.selected{border-color:#017db1;background:#eaf6fb;box-shadow:0 0 0 2px rgba(1,125,177,.12)}.rec-title{display:flex;justify-content:space-between;gap:8px;font-size:12px;font-weight:900}.rec-title span{display:inline;margin:0;color:#293944;font-size:12px}.rec-reason{margin-top:7px;color:#52656e;font-size:10px;line-height:1.4}.rec-points{margin:8px 0 0;padding-left:16px;color:#52656e;font-size:10px;line-height:1.45}.rec-points li{margin:3px 0}.rec-points .muted{color:#7b898f}.status-select{width:112px;padding:7px 9px;border:1px solid #b7c6cc;border-radius:7px;background:#fff;color:#293944;font:inherit;font-size:11px;font-weight:900}.context{padding:0 16px 15px;color:#64737b;font-size:11px;line-height:1.5}.footer{position:fixed;left:0;right:0;bottom:0;display:flex;align-items:center;gap:9px;padding:14px 25px;border-top:1px solid #cbd5da;background:rgba(247,249,250,.97)}button.action{padding:10px 15px;border:1px solid #0f5470;border-radius:7px;background:#fff;color:#0f5470;font-weight:900;cursor:pointer;transition:background .18s,color .18s,border-color .18s}button.primary{background:#0f5470;color:#fff}button.primary.saving{border-color:#017db1;background:#017db1}button.primary.saved{border-color:#2f7d57;background:#2f7d57}.save-status{margin-left:auto;color:#66757d;font-size:11px}.error{color:#9b3030}@media(max-width:700px){.grid,.contact-row,.recommendations{grid-template-columns:1fr}.wide{grid-column:auto}}
</style></head><body><div class="top"><div><div class="title">Edit Customer Information</div><div id="heading" class="sub">Loading customer…</div></div><img src="https://www.finnpools.ca/images/logo_only.png" alt="Finn Pools" style="width:42px;height:42px;object-fit:contain"></div><div class="body">
<div class="section"><div class="section-head"><h3>Customer & contact information</h3></div><div class="grid"><div class="field"><label>First name(s)</label><input id="firstName"></div><div class="field"><label>Last name / household</label><input id="lastName"></div><div class="field"><label>Phone</label><input id="phone"></div><div class="field"><label>Email</label><input id="email" type="email"></div><div id="additionalContacts" class="wide"></div></div><button id="addContact" class="add-link" type="button">+ Add Contact</button><div class="grid" style="padding-top:0"><div class="field wide"><label>Service address</label><div class="address-wrap"><input id="address" autocomplete="off"><div id="addressList" class="address-list"></div></div></div><div id="routeBox" class="route-box"><div id="routeMessage" class="route-message">A changed address needs a new route placement.</div><div id="recommendations" class="recommendations"></div></div><div class="field wide"><label>Calendar title</label><input id="calendarTitle"></div></div></div>
<div class="section"><div class="section-head"><h3>Maintenance</h3><select id="customerStatus" class="status-select" aria-label="Customer status"><option>Active</option><option>Inactive</option><option>Paused</option></select></div><div class="grid"><div class="field"><label>Frequency</label><select id="frequency"><option value=""></option><option>Weekly</option><option>Twice Weekly</option><option>Bi-Weekly</option><option>Monthly</option><option>On Request</option></select></div><div class="field"><label>Service start date</label><input id="serviceStartDate" type="date"></div><div class="field wide"><label>Route placement</label><div class="route-view"><input id="routeSummary" disabled><button id="changeRoute" class="route-change" type="button">Change Route</button></div></div></div></div>
<div class="section"><div class="section-head"><h3>Property information</h3></div><div class="grid"><div class="field"><label>Entry information</label><textarea id="entryInformation"></textarea></div><div class="field"><label>Customer notes</label><textarea id="notes"></textarea></div></div></div><div class="section"><div class="section-head"><h3>Bodies of water & equipment</h3></div><div id="equipmentContext" class="context" style="padding-top:15px">Loading equipment…</div></div><div class="section"><div class="section-head"><h3>Service season</h3></div><div class="grid"><div class="field wide"><label>Season</label><select id="yearRound"><option>Seasonal</option><option>Year Round</option></select></div></div></div></div>
<div class="footer"><button id="save" class="action primary">Save Changes</button><button id="cancel" class="action">Cancel</button><span id="saveStatus" class="save-status">Loading…</span></div><script>
var customerId=${idJson},returnContext=${contextJson},editToken='',loaded=null,originalAddress='',selectedAddress=null,selectedPlacements=[],routeChangeRequested=false,addressTimer=null,addressRequest=0;function el(id){return document.getElementById(id)}function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}function norm(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'')}function setStatus(m,e){el('saveStatus').textContent=m;el('saveStatus').className='save-status'+(e?' error':'')}
function routeSummary(routes){var groups={};(routes||[]).forEach(function(r){var key=[r.day||'',r.routeArea||''].join('|');if(!groups[key])groups[key]={day:r.day||'',area:r.routeArea||'',weeks:[]};if(r.week&&groups[key].weeks.indexOf(r.week)<0)groups[key].weeks.push(r.week)});return Object.keys(groups).map(function(key){var g=groups[key],weeks=g.weeks.sort(function(a,b){return a-b}),weekText=weeks.length?'Week'+(weeks.length>1?'s ':' ')+weeks.map(function(w,i){return i===weeks.length-1&&i>0?'& '+w:String(w)}).join(weeks.length>2?', ':weeks.length===2?' ':''):'';return [g.day,g.area?'→ '+g.area:'',weekText].filter(Boolean).join(' ')}).join(' · ')}
function fill(data){loaded=data;editToken=data.editToken;originalAddress=data.address||'';el('heading').textContent=data.displayName+' · '+data.customerId;['firstName','lastName','address','phone','email','calendarTitle','frequency','serviceStartDate','entryInformation','notes'].forEach(function(id){el(id).value=data[id]||''});el('customerStatus').value=data.status||'Active';el('yearRound').value=/yes|year round/i.test(data.yearRound||'')?'Year Round':'Seasonal';el('routeSummary').value=routeSummary(data.routes);var bodies=data.bodiesOfWater||[];el('equipmentContext').innerHTML=bodies.length?bodies.map(function(body){return '<div style="padding:8px 0;border-bottom:1px solid #e2e7e9"><b>'+esc(body.name||body.type||'Body of water')+'</b><div style="margin-top:3px">'+esc([body.type,body.sanitization].filter(Boolean).join(' · '))+'</div></div>'}).join(''):'No structured equipment details are stored for this customer.';setStatus('Ready.')}
function addContact(){var row=document.createElement('div');row.className='contact-row';row.innerHTML='<button type="button" class="remove" aria-label="Remove contact">×</button><div class="field"><label>First name</label><input data-contact="firstName"></div><div class="field"><label>Last name</label><input data-contact="lastName" value="'+esc(el('lastName').value)+'"></div><div class="field"><label>Phone number</label><input data-contact="phone"></div><button type="button" class="add-link" style="margin:0;align-self:end;justify-self:start" data-add-email>+ Add email</button><div class="field contact-email"><label>Email</label><input data-contact="email" type="email"></div>';row.querySelector('.remove').onclick=function(){row.remove()};row.querySelector('[data-add-email]').onclick=function(){this.style.display='none';row.querySelector('.contact-email').style.display='block';row.querySelector('[data-contact="email"]').focus()};el('additionalContacts').appendChild(row);row.querySelector('[data-contact="firstName"]').focus()}
function contacts(){return Array.prototype.map.call(document.querySelectorAll('.contact-row'),function(row){return{firstName:row.querySelector('[data-contact="firstName"]').value,lastName:row.querySelector('[data-contact="lastName"]').value,phone:row.querySelector('[data-contact="phone"]').value,email:row.querySelector('[data-contact="email"]').value}})}function addressChanged(){return norm(el('address').value)!==norm(originalAddress)}function clearRoute(){selectedAddress=null;selectedPlacements=[];el('recommendations').innerHTML='';el('routeBox').style.display=addressChanged()?'block':'none';if(addressChanged())el('routeMessage').textContent='Choose and confirm the new address to calculate route placement.'}
function searchAddress(){clearTimeout(addressTimer);clearRoute();var q=el('address').value.trim(),request=++addressRequest;if(!addressChanged()||q.length<3){el('addressList').style.display='none';return}addressTimer=setTimeout(function(){google.script.run.withSuccessHandler(function(items){if(request!==addressRequest)return;var list=el('addressList');list.innerHTML='';(items||[]).forEach(function(item){var b=document.createElement('button');b.type='button';b.className='address-option';b.textContent=item.address;b.onmousedown=function(event){event.preventDefault();confirmAddress(item)};list.appendChild(b)});list.style.display=items&&items.length?'block':'none'}).withFailureHandler(function(e){setStatus(e&&e.message?e.message:String(e),true)}).suggestPmosAddresses(q,6)},180)}function confirmAddress(item){el('addressList').style.display='none';el('routeMessage').textContent='Confirming address…';google.script.run.withSuccessHandler(function(confirmed){selectedAddress=confirmed;el('address').value=confirmed.address;loadRoutes()}).withFailureHandler(function(e){setStatus(e&&e.message?e.message:String(e),true)}).confirmPmosSelectedAddress(item)}
function loadRoutes(){el('routeBox').style.display='block';el('routeMessage').textContent='Address confirmed. Calculating the best route placements…';el('recommendations').innerHTML='';google.script.run.withSuccessHandler(renderRoutes).withFailureHandler(function(e){el('routeMessage').textContent=e&&e.message?e.message:String(e)}).recommendMaintenanceClientRotations({address:el('address').value,addressVerified:true,addressDetails:selectedAddress,frequency:el('frequency').value||'Weekly',excludeCustomerId:customerId})}function fmtRouteMinutes(v){var n=Math.max(0,Math.round(Number(v)||0)),h=Math.floor(n/60),m=n%60;return h?h+'h '+m+'m':m+' min'}function formatRoutePlacement(p){var text='Week '+p.week+' - '+p.day+' - stop '+p.position;if(p.isFirstStop)text+=' (first stop)';else if(p.isLastStop)text+=' (last stop)';return text}function renderRoutes(result){var rows=result&&result.recommendations||[];el('routeMessage').textContent=result&&result.qualityMessage||'Select a route placement.';rows.forEach(function(r,i){var b=document.createElement('button'),primary=r.placements&&r.placements[0]||{},stop=Math.max(1,Math.round(Number(r.position||primary.position||1))),placement=String(stop)+(primary.isFirstStop?' (first stop)':primary.isLastStop?' (last stop)':''),layers=(r.placements||[]).map(formatRoutePlacement).join('; '),rotationHeading=(r.weeks||[]).length===2?'Rotation weeks':'Rotation week',points=['<li><b>'+rotationHeading+':</b> '+esc(r.rotationLabel)+'</li>','<li><b>Stop position:</b> '+esc(placement)+'</li>','<li><b>Template:</b> '+esc(layers)+'</li>'];if(r.roadDataComplete){points.push('<li><b>Drive:</b> '+esc(fmtRouteMinutes(r.routeDriveMinutes))+' · '+Number(r.routeDistanceKm||0).toFixed(1)+' km</li>','<li><b>Stops:</b> '+Math.round(Number(r.customerCount||0)+1)+'</li>','<li><b>Estimated route*:</b> '+esc(fmtRouteMinutes(r.estimatedRouteMinutes))+'</li>','<li><b>Added:</b> +'+Number(r.addedDurationMinutes||0).toFixed(0)+' min · +'+Number(r.addedDistanceKm||0).toFixed(1)+' km</li>','<li class="muted">*'+Math.round(Number(r.serviceMinutes)||20)+'-minute average visits · '+esc(r.routeProvider||'RIE')+'</li>')}else points.push('<li>GPS road-time check unavailable. Review this placement carefully.</li>');b.type='button';b.className='rec';b.innerHTML='<div class="rec-title"><span>'+(i+1)+'. '+esc(r.label)+'</span><span>'+esc(r.rating)+'</span></div><div class="rec-reason">'+esc(r.reason||'Review the route impact below.')+'</div><ul class="rec-points">'+points.join('')+'</ul>';b.onclick=function(){Array.prototype.forEach.call(document.querySelectorAll('.rec'),function(x){x.classList.remove('selected')});b.classList.add('selected');selectedPlacements=(r.placements||[]).map(function(p){return{week:p.week,day:p.day,layer:p.layer,position:p.position}});el('routeMessage').textContent='Recommendation applied to '+selectedPlacements.length+' exact Route Template layer(s).'};el('recommendations').appendChild(b)})}
function changeRoute(){routeChangeRequested=true;selectedPlacements=[];el('routeBox').style.display='block';el('routeMessage').textContent='Confirming the current address before finding alternate placements…';google.script.run.withSuccessHandler(function(confirmed){selectedAddress=confirmed;loadRoutes()}).withFailureHandler(function(e){routeChangeRequested=false;el('routeMessage').textContent=e&&e.message?e.message:String(e)}).resolvePmosAddressSuggestion(el('address').value)}
function payload(){return{customerId:customerId,editToken:editToken,firstName:el('firstName').value,lastName:el('lastName').value,address:el('address').value,addressVerified:!addressChanged()||!!selectedAddress,addressDetails:selectedAddress,routeChangeRequested:routeChangeRequested,originalFrequency:loaded&&loaded.frequency||'',recommendedPlacements:selectedPlacements,additionalContacts:contacts(),phone:el('phone').value,email:el('email').value,calendarTitle:el('calendarTitle').value,status:el('customerStatus').value,frequency:el('frequency').value,serviceStartDate:el('serviceStartDate').value,yearRound:el('yearRound').value,entryInformation:el('entryInformation').value,notes:el('notes').value}}function finishReturn(){google.script.run.withFailureHandler(function(e){setStatus(e&&e.message?e.message:String(e),true)}).returnFromPmosCustomerEditor(customerId,returnContext);setTimeout(function(){google.script.host.close()},350)}el('addContact').onclick=addContact;el('changeRoute').onclick=changeRoute;el('address').addEventListener('input',searchAddress);el('address').addEventListener('blur',function(){setTimeout(function(){el('addressList').style.display='none'},180)});el('frequency').addEventListener('change',changeRoute);el('save').onclick=function(){var button=this;button.disabled=true;button.textContent='Saving…';button.classList.remove('saved');button.classList.add('saving');setStatus('Saving changes…');google.script.run.withSuccessHandler(function(result){var message=result.contactStatus||'',failed=/could not/i.test(message);button.classList.remove('saving');button.classList.add('saved');button.textContent='Saved ✓';setStatus((result.calendarStatus==='SCHEDULED'?'Saved · Calendar refresh scheduled':'Changes saved successfully')+(message?' · '+message:''),failed);if(failed){button.disabled=false;return}setTimeout(finishReturn,1100)}).withFailureHandler(function(e){button.disabled=false;button.classList.remove('saving');button.textContent='Save Changes';setStatus(e&&e.message?e.message:String(e),true)}).savePmosCustomerEditorData(payload())};el('cancel').onclick=finishReturn;google.script.run.withSuccessHandler(fill).withFailureHandler(function(e){setStatus(e&&e.message?e.message:String(e),true)}).getPmosCustomerEditorData(customerId);
</script></body></html>`;
}
