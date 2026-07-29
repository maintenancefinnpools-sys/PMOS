/**
 * PMOS persistent and resumable Calendar synchronization.
 *
 * Calendar work is controlled by execution time, not a fixed batch size. Each
 * invocation runs until the safety deadline, saves progress, and schedules one
 * continuation when more work remains.
 */

const PMOS_CALENDAR_CONTINUATION_DELAY_MS = 2 * 1000;

function getCalendarAutoSyncStatus() {
  const stored = readCalendarAutoJob_();
  const preview = previewCalendarChanges();
  const remaining = preview.creates + preview.updates + preview.deletes;
  const state = stored || {};

  if (!remaining && state.status !== 'Running') {
    state.status = 'Complete';
    state.autoEnabled = false;
    state.remaining = 0;
    state.nextRunAt = '';
    writeCalendarAutoJob_(state);
    removeCalendarAutoTrigger_();
    clearPmosRuntimeCheckpoint_('CALENDAR_SYNC');
  } else {
    state.remaining = remaining;
    state.originalTotal = Math.max(
      Number(state.originalTotal || 0),
      Number(state.processedItems || 0) + remaining
    );
  }

  return {
    status: state.status || 'Paused',
    autoEnabled: Boolean(state.autoEnabled),
    originalTotal: Number(state.originalTotal || remaining),
    remaining,
    lastCreated: Number(state.lastCreated || 0),
    lastUpdated: Number(state.lastUpdated || 0),
    lastDeleted: Number(state.lastDeleted || 0),
    lastErrors: Number(state.lastErrors || 0),
    lastError: String(state.lastError || ''),
    lastRunAt: formatCalendarJobDate_(state.lastRunAt),
    nextRunAt: formatCalendarJobDate_(state.nextRunAt)
  };
}

function startCalendarAutoContinue() {
  const preview = previewCalendarChanges();
  const remaining = preview.creates + preview.updates + preview.deletes;

  if (!remaining) {
    const complete = {
      status: 'Complete',
      autoEnabled: false,
      originalTotal: 0,
      remaining: 0,
      processedItems: 0,
      lastCreated: 0,
      lastUpdated: 0,
      lastDeleted: 0,
      lastErrors: 0,
      lastError: '',
      lastRunAt: new Date().toISOString(),
      nextRunAt: ''
    };
    writeCalendarAutoJob_(complete);
    removeCalendarAutoTrigger_();
    clearPmosRuntimeCheckpoint_('CALENDAR_SYNC');
    return complete;
  }

  const state = readCalendarAutoJob_() || {};
  state.status = 'Running';
  state.autoEnabled = true;
  state.pauseRequested = false;
  state.operationId = state.operationId || Utilities.getUuid();
  state.originalTotal = Math.max(
    Number(state.originalTotal || 0),
    Number(state.processedItems || 0) + remaining
  );
  state.remaining = remaining;
  state.lastError = '';
  state.nextRunAt = '';
  writeCalendarAutoJob_(state);
  removeCalendarAutoTrigger_();

  runCalendarSyncBatchNow();
  return getCalendarAutoSyncStatus();
}

function pauseCalendarAutoContinue() {
  const state = readCalendarAutoJob_() || {};
  state.status = 'Paused';
  state.autoEnabled = false;
  state.pauseRequested = true;
  state.nextRunAt = '';
  writeCalendarAutoJob_(state);
  removeCalendarAutoTrigger_();
  return getCalendarAutoSyncStatus();
}

/**
 * Public compatibility entry point retained for existing menus and UI calls.
 * The name is historical; execution is deadline-based and has no item batch.
 */
