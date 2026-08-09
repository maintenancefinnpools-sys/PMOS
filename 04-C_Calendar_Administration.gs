/** Calendar settings parsing and recurring-series validation helpers. */
function parseSettingDateForYear_(value, year, fallback) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return new Date(year, value.getMonth(), value.getDate(), 12, 0, 0, 0);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const spreadsheetEpoch = new Date(Date.UTC(1899, 11, 30));
    const serialDate = new Date(spreadsheetEpoch.getTime() + value * 86400000);
    return new Date(year, serialDate.getUTCMonth(), serialDate.getUTCDate(), 12, 0, 0, 0);
  }

  const text = String(value || '').trim();
  if (text) {
    const parsed = new Date(text);
    if (Number.isFinite(parsed.getTime())) {
      return new Date(year, parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0);
    }

    const numeric = text.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-]\d{2,4})?$/);
    if (numeric) {
      return new Date(year, Number(numeric[1]) - 1, Number(numeric[2]), 12, 0, 0, 0);
    }
  }

  const safeFallback =
    fallback instanceof Date && Number.isFinite(fallback.getTime())
      ? fallback
      : new Date(year, 0, 1);

  return new Date(year, safeFallback.getMonth(), safeFallback.getDate(), 12, 0, 0, 0);
}

function parseFlexibleRouteTime_(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return {hours: value.getHours(), minutes: value.getMinutes()};
  }

  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return {hours: 6, minutes: 0};

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const suffix = String(match[3] || '').toUpperCase();
  if (suffix === 'PM' && hours !== 12) hours += 12;
  if (suffix === 'AM' && hours === 12) hours = 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return {hours: 6, minutes: 0};
  }
  return {hours: hours, minutes: minutes};
}

function positiveNumberOrDefault_(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function validateRecurringCalendarSettings_(settings) {
  [
    ['Rotation Week 1 Monday', settings.rotationWeek1Start],
    ['Season Start', settings.seasonStart],
    ['Season End', settings.seasonEnd]
  ].forEach(function(item) {
    if (!(item[1] instanceof Date) || !Number.isFinite(item[1].getTime())) {
      throw new Error(item[0] + ' is not a valid date in App Settings.');
    }
  });

  if (settings.seasonEnd.getTime() < settings.seasonStart.getTime()) {
    throw new Error('Season End occurs before Season Start in App Settings.');
  }
}

function assertValidSeriesDates_(row, parsed, start, end, seasonEnd) {
  const prefix = row.title + ' — ' + row.layer;
  if (!(start instanceof Date) || !Number.isFinite(start.getTime())) {
    throw new Error(prefix + ': invalid start time (' + start + ').');
  }
  if (!(end instanceof Date) || !Number.isFinite(end.getTime())) {
    throw new Error(prefix + ': invalid end time (' + end + ').');
  }
  if (end.getTime() <= start.getTime()) {
    throw new Error(prefix + ': end time must be after start time.');
  }
  if (
    seasonEnd instanceof Date &&
    Number.isFinite(seasonEnd.getTime()) &&
    start.getTime() > endOfDay_(seasonEnd).getTime()
  ) {
    throw new Error(
      prefix + ': first occurrence ' + formatDiagnosticDate_(start) +
      ' is after the season end ' + formatDiagnosticDate_(seasonEnd) + '.'
    );
  }
}

function formatDiagnosticDate_(date) {
  return Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd h:mm a');
}
