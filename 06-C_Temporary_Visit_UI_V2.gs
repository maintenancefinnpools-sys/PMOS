/**
 * Modern Temporary Visit dialog. Reuses PMOS address and route intelligence,
 * while keeping the legacy scheduler available during development testing.
 */
function showTemporaryVisitSchedulerV2() {
  return showTemporaryVisitSchedulerV3();
}

function scheduleTemporaryVisitsV2(payload) {
  payload = payload || {};
  const title = String(payload.title || '').trim();
  const address = String(payload.address || '').trim();
  let requests = (Array.isArray(payload.visits) ? payload.visits : []).map(function(item) {
    return {date: String(item.date || '').trim(), stopPosition: Math.max(1, Math.floor(Number(item.stopPosition || 1)))};
  }).filter(function(item) { return item.date; });
  if (!requests.length && Array.isArray(payload.dates)) {
    const stops = Array.isArray(payload.stopPositions) ? payload.stopPositions : [];
    requests = payload.dates.map(function(date, index) {
      return {date: String(date || '').trim(), stopPosition: Math.max(1, Math.floor(Number(stops[index] || 1)))};
    }).filter(function(item) { return item.date; });
  }
  if (!title) throw new Error('Enter a Calendar title or customer surname.');
  if (!address) throw new Error('Enter the service address.');
  getVerifiedTemporaryVisitPoint_(payload);
  if (!requests.length) throw new Error('Choose at least one visit date.');

  const calendar = getRecurringCalendar_();
  const settings = getRecurringCalendarSettings_();
  let created = 0;
  let adjusted = 0;
  const details = [];
  requests.forEach(function(request) {
    const serviceDate = parseTemporaryVisitDate_(request.date);
    if (serviceDate.getDay() === 0 || serviceDate.getDay() === 6) throw new Error(request.date + ' is a weekend. Temporary maintenance visits currently support Monday–Friday.');
    const dayStart = new Date(serviceDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(serviceDate); dayEnd.setHours(23, 59, 59, 999);
    const existing = calendar.getEvents(dayStart, dayEnd).filter(function(event) { return !event.isAllDayEvent(); }).sort(function(a, b) { return a.getStartTime() - b.getStartTime(); });
    const position = Math.min(request.stopPosition, existing.length + 1);
    const start = routeTimeForOrder_(serviceDate, position, settings);
    const end = new Date(start.getTime() + settings.eventDurationMinutes * 60000);
    const event = calendar.createEvent(title, start, end, {location: address, description: buildTemporaryVisitDescriptionV2_(payload)});
    const ordered = existing.slice(); ordered.splice(position - 1, 0, event);
    ordered.forEach(function(item, index) {
      const newStart = routeTimeForOrder_(serviceDate, index + 1, settings);
      const newEnd = new Date(newStart.getTime() + settings.eventDurationMinutes * 60000);
      if (item.getStartTime().getTime() !== newStart.getTime() || item.getEndTime().getTime() !== newEnd.getTime()) { item.setTime(newStart, newEnd); adjusted++; }
    });
    created++;
    details.push(Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'EEEE, MMMM d') + ' — inserted as stop ' + position);
    invalidateTemporaryRouteSnapshot_(serviceDate);
  });
  return {created: created, adjusted: adjusted, details: details};
}

function buildTemporaryVisitDescriptionV2_(payload) {
  const esc = function(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  const blocks = [];
  if (payload.entryInformation) blocks.push('<b>ENTRY INFORMATION</b><br>' + esc(payload.entryInformation).replace(/\n/g, '<br>'));
  if (payload.customerNotes) blocks.push('<b>CUSTOMER NOTES</b><br>' + esc(payload.customerNotes).replace(/\n/g, '<br>'));
  const service = [];
  if (payload.fullName) service.push(esc(payload.fullName));
  service.push('Temporary maintenance visit');
  if (payload.phone) {
    const displayPhone = esc(payload.phone);
    let digits = String(payload.phone).replace(/\D/g, '');
    if (digits.length === 10) digits = '1' + digits;
    const dial = digits ? '+' + digits : '';
    service.push(dial
      ? 'PHONE: <a href="tel:' + dial + '">' + displayPhone + '</a> &nbsp;·&nbsp; <a href="sms:' + dial + '">Text</a>'
      : 'PHONE: ' + displayPhone);
  }
  if (payload.email) service.push('EMAIL: <a href="mailto:' + esc(payload.email) + '">' + esc(payload.email) + '</a>');
  blocks.push('<b>SERVICE DETAILS</b><br>' + service.join('<br>'));
  blocks.push(esc(PMOS_TEMP_VISIT_MARKER) + '<br>PMOS_TEMP_VISIT_ID=' + esc(Utilities.getUuid()));
  return blocks.join('<br><br>');
}
