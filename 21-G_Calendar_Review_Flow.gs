/**
 * Calendar review-flow controller.
 * Individual dialogs submit their decisions here; this controller saves the
 * step and opens the next unresolved review stage in one server invocation.
 */
function saveAndAdvancePmosCalendarReview(reviewType, items, selectedIndexes) {
  const type = String(reviewType || '').trim().toUpperCase();
  let saved;

  switch (type) {
    case 'SUGGESTED_MATCH':
      saved = savePmosCalendarSuggestedMatchDecisionsForSync_(items || [], selectedIndexes || []);
      break;
    case 'UNCLASSIFIED_EVENT':
      saved = savePmosCalendarUnclassifiedDecisions(items || [], selectedIndexes || []);
      break;
    case 'DELETION_CANDIDATE':
      saved = savePmosCalendarDeletionExceptions(items || [], selectedIndexes || []);
      break;
    default:
      throw new Error('Unsupported Calendar review step: ' + type);
  }

  if (!saved || saved.saved !== true) {
    throw new Error('The Calendar review step was not saved.');
  }

  // Review progression reuses the original read-only audit snapshot. It does
  // not rebuild the planner or determine execution readiness between stages.
  const next = continuePmosCalendarReviewFlow();
  return {
    saved: true,
    reviewType: type,
    decisionCount: Number(saved.decisionCount || 0),
    nextStep: String(next && next.opened || ''),
    reviewComplete: Boolean(next && next.reviewComplete)
  };
}

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
    showCalendarUnclassifiedExceptionsReview();
    return {opened: 'UNCLASSIFIED_EVENTS'};
  }
  if (Number(audit.deletionCandidateCount || 0) > 0) {
    showCalendarDeletionExceptionsReview();
    return {opened: 'SUGGESTED_DELETIONS'};
  }

  if (audit.reviewComplete === true) {
    openReviewedCalendarSyncPreview();
    return {
      opened: 'CALENDAR_SYNC_PREVIEW',
      reviewComplete: true
    };
  }

  return {
    opened: '',
    reviewComplete: false
  };
}
