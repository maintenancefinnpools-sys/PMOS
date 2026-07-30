/**
 * PMOS Calendar safety and date-range repair workflow.
 * Shared constants live in 15-0_Calendar_Constants.gs.
 */

function saveCalendarEffectiveDate(value) {
  const date = parseCalendarEffectiveDate_(value);
  PropertiesService.getDocumentProperties().setProperty(
    PMOS_CALENDAR_CONFIG.EFFECTIVE_DATE_KEY,
    Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd')
  );
  return {
    summary: 'Effective date saved: ' +
      Utilities.formatDate(date, PMOS.TIMEZONE, 'MMMM d, yyyy')
  };
}

function getCalendarEffectiveDate_() {
  const stored = PropertiesService.getDocumentProperties().getProperty(
    PMOS_CALENDAR_CONFIG.EFFECTIVE_DATE_KEY
  );
  return parseCalendarEffectiveDate_(
    stored || Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd')
  );
}

function parseCalendarEffectiveDate_(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Effective date must use YYYY-MM-DD.');

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    0,
    0,
    0,
    0
  );
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Effective date is invalid.');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() < today.getTime()) {
    throw new Error(
      'The effective date cannot be earlier than today. ' +
      'Historical Calendar records are protected.'
    );
  }
  return date;
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
  if (!match) throw new Error(label + ' must use YYYY-MM-DD.');
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    0,
    0,
    0,
    0
  );
  if (!Number.isFinite(date.getTime())) {
    throw new Error(label + ' is invalid.');
  }
  return date;
}

function buildExpectedRepairVisits_(startDate, endDate) {
  const settings = getRecurringCalendarSettings_();
  const routes = readRoutesInPhysicalOrder_();
  const offsets = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6
  };
  const visits = [];

  routes.forEach(function (row) {
    const parsed = parseLayer_(row.layer);
    if (offsets[parsed.day] == null) return;

    let date = new Date(settings.rotationWeek1Start);
    date.setHours(0, 0, 0, 0);
    date.setDate(
      date.getDate() + (parsed.week - 1) * 7 + offsets[parsed.day]
    );
    while (date.getTime() < startDate.getTime()) {
      date.setDate(date.getDate() + 28);
    }

    while (date.getTime() <= endDate.getTime()) {
      const visitDate = new Date(date);
      const start = routeTimeForOrder_(visitDate, row.order, settings);
      visits.push({
        id: Utilities.getUuid(),
        customerId: row.customerId || '',
        title: row.title,
        layer: row.layer,
        order: Number(row.order || 1),
        date: Utilities.formatDate(visitDate, PMOS.TIMEZONE, 'yyyy-MM-dd'),
        start: start.toISOString(),
        end: new Date(
          start.getTime() + settings.eventDurationMinutes * 60000
        ).toISOString(),
        address: row.address || '',
        description: buildRouteDescription_(row, parsed),
        frequency: row.frequency || '',
        color: calendarColorForFrequency_(row.frequency)
      });
      date.setDate(date.getDate() + 28);
    }
  });
  return visits;
}

function repairVisitExists_(events, visit) {
  return events.some(function (event) {
    const date = Utilities.formatDate(
      event.getStartTime(),
      PMOS.TIMEZONE,
      'yyyy-MM-dd'
    );
    if (date !== visit.date) return false;
    const description = String(event.getDescription() || '');
    if (
      visit.customerId &&
      description.indexOf('PMOS_CUSTOMER_ID=' + visit.customerId) >= 0
    ) {
      return true;
    }
    return normalize_(event.getTitle()) === normalize_(visit.title);
  });
}

function buildCalendarRepairPlan_(start, end) {
  const calendar = getRecurringCalendar_();
  const queryEnd = new Date(end);
  queryEnd.setDate(queryEnd.getDate() + 1);
  const events = calendar.getEvents(start, queryEnd);
  const expected = buildExpectedRepairVisits_(start, end);
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    start: Utilities.formatDate(start, PMOS.TIMEZONE, 'yyyy-MM-dd'),
    end: Utilities.formatDate(end, PMOS.TIMEZONE, 'yyyy-MM-dd'),
    items: expected.filter(function (visit) {
      return !repairVisitExists_(events, visit);
    })
  };
}

