/**
 * PMOS v1.9.0 — Resumable long-running job engine.
 * Move-only refactor: public names and operational behavior are preserved.
 */

function showPmosJobEngine(initialType) {
  ensurePmosJobHistorySheet_();

  const rememberedJobType = PropertiesService
    .getUserProperties()
    .getProperty('PMOS_LAST_JOB_TYPE') || '';

  const selectedJobType = PMOS_JOB_TYPES[initialType]
    ? initialType
    : (
        PMOS_JOB_TYPES[rememberedJobType]
          ? rememberedJobType
          : 'CALENDAR_SYNC'
      );

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 18px;
      font-family: Arial, sans-serif;
      color: #1f2937;
      background: #ffffff;
    }

    h2 {
      margin: 0 0 5px;
    }

    .muted {
      color: #6b7280;
      font-size: 13px;
    }

    .layout {
      display: grid;
      grid-template-columns: 250px 1fr;
      gap: 14px;
      margin-top: 15px;
    }

    .jobs {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .job {
      width: 100%;
      padding: 11px 12px;
      font: inherit;
      font-weight: 700;
      color: #1f2937;
      text-align: left;
      background: #ffffff;
      border: 2px solid #e5e7eb;
      border-radius: 9px;
      cursor: pointer;
    }

    .job:hover {
      background: #f8fafc;
    }

    .job.selected {
      color: #1d4ed8;
      background: #eff6ff;
      border-color: #2563eb;
    }

    .panel {
      display: flex;
      min-height: 475px;
      padding: 14px;
      flex-direction: column;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
    }

    .panel h3 {
      margin: 0 0 8px;
      font-size: 15px;
    }

    .purpose {
      min-height: 62px;
      color: #374151;
      line-height: 1.45;
    }

    .auto-note {
      display: none;
      margin-top: 9px;
      padding: 8px 10px;
      color: #166534;
      font-size: 12px;
      line-height: 1.4;
      background: #dcfce7;
      border-radius: 7px;
    }

    .status {
      min-height: 150px;
      margin-top: 12px;
      padding: 12px;
      background: #f3f4f6;
      border-radius: 9px;
      white-space: pre-line;
      line-height: 1.45;
      font-size: 13px;
    }

    .progress {
      height: 14px;
      margin-top: 10px;
      overflow: hidden;
      background: #e5e7eb;
      border-radius: 8px;
    }

    .bar {
      width: 0;
      height: 100%;
      background: #2563eb;
      transition: width 0.25s ease;
    }

    .error {
      display: none;
      margin-top: 10px;
      padding: 10px;
      color: #991b1b;
      background: #fee2e2;
      border-radius: 8px;
      white-space: pre-wrap;
      font-size: 13px;
    }

    .buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: auto;
      padding-top: 14px;
    }

    button.action {
      padding: 9px 12px;
      font-weight: 700;
      border: 0;
      border-radius: 8px;
      cursor: pointer;
    }

    .primary {
      color: #ffffff;
      background: #2563eb;
    }

    .secondary {
      color: #111827;
      background: #e5e7eb;
    }

    .danger {
      color: #991b1b;
      background: #fee2e2;
    }

    button:disabled {
      opacity: 0.45;
      cursor: default;
    }
  </style>
</head>

