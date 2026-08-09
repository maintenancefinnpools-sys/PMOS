/**
 * Guarded handoff from Calendar Sync Preview into the reviewed, durable
 * Calendar Sync executor.
 *
 * The durable queue prepared in 23_C is authoritative. This module only reads
 * that queue for preview and status display; it does not rebuild planner state.
 */

/** Compatibility helper retained for callers that only need preparation totals. */
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

/**
 * Read-only UI projection of the already-prepared durable queue.
 */
function getReviewedCalendarSyncPreviewRows() {
  const state = readReviewedCalendarSyncState_();
  if (!state || !state.planId || Number(state.total || 0) <= 0) return [];

  const total = Number(state.total || 0);
  const sheet = ensureReviewedCalendarSyncQueueSheet_();
  if (sheet.getLastRow() < total + 1) {
    throw new Error('Calendar Sync preview cannot load because one or more queue rows are missing.');
  }

  const values = sheet.getRange(
    2,
    1,
    total,
    PMOS_REVIEWED_SYNC_QUEUE_HEADERS.length
  ).getValues();

  return values.map(function(row, index) {
    let operation;
    try {
      operation = JSON.parse(String(row[8] || ''));
    } catch (error) {
      throw new Error('Calendar Sync preview row ' + (index + 1) + ' contains invalid operation JSON.');
    }

    const payload = operation && operation.payload || {};
    const desired = payload.desired || {};
    const current = payload.current || {};
    const action = String(operation && operation.action || row[2] || '').toUpperCase();
    const changedFields = Array.isArray(payload.changedFields)
      ? payload.changedFields.slice()
      : [];
    const currentTitle = String(current.title || current.eventTitle || '').trim();
    const plannedTitle = String(desired.title || desired.eventTitle || '').trim();
    const title = plannedTitle || currentTitle || String(operation.entityId || row[3] || '');

    return {
      index: index,
      operationId: String(operation && operation.id || row[1] || ''),
      action: action,
      entityId: String(operation && operation.entityId || row[3] || ''),
      status: String(row[4] || ''),
      title: title,
      customerId: String(desired.customerId || current.customerId || ''),
      seriesId: String(current.seriesId || current.id || payload.seriesId || ''),
      reason: String(operation && operation.reason || ''),
      changedFields: changedFields,
      current: formatReviewedCalendarPreviewRecord_(current),
      planned: formatReviewedCalendarPreviewRecord_(desired),
      identityReconciled: Boolean(current.metadata && current.metadata.identityReconciled),
      previousSeriesKey: String(current.metadata && current.metadata.previousSeriesKey || ''),
      reconciliationMethod: String(current.metadata && current.metadata.identityReconciliationMethod || '')
    };
  });
}

function formatReviewedCalendarPreviewRecord_(record) {
  const value = record || {};
  return {
    seriesKey: String(value.seriesKey || ''),
    customerId: String(value.customerId || ''),
    layer: String(value.layer || ''),
    title: String(value.title || value.eventTitle || ''),
    start: formatReviewedCalendarPreviewValue_(value.start),
    end: formatReviewedCalendarPreviewValue_(value.end),
    until: formatReviewedCalendarPreviewValue_(value.until),
    location: String(value.location || ''),
    color: String(value.color || ''),
    status: String(value.status || '')
  };
}

