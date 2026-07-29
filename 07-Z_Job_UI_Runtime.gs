/**
 * PMOS runtime Job UI.
 *
 * Transitional override for the legacy Job Engine UI. This module exposes only
 * runtime-backed operations and removes rebuild and batch terminology.
 */

function showPmosJobEngine(initialType) {
  ensurePmosJobHistorySheet_();

  const rememberedType = PropertiesService
    .getUserProperties()
    .getProperty('PMOS_LAST_JOB_TYPE') || '';

  const allowedTypes = {
    CALENDAR_SYNC: true,
    RECONCILE_FUTURE: true
  };

  const selectedType = allowedTypes[initialType]
    ? initialType
    : (allowedTypes[rememberedType] ? rememberedType : 'CALENDAR_SYNC');

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 18px;
      font-family: Arial, sans-serif;
      color: #1f2937;
      background: #fff;
    }
    h2 { margin: 0 0 5px; }
    .muted { color: #6b7280; font-size: 13px; }
    .layout {
      display: grid;
      grid-template-columns: 245px 1fr;
      gap: 14px;
      margin-top: 15px;
    }
    .operations { display: flex; flex-direction: column; gap: 7px; }
    .operation {
      width: 100%;
      padding: 11px 12px;
      font: inherit;
      font-weight: 700;
      color: #1f2937;
      text-align: left;
      background: #fff;
      border: 2px solid #e5e7eb;
      border-radius: 9px;
      cursor: pointer;
    }
    .operation:hover { background: #f8fafc; }
    .operation.selected {
      color: #1d4ed8;
      background: #eff6ff;
      border-color: #2563eb;
    }
    .panel {
      display: flex;
      min-height: 410px;
      padding: 14px;
      flex-direction: column;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
    }
    .panel h3 { margin: 0 0 8px; font-size: 15px; }
    .purpose { min-height: 62px; color: #374151; line-height: 1.45; }
    .runtime-note {
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
      transition: width .25s ease;
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
    .primary { color: #fff; background: #2563eb; }
    .secondary { color: #111827; background: #e5e7eb; }
    .danger { color: #991b1b; background: #fee2e2; }
    button:disabled { opacity: .45; cursor: default; }
  </style>
</head>
<body>
  <h2>PMOS Operations</h2>
  <div class="muted">Select a runtime operation, review its purpose, then run it.</div>

  <div class="layout">
    <div class="operations">
      <button type="button" class="operation" data-type="CALENDAR_SYNC" onclick="selectOperation(this)">
        Calendar Sync
      </button>
      <button type="button" class="operation" data-type="RECONCILE_FUTURE" onclick="selectOperation(this)">
        Reconcile Calendar
      </button>
    </div>

    <div class="panel">
      <h3 id="selectedTitle">Purpose</h3>
      <div id="purpose" class="purpose"></div>
      <div class="runtime-note">
        PMOS processes one queued operation at a time. Continue automatically keeps the runtime active until the queue is complete or paused.
      </div>
      <div id="statusBox" class="status">Loading current status…</div>
      <div class="progress"><div id="progressBar" class="bar"></div></div>
      <div id="errorBox" class="error"></div>

      <div class="buttons">
        <button id="runButton" class="action primary" type="button" onclick="runSelected(false)">Run Operation</button>
        <button id="autoButton" class="action primary" type="button" onclick="runSelected(true)">Continue Automatically</button>
        <button id="pauseButton" class="action danger" type="button" onclick="pauseOperation()">Pause</button>
        <button id="refreshButton" class="action secondary" type="button" onclick="refreshState(true)">Refresh</button>
        <button id="historyButton" class="action secondary" type="button" onclick="openHistory()">Job History</button>
        <button class="action secondary" type="button" onclick="closeEngine()">Close</button>
      </div>
    </div>
  </div>

<script>
  var selectedType = ${JSON.stringify(selectedType)};
  var currentState = {};
  var busy = false;
  var polling = false;
  var pollTimer = null;

  var operations = {
    CALENDAR_SYNC: {
      label: 'Calendar Sync',
      purpose: 'Synchronize the verified PMOS route plan to Google Calendar using queued runtime operations.'
    },
    RECONCILE_FUTURE: {
      label: 'Reconcile Calendar',
      purpose: 'Compare PMOS with future PMOS-managed Calendar series and queue only the changes needed to make them match.'
    }
  };

  function byId(id) { return document.getElementById(id); }

  function errorMessage(error) {
    if (!error) return 'Unknown error';
    return error.message ? error.message : String(error);
  }

  function showError(message) {
    byId('errorBox').style.display = 'block';
    byId('errorBox').textContent = message || 'Unknown error';
  }

  function clearError() {
    byId('errorBox').style.display = 'none';
    byId('errorBox').textContent = '';
  }

  function fail(error) {
    busy = false;
    polling = false;
    showError(errorMessage(error));
    updateButtons();
  }

  function selectOperation(button) {
    selectedType = button.getAttribute('data-type');
    renderSelection();
    google.script.run
      .withFailureHandler(function () {})
      .rememberPmosJobType(selectedType);
  }

  function renderSelection() {
    var buttons = document.getElementsByClassName('operation');
    for (var i = 0; i < buttons.length; i++) {
      var selected = buttons[i].getAttribute('data-type') === selectedType;
      buttons[i].className = 'operation' + (selected ? ' selected' : '');
    }

    var operation = operations[selectedType];
    byId('selectedTitle').textContent = operation ? operation.label : 'Purpose';
    byId('purpose').textContent = operation ? operation.purpose : 'Select an operation.';
    updateButtons();
  }

  function setBusy(value) {
    busy = Boolean(value);
    updateButtons();
  }

  function hasActiveOperation() {
    return Boolean(
      currentState &&
      currentState.type &&
      currentState.status !== 'Complete' &&
      currentState.status !== 'Cancelled' &&
      currentState.status !== 'Idle'
    );
  }

  function updateButtons() {
    var hasSelection = Boolean(operations[selectedType]);
    var active = hasActiveOperation();
    byId('runButton').disabled = busy || !hasSelection;
    byId('autoButton').disabled = busy || !hasSelection;
    byId('pauseButton').style.display = active ? 'inline-block' : 'none';
    byId('pauseButton').disabled = busy || !active;
    byId('refreshButton').disabled = busy;
    byId('historyButton').disabled = busy;
  }

  function calculatePercent(state) {
    if (state && state.status === 'Complete') return 100;
    var total = Number(state && state.originalTotal ? state.originalTotal : 0);
    var remaining = state && state.remaining != null ? Number(state.remaining) : null;
    if (total > 0 && remaining != null && isFinite(remaining)) {
      return Math.min(100, Math.max(0, Math.round((total - remaining) / total * 100)));
    }
    return 0;
  }

  function renderState(state) {
    currentState = state || {};
    var percent = calculatePercent(currentState);
    byId('progressBar').style.width = percent + '%';

    var lines = [
      'Operation: ' + (currentState.label || 'No active operation'),
      'Status: ' + (currentState.status || 'Idle'),
      'Progress: ' + percent + '%',
      'Completed operations: ' + Number(currentState.completedBatches || 0),
      'Processed items: ' + Number(currentState.processedItems || 0),
      'Remaining: ' + (currentState.remaining == null ? '—' : currentState.remaining)
    ];

    if (currentState.autoEnabled) lines.push('Automatic continuation: Enabled');
    if (currentState.nextRunAt) lines.push('Next attempt: ' + currentState.nextRunAt);
    if (currentState.lastSummary) lines.push('Last result: ' + currentState.lastSummary);

    byId('statusBox').textContent = lines.join('\\n');
    if (currentState.lastError) showError(currentState.lastError); else clearError();
    updateButtons();
  }

  function refreshState(showBusyState) {
    if (polling) return;
    polling = true;
    if (showBusyState) setBusy(true);

    google.script.run
      .withSuccessHandler(function (state) {
        polling = false;
        renderState(state);
        if (showBusyState) setBusy(false);
      })
      .withFailureHandler(function (error) {
        polling = false;
        if (showBusyState) fail(error);
      })
      .getPmosJobStatus();
  }

  function runSelected(autoMode) {
    clearError();
    var operation = operations[selectedType];
    if (!operation) {
      showError('Select an operation first.');
      return;
    }

    setBusy(true);
    byId('statusBox').textContent = 'Starting ' + operation.label + '…';

    google.script.run
      .withSuccessHandler(function (state) {
        renderState(state);
        setBusy(false);
      })
      .withFailureHandler(fail)
      .startPmosJob(selectedType, Boolean(autoMode), false);
  }

  function pauseOperation() {
    setBusy(true);
    clearError();
    google.script.run
      .withSuccessHandler(function (state) {
        renderState(state);
        setBusy(false);
      })
      .withFailureHandler(fail)
      .pausePmosJob();
  }

  function openHistory() {
    google.script.run.withFailureHandler(fail).showPmosJobHistory();
  }

  function closeEngine() {
    if (pollTimer) clearInterval(pollTimer);
    google.script.host.close();
  }

  window.addEventListener('beforeunload', function () {
    if (pollTimer) clearInterval(pollTimer);
  });

  renderSelection();
  refreshState(false);
  pollTimer = setInterval(function () { refreshState(false); }, 2000);
</script>
</body>
</html>`)
    .setWidth(810)
    .setHeight(610);

  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Operations');
}

function showPmosJobEngineFor_(type) {
  if (type !== 'CALENDAR_SYNC' && type !== 'RECONCILE_FUTURE') {
    throw new Error(`Unsupported runtime operation: ${type}`);
  }

  const audit = runCalendarPlanAudit_();
  if (!audit.canSync) {
    showCalendarPlanAudit();
    return;
  }

  showPmosJobEngine(type);
}

function startCalendarSyncJobFromMenu() {
  showPmosJobEngineFor_('CALENDAR_SYNC');
}

function startCalendarReconcileJobFromMenu() {
  showPmosJobEngineFor_('RECONCILE_FUTURE');
}
