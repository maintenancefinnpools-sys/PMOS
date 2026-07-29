/**
 * PMOS pure Calendar synchronization planner.
 *
 * Converts desired recurring-series records and current registry records into an
 * immutable PMOS plan. This module performs no Calendar, Spreadsheet, Drive,
 * PropertiesService, trigger, runtime, or executor work.
 */

const PMOS_CALENDAR_PLANNER_VERSION = 1;
const PMOS_CALENDAR_PLANNER_NAME = 'CALENDAR_SYNC';
const PMOS_CALENDAR_SERIES_ENTITY = 'CALENDAR_SERIES';
const PMOS_CALENDAR_DESTINATION = 'CALENDAR';

/**
 * Builds an immutable Calendar synchronization plan.
 *
 * desiredSeries: array from buildRecurringSeriesPlan_() or equivalent plain data
 * currentSeries: array or registry object keyed by seriesKey
 *
 * Options:
 *   id: explicit plan ID
 *   createdAt: explicit plan timestamp
 *   sourceVersion: source snapshot/version label
 *   calendarName: target Calendar name
 *   includeSkips: include unchanged series as SKIP operations (default false)
 *   allowDeletes: emit DELETE operations for stale managed series (default true)
 */
function buildPmosCalendarSyncPlan(desiredSeries, currentSeries, options) {
  const settings = normalizePmosCalendarPlannerOptions_(options);
  const desired = normalizePmosCalendarSeriesCollection_(desiredSeries, 'DESIRED');
  const current = normalizePmosCalendarSeriesCollection_(currentSeries, 'CURRENT');
  const desiredIndex = indexPmosCalendarSeries_(desired.records);
  const currentIndex = indexPmosCalendarSeries_(current.records);
  const operationInputs = [];

  appendPmosCalendarDuplicateOperations_(operationInputs, desired.duplicates, 'desired');
  appendPmosCalendarDuplicateOperations_(operationInputs, current.duplicates, 'current');

  Object.keys(desiredIndex).sort().forEach(function (seriesKey) {
    const wanted = desiredIndex[seriesKey];
    const existing = currentIndex[seriesKey] || null;

    if (!existing) {
      operationInputs.push(buildPmosCalendarOperationInput_(
        PMOS_OPERATION.CREATE,
        seriesKey,
        'Recurring Calendar series does not exist.',
        wanted,
        null,
        settings
      ));
      return;
    }

    const diff = diffPmosRecords(
      calendarSeriesComparableRecord_(existing),
      calendarSeriesComparableRecord_(wanted),
      { ignoreMetadata: false, ignoreModelVersion: true, arrayMode: 'ORDERED' }
    );

    if (diff.changed) {
      operationInputs.push(buildPmosCalendarOperationInput_(
        PMOS_OPERATION.UPDATE,
        seriesKey,
        'Recurring Calendar series differs from the desired plan.',
        wanted,
        existing,
        settings,
        diff
      ));
    } else if (settings.includeSkips) {
      operationInputs.push(buildPmosCalendarOperationInput_(
        PMOS_OPERATION.SKIP,
        seriesKey,
        'Recurring Calendar series is already synchronized.',
        wanted,
        existing,
        settings,
        diff
      ));
    }
  });

  Object.keys(currentIndex).sort().forEach(function (seriesKey) {
    if (desiredIndex[seriesKey]) return;
    const existing = currentIndex[seriesKey];

    if (settings.allowDeletes) {
      operationInputs.push(buildPmosCalendarOperationInput_(
        PMOS_OPERATION.DELETE,
        seriesKey,
        'Managed recurring Calendar series is no longer present in the desired plan.',
        null,
        existing,
        settings
      ));
    } else {
      operationInputs.push(buildPmosCalendarOperationInput_(
        PMOS_OPERATION.WARNING,
        seriesKey,
        'Stale managed Calendar series was detected, but deletion is disabled.',
        null,
        existing,
        settings
      ));
    }
  });

  const planId = settings.id || buildPmosCalendarPlanId_(
    desired.records,
    current.records,
    settings
  );

  return createPmosPlan({
    id: planId,
    type: PMOS_CALENDAR_PLANNER_NAME,
    planner: PMOS_CALENDAR_PLANNER_NAME,
    createdAt: settings.createdAt,
    sourceVersion: settings.sourceVersion,
    operations: operationInputs,
    metadata: {
      plannerVersion: PMOS_CALENDAR_PLANNER_VERSION,
      calendarName: settings.calendarName,
      desiredCount: desired.records.length,
      currentCount: current.records.length,
      duplicateDesiredKeys: desired.duplicates.slice(),
      duplicateCurrentKeys: current.duplicates.slice(),
      allowDeletes: settings.allowDeletes,
      includeSkips: settings.includeSkips
    }
  });
}

