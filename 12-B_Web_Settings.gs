/** Web App adapter for validated PMOS Settings. */

function getPmosWebSettings() {
  const sheet = ensureAppSettingsSheet_();
  const values = sheet.getDataRange().getValues();
  const settings = {};
  values.slice(1).forEach(function(row) {
    const key = String(row[0] || '').trim();
    if (!key) return;
    settings[key] = formatPmosWebSettingValue_(key, row[1]);
  });
  let calendarNames = [];
  try {
    const auditOptions = getPmosCalendarAuditJobCenterOptions();
    calendarNames = auditOptions && auditOptions.calendarNames || [];
  } catch (error) {}
  return {
    app: {
      calendarName: String(settings['Calendar Name'] || ''),
      calendarYear: Number(settings['Calendar Year'] || new Date().getFullYear()),
      seasonStart: String(settings['Season Start'] || ''),
      seasonEnd: String(settings['Season End'] || ''),
      dailyRouteStart: String(settings['Daily Route Start'] || '6:00 AM'),
      eventDurationMinutes: Number(settings['Event Duration Minutes'] || 60),
      calendarNames: calendarNames
    },
    routing: getPmosRieSettingsForUi()
  };
}

function savePmosWebAppSettings(input) {
  const values = input || {};
  const calendarName = String(values.calendarName || '').trim();
  const calendarYear = Number(values.calendarYear);
  const seasonStartText = String(values.seasonStart || '').trim();
  const seasonEndText = String(values.seasonEnd || '').trim();
  const dailyRouteStart = String(values.dailyRouteStart || '').trim();
  const duration = Number(values.eventDurationMinutes);

  if (!calendarName) throw new Error('Calendar Name is required.');
  if (!Number.isInteger(calendarYear) || calendarYear < 2000 || calendarYear > 2100) {
    throw new Error('Calendar Year must be between 2000 and 2100.');
  }
  const seasonStart = parsePmosWebDate_(seasonStartText, 'Season Start');
  const seasonEnd = parsePmosWebDate_(seasonEndText, 'Season End');
  if (seasonStart.getTime() > seasonEnd.getTime()) {
    throw new Error('Season Start cannot be after Season End.');
  }
  if (!dailyRouteStart) throw new Error('Daily Route Start is required.');
  parseFlexibleRouteTime_(dailyRouteStart);
  if (!Number.isFinite(duration) || duration < 1 || duration > 1440) {
    throw new Error('Event Duration Minutes must be between 1 and 1440.');
  }

  const sheet = ensureAppSettingsSheet_();
  const data = sheet.getDataRange().getValues();
  const rowByKey = {};
  data.slice(1).forEach(function(row, index) {
    rowByKey[String(row[0] || '').trim()] = index + 2;
  });
  const updates = {
    'Calendar Name': calendarName,
    'Calendar Year': calendarYear,
    'Season Start': seasonStart,
    'Season End': seasonEnd,
    'Daily Route Start': dailyRouteStart,
    'Event Duration Minutes': Math.round(duration)
  };
  const previous = {};
  Object.keys(updates).forEach(function(key) {
    const row = rowByKey[key];
    if (!row) throw new Error('App Settings row is missing: ' + key + '.');
    previous[key] = sheet.getRange(row, 2).getValue();
  });

  try {
    Object.keys(updates).forEach(function(key) {
      sheet.getRange(rowByKey[key], 2).setValue(updates[key]);
    });
    sheet.getRange(rowByKey['Calendar Year'], 2).setNumberFormat('0');
    sheet.getRange(rowByKey['Season Start'], 2).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(rowByKey['Season End'], 2).setNumberFormat('yyyy-mm-dd');
    getRecurringCalendarSettings_();
  } catch (error) {
    Object.keys(previous).forEach(function(key) {
      sheet.getRange(rowByKey[key], 2).setValue(previous[key]);
    });
    throw error;
  }

  return getPmosWebSettings().app;
}

function formatPmosWebSettingValue_(key, value) {
  if ((key === 'Season Start' || key === 'Season End') && value instanceof Date && Number.isFinite(value.getTime())) {
    return Utilities.formatDate(value, PMOS.TIMEZONE, 'yyyy-MM-dd');
  }
  return value == null ? '' : value;
}

function parsePmosWebDate_(value, label) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(label + ' must be a valid date.');
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) {
    throw new Error(label + ' must be a valid date.');
  }
  date.setHours(12,0,0,0);
  return date;
}
