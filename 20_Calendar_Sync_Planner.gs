/**
 * PMOS pure Calendar synchronization planner.
 * Produces immutable operations only; performs no Google service calls.
 */

const PMOS_CALENDAR_PLANNER_VERSION = 1;
const PMOS_CALENDAR_PLANNER_NAME = 'CALENDAR_SYNC';
const PMOS_CALENDAR_SERIES_ENTITY = 'CALENDAR_SERIES';
const PMOS_CALENDAR_DESTINATION = 'CALENDAR';

/**
 * Builds an immutable plan from desired recurring series and current registry
 * records. Registry input may be an array or an object keyed by seriesKey.
 */
function buildPmosCalendarSyncPlan(desiredSeries, currentSeries, options) {
  const settings = normalizePmosCalendarPlannerOptions_(options);
  const desired = normalizePmosCalendarSeriesCollection_(desiredSeries, 'DESIRED');
  const current = normalizePmosCalendarSeriesCollection_(currentSeries, 'CURRENT');
  const desiredByKey = indexPmosCalendarSeries_(desired.records);
  const currentByKey = indexPmosCalendarSeries_(current.records);
  const operations = [];

  appendPmosCalendarDuplicateOperations_(operations, desired.duplicates, 'desired');
  appendPmosCalendarDuplicateOperations_(operations, current.duplicates, 'current');

  Object.keys(desiredByKey).sort().forEach(function (seriesKey) {
    const wanted = desiredByKey[seriesKey];
    const existing = currentByKey[seriesKey] || null;

    if (!existing) {
      operations.push(buildPmosCalendarOperationInput_(
        PMOS_OPERATION.CREATE,
        seriesKey,
        'Recurring Calendar series does not exist.',
        wanted,
        null,
        settings,
        null
      ));
      return;
    }

    const comparison = buildPmosCalendarSeriesComparison_(existing, wanted);
    const diff = diffPmosRecords(comparison.before, comparison.after, {
      ignoreMetadata: false,
      ignoreModelVersion: true,
      arrayMode: 'ORDERED'
    });

    if (diff.changed) {
      operations.push(buildPmosCalendarOperationInput_(
        PMOS_OPERATION.UPDATE,
        seriesKey,
        'Recurring Calendar series differs from the desired plan.',
        wanted,
        existing,
        settings,
        diff
      ));
    } else if (settings.includeSkips) {
      operations.push(buildPmosCalendarOperationInput_(
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

  Object.keys(currentByKey).sort().forEach(function (seriesKey) {
    if (desiredByKey[seriesKey]) return;
    const existing = currentByKey[seriesKey];
    const action = settings.allowDeletes
      ? PMOS_OPERATION.DELETE
      : PMOS_OPERATION.WARNING;
    const reason = settings.allowDeletes
      ? 'Managed recurring Calendar series is no longer present in the desired plan.'
      : 'Stale managed Calendar series was detected, but deletion is disabled.';

    operations.push(buildPmosCalendarOperationInput_(
      action,
      seriesKey,
      reason,
      null,
      existing,
      settings,
      null
    ));
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
    operations: operations,
    metadata: {
      plannerVersion: PMOS_CALENDAR_PLANNER_VERSION,
      calendarName: settings.calendarName,
      desiredCount: desired.records.length,
      currentCount: current.records.length,
      duplicateDesiredKeys: desired.duplicates,
      duplicateCurrentKeys: current.duplicates,
      blockingPlannerErrors: desired.duplicates.length + current.duplicates.length,
      allowDeletes: settings.allowDeletes,
      includeSkips: settings.includeSkips
    }
  });
}

/** Converts a desired plan or registry row into canonical Calendar-series data. */
function normalizePmosCalendarSeries(source, role) {
  const record = source || {};
  return freezePmosCalendarPlannerValue_({
    modelVersion: 1,
    type: PMOS_CALENDAR_SERIES_ENTITY,
    role: String(role || record.role || 'DESIRED').trim().toUpperCase(),
    seriesKey: normalizePmosCalendarText_(
      record.seriesKey || record['Series Key'] || record.key
    ),
    seriesId: normalizePmosCalendarText_(record.seriesId || record['Series ID']),
    customerId: normalizePmosCalendarText_(record.customerId || record['Customer ID']),
    layer: normalizePmosCalendarText_(record.layer || record.Layer),
    calendarName: normalizePmosCalendarText_(
      record.calendarName || record['Calendar Name']
    ),
    title: normalizePmosCalendarText_(record.title),
    start: normalizePmosCalendarDate_(record.start || record.startTime),
    end: normalizePmosCalendarDate_(record.end || record.endTime),
    until: normalizePmosCalendarDate_(record.until || record.untilTime),
    location: normalizePmosCalendarText_(record.location),
    description: normalizePmosCalendarMultilineText_(record.description),
    color: normalizePmosCalendarText_(record.color),
    signature: normalizePmosCalendarText_(record.signature || record.Signature),
    status: normalizePmosCalendarText_(record.status || record.Status),
    metadata: clonePmosCalendarPlannerValue_(record.metadata || {})
  });
}

function summarizePmosCalendarSyncPlan(plan) {
  const base = summarizePmosPlan(plan);
  const operations = plan && Array.isArray(plan.operations) ? plan.operations : [];
  return freezePmosCalendarPlannerValue_({
    planId: base.planId,
    total: base.total,
    executable: base.executable,
    counts: base.counts,
    blockingPlannerErrors: operations.filter(function (operation) {
      return operation.action === PMOS_OPERATION.ERROR;
    }).length,
    affectedSeries: operations.filter(isPmosExecutableOperation).map(function (operation) {
      return operation.entityId;
    })
  });
}

function buildPmosCalendarOperationInput_(action, key, reason, desired, current, settings, diff) {
  return {
    planner: PMOS_CALENDAR_PLANNER_NAME,
    action: action,
    entity: PMOS_CALENDAR_SERIES_ENTITY,
    entityId: key,
    destination: PMOS_CALENDAR_DESTINATION,
    priority: action === PMOS_OPERATION.ERROR
      ? PMOS_OPERATION_PRIORITY.CRITICAL
      : action === PMOS_OPERATION.DELETE
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
      seriesKey: key,
      blocking: action === PMOS_OPERATION.ERROR
    }
  };
}

function appendPmosCalendarDuplicateOperations_(operations, duplicates, sourceName) {
  duplicates.forEach(function (key) {
    operations.push(buildPmosCalendarOperationInput_(
      PMOS_OPERATION.ERROR,
      key,
      'Duplicate ' + sourceName + ' recurring-series key: ' + key + '.',
      null,
      null,
      { calendarName: null },
      null
    ));
  });
}

function normalizePmosCalendarSeriesCollection_(source, role) {
  const values = Array.isArray(source)
    ? source
    : source && typeof source === 'object'
      ? Object.keys(source).sort().map(function (key) {
          return Object.assign({ seriesKey: key }, source[key] || {});
        })
      : [];

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
    duplicates: Object.keys(counts).filter(function (key) {
      return counts[key] > 1;
    }).sort()
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

/** Registry signatures are authoritative when present on both records. */
function buildPmosCalendarSeriesComparison_(current, desired) {
  if (current && desired && current.signature && desired.signature) {
    return {
      before: { signature: current.signature },
      after: { signature: desired.signature }
    };
  }
  return {
    before: calendarSeriesComparableRecord_(current),
    after: calendarSeriesComparableRecord_(desired)
  };
}

function calendarSeriesComparableRecord_(record) {
  if (!record) return null;
  return {
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
  return 'CALENDAR_SYNC_PLAN_' + pmosCalendarHash_(JSON.stringify({
    sourceVersion: settings.sourceVersion,
    calendarName: settings.calendarName,
    desired: desired.map(calendarSeriesFingerprint_),
    current: current.map(calendarSeriesFingerprint_)
  }));
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
