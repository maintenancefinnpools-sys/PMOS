/**
 * PMOS Calendar recurring-series identity reconciliation.
 *
 * This is a pure/read-only planning adapter. It prevents a legacy registry key
 * from being interpreted as an obsolete series when the same customer/layer is
 * still present in the desired route plan under the current key scheme.
 *
 * No Calendar, Sheet, Properties, trigger, registry, or job writes occur here.
 */
function reconcilePmosCalendarSeriesIdentities_(desiredSeries, verifiedState) {
  const desired = Array.isArray(desiredSeries) ? desiredSeries : [];
  const verified = verifiedState || {};
  const current = Array.isArray(verified.records) ? verified.records : [];

  const desiredKeys = {};
  const currentKeys = {};
  desired.forEach(function (record) {
    const key = String(record && record.seriesKey || '').trim();
    if (key) desiredKeys[key] = true;
  });
  current.forEach(function (record) {
    const key = String(record && record.seriesKey || '').trim();
    if (key) currentKeys[key] = true;
  });

  const unmatchedDesired = desired.filter(function (record) {
    const key = String(record && record.seriesKey || '').trim();
    return key && !currentKeys[key];
  });
  const unmatchedCurrent = current.filter(function (record) {
    const key = String(record && record.seriesKey || '').trim();
    return key && !desiredKeys[key];
  });

  const desiredByStableIdentity = indexUniquePmosCalendarStableIdentities_(
    unmatchedDesired,
    'desired'
  );
  const currentByStableIdentity = indexUniquePmosCalendarStableIdentities_(
    unmatchedCurrent,
    'current'
  );
  const remappedCurrentKeys = {};
  const reconciliations = [];

  Object.keys(desiredByStableIdentity.unique).sort().forEach(function (identity) {
    const wanted = desiredByStableIdentity.unique[identity];
    const existing = currentByStableIdentity.unique[identity];
    if (!wanted || !existing) return;

    const oldKey = String(existing.seriesKey || '').trim();
    const newKey = String(wanted.seriesKey || '').trim();
    if (!oldKey || !newKey || oldKey === newKey) return;

    remappedCurrentKeys[oldKey] = newKey;
    reconciliations.push(Object.freeze({
      fromSeriesKey: oldKey,
      toSeriesKey: newKey,
      customerId: String(wanted.customerId || existing.customerId || ''),
      layer: String(wanted.layer || existing.layer || ''),
      seriesId: String(existing.seriesId || ''),
      method: 'CUSTOMER_ID_AND_LAYER'
    }));
  });

  const records = current.map(function (record) {
    const oldKey = String(record && record.seriesKey || '').trim();
    const newKey = remappedCurrentKeys[oldKey];
    if (!newKey) return record;

    // Preserve the observed/registered series and its signature/seriesId. Only
    // its planner identity is translated to the desired key so the planner can
    // compare the same real series instead of manufacturing DELETE + CREATE.
    return Object.assign({}, record, {
      seriesKey: newKey,
      metadata: Object.assign({}, record.metadata || {}, {
        identityReconciled: true,
        previousSeriesKey: oldKey,
        identityReconciliationMethod: 'CUSTOMER_ID_AND_LAYER'
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
    identityReconciliationCount: reconciliations.length,
    ambiguousDesiredIdentities: Object.freeze(desiredByStableIdentity.ambiguous.slice()),
    ambiguousCurrentIdentities: Object.freeze(currentByStableIdentity.ambiguous.slice())
  });
}

/**
 * Stable identity is deliberately conservative. Customer ID + exact route
 * layer is required. We do not guess by title, address, time, or partial name:
 * ambiguous or incomplete identities remain unmatched and therefore visible to
 * the existing review/safety flow.
 */
function indexUniquePmosCalendarStableIdentities_(records, sourceName) {
  const buckets = {};
  (records || []).forEach(function (record) {
    const identity = buildPmosCalendarStableIdentity_(record);
    if (!identity) return;
    if (!buckets[identity]) buckets[identity] = [];
    buckets[identity].push(record);
  });

  const unique = {};
  const ambiguous = [];
  Object.keys(buckets).sort().forEach(function (identity) {
    if (buckets[identity].length === 1) {
      unique[identity] = buckets[identity][0];
      return;
    }
    ambiguous.push(Object.freeze({
      source: String(sourceName || ''),
      identity: identity,
      count: buckets[identity].length,
      seriesKeys: Object.freeze(buckets[identity].map(function (record) {
        return String(record.seriesKey || '');
      }).sort())
    }));
  });

  return {
    unique: unique,
    ambiguous: ambiguous
  };
}

function buildPmosCalendarStableIdentity_(record) {
  const customerId = String(record && record.customerId || '').trim();
  const layer = normalizePmosCalendarIdentityLayer_(record && record.layer);
  if (!customerId || !layer) return '';
  return customerId.toUpperCase() + '|' + layer;
}

function normalizePmosCalendarIdentityLayer_(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}
