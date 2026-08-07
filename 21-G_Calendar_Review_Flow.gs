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

  // The durable audit snapshot contains the planner result from before this
  // review decision was saved. Reusing it would preserve stale warning
  // operations and a stale canExecute=false value even after every review item
  // has a final disposition. Clear only the audit snapshot; the persistent
  // Review Session and its decisions remain intact. The next audit rebuild
  // resolves those decisions into the executable Calendar plan.
  clearPmosCalendarAuditSnapshot_();

  const next = continuePmosCalendarReviewFlow();
  return {
    saved: true,
    reviewType: type,
    decisionCount: Number(saved.decisionCount || 0),
    nextStep: String(next && next.opened || ''),
    reviewComplete: Boolean(next && next.reviewComplete),
    canSync: Boolean(next && next.canSync)
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
      reviewComplete: true,
      canSync: audit.canSync === true
    };
  }

  return {
    opened: '',
    reviewComplete: false,
    canSync: false
  };
}
