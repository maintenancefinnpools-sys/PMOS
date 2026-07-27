/**
 * PMOS v1.9.0 — Unified job task windows and retry handling.
 */

function showCalendarAuditTaskWindow() { showPmosTaskWindow_('CALENDAR_AUDIT', 'Calendar Plan Audit'); }
function showCalendarStatusTaskWindow() { showPmosTaskWindow_('CALENDAR_STATUS', 'Calendar Status'); }
function showVerifyCalendarTaskWindow() { showPmosTaskWindow_('VERIFY_CALENDAR', 'Verify Calendar'); }
function showCustomerSyncTaskWindow() { showPmosTaskWindow_('CUSTOMER_SYNC', 'Sync Customer Database'); }
function showMapExportTaskWindow() { showPmosTaskWindow_('MAP_EXPORT', 'Export Updated Map Layers'); }

function showPmosTaskWindow_(taskType, taskTitle) {
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}h2{margin:0 0 5px}.muted{font-size:13px;color:#6b7280}.stage{margin-top:16px;font-weight:700}.barShell{height:16px;background:#e5e7eb;border-radius:9px;overflow:hidden;margin-top:9px;position:relative}.bar{height:100%;width:35%;background:#2563eb;position:absolute;animation:move 1.25s infinite ease-in-out;border-radius:9px}@keyframes move{0%{left:-35%}100%{left:100%}}.elapsed{text-align:right;font-size:13px;margin-top:5px;color:#4b5563}.result{margin-top:14px;padding:12px;background:#f3f4f6;border-radius:9px;white-space:pre-wrap;max-height:330px;overflow:auto}.buttons{display:flex;gap:8px;margin-top:14px;align-items:center;flex-wrap:wrap}button{border:0;border-radius:8px;padding:9px 13px;font-weight:600;cursor:pointer}.primary{background:#2563eb;color:white}.secondary{background:#e5e7eb;color:#111827}button.loading{background:#e5e7eb;color:#6b7280;cursor:default}button:disabled{opacity:1}.launchStatus{display:none;font-size:12px;color:#4b5563}.complete .bar{width:100%;left:0;animation:none}.failed .bar{width:100%;left:0;animation:none}
</style></head><body id="body">
<h2>${escapeHtml_(taskTitle)}</h2><div class="muted">This window remains active while PMOS completes the operation.</div><div id="stage" class="stage">Working…</div><div class="barShell"><div id="bar" class="bar"></div></div><div id="elapsed" class="elapsed">Elapsed: 0s</div><div id="result" class="result">Starting ${escapeHtml_(taskTitle)}…</div><div class="buttons"><button id="syncButton" class="primary" style="display:none" onclick="openCalendarSync()">Open Calendar Sync</button><button class="secondary" onclick="google.script.host.close()">Close</button><span id="launchStatus" class="launchStatus">Opening Calendar Sync in the Job Engine…</span></div>
<script>
const body=document.getElementById('body'),stage=document.getElementById('stage'),elapsed=document.getElementById('elapsed'),result=document.getElementById('result'),syncButton=document.getElementById('syncButton'),launchStatus=document.getElementById('launchStatus'),started=Date.now();
const clock=setInterval(function(){elapsed.textContent='Elapsed: '+Math.floor((Date.now()-started)/1000)+'s';},1000);
google.script.run.withSuccessHandler(function(response){clearInterval(clock);body.classList.add('complete');stage.textContent='Complete';elapsed.textContent='Duration: '+Math.max(1,Math.round((Date.now()-started)/1000))+'s';result.textContent=response&&response.summary?response.summary:'Task completed.';if('${taskType}'==='CALENDAR_AUDIT'&&response&&response.canSync)syncButton.style.display='inline-block';}).withFailureHandler(function(error){clearInterval(clock);body.classList.add('failed');stage.textContent='Needs attention';result.textContent=error&&error.message?error.message:String(error);}).runPmosTask('${taskType}');
function setSyncLoading_(loading){syncButton.disabled=loading;syncButton.className=loading?'loading':'primary';syncButton.textContent=loading?'Opening Calendar Sync…':'Open Calendar Sync';launchStatus.style.display=loading?'inline':'none';}
function openCalendarSync(){if(syncButton.disabled)return;setSyncLoading_(true);result.textContent+='\n\nOpening Calendar Sync in the PMOS Job Engine…';google.script.run.withSuccessHandler(function(){launchStatus.textContent='Calendar Sync opened.';setTimeout(function(){google.script.host.close();},150);}).withFailureHandler(function(error){setSyncLoading_(false);launchStatus.style.display='inline';launchStatus.textContent='Calendar Sync did not open.';result.textContent+='\n'+(error&&error.message?error.message:String(error));}).openIntegratedCalendarSyncFromAudit();}
</script></body></html>`).setWidth(610).setHeight(540);
  SpreadsheetApp.getUi().showModalDialog(html, taskTitle);
}

function runPmosTask_(taskType) {
  return withSpreadsheetServiceRetry_(() => {
    switch (taskType) {
      case 'CALENDAR_AUDIT': {
        const audit = runCalendarPlanAudit_();
        return {canSync:Boolean(audit.canSync),summary:['Calendar Plan Audit complete.',`Expected recurring series: ${audit.uniqueSeriesCount}`,`Blocking errors: ${audit.errorCount}`,`Warnings: ${audit.warningCount}`,audit.canSync?'Calendar Sync and Rebuild are permitted.':'Calendar Sync and Rebuild remain blocked until errors are repaired.'].join('\n')};
      }
      case 'CALENDAR_STATUS': {
        const preview=previewCalendarChanges(),registry=getSeriesRegistry_();
        return {summary:['Calendar Status complete.',`Registered recurring series: ${Object.keys(registry).length}`,`Creates pending: ${preview.creates||0}`,`Updates pending: ${preview.updates||0}`,`Removals pending: ${preview.deletes||0}`].join('\n')};
      }
      case 'VERIFY_CALENDAR': { const r=executeVerifyCalendarJob_(); return {summary:`Verification complete.\n${r.summary}`}; }
      case 'CUSTOMER_SYNC': { const r=synchronizeCustomerDatabase_(true); return {summary:['Customer Database Sync complete.',`IDs created: ${r.idsCreated||0}`,`Route rows updated: ${r.routeRowsUpdated||0}`,`Route rows created: ${r.routeRowsCreated||0}`].join('\n')}; }
      case 'MAP_EXPORT': { const r=exportAffectedMapLayers(); return {summary:['Map export complete.',`Layer files exported: ${r.count||0}`,`Drive folder: ${r.folderName||''}`].join('\n')}; }
      default: throw new Error(`Unknown PMOS task: ${taskType}`);
    }
  }, `running ${taskType}`);
}

function withSpreadsheetServiceRetry_(operation, operationName) {
  const delays=[0,600,1500,3000]; let lastError=null;
  for(let attempt=0;attempt<delays.length;attempt++){
    if(delays[attempt])Utilities.sleep(delays[attempt]);
    try{return operation();}catch(error){lastError=error;const message=String(error&&error.message?error.message:error);const transient=/Service Spreadsheets failed/i.test(message)||/internal error/i.test(message)||/timed out/i.test(message)||/try again/i.test(message);if(!transient||attempt===delays.length-1)throw new Error(`${operationName||'PMOS operation'} failed after ${attempt+1} attempt(s): ${message}`);}
  }
  throw lastError;
}
