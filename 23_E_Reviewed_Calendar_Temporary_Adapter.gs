/** Converts an explicitly reviewed one-time Calendar event into a PMOS Temporary Visit. */
function executeReviewedCalendarTemporaryOperation_(operation, calendar) {
  const payload = operation && operation.payload || {};
  const current = payload.current || {};
  const review = payload.review || {};
  const eventId = String(
    current.eventId || review.eventId || operation.entityId || ''
  ).trim();

  if (!eventId) {
    throw new Error('TEMPORARY review operation is missing its Calendar event ID.');
  }
  if (String(current.seriesId || review.seriesId || '').trim()) {
    throw new Error(
      'TEMPORARY review operation targets a recurring series. ' +
      'Temporary Visits must remain one-time Calendar events.'
    );
  }

  const event = calendar.getEventById(eventId);
  if (!event) {
    throw new Error('Reviewed Calendar event could not be found for TEMPORARY: ' + eventId);
  }
  if (event.isRecurringEvent()) {
    throw new Error(
      'Reviewed Calendar event is recurring. PMOS stopped rather than converting a recurring series into a Temporary Visit.'
    );
  }

  const existingDescription = String(event.getDescription() || '');
  const existingMetadata = parsePmosCalendarMetadata_(existingDescription);
  const temporaryVisitId = String(existingMetadata.PMOS_TEMP_VISIT_ID || Utilities.getUuid());
  const description = upsertReviewedCalendarMetadata_(existingDescription, {
    PMOS_MANAGED: 'true',
    PMOS_EVENT_TYPE: 'TEMPORARY_VISIT',
    PMOS_TEMP_VISIT_ID: temporaryVisitId,
    PMOS_REVIEW_SESSION_ID: String(review.reviewSessionId || ''),
    PMOS_REVIEW_ACTION: 'TEMPORARY'
  });

  event.setDescription(description);

  const verified = calendar.getEventById(eventId);
  if (!verified) {
    throw new Error('Temporary Visit could not be reloaded after conversion: ' + eventId);
  }
  const metadata = parsePmosCalendarMetadata_(verified.getDescription());
  if (String(metadata.PMOS_EVENT_TYPE || '') !== 'TEMPORARY_VISIT') {
    throw new Error('Temporary Visit conversion could not be verified for event ' + eventId + '.');
  }
  if (String(metadata.PMOS_TEMP_VISIT_ID || '') !== temporaryVisitId) {
    throw new Error('Temporary Visit identity could not be verified for event ' + eventId + '.');
  }
  if (String(metadata.PMOS_MANAGED || '') !== 'true') {
    throw new Error('Temporary Visit managed status could not be verified for event ' + eventId + '.');
  }

  invalidateTemporaryRouteSnapshot_(verified.getStartTime());
  return {
    action: 'UPDATE',
    id: eventId,
    temporaryVisitId: temporaryVisitId,
    reviewAction: 'TEMPORARY'
  };
}
