/**
 * PMOS job-operation provider framework.
 */
const PMOS_JOB_QUEUE_SHEET = 'PMOS Job Operation Queue';
const PMOS_JOB_OPERATION_MAX_ATTEMPTS = 3;
const PMOS_JOB_QUEUE_HEADERS = [
  'Job ID','Sequence','Job Type','Operation Type','Status','Payload JSON',
  'Created At','Started At','Completed At','Last Error'
];

function executeNextJobOperation_(state) {
  state = state || readPmosJobState_();
  if (!state || !state.type) throw new Error('No active PMOS job.');
  const provider = getPmosJobOperationProvider_(state.type);
  if (!provider) throw new Error('No operation provider is registered for ' + state.type + '.');
  ensurePmosJobOperationQueueSheet_();
  if (!state.operationQueueInitialized) {
    if (typeof provider.initialize === 'function') provider.initialize(state);
    state.operationQueueInitialized = true;
    state.operationQueueInitializedAt = new Date().toISOString();
    writePmosJobState_(state);
  }
  const operation = claimNextPmosJobOperation_(state.id, state.type);
  if (!operation) {
    assertNoFailedPmosJobOperations_(state.id, state.type);
    if (!state.operationProviderFinalized && typeof provider.finalize === 'function') {
      provider.finalize(state);
      state.operationProviderFinalized = true;
      writePmosJobState_(state);
    }
    return {processed:0,remaining:0,complete:true,summary:state.lastSummary || (state.label || state.type) + ' complete.'};
  }
  let result;
  try {
    result = provider.execute(state, operation) || {};
    completePmosJobOperation_(operation.rowNumber);
  } catch (error) {
    failPmosJobOperation_(operation.rowNumber, operation, error);
    throw error;
  }
  const remaining = countPendingPmosJobOperations_(state.id, state.type);
  if (remaining === 0) assertNoFailedPmosJobOperations_(state.id, state.type);
  const summary = typeof provider.summarize === 'function'
    ? provider.summarize(state, operation, result, remaining)
    : String(result.summary || operation.operationType + ' complete.');
  return {
    processed: result.processed == null ? 1 : Number(result.processed || 0),
    remaining: remaining,
    complete: remaining === 0,
    summary: summary,
    error: String(result.error || '')
  };
}

function assertNoFailedPmosJobOperations_(jobId, jobType) {
  const failed = readFailedPmosJobOperations_(jobId, jobType);
  if (!failed.length) return;
  const first = failed[0];
  throw new Error(
    failed.length + ' job operation(s) failed after ' + PMOS_JOB_OPERATION_MAX_ATTEMPTS +
    ' attempts. First failed operation: ' + String(first.operationType || 'operation') +
    ' at queue row ' + first.rowNumber + '. Review the Job Operation Queue and resolve the error before retrying.'
  );
}

function getPmosJobOperationProvider_(type) {
  const providers = {};
  if (typeof getIntegratedCalendarSyncOperationProvider_ === 'function') {
    providers.CALENDAR_SYNC = getIntegratedCalendarSyncOperationProvider_();
  } else if (typeof getCalendarSyncOperationProvider_ === 'function') {
    providers.CALENDAR_SYNC = getCalendarSyncOperationProvider_();
  }
  if (typeof getReconcileCalendarOperationProvider_ === 'function') {
    providers.RECONCILE_FUTURE = getReconcileCalendarOperationProvider_();
  }
  return providers[String(type || '')] || null;
}

function ensurePmosJobOperationQueueSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(PMOS_JOB_QUEUE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(PMOS_JOB_QUEUE_SHEET);
    sheet.getRange(1,1,1,PMOS_JOB_QUEUE_HEADERS.length).setValues([PMOS_JOB_QUEUE_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.hideSheet();
    return sheet;
  }
  const current = sheet.getRange(1,1,1,PMOS_JOB_QUEUE_HEADERS.length).getValues()[0]
    .map(function(value){return String(value || '').trim();});
  const valid = PMOS_JOB_QUEUE_HEADERS.every(function(header,index){return current[index] === header;});
  if (!valid) throw new Error(PMOS_JOB_QUEUE_SHEET + ' has an unexpected schema.');
  if (!sheet.isSheetHidden()) sheet.hideSheet();
  return sheet;
}

function replacePmosJobOperationQueue_(jobId, jobType, operations) {
  const sheet = ensurePmosJobOperationQueueSheet_();
  deletePmosJobOperationQueue_(jobId);
  const now = new Date();
  const rows = (operations || []).map(function(operation,index){
    const payload = operation.payload == null ? operation : operation.payload;
    const durablePayload = Object.assign({}, payload || {}, {__attempts:0});
    return [String(jobId || ''),index+1,String(jobType || ''),String(operation.type || operation.operationType || ''),'Pending',JSON.stringify(durablePayload),now,'','',''];
  });
  if (rows.length) sheet.getRange(sheet.getLastRow()+1,1,rows.length,PMOS_JOB_QUEUE_HEADERS.length).setValues(rows);
  return rows.length;
}

function appendPmosJobOperations_(jobId, jobType, operations) {
  const sheet = ensurePmosJobOperationQueueSheet_();
  const existing = readPmosJobQueueRows_(sheet, jobId, jobType);
  const startSequence = existing.reduce(function(maximum,row){return Math.max(maximum,Number(row.values[1] || 0));},0);
  const now = new Date();
  const rows = (operations || []).map(function(operation,index){
    const payload = operation.payload == null ? operation : operation.payload;
    const durablePayload = Object.assign({}, payload || {}, {__attempts:0});
    return [String(jobId || ''),startSequence+index+1,String(jobType || ''),String(operation.type || operation.operationType || ''),'Pending',JSON.stringify(durablePayload),now,'','',''];
  });
  if (rows.length) sheet.getRange(sheet.getLastRow()+1,1,rows.length,PMOS_JOB_QUEUE_HEADERS.length).setValues(rows);
  return rows.length;
}

function claimNextPmosJobOperation_(jobId, jobType) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) throw new Error('Another PMOS worker is claiming the next operation.');
  try {
    const sheet = ensurePmosJobOperationQueueSheet_();
    const rows = readPmosJobQueueRows_(sheet,jobId,jobType)
      .filter(function(row){return String(row.values[4] || '') === 'Pending';})
      .sort(function(a,b){return Number(a.values[1] || 0)-Number(b.values[1] || 0);});
    if (!rows.length) return null;
    const next = rows[0];
    let payload = {};
    try { payload = JSON.parse(String(next.values[5] || '{}')); }
    catch (error) { throw new Error('Invalid operation payload at queue row ' + next.rowNumber + '.'); }
    const attempts = Math.max(0,Number(payload.__attempts || 0));
    if (attempts >= PMOS_JOB_OPERATION_MAX_ATTEMPTS) {
      sheet.getRange(next.rowNumber,5).setValue('Failed');
      return null;
    }
    sheet.getRange(next.rowNumber,5,1,4).setValues([['Running',next.values[5],next.values[6],new Date()]]);
    return {rowNumber:next.rowNumber,sequence:Number(next.values[1] || 0),jobType:String(next.values[2] || ''),operationType:String(next.values[3] || ''),attempts:attempts,payload:payload};
  } finally { lock.releaseLock(); }
}

function completePmosJobOperation_(rowNumber) {
  const sheet = ensurePmosJobOperationQueueSheet_();
  sheet.getRange(Number(rowNumber),5).setValue('Complete');
  sheet.getRange(Number(rowNumber),9).setValue(new Date());
  sheet.getRange(Number(rowNumber),10).clearContent();
}

function failPmosJobOperation_(rowNumber, operation, error) {
  const sheet = ensurePmosJobOperationQueueSheet_();
  const message = String(error && error.message ? error.message : error || 'Unknown error');
  const payload = Object.assign({},operation && operation.payload || {});
  const attempts = Math.max(0,Number(operation && operation.attempts || payload.__attempts || 0))+1;
  payload.__attempts = attempts;
  sheet.getRange(Number(rowNumber),5).setValue(attempts >= PMOS_JOB_OPERATION_MAX_ATTEMPTS ? 'Failed' : 'Pending');
  sheet.getRange(Number(rowNumber),6).setValue(JSON.stringify(payload));
  sheet.getRange(Number(rowNumber),10).setValue('Attempt ' + attempts + ' of ' + PMOS_JOB_OPERATION_MAX_ATTEMPTS + ': ' + message);
}

function countPendingPmosJobOperations_(jobId, jobType) {
  const sheet = ensurePmosJobOperationQueueSheet_();
  return readPmosJobQueueRows_(sheet,jobId,jobType).filter(function(row){
    const status = String(row.values[4] || '');
    return status === 'Pending' || status === 'Running';
  }).length;
}

function readFailedPmosJobOperations_(jobId, jobType) {
  const sheet = ensurePmosJobOperationQueueSheet_();
  return readPmosJobQueueRows_(sheet,jobId,jobType)
    .filter(function(row){return String(row.values[4] || '') === 'Failed';})
    .map(function(row){return {rowNumber:row.rowNumber,sequence:Number(row.values[1] || 0),operationType:String(row.values[3] || ''),lastError:String(row.values[9] || '')};});
}

function deletePmosJobOperationQueue_(jobId) {
  const sheet = ensurePmosJobOperationQueueSheet_();
  const rows = readPmosJobQueueRows_(sheet,jobId,'');
  rows.sort(function(a,b){return b.rowNumber-a.rowNumber;}).forEach(function(row){sheet.deleteRow(row.rowNumber);});
  return rows.length;
}

function readPmosJobQueueRows_(sheet, jobId, jobType) {
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2,1,sheet.getLastRow()-1,PMOS_JOB_QUEUE_HEADERS.length).getValues();
  return values.map(function(row,index){return {rowNumber:index+2,values:row};}).filter(function(record){
    const matchesJob = String(record.values[0] || '') === String(jobId || '');
    const matchesType = !jobType || String(record.values[2] || '') === String(jobType);
    return matchesJob && matchesType;
  });
}