function saveRepairPlan_(plan) {
  PropertiesService.getDocumentProperties().setProperty(
    PMOS_CALENDAR_CONFIG.REPAIR_PLAN_KEY,
    JSON.stringify(plan)
  );
  return plan;
}

function readRepairPlan_() {
  const text = PropertiesService.getDocumentProperties().getProperty(
    PMOS_CALENDAR_CONFIG.REPAIR_PLAN_KEY
  );
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function previewCalendarRepairPlan(startValue, endValue) {
  const start = parseRepairDate_(startValue, 'Begin date');
  const end = parseRepairDate_(endValue, 'End date');
  if (end.getTime() < start.getTime()) {
    throw new Error('End date must be on or after begin date.');
  }
  const plan = saveRepairPlan_(buildCalendarRepairPlan_(start, end));
  const sample = plan.items.slice(0, 12).map(function (item) {
    return item.date + ' — ' + item.title +
      ' (' + item.layer + ', stop ' + item.order + ')';
  });
  return {
    missing: plan.items.length,
    summary: [
      'Repair range: ' + plan.start + ' through ' + plan.end,
      'Missing visits found: ' + plan.items.length,
      sample.length ? '\nPreview:\n' + sample.join('\n') :
        '\nNo repair is required.',
      plan.items.length
        ? '\nUse Expand Preview / Edit Route Order before applying.'
        : ''
    ].join('\n')
  };
}

function saveCalendarRepairBoardPlan(changes) {
  if (!Array.isArray(changes)) {
    throw new Error('Edited repair data is missing.');
  }
  const plan = readRepairPlan_();
  if (!plan) throw new Error('Run Calendar Repair Preview first.');
  const byId = {};
  changes.forEach(function (change) {
    byId[String(change.id)] = change;
  });
  const settings = getRecurringCalendarSettings_();

  plan.items = plan.items.map(function (item) {
    const change = byId[String(item.id)];
    if (!change) return item;
    const date = parseRepairDate_(change.date, 'Repair date');
    const order = Math.max(1, Number(change.order || 1));
    const start = routeTimeForOrder_(date, order, settings);
    item.date = Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd');
    item.order = order;
    item.start = start.toISOString();
    item.end = new Date(
      start.getTime() + settings.eventDurationMinutes * 60000
    ).toISOString();
    return item;
  });
  saveRepairPlan_(plan);
  return {
    summary: 'Edited repair preview saved. ' + plan.items.length +
      ' visit(s) are ready to apply from the Job Engine.'
  };
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

  plan.items.forEach(function (item) {
    if (repairVisitExists_(existing, item)) {
      skipped++;
      return;
    }
    try {
      assertCalendarMutationIsSafe_(new Date(item.start), true);
      const description = [
        item.description,
        '',
        'PMOS_HISTORY_REPAIR=true',
        item.customerId ? 'PMOS_CUSTOMER_ID=' + item.customerId : '',
        'PMOS_REPAIR_ORIGINAL_LAYER=' + item.layer,
        'PMOS_REPAIR_APPLIED_DATE=' + item.date,
        'PMOS_REPAIR_STOP_ORDER=' + item.order
      ].filter(Boolean).join('\n');
      const event = calendar.createEvent(
        item.title,
        new Date(item.start),
        new Date(item.end),
        {description: description, location: item.address || ''}
      );
      if (item.color) event.setColor(item.color);
      created++;
      existing.push(event);
    } catch (error) {
      errors.push(item.date + ' ' + item.title + ': ' + error);
    }
  });

  PropertiesService.getDocumentProperties().deleteProperty(
    PMOS_CALENDAR_CONFIG.REPAIR_PLAN_KEY
  );
  return {
    summary: [
      'Calendar repair complete.',
      'Date range: ' + plan.start + ' through ' + plan.end,
      'Visits created: ' + created,
      'Already present and skipped: ' + skipped,
      'Errors: ' + errors.length,
      errors.length ? 'First error: ' + errors[0] : ''
    ].filter(Boolean).join('\n')
  };
}
