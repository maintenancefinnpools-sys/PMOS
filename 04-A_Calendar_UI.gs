/**
 * PMOS v1.9.0 — Calendar synchronization user interface.
 * Move-only refactor: public names and operational behavior are preserved.
 */

function showCalendarSyncDialog() {
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}
    h2{margin:0 0 6px}.muted{color:#6b7280;font-size:13px}
    .status{margin-top:14px;padding:12px;border-radius:10px;background:#f3f4f6;white-space:pre-line}
    .progress{width:100%;height:14px;background:#e5e7eb;border-radius:8px;overflow:hidden;margin-top:12px}
    .bar{height:100%;width:0;background:#2563eb;transition:width .2s}
    .buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
    button{border:0;border-radius:8px;padding:9px 13px;font-weight:600;cursor:pointer}
    .primary{background:#2563eb;color:white}.secondary{background:#e5e7eb}.danger{background:#fee2e2;color:#991b1b}
    button:disabled{opacity:.5;cursor:default}.error{display:none;margin-top:10px;padding:10px;border-radius:8px;background:#fee2e2;color:#991b1b;white-space:pre-wrap}
  </style>
</head>
<body>
  <h2>PMOS Calendar Sync</h2>
  <div class="muted">Water Maintenance Routes · 40 recurring-series changes per batch</div>
  <div id="status" class="status">Checking Calendar status…</div>
  <div class="progress"><div id="bar" class="bar"></div></div>
  <div id="error" class="error"></div>


  <div class="buttons">
    <button id="nextButton" class="primary" onclick="runOneBatch()">Continue Sync</button>
    <button id="autoButton" class="primary" onclick="startAutoContinue()">Auto Continue</button>
    <button id="pauseButton" class="danger" onclick="pauseAutoContinue()">Pause Auto Continue</button>
    <button class="secondary" onclick="google.script.host.close()">Close</button>
  </div>


<script>
let originalTotal=0;
let running=false;
let pollTimer=null;


function showError(message){
  error.style.display='block';
  error.textContent=message||'Unknown error';
}


function clearError(){
  error.style.display='none';
  error.textContent='';
}


function updateProgress(remaining){
  if(!originalTotal){
    bar.style.width=remaining?'0%':'100%';
    return;
  }
  const completed=Math.max(0,originalTotal-remaining);
  bar.style.width=Math.min(100,Math.round(completed/originalTotal*100))+'%';
}


function renderState(state){
  const total=state.remaining||0;
  if(!originalTotal && state.originalTotal) originalTotal=state.originalTotal;


  status.textContent =
    'Job status: '+state.status+'\\n'+
    'Remaining changes: '+total+'\\n'+
    'Last batch created: '+(state.lastCreated||0)+'\\n'+
    'Last batch updated: '+(state.lastUpdated||0)+'\\n'+
    'Last batch removed: '+(state.lastDeleted||0)+'\\n'+
    'Last batch errors: '+(state.lastErrors||0)+'\\n'+
    (state.nextRunAt ? 'Next automatic batch: '+state.nextRunAt : '');


  updateProgress(total);


  nextButton.disabled=running || state.status==='Running';
  autoButton.disabled=running || state.autoEnabled;
  pauseButton.disabled=!state.autoEnabled;


  if(state.lastError) showError(state.lastError);
  if(!total && state.status==='Complete'){
    status.textContent='Calendar synchronization is complete.\\nAll recurring series are current.';
    updateProgress(0);
  }
}


function refreshState(){
  google.script.run
    .withSuccessHandler(renderState)
    .withFailureHandler(function(e){showError(e&&e.message?e.message:String(e));})
    .getCalendarAutoSyncStatus();
}


function runOneBatch(){
  if(running)return;
  clearError();
  running=true;
  nextButton.disabled=true;
  status.textContent='Synchronizing the next batch…';


  google.script.run
    .withSuccessHandler(function(result){
      running=false;
      refreshState();
    })
    .withFailureHandler(function(e){
      running=false;
      showError(e&&e.message?e.message:String(e));
      refreshState();
    })
    .runCalendarSyncBatchNow();
}


function startAutoContinue(){
  clearError();
  google.script.run
    .withSuccessHandler(function(){
      refreshState();
    })
    .withFailureHandler(function(e){
      showError(e&&e.message?e.message:String(e));
    })
    .startCalendarAutoContinue();
}


function pauseAutoContinue(){
  google.script.run
    .withSuccessHandler(function(){
      refreshState();
    })
    .withFailureHandler(function(e){
      showError(e&&e.message?e.message:String(e));
    })
    .pauseCalendarAutoContinue();
}


refreshState();
pollTimer=setInterval(refreshState,10000);
</script>
</body>
</html>`)
    .setWidth(540)
    .setHeight(540);


  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Calendar Sync');
}

