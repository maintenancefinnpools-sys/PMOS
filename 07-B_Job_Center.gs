/** Authoritative PMOS Operations / Job Center window. */
function openPmosJobEngine(initialType) {
  const definitions = {
    CALENDAR_STATUS: {
      label: 'Calendar Status',
      icon: '◷',
      description: 'View the current relationship between the route plan, registry, and Google Calendar.',
      mode: 'task'
    },
    VERIFY_CALENDAR: {
      label: 'Verify Calendar',
      icon: '✓',
      description: 'Check the expected schedule, registry, and Calendar for discrepancies.',
      mode: 'task'
    },
    CALENDAR_AUDIT: {
      label: 'Calendar Plan Audit',
      icon: '▣',
      description: 'Open the authoritative read-only audit and Review Session workflow.',
      mode: 'audit'
    },
    CALENDAR_SYNC: {
      label: 'Calendar Sync',
      icon: '↻',
      description: 'Execute only the approved reviewed Calendar queue using resumable processing.',
      mode: 'runtime'
    },
    CUSTOMER_SYNC: {
      label: 'Customer Database Sync',
      icon: '♙',
      description: 'Create missing customer IDs and refresh route records from Customers.',
      mode: 'task'
    },
    MAP_EXPORT: {
      label: 'Export Map Layers',
      icon: '◇',
      description: 'Create updated map-layer files for route layers that have changed.',
      mode: 'task'
    },
    CALENDAR_REPAIR: {
      label: 'Calendar Repair',
      icon: '⚒',
      description: 'Open the explicit historical repair preview/editor. Repair is separate from normal Calendar Sync.',
      mode: 'repair'
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
<!DOCTYPE html><html><head><base target="_top">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;700;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:'Mulish',Arial,sans-serif;color:#293944;background:#e5eaed}button{font:inherit}.shell{display:grid;grid-template-columns:222px minmax(0,1fr);height:100vh;min-height:620px;transition:grid-template-columns .22s ease}.shell.collapsed{grid-template-columns:46px minmax(0,1fr)}.sidebar{min-width:0;padding:14px 10px;background:#566a76;color:#fff;border-right:1px solid #455b67;display:flex;flex-direction:column;gap:14px;overflow:hidden}.brand{min-width:0;display:flex;align-items:center;gap:9px;white-space:nowrap}.brand-mark{width:38px;height:36px;display:grid;place-items:center;flex:0 0 auto}.brand-mark img{display:block;width:36px;height:34px;object-fit:contain;filter:drop-shadow(0 3px 7px rgba(0,0,0,.14))}.brand-copy strong,.brand-copy span{display:block}.brand-copy strong{font-weight:900;color:#fff}.brand-copy span{color:#c4e5f2;font-weight:700}.jobs{display:grid;gap:6px;min-width:0;width:100%}.job{width:100%;min-width:0;padding:9px 10px;border:1px solid rgba(255,255,255,.09);border-left:3px solid transparent;border-radius:9px;background:rgba(255,255,255,.10);color:#eef4f6;display:flex;align-items:center;gap:9px;text-align:left;font-weight:700;cursor:pointer;overflow:hidden}.job:hover{background:rgba(255,255,255,.16)}.job.selected{border-color:rgba(117,196,229,.32);border-left-color:#00aadb;background:rgba(1,125,177,.34);color:#fff;box-shadow:0 3px 9px rgba(35,54,64,.12)}.job-icon{width:20px;display:grid;place-items:center;flex:0 0 auto;font-size:17px}.job-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sidebar-toggle{margin-top:auto;width:100%;min-height:40px;padding:8px 10px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:rgba(255,255,255,.10);color:#eef4f6;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;cursor:pointer;white-space:nowrap}.sidebar-toggle:hover{background:rgba(255,255,255,.16);color:#fff}.toggle-icon{display:block;width:20px;height:20px;flex:0 0 auto;transition:transform .22s ease}.connection{padding-top:12px;border-top:1px solid rgba(255,255,255,.18);min-width:0;display:flex;align-items:center;gap:8px;color:#dbe8ed;white-space:nowrap}.connection-dot{width:9px;height:9px;border-radius:50%;background:#75c4e5;box-shadow:0 0 0 3px rgba(117,196,229,.13);flex:0 0 auto}.connection.disconnected .connection-dot{background:#d96b6b;box-shadow:0 0 0 3px rgba(217,107,107,.15)}.shell.collapsed .sidebar{padding-left:5px;padding-right:5px}.shell.collapsed .brand-copy,.shell.collapsed .job-label,.shell.collapsed .toggle-label,.shell.collapsed .connection-label{display:none}.shell.collapsed .brand{justify-content:center}.shell.collapsed .brand-mark{width:36px}.shell.collapsed .jobs{justify-items:center}.shell.collapsed .job,.shell.collapsed .sidebar-toggle{width:36px;padding-left:6px;padding-right:6px}.shell.collapsed .toggle-icon{transform:rotate(180deg)}.shell.collapsed .connection{justify-content:center}.workspace{min-width:0;padding:20px;background:#e5eaed;overflow:auto}.top{display:flex;align-items:flex-start;gap:14px;margin-bottom:15px}.top h2{margin:0;font-weight:900;color:#293944}.top p{margin:4px 0 0;color:#68747a}.top-actions{margin-left:auto;display:flex;gap:8px}.button{border:1px solid #c7d2d8;border-radius:8px;padding:9px 12px;background:#f2f5f6;color:#293944;font-weight:700;cursor:pointer}.button:hover{background:#e7f2f7;border-color:#75c4e5}.button.primary{border-color:#0f5470;background:#0f5470;color:#fff}.button.primary:hover{background:#017db1;border-color:#017db1}.button.danger{border-color:#d9a1a1;background:#f6e7e7;color:#8e3f3f}.button:disabled{opacity:.55;cursor:default}.status-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}.metric,.panel{position:relative;overflow:hidden;background:#f9fafb;border:1px solid #d2dade;border-radius:10px;box-shadow:0 4px 14px rgba(46,56,66,.05)}.metric{padding:13px 12px}.metric:before,.panel:before{content:'';position:absolute;inset:0 auto 0 0;width:4px;background:#0f5470}.metric:nth-child(2):before{background:#017db1}.metric:nth-child(3):before{background:#00aadb}.metric:nth-child(4):before{background:#75c4e5}.metric span{display:block;color:#68747a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}.metric strong{display:block;margin-top:5px;color:#0f5470;font-weight:900}.panel{padding:15px 15px 14px 18px}.panel-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px}.panel-head h3{margin:0;font-weight:900}.purpose{margin-top:4px;color:#68747a;line-height:1.45}.mode-badge{margin-left:auto;padding:5px 9px;border-radius:999px;background:#e4f0f5;color:#0f5470;border:1px solid #bfd9e5;font-size:12px;font-weight:700;white-space:nowrap}.summary{min-height:112px;white-space:pre-wrap;padding:12px;background:#edf1f3;border:1px solid #d2dade;border-radius:9px;color:#293944;overflow:auto}.progress-wrap{margin-top:14px}.progress-line{display:flex;justify-content:space-between;gap:10px;margin-bottom:7px;color:#68747a;font-size:12px}.progress{height:11px;overflow:hidden;background:#d9e0e3;border-radius:999px}.bar{width:0;height:100%;background:linear-gradient(90deg,#0f5470,#00aadb);border-radius:999px;transition:width .25s ease}.progress-note{min-height:15px;text-align:right}.options{display:none;margin-top:12px;padding:10px 11px;border-left:3px solid #017db1;border-radius:7px;background:#e7f2f7;color:#293944}.options .muted{display:block;margin-top:4px;color:#68747a}.error{margin-top:10px;white-space:pre-wrap;color:#9f3f3f;font-weight:700}.actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:14px}.muted{color:#68747a;font-size:13px}.hidden{display:none!important}
@media(max-width:720px){.shell{grid-template-columns:190px minmax(0,1fr)}.shell.collapsed{grid-template-columns:46px minmax(0,1fr)}.workspace{padding:12px}.status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.top,.panel-head{flex-wrap:wrap}.top-actions,.mode-badge{margin-left:0}}
@media(max-width:520px){.shell{grid-template-columns:170px minmax(0,1fr)}.shell.collapsed{grid-template-columns:46px minmax(0,1fr)}.status-grid{grid-template-columns:1fr}.actions{align-items:stretch}.actions .button{width:100%}}
</style></head><body>
<div class="shell" id="jobShell">
  <aside class="sidebar">
    <div class="brand"><span class="brand-mark"><img src="https://www.finnpools.ca/images/logo_only.png" alt="Finn Pools"></span><span class="brand-copy"><strong>PMOS</strong><span>Operations</span></span></div>
    <nav class="jobs" id="jobs" aria-label="PMOS operations"></nav>
    <button class="sidebar-toggle" id="sidebarToggle" type="button" aria-label="Hide operations panel"><svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg><span class="toggle-label">Hide panel</span></button>
    <div class="connection" id="connection"><span class="connection-dot"></span><span class="connection-label">Spreadsheet connected</span></div>
  </aside>
  <main class="workspace">
    <header class="top"><div><h2 id="jobName">PMOS Operations</h2><p id="jobDescription">Select an operation, review its purpose, then run it.</p></div><div class="top-actions"><button class="button" id="historyTop">Job History</button><button class="button" id="closeTop">Close</button></div></header>
    <section class="status-grid" aria-label="Operation status">
      <div class="metric"><span>Status</span><strong id="status">Ready</strong></div>
      <div class="metric"><span>Remaining</span><strong id="remaining">—</strong></div>
      <div class="metric"><span>Processed operations</span><strong id="processed">—</strong></div>
      <div class="metric"><span>Progress</span><strong id="progressText">0%</strong></div>
    </section>
    <section class="panel">
      <div class="panel-head"><div><h3 id="detailTitle">Operation details</h3><div class="purpose" id="purposeCopy">Select an operation.</div></div><span class="mode-badge" id="modeBadge">Ready</span></div>
      <div class="summary" id="summary">Select an operation.</div>
      <div class="progress-wrap"><div class="progress-line"><span>Execution progress</span><span id="progressNote"></span></div><div class="progress"><div class="bar" id="progressBar"></div></div></div>
      <div class="error" id="error"></div>
      <div class="options" id="calendarOptions"><b>Reviewed Calendar Sync</b><span class="muted">The Calendar, date range, decisions, and operation list are fixed by the completed Plan Audit / Review Session.</span></div>
      <div class="actions"><button class="button primary" id="start">Run</button><button class="button danger" id="pause" style="display:none">Pause</button><button class="button" id="refresh">Refresh</button><button class="button" id="history">Job History</button><button class="button" id="close">Close</button></div>
    </section>
  </main>
</div>
<script>
(function(){
const definitions=${JSON.stringify(clientDefinitions)};
let selectedType=${JSON.stringify(selectedType)},busy=false,currentState={},lastError='',activeRuntimeStartedAt=0;
const $=id=>document.getElementById(id);
function setConnectionState(connected){const node=$('connection');if(!node)return;node.classList.toggle('disconnected',!connected);const label=node.querySelector('.connection-label');if(label)label.textContent=connected?'Spreadsheet connected':'Spreadsheet connection problem';}\nfunction server(name,...args){return new Promise((resolve,reject)=>{const runner=google.script.run.withSuccessHandler(payload=>{setConnectionState(true);if(payload&&payload.ok===false){reject(new Error(payload.error||'Unknown PMOS server error'));return;}resolve(payload&&payload.ok===true?payload.result:payload);}).withFailureHandler(error=>{setConnectionState(false);reject(new Error(error&&error.message?error.message:String(error)));});switch(name){case'remember':return runner.rememberPmosJobType(args[0]);case'status':return runner.getReviewedCalendarSyncJobCenterStatus();case'task':return runner.runPmosTask(args[0]);case'audit':return runner.showFreshCalendarAuditTaskWindow();case'startSync':return runner.startReviewedCalendarSyncJobCenterExecution();case'resumeSync':return runner.resumeReviewedCalendarSyncJobCenterExecution();case'retrySync':return runner.retryReviewedCalendarSyncJobCenterExecution();case'pauseSync':return runner.pauseReviewedCalendarSyncJobCenterExecution();case'repair':return runner.showIntegratedPmosJobEngine('CALENDAR_REPAIR');case'history':return runner.showPmosJobHistoryWindow();default:return reject(new Error('Unsupported PMOS server action: '+name));}});}
function definition(){return definitions.find(item=>item.type===selectedType)||definitions[0];}
function isProcessing(state){return ['Running','Scheduled','Waiting','Waiting for Google'].indexOf(String(state&&state.status||''))>=0;}
function isPaused(state){return String(state&&state.status||'')==='Paused';}
function isFailed(state){return String(state&&state.status||'')==='Paused on error';}
function setProgress(value){value=Math.max(0,Math.min(100,Number(value||0)));$('progressBar').style.width=value+'%';$('progressText').textContent=Math.round(value)+'%';}
function setBusy(value){busy=value;renderControls();}
function renderActiveRuntimeClock(){if(!busy||!activeRuntimeStartedAt||definition().mode!=='runtime')return;const elapsed=formatElapsed(new Date(activeRuntimeStartedAt).toISOString(),'');$('status').textContent='Running';$('progressNote').textContent=(elapsed?elapsed+' • ':'')+'Immediate worker active';}
function showError(error){lastError=error&&error.message?error.message:String(error||'');$('error').textContent=lastError;}
function clearError(){lastError='';$('error').textContent='';}
function renderJobs(){$('jobs').innerHTML=definitions.map(item=>'<button class="job'+(item.type===selectedType?' selected':'')+'" data-type="'+item.type+'"><span class="job-icon" aria-hidden="true">'+(item.icon||'•')+'</span><span class="job-label">'+item.label+'</span></button>').join('');document.querySelectorAll('.job').forEach(button=>{button.onclick=()=>{selectedType=button.dataset.type;currentState={};clearError();server('remember',selectedType).catch(()=>{});renderJobs();renderReady();if(definition().mode==='runtime')refreshRuntime(false);};});}
function renderReady(){const item=definition();$('jobName').textContent=item.label;$('jobDescription').textContent=item.description;$('detailTitle').textContent=item.label;$('purposeCopy').textContent=item.description;$('modeBadge').textContent=item.mode==='runtime'?'Reviewed queue':item.mode==='audit'?'Review workflow':item.mode==='repair'?'Manual tool':'Operation';$('calendarOptions').style.display=item.mode==='runtime'?'block':'none';$('status').textContent='Ready';$('remaining').textContent='—';$('processed').textContent='—';$('summary').textContent=item.mode==='audit'?'Open the Calendar Plan Audit to choose the Calendar/date range and complete review decisions.':item.mode==='repair'?'Open the explicit Calendar Repair tool.':'Ready to run '+item.label+'.';$('progressNote').textContent='';setProgress(0);renderControls();}
function renderControls(){const item=definition(),runtime=item.mode==='runtime',processing=runtime&&isProcessing(currentState),paused=runtime&&isPaused(currentState),failed=runtime&&isFailed(currentState);if(runtime)$('start').textContent=failed?'Retry After Recovery':paused?'Resume':'Start / Continue';else if(item.mode==='audit')$('start').textContent='Open Audit';else if(item.mode==='repair')$('start').textContent='Open Repair';else $('start').textContent='Run';$('start').disabled=busy||processing||(runtime&&String(currentState.status||'')==='Complete');$('pause').style.display=processing?'inline-block':'none';$('pause').disabled=busy;$('refresh').disabled=busy;}
function formatElapsed(startedAt,completedAt){if(!startedAt)return'';const start=new Date(startedAt).getTime(),end=completedAt?new Date(completedAt).getTime():Date.now();if(!Number.isFinite(start)||!Number.isFinite(end))return'';let seconds=Math.max(0,Math.floor((end-start)/1000));if(seconds<60)return seconds+'s';const hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60),remaining=seconds%60;return hours?hours+'h '+String(minutes).padStart(2,'0')+'m '+String(remaining).padStart(2,'0')+'s':minutes+'m '+String(remaining).padStart(2,'0')+'s';}
function renderRuntime(state){currentState=state||{};const total=Number(currentState.originalTotal||0),remaining=currentState.remaining==null?null:Number(currentState.remaining),percent=currentState.status==='Complete'?100:(total>0&&remaining!=null?Math.round((total-remaining)/total*100):0);$('status').textContent=currentState.status||'Not prepared';$('remaining').textContent=remaining==null?'—':remaining;$('processed').textContent=String(currentState.processedItems||0);setProgress(percent);const elapsed=formatElapsed(currentState.startedAt,currentState.completedAt);$('progressNote').textContent=(elapsed?elapsed+' • ':'')+Math.round(percent)+'%';$('summary').textContent=currentState.lastSummary||((currentState.status==='Not prepared')?'Run Calendar Plan Audit and complete review before starting Sync.':'');$('error').textContent=lastError||currentState.lastError||'';renderControls();}
async function refreshRuntime(showFeedback){try{if(showFeedback)setBusy(true);renderRuntime(await server('status'));}catch(error){showError(error);}finally{if(showFeedback)setBusy(false);}}
async function runTask(){try{setBusy(true);clearError();$('status').textContent='Running';$('summary').textContent='Running '+definition().label+'…';const result=await server('task',selectedType);$('status').textContent='Complete';$('summary').textContent=result&&result.summary?result.summary:'Operation completed.';setProgress(100);}catch(error){$('status').textContent='Needs attention';showError(error);}finally{setBusy(false);}}
async function openAudit(){try{setBusy(true);clearError();await server('audit');$('status').textContent='Audit opened';$('summary').textContent='Complete the Calendar Plan Audit and Review Session in the opened window.';}catch(error){showError(error);}finally{setBusy(false);}}
async function openRepair(){try{setBusy(true);clearError();await server('repair');$('status').textContent='Repair opened';$('summary').textContent='Calendar Repair opened in a separate window.';}catch(error){showError(error);}finally{setBusy(false);}}
async function runRuntime(){try{activeRuntimeStartedAt=Date.now();setBusy(true);clearError();renderActiveRuntimeClock();const action=isFailed(currentState)?'retrySync':isPaused(currentState)?'resumeSync':'startSync';const state=await server(action);renderRuntime(state);}catch(error){showError(error);}finally{activeRuntimeStartedAt=0;setBusy(false);}}
async function pauseRuntime(){try{setBusy(true);renderRuntime(await server('pauseSync'));}catch(error){showError(error);}finally{setBusy(false);}}
async function openHistory(){try{setBusy(true);await server('history');}catch(error){showError(error);}finally{setBusy(false);}}
$('start').onclick=function(){const mode=definition().mode;if(mode==='runtime')return runRuntime();if(mode==='audit')return openAudit();if(mode==='repair')return openRepair();return runTask();};$('pause').onclick=pauseRuntime;$('refresh').onclick=function(){if(definition().mode==='runtime')return refreshRuntime(true);renderReady();};$('history').onclick=openHistory;$('historyTop').onclick=openHistory;$('close').onclick=function(){google.script.host.close();};$('closeTop').onclick=function(){google.script.host.close();};$('sidebarToggle').onclick=function(){const shell=$('jobShell'),collapsed=shell.classList.toggle('collapsed'),label=this.querySelector('.toggle-label');if(label)label.textContent=collapsed?'Show panel':'Hide panel';this.setAttribute('aria-label',collapsed?'Show operations panel':'Hide operations panel');};
setConnectionState(true);renderJobs();renderReady();if(definition().mode==='runtime')refreshRuntime(false);setInterval(renderActiveRuntimeClock,1000);setInterval(function(){if(!busy&&definition().mode==='runtime')refreshRuntime(false);},2000);
})();
</script></body></html>`).setWidth(850).setHeight(680);

  SpreadsheetApp.getUi().showModelessDialog(html, 'PMOS Operations');
}
