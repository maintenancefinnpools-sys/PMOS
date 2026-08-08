/**
 * PMOS legacy Job Engine compatibility and history helpers.
 *
 * Long-running Calendar execution is owned by the reviewed Calendar Sync
 * worker in 23_B. The former generic Job Engine UI/batch executor, Calendar
 * Rebuild, and Auto Continue pathways are retired. This module keeps only
 * stable public adapters, legacy-state cleanup, and shared Job History helpers.
 */

/** Older callers now open the authoritative Operations window. */
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

/**
 * Compatibility entry for older HTML clients.
 * Calendar writes never execute here.
 */
function startPmosJob(type, autoMode, openEngine) {
  const jobType = String(type || '').trim().toUpperCase();

  if (jobType === 'CALENDAR_SYNC') {
    showFreshCalendarAuditTaskWindow();
    return {
      type: jobType,
      label: 'Calendar Sync',
      status: 'REVIEW_REQUIRED',
      autoEnabled: false,
      remaining: null,
      lastSummary:
        'Legacy Calendar Sync entry was redirected to the reviewed Calendar Plan Audit.'
    };
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

function pausePmosJob() {
  removePmosJobTrigger_();
  const state = readPmosJobState_();
  if (state) {
    state.status = 'Paused';
    state.autoEnabled = false;
    state.nextRunAt = '';
    writePmosJobState_(state);
  }
  return getPmosJobStatus();
}

/**
 * Legacy generic job status. The authoritative Calendar Sync status is exposed
 * separately by getReviewedCalendarSyncJobCenterStatus().
 */
function getPmosJobStatus() {
  const state = readPmosJobState_();
  if (!state) {
    return {
      type: '',
      label: 'No active legacy job',
      status: 'Idle',
      autoEnabled: false,
      completedBatches: 0,
      processedItems: 0,
      originalTotal: 0,
      remaining: null,
      lastSummary: '',
      lastError: '',
      nextRunAt: ''
    };
  }

  return {
    type: String(state.type || ''),
    label: String(state.label || state.type || 'Legacy PMOS job'),
    status: String(state.status || 'Idle'),
    autoEnabled: false,
    completedBatches: Number(state.completedBatches || 0),
    processedItems: Number(state.processedItems || 0),
    originalTotal: Number(state.originalTotal || 0),
    remaining: state.remaining == null ? null : Number(state.remaining),
    lastSummary: String(state.lastSummary || ''),
    lastError: String(state.lastError || ''),
    nextRunAt: ''
  };
}

function newPmosJobState_(type) {
  const jobType = String(type || '').trim().toUpperCase();
  const definition = PMOS_JOB_TYPES[jobType] || {};
  return {
    id: Utilities.getUuid(),
    type: jobType,
    label: String(definition.label || jobType),
    status: 'Ready',
    autoEnabled: false,
    createdAt: new Date().toISOString(),
    lastRunAt: '',
    nextRunAt: '',
    completedBatches: 0,
    processedItems: 0,
    originalTotal: 0,
    remaining: null,
    lastSummary: '',
    lastError: ''
  };
}

function readPmosJobState_() {
  const raw = PropertiesService.getDocumentProperties().getProperty(PMOS_JOB_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function writePmosJobState_(state) {
  PropertiesService.getDocumentProperties().setProperty(
    PMOS_JOB_STATE_KEY,
    JSON.stringify(state || {})
  );
  return state;
}

function clearLegacyPmosJobState_() {
  removePmosJobTrigger_();
  PropertiesService.getDocumentProperties().deleteProperty(PMOS_JOB_STATE_KEY);
  return true;
}

/** Retired trigger handler: delete any trigger left by an older installation. */
function runPmosJobTrigger_() {
  removePmosJobTrigger_();
  return getPmosJobStatus();
}

/** Generic Auto Continue is retired and must never create another trigger. */
function ensurePmosJobTrigger_() {
  removePmosJobTrigger_();
  return false;
}

function removePmosJobTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return trigger.getHandlerFunction() === PMOS_JOB_TRIGGER_HANDLER;
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

/** Older callers retain the same public history entry. */
function showPmosJobHistory() {
  return showPmosJobHistoryWindow();
}

function formatJobHistoryDate_(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value || '');
  return Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd h:mm a');
}

/** Legacy temporary-visit browser wrappers retained for existing dialogs. */
function suggestTemporaryVisitPlacement(payload) {
  return suggestTemporaryVisitPlacement_(payload);
}

function recommendTemporaryVisitDates(payload) {
  return recommendTemporaryVisitDates_(payload);
}

function scheduleTemporaryVisits(payload) {
  return scheduleTemporaryVisits_(payload);
}
