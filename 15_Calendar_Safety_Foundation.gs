/**
 * PMOS Calendar safety and date-range repair workflow.
 */

const PMOS_CALENDAR_EFFECTIVE_DATE_KEY = 'PMOS_CALENDAR_EFFECTIVE_DATE';
const PMOS_CALENDAR_RECONCILE_HORIZON_YEARS = 5;
const PMOS_CALENDAR_REPAIR_PLAN_KEY = 'PMOS_CALENDAR_REPAIR_PLAN_V1';

function saveCalendarEffectiveDate(value) {
  const date = parseCalendarEffectiveDate_(value);
  PropertiesService.getDocumentProperties().setProperty(
    PMOS_CALENDAR_EFFECTIVE_DATE_KEY,
    Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd')
  );
  return {summary: `Effective date saved: ${Utilities.formatDate(date, PMOS.TIMEZONE, 'MMMM d, yyyy')}`};
}

function getCalendarEffectiveDate_() {
  const stored = PropertiesService.getDocumentProperties().getProperty(PMOS_CALENDAR_EFFECTIVE_DATE_KEY);
  return parseCalendarEffectiveDate_(stored || Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd'));
}

function parseCalendarEffectiveDate_(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Effective date must use YYYY-MM-DD.');
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
  if (!Number.isFinite(date.getTime())) throw new Error('Effective date is invalid.');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() < today.getTime()) {
    throw new Error('The effective date cannot be earlier than today. Historical Calendar records are protected.');
  }
  return date;
}

function previewReconcileFutureCalendar(value) {
  const effectiveDate = parseCalendarEffectiveDate_(value);
  const preview = buildFutureReconcilePreview_(effectiveDate);
  return {
    effectiveDate: preview.effectiveDate,
    managedOccurrencesToRemove: preview.managedOccurrences.length,
    recurringSeriesToCreate: preview.plans.length,
    summary: [
      `Effective date: ${preview.effectiveDate}`,
      `PMOS-managed future occurrences to remove: ${preview.managedOccurrences.length}`,
      `Future recurring series to create: ${preview.plans.length}`,
      '',
      'No Calendar changes were made.'
    ].join('\n')
  };
}

function reconcileFutureCalendar(value, confirmed) {
  if (confirmed !== true) throw new Error('Reconciliation requires explicit confirmation.');
  const effectiveDate = parseCalendarEffectiveDate_(value);
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) throw new Error('Another PMOS operation is running. Try again after it completes.');

  try {
    const preview = buildFutureReconcilePreview_(effectiveDate);
    let removed = 0;
    let created = 0;
    const errors = [];

    preview.managedOccurrences.forEach(event => {
      try {
        if (event.getStartTime().getTime() >= effectiveDate.getTime()) {
          event.deleteEvent();
          removed++;
        }
      } catch (error) {
        errors.push(`Delete ${event.getTitle()}: ${error}`);
      }
    });

    clearRecurringSeriesRegistry_();
    preview.plans.forEach(plan => {
      try {
        const series = createRecurringSeries_(preview.calendar, plan);
        upsertSeriesRegistry_(plan, series.getId(), preview.calendar.getName(), 'Current');
        created++;
      } catch (error) {
        errors.push(`Create ${plan.title}: ${error}`);
      }
    });

    PropertiesService.getDocumentProperties().setProperty(
      PMOS_CALENDAR_EFFECTIVE_DATE_KEY,
      Utilities.formatDate(effectiveDate, PMOS.TIMEZONE, 'yyyy-MM-dd')
    );

    updateSyncStatus_(
      errors.length ? 'Synchronization error' : 'Everything synchronized',
      errors.length ? `${errors.length} future reconciliation error(s).` : `${created} future recurring series created from the effective date.`
    );

    return {
      removed,
      created,
      errors: errors.length,
      summary: [
        'Future-only reconciliation complete.',
        `Historical events before ${Utilities.formatDate(effectiveDate, PMOS.TIMEZONE, 'MMMM d, yyyy')} were not intentionally changed.`,
        `Future occurrences removed: ${removed}`,
        `Recurring series created: ${created}`,
        `Errors: ${errors.length}`,
        errors.length ? `First error: ${errors[0]}` : ''
      ].filter(Boolean).join('\n')
    };
  } finally {
    lock.releaseLock();
  }
}

