/**
 * Calendar Job Engine workflow fixes.
 *
 * - Calendar Sync receives an effective date, defaulting to today.
 * - Reconcile Calendar runs as a resumable batched job.
 * - Auto Continue works for both Calendar Sync and Reconcile.
 * - The Job Engine is modeless so Job History can close independently.
 */

const PMOS_SYNC_EFFECTIVE_DATE_KEY = 'PMOS_CALENDAR_SYNC_EFFECTIVE_DATE';
const PMOS_RECONCILE_JOB_KEY = 'PMOS_RECONCILE_BATCH_JOB_V1';
const PMOS_RECONCILE_BATCH_SIZE = 40;
const PMOS_RECONCILE_TRIGGER_HANDLER = 'continueBatchedCalendarReconcile';

function saveCalendarSyncEffectiveDate(value) {
  const date = parseRepairDate_(value, 'Calendar Sync effective date');
  const text = Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd');
  const properties = PropertiesService.getDocumentProperties();
  properties.setProperty(PMOS_SYNC_EFFECTIVE_DATE_KEY, text);
  properties.setProperty(PMOS_CALENDAR_EFFECTIVE_DATE_KEY, text);
  return {effectiveDate: text};
}

function getCalendarSyncEffectiveDate_() {
  return PropertiesService.getDocumentProperties().getProperty(PMOS_SYNC_EFFECTIVE_DATE_KEY) ||
    Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
}

function startCalendarSyncFromDate(effectiveDate, autoContinue) {
  const saved = saveCalendarSyncEffectiveDate(effectiveDate);
  const result = startPmosJob('CALENDAR_SYNC', Boolean(autoContinue), false) || {};
  result.effectiveDate = saved.effectiveDate;
  result.summary = [
    result.summary || 'Calendar Sync started.',
    `Effective date: ${saved.effectiveDate}`,
    autoContinue ? 'Auto Continue is enabled.' : 'Run One Batch mode is enabled.'
  ].join('\n');
  return result;
}

function readBatchedReconcileJob_() {
  const text = PropertiesService.getDocumentProperties().getProperty(PMOS_RECONCILE_JOB_KEY);
  if (!text) return null;
  try { return JSON.parse(text); } catch (error) { return null; }
}

function writeBatchedReconcileJob_(job) {
  PropertiesService.getDocumentProperties().setProperty(PMOS_RECONCILE_JOB_KEY, JSON.stringify(job));
  return job;
}

function clearBatchedReconcileTriggers_() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === PMOS_RECONCILE_TRIGGER_HANDLER) ScriptApp.deleteTrigger(trigger);
  });
}

function scheduleBatchedReconcileContinuation_() {
  clearBatchedReconcileTriggers_();
  ScriptApp.newTrigger(PMOS_RECONCILE_TRIGGER_HANDLER).timeBased().after(60 * 1000).create();
}

function startBatchedCalendarReconcile(effectiveDate, autoContinue, confirmed) {
  if (confirmed !== true) throw new Error('Reconcile Calendar requires confirmation.');
  const date = parseCalendarEffectiveDate_(effectiveDate);
  const dateText = Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd');
  clearBatchedReconcileTriggers_();
  writeBatchedReconcileJob_({
    type: 'RECONCILE_FUTURE',
    label: 'Reconcile Calendar',
    status: 'Running',
    phase: 'delete',
    effectiveDate: dateText,
    autoContinue: Boolean(autoContinue),
    created: 0,
    removed: 0,
    errors: [],
    planIndex: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSummary: 'Reconcile Calendar initialized.'
  });
  return runBatchedCalendarReconcile_();
}

function continueBatchedCalendarReconcile() {
  clearBatchedReconcileTriggers_();
  return runBatchedCalendarReconcile_();
}

