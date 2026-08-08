/**
 * PMOS Calendar safety and repair planning foundation.
 *
 * This module owns protected-date parsing, Calendar mutation guards, repair
 * plan construction and repair-plan persistence. The editable Repair UI lives
 * in 16_Calendar_Repair_Editor.gs and execution lives in
 * 18_Calendar_Repair_Combined_Stagger.gs.
 */

const PMOS_CALENDAR_EFFECTIVE_DATE_KEY = 'PMOS_CALENDAR_EFFECTIVE_DATE';
const PMOS_CALENDAR_REPAIR_PLAN_KEY = 'PMOS_CALENDAR_REPAIR_PLAN_V2';
const PMOS_CALENDAR_REPAIR_OPERATION = 'CALENDAR_REPAIR';
const PMOS_CALENDAR_REPAIR_TRIGGER_HANDLER = 'runCalendarRepairContinuation';

function saveCalendarEffectiveDate(value) {
  const date = parseCalendarEffectiveDate_(value);
  const text = Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd');
  PropertiesService.getDocumentProperties()
    .setProperty(PMOS_CALENDAR_EFFECTIVE_DATE_KEY, text);
  return {
    effectiveDate: text,
    summary: 'Effective date saved: ' +
      Utilities.formatDate(date, PMOS.TIMEZONE, 'MMMM d, yyyy')
  };
}

function getCalendarEffectiveDate_() {
  const stored = PropertiesService.getDocumentProperties()
    .getProperty(PMOS_CALENDAR_EFFECTIVE_DATE_KEY);
  return parseCalendarEffectiveDate_(
    stored || Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd')
  );
}

function parseCalendarEffectiveDate_(value) {
  const date = parsePmosCalendarDate_(value, 'Effective date');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() < today.getTime()) {
    throw new Error(
      'The effective date cannot be earlier than today. Historical Calendar records are protected.'
    );
  }
  return date;
}

function parseRepairDate_(value, label) {
  return parsePmosCalendarDate_(value, label || 'Repair date');
}

function parsePmosCalendarDate_(value, label) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(label + ' must use YYYY-MM-DD.');

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(label + ' is invalid.');
  }
  return date;
}

function assertCalendarMutationIsSafe_(date, allowHistoricalRepair) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new Error('Calendar mutation date is invalid.');
  }
  if (allowHistoricalRepair === true) return true;

  const effectiveDate = getCalendarEffectiveDate_();
  if (date.getTime() < effectiveDate.getTime()) {
    throw new Error(
      'PMOS blocked a Calendar change before the protected effective date ' +
      Utilities.formatDate(effectiveDate, PMOS.TIMEZONE, 'yyyy-MM-dd') + '.'
    );
  }
  return true;
}

function isPmosManagedCalendarEvent_(event) {
  const description = String(
    event && typeof event.getDescription === 'function'
      ? event.getDescription() || ''
      : ''
  );
  return description.indexOf('PMOS_MANAGED=true') >= 0 ||
    description.indexOf('PMOS_SERIES_KEY=') >= 0 ||
    description.indexOf('PMOS_CUSTOMER_ID=') >= 0 ||
    description.indexOf('PMOS_TEMP_VISIT_ID=') >= 0 ||
    description.indexOf(PMOS_TEMP_VISIT_MARKER) >= 0 ||
    description.indexOf('PMOS_HISTORY_REPAIR=true') >= 0;
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

  routes.forEach(function(row) {
    const parsed = parseLayer_(row.layer);
    if (offsets[parsed.day] == null) return;

    let date = new Date(settings.rotationWeek1Start);
    date.setHours(0, 0, 0, 0);
    date.setDate(
      date.getDate() +
      (parsed.week - 1) * 7 +
      offsets[parsed.day]
    );

    while (date.getTime() < startDate.getTime()) {
      date.setDate(date.getDate() + 28);
    }

    while (date.getTime() <= endDate.getTime()) {
      const visitDate = new Date(date);
      const start = routeTimeForOrder_(visitDate, row.order, settings);
      const end = new Date(
        start.getTime() + settings.eventDurationMinutes * 60000
      );

      visits.push({
        id: Utilities.getUuid(),
        customerId: row.customerId || '',
        title: row.title,
        layer: row.layer,
        order: Number(row.order || 1),
        date: Utilities.formatDate(
          visitDate,
          PMOS.TIMEZONE,
          'yyyy-MM-dd'
        ),
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
  return (events || []).some(function(event) {
    const eventDate = Utilities.formatDate(
      event.getStartTime(),
      PMOS.TIMEZONE,
      'yyyy-MM-dd'
    );
    if (eventDate !== visit.date) return false;

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
  if (!(start instanceof Date) || !(end instanceof Date)) {
    throw new Error('Calendar Repair requires valid begin and end dates.');
  }
  if (end.getTime() < start.getTime()) {
    throw new Error('End date must be on or after begin date.');
  }

  const calendar = getRecurringCalendar_();
  const queryEnd = new Date(end);
  queryEnd.setDate(queryEnd.getDate() + 1);
  const existing = calendar.getEvents(start, queryEnd);
  const expected = buildExpectedRepairVisits_(start, end);

  return {
    version: 2,
    createdAt: new Date().toISOString(),
    start: Utilities.formatDate(start, PMOS.TIMEZONE, 'yyyy-MM-dd'),
    end: Utilities.formatDate(end, PMOS.TIMEZONE, 'yyyy-MM-dd'),
    items: expected.filter(function(visit) {
      return !repairVisitExists_(existing, visit);
    })
  };
}

function saveRepairPlan_(plan) {
  PropertiesService.getDocumentProperties()
    .setProperty(PMOS_CALENDAR_REPAIR_PLAN_KEY, JSON.stringify(plan));
  return plan;
}

function readRepairPlan_() {
  const text = PropertiesService.getDocumentProperties()
    .getProperty(PMOS_CALENDAR_REPAIR_PLAN_KEY);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function clearCalendarRepairPlan_() {
  PropertiesService.getDocumentProperties()
    .deleteProperty(PMOS_CALENDAR_REPAIR_PLAN_KEY);
  clearPmosRuntimeCheckpoint_(PMOS_CALENDAR_REPAIR_OPERATION);
}

function previewCalendarRepairPlan(startValue, endValue) {
  const start = parseRepairDate_(startValue, 'Begin date');
  const end = parseRepairDate_(endValue, 'End date');
  if (end.getTime() < start.getTime()) {
    throw new Error('End date must be on or after begin date.');
  }

  const plan = saveRepairPlan_(buildCalendarRepairPlan_(start, end));
  clearPmosRuntimeCheckpoint_(PMOS_CALENDAR_REPAIR_OPERATION);

  const sample = plan.items.slice(0, 12).map(function(item) {
    return item.date + ' — ' + item.title +
      ' (' + item.layer + ', stop ' + item.order + ')';
  });

  return {
    missing: plan.items.length,
    summary: [
      'Repair range: ' + plan.start + ' through ' + plan.end,
      'Missing visits found: ' + plan.items.length,
      sample.length
        ? '\nPreview:\n' + sample.join('\n')
        : '\nNo repair is required.',
      plan.items.length
        ? '\nOpen the editable preview before applying if route order needs adjustment.'
        : ''
    ].join('\n')
  };
}