function buildFutureReconcilePreview_(effectiveDate) {
  const calendar = getRecurringCalendar_();
  const horizon = new Date(effectiveDate);
  horizon.setFullYear(horizon.getFullYear() + PMOS_CALENDAR_RECONCILE_HORIZON_YEARS);
  const managedOccurrences = calendar.getEvents(effectiveDate, horizon).filter(isPmosManagedCalendarEvent_);
  const plans = buildRecurringSeriesPlan_()
    .map(plan => shiftPlanToEffectiveDate_(plan, effectiveDate))
    .filter(plan => !plan.until || plan.start.getTime() <= plan.until.getTime());
  return {
    calendar,
    managedOccurrences,
    plans,
    effectiveDate: Utilities.formatDate(effectiveDate, PMOS.TIMEZONE, 'yyyy-MM-dd'),
    horizon
  };
}

function shiftPlanToEffectiveDate_(plan, effectiveDate) {
  const shifted = Object.assign({}, plan);
  shifted.start = new Date(plan.start);
  shifted.end = new Date(plan.end);
  while (shifted.start.getTime() < effectiveDate.getTime()) {
    shifted.start.setDate(shifted.start.getDate() + 28);
    shifted.end.setDate(shifted.end.getDate() + 28);
  }
  shifted.signature = recurringSeriesSignature_(shifted);
  return shifted;
}

function isPmosManagedCalendarEvent_(event) {
  const description = String(event.getDescription() || '');
  return description.indexOf('PMOS_SERIES_KEY=') >= 0 ||
    description.indexOf('PMOS_CUSTOMER_ID=') >= 0 ||
    description.indexOf(PMOS_TEMP_VISIT_MARKER) >= 0;
}

