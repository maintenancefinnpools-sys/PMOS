/**
 * PMOS Calendar Safety, route snapshots, history repair, and visual repair board.
 *
 * Safety rule: no PMOS operation in this module edits calendar events before
 * the selected effective date.
 */

const PMOS_ROUTE_SNAPSHOTS_SHEET = 'PMOS Route Snapshots';
const PMOS_HISTORY_REPAIR_STATE_KEY = 'PMOS_HISTORY_REPAIR_STATE_V1';
const PMOS_RECONCILE_STATE_KEY = 'PMOS_RECONCILE_FUTURE_STATE_V1';
const PMOS_SAFETY_TRIGGER_HANDLER = 'runPmosCalendarSafetyTrigger';

function showCalendarSafetyCenter() {
  const today = Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}
    h2{margin:0 0 5px}.muted{color:#6b7280;font-size:13px;line-height:1.4}
    .card{border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-top:14px}
    label{display:block;font-weight:700;margin:8px 0 4px}
    input{padding:8px;border:1px solid #cbd5e1;border-radius:7px}
    button{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer;margin:7px 5px 0 0}
    .primary{background:#2563eb;color:#fff}.secondary{background:#e5e7eb;color:#111827}
    .status{white-space:pre-wrap;background:#f3f4f6;padding:11px;border-radius:8px;margin-top:12px;min-height:48px}
  </style>
</head>
<body>
  <h2>Calendar Safety Center</h2>
  <div class="muted">Future-only reconciliation, route snapshots, and missing-history repair. Historical events are never intentionally changed by future reconciliation.</div>

  <div class="card">
    <h3>Reconcile Future Calendar</h3>
    <label>Effective date</label>
    <input id="effectiveDate" type="date" value="${today}">
    <div>
      <button class="primary" onclick="startReconcile()">Start / Continue</button>
      <button class="secondary" onclick="previewReconcile()">Preview</button>
    </div>
  </div>

  <div class="card">
    <h3>Repair Calendar History</h3>
    <label>Start date</label><input id="historyStart" type="date">
    <label>End date</label><input id="historyEnd" type="date" value="${today}">
    <div>
      <button class="primary" onclick="previewHistory()">Preview Missing Visits</button>
      <button class="primary" onclick="startHistory()">Create Missing Visits</button>
    </div>
  </div>

  <div class="card">
    <h3>Route tools</h3>
    <button class="secondary" onclick="snapshot()">Create Route Snapshot</button>
    <button class="secondary" onclick="google.script.run.showCalendarRepairBoard()">Open Visual Repair Board</button>
  </div>

  <div id="status" class="status">Ready.</div>

<script>
  function val(id){return document.getElementById(id).value}
  function ok(result){status.textContent = result && result.summary ? result.summary : JSON.stringify(result,null,2)}
  function fail(error){status.textContent = error && error.message ? error.message : String(error)}
  function startReconcile(){status.textContent='Running future reconciliation…';google.script.run.withSuccessHandler(ok).withFailureHandler(fail).startOrContinueFutureReconcile(val('effectiveDate'))}
  function previewReconcile(){google.script.run.withSuccessHandler(ok).withFailureHandler(fail).previewFutureReconcile(val('effectiveDate'))}
  function previewHistory(){google.script.run.withSuccessHandler(ok).withFailureHandler(fail).previewCalendarHistoryRepair(val('historyStart'),val('historyEnd'))}
  function startHistory(){status.textContent='Repairing missing history…';google.script.run.withSuccessHandler(ok).withFailureHandler(fail).startOrContinueCalendarHistoryRepair(val('historyStart'),val('historyEnd'))}
  function snapshot(){google.script.run.withSuccessHandler(ok).withFailureHandler(fail).createRouteSnapshot('Manual snapshot')}
</script>
</body>
</html>`).setWidth(650).setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Calendar Safety Center');
}

function normalizeSafetyDate_(value, fallback) {
  const text = String(value || '').trim();
  const parsed = text ? new Date(text + 'T12:00:00') : new Date(fallback || new Date());
  if (!Number.isFinite(parsed.getTime())) throw new Error('A valid date is required.');
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function ensureRouteSnapshotsSheet_() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(PMOS_ROUTE_SNAPSHOTS_SHEET) || ss.insertSheet(PMOS_ROUTE_SNAPSHOTS_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Snapshot ID', 'Created At', 'Label', 'Signature', 'Route JSON']);
    sheet.hideSheet();
  }
  return sheet;
}

function createRouteSnapshot(label) {
  const sheet = ensureRouteSnapshotsSheet_();
  const routes = readRoutesInPhysicalOrder_();
  const routeJson = JSON.stringify(routes);
  const signature = Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    routeJson
  ));
  const values = sheet.getDataRange().getValues();
  const duplicate = values.slice(1).some(row => String(row[3] || '') === signature);
  purgeOldRouteSnapshots_();
  if (duplicate) {
    return {created: false, summary: 'No snapshot was added because the current route plan already has an identical snapshot.'};
  }
  const id = Utilities.getUuid();
  sheet.appendRow([id, new Date(), label || 'Route snapshot', signature, routeJson]);
  sheet.hideSheet();
  return {created: true, snapshotId: id, summary: `Route snapshot created with ${routes.length} route stops.`};
}

function purgeOldRouteSnapshots_() {
  const sheet = ensureRouteSnapshotsSheet_();
  if (sheet.getLastRow() < 2) return 0;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const keep = values.filter(row => {
    const date = row[1] instanceof Date ? row[1] : new Date(row[1]);
    return Number.isFinite(date.getTime()) && date.getTime() >= cutoff;
  });
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).clearContent();
  if (keep.length) sheet.getRange(2, 1, keep.length, 5).setValues(keep);
  return values.length - keep.length;
}

function getLatestRouteSnapshot_() {
  const sheet = ensureRouteSnapshotsSheet_();
  if (sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues()
    .filter(row => row[4])
    .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime());
  if (!rows.length) return null;
  try {
    return {id: String(rows[0][0]), createdAt: rows[0][1], label: String(rows[0][2]), routes: JSON.parse(rows[0][4])};
  } catch (error) {
    return null;
  }
}

function isPmosManagedEvent_(event) {
  const description = String(event.getDescription() || '');
  return description.indexOf('PMOS_SERIES_KEY=') >= 0 ||
    description.indexOf('PMOS_CUSTOMER_ID=') >= 0 ||
    description.indexOf(PMOS_TEMP_VISIT_MARKER) >= 0;
}

function previewFutureReconcile(effectiveDateValue) {
  const effectiveDate = normalizeSafetyDate_(effectiveDateValue, new Date());
  const calendar = getRecurringCalendar_();
  const horizon = new Date(effectiveDate);
  horizon.setFullYear(horizon.getFullYear() + 2);
  const futureEvents = calendar.getEvents(effectiveDate, horizon).filter(isPmosManagedEvent_);
  const plan = buildRecurringSeriesPlan_().filter(item => item.start.getTime() >= effectiveDate.getTime());
  return {
    effectiveDate: effectiveDate.toISOString(),
    futureEvents: futureEvents.length,
    plannedSeries: plan.length,
    summary: [
      `Effective date: ${Utilities.formatDate(effectiveDate, PMOS.TIMEZONE, 'yyyy-MM-dd')}`,
      `${futureEvents.length} future PMOS event occurrences found for removal.`,
      `${plan.length} future recurring series will be created from the verified route plan.`,
      'Events before the effective date are excluded.'
    ].join('\n')
  };
}

function startOrContinueFutureReconcile(effectiveDateValue) {
  const props = PropertiesService.getDocumentProperties();
  let state = null;
  try { state = JSON.parse(props.getProperty(PMOS_RECONCILE_STATE_KEY) || 'null'); } catch (error) {}
  const effectiveDate = state && state.effectiveDate
    ? normalizeSafetyDate_(state.effectiveDate)
    : normalizeSafetyDate_(effectiveDateValue, new Date());

  if (!state) {
    createRouteSnapshot('Before future calendar reconciliation');
    state = {
      phase: 'DELETE_FUTURE',
      effectiveDate: Utilities.formatDate(effectiveDate, PMOS.TIMEZONE, 'yyyy-MM-dd'),
      deleted: 0,
      created: 0,
      errors: 0,
      startedAt: new Date().toISOString()
    };
  }

  const calendar = getRecurringCalendar_();
  if (state.phase === 'DELETE_FUTURE') {
    const horizon = new Date(effectiveDate);
    horizon.setFullYear(horizon.getFullYear() + 2);
    const batch = calendar.getEvents(effectiveDate, horizon).filter(isPmosManagedEvent_).slice(0, 40);
    let firstError = '';
    batch.forEach(event => {
      try {
        event.deleteEvent();
        state.deleted++;
      } catch (error) {
        state.errors++;
        if (!firstError) firstError = String(error);
      }
    });
    const remaining = calendar.getEvents(effectiveDate, horizon).filter(isPmosManagedEvent_).length;
    if (remaining > 0) {
      props.setProperty(PMOS_RECONCILE_STATE_KEY, JSON.stringify(state));
      scheduleCalendarSafetyContinuation_();
      return {summary: `Future reconciliation is removing future occurrences.\n${state.deleted} removed; ${remaining} remain.${firstError ? '\n' + firstError : ''}`};
    }
    clearRecurringSeriesRegistry_();
    state.phase = 'CREATE_FUTURE';
  }

  const plan = buildRecurringSeriesPlan_().filter(item => item.start.getTime() >= effectiveDate.getTime());
  const registry = getSeriesRegistry_();
  const pending = plan.filter(item => !registry[item.seriesKey]).slice(0, 40);
  let firstError = '';
  pending.forEach(item => {
    try {
      const series = createRecurringSeries_(calendar, item);
      upsertSeriesRegistry_(item, series.getId(), calendar.getName(), 'Current');
      state.created++;
    } catch (error) {
      state.errors++;
      if (!firstError) firstError = String(error);
      markSeriesRegistryError_(item.seriesKey, String(error));
    }
  });
  const remaining = plan.filter(item => !getSeriesRegistry_()[item.seriesKey]).length;
  if (remaining > 0) {
    props.setProperty(PMOS_RECONCILE_STATE_KEY, JSON.stringify(state));
    scheduleCalendarSafetyContinuation_();
    return {summary: `Future reconciliation is creating recurring series.\n${state.created} created; ${remaining} remain.${firstError ? '\n' + firstError : ''}`};
  }

  props.deleteProperty(PMOS_RECONCILE_STATE_KEY);
  removeCalendarSafetyTrigger_();
  createRouteSnapshot('After future calendar reconciliation');
  storeRouteSignatures_();
  clearPendingChanges_();
  updateSyncStatus_('Everything synchronized', `${plan.length} future recurring series reconciled without editing history.`);
  return {
    complete: true,
    summary: `Future reconciliation complete.\n${state.deleted} future occurrences removed.\n${state.created} recurring series created.\n${state.errors} errors.\nHistorical events before ${state.effectiveDate} were not edited.`
  };
}

function buildExpectedHistoryVisits_(startDate, endDate, routes) {
  const settings = getRecurringCalendarSettings_();
  const visits = [];
  (routes || []).forEach(row => {
    const parsed = parseLayer_(row.layer);
    const dayOffsets = {Monday:0, Tuesday:1, Wednesday:2, Thursday:3, Friday:4, Saturday:5, Sunday:6};
    if (dayOffsets[parsed.day] == null) return;
    let date = new Date(settings.rotationWeek1Start);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + (parsed.week - 1) * 7 + dayOffsets[parsed.day]);
    while (date.getTime() < startDate.getTime()) date.setDate(date.getDate() + 28);
    while (date.getTime() <= endDate.getTime()) {
      const start = routeTimeForOrder_(date, row.order, settings);
      const end = new Date(start.getTime() + settings.eventDurationMinutes * 60000);
      const customerKey = row.customerId || normalize_(row.title);
      visits.push({
        key: `${Utilities.formatDate(start, PMOS.TIMEZONE, 'yyyy-MM-dd')}|${customerKey}|${row.layer}`,
        customerKey,
        customerId: row.customerId || '',
        title: row.title,
        layer: row.layer,
        start,
        end,
        location: row.address || '',
        description: buildRouteDescription_(row, parsed) + `\n\nPMOS_HISTORY_REPAIR=true\nPMOS_SERIES_KEY=${customerKey}|${row.layer}`,
        color: calendarColorForFrequency_(row.frequency)
      });
      date = new Date(date);
      date.setDate(date.getDate() + 28);
    }
  });
  return visits;
}

function findMissingHistoryVisits_(startDate, endDate) {
  const snapshot = getLatestRouteSnapshot_();
  const routes = snapshot && snapshot.routes && snapshot.routes.length ? snapshot.routes : readRoutesInPhysicalOrder_();
  const expected = buildExpectedHistoryVisits_(startDate, endDate, routes);
  const calendar = getRecurringCalendar_();
  const queryEnd = new Date(endDate);
  queryEnd.setDate(queryEnd.getDate() + 1);
  const events = calendar.getEvents(startDate, queryEnd);
  const existing = {};
  events.forEach(event => {
    const description = String(event.getDescription() || '');
    const idMatch = description.match(/PMOS_CUSTOMER_ID=([^\n]+)/);
    const customerKey = idMatch ? idMatch[1].trim() : normalize_(event.getTitle());
    const layerMatch = description.match(/PMOS_SERIES_KEY=[^|\n]*\|([^\n]+)/);
    const layer = layerMatch ? layerMatch[1].trim() : '';
    const dateKey = Utilities.formatDate(event.getStartTime(), PMOS.TIMEZONE, 'yyyy-MM-dd');
    existing[`${dateKey}|${customerKey}|${layer}`] = true;
    existing[`${dateKey}|${normalize_(event.getTitle())}|${layer}`] = true;
  });
  return {
    snapshot,
    expected,
    missing: expected.filter(item =>
      !existing[item.key] &&
      !existing[`${Utilities.formatDate(item.start, PMOS.TIMEZONE, 'yyyy-MM-dd')}|${normalize_(item.title)}|${item.layer}`]
    )
  };
}

function previewCalendarHistoryRepair(startValue, endValue) {
  const start = normalizeSafetyDate_(startValue);
  const end = normalizeSafetyDate_(endValue, new Date());
  if (end.getTime() < start.getTime()) throw new Error('History end date must be on or after the start date.');
  const result = findMissingHistoryVisits_(start, end);
  const sample = result.missing.slice(0, 12).map(item =>
    `${Utilities.formatDate(item.start, PMOS.TIMEZONE, 'yyyy-MM-dd h:mm a')} — ${item.title} (${item.layer})`
  );
  return {
    missing: result.missing.length,
    summary: [
      `${result.missing.length} missing historical visit(s) detected.`,
      result.snapshot ? `Route source: snapshot from ${Utilities.formatDate(new Date(result.snapshot.createdAt), PMOS.TIMEZONE, 'yyyy-MM-dd h:mm a')}.` : 'Route source: current route sheet.',
      sample.length ? '\nPreview:\n' + sample.join('\n') : 'No repair is required.'
    ].join('\n')
  };
}

function startOrContinueCalendarHistoryRepair(startValue, endValue) {
  const props = PropertiesService.getDocumentProperties();
  let state = null;
  try { state = JSON.parse(props.getProperty(PMOS_HISTORY_REPAIR_STATE_KEY) || 'null'); } catch (error) {}
  const start = state ? normalizeSafetyDate_(state.start) : normalizeSafetyDate_(startValue);
  const end = state ? normalizeSafetyDate_(state.end) : normalizeSafetyDate_(endValue, new Date());
  if (!state) {
    state = {
      start: Utilities.formatDate(start, PMOS.TIMEZONE, 'yyyy-MM-dd'),
      end: Utilities.formatDate(end, PMOS.TIMEZONE, 'yyyy-MM-dd'),
      created: 0,
      errors: 0,
      startedAt: new Date().toISOString()
    };
  }
  const result = findMissingHistoryVisits_(start, end);
  const batch = result.missing.slice(0, 40);
  const calendar = getRecurringCalendar_();
  let firstError = '';
  batch.forEach(item => {
    try {
      const event = calendar.createEvent(item.title, item.start, item.end, {
        description: item.description,
        location: item.location
      });
      event.setTag('PMOS_HISTORY_REPAIR', 'true');
      event.setTag('PMOS_CUSTOMER_ID', item.customerId || '');
      if (item.color) event.setColor(item.color);
      state.created++;
    } catch (error) {
      state.errors++;
      if (!firstError) firstError = String(error);
    }
  });
  const remaining = findMissingHistoryVisits_(start, end).missing.length;
  if (remaining > 0) {
    props.setProperty(PMOS_HISTORY_REPAIR_STATE_KEY, JSON.stringify(state));
    scheduleCalendarSafetyContinuation_();
    return {summary: `Calendar history repair is in progress.\n${state.created} standalone visits created; ${remaining} remain.${firstError ? '\n' + firstError : ''}`};
  }
  props.deleteProperty(PMOS_HISTORY_REPAIR_STATE_KEY);
  removeCalendarSafetyTrigger_();
  return {
    complete: true,
    summary: `Calendar history repair complete.\n${state.created} standalone visits created.\n${state.errors} errors.`
  };
}

function scheduleCalendarSafetyContinuation_() {
  const exists = ScriptApp.getProjectTriggers().some(trigger =>
    trigger.getHandlerFunction() === PMOS_SAFETY_TRIGGER_HANDLER
  );
  if (!exists) {
    ScriptApp.newTrigger(PMOS_SAFETY_TRIGGER_HANDLER).timeBased().after(60 * 1000).create();
  }
}

function removeCalendarSafetyTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === PMOS_SAFETY_TRIGGER_HANDLER)
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

function runPmosCalendarSafetyTrigger() {
  removeCalendarSafetyTrigger_();
  const props = PropertiesService.getDocumentProperties();
  if (props.getProperty(PMOS_RECONCILE_STATE_KEY)) {
    startOrContinueFutureReconcile('');
  } else if (props.getProperty(PMOS_HISTORY_REPAIR_STATE_KEY)) {
    startOrContinueCalendarHistoryRepair('', '');
  }
}

function getCalendarRepairBoardData() {
  const sheet = getRoutesSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(value => String(value).trim());
  const layerCol = headers.indexOf('Layer');
  const orderCol = headers.indexOf('Stop Order');
  const titleCol = headers.indexOf('Calendar Title');
  const idCol = headers.indexOf('Customer ID');
  if (layerCol < 0 || titleCol < 0) throw new Error('Route sheet needs Layer and Calendar Title columns.');
  return values.slice(1).map((row, index) => ({
    rowNumber: index + 2,
    customerId: idCol >= 0 ? String(row[idCol] || '') : '',
    title: String(row[titleCol] || ''),
    layer: String(row[layerCol] || ''),
    order: orderCol >= 0 ? Number(row[orderCol] || 0) : 0
  })).filter(item => item.title && item.layer);
}

function showCalendarRepairBoard() {
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    *{box-sizing:border-box}body{font-family:Arial;margin:0;padding:14px;color:#1f2937}
    h2{margin:0 0 4px}.muted{font-size:12px;color:#6b7280}.board{display:grid;grid-template-columns:repeat(4,minmax(240px,1fr));gap:12px;margin-top:14px;overflow:auto}
    .week{border:1px solid #cbd5e1;border-radius:10px;padding:9px;background:#f8fafc;min-height:500px}.week h3{margin:0 0 8px}
    .day{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:7px;margin-bottom:8px;min-height:65px}.day h4{margin:0 0 5px;font-size:12px}
    .stop{padding:7px;margin:5px 0;background:#eff6ff;border:1px solid #bfdbfe;border-radius:7px;cursor:grab;font-size:12px}
    button{margin-top:12px;border:0;border-radius:8px;padding:9px 12px;font-weight:700;background:#2563eb;color:#fff;cursor:pointer}
    #status{margin-top:10px;white-space:pre-wrap}
  </style>
</head>
<body>
  <h2>PMOS Visual Repair Board</h2>
  <div class="muted">Drag stops vertically to reorder, between weekdays to change service day, or into another week to change rotation week.</div>
  <div id="board" class="board"></div>
  <button onclick="save()">Save Route Layout</button>
  <div id="status"></div>
<script>
  const days=['Monday','Tuesday','Wednesday','Thursday','Friday'];
  let dragged=null;
  function parseLayer(layer){
    const week=(layer.match(/week\\s*(\\d)/i)||[])[1]||'1';
    const day=days.find(d=>layer.toLowerCase().includes(d.toLowerCase()))||'Monday';
    return {week:Number(week),day};
  }
  function render(items){
    board.innerHTML='';
    for(let w=1;w<=4;w++){
      const week=document.createElement('div');week.className='week';week.innerHTML='<h3>Week '+w+'</h3>';
      days.forEach(day=>{
        const lane=document.createElement('div');lane.className='day';lane.dataset.week=w;lane.dataset.day=day;lane.innerHTML='<h4>'+day+'</h4>';
        lane.ondragover=e=>e.preventDefault();
        lane.ondrop=e=>{e.preventDefault();if(dragged)lane.appendChild(dragged)};
        items.filter(i=>{const p=parseLayer(i.layer);return p.week===w&&p.day===day}).sort((a,b)=>a.order-b.order).forEach(item=>{
          const stop=document.createElement('div');stop.className='stop';stop.draggable=true;stop.dataset.row=item.rowNumber;stop.textContent=item.title;
          stop.ondragstart=()=>dragged=stop;stop.ondragend=()=>dragged=null;lane.appendChild(stop);
        });
        week.appendChild(lane);
      });
      board.appendChild(week);
    }
  }
  function save(){
    const changes=[];
    document.querySelectorAll('.day').forEach(lane=>{
      lane.querySelectorAll('.stop').forEach((stop,index)=>changes.push({rowNumber:Number(stop.dataset.row),layer:'Week '+lane.dataset.week+' - '+lane.dataset.day,order:index+1}));
    });
    status.textContent='Saving…';
    google.script.run.withSuccessHandler(r=>status.textContent=r.summary).withFailureHandler(e=>status.textContent=e.message||String(e)).saveCalendarRepairBoard(changes);
  }
  google.script.run.withSuccessHandler(render).withFailureHandler(e=>status.textContent=e.message||String(e)).getCalendarRepairBoardData();
</script>
</body>
</html>`).setWidth(1200).setHeight(760);
  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Visual Repair Board');
}

function saveCalendarRepairBoard(changes) {
  if (!Array.isArray(changes) || !changes.length) throw new Error('No route changes were supplied.');
  createRouteSnapshot('Before visual repair board save');
  const sheet = getRoutesSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(value => String(value).trim());
  const layerCol = headers.indexOf('Layer');
  const orderCol = headers.indexOf('Stop Order');
  if (layerCol < 0 || orderCol < 0) throw new Error('Route sheet needs Layer and Stop Order columns.');
  const rowsByNumber = {};
  values.slice(1).forEach((row, index) => rowsByNumber[index + 2] = row.slice());
  const orderedRows = [];
  changes.forEach(change => {
    const row = rowsByNumber[Number(change.rowNumber)];
    if (!row) return;
    row[layerCol] = String(change.layer || '');
    row[orderCol] = Number(change.order || 0);
    orderedRows.push(row);
    delete rowsByNumber[Number(change.rowNumber)];
  });
  Object.keys(rowsByNumber).sort((a, b) => Number(a) - Number(b)).forEach(key => orderedRows.push(rowsByNumber[key]));
  if (values.length > 1) sheet.getRange(2, 1, values.length - 1, values[0].length).clearContent();
  if (orderedRows.length) sheet.getRange(2, 1, orderedRows.length, values[0].length).setValues(orderedRows);
  const normalized = normalizeRoutesFromPhysicalOrder_(true);
  createRouteSnapshot('After visual repair board save');
  return {
    summary: `Route layout saved.\n${changes.length} stops placed.\n${normalized.updatedRows} calculated route fields refreshed.\nUse Reconcile Future Calendar to apply the new route plan without changing history.`
  };
}
