/**
 * Shared route-to-Calendar formatting helpers still used by recurring planning
 * and Temporary Visit scheduling. These helpers calculate values only and do
 * not write to Google Calendar.
 */

function buildRouteDescription_(row, parsed) {
  const parts = [];
  if (row.entry) parts.push('ENTRY INFORMATION', row.entry);
  if (row.notes) parts.push(parts.length ? '' : null, 'CUSTOMER NOTES', row.notes);
  const service = [];
  if (row.fullName) service.push(row.fullName);
  service.push(parsed.day + ' • Rotation Week ' + parsed.week);
  if (row.frequency) service.push(row.frequency);
  if (row.phone) service.push('PHONE: ' + row.phone);
  if (service.length) parts.push(parts.length ? '' : null, 'SERVICE DETAILS', service.join('\n'));
  if (row.customerId) parts.push('', 'PMOS_CUSTOMER_ID=' + row.customerId);
  return parts.filter(function (part) { return part !== null; }).join('\n').trim();
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
