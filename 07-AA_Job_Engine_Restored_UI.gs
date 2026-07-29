/**
 * Restored PMOS Job Engine interface.
 * Uses the existing Job Engine state and execution functions without changing
 * job processing behavior.
 */
function showRestoredPmosJobEngine(initialType) {
  ensurePmosJobHistorySheet_();

  const remembered = PropertiesService.getUserProperties()
    .getProperty('PMOS_LAST_JOB_TYPE') || '';
  const selected = PMOS_JOB_TYPES[initialType]
    ? initialType
    : (PMOS_JOB_TYPES[remembered] ? remembered : 'CALENDAR_SYNC');

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:18px;font-family:Arial,sans-serif;color:#1f2937;background:#fff}
    h2{margin:0 0 5px}.muted{color:#6b7280;font-size:13px}
    .layout{display:grid;grid-template-columns:250px 1fr;gap:14px;margin-top:15px}
    .jobs{display:flex;flex-direction:column;gap:7px}
    .job{width:100%;padding:11px 12px;font:inherit;font-weight:700;color:#1f2937;text-align:left;background:#fff;border:2px solid #e5e7eb;border-radius:9px;cursor:pointer}
    .job:hover{background:#f8fafc}
    .job.selected{color:#1d4ed8;background:#eff6ff;border-color:#2563eb}
    .panel{display:flex;min-height:475px;padding:14px;flex-direction:column;background:#fff;border:1px solid #e5e7eb;border-radius:10px}
    .panel h3{margin:0 0 8px;font-size:15px}.purpose{min-height:62px;color:#374151;line-height:1.45}
    .autoRow{display:none;margin-top:9px;padding:9px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;color:#1e3a8a;font-size:13px}
    .autoRow label{display:flex;align-items:center;gap:8px;cursor:pointer}.autoRow input{width:15px;height:15px}
    .status{min-height:150px;margin-top:12px;padding:12px;background:#f3f4f6;border-radius:9px;white-space:pre-line;line-height:1.45;font-size:13px}
    .progress{height:14px;margin-top:10px;overflow:hidden;background:#e5e7eb;border-radius:8px}.bar{width:0;height:100%;background:#2563eb;transition:width .25s ease}
    .error{display:none;margin-top:10px;padding:10px;color:#991b1b;background:#fee2e2;border-radius:8px;white-space:pre-wrap;font-size:13px}
    .buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:14px}
    button.action{padding:9px 12px;font-weight:700;border:0;border-radius:8px;cursor:pointer}.primary{color:#fff;background:#2563eb}.secondary{color:#111827;background:#e5e7eb}.danger{color:#991b1b;background:#fee2e2}button:disabled{opacity:.45;cursor:default}
  </style>
</head>
<body>
  <h2>PMOS Job Engine</h2>
  <div class="muted">Select an operation, review its purpose, then run it.</div>
  <div class="layout">
    <div class="jobs">
      <button class="job" data-type="CALENDAR_SYNC">Calendar Sync</button>
      <button class="job" data-type="CALENDAR_REBUILD">Calendar Rebuild</button>
      <button class="job" data-type="VERIFY_CALENDAR">Verify Calendar</button>
      <button class="job" data-type="CALENDAR_STATUS">Calendar Status</button>
      <button class="job" data-type="CUSTOMER_SYNC">Customer Database Sync</button>
      <button class="job" data-type="MAP_EXPORT">Export Updated Map Layers</button>
    </div>
    <div class="panel">
      <h3 id="selectedTitle">Purpose</h3>
      <div id="purpose" class="purpose"></div>
      <div id="autoRow" class="autoRow">
        <label><input id="autoContinue" type="checkbox" checked> Run Auto Continue</label>
      </div>
      <div id="statusBox" class="status">Loading current status…</div>
      <div class="progress"><div id="progressBar" class="bar"></div></div>
      <div id="errorBox" class="error"></div>
      <div class="buttons">
        <button id="runButton" class="action primary" type="button">Start / Continue</button>
        <button id="pauseButton" class="action danger" type="button">Pause</button>
        <button id="refreshButton" class="action secondary" type="button">Refresh</button>
        <button id="historyButton" class="action secondary" type="button">Job History</button>
        <button id="closeButton" class="action secondary" type="button">Close</button>
      </div>
    </div>
  </div>
<script>
(function(){
  var selectedType=${JSON.stringify(selected)}, currentState={}, busy=false, polling=false, pollTimer=null;
  var jobs={
    CALENDAR_SYNC:{label:'Calendar Sync',purpose:'Create, update, and remove recurring Google Calendar series so the Calendar matches the verified PMOS route plan.',supportsAuto:true},
    CALENDAR_REBUILD:{label:'Calendar Rebuild',purpose:'Remove PMOS-managed recurring Calendar series and rebuild the verified four-week route plan from current PMOS data.',supportsAuto:true},
    VERIFY_CALENDAR:{label:'Verify Calendar',purpose:'Compare the PMOS route plan, Calendar Series Registry, and Google Calendar without intentionally changing the Calendar.',supportsAuto:false},
    CALENDAR_STATUS:{label:'Calendar Status',purpose:'Display the current Calendar synchronization state, progress, pending work, and most recent result.',supportsAuto:false},
    CUSTOMER_SYNC:{label:'Customer Database Sync',purpose:'Generate missing customer IDs and propagate current customer information through route sheets and PMOS records.',supportsAuto:false},
    MAP_EXPORT:{label:'Export Updated Map Layers',purpose:'Generate updated CSV map-layer files for route layers affected by pending PMOS changes.',supportsAuto:false}
  };
  function byId(id){return document.getElementById(id)}
  function clearError(){byId('errorBox').style.display='none';byId('errorBox').textContent=''}
  function showError(error){byId('errorBox').style.display='block';byId('errorBox').textContent=error&&error.message?error.message:String(error||'Unknown error')}
  function active(){return !!(currentState&&currentState.type&&currentState.status!=='Complete'&&currentState.status!=='Cancelled'&&currentState.status!=='Idle')}
  function updateButtons(){var job=jobs[selectedType];byId('runButton').disabled=busy||!job;byId('pauseButton').disabled=busy||!active();byId('refreshButton').disabled=busy;byId('historyButton').disabled=busy}
  function renderSelection(){
    Array.prototype.forEach.call(document.getElementsByClassName('job'),function(button){button.className='job'+(button.getAttribute('data-type')===selectedType?' selected':'')});
    var job=jobs[selectedType];byId('selectedTitle').textContent=job?job.label:'Purpose';byId('purpose').textContent=job?job.purpose:'Select an operation.';byId('autoRow').style.display=job&&job.supportsAuto?'block':'none';updateButtons();
  }
  function percent(state){if(state&&state.status==='Complete')return 100;var total=Number(state&&state.originalTotal||0),remaining=state&&state.remaining!=null?Number(state.remaining):null;return total>0&&remaining!=null&&isFinite(remaining)?Math.min(100,Math.max(0,Math.round((total-remaining)/total*100))):0}
  function renderState(state){
    currentState=state||{};var p=percent(currentState);byId('progressBar').style.width=p+'%';
    var lines=['Job: '+(currentState.label||'No active job'),'Status: '+(currentState.status||'Idle'),'Progress: '+p+'%','Completed batches: '+Number(currentState.completedBatches||0),'Processed items: '+Number(currentState.processedItems||0),'Remaining: '+(currentState.remaining==null?'—':currentState.remaining)];
    if(currentState.autoEnabled)lines.push('Auto Continue: Enabled');if(currentState.nextRunAt)lines.push('Next attempt: '+currentState.nextRunAt);if(currentState.lastSummary)lines.push('Last result: '+currentState.lastSummary);byId('statusBox').textContent=lines.join('\n');
    if(currentState.lastError)showError(currentState.lastError);else clearError();busy=false;updateButtons();
  }
  function fail(error){busy=false;polling=false;showError(error);updateButtons()}
  function refresh(showBusy){if(polling)return;polling=true;if(showBusy){busy=true;updateButtons()}google.script.run.withSuccessHandler(function(state){polling=false;renderState(state)}).withFailureHandler(fail).getPmosJobStatus()}
  function run(){
    clearError();var job=jobs[selectedType];if(!job)return showError('Select an operation first.');if(selectedType==='CALENDAR_STATUS')return refresh(true);
    busy=true;updateButtons();byId('statusBox').textContent='Starting '+job.label+'…';
    google.script.run.withSuccessHandler(renderState).withFailureHandler(fail).startPmosJob(selectedType,job.supportsAuto&&byId('autoContinue').checked,false);
  }
  function pause(){busy=true;clearError();updateButtons();google.script.run.withSuccessHandler(renderState).withFailureHandler(fail).pausePmosJob()}
  Array.prototype.forEach.call(document.getElementsByClassName('job'),function(button){button.addEventListener('click',function(){selectedType=button.getAttribute('data-type');renderSelection();google.script.run.withFailureHandler(function(){}).rememberPmosJobType(selectedType)})});
  byId('runButton').addEventListener('click',run);byId('pauseButton').addEventListener('click',pause);byId('refreshButton').addEventListener('click',function(){refresh(true)});byId('historyButton').addEventListener('click',function(){google.script.run.withFailureHandler(fail).showPmosJobHistory()});byId('closeButton').addEventListener('click',function(){if(pollTimer)clearInterval(pollTimer);google.script.host.close()});
  renderSelection();refresh(false);pollTimer=setInterval(function(){refresh(false)},2000);
})();
</script>
</body>
</html>`).setWidth(840).setHeight(680);

  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Job Engine');
}

function openRestoredCalendarSyncFromAudit() {
  showRestoredPmosJobEngine('CALENDAR_SYNC');
  return true;
}
