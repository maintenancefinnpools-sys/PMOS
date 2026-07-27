/**
 * Calendar Audit sync-launch feedback.
 * Keeps the existing audit data and actions while making the Calendar Sync
 * launch state immediately visible to the user.
 */

function showCalendarPlanAudit() {
  const audit = runCalendarPlanAudit_();
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}
    h2{margin:0 0 6px}.muted{color:#6b7280;font-size:13px}
    .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}
    .card{padding:10px;border-radius:9px;background:#f3f4f6}
    .good{background:#dcfce7;color:#166534}.bad{background:#fee2e2;color:#991b1b}
    .warn{background:#fef3c7;color:#92400e}
    .issue{border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:10px 0}
    .issue h4{margin:0 0 6px}.meta{font-size:13px;white-space:pre-line;color:#4b5563}
    button{border:0;border-radius:7px;padding:8px 11px;font-weight:600;cursor:pointer;margin:7px 5px 0 0}
    .primary{background:#2563eb;color:white}.secondary{background:#e5e7eb;color:#1f2937}.danger{background:#fee2e2;color:#991b1b}
    button.loading,button:disabled{background:#e5e7eb!important;color:#6b7280!important;cursor:default}
    .launch-status{display:none;margin-top:9px;padding:8px 10px;border-radius:7px;background:#f3f4f6;color:#4b5563;font-size:12px}
    .launch-status.visible{display:block}
    .footer{position:sticky;bottom:0;background:white;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:14px}
  </style>
</head>
<body>
  <h2>Calendar Plan Audit</h2>
  <div class="muted">Nothing is written to Google Calendar during this audit.</div>

  <div class="summary">
    <div class="card"><b>${audit.customerCount}</b><br><small>customers</small></div>
    <div class="card"><b>${audit.uniqueSeriesCount}</b><br><small>unique series</small></div>
    <div class="card ${audit.canSync ? 'good' : 'bad'}"><b>${audit.errorCount}</b><br><small>blocking errors</small></div>
    <div class="card ${audit.warningCount ? 'warn' : 'good'}"><b>${audit.warningCount}</b><br><small>warnings</small></div>
    <div class="card"><b>${audit.routeRowCount}</b><br><small>route rows</small></div>
    <div class="card"><b>${audit.expectedByFrequency.total}</b><br><small>frequency estimate</small></div>
  </div>

  <div>
    ${audit.issues.length ? audit.issues.map(issue => `
      <div class="issue">
        <h4>${escapeHtmlClient_(issue.title)}</h4>
        <div class="meta">${escapeHtmlClient_(issue.details)}</div>
        ${issue.row ? `<button class="secondary" onclick="openRow(${issue.row})">Go to row ${issue.row}</button>` : ''}
        ${issue.fix === 'REN_NUMBER' ? `<button class="primary" onclick="renumber()">Renumber stops</button>` : ''}
        ${issue.fix === 'ASSIGN_IDS' ? `<button class="primary" onclick="assignIds()">Assign missing IDs</button>` : ''}
      </div>
    `).join('') : `<div class="card good"><b>Calendar plan verified.</b><br>No blocking errors were found.</div>`}
  </div>

  <div class="footer">
    <button class="secondary" onclick="refreshAudit()">Run Audit Again</button>
    ${audit.canSync ? `<button id="syncButton" class="primary" onclick="openSync()">Open Calendar Sync</button>` : ''}
    <button class="secondary" onclick="google.script.host.close()">Close</button>
    <div id="launchStatus" class="launch-status">Calendar Sync selected. Loading the PMOS Job Engine…</div>
  </div>

<script>
function escapeHtmlClient_(value){
  return String(value||'').replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function openRow(row){ google.script.run.activateRouteRow(row); }
function renumber(){ google.script.run.withSuccessHandler(refreshAudit).auditFixRouteNumbers(); }
function assignIds(){ google.script.run.withSuccessHandler(refreshAudit).auditFixCustomerIds(); }
function refreshAudit(){ google.script.host.close(); google.script.run.showCalendarPlanAudit(); }
function setSyncLoading_(loading){
  var button=document.getElementById('syncButton');
  var status=document.getElementById('launchStatus');
  if(!button)return;
  button.disabled=Boolean(loading);
  button.className=loading?'loading':'primary';
  button.textContent=loading?'Opening Calendar Sync…':'Open Calendar Sync';
  if(status)status.className=loading?'launch-status visible':'launch-status';
}
function openSync(){
  setSyncLoading_(true);
  google.script.run
    .withSuccessHandler(function(){
      window.setTimeout(function(){ google.script.host.close(); },250);
    })
    .withFailureHandler(function(error){
      setSyncLoading_(false);
      alert(error&&error.message?error.message:String(error));
    })
    .openCalendarSyncFromAudit();
}
</script>
</body>
</html>`).setWidth(760).setHeight(700);

  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Calendar Plan Audit');
}

function openCalendarSyncFromAudit_() {
  const audit = runCalendarPlanAudit_();
  if (!audit.canSync) {
    throw new Error(`Calendar Plan Audit still has ${audit.errorCount} blocking error(s).`);
  }

  const today = Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
  try {
    if (typeof saveCalendarSyncEffectiveDate === 'function') {
      saveCalendarSyncEffectiveDate(today);
    } else {
      PropertiesService.getDocumentProperties().setProperty('PMOS_CALENDAR_SYNC_EFFECTIVE_DATE', today);
    }
  } catch (ignored) {}

  if (typeof showIntegratedPmosJobEngine === 'function') {
    showIntegratedPmosJobEngine('CALENDAR_SYNC');
  } else {
    showPmosJobEngineFor_('CALENDAR_SYNC');
  }
  return {summary:'Calendar Sync selected. PMOS Job Engine opened.',selectedType:'CALENDAR_SYNC',effectiveDate:today};
}
