/** Advance to the next unresolved Calendar review stage. */
function continuePmosCalendarReviewFlow() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();

  if (audit.hasErrors) {
    showCalendarAuditErrorsReview();
    return {opened: 'ERRORS'};
  }
  if (audit.hasWarnings) {
    showCalendarAuditWarningsReview();
    return {opened: 'WARNINGS'};
  }
  if (audit.hasSuggestedMatches) {
    showCalendarSuggestedMatchesReview();
    return {opened: 'SUGGESTED_MATCHES'};
  }
  if (audit.hasUnclassifiedEvents) {
    if (typeof showCalendarUnclassifiedEventsReview === 'function') {
      showCalendarUnclassifiedEventsReview();
    } else {
      showCalendarUnclassifiedExceptionsReview();
    }
    return {opened: 'UNCLASSIFIED_EVENTS'};
  }
  if (Number(audit.deletionCandidateCount || 0) > 0) {
    showCalendarDeletionExceptionsReview();
    return {opened: 'SUGGESTED_DELETIONS'};
  }

  return {
    opened: '',
    reviewComplete: audit.reviewComplete === true,
    canSync: audit.canSync === true
  };
}
