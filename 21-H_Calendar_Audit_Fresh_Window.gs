/** Dedicated Calendar Plan Audit entry. */
function resetPmosCalendarReviewSessionForNewAudit_() {
  PropertiesService.getDocumentProperties().deleteProperty(PMOS_REVIEW_SESSION_PROPERTY);
  clearPmosCalendarAuditOptions_();
  clearPmosCalendarAuditSnapshot_();
  return {reset: true};
}

/** Lightweight Job Center adapter. Loading these choices never starts or resets an audit. */
function getPmosCalendarAuditJobCenterOptions() {
  return getPmosCalendarAuditLaunchOptions_();
}

/** Runs the same fresh audit lifecycle previously started by the standalone window. */
function runFreshPmosCalendarAuditFromJobCenter(options) {
  resetPmosCalendarReviewSessionForNewAudit_();
  return runFreshPmosCalendarAuditWithOptions(options || {});
}
