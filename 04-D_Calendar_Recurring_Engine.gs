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
  return getOrCreateConfiguredPmosCalendar_();
}

function getRecurringCalendarSettings_() {
  const base = getSettings_();
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS.SETTINGS_SHEET);
  const values = sheet ? sheet.getDataRange().getValues() : [];
  const map = {};

  values.slice(1).forEach(row => {
    map[String(row[0] || '').trim()] = row[1];
  });

  const yearCandidate = Number(base.calendarYear || map['Calendar Year'] || 2026);
  const year = Number.isFinite(yearCandidate) && yearCandidate >= 2000 && yearCandidate <= 2100
    ? yearCandidate
    : 2026;

  const hasCalendarNameSetting = Object.prototype.hasOwnProperty.call(map, 'Calendar Name');
  const calendarName = hasCalendarNameSetting
    ? String(map['Calendar Name'] || '').trim()
    : String(base.calendarName || PMOS.CALENDAR_NAME || '').trim();

  if (!calendarName) {
    throw new Error('Calendar Name is blank in App Settings. Enter the exact development or operational calendar name before syncing.');
  }

  return {
    calendarName,
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
