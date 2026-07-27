/**
 * Add Maintenance Client workflow.
 *
 * Customers remains the source of truth for customer information. This workflow
 * creates the customer record and the required 4-Week Route Template rows, but
 * does not silently modify Google Calendar. Calendar Sync remains an explicit
 * reviewed operation.
 */

function showAddMaintenanceClient() {
  const today = Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    *{box-sizing:border-box}body{margin:0;padding:18px;font-family:Arial,sans-serif;color:#1f2937;background:#fff}
    h2{margin:0 0 5px}.muted{font-size:12px;color:#6b7280;line-height:1.45}.grid{display:grid;grid-template-columns:1fr 1fr;gap:11px 14px;margin-top:15px}.full{grid-column:1/-1}
    label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700}input,select,textarea{width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:7px;font:inherit}textarea{min-height:70px;resize:vertical}
    .section{grid-column:1/-1;margin-top:6px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:13px;font-weight:700}.note{grid-column:1/-1;padding:9px 10px;background:#eff6ff;border-radius:8px;font-size:12px;line-height:1.45}
    .buttons{display:flex;gap:8px;margin-top:16px}button{padding:9px 13px;border:0;border-radius:8px;font-weight:700;cursor:pointer}.primary{color:#fff;background:#2563eb}.secondary{background:#e5e7eb}.status{min-height:52px;margin-top:12px;padding:10px;background:#f3f4f6;border-radius:8px;white-space:pre-wrap;font-size:12px}.error{color:#991b1b;background:#fee2e2}
    button:disabled{opacity:.45;cursor:default}@media(max-width:700px){.grid{grid-template-columns:1fr}.full,.section,.note{grid-column:1}}
  </style>
</head>
<body>
  <h2>Add Maintenance Client</h2>
  <div class="muted">Creates the customer record and route-template placement. It does not change Google Calendar until Calendar Sync is run.</div>
  <div class="grid">
    <div class="section">Customer information</div>
    <label>Customer name<input id="name" autocomplete="name"></label>
    <label>Service address<input id="address" autocomplete="street-address"></label>
    <label>Phone<input id="phone" autocomplete="tel"></label>
    <label>Email<input id="email" type="email" autocomplete="email"></label>
    <label class="full">Notes<textarea id="notes"></textarea></label>

    <div class="section">Maintenance schedule</div>
    <label>Frequency<select id="frequency" onchange="updateWeekHelp()"><option>Weekly</option><option>Biweekly</option><option>Monthly</option></select></label>
    <label>First rotation week<select id="week"><option value="1">Week 1</option><option value="2">Week 2</option><option value="3">Week 3</option><option value="4">Week 4</option></select></label>
    <label>Service day<select id="day"><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></select></label>
    <label>Stop position<input id="stop" type="number" min="1" step="1" placeholder="Add at end of route"></label>
    <label>Service start date<input id="startDate" type="date" value="${today}"></label>
    <label>Calendar title<input id="calendarTitle" placeholder="Defaults to customer name"></label>
    <div id="weekHelp" class="note"></div>
  </div>
  <div class="buttons"><button id="saveButton" class="primary" onclick="saveClient()">Create Client</button><button class="secondary" onclick="google.script.host.close()">Cancel</button></div>
  <div id="status" class="status">Ready.</div>
<script>
function byId(id){return document.getElementById(id)}
function updateWeekHelp(){const f=byId('frequency').value;byId('weekHelp').textContent=f==='Weekly'?'Weekly creates one route stop in all four rotation weeks.':f==='Biweekly'?'Biweekly creates stops in the selected week and the opposite week two weeks later.':'Monthly creates one stop in the selected rotation week.'}
function values(){return {name:byId('name').value,address:byId('address').value,phone:byId('phone').value,email:byId('email').value,notes:byId('notes').value,frequency:byId('frequency').value,week:Number(byId('week').value),day:byId('day').value,stop:byId('stop').value,startDate:byId('startDate').value,calendarTitle:byId('calendarTitle').value}}
function saveClient(){const data=values();if(!data.name.trim()){byId('status').className='status error';byId('status').textContent='Customer name is required.';return}if(!data.address.trim()){byId('status').className='status error';byId('status').textContent='Service address is required.';return}byId('saveButton').disabled=true;byId('status').className='status';byId('status').textContent='Creating customer and route records…';google.script.run.withSuccessHandler(r=>{byId('status').className='status';byId('status').textContent=r.summary;byId('saveButton').textContent='Created';}).withFailureHandler(e=>{byId('saveButton').disabled=false;byId('status').className='status error';byId('status').textContent=e&&e.message?e.message:String(e)}).createMaintenanceClient(data)}
updateWeekHelp();
</script>
</body>
</html>`).setWidth(760).setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(html, 'Add Maintenance Client');
}

function createMaintenanceClient(input) {
  input = input || {};
  const name = String(input.name || '').trim();
  const address = String(input.address || '').trim();
  const phone = String(input.phone || '').trim();
  const email = String(input.email || '').trim();
  const notes = String(input.notes || '').trim();
  const frequency = normalizeMaintenanceFrequency_(input.frequency);
  const firstWeek = Math.max(1, Math.min(4, Number(input.week || 1)));
  const day = normalizeMaintenanceDay_(input.day);
  const requestedStop = Math.max(0, Math.floor(Number(input.stop || 0)));
  const startDate = parseMaintenanceStartDate_(input.startDate);
  const calendarTitle = String(input.calendarTitle || name).trim() || name;

  if (!name) throw new Error('Customer name is required.');
  if (!address) throw new Error('Service address is required.');

  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) throw new Error('Another PMOS operation is running. Try again after it completes.');
  try {
    const ss = SpreadsheetApp.getActive();
    const customersSheet = findFirstSheetByName_(ss, ['Customers', 'Customer Database', 'Customer List']);
    const routeSheet = findFirstSheetByName_(ss, ['4-Week Route Template', 'PMOS 4-Week Route Template', 'Route Template']);
    if (!customersSheet) throw new Error('Customers sheet was not found.');
    if (!routeSheet) throw new Error('4-Week Route Template sheet was not found.');

    const customerTable = readHeaderTable_(customersSheet);
    const routeTable = readHeaderTable_(routeSheet);
    ensureMaintenanceClientHeaders_(customersSheet, customerTable, [
      'Customer ID','Customer Name','Address','Phone','Email','Frequency','Service Start Date','Calendar Title','Notes'
    ]);
    ensureMaintenanceClientHeaders_(routeSheet, routeTable, [
      'Customer ID','Customer Name','Address','Phone','Email','Frequency','Service Start Date','Calendar Title','Layer','Stop Order'
    ]);

    const refreshedCustomers = readHeaderTable_(customersSheet);
    const refreshedRoutes = readHeaderTable_(routeSheet);
    assertMaintenanceClientNotDuplicate_(refreshedCustomers, name, address, email);

    const customerId = 'CUS-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
    const customerValues = {
      'Customer ID': customerId,
      'Customer Name': name,
      'Name': name,
      'Customer': name,
      'Address': address,
      'Service Address': address,
      'Street Address': address,
      'Phone': phone,
      'Phone Number': phone,
      'Email': email,
      'Email Address': email,
      'Frequency': frequency,
      'Service Frequency': frequency,
      'Service Start Date': startDate,
      'Start Date': startDate,
      'Calendar Title': calendarTitle,
      'Notes': notes,
      'Details': notes,
      'Status': 'Active'
    };
    appendMappedMaintenanceRow_(customersSheet, refreshedCustomers, customerValues);

    const weeks = maintenanceWeeksForFrequency_(frequency, firstWeek);
    const routeRows = [];
    weeks.forEach(week => {
      const layer = `Week ${week} - ${day}`;
      const stop = requestedStop || nextMaintenanceStopForLayer_(refreshedRoutes, layer);
      const routeValues = Object.assign({}, customerValues, {
        'Layer': layer,
        'Route Layer': layer,
        'Route Assignment': layer,
        'Week': week,
        'Rotation Week': week,
        'Day': day,
        'Weekday': day,
        'Stop': stop,
        'Stop Order': stop,
        'Order': stop
      });
      appendMappedMaintenanceRow_(routeSheet, refreshedRoutes, routeValues);
      routeRows.push({layer, stop});
      refreshedRoutes.rows.push(mappedMaintenanceRow_(refreshedRoutes.headers, routeValues));
    });

    SpreadsheetApp.flush();
    let syncSummary = '';
    try {
      const sync = synchronizeCustomerDatabaseSmart_();
      syncSummary = `${sync.routeRowsUpdated} route row(s) refreshed by Customer Database Sync.`;
    } catch (error) {
      syncSummary = `Customer and route records were created, but Customer Database Sync reported: ${error}`;
    }

    return {
      customerId,
      routeRows,
      summary: [
        'Maintenance client created.',
        `Customer: ${name}`,
        `Customer ID: ${customerId}`,
        `Frequency: ${frequency}`,
        `Route placement: ${routeRows.map(row => `${row.layer}, stop ${row.stop}`).join('; ')}`,
        `Service start date recorded: ${Utilities.formatDate(startDate, PMOS.TIMEZONE, 'yyyy-MM-dd')}`,
        syncSummary,
        '',
        'Review the route placement, then run Calendar Sync when the new client should be added to Google Calendar.'
      ].join('\n')
    };
  } finally {
    lock.releaseLock();
  }
}

function normalizeMaintenanceFrequency_(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'weekly') return 'Weekly';
  if (text === 'biweekly' || text === 'bi-weekly' || text === 'every other week') return 'Biweekly';
  if (text === 'monthly') return 'Monthly';
  throw new Error('Frequency must be Weekly, Biweekly, or Monthly.');
}

function normalizeMaintenanceDay_(value) {
  const text = String(value || '').trim();
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const match = days.find(day => day.toLowerCase() === text.toLowerCase());
  if (!match) throw new Error('Service day must be Monday through Friday.');
  return match;
}

function parseMaintenanceStartDate_(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Service start date must use YYYY-MM-DD.');
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
  if (!Number.isFinite(date.getTime())) throw new Error('Service start date is invalid.');
  return date;
}

function maintenanceWeeksForFrequency_(frequency, firstWeek) {
  if (frequency === 'Weekly') return [1,2,3,4];
  if (frequency === 'Biweekly') return [firstWeek, ((firstWeek + 1) % 4) + 1].sort((a,b) => a-b);
  return [firstWeek];
}

function ensureMaintenanceClientHeaders_(sheet, table, required) {
  const normalized = table.headers.map(normalizeSyncHeader_);
  const missing = required.filter(header => normalized.indexOf(normalizeSyncHeader_(header)) < 0);
  if (!missing.length) return;
  const startColumn = table.headers.length + 1;
  sheet.getRange(table.headerRow, startColumn, 1, missing.length).setValues([missing]);
}

function assertMaintenanceClientNotDuplicate_(table, name, address, email) {
  const nameIndex = findHeaderIndex_(table.headers, ['Customer Name','Name','Customer']);
  const addressIndex = findHeaderIndex_(table.headers, ['Address','Service Address','Street Address']);
  const emailIndex = findHeaderIndex_(table.headers, ['Email','Email Address']);
  const targetName = normalizeSyncValue_(name);
  const targetAddress = normalizeSyncValue_(address);
  const targetEmail = normalizeSyncValue_(email);
  const duplicate = table.rows.find(row => {
    const rowName = nameIndex >= 0 ? normalizeSyncValue_(row[nameIndex]) : '';
    const rowAddress = addressIndex >= 0 ? normalizeSyncValue_(row[addressIndex]) : '';
    const rowEmail = emailIndex >= 0 ? normalizeSyncValue_(row[emailIndex]) : '';
    return (targetEmail && rowEmail === targetEmail) || (rowName === targetName && rowAddress === targetAddress);
  });
  if (duplicate) throw new Error('A matching customer already exists. No new records were created.');
}

function mappedMaintenanceRow_(headers, valuesByHeader) {
  const normalizedValues = {};
  Object.keys(valuesByHeader).forEach(key => normalizedValues[normalizeSyncHeader_(key)] = valuesByHeader[key]);
  return headers.map(header => {
    const key = normalizeSyncHeader_(header);
    return Object.prototype.hasOwnProperty.call(normalizedValues, key) ? normalizedValues[key] : '';
  });
}

function appendMappedMaintenanceRow_(sheet, table, valuesByHeader) {
  const row = mappedMaintenanceRow_(table.headers, valuesByHeader);
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, table.headers.length).setValues([row]);
  return row;
}

function nextMaintenanceStopForLayer_(routeTable, layer) {
  const layerIndex = findHeaderIndex_(routeTable.headers, ['Layer','Route Layer','Route Assignment']);
  const stopIndex = findHeaderIndex_(routeTable.headers, ['Stop Order','Stop','Order']);
  let maximum = 0;
  routeTable.rows.forEach(row => {
    if (layerIndex < 0 || normalizeSyncValue_(row[layerIndex]) !== normalizeSyncValue_(layer)) return;
    const value = stopIndex >= 0 ? Number(row[stopIndex] || 0) : 0;
    if (Number.isFinite(value)) maximum = Math.max(maximum, value);
  });
  return maximum + 1;
}
