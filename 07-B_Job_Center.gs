/**
 * Authoritative PMOS Operations window.
 *
 * This is the only module allowed to define openPmosJobEngine(). Long-running
 * Calendar Sync uses the shared runtime worker. Other operations use their
 * established task or editor entry points.
 */
function openPmosJobEngine(initialType) {
  const allowed = {
    CALENDAR_STATUS: true,
    CALENDAR_AUDIT: true,
    VERIFY_CALENDAR: true,
    CALENDAR_SYNC: true,
    CALENDAR_REPAIR: true,
    CUSTOMER_SYNC: true,
    MAP_EXPORT: true
  };
  const selectedType = allowed[initialType] ? initialType : 'CALENDAR_STATUS';

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{margin:0;padding:18px;font-family:Arial,sans-serif;color:#1f2937;background:#fff}h2{margin:0 0 4px}.muted{color:#64748b;font-size:13px}.grid{display:grid;grid-template-columns:245px 1fr;gap:14px;margin-top:16px}.panel{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px}.jobs{display:flex;flex-direction:column;gap:7px}.job{width:100%;border:2px solid #e2e8f0;border-radius:9px;background:#fff;padding:10px 11px;text-align:left;font-weight:700;cursor:pointer;color:#1f2937}.job:hover{background:#f8fafc}.job.selected{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}.purpose{min-height:54px;color:#374151;line-height:1.45}.status-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:13px 0}.metric{border:1px solid #e2e8f0;border-radius:8px;padding:9px}.metric span{display:block;color:#64748b;font-size:12px}.metric strong{display:block;margin-top:3px}.summary{min-height:110px;white-space:pre-wrap;border:1px solid #e2e8f0;border-radius:8px;padding:10px;background:#f8fafc;overflow:auto}.options{display:none;margin-top:11px;padding:10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc}.options label{display:block;margin-top:7px}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}button.action{border:0;border-radius:8px;padding:10px 13px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e2e8f0;color:#1f2937}.danger{background:#fee2e2;color:#991b1b}button:disabled{opacity:.55;cursor:default}.error{color:#b91c1c;margin-top:10px;white-space:pre-wrap}.progress{height:13px;margin-top:10px;overflow:hidden;background:#e5e7eb;border-radius:8px}.bar{width:0;height:100%;background:#2563eb;transition:width .25s ease}
</style></head><body>
<h2>PMOS Operations</h2><div class="muted">Select an operation, review its purpose, then run it.</div>
<div class="grid"><div class="panel jobs" id="jobs"></div><div class="panel">
<h3 id="jobName" style="margin-top:0">Purpose</h3><div class="purpose" id="jobDescription"></div>
<div class="status-grid"><div class="metric"><span>Status</span><strong id="status">Ready</strong></div><div class="metric"><span>Remaining</span><strong id="remaining">—</strong></div><div class="metric"><span>Processed operations</span><strong id="processed">—</strong></div><div class="metric"><span>Progress</span><strong id="progressText">0%</strong></div></div>
<div class="summary" id="summary">Select an operation.</div><div class="progress"><div class="bar" id="progressBar"></div></div><div class="error" id="error"></div>
<div class="options" id="calendarOptions"><b>Calendar Sync options</b><label><input type="checkbox" id="includeStartedToday"> Include events that have already started today</label><label><input type="checkbox" id="autoMode" checked> Continue automatically until complete</label></div>
<div class="actions"><button class="action primary" id="start">Run</button><button class="action danger" id="pause" style="display:none">Pause</button><button class="action secondary" id="refresh">Refresh</button><button class="action secondary" id="history">Job History</button><button class="action secondary" id="close">Close</button></div>
</div></div>
<script>
(function(){
const definitions=[
{type:'CALENDAR_STATUS',label:'Calendar Status',description:'View the current relationship between the route plan, registry, and Google Calendar.',mode:'task'},
{type:'CALENDAR_AUDIT',label:'Calendar Plan Audit',description:'Build and validate the exact Calendar Sync plan, then review any errors, warnings, or suggested deletions.',mode:'task'},
{type:'VERIFY_CALENDAR',label:'Verify Calendar',description:'Check the expected schedule, registry, and Calendar for discrepancies.',mode:'task'},
{type:'CALENDAR_SYNC',label:'Calendar Sync',description:'Apply the verified PMOS schedule to Google Calendar using resumable time-limited execution.',mode:'runtime'},
{type:'CALENDAR_REPAIR',label:'Calendar Repair',description:'Open the historical repair preview and editor for missing or duplicate Calendar events.',mode:'repair'},
{type:'CUSTOMER_SYNC',label:'Customer Database Sync',description:'Create missing customer IDs and update route records from the customer database.',mode:'task'},
{type:'MAP_EXPORT',label:'Export Map Layers',description:'Create updated map-layer files for route layers that have changed.',mode:'task'}
];
let selectedType=${JSON.stringify(selectedType)},busy=false,currentState={},lastError='';
const $=id=>document.getElementById(id);
const server=(name,...args)=>new Promise((resolve,reject)=>{const runner=google.script.run.withSuccessHandler(resolve).withFailureHandler(error=>reject(new Error(error&&error.message?error.message:String(error))));runner[name](...args);});
function definition(){return definitions.find(item=>item.type===selectedType)||definitions[0];}
function isProcessing(state){return Boolean(state&&state.type&&['Running','Waiting','Waiting for Google'].indexOf(String(state.status||''))>=0);}
function isPausing(state){return String(state&&state.status||'')==='Pausing';}
function renderJobs(){$('jobs').innerHTML=definitions.map(item=>'<button class="job'+(item.type===selectedType?' selected':'')+'" data-type="'+item.type+'">'+item.label+'</button>').join('');document.querySelectorAll('.job').forEach(button=>{button.onclick=()=>{selectedType=button.dataset.type;lastError='';server('rememberPmosJobType',selectedType).catch(()=>{});renderJobs();renderDefinition();if(definition().mode==='runtime')refreshRuntime();else showReady();};});}
function renderDefinition(){const item=definition(),runtime=item.mode==='runtime',processing=runtime&&isProcessing(currentState),pausing=runtime&&isPausing(currentState);$('jobName').textContent=item.label;$('jobDescription').textContent=item.description;$('calendarOptions').style.display=runtime?'block':'none';$('start').textContent=runtime?(pausing?'Cancel Pause':'Start / Continue'):item.mode==='repair'?'Open Repair':'Run';$('start').disabled=busy||processing;$('pause').style.display=processing||pausing?'inline-block':'none';$('pause').textContent=pausing?'Pause Requested':'Pause';$('pause').disabled=busy||pausing;}
function setBusy(value){busy=value;$('refresh').disabled=value;renderDefinition();}
function showReady(){$('status').textContent='Ready';$('remaining').textContent='—';$('processed').textContent='—';setProgress(0);$('summary').textContent='Ready to run '+definition().label+'.';$('error').textContent=lastError;renderDefinition();}
function setProgress(percent){const value=Math.max(0,Math.min(100,Number(percent||0)));$('progressBar').style.width=value+'%';$('progressText').textContent=Math.round(value)+'%';}
function renderRuntime(state){currentState=state||{};const total=Number(currentState.originalTotal||0),remaining=currentState.remaining==null?null:Number(currentState.remaining),percent=currentState.status==='Complete'?100:(total>0&&remaining!=null?Math.round((total-remaining)/total*100):0);$('status').textContent=currentState.status||'Idle';$('remaining').textContent=remaining==null?'—':remaining;$('processed').textContent=String(currentState.processedItems||0);setProgress(percent);$('summary').textContent=currentState.lastSummary||('Calendar Sync status: '+String(currentState.status||'Idle')+'.');$('error').textContent=lastError||currentState.lastError||'';renderDefinition();}
async function refreshRuntime(){try{renderRuntime(await server('getPmosJobStatus'));}catch(error){lastError=error.message;$('error').textContent=lastError;}}
async function runTask(){setBusy(true);lastError='';$('error').textContent='';$('status').textContent='Running';$('summary').textContent='Running '+definition().label+'…';try{const result=await server('runPmosTask',selectedType);$('status').textContent='Complete';$('remaining').textContent='—';$('processed').textContent='—';setProgress(100);$('summary').textContent=result&&result.summary?result.summary:'Operation completed.';}catch(error){lastError=error.message;$('status').textContent='Needs attention';$('error').textContent=lastError;}finally{setBusy(false);}}
async function runRuntime(){setBusy(true);lastError='';$('error').textContent='';try{if(isPausing(currentState)){renderRuntime(await server('cancelPmosRuntimePauseRequest_',$('autoMode').checked,{includeStartedToday:$('includeStartedToday').checked}));return;}if(isProcessing(currentState))return;renderRuntime(await server('startVerifiedCalendarSyncJob',$('autoMode').checked,{includeStartedToday:$('includeStartedToday').checked}));}catch(error){lastError=error.message;$('error').textContent=lastError;}finally{setBusy(false);}}
async function openRepair(){setBusy(true);try{await server('showIntegratedPmosJobEngine','CALENDAR_REPAIR');google.script.host.close();}catch(error){lastError=error.message;$('error').textContent=lastError;setBusy(false);}}
async function execute(){const mode=definition().mode;if(mode==='runtime')return runRuntime();if(mode==='repair')return openRepair();return runTask();}
async function pause(){setBusy(true);try{renderRuntime(await server('pausePmosJob'));}catch(error){lastError=error.message;$('error').textContent=lastError;}finally{setBusy(false);}}
$('start').onclick=execute;$('pause').onclick=pause;$('refresh').onclick=()=>definition().mode==='runtime'?refreshRuntime():showReady();$('history').onclick=()=>server('showPmosJobHistory').catch(error=>{$('error').textContent=error.message;});$('close').onclick=()=>google.script.host.close();
renderJobs();renderDefinition();if(definition().mode==='runtime')refreshRuntime();else showReady();setInterval(()=>{if(!busy&&definition().mode==='runtime')refreshRuntime();},5000);
})();
</script></body></html>`).setWidth(850).setHeight(680);

  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Operations');
}

function cancelPmosRuntimePauseRequest_(autoMode, options) {
  const state = readPmosJobState_();
  if (!state) return getPmosJobStatus();

  if (String(state.status || '') === 'Paused') {
    return startVerifiedCalendarSyncJob(autoMode, options || {});
  }

  if (String(state.status || '') !== 'Pausing') {
    return getPmosJobStatus();
  }

  state.pauseRequested = false;
  state.autoEnabled = Boolean(autoMode);
  state.status = 'Running';
  state.nextRunAt = '';
  state.lastError = '';
  state.lastSummary = 'Pause request cancelled. Calendar Sync is continuing.';
  writePmosJobState_(state);
  return getPmosJobStatus();
}

function showPmosJobEngineFor_(type) {
  const auditRequired = type === 'CALENDAR_SYNC';
  if (auditRequired) {
    const audit = runVerifiedCalendarPlanAuditReadOnly_();
    if (!audit.canSync) {
      showCalendarAuditTaskWindow();
      return;
    }
  }
  openPmosJobEngine(type);
}

function startCalendarSyncJobFromMenu() { showPmosJobEngineFor_('CALENDAR_SYNC'); }
function startVerifyCalendarJobFromMenu() { openPmosJobEngine('VERIFY_CALENDAR'); }
function startCustomerSyncJobFromMenu() { openPmosJobEngine('CUSTOMER_SYNC'); }
function startMapExportJobFromMenu() { openPmosJobEngine('MAP_EXPORT'); }
