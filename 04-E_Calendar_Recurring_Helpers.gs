/**
 * PMOS recurring Calendar helper functions.
 */
function firstOccurrenceForLayer_(parsed, settings, yearRound, serviceStartDate) {
  const dayOffsets = {Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
  if (!Object.prototype.hasOwnProperty.call(dayOffsets, parsed.day)) {
    throw new Error('Unsupported route weekday "' + parsed.day + '" in ' + parsed.routeDay + '.');
  }
  const date = new Date(settings.rotationWeek1Start.getTime());
  date.setHours(12,0,0,0);
  date.setDate(date.getDate() + (parsed.week - 1) * 7 + dayOffsets[parsed.day]);
  const routeStart = parseFlexibleRouteTime_(settings.routeStart);
  date.setHours(routeStart.hours, routeStart.minutes, 0, 0);
  let earliest = yearRound ? null : new Date(settings.seasonStart.getTime());
  if (serviceStartDate instanceof Date && Number.isFinite(serviceStartDate.getTime())) {
    const requestedStart = new Date(serviceStartDate.getTime());
    requestedStart.setHours(0, 0, 0, 0);
    if (!earliest || requestedStart.getTime() > earliest.getTime()) earliest = requestedStart;
  } else if (String(serviceStartDate || '').trim()) {
    const startText = String(serviceStartDate).trim();
    const localMatch = startText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const requestedStart = localMatch
      ? new Date(Number(localMatch[1]), Number(localMatch[2]) - 1, Number(localMatch[3]))
      : new Date(startText);
    if (Number.isFinite(requestedStart.getTime())) {
      requestedStart.setHours(0, 0, 0, 0);
      if (!earliest || requestedStart.getTime() > earliest.getTime()) earliest = requestedStart;
    }
  }
  while (earliest && date.getTime() < earliest.getTime()) {
    date.setDate(date.getDate() + 28);
  }
  date.setHours(12,0,0,0);
  return date;
}

function endOfDay_(date) {
  const result = new Date(date);
  result.setHours(23,59,59,999);
  return result;
}

function buildFourWeekRecurrence_(plan) {
  const recurrence = CalendarApp.newRecurrence().setTimeZone(PMOS.TIMEZONE);
  const weeklyRule = recurrence.addWeeklyRule().interval(4);
  if (plan.until) weeklyRule.until(plan.until);
  return recurrence;
}

function createRecurringSeries_(calendar, plan) {
  const series = calendar.createEventSeries(
    plan.title, plan.start, plan.end, buildFourWeekRecurrence_(plan),
    {description: buildPmosManagedRecurringDescription_(plan), location: plan.location}
  );
  applyPmosRecurringSeriesIdentity_(series, plan);
  if (plan.color) series.setColor(plan.color);
  return series;
}

function updateRecurringSeries_(series, plan, calendar) {
  if (!calendar || typeof calendar.getEvents !== 'function') {
    throw new Error('Recurring-series UPDATE requires its owning Calendar.');
  }
  const seriesId = String(series && series.getId ? series.getId() : '').trim();
  if (!seriesId) throw new Error('Recurring-series UPDATE is missing its Calendar series ID.');
  if (!(plan.start instanceof Date) || !Number.isFinite(plan.start.getTime()) ||
      !(plan.end instanceof Date) || !Number.isFinite(plan.end.getTime())) {
    throw new Error('Recurring-series UPDATE has invalid desired times.');
  }

  // setRecurrence() rebuilds the whole series and can alter or duplicate past
  // occurrences. PMOS history is immutable: update only today's and future
  // instances while retaining the managed recurring-series identity.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const desiredFirstDay = new Date(plan.start.getTime());
  desiredFirstDay.setHours(0, 0, 0, 0);
  const updateStart = desiredFirstDay.getTime() > today.getTime()
    ? desiredFirstDay : today;
  const updateEnd = plan.until instanceof Date && Number.isFinite(plan.until.getTime())
    ? new Date(plan.until.getTime())
    : new Date(updateStart.getTime() + 370 * 24 * 60 * 60 * 1000);
  updateEnd.setHours(23, 59, 59, 999);
  const duration = Math.max(60000, plan.end.getTime() - plan.start.getTime());
  const description = buildPmosManagedRecurringDescription_(plan);

  calendar.getEvents(updateStart, updateEnd).forEach(function(event) {
    if (readPmosCalendarEventSeriesId_(event) !== seriesId) return;
    const existingStart = event.getStartTime();
    const desiredStart = new Date(existingStart.getTime());
    desiredStart.setHours(
      plan.start.getHours(), plan.start.getMinutes(),
      plan.start.getSeconds(), plan.start.getMilliseconds()
    );
    const desiredEnd = new Date(desiredStart.getTime() + duration);
    if (String(event.getTitle() || '') !== String(plan.title || '')) {
      event.setTitle(plan.title);
    }
    if (normalizePmosCalendarDescriptionForWrite_(event.getDescription()) !==
        normalizePmosCalendarDescriptionForWrite_(description)) {
      event.setDescription(description);
    }
    if (String(event.getLocation() || '') !== String(plan.location || '')) {
      event.setLocation(plan.location || '');
    }
    if (existingStart.getTime() !== desiredStart.getTime() ||
        event.getEndTime().getTime() !== desiredEnd.getTime()) {
      event.setTime(desiredStart, desiredEnd);
    }
    applyPmosRecurringSeriesIdentityIfChanged_(event, plan);
    if (plan.color && String(event.getColor() || '') !== String(plan.color)) {
      event.setColor(plan.color);
    }
  });

  // Preserve discoverability on the recurring-series parent without changing
  // its recurrence rule or rewriting historical occurrence content.
  applyPmosRecurringSeriesIdentityIfChanged_(series, plan);
}

function normalizePmosCalendarDescriptionForWrite_(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim();
}

function applyPmosRecurringSeriesIdentityIfChanged_(series, plan) {
  setPmosCalendarTagIfChanged_(series, 'PMOS_MANAGED', 'true');
  setPmosCalendarTagIfChanged_(series, 'PMOS_EVENT_TYPE', 'RECURRING_ROUTE');
  setPmosCalendarTagIfChanged_(series, 'PMOS_SERIES_KEY', plan.seriesKey);
  setPmosCalendarTagIfChanged_(series, 'PMOS_CUSTOMER_ID', plan.customerId || '');
  if (plan.objectId) {
    setPmosCalendarTagIfChanged_(series, 'PMOS_OBJECT_ID', plan.objectId);
  }
  if (plan.currentVersion) {
    setPmosCalendarTagIfChanged_(
      series, 'PMOS_OBJECT_VERSION', String(plan.currentVersion)
    );
  }
}

function setPmosCalendarTagIfChanged_(event, key, value) {
  let existing = null;
  try { existing = event.getTag(key); } catch (error) {}
  if (String(existing == null ? '' : existing) !== String(value || '')) {
    event.setTag(key, String(value || ''));
  }
}

function applyPmosRecurringSeriesIdentity_(series, plan) {
  series.setTag('PMOS_MANAGED', 'true');
  series.setTag('PMOS_EVENT_TYPE', 'RECURRING_ROUTE');
  series.setTag('PMOS_SERIES_KEY', plan.seriesKey);
  series.setTag('PMOS_CUSTOMER_ID', plan.customerId || '');
  if (plan.objectId) series.setTag('PMOS_OBJECT_ID', plan.objectId);
  if (plan.currentVersion) series.setTag('PMOS_OBJECT_VERSION', String(plan.currentVersion));
}

function buildPmosManagedRecurringDescription_(plan) {
  const metadataKeys = {
    PMOS_MANAGED:true, PMOS_EVENT_TYPE:true, PMOS_SERIES_KEY:true,
    PMOS_CUSTOMER_ID:true, PMOS_OBJECT_ID:true, PMOS_OBJECT_VERSION:true
  };
  const userLines = String(plan.description || '').replace(/\r\n?/g,'\n').split('\n')
    .filter(function(line){
      const match = String(line || '').match(/^\s*(PMOS_[A-Z0-9_]+)\s*=/);
      return !match || !metadataKeys[match[1]];
    });
  while (userLines.length && !String(userLines[0] || '').trim()) userLines.shift();
  while (userLines.length && !String(userLines[userLines.length - 1] || '').trim()) userLines.pop();
  const metadata = [
    'PMOS_MANAGED=true',
    'PMOS_EVENT_TYPE=RECURRING_ROUTE',
    'PMOS_SERIES_KEY=' + String(plan.seriesKey || ''),
    'PMOS_CUSTOMER_ID=' + String(plan.customerId || ''),
    'PMOS_OBJECT_ID=' + String(plan.objectId || ''),
    'PMOS_OBJECT_VERSION=' + String(plan.currentVersion || '')
  ];
  return userLines.length ? userLines.join('\n') + '\n\n' + metadata.join('\n') : metadata.join('\n');
}

function calendarColorForFrequency_(frequency) {
  const normalized = normalize_(frequency);
  if (normalized.indexOf('monthly') >= 0 || normalized.indexOf('4 week') >= 0) return '3';
  if (normalized.indexOf('biweekly') >= 0 || normalized.indexOf('bi weekly') >= 0) return '9';
  return '7';
}

function recurringSeriesSignature_(plan) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify({
      title:plan.title,start:plan.start.toISOString(),end:plan.end.toISOString(),
      until:plan.until ? plan.until.toISOString() : '',location:plan.location,
      description:plan.description,color:plan.color
    })
  ));
}

