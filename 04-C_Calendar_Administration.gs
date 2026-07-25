/**
 * PMOS v1.9.0 — Calendar rebuild, status, and administration.
 * Move-only refactor: public names and operational behavior are preserved.
 */

function rebuildCalendarFromSheet() {
  const audit = runCalendarPlanAudit_();


  if (!audit.canSync) {
    showCalendarPlanAudit();
    return;
  }


  showPmosJobEngineFor_('CALENDAR_REBUILD');
}

function continueCalendarRebuild_() {
  ensureRecurringSeriesRegistry_();


  const state = getCalendarRebuildState_() || {phase: 'DELETE'};
  const calendar = getRecurringCalendar_();


  if (state.phase === 'DELETE') {
    const registry = getSeriesRegistry_();
    const keys = Object.keys(registry);
    const batch = keys.slice(0, 40);


    let deleted = 0;
    let errors = 0;
    let firstError = '';

    const liveJobState =
      readPmosJobState_();

    const baseProcessed =
      liveJobState
        ? Number(liveJobState.processedItems || 0)
        : 0;

    const totalDeletesAtStart =
      keys.length;

    batch.forEach((key, index) => {
      const record = registry[key];


      try {
        if (record.seriesId) {
          const series = calendar.getEventSeriesById(record.seriesId);
          if (series) series.deleteEventSeries();
        }


        deleteSeriesRegistryRow_(key);
        deleted++;
      } catch (error) {
        errors++;
        if (!firstError) firstError = String(error);
        console.error(`Rebuild delete ${key}: ${error}`);


                try {
          deleteSeriesRegistryRow_(key);
        } catch (ignored) {}
      }

      const attemptedThisBatch =
        index + 1;

      const liveRemaining =
        Math.max(
          0,
          totalDeletesAtStart -
          attemptedThisBatch
        );

      const shouldUpdate =
        attemptedThisBatch % 5 === 0 ||
        attemptedThisBatch === batch.length;

      if (shouldUpdate) {
        updatePmosLiveProgress_(
          baseProcessed,
          deleted,
          liveRemaining,
          'Calendar Rebuild: removing old series. ' +
            attemptedThisBatch +
            ' of ' +
            batch.length +
            ' processed in this batch. ' +
            deleted +
            ' removed.'
        );
      }
    });


    const remainingDelete = Math.max(0, keys.length - batch.length);


    if (remainingDelete > 0) {
      return {
        phase: 'Deleting old recurring series',
        deleted,
        errors,
        firstError,
        remaining: remainingDelete,
        complete: false
      };
    }


    clearRecurringSeriesRegistry_();


    setCalendarRebuildState_({
      phase: 'CREATE',
      startedAt: state.startedAt || new Date().toISOString()
    });
  }


  const syncResult = applyCalendarChanges();


  if (!syncResult.remaining && !syncResult.errors) {
    clearCalendarRebuildState_();


    return {
      phase: 'Creating recurring series',
      created: syncResult.created,
      updated: syncResult.updated,
      deleted: syncResult.deleted,
      errors: syncResult.errors,
      firstError: syncResult.firstError || '',
      remaining: 0,
      complete: true
    };
  }


  return {
    phase: 'Creating recurring series',
    created: syncResult.created,
    updated: syncResult.updated,
    deleted: syncResult.deleted,
    errors: syncResult.errors,
    firstError: syncResult.firstError || '',
    remaining: syncResult.remaining,
    complete: false
  };
}

function showCalendarStatus() {
  const ui = SpreadsheetApp.getUi();
  const preview = previewCalendarChanges();
  const registry = getSeriesRegistry_();
  const rebuild = getCalendarRebuildState_();


  const lines = [
    'Calendar: Water Maintenance Routes',
    `${preview.totalSeries} recurring series expected`,
    `${Object.keys(registry).length} series registered`,
    `${preview.creates} to create`,
    `${preview.updates} to update`,
    `${preview.deletes} to remove`,
    `Rebuild status: ${rebuild ? rebuild.phase : 'Not running'}`
  ];


  ui.alert('PMOS Calendar Status', lines.join('\n'), ui.ButtonSet.OK);
}

function clearRecurringSeriesRegistry_() {
  const sheet = ensureRecurringSeriesRegistry_();
  if (sheet.getLastRow() > 1) {
    sheet.getRange(
      2,
      1,
      sheet.getLastRow() - 1,
      sheet.getLastColumn()
    ).clearContent();
  }
}

