/**
 * PMOS Job Center UI.
 * Calendar Sync uses the shared runtime Job Engine and the verified immutable
 * Calendar plan. One-off tasks use their task providers.
 */
function openPmosJobEngine(initialType) {
  const selectedType = PMOS_JOB_TYPES[initialType]
    ? initialType
    : 'CALENDAR_SYNC';

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html><head><base target="_top"><style>
*{box-sizing:border-box}body{margin:0;padding:18px;font-family:Arial,sans-serif;color:#1f2937;background:#f8fafc}h2{margin:0 0 4px}p{margin:0}.muted{color:#64748b;font-size:13px}.grid{display:grid;grid-template-columns:230px 1fr;gap:14px;margin-top:16px}.panel{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px}.jobs{display:flex;flex-direction:column;gap:8px}.job{width:100%;border:2px solid #cbd5e1;border-radius:8px;background:#fff;padding:10px 11px;text-align:left;font-weight:700;cursor:pointer;color:#1f2937;transition:background .15s,border-color .15s,color .15s,box-shadow .15s}.job:hover{background:#f8fafc;border-color:#94a3b8}.job.selected{border-color:#1d4ed8;background:#dbeafe;color:#1e3a8a;box-shadow:none}.selection-note{margin:2px 0 4px;padding:8px 10px;border-radius:7px;background:#dbeafe;color:#1e40af;font-size:12px;font-weight:700}.status-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}.metric{border:1px solid #e2e8f0;border-radius:8px;padding:10px}.metric span{display:block;color:#64748b;font-size:12px}.metric strong{display:block;margin-top:3px}.summary{min-height:74px;white-space:pre-wrap;border:1px solid #e2e8f0;border-radius:8px;padding:10px;background:#f8fafc}.options{margin-top:12px;padding:10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc}.options label{display:block;margin-top:7px}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}button.action{border:0;border-radius:8px;padding:10px 13px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e2e8f0;color:#1f2937}.danger{background:#fee2e2;color:#991b1b}button:disabled{opacity:.55;cursor:default}.error{color:#b91c1c;margin-top:10px;white-space:pre-wrap}
</style></head><body>
<h2>PMOS Job Center</h2><p class="muted">Run and monitor PMOS operations.</p>
<div class="grid"><div class="panel jobs" id="jobs"></div><div class="panel">
<div class="selection-note" id="selectionNote"></div><h3 id="jobName" style="margin-top:0"></h3><p class="muted" id="jobDescription"></p>
<div class="status-grid"><div class="metric"><span>Status</span><strong id="status">Idle</strong></div><div class="metric"><span>Remaining</span><strong id="remaining">—</strong></div><div class="metric"><span>Processed operations</span><strong id="processed">0</strong></div><div class="metric"><span>Last result</span><strong id="lastRun">—</strong></div></div>
<div class="summary" id="summary">No job is currently active.</div><div class="error" id="error"></div>
<div class="options" id="calendarOptions"><b>Calendar Sync options</b><label><input type="checkbox" id="includeStartedToday"> Include events that have already started today</label><label><input type="checkbox" id="autoMode" checked> Continue automatically until complete</label></div>
<div class="actions"><button class="action primary" id="start">Start / Continue</button><button class="action secondary" id="runOnce">Run once</button><button class="action danger" id="pause">Pause</button><button class="action secondary" id="history">History</button></div>
</div></div>
<script>
const definitions=[
{type:'CALENDAR_SYNC',label:'Calendar Sync',description:'Bring Google Calendar up to date with the verified schedule in PMOS.',resumable:true},
{type:'VERIFY_CALENDAR',label:'Verify Calendar',description:'Compare the planned schedule with the PMOS registry and Google Calendar, then report any differences.',resumable:false},
{type:'CUSTOMER_SYNC',label:'Customer Sync',description:'Make sure every customer has a PMOS ID and that route records match the customer database.',resumable:false},
{type:'MAP_EXPORT',label:'Map Export',description:'Create updated map files for route layers that have changed.',resumable:false}
];
let selectedType=${JSON.stringify(selectedType)},busy=false,lastActionError='';
const $=id=>document.getElementById(id);
const server=(name,...args)=>new Promise((resolve,reject)=>{const runner=google.script.run.withSuccessHandler(resolve).withFailureHandler(error=>reject(new Error(error&&error.message?error.message:String(error))));runner[name](...args);});
function currentDefinition(){return definitions.find(item=>item.type===selectedType)||definitions[0];}
function renderJobs(){$('jobs').innerHTML=definitions.map(item=>'<button class="job'+(item.type===selectedType?' selected':'')+'" data-type="'+item.type+'" aria-pressed="'+(item.type===selectedType?'true':'false')+'">'+item.label+'</button>').join('');document.querySelectorAll('.job').forEach(button=>{button.onclick=()=>{selectedType=button.dataset.type;lastActionError='';server('rememberPmosJobType',selectedType).catch(()=>{});renderJobs();renderDefinition();if(currentDefinition().resumable){refresh();}else{showReadyState();}};});}
function renderDefinition(){const item=currentDefinition();$('selectionNote').textContent='Selected operation: '+item.label;$('jobName').textContent=item.label;$('jobDescription').textContent=item.description;$('calendarOptions').style.display=item.resumable?'block':'none';$('runOnce').style.display=item.resumable?'inline-block':'none';$('pause').style.display=item.resumable?'inline-block':'none';$('start').textContent=item.resumable?'Start / Continue':'Run';}
function setBusy(value){busy=value;['start','runOnce','pause'].forEach(id=>$(id).disabled=value);}
function showReadyState(){$('status').textContent='Ready';$('remaining').textContent='—';$('processed').textContent='—';$('lastRun').textContent='—';$('summary').textContent='Ready to run '+currentDefinition().label+'.';$('error').textContent=lastActionError;}
function renderCalendarStatus(status){const current=status||{};$('status').textContent=current.status||'Idle';$('remaining').textContent=current.remaining==null?'—':current.remaining;$('processed').textContent=String(current.processedItems||0);$('lastRun').textContent=current.lastSummary||'—';if(Number(current.remaining||0)===0&&current.status==='Complete'){$('summary').textContent='Calendar is synchronized and verified.';}else if(current.status==='Waiting'||current.status==='Waiting for Google'){$('summary').textContent='Calendar Sync saved its progress and is waiting for the next continuation.';}else if(current.status==='Running'){$('summary').textContent='Calendar Sync is running until the safe execution-time limit.';}else if(current.status==='Paused'||current.status==='Paused on error'){$('summary').textContent='Calendar Sync is paused.';}else{$('summary').textContent='Calendar Sync status: '+String(current.status||'Idle')+'.';}$('error').textContent=lastActionError||current.lastError||'';}
async function refresh(){if(!currentDefinition().resumable)return;try{renderCalendarStatus(await server('getPmosJobStatus'));}catch(error){lastActionError=error.message;$('error').textContent=lastActionError;}}
function calendarOptions(){return{includeStartedToday:$('includeStartedToday').checked};}
async function startCalendar(auto){setBusy(true);lastActionError='';$('error').textContent='';try{const status=await server('startVerifiedCalendarSyncJob',Boolean(auto),calendarOptions());renderCalendarStatus(status);}catch(error){lastActionError=error.message;$('error').textContent=lastActionError;}finally{setBusy(false);}}
async function executeTask(){setBusy(true);lastActionError='';$('error').textContent='';$('status').textContent='Running';$('summary').textContent='Running '+currentDefinition().label+'…';try{const result=await server('runPmosTask',selectedType);$('status').textContent='Complete';$('remaining').textContent='—';$('processed').textContent='—';$('lastRun').textContent='Just now';$('summary').textContent=result&&result.summary?result.summary:currentDefinition().label+' completed.';}catch(error){lastActionError=error.message;$('status').textContent='Needs attention';$('error').textContent=lastActionError;}finally{setBusy(false);}}
async function execute(){if(currentDefinition().resumable){await startCalendar($('autoMode').checked);}else{await executeTask();}}
async function pause(){setBusy(true);lastActionError='';$('error').textContent='';try{renderCalendarStatus(await server('pausePmosJob'));}catch(error){lastActionError=error.message;$('error').textContent=lastActionError;}finally{setBusy(false);}}
$('start').onclick=execute;$('runOnce').onclick=()=>startCalendar(false);$('pause').onclick=pause;$('history').onclick=()=>server('showPmosJobHistory').catch(error=>{lastActionError=error.message;$('error').textContent=lastActionError;});
renderJobs();renderDefinition();if(currentDefinition().resumable){refresh();}else{showReadyState();}setInterval(()=>{if(!busy&&currentDefinition().resumable)refresh();},5000);
</script></body></html>`).setWidth(820).setHeight(640);

  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Job Center');
}