/** Normalizes one desired plan or registry record into a canonical series. */
function normalizePmosCalendarSeries(source, role) {
  const record = source || {};
  const normalizedRole = String(role || record.role || 'DESIRED').trim().toUpperCase();
  const start = normalizePmosCalendarDate_(record.start || record.startTime);
  const end = normalizePmosCalendarDate_(record.end || record.endTime);
  const until = normalizePmosCalendarDate_(record.until || record.untilTime);
  const seriesKey = normalizePmosCalendarText_(
    record.seriesKey || record['Series Key'] || record.key
  );

  const normalized = {
    modelVersion: 1,
    type: PMOS_CALENDAR_SERIES_ENTITY,
    role: normalizedRole,
    seriesKey: seriesKey,
    seriesId: normalizePmosCalendarText_(record.seriesId || record['Series ID']),
    customerId: normalizePmosCalendarText_(record.customerId || record['Customer ID']),
    layer: normalizePmosCalendarText_(record.layer || record.Layer),
    calendarName: normalizePmosCalendarText_(record.calendarName || record['Calendar Name']),
    title: normalizePmosCalendarText_(record.title),
    start: start,
    end: end,
    until: until,
    location: normalizePmosCalendarText_(record.location),
    description: normalizePmosCalendarMultilineText_(record.description),
    color: normalizePmosCalendarText_(record.color),
    signature: normalizePmosCalendarText_(record.signature || record.Signature),
    status: normalizePmosCalendarText_(record.status || record.Status),
    metadata: clonePmosCalendarPlannerValue_(record.metadata || {})
  };

  return freezePmosCalendarPlannerValue_(normalized);
}

/** Returns action counts and affected series for a Calendar plan. */
function summarizePmosCalendarSyncPlan(plan) {
  const base = summarizePmosPlan(plan);
  const operations = plan && Array.isArray(plan.operations) ? plan.operations : [];
  return freezePmosCalendarPlannerValue_({
    planId: base.planId,
    total: base.total,
    executable: base.executable,
    counts: base.counts,
    affectedSeries: operations
      .filter(function (operation) { return isPmosExecutableOperation(operation); })
      .map(function (operation) { return operation.entityId; })
  });
}

function buildPmosCalendarOperationInput_(
  action,
  seriesKey,
  reason,
  desired,
  current,
  settings,
  diff
) {
  return {
    planner: PMOS_CALENDAR_PLANNER_NAME,
    action: action,
    entity: PMOS_CALENDAR_SERIES_ENTITY,
    entityId: seriesKey,
    destination: PMOS_CALENDAR_DESTINATION,
    priority: action === PMOS_OPERATION.DELETE
      ? PMOS_OPERATION_PRIORITY.HIGH
      : PMOS_OPERATION_PRIORITY.NORMAL,
    reason: reason,
    payload: {
      calendarName: settings.calendarName,
      desired: desired,
      current: current,
      changedFields: diff ? diff.changedFields : [],
      changes: diff ? diff.changes : {}
    },
    metadata: {
      plannerVersion: PMOS_CALENDAR_PLANNER_VERSION,
      seriesKey: seriesKey
    }
  };
}

function appendPmosCalendarDuplicateOperations_(operations, duplicates, sourceName) {
  duplicates.forEach(function (seriesKey) {
    operations.push({
      planner: PMOS_CALENDAR_PLANNER_NAME,
      action: PMOS_OPERATION.ERROR,
      entity: PMOS_CALENDAR_SERIES_ENTITY,
      entityId: seriesKey,
      destination: PMOS_CALENDAR_DESTINATION,
      priority: PMOS_OPERATION_PRIORITY.CRITICAL,
      reason: 'Duplicate ' + sourceName + ' recurring-series key: ' + seriesKey + '.',
      payload: { seriesKey: seriesKey, source: sourceName },
      metadata: { blocking: true, plannerVersion: PMOS_CALENDAR_PLANNER_VERSION }
    });
  });
}

