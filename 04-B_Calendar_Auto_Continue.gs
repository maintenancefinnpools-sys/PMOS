/**
 * PMOS v1.9.0 — Persistent and resumable Calendar synchronization.
 * Move-only refactor: public names and operational behavior are preserved.
 */

function getCalendarAutoSyncStatus() {
  const props = PropertiesService.getDocumentProperties();
  const stored = readCalendarAutoJob_();
  const preview = previewCalendarChanges();
  const remaining =
    preview.creates +
    preview.updates +
    preview.deletes;


  const state = stored || {};


  if (!remaining && state.status !== 'Running') {
    state.status = 'Complete';
    state.autoEnabled = false;
    state.remaining = 0;
    state.nextRunAt = '';
    writeCalendarAutoJob_(state);
    removeCalendarAutoTrigger_();
  } else {
    state.remaining = remaining;
    state.originalTotal = Math.max(
      Number(state.originalTotal || 0),
      remaining
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
  const remaining =
    preview.creates +
    preview.updates +
    preview.deletes;


  if (!remaining) {
    const complete = {
      status: 'Complete',
      autoEnabled: false,
      originalTotal: 0,
      remaining: 0,
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
    return complete;
  }


  const state = readCalendarAutoJob_() || {};
  state.status = 'Waiting';
  state.autoEnabled = true;
  state.originalTotal = Math.max(
    Number(state.originalTotal || 0),
    remaining
  );
  state.remaining = remaining;
  state.lastError = '';
  state.nextRunAt = new Date(
    Date.now() + 60 * 1000
  ).toISOString();


  writeCalendarAutoJob_(state);
  ensureCalendarAutoTrigger_();


  return getCalendarAutoSyncStatus();
}

function pauseCalendarAutoContinue() {
  const state = readCalendarAutoJob_() || {};
  state.status = 'Paused';
  state.autoEnabled = false;
  state.nextRunAt = '';
  writeCalendarAutoJob_(state);
  removeCalendarAutoTrigger_();
  return getCalendarAutoSyncStatus();
}

function runCalendarSyncBatchNow() {
  const state = readCalendarAutoJob_() || {};
  state.status = 'Running';
  state.lastError = '';
  writeCalendarAutoJob_(state);


  const result = applyCalendarChanges();
  const remaining = Number(result.remaining || 0);


  state.lastCreated = Number(result.created || 0);
  state.lastUpdated = Number(result.updated || 0);
  state.lastDeleted = Number(result.deleted || 0);
  state.lastErrors = Number(result.errors || 0);
  state.lastError = String(result.firstError || '');
  state.lastRunAt = new Date().toISOString();
  state.remaining = remaining;


  if (!remaining) {
    state.status = 'Complete';
    state.autoEnabled = false;
    state.nextRunAt = '';
    removeCalendarAutoTrigger_();
  } else if (result.errors) {
    state.status = 'Paused on error';
    state.autoEnabled = false;
    state.nextRunAt = '';
    removeCalendarAutoTrigger_();
  } else if (state.autoEnabled) {
    state.status = 'Waiting';
    state.nextRunAt = new Date(
      Date.now() + 60 * 1000
    ).toISOString();
  } else {
    state.status = 'Paused';
    state.nextRunAt = '';
  }


  writeCalendarAutoJob_(state);
  return result;
}

function runCalendarAutoContinueTrigger() {
  const lock = LockService.getDocumentLock();


  if (!lock.tryLock(1000)) return;


  try {
    const state = readCalendarAutoJob_();


    if (!state || !state.autoEnabled) {
      removeCalendarAutoTrigger_();
      return;
    }


    runCalendarSyncBatchNow();
  } finally {
    lock.releaseLock();
  }
}

function ensureCalendarAutoTrigger_() {
  const existing = ScriptApp.getProjectTriggers()
    .filter(trigger =>
      trigger.getHandlerFunction() ===
      PMOS_CALENDAR_AUTO_HANDLER
    );


  if (existing.length) return;


  ScriptApp.newTrigger(PMOS_CALENDAR_AUTO_HANDLER)
    .timeBased()
    .everyMinutes(1)
    .create();
}

function removeCalendarAutoTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter(trigger =>
      trigger.getHandlerFunction() ===
      PMOS_CALENDAR_AUTO_HANDLER
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


  if (!Number.isFinite(date.getTime())) {
    return '';
  }


  return Utilities.formatDate(
    date,
    PMOS.TIMEZONE,
    'yyyy-MM-dd h:mm:ss a'
  );
}

