/**
 * Authoritative Calendar Sync preview for a completed Calendar Review Session.
 * Review Session -> ONE detailed preview -> Approve & Prepare -> Job Center.
 */
function openReviewedCalendarSyncPreview() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  if (!audit.reviewComplete) throw new Error('Calendar review is not complete. Finish all review items before opening Calendar Sync Preview.');

  // The audit snapshot is evidence for review completion, not an executable
  // plan. Rebuild now so ledger decisions are resolved against current verified
  // Calendar state and this dialog previews the exact plan preparation will use.
  const preview = previewPmosCalendarSyncPlan();
  if (String(preview.reviewSessionId || '') !== String(audit.reviewSessionId || '')) {
    throw new Error('Calendar review session changed before Sync Preview could be built. Run Calendar Plan Audit again.');
  }
  if (!preview || !preview.plan || !Array.isArray(preview.plan.operations)) throw new Error('Calendar Sync Preview could not build the reviewed operation plan.');

  const resolutionErrors = Number(preview.reviewResolutionErrors || 0);
  const executorPending = Boolean(preview.reviewExecutorPending);
  const operations = preview.plan.operations.filter(isPmosExecutableOperation).map(buildPmosCalendarSyncPreviewRow_);
  const reviewedActions = Array.isArray(preview.reviewedActions) ? preview.reviewedActions : [];
  const ignored = reviewedActions.filter(function(a){ return String(a.reviewAction || '').toLowerCase() === 'ignore'; }).length;
  const reviewed = {
    matches:Number(preview.reviewedMatches || 0),
    temporary:Number(preview.reviewedTemporaryVisits || 0),
    kept:Number(preview.reviewedKeeps || 0),
    ignored:ignored,
    deletions:Number(preview.reviewedDeletions || 0),
    errors:resolutionErrors,
    actions:reviewedActions
  };

  const rowsJson = JSON.stringify(operations).replace(/</g,'\\u003c');
  const reviewedJson = JSON.stringify(reviewed).replace(/</g,'\\u003c');
  const blockedText = resolutionErrors > 0 ? resolutionErrors + ' reviewed action(s) could not be resolved safely.' : executorPending ? 'Reviewed Calendar execution support is not connected yet.' : operations.length === 0 ? 'There are no executable Calendar changes to approve.' : '';

  const html = HtmlService.createHtmlOutput(`<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}html,body{height:100%}body{font-family:Arial,sans-serif;margin:0;color:#1f2937;display:flex;flex-direction:column;overflow:hidden;background:#fff}.content{padding:18px 18px 0;overflow:auto;flex:1;min-height:0}h2{margin:0 0 4px}.muted{font-size:13px;color:#64748b}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0}.metric,.reviewMetric{border:1px solid #e2e8f0;border-radius:8px;padding:9px;background:#f8fafc}.metric span,.reviewMetric span{display:block;font-size:11px;color:#64748b}.metric strong,.reviewMetric strong{display:block;margin-top:3px;font-size:17px}.reviewBox{border:1px solid #dbeafe;border-radius:10px;background:#f8fbff;margin:0 0 12px;overflow:hidden}.reviewHead{padding:10px 12px;font-weight:700;display:flex;justify-content:space-between;align-items:center;cursor:pointer}.reviewGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;padding:0 10px 10px}.reviewDetails{display:none;border-top:1px solid #dbeafe;padding:9px 12px;background:#fff}.reviewBox.open .reviewDetails{display:block}.reviewAction{font-size:12px;padding:7px 0;border-bottom:1px solid #eef2f7}.tools{display:flex;gap:8px;align-items:center;position:sticky;top:0;background:#fff;padding:8px 0;z-index:3}.tools input,.tools select{border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px}.tools input{flex:1;min-width:160px}.count{font-size:12px;color:#64748b;white-space:nowrap}.row{border:1px solid #e2e8f0;border-left:5px solid #64748b;border-radius:9px;margin:8px 0;background:#fff;overflow:hidden}.row.CREATE{border-left-color:#16a34a}.row.UPDATE{border-left-color:#2563eb}.row.DELETE{border-left-color:#dc2626}.head{display:grid;grid-template-columns:74px 1fr auto;gap:10px;align-items:center;padding:10px 12px;cursor:pointer}.badge{font-size:11px;font-weight:900}.title{font-weight:700}.summary{font-size:12px;color:#64748b;margin-top:3px}.details{display:none;border-top:1px solid #e2e8f0;padding:11px 12px;background:#f8fafc}.row.open .details{display:block}.compare{display:grid;grid-template-columns:1fr 1fr;gap:10px}.card{border:1px solid #e2e8f0;border-radius:8px;padding:9px;background:#fff}.card h4{margin:0 0 7px;font-size:12px}.line{font-size:12px;margin:4px 0;word-break:break-word}.label{color:#64748b}.reason{margin-top:9px;font-size:12px;color:#475569}.notice{margin:10px 0;padding:11px;border-radius:9px;background:#fef3c7;color:#92400e;font-weight:700}.empty{padding:18px;color:#64748b;text-align:center}.actions{display:flex;gap:8px;padding:12px 18px 14px;background:#fff;border-top:1px solid #e2e8f0;box-shadow:0 -4px 12px rgba(15,23,42,.06);flex:0 0 auto}button{border:0;border-radius:8px;padding:10px 13px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e2e8f0;color:#1f2937}button:disabled{opacity:.5;cursor:default}
</style></head><body><div class="content">
<h2>Calendar Sync Preview</h2><div class="muted">Review every proposed Calendar change for ${escapePmosSyncPreviewHtml_(preview.calendarName || '')}. Approval prepares this exact reviewed plan for execution in Job Center.</div>
<div class="metrics"><div class="metric"><span>Create</span><strong>${Number(preview.creates || 0)}</strong></div><div class="metric"><span>Update</span><strong>${Number(preview.updates || 0)}</strong></div><div class="metric"><span>Delete</span><strong>${Number(preview.deletes || 0)}</strong></div></div>
<div id="reviewBox" class="reviewBox"><div class="reviewHead" onclick="toggleReview()"><span>Reviewed Event Actions</span><span id="reviewChevron">▼</span></div><div id="reviewGrid" class="reviewGrid"></div><div id="reviewDetails" class="reviewDetails"></div></div>
${blockedText ? '<div class="notice">' + escapePmosSyncPreviewHtml_(blockedText) + '</div>' : ''}
<div class="tools"><input id="search" placeholder="Search customer, layer, series ID…"><select id="filter"><option value="ALL">All changes</option><option value="CREATE">Creates</option><option value="UPDATE">Updates</option><option value="DELETE">Deletes</option></select><span id="visibleCount" class="count"></span></div><div id="rows"></div></div>
<div class="actions"><button id="approve" class="primary" ${blockedText ? 'disabled' : ''}>Approve & Prepare Sync</button><button class="secondary" onclick="google.script.host.close()">Close</button></div>
<script>
const rows=${rowsJson},reviewed=${reviewedJson};
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderReview(){const items=[['Customer matches',reviewed.matches],['Temporary visits',reviewed.temporary],['Ignored / kept',reviewed.ignored+reviewed.kept],['Approved deletions',reviewed.deletions],['Resolution errors',reviewed.errors]];document.getElementById('reviewGrid').innerHTML=items.map(x=>'<div class="reviewMetric"><span>'+esc(x[0])+'</span><strong>'+Number(x[1]||0)+'</strong></div>').join('');const a=reviewed.actions||[];document.getElementById('reviewDetails').innerHTML=a.length?a.map(x=>'<div class="reviewAction"><b>'+esc(x.reviewAction||x.action||'Reviewed action')+'</b> — '+esc(x.customerName||x.title||x.seriesKey||'Calendar event')+(x.reason?' · '+esc(x.reason):'')+'</div>').join(''):'<div class="muted">No reviewed event actions were required for this sync.</div>';}
function toggleReview(){const b=document.getElementById('reviewBox');b.classList.toggle('open');document.getElementById('reviewChevron').textContent=b.classList.contains('open')?'▲':'▼';}
function recordCard(label,r){r=r||{};const values=[['Customer ID',r.customerId],['Layer',r.layer],['Title',r.title],['Start',r.start],['End',r.end],['Until',r.until],['Series key',r.seriesKey],['Series ID',r.seriesId],['Location',r.location]].filter(x=>x[1]);return '<div class="card"><h4>'+esc(label)+'</h4>'+(values.length?values.map(x=>'<div class="line"><span class="label">'+esc(x[0])+':</span> '+esc(x[1])+'</div>').join(''):'<div class="line label">None</div>')+'</div>';}
function rowHtml(r,i){const c=r.current||{},p=r.planned||{};let s=r.action==='UPDATE'?(c.layer||c.title||'Existing series')+' → '+(p.layer||p.title||'Planned series'):r.action==='CREATE'?(p.layer||p.title||'New recurring series'):(c.layer||c.title||'Existing recurring series');return '<div class="row '+esc(r.action)+'" data-i="'+i+'"><div class="head" onclick="toggle('+i+')"><div class="badge">'+esc(r.action)+'</div><div><div class="title">'+esc(r.title||r.entityId||'Calendar series')+'</div><div class="summary">'+esc(s)+'</div></div><div>▼</div></div><div class="details"><div class="compare">'+recordCard('Current',c)+recordCard('Planned',p)+'</div>'+(r.changedFields&&r.changedFields.length?'<div class="reason"><b>Changed:</b> '+esc(r.changedFields.join(', '))+'</div>':'')+(r.reason?'<div class="reason"><b>Reason:</b> '+esc(r.reason)+'</div>':'')+(r.identityReconciled?'<div class="reason"><b>Identity reconciled:</b> '+esc(r.previousSeriesKey||'legacy identity')+' → '+esc(p.seriesKey||r.entityId||'current identity')+'</div>':'')+'</div></div>';}
function render(){const q=document.getElementById('search').value.trim().toLowerCase(),f=document.getElementById('filter').value,v=[];rows.forEach((r,i)=>{if((f==='ALL'||r.action===f)&&(!q||JSON.stringify(r).toLowerCase().includes(q)))v.push([r,i]);});document.getElementById('rows').innerHTML=v.length?v.map(x=>rowHtml(x[0],x[1])).join(''):'<div class="empty">No matching operations.</div>';document.getElementById('visibleCount').textContent=v.length+' of '+rows.length;}
function toggle(i){const e=document.querySelector('.row[data-i="'+i+'"]');if(e)e.classList.toggle('open');}
document.getElementById('search').addEventListener('input',render);document.getElementById('filter').addEventListener('change',render);document.getElementById('approve').onclick=function(){const b=this;b.disabled=true;b.textContent='Preparing Sync…';google.script.run.withSuccessHandler(function(){b.textContent='Prepared';google.script.host.close();}).withFailureHandler(function(e){b.disabled=false;b.textContent='Approve & Prepare Sync';alert(e&&e.message?e.message:String(e));}).approveDetailedCalendarSyncPreview();};renderReview();render();
</script></body></html>`).setWidth(920).setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html,'Calendar Sync Preview');
  return {opened:true,reviewSessionId:preview.reviewSessionId||'',operationCount:operations.length};
}