function normalizePmosCalendarSeriesCollection_(source, role) {
  let values;
  if (Array.isArray(source)) {
    values = source;
  } else if (source && typeof source === 'object') {
    values = Object.keys(source).sort().map(function (key) {
      const value = source[key] || {};
      return Object.assign({ seriesKey: key }, value);
    });
  } else {
    values = [];
  }

  const records = values.map(function (record) {
    return normalizePmosCalendarSeries(record, role);
  }).filter(function (record) {
    return Boolean(record.seriesKey);
  });

  const counts = {};
  records.forEach(function (record) {
    counts[record.seriesKey] = (counts[record.seriesKey] || 0) + 1;
  });

  return {
    records: records,
    duplicates: Object.keys(counts).filter(function (key) { return counts[key] > 1; }).sort()
  };
}

function indexPmosCalendarSeries_(records) {
  const index = {};
  records.forEach(function (record) {
    if (!Object.prototype.hasOwnProperty.call(index, record.seriesKey)) {
      index[record.seriesKey] = record;
    }
  });
  return index;
}

function calendarSeriesComparableRecord_(record) {
  if (!record) return null;

  // A stored signature is the authoritative comparison when both sides have one.
  // Otherwise compare the complete executor-relevant desired state.
  return {
    signature: record.signature || null,
    title: record.title || null,
    start: record.start || null,
    end: record.end || null,
    until: record.until || null,
    location: record.location || null,
    description: record.description || null,
    color: record.color || null,
    calendarName: record.calendarName || null
  };
}

function normalizePmosCalendarPlannerOptions_(options) {
  const source = options || {};
  return {
    id: normalizePmosCalendarToken_(source.id),
    createdAt: source.createdAt || null,
    sourceVersion: normalizePmosCalendarText_(source.sourceVersion),
    calendarName: normalizePmosCalendarText_(source.calendarName),
    includeSkips: source.includeSkips === true,
    allowDeletes: source.allowDeletes !== false
  };
}

function buildPmosCalendarPlanId_(desired, current, settings) {
  const fingerprint = JSON.stringify({
    sourceVersion: settings.sourceVersion,
    calendarName: settings.calendarName,
    desired: desired.map(calendarSeriesFingerprint_),
    current: current.map(calendarSeriesFingerprint_)
  });
  return 'CALENDAR_SYNC_PLAN_' + pmosCalendarHash_(fingerprint);
}

function calendarSeriesFingerprint_(record) {
  return {
    seriesKey: record.seriesKey,
    seriesId: record.seriesId,
    signature: record.signature,
    title: record.title,
    start: record.start,
    end: record.end,
    until: record.until,
    location: record.location,
    color: record.color
  };
}

function pmosCalendarHash_(text) {
  let hash = 2166136261;
  const value = String(text || '');
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16).toUpperCase()).slice(-8);
}

function normalizePmosCalendarDate_(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizePmosCalendarText_(value) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text || null;
}

function normalizePmosCalendarMultilineText_(value) {
  if (value == null) return null;
  const lines = String(value).replace(/\r\n?/g, '\n').split('\n')
    .map(function (line) { return line.replace(/[ \t]+/g, ' ').trim(); });
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines.length ? lines.join('\n') : null;
}

function normalizePmosCalendarToken_(value) {
  const text = normalizePmosCalendarText_(value);
  return text ? text.toUpperCase().replace(/[^A-Z0-9_-]+/g, '_') : null;
}

function clonePmosCalendarPlannerValue_(value) {
  if (value === undefined) return null;
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) return value.map(clonePmosCalendarPlannerValue_);
  const copy = {};
  Object.keys(value).sort().forEach(function (key) {
    copy[key] = clonePmosCalendarPlannerValue_(value[key]);
  });
  return copy;
}

function freezePmosCalendarPlannerValue_(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) {
    freezePmosCalendarPlannerValue_(value[key]);
  });
  return Object.freeze(value);
}