function formatReviewedCalendarPreviewValue_(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Detailed preview plus the existing non-blocking execution monitor.
 */
function showReviewedCalendarSyncExecutionWindow_(prepared) {
  const snapshot = prepared || prepareSafeReviewedCalendarSync_();
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    * { box-sizing:border-box; }
    html, body { height:100%; }
    body { margin:0; font-family:Arial,sans-serif; color:#1f2937; background:#f8fafc; display:flex; flex-direction:column; }
    .header { padding:16px 18px 12px; background:white; border-bottom:1px solid #e5e7eb; flex:0 0 auto; }
    h2 { margin:0 0 4px; font-size:20px; }
    .muted { color:#6b7280; font-size:12px; line-height:1.4; }
    .counts { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
    .count { padding:6px 9px; border-radius:7px; font-size:12px; font-weight:700; background:#f3f4f6; }
    .toolbar { display:flex; gap:8px; margin-top:10px; align-items:center; flex-wrap:wrap; }
    input, select { height:34px; border:1px solid #d1d5db; border-radius:7px; padding:0 9px; background:white; color:#111827; }
    input { flex:1; min-width:210px; }
    .body { flex:1 1 auto; min-height:0; overflow:auto; padding:10px 18px 16px; }
    .loading, .empty { padding:20px; text-align:center; color:#6b7280; }
    .row { background:white; border:1px solid #e5e7eb; border-radius:9px; margin-bottom:7px; overflow:hidden; }
    .rowHead { display:grid; grid-template-columns:78px minmax(160px,1fr) minmax(180px,1.15fr) 26px; gap:9px; align-items:center; padding:9px 11px; cursor:pointer; }
    .badge { display:inline-block; width:max-content; min-width:64px; text-align:center; padding:4px 7px; border-radius:999px; font-size:10px; font-weight:800; letter-spacing:.3px; }
    .CREATE .badge { color:#166534; background:#dcfce7; }
    .UPDATE .badge, .MERGE .badge { color:#1e40af; background:#dbeafe; }
    .DELETE .badge { color:#991b1b; background:#fee2e2; }
    .title { font-size:13px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .movement { color:#4b5563; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .chev { color:#6b7280; text-align:right; font-size:13px; }
    .details { display:none; border-top:1px solid #eef2f7; padding:11px; background:#fbfdff; }
    .row.open .details { display:block; }
    .row.open .chev { transform:rotate(90deg); }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .panel { border:1px solid #e5e7eb; border-radius:8px; padding:9px; background:white; }
    .panel h4 { margin:0 0 7px; font-size:11px; text-transform:uppercase; letter-spacing:.4px; color:#6b7280; }
    .kv { display:grid; grid-template-columns:94px 1fr; gap:4px 8px; font-size:11px; line-height:1.35; }
    .k { color:#6b7280; }
    .v { min-width:0; overflow-wrap:anywhere; }
    .reason { margin-top:9px; padding-top:8px; border-top:1px solid #e5e7eb; font-size:11px; line-height:1.45; }
    .fields { margin-top:6px; color:#4b5563; }
    .progressWrap { margin-top:10px; display:none; }
    .progress { height:10px; overflow:hidden; background:#e5e7eb; border-radius:7px; }
    .bar { width:0; height:100%; background:#2563eb; transition:width .25s ease; }
    .statusText { margin-top:5px; font-size:11px; color:#4b5563; white-space:pre-line; }
    .error { display:none; margin-top:8px; padding:8px; color:#991b1b; background:#fee2e2; border-radius:7px; font-size:11px; white-space:pre-wrap; }
    .footer { flex:0 0 auto; position:sticky; bottom:0; display:flex; justify-content:space-between; gap:8px; align-items:center; padding:11px 18px; background:white; border-top:1px solid #dbe2ea; box-shadow:0 -2px 10px rgba(15,23,42,.05); }
    .footerLeft { font-size:11px; color:#6b7280; }
    .buttons { display:flex; gap:8px; }
    button { padding:8px 11px; border:0; border-radius:7px; font-weight:700; cursor:pointer; }
    .primary { color:white; background:#2563eb; }
    .secondary { color:#111827; background:#e5e7eb; }
    button:disabled { opacity:.45; cursor:default; }
  </style>
</head>
<body>
  <div class="header">
    <h2>Calendar Sync Preview</h2>
    <div class="muted">Review the exact prepared operations before synchronization.</div>
    <div class="counts">
      <span class="count">Total ${Number(snapshot.total || 0)}</span>
      <span class="count">Creates ${Number(snapshot.creates || 0)}</span>
      <span class="count">Updates ${Number(snapshot.updates || 0)}</span>
      <span class="count">Deletes ${Number(snapshot.deletes || 0)}</span>
    </div>
    <div class="toolbar">
      <input id="search" type="text" placeholder="Search customer, ID, layer or series..." oninput="renderRows()">
      <select id="filter" onchange="renderRows()">
        <option value="ALL">All operations</option>
        <option value="CREATE">Creates</option>
        <option value="UPDATE">Updates</option>
        <option value="DELETE">Deletes</option>
      </select>
    </div>
    <div id="progressWrap" class="progressWrap">
      <div class="progress"><div id="bar" class="bar"></div></div>
      <div id="statusText" class="statusText"></div>
    </div>
    <div id="error" class="error"></div>
  </div>

  <div class="body">
    <div id="rows" class="loading">Loading prepared operations...</div>
  </div>

  <div class="footer">
    <div id="shown" class="footerLeft">Loading preview...</div>
    <div class="buttons">
      <button id="start" class="primary" disabled onclick="startSync()">Start Sync</button>
      <button class="secondary" onclick="reloadPreview()">Refresh Preview</button>
      <button class="secondary" onclick="google.script.host.close()">Close</button>
    </div>
  </div>

<script>
  var previewRows = [];
  var previewLoaded = false;
  var polling = false;
  var executionStarted = false;

  function el(id){ return document.getElementById(id); }
  function text(value){ return value == null ? '' : String(value); }
  function esc(value){
    return text(value).replace(/[&<>\"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function message(error){ return error && error.message ? error.message : String(error || 'Unknown error'); }
  function showError(error){
    el('error').style.display='block';
    el('error').textContent=message(error);
    if (!executionStarted) el('start').disabled=true;
  }
  function clearError(){ el('error').style.display='none'; el('error').textContent=''; }
  function displayDate(value){
    if (!value) return '';
    var d=new Date(value);
    if (isNaN(d.getTime())) return text(value);
    return d.toLocaleString([], {year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }
  function compactMovement(row){
    var c=row.current||{}, p=row.planned||{};
    if (row.action==='CREATE') return p.layer || displayDate(p.start) || 'New recurring series';
    if (row.action==='DELETE') return c.layer || displayDate(c.start) || 'Remove existing series';
    var from=c.layer || displayDate(c.start) || 'Existing';
    var to=p.layer || displayDate(p.start) || 'Planned';
    return from===to ? (row.changedFields||[]).join(', ') || 'Details updated' : from+' → '+to;
  }
  function recordPanel(label,record,seriesId){
    record=record||{};
    var pairs=[
      ['Customer ID',record.customerId],
      ['Layer',record.layer],
      ['Title',record.title],
      ['Start',displayDate(record.start)],
      ['End',displayDate(record.end)],
      ['Until',displayDate(record.until)],
      ['Location',record.location],
      ['Series Key',record.seriesKey]
    ];
    if (label==='Current' && seriesId) pairs.push(['Calendar Series ID',seriesId]);
    var body=pairs.filter(function(pair){return text(pair[1]);}).map(function(pair){
      return '<div class="k">'+esc(pair[0])+'</div><div class="v">'+esc(pair[1])+'</div>';
    }).join('');
    if (!body) body='<div class="muted">No '+esc(label.toLowerCase())+' record.</div>';
    return '<div class="panel"><h4>'+esc(label)+'</h4><div class="kv">'+body+'</div></div>';
  }
  function rowHtml(row){
    var details='';
    if (row.action==='CREATE') details=recordPanel('Planned',row.planned,'');
    else if (row.action==='DELETE') details=recordPanel('Current',row.current,row.seriesId);
    else details='<div class="grid">'+recordPanel('Current',row.current,row.seriesId)+recordPanel('Planned',row.planned,'')+'</div>';

    var notes=[];
    if ((row.changedFields||[]).length) notes.push('<div class="fields"><b>Changed:</b> '+esc(row.changedFields.join(', '))+'</div>');
    if (row.identityReconciled) {
      notes.push('<div class="fields"><b>Existing identity reconciled:</b> '+esc(row.reconciliationMethod||'Yes')+'</div>');
    }
    if (row.reason) notes.push('<div class="fields"><b>Reason:</b> '+esc(row.reason)+'</div>');
    if (notes.length) details+='<div class="reason">'+notes.join('')+'</div>';

    return '<div class="row '+esc(row.action)+'" onclick="toggleRow(this)">'+
      '<div class="rowHead">'+
        '<span class="badge">'+esc(row.action)+'</span>'+
        '<div class="title" title="'+esc(row.title)+'">'+esc(row.title||row.entityId)+'</div>'+
        '<div class="movement" title="'+esc(compactMovement(row))+'">'+esc(compactMovement(row))+'</div>'+
        '<div class="chev">›</div>'+
      '</div><div class="details">'+details+'</div></div>';
  }
  function toggleRow(node){ node.classList.toggle('open'); }
  function renderRows(){
    if (!previewLoaded) return;
    var filter=el('filter').value;
    var query=text(el('search').value).trim().toLowerCase();
    var rows=previewRows.filter(function(row){
      if (filter!=='ALL' && row.action!==filter && !(filter==='UPDATE' && row.action==='MERGE')) return false;
      if (!query) return true;
      var hay=[row.title,row.customerId,row.entityId,row.seriesId,row.current&&row.current.layer,row.planned&&row.planned.layer,row.current&&row.current.seriesKey,row.planned&&row.planned.seriesKey].join(' ').toLowerCase();
      return hay.indexOf(query)>=0;
    });
    el('rows').className='';
    el('rows').innerHTML=rows.length ? rows.map(rowHtml).join('') : '<div class="empty">No operations match this filter.</div>';
    el('shown').textContent='Showing '+rows.length+' of '+previewRows.length+' prepared operation(s)';
  }
  function loadRows(){
    previewLoaded=false;
    el('start').disabled=true;
    el('rows').className='loading';
    el('rows').textContent='Loading prepared operations...';
    google.script.run
      .withSuccessHandler(function(rows){
        previewRows=Array.isArray(rows)?rows:[];
        previewLoaded=true;
        renderRows();
        refreshStatus();
      })
      .withFailureHandler(function(error){ showError(error); el('rows').textContent='Preview could not be loaded.'; })
      .getReviewedCalendarSyncPreviewRows();
  }
  function refreshStatus(){
    if (polling) return;
    polling=true;
    google.script.run
      .withSuccessHandler(function(state){
        polling=false;
        state=state||{};
        var active=state.status==='Running'||state.status==='Scheduled'||state.status==='Complete'||state.status==='Paused on error';
        if (active || executionStarted) {
          executionStarted=true;
          el('progressWrap').style.display='block';
          var total=Number(state.total||0), processed=Number(state.processed||0);
          var percent=total>0?Math.round(processed/total*100):0;
          if (state.status==='Complete') percent=100;
          el('bar').style.width=Math.max(0,Math.min(100,percent))+'%';
          el('statusText').textContent='Status: '+text(state.status)+'\nProgress: '+processed+' / '+total+' • Remaining: '+Number(state.remaining||0)+' • Created: '+Number(state.created||0)+' • Updated: '+Number(state.updated||0)+' • Deleted: '+Number(state.deleted||0);
        }
        if (state.lastError) showError(state.lastError); else clearError();
        el('start').disabled=!previewLoaded || state.status==='Running' || state.status==='Scheduled' || state.status==='Complete' || state.status==='Paused on error';
      })
      .withFailureHandler(function(error){polling=false;showError(error);})
      .getReviewedCalendarSyncStatus();
  }
  function reloadPreview(){ clearError(); loadRows(); }
  function startSync(){
    if (!previewLoaded) return;
    executionStarted=true;
    el('start').disabled=true;
    el('progressWrap').style.display='block';
    clearError();
    google.script.run
      .withSuccessHandler(function(){ refreshStatus(); })
      .withFailureHandler(showError)
      .startReviewedCalendarSyncExecution();
  }

  loadRows();
  setInterval(refreshStatus,2000);
</script>
</body>
</html>`).setWidth(860).setHeight(690);

  SpreadsheetApp.getUi().showModalDialog(html, 'Calendar Sync Preview');
}
