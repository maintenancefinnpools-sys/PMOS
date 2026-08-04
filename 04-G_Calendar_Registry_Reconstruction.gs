/**
 * Read-only reconstruction model for the active Calendar registry.
 *
 * This module does not repair or write. It describes whether each current
 * registry row can be corroborated by Google Calendar and verified transaction
 * history, and identifies Calendar-managed series that could rebuild a missing
 * active row.
 */
function readPmosVersionedCalendarRegistry_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_CALENDAR_REGISTRY_SHEET);
  if (!sheet || sheet.getLastRow() < 1) return {};
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(value){ return String(value || '').trim(); });
  const indexes = {};
  headers.forEach(function(header,index){ indexes[header] = index; });
  const required = ['Series Key','Series ID','Signature'];
  const missing = required.filter(function(header){ return indexes[header] == null; });
  if (missing.length) {
    throw new Error(
      PMOS_CALENDAR_REGISTRY_SHEET + ' is missing required column(s): ' +
      missing.join(', ') + '.'
    );
  }
  const result = {};
  values.slice(1).forEach(function(row,index){
    const key = String(row[indexes['Series Key']] || '').trim();
    if (!key) return;
    result[key] = {
      row:index + 2,
      seriesKey:key,
      customerId:readPmosRegistryCell_(row,indexes,'Customer ID'),
      layer:readPmosRegistryCell_(row,indexes,'Layer'),
      seriesId:readPmosRegistryCell_(row,indexes,'Series ID'),
      calendarName:readPmosRegistryCell_(row,indexes,'Calendar Name'),
      signature:readPmosRegistryCell_(row,indexes,'Signature'),
      status:readPmosRegistryCell_(row,indexes,'Status'),
      objectId:readPmosRegistryCell_(row,indexes,'PMOS Object ID'),
      currentVersion:Number(readPmosRegistryCell_(row,indexes,'Current Version') || 0),
      lastVerified:readPmosRegistryDateCell_(row,indexes,'Last Verified'),
      lastTransactionId:readPmosRegistryCell_(row,indexes,'Last Transaction ID')
    };
  });
  return result;
}

function buildPmosCalendarRegistryReconstructionPlan_() {
  const settings = getRecurringCalendarSettings_();
  const registry = readPmosVersionedCalendarRegistry_();
  const currentState = readPmosCalendarCurrentState_(settings,registry,{});
  const verifiedTransactions = readLatestVerifiedPmosCalendarTransactions_();
  const items = [];
  const calendarByKey = {};

  (currentState.events || []).forEach(function(event){
    const key = String(event.seriesKey || '').trim();
    if (!key || event.eventType !== 'RECURRING_ROUTE') return;
    if (!calendarByKey[key]) calendarByKey[key] = [];
    calendarByKey[key].push(event);
  });

  Object.keys(registry).sort().forEach(function(key){
    const record = registry[key];
    const calendarMatches = calendarByKey[key] || [];
    const transaction = verifiedTransactions[key] || null;
    let status = 'VERIFIED';
    let reason = 'Registry, Calendar, and available transaction history agree.';

    if (calendarMatches.length > 1) {
      status = 'AMBIGUOUS';
      reason = 'More than one Calendar series uses this PMOS series key.';
    } else if (!calendarMatches.length) {
      status = 'CALENDAR_MISSING';
      reason = 'The active registry row has no matching recurring Calendar series.';
    } else if (!record.objectId || record.currentVersion < 1) {
      status = 'IDENTITY_MIGRATION_REQUIRED';
      reason = 'The registry row predates stable object IDs or versioning.';
    } else if (transaction && record.lastTransactionId &&
      transaction.transactionId !== record.lastTransactionId) {
      status = 'HISTORY_MISMATCH';
      reason = 'The active row does not reference the latest verified transaction.';
    }

    items.push({
      seriesKey:key,
      objectId:record.objectId,
      currentVersion:record.currentVersion,
      registrySeriesId:record.seriesId,
      calendarSeriesIds:calendarMatches.map(function(item){ return item.seriesId; }),
      latestVerifiedTransactionId:transaction ? transaction.transactionId : '',
      status:status,
      reason:reason,
      proposedAction:status === 'VERIFIED' ? 'NONE' :
        status === 'IDENTITY_MIGRATION_REQUIRED' ? 'MIGRATE_IDENTITY' :
        status === 'CALENDAR_MISSING' ? 'VERIFY_OR_RECREATE' : 'MANUAL_REVIEW'
    });
  });

  Object.keys(calendarByKey).sort().forEach(function(key){
    if (registry[key]) return;
    const matches = calendarByKey[key];
    items.push({
      seriesKey:key,
      objectId:String(matches[0] && matches[0].objectId || ''),
      currentVersion:Number(matches[0] && matches[0].objectVersion || 0),
      registrySeriesId:'',
      calendarSeriesIds:matches.map(function(item){ return item.seriesId; }),
      latestVerifiedTransactionId:verifiedTransactions[key]
        ? verifiedTransactions[key].transactionId : '',
      status:matches.length === 1 ? 'REGISTRY_MISSING' : 'AMBIGUOUS',
      reason:matches.length === 1
        ? 'A PMOS-managed Calendar series exists without an active registry row.'
        : 'Multiple Calendar series could claim the missing registry row.',
      proposedAction:matches.length === 1 ? 'REBUILD_REGISTRY_ROW' : 'MANUAL_REVIEW'
    });
  });

  const counts = {};
  items.forEach(function(item){ counts[item.status] = Number(counts[item.status] || 0) + 1; });
  return Object.freeze({
    calendarName:settings.calendarName,
    inspectedRegistryRows:Object.keys(registry).length,
    inspectedCalendarSeries:Object.keys(calendarByKey).length,
    items:Object.freeze(items),
    counts:Object.freeze(counts),
    canRebuildAutomatically:items.every(function(item){
      return ['VERIFIED','REGISTRY_MISSING','IDENTITY_MIGRATION_REQUIRED'].indexOf(item.status) >= 0;
    })
  });
}

function readLatestVerifiedPmosCalendarTransactions_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_CALENDAR_TRANSACTION_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const rows = sheet.getRange(2,1,sheet.getLastRow() - 1,PMOS_CALENDAR_TRANSACTION_HEADERS.length)
    .getValues();
  const latest = {};
  rows.forEach(function(row,index){
    const record = buildPmosCalendarTransactionRecord_(row,index + 2);
    if (record.status !== 'VERIFIED' || !record.seriesKey) return;
    latest[record.seriesKey] = record;
  });
  return latest;
}

function readPmosRegistryCell_(row, indexes, header) {
  const index = indexes[header];
  return index == null ? '' : String(row[index] || '');
}

function readPmosRegistryDateCell_(row, indexes, header) {
  const index = indexes[header];
  if (index == null || !row[index]) return '';
  const value = row[index];
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : String(value);
}
