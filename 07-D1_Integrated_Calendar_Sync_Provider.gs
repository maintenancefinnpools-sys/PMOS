/** Calendar Sync provider that handles recurring series and reviewed events. */
function getIntegratedCalendarSyncOperationProvider_() {
  return {
    initialize: initializeIntegratedCalendarSyncOperationQueue_,
    execute: executeIntegratedCalendarSyncOperation_,
    summarize: summarizeCalendarSyncOperation_,
    finalize: finalizeIntegratedCalendarSyncOperations_
  };
}

function initializeIntegratedCalendarSyncOperationQueue_(state) {
  const result = buildValidatedPmosCalendarSyncPlan_(
    state && state.calendarOptions ? state.calendarOptions : {}
  );
  if (!result.canExecute) {
    throw new Error(
      'Calendar Plan Audit failed with ' +
      Number(result.validation && result.validation.errorCount || 0) +
      ' blocking error(s).'
    );
  }

  const plan = result.plan;
  const auditedPlanId = String(state && state.auditedPlanId || '');
  if (!auditedPlanId) {
    throw new Error('Calendar Sync has no audited plan ID. Run Calendar Plan Audit again before starting.');
  }
  if (plan.id !== auditedPlanId) {
    throw new Error(
      'Calendar data changed after the Plan Audit. Expected plan ' + auditedPlanId +
      ', but the current plan is ' + plan.id + '. Run Calendar Plan Audit again before starting Calendar Sync.'
    );
  }

  const recurring = plan.operations.filter(isPmosExecutableOperation).map(function (operation) {
    if (
      operation.action === PMOS_OPERATION.DELETE &&
      !(operation.metadata && operation.metadata.deletionApproved === true)
    ) {
      throw new Error('Calendar plan contains an unapproved deletion: ' + operation.entityId + '.');
    }
    return {
      type: operation.action,
      payload: {
        planId: plan.id,
        sourceVersion: plan.sourceVersion || '',
        operationId: operation.id,
        action: operation.action,
        seriesKey: operation.entityId,
        deletionApproved: Boolean(operation.metadata && operation.metadata.deletionApproved === true),
        desired: serializeCanonicalCalendarSeries_(operation.payload && operation.payload.desired),
        current: cloneCalendarOperationPayload_(operation.payload && operation.payload.current)
      }
    };
  });

  const reviewed = plan.operations.filter(function (operation) {
    return Boolean(operation.metadata && operation.metadata.reviewOperation) &&
      operation.action !== PMOS_OPERATION.ERROR;
  }).map(function (operation) {
    const reviewAction = String(operation.metadata && operation.metadata.reviewAction || '');
    return {
      type: reviewAction,
      payload: {
        planId: plan.id,
        sourceVersion: plan.sourceVersion || '',
        operationId: operation.id,
        reviewAction: reviewAction,
        itemKey: operation.entityId,
        reviewSessionId: String(plan.metadata && plan.metadata.reviewSessionId || ''),
        current: cloneCalendarOperationPayload_(operation.payload && operation.payload.current),
        review: cloneCalendarOperationPayload_(operation.payload && operation.payload.review)
      }
    };
  });

  const operations = recurring.concat(reviewed);
  const total = replacePmosJobOperationQueue_(state.id, state.type, operations);
  state.planId = plan.id;
  state.planSourceVersion = plan.sourceVersion || '';
  state.planCreatedAt = plan.createdAt || '';
  state.reviewSessionId = String(plan.metadata && plan.metadata.reviewSessionId || '');
  state.originalTotal = total;
  state.remaining = total;
  state.processedItems = 0;
  state.calendarName = plan.metadata.calendarName || '';
  state.lastSummary = total
    ? 'Calendar Sync prepared ' + total + ' verified operation(s).'
    : 'Calendar is already synchronized.';
  writePmosJobState_(state);

  updateSyncStatus_(
    total ? 'Synchronization in progress' : 'Everything synchronized',
    total
      ? total + ' verified Calendar operation(s) queued from plan ' + plan.id + '.'
      : Number(plan.metadata.desiredCount || 0) + ' Calendar series are current.'
  );
}

function executeIntegratedCalendarSyncOperation_(state, operation) {
  const type = String(operation && operation.operationType || '').toUpperCase();
  if (
    type === 'LINK_CUSTOMER' ||
    type === 'REGISTER_TEMPORARY_VISIT' ||
    type === 'PRESERVE_EVENT' ||
    type === 'DELETE_APPROVED_EVENT'
  ) {
    const result = executePmosReviewedCalendarOperation_(state, operation);
    verifyPmosReviewedCalendarOperation_(operation, result);
    result.verified = true;
    return result;
  }
  return executeTransactionalCalendarSyncOperation_(state, operation);
}

function finalizeIntegratedCalendarSyncOperations_(state) {
  finalizeCalendarSyncOperations_(state);
  if (state && state.reviewSessionId) completePmosReviewSession_();
}
