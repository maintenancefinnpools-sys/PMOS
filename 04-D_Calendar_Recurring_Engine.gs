/**
 * PMOS v1.9.0 — Recurring Calendar series planning and registry.
 * Move-only refactor: public names and operational behavior are preserved.
 */
function ensureRecurringSeriesRegistry_() {
  const ss = SpreadsheetApp.getActive();

  const sheet =
    ss.getSheetByName('Calendar Series Registry') ||
    ss.insertSheet('Calendar Series Registry');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Series Key',
      'Customer ID',
      'Layer',
      'Series ID',
      'Calendar Name',
      'Signature',
      'Last Sync',
      'Status',
      'Error'
    ]);

    sheet.hideSheet();
  }

  return sheet;
}
function getRecurringCalendar_() {
  const settings = getRecurringCalendarSettings_();
  const matches = CalendarApp.getCalendarsByName(settings.calendarName);
  if (matches.length) return matches[0];
  return CalendarApp.createCalendar(settings.calendarName, {
    summary: 'PMOS four-week recurring maintenance routes',
    timeZone: PMOS.TIMEZONE
  });
}

function getRecurringCalendarSettings_() {
  const base = getSettings_();
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.SETTINGS_SHEET);
  const values = sheet ? sheet.getDataRange().getValues() : [];
  const map = {};


  values.slice(1).forEach(row => {
    map[String(row[0] || '').trim()] = row[1];
  });


  const year = Number(base.calendarYear || map['Calendar Year'] || 2026);


  return {
    calendarName: 'Water Maintenance Routes',
    calendarYear: year,


    // Deliberately use the new active rotation anchor rather than the old
    // April season anchor. Monday July 13 is Week 1, which makes
    // Thursday July 16 the first future Week 1 service day.
    rotationWeek1Start: new Date(
      PMOS_RECURRING_WEEK1_MONDAY.getTime()
    ),


    seasonStart: parseSettingDateForYear_(
      map['Season Start'],
      year,
      new Date(year, 3, 1)
    ),
    seasonEnd: parseSettingDateForYear_(
      map['Season End'],
      year,
      new Date(year, 10, 30)
    ),
    eventDurationMinutes: positiveNumberOrDefault_(
      base.eventDurationMinutes,
      60
    ),
    routeStart: base.routeStart || map['Daily Route Start'] || '6:00 AM'
  };
}

function parseSettingDate_(value, fallback) {
  const fallbackDate = fallback instanceof Date
    ? new Date(fallback)
    : new Date();


  return parseSettingDateForYear_(
    value,
    fallbackDate.getFullYear(),
    fallbackDate
  );
}

function buildRecurringSeriesPlan_() {
  const settings = getRecurringCalendarSettings_();
  validateRecurringCalendarSettings_(settings);


  const plans = [];


  readRoutesInPhysicalOrder_().forEach(row => {
    const parsed = parseLayer_(row.layer);
    const firstDate = firstOccurrenceForLayer_(
      parsed,
      settings,
      row.yearRound
    );


    // Seasonal customers whose next aligned occurrence is beyond season end
    // have no remaining visit this season and should not create a series.
    if (
      !row.yearRound &&
      firstDate.getTime() > endOfDay_(settings.seasonEnd).getTime()
    ) {
      return;
    }


    const order = positiveNumberOrDefault_(row.order, 1);
    const start = routeTimeForOrder_(firstDate, order, settings);
    const end = new Date(
      start.getTime() +
      settings.eventDurationMinutes * 60000
    );


    assertValidSeriesDates_(
      row,
      parsed,
      start,
      end,
      row.yearRound ? null : settings.seasonEnd
    );


    const until = row.yearRound
      ? null
      : endOfDay_(settings.seasonEnd);


    const seriesKey =
      `${row.customerId || normalize_(row.title)}|${row.layer}`;


    const description =
      buildRouteDescription_(row, parsed) +
      `\n\nPMOS_SERIES_KEY=${seriesKey}`;


    const plan = {
      seriesKey,
      customerId: row.customerId || '',
      layer: row.layer,
      title: row.title,
      start,
      end,
      until,
      location: row.address || '',
      description,
      color: calendarColorForFrequency_(row.frequency),
      row
    };


    plan.signature = recurringSeriesSignature_(plan);
    plans.push(plan);
  });


  plans.sort((a, b) =>
    a.start.getTime() - b.start.getTime() ||
    a.layer.localeCompare(b.layer) ||
    a.row.order - b.row.order
  );


  return plans;
}

function firstOccurrenceForLayer_(parsed, settings, yearRound) {
  const dayOffsets = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6
  };


  if (!Object.prototype.hasOwnProperty.call(dayOffsets, parsed.day)) {
    throw new Error(
      `Unsupported route weekday "${parsed.day}" in ${parsed.routeDay}.`
    );
  }


  const date = new Date(settings.rotationWeek1Start.getTime());
  date.setHours(12, 0, 0, 0);
  date.setDate(
    date.getDate() +
    (parsed.week - 1) * 7 +
    dayOffsets[parsed.day]
  );


  // Use the actual current moment—not merely midnight—so a route whose
  // start time has already passed today advances by a full 28-day cycle.
  const now = new Date();
  const routeStart = parseFlexibleRouteTime_(settings.routeStart);


  date.setHours(routeStart.hours, routeStart.minutes, 0, 0);


  while (date.getTime() <= now.getTime()) {
    date.setDate(date.getDate() + 28);
  }


  // Return the service date; routeTimeForOrder_ will apply the exact
  // staggered time for each stop.
  date.setHours(12, 0, 0, 0);
  return date;
}

