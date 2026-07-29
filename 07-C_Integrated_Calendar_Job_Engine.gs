/**
 * PMOS integrated Calendar Job Engine.
 * Restores Calendar Repair preview/edit controls and live job progress.
 */
function showIntegratedPmosJobEngine(initialType) {
  ensurePmosJobHistorySheet_();
  const today = Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
  const remembered = PropertiesService.getUserProperties()
    .getProperty('PMOS_LAST_INTEGRATED_JOB_TYPE') || '';
  const selected = initialType || remembered || 'CALENDAR_STATUS';
  const savedRepairPlan = readRepairPlan_();
  const savedRepairStart = savedRepairPlan && savedRepairPlan.start
    ? savedRepairPlan.start
    : today;
  const savedRepairEnd = savedRepairPlan && savedRepairPlan.end
    ? savedRepairPlan.end
    : today;

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    *{box-sizing:border-box}body{margin:0;padding:18px;font-family:Arial,sans-serif;color:#1f2937;background:#fff}
    h2{margin:0 0 5px}.muted{color:#6b7280;font-size:13px}.layout{display:grid;grid-template-columns:250px 1fr;gap:14px;margin-top:15px}
    .jobs{display:flex;flex-direction:column;gap:7px}.job{width:100%;padding:11px 12px;font:inherit;font-weight:700;color:#1f2937;text-align:left;background:#fff;border:2px solid #e5e7eb;border-radius:9px;cursor:pointer}
    .job:hover{background:#f8fafc}.job.selected{color:#1d4ed8;background:#eff6ff;border-color:#2563eb}.panel{display:flex;min-height:500px;padding:14px;flex-direction:column;background:#fff;border:1px solid #e5e7eb;border-radius:10px}
    .panel h3{margin:0 0 8px;font-size:15px}.purpose{min-height:62px;color:#374151;line-height:1.45}.fields{display:none;margin-top:10px;padding:11px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:9px}
    .field-row{display:flex;gap:12px;flex-wrap:wrap}.field{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700}.field input{padding:7px;border:1px solid #cbd5e1;border-radius:7px;font:inherit}
    .auto-note{display:none;margin-top:9px;padding:8px 10px;color:#166534;font-size:12px;line-height:1.4;background:#dcfce7;border-radius:7px}.status{min-height:170px;margin-top:12px;padding:12px;background:#f3f4f6;border-radius:9px;white-space:pre-wrap;line-height:1.45;font-size:13px;overflow:auto}
    .progress{height:14px;margin-top:10px;overflow:hidden;background:#e5e7eb;border-radius:8px}.bar{width:0;height:100%;background:#2563eb;transition:width .25s ease}.progressText{margin-top:5px;text-align:right;color:#6b7280;font-size:12px}
    .error{display:none;margin-top:10px;padding:10px;color:#991b1b;background:#fee2e2;border-radius:8px;white-space:pre-wrap;font-size:13px}.buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:14px}
    button.action{padding:9px 12px;font-weight:700;border:0;border-radius:8px;cursor:pointer}.primary{color:#fff;background:#2563eb}.secondary{color:#111827;background:#e5e7eb}.danger{color:#991b1b;background:#fee2e2}button:disabled{opacity:.45;cursor:default}
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
      <div id="syncFields" class="fields"><div class="field-row"><label class="field">Effective date<input id="effectiveDate" type="date" value="${today}"></label></div></div>
      <div id="repairFields" class="fields"><div class="field-row"><label class="field">Begin date<input id="repairStart" type="date" value="${savedRepairStart}"></label><label class="field">End date<input id="repairEnd" type="date" value="${savedRepairEnd}"></label></div></div>
      <div id="autoNote" class="auto-note">Auto Continue runs one batch now and schedules later batches automatically.</div>
      <div id="statusBox" class="status">Ready.</div>
      <div class="progress"><div id="progressBar" class="bar"></div></div>
      <div id="progressText" class="progressText">0%</div>
      <div id="errorBox" class="error"></div>
      <div class="buttons">
        <button id="runButton" class="action primary" type="button">Run / Continue</button>
        <button id="autoButton" class="action primary" type="button">Auto Continue</button>
        <button id="previewButton" class="action secondary" type="button">Preview</button>
        <button id="editButton" class="action secondary" type="button">Expand Preview / Edit Route Order</button>
        <button id="pauseButton" class="action danger" type="button">Pause</button>
        <button id="refreshButton" class="action secondary" type="button">Refresh</button>
        <button id="historyButton" class="action secondary" type="button">Job History</button>
        <button id="closeButton" class="action secondary" type="button">Close</button>
      </div>
    </div>
  </div>
<script>
(function(){
  var selectedType=${JSON.stringify(selected)};
  var currentState={};
  var busy=false;
  var pollTimer=null;
  var NL=String.fromCharCode(10);
  var jobs={
    CALENDAR_STATUS:{label:'Calendar Status',purpose:'View current Calendar synchronization status, progress, and the most recent result.',auto:false,runLabel:'Refresh Status'},
    VERIFY_CALENDAR:{label:'Verify Calendar',purpose:'Compare the route template, registry, and Google Calendar for missing, extra, or mismatched visits.',auto:false,runLabel:'Run Verification'},
    CALENDAR_SYNC:{label:'Calendar Sync',purpose:'Update Google Calendar from the current route template.',auto:true,runLabel:'Run One Batch'},
    RECONCILE_FUTURE:{label:'Reconcile Calendar',purpose:'Safely replace future PMOS Calendar events from the selected effective date while preserving history.',auto:true,runLabel:'Run One Batch'},
    CALENDAR_REPAIR:{label:'Calendar Repair',purpose:'Preview, add, remove, move, and reorder Calendar visits within a selected date range before applying changes.',auto:false,runLabel:'Apply Previewed Repair'},
    CUSTOMER_SYNC:{label:'Customer Database Sync',purpose:'Refresh matching customer information throughout the route template.',auto:false,runLabel:'Run Customer Sync'},
    MAP_EXPORT:{label:'Export Map Layers',purpose:'Generate current route-layer files for Google My Maps.',auto:false,runLabel:'Export Map Layers'}
  };
  function el(id){return document.getElementById(id);}
  function errorText(e){return e&&e.message?e.message:String(e||'Unknown error');}
  function titleCase(key){return String(key||'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/^./,function(c){return c.toUpperCase();});}
  function renderObject(value,depth){
    depth=depth||0;
    if(value===null||value===undefined||value==='')return '';
    if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value);
    if(Array.isArray(value))return value.length?value.map(function(item,i){return (i+1)+'. '+renderObject(item,depth+1);}).join(NL):'None';
    if(typeof value==='object'){
      var preferred=['label','status','summary','message','phase','effectiveDate','processedItems','originalTotal','remaining','completedBatches','created','updated','removed','skipped','warnings','errors','lastSummary','nextRunAt'];
      var keys=Object.keys(value),ordered=[];
      preferred.forEach(function(k){if(keys.indexOf(k)>=0)ordered.push(k);});
      keys.forEach(function(k){if(ordered.indexOf(k)<0)ordered.push(k);});
      return ordered.map(function(k){var v=value[k];if(v===null||v===undefined||v==='')return '';var text=renderObject(v,depth+1);if(!text)return '';if(k==='summary'||k==='message'||k==='lastSummary')return text;return titleCase(k)+': '+text;}).filter(Boolean).join(NL);
    }
    return String(value);
  }
  function setBusy(value){busy=value;renderControls();}
  function fail(error){busy=false;el('errorBox').style.display='block';el('errorBox').textContent=errorText(error);renderControls();}
  function calculateProgress(state){
    if(!state)return 0;
    if(state.status==='Complete')return 100;
    var total=Number(state.originalTotal||0),remaining=state.remaining;
    if(total>0&&remaining!==null&&remaining!==undefined)return Math.max(0,Math.min(100,Math.round((total-Number(remaining||0))/total*100)));
    return 0;
  }
  function showState(state){
    currentState=state||{};
    var p=calculateProgress(currentState);
    el('progressBar').style.width=p+'%';
    el('progressText').textContent=p+'%';
    el('statusBox').textContent=renderObject(currentState)||'Ready.';
    renderControls();
  }
  function success(result){busy=false;el('errorBox').style.display='none';showState(result||{});startPollingIfNeeded();}
  function selectType(type){selectedType=type;google.script.run.withFailureHandler(function(){}).rememberIntegratedPmosJobType(type);renderSelection();}
  function renderSelection(){
    var buttons=document.getElementsByClassName('job');
    for(var i=0;i<buttons.length;i++)buttons[i].className='job'+(buttons[i].getAttribute('data-type')===selectedType?' selected':'');
    var job=jobs[selectedType]||{};
    el('selectedTitle').textContent=job.label||'Purpose';
    el('purpose').textContent=job.purpose||'';
    el('syncFields').style.display=(selectedType==='CALENDAR_SYNC'||selectedType==='RECONCILE_FUTURE')?'block':'none';
    el('repairFields').style.display=selectedType==='CALENDAR_REPAIR'?'block':'none';
    el('autoNote').style.display=job.auto?'block':'none';
    renderControls();
  }
  function renderControls(){
    var job=jobs[selectedType]||{},repair=selectedType==='CALENDAR_REPAIR';
    el('runButton').textContent=job.runLabel||'Run';
    el('runButton').disabled=busy;
    el('autoButton').disabled=busy;
    el('autoButton').style.display=job.auto?'inline-block':'none';
    el('previewButton').style.display=(repair||selectedType==='RECONCILE_FUTURE')?'inline-block':'none';
    el('editButton').style.display=repair?'inline-block':'none';
    var active=currentState&&currentState.status&&['Complete','Cancelled','Idle'].indexOf(currentState.status)<0;
    el('pauseButton').style.display=active?'inline-block':'none';
  }
  function repairDates(){return{start:el('repairStart').value,end:el('repairEnd').value};}
  function rememberRepairDates(d){if(d.start&&d.end)google.script.run.withFailureHandler(function(){}).rememberCalendarRepairDates(d.start,d.end);}
  function runSelected(autoMode){
    setBusy(true);el('errorBox').style.display='none';
    if(selectedType==='CALENDAR_STATUS'){refreshState(true);return;}
    if(selectedType==='CALENDAR_SYNC'){google.script.run.withSuccessHandler(success).withFailureHandler(fail).startCalendarSyncFromDate(el('effectiveDate').value,Boolean(autoMode));return;}
    if(selectedType==='RECONCILE_FUTURE'){
      if(!confirm('Apply future-only reconciliation from the selected effective date?')){setBusy(false);return;}
      google.script.run.withSuccessHandler(success).withFailureHandler(fail).startBatchedCalendarReconcile(el('effectiveDate').value,Boolean(autoMode),true);return;
    }
    if(selectedType==='CALENDAR_REPAIR'){
      var d=repairDates();rememberRepairDates(d);
      if(!confirm('Apply the currently previewed Calendar repair plan?')){setBusy(false);return;}
      google.script.run.withSuccessHandler(success).withFailureHandler(fail).applyCalendarRepairPlan(d.start,d.end);return;
    }
    if(selectedType==='CUSTOMER_SYNC'){google.script.run.withSuccessHandler(success).withFailureHandler(fail).runSmartCustomerDatabaseSync();return;}
    google.script.run.withSuccessHandler(success).withFailureHandler(fail).startPmosJob(selectedType,Boolean(autoMode),false);
  }
  function previewSelected(){
    setBusy(true);
    if(selectedType==='RECONCILE_FUTURE'){google.script.run.withSuccessHandler(success).withFailureHandler(fail).previewReconcileFutureCalendar(el('effectiveDate').value);return;}
    var d=repairDates();rememberRepairDates(d);google.script.run.withSuccessHandler(success).withFailureHandler(fail).previewCalendarRepairPlan(d.start,d.end);
  }
  function editRepair(){
    var d=repairDates();rememberRepairDates(d);setBusy(true);
    google.script.run.withSuccessHandler(function(result){busy=false;el('statusBox').textContent=renderObject(result)||'Editable repair board opened.';renderControls();}).withFailureHandler(fail).openCalendarRepairBoard(d.start,d.end);
  }
  function refreshState(showBusy){
    if(showBusy)setBusy(true);
    google.script.run.withSuccessHandler(function(state){busy=false;showState(state||{label:'No active job',status:'Idle'});}).withFailureHandler(fail).getPmosJobStatus();
  }
  function pause(){setBusy(true);if(selectedType==='RECONCILE_FUTURE')google.script.run.withSuccessHandler(success).withFailureHandler(fail).pauseBatchedCalendarReconcile();else google.script.run.withSuccessHandler(success).withFailureHandler(fail).pausePmosJob();}
  function startPollingIfNeeded(){
    if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
    var active=currentState&&currentState.status&&['Complete','Cancelled','Idle','Paused'].indexOf(currentState.status)<0;
    if(active||currentState.autoEnabled)pollTimer=setInterval(function(){refreshState(false);},2000);
  }
  var jobButtons=document.getElementsByClassName('job');
  for(var i=0;i<jobButtons.length;i++)jobButtons[i].onclick=function(){selectType(this.getAttribute('data-type'));};
  el('runButton').onclick=function(){runSelected(false);};
  el('autoButton').onclick=function(){runSelected(true);};
  el('previewButton').onclick=previewSelected;
  el('editButton').onclick=editRepair;
  el('pauseButton').onclick=pause;
  el('refreshButton').onclick=function(){refreshState(true);};
  el('historyButton').onclick=function(){google.script.run.withFailureHandler(fail).showPmosJobHistory();};
  el('closeButton').onclick=function(){google.script.host.close();};
  window.addEventListener('beforeunload',function(){if(pollTimer)clearInterval(pollTimer);});
  renderSelection();
  refreshState(false);
  setTimeout(function(){var buttons=document.getElementsByClassName('job');for(var i=0;i<buttons.length;i++){if(buttons[i].getAttribute('data-type')===selectedType){buttons[i].className='job selected';break;}}},0);
})();
</script>
</body>
</html>`).setWidth(930).setHeight(760);

  SpreadsheetApp.getUi().showModelessDialog(html, 'PMOS Job Engine');
}

function rememberIntegratedPmosJobType(type) {
  PropertiesService.getUserProperties()
    .setProperty('PMOS_LAST_INTEGRATED_JOB_TYPE', String(type || ''));
  return type;
}

function rememberCalendarRepairDates(startValue, endValue) {
  const start = parseRepairDate_(startValue, 'Begin date');
  const end = parseRepairDate_(endValue, 'End date');
  const properties = PropertiesService.getUserProperties();
  properties.setProperty('PMOS_LAST_REPAIR_START', Utilities.formatDate(start, PMOS.TIMEZONE, 'yyyy-MM-dd'));
  properties.setProperty('PMOS_LAST_REPAIR_END', Utilities.formatDate(end, PMOS.TIMEZONE, 'yyyy-MM-dd'));
  return {start: startValue, end: endValue};
}
