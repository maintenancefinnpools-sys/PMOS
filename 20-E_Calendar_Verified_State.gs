/**
 * PMOS verified Calendar planning state.
 *
 * Combines the registry with actual read-only Calendar observations. It does not
 * write to Calendar, Sheets, Properties, triggers, or job state.
 */

function buildVerifiedPmosCalendarSeriesState_(currentState, registry) {
  const state = currentState || {};
  const registryRecords = registry || {};
  const records = [];
  const missingRegistrySeries = [];
  const seenSeriesIdentities = {};
  const registeredSeriesKeys = {};

  (state.registeredSeries || []).forEach(function (observed) {
    const key = String(observed.seriesKey || '').trim();
    if (!key) return;

    if (observed.state === PMOS_CALENDAR_STATE.REGISTERED_MISSING) {
      missingRegistrySeries.push({
        seriesKey: key,
        seriesId: String(observed.seriesId || ''),
        customerId: String(observed.customerId || ''),
        layer: String(observed.layer || ''),
        readError: String(observed.readError || '')
      });
      return;
    }

    // A registered series key is the authoritative identity. Google Calendar
    // may expose the same series ID in different forms when it is read through
    // the registry and through an occurrence. Keep one canonical current record
    // for the registered key rather than manufacturing a planner duplicate.
    if (registeredSeriesKeys[key]) return;
    registeredSeriesKeys[key] = true;

    const record = registryRecords[key] || observed;
    const seriesId = String(observed.seriesId || record.seriesId || '').trim();
    const identity = key + '::' + seriesId;
    seenSeriesIdentities[identity] = true;

    records.push({
      seriesKey: key,
      seriesId: seriesId,
      customerId: String(record.customerId || observed.customerId || ''),
      layer: String(record.layer || observed.layer || ''),
      calendarName: String(state.calendarName || record.calendarName || ''),
      title: String(observed.actualTitle || ''),
      description: String(observed.actualDescription || ''),
      location: String(observed.actualLocation || ''),
      signature: String(record.signature || observed.signature || ''),
      status: String(record.status || observed.status || ''),
      metadata: {
        verifiedState: PMOS_CALENDAR_STATE.REGISTERED_PRESENT,
        registryRow: Number(record.row || 0)
      }
    });
  });

  (state.events || []).forEach(function (event) {
    if (event.eventType !== PMOS_CALENDAR_EVENT_TYPE.RECURRING_ROUTE) return;

    const key = String(event.seriesKey || '').trim();
    const seriesId = String(event.seriesId || '').trim();
    if (!key || !seriesId) return;

    // The registered record above already represents this managed series. Do
    // not add its event-snapshot representation a second time merely because
    // Google returned a differently formatted series ID.
    if (registeredSeriesKeys[key]) return;

    const identity = key + '::' + seriesId;
    if (seenSeriesIdentities[identity]) return;
    seenSeriesIdentities[identity] = true;

    const registryRecord = registryRecords[key] || {};
    records.push({
      seriesKey: key,
      seriesId: seriesId,
      customerId: String(event.customerId || registryRecord.customerId || ''),
      layer: String(registryRecord.layer || ''),
      calendarName: String(state.calendarName || registryRecord.calendarName || ''),
      title: String(event.title || ''),
      start: String(event.start || ''),
      end: String(event.end || ''),
      location: String(event.location || ''),
      description: String(event.description || ''),
      signature: '',
      status: 'Calendar Only',
      metadata: {
        verifiedState: PMOS_CALENDAR_STATE.CALENDAR_ONLY,
        eventId: String(event.eventId || '')
      }
    });
  });

  return freezePmosCalendarPlannerValue_({
    records: records,
    missingRegistrySeries: missingRegistrySeries,
    reviewEvents: (state.events || []).filter(function (event) {
      return event.eventType === PMOS_CALENDAR_EVENT_TYPE.UNCLASSIFIED;
    }),
    temporaryVisits: (state.events || []).filter(function (event) {
      return event.eventType === PMOS_CALENDAR_EVENT_TYPE.TEMPORARY_VISIT;
    }),
    repairVisits: (state.events || []).filter(function (event) {
      return event.eventType === PMOS_CALENDAR_EVENT_TYPE.REPAIR_VISIT;
    })
  });
}

function appendPmosCalendarStateReviewPlan_(basePlan, currentState, verifiedState) {
  const reviewOperations = [];
  const verified = verifiedState || {};

  (verified.reviewEvents || []).forEach(function (event) {
    reviewOperations.push({
      planner: PMOS_CALENDAR_PLANNER_NAME,
      action: PMOS_OPERATION.WARNING,
      entity: 'CALENDAR_EVENT',
      entityId: String(event.eventId || ''),
      destination: PMOS_CALENDAR_DESTINATION,
      priority: PMOS_OPERATION_PRIORITY.NORMAL,
      reason: 'Unclassified Calendar event requires user review before synchronization.',
      payload: {
        calendarName: currentState.calendarName || '',
        current: event
      },
      metadata: {
        blocking: false,
        reviewRequired: true,
        reviewType: 'UNCLASSIFIED_CALENDAR_EVENT'
      }
    });
  });

  const operations = (basePlan.operations || []).concat(reviewOperations);
  return createPmosPlan({
    id: basePlan.id,
    type: basePlan.type,
    planner: basePlan.planner,
    createdAt: basePlan.createdAt,
    sourceVersion: basePlan.sourceVersion,
    operations: operations,
    metadata: Object.assign({}, basePlan.metadata || {}, {
      verifiedCalendarState: true,
      registeredPresentCount: Number(currentState.registeredPresentCount || 0),
      registeredMissingCount: Number(currentState.registeredMissingCount || 0),
      temporaryVisitCount: Number(currentState.temporaryVisitCount || 0),
      repairVisitCount: Number(currentState.repairVisitCount || 0),
      unclassifiedEventCount: Number(currentState.unclassifiedCount || 0),
      reviewRequiredCount: reviewOperations.length
    })
  });
}

function buildPmosCalendarVerifiedSourceVersion_(desiredSeries, verifiedState, currentState) {
  const desired = (desiredSeries || []).map(function (series) {
    return String(series.seriesKey || '') + ':' + String(series.signature || '');
  }).sort();

  const current = ((verifiedState && verifiedState.records) || []).map(function (series) {
    return [
      String(series.seriesKey || ''),
      String(series.seriesId || ''),
      String(series.signature || ''),
      String(series.title || ''),
      String(series.start || ''),
      String(series.end || '')
    ].join(':');
  }).sort();

  const missing = ((verifiedState && verifiedState.missingRegistrySeries) || [])
    .map(function (series) {
      return String(series.seriesKey || '') + ':' + String(series.seriesId || '');
    }).sort();

  const review = ((verifiedState && verifiedState.reviewEvents) || [])
    .map(function (event) {
      return String(event.eventId || '') + ':' + String(event.start || '');
    }).sort();

  return 'CALENDAR_SOURCE_' + pmosCalendarHash_(JSON.stringify({
    calendarId: currentState && currentState.calendarId || '',
    range: currentState && currentState.range || {},
    desired: desired,
    current: current,
    missing: missing,
    review: review
  }));
}
