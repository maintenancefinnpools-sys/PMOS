/** Converts an explicitly reviewed one-time Calendar event into a PMOS Temporary Visit. */
function executeReviewedCalendarTemporaryOperation_(operation, calendar) {
  const payload = operation && operation.payload || {};
  const current = payload.current || {};
  const review = payload.review || {};
  const identity = {
    eventId:String(current.eventId || review.eventId || operation.entityId || '').trim(),
    seriesId:String(current.seriesId || review.seriesId || '').trim(),
    start:String(review.start || current.start || ''),
    end:String(review.end || current.end || ''),
    title:String(review.title || current.title || ''),
    location:String(review.location || current.location || '')
  };

  if (!identity.eventId) throw new Error('TEMPORARY review operation is missing its Calendar event ID.');
  if (identity.seriesId) throw new Error('TEMPORARY review operation targets a recurring series. Temporary Visits must remain one-time Calendar events.');

  const target = resolveReviewedCalendarTarget_(calendar, identity);
  const event = target && target.kind === 'EVENT' ? target.object : null;
  if (!event) throw new Error('Reviewed Calendar event could not be found for TEMPORARY: ' + identity.eventId);
  if (event.isRecurringEvent()) throw new Error('Reviewed Calendar event is recurring. PMOS stopped rather than converting a recurring series into a Temporary Visit.');

  const existingDescription = String(event.getDescription() || '');
  const existingMetadata = parsePmosCalendarMetadata_(existingDescription);
  const temporaryVisitId = String(existingMetadata.PMOS_TEMP_VISIT_ID || Utilities.getUuid());
  event.setDescription(upsertReviewedCalendarMetadata_(existingDescription, {
    PMOS_MANAGED:'true',PMOS_EVENT_TYPE:'TEMPORARY_VISIT',PMOS_TEMP_VISIT_ID:temporaryVisitId,
    PMOS_REVIEW_SESSION_ID:String(review.reviewSessionId || ''),PMOS_REVIEW_ACTION:'TEMPORARY'
  }));

  const verifiedTarget = resolveReviewedCalendarTarget_(calendar, identity);
  const verified = verifiedTarget && verifiedTarget.kind === 'EVENT' ? verifiedTarget.object : null;
  if (!verified) throw new Error('Temporary Visit could not be reloaded after conversion: ' + identity.eventId);
  const metadata = parsePmosCalendarMetadata_(verified.getDescription());
  if (String(metadata.PMOS_EVENT_TYPE || '') !== 'TEMPORARY_VISIT') throw new Error('Temporary Visit conversion could not be verified for event ' + identity.eventId + '.');
  if (String(metadata.PMOS_TEMP_VISIT_ID || '') !== temporaryVisitId) throw new Error('Temporary Visit identity could not be verified for event ' + identity.eventId + '.');
  if (String(metadata.PMOS_MANAGED || '') !== 'true') throw new Error('Temporary Visit managed status could not be verified for event ' + identity.eventId + '.');

  invalidateTemporaryRouteSnapshot_(verified.getStartTime());
  return {action:'UPDATE',id:identity.eventId,temporaryVisitId:temporaryVisitId,reviewAction:'TEMPORARY'};
}
