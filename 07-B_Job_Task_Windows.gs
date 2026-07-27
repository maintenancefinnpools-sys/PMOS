/**
 * PMOS unified task windows.
 */
function showCalendarAuditTaskWindow() { showPmosTaskWindow_('CALENDAR_AUDIT', 'Calendar Plan Audit'); }
function showCalendarStatusTaskWindow() { showPmosTaskWindow_('CALENDAR_STATUS', 'Calendar Status'); }
function showVerifyCalendarTaskWindow() { showPmosTaskWindow_('VERIFY_CALENDAR', 'Verify Calendar'); }
function showCustomerSyncTaskWindow() { showPmosTaskWindow_('CUSTOMER_SYNC', 'Sync Customer Database'); }
function showMapExportTaskWindow() { showPmosTaskWindow_('MAP_EXPORT', 'Export Updated Map Layers'); }

function showPmosTaskWindow_(taskType, taskTitle) {
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}h2{margin:0 0 5px}.muted{font-size:13px;color:#6b7280}.stage{margin-top:16px;font-weight:700}.barShell{height:16px;background:#e5e7eb;border-radius:9px;overflow:hidden;margin-top:9px;position:relative}.bar{height:100%;width:35%;background:#2563eb;position:absolute;animation:move 1.25s infinite ease-in-out;border-radius:9px}@keyframes move{0%{left:-35%}100%{left:100%}}.elapsed{text-align:right;font-size:13px;margin-top:5px;color:#4b5563}.result{margin-top:14px;padding:12px;background:#f3f4f6;border-radius:9px;white-space:pre-wrap;max-height:330px;overflow:auto}.buttons{display:flex;gap:8px;margin-top:14px;align-items:center;flex-wrap:wrap}button{border:0;border-radius:8px;padding:9px 13px;font-weight:600;cursor:pointer}.primary{background:#2563eb;color:white}.secondary{background:#e5e7eb;color:#111827}.complete .bar,.failed .bar{width:100%;left:0;animation:none}
</style></head><body id="body">
<h2>${escapeHtml_(taskTitle)}</h2><div class="muted">This window remains active while PMOS completes the operation.</div><div id="stage" class="stage">Working…</div><div class="barShell"><div class="bar"></div></div><div id="elapsed" class="elapsed">Elapsed: 0s</div><div id="result" class="result">Starting ${escapeHtml_(taskTitle)}…</div><div class="buttons"><button id="syncButton" class="primary" style="display:none">Open Calendar Sync</button><button id="closeButton" class="secondary">Close</button></div>
<script>
(function(){
var body=document.getElementById('body'),stage=document.getElementById('stage'),elapsed=document.getElementById('elapsed'),result=document.getElementById('result'),syncButton=document.getElementById('syncButton'),started=Date.now();
var clock=setInterval(function(){elapsed.textContent='Elapsed: '+Math.floor((Date.now()-started)/1000)+'s';},1000);
function fail(error){clearInterval(clock);body.className='failed';stage.textContent='Needs attention';result.textContent=error&&error.message?error.message:String(error);}
function done(response){clearInterval(clock);body.className='complete';stage.textContent='Complete';elapsed.textContent='Duration: '+Math.max(1,Math.round((Date.now()-started)/1000))+'s';result.textContent=response&&response.summary?response.summary:'Task completed.';if('${taskType}'==='CALENDAR_AUDIT'&&response&&response.canSync)syncButton.style.display='inline-block';}
google.script.run.withSuccessHandler(done).withFailureHandler(fail).runPmosTask('${taskType}');
syncButton.onclick=function(){syncButton.disabled=true;google.script.run.withSuccessHandler(function(){google.script.host.close();}).withFailureHandler(fail).openIntegratedCalendarSyncFromAudit();};
document.getElementById('closeButton').onclick=function(){google.script.host.close();};
})();
</script></body></html>`).setWidth(610).setHeight(540);
  SpreadsheetApp.getUi().showModalDialog(html, taskTitle);
}

function runPmosTask_(taskType) {
  return withSpreadsheetServiceRetry_(() => {
    switch (taskType) {
      case 'CALENDAR_AUDIT': return runCalendarPlanAuditReadOnly_();
      case 'CALENDAR_STATUS': {
        const preview = previewCalendarChanges();
        const registry = getSeriesRegistry_();
        return {summary:['Calendar Status complete.',`Registered recurring series: ${Object.keys(registry).length}`,`Creates pending: ${preview.creates||0}`,`Updates pending: ${preview.updates||0}`,`Removals pending: ${preview.deletes||0}`].join('\n')};
      }
      case 'VERIFY_CALENDAR': { const r=executeVerifyCalendarJob_(); return {summary:`Verification complete.\n${r.summary}`}; }
      case 'CUSTOMER_SYNC': { const r=synchronizeCustomerDatabase_(true); return {summary:['Customer Database Sync complete.',`IDs created: ${r.idsCreated||0}`,`Route rows updated: ${r.routeRowsUpdated||0}`,`Route rows created: ${r.routeRowsCreated||0}`].join('\n')}; }
      case 'MAP_EXPORT': { const r=exportAffectedMapLayers(); return {summary:['Map export complete.',`Layer files exported: ${r.count||0}`,`Drive folder: ${r.folderName||''}`].join('\n')}; }
      default: throw new Error(`Unknown PMOS task: ${taskType}`);
    }
  }, `running ${taskType}`);
}

function runCalendarPlanAuditReadOnly_() {
  const sheet = getRoutesSheet_();
  const values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error('The route template is empty.');
  const headers = values[0].map(value => String(value || '').trim());
  const required = ['Layer','Stop Order','Calendar Title','Customer ID'];
  const missing = required.filter(header => headers.indexOf(header) < 0);
  if (missing.length) {
    return {canSync:false,summary:['Calendar Plan Audit complete.','No spreadsheet changes were made.',`Blocking errors: ${missing.length}`,'Missing required columns: '+missing.join(', ')].join('\n')};
  }
  const layerIndex=headers.indexOf('Layer'),orderIndex=headers.indexOf('Stop Order'),titleIndex=headers.indexOf('Calendar Title'),idIndex=headers.indexOf('Customer ID');
  let routeRows=0,errors=0,warnings=0;
  const series={},orders={};
  for(let row=1;row<values.length;row++){
    const record=values[row];
    if(!record.some(value => value!=='' && value!=null)) continue;
    routeRows++;
    const layer=String(record[layerIndex]||'').trim(),title=String(record[titleIndex]||'').trim(),id=String(record[idIndex]||'').trim(),order=Number(record[orderIndex]);
    if(!layer||!title||!id||!Number.isFinite(order)||order<1){errors++;continue;}
    const key=id+'|'+layer;
    if(series[key]) warnings++; else series[key]=true;
    if(!orders[layer]) orders[layer]={};
    if(orders[layer][order]) warnings++; else orders[layer][order]=true;
  }
  const uniqueSeriesCount=Object.keys(series).length;
  return {canSync:errors===0,summary:['Calendar Plan Audit complete.','No spreadsheet changes were made.',`Route rows checked: ${routeRows}`,`Unique recurring series: ${uniqueSeriesCount}`,`Blocking errors: ${errors}`,`Warnings: ${warnings}`,errors===0?'Calendar Sync is permitted.':'Calendar Sync remains blocked until the errors are repaired.'].join('\n')};
}

function withSpreadsheetServiceRetry_(operation, operationName) {
  const delays=[0,600,1500,3000]; let lastError=null;
  for(let attempt=0;attempt<delays.length;attempt++){
    if(delays[attempt]) Utilities.sleep(delays[attempt]);
    try{return operation();}catch(error){
      lastError=error;
      const message=String(error&&error.message?error.message:error);
      const transient=/Service Spreadsheets failed/i.test(message)||/internal error/i.test(message)||/timed out/i.test(message)||/try again/i.test(message);
      if(!transient||attempt===delays.length-1) throw new Error(`${operationName||'PMOS operation'} failed after ${attempt+1} attempt(s): ${message}`);
    }
  }
  throw lastError;
}