function getCalendarRebuildState_() {
  const raw = PropertiesService.getDocumentProperties()
    .getProperty(PMOS_CALENDAR_REBUILD_STATE);


  if (!raw) return null;


  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function setCalendarRebuildState_(state) {
  PropertiesService.getDocumentProperties()
    .setProperty(PMOS_CALENDAR_REBUILD_STATE, JSON.stringify(state));
}

function clearCalendarRebuildState_() {
  PropertiesService.getDocumentProperties()
    .deleteProperty(PMOS_CALENDAR_REBUILD_STATE);
}

function parseSettingDateForYear_(value, year, fallback) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return new Date(
      year,
      value.getMonth(),
      value.getDate(),
      12,
      0,
      0,
      0
    );
  }


  if (typeof value === 'number' && Number.isFinite(value)) {
    // Google Sheets normally returns Date objects, but this also supports
    // spreadsheet serial values if a date column is formatted unexpectedly.
    const spreadsheetEpoch = new Date(Date.UTC(1899, 11, 30));
    const serialDate = new Date(
      spreadsheetEpoch.getTime() +
      value * 86400000
    );


    return new Date(
      year,
      serialDate.getUTCMonth(),
      serialDate.getUTCDate(),
      12,
      0,
      0,
      0
    );
  }


  const text = String(value || '').trim();


  if (text) {
    const monthDay = text.match(
      /^(?:[A-Za-z]+\s+)?([A-Za-z]+)\s+(\d{1,2})(?:,\s*\d{4})?$/
    );


    const parsed = new Date(text);


    if (Number.isFinite(parsed.getTime())) {
      return new Date(
        year,
        parsed.getMonth(),
        parsed.getDate(),
        12,
        0,
        0,
        0
      );
    }


    const numeric = text.match(
      /^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-]\d{2,4})?$/
    );


    if (numeric) {
      return new Date(
        year,
        Number(numeric[1]) - 1,
        Number(numeric[2]),
        12,
        0,
        0,
        0
      );
    }
  }


  const safeFallback =
    fallback instanceof Date &&
    Number.isFinite(fallback.getTime())
      ? fallback
      : new Date(year, 0, 1);


  return new Date(
    year,
    safeFallback.getMonth(),
    safeFallback.getDate(),
    12,
    0,
    0,
    0
  );
}

function parseFlexibleRouteTime_(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return {
      hours: value.getHours(),
      minutes: value.getMinutes()
    };
  }


  const text = String(value || '').trim();
  const match = text.match(
    /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i
  );


  if (!match) {
    return {hours: 6, minutes: 0};
  }


  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const suffix = String(match[3] || '').toUpperCase();


  if (suffix === 'PM' && hours !== 12) hours += 12;
  if (suffix === 'AM' && hours === 12) hours = 0;


  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return {hours: 6, minutes: 0};
  }


  return {hours, minutes};
}

function positiveNumberOrDefault_(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? number
    : fallback;
}

function validateRecurringCalendarSettings_(settings) {
  const values = [
    ['Rotation Week 1 Monday', settings.rotationWeek1Start],
    ['Season Start', settings.seasonStart],
    ['Season End', settings.seasonEnd]
  ];


  values.forEach(item => {
    if (
      !(item[1] instanceof Date) ||
      !Number.isFinite(item[1].getTime())
    ) {
      throw new Error(
        `${item[0]} is not a valid date in App Settings.`
      );
    }
  });


  if (
    settings.seasonEnd.getTime() <
    settings.seasonStart.getTime()
  ) {
    throw new Error(
      'Season End occurs before Season Start in App Settings.'
    );
  }
}

function assertValidSeriesDates_(
  row,
  parsed,
  start,
  end,
  seasonEnd
) {
  const prefix =
    `${row.title} — ${row.layer}`;


  if (
    !(start instanceof Date) ||
    !Number.isFinite(start.getTime())
  ) {
    throw new Error(
      `${prefix}: invalid start time (${start}).`
    );
  }


  if (
    !(end instanceof Date) ||
    !Number.isFinite(end.getTime())
  ) {
    throw new Error(
      `${prefix}: invalid end time (${end}).`
    );
  }


  if (end.getTime() <= start.getTime()) {
    throw new Error(
      `${prefix}: end time must be after start time.`
    );
  }


  if (
    seasonEnd instanceof Date &&
    Number.isFinite(seasonEnd.getTime()) &&
    start.getTime() > endOfDay_(seasonEnd).getTime()
  ) {
    throw new Error(
      `${prefix}: first occurrence ${formatDiagnosticDate_(start)} ` +
      `is after the season end ${formatDiagnosticDate_(seasonEnd)}.`
    );
  }
}

function formatDiagnosticDate_(date) {
  return Utilities.formatDate(
    date,
    PMOS.TIMEZONE,
    'yyyy-MM-dd h:mm a'
  );
}

function testFirstRecurringSeries() {
  const ui = SpreadsheetApp.getUi();


  try {
    const settings = getRecurringCalendarSettings_();
    const plan = buildRecurringSeriesPlan_();


    if (!plan.length) {
      throw new Error(
        'No remaining route occurrences were found inside the season.'
      );
    }


    const earliest = plan.slice(0, 8).map((item, index) =>
      `${index + 1}. ${item.layer} — ${item.title}: ${formatDiagnosticDate_(item.start)}`
    );


    ui.alert(
      'Recurring-series diagnostic',
      [
        `Code version: ${PMOS_VERSION}`,
        'Rotation Week 1 Monday: July 13, 2026',
        'First eligible build day: Thursday, July 16, 2026',
        '',
        'Earliest upcoming series in actual Calendar order:',
        ...earliest,
        '',
        `Calendar: ${settings.calendarName}`
      ].join('\n'),
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert(
      'Recurring-series diagnostic failed',
      String(error),
      ui.ButtonSet.OK
    );
  }
}

