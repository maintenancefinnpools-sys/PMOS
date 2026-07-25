/**
 * PMOS v1.9.0 — Calendar plan audit and repair entry points.
 * Move-only refactor: public names and operational behavior are preserved.
 */

function showCalendarPlanAudit() {
  const audit = runCalendarPlanAudit_();


  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}
    h2{margin:0 0 6px}.muted{color:#6b7280;font-size:13px}
    .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}
    .card{padding:10px;border-radius:9px;background:#f3f4f6}
    .good{background:#dcfce7;color:#166534}.bad{background:#fee2e2;color:#991b1b}
    .warn{background:#fef3c7;color:#92400e}
    .issue{border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:10px 0}
    .issue h4{margin:0 0 6px}.meta{font-size:13px;white-space:pre-line;color:#4b5563}
    button{border:0;border-radius:7px;padding:8px 11px;font-weight:600;cursor:pointer;margin:7px 5px 0 0}
    .primary{background:#2563eb;color:white}.secondary{background:#e5e7eb}.danger{background:#fee2e2;color:#991b1b}
    .footer{position:sticky;bottom:0;background:white;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:14px}
  </style>
</head>
<body>
  <h2>Calendar Plan Audit</h2>
  <div class="muted">Nothing is written to Google Calendar during this audit.</div>


  <div class="summary">
    <div class="card"><b>${audit.customerCount}</b><br><small>customers</small></div>
    <div class="card"><b>${audit.uniqueSeriesCount}</b><br><small>unique series</small></div>
    <div class="card ${audit.canSync ? 'good' : 'bad'}"><b>${audit.errorCount}</b><br><small>blocking errors</small></div>
    <div class="card ${audit.warningCount ? 'warn' : 'good'}"><b>${audit.warningCount}</b><br><small>warnings</small></div>
    <div class="card"><b>${audit.routeRowCount}</b><br><small>route rows</small></div>
    <div class="card"><b>${audit.expectedByFrequency.total}</b><br><small>frequency estimate</small></div>
  </div>


  <div>
    ${audit.issues.length ? audit.issues.map(issue => `
      <div class="issue">
        <h4>${escapeHtmlClient_(issue.title)}</h4>
        <div class="meta">${escapeHtmlClient_(issue.details)}</div>
        ${issue.row ? `<button class="secondary" onclick="openRow(${issue.row})">Go to row ${issue.row}</button>` : ''}
        ${issue.fix === 'REN_NUMBER' ? `<button class="primary" onclick="renumber()">Renumber stops</button>` : ''}
        ${issue.fix === 'ASSIGN_IDS' ? `<button class="primary" onclick="assignIds()">Assign missing IDs</button>` : ''}
      </div>
    `).join('') : `<div class="card good"><b>Calendar plan verified.</b><br>No blocking errors were found.</div>`}
  </div>


  <div class="footer">
    <button class="secondary" onclick="refreshAudit()">Run Audit Again</button>
    ${audit.canSync ? `<button class="primary" onclick="openSync()">Open Calendar Sync</button>` : ''}
    <button class="secondary" onclick="google.script.host.close()">Close</button>
  </div>


<script>
function escapeHtmlClient_(value){
  return String(value||'').replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function openRow(row){
  google.script.run.activateRouteRow(row);
}
function renumber(){
  google.script.run.withSuccessHandler(refreshAudit).auditFixRouteNumbers();
}
function assignIds(){
  google.script.run.withSuccessHandler(refreshAudit).auditFixCustomerIds();
}
function refreshAudit(){
  google.script.host.close();
  google.script.run.showCalendarPlanAudit();
}
function openSync(){
  google.script.run
    .withSuccessHandler(function(){
      google.script.host.close();
    })
    .withFailureHandler(function(error){
      alert(error && error.message ? error.message : String(error));
    })
    .openCalendarSyncFromAudit();
}
</script>
</body>
</html>`)
    .setWidth(760)
    .setHeight(680);


  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Calendar Plan Audit');
}

function openCalendarSyncFromAudit() {
  return openCalendarSyncFromAudit_();
}

function activateRouteRow(rowNumber) {
  return activateRouteRow_(rowNumber);
}

function auditFixRouteNumbers() {
  return auditFixRouteNumbers_();
}

function auditFixCustomerIds() {
  return auditFixCustomerIds_();
}

function openCalendarSyncFromAudit_() {
  const audit = runCalendarPlanAudit_();


  if (!audit.canSync) {
    throw new Error(
      `Calendar Plan Audit still has ${audit.errorCount} blocking error(s).`
    );
  }


  showPmosJobEngineFor_('CALENDAR_SYNC');
  return true;
}

function runCalendarPlanAudit_() {
  ensureSupportSheets_();
  ensureCustomerIds_();
  ensureRouteCustomerIdColumn_();


  const sheet = getRoutesSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(value => String(value || '').trim());


  const column = {};
  headers.forEach((header, index) => column[header] = index);


  const requiredHeaders = [
    'Layer',
    'Stop Order',
    'Calendar Title',
    'Customer ID'
  ];


  const issues = [];
  requiredHeaders.forEach(header => {
    if (column[header] == null) {
      issues.push({
        severity: 'ERROR',
        code: 'MISSING_COLUMN',
        title: `Missing required column: ${header}`,
        details: `Add the ${header} column to the 4-Week Route Template.`,
        row: 0,
        fix: ''
      });
    }
  });


  if (issues.length) {
    return finalizeCalendarAudit_(issues, 0, 0, 0, {
      weekly: 0, biweekly: 0, monthly: 0, twiceWeeklyExtra: 0, total: 0
    });
  }


  const rows = [];
  const customerIds = new Set();
  const uniqueSeries = new Map();
  const layers = new Map();


  for (let index = 1; index < values.length; index++) {
    const raw = values[index];
    if (!raw.some(value => value !== '' && value != null)) continue;


    const layer = String(raw[column['Layer']] || '').trim();
    const title = String(raw[column['Calendar Title']] || '').trim();
    const customerId = String(raw[column['Customer ID']] || '').trim();
    const orderRaw = raw[column['Stop Order']];
    const order = Number(orderRaw);
    const rowNumber = index + 1;


    if (!layer && !title && !customerId) continue;


    const parsed = safeParseLayerForAudit_(layer);
    const row = {
      rowNumber,
      layer,
      title,
      customerId,
      order,
      parsed
    };
    rows.push(row);


    if (customerId) customerIds.add(customerId);


    if (!customerId) {
      issues.push({
        severity: 'ERROR',
        code: 'MISSING_ID',
        title: `Missing Customer ID — ${title || 'unnamed customer'}`,
        details: `${layer || 'No layer'}\nSpreadsheet row ${rowNumber}`,
        row: rowNumber,
        fix: 'ASSIGN_IDS'
      });
    }


    if (!title) {
      issues.push({
        severity: 'ERROR',
        code: 'MISSING_TITLE',
        title: 'Missing Calendar Title',
        details: `${layer || 'No layer'}\nSpreadsheet row ${rowNumber}`,
        row: rowNumber,
        fix: ''
      });
    }


    if (!parsed.valid) {
      issues.push({
        severity: 'ERROR',
        code: 'INVALID_LAYER',
        title: `Invalid route layer — ${layer || 'blank'}`,
        details: `Row ${rowNumber}\nExpected a layer containing Week 1–4 and Monday–Friday.`,
        row: rowNumber,
        fix: ''
      });
    } else if (parsed.day === 'Saturday' || parsed.day === 'Sunday') {
      issues.push({
        severity: 'ERROR',
        code: 'WEEKEND_LAYER',
        title: `Weekend service layer — ${layer}`,
        details: `${title}\nRow ${rowNumber}\nWeekend service is not currently enabled.`,
        row: rowNumber,
        fix: ''
      });
    }


    if (!Number.isFinite(order) || order < 1 || Math.floor(order) !== order) {
      issues.push({
        severity: 'ERROR',
        code: 'INVALID_STOP',
        title: `Invalid stop number — ${title || layer}`,
        details: `Found: ${orderRaw}\nRow ${rowNumber}`,
        row: rowNumber,
        fix: 'REN_NUMBER'
      });
    }


    if (parsed.valid) {
      if (!layers.has(layer)) layers.set(layer, []);
      layers.get(layer).push(row);
    }


    const key = `${customerId || normalize_(title)}|${layer}`;
    if (uniqueSeries.has(key)) {
      const first = uniqueSeries.get(key);
      issues.push({
        severity: 'ERROR',
        code: 'DUPLICATE_SERIES',
        title: `Duplicate route entry — ${title}`,
        details: `${layer}\nRows ${first.rowNumber} and ${rowNumber}\nRemove one duplicate row or correct its route assignment.`,
        row: rowNumber,
        fix: ''
      });
    } else {
      uniqueSeries.set(key, row);
    }
  }


  layers.forEach((layerRows, layer) => {
    const seenOrders = new Map();
    const sorted = layerRows.slice().sort((a, b) => a.rowNumber - b.rowNumber);


    sorted.forEach((row, index) => {
      const expectedOrder = index + 1;


      if (seenOrders.has(row.order)) {
        issues.push({
          severity: 'ERROR',
          code: 'DUPLICATE_STOP',
          title: `Duplicate stop ${row.order} — ${layer}`,
          details: `Rows ${seenOrders.get(row.order)} and ${row.rowNumber}`,
          row: row.rowNumber,
          fix: 'REN_NUMBER'
        });
      } else {
        seenOrders.set(row.order, row.rowNumber);
      }


      if (row.order !== expectedOrder) {
        issues.push({
          severity: 'WARNING',
          code: 'STOP_SEQUENCE',
          title: `Stop sequence needs refresh — ${layer}`,
          details: `Row ${row.rowNumber} is stop ${row.order}; expected ${expectedOrder} from physical row order.`,
          row: row.rowNumber,
          fix: 'REN_NUMBER'
        });
      }
    });


    const settings = getRecurringCalendarSettings_();
    const parsed = safeParseLayerForAudit_(layer);


    if (parsed.valid && layerRows.length) {
      const lastStop = Math.max(
        ...layerRows.map(row => Number.isFinite(row.order) ? row.order : 1)
      );
      const sampleDate = new Date(2026, 6, 13, 12, 0, 0, 0);
      sampleDate.setDate(sampleDate.getDate() + (parsed.week - 1) * 7 + parsed.dayOffset);
      const start = routeTimeForOrder_(sampleDate, lastStop, settings);


      if (start.getDay() !== sampleDate.getDay()) {
        issues.push({
          severity: 'ERROR',
          code: 'TIME_OVERFLOW',
          title: `Route time crosses into the next day — ${layer}`,
          details: `Last stop ${lastStop} calculates to ${Utilities.formatDate(start, PMOS.TIMEZONE, 'EEEE h:mm a')}.\nReduce route length or adjust timing.`,
          row: layerRows[layerRows.length - 1].rowNumber,
          fix: ''
        });
      }
    }
  });


  const frequencyEstimate = estimateSeriesByFrequency_();
  const routeRowCount = rows.length;
  const uniqueSeriesCount = uniqueSeries.size;


  if (
    frequencyEstimate.total > 0 &&
    uniqueSeriesCount > frequencyEstimate.total + 8
  ) {
    issues.push({
      severity: 'ERROR',
      code: 'SERIES_COUNT_HIGH',
      title: 'Calculated series count is unexpectedly high',
      details:
        `Unique route series: ${uniqueSeriesCount}\n` +
        `Frequency-based estimate: ${frequencyEstimate.total}\n` +
        `Review duplicate route assignments and customer frequencies.`,
      row: 0,
      fix: ''
    });
  }


  return finalizeCalendarAudit_(
    issues,
    customerIds.size,
    routeRowCount,
    uniqueSeriesCount,
    frequencyEstimate
  );
}

function finalizeCalendarAudit_(
  issues,
  customerCount,
  routeRowCount,
  uniqueSeriesCount,
  expectedByFrequency
) {
  const errors = issues.filter(issue => issue.severity === 'ERROR');
  const warnings = issues.filter(issue => issue.severity === 'WARNING');


  return {
    canSync: errors.length === 0,
    customerCount,
    routeRowCount,
    uniqueSeriesCount,
    expectedByFrequency,
    errorCount: errors.length,
    warningCount: warnings.length,
    issues: errors.concat(warnings).slice(0, 150),
    auditedAt: new Date().toISOString()
  };
}

function estimateSeriesByFrequency_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.CUSTOMERS_SHEET);
  if (!sheet) {
    return {
      weekly: 0,
      biweekly: 0,
      monthly: 0,
      twiceWeeklyExtra: 0,
      total: 0
    };
  }


  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(value => String(value || '').trim());
  const frequencyCol = headers.indexOf('Frequency');
  const daysCol = headers.indexOf('Route Day(s)');
  const titleCol = headers.indexOf('Calendar Title');
  const fullNameCol = headers.indexOf('Full Name(s)');


  const result = {
    weekly: 0,
    biweekly: 0,
    monthly: 0,
    twiceWeeklyExtra: 0,
    total: 0
  };


  values.slice(1).forEach(row => {
    const hasCustomer =
      (titleCol >= 0 && String(row[titleCol] || '').trim()) ||
      (fullNameCol >= 0 && String(row[fullNameCol] || '').trim());


    if (!hasCustomer) return;


    const frequency = normalize_(
      frequencyCol >= 0 ? row[frequencyCol] : ''
    );
    const days = daysCol >= 0
      ? parseCustomerDays_(row[daysCol]).length
      : 1;
    const serviceDays = Math.max(1, days);


    if (frequency.includes('weekly')) {
      result.weekly++;
      result.total += 4 * serviceDays;
      if (serviceDays > 1) {
        result.twiceWeeklyExtra += 4 * (serviceDays - 1);
      }
    } else if (
      frequency.includes('biweekly') ||
      frequency.includes('bi-weekly') ||
      frequency.includes('2 week')
    ) {
      result.biweekly++;
      result.total += 2 * serviceDays;
    } else if (
      frequency.includes('monthly') ||
      frequency.includes('4 week')
    ) {
      result.monthly++;
      result.total += 1 * serviceDays;
    }
  });


  return result;
}

function safeParseLayerForAudit_(layer) {
  const text = String(layer || '');
  const weekMatch = text.match(/Week\s*([1-4])/i);
  const days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
  ];
  const day = days.find(value =>
    text.toLowerCase().includes(value.toLowerCase())
  ) || '';


  const offsets = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6
  };


  return {
    valid: Boolean(weekMatch && day),
    week: weekMatch ? Number(weekMatch[1]) : 0,
    day,
    dayOffset: offsets[day] == null ? 0 : offsets[day]
  };
}

function activateRouteRow_(rowNumber) {
  const sheet = getRoutesSheet_();
  const row = Math.max(2, Number(rowNumber || 2));
  sheet.activate();
  sheet.getRange(row, 1).activate();
}

function auditFixRouteNumbers_() {
  return normalizeRoutesFromPhysicalOrder_(true);
}

function auditFixCustomerIds_() {
  const idsCreated = ensureCustomerIds_();
  synchronizeCustomerDatabase_(true);
  return {idsCreated};
}

