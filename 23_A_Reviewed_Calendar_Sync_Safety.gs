/**
 * Guarded handoff from Calendar Sync Preview into the authoritative Job Center.
 * This module prepares the durable reviewed queue but does not execute it.
 */
function openSafeReviewedCalendarSyncPreview_() {
  const prepared = prepareReviewedCalendarSyncWindow_();
  openPmosJobEngine('CALENDAR_SYNC');
  return prepared;
}

/** Compatibility helper retained for callers that only need preparation totals. */
function prepareSafeReviewedCalendarSync_() {
  const state = readReviewedCalendarSyncState_();
  if (state && state.status === 'Prepared') {
    return {
      sessionId: state.sessionId,
      planId: state.planId,
      sourceVersion: state.sourceVersion,
      calendarName: state.calendarName,
      total: state.total,
      creates: Number(state.expectedCreates || 0),
      updates: Number(state.expectedUpdates || 0),
      deletes: Number(state.expectedDeletes || 0),
      preflightWarnings: Array.isArray(state.preflightWarnings)
        ? state.preflightWarnings.slice()
        : [],
      preparedAt: state.updatedAt
    };
  }
  return prepareReviewedCalendarSyncWindow_();
}
