/**
 * PMOS integrated Calendar Job Engine.
 * Uses deliberately simple browser JavaScript so the dialog remains reliable
 * inside the Apps Script HTML sandbox.
 */
function showIntegratedPmosJobEngine(initialType) {
  ensurePmosJobHistorySheet_();
  const today = Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
  const remembered = PropertiesService.getUserProperties()
    .getProperty('PMOS_LAST_INTEGRATED_JOB_TYPE') || '';
  const selected = initialType || remembered || 'CALENDAR_STATUS';

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    *{box-sizing:border-box}body{margin:0;padding:18px;font-family:Arial,sans-serif;color:#1f2937;background:#fff}
    h2{margin:0 0 5px}.muted{color:#6b7280;font-size:13px}.layout{display:grid;grid-template-columns:245px 1fr;gap:14px;margin-top:15px}
    .jobs{display:flex;flex-direction:column;gap:7px}.job{width:100%;padding:11px 12px;font:inherit;font-weight:700;text-align:left;background:#fff;border:2px solid #e5e7eb;border-radius:9px;cursor:pointer}
    .job.selected{color:#1d4ed8;background:#eff6ff;border-color:#2563eb}.panel{display:flex;min-height:475px;padding:14px;flex-direction:column;border:1px solid #e5e7eb;border-radius:10px}
    .panel h3{margin:0 0 8px;font-size:15px}.purpose{min-height:62px;color:#374151;line-height:1.45}.fields{display:none;margin-top:10px;padding:11px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:9px}
    .field{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700}.field input{padding:7px;border:1px solid #cbd5e1;border-radius:7px;font:inherit}
    .status{min-height:155px;margin-top:12px;padding:12px;background:#f3f4f6;border-radius:9px;white-space:pre-wrap;line-height:1.45;font-size:13px;overflow:auto}
    .error{display:none;margin-top:10px;padding:10px;color:#991b1b;background:#fee2e2;border-radius:8px;white-space:pre-wrap;font-size:13px}
    .buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:14px}button.action{padding:9px 12px;font-weight:700;border:0;border-radius:8px;cursor:pointer}
    .primary{color:#fff;background:#2563eb}.secondary{color:#111827;background:#e5e7eb}.danger{color:#991b1b;background:#fee2e2}button:disabled{opacity:.45;cursor:default}
  </style>
</head>
<body>
  <h2>PMOS Job Engine</h2>
  <div class="muted">Select an operation, review its purpose, then run it.</div>
  <div class="layout">
    <div class="jobs">
      <button type="button" class="job" data-type="CALENDAR_STATUS">Calendar Status</button>
      <button type="button" class="job" data-type="VERIFY_CALENDAR">Verify Calendar</button>
      <button type="button" class="job" data-type="CALENDAR_SYNC">Calendar Sync</button>
      <button type="button" class="job" data-type="RECONCILE_FUTURE">Reconcile Calendar</button>
      <button type="button" class="job" data-type="CALENDAR_REPAIR">Calendar Repair</button>
      <button type="button" class="job" data-type="CUSTOMER_SYNC">Customer Database Sync</button>
      <button type="button" class="job" data-type="MAP_EXPORT">Export Map Layers</button>
    </div>
    <div class="panel">
      <h3 id="selectedTitle">Purpose</h3>
      <div id="purpose" class="purpose"></div>
      <div id="dateFields" class="fields"><label class="field">Effective date<input id="effectiveDate" type="date" value="${today}"></label></div>
      <div id="statusBox" class="status">Ready.</div>
      <div id="errorBox" class="error"></div>
      <div class="buttons">
        <button id="runButton" class="action primary" type="button">Run / Continue</button>
        <button id="autoButton" class="action primary" type="button">Auto Continue</button>
        <button id="previewButton" class="action secondary" type="button">Preview</button>
        <button id="pauseButton" class="action danger" type="button">Pause</button>
        <button id="refreshButton" class="action secondary" type="button">Refresh</button>
        <button id="historyButton" class="action secondary" type="button">Job History</button>
        <button id="closeButton" class="action secondary" type="button">Close</button>
      </div>
    </div>
  </div>
<script>
(function(){
  var selectedType = ${JSON.stringify(selected)};
  var busy = false;
  var currentState = {};
  var jobs = {
    CALENDAR_STATUS:{label:'Calendar Status',purpose:'View the current PMOS Calendar synchronization status.',auto:false},
    VERIFY_CALENDAR:{label:'Verify Calendar',purpose:'Compare the route template, registry, and Google Calendar.',auto:false},
    CALENDAR_SYNC:{label:'Calendar Sync',purpose:'Update Google Calendar from the current route template.',auto:true},
    RECONCILE_FUTURE:{label:'Reconcile Calendar',purpose:'Replace future PMOS Calendar events from the selected effective date.',auto:true},
    CALENDAR_REPAIR:{label:'Calendar Repair',purpose:'Open the Calendar repair workflow.',auto:false},
    CUSTOMER_SYNC:{label:'Customer Database Sync',purpose:'Refresh customer information in the route template.',auto:false},
    MAP_EXPORT:{label:'Export Map Layers',purpose:'Generate current route-layer files for Google My Maps.',auto:false}
  };
  function el(id){return document.getElementById(id);}
  function message(error){return error && error.message ? error.message : String(error || 'Unknown error');}
  function display(value){
    if(value === null || value === undefined) return 'Complete.';
    if(typeof value === 'string') return value;
    if(value.summary) return String(value.summary);
    try{return JSON.stringify(value, null, 2);}catch(ignore){return String(value);}
  }
  function setBusy(value){busy=value;render();}
  function fail(error){setBusy(false);el('errorBox').style.display='block';el('errorBox').textContent=message(error);}
  function success(result){currentState=result||{};setBusy(false);el('errorBox').style.display='none';el('statusBox').textContent=display(result);}
  function render(){
    var buttons=document.getElementsByClassName('job');
    for(var i=0;i<buttons.length;i++) buttons[i].className='job'+(buttons[i].getAttribute('data-type')===selectedType?' selected':'');
    var job=jobs[selectedType]||{};
    el('selectedTitle').textContent=job.label||'Purpose';
    el('purpose').textContent=job.purpose||'';
    el('dateFields').style.display=(selectedType==='CALENDAR_SYNC'||selectedType==='RECONCILE_FUTURE')?'block':'none';
    el('runButton').disabled=busy;
    el('autoButton').disabled=busy;
    el('autoButton').style.display=job.auto?'inline-block':'none';
    el('previewButton').style.display=selectedType==='RECONCILE_FUTURE'?'inline-block':'none';
    el('pauseButton').style.display=currentState && currentState.status && currentState.status!=='Idle' && currentState.status!=='Complete' ? 'inline-block':'none';
  }
  function select(type){selectedType=type;google.script.run.withFailureHandler(function(){}).rememberIntegratedPmosJobType(type);render();}
  function run(autoMode){
    setBusy(true);el('errorBox').style.display='none';
    if(selectedType==='CALENDAR_STATUS'){refresh();return;}
    if(selectedType==='CALENDAR_SYNC'){
      google.script.run.withSuccessHandler(success).withFailureHandler(fail).startCalendarSyncFromDate(el('effectiveDate').value,Boolean(autoMode));return;
    }
    if(selectedType==='RECONCILE_FUTURE'){
      if(!confirm('Apply future-only reconciliation from the selected effective date?')){setBusy(false);return;}
      google.script.run.withSuccessHandler(success).withFailureHandler(fail).startBatchedCalendarReconcile(el('effectiveDate').value,Boolean(autoMode),true);return;
    }
    if(selectedType==='CALENDAR_REPAIR'){
      setBusy(false);google.script.run.withFailureHandler(fail).showCalendarRepairEditor();return;
    }
    if(selectedType==='CUSTOMER_SYNC'){
      google.script.run.withSuccessHandler(success).withFailureHandler(fail).runSmartCustomerDatabaseSync();return;
    }
    google.script.run.withSuccessHandler(success).withFailureHandler(fail).startPmosJob(selectedType,Boolean(autoMode),false);
  }
  function refresh(){setBusy(true);google.script.run.withSuccessHandler(success).withFailureHandler(fail).getPmosJobStatus();}
  function preview(){setBusy(true);google.script.run.withSuccessHandler(success).withFailureHandler(fail).previewReconcileFutureCalendar(el('effectiveDate').value);}
  function pause(){setBusy(true);if(selectedType==='RECONCILE_FUTURE')google.script.run.withSuccessHandler(success).withFailureHandler(fail).pauseBatchedCalendarReconcile();else google.script.run.withSuccessHandler(success).withFailureHandler(fail).pausePmosJob();}
  var jobButtons=document.getElementsByClassName('job');
  for(var i=0;i<jobButtons.length;i++) jobButtons[i].onclick=function(){select(this.getAttribute('data-type'));};
  el('runButton').onclick=function(){run(false);};
  el('autoButton').onclick=function(){run(true);};
  el('previewButton').onclick=preview;
  el('pauseButton').onclick=pause;
  el('refreshButton').onclick=refresh;
  el('historyButton').onclick=function(){google.script.run.withFailureHandler(fail).showPmosJobHistory();};
  el('closeButton').onclick=function(){google.script.host.close();};
  render();
  refresh();
})();
</script>
</body>
</html>`).setWidth(900).setHeight(720);

  SpreadsheetApp.getUi().showModelessDialog(html, 'PMOS Job Engine');
}

function rememberIntegratedPmosJobType(type) {
  PropertiesService.getUserProperties()
    .setProperty('PMOS_LAST_INTEGRATED_JOB_TYPE', String(type || ''));
  return type;
}