function parseRepairDate_(value, label) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`${label} must use YYYY-MM-DD.`);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} is invalid.`);
  return date;
}

function buildExpectedRepairVisits_(startDate, endDate) {
  const settings = getRecurringCalendarSettings_();
  const routes = readRoutesInPhysicalOrder_();
  const offsets = {Monday:0, Tuesday:1, Wednesday:2, Thursday:3, Friday:4, Saturday:5, Sunday:6};
  const visits = [];

  routes.forEach(row => {
    const parsed = parseLayer_(row.layer);
    if (offsets[parsed.day] == null) return;
    let date = new Date(settings.rotationWeek1Start);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + (parsed.week - 1) * 7 + offsets[parsed.day]);
    while (date.getTime() < startDate.getTime()) date.setDate(date.getDate() + 28);

    while (date.getTime() <= endDate.getTime()) {
      const visitDate = new Date(date);
      const start = routeTimeForOrder_(visitDate, row.order, settings);
      const end = new Date(start.getTime() + settings.eventDurationMinutes * 60000);
      visits.push({
        id: Utilities.getUuid(),
        customerId: row.customerId || '',
        title: row.title,
        layer: row.layer,
        order: Number(row.order || 1),
        date: Utilities.formatDate(visitDate, PMOS.TIMEZONE, 'yyyy-MM-dd'),
        start: start.toISOString(),
        end: end.toISOString(),
        address: row.address || '',
        description: buildRouteDescription_(row, parsed),
        frequency: row.frequency || '',
        color: calendarColorForFrequency_(row.frequency)
      });
      date = new Date(date);
      date.setDate(date.getDate() + 28);
    }
  });
  return visits;
}

function repairVisitExists_(events, visit) {
  const visitDate = visit.date;
  return events.some(event => {
    const date = Utilities.formatDate(event.getStartTime(), PMOS.TIMEZONE, 'yyyy-MM-dd');
    if (date !== visitDate) return false;
    const description = String(event.getDescription() || '');
    if (visit.customerId && description.indexOf(`PMOS_CUSTOMER_ID=${visit.customerId}`) >= 0) return true;
    return normalize_(event.getTitle()) === normalize_(visit.title);
  });
}

function buildCalendarRepairPlan_(start, end) {
  const calendar = getRecurringCalendar_();
  const queryEnd = new Date(end);
  queryEnd.setDate(queryEnd.getDate() + 1);
  const events = calendar.getEvents(start, queryEnd);
  const expected = buildExpectedRepairVisits_(start, end);
  const missing = expected.filter(visit => !repairVisitExists_(events, visit));
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    start: Utilities.formatDate(start, PMOS.TIMEZONE, 'yyyy-MM-dd'),
    end: Utilities.formatDate(end, PMOS.TIMEZONE, 'yyyy-MM-dd'),
    items: missing
  };
}

function saveRepairPlan_(plan) {
  PropertiesService.getDocumentProperties().setProperty(PMOS_CALENDAR_REPAIR_PLAN_KEY, JSON.stringify(plan));
  return plan;
}

function readRepairPlan_() {
  const text = PropertiesService.getDocumentProperties().getProperty(PMOS_CALENDAR_REPAIR_PLAN_KEY);
  if (!text) return null;
  try { return JSON.parse(text); } catch (error) { return null; }
}

function previewCalendarRepairPlan(startValue, endValue) {
  const start = parseRepairDate_(startValue, 'Begin date');
  const end = parseRepairDate_(endValue, 'End date');
  if (end.getTime() < start.getTime()) throw new Error('End date must be on or after begin date.');
  const plan = saveRepairPlan_(buildCalendarRepairPlan_(start, end));
  const sample = plan.items.slice(0, 12).map(item => `${item.date} — ${item.title} (${item.layer}, stop ${item.order})`);
  return {
    missing: plan.items.length,
    summary: [
      `Repair range: ${plan.start} through ${plan.end}`,
      `Missing visits found: ${plan.items.length}`,
      sample.length ? `\nPreview:\n${sample.join('\n')}` : '\nNo repair is required.',
      plan.items.length ? '\nUse Expand Preview / Edit Route Order to drag customers before applying.' : ''
    ].join('\n')
  };
}

function openCalendarRepairBoard(startValue, endValue) {
  const start = parseRepairDate_(startValue, 'Begin date');
  const end = parseRepairDate_(endValue, 'End date');
  let plan = readRepairPlan_();
  const startText = Utilities.formatDate(start, PMOS.TIMEZONE, 'yyyy-MM-dd');
  const endText = Utilities.formatDate(end, PMOS.TIMEZONE, 'yyyy-MM-dd');
  if (!plan || plan.start !== startText || plan.end !== endText) {
    plan = saveRepairPlan_(buildCalendarRepairPlan_(start, end));
  }

  const lanes = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const day = Utilities.formatDate(cursor, PMOS.TIMEZONE, 'EEEE');
    if (['Monday','Tuesday','Wednesday','Thursday','Friday'].indexOf(day) >= 0) {
      lanes.push({date: Utilities.formatDate(cursor, PMOS.TIMEZONE, 'yyyy-MM-dd'), day});
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{font-family:Arial;margin:0;padding:14px;color:#1f2937}h2{margin:0 0 4px}.muted{font-size:12px;color:#6b7280}.board{display:flex;gap:10px;overflow:auto;margin-top:14px;padding-bottom:10px}.lane{min-width:220px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:9px;padding:8px;min-height:420px}.lane h3{font-size:13px;margin:0 0 7px}.stop{padding:8px;margin:6px 0;background:#eff6ff;border:1px solid #bfdbfe;border-radius:7px;cursor:grab;font-size:12px}.buttons{display:flex;gap:8px;margin-top:12px}button{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e5e7eb}.status{margin-top:10px;white-space:pre-wrap}
</style></head><body>
<h2>Calendar Repair Preview</h2><div class="muted">Drag customers between dates or vertically within a date. Their order becomes the stop order for that repair date. Save the edited preview, then return to the Job Engine and apply it.</div>
<div id="board" class="board"></div><div class="buttons"><button class="primary" onclick="save()">Save Edited Preview</button><button class="secondary" onclick="google.script.host.close()">Close</button></div><div id="status" class="status"></div>
<script>
const lanes=${JSON.stringify(lanes)};const items=${JSON.stringify(plan.items)};let dragged=null;
function render(){board.innerHTML='';lanes.forEach(l=>{const lane=document.createElement('div');lane.className='lane';lane.dataset.date=l.date;lane.innerHTML='<h3>'+l.day+'<br>'+l.date+'</h3>';lane.ondragover=e=>e.preventDefault();lane.ondrop=e=>{e.preventDefault();if(dragged)lane.appendChild(dragged)};items.filter(i=>i.date===l.date).sort((a,b)=>a.order-b.order).forEach(i=>{const c=document.createElement('div');c.className='stop';c.draggable=true;c.dataset.id=i.id;c.textContent=i.title;c.ondragstart=()=>dragged=c;c.ondragend=()=>dragged=null;lane.appendChild(c)});board.appendChild(lane)})}
function save(){const changes=[];document.querySelectorAll('.lane').forEach(l=>l.querySelectorAll('.stop').forEach((c,index)=>changes.push({id:c.dataset.id,date:l.dataset.date,order:index+1})));status.textContent='Saving edited preview…';google.script.run.withSuccessHandler(r=>status.textContent=r.summary).withFailureHandler(e=>status.textContent=e.message||String(e)).saveCalendarRepairBoardPlan(changes)}render();
</script></body></html>`).setWidth(1200).setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Calendar Repair Preview');
  return {summary: `Expanded repair preview opened with ${plan.items.length} missing visit(s).`};
}