function endOfDay_(date) {
  const result = new Date(date);
  result.setHours(23,59,59,999);
  return result;
}

function buildFourWeekRecurrence_(plan) {
  // setTimeZone() returns EventRecurrence, while until() belongs to
  // the RecurrenceRule returned by addWeeklyRule(). Keep both references.
  const recurrence = CalendarApp.newRecurrence()
    .setTimeZone(PMOS.TIMEZONE);


  const weeklyRule = recurrence
    .addWeeklyRule()
    .interval(4);


  if (plan.until) {
    weeklyRule.until(plan.until);
  }


  return recurrence;
}

function createRecurringSeries_(calendar, plan) {
  const series = calendar.createEventSeries(
    plan.title, plan.start, plan.end, buildFourWeekRecurrence_(plan),
    {description: plan.description, location: plan.location}
  );
  series.setTag('PMOS_SERIES_KEY', plan.seriesKey);
  series.setTag('PMOS_CUSTOMER_ID', plan.customerId || '');
  if (plan.color) series.setColor(plan.color);
  return series;
}

function updateRecurringSeries_(series, plan) {
  series.setTitle(plan.title);
  series.setDescription(plan.description);
  series.setLocation(plan.location);
  series.setRecurrence(buildFourWeekRecurrence_(plan), plan.start, plan.end);
  series.setTag('PMOS_SERIES_KEY', plan.seriesKey);
  series.setTag('PMOS_CUSTOMER_ID', plan.customerId || '');
  if (plan.color) series.setColor(plan.color);
}

function calendarColorForFrequency_(frequency) {
  const normalized = normalize_(frequency);
  if (normalized.includes('monthly') || normalized.includes('4 week')) return '3'; // Grape
  if (normalized.includes('biweekly') || normalized.includes('bi weekly')) return '9'; // Blueberry
  return '7'; // Peacock / weekly
}

function recurringSeriesSignature_(plan) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify({
      title: plan.title, start: plan.start.toISOString(), end: plan.end.toISOString(),
      until: plan.until ? plan.until.toISOString() : '', location: plan.location,
      description: plan.description, color: plan.color
    })
  ));
}

function getSeriesRegistry_() {
  const sheet = ensureRecurringSeriesRegistry_();
  const values = sheet.getDataRange().getValues();
  const map = {};
  values.slice(1).forEach((row,index) => {
    if (!row[0]) return;
    map[String(row[0])] = {
      row: index + 2, seriesKey: String(row[0]), customerId: String(row[1] || ''),
      layer: String(row[2] || ''), seriesId: String(row[3] || ''),
      calendarName: String(row[4] || ''), signature: String(row[5] || ''),
      status: String(row[7] || '')
    };
  });
  return map;
}

function compareSeriesPlanToRegistry_(plan, registry, calendar) {
  const expected = {};
  const actions = [];

  // The incoming plan is already sorted chronologically.
  // Preserve that exact order for CREATE and UPDATE actions.
  plan.forEach(item => {
    expected[item.seriesKey] = true;

    const record = registry[item.seriesKey];

    if (!record || !record.seriesId) {
      actions.push({
        action: 'CREATE',
        seriesKey: item.seriesKey,
        layer: item.layer,
        title: item.title,
        plan: item
      });

      return;
    }

    const series = (() => {
      try {
        return calendar.getEventSeriesById(record.seriesId);
      } catch (error) {
        console.warn(
          `Could not read recurring series ${record.seriesId}: ${error}`
        );

        return null;
      }
    })();

    if (!series || record.signature !== item.signature) {
      actions.push({
        action: 'UPDATE',
        seriesKey: item.seriesKey,
        layer: item.layer,
        title: item.title,
        plan: item,
        series
      });
    }
  });

  // Obsolete registry entries are deleted after creates and updates.
  Object.keys(registry).forEach(key => {
    if (expected[key]) return;

    const record = registry[key];

    const series = (() => {
      try {
        return calendar.getEventSeriesById(record.seriesId);
      } catch (error) {
        console.warn(
          `Could not read obsolete recurring series ${record.seriesId}: ${error}`
        );

        return null;
      }
    })();

    actions.push({
      action: 'DELETE',
      seriesKey: key,
      layer: record.layer,
      title: key,
      series
    });
  });

  return actions;
}
function upsertSeriesRegistry_(plan, seriesId, calendarName, status) {
  const sheet = ensureRecurringSeriesRegistry_();
  const registry = getSeriesRegistry_();
  const row = [plan.seriesKey, plan.customerId, plan.layer, seriesId, calendarName, plan.signature, new Date(), status, ''];
  if (registry[plan.seriesKey]) sheet.getRange(registry[plan.seriesKey].row,1,1,row.length).setValues([row]);
  else sheet.appendRow(row);
}

function deleteSeriesRegistryRow_(seriesKey) {
  const sheet = ensureRecurringSeriesRegistry_();
  const registry = getSeriesRegistry_();
  if (registry[seriesKey]) sheet.deleteRow(registry[seriesKey].row);
}

function markSeriesRegistryError_(seriesKey, error) {
  const registry = getSeriesRegistry_();
  const sheet = ensureRecurringSeriesRegistry_();
  if (registry[seriesKey]) {
    sheet.getRange(registry[seriesKey].row,8,1,2).setValues([['Error', error]]);
  }
}

