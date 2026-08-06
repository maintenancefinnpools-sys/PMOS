/**
 * Performs a non-mutating validation pass over the exact reviewed Calendar Sync
 * operations before they are persisted to the durable queue.
 */
function validateReviewedCalendarSyncPreflight_(operations, calendar, calendarName) {
  const items = Array.isArray(operations) ? operations : [];
  const errors = [];
  const warnings = [];
  const counts = {CREATE: 0, UPDATE: 0, DELETE: 0, MERGE: 0};

  if (!calendar) errors.push('The configured target Calendar could not be loaded.');
  if (!String(calendarName || '').trim()) errors.push('The target Calendar Name is blank.');
  if (!items.length) errors.push('The reviewed Calendar Sync plan contains no executable operations.');

  items.forEach(function (operation, index) {
    const label = String(
      operation && (operation.id || operation.entityId) || ('operation ' + (index + 1))
    );
    try {
      validateReviewedCalendarSyncPreflightOperation_(operation, calendar);
      const action = String(operation && operation.action || '').toUpperCase();
      if (Object.prototype.hasOwnProperty.call(counts, action)) counts[action]++;
    } catch (error) {
      errors.push(label + ': ' + String(error && error.message ? error.message : error));
    }
  });

  if (String(calendarName || '').trim() === String(PMOS.CALENDAR_NAME || '').trim()) {
    warnings.push(
      'The target Calendar matches the PMOS operational default: ' +
      String(PMOS.CALENDAR_NAME || '') + '. Confirm App Settings before starting a development test.'
    );
  }

  return {
    valid: errors.length === 0,
    calendarName: String(calendarName || ''),
    operationCount: items.length,
    counts: counts,
    errors: errors,
    warnings: warnings
  };
}

function validateReviewedCalendarSyncPreflightOperation_(operation, calendar) {
  if (!operation || typeof operation !== 'object') {
    throw new Error('Operation payload is missing.');
  }

  const action = String(operation.action || '').toUpperCase();
  const payload = operation.payload || {};
  const current = payload.current || {};
  const desired = payload.desired || {};
  const review = payload.review || {};
  const reviewAction = String(
    operation.metadata && operation.metadata.reviewAction || ''
  ).toUpperCase();

  if (reviewAction === 'MATCH') {
    if (!String(review.customerId || '').trim()) {
      throw new Error('MATCH is missing the approved Customer ID.');
    }
    const target = findReviewedCalendarMatchTarget_(
      calendar,
      String(review.eventId || current.eventId || ''),
      String(review.seriesId || current.seriesId || '')
    );
    if (!target.object) throw new Error('MATCH target could not be reloaded from the configured Calendar.');
    return;
  }

  if (reviewAction === 'TEMPORARY') {
    const eventId = String(review.eventId || current.eventId || '').trim();
    if (!eventId) throw new Error('TEMPORARY is missing the reviewed event ID.');
    const event = calendar.getEventById(eventId);
    if (!event) throw new Error('TEMPORARY target could not be reloaded from the configured Calendar.');
    if (event.isRecurringEvent()) {
      throw new Error('TEMPORARY cannot convert a recurring event or recurring series.');
    }
    return;
  }

  if (reviewAction === 'DELETE') {
    const eventId = String(review.eventId || current.eventId || '').trim();
    const seriesId = String(review.seriesId || current.seriesId || '').trim();
    if (!eventId && !seriesId) throw new Error('Reviewed DELETE is missing an exact event or series ID.');
    // An already-absent reviewed target remains valid because reviewed deletion is idempotent.
    return;
  }

  if (action === String(PMOS_OPERATION.CREATE).toUpperCase()) {
    if (!desired.seriesKey || !desired.start || !desired.end || !desired.title) {
      throw new Error('CREATE is missing its series key, title, start, or end.');
    }
    return;
  }

  if (action === String(PMOS_OPERATION.UPDATE).toUpperCase()) {
    const seriesId = String(current.seriesId || current.id || payload.seriesId || '').trim();
    if (!desired.seriesKey || !seriesId) {
      throw new Error('UPDATE is missing its desired series key or current series ID.');
    }
    if (!calendar.getEventSeriesById(seriesId)) {
      throw new Error('UPDATE series could not be reloaded from the configured Calendar.');
    }
    return;
  }

  if (action === String(PMOS_OPERATION.DELETE).toUpperCase()) {
    const seriesId = String(current.seriesId || current.id || payload.seriesId || '').trim();
    const eventId = String(current.eventId || payload.eventId || '').trim();
    if (!seriesId && !eventId) throw new Error('DELETE is missing an event or series ID.');
    return;
  }

  throw new Error('Unsupported executable operation action: ' + (action || '(blank)') + '.');
}
