/** Builds and persists the reviewed queue before the Sync window is displayed. */
function prepareReviewedCalendarSyncWindow_() {
  const session = requireActivePmosReviewSession_('CALENDAR');
  const result = buildValidatedPmosCalendarSyncPlan_({});
  const plan = result && result.plan;
  if (!plan || !Array.isArray(plan.operations)) {
    throw new Error('Calendar Sync could not build the reviewed operation plan.');
  }
  if (!result.canExecute) {
    throw new Error('The reviewed Calendar plan is not executable. Resolve all planner, validation, and review errors before syncing.');
  }

  const operations = plan.operations.filter(isPmosExecutableOperation);
  if (!operations.length) {
    throw new Error(
      'Calendar Sync produced zero executable operations from ' +
      Object.keys(session.decisions || {}).length +
      ' reviewed decision(s). PMOS stopped before making Calendar changes.'
    );
  }

  clearReviewedCalendarSyncQueue_();
  const writes = {};
  const counts = {creates: 0, updates: 0, deletes: 0};
  operations.forEach(function (operation, index) {
    const action = String(operation && operation.action || '').toUpperCase();
    if (action === String(PMOS_OPERATION.CREATE).toUpperCase()) counts.creates++;
    else if (action === String(PMOS_OPERATION.UPDATE).toUpperCase()) counts.updates++;
    else if (action === String(PMOS_OPERATION.DELETE).toUpperCase()) counts.deletes++;
    writes[PMOS_REVIEWED_SYNC_ITEM_PREFIX + String(index)] = JSON.stringify(operation);
  });

  const state = {
    id: Utilities.getUuid(),
    sessionId: session.id,
    planId: String(plan.id || ''),
    sourceVersion: String(plan.metadata && plan.metadata.sourceVersion || ''),
    status: 'Prepared',
    phase: 'Ready to start',
    total: operations.length,
    cursor: 0,
    processed: 0,
    remaining: operations.length,
    created: 0,
    updated: 0,
    deleted: 0,
    expectedCreates: counts.creates,
    expectedUpdates: counts.updates,
    expectedDeletes: counts.deletes,
    failed: 0,
    currentOperation: '',
    lastError: '',
    startedAt: '',
    updatedAt: new Date().toISOString(),
    completedAt: ''
  };
  writes[PMOS_REVIEWED_SYNC_STATE] = JSON.stringify(state);
  PropertiesService.getDocumentProperties().setProperties(writes, false);

  return {
    sessionId: state.sessionId,
    planId: state.planId,
    sourceVersion: state.sourceVersion,
    total: state.total,
    creates: counts.creates,
    updates: counts.updates,
    deletes: counts.deletes,
    reviewDecisionCount: Object.keys(session.decisions || {}).length,
    preparedAt: state.updatedAt
  };
}
