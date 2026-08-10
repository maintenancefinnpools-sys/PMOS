/**
 * PMOS Calendar recurring-series identity reconciliation.
 * Pure/read-only adapter used before sync planning.
 *
 * Customer identity is stable. Route layer/week/day/time are scheduling
 * properties and may change without turning the same managed series into
 * DELETE + CREATE churn.
 */
function reconcilePmosCalendarSeriesIdentities_(desiredSeries, verifiedState) {
  const desired = Array.isArray(desiredSeries) ? desiredSeries : [];
  const verified = verifiedState || {};
  const current = Array.isArray(verified.records) ? verified.records : [];
  const desiredKeys = {};
  const currentKeys = {};

  desired.forEach(function(record) {
    const key = String(record && record.seriesKey || '').trim();
    if (key) desiredKeys[key] = true;
  });
  current.forEach(function(record) {
    const key = String(record && record.seriesKey || '').trim();
    if (key) currentKeys[key] = true;
  });

  const unmatchedDesired = desired.filter(function(record) {
    const key = String(record && record.seriesKey || '').trim();
    return key && !currentKeys[key];
  });
  const unmatchedCurrent = current.filter(function(record) {
    const key = String(record && record.seriesKey || '').trim();
    return key && !desiredKeys[key];
  });
  const remappedCurrentKeys = {};
  const reconciliations = [];

  // Strongest recovery: same customer and same normalized layer.
  matchPmosCalendarIdentityPass_(
    unmatchedDesired,
    unmatchedCurrent,
    remappedCurrentKeys,
    reconciliations,
    'CUSTOMER_ID_AND_LAYER',
    function(record) {
      const customerId = effectivePmosCalendarCustomerId_(record);
      const layer = effectivePmosCalendarLayer_(record);
      return customerId && layer ? customerId + '|' + layer : '';
    }
  );

  // Legacy fallback where customer IDs were not recorded reliably.
  matchPmosCalendarIdentityPass_(
    unmatchedDesired,
    unmatchedCurrent,
    remappedCurrentKeys,
    reconciliations,
    'TITLE_AND_LAYER',
    function(record) {
      const title = normalizePmosCalendarIdentityText_(record && record.title);
      const layer = effectivePmosCalendarLayer_(record);
      return title && layer ? title + '|' + layer : '';
    }
  );

  // Critical pass: pair remaining series for the same customer even when the
  // route/week/day changed. Weekly/biweekly customers can own several four-week
  // series, so pair the closest rotation slots rather than treating Customer ID
  // as a single-series key.
  pairPmosCalendarCustomerSeries_(
    unmatchedDesired,
    unmatchedCurrent,
    remappedCurrentKeys,
    reconciliations,
    'CUSTOMER_ID_SERIES_PAIR',
    function(record) { return effectivePmosCalendarCustomerId_(record); }
  );

  // Conservative title fallback for legacy records with no usable Customer ID.
  pairPmosCalendarCustomerSeries_(
    unmatchedDesired,
    unmatchedCurrent,
    remappedCurrentKeys,
    reconciliations,
    'TITLE_SERIES_PAIR',
    function(record) { return normalizePmosCalendarIdentityText_(record && record.title); }
  );

  const records = current.map(function(record) {
    const oldKey = String(record && record.seriesKey || '').trim();
    const mapping = remappedCurrentKeys[oldKey];
    if (!mapping) return record;

    return Object.assign({}, record, {
      seriesKey: mapping.newKey,
      metadata: Object.assign({}, record.metadata || {}, {
        identityReconciled: true,
        previousSeriesKey: oldKey,
        identityReconciliationMethod: mapping.method
      })
    });
  });

  return Object.freeze({
    records: records,
    missingRegistrySeries: verified.missingRegistrySeries || [],
    reviewEvents: verified.reviewEvents || [],
    temporaryVisits: verified.temporaryVisits || [],
    repairVisits: verified.repairVisits || [],
    identityReconciliations: Object.freeze(reconciliations.slice()),
    identityReconciliationCount: reconciliations.length
  });
}

