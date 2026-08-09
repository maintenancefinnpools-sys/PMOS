/**
 * PMOS legacy Job Engine compatibility and shared history helpers.
 *
 * The former generic runtime/state machine is retired. Long-running Calendar
 * execution belongs exclusively to the reviewed Calendar Sync worker in 23_B.
 * Public legacy names below either redirect to current UI/task ownership or
 * clean up obsolete triggers/state without performing Calendar mutation.
 */

function showPmosJobEngine(initialType) {
  return openPmosJobEngine(initialType);
}

function rememberPmosJobType(type) {
  return rememberPmosJobType_(type);
}

function rememberPmosJobType_(type) {
  const value = String(type || '').trim();
  if (value) {
    PropertiesService.getUserProperties().setProperty('PMOS_LAST_JOB_TYPE', value);
  }
  return value;
}

function startPmosJob(type, autoMode, openEngine) {
  const jobType = String(type || '').trim().toUpperCase();

  if (jobType === 'CALENDAR_SYNC') {
    showFreshCalendarAuditTaskWindow();
    return legacyPmosJobStatus_(
      jobType,
      'Calendar Sync',
      'REVIEW_REQUIRED',
      'Legacy Calendar Sync entry was redirected to the reviewed Calendar Plan Audit.'
    );
  }

  if (jobType === 'CALENDAR_REBUILD') {
    throw new Error(
      'Calendar Rebuild has been retired. Run Calendar Plan Audit and reviewed Calendar Sync instead.'
    );
  }

  if (
    jobType === 'VERIFY_CALENDAR' ||
    jobType === 'CUSTOMER_SYNC' ||
    jobType === 'MAP_EXPORT' ||
    jobType === 'CALENDAR_STATUS'
  ) {
    return runPmosTask_(jobType);
  }

  throw new Error('Unsupported legacy PMOS job type: ' + (jobType || '(blank)') + '.');
}

/**
 * Retired generic pause entry. There is no generic runtime left to pause.
 * Clear any state/trigger from older installations and return a stable status.
 */
function pausePmosJob() {
  clearLegacyPmosJobState_();
  return getPmosJobStatus();
}

function getPmosJobStatus() {
  return legacyPmosJobStatus_(
    '',
    'No active legacy job',
    'Idle',
    'Generic PMOS job execution is retired. Current operations run through PMOS Operations.'
  );
}

function legacyPmosJobStatus_(type, label, status, summary) {
  return {
    type: String(type || ''),
    label: String(label || 'No active legacy job'),
    status: String(status || 'Idle'),
    autoEnabled: false,
    completedBatches: 0,
    processedItems: 0,
    originalTotal: 0,
    remaining: null,
    lastSummary: String(summary || ''),
    lastError: '',
    nextRunAt: ''
  };
}

function clearLegacyPmosJobState_() {
  removePmosJobTrigger_();
  PropertiesService.getDocumentProperties().deleteProperty('PMOS_ACTIVE_JOB_V1');
  return true;
}

/** Old installable-trigger entry: cleanup only, never Calendar mutation. */
function runPmosJobTrigger_() {
  clearLegacyPmosJobState_();
  return getPmosJobStatus();
}

function ensurePmosJobTrigger_() {
  removePmosJobTrigger_();
  return false;
}

function removePmosJobTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return trigger.getHandlerFunction() === 'runPmosJobTrigger_';
    })
    .forEach(function(trigger) {
      ScriptApp.deleteTrigger(trigger);
    });
}

function ensurePmosJobHistorySheet_() {
  const spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getSheetByName(PMOS_JOB_HISTORY_SHEET);
  if (sheet) return sheet;

  sheet = spreadsheet.insertSheet(PMOS_JOB_HISTORY_SHEET);
  sheet.appendRow([
    'Timestamp',
    'Job ID',
    'Job Type',
    'Job Name',
    'Result',
    'Batches',
    'Processed Items',
    'Summary'
  ]);
  sheet.hideSheet();
  return sheet;
}

function appendPmosJobHistory_(state, result, summary) {
  const sheet = ensurePmosJobHistorySheet_();
  sheet.appendRow([
    new Date(),
    state && state.id || '',
    state && state.type || '',
    state && state.label || '',
    result || '',
    Number(state && state.completedBatches || 0),
    Number(state && state.processedItems || state && state.processed || 0),
    summary || ''
  ]);
}

function showPmosJobHistory() {
  return showPmosJobHistoryWindow();
}

function formatJobHistoryDate_(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value || '');
  return Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd h:mm a');
}

/** Public wrappers used by existing Temporary Visit dialogs. */
function suggestTemporaryVisitPlacement(payload) {
  return suggestTemporaryVisitPlacement_(payload);
}

function recommendTemporaryVisitDates(payload) {
  return recommendTemporaryVisitDates_(payload);
}

function scheduleTemporaryVisits(payload) {
  return scheduleTemporaryVisits_(payload);
}
