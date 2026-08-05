/**
 * Exception-based Calendar review windows.
 * PMOS proposes the normal action. Checked rows are exceptions to that action.
 */
function showCalendarDeletionExceptionsReview() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  const items = audit.deletionCandidates || [];
  const session = getOrBeginPmosReviewSession_('CALENDAR', audit.sourceVersion);
  const kept = {};

  items.forEach(function (item) {
    const itemKey = String(item.seriesKey || item.seriesId || '');
    const decision = readPmosReviewSessionDecision_(session, 'DELETION_CANDIDATE', itemKey);
    kept[itemKey] = String(decision && decision.decision || '').toUpperCase() === 'KEEP';
  });

  const body = items.length
    ? '<div class="instructions delete-instructions">Unselected events will be deleted. Select only the events that should be kept.</div>' +
      '<div class="bulk-toolbar delete-toolbar" id="bulkToolbar">' +
        '<label class="bulk-toggle" id="bulkToggle" role="button" tabindex="0">' +
          '<input type="checkbox" id="toggleAll" tabindex="-1"><span id="toggleAllLabel">Select all</span>' +
        '</label>' +
        '<span id="selectionCount">0 selected to keep</span>' +
      '</div>' +
      items.map(function (item, index) {
        const itemKey = String(item.seriesKey || item.seriesId || '');
        const checked = kept[itemKey] ? ' checked' : '';
        return '<label class="item deletion-exception selectable' + (checked ? ' selected-exception' : '') + '" for="keep-' + index + '" id="row-' + index + '">' +
          '<input class="keep-check" type="checkbox" id="keep-' + index + '" data-index="' + index + '"' + checked + '>' +
          '<span class="row-content"><span class="row-top"><span class="heading">' + escapePmosAuditReviewHtml_(item.title || item.seriesKey) + '</span>' +
          '<span class="exception-badge">KEEP</span></span>' +
          (item.layer ? '<span class="meta">Route: ' + escapePmosAuditReviewHtml_(item.layer) + '</span>' : '') +
          '<span class="meta">Series: ' + escapePmosAuditReviewHtml_(item.seriesKey) + '</span>' +
          '<span class="details">' + escapePmosAuditReviewHtml_(item.reason) + '</span></span>' +
          '</label>';
      }).join('')
    : '<div class="empty">No Calendar series are currently suggested for deletion.</div>';

  const itemJson = JSON.stringify(items).replace(/</g, '\\u003c');
  const footer = items.length
    ? '<button id="approveButton" class="delete" onclick="approveDeletions(this)">Complete deletion review</button>' +
      '<button onclick="google.script.host.close()">Close</button>'
    : '<button onclick="google.script.host.close()">Close</button>';

  const script = '<script>' +
    'var candidates=' + itemJson + ';' +
    'function boxes(){return Array.prototype.slice.call(document.querySelectorAll(".keep-check"));}' +
    'function keptIndexes(){return boxes().filter(function(x){return x.checked;}).map(function(x){return Number(x.getAttribute("data-index"));});}' +
    'function allSelected(){var list=boxes();return list.length>0&&list.every(function(x){return x.checked;});}' +
    'function updateRows(){boxes().forEach(function(x){var row=document.getElementById("row-"+x.getAttribute("data-index"));if(row)row.classList.toggle("selected-exception",x.checked);});}' +
    'function updateBulkControl(){var list=boxes(),selected=keptIndexes().length,control=document.getElementById("toggleAll"),label=document.getElementById("toggleAllLabel"),toolbar=document.getElementById("bulkToolbar");if(!control||!label)return;var all=selected===list.length&&list.length>0;control.indeterminate=false;control.checked=all;label.textContent=all?"Clear all":"Select all";document.getElementById("selectionCount").textContent=selected+" selected to keep";if(toolbar){toolbar.classList.toggle("partial",selected>0&&!all);toolbar.classList.toggle("all",all);}updateRows();}' +
    'function applyBulkToggle(){var shouldSelect=!allSelected();boxes().forEach(function(x){x.checked=shouldSelect;});updateBulkControl();}' +
    'boxes().forEach(function(x){x.addEventListener("change",updateBulkControl);});' +
    'var bulk=document.getElementById("bulkToggle");if(bulk){bulk.addEventListener("click",function(event){event.preventDefault();applyBulkToggle();});bulk.addEventListener("keydown",function(event){if(event.key===" "||event.key==="Enter"){event.preventDefault();applyBulkToggle();}});}updateBulkControl();' +
    'function approveDeletions(button){var kept=keptIndexes(),deleteCount=candidates.length-kept.length;' +
      'if(deleteCount>0&&!confirm("Are you sure you would like to delete the "+deleteCount+" unselected events?"))return;' +
      'button.disabled=true;button.classList.add("opening");button.textContent="Saving and continuing…";' +
      'google.script.run.withSuccessHandler(function(result){if(!result||result.saved!==true){button.disabled=false;button.classList.remove("opening");button.textContent="Complete deletion review";alert("The deletion decisions were not saved.");return;}google.script.host.close();})' +
      '.withFailureHandler(function(e){button.disabled=false;button.classList.remove("opening");button.textContent="Complete deletion review";alert(e&&e.message?e.message:String(e));})' +
      '.saveAndAdvancePmosCalendarReview("DELETION_CANDIDATE",candidates,kept);}' +
    '</script>';

  const html = HtmlService.createHtmlOutput(buildPmosAuditReviewHtml_(
    'Suggested Calendar Deletions', body, footer, script + '<style>' +
      '.delete-instructions{background:#fee2e2;color:#7f1d1d}' +
      '.delete-toolbar{background:#fff1f2;border-color:#fda4af}.delete-toolbar.partial{background:#ffe4e6;border-color:#fb7185}.delete-toolbar.all{background:#fecdd3;border-color:#f43f5e}' +
      '.deletion-exception{border-left:5px solid #dc2626}.deletion-exception .exception-badge{display:none}' +
      '.deletion-exception.selected-exception{background:#f8fafc;border-left-color:#64748b;opacity:.82}' +
      '.deletion-exception.selected-exception .exception-badge{display:inline-block;background:#e2e8f0;color:#334155;border-radius:999px;padding:2px 7px;font-size:11px;font-weight:800}' +
      '.row-top{display:flex!important;align-items:center;gap:8px}.row-top .heading{margin-right:auto}' +
    '</style>'
  )).setWidth(800).setHeight(700);

  SpreadsheetApp.getUi().showModalDialog(html, 'Suggested Calendar Deletions');
  return {count: items.length, planId: audit.planId, reviewSessionId: audit.reviewSessionId};
}

function savePmosCalendarDeletionExceptions(candidates, keptIndexes) {
  const kept = {};
  (keptIndexes || []).forEach(function (index) { kept[Number(index)] = true; });
  const records = [];
  let deletedCount = 0;
  let keptCount = 0;

  (candidates || []).forEach(function (item, index) {
    const itemKey = String(item && (item.seriesKey || item.seriesId) || '');
    if (!itemKey) throw new Error('A deletion candidate is missing its stable series identity.');
    const decision = kept[index] ? 'KEEP' : 'DELETE';
    if (decision === 'KEEP') keptCount++;
    else deletedCount++;
    records.push({itemKey: itemKey, decision: decision});
  });

  const saved = savePmosReviewStep_('CALENDAR', 'DELETION_CANDIDATE', records);
  if (!saved || saved.decisionCount !== records.length) {
    throw new Error('Not all deletion decisions were saved.');
  }
  return {
    saved: true,
    decisionCount: records.length,
    deletedCount: deletedCount,
    keptCount: keptCount,
    reviewSessionId: saved.sessionId
  };
}