<body>
  <h2>PMOS Job Engine</h2>

  <div class="muted">
    Select an operation, review its purpose, then run it.
  </div>

  <div class="layout">
    <div class="jobs">
      <button
        type="button"
        class="job"
        data-type="CALENDAR_SYNC"
        onclick="selectJob(this)"
      >
        Calendar Sync
      </button>

      <button
        type="button"
        class="job"
        data-type="CALENDAR_REBUILD"
        onclick="selectJob(this)"
      >
        Calendar Rebuild
      </button>

      <button
        type="button"
        class="job"
        data-type="VERIFY_CALENDAR"
        onclick="selectJob(this)"
      >
        Verify Calendar
      </button>

      <button
        type="button"
        class="job"
        data-type="CALENDAR_STATUS"
        onclick="selectJob(this)"
      >
        Calendar Status
      </button>

      <button
        type="button"
        class="job"
        data-type="CUSTOMER_SYNC"
        onclick="selectJob(this)"
      >
        Customer Database Sync
      </button>

      <button
        type="button"
        class="job"
        data-type="MAP_EXPORT"
        onclick="selectJob(this)"
      >
        Export Updated Map Layers
      </button>
    </div>

    <div class="panel">
      <h3 id="selectedTitle">Purpose</h3>

      <div id="purpose" class="purpose"></div>

      <div id="autoNote" class="auto-note">
        Auto Continue runs the current batch immediately and schedules
        later batches automatically.
      </div>

      <div id="statusBox" class="status">
        Loading current status…
      </div>

      <div class="progress">
        <div id="progressBar" class="bar"></div>
      </div>

      <div id="errorBox" class="error"></div>

      <div class="buttons">
        <button
          id="runButton"
          class="action primary"
          type="button"
          onclick="runSelected(false)"
        >
          Run / Continue
        </button>

        <button
          id="autoButton"
          class="action primary"
          type="button"
          onclick="runSelected(true)"
        >
          Auto Continue
        </button>

        <button
          id="pauseButton"
          class="action danger"
          type="button"
          onclick="pauseJob()"
        >
          Pause
        </button>

        <button
          id="refreshButton"
          class="action secondary"
          type="button"
          onclick="refreshState(true)"
        >
          Refresh
        </button>

        <button
          id="historyButton"
          class="action secondary"
          type="button"
          onclick="openHistory()"
        >
          Job History
        </button>

        <button
          class="action secondary"
          type="button"
          onclick="closeEngine()"
        >
          Close
        </button>
      </div>
    </div>
  </div>

