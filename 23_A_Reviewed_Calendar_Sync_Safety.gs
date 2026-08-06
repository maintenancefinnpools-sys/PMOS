/** Guarded handoff from Calendar Review into resumable Calendar Sync. */
function openSafeReviewedCalendarSyncPreview_() {
  const prepared = prepareReviewedCalendarSyncWindow_();
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;padding:18px;color:#1f2937;margin:0}h2{margin:0 0 6px}.muted{font-size:13px;color:#6b7280}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.card{padding:11px;border-radius:9px;background:#f3f4f6}.card b{font-size:20px}.ready{background:#dcfce7;color:#166534}.phase{margin:12px 0 8px;padding:10px 12px;border-radius:9px;background:#eff6ff;color:#1e40af;font-weight:700}.phase.paused{background:#fef3c7;color:#92400e}.phase.complete{background:#dcfce7;color:#166534}.status-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.status-card{padding:10px;border-radius:9px;background:#f8fafc;border:1px solid #e5e7eb}.status-card span{display:block;font-size:11px;color:#64748b}.status-card strong{display:block;margin-top:3px;font-size:16px;overflow-wrap:anywhere}.wide{grid-column:1/-1}.progress{height:15px;background:#e5e7eb;border-radius:8px;overflow:hidden;margin:13px 0}.bar{height:100%;width:0;background:#2563eb;transition:width .25s}.error{display:none;margin-top:10px;padding:10px;background:#fee2e2;color:#991b1b;border-radius:8px;white-space:pre-wrap}.buttons{display:flex;gap:8px;margin-top:16px}button{border:0;border-radius:8px;padding:9px 13px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e5e7eb;color:#111827}button:disabled{opacity:.5;cursor:default}
</style></head><body>
<h2>Calendar Sync</h2><div class="muted">The reviewed plan is validated and stored in the durable execution queue. No Calendar changes begin until Start Sync is selected.</div>
<div class="summary"><div class="card ready"><b>${prepared.total}</b><br><small>Total operations</small></div><div class="card"><b>${prepared.creates}</b><br><small>Expected creates</small></div><div class="card"><b>${prepared.updates}</b><br><small>Expected updates</small></div><div class="card"><b>${prepared.deletes}</b><br><small>Expected deletes</small></div></div>
<div id="phase" class="phase">Preparing</div>
<div class="progress"><div id="bar" class="bar"></div></div>
<div class="status-grid">
<div class="status-card"><span>Processed</span><strong id="processed">0 / ${prepared.total}</strong></div>
<div class="status-card"><span>Remaining</span><strong id="remaining">${prepared.total}</strong></div>
<div class="status-card"><span>Creates</span><strong id="created">0 / ${prepared.creates}</strong></div>
<div class="status-card"><span>Updates</span><strong id="updated">0 / ${prepared.updates}</strong></div>
<div class="status-card"><span>Deletes</span><strong id="deleted">0 / ${prepared.deletes}</strong></div>
<div class="status-card"><span>Retries</span><strong id="retries">0</strong></div>
<div class="status-card wide"><span>Current operation</span><strong id="currentOperation">Queue prepared</strong></div>
<div class="status-card"><span>Queue status</span><strong id="queueStatus">Prepared</strong></div>
<div class="status-card"><span>Attempts</span><strong id="attempts">0</strong></div>
</div>
<div id="error" class="error"></div>
<div class="buttons"><button id="start" class="primary">Start Sync</button><button id="refresh" class="secondary">Refresh</button><button class="secondary" onclick="google.script.host.close()">Close</button></div>
<script>
(function(){
var start=document.getElementById('start'),refresh=document.getElementById('refresh'),phase=document.getElementById('phase'),bar=document.getElementById('bar'),error=document.getElementById('error'),timer=null;
var expected={total:${prepared.total},creates:${prepared.creates},updates:${prepared.updates},deletes:${prepared.deletes}};
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
start.onclick=function(){start.disabled=true;error.style.display='none';phase.textContent='Running — scheduling execution worker';google.script.run.withSuccessHandler(function(){poll();if(!timer)timer=setInterval(poll,2000);}).withFailureHandler(fail).startReviewedCalendarSyncExecution();};
refresh.onclick=poll;
poll();
})();
</script></body></html>`).setWidth(760).setHeight(670);
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
      total: state.total,
      creates: Number(state.expectedCreates || 0),
      updates: Number(state.expectedUpdates || 0),
      deletes: Number(state.expectedDeletes || 0),
      preparedAt: state.updatedAt
    };
  }
  return prepareReviewedCalendarSyncWindow_();
}
