/**
 * PMOS configured Calendar provisioning safeguard.
 *
 * Uses the exact Calendar Name from App Settings. If no matching Google
 * Calendar exists, PMOS creates it before planning or synchronization continues.
 */

function getOrCreateConfiguredPmosCalendar_() {
  const settings = getRecurringCalendarSettings_();
  const calendarName = String(settings.calendarName || '').trim();

  if (!calendarName) {
    throw new Error(
      'Calendar Name is blank in App Settings. Enter the exact development or operational calendar name.'
    );
  }

  const matches = CalendarApp.getCalendarsByName(calendarName);
  if (matches.length) {
    return matches[0];
  }

  return CalendarApp.createCalendar(calendarName, {
    summary: 'PMOS recurring maintenance routes',
    timeZone: PMOS.TIMEZONE
  });
}
