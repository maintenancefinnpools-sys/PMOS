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

  // Identity recovery is safe only when it cannot change how many managed
  // series the customer owns. Apply this guard before every remapping pass;
  // otherwise the same-week/day fallback can consume a genuine route removal
  // before the cross-layer guard gets a chance to preserve it for review.
  const customerCountParity = buildPmosCalendarIdentityCountParity_(
    desired,
    current,
    function(record) { return effectivePmosCalendarCustomerId_(record); }
  );
  const titleCountParity = buildPmosCalendarIdentityCountParity_(
    desired,
    current,
    function(record) { return normalizePmosCalendarIdentityText_(record && record.title); }
  );
  const looseTitleCountParity = buildPmosCalendarIdentityCountParity_(
    desired,
    current,
    function(record) { return normalizePmosCalendarLooseTitle_(record && record.title); }
  );
  const customerParityDesired = unmatchedDesired.filter(function(record) {
    return customerCountParity[effectivePmosCalendarCustomerId_(record)] === true;
  });
  const customerParityCurrent = unmatchedCurrent.filter(function(record) {
    return customerCountParity[effectivePmosCalendarCustomerId_(record)] === true;
  });
  const titleParityDesired = unmatchedDesired.filter(function(record) {
    return titleCountParity[normalizePmosCalendarIdentityText_(record && record.title)] === true;
  });
  const titleParityCurrent = unmatchedCurrent.filter(function(record) {
    return titleCountParity[normalizePmosCalendarIdentityText_(record && record.title)] === true;
  });
  const looseTitleParityDesired = unmatchedDesired.filter(function(record) {
    return looseTitleCountParity[normalizePmosCalendarLooseTitle_(record && record.title)] === true;
  });
  const looseTitleParityCurrent = unmatchedCurrent.filter(function(record) {
    return looseTitleCountParity[normalizePmosCalendarLooseTitle_(record && record.title)] === true;
  });

  // Strongest recovery: same customer and same normalized layer.
  matchPmosCalendarIdentityPass_(
    customerParityDesired,
    customerParityCurrent,
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
    titleParityDesired,
    titleParityCurrent,
    remappedCurrentKeys,
    reconciliations,
    'TITLE_AND_LAYER',
    function(record) {
      const title = normalizePmosCalendarIdentityText_(record && record.title);
      const layer = effectivePmosCalendarLayer_(record);
      return title && layer ? title + '|' + layer : '';
    }
  );

  // Conservative spelling-variation fallback for legacy IDs. Removing vowels
  // allows a minor variant such as Hollinder/Hollander to resolve, but only
  // when the customer owns the same number of desired and current series and
  // exactly one record exists on the same normalized route layer.
  matchPmosCalendarIdentityPass_(
    looseTitleParityDesired,
    looseTitleParityCurrent,
    remappedCurrentKeys,
    reconciliations,
    'LOOSE_TITLE_AND_LAYER',
    function(record) {
      const title = normalizePmosCalendarLooseTitle_(record && record.title);
      const layer = effectivePmosCalendarLayer_(record);
      return title && layer ? title + '|' + layer : '';
    }
  );

  // A cross-layer pair represents a move only when the customer owns the same
  // total number of desired and current series. A lower desired count means a
  // Route Template row was removed; leave that current series unmatched so it
  // reaches explicit deletion review.
  pairPmosCalendarCustomerSeries_(
    unmatchedDesired,
    unmatchedCurrent,
    remappedCurrentKeys,
    reconciliations,
    'CUSTOMER_ID_SERIES_PAIR',
    function(record) { return effectivePmosCalendarCustomerId_(record); },
    customerCountParity
  );

  // Conservative title fallback for legacy records with no usable Customer ID.
  pairPmosCalendarCustomerSeries_(
    unmatchedDesired,
    unmatchedCurrent,
    remappedCurrentKeys,
    reconciliations,
    'TITLE_SERIES_PAIR',
    function(record) { return normalizePmosCalendarIdentityText_(record && record.title); },
    titleCountParity
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

function pairPmosCalendarCustomerSeries_(desired, current, mappings, reconciliations, method, identityBuilder, eligibleIdentities) {
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
    if (eligibleIdentities && eligibleIdentities[identity] !== true) return;
    const wanted = desiredBuckets[identity] || [];
    const existing = currentBuckets[identity] || [];
    if (!wanted.length || !existing.length) return;

    // Cross-layer recovery is unambiguous only for one desired and one
    // current series. Multi-series scoring can hide a real removal/create pair
    // even when totals happen to match, so preserve those records for explicit
    // CREATE/deletion review instead of guessing.
    if (wanted.length !== 1 || existing.length !== 1) return;

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

function buildPmosCalendarIdentityCountParity_(desired, current, identityBuilder) {
  const desiredCounts = {};
  const currentCounts = {};

  (desired || []).forEach(function(record) {
    const identity = String(identityBuilder(record) || '').trim();
    if (identity) desiredCounts[identity] = (desiredCounts[identity] || 0) + 1;
  });
  (current || []).forEach(function(record) {
    const identity = String(identityBuilder(record) || '').trim();
    if (identity) currentCounts[identity] = (currentCounts[identity] || 0) + 1;
  });

  const parity = {};
  Object.keys(desiredCounts).forEach(function(identity) {
    parity[identity] = desiredCounts[identity] === currentCounts[identity];
  });
  return parity;
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

function normalizePmosCalendarLooseTitle_(value) {
  return normalizePmosCalendarIdentityText_(value)
    .split(' ')
    .map(function(part) {
      return part.length > 2 ? part.replace(/[AEIOUY]/g, '') : part;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