/**
 * Safe recurring-series lookup shared by synchronization, versioning and
 * transaction recovery. Missing/deleted series resolve to null.
 */
function readPmosRecurringSeriesById_(calendar, seriesId) {
  const id = String(seriesId || '').trim();
  if (!calendar || !id) return null;
  try {
    return calendar.getEventSeriesById(id) || null;
  } catch (error) {
    return null;
  }
}

/**
 * Resolve one PMOS recurring series without guessing. Registry identity wins;
 * when that identity is missing/stale, metadata may recover exactly one series.
 */
function findExistingPmosRecurringSeries_(calendar, plan, registryRecord) {
  const fromRegistry = readPmosRecurringSeriesById_(
    calendar,
    registryRecord && registryRecord.seriesId
  );
  if (fromRegistry) return fromRegistry;

  if (!calendar || !plan || !plan.seriesKey || !(plan.start instanceof Date)) {
    return null;
  }

  const searchStart = new Date(plan.start.getTime());
  searchStart.setDate(searchStart.getDate() - 1);
  searchStart.setHours(0, 0, 0, 0);
  const searchEnd = new Date(plan.start.getTime());
  searchEnd.setDate(searchEnd.getDate() + 35);
  searchEnd.setHours(23, 59, 59, 999);

  const matchesBySeriesId = {};
  calendar.getEvents(searchStart, searchEnd).forEach(function(event) {
    let recurring = false;
    try { recurring = event.isRecurringEvent(); } catch (error) { recurring = false; }
    if (!recurring) return;

    const metadata = parsePmosCalendarMetadata_(event.getDescription());
    if (String(metadata.PMOS_SERIES_KEY || '') !== String(plan.seriesKey || '')) return;

    const seriesId = readPmosCalendarEventSeriesId_(event);
    if (seriesId) matchesBySeriesId[seriesId] = true;
  });

  const seriesIds = Object.keys(matchesBySeriesId);
  if (seriesIds.length > 1) {
    throw new Error(
      'More than one recurring Calendar series has PMOS series key ' +
      plan.seriesKey + '. Resolve the duplicate before synchronization continues.'
    );
  }

  return seriesIds.length
    ? readPmosRecurringSeriesById_(calendar, seriesIds[0])
    : null;
}

