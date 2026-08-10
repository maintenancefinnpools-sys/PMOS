/**
 * Guarded handoff from Calendar Sync Preview into the reviewed, durable
 * Calendar Sync executor.
 *
 * The durable queue prepared in 23_C is authoritative. This module only reads
 * that queue for preview and status display; it does not rebuild planner state.
 */

/**
 * Read-only UI projection of the already-prepared durable queue.
 */
function getReviewedCalendarSyncPreviewRows() {
  const state = readReviewedCalendarSyncState_();
  if (!state || !state.planId || Number(state.total || 0) <= 0) return [];

  const total = Number(state.total || 0);
  const sheet = ensureReviewedCalendarSyncQueueSheet_();
  if (sheet.getLastRow() < total + 1) {
    throw new Error('Calendar Sync preview cannot load because one or more queue rows are missing.');
  }

  const values = sheet.getRange(
    2,
    1,
    total,
    PMOS_REVIEWED_SYNC_QUEUE_HEADERS.length
  ).getValues();

  return values.map(function(row, index) {
    let operation;
    try {
      operation = JSON.parse(String(row[8] || ''));
    } catch (error) {
      throw new Error('Calendar Sync preview row ' + (index + 1) + ' contains invalid operation JSON.');
    }

    const payload = operation && operation.payload || {};
    const desired = payload.desired || {};
    const current = payload.current || {};
    const action = String(operation && operation.action || row[2] || '').toUpperCase();
    const changedFields = Array.isArray(payload.changedFields)
      ? payload.changedFields.slice()
      : [];
    const currentTitle = String(current.title || current.eventTitle || '').trim();
    const plannedTitle = String(desired.title || desired.eventTitle || '').trim();
    const title = plannedTitle || currentTitle || String(operation.entityId || row[3] || '');

    return {
      index: index,
      operationId: String(operation && operation.id || row[1] || ''),
      action: action,
      entityId: String(operation && operation.entityId || row[3] || ''),
      status: String(row[4] || ''),
      title: title,
      customerId: String(desired.customerId || current.customerId || ''),
      seriesId: String(current.seriesId || current.id || payload.seriesId || ''),
      reason: String(operation && operation.reason || ''),
      changedFields: changedFields,
      current: formatReviewedCalendarPreviewRecord_(current),
      planned: formatReviewedCalendarPreviewRecord_(desired),
      identityReconciled: Boolean(current.metadata && current.metadata.identityReconciled),
      previousSeriesKey: String(current.metadata && current.metadata.previousSeriesKey || ''),
      reconciliationMethod: String(current.metadata && current.metadata.identityReconciliationMethod || '')
    };
  });
}

function formatReviewedCalendarPreviewRecord_(record) {
  const value = record || {};
  return {
    seriesKey: String(value.seriesKey || ''),
    customerId: String(value.customerId || ''),
    layer: String(value.layer || ''),
    title: String(value.title || value.eventTitle || ''),
    start: formatReviewedCalendarPreviewValue_(value.start),
    end: formatReviewedCalendarPreviewValue_(value.end),
    until: formatReviewedCalendarPreviewValue_(value.until),
    location: String(value.location || ''),
    color: String(value.color || ''),
    status: String(value.status || '')
  };
}

function formatReviewedCalendarPreviewValue_(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