<script>
  var selectedType =
    ${JSON.stringify(selectedJobType)};

  var currentState = {};
  var busy = false;
  var polling = false;
  var pollTimer = null;

  var jobs = {
    CALENDAR_SYNC: {
      label: 'Calendar Sync',
      purpose:
        'Create, update, and remove recurring Google Calendar series ' +
        'so the Calendar matches the verified PMOS route plan.',
      supportsAuto: true,
      runLabel: 'Run One Batch'
    },

    CALENDAR_REBUILD: {
      label: 'Calendar Rebuild',
      purpose:
        'Remove PMOS-managed recurring Calendar series and rebuild the ' +
        'verified four-week route plan from the current PMOS data.',
      supportsAuto: true,
      runLabel: 'Run One Batch'
    },

    VERIFY_CALENDAR: {
      label: 'Verify Calendar',
      purpose:
        'Compare the verified PMOS route plan, Calendar Series Registry, ' +
        'and Google Calendar. This reports missing or mismatched series ' +
        'without intentionally changing the Calendar.',
      supportsAuto: false,
      runLabel: 'Run Verification'
    },

    CALENDAR_STATUS: {
      label: 'Calendar Status',
      purpose:
        'Display the current Calendar synchronization state, progress, ' +
        'pending work, and the most recent result.',
      supportsAuto: false,
      runLabel: 'Refresh Status'
    },

    CUSTOMER_SYNC: {
      label: 'Customer Database Sync',
      purpose:
        'Generate missing customer IDs and propagate current customer ' +
        'information through route sheets and PMOS records.',
      supportsAuto: false,
      runLabel: 'Run Customer Sync'
    },

    MAP_EXPORT: {
      label: 'Export Updated Map Layers',
      purpose:
        'Generate updated CSV map-layer files for route layers affected ' +
        'by pending PMOS changes and place them in a new Drive folder.',
      supportsAuto: false,
      runLabel: 'Export Map Layers'
    }
  };


  function byId(id) {
    return document.getElementById(id);
  }


  function errorMessage(error) {
    if (!error) {
      return 'Unknown error';
    }

    return error.message
      ? error.message
      : String(error);
  }


  function showError(message) {
    byId('errorBox').style.display =
      'block';

    byId('errorBox').textContent =
      message || 'Unknown error';
  }


  function clearError() {
    byId('errorBox').style.display =
      'none';

    byId('errorBox').textContent =
      '';
  }


  function fail(error) {
    busy = false;
    polling = false;

    showError(
      errorMessage(error)
    );

    updateButtons();
  }


  function selectJob(button) {
    selectedType =
      button.getAttribute('data-type');

    renderSelection();

    google.script.run
      .withFailureHandler(function () {
        // Remembering the selection is optional.
      })
      .rememberPmosJobType(selectedType);
  }


  function renderSelection() {
    var jobButtons =
      document.getElementsByClassName('job');

    for (
      var index = 0;
      index < jobButtons.length;
      index++
    ) {
      var button =
        jobButtons[index];

      var selected =
        button.getAttribute('data-type') ===
        selectedType;

      button.className =
        'job' +
        (selected ? ' selected' : '');
    }

    var job =
      jobs[selectedType];

    if (!job) {
      byId('selectedTitle').textContent =
        'Purpose';

      byId('purpose').textContent =
        'Select an operation.';

      byId('autoNote').style.display =
        'none';

      updateButtons();
      return;
    }

    byId('selectedTitle').textContent =
      job.label;

    byId('purpose').textContent =
      job.purpose;

    byId('autoNote').style.display =
      job.supportsAuto
        ? 'block'
        : 'none';

    updateButtons();
  }


  function setBusy(value) {
    busy = Boolean(value);
    updateButtons();
  }


  function hasActiveJob() {
    return Boolean(
      currentState &&
      currentState.type &&
      currentState.status !== 'Complete' &&
      currentState.status !== 'Cancelled' &&
      currentState.status !== 'Idle'
    );
  }


  function updateButtons() {
    var job =
      jobs[selectedType];

    var hasSelection =
      Boolean(job);

    var active =
      hasActiveJob();

    var runButton =
      byId('runButton');

    var autoButton =
      byId('autoButton');

    var pauseButton =
      byId('pauseButton');

    runButton.style.display =
      hasSelection
        ? 'inline-block'
        : 'none';

    runButton.disabled =
      busy ||
      !hasSelection;

    runButton.textContent =
      job
        ? job.runLabel
        : 'Run';

    autoButton.style.display =
      job && job.supportsAuto
        ? 'inline-block'
        : 'none';

    autoButton.disabled =
      busy ||
      !job ||
      !job.supportsAuto;

    pauseButton.style.display =
      active
        ? 'inline-block'
        : 'none';

    pauseButton.disabled =
      busy ||
      !active;

    byId('refreshButton').disabled =
      busy;

    byId('historyButton').disabled =
      busy;
  }


  function calculatePercent(state) {
    if (
      state &&
      state.status === 'Complete'
    ) {
      return 100;
    }

    var total =
      Number(
        state &&
        state.originalTotal
          ? state.originalTotal
          : 0
      );

    var remaining =
      state &&
      state.remaining != null
        ? Number(state.remaining)
        : null;

    if (
      total > 0 &&
      remaining != null &&
      isFinite(remaining)
    ) {
      return Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (
              total -
              remaining
            ) /
            total *
            100
          )
        )
      );
    }

    return 0;
  }


  function renderState(state) {
    currentState =
      state || {};

    var percent =
      calculatePercent(currentState);

    byId('progressBar').style.width =
      percent + '%';

    var lines = [
      'Job: ' +
        (
          currentState.label ||
          'No active job'
        ),

      'Status: ' +
        (
          currentState.status ||
          'Idle'
        ),

      'Progress: ' +
        percent +
        '%',

      'Completed batches: ' +
        Number(
          currentState.completedBatches || 0
        ),

      'Processed items: ' +
        Number(
          currentState.processedItems || 0
        ),

      'Remaining: ' +
        (
          currentState.remaining == null
            ? '—'
            : currentState.remaining
        )
    ];

    if (currentState.autoEnabled) {
      lines.push(
        'Auto Continue: Enabled'
      );
    }

    if (currentState.nextRunAt) {
      lines.push(
        'Next attempt: ' +
        currentState.nextRunAt
      );
    }

    if (currentState.lastSummary) {
      lines.push(
        'Last result: ' +
        currentState.lastSummary
      );
    }

    byId('statusBox').textContent =
      lines.join('\\n');

    if (currentState.lastError) {
      showError(
        currentState.lastError
      );
    } else {
      clearError();
    }

  }


  function renderTask(response) {
    byId('progressBar').style.width =
      '100%';

    byId('statusBox').textContent =
      response && response.summary
        ? response.summary
        : 'Task complete.';

    clearError();
    setBusy(false);
  }


    function refreshState(showBusyState) {
    if (polling) {
      return;
    }

    polling = true;

    if (showBusyState) {
      setBusy(true);
    }

    google.script.run
      .withSuccessHandler(
        function (state) {
          polling = false;
          renderState(state);

          if (showBusyState) {
            setBusy(false);
          }
        }
      )
      .withFailureHandler(
        function (error) {
          polling = false;

          if (showBusyState) {
            fail(error);
          }
        }
      )
      .getPmosJobStatus();
  }


  function runSelected(autoMode) {
    clearError();

    var job =
      jobs[selectedType];

    if (!job) {
      showError(
        'Select an operation first.'
      );

      return;
    }

    if (
      autoMode &&
      !job.supportsAuto
    ) {
      showError(
        'Auto Continue is not available for this operation.'
      );

      return;
    }

    if (
      selectedType ===
      'CALENDAR_STATUS'
    ) {
      refreshState(true);
      return;
    }

    setBusy(true);

    byId('statusBox').textContent =
      'Starting ' +
      job.label +
      '…';

    google.script.run
      .withSuccessHandler(
         function (state) {
          renderState(state);
           setBusy(false);
        }
       )
      .withFailureHandler(fail)
      .startPmosJob(
        selectedType,
        Boolean(autoMode),
        false
      );
  }

  function pauseJob() {
    setBusy(true);
    clearError();

    google.script.run
      .withSuccessHandler(
        function (state) {
          renderState(state);
          setBusy(false);
        }
      )
      .withFailureHandler(fail)
      .pausePmosJob();
  }


  function openHistory() {
    google.script.run
      .withFailureHandler(fail)
      .showPmosJobHistory();
  }


  function closeEngine() {
    if (pollTimer) {
      clearInterval(pollTimer);
    }

    google.script.host.close();
  }


  window.addEventListener(
    'beforeunload',
    function () {
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    }
  );


  renderSelection();
  refreshState(false);

  pollTimer = setInterval(
    function () {
      refreshState(false);
    },
    2000
  );