function saveCalendarRepairBoardPlan(changes) {
  if (!Array.isArray(changes)) throw new Error('Edited repair data is missing.');
  const plan = readRepairPlan_();
  if (!plan) throw new Error('Run Calendar Repair Preview first.');
  const byId = {};
  changes.forEach(change => byId[String(change.id)] = change);
  const settings = getRecurringCalendarSettings_();

  plan.items = plan.items.map(item => {
    const change = byId[String(item.id)];
    if (!change) return item;
    const date = parseRepairDate_(change.date, 'Repair date');
    const order = Math.max(1, Number(change.order || 1));
    const start = routeTimeForOrder_(date, order, settings);
    item.date = Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd');
    item.order = order;
    item.start = start.toISOString();
    item.end = new Date(start.getTime() + settings.eventDurationMinutes * 60000).toISOString();
    return item;
  });
  saveRepairPlan_(plan);
  return {summary: `Edited repair preview saved. ${plan.items.length} visit(s) are ready to apply from the Job Engine.`};
}

function applyCalendarRepairPlan(startValue, endValue) {
  const start = parseRepairDate_(startValue, 'Begin date');
  const end = parseRepairDate_(endValue, 'End date');
  const startText = Utilities.formatDate(start, PMOS.TIMEZONE, 'yyyy-MM-dd');
  const endText = Utilities.formatDate(end, PMOS.TIMEZONE, 'yyyy-MM-dd');
  let plan = readRepairPlan_();
  if (!plan || plan.start !== startText || plan.end !== endText) {
    plan = saveRepairPlan_(buildCalendarRepairPlan_(start, end));
  }

  const calendar = getRecurringCalendar_();
  const queryEnd = new Date(end);
  queryEnd.setDate(queryEnd.getDate() + 1);
  const existing = calendar.getEvents(start, queryEnd);
  let created = 0;
  let skipped = 0;
  const errors = [];

  plan.items.forEach(item => {
    if (repairVisitExists_(existing, item)) { skipped++; return; }
    try {
      const parsed = parseLayer_(item.layer);
      const description = [
        item.description,
        '',
        'PMOS_HISTORY_REPAIR=true',
        item.customerId ? `PMOS_CUSTOMER_ID=${item.customerId}` : '',
        `PMOS_REPAIR_ORIGINAL_LAYER=${item.layer}`,
        `PMOS_REPAIR_APPLIED_DATE=${item.date}`,
        `PMOS_REPAIR_STOP_ORDER=${item.order}`
      ].filter(Boolean).join('\n');
      const event = calendar.createEvent(item.title, new Date(item.start), new Date(item.end), {
        description,
        location: item.address || ''
      });
      if (item.color) event.setColor(item.color);
      created++;
      existing.push(event);
    } catch (error) {
      errors.push(`${item.date} ${item.title}: ${error}`);
    }
  });

  PropertiesService.getDocumentProperties().deleteProperty(PMOS_CALENDAR_REPAIR_PLAN_KEY);
  return {
    summary: [
      'Calendar repair complete.',
      `Date range: ${plan.start} through ${plan.end}`,
      `Visits created: ${created}`,
      `Already present and skipped: ${skipped}`,
      `Errors: ${errors.length}`,
      errors.length ? `First error: ${errors[0]}` : ''
    ].filter(Boolean).join('\n')
  };
}
