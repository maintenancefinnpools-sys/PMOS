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
body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}h2{margin:0 0 5px}.muted{font-size:13px;color:#6b7280}.stage{margin-top:16px;font-weight:700}.barShell{height:16px;background:#e5e7eb;border-radius:9px;overflow:hidden;margin-top:9px;position:relative}.bar{height:100%;width:35%;background:#2563eb;position:absolute;animation:move 1.25s infinite ease-in-out;border-radius:9px}@keyframes move{0%{left:-35%}100%{left:100%}}.elapsed{text-align:right;font-size:13px;margin-top:5px;color:#4b5563}.result{margin-top:14px;padding:12px;background:#f3f4f6;border-radius:9px;white-space:pre-wrap;max-height:330px;overflow:auto}.buttons{display:flex;gap:8px;margin-top:14px;align-items:center;flex-wrap:wrap}button{border:0;border-radius:8px;padding:9px 13px;font-weight:600;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e5e7eb;color:#111827}.complete .bar,.failed .bar{width:100%;left:0;animation:none}button:disabled{opacity:.55;cursor:default}
</style></head><body id="body">
<h2>${escapeHtml_(taskTitle)}</h2><div class="muted">This window remains active while PMOS completes the operation.</div><div id="stage" class="stage">Working…</div><div class="barShell"><div class="bar"></div></div><div id="elapsed" class="elapsed">Elapsed: 0s</div><div id="result" class="result">Starting ${escapeHtml_(taskTitle)}…</div><div class="buttons"><button id="syncButton" class="primary" style="display:none">Open Calendar Sync</button><button id="closeButton" class="secondary">Close</button></div>
<script>
(function(){
var body=document.getElementById('body'),stage=document.getElementById('stage'),elapsed=document.getElementById('elapsed'),result=document.getElementById('result'),syncButton=document.getElementById('syncButton'),started=Date.now();
var clock=setInterval(function(){elapsed.textContent='Elapsed: '+Math.floor((Date.now()-started)/1000)+'s';},1000);
function fail(error){clearInterval(clock);body.className='failed';stage.textContent='Needs attention';result.textContent=error&&error.message?error.message:String(error);syncButton.disabled=false;}
function done(response){clearInterval(clock);body.className='complete';stage.textContent='Complete';elapsed.textContent='Duration: '+Math.max(1,Math.round((Date.now()-started)/1000))+'s';result.textContent=response&&response.summary?response.summary:'Task completed.';if('${taskType}'==='CALENDAR_AUDIT'&&response&&response.canSync)syncButton.style.display='inline-block';}
google.script.run.withSuccessHandler(done).withFailureHandler(fail).runPmosTask('${taskType}');
syncButton.onclick=function(){syncButton.disabled=true;stage.textContent='Opening Calendar Sync…';google.script.run.withSuccessHandler(function(){google.script.host.close();}).withFailureHandler(fail).openVerifiedCalendarSyncFromAudit();};
document.getElementById('closeButton').onclick=function(){google.script.host.close();};
})();
</script></body></html>`).setWidth(610).setHeight(540);
  SpreadsheetApp.getUi().showModalDialog(html, taskTitle);
}

function runPmosTask_(taskType) {
  return withSpreadsheetServiceRetry_(() => {
    switch (taskType) {
      case 'CALENDAR_AUDIT':
        return runVerifiedCalendarPlanAuditReadOnly_();
      case 'CALENDAR_STATUS': {
        const preview = previewPmosCalendarSyncPlan();
        return {
          summary: [
            'Calendar Status complete.',
            'No spreadsheet or Calendar changes were made.',
            `Expected recurring series: ${preview.totalSeries || 0}`,
            `Registered series present: ${preview.registeredPresent || 0}`,
            `Registered series missing: ${preview.registeredMissing || 0}`,
            `Creates proposed: ${preview.creates || 0}`,
            `Updates proposed: ${preview.updates || 0}`,
            `Approved removals: ${preview.deletes || 0}`,
            `Temporary visits preserved: ${preview.temporaryVisits || 0}`,
            `Unclassified events: ${preview.unclassifiedEvents || 0}`
          ].join('\n')
        };
      }
      case 'VERIFY_CALENDAR': {
        const result = executeVerifyCalendarJob_();
        return {summary: `Verification complete.\n${result.summary}`};
      }
      case 'CUSTOMER_SYNC': {
        const result = synchronizeCustomerDatabase_(true);
        return {
          summary: [
            'Customer Database Sync complete.',
            `IDs created: ${result.idsCreated || 0}`,
            `Route rows updated: ${result.routeRowsUpdated || 0}`,
            `Route rows created: ${result.routeRowsCreated || 0}`
          ].join('\n')
        };
      }
      case 'MAP_EXPORT': {
        const result = exportAffectedMapLayers();
        return {
          summary: [
            'Map export complete.',
            `Layer files exported: ${result.count || 0}`,
            `Drive folder: ${result.folderName || ''}`
          ].join('\n')
        };
      }
      default:
        throw new Error(`Unknown PMOS task: ${taskType}`);
    }
  }, `running ${taskType}`);
}

/** Compatibility wrapper retained for existing callers. */
function runCalendarPlanAuditReadOnly_() {
  return runVerifiedCalendarPlanAuditReadOnly_();
}

function withSpreadsheetServiceRetry_(operation, operationName) {
  const delays = [0, 600, 1500, 3000];
  let lastError = null;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]) Utilities.sleep(delays[attempt]);
    try {
      return operation();
    } catch (error) {
      lastError = error;
      const message = String(error && error.message ? error.message : error);
      const transient = /Service Spreadsheets failed/i.test(message) ||
        /internal error/i.test(message) ||
        /timed out/i.test(message) ||
        /try again/i.test(message);
      if (!transient || attempt === delays.length - 1) {
        throw new Error(
          `${operationName || 'PMOS operation'} failed after ${attempt + 1} attempt(s): ${message}`
        );
      }
    }
  }

  throw lastError;
}
