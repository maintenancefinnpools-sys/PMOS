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
  const registered = readRegisteredPmosCalendarSeriesState_(calendar,records);
  const events = readPmosCalendarEventsInRange_(calendar,range);
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

function readRegisteredPmosCalendarSeriesState_(calendar, registry) {
  const records = [];
  let presentCount = 0;
  let missingCount = 0;
  Object.keys(registry || {}).sort().forEach(function(seriesKey){
    const record = registry[seriesKey] || {};
    let series = null;
    let error = '';
    if (record.seriesId) {
      try { series = calendar.getEventSeriesById(record.seriesId); }
      catch (caught) { error = String(caught || ''); }
    }
    const present = Boolean(series);
    if (present) presentCount++; else missingCount++;
    const actualDescription = present ? safePmosCalendarRead_(series,'getDescription') : '';
    const metadata = parsePmosCalendarMetadata_(actualDescription);
    records.push({
      state:present ? PMOS_CALENDAR_STATE.REGISTERED_PRESENT : PMOS_CALENDAR_STATE.REGISTERED_MISSING,
      seriesKey:seriesKey,seriesId:String(record.seriesId || ''),
      customerId:String(record.customerId || ''),layer:String(record.layer || ''),
      calendarName:String(record.calendarName || ''),signature:String(record.signature || ''),
      status:String(record.status || ''),objectId:String(record.objectId || metadata.PMOS_OBJECT_ID || ''),
      objectVersion:Number(record.currentVersion || metadata.PMOS_OBJECT_VERSION || 0),
      lastVerified:String(record.lastVerified || ''),
      lastTransactionId:String(record.lastTransactionId || ''),
      actualTitle:present ? safePmosCalendarRead_(series,'getTitle') : '',
      actualDescription:actualDescription,
      actualLocation:present ? safePmosCalendarRead_(series,'getLocation') : '',
      readError:error
    });
  });
  return {records:records,presentCount:presentCount,missingCount:missingCount};
}

function readPmosCalendarEventsInRange_(calendar, range) {
  return calendar.getEvents(range.start,range.end).map(function(event){
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
    if (!event.isRecurringEvent()) return '';
    const series = event.getEventSeries();
    return series ? String(series.getId() || '') : '';
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
