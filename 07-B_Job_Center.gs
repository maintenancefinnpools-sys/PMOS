/** Authoritative PMOS Operations / Job Center window. */
function openPmosJobEngine(initialType) {
  const definitions = {
    CALENDAR_STATUS: {
      label: 'Calendar Status',
      description: 'View the current relationship between the route plan, registry, and Google Calendar.',
      mode: 'task'
    },
    CALENDAR_AUDIT: {
      label: 'Calendar Plan Audit',
      description: 'Open the authoritative read-only audit and Review Session workflow.',
      mode: 'audit'
    },
    VERIFY_CALENDAR: {
      label: 'Verify Calendar',
      description: 'Check the expected schedule, registry, and Calendar for discrepancies.',
      mode: 'task'
    },
    CALENDAR_SYNC: {
      label: 'Calendar Sync',
      description: 'Execute only the approved reviewed Calendar queue using resumable processing.',
      mode: 'runtime'
    },
    CALENDAR_REPAIR: {
      label: 'Calendar Repair',
      description: 'Open the explicit historical repair preview/editor. Repair is separate from normal Calendar Sync.',
      mode: 'repair'
    },
    CUSTOMER_SYNC: {
      label: 'Customer Database Sync',
      description: 'Create missing customer IDs and refresh route records from Customers.',
      mode: 'task'
    },
    MAP_EXPORT: {
      label: 'Export Map Layers',
      description: 'Create updated map-layer files for route layers that have changed.',
      mode: 'task'
    }
  };

  const remembered = PropertiesService.getUserProperties()
    .getProperty('PMOS_LAST_JOB_TYPE') || '';
  const selectedType = definitions[initialType]
    ? initialType
    : definitions[remembered]
      ? remembered
      : 'CALENDAR_STATUS';

  const clientDefinitions = Object.keys(definitions).map(function(type) {
    return Object.assign({type:type}, definitions[type]);
  });

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{margin:0;padding:18px;font-family:Arial,sans-serif;color:#1f2937;background:#fff}h2{margin:0 0 4px}.muted{color:#64748b;font-size:13px}.grid{display:grid;grid-template-columns:245px 1fr;gap:14px;margin-top:16px}.panel{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px}.jobs{display:flex;flex-direction:column;gap:7px}.job{width:100%;border:2px solid #e2e8f0;border-radius:9px;background:#fff;padding:10px 11px;text-align:left;font-weight:700;cursor:pointer;color:#1f2937}.job:hover{background:#f8fafc}.job.selected{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}.purpose{min-height:58px;color:#374151;line-height:1.45}.status-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:13px 0}.metric{border:1px solid #e2e8f0;border-radius:8px;padding:9px}.metric span{display:block;color:#64748b;font-size:12px}.metric strong{display:block;margin-top:3px}.summary{min-height:120px;white-space:pre-wrap;border:1px solid #e2e8f0;border-radius:8px;padding:10px;background:#f8fafc;overflow:auto}.options{display:none;margin-top:11px;padding:10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}button.action{border:0;border-radius:8px;padding:10px 13px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e2e8f0;color:#1f2937}.danger{background:#fee2e2;color:#991b1b}.success{background:#dcfce7!important;color:#166534!important}button:disabled{opacity:.55;cursor:default}.error{color:#b91c1c;margin-top:10px;white-space:pre-wrap}.progress{height:13px;margin-top:10px;overflow:hidden;background:#e5e7eb;border-radius:8px}.bar{width:0;height:100%;background:#2563eb;transition:width .25s ease}.progress-note{font-size:12px;color:#64748b;margin-top:7px;min-height:15px;text-align:right}
</style></head><body>
<h2>PMOS Operations</h2><div class="muted">Select an operation, review its purpose, then run it.</div>
<div class="grid"><div class="panel jobs" id="jobs"></div><div class="panel">
<h3 id="jobName" style="margin-top:0">Purpose</h3><div class="purpose" id="jobDescription"></div>
<div class="status-grid"><div class="metric"><span>Status</span><strong id="status">Ready</strong></div><div class="metric"><span>Remaining</span><strong id="remaining">—</strong></div><div class="metric"><span>Processed operations</span><strong id="processed">—</strong></div><div class="metric"><span>Progress</span><strong id="progressText">0%</strong></div></div>
<div class="summary" id="summary">Select an operation.</div><div class="progress"><div class="bar" id="progressBar"></div></div><div id="progressNote" class="progress-note"></div><div class="error" id="error"></div>
<div class="options" id="calendarOptions"><b>Reviewed Calendar Sync</b><div class="muted" style="margin-top:6px">The Calendar, date range, decisions, and operation list are fixed by the completed Plan Audit / Review Session.</div></div>
<div class="actions"><button class="action primary" id="start">Run</button><button class="action danger" id="pause" style="display:none">Pause</button><button class="action secondary" id="refresh">Refresh</button><button class="action secondary" id="history">Job History</button><button class="action secondary" id="close">Close</button></div>
</div></div>
<script>
(function(){
const definitions=${JSON.stringify(clientDefinitions)};
let selectedType=${JSON.stringify(selectedType)},busy=false,currentState={},lastError='';
const $=id=>document.getElementById(id);
function server(name,...args){return new Promise((resolve,reject)=>{const runner=google.script.run.withSuccessHandler(payload=>{if(payload&&payload.ok===false){reject(new Error(payload.error||'Unknown PMOS server error'));return;}resolve(payload&&payload.ok===true?payload.result:payload);}).withFailureHandler(error=>reject(new Error(error&&error.message?error.message:String(error))));switch(name){case'remember':return runner.rememberPmosJobType(args[0]);case'status':return runner.getReviewedCalendarSyncJobCenterStatus();case'task':return runner.runPmosTask(args[0]);case'audit':return runner.showFreshCalendarAuditTaskWindow();case'startSync':return runner.startReviewedCalendarSyncJobCenterExecution();case'resumeSync':return runner.resumeReviewedCalendarSyncJobCenterExecution();case'retrySync':return runner.retryReviewedCalendarSyncJobCenterExecution();case'pauseSync':return runner.pauseReviewedCalendarSyncJobCenterExecution();case'repair':return runner.showIntegratedPmosJobEngine('CALENDAR_REPAIR');case'history':return runner.showPmosJobHistoryWindow();default:return reject(new Error('Unsupported PMOS server action: '+name));}});}
function definition(){return definitions.find(item=>item.type===selectedType)||definitions[0];}
function isProcessing(state){return ['Running','Scheduled','Waiting','Waiting for Google'].indexOf(String(state&&state.status||''))>=0;}
function isPaused(state){return String(state&&state.status||'')==='Paused';}
function isFailed(state){return String(state&&state.status||'')==='Paused on error';}
function setProgress(value){value=Math.max(0,Math.min(100,Number(value||0)));$('progressBar').style.width=value+'%';$('progressText').textContent=Math.round(value)+'%';}
function setBusy(value){busy=value;renderControls();}
function showError(error){lastError=error&&error.message?error.message:String(error||'');$('error').textContent=lastError;}
function clearError(){lastError='';$('error').textContent='';}
function renderJobs(){$('jobs').innerHTML=definitions.map(item=>'<button class="job'+(item.type===selectedType?' selected':'')+'" data-type="'+item.type+'">'+item.label+'</button>').join('');document.querySelectorAll('.job').forEach(button=>{button.onclick=()=>{selectedType=button.dataset.type;currentState={};clearError();server('remember',selectedType).catch(()=>{});renderJobs();renderReady();if(definition().mode==='runtime')refreshRuntime(false);};});}
function renderReady(){const item=definition();$('jobName').textContent=item.label;$('jobDescription').textContent=item.description;$('calendarOptions').style.display=item.mode==='runtime'?'block':'none';$('status').textContent='Ready';$('remaining').textContent='—';$('processed').textContent='—';$('summary').textContent=item.mode==='audit'?'Open the Calendar Plan Audit to choose the Calendar/date range and complete review decisions.':item.mode==='repair'?'Open the explicit Calendar Repair tool.':'Ready to run '+item.label+'.';$('progressNote').textContent='';setProgress(0);renderControls();}
function renderControls(){const item=definition(),runtime=item.mode==='runtime',processing=runtime&&isProcessing(currentState),paused=runtime&&isPaused(currentState),failed=runtime&&isFailed(currentState);if(runtime)$('start').textContent=failed?'Retry After Recovery':paused?'Resume':'Start / Continue';else if(item.mode==='audit')$('start').textContent='Open Audit';else if(item.mode==='repair')$('start').textContent='Open Repair';else $('start').textContent='Run';$('start').disabled=busy||processing||(runtime&&String(currentState.status||'')==='Complete');$('pause').style.display=processing?'inline-block':'none';$('pause').disabled=busy;$('refresh').disabled=busy;}
function formatElapsed(startedAt,completedAt){if(!startedAt)return'';const start=new Date(startedAt).getTime(),end=completedAt?new Date(completedAt).getTime():Date.now();if(!Number.isFinite(start)||!Number.isFinite(end))return'';let seconds=Math.max(0,Math.floor((end-start)/1000));if(seconds<60)return seconds+'s';const hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60),remaining=seconds%60;return hours?hours+'h '+String(minutes).padStart(2,'0')+'m '+String(remaining).padStart(2,'0')+'s':minutes+'m '+String(remaining).padStart(2,'0')+'s';}
function renderRuntime(state){currentState=state||{};const total=Number(currentState.originalTotal||0),remaining=currentState.remaining==null?null:Number(currentState.remaining),percent=currentState.status==='Complete'?100:(total>0&&remaining!=null?Math.round((total-remaining)/total*100):0);$('status').textContent=currentState.status||'Not prepared';$('remaining').textContent=remaining==null?'—':remaining;$('processed').textContent=String(currentState.processedItems||0);setProgress(percent);const elapsed=formatElapsed(currentState.startedAt,currentState.completedAt);$('progressNote').textContent=(elapsed?elapsed+' • ':'')+Math.round(percent)+'%';$('summary').textContent=currentState.lastSummary||((currentState.status==='Not prepared')?'Run Calendar Plan Audit and complete review before starting Sync.':'');$('error').textContent=lastError||currentState.lastError||'';renderControls();}
async function refreshRuntime(showFeedback){try{if(showFeedback)setBusy(true);renderRuntime(await server('status'));}catch(error){showError(error);}finally{if(showFeedback)setBusy(false);}}
async function runTask(){try{setBusy(true);clearError();$('status').textContent='Running';$('summary').textContent='Running '+definition().label+'…';const result=await server('task',selectedType);$('status').textContent='Complete';$('summary').textContent=result&&result.summary?result.summary:'Operation completed.';setProgress(100);}catch(error){$('status').textContent='Needs attention';showError(error);}finally{setBusy(false);}}
async function openAudit(){try{setBusy(true);clearError();await server('audit');$('status').textContent='Audit opened';$('summary').textContent='Complete the Calendar Plan Audit and Review Session in the opened window.';}catch(error){showError(error);}finally{setBusy(false);}}
async function openRepair(){try{setBusy(true);clearError();await server('repair');$('status').textContent='Repair opened';$('summary').textContent='Calendar Repair opened in a separate window.';}catch(error){showError(error);}finally{setBusy(false);}}
async function runRuntime(){try{setBusy(true);clearError();const action=isFailed(currentState)?'retrySync':isPaused(currentState)?'resumeSync':'startSync';const state=await server(action);renderRuntime(state);}catch(error){showError(error);}finally{setBusy(false);}}
async function pauseRuntime(){try{setBusy(true);renderRuntime(await server('pauseSync'));}catch(error){showError(error);}finally{setBusy(false);}}
async function openHistory(){try{setBusy(true);await server('history');}catch(error){showError(error);}finally{setBusy(false);}}
$('start').onclick=function(){const mode=definition().mode;if(mode==='runtime')return runRuntime();if(mode==='audit')return openAudit();if(mode==='repair')return openRepair();return runTask();};$('pause').onclick=pauseRuntime;$('refresh').onclick=function(){if(definition().mode==='runtime')return refreshRuntime(true);renderReady();};$('history').onclick=openHistory;$('close').onclick=function(){google.script.host.close();};
renderJobs();renderReady();if(definition().mode==='runtime')refreshRuntime(false);setInterval(function(){if(!busy&&definition().mode==='runtime')refreshRuntime(false);},2000);
})();
</script></body></html>`).setWidth(850).setHeight(680);

  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Operations');
}

function cancelPmosRuntimePauseRequest_(autoMode, options) {
  return resumeReviewedCalendarSyncJobCenterExecution_();
}

function showPmosJobEngineFor_(type) {
  if (type === 'CALENDAR_SYNC') {
    const state = readReviewedCalendarSyncState_();
    if (!state || !state.planId) {
      showFreshCalendarAuditTaskWindow();
      return;
    }
  }
  openPmosJobEngine(type);
}

function startCalendarSyncJobFromMenu() {
  showPmosJobEngineFor_('CALENDAR_SYNC');
}

function startVerifyCalendarJobFromMenu() {
  openPmosJobEngine('VERIFY_CALENDAR');
}

function startCustomerSyncJobFromMenu() {
  openPmosJobEngine('CUSTOMER_SYNC');
}

function startMapExportJobFromMenu() {
  openPmosJobEngine('MAP_EXPORT');
}