</script>
</body>
</html>`)
    .setWidth(840)
    .setHeight(680);

  SpreadsheetApp
    .getUi()
    .showModalDialog(
      html,
      'PMOS Job Engine'
    );
}

function rememberPmosJobType(type) {
  return rememberPmosJobType_(type);
}

function startPmosJob(type, autoMode, openEngine) {
  return startPmosJob_(type, autoMode, openEngine);
}

function pausePmosJob() {
  return pausePmosJob_();
}

function runPmosTask(taskType) {
  return runPmosTask_(taskType);
}

function suggestTemporaryVisitPlacement(payload) {
  return suggestTemporaryVisitPlacement_(payload);
}

function recommendTemporaryVisitDates(payload) {
  return recommendTemporaryVisitDates_(payload);
}

function scheduleTemporaryVisits(payload) {
  return scheduleTemporaryVisits_(payload);
}

function rememberPmosJobType_(type) {
  if (PMOS_JOB_TYPES[type]) {
    PropertiesService.getUserProperties().setProperty('PMOS_LAST_JOB_TYPE', type);
  }
  return type;
}

function showPmosJobEngineFor_(type) {
  if (!PMOS_JOB_TYPES[type]) {
    throw new Error(`Unknown PMOS job type: ${type}`);
  }


  if (
    type === 'CALENDAR_SYNC' ||
    type === 'CALENDAR_REBUILD'
  ) {
    const audit = runCalendarPlanAudit_();


    if (!audit.canSync) {
      showCalendarPlanAudit();
      return;
    }
  }


  showPmosJobEngine(type);
}

function startCalendarSyncJobFromMenu() {
  showPmosJobEngineFor_('CALENDAR_SYNC');
}

function startCalendarRebuildJobFromMenu() {
  showPmosJobEngineFor_('CALENDAR_REBUILD');
}

function startVerifyCalendarJobFromMenu() {
  showPmosJobEngineFor_('VERIFY_CALENDAR');
}

function startCustomerSyncJobFromMenu() {
  showPmosJobEngineFor_('CUSTOMER_SYNC');
}

function startMapExportJobFromMenu() {
  showPmosJobEngineFor_('MAP_EXPORT');
}

function startPmosJob_(type, autoMode, openEngine) {
  if (!PMOS_JOB_TYPES[type]) {
    throw new Error(`Unknown PMOS job type: ${type}`);
  }


  const existing = readPmosJobState_();


  if (
    existing &&
    existing.status !== 'Complete' &&
    existing.status !== 'Cancelled' &&
    existing.type !== type
  ) {
    throw new Error(
      `${existing.label || existing.type} is already active. Pause or complete it before starting another job.`
    );
  }


  if (
    type === 'CALENDAR_SYNC' ||
    type === 'CALENDAR_REBUILD'
  ) {
    const audit = runCalendarPlanAudit_();
    if (!audit.canSync) {
      showCalendarPlanAudit();
      return getPmosJobStatus();
    }
  }


  let state = existing && existing.type === type
    ? existing
    : newPmosJobState_(type);


  state.autoEnabled =
    Boolean(autoMode) &&
    Boolean(PMOS_JOB_TYPES[type].supportsAuto);
  state.status = 'Ready';
  state.lastError = '';


  if (type === 'CALENDAR_REBUILD' && !getCalendarRebuildState_()) {
    setCalendarRebuildState_({
      phase: 'DELETE',
      startedAt: new Date().toISOString()
    });
  }


  writePmosJobState_(state);


  if (state.autoEnabled) {
    ensurePmosJobTrigger_();
  }


  const result = runPmosJobBatch_();


  if (openEngine) {
    showPmosJobEngine();
  }


  return result;
}

function pausePmosJob_() {
  const state = readPmosJobState_();


  if (!state) return getPmosJobStatus();


  state.autoEnabled = false;
  state.status = 'Paused';
  state.nextRunAt = '';
  writePmosJobState_(state);
  removePmosJobTrigger_();


  return getPmosJobStatus();
}

function getPmosJobStatus() {
  const state = readPmosJobState_();


  if (!state) {
    return {
      type: '',
      label: 'No active job',
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
    type: state.type,
    label: state.label,
    status: state.status,
    autoEnabled: Boolean(state.autoEnabled),
    completedBatches: Number(state.completedBatches || 0),
    processedItems: Number(state.processedItems || 0),
    originalTotal: Number(state.originalTotal || 0),
    remaining: state.remaining == null ? null : Number(state.remaining),
    lastSummary: String(state.lastSummary || ''),
    lastError: String(state.lastError || ''),
    nextRunAt: formatCalendarJobDate_(state.nextRunAt)
  };
}

function runPmosJobTrigger_() {
  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(1000)) {
    return;
  }

  try {
    const state = readPmosJobState_();

    if (!state || !state.autoEnabled) {
      removePmosJobTrigger_();
      return;
    }

    // Do not run before the scheduled retry/continuation time.
    if (state.nextRunAt) {
      const nextRunTime = new Date(state.nextRunAt).getTime();

      if (
        Number.isFinite(nextRunTime) &&
        Date.now() < nextRunTime
      ) {
        return;
      }
    }

    runPmosJobBatch_();

  } finally {
    lock.releaseLock();
  }
}

function runPmosJobBatch_() {
  const state = readPmosJobState_();

  if (!state) {
    throw new Error('No active PMOS job.');
  }

  state.status = 'Running';
  state.lastError = '';
  state.lastRunAt = new Date().toISOString();

  writePmosJobState_(state);

  let batchResult = null;

  try {
    batchResult =
      executePmosJobBatch_(state.type);

  } catch (error) {
    const message = String(
      error && error.message
        ? error.message
        : error || 'Unknown error'
    );

    const retryable =
      /too many changes/i.test(message) ||
      /creating or deleting too many/i.test(message) ||
      /service invoked too many times/i.test(message) ||
      /rate limit/i.test(message) ||
      /quota exceeded/i.test(message) ||
      /user rate limit exceeded/i.test(message) ||
      /calendar usage limits exceeded/i.test(message) ||
      /resource has been exhausted/i.test(message) ||
      /try again later/i.test(message) ||
      /service unavailable/i.test(message) ||
      /internal error/i.test(message) ||
      /timed out/i.test(message) ||
      /timeout/i.test(message);

    if (
      retryable &&
      state.autoEnabled
    ) {
      const longDelay =
        /too many changes/i.test(message) ||
        /creating or deleting too many/i.test(message) ||
        /calendar usage limits exceeded/i.test(message) ||
        /quota exceeded/i.test(message) ||
        /rate limit/i.test(message) ||
        /resource has been exhausted/i.test(message);

      const retryDelay = longDelay
        ? 5 * 60 * 1000
        : 2 * 60 * 1000;

      state.status =
        'Waiting for Google';

      state.lastError =
        message;

      state.lastSummary =
        'Google temporarily limited or interrupted the Calendar operation. ' +
        'Auto Continue remains enabled and will retry automatically.';

      state.nextRunAt =
        new Date(
          Date.now() + retryDelay
        ).toISOString();

      writePmosJobState_(state);
      ensurePmosJobTrigger_();

      return getPmosJobStatus();
    }

    state.status =
      'Paused on error';

    state.autoEnabled =
      false;

    state.lastError =
      message;

    state.nextRunAt =
      '';

    try {
      writePmosJobState_(state);
      removePmosJobTrigger_();

      appendPmosJobHistory_(
        state,
        'ERROR',
        message
      );

    } catch (finalizationError) {
      throw new Error(
        'Calendar work stopped or completed, but PMOS could not save the final status. ' +
        'Original result: ' +
        message +
        '. Status-write error: ' +
        String(finalizationError)
      );
    }

    throw error;
  }

  const result =
    batchResult || {};

  state.completedBatches =
    Number(
      state.completedBatches || 0
    ) + 1;

  state.processedItems =
    Number(
      state.processedItems || 0
    ) +
    Number(
      result.processed || 0
    );

  state.remaining =
    result.remaining == null
      ? 0
      : Number(result.remaining);

  state.originalTotal =
    Math.max(
      Number(
        state.originalTotal || 0
      ),
      state.processedItems +
        state.remaining
    );

  state.lastSummary =
    String(
      result.summary || ''
    );

  state.lastError =
    String(
      result.error || ''
    );

  if (result.complete) {
    state.status =
      'Complete';

    state.autoEnabled =
      false;

    state.nextRunAt =
      '';

    removePmosJobTrigger_();

    appendPmosJobHistory_(
      state,
      'COMPLETE',
      state.lastSummary
    );

  } else if (state.lastError) {
    const message =
      state.lastError;

    const retryable =
      /too many changes/i.test(message) ||
      /creating or deleting too many/i.test(message) ||
      /service invoked too many times/i.test(message) ||
      /rate limit/i.test(message) ||
      /quota exceeded/i.test(message) ||
      /user rate limit exceeded/i.test(message) ||
      /calendar usage limits exceeded/i.test(message) ||
      /resource has been exhausted/i.test(message) ||
      /try again later/i.test(message) ||
      /service unavailable/i.test(message) ||
      /internal error/i.test(message) ||
      /timed out/i.test(message) ||
      /timeout/i.test(message);

    if (
      retryable &&
      state.autoEnabled
    ) {
      const longDelay =
        /too many changes/i.test(message) ||
        /creating or deleting too many/i.test(message) ||
        /calendar usage limits exceeded/i.test(message) ||
        /quota exceeded/i.test(message) ||
        /rate limit/i.test(message) ||
        /resource has been exhausted/i.test(message);

      const retryDelay = longDelay
        ? 5 * 60 * 1000
        : 2 * 60 * 1000;

      state.status =
        'Waiting for Google';

      state.lastSummary =
        'Google temporarily limited or interrupted the Calendar operation. ' +
        'Auto Continue remains enabled and will retry automatically.';

      state.nextRunAt =
        new Date(
          Date.now() + retryDelay
        ).toISOString();

      ensurePmosJobTrigger_();

    } else {
      state.status =
        'Paused on error';

      state.autoEnabled =
        false;

      state.nextRunAt =
        '';

      removePmosJobTrigger_();

      appendPmosJobHistory_(
        state,
        'ERROR',
        state.lastError
      );
    }

  } else if (state.autoEnabled) {
    state.status =
      'Waiting';

    state.nextRunAt =
      new Date(
        Date.now() +
        60 * 1000
      ).toISOString();

    ensurePmosJobTrigger_();

  } else {
    state.status =
      'Paused';

    state.nextRunAt =
      '';
  }

  writePmosJobState_(state);

  return getPmosJobStatus();
}


function executePmosJobBatch_(type) {
  switch (type) {
    case 'CALENDAR_SYNC':
      return executeCalendarSyncJobBatch_();


    case 'CALENDAR_REBUILD':
      return executeCalendarRebuildJobBatch_();


    case 'VERIFY_CALENDAR':
      return executeVerifyCalendarJob_();


    case 'CUSTOMER_SYNC':
      return executeCustomerSyncJob_();


    case 'MAP_EXPORT':
      return executeMapExportJob_();


    default:
      throw new Error(`Unsupported PMOS job: ${type}`);
  }
}

function executeCalendarSyncJobBatch_() {
  const result = applyCalendarChanges();


  return {
    processed:
      Number(result.created || 0) +
      Number(result.updated || 0) +
      Number(result.deleted || 0),
    remaining: Number(result.remaining || 0),
    complete:
      Number(result.remaining || 0) === 0 &&
      Number(result.errors || 0) === 0,
    summary:
      `${result.created || 0} created, ` +
      `${result.updated || 0} updated, ` +
      `${result.deleted || 0} removed`,
    error: String(result.firstError || '')
  };
}

function executeCalendarRebuildJobBatch_() {
  if (!getCalendarRebuildState_()) {
    setCalendarRebuildState_({
      phase: 'DELETE',
      startedAt: new Date().toISOString()
    });
  }


  const result = continueCalendarRebuild_();


  return {
    processed:
      Number(result.created || 0) +
      Number(result.updated || 0) +
      Number(result.deleted || 0),
    remaining: Number(result.remaining || 0),
    complete: Boolean(result.complete),
    summary:
      `${result.phase}: ` +
      `${result.deleted || 0} removed, ` +
      `${result.created || 0} created, ` +
      `${result.updated || 0} updated`,
    error: String(result.firstError || '')
  };
}

function executeVerifyCalendarJob_() {
  const audit = runCalendarPlanAudit_();
  const preview = previewCalendarChanges();
  const registry = getSeriesRegistry_();


  const discrepancies =
    Number(preview.creates || 0) +
    Number(preview.updates || 0) +
    Number(preview.deletes || 0);


  const summary = [
    `Audit errors: ${audit.errorCount}`,
    `Audit warnings: ${audit.warningCount}`,
    `Expected series: ${audit.uniqueSeriesCount}`,
    `Registered series: ${Object.keys(registry).length}`,
    `Calendar discrepancies: ${discrepancies}`
  ].join('; ');


  return {
    processed:
      audit.uniqueSeriesCount +
      Object.keys(registry).length,
    remaining: discrepancies,
    complete: true,
    summary,
    error: ''
  };
}

function executeCustomerSyncJob_() {
  const result = synchronizeCustomerDatabase_(true);


  return {
    processed:
      Number(result.idsCreated || 0) +
      Number(result.routeRowsUpdated || 0) +
      Number(result.routeRowsCreated || 0),
    remaining: 0,
    complete: true,
    summary:
      `${result.idsCreated || 0} IDs created, ` +
      `${result.routeRowsUpdated || 0} route rows updated, ` +
      `${result.routeRowsCreated || 0} route rows created`,
    error: ''
  };
}

function executeMapExportJob_() {
  const result = exportAffectedMapLayers() || {};

  const exportedLayers = Array.isArray(result.exportedLayers)
    ? result.exportedLayers
    : Array.isArray(result.layers)
      ? result.layers
      : [];

  const exportedFiles = Array.isArray(result.exportedFiles)
    ? result.exportedFiles
    : Array.isArray(result.files)
      ? result.files
      : [];

  const count = Number(
    result.count ||
    exportedFiles.length ||
    exportedLayers.length ||
    0
  );

  const folderName =
    String(result.folderName || result.exportFolderName || 'PMOS Map Exports');

  const folderUrl =
    String(result.folderUrl || result.exportFolderUrl || '');

  const layerDetails = exportedLayers.length
    ? `\nLayers:\n${exportedLayers.map(layer => `• ${layer}`).join('\n')}`
    : '';

  const folderDetails = folderUrl
    ? `\nDrive folder: ${folderName}\n${folderUrl}`
    : `\nDrive folder: ${folderName}`;

  return {
    processed: count,
    remaining: 0,
    complete: true,
    summary:
      `${count} map layer file(s) exported.` +
      layerDetails +
      folderDetails,
    error: ''
  };
}

function newPmosJobState_(type) {
  const definition = PMOS_JOB_TYPES[type];


  return {
    id: Utilities.getUuid(),
    type,
    label: definition.label,
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
  const raw = PropertiesService.getDocumentProperties()
    .getProperty(PMOS_JOB_STATE_KEY);


  if (!raw) return null;


  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function writePmosJobState_(state) {
  withSpreadsheetServiceRetry_(
    () => {
      PropertiesService.getDocumentProperties()
        .setProperty(PMOS_JOB_STATE_KEY, JSON.stringify(state));
      SpreadsheetApp.flush();
      return true;
    },
    'saving PMOS job progress'
  );
}

function ensurePmosJobTrigger_() {
  const existing = ScriptApp.getProjectTriggers()
    .filter(trigger =>
      trigger.getHandlerFunction() ===
      PMOS_JOB_TRIGGER_HANDLER
    );


  if (!existing.length) {
    ScriptApp.newTrigger(PMOS_JOB_TRIGGER_HANDLER)
      .timeBased()
      .everyMinutes(1)
      .create();
  }
}

function removePmosJobTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter(trigger =>
      trigger.getHandlerFunction() ===
      PMOS_JOB_TRIGGER_HANDLER
    )
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

function ensurePmosJobHistorySheet_() {
  const ss = SpreadsheetApp.getActive();

  const sheet = (() => {
    const existing = ss.getSheetByName(PMOS_JOB_HISTORY_SHEET);

    if (existing) {
      return existing;
    }

    const created = ss.insertSheet(PMOS_JOB_HISTORY_SHEET);

    created.appendRow([
      'Timestamp',
      'Job ID',
      'Job Type',
      'Job Name',
      'Result',
      'Batches',
      'Processed Items',
      'Summary'
    ]);

    created.hideSheet();

    return created;
  })();

  return sheet;
}
function appendPmosJobHistory_(state, result, summary) {
  withSpreadsheetServiceRetry_(
    () => {
      const sheet = ensurePmosJobHistorySheet_();
      sheet.appendRow([
        new Date(),
        state.id || '',
        state.type || '',
        state.label || '',
        result || '',
        Number(state.completedBatches || 0),
        Number(state.processedItems || 0),
        summary || ''
      ]);
      SpreadsheetApp.flush();
      return true;
    },
    'writing PMOS Job History'
  );
}

function showPmosJobHistory() {
  const sheet = ensurePmosJobHistorySheet_();
  const rows = sheet.getDataRange().getValues()
    .slice(1)
    .reverse()
    .slice(0, 50);


  const body = rows.length
    ? rows.map(row => `
      <tr>
        <td>${escapeHtml_(formatJobHistoryDate_(row[0]))}</td>
        <td>${escapeHtml_(row[3])}</td>
        <td>${escapeHtml_(row[4])}</td>
        <td>${escapeHtml_(row[5])}</td>
        <td>${escapeHtml_(row[6])}</td>
        <td>${escapeHtml_(row[7])}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="6">No completed jobs yet.</td></tr>';


  const html = HtmlService.createHtmlOutput(`
    <div style="font-family:Arial;padding:16px">
      <h2>PMOS Job History</h2>
      <table style="border-collapse:collapse;width:100%;font-size:13px">
        <thead>
          <tr>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:7px">Time</th>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:7px">Job</th>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:7px">Result</th>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:7px">Batches</th>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:7px">Items</th>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:7px">Summary</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `).setWidth(900).setHeight(560);


  SpreadsheetApp.getUi().showModalDialog(
    html,
    'PMOS Job History'
  );
}

