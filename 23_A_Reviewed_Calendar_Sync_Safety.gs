/** Guarded handoff from Calendar Review into resumable Calendar Sync. */
function openSafeReviewedCalendarSyncPreview_() {
  const prepared = prepareReviewedCalendarSyncWindow_();
  const preflightWarnings = Array.isArray(prepared.preflightWarnings)
    ? prepared.preflightWarnings.slice()
    : [];
  const warningHtml = preflightWarnings.length
    ? '<div class="notice danger"><b>Preflight warning</b><br>' +
      preflightWarnings.map(escapePmosSyncPreviewHtml_).join('<br>') +
      '</div>'
    : '';
  const warningJson = JSON.stringify(preflightWarnings).replace(/</g, '\\u003c');

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}html,body{height:100%}body{font-family:Arial,sans-serif;margin:0;color:#1f2937;display:flex;flex-direction:column;overflow:hidden}.content{padding:18px 18px 0;overflow:auto;flex:1;min-height:0}h2{margin:0 0 4px}.muted{font-size:13px;color:#64748b}.section{margin-top:15px;border:1px solid #e2e8f0;border-radius:10px;padding:13px}.section h3{margin:0 0 10px}.section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.section-head h3{margin:0}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.metric{border:1px solid #e2e8f0;border-radius:8px;padding:9px;background:#f8fafc}.metric span{display:block;font-size:11px;color:#64748b}.metric strong{display:block;margin-top:3px;font-size:17px;overflow-wrap:anywhere}.metric.wide{grid-column:1/-1}.target{margin-top:12px;padding:11px;border-radius:9px;background:#fffbeb;color:#92400e;border:1px solid #f59e0b;font-weight:700}.phase{padding:11px;border-radius:9px;background:#eff6ff;color:#1e40af;font-weight:700}.phase.paused{background:#fef3c7;color:#92400e}.phase.complete{background:#dcfce7;color:#166534}.progress{height:14px;background:#e5e7eb;border-radius:8px;overflow:hidden;margin-top:11px}.bar{height:100%;width:0;background:#2563eb;transition:width .25s}.notice{margin-top:14px;padding:11px;border-radius:9px;background:#fef3c7;color:#92400e;font-weight:700;line-height:1.45}.notice.danger{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}.error{display:none;margin-top:12px;padding:11px;background:#fee2e2;color:#991b1b;border-radius:9px;white-space:pre-wrap}.actions{display:flex;gap:8px;padding:12px 18px 14px;margin-top:12px;background:#fff;border-top:1px solid #e2e8f0;box-shadow:0 -4px 12px rgba(15,23,42,.06);flex:0 0 auto;position:relative;z-index:5}button{border:0;border-radius:8px;padding:10px 13px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e2e8f0;color:#1f2937}button:disabled{opacity:.5;cursor:default}.bottom-space{height:14px}
</style></head><body>
<div class="content">
<h2>Calendar Sync</h2>
<div class="muted">Review the prepared synchronization for ${escapePmosSyncPreviewHtml_(prepared.calendarName || '')}. No Calendar changes begin until Start Sync is selected.</div>
<div class="target">Target Calendar: ${escapePmosSyncPreviewHtml_(prepared.calendarName || '')}</div>
${warningHtml}

<div class="section"><h3>Planned Calendar changes</h3><div class="metrics">
<div class="metric"><span>Create</span><strong>${prepared.creates}</strong></div>
<div class="metric"><span>Update</span><strong>${prepared.updates}</strong></div>
<div class="metric"><span>Delete</span><strong>${prepared.deletes}</strong></div>
<div class="metric"><span>Total operations</span><strong>${prepared.total}</strong></div>
<div class="metric"><span>Processed</span><strong id="processed">0 / ${prepared.total}</strong></div>
<div class="metric"><span>Remaining</span><strong id="remaining">${prepared.total}</strong></div>
</div></div>

<div class="section"><div class="section-head"><h3>Execution status</h3><button id="refresh" class="secondary" type="button">Refresh</button></div>
<div id="phase" class="phase">Preparing complete — ready to start</div>
<div class="progress"><div id="bar" class="bar"></div></div>
<div class="metrics" style="margin-top:10px">
<div class="metric"><span>Creates completed</span><strong id="created">0 / ${prepared.creates}</strong></div>
<div class="metric"><span>Updates completed</span><strong id="updated">0 / ${prepared.updates}</strong></div>
<div class="metric"><span>Deletes completed</span><strong id="deleted">0 / ${prepared.deletes}</strong></div>
<div class="metric"><span>Attempts</span><strong id="attempts">0</strong></div>
<div class="metric"><span>Retries</span><strong id="retries">0</strong></div>
<div class="metric"><span>Queue status</span><strong id="queueStatus">Prepared</strong></div>
<div class="metric wide"><span>Current operation</span><strong id="currentOperation">Queue prepared</strong></div>
</div></div>

<div id="error" class="error"></div><div class="bottom-space"></div>
</div>
<div class="actions"><button id="start" class="primary">Start Sync</button><button class="secondary" onclick="google.script.host.close()">Close</button></div>
<script>
(function(){
var start=document.getElementById('start'),refresh=document.getElementById('refresh'),phase=document.getElementById('phase'),bar=document.getElementById('bar'),error=document.getElementById('error'),timer=null;
var expected={total:${prepared.total},creates:${prepared.creates},updates:${prepared.updates},deletes:${prepared.deletes}};
var preflightWarnings=${warningJson};
function text(id,value){document.getElementById(id).textContent=String(value);}
function fail(e){error.style.display='block';error.textContent=e&&e.message?e.message:String(e);start.disabled=false;refresh.disabled=false;}
function render(s){
  s=s||{};
  var total=Number(s.total||expected.total),processed=Number(s.processed||0),remaining=s.remaining==null?Math.max(0,total-processed):Number(s.remaining),percent=total?Math.round(processed/total*100):0;
  if(s.status==='Complete')percent=100;
  bar.style.width=Math.max(0,Math.min(100,percent))+'%';
  var displayPhase=s.phase||'Ready to start';
  if(s.status==='Prepared')displayPhase='Preparing complete — ready to start';
  else if(s.status==='Scheduled')displayPhase='Running — waiting for execution worker';
  else if(s.status==='Running')displayPhase='Running — applying reviewed Calendar operations';
  else if(s.status==='Paused on error')displayPhase='Paused — synchronization stopped safely';
  else if(s.status==='Complete')displayPhase='Complete — all queued operations verified';
  phase.textContent=displayPhase;
  phase.className='phase'+(s.status==='Paused on error'?' paused':s.status==='Complete'?' complete':'');
  text('processed',processed+' / '+total+' ('+percent+'%)');
  text('remaining',remaining);
  text('created',Number(s.created||0)+' / '+Number(s.expectedCreates==null?expected.creates:s.expectedCreates));
  text('updated',Number(s.updated||0)+' / '+Number(s.expectedUpdates==null?expected.updates:s.expectedUpdates));
  text('deleted',Number(s.deleted||0)+' / '+Number(s.expectedDeletes==null?expected.deletes:s.expectedDeletes));
  text('retries',Number(s.retries||0));
  text('attempts',Number(s.attempts||0));
  text('currentOperation',s.currentOperation||(s.status==='Complete'?'None — synchronization complete':s.status==='Prepared'?'Queue prepared':'Waiting for next operation'));
  text('queueStatus','Pending '+Number(s.pending||0)+' • Running '+Number(s.running||0)+' • Complete '+Number(s.completeRows||0)+' • Error '+Number(s.errorRows||0));
  error.style.display=s.lastError?'block':'none';
  error.textContent=s.lastError||'';
  var active=['Scheduled','Running'].indexOf(s.status)>=0;
  start.disabled=active||s.status==='Complete'||s.status==='Paused on error';
  start.textContent=s.status==='Complete'?'Complete':s.status==='Paused on error'?'Paused':active?'Running…':'Start Sync';
  if((s.status==='Complete'||s.status==='Paused on error')&&timer){clearInterval(timer);timer=null;}
}
function poll(){google.script.run.withSuccessHandler(render).withFailureHandler(fail).getReviewedCalendarSyncDetailedStatus();}
start.onclick=function(){
  if(preflightWarnings.length&&!confirm(preflightWarnings.join('\n\n')+'\n\nStart Calendar Sync anyway?'))return;
  start.disabled=true;error.style.display='none';phase.textContent='Running — scheduling execution worker';
  google.script.run.withSuccessHandler(function(){poll();if(!timer)timer=setInterval(poll,2000);}).withFailureHandler(fail).startReviewedCalendarSyncExecution();
};
refresh.onclick=poll;
poll();
})();
</script></body></html>`).setWidth(860).setHeight(650);
  SpreadsheetApp.getUi().showModalDialog(html, 'Reviewed Calendar Sync');
  return prepared;
}

/** Compatibility helper retained for callers that only need validation totals. */
function prepareSafeReviewedCalendarSync_() {
  const state = readReviewedCalendarSyncState_();
  if (state && state.status === 'Prepared') {
    return {
      sessionId: state.sessionId,
      planId: state.planId,
      sourceVersion: state.sourceVersion,
      calendarName: state.calendarName,
      total: state.total,
      creates: Number(state.expectedCreates || 0),
      updates: Number(state.expectedUpdates || 0),
      deletes: Number(state.expectedDeletes || 0),
      preflightWarnings: Array.isArray(state.preflightWarnings)
        ? state.preflightWarnings.slice()
        : [],
      preparedAt: state.updatedAt
    };
  }
  return prepareReviewedCalendarSyncWindow_();
}
