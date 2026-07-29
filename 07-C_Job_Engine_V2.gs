/**
 * PMOS Job Engine V2.
 * Keeps the existing resumable backend while correcting calendar targeting,
 * button state, preflight totals, and visible overall progress.
 */
function openIntegratedCalendarSyncFromAuditV2() {
  return showPmosJobEngineV2('CALENDAR_SYNC');
}

function showPmosJobEngineForV2_(type) {
  if (!PMOS_JOB_TYPES[type]) throw new Error(`Unknown PMOS job type: ${type}`);
  if (type === 'CALENDAR_SYNC' || type === 'CALENDAR_REBUILD') {
    const audit = runCalendarPlanAudit_();
    if (!audit.canSync) {
      showCalendarPlanAudit();
      return;
    }
  }
  return showPmosJobEngineV2(type);
}

function getPmosJobStatusV2() {
  const status = getPmosJobStatus();
  if (status.type === 'CALENDAR_SYNC' || status.type === 'CALENDAR_REBUILD') {
    try {
      status.targetCalendarName = getRecurringCalendarSettings_().calendarName;
    } catch (error) {
      status.targetCalendarName = '';
      status.lastError = status.lastError || String(error && error.message ? error.message : error);
    }
  }
  return status;
}

function preparePmosJobV2_(type) {
  if (type !== 'CALENDAR_SYNC' && type !== 'CALENDAR_REBUILD') return;

  const settings = getRecurringCalendarSettings_();
  validateRecurringCalendarSettings_(settings);
  const preview = previewCalendarChanges();
  const plannedTotal =
    Number(preview.creates || 0) +
    Number(preview.updates || 0) +
    Number(preview.deletes || 0);

  let state = readPmosJobState_();
  const reusable = state && state.type === type &&
    state.status !== 'Complete' && state.status !== 'Cancelled';

  if (!reusable) state = newPmosJobState_(type);

  state.targetCalendarName = settings.calendarName;
  state.originalTotal = plannedTotal;
  state.remaining = plannedTotal;
  state.processedItems = reusable ? Number(state.processedItems || 0) : 0;
  state.lastSummary = [
    `Preflight complete for ${settings.calendarName}.`,
    `${preview.creates || 0} create, ${preview.updates || 0} update, ${preview.deletes || 0} remove.`
  ].join(' ');
  writePmosJobState_(state);
}

function startPmosJobV2(type, autoMode) {
  preparePmosJobV2_(type);
  return startPmosJob_(type, autoMode, false);
}

function pausePmosJobV2() {
  return pausePmosJob_();
}

function showPmosJobEngineV2(initialType) {
  const selected = PMOS_JOB_TYPES[initialType] ? initialType : 'CALENDAR_SYNC';
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:18px;color:#1f2937}h2{margin:0 0 5px}.muted{font-size:13px;color:#64748b}.panel{margin-top:14px;padding:14px;border:1px solid #e2e8f0;border-radius:10px}.status{min-height:180px;padding:12px;background:#f1f5f9;border-radius:8px;white-space:pre-wrap;line-height:1.45}.progress-shell{height:14px;background:#e5e7eb;border-radius:8px;overflow:hidden;margin-top:12px}.progress-bar{height:100%;width:0;background:#2563eb;transition:width .25s}.progress-label{font-size:12px;color:#475569;margin-top:6px}.buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}button{border:0;border-radius:8px;padding:9px 13px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.danger{background:#fee2e2;color:#991b1b}.secondary{background:#e2e8f0;color:#111827}button:disabled{opacity:.45;cursor:default}.error{display:none;margin-top:10px;padding:10px;background:#fee2e2;color:#991b1b;border-radius:8px;white-space:pre-wrap}
</style></head><body>
<h2>PMOS Job Center</h2><div class="muted">Calendar work is preflighted before the first batch and then continues through the resumable Job Engine.</div>
<div class="panel"><div id="status" class="status">Loading current status…</div><div class="progress-shell"><div id="bar" class="progress-bar"></div></div><div id="progressLabel" class="progress-label">Overall progress: 0%</div><div id="error" class="error"></div><div class="buttons"><button id="run" class="primary">Start / Continue</button><button id="auto" class="primary">Auto Continue</button><button id="pause" class="danger">Pause</button><button id="refresh" class="secondary">Refresh</button><button id="close" class="secondary">Close</button></div></div>
<script>
var type=${JSON.stringify(selected)},state={},busy=false,polling=false;
function id(x){return document.getElementById(x)}
function statusName(){return String(state.status||'Idle')}
function isRunning(){return statusName()==='Running'}
function isWaiting(){return statusName()==='Waiting'||statusName()==='Waiting for Google'}
function canStart(){var s=statusName();return s==='Idle'||s==='Ready'||s==='Paused'||s==='Paused on error'||s==='Complete'||s==='Cancelled'}
function canPause(){return isRunning()||isWaiting()}
function percent(){var total=Number(state.originalTotal||0),remaining=state.remaining==null?null:Number(state.remaining);if(statusName()==='Complete')return 100;if(total>0&&remaining!=null&&isFinite(remaining))return Math.max(0,Math.min(100,Math.round((total-remaining)/total*100)));return 0}
function buttons(){var start=canStart();id('run').disabled=busy||!start;id('auto').disabled=busy||!start;id('pause').disabled=busy||!canPause();id('refresh').disabled=busy}
function render(s){state=s||{};var p=percent(),processed=Number(state.processedItems||0),total=Number(state.originalTotal||0);id('bar').style.width=p+'%';id('progressLabel').textContent='Overall progress: '+p+'%'+(total?' — '+processed+' of '+total+' items processed':'');var lines=['Job: '+(state.label||'Calendar Sync'),'Status: '+statusName()];if(state.targetCalendarName)lines.push('Target calendar: '+state.targetCalendarName);lines.push('Completed batches: '+Number(state.completedBatches||0));lines.push('Processed items: '+processed);lines.push('Remaining: '+(state.remaining==null?'—':state.remaining));if(state.autoEnabled)lines.push('Auto Continue: Enabled');if(state.nextRunAt)lines.push('Next attempt: '+state.nextRunAt);if(state.lastSummary)lines.push('Last result: '+state.lastSummary);id('status').textContent=lines.join('\n');if(state.lastError){id('error').style.display='block';id('error').textContent=state.lastError}else{id('error').style.display='none';id('error').textContent=''}buttons()}
function fail(e){busy=false;id('error').style.display='block';id('error').textContent=e&&e.message?e.message:String(e);buttons()}
function refresh(showBusy){if(polling)return;polling=true;if(showBusy)busy=true;buttons();google.script.run.withSuccessHandler(function(s){polling=false;busy=false;render(s)}).withFailureHandler(function(e){polling=false;fail(e)}).getPmosJobStatusV2()}
function run(auto){if(!canStart())return;busy=true;buttons();id('status').textContent='Preflighting the calendar plan and starting the job…';google.script.run.withSuccessHandler(function(s){busy=false;render(s)}).withFailureHandler(fail).startPmosJobV2(type,auto)}
id('run').onclick=function(){run(false)};id('auto').onclick=function(){run(true)};id('pause').onclick=function(){if(!canPause())return;busy=true;buttons();google.script.run.withSuccessHandler(function(s){busy=false;render(s)}).withFailureHandler(fail).pausePmosJobV2()};id('refresh').onclick=function(){refresh(true)};id('close').onclick=function(){google.script.host.close()};refresh(false);setInterval(function(){refresh(false)},2000);
</script></body></html>`).setWidth(680).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Job Center');
}
