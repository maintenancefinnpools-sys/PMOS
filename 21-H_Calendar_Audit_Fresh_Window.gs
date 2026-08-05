/**
 * Dedicated Calendar Plan Audit entry.
 *
 * Every deliberate menu launch starts a new review operation. Review decisions
 * remain active only while the automatic review flow is in progress.
 */
function showFreshCalendarAuditTaskWindow() {
  resetPmosCalendarReviewSessionForNewAudit_();

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}h2{margin:0 0 5px}.muted{font-size:13px;color:#6b7280}.option{margin-top:14px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px}.option label{display:flex;align-items:center;gap:8px;cursor:pointer}.stage{margin-top:16px;font-weight:700}.barShell{height:16px;background:#e5e7eb;border-radius:9px;overflow:hidden;margin-top:9px;position:relative}.bar{height:100%;width:35%;background:#2563eb;position:absolute;animation:move 1.25s infinite ease-in-out;border-radius:9px}@keyframes move{0%{left:-35%}100%{left:100%}}.elapsed{text-align:right;font-size:13px;margin-top:5px;color:#4b5563}.result{margin-top:14px;padding:12px;background:#f3f4f6;border-radius:9px;white-space:pre-wrap;max-height:330px;overflow:auto}.buttons{display:flex;gap:8px;margin-top:14px;align-items:center;flex-wrap:wrap}button{border:0;border-radius:8px;padding:9px 13px;font-weight:600;cursor:pointer;transition:background .15s,color .15s,opacity .15s}.primary{background:#2563eb;color:#fff}.secondary{background:#e5e7eb;color:#111827}.warning{background:#fef3c7;color:#92400e}.warning.opening{background:#fff7d6!important;color:#c45f5f!important}.match{background:#dbeafe;color:#1e3a8a}.match.opening{background:#bfdbfe!important;color:#1e40af!important}.primary.opening{background:#1d4ed8!important;color:#fff!important}.complete .bar,.failed .bar{width:100%;left:0;animation:none}button:disabled{opacity:.88;cursor:default}
</style></head><body id="body">
<h2>Calendar Plan Audit</h2><div class="muted">PMOS is checking the current data.</div><div class="option"><label><input type="checkbox" id="includeStartedToday"> Include events that have already started today</label></div><div id="stage" class="stage">Working…</div><div class="barShell"><div class="bar"></div></div><div id="elapsed" class="elapsed">Elapsed: 0s</div><div id="result" class="result">Starting Calendar Plan Audit…</div><div class="buttons"><button id="errorsButton" class="warning" style="display:none">Errors</button><button id="warningsButton" class="warning" style="display:none">Warnings</button><button id="matchesButton" class="match" style="display:none">Suggested Matches</button><button id="unclassifiedButton" class="warning" style="display:none">Unclassified Events</button><button id="deletionsButton" class="warning" style="display:none">Suggested Deletions</button><button id="syncButton" class="primary" style="display:none">Open Calendar Sync</button><button id="closeButton" class="secondary">Close</button></div>
<script>
(function(){
var body=document.getElementById('body'),stage=document.getElementById('stage'),elapsed=document.getElementById('elapsed'),result=document.getElementById('result'),syncButton=document.getElementById('syncButton'),errorsButton=document.getElementById('errorsButton'),warningsButton=document.getElementById('warningsButton'),matchesButton=document.getElementById('matchesButton'),deletionsButton=document.getElementById('deletionsButton'),unclassifiedButton=document.getElementById('unclassifiedButton'),includeStartedToday=document.getElementById('includeStartedToday'),started=Date.now(),clock=null;
var reviewButtons=[errorsButton,warningsButton,matchesButton,unclassifiedButton,deletionsButton,syncButton];
function startClock(){clock=setInterval(function(){elapsed.textContent='Elapsed: '+Math.floor((Date.now()-started)/1000)+'s';},1000);}
function fail(error){if(clock)clearInterval(clock);body.className='failed';stage.textContent='Needs attention';result.textContent=error&&error.message?error.message:String(error);resetOpeningButtons();}
function done(response){if(clock)clearInterval(clock);body.className='complete';stage.textContent='Complete';elapsed.textContent='Duration: '+Math.max(1,Math.round((Date.now()-started)/1000))+'s';result.textContent=response&&response.summary?response.summary:'Task completed.';if(response){if(response.hasErrors)errorsButton.style.display='inline-block';if(response.hasWarnings)warningsButton.style.display='inline-block';if(response.hasSuggestedMatches)matchesButton.style.display='inline-block';if(response.hasUnclassifiedEvents)unclassifiedButton.style.display='inline-block';if(Number(response.deletionCandidateCount||0)>0)deletionsButton.style.display='inline-block';if(response.canSync)syncButton.style.display='inline-block';}}
function resetOpeningButtons(){reviewButtons.forEach(function(button){if(!button)return;button.disabled=false;button.classList.remove('opening');button.textContent=button.getAttribute('data-label')||button.textContent;});}
function openAction(button,label,serverFunction,closeParent){button.setAttribute('data-label',button.textContent);button.disabled=true;button.classList.add('opening');button.textContent='Opening '+label+'…';stage.textContent='Opening '+label+'…';google.script.run.withSuccessHandler(function(){if(closeParent){google.script.host.close();return;}button.textContent='Opened '+label;setTimeout(function(){button.disabled=false;button.classList.remove('opening');button.textContent=button.getAttribute('data-label');stage.textContent='Complete';},700);}).withFailureHandler(fail)[serverFunction]();}
errorsButton.onclick=function(){openAction(errorsButton,'Errors','showCalendarAuditErrorsReview',false);};
warningsButton.onclick=function(){openAction(warningsButton,'Warnings','showCalendarAuditWarningsReview',false);};
matchesButton.onclick=function(){openAction(matchesButton,'Suggested Matches','showCalendarSuggestedMatchesReview',false);};
unclassifiedButton.onclick=function(){openAction(unclassifiedButton,'Unclassified Events','showCalendarUnclassifiedExceptionsReview',false);};
deletionsButton.onclick=function(){openAction(deletionsButton,'Suggested Deletions','showCalendarDeletionExceptionsReview',false);};
syncButton.onclick=function(){openAction(syncButton,'Calendar Sync','openVerifiedCalendarSyncFromAudit',true);};
document.getElementById('closeButton').onclick=function(){google.script.host.close();};
startClock();google.script.run.withSuccessHandler(done).withFailureHandler(fail).runFreshPmosCalendarAuditWithOptions({includeStartedToday:includeStartedToday.checked});
})();
</script></body></html>`).setWidth(760).setHeight(660);

  SpreadsheetApp.getUi().showModelessDialog(html, 'Calendar Plan Audit');
}

function resetPmosCalendarReviewSessionForNewAudit_() {
  PropertiesService.getDocumentProperties().deleteProperty(
    PMOS_REVIEW_SESSION_PROPERTY
  );
  clearPmosCalendarAuditOptions_();
  return {reset: true};
}
