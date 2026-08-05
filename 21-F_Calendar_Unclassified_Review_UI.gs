/** Compact, expandable review for unclassified Calendar events. */
function showCalendarUnclassifiedExceptionsReview() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  const items = audit.unclassifiedEvents || [];
  const session = getOrBeginPmosReviewSession_('CALENDAR', audit.sourceVersion);
  const selected = {};

  items.forEach(function (item) {
    const itemKey = String(item.eventId || item.seriesId || item.operationId || '');
    const decision = readPmosReviewSessionDecision_(session, 'UNCLASSIFIED_EVENT', itemKey);
    selected[itemKey] = String(decision && decision.decision || '').toUpperCase() === 'IGNORE';
  });

  const rows = items.map(function (item, index) {
    const itemKey = String(item.eventId || item.seriesId || item.operationId || '');
    const checked = selected[itemKey] ? ' checked' : '';
    const type = item.recurring ? 'RECURRING' : 'ONE-TIME';
    const dateText = item.start ? String(item.start).replace('T', ' ').slice(0, 16) : '';
    return '<div class="unclassified-row' + (checked ? ' selected' : '') + '" id="row-' + index + '">' +
      '<label class="unclassified-summary" for="unclassified-' + index + '">' +
        '<input class="unclassified-check" type="checkbox" id="unclassified-' + index + '" data-index="' + index + '"' + checked + '>' +
        '<span class="compact">' +
          '<span class="type-badge">' + escapePmosAuditReviewHtml_(type) + '</span>' +
          '<span class="exception-badge">IGNORE FOR THIS SYNC</span>' +
          '<span class="heading">' + escapePmosAuditReviewHtml_(item.title || 'Calendar event') +
            (dateText ? ' • ' + escapePmosAuditReviewHtml_(dateText) : '') + '</span>' +
          (item.location ? '<span class="event-location">' + escapePmosAuditReviewHtml_(item.location) + '</span>' : '') +
        '</span>' +
        '<button type="button" class="expand" onclick="toggleDetails(event,' + index + ')">Details</button>' +
      '</label>' +
      '<div class="expanded" id="details-' + index + '">' +
        '<div><strong>Default action:</strong> Convert to Temporary Visit</div>' +
        '<div><strong>Event type:</strong> ' + escapePmosAuditReviewHtml_(type) + '</div>' +
        (item.start ? '<div><strong>Start:</strong> ' + escapePmosAuditReviewHtml_(item.start) + '</div>' : '') +
        (item.end ? '<div><strong>End:</strong> ' + escapePmosAuditReviewHtml_(item.end) + '</div>' : '') +
        (item.location ? '<div><strong>Location:</strong> ' + escapePmosAuditReviewHtml_(item.location) + '</div>' : '') +
        (item.description ? '<div><strong>Description:</strong> ' + escapePmosAuditReviewHtml_(item.description) + '</div>' : '') +
        '<div><strong>Reason:</strong> ' + escapePmosAuditReviewHtml_(item.reason || 'No customer match was found.') + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  const body = items.length
    ? '<div class="instructions amber">Unselected events will become Temporary Visits during Calendar Sync. Select only events to ignore for this sync.</div>' +
      '<div class="bulk-toolbar amber-toolbar" id="bulkToolbar"><label class="bulk-toggle" id="bulkToggle" role="button" tabindex="0">' +
      '<input type="checkbox" id="toggleAll" tabindex="-1"><span id="toggleAllLabel">Select all</span></label>' +
      '<span id="selectionCount">0 selected</span></div>' + rows
    : '<div class="empty">No unclassified Calendar events require review.</div>';

  const dataJson = JSON.stringify(items).replace(/</g, '\\u003c');
  const footer = items.length
    ? '<button class="amber-action" id="approveButton" onclick="approveUnclassified(this)">Approve classifications</button>' +
      '<button onclick="google.script.host.close()">Close</button>'
    : '<button onclick="google.script.host.close()">Close</button>';
  const script = '<script>' +
    'var events=' + dataJson + ';' +
    'function boxes(){return Array.prototype.slice.call(document.querySelectorAll(".unclassified-check"));}' +
    'function selectedIndexes(){return boxes().filter(function(x){return x.checked;}).map(function(x){return Number(x.dataset.index);});}' +
    'function allSelected(){var b=boxes();return b.length>0&&b.every(function(x){return x.checked;});}' +
    'function refresh(){var selected=selectedIndexes(),all=selected.length===boxes().length&&boxes().length>0;boxes().forEach(function(x){document.getElementById("row-"+x.dataset.index).classList.toggle("selected",x.checked);});document.getElementById("toggleAll").checked=all;document.getElementById("toggleAllLabel").textContent=all?"Clear all":"Select all";document.getElementById("selectionCount").textContent=selected.length+" selected";var toolbar=document.getElementById("bulkToolbar");toolbar.classList.toggle("partial",selected.length>0&&!all);toolbar.classList.toggle("all",all);}' +
    'function toggleAll(){var value=!allSelected();boxes().forEach(function(x){x.checked=value;});refresh();}' +
    'function toggleDetails(event,i){event.preventDefault();event.stopPropagation();document.getElementById("details-"+i).classList.toggle("open");}' +
    'boxes().forEach(function(x){x.addEventListener("change",refresh);});document.getElementById("bulkToggle").addEventListener("click",function(e){e.preventDefault();toggleAll();});refresh();' +
    'function approveUnclassified(button){var ignored=selectedIndexes();var temporaryCount=events.length-ignored.length;if(!confirm("Convert "+temporaryCount+" unselected event(s) to Temporary Visits and ignore "+ignored.length+" selected event(s) for this sync?"))return;button.disabled=true;button.textContent="Approving…";google.script.run.withSuccessHandler(function(){google.script.host.close();}).withFailureHandler(function(e){button.disabled=false;button.textContent="Approve classifications";alert(e&&e.message?e.message:String(e));}).savePmosCalendarUnclassifiedDecisions(' + JSON.stringify(audit.sourceVersion) + ',events,ignored);}' +
    '</script>';

  const html = HtmlService.createHtmlOutput(buildPmosAuditReviewHtml_(
    'Unclassified Calendar Events', body, footer, script
  ) + '<style>' +
    '.instructions.amber{background:#fef3c7;color:#92400e}.amber-toolbar{background:#fffbeb;border-color:#fcd34d}.amber-toolbar.partial{background:#fef3c7;border-color:#fbbf24}.amber-toolbar.all{background:#fde68a;border-color:#f59e0b}.unclassified-row{background:#fff;border:1px solid #fde68a;border-left:5px solid #d97706;border-radius:10px;margin:9px 0}.unclassified-row.selected{background:#fffbeb;opacity:.78}.unclassified-summary{display:grid;grid-template-columns:22px 1fr auto;gap:9px;align-items:start;padding:10px;cursor:pointer}.compact span{display:block}.type-badge,.exception-badge{display:inline-block!important;width:max-content;font-size:10px;font-weight:800;border-radius:999px;padding:2px 7px;margin-bottom:4px}.type-badge{background:#fef3c7;color:#92400e}.exception-badge{display:none!important;background:#fde68a;color:#78350f}.selected .exception-badge{display:inline-block!important}.event-location{font-size:13px;color:#92400e;margin-top:3px}.expand{padding:5px 8px;background:#fef3c7;color:#92400e}.expanded{display:none;padding:0 12px 12px 41px;font-size:13px;line-height:1.5}.expanded.open{display:block}.amber-action{background:#fef3c7;color:#92400e}' +
    '</style>').setWidth(820).setHeight(700);

  SpreadsheetApp.getUi().showModalDialog(html, 'Unclassified Calendar Events');
  return {count: items.length, planId: audit.planId, reviewSessionId: audit.reviewSessionId};
}

function savePmosCalendarUnclassifiedDecisions(sourceVersion, items, ignoredIndexes) {
  const session = getOrBeginPmosReviewSession_('CALENDAR', sourceVersion);
  const ignored = {};
  (ignoredIndexes || []).forEach(function (index) { ignored[Number(index)] = true; });
  let temporaryCount = 0;
  let ignoredCount = 0;

  (items || []).forEach(function (item, index) {
    const itemKey = String(item.eventId || item.seriesId || item.operationId || '');
    if (!itemKey) throw new Error('An unclassified event is missing its stable Calendar identity.');
    const decision = ignored[index] ? 'IGNORE' : 'TEMPORARY';
    if (decision === 'IGNORE') ignoredCount++;
    else temporaryCount++;
    savePmosReviewSessionDecision_(
      'CALENDAR',
      session.sourceVersion,
      'UNCLASSIFIED_EVENT',
      itemKey,
      decision,
      item
    );
  });

  return {
    saved: true,
    temporaryCount: temporaryCount,
    ignoredCount: ignoredCount,
    reviewSessionId: session.id
  };
}