function getSeriesRegistry_() {
  const sheet = ensureRecurringSeriesRegistry_();
  const values = sheet.getDataRange().getValues();
  const map = {};
  values.slice(1).forEach(function(row,index){
    if (!row[0]) return;
    map[String(row[0])] = {
      row:index + 2, seriesKey:String(row[0]), customerId:String(row[1] || ''),
      layer:String(row[2] || ''), seriesId:String(row[3] || ''),
      calendarName:String(row[4] || ''), signature:String(row[5] || ''),
      lastSync:row[6] || '', status:String(row[7] || ''), error:String(row[8] || ''),
      objectId:String(row[9] || ''), currentVersion:Number(row[10] || 1),
      lastVerified:row[11] || '', lastTransactionId:String(row[12] || '')
    };
  });
  return map;
}

/**
 * Canonical registry upsert. A matching Calendar Series ID is treated as the
 * same PMOS object even when the series key changed during approved identity
 * reconciliation, preventing duplicate active registry rows.
 */
function upsertSeriesRegistry_(plan, seriesId, calendarName, status, transactionId) {
  const sheet = ensureRecurringSeriesRegistry_();
  const registry = getSeriesRegistry_();
  const targetSeriesId = String(seriesId || '').trim();
  let existing = registry[plan.seriesKey] || null;

  if (!existing && targetSeriesId) {
    Object.keys(registry).some(function(key) {
      const candidate = registry[key];
      if (String(candidate.seriesId || '').trim() !== targetSeriesId) return false;
      existing = candidate;
      return true;
    });
  }

  const identity = resolvePmosRegistryIdentity_(existing, plan, targetSeriesId);
  plan.objectId = identity.objectId;
  plan.currentVersion = identity.currentVersion;
  const now = new Date();
  const row = [
    plan.seriesKey, plan.customerId, plan.layer, targetSeriesId, calendarName,
    plan.signature, now, status, '', identity.objectId,
    identity.currentVersion, now, String(transactionId || '')
  ];

  let targetRow = 0;
  if (existing) {
    targetRow = existing.row;
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
    targetRow = sheet.getLastRow();
  }

  if (targetSeriesId && sheet.getLastRow() > 2) {
    const refreshed = sheet.getDataRange().getValues();
    for (let index = refreshed.length - 1; index >= 1; index--) {
      const rowNumber = index + 1;
      if (rowNumber === targetRow) continue;
      const rowSeriesId = String(refreshed[index][3] || '').trim();
      if (rowSeriesId === targetSeriesId) {
        sheet.deleteRow(rowNumber);
        if (rowNumber < targetRow) targetRow--;
      }
    }
  }

  return {
    objectId: identity.objectId,
    currentVersion: identity.currentVersion,
    seriesId: targetSeriesId,
    row: targetRow
  };
}

function deleteSeriesRegistryRow_(seriesKey) {
  const sheet = ensureRecurringSeriesRegistry_();
  const registry = getSeriesRegistry_();
  if (registry[seriesKey]) sheet.deleteRow(registry[seriesKey].row);
}