function formatJobHistoryDate_(value) {
  const date = value instanceof Date
    ? value
    : new Date(value);


  if (!Number.isFinite(date.getTime())) return String(value || '');


  return Utilities.formatDate(
    date,
    PMOS.TIMEZONE,
    'yyyy-MM-dd h:mm a'
  );
}

function isRetryablePmosError_(error) {
  const message = String(
    error && error.message
      ? error.message
      : error || ''
  );

  return (
    /too many changes/i.test(message) ||
    /too many calendar/i.test(message) ||
    /creating or deleting too many/i.test(message) ||
    /service invoked too many times/i.test(message) ||
    /rate limit/i.test(message) ||
    /quota exceeded/i.test(message) ||
    /user rate limit exceeded/i.test(message) ||
    /calendar usage limits exceeded/i.test(message) ||
    /resource has been exhausted/i.test(message) ||
    /try again later/i.test(message) ||
    /service unavailable/i.test(message) ||
    /internal error/i.test(message) ||
    /timed out/i.test(message)
  );
}


function getPmosRetryDelayMs_(error) {
  const message = String(
    error && error.message
      ? error.message
      : error || ''
  );

  // Google Calendar change limits normally need a longer rest.
  if (
    /too many changes/i.test(message) ||
    /creating or deleting too many/i.test(message) ||
    /calendar usage limits exceeded/i.test(message) ||
    /quota exceeded/i.test(message) ||
    /rate limit/i.test(message)
  ) {
    return 5 * 60 * 1000;
  }

  // Shorter delay for temporary service or timeout errors.
  return 2 * 60 * 1000;
}

