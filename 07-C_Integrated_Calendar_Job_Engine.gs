/**
 * PMOS integrated Calendar Job Engine.
 * Preserves the established left-hand job layout while adding safe Calendar work.
 */

function showIntegratedPmosJobEngine(initialType) {
  ensurePmosJobHistorySheet_();
  const today = Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
  const remembered = PropertiesService.getUserProperties().getProperty('PMOS_LAST_INTEGRATED_JOB_TYPE') || '';
  const selected = initialType || remembered || 'CALENDAR_SYNC';

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    *{box-sizing:border-box}body{margin:0;padding:18px;font-family:Arial,sans-serif;color:#1f2937;background:#fff}
    h2{margin:0 0 5px}.muted{color:#6b7280;font-size:13px}.layout{display:grid;grid-template-columns:250px 1fr;gap:14px;margin-top:15px}
    .jobs{display:flex;flex-direction:column;gap:7px}.job{width:100%;padding:11px 12px;font:inherit;font-weight:700;color:#1f2937;text-align:left;background:#fff;border:2px solid #e5e7eb;border-radius:9px;cursor:pointer}
    .job:hover{background:#f8fafc}.job.selected{color:#1d4ed8;background:#eff6ff;border-color:#2563eb}.panel{display:flex;min-height:475px;padding:14px;flex-direction:column;background:#fff;border:1px solid #e5e7eb;border-radius:10px}
    .panel h3{margin:0 0 8px;font-size:15px}.purpose{min-height:62px;color:#374151;line-height:1.45}.fields{display:none;margin-top:10px;padding:11px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:9px}
    .field-row{display:flex;gap:12px;flex-wrap:wrap}.field{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700}.field input{padding:7px;border:1px solid #cbd5e1;border-radius:7px;font:inherit}
    .auto-note{display:none;margin-top:9px;padding:8px 10px;color:#166534;font-size:12px;line-height:1.4;background:#dcfce7;border-radius:7px}.status{min-height:150px;margin-top:12px;padding:12px;background:#f3f4f6;border-radius:9px;white-space:pre-line;line-height:1.45;font-size:13px}
    .progress{height:14px;margin-top:10px;overflow:hidden;background:#e5e7eb;border-radius:8px}.bar{width:0;height:100%;background:#2563eb;transition:width .25s ease}.error{display:none;margin-top:10px;padding:10px;color:#991b1b;background:#fee2e2;border-radius:8px;white-space:pre-wrap;font-size:13px}
    .buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:14px}button.action{padding:9px 12px;font-weight:700;border:0;border-radius:8px;cursor:pointer}.primary{color:#fff;background:#2563eb}.secondary{color:#111827;background:#e5e7eb}.danger{color:#991b1b;background:#fee2e2}button:disabled{opacity:.45;cursor:default}
  </style>
</head>
<body>
  <h2>PMOS Job Engine</h2>
  <div class="muted">Select an operation, review its purpose, then run it.</div>
  <div class="layout">
    <div class="jobs">
      <button type="button" class="job" data-type="CALENDAR_SYNC" onclick="selectJob(this)">Calendar Sync</button>
      <button type="button" class="job" data-type="RECONCILE_FUTURE" onclick="selectJob(this)">Reconcile Future Calendar</button>
      <button type="button" class="job" data-type="CALENDAR_REPAIR" onclick="selectJob(this)">Calendar Repair</button>
      <button type="button" class="job" data-type="VERIFY_CALENDAR" onclick="selectJob(this)">Verify Calendar</button>
      <button type="button" class="job" data-type="CALENDAR_STATUS" onclick="selectJob(this)">Calendar Status</button>
      <button type="button" class="job" data-type="CUSTOMER_SYNC" onclick="selectJob(this)">Customer Database Sync</button>
      <button type="button" class="job" data-type="MAP_EXPORT" onclick="selectJob(this)">Export Updated Map Layers</button>
    </div>
    <div class="panel">
      <h3 id="selectedTitle">Purpose</h3>
      <div id="purpose" class="purpose"></div>
      <div id="reconcileFields" class="fields"><div class="field-row"><label class="field">Effective date<input id="effectiveDate" type="date" value="${today}"></label></div></div>
      <div id="repairFields" class="fields"><div class="field-row"><label class="field">Begin date<input id="repairStart" type="date"></label><label class="field">End date<input id="repairEnd" type="date" value="${today}"></label></div></div>
      <div id="autoNote" class="auto-note">Auto Continue runs the current batch immediately and schedules later batches automatically.</div>
      <div id="statusBox" class="status">Ready.</div>
      <div class="progress"><div id="progressBar" class="bar"></div></div>
      <div id="errorBox" class="error"></div>
      <div class="buttons">
        <button id="runButton" class="action primary" type="button" onclick="runSelected(false)">Run / Continue</button>
        <button id="autoButton" class="action primary" type="button" onclick="runSelected(true)">Auto Continue</button>
        <button id="previewButton" class="action secondary" type="button" onclick="previewSelected()">Preview</button>
        <button id="expandButton" class="action secondary" type="button" onclick="expandRepair()">Expand Preview / Edit Route Order</button>
        <button id="pauseButton" class="action danger" type="button" onclick="pauseJob()">Pause</button>
        <button id="refreshButton" class="action secondary" type="button" onclick="refreshState(true)">Refresh</button>
        <button id="historyButton" class="action secondary" type="button" onclick="openHistory()">Job History</button>
        <button class="action secondary" type="button" onclick="google.script.host.close()">Close</button>
      </div>
    </div>
  </div>
<script>
  var selectedType=${JSON.stringify(selected)};var currentState={};var busy=false;
  var jobs={
    CALENDAR_SYNC:{label:'Calendar Sync',purpose:'Create, update, and remove recurring Google Calendar series so the Calendar matches the verified PMOS route plan.',supportsAuto:true,runLabel:'Run One Batch'},
    RECONCILE_FUTURE:{label:'Reconcile Future Calendar',purpose:'Replace Calendar Rebuild. Reconcile only PMOS-managed Calendar work on or after the effective date while preserving earlier Calendar history.',supportsAuto:false,runLabel:'Apply Reconciliation'},
    CALENDAR_REPAIR:{label:'Calendar Repair',purpose:'Choose a begin and end date, preview missing or mismatched route visits, optionally expand the preview and drag customers between stops, days, and weeks, then apply the edited repair plan.',supportsAuto:false,runLabel:'Apply Previewed Repair'},
    VERIFY_CALENDAR:{label:'Verify Calendar',purpose:'Compare the verified PMOS route plan, Calendar Series Registry, and Google Calendar without intentionally changing the Calendar.',supportsAuto:false,runLabel:'Run Verification'},
    CALENDAR_STATUS:{label:'Calendar Status',purpose:'Display the current Calendar synchronization state, progress, pending work, and most recent result.',supportsAuto:false,runLabel:'Refresh Status'},
    CUSTOMER_SYNC:{label:'Customer Database Sync',purpose:'Generate missing customer IDs and propagate current customer information through route sheets and PMOS records.',supportsAuto:false,runLabel:'Run Customer Sync'},
    MAP_EXPORT:{label:'Export Updated Map Layers',purpose:'Generate updated CSV map-layer files for route layers affected by pending PMOS changes and place them in a new Drive folder.',supportsAuto:false,runLabel:'Export Map Layers'}
  };
  function byId(id){return document.getElementById(id)}function err(e){return e&&e.message?e.message:String(e||'Unknown error')}
  function fail(e){busy=false;byId('errorBox').style.display='block';byId('errorBox').textContent=err(e);updateButtons()}
  function showResult(r){busy=false;byId('errorBox').style.display='none';byId('statusBox').textContent=r&&r.summary?r.summary:String(r||'Complete.');byId('progressBar').style.width='100%';updateButtons()}
  function selectJob(button){selectedType=button.dataset.type;google.script.run.rememberIntegratedPmosJobType(selectedType);renderSelection()}
  function renderSelection(){Array.prototype.forEach.call(document.getElementsByClassName('job'),function(b){b.className='job'+(b.dataset.type===selectedType?' selected':'')});var j=jobs[selectedType]||{};byId('selectedTitle').textContent=j.label||'Purpose';byId('purpose').textContent=j.purpose||'Select an operation.';byId('reconcileFields').style.display=selectedType==='RECONCILE_FUTURE'?'block':'none';byId('repairFields').style.display=selectedType==='CALENDAR_REPAIR'?'block':'none';byId('autoNote').style.display=j.supportsAuto?'block':'none';updateButtons()}
  function updateButtons(){var j=jobs[selectedType];byId('runButton').textContent=j?j.runLabel:'Run';byId('runButton').disabled=busy||!j;byId('autoButton').style.display=j&&j.supportsAuto?'inline-block':'none';byId('previewButton').style.display=(selectedType==='RECONCILE_FUTURE'||selectedType==='CALENDAR_REPAIR')?'inline-block':'none';byId('expandButton').style.display=selectedType==='CALENDAR_REPAIR'?'inline-block':'none';byId('pauseButton').style.display=currentState&&currentState.type&&currentState.status!=='Complete'&&currentState.status!=='Cancelled'&&currentState.status!=='Idle'?'inline-block':'none'}
  function dates(){return {start:byId('repairStart').value,end:byId('repairEnd').value}}
  function previewSelected(){busy=true;updateButtons();if(selectedType==='RECONCILE_FUTURE'){google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).previewReconcileFutureCalendar(byId('effectiveDate').value)}else{var d=dates();google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).previewCalendarRepairPlan(d.start,d.end)}}
  function expandRepair(){var d=dates();busy=true;updateButtons();google.script.run.withSuccessHandler(function(r){busy=false;byId('statusBox').textContent=r.summary;updateButtons()}).withFailureHandler(fail).openCalendarRepairBoard(d.start,d.end)}
  function runSelected(autoMode){busy=true;byId('errorBox').style.display='none';updateButtons();if(selectedType==='RECONCILE_FUTURE'){if(!confirm('Apply future-only reconciliation from the selected effective date?')){busy=false;updateButtons();return}google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).reconcileFutureCalendar(byId('effectiveDate').value,true);return}if(selectedType==='CALENDAR_REPAIR'){var d=dates();if(!confirm('Apply the current Calendar repair preview?')){busy=false;updateButtons();return}google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).applyCalendarRepairPlan(d.start,d.end);return}if(selectedType==='CALENDAR_STATUS'){refreshState(true);return}google.script.run.withSuccessHandler(function(s){currentState=s||{};showResult(s)}).withFailureHandler(fail).startPmosJob(selectedType,Boolean(autoMode),false)}
  function refreshState(showBusy){if(showBusy){busy=true;updateButtons()}google.script.run.withSuccessHandler(function(s){currentState=s||{};busy=false;var p=0;if(s&&s.status==='Complete')p=100;else if(s&&s.originalTotal>0&&s.remaining!=null)p=Math.round((s.originalTotal-s.remaining)/s.originalTotal*100);byId('progressBar').style.width=Math.max(0,Math.min(100,p))+'%';byId('statusBox').textContent=['Job: '+(s.label||'No active job'),'Status: '+(s.status||'Idle'),'Progress: '+p+'%','Processed items: '+Number(s.processedItems||0),'Remaining: '+(s.remaining==null?'—':s.remaining),s.lastSummary?'Last result: '+s.lastSummary:''].filter(Boolean).join('\n');updateButtons()}).withFailureHandler(fail).getPmosJobStatus()}
  function pauseJob(){busy=true;updateButtons();google.script.run.withSuccessHandler(function(s){currentState=s||{};showResult(s)}).withFailureHandler(fail).pausePmosJob()}
  function openHistory(){google.script.run.withFailureHandler(fail).showPmosJobHistory()}
  renderSelection();refreshState(false);
</script>
</body>
</html>`).setWidth(900).setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Job Engine');
}

function rememberIntegratedPmosJobType(type) {
  PropertiesService.getUserProperties().setProperty('PMOS_LAST_INTEGRATED_JOB_TYPE', String(type || ''));
  return type;
}
