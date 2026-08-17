/**
 * PMOS v1.9.0 — Recurring Calendar series planning and registry.
 * Move-only refactor: public names and operational behavior are preserved.
 */
function ensureRecurringSeriesRegistry_() {
  return ensureVersionedRecurringSeriesRegistry_();
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
      map['Event Duration Minutes'],
      60
    ),
    routeStart: base.routeStart || map['Daily Route Start'] || '6:00 AM'
  };
}

/**
 * Builds the desired recurring-series plan.
 *
 * A caller may provide a read-only route reader. Legacy callers continue using
 * readRoutesInPhysicalOrder_() until they are migrated separately.
 */
function buildRecurringSeriesPlan_(routeReader) {
  const settings = getRecurringCalendarSettings_();
  validateRecurringCalendarSettings_(settings);

  const readRoutes = typeof routeReader === 'function'
    ? routeReader
    : readRoutesInPhysicalOrder_;
  const routeRows = readRoutes();

  if (!Array.isArray(routeRows)) {
    throw new Error('Calendar route source did not return an array.');
  }

  const plans = [];

  routeRows.forEach(row => {
    const parsed = parseLayer_(row.layer);
    const firstDate = firstOccurrenceForLayer_(
      parsed,
      settings,
      row.yearRound,
      row.serviceStartDate
    );

    if (
      !row.yearRound &&
      firstDate.getTime() > endOfDay_(settings.seasonEnd).getTime()
    ) {
      throw new Error(
        row.title + ' — ' + row.layer +
        ': the Route Template contains this customer, but its next occurrence ' +
        formatDiagnosticDate_(firstDate) + ' is after the configured Season End ' +
        formatDiagnosticDate_(settings.seasonEnd) +
        '. PMOS stopped instead of treating the managed series as absent.'
      );
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

  return collapseEquivalentPmosRecurringPlans_(plans);
}

/**
 * Repairs the specific duplicate shape produced by the old Customer Sync bug:
 * two route rows resolve to the same Customer ID + layer and carry the same
 * customer/calendar content, but have different physical Stop Order values.
 *
 * We collapse only equivalent rows. If two records share a series key but have
 * materially different customer data, both are retained so the planner still
 * raises a blocking duplicate-key error rather than guessing.
 */
function collapseEquivalentPmosRecurringPlans_(plans) {
  const result = [];
  const firstByKey = {};

  (plans || []).forEach(function (plan) {
    const key = String(plan && plan.seriesKey || '').trim();
    if (!key || !firstByKey[key]) {
      if (key) firstByKey[key] = plan;
      result.push(plan);
      return;
    }

    const first = firstByKey[key];
    if (!areEquivalentPmosRecurringRouteRows_(first.row, plan.row)) {
      result.push(plan);
    }
  });

  return result;
}

function areEquivalentPmosRecurringRouteRows_(left, right) {
  const a = left || {};
  const b = right || {};
  const textFields = [
    'customerId', 'layer', 'title', 'fullName', 'address', 'frequency',
    'entry', 'notes', 'phone', 'secondaryPhone', 'email', 'sanitization',
    'automation'
  ];

  for (let index = 0; index < textFields.length; index++) {
    const field = textFields[index];
    if (normalize_(a[field]) !== normalize_(b[field])) return false;
  }

  return Boolean(a.yearRound) === Boolean(b.yearRound);
}