function runBatchedCalendarReconcile_() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) {
    const busyJob = readBatchedReconcileJob_();
    if (busyJob && busyJob.autoContinue) scheduleBatchedReconcileContinuation_();
    return getBatchedCalendarReconcileStatus();
  }

  try {
    const job = readBatchedReconcileJob_();
    if (!job) throw new Error('No Reconcile Calendar job is initialized.');
    if (job.status === 'Paused' || job.status === 'Complete' || job.status === 'Cancelled') return formatBatchedReconcileStatus_(job);

    const effectiveDate = parseRepairDate_(job.effectiveDate, 'Effective date');
    const preview = buildFutureReconcilePreview_(effectiveDate);
    let processed = 0;

    if (job.phase === 'delete') {
      const remaining = preview.managedOccurrences
        .filter(event => event.getStartTime().getTime() >= effectiveDate.getTime())
        .slice(0, PMOS_RECONCILE_BATCH_SIZE);

      remaining.forEach(event => {
        try {
          event.deleteEvent();
          job.removed++;
        } catch (error) {
          job.errors.push(`Delete ${event.getTitle()}: ${error}`);
        }
        processed++;
      });

      if (!remaining.length) {
        clearRecurringSeriesRegistry_();
        job.phase = 'create';
        job.planIndex = 0;
        job.lastSummary = 'Future PMOS events removed. Beginning recurring-series creation.';
      } else {
        job.lastSummary = `Deleted ${processed} future Calendar occurrence(s) in this batch.`;
      }
    }

    if (job.phase === 'create' && processed < PMOS_RECONCILE_BATCH_SIZE) {
      const plans = preview.plans;
      const allowance = PMOS_RECONCILE_BATCH_SIZE - processed;
      const batch = plans.slice(job.planIndex, job.planIndex + allowance);

      batch.forEach(plan => {
        try {
          const series = createRecurringSeries_(preview.calendar, plan);
          upsertSeriesRegistry_(plan, series.getId(), preview.calendar.getName(), 'Current');
          job.created++;
        } catch (error) {
          job.errors.push(`Create ${plan.title}: ${error}`);
        }
        job.planIndex++;
        processed++;
      });

      if (job.planIndex >= plans.length) {
        job.phase = 'complete';
        job.status = job.errors.length ? 'Complete with errors' : 'Complete';
        job.completedAt = new Date().toISOString();
        job.lastSummary = `Reconcile Calendar complete. Removed ${job.removed}; created ${job.created}; errors ${job.errors.length}.`;
        PropertiesService.getDocumentProperties().setProperty(PMOS_CALENDAR_EFFECTIVE_DATE_KEY, job.effectiveDate);
        updateSyncStatus_(
          job.errors.length ? 'Synchronization error' : 'Everything synchronized',
          job.lastSummary
        );
        clearBatchedReconcileTriggers_();
      } else {
        job.lastSummary = `Created ${batch.length} recurring series in this batch. ${plans.length - job.planIndex} remain.`;
      }
    }

    job.updatedAt = new Date().toISOString();
    writeBatchedReconcileJob_(job);

    if (job.autoContinue && job.status === 'Running') scheduleBatchedReconcileContinuation_();
    return formatBatchedReconcileStatus_(job);
  } finally {
    lock.releaseLock();
  }
}

function pauseBatchedCalendarReconcile() {
  const job = readBatchedReconcileJob_();
  if (!job) return {summary: 'No Reconcile Calendar job is active.', status: 'Idle'};
  job.status = 'Paused';
  job.autoContinue = false;
  job.updatedAt = new Date().toISOString();
  job.lastSummary = 'Reconcile Calendar paused.';
  writeBatchedReconcileJob_(job);
  clearBatchedReconcileTriggers_();
  return formatBatchedReconcileStatus_(job);
}

function resumeBatchedCalendarReconcile(autoContinue) {
  const job = readBatchedReconcileJob_();
  if (!job) throw new Error('No paused Reconcile Calendar job was found.');
  if (job.status === 'Complete' || job.status === 'Complete with errors') return formatBatchedReconcileStatus_(job);
  job.status = 'Running';
  job.autoContinue = Boolean(autoContinue);
  job.updatedAt = new Date().toISOString();
  writeBatchedReconcileJob_(job);
  return runBatchedCalendarReconcile_();
}

function getBatchedCalendarReconcileStatus() {
  const job = readBatchedReconcileJob_();
  return job ? formatBatchedReconcileStatus_(job) : {
    type: 'RECONCILE_FUTURE',
    label: 'Reconcile Calendar',
    status: 'Idle',
    phase: 'idle',
    processedItems: 0,
    remaining: null,
    originalTotal: 0,
    summary: 'No Reconcile Calendar job is active.'
  };
}

