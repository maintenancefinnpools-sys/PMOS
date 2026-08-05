/**
 * Exception-based Calendar review windows.
 *
 * PMOS proposes the normal action. Checked rows are exceptions to that action.
 */

function showCalendarDeletionExceptionsReview() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  const items = audit.deletionCandidates || [];
  const decisions = readPmosCalendarReviewDecisions_();
  const kept = {};

  items.forEach(function (item) {
    const key = 'DELETION_CANDIDATE::' + String(item.seriesKey || '');
    kept[item.seriesKey] = Boolean(
      decisions[key] &&
      decisions[key].planId === audit.planId &&
      decisions[key].decision === 'KEEP'
    );
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
        const checked = kept[item.seriesKey] ? ' checked' : '';
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
    ? '<button id="approveButton" class="delete" onclick="approveDeletions(this)">Approve deletions</button>' +
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
    'function approveDeletions(button){var kept=keptIndexes(),deleteCount=candidates.length-kept.length;if(!deleteCount){alert("All events are selected to keep. There are no deletions to approve.");return;}' +
      'if(!confirm("Are you sure you would like to delete the "+deleteCount+" unselected events?"))return;' +
      'button.disabled=true;button.classList.add("opening");button.textContent="Approving…";' +
      'var keptItems=kept.map(function(i){return candidates[i];});' +
      'google.script.run.withSuccessHandler(function(result){button.textContent="Approved "+String(result.deletedCount||0)+" deletions";setTimeout(function(){google.script.host.close();},700);})' +
      '.withFailureHandler(function(e){button.disabled=false;button.classList.remove("opening");button.textContent="Approve deletions";alert(e&&e.message?e.message:String(e));})' +
      '.savePmosCalendarDeletionExceptions(' + JSON.stringify(audit.planId) + ',keptItems);}' +
    '</script>';

  const html = HtmlService.createHtmlOutput(buildPmosAuditReviewHtml_(
    'Suggested Calendar Deletions',
    body,
    footer,
    script + '<style>' +
      '.delete-instructions{background:#fee2e2;color:#7f1d1d}' +
      '.delete-toolbar{background:#fff1f2;border-color:#fda4af}.delete-toolbar.partial{background:#ffe4e6;border-color:#fb7185}.delete-toolbar.all{background:#fecdd3;border-color:#f43f5e}' +
      '.deletion-exception{border-left:5px solid #dc2626}.deletion-exception .exception-badge{display:none}' +
      '.deletion-exception.selected-exception{background:#f8fafc;border-left-color:#64748b;opacity:.82}' +
      '.deletion-exception.selected-exception .exception-badge{display:inline-block;background:#e2e8f0;color:#334155;border-radius:999px;padding:2px 7px;font-size:11px;font-weight:800}' +
      '.row-top{display:flex!important;align-items:center;gap:8px}.row-top .heading{margin-right:auto}' +
    '</style>'
  )).setWidth(800).setHeight(700);

  SpreadsheetApp.getUi().showModalDialog(html, 'Suggested Calendar Deletions');
  return { count: items.length, planId: audit.planId };
}

function savePmosCalendarDeletionExceptions(planId, keptItems) {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  if (String(planId || '') !== String(audit.planId || '')) {
    throw new Error('Calendar data changed. Run the Plan Audit again before approving deletions.');
  }

  const candidates = {};
  (audit.deletionCandidates || []).forEach(function (item) {
    candidates[String(item.seriesKey || '')] = item;
  });

  const keptKeys = {};
  (keptItems || []).forEach(function (item) {
    const key = String(item && item.seriesKey || '');
    if (!key || !candidates[key]) {
      throw new Error('A selected event is not part of the current deletion review.');
    }
    keptKeys[key] = true;
  });

  Object.keys(candidates).forEach(function (seriesKey) {
    savePmosCalendarReviewDecision(
      audit.planId,
      'DELETION_CANDIDATE',
      keptKeys[seriesKey] ? 'KEEP' : 'DELETE',
      candidates[seriesKey]
    );
  });

  return {
    saved: true,
    deletedCount: Object.keys(candidates).length - Object.keys(keptKeys).length,
    keptCount: Object.keys(keptKeys).length,
    planId: audit.planId
  };
}
