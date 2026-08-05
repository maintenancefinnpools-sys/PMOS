/** Saves Suggested Match decisions with the exact approved customer identity. */
function savePmosCalendarSuggestedMatchDecisionsForSync_(items, exemptIndexes) {
  const exempt = {};
  (exemptIndexes || []).forEach(function (index) {
    exempt[Number(index)] = true;
  });

  const records = [];
  let approvedCount = 0;
  let exemptCount = 0;

  (items || []).forEach(function (item, index) {
    const eventKey = String(item && (item.eventId || item.seriesId) || '').trim();
    if (!eventKey) {
      throw new Error('A suggested match is missing its Calendar event identity.');
    }

    const decision = exempt[index] ? 'IGNORE' : 'MATCH';
    if (decision === 'MATCH') approvedCount++;
    else exemptCount++;

    records.push({
      itemKey: eventKey,
      decision: decision,
      payload: {
        eventId: String(item && item.eventId || ''),
        seriesId: String(item && item.seriesId || ''),
        customerId: String(item && item.customerId || ''),
        customerName: String(item && item.customerName || ''),
        customerAddress: String(item && item.customerAddress || ''),
        title: String(item && item.title || ''),
        start: String(item && item.start || ''),
        end: String(item && item.end || ''),
        location: String(item && item.location || '')
      }
    });
  });

  const saved = savePmosReviewStep_('CALENDAR', 'SUGGESTED_MATCH', records);
  if (!saved || saved.decisionCount !== records.length) {
    throw new Error('Not all suggested-match decisions were saved.');
  }

  return {
    saved: true,
    decisionCount: records.length,
    approvedCount: approvedCount,
    exemptCount: exemptCount,
    reviewSessionId: saved.sessionId
  };
}
