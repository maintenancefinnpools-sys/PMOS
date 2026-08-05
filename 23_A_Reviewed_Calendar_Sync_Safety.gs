/** Guarded handoff from Calendar Review into resumable Calendar Sync. */
function openSafeReviewedCalendarSyncPreview_() {
  const prepared = prepareReviewedCalendarSyncWindow_();
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}h2{margin:0 0 6px}.muted{font-size:13px;color:#6b7280}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.card{padding:11px;border-radius:9px;background:#f3f4f6}.card b{font-size:20px}.ready{background:#dcfce7;color:#166534}.status{padding:12px;border-radius:9px;background:#f8fafc;border:1px solid #e5e7eb;white-space:pre-wrap;font-size:13px;line-height:1.5}.progress{height:14px;background:#e5e7eb;border-radius:8px;overflow:hidden;margin:12px 0}.bar{height:100%;width:0;background:#2563eb;transition:width .25s}.error{display:none;margin-top:10px;padding:10px;background:#fee2e2;color:#991b1b;border-radius:8px;white-space:pre-wrap}.buttons{display:flex;gap:8px;margin-top:16px}button{border:0;border-radius:8px;padding:9px 13px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e5e7eb;color:#111827}button:disabled{opacity:.5;cursor:default}
</style></head><body>
<h2>Calendar Sync</h2><div class="muted">The reviewed Calendar plan is validated and queued. No Calendar changes have started.</div>
<div class="summary"><div class="card ready"><b>${prepared.total}</b><br><small>Total operations</small></div><div class="card"><b>${prepared.creates}</b><br><small>Creates</small></div><div class="card"><b>${prepared.updates}</b><br><small>Updates</small></div><div class="card"><b>${prepared.deletes}</b><br><small>Deletes</small></div></div>
<div id="status" class="status">Prepared. No Calendar changes have started.</div><div class="progress"><div id="bar" class="bar"></div></div><div id="error" class="error"></div>
<div class="buttons"><button id="start" class="primary">Start Sync</button><button id="refresh" class="secondary">Refresh</button><button class="secondary" onclick="google.script.host.close()">Close</button></div>
<script>
(function(){var start=document.getElementById('start'),refresh=document.getElementById('refresh'),status=document.getElementById('status'),bar=document.getElementById('bar'),error=document.getElementById('error'),timer=null;
function fail(e){error.style.display='block';error.textContent=e&&e.message?e.message:String(e);start.disabled=false;refresh.disabled=false;}
function render(s){s=s||{};var total=Number(s.total||${prepared.total}),processed=Number(s.processed||0),remaining=s.remaining==null?Math.max(0,total-processed):Number(s.remaining),percent=total?Math.round(processed/total*100):0;if(s.status==='Complete')percent=100;bar.style.width=Math.max(0,Math.min(100,percent))+'%';status.textContent=['Status: '+(s.status||'Prepared'),'Phase: '+(s.phase||'Ready to start'),'Progress: '+processed+' / '+total+' ('+percent+'%)','Remaining: '+remaining,'Created: '+Number(s.created||0),'Updated: '+Number(s.updated||0),'Deleted: '+Number(s.deleted||0),s.currentOperation?'Current operation: '+s.currentOperation:''].filter(Boolean).join('\n');error.style.display=s.lastError?'block':'none';error.textContent=s.lastError||'';var active=['Scheduled','Running'].indexOf(s.status)>=0;start.disabled=active||s.status==='Complete'||s.status==='Paused on error';start.textContent=s.status==='Complete'?'Complete':active?'Running…':'Start Sync';if((s.status==='Complete'||s.status==='Paused on error')&&timer){clearInterval(timer);timer=null;}}
function poll(){google.script.run.withSuccessHandler(render).withFailureHandler(fail).getReviewedCalendarSyncStatus();}
start.onclick=function(){start.disabled=true;error.style.display='none';status.textContent='Scheduling Calendar Sync…';google.script.run.withSuccessHandler(function(s){render(s);if(!timer)timer=setInterval(poll,2000);}).withFailureHandler(fail).startReviewedCalendarSyncExecution();};
refresh.onclick=poll;poll();
})();
</script></body></html>`).setWidth(700).setHeight(540);
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
