/**
 * PMOS read-only Calendar current-state reader.
 */
const PMOS_CALENDAR_EVENT_TYPE = Object.freeze({
  RECURRING_ROUTE:'RECURRING_ROUTE',TEMPORARY_VISIT:'TEMPORARY_VISIT',
  REPAIR_VISIT:'REPAIR_VISIT',UNCLASSIFIED:'UNCLASSIFIED'
});
const PMOS_CALENDAR_STATE = Object.freeze({
  REGISTERED_PRESENT:'REGISTERED_PRESENT',REGISTERED_MISSING:'REGISTERED_MISSING',
  CALENDAR_ONLY:'CALENDAR_ONLY',TEMPORARY_VISIT:'TEMPORARY_VISIT',
  REPAIR_VISIT:'REPAIR_VISIT',UNCLASSIFIED:'UNCLASSIFIED'
});

function readPmosCalendarCurrentState_(settings, registry, options) {
  const configuration = settings || getRecurringCalendarSettings_();
  const records = registry || readExistingPmosCalendarRegistry_();
  const range = normalizePmosCalendarReadRange_(configuration,options);
  const calendar = getExistingConfiguredPmosCalendar_(configuration.calendarName);

  // Fetch the audit range exactly once. The same snapshot is used both to
  // classify Calendar events and to verify registered recurring series.
  const rawEvents = calendar.getEvents(range.start,range.end);
  const observedSeries = indexObservedPmosCalendarSeries_(rawEvents);
  const registered = readRegisteredPmosCalendarSeriesState_(
    calendar,
    records,
    observedSeries,
    range
  );
  const events = readPmosCalendarEventsInRange_(calendar,range,rawEvents);

  return freezePmosCalendarPlannerValue_({
    calendarName:calendar.getName(),calendarId:calendar.getId(),
    range:{start:range.start.toISOString(),end:range.end.toISOString(),includeStartedToday:range.includeStartedToday},
    registeredSeries:registered.records,
    registeredPresentCount:registered.presentCount,
    registeredMissingCount:registered.missingCount,
    events:events,eventCount:events.length,
    recurringRouteCount:countPmosCalendarStateType_(events,PMOS_CALENDAR_EVENT_TYPE.RECURRING_ROUTE),
    temporaryVisitCount:countPmosCalendarStateType_(events,PMOS_CALENDAR_EVENT_TYPE.TEMPORARY_VISIT),
    repairVisitCount:countPmosCalendarStateType_(events,PMOS_CALENDAR_EVENT_TYPE.REPAIR_VISIT),
    unclassifiedCount:countPmosCalendarStateType_(events,PMOS_CALENDAR_EVENT_TYPE.UNCLASSIFIED)
  });
}

function getExistingConfiguredPmosCalendar_(calendarName) {
  const name = String(calendarName || '').trim();
  if (!name) throw new Error('Calendar Name is blank in App Settings.');
  if (typeof resolvePmosCalendarByName_ === 'function') {
    return resolvePmosCalendarByName_(name);
  }

  const matches = CalendarApp.getCalendarsByName(name);
  if (!matches.length) {
    throw new Error('Configured Calendar does not exist: ' + name + '. Create it through PMOS setup before running Calendar Preview.');
  }
  if (matches.length > 1) {
    throw new Error('More than one Calendar is named "' + name + '". PMOS requires one unambiguous destination Calendar.');
  }
  return matches[0];
}

function normalizePmosCalendarReadRange_(settings, options) {
  const stored = typeof readPmosCalendarAuditOptions_ === 'function'
    ? readPmosCalendarAuditOptions_()
    : {includeStartedToday:false};
  const source = Object.assign({}, stored || {}, options || {});
  const now = new Date();
  const today = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const configuredEnd = settings && settings.seasonEnd instanceof Date ? new Date(settings.seasonEnd) : today;
  const requestedStart = source.startDate instanceof Date ? new Date(source.startDate) : today;
  const requestedEnd = source.endDate instanceof Date ? new Date(source.endDate) : configuredEnd;
  requestedStart.setHours(0,0,0,0);
  requestedEnd.setHours(23,59,59,999);
  const includeStartedToday = source.includeStartedToday === true;
  const effectiveStart = !includeStartedToday && requestedStart.getTime() === today.getTime()
    ? new Date(now.getTime()) : requestedStart;
  if (requestedEnd.getTime() < effectiveStart.getTime()) {
    throw new Error('Calendar Sync end date must not be before its start date.');
  }
  return {start:effectiveStart,end:requestedEnd,includeStartedToday:includeStartedToday};
}

/**
 * Index recurring occurrences from the one range snapshot.
 * CalendarEvent#getId() is the recurring iCal identity used by
 * Calendar#getEventSeriesById(), so no getEventSeries() round trip is needed.
 */
function indexObservedPmosCalendarSeries_(events) {
  const bySeriesId = {};
  (events || []).forEach(function(event) {
    let recurring = false;
    try { recurring = event.isRecurringEvent(); }
    catch (error) { recurring = false; }
    if (!recurring) return;

    const seriesId = String(event.getId() || '');
    if (seriesId && !bySeriesId[seriesId]) bySeriesId[seriesId] = event;
  });
  return bySeriesId;
}

