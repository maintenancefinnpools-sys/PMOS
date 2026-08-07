/** Applies an approved Suggested Match to the exact reviewed Calendar event. */
function executeReviewedCalendarMatchOperation_(operation, calendar) {
  const payload = operation && operation.payload || {};
  const current = payload.current || {};
  const review = payload.review || {};
  const customerId = String(review.customerId || '').trim();
  const identity = {
    eventId:String(review.eventId || current.eventId || '').trim(),
    seriesId:String(review.seriesId || current.seriesId || '').trim(),
    start:String(review.start || current.start || ''),
    end:String(review.end || current.end || ''),
    title:String(review.title || current.title || ''),
    location:String(review.location || current.location || '')
  };

  if (!customerId) throw new Error('MATCH operation is missing the approved Customer ID.');
  if (!identity.eventId && !identity.seriesId) throw new Error('MATCH operation is missing the reviewed Calendar event identity.');

  const target = resolveReviewedCalendarTarget_(calendar, identity);
  if (!target.object) throw new Error('The reviewed Calendar event could not be found for MATCH: ' + String(identity.eventId || identity.seriesId) + '.');

  const title = String(review.customerTitle || review.customerName || current.title || '').trim();
  const location = String(review.customerAddress || current.location || '').trim();
  const description = upsertReviewedCalendarMetadata_(target.object.getDescription(), {
    PMOS_MANAGED:'true',PMOS_CUSTOMER_ID:customerId,
    PMOS_REVIEW_SESSION_ID:String(review.reviewSessionId || '').trim(),PMOS_REVIEW_ACTION:'MATCH'
  });

  if (title) target.object.setTitle(title);
  target.object.setLocation(location);
  target.object.setDescription(description);
  if (target.kind === 'SERIES') {
    target.object.setTag('PMOS_CUSTOMER_ID', customerId);
    target.object.setTag('PMOS_MANAGED', 'true');
  }

  verifyReviewedCalendarMatchOperation_(calendar, {
    eventId:identity.eventId,seriesId:identity.seriesId,start:identity.start,end:identity.end,
    customerId:customerId,title:title,location:location
  });
  return {action:'UPDATE',id:String(target.object.getId() || identity.eventId || identity.seriesId),reviewAction:'MATCH',customerId:customerId};
}

/** Compatibility helper retained for callers using the former signature. */
function findReviewedCalendarMatchTarget_(calendar, eventId, seriesId, snapshot) {
  return resolveReviewedCalendarTarget_(calendar, Object.assign({}, snapshot || {}, {
    eventId:String(eventId || ''),seriesId:String(seriesId || '')
  }));
}

function verifyReviewedCalendarMatchOperation_(calendar, expected) {
  const target = resolveReviewedCalendarTarget_(calendar, expected || {});
  if (!target.object) throw new Error('MATCH verification failed because the Calendar event could not be reloaded.');
  const metadata = parsePmosCalendarMetadata_(String(target.object.getDescription() || ''));
  if (String(metadata.PMOS_CUSTOMER_ID || '') !== expected.customerId) throw new Error('MATCH verification failed because the approved Customer ID was not stored.');
  if (String(metadata.PMOS_MANAGED || '').toLowerCase() !== 'true') throw new Error('MATCH verification failed because the event was not marked as PMOS-managed.');
  if (expected.title && String(target.object.getTitle() || '') !== expected.title) throw new Error('MATCH verification failed because the Calendar title was not updated.');
  if (String(target.object.getLocation() || '') !== expected.location) throw new Error('MATCH verification failed because the Calendar location was not updated.');
}

function upsertReviewedCalendarMetadata_(description, values) {
  const replacements = values || {}, keys = {};
  Object.keys(replacements).forEach(function(key){keys[key]=true;});
  const lines = String(description || '').split(/\r?\n/).filter(function(line){
    const match=String(line||'').match(/^\s*(PMOS_[A-Z0-9_]+)\s*[=:]/);return !match||!keys[match[1]];
  });
  Object.keys(replacements).sort().forEach(function(key){const value=String(replacements[key]==null?'':replacements[key]).trim();if(value)lines.push(key+'='+value);});
  return lines.join('\n').trim();
}