function matchPmosCalendarIdentityPass_(desired, current, mappings, reconciliations, method, identityBuilder) {
  const desiredBuckets = {};
  const currentBuckets = {};
  const mappedTargets = buildPmosCalendarMappedTargetIndex_(mappings);

  (desired || []).forEach(function(record) {
    const key = String(record && record.seriesKey || '').trim();
    if (!key || mappedTargets[key]) return;
    const identity = identityBuilder(record);
    if (!identity) return;
    if (!desiredBuckets[identity]) desiredBuckets[identity] = [];
    desiredBuckets[identity].push(record);
  });

  (current || []).forEach(function(record) {
    const oldKey = String(record && record.seriesKey || '').trim();
    if (!oldKey || mappings[oldKey]) return;
    const identity = identityBuilder(record);
    if (!identity) return;
    if (!currentBuckets[identity]) currentBuckets[identity] = [];
    currentBuckets[identity].push(record);
  });

  Object.keys(desiredBuckets).sort().forEach(function(identity) {
    const wanted = desiredBuckets[identity];
    const existing = currentBuckets[identity];
    if (!wanted || wanted.length !== 1 || !existing || existing.length !== 1) return;
    recordPmosCalendarIdentityMapping_(wanted[0], existing[0], mappings, reconciliations, method);
  });
}

function pairPmosCalendarCustomerSeries_(desired, current, mappings, reconciliations, method, identityBuilder) {
  const desiredBuckets = {};
  const currentBuckets = {};
  const mappedTargets = buildPmosCalendarMappedTargetIndex_(mappings);

  (desired || []).forEach(function(record) {
    const key = String(record && record.seriesKey || '').trim();
    if (!key || mappedTargets[key]) return;
    const identity = String(identityBuilder(record) || '').trim();
    if (!identity) return;
    if (!desiredBuckets[identity]) desiredBuckets[identity] = [];
    desiredBuckets[identity].push(record);
  });

  (current || []).forEach(function(record) {
    const key = String(record && record.seriesKey || '').trim();
    if (!key || mappings[key]) return;
    const identity = String(identityBuilder(record) || '').trim();
    if (!identity) return;
    if (!currentBuckets[identity]) currentBuckets[identity] = [];
    currentBuckets[identity].push(record);
  });

  Object.keys(desiredBuckets).sort().forEach(function(identity) {
    const wanted = desiredBuckets[identity] || [];
    const existing = currentBuckets[identity] || [];
    if (!wanted.length || !existing.length) return;

    // Cross-layer pairing is safe only when both unmatched sets are balanced.
    // With unequal counts, pairing can hide a real route removal by remapping
    // the extra current series onto a different desired layer. Preserve the
    // unmatched records so the planner emits explicit CREATE/deletion review.
    if (wanted.length !== existing.length) return;

    const pairs = [];
    wanted.forEach(function(desiredRecord) {
      existing.forEach(function(currentRecord) {
        pairs.push({
          desired: desiredRecord,
          current: currentRecord,
          score: scorePmosCalendarSeriesPair_(currentRecord, desiredRecord)
        });
      });
    });

    pairs.sort(function(left, right) {
      return left.score - right.score ||
        String(left.desired.seriesKey || '').localeCompare(String(right.desired.seriesKey || '')) ||
        String(left.current.seriesKey || '').localeCompare(String(right.current.seriesKey || ''));
    });

    const usedDesired = {};
    const usedCurrent = {};
    pairs.forEach(function(pair) {
      const desiredKey = String(pair.desired.seriesKey || '').trim();
      const currentKey = String(pair.current.seriesKey || '').trim();
      if (!desiredKey || !currentKey || usedDesired[desiredKey] || usedCurrent[currentKey]) return;
      if (mappings[currentKey]) return;
      const latestTargets = buildPmosCalendarMappedTargetIndex_(mappings);
      if (latestTargets[desiredKey]) return;

      recordPmosCalendarIdentityMapping_(
        pair.desired,
        pair.current,
        mappings,
        reconciliations,
        method
      );
      usedDesired[desiredKey] = true;
      usedCurrent[currentKey] = true;
    });
  });
}

