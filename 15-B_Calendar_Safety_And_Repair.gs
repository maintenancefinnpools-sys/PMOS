/**
 * PMOS Calendar safety and historical repair support.
 *
 * Historical Calendar records are protected by an explicit effective date.
 * Repair application is resumable and runs until the shared runtime deadline.
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
      'The effective date cannot be earlier than today. ' +
      'Historical Calendar records are protected.'
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
  const description = String(event && event.getDescription
    ? event.getDescription() || ''
    : '');
  return description.indexOf('PMOS_SERIES_KEY=') >= 0 ||
    description.indexOf('PMOS_CUSTOMER_ID=') >= 0 ||
    description.indexOf('PMOS_TEMP_VISIT=') >= 0 ||
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

  routes.forEach(function (row) {
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
  return events.some(function (event) {
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
    items: expected.filter(function (visit) {
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

function previewCalendarRepairPlan(startValue, endValue) {
  const start = parseRepairDate_(startValue, 'Begin date');
  const end = parseRepairDate_(endValue, 'End date');
  if (end.getTime() < start.getTime()) {
    throw new Error('End date must be on or after begin date.');
  }

  const plan = saveRepairPlan_(buildCalendarRepairPlan_(start, end));
  clearPmosRuntimeCheckpoint_(PMOS_CALENDAR_REPAIR_OPERATION);

  const sample = plan.items.slice(0, 12).map(function (item) {
    return item.date + ' — ' + item.title +
      ' (' + item.layer + ', stop ' + item.order + ')';
  });

  return {
    missing: plan.items.length,
    summary: [
      'Repair range: ' + plan.start + ' through ' + plan.end,
      'Missing visits found: ' + plan.items.length,
      sample.length ? '\nPreview:\n' + sample.join('\n') : '\nNo repair is required.'
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
  clearPmosRuntimeCheckpoint_(PMOS_CALENDAR_REPAIR_OPERATION);
  return {
    summary: 'Edited repair preview saved. ' +
      plan.items.length + ' visit(s) are ready to apply.'
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

  savePmosRuntimeCheckpoint_(PMOS_CALENDAR_REPAIR_OPERATION, {
    index: 0,
    created: 0,
    skipped: 0,
    errors: [],
    start: startText,
    end: endText
  });

  return runCalendarRepairRuntime_();
}

function runCalendarRepairContinuation() {
  return runCalendarRepairRuntime_();
}

function runCalendarRepairRuntime_() {
  const plan = readRepairPlan_();
  if (!plan) throw new Error('No Calendar repair plan is available.');

  const context = createPmosRuntimeContext_(PMOS_CALENDAR_REPAIR_OPERATION);
  const lock = acquirePmosRuntimeLock_(context, 1000);

  try {
    const calendar = getRecurringCalendar_();
    const start = parseRepairDate_(plan.start, 'Begin date');
    const end = parseRepairDate_(plan.end, 'End date');
    const queryEnd = new Date(end);
    queryEnd.setDate(queryEnd.getDate() + 1);
    const existing = calendar.getEvents(start, queryEnd);

    const checkpoint = readPmosRuntimeCheckpoint_(
      PMOS_CALENDAR_REPAIR_OPERATION
    ) || {
      index: 0,
      created: 0,
      skipped: 0,
      errors: [],
      start: plan.start,
      end: plan.end
    };

    while (
      checkpoint.index < plan.items.length &&
      !pmosRuntimeShouldYield_(context)
    ) {
      const item = plan.items[checkpoint.index];

      if (repairVisitExists_(existing, item)) {
        checkpoint.skipped++;
      } else {
        try {
          const visitDate = parseRepairDate_(item.date, 'Repair date');
          assertCalendarMutationIsSafe_(visitDate, true);

          const description = [
            item.description,
            '',
            'PMOS_HISTORY_REPAIR=true',
            item.customerId
              ? 'PMOS_CUSTOMER_ID=' + item.customerId
              : '',
            'PMOS_REPAIR_ORIGINAL_LAYER=' + item.layer,
            'PMOS_REPAIR_APPLIED_DATE=' + item.date,
            'PMOS_REPAIR_STOP_ORDER=' + item.order
          ].filter(Boolean).join('\n');

          const event = calendar.createEvent(
            item.title,
            new Date(item.start),
            new Date(item.end),
            {
              description: description,
              location: item.address || ''
            }
          );
          if (item.color) event.setColor(item.color);
          existing.push(event);
          checkpoint.created++;
        } catch (error) {
          checkpoint.errors.push(
            item.date + ' ' + item.title + ': ' + String(error)
          );
        }
      }

      checkpoint.index++;
      savePmosRuntimeCheckpoint_(PMOS_CALENDAR_REPAIR_OPERATION, checkpoint);
      heartbeatPmosRuntimeOperation_(context);
    }

    if (checkpoint.index < plan.items.length) {
      scheduleCalendarRepairContinuation_(2000);
      releasePmosRuntimeLock_(lock, context);
      return calendarRepairStatus_(checkpoint, plan, 'Waiting');
    }

    removeCalendarRepairContinuation_();
    PropertiesService.getDocumentProperties()
      .deleteProperty(PMOS_CALENDAR_REPAIR_PLAN_KEY);
    completePmosRuntimeOperation_(
      PMOS_CALENDAR_REPAIR_OPERATION,
      lock,
      context
    );
    return calendarRepairStatus_(checkpoint, plan, 'Complete');
  } catch (error) {
    abandonPmosRuntimeOperation_(lock, context);
    throw error;
  }
}

function calendarRepairStatus_(checkpoint, plan, status) {
  const errors = Array.isArray(checkpoint.errors)
    ? checkpoint.errors
    : [];
  return {
    status: status,
    created: Number(checkpoint.created || 0),
    skipped: Number(checkpoint.skipped || 0),
    errors: errors.length,
    remaining: Math.max(0, plan.items.length - Number(checkpoint.index || 0)),
    summary: [
      status === 'Complete'
        ? 'Calendar repair complete.'
        : 'Calendar repair saved and will continue automatically.',
      'Date range: ' + plan.start + ' through ' + plan.end,
      'Visits created: ' + Number(checkpoint.created || 0),
      'Already present and skipped: ' + Number(checkpoint.skipped || 0),
      'Remaining: ' +
        Math.max(0, plan.items.length - Number(checkpoint.index || 0)),
      'Errors: ' + errors.length,
      errors.length ? 'First error: ' + errors[0] : ''
    ].filter(Boolean).join('\n')
  };
}

function scheduleCalendarRepairContinuation_(delayMs) {
  removeCalendarRepairContinuation_();
  ScriptApp.newTrigger(PMOS_CALENDAR_REPAIR_TRIGGER_HANDLER)
    .timeBased()
    .after(Math.max(1000, Number(delayMs || 0)))
    .create();
}

function removeCalendarRepairContinuation_() {
  ScriptApp.getProjectTriggers()
    .filter(function (trigger) {
      return trigger.getHandlerFunction() ===
        PMOS_CALENDAR_REPAIR_TRIGGER_HANDLER;
    })
    .forEach(function (trigger) {
      ScriptApp.deleteTrigger(trigger);
    });
}