function readRegisteredPmosCalendarSeriesState_(calendar, registry, observedSeries, range) {
  const records = [];
  let presentCount = 0;
  let missingCount = 0;
  const observed = observedSeries || {};
  const rangeDays = Math.max(
    0,
    (range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000)
  );

  // PMOS maintenance recurrence is weekly, biweekly, or monthly. In an audit
  // window of at least 35 days, an active PMOS series must have an occurrence
  // in the single Calendar snapshot. Shorter windows retain exact ID lookup.
  const canVerifyFromSnapshot = rangeDays >= 35;

  Object.keys(registry || {}).sort().forEach(function(seriesKey){
    const record = registry[seriesKey] || {};
    const seriesId = String(record.seriesId || '');
    let representative = seriesId ? observed[seriesId] || null : null;
    let series = null;
    let error = '';

    if (!representative && seriesId && !canVerifyFromSnapshot) {
      try { series = calendar.getEventSeriesById(seriesId); }
      catch (caught) { error = String(caught || ''); }
    }

    const present = Boolean(representative || series);
    if (present) presentCount++; else missingCount++;
    const source = representative || series;
    const actualDescription = present ? safePmosCalendarRead_(source,'getDescription') : '';
    const metadata = parsePmosCalendarMetadata_(actualDescription);
    records.push({
      state:present ? PMOS_CALENDAR_STATE.REGISTERED_PRESENT : PMOS_CALENDAR_STATE.REGISTERED_MISSING,
      seriesKey:seriesKey,seriesId:seriesId,
      customerId:String(record.customerId || ''),layer:String(record.layer || ''),
      calendarName:String(record.calendarName || ''),signature:String(record.signature || ''),
      status:String(record.status || ''),objectId:String(record.objectId || metadata.PMOS_OBJECT_ID || ''),
      objectVersion:Number(record.currentVersion || metadata.PMOS_OBJECT_VERSION || 0),
      lastVerified:String(record.lastVerified || ''),
      lastTransactionId:String(record.lastTransactionId || ''),
      actualTitle:present ? safePmosCalendarRead_(source,'getTitle') : '',
      actualDescription:actualDescription,
      actualLocation:present ? safePmosCalendarRead_(source,'getLocation') : '',
      readError:error
    });
  });
  return {records:records,presentCount:presentCount,missingCount:missingCount};
}

function readPmosCalendarEventsInRange_(calendar, range, rawEvents) {
  const events = rawEvents || calendar.getEvents(range.start,range.end);
  return events.map(function(event){
    const description = String(event.getDescription() || '');
    const metadata = parsePmosCalendarMetadata_(description);
    const eventType = classifyPmosCalendarEventType_(metadata);
    return {
      state:eventType === PMOS_CALENDAR_EVENT_TYPE.TEMPORARY_VISIT
        ? PMOS_CALENDAR_STATE.TEMPORARY_VISIT
        : eventType === PMOS_CALENDAR_EVENT_TYPE.REPAIR_VISIT
          ? PMOS_CALENDAR_STATE.REPAIR_VISIT
          : eventType === PMOS_CALENDAR_EVENT_TYPE.RECURRING_ROUTE
            ? PMOS_CALENDAR_STATE.CALENDAR_ONLY
            : PMOS_CALENDAR_STATE.UNCLASSIFIED,
      eventType:eventType,eventId:String(event.getId() || ''),
      seriesId:readPmosCalendarEventSeriesId_(event),title:String(event.getTitle() || ''),
      description:description,location:String(event.getLocation() || ''),
      start:event.getStartTime().toISOString(),end:event.getEndTime().toISOString(),
      allDay:event.isAllDayEvent(),seriesKey:metadata.PMOS_SERIES_KEY || '',
      customerId:metadata.PMOS_CUSTOMER_ID || '',temporaryVisitId:metadata.PMOS_TEMP_VISIT_ID || '',
      repairVisitId:metadata.PMOS_REPAIR_VISIT_ID || '',objectId:metadata.PMOS_OBJECT_ID || '',
      objectVersion:Number(metadata.PMOS_OBJECT_VERSION || 0),
      managed:metadata.PMOS_MANAGED === 'true' || Boolean(metadata.PMOS_SERIES_KEY || metadata.PMOS_TEMP_VISIT_ID)
    };
  });
}

function parsePmosCalendarMetadata_(description) {
  const metadata = {};
  String(description || '').split(/\r?\n/).forEach(function(line){
    const match = line.match(/^\s*(PMOS_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) metadata[match[1]] = match[2];
  });
  return metadata;
}

function classifyPmosCalendarEventType_(metadata) {
  const declared = String(metadata.PMOS_EVENT_TYPE || '').trim().toUpperCase();
  if (declared === PMOS_CALENDAR_EVENT_TYPE.TEMPORARY_VISIT || metadata.PMOS_TEMP_VISIT_ID) return PMOS_CALENDAR_EVENT_TYPE.TEMPORARY_VISIT;
  if (declared === PMOS_CALENDAR_EVENT_TYPE.REPAIR_VISIT || metadata.PMOS_REPAIR_VISIT_ID) return PMOS_CALENDAR_EVENT_TYPE.REPAIR_VISIT;
  if (declared === PMOS_CALENDAR_EVENT_TYPE.RECURRING_ROUTE || metadata.PMOS_SERIES_KEY) return PMOS_CALENDAR_EVENT_TYPE.RECURRING_ROUTE;
  return PMOS_CALENDAR_EVENT_TYPE.UNCLASSIFIED;
}

function readPmosCalendarEventSeriesId_(event) {
  try {
    return event.isRecurringEvent() ? String(event.getId() || '') : '';
  } catch (error) { return ''; }
}

function safePmosCalendarRead_(object, methodName) {
  try {
    return object && typeof object[methodName] === 'function'
      ? String(object[methodName]() || '') : '';
  } catch (error) { return ''; }
}

function countPmosCalendarStateType_(events, eventType) {
  return (events || []).filter(function(event){ return event.eventType === eventType; }).length;
}
