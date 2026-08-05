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
body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}h2{margin:0 0 5px}.muted{font-size:13px;color:#6b7280}.stage{margin-top:16px;font-weight:700}.barShell{height:16px;background:#e5e7eb;border-radius:9px;overflow:hidden;margin-top:9px;position:relative}.bar{height:100%;width:35%;background:#2563eb;position:absolute;animation:move 1.25s infinite ease-in-out;border-radius:9px}@keyframes move{0%{left:-35%}100%{left:100%}}.elapsed{text-align:right;font-size:13px;margin-top:5px;color:#4b5563}.result{margin-top:14px;padding:12px;background:#f3f4f6;border-radius:9px;white-space:pre-wrap;max-height:330px;overflow:auto}.buttons{display:flex;gap:8px;margin-top:14px;align-items:center;flex-wrap:wrap}button{border:0;border-radius:8px;padding:9px 13px;font-weight:600;cursor:pointer;transition:background .15s,color .15s,opacity .15s}.primary{background:#2563eb;color:#fff}.secondary{background:#e5e7eb;color:#111827}.warning{background:#fef3c7;color:#92400e}.warning.opening{background:#fff7d6!important;color:#c45f5f!important}.match{background:#dbeafe;color:#1e3a8a}.match.opening{background:#bfdbfe!important;color:#1e40af!important}.primary.opening{background:#1d4ed8!important;color:#fff!important}.secondary.opening{background:#cbd5e1!important;color:#334155!important}.complete .bar,.failed .bar{width:100%;left:0;animation:none}button:disabled{opacity:.88;cursor:default}
</style></head><body id="body">
<h2>${escapeHtml_(taskTitle)}</h2><div class="muted">PMOS is checking the current data.</div><div id="stage" class="stage">Working…</div><div class="barShell"><div class="bar"></div></div><div id="elapsed" class="elapsed">Elapsed: 0s</div><div id="result" class="result">Starting ${escapeHtml_(taskTitle)}…</div><div class="buttons"><button id="errorsButton" class="warning" style="display:none">Errors</button><button id="warningsButton" class="warning" style="display:none">Warnings</button><button id="matchesButton" class="match" style="display:none">Suggested Matches</button><button id="unclassifiedButton" class="warning" style="display:none">Unclassified Events</button><button id="deletionsButton" class="warning" style="display:none">Suggested Deletions</button><button id="syncButton" class="primary" style="display:none">Open Calendar Sync</button><button id="rerunButton" class="secondary" style="display:none">Re-run Audit</button><button id="closeButton" class="secondary">Close</button></div>
<script>
(function(){
var body=document.getElementById('body'),stage=document.getElementById('stage'),elapsed=document.getElementById('elapsed'),result=document.getElementById('result'),syncButton=document.getElementById('syncButton'),errorsButton=document.getElementById('errorsButton'),warningsButton=document.getElementById('warningsButton'),matchesButton=document.getElementById('matchesButton'),deletionsButton=document.getElementById('deletionsButton'),unclassifiedButton=document.getElementById('unclassifiedButton'),rerunButton=document.getElementById('rerunButton'),started=Date.now(),clock=null;
var reviewButtons=[errorsButton,warningsButton,matchesButton,unclassifiedButton,deletionsButton,syncButton];
function startClock(){if(clock)clearInterval(clock);clock=setInterval(function(){elapsed.textContent='Elapsed: '+Math.floor((Date.now()-started)/1000)+'s';},1000);}
function hideReviewButtons(){reviewButtons.forEach(function(button){button.style.display='none';button.disabled=false;button.classList.remove('opening');});}
function fail(error){if(clock)clearInterval(clock);body.className='failed';stage.textContent='Needs attention';result.textContent=error&&error.message?error.message:String(error);rerunButton.style.display='inline-block';rerunButton.disabled=false;rerunButton.classList.remove('opening');rerunButton.textContent='Re-run Audit';resetOpeningButtons();}
function done(response){if(clock)clearInterval(clock);body.className='complete';stage.textContent='Complete';elapsed.textContent='Duration: '+Math.max(1,Math.round((Date.now()-started)/1000))+'s';result.textContent=response&&response.summary?response.summary:'Task completed.';rerunButton.style.display='inline-block';rerunButton.disabled=false;rerunButton.classList.remove('opening');rerunButton.textContent='Re-run Audit';if('${taskType}'==='CALENDAR_AUDIT'&&response){if(response.hasErrors)errorsButton.style.display='inline-block';if(response.hasWarnings)warningsButton.style.display='inline-block';if(response.hasSuggestedMatches)matchesButton.style.display='inline-block';if(response.hasUnclassifiedEvents)unclassifiedButton.style.display='inline-block';if(Number(response.deletionCandidateCount||0)>0)deletionsButton.style.display='inline-block';if(response.canSync)syncButton.style.display='inline-block';}}
function resetOpeningButtons(){reviewButtons.forEach(function(button){if(!button)return;button.disabled=false;button.classList.remove('opening');button.textContent=button.getAttribute('data-label')||button.textContent;});if(body.className!=='failed')stage.textContent='Complete';}
function runAudit(isRerun){started=Date.now();body.className='';hideReviewButtons();stage.textContent=isRerun?'Re-running Audit…':'Working…';elapsed.textContent='Elapsed: 0s';result.textContent=isRerun?'Refreshing Calendar Plan Audit…':'Starting ${escapeHtml_(taskTitle)}…';if(isRerun){rerunButton.style.display='inline-block';rerunButton.disabled=true;rerunButton.classList.add('opening');rerunButton.textContent='Re-running Audit…';}startClock();google.script.run.withSuccessHandler(done).withFailureHandler(fail).runPmosTask('${taskType}');}
function openAction(button,label,serverFunction,closeParent){button.setAttribute('data-label',button.textContent);button.disabled=true;button.classList.add('opening');button.textContent='Opening '+label+'…';stage.textContent='Opening '+label+'…';google.script.run.withSuccessHandler(function(){if(closeParent){google.script.host.close();return;}button.textContent='Opened '+label;setTimeout(function(){button.disabled=false;button.classList.remove('opening');button.textContent=button.getAttribute('data-label');stage.textContent='Complete';},700);}).withFailureHandler(fail)[serverFunction]();}
errorsButton.onclick=function(){openAction(errorsButton,'Errors','showCalendarAuditErrorsReview',false);};
warningsButton.onclick=function(){openAction(warningsButton,'Warnings','showCalendarAuditWarningsReview',false);};
matchesButton.onclick=function(){openAction(matchesButton,'Suggested Matches','showCalendarSuggestedMatchesReview',false);};
unclassifiedButton.onclick=function(){openAction(unclassifiedButton,'Unclassified Events','showCalendarUnclassifiedExceptionsReview',false);};
deletionsButton.onclick=function(){openAction(deletionsButton,'Suggested Deletions','showCalendarDeletionExceptionsReview',false);};
syncButton.onclick=function(){openAction(syncButton,'Calendar Sync','openVerifiedCalendarSyncFromAudit',true);};
rerunButton.onclick=function(){runAudit(true);};
document.getElementById('closeButton').onclick=function(){google.script.host.close();};
runAudit(false);
})();
</script></body></html>`).setWidth(760).setHeight(620);

  if (taskType === 'CALENDAR_AUDIT') SpreadsheetApp.getUi().showModelessDialog(html, taskTitle);
  else SpreadsheetApp.getUi().showModalDialog(html, taskTitle);
}

function runPmosTask_(taskType) {
  return withSpreadsheetServiceRetry_(function () {
    switch (taskType) {
      case 'CALENDAR_AUDIT': return runVerifiedCalendarPlanAuditReadOnly_();
      case 'CALENDAR_STATUS': {
        const preview = previewPmosCalendarSyncPlan();
        return {summary:[
          'Calendar: ' + String(preview.calendarName || ''),
          'Expected recurring series: ' + Number(preview.totalSeries || 0),
          'Registered series present: ' + Number(preview.registeredPresent || 0),
          'Registered series missing: ' + Number(preview.registeredMissing || 0),
          'Creates proposed: ' + Number(preview.creates || 0),
          'Updates proposed: ' + Number(preview.updates || 0),
          'Warnings: ' + Number(preview.warnings || 0),
          'Unclassified events: ' + Number(preview.unclassifiedEvents || 0)
        ].join('\n')};
      }
      case 'VERIFY_CALENDAR': { const result = executeVerifyCalendarJob_(); return {summary:String(result.summary || '')}; }
      case 'CUSTOMER_SYNC': {
        const result = synchronizeCustomerDatabase_(true);
        return {summary:['IDs created: ' + Number(result.idsCreated || 0),'Route rows updated: ' + Number(result.routeRowsUpdated || 0),'Route rows created: ' + Number(result.routeRowsCreated || 0)].join('\n')};
      }
      case 'MAP_EXPORT': {
        const result = exportAffectedMapLayers();
        return {summary:['Layer files exported: ' + Number(result.count || 0),'Drive folder: ' + String(result.folderName || '')].join('\n')};
      }
      default: throw new Error('Unknown PMOS task: ' + taskType);
    }
  }, 'running ' + taskType);
}

function runCalendarPlanAuditReadOnly_() { return runVerifiedCalendarPlanAuditReadOnly_(); }

function withSpreadsheetServiceRetry_(operation, operationName) {
  const delays = [0,600,1500,3000];
  let lastError = null;
  for (let attempt=0; attempt<delays.length; attempt++) {
    if (delays[attempt]) Utilities.sleep(delays[attempt]);
    try { return operation(); }
    catch (error) {
      lastError = error;
      const message = String(error && error.message ? error.message : error);
      const transient = /Service Spreadsheets failed/i.test(message) || /internal error/i.test(message) || /timed out/i.test(message) || /try again/i.test(message);
      if (!transient || attempt === delays.length-1) throw new Error((operationName || 'PMOS operation') + ' failed after ' + (attempt+1) + ' attempt(s): ' + message);
    }
  }
  throw lastError;
}