function formatBatchedReconcileStatus_(job) {
  const effectiveDate = parseRepairDate_(job.effectiveDate, 'Effective date');
  const preview = buildFutureReconcilePreview_(effectiveDate);
  const createRemaining = Math.max(0, preview.plans.length - Number(job.planIndex || 0));
  const deleteRemaining = job.phase === 'delete' ? preview.managedOccurrences.length : 0;
  const remaining = deleteRemaining + createRemaining;
  const processedItems = Number(job.removed || 0) + Number(job.created || 0);
  const originalTotal = processedItems + remaining;
  return {
    type: 'RECONCILE_FUTURE',
    label: 'Reconcile Calendar',
    status: job.status,
    phase: job.phase,
    effectiveDate: job.effectiveDate,
    autoContinue: Boolean(job.autoContinue),
    removed: Number(job.removed || 0),
    created: Number(job.created || 0),
    errors: (job.errors || []).length,
    processedItems,
    remaining,
    originalTotal,
    lastSummary: job.lastSummary || '',
    summary: [
      `Job: Reconcile Calendar`,
      `Status: ${job.status}`,
      `Effective date: ${job.effectiveDate}`,
      `Phase: ${job.phase}`,
      `Future occurrences removed: ${Number(job.removed || 0)}`,
      `Recurring series created: ${Number(job.created || 0)}`,
      `Remaining work: ${remaining}`,
      `Errors: ${(job.errors || []).length}`,
      job.lastSummary || ''
    ].filter(Boolean).join('\n')
  };
}