function runCalendarSyncBatchNow() {
  const state = readCalendarAutoJob_() || {};
  const context = createPmosRuntimeContext_('CALENDAR_SYNC', {
    operationId: state.operationId || Utilities.getUuid()
  });
  const lock = acquirePmosRuntimeLock_(context, 5000);

  state.operationId = context.operationId;
  state.status = 'Running';
  state.pauseRequested = false;
  state.lastError = '';
  state.nextRunAt = '';
  writeCalendarAutoJob_(state);

  try {
    const result = applyCalendarChangesUntilDeadline_(context);
    const latest = readCalendarAutoJob_() || state;
    const successful =
      Number(result.created || 0) +
      Number(result.updated || 0) +
      Number(result.deleted || 0);

    latest.processedItems = Number(latest.processedItems || 0) + successful;
    latest.lastCreated = Number(result.created || 0);
    latest.lastUpdated = Number(result.updated || 0);
    latest.lastDeleted = Number(result.deleted || 0);
    latest.lastErrors = Number(result.errors || 0);
    latest.lastError = String(result.firstError || '');
    latest.lastRunAt = new Date().toISOString();
    latest.remaining = Number(result.remaining || 0);

    if (!latest.remaining) {
      latest.status = 'Complete';
      latest.autoEnabled = false;
      latest.pauseRequested = false;
      latest.nextRunAt = '';
      latest.operationId = '';
      removeCalendarAutoTrigger_();
      clearPmosRuntimeCheckpoint_('CALENDAR_SYNC');
    } else if (result.errors) {
      latest.status = 'Paused on error';
      latest.autoEnabled = false;
      latest.nextRunAt = '';
      removeCalendarAutoTrigger_();
    } else if (latest.autoEnabled) {
      latest.status = 'Waiting';
      latest.nextRunAt = new Date(
        Date.now() + PMOS_CALENDAR_CONTINUATION_DELAY_MS
      ).toISOString();
      scheduleCalendarAutoContinuation_(PMOS_CALENDAR_CONTINUATION_DELAY_MS);
    } else {
      latest.status = 'Paused';
      latest.nextRunAt = '';
      removeCalendarAutoTrigger_();
    }

    writeCalendarAutoJob_(latest);
    return result;
  } catch (error) {
    const failed = readCalendarAutoJob_() || state;
    failed.status = 'Paused on error';
    failed.autoEnabled = false;
    failed.lastError = String(error && error.message ? error.message : error);
    failed.lastRunAt = new Date().toISOString();
    failed.nextRunAt = '';
    writeCalendarAutoJob_(failed);
    removeCalendarAutoTrigger_();
    throw error;
  } finally {
    abandonPmosRuntimeOperation_(lock, context);
  }
}

function runCalendarAutoContinueTrigger() {
  const state = readCalendarAutoJob_();

  if (!state || !state.autoEnabled || state.pauseRequested) {
    removeCalendarAutoTrigger_();
    return;
  }

  runCalendarSyncBatchNow();
}

function scheduleCalendarAutoContinuation_(delayMs) {
  removeCalendarAutoTrigger_();
  ScriptApp.newTrigger(PMOS_CALENDAR_AUTO_HANDLER)
    .timeBased()
    .after(Math.max(1000, Number(delayMs || 0)))
    .create();
}

/** Compatibility alias retained for older callers. */
function ensureCalendarAutoTrigger_() {
  scheduleCalendarAutoContinuation_(PMOS_CALENDAR_CONTINUATION_DELAY_MS);
}

function removeCalendarAutoTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter(trigger =>
      trigger.getHandlerFunction() === PMOS_CALENDAR_AUTO_HANDLER
    )
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

function readCalendarAutoJob_() {
  const raw = PropertiesService.getDocumentProperties()
    .getProperty(PMOS_CALENDAR_AUTO_JOB);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function writeCalendarAutoJob_(state) {
  PropertiesService.getDocumentProperties()
    .setProperty(
      PMOS_CALENDAR_AUTO_JOB,
      JSON.stringify(state || {})
    );
}

function formatCalendarJobDate_(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

  return Utilities.formatDate(
    date,
    PMOS.TIMEZONE,
    'yyyy-MM-dd h:mm:ss a'
  );
}
