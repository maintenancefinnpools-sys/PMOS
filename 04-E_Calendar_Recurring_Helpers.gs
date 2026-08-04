/**
 * PMOS recurring Calendar helper functions.
 *
 * Restores the date alignment, recurrence, signature, and registry helpers used
 * by 04-D_Calendar_Recurring_Engine.gs. These functions perform no work until
 * called by the planner or executor.
 */

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
      'Unsupported route weekday "' + parsed.day + '" in ' + parsed.routeDay + '.'
    );
  }

  const date = new Date(settings.rotationWeek1Start.getTime());
  date.setHours(12, 0, 0, 0);
  date.setDate(
    date.getDate() +
    (parsed.week - 1) * 7 +
    dayOffsets[parsed.day]
  );

  const now = new Date();
  const routeStart = parseFlexibleRouteTime_(settings.routeStart);
  date.setHours(routeStart.hours, routeStart.minutes, 0, 0);

  while (date.getTime() <= now.getTime()) {
    date.setDate(date.getDate() + 28);
  }

  date.setHours(12, 0, 0, 0);
  return date;
}

function endOfDay_(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function buildFourWeekRecurrence_(plan) {
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
    plan.title,
    plan.start,
    plan.end,
    buildFourWeekRecurrence_(plan),
    {
      description: buildPmosManagedRecurringDescription_(plan),
      location: plan.location
    }
  );
  applyPmosRecurringSeriesIdentity_(series, plan);
  if (plan.color) series.setColor(plan.color);
  return series;
}

function updateRecurringSeries_(series, plan) {
  series.setTitle(plan.title);
  series.setDescription(buildPmosManagedRecurringDescription_(plan));
  series.setLocation(plan.location);
  series.setRecurrence(
    buildFourWeekRecurrence_(plan),
    plan.start,
    plan.end
  );
  applyPmosRecurringSeriesIdentity_(series, plan);
  if (plan.color) series.setColor(plan.color);
}

function applyPmosRecurringSeriesIdentity_(series, plan) {
  series.setTag('PMOS_MANAGED', 'true');
  series.setTag('PMOS_EVENT_TYPE', 'RECURRING_ROUTE');
  series.setTag('PMOS_SERIES_KEY', plan.seriesKey);
  series.setTag('PMOS_CUSTOMER_ID', plan.customerId || '');
}

function buildPmosManagedRecurringDescription_(plan) {
  const metadataKeys = {
    PMOS_MANAGED: true,
    PMOS_EVENT_TYPE: true,
    PMOS_SERIES_KEY: true,
    PMOS_CUSTOMER_ID: true
  };
  const userLines = String(plan.description || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter(function (line) {
      const match = String(line || '').match(/^\s*(PMOS_[A-Z0-9_]+)\s*=/);
      return !match || !metadataKeys[match[1]];
    });

  while (userLines.length && !String(userLines[0] || '').trim()) userLines.shift();
  while (userLines.length && !String(userLines[userLines.length - 1] || '').trim()) {
    userLines.pop();
  }

  const metadata = [
    'PMOS_MANAGED=true',
    'PMOS_EVENT_TYPE=RECURRING_ROUTE',
    'PMOS_SERIES_KEY=' + String(plan.seriesKey || ''),
    'PMOS_CUSTOMER_ID=' + String(plan.customerId || '')
  ];

  return userLines.length
    ? userLines.join('\n') + '\n\n' + metadata.join('\n')
    : metadata.join('\n');
}

function calendarColorForFrequency_(frequency) {
  const normalized = normalize_(frequency);
  if (
    normalized.indexOf('monthly') >= 0 ||
    normalized.indexOf('4 week') >= 0
  ) {
    return '3';
  }
  if (
    normalized.indexOf('biweekly') >= 0 ||
    normalized.indexOf('bi weekly') >= 0
  ) {
    return '9';
  }
  return '7';
}

function recurringSeriesSignature_(plan) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      JSON.stringify({
        title: plan.title,
        start: plan.start.toISOString(),
        end: plan.end.toISOString(),
        until: plan.until ? plan.until.toISOString() : '',
        location: plan.location,
        description: plan.description,
        color: plan.color
      })
    )
  );
}

function getSeriesRegistry_() {
  const sheet = ensureRecurringSeriesRegistry_();
  const values = sheet.getDataRange().getValues();
  const map = {};

  values.slice(1).forEach(function (row, index) {
    if (!row[0]) return;
    map[String(row[0])] = {
      row: index + 2,
      seriesKey: String(row[0]),
      customerId: String(row[1] || ''),
      layer: String(row[2] || ''),
      seriesId: String(row[3] || ''),
      calendarName: String(row[4] || ''),
      signature: String(row[5] || ''),
      status: String(row[7] || '')
    };
  });
  return map;
}

function compareSeriesPlanToRegistry_(plan, registry, calendar) {
  const expected = {};
  const actions = [];

  plan.forEach(function (item) {
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

    let series = null;
    try {
      series = calendar.getEventSeriesById(record.seriesId);
    } catch (error) {
      console.warn(
        'Could not read recurring series ' + record.seriesId + ': ' + error
      );
    }

    if (!series || record.signature !== item.signature) {
      actions.push({
        action: 'UPDATE',
        seriesKey: item.seriesKey,
        layer: item.layer,
        title: item.title,
        plan: item,
        series: series
      });
    }
  });

  Object.keys(registry).forEach(function (key) {
    if (expected[key]) return;
    const record = registry[key];
    let series = null;

    try {
      series = calendar.getEventSeriesById(record.seriesId);
    } catch (error) {
      console.warn(
        'Could not read obsolete recurring series ' +
        record.seriesId + ': ' + error
      );
    }

    actions.push({
      action: 'DELETE',
      seriesKey: key,
      layer: record.layer,
      title: key,
      series: series
    });
  });

  return actions;
}

function upsertSeriesRegistry_(plan, seriesId, calendarName, status) {
  const sheet = ensureRecurringSeriesRegistry_();
  const registry = getSeriesRegistry_();
  const row = [
    plan.seriesKey,
    plan.customerId,
    plan.layer,
    seriesId,
    calendarName,
    plan.signature,
    new Date(),
    status,
    ''
  ];

  if (registry[plan.seriesKey]) {
    sheet.getRange(
      registry[plan.seriesKey].row,
      1,
      1,
      row.length
    ).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function deleteSeriesRegistryRow_(seriesKey) {
  const sheet = ensureRecurringSeriesRegistry_();
  const registry = getSeriesRegistry_();
  if (registry[seriesKey]) {
    sheet.deleteRow(registry[seriesKey].row);
  }
}

function markSeriesRegistryError_(seriesKey, error) {
  const registry = getSeriesRegistry_();
  const sheet = ensureRecurringSeriesRegistry_();
  if (registry[seriesKey]) {
    sheet.getRange(
      registry[seriesKey].row,
      8,
      1,
      2
    ).setValues([['Error', String(error || '')]]);
  }
}
