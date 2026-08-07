/** Calendar Plan Audit options retained for one active review operation. */
const PMOS_CALENDAR_AUDIT_OPTIONS_PROPERTY = 'PMOS_CALENDAR_AUDIT_OPTIONS';

function normalizePmosCalendarAuditDate_(value) {
  if (value == null || value === '') return '';
  const date = value instanceof Date ? new Date(value) : new Date(String(value) + (/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? 'T00:00:00' : ''));
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid Calendar Audit date: ' + value);
  return Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd');
}

function savePmosCalendarAuditOptions_(options) {
  const source = options || {};
  const normalized = {
    calendarName: String(source.calendarName || '').trim(),
    startDate: normalizePmosCalendarAuditDate_(source.startDate),
    endDate: normalizePmosCalendarAuditDate_(source.endDate),
    includeStartedToday: Boolean(source.includeStartedToday)
  };
  if (normalized.startDate && normalized.endDate && normalized.startDate > normalized.endDate) {
    throw new Error('Calendar Audit start date cannot be after the end date.');
  }
  PropertiesService.getDocumentProperties().setProperty(
    PMOS_CALENDAR_AUDIT_OPTIONS_PROPERTY,
    JSON.stringify(normalized)
  );
  return normalized;
}

function readPmosCalendarAuditOptions_() {
  const raw = PropertiesService.getDocumentProperties().getProperty(
    PMOS_CALENDAR_AUDIT_OPTIONS_PROPERTY
  );
  if (!raw) return {calendarName: '', startDate: '', endDate: '', includeStartedToday: false};
  try {
    const parsed = JSON.parse(raw) || {};
    return {
      calendarName: String(parsed.calendarName || '').trim(),
      startDate: String(parsed.startDate || ''),
      endDate: String(parsed.endDate || ''),
      includeStartedToday: parsed.includeStartedToday === true
    };
  } catch (error) {
    return {calendarName: '', startDate: '', endDate: '', includeStartedToday: false};
  }
}

function clearPmosCalendarAuditOptions_() {
  PropertiesService.getDocumentProperties().deleteProperty(
    PMOS_CALENDAR_AUDIT_OPTIONS_PROPERTY
  );
}

function listPmosCalendarAuditTargets_() {
  const names = CalendarApp.getAllCalendars()
    .map(function (calendar) { return String(calendar.getName() || '').trim(); })
    .filter(Boolean);
  return Array.from(new Set(names)).sort(function (a, b) { return a.localeCompare(b); });
}

function getPmosCalendarAuditLaunchOptions_() {
  const settings = getRecurringCalendarSettings_();
  const names = listPmosCalendarAuditTargets_();
  if (settings.calendarName && names.indexOf(settings.calendarName) < 0) names.unshift(settings.calendarName);
  return {
    calendarNames: names,
    calendarName: settings.calendarName,
    startDate: Utilities.formatDate(settings.seasonStart, PMOS.TIMEZONE, 'yyyy-MM-dd'),
    endDate: Utilities.formatDate(settings.seasonEnd, PMOS.TIMEZONE, 'yyyy-MM-dd'),
    includeStartedToday: false
  };
}

/**
 * Resolves a Calendar name without silently choosing among ambiguous targets.
 * When duplicate visible names exist, the sole Calendar owned by the current
 * user is the authoritative target. Multiple owned copies still require a
 * rename because a name-only App Setting cannot distinguish them safely.
 */
function resolvePmosCalendarByName_(calendarName) {
  const name = String(calendarName || '').trim();
  if (!name) throw new Error('Select a Calendar before running the audit.');

  const matches = CalendarApp.getCalendarsByName(name);
  if (!matches.length) {
    throw new Error('No Calendar was found with this name: ' + name + '.');
  }
  if (matches.length === 1) return matches[0];

  const owned = matches.filter(function (calendar) {
    try { return calendar.isOwnedByMe(); }
    catch (error) { return false; }
  });
  if (owned.length === 1) return owned[0];

  throw new Error(
    'Found ' + matches.length + ' Calendars named "' + name + '"' +
    (owned.length ? ', including ' + owned.length + ' owned Calendars' : '') +
    '. Rename the intended Calendar so its name is unique, then run the audit again.'
  );
}

function setPmosCalendarNameFromAudit_(calendarName) {
  const name = String(calendarName || '').trim();
  resolvePmosCalendarByName_(name);
  const sheet = ensureAppSettingsSheet_();
  const values = sheet.getDataRange().getValues();
  let row = 0;
  for (let index = 1; index < values.length; index++) {
    if (String(values[index][0] || '').trim() === 'Calendar Name') { row = index + 1; break; }
  }
  if (!row) throw new Error('Calendar Name setting is missing from App Settings.');
  sheet.getRange(row, 2).setValue(name);
  SpreadsheetApp.flush();
  return name;
}

function runFreshPmosCalendarAuditWithOptions(options) {
  const normalized = savePmosCalendarAuditOptions_(options || {});
  if (normalized.calendarName) setPmosCalendarNameFromAudit_(normalized.calendarName);
  clearPmosCalendarAuditSnapshot_();
  return runVerifiedCalendarPlanAuditReadOnly_(Object.assign({}, normalized, {
    forceFresh: true
  }));
}
