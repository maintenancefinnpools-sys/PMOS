/**
 * PMOS v1.9.0 — Unified job task windows and retry handling.
 * Move-only refactor: public names and operational behavior are preserved.
 */

function showCalendarAuditTaskWindow() {
  showPmosTaskWindow_('CALENDAR_AUDIT', 'Calendar Plan Audit');
}

function showCalendarStatusTaskWindow() {
  showPmosTaskWindow_('CALENDAR_STATUS', 'Calendar Status');
}

function showVerifyCalendarTaskWindow() {
  showPmosTaskWindow_('VERIFY_CALENDAR', 'Verify Calendar');
}

function showCustomerSyncTaskWindow() {
  showPmosTaskWindow_('CUSTOMER_SYNC', 'Sync Customer Database');
}

function showMapExportTaskWindow() {
  showPmosTaskWindow_('MAP_EXPORT', 'Export Updated Map Layers');
}

function showPmosTaskWindow_(taskType, taskTitle) {
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}
    h2{margin:0 0 5px}.muted{font-size:13px;color:#6b7280}
    .stage{margin-top:16px;font-weight:700}
    .barShell{height:16px;background:#e5e7eb;border-radius:9px;overflow:hidden;margin-top:9px;position:relative}
    .bar{height:100%;width:35%;background:#2563eb;position:absolute;animation:move 1.25s infinite ease-in-out;border-radius:9px}
    @keyframes move{0%{left:-35%}100%{left:100%}}
    .elapsed{text-align:right;font-size:13px;margin-top:5px;color:#4b5563}
    .result{margin-top:14px;padding:12px;background:#f3f4f6;border-radius:9px;white-space:pre-line;max-height:330px;overflow:auto}
    .buttons{display:flex;gap:8px;margin-top:14px}
    button{border:0;border-radius:8px;padding:9px 13px;font-weight:600;cursor:pointer}
    .primary{background:#2563eb;color:white}
    .secondary{background:#e5e7eb;color:#111827}
    .opening{background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;cursor:default}
    .complete .bar{width:100%;left:0;animation:none}.failed .bar{width:100%;left:0;animation:none}
  </style>
</head>
<body id="body">
  <h2>${escapeHtml_(taskTitle)}</h2>
  <div class="muted">This window remains active while PMOS completes the operation.</div>
  <div id="stage" class="stage">Working…</div>
  <div class="barShell"><div id="bar" class="bar"></div></div>
  <div id="elapsed" class="elapsed">Elapsed: 0s</div>
  <div id="result" class="result">Starting ${escapeHtml_(taskTitle)}…</div>
  <div class="buttons">
    <button id="syncButton" class="primary" style="display:none" onclick="openCalendarSync()">Open Calendar Sync</button>
    <button class="secondary" onclick="google.script.host.close()">Close</button>
  </div>
<script>
const body=document.getElementById('body');
const stage=document.getElementById('stage');
const elapsed=document.getElementById('elapsed');
const result=document.getElementById('result');
const syncButton=document.getElementById('syncButton');
const started=Date.now();
const clock=setInterval(()=>{elapsed.textContent='Elapsed: '+Math.floor((Date.now()-started)/1000)+'s';},1000);
google.script.run
  .withSuccessHandler(function(response){
    clearInterval(clock);body.classList.add('complete');stage.textContent='Complete';
    elapsed.textContent='Duration: '+Math.max(1,Math.round((Date.now()-started)/1000))+'s';
    result.textContent=response.summary||'Task completed.';
    if('${taskType}'==='CALENDAR_AUDIT' && response.canSync){syncButton.style.display='inline-block';}
  })
  .withFailureHandler(function(error){
    clearInterval(clock);body.classList.add('failed');stage.textContent='Needs attention';
    result.textContent=error&&error.message?error.message:String(error);
  })
  .runPmosTask('${taskType}');
function openCalendarSync(){
  syncButton.disabled=true;
  syncButton.className='opening';
  syncButton.textContent='Opening Calendar Sync…';
  stage.textContent='Opening Calendar Sync';
  google.script.run
    .withSuccessHandler(function(){google.script.host.close();})
    .withFailureHandler(function(error){
      syncButton.disabled=false;
      syncButton.className='primary';
      syncButton.textContent='Open Calendar Sync';
      stage.textContent='Complete';
      alert(error&&error.message?error.message:String(error));
    })
    .openOriginalCalendarSyncFromCompletedAudit();
}
</script>
</body>
</html>`)
    .setWidth(610)
    .setHeight(540);

  SpreadsheetApp.getUi().showModalDialog(html, taskTitle);
}

function openOriginalCalendarSyncFromCompletedAudit() {
  showPmosJobEngine('CALENDAR_SYNC');
  return true;
}

function runPmosTask_(taskType) {
  return withSpreadsheetServiceRetry_(
    () => {
      switch (taskType) {
        case 'CALENDAR_AUDIT': {
          const audit = runCalendarPlanAudit_();
          return {
            canSync: Boolean(audit.canSync),
            summary: [
              `Calendar Plan Audit complete.`,
              `Expected recurring series: ${audit.uniqueSeriesCount}`,
              `Blocking errors: ${audit.errorCount}`,
              `Warnings: ${audit.warningCount}`,
              audit.canSync
                ? 'Calendar Sync and Rebuild are permitted.'
                : 'Calendar Sync and Rebuild remain blocked until errors are repaired.'
            ].join('\n')
          };
        }

        case 'CALENDAR_STATUS': {
          const preview = previewCalendarChanges();
          const registry = getSeriesRegistry_();
          return {
            summary: [
              'Calendar Status complete.',
              `Registered recurring series: ${Object.keys(registry).length}`,
              `Creates pending: ${preview.creates || 0}`,
              `Updates pending: ${preview.updates || 0}`,
              `Removals pending: ${preview.deletes || 0}`
            ].join('\n')
          };
        }

        case 'VERIFY_CALENDAR': {
          const result = executeVerifyCalendarJob_();
          return { summary: `Verification complete.\n${result.summary}` };
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
    },
    `running ${taskType}`
  );
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
      const transient =
        /Service Spreadsheets failed/i.test(message) ||
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