function showIntegratedPmosJobEngine(initialType) {
  ensurePmosJobHistorySheet_();
  const today = Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
  const syncDate = getCalendarSyncEffectiveDate_();
  const remembered = PropertiesService.getUserProperties().getProperty('PMOS_LAST_INTEGRATED_JOB_TYPE') || '';
  const selected = initialType || remembered || 'CALENDAR_STATUS';
  const savedRepairPlan = readRepairPlan_();
  const savedRepairStart = savedRepairPlan && savedRepairPlan.start ? savedRepairPlan.start : '';
  const savedRepairEnd = savedRepairPlan && savedRepairPlan.end ? savedRepairPlan.end : today;

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{margin:0;padding:18px;font-family:Arial,sans-serif;color:#1f2937;background:#fff}h2{margin:0 0 5px}.muted{color:#6b7280;font-size:13px}.layout{display:grid;grid-template-columns:250px 1fr;gap:14px;margin-top:15px}.jobs{display:flex;flex-direction:column;gap:7px}.job{width:100%;padding:11px 12px;font:inherit;font-weight:700;text-align:left;background:#fff;border:2px solid #e5e7eb;border-radius:9px;cursor:pointer}.job.selected{color:#1d4ed8;background:#eff6ff;border-color:#2563eb}.panel{display:flex;min-height:475px;padding:14px;flex-direction:column;border:1px solid #e5e7eb;border-radius:10px}.purpose{min-height:62px;line-height:1.45}.fields{display:none;margin-top:10px;padding:11px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:9px}.field-row{display:flex;gap:12px;flex-wrap:wrap}.field{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700}.field input{padding:7px;border:1px solid #cbd5e1;border-radius:7px}.auto-note{display:none;margin-top:9px;padding:8px 10px;color:#166534;font-size:12px;background:#dcfce7;border-radius:7px}.status{min-height:150px;margin-top:12px;padding:12px;background:#f3f4f6;border-radius:9px;white-space:pre-line;line-height:1.45;font-size:13px}.progress{height:14px;margin-top:10px;overflow:hidden;background:#e5e7eb;border-radius:8px}.bar{width:0;height:100%;background:#2563eb}.error{display:none;margin-top:10px;padding:10px;color:#991b1b;background:#fee2e2;border-radius:8px;white-space:pre-wrap}.buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:14px}button.action{padding:9px 12px;font-weight:700;border:0;border-radius:8px;cursor:pointer}.primary{color:#fff;background:#2563eb}.secondary{background:#e5e7eb}.danger{color:#991b1b;background:#fee2e2}button:disabled{opacity:.45}
</style></head><body>
<h2>PMOS Job Engine</h2><div class="muted">Select an operation, review its purpose, then run it.</div>
<div class="layout"><div class="jobs">
<button class="job" data-type="CALENDAR_STATUS" onclick="selectJob(this)">Calendar Status</button>
<button class="job" data-type="VERIFY_CALENDAR" onclick="selectJob(this)">Verify Calendar</button>
<button class="job" data-type="CALENDAR_SYNC" onclick="selectJob(this)">Calendar Sync</button>
<button class="job" data-type="RECONCILE_FUTURE" onclick="selectJob(this)">Reconcile Calendar</button>
<button class="job" data-type="CALENDAR_REPAIR" onclick="selectJob(this)">Calendar Repair</button>
<button class="job" data-type="CUSTOMER_SYNC" onclick="selectJob(this)">Customer Database Sync</button>
<button class="job" data-type="MAP_EXPORT" onclick="selectJob(this)">Export Map Layers</button>
</div><div class="panel"><h3 id="selectedTitle">Purpose</h3><div id="purpose" class="purpose"></div>
<div id="syncFields" class="fields"><div class="field-row"><label class="field">Effective date<input id="syncEffectiveDate" type="date" value="${syncDate}"></label></div></div>
<div id="reconcileFields" class="fields"><div class="field-row"><label class="field">Effective date<input id="effectiveDate" type="date" value="${today}"></label></div></div>
<div id="repairFields" class="fields"><div class="field-row"><label class="field">Begin date<input id="repairStart" type="date" value="${savedRepairStart}"></label><label class="field">End date<input id="repairEnd" type="date" value="${savedRepairEnd}"></label></div></div>
<div id="autoNote" class="auto-note">Auto Continue runs the current batch immediately and schedules later batches automatically.</div><div id="statusBox" class="status">Ready.</div><div class="progress"><div id="progressBar" class="bar"></div></div><div id="errorBox" class="error"></div>
<div class="buttons"><button id="runButton" class="action primary" onclick="runSelected(false)">Run / Continue</button><button id="autoButton" class="action primary" onclick="runSelected(true)">Auto Continue</button><button id="previewButton" class="action secondary" onclick="previewSelected()">Preview</button><button id="expandButton" class="action secondary" onclick="expandRepair()">Expand Preview / Edit Route Order</button><button id="pauseButton" class="action danger" onclick="pauseJob()">Pause</button><button class="action secondary" onclick="refreshState(true)">Refresh</button><button class="action secondary" onclick="openHistory()">Job History</button><button class="action secondary" onclick="google.script.host.close()">Close</button></div>
</div></div><script>
var selectedType=${JSON.stringify(selected)},currentState={},busy=false;var savedRepairDates={start:${JSON.stringify(savedRepairStart)},end:${JSON.stringify(savedRepairEnd)}};
var jobs={CALENDAR_STATUS:{label:'Calendar Status',purpose:'View current synchronization status and progress.',supportsAuto:false,runLabel:'Refresh Status'},VERIFY_CALENDAR:{label:'Verify Calendar',purpose:'Compare the route template, registry, and Google Calendar.',supportsAuto:false,runLabel:'Run Verification'},CALENDAR_SYNC:{label:'Calendar Sync',purpose:'Update Google Calendar from the selected effective date using the current route template.',supportsAuto:true,runLabel:'Run One Batch'},RECONCILE_FUTURE:{label:'Reconcile Calendar',purpose:'Safely replace future PMOS Calendar work from the selected effective date through resumable batches.',supportsAuto:true,runLabel:'Run One Batch'},CALENDAR_REPAIR:{label:'Calendar Repair',purpose:'Add, remove, or rearrange visits within a selected date range.',supportsAuto:false,runLabel:'Apply Previewed Repair'},CUSTOMER_SYNC:{label:'Customer Database Sync',purpose:'Refresh customer information in the route template.',supportsAuto:false,runLabel:'Run Customer Sync'},MAP_EXPORT:{label:'Export Map Layers',purpose:'Generate current route-layer CSV files.',supportsAuto:false,runLabel:'Export Map Layers'}};
function byId(id){return document.getElementById(id)}function fail(e){busy=false;byId('errorBox').style.display='block';byId('errorBox').textContent=e&&e.message?e.message:String(e);updateButtons()}function showResult(r){busy=false;currentState=r||{};byId('errorBox').style.display='none';byId('statusBox').textContent=r&&r.summary?r.summary:String(r||'Complete.');updateProgress(r);updateButtons()}function updateProgress(s){var p=0;if(s&&String(s.status).indexOf('Complete')===0)p=100;else if(s&&s.originalTotal>0&&s.remaining!=null)p=Math.round((s.originalTotal-s.remaining)/s.originalTotal*100);byId('progressBar').style.width=Math.max(0,Math.min(100,p))+'%'}
function selectJob(button){selectedType=button.dataset.type;google.script.run.withFailureHandler(function(){}).rememberIntegratedPmosJobType(selectedType);renderSelection();refreshState(false)}
function renderSelection(){Array.prototype.forEach.call(document.getElementsByClassName('job'),function(b){b.className='job'+(b.dataset.type===selectedType?' selected':'')});var j=jobs[selectedType]||{};byId('selectedTitle').textContent=j.label||'Purpose';byId('purpose').textContent=j.purpose||'';byId('syncFields').style.display=selectedType==='CALENDAR_SYNC'?'block':'none';byId('reconcileFields').style.display=selectedType==='RECONCILE_FUTURE'?'block':'none';byId('repairFields').style.display=selectedType==='CALENDAR_REPAIR'?'block':'none';byId('autoNote').style.display=j.supportsAuto?'block':'none';updateButtons()}
function updateButtons(){var j=jobs[selectedType],repair=selectedType==='CALENDAR_REPAIR';byId('runButton').textContent=j?j.runLabel:'Run';byId('runButton').disabled=busy||!j;byId('autoButton').style.display=j&&j.supportsAuto?'inline-block':'none';byId('previewButton').style.display=(selectedType==='RECONCILE_FUTURE'||repair)?'inline-block':'none';byId('expandButton').style.display=repair?'inline-block':'none';byId('pauseButton').style.display=currentState&&currentState.status&&['Idle','Complete','Complete with errors','Cancelled'].indexOf(currentState.status)<0?'inline-block':'none'}
function dates(){return{start:byId('repairStart').value||savedRepairDates.start,end:byId('repairEnd').value||savedRepairDates.end}}function rememberRepairDates(d){if(!d.start||!d.end)return;savedRepairDates=d;google.script.run.withFailureHandler(function(){}).rememberCalendarRepairDates(d.start,d.end)}
function previewSelected(){busy=true;updateButtons();if(selectedType==='RECONCILE_FUTURE')google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).previewReconcileFutureCalendar(byId('effectiveDate').value);else{var d=dates();rememberRepairDates(d);google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).previewCalendarRepairPlan(d.start,d.end)}}
function expandRepair(){var d=dates();rememberRepairDates(d);busy=true;updateButtons();google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).openCalendarRepairBoard(d.start,d.end)}
function runSelected(autoMode){busy=true;byId('errorBox').style.display='none';updateButtons();if(selectedType==='CALENDAR_SYNC'){google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).startCalendarSyncFromDate(byId('syncEffectiveDate').value,Boolean(autoMode));return}if(selectedType==='RECONCILE_FUTURE'){var status=currentState&&currentState.type==='RECONCILE_FUTURE'?currentState:null;if(status&&status.status==='Paused'){google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).resumeBatchedCalendarReconcile(Boolean(autoMode));return}if(!confirm('Start future-only reconciliation from the selected effective date?')){busy=false;updateButtons();return}google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).startBatchedCalendarReconcile(byId('effectiveDate').value,Boolean(autoMode),true);return}if(selectedType==='CALENDAR_REPAIR'){var d=dates();rememberRepairDates(d);if(!confirm('Apply the current Calendar repair preview?')){busy=false;updateButtons();return}google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).applyCalendarRepairPlan(d.start,d.end);return}if(selectedType==='CUSTOMER_SYNC'){google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).runSmartCustomerDatabaseSync();return}if(selectedType==='CALENDAR_STATUS'){refreshState(true);return}google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).startPmosJob(selectedType,Boolean(autoMode),false)}
function refreshState(showBusy){if(showBusy){busy=true;updateButtons()}if(selectedType==='RECONCILE_FUTURE'){google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).getBatchedCalendarReconcileStatus();return}google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).getPmosJobStatus()}
function pauseJob(){busy=true;updateButtons();if(selectedType==='RECONCILE_FUTURE')google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).pauseBatchedCalendarReconcile();else google.script.run.withSuccessHandler(showResult).withFailureHandler(fail).pausePmosJob()}
function openHistory(){google.script.run.withFailureHandler(fail).showPmosJobHistory()}
renderSelection();refreshState(false);
</script></body></html>`).setWidth(900).setHeight(720);
  SpreadsheetApp.getUi().showModelessDialog(html, 'PMOS Job Engine');
}
