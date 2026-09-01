/** Web App adapter for Calendar Repair and deterministic transaction recovery. */

function getPmosWebCalendarRepairDefaults() {
  const today = new Date();
  const plan = readRepairPlan_();
  const recoverable = readRecoverablePmosCalendarTransactions_();
  return {
    startDate: String(plan && plan.start || Utilities.formatDate(today, PMOS.TIMEZONE, 'yyyy-MM-dd')),
    endDate: String(plan && plan.end || Utilities.formatDate(today, PMOS.TIMEZONE, 'yyyy-MM-dd')),
    hasSavedPlan: Boolean(plan),
    recoverableTransactions: recoverable.map(pmosWebRecoverableTransaction_),
    repairStatus: getPmosWebCalendarRepairStatus()
  };
}

function getPmosWebCalendarRepairBoard(startValue, endValue) {
  const start = parseRepairDate_(startValue, 'Begin date');
  const end = parseRepairDate_(endValue, 'End date');
  if (end.getTime() < start.getTime()) throw new Error('End date must be on or after begin date.');

  const startText = Utilities.formatDate(start, PMOS.TIMEZONE, 'yyyy-MM-dd');
  const endText = Utilities.formatDate(end, PMOS.TIMEZONE, 'yyyy-MM-dd');
  let plan = readRepairPlan_();
  if (!plan || plan.start !== startText || plan.end !== endText) {
    previewCalendarRepairPlan(startText, endText);
    plan = readRepairPlan_();
  }
  if (!plan) throw new Error('Calendar Repair preview could not be created.');

  const lanes = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const day = Utilities.formatDate(cursor, PMOS.TIMEZONE, 'EEEE');
    if (['Monday','Tuesday','Wednesday','Thursday','Friday'].indexOf(day) >= 0) {
      lanes.push({
        date: Utilities.formatDate(cursor, PMOS.TIMEZONE, 'yyyy-MM-dd'),
        day: day
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    start: startText,
    end: endText,
    lanes: lanes,
    customers: clonePmosWebValue_(getCalendarRepairCustomerPool_()),
    existingVisits: clonePmosWebValue_(getCalendarRepairExistingVisitCards_(start, end)),
    items: clonePmosWebValue_(plan.items || []),
    summary: String(plan.summary || '')
  };
}

function savePmosWebCalendarRepairBoard(changes) {
  return saveCalendarRepairBoardPlan(changes || []);
}

function applyPmosWebCalendarRepairBoard(changes, startValue, endValue) {
  saveCalendarRepairBoardPlan(changes || []);
  return applyCalendarRepairPlan(startValue, endValue);
}

function getPmosWebCalendarRepairStatus() {
  const plan = readRepairPlan_();
  const checkpoint = readPmosRuntimeCheckpoint_(PMOS_CALENDAR_REPAIR_OPERATION);
  if (!plan) {
    return {
      status:'Idle', created:0, skipped:0, repositioned:0,
      errors:0, remaining:0,
      summary:'No Calendar Repair preview is currently active.'
    };
  }
  const dateKeys = repairCalendarPlanDateKeys_(plan);
  if (!checkpoint) {
    return {
      status:'Preview ready', created:0, skipped:0, repositioned:0,
      errors:0, remaining:dateKeys.length,
      summary:'Calendar Repair preview is ready for review before Apply Repair.'
    };
  }
  const processed = Math.min(dateKeys.length, Number(checkpoint.dateIndex || 0));
  const errors = Array.isArray(checkpoint.errors) ? checkpoint.errors : [];
  return {
    status: processed < dateKeys.length ? 'Waiting' : (errors.length ? 'Complete with errors' : 'Complete'),
    created:Number(checkpoint.created || 0),
    skipped:Number(checkpoint.skipped || 0),
    repositioned:Number(checkpoint.repositioned || 0),
    errors:errors.length,
    remaining:Math.max(0, dateKeys.length - processed),
    summary:[
      'Repair days processed: ' + processed + ' of ' + dateKeys.length,
      'Visits created: ' + Number(checkpoint.created || 0),
      'Existing PMOS/route visits repositioned: ' + Number(checkpoint.repositioned || 0),
      'Already present and skipped: ' + Number(checkpoint.skipped || 0),
      'Errors: ' + errors.length,
      errors.length ? 'First error: ' + errors[0] : ''
    ].filter(Boolean).join('\n')
  };
}

function getPmosWebRecoverableCalendarTransactions() {
  return readRecoverablePmosCalendarTransactions_().map(pmosWebRecoverableTransaction_);
}

function runPmosWebCalendarTransactionRecovery() {
  const result = recoverPmosCalendarRegistryTransactions_();
  return {
    inspected:Number(result.inspected || 0),
    finalized:Number(result.finalized || 0),
    retryRequired:Number(result.retryRequired || 0),
    manualReview:Number(result.manualReview || 0),
    issues:clonePmosWebValue_(result.issues || []),
    recoverableTransactions:getPmosWebRecoverableCalendarTransactions()
  };
}

function pmosWebRecoverableTransaction_(record) {
  const after = record.after || {};
  const before = record.before || {};
  return {
    transactionId:String(record.transactionId || ''),
    operationId:String(record.operationId || ''),
    action:String(record.action || ''),
    seriesKey:String(record.seriesKey || ''),
    status:String(record.status || ''),
    title:String(after.title || before.title || record.seriesKey || record.action || ''),
    customerId:String(after.customerId || before.customerId || ''),
    startedAt:String(record.startedAt || ''),
    lastError:String(record.lastError || '')
  };
}
