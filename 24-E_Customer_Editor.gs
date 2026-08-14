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
  try {
    const record = getPmosCustomerEditorRow_(customerId);
    if (String(request.editToken || '') !== pmosCustomerEditorToken_(record.values)) {
      throw new Error('This customer changed after the editor opened. Close it, review the latest profile, and try again.');
    }
    const before = record.values.slice();
    const values = record.values.slice();
    const fields = {
      firstName: {aliases: ['First Name'], value: firstName},
      lastName: {aliases: ['Last Name', 'Customer Name', 'Name', 'Customer'], value: lastName},
      fullName: {aliases: ['Full Name(s)', 'Full Name'], value: [firstName, lastName].filter(Boolean).join(' ')},
      calendarTitle: {aliases: ['Calendar Title'], value: String(request.calendarTitle || lastName || firstName).trim()},
      address: {aliases: ['Full Address', 'Service Address', 'Address', 'Street Address'], value: String(request.address || '').trim()},
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
    const routePlan = preparePmosCustomerEditorRouteRows_(customerId, fields);
    const equipmentPlan = preparePmosCustomerEditorEquipmentTitle_(customerId, fields.calendarTitle.value);
    affectedLayers = routePlan.layers;
    try {
      record.sheet.getRange(record.rowNumber, 1, 1, values.length).setValues([values]);
      routePlan.updates.forEach(function (update) {
        update.sheet.getRange(update.rowNumber, 1, 1, update.after.length).setValues([update.after]);
      });
      if (equipmentPlan) equipmentPlan.sheet.getRange(equipmentPlan.rowNumber, 2).setValue(equipmentPlan.after);
      SpreadsheetApp.flush();
    } catch (error) {
      record.sheet.getRange(record.rowNumber, 1, 1, before.length).setValues([before]);
      routePlan.updates.forEach(function (update) {
        update.sheet.getRange(update.rowNumber, 1, 1, update.before.length).setValues([update.before]);
      });
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
  return {saved: true, customerId: customerId, profile: getPmosCustomerProfile(customerId), calendarStatus: calendarStatus};
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

function preparePmosCustomerEditorRouteRows_(customerId, fields) {
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [PMOS.ROUTES_SHEET, 'PMOS 4-Week Route Template', 'Route Template']);
  if (!sheet) return {layers: [], updates: []};
  const table = readPmosHeaderTable_(sheet);
  const idIndex = findHeaderIndex_(table.headers, ['Customer ID']);
  const layerIndex = findHeaderIndex_(table.headers, ['Layer', 'Route Layer']);
  if (idIndex < 0) return {layers: [], updates: []};
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
  return {layers: layers.filter(function (value, index, all) { return all.indexOf(value) === index; }), updates: updates};
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

function buildPmosCustomerEditorHtml_(customerId, returnContext) {
  const idJson = JSON.stringify(customerId), contextJson = JSON.stringify(returnContext);
  return `<!doctype html><html><head><base target="_top"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;700;900&display=swap" rel="stylesheet"><style>
*{box-sizing:border-box}body{margin:0;background:#e5eaed;color:#293944;font-family:Mulish,Arial,sans-serif}.top{display:flex;align-items:center;justify-content:space-between;padding:20px 25px;background:#566a76;color:#fff}.title{font-size:21px;font-weight:900}.sub{margin-top:3px;color:#d8e2e6;font-size:11px}.body{height:626px;overflow:auto;padding:20px 25px 100px}.section{margin-bottom:15px;border:1px solid #d0d9dd;border-radius:11px;background:#f9fafb;box-shadow:0 4px 15px rgba(42,55,64,.04)}.section h3{margin:0;padding:14px 16px;border-bottom:1px solid #e1e7e9;font-size:14px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:15px}.wide{grid-column:1/-1}.field label{display:block;margin-bottom:5px;color:#6f7d84;font-size:10px;font-weight:900;letter-spacing:.07em;text-transform:uppercase}.field input,.field select,.field textarea{width:100%;padding:10px 11px;border:1px solid #bfcbd1;border-radius:7px;background:#fff;color:#293944;font:inherit;outline:none}.field input:focus,.field select:focus,.field textarea:focus{border-color:#017db1;box-shadow:0 0 0 3px rgba(1,125,177,.13)}textarea{min-height:88px;resize:vertical}.context{padding:0 16px 15px;color:#64737b;font-size:11px;line-height:1.5}.footer{position:fixed;left:0;right:0;bottom:0;display:flex;align-items:center;gap:9px;padding:14px 25px;border-top:1px solid #cbd5da;background:rgba(247,249,250,.97)}button{padding:10px 15px;border:1px solid #0f5470;border-radius:7px;background:#fff;color:#0f5470;font-weight:900;cursor:pointer}button.primary{background:#0f5470;color:#fff}.status{margin-left:auto;color:#66757d;font-size:11px}.error{color:#9b3030}@media(max-width:700px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}}
</style></head><body><div class="top"><div><div class="title">Edit Customer Information</div><div id="heading" class="sub">Loading customer…</div></div><img src="https://www.finnpools.ca/images/logo_only.png" alt="Finn Pools" style="width:42px;height:42px;object-fit:contain"></div><div class="body"><div class="section"><h3>Customer & contact information</h3><div class="grid"><div class="field"><label>First name(s)</label><input id="firstName"></div><div class="field"><label>Last name / household</label><input id="lastName"></div><div class="field wide"><label>Service address</label><input id="address"></div><div class="field"><label>Phone</label><input id="phone"></div><div class="field"><label>Email</label><input id="email" type="email"></div><div class="field"><label>Calendar title</label><input id="calendarTitle"></div><div class="field"><label>Status</label><select id="customerStatus"><option>Active</option><option>Inactive</option><option>Paused</option></select></div></div></div><div class="section"><h3>Maintenance</h3><div class="grid"><div class="field"><label>Frequency</label><select id="frequency"><option value=""></option><option>Weekly</option><option>Bi-Weekly</option><option>Monthly</option><option>On Request</option></select></div><div class="field"><label>Service start date</label><input id="serviceStartDate" type="date"></div><div class="field"><label>Season</label><select id="yearRound"><option value=""></option><option>Seasonal</option><option>Year Round</option><option>Yes</option><option>No</option></select></div><div class="field"><label>Current route placement</label><input id="routeSummary" disabled></div></div><div class="context">Route placement is shown for context. The route-placement editor will use the Route Intelligence workflow rather than accepting unsafe free-form route text.</div></div><div class="section"><h3>Property information</h3><div class="grid"><div class="field"><label>Entry information</label><textarea id="entryInformation"></textarea></div><div class="field"><label>Customer notes</label><textarea id="notes"></textarea></div></div></div><div class="section"><h3>Bodies of water & equipment</h3><div id="equipmentContext" class="context" style="padding-top:15px">Loading equipment…</div></div></div><div class="footer"><button id="save" class="primary">Save Changes</button><button id="cancel">Cancel</button><span id="saveStatus" class="status">Loading…</span></div><script>
var customerId=${idJson},returnContext=${contextJson},editToken='',loaded=null;function el(id){return document.getElementById(id)}function setStatus(message,error){el('saveStatus').textContent=message;el('saveStatus').className='status'+(error?' error':'')}function fill(data){loaded=data;editToken=data.editToken;el('heading').textContent=data.displayName+' · '+data.customerId;['firstName','lastName','address','phone','email','calendarTitle','frequency','serviceStartDate','yearRound','entryInformation','notes'].forEach(function(id){el(id).value=data[id]||''});el('customerStatus').value=data.status||'Active';el('routeSummary').value=(data.routes||[]).map(function(r){return [r.week?'Week '+r.week:'',r.day,r.routeArea].filter(Boolean).join(' ')}).join(' · ');var bodies=data.bodiesOfWater||[];el('equipmentContext').innerHTML=bodies.length?bodies.map(function(body){return '<div style="padding:8px 0;border-bottom:1px solid #e2e7e9"><b>'+escapeHtml(body.name||body.type||'Body of water')+'</b><div style="margin-top:3px">'+escapeHtml([body.type,body.sanitization].filter(Boolean).join(' · '))+'</div></div>'}).join(''):'No structured equipment details are stored for this customer.';setStatus('Ready.')}function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}function payload(){return{customerId:customerId,editToken:editToken,firstName:el('firstName').value,lastName:el('lastName').value,address:el('address').value,phone:el('phone').value,email:el('email').value,calendarTitle:el('calendarTitle').value,status:el('customerStatus').value,frequency:el('frequency').value,serviceStartDate:el('serviceStartDate').value,yearRound:el('yearRound').value,entryInformation:el('entryInformation').value,notes:el('notes').value}}function finishReturn(){google.script.run.withFailureHandler(function(error){setStatus(error&&error.message?error.message:String(error),true)}).returnFromPmosCustomerEditor(customerId,returnContext);setTimeout(function(){google.script.host.close()},350)}el('save').addEventListener('click',function(){this.disabled=true;setStatus('Saving changes…');google.script.run.withSuccessHandler(function(result){setStatus(result.calendarStatus==='SCHEDULED'?'Saved · Calendar refresh scheduled':'Saved');setTimeout(finishReturn,550)}).withFailureHandler(function(error){el('save').disabled=false;setStatus(error&&error.message?error.message:String(error),true)}).savePmosCustomerEditorData(payload())});el('cancel').addEventListener('click',finishReturn);google.script.run.withSuccessHandler(fill).withFailureHandler(function(error){setStatus(error&&error.message?error.message:String(error),true)}).getPmosCustomerEditorData(customerId);
</script></body></html>`;
}
