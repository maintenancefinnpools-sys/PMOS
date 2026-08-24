/**
 * PMOS v1.9.0 — Temporary visit scheduling UI and operations.
 * Move-only refactor: public names and operational behavior are preserved.
 */

function showTemporaryVisitScheduler() {
  return showTemporaryVisitSchedulerV3();
}

function scheduleTemporaryVisits_(payload) {
  payload = payload || {};


  const title = String(payload.title || '').trim();
  const address = String(payload.address || '').trim();
  const visitRequests = Array.isArray(payload.visits) && payload.visits.length
    ? payload.visits.map(item => ({
        date: String(item.date || '').trim(),
        stopPosition: Math.max(1, Math.floor(Number(item.stopPosition || 1)))
      })).filter(item => item.date)
    : (Array.isArray(payload.dates)
        ? payload.dates.map(value => ({date: String(value || '').trim(), stopPosition: Math.max(1, Math.floor(Number(payload.stopPosition || 1)))})).filter(item => item.date)
        : [String(payload.date1 || '').trim(), String(payload.date2 || '').trim()].filter(Boolean).map(value => ({date:value, stopPosition:Math.max(1, Math.floor(Number(payload.stopPosition || 1)))})));
  const dateStrings = visitRequests.map(item => item.date);


  if (!title) {
    throw new Error('Enter a Calendar title or customer surname.');
  }


  if (!address) {
    throw new Error('Enter the service address.');
  }

  // Scheduling accepts only the same complete, confirmed address used by the
  // route recommendations. This prevents a typed edit from bypassing routing.
  getVerifiedTemporaryVisitPoint_(payload);


  if (!dateStrings.length) {
    throw new Error('Choose at least one visit date.');
  }


  const calendar = getRecurringCalendar_();
  const settings = getRecurringCalendarSettings_();
  let created = 0;
  let adjusted = 0;
  const details = [];


  visitRequests.forEach(visitRequest => {
    const dateString = visitRequest.date;
    const stopPosition = visitRequest.stopPosition;
    const serviceDate = parseTemporaryVisitDate_(dateString);


    if (
      serviceDate.getDay() === 0 ||
      serviceDate.getDay() === 6
    ) {
      throw new Error(
        `${dateString} is a weekend. Temporary maintenance visits currently support Monday–Friday.`
      );
    }


    const dayStart = new Date(serviceDate);
    dayStart.setHours(0, 0, 0, 0);


    const dayEnd = new Date(serviceDate);
    dayEnd.setHours(23, 59, 59, 999);


    const existingEvents = calendar.getEvents(dayStart, dayEnd)
      .filter(event => !event.isAllDayEvent())
      .sort((a, b) =>
        a.getStartTime().getTime() -
        b.getStartTime().getTime()
      );


    const safePosition = Math.min(
      stopPosition,
      existingEvents.length + 1
    );


    const placeholderStart = routeTimeForOrder_(
      serviceDate,
      safePosition,
      settings
    );
    const placeholderEnd = new Date(
      placeholderStart.getTime() +
      settings.eventDurationMinutes * 60000
    );


    const description = buildTemporaryVisitDescription_(payload);


    const newEvent = calendar.createEvent(
      title,
      placeholderStart,
      placeholderEnd,
      {
        location: address,
        description
      }
    );


    const orderedEvents = existingEvents.slice();
    orderedEvents.splice(safePosition - 1, 0, newEvent);


    orderedEvents.forEach((event, index) => {
      const newStart = routeTimeForOrder_(
        serviceDate,
        index + 1,
        settings
      );
      const newEnd = new Date(
        newStart.getTime() +
        settings.eventDurationMinutes * 60000
      );


      if (
        event.getStartTime().getTime() !== newStart.getTime() ||
        event.getEndTime().getTime() !== newEnd.getTime()
      ) {
        event.setTime(newStart, newEnd);
        adjusted++;
      }
    });


    created++;
    details.push(
      `${Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'EEEE, MMMM d')} — inserted as stop ${safePosition}`
    );
    invalidateTemporaryRouteSnapshot_(serviceDate);
  });


  return {
    created,
    adjusted,
    details
  };
}

function parseTemporaryVisitDate_(value) {
  const match = String(value || '').match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );


  if (!match) {
    throw new Error(`Invalid visit date: ${value}`);
  }


  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0
  );


  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid visit date: ${value}`);
  }


  return date;
}

function buildTemporaryVisitDescription_(payload) {
  const lines = [
    'Temporary / vacation maintenance visit',
    PMOS_TEMP_VISIT_MARKER
  ];


  if (payload.fullName) {
    lines.push(`Customer: ${payload.fullName}`);
  }


  if (payload.phone) {
    lines.push(`Phone: ${payload.phone}`);
  }

  if (payload.email) {
    lines.push(`Email: ${payload.email}`);
  }

  if (payload.customerNotes) {
    lines.push('', 'Customer Notes:', String(payload.customerNotes));
  }

  if (payload.entryInformation) {
    lines.push('', 'Entry Information:', String(payload.entryInformation));
  }

  if (!payload.customerNotes && !payload.entryInformation && payload.notes) {
    lines.push('', String(payload.notes));
  }


  lines.push('', `PMOS_TEMP_VISIT_ID=${Utilities.getUuid()}`);


  return lines.join('\n');
}
