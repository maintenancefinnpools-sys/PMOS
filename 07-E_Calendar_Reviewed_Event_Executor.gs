/**
 * Executes user-approved one-time Calendar review operations.
 * These operations never write to the recurring-series registry.
 */
function executePmosReviewedCalendarOperation_(state, operation) {
  const payload = operation && operation.payload || {};
  const review = payload.review || {};
  const action = String(operation.operationType || payload.reviewAction || review.action || '').trim().toUpperCase();
  const settings = getRecurringCalendarSettings_();
  const calendar = getExistingConfiguredPmosCalendar_(settings.calendarName);
  const event = findPmosReviewedCalendarEvent_(calendar, payload);

  if (action === 'PRESERVE_EVENT') {
    return {
      processed: 1,
      action: 'KEEP',
      title: String(payload.current && payload.current.title || review.eventTitle || payload.itemKey || 'Calendar event'),
      eventId: event ? String(event.getId() || '') : String(review.eventId || payload.itemKey || '')
    };
  }

  if (!event) {
    if (action === 'DELETE_APPROVED_EVENT') {
      return {
        processed: 1,
        action: 'DELETE_ALREADY_APPLIED',
        title: String(review.eventTitle || payload.itemKey || 'Calendar event'),
        eventId: ''
      };
    }
    throw new Error('Reviewed Calendar event could not be reloaded: ' + String(payload.itemKey || review.eventId || '') + '.');
  }

  if (action === 'LINK_CUSTOMER') {
    const customerId = String(review.customerId || '').trim();
    if (!customerId) throw new Error('Reviewed customer match is missing the approved Customer ID.');
    event.setDescription(upsertPmosReviewedEventMetadata_(event.getDescription(), {
      PMOS_CUSTOMER_ID: customerId,
      PMOS_REVIEW_SESSION_ID: String(review.reviewSessionId || payload.reviewSessionId || ''),
      PMOS_REVIEW_ACTION: 'LINK_CUSTOMER'
    }));
    if (review.customerAddress && !String(event.getLocation() || '').trim()) {
      event.setLocation(String(review.customerAddress));
    }
    return {
      processed: 1,
      action: 'LINK_CUSTOMER',
      title: String(event.getTitle() || review.eventTitle || 'Calendar event'),
      eventId: String(event.getId() || ''),
      customerId: customerId
    };
  }

  if (action === 'REGISTER_TEMPORARY_VISIT') {
    event.setDescription(upsertPmosReviewedEventMetadata_(event.getDescription(), {
      PMOS_EVENT_TYPE: 'TEMPORARY_VISIT',
      PMOS_REVIEW_SESSION_ID: String(review.reviewSessionId || payload.reviewSessionId || ''),
      PMOS_REVIEW_ACTION: 'REGISTER_TEMPORARY_VISIT'
    }));
    return {
      processed: 1,
      action: 'REGISTER_TEMPORARY_VISIT',
      title: String(event.getTitle() || review.eventTitle || 'Calendar event'),
      eventId: String(event.getId() || '')
    };
  }

  if (action === 'DELETE_APPROVED_EVENT') {
    event.deleteEvent();
    return {
      processed: 1,
      action: 'DELETE_APPROVED_EVENT',
      title: String(review.eventTitle || payload.current && payload.current.title || 'Calendar event'),
      eventId: ''
    };
  }

  throw new Error('Unsupported reviewed Calendar action: ' + (action || '(blank)') + '.');
}

function verifyPmosReviewedCalendarOperation_(operation, result) {
  const payload = operation && operation.payload || {};
  const review = payload.review || {};
  const action = String(operation.operationType || payload.reviewAction || review.action || '').trim().toUpperCase();
  const settings = getRecurringCalendarSettings_();
  const calendar = getExistingConfiguredPmosCalendar_(settings.calendarName);
  const event = findPmosReviewedCalendarEvent_(calendar, payload);

  if (action === 'DELETE_APPROVED_EVENT') {
    if (event) throw new Error('Approved reviewed event deletion could not be verified.');
    return {verified: true, eventId: ''};
  }
  if (action === 'PRESERVE_EVENT') return {verified: true, eventId: String(result && result.eventId || '')};
  if (!event) throw new Error('Reviewed Calendar event could not be reloaded after synchronization.');

  const metadata = parsePmosReviewedEventMetadata_(event.getDescription());
  if (action === 'LINK_CUSTOMER') {
    if (String(metadata.PMOS_CUSTOMER_ID || '') !== String(review.customerId || '')) {
      throw new Error('Reviewed customer link could not be verified.');
    }
    return {verified: true, eventId: String(event.getId() || '')};
  }
  if (String(metadata.PMOS_EVENT_TYPE || '') !== 'TEMPORARY_VISIT') {
    throw new Error('Temporary Visit registration could not be verified.');
  }
  return {verified: true, eventId: String(event.getId() || '')};
}

function findPmosReviewedCalendarEvent_(calendar, payload) {
  const review = payload && payload.review || {};
  const current = payload && payload.current || {};
  const ids = [review.eventId, current.eventId, payload.itemKey]
    .map(function (value) { return String(value || '').trim(); })
    .filter(Boolean);
  for (let index = 0; index < ids.length; index++) {
    try {
      const event = calendar.getEventById(ids[index]);
      if (event) return event;
    } catch (error) {}
  }
  return null;
}

function upsertPmosReviewedEventMetadata_(description, values) {
  const original = String(description || '');
  const lines = original.split(/\r?\n/).filter(function (line) {
    return !/^PMOS_[A-Z0-9_]+\s*:/.test(String(line || '').trim());
  });
  Object.keys(values || {}).sort().forEach(function (key) {
    const value = String(values[key] == null ? '' : values[key]).trim();
    if (value) lines.push(key + ': ' + value);
  });
  return lines.join('\n').trim();
}

function parsePmosReviewedEventMetadata_(description) {
  const metadata = {};
  String(description || '').split(/\r?\n/).forEach(function (line) {
    const match = String(line || '').match(/^\s*(PMOS_[A-Z0-9_]+)\s*:\s*(.*?)\s*$/);
    if (match) metadata[match[1]] = match[2];
  });
  return metadata;
}
