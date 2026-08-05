/**
 * Resolves approved Calendar Review Session decisions against verified Calendar
 * state and appends explicit, non-writing review operations to the Sync plan.
 *
 * Review operations remain SKIP operations until the dedicated executor is
 * connected. This prevents the recurring-series executor from interpreting a
 * reviewed one-time event as an ordinary recurring-series update or deletion.
 */
function appendResolvedPmosCalendarReviewOperations_(plan, currentState, verifiedState, decisionSet) {
  const decisions = decisionSet || readActivePmosCalendarReviewDecisions_();
  const validation = validatePmosCalendarReviewDecisionSet_(decisions);
  const intents = buildPmosCalendarReviewOperationIntents_(decisions);
  const stateIndex = buildPmosCalendarReviewStateIndex_(currentState, verifiedState);
  const reviewOperations = [];
  const resolutionErrors = validation.errors.slice();

  intents.forEach(function (intent) {
    const itemKey = String(intent.itemKey || '').trim();
    const decisionRecord = findPmosCalendarReviewDecisionRecord_(decisions, itemKey, intent.action);
    const payload = decisionRecord && decisionRecord.payload || {};
    const stateRecord = stateIndex[itemKey] || findPmosCalendarReviewStateRecordByPayload_(stateIndex, payload);

    if (!stateRecord) {
      resolutionErrors.push(
        'Reviewed Calendar item ' + itemKey + ' could not be found in the verified Calendar state.'
      );
      reviewOperations.push(buildPmosCalendarReviewPlannerError_(intent, payload,
        'The reviewed Calendar event no longer exists or its identity changed.'));
      return;
    }

    if (intent.action === 'LINK_CUSTOMER' && !String(payload.customerId || '').trim()) {
      resolutionErrors.push(
        'Reviewed Calendar match ' + itemKey + ' is missing the approved Customer ID.'
      );
      reviewOperations.push(buildPmosCalendarReviewPlannerError_(intent, payload,
        'The approved customer identity is missing. Run a fresh Calendar Plan Audit.'));
      return;
    }

    reviewOperations.push(buildResolvedPmosCalendarReviewPlanOperation_(
      intent,
      stateRecord,
      payload,
      decisions.sessionId
    ));
  });

  const existingOperations = (plan && plan.operations || []).slice();
  const metadata = Object.assign({}, plan && plan.metadata || {}, {
    reviewSessionId: String(decisions.sessionId || ''),
    reviewDecisionCounts: Object.assign({}, decisions.counts || {}),
    reviewOperationCount: reviewOperations.length,
    reviewResolutionErrorCount: resolutionErrors.length,
    reviewExecutorPending: reviewOperations.some(function (operation) {
      return Boolean(operation.metadata && operation.metadata.reviewExecutorPending);
    })
  });

  return Object.freeze(Object.assign({}, plan, {
    operations: Object.freeze(existingOperations.concat(reviewOperations)),
    metadata: Object.freeze(metadata),
    reviewResolution: Object.freeze({
      valid: resolutionErrors.length === 0,
      errorCount: resolutionErrors.length,
      errors: Object.freeze(resolutionErrors.slice()),
      operationCount: reviewOperations.length
    })
  }));
}

function buildPmosCalendarReviewStateIndex_(currentState, verifiedState) {
  const index = {};
  indexPmosCalendarReviewStateValue_(index, currentState);
  indexPmosCalendarReviewStateValue_(index, verifiedState);
  return index;
}

function indexPmosCalendarReviewStateValue_(index, value) {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach(function (item) { indexPmosCalendarReviewStateValue_(index, item); });
    return;
  }
  if (typeof value !== 'object') return;

  const keys = [
    value.eventId,
    value.seriesId,
    value.seriesKey,
    value.operationId,
    value.id
  ].map(function (key) { return String(key || '').trim(); }).filter(Boolean);

  keys.forEach(function (key) {
    if (!index[key]) index[key] = value;
  });

  Object.keys(value).forEach(function (key) {
    const child = value[key];
    if (child && typeof child === 'object') {
      indexPmosCalendarReviewStateValue_(index, child);
    }
  });
}

function findPmosCalendarReviewStateRecordByPayload_(stateIndex, payload) {
  const candidates = [payload && payload.eventId, payload && payload.seriesId]
    .map(function (key) { return String(key || '').trim(); })
    .filter(Boolean);
  for (let index = 0; index < candidates.length; index++) {
    if (stateIndex[candidates[index]]) return stateIndex[candidates[index]];
  }
  return null;
}

function findPmosCalendarReviewDecisionRecord_(decisionSet, itemKey, intentAction) {
  const decisions = decisionSet && decisionSet.records || {};
  const expectedTypes = intentAction === 'LINK_CUSTOMER'
    ? ['SUGGESTED_MATCH']
    : intentAction === 'REGISTER_TEMPORARY_VISIT'
      ? ['UNCLASSIFIED_EVENT']
      : ['DELETION_CANDIDATE'];

  const keys = Object.keys(decisions);
  for (let index = 0; index < keys.length; index++) {
    const record = decisions[keys[index]] || {};
    if (String(record.itemKey || '') !== String(itemKey || '')) continue;
    if (expectedTypes.indexOf(String(record.reviewType || '').toUpperCase()) < 0) continue;
    return record;
  }
  return null;
}

function buildResolvedPmosCalendarReviewPlanOperation_(intent, stateRecord, payload, sessionId) {
  return Object.freeze({
    id: String(intent.id || ''),
    action: PMOS_OPERATION.SKIP,
    entityType: 'CALENDAR_REVIEW_EVENT',
    entityId: String(intent.itemKey || ''),
    reason: pmosCalendarReviewIntentReason_(intent.action),
    payload: Object.freeze({
      current: stateRecord,
      review: Object.freeze(Object.assign({}, payload || {}, {
        action: intent.action,
        approvedByUser: true,
        reviewSessionId: String(sessionId || '')
      }))
    }),
    metadata: Object.freeze({
      reviewOperation: true,
      reviewAction: intent.action,
      reviewExecutorPending: intent.action !== 'PRESERVE_EVENT',
      userApproved: true,
      blocking: false
    })
  });
}

function buildPmosCalendarReviewPlannerError_(intent, payload, reason) {
  return Object.freeze({
    id: 'REVIEW_ERROR_' + pmosCalendarHash_(String(intent && intent.itemKey || '')),
    action: PMOS_OPERATION.ERROR,
    entityType: 'CALENDAR_REVIEW_EVENT',
    entityId: String(intent && intent.itemKey || ''),
    reason: String(reason || 'A reviewed Calendar decision could not be resolved.'),
    payload: Object.freeze({review: Object.freeze(Object.assign({}, payload || {}))}),
    metadata: Object.freeze({
      reviewOperation: true,
      reviewAction: String(intent && intent.action || ''),
      userApproved: true,
      blocking: true
    })
  });
}

function pmosCalendarReviewIntentReason_(action) {
  switch (String(action || '')) {
    case 'LINK_CUSTOMER': return 'Link reviewed Calendar event to the approved customer.';
    case 'REGISTER_TEMPORARY_VISIT': return 'Register reviewed Calendar event as a Temporary Visit.';
    case 'PRESERVE_EVENT': return 'Preserve reviewed Calendar event unchanged.';
    case 'DELETE_APPROVED_EVENT': return 'Delete Calendar event approved for deletion.';
    default: return 'Apply approved Calendar review decision.';
  }
}
