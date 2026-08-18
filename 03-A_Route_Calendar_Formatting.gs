/**
 * Shared route-to-Calendar formatting helpers still used by recurring planning
 * and Temporary Visit scheduling. These helpers calculate values only and do
 * not write to Google Calendar.
 */

function buildRouteDescription_(row, parsed) {
  const parts = [];
  if (row.customerId) parts.push('PMOS_CUSTOMER_ID=' + row.customerId);
  if (row.fullName) parts.push(row.fullName);
  if (row.entry) parts.push('', 'ENTRY', row.entry);
  parts.push('', parsed.day + ' • Rotation Week ' + parsed.week);
  if (row.frequency) parts.push(row.frequency);
  if (row.phone) parts.push('', 'PHONE: ' + row.phone);
  if (row.notes) parts.push('', 'NOTES', row.notes);
  return parts.join('\n').trim();
}

function routeTimeForOrder_(eventDate, order, settings) {
  if (!(eventDate instanceof Date) || !Number.isFinite(eventDate.getTime())) {
    throw new Error('Invalid route date: ' + eventDate);
  }
  const time = parseFlexibleRouteTime_(settings.routeStart);
  const result = new Date(eventDate.getTime());
  result.setHours(time.hours, time.minutes, 0, 0);
  const safeOrder = positiveNumberOrDefault_(order, 1);
  for (let index = 1; index < safeOrder; index++) {
    result.setMinutes(result.getMinutes() + (index % 2 === 1 ? 45 : 60));
  }
  if (!Number.isFinite(result.getTime())) {
    throw new Error(
      'Could not calculate a valid start time from ' + eventDate +
      ', order ' + order + ', and route start ' + settings.routeStart + '.'
    );
  }
  return result;
}