function approveDetailedCalendarSyncPreview(){const prepared=prepareReviewedCalendarSyncWindow_();openPmosJobEngine('CALENDAR_SYNC');return {prepared:true,planId:String(prepared&&prepared.planId||''),reviewSessionId:String(prepared&&prepared.sessionId||''),total:Number(prepared&&prepared.total||0),creates:Number(prepared&&prepared.creates||0),updates:Number(prepared&&prepared.updates||0),deletes:Number(prepared&&prepared.deletes||0)};}
function buildPmosCalendarSyncPreviewRow_(operation){const p=operation&&operation.payload||{},c=p.current||{},d=p.desired||{};return {operationId:String(operation&&operation.id||''),action:String(operation&&operation.action||'').toUpperCase(),entityId:String(operation&&operation.entityId||''),title:String(d.title||d.eventTitle||c.title||c.eventTitle||operation.entityId||''),reason:String(operation&&operation.reason||''),changedFields:Array.isArray(p.changedFields)?p.changedFields.slice():[],current:buildPmosCalendarSyncPreviewRecord_(c),planned:buildPmosCalendarSyncPreviewRecord_(d),identityReconciled:Boolean(c.metadata&&c.metadata.identityReconciled),previousSeriesKey:String(c.metadata&&c.metadata.previousSeriesKey||'')};}
function buildPmosCalendarSyncPreviewRecord_(record){const v=record||{};return {seriesKey:String(v.seriesKey||''),customerId:String(v.customerId||''),layer:String(v.layer||''),title:String(v.title||v.eventTitle||''),start:formatPmosSyncPreviewValue_(v.start),end:formatPmosSyncPreviewValue_(v.end),until:formatPmosSyncPreviewValue_(v.until),seriesId:String(v.seriesId||v.id||''),location:String(v.location||''),color:String(v.color||''),status:String(v.status||'')};}
function formatPmosSyncPreviewValue_(value){if(value==null||value==='')return '';if(value instanceof Date)return value.toISOString();return String(value);}
function escapePmosSyncPreviewHtml_(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');}
