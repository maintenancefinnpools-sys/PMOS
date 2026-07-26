/**
 * PMOS Calendar Safety Foundation.
 * Separates future schedule reconciliation from historical calendar records.
 */

const PMOS_CALENDAR_EFFECTIVE_DATE_KEY = 'PMOS_CALENDAR_EFFECTIVE_DATE';
const PMOS_CALENDAR_RECONCILE_HORIZON_YEARS = 5;

function showCalendarSafetyCenter() {
  const effectiveDate = getCalendarEffectiveDate_();
  const formatted = Utilities.formatDate(effectiveDate, PMOS.TIMEZONE, 'yyyy-MM-dd');

  const html = HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}
        h2{margin:0 0 8px}.muted{color:#6b7280;font-size:13px;line-height:1.45}
        label{display:block;margin-top:16px;font-weight:700}
        input{margin-top:6px;padding:8px;width:180px}
        .warning{margin-top:14px;padding:11px;background:#fff7ed;border:1px solid #fdba74;border-radius:8px;font-size:13px;line-height:1.45}
        .status{margin-top:14px;padding:11px;background:#f3f4f6;border-radius:8px;white-space:pre-line;min-height:74px}
        .buttons{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
        button{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}
        .primary{background:#2563eb;color:white}.secondary{background:#e5e7eb}.danger{background:#fee2e2;color:#991b1b}
      </style>
    </head>
    <body>
      <h2>Calendar Safety Center</h2>
      <div class="muted">Future-only reconciliation. Events before the effective date are never intentionally edited or deleted.</div>

      <label for="effectiveDate">Effective date</label>
      <input id="effectiveDate" type="date" value="${formatted}">

      <div class="warning">
        Preview first. Reconcile Future Calendar deletes PMOS-managed occurrences on or after the effective date, then recreates the future recurring plan. Historical events remain in place.
      </div>

      <div id="status" class="status">Ready.</div>

      <div class="buttons">
        <button class="secondary" onclick="saveDate()">Save Effective Date</button>
        <button class="primary" onclick="preview()">Preview Reconcile</button>
        <button class="danger" onclick="runReconcile()">Reconcile Future Calendar</button>
        <button class="secondary" onclick="google.script.host.close()">Close</button>
      </div>

      <script>
        function value(){return document.getElementById('effectiveDate').value;}
        function show(result){
          document.getElementById('status').textContent = result && result.summary ? result.summary : String(result || 'Complete.');
        }
        function fail(error){
          document.getElementById('status').textContent = error && error.message ? error.message : String(error);
        }
        function saveDate(){
          google.script.run.withSuccessHandler(show).withFailureHandler(fail).saveCalendarEffectiveDate(value());
        }
        function preview(){
          google.script.run.withSuccessHandler(show).withFailureHandler(fail).previewReconcileFutureCalendar(value());
        }
        function runReconcile(){
          if(!confirm('Proceed with future-only reconciliation? Historical events before the effective date will remain untouched.')) return;
          document.getElementById('status').textContent = 'Reconciling future Calendar occurrences…';
          google.script.run.withSuccessHandler(show).withFailureHandler(fail).reconcileFutureCalendar(value(), true);
        }
      </script>
    </body>
    </html>
  `).setWidth(590).setHeight(500);

  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Calendar Safety Center');
}

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
      errors.length
        ? `${errors.length} future reconciliation error(s).`
        : `${created} future recurring series created from the effective date.`
    );

    return {
      removed,
      created,
      errors: errors.length,
      firstError: errors[0] || '',
      summary: [
        `Future-only reconciliation complete.`,
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
  const settings = getRecurringCalendarSettings_();
  const horizon = new Date(effectiveDate);
  horizon.setFullYear(horizon.getFullYear() + PMOS_CALENDAR_RECONCILE_HORIZON_YEARS);

  const managedOccurrences = calendar
    .getEvents(effectiveDate, horizon)
    .filter(isPmosManagedCalendarEvent_);

  const plans = buildRecurringSeriesPlan_()
    .map(plan => shiftPlanToEffectiveDate_(plan, effectiveDate))
    .filter(plan => !plan.until || plan.start.getTime() <= plan.until.getTime());

  return {
    calendar,
    settings,
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
