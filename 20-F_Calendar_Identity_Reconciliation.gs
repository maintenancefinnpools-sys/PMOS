/**
 * PMOS Calendar recurring-series identity reconciliation.
 * Pure/read-only adapter used before sync planning.
 */
function reconcilePmosCalendarSeriesIdentities_(desiredSeries, verifiedState) {
  const desired = Array.isArray(desiredSeries) ? desiredSeries : [];
  const verified = verifiedState || {};
  const current = Array.isArray(verified.records) ? verified.records : [];
  const desiredKeys = {};
  const currentKeys = {};
  desired.forEach(function(record){ const key=String(record&&record.seriesKey||'').trim(); if(key) desiredKeys[key]=true; });
  current.forEach(function(record){ const key=String(record&&record.seriesKey||'').trim(); if(key) currentKeys[key]=true; });

  const unmatchedDesired = desired.filter(function(record){ const key=String(record&&record.seriesKey||'').trim(); return key && !currentKeys[key]; });
  const unmatchedCurrent = current.filter(function(record){ const key=String(record&&record.seriesKey||'').trim(); return key && !desiredKeys[key]; });
  const remappedCurrentKeys = {};
  const reconciliations = [];

  matchPmosCalendarIdentityPass_(unmatchedDesired, unmatchedCurrent, remappedCurrentKeys, reconciliations, 'CUSTOMER_ID_AND_LAYER', function(record){
    const customerId = effectivePmosCalendarCustomerId_(record);
    const layer = effectivePmosCalendarLayer_(record);
    return customerId && layer ? customerId + '|' + layer : '';
  });

  matchPmosCalendarIdentityPass_(unmatchedDesired, unmatchedCurrent, remappedCurrentKeys, reconciliations, 'TITLE_AND_LAYER', function(record){
    const title = normalizePmosCalendarIdentityText_(record && record.title);
    const layer = effectivePmosCalendarLayer_(record);
    return title && layer ? title + '|' + layer : '';
  });

  const records = current.map(function(record){
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
  (desired || []).forEach(function(record){
    const key = String(record && record.seriesKey || '').trim();
    if (!key) return;
    const identity = identityBuilder(record);
    if (!identity) return;
    if (!desiredBuckets[identity]) desiredBuckets[identity] = [];
    desiredBuckets[identity].push(record);
  });
  (current || []).forEach(function(record){
    const oldKey = String(record && record.seriesKey || '').trim();
    if (!oldKey || mappings[oldKey]) return;
    const identity = identityBuilder(record);
    if (!identity) return;
    if (!currentBuckets[identity]) currentBuckets[identity] = [];
    currentBuckets[identity].push(record);
  });

  Object.keys(desiredBuckets).sort().forEach(function(identity){
    const wanted = desiredBuckets[identity];
    const existing = currentBuckets[identity];
    if (!wanted || wanted.length !== 1 || !existing || existing.length !== 1) return;
    const desiredRecord = wanted[0];
    const currentRecord = existing[0];
    const oldKey = String(currentRecord.seriesKey || '').trim();
    const newKey = String(desiredRecord.seriesKey || '').trim();
    if (!oldKey || !newKey || oldKey === newKey || mappings[oldKey]) return;
    mappings[oldKey] = {newKey:newKey,method:method};
    reconciliations.push(Object.freeze({
      fromSeriesKey: oldKey,
      toSeriesKey: newKey,
      customerId: String(desiredRecord.customerId || currentRecord.customerId || ''),
      layer: String(desiredRecord.layer || currentRecord.layer || ''),
      seriesId: String(currentRecord.seriesId || ''),
      method: method
    }));
  });
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