function scorePmosCalendarSeriesPair_(current, desired) {
  const currentParts = readPmosCalendarLayerParts_(current);
  const desiredParts = readPmosCalendarLayerParts_(desired);
  let score = 100;

  if (currentParts.layer && desiredParts.layer && currentParts.layer === desiredParts.layer) score -= 80;
  if (currentParts.week && desiredParts.week && currentParts.week === desiredParts.week) score -= 35;
  if (currentParts.day && desiredParts.day && currentParts.day === desiredParts.day) score -= 25;
  if (currentParts.routeDay && desiredParts.routeDay && currentParts.routeDay === desiredParts.routeDay) score -= 10;

  const currentTitle = normalizePmosCalendarIdentityText_(current && current.title);
  const desiredTitle = normalizePmosCalendarIdentityText_(desired && desired.title);
  if (currentTitle && desiredTitle && currentTitle === desiredTitle) score -= 15;

  return Math.max(0, score);
}

function readPmosCalendarLayerParts_(record) {
  let raw = String(record && record.layer || '').trim();
  if (!raw) {
    const key = String(record && record.seriesKey || '').trim();
    if (key.indexOf('|') >= 0) raw = key.substring(key.indexOf('|') + 1).trim();
  }
  if (!raw) return {layer: '', week: 0, day: '', routeDay: ''};

  try {
    const parsed = parseLayer_(raw);
    return {
      layer: effectivePmosCalendarLayer_({layer: raw}),
      week: Number(parsed.week || 0),
      day: normalizePmosCalendarIdentityText_(parsed.day),
      routeDay: normalizePmosCalendarIdentityText_(parsed.routeDay)
    };
  } catch (error) {
    return {
      layer: normalizePmosCalendarIdentityText_(raw),
      week: 0,
      day: '',
      routeDay: normalizePmosCalendarIdentityText_(raw)
    };
  }
}

function recordPmosCalendarIdentityMapping_(desiredRecord, currentRecord, mappings, reconciliations, method) {
  const oldKey = String(currentRecord && currentRecord.seriesKey || '').trim();
  const newKey = String(desiredRecord && desiredRecord.seriesKey || '').trim();
  if (!oldKey || !newKey || oldKey === newKey || mappings[oldKey]) return false;

  const mappedTargets = buildPmosCalendarMappedTargetIndex_(mappings);
  if (mappedTargets[newKey]) return false;

  mappings[oldKey] = {newKey: newKey, method: method};
  reconciliations.push(Object.freeze({
    fromSeriesKey: oldKey,
    toSeriesKey: newKey,
    customerId: String(desiredRecord.customerId || currentRecord.customerId || ''),
    layer: String(desiredRecord.layer || currentRecord.layer || ''),
    previousLayer: String(currentRecord.layer || ''),
    seriesId: String(currentRecord.seriesId || ''),
    method: method
  }));
  return true;
}

function buildPmosCalendarMappedTargetIndex_(mappings) {
  const targets = {};
  Object.keys(mappings || {}).forEach(function(oldKey) {
    const mapping = mappings[oldKey];
    const newKey = String(mapping && mapping.newKey || '').trim();
    if (newKey) targets[newKey] = true;
  });
  return targets;
}

function effectivePmosCalendarCustomerId_(record) {
  const direct = String(record && record.customerId || '').trim();
  if (direct) return direct.toUpperCase();
  const key = String(record && record.seriesKey || '').trim();
  if (!key || key.indexOf('|') < 0) return '';
  return String(key.split('|')[0] || '').trim().toUpperCase();
}

function effectivePmosCalendarLayer_(record) {
  let value = String(record && record.layer || '').trim();
  if (!value) {
    const key = String(record && record.seriesKey || '').trim();
    if (key.indexOf('|') >= 0) value = key.substring(key.indexOf('|') + 1).trim();
  }
  if (!value) return '';
  try {
    const parsed = parseLayer_(value);
    return 'W' + Number(parsed.week) + '|' + normalizePmosCalendarIdentityText_(parsed.routeDay);
  } catch (error) {
    return normalizePmosCalendarIdentityText_(value);
  }
}

function normalizePmosCalendarIdentityText_(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[\u2011\u2013\u2014-]+/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
