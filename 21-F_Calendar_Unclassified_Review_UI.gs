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
        '<span class="compact"><span class="type-badge">' + escapePmosAuditReviewHtml_(type) + '</span>' +
          '<span class="exception-badge">IGNORE FOR THIS SYNC</span>' +
          '<span class="heading">' + escapePmosAuditReviewHtml_(item.title || 'Calendar event') +
            (dateText ? ' • ' + escapePmosAuditReviewHtml_(dateText) : '') + '</span>' +
          (item.location ? '<span class="event-location">' + escapePmosAuditReviewHtml_(item.location) + '</span>' : '') + '</span>' +
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
      '</div></div>';
  }).join('');

  const body = items.length
    ? '<div class="instructions amber">Unselected events will become Temporary Visits during Calendar Sync. Select only events to send to deletion review.</div>' +
      '<div class="bulk-toolbar amber-toolbar" id="bulkToolbar"><label class="bulk-toggle" id="bulkToggle" role="button" tabindex="0">' +
      '<input type="checkbox" id="toggleAll" tabindex="-1"><span id="toggleAllLabel">Select all</span></label>' +
      '<span id="selectionCount">0 selected</span></div>' + rows
    : '<div class="empty">No unclassified Calendar events require review.</div>';

  const dataJson = JSON.stringify(items).replace(/</g, '\\u003c');
  const footer = items.length
    ? '<button class="amber-action" id="approveButton" onclick="approveUnclassified(this)">Continue Review</button><button onclick="google.script.host.close()">Close</button>'
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
    'function approveUnclassified(button){var ignored=selectedIndexes();var temporaryCount=events.length-ignored.length;if(!confirm("Convert "+temporaryCount+" unselected event(s) to Temporary Visits and send "+ignored.length+" selected event(s) to deletion review?"))return;button.disabled=true;button.textContent="Saving and continuing…";google.script.run.withSuccessHandler(function(result){if(!result||result.saved!==true){button.disabled=false;button.textContent="Continue Review";alert("The review decisions were not saved.");return;}google.script.host.close();}).withFailureHandler(function(e){button.disabled=false;button.textContent="Continue Review";alert(e&&e.message?e.message:String(e));}).saveAndAdvancePmosCalendarReview("UNCLASSIFIED_EVENT",events,ignored);}' +
    '</script>';

  const html = HtmlService.createHtmlOutput(buildPmosAuditReviewHtml_('Unclassified Calendar Events', body, footer, script) + '<style>' +
    '.instructions.amber{background:#f4ead1;color:#765b21;border-color:#ddc88f;border-left-color:#b88735}.amber-toolbar{background:#f2f5f6;border-color:#d2dade}.amber-toolbar.partial{background:#f4ead1;border-color:#ddc88f}.amber-toolbar.all{background:#eadbb8;border-color:#b88735}.unclassified-row{background:#f9fafb;border:1px solid #d2dade;border-left:5px solid #b88735;border-radius:9px;margin:9px 0;box-shadow:0 3px 10px rgba(46,56,66,.045)}.unclassified-row.selected{background:#edf1f3;opacity:1}.unclassified-summary{display:grid;grid-template-columns:22px 1fr auto;gap:9px;align-items:start;padding:10px;cursor:pointer}.compact span{display:block}.type-badge,.exception-badge{display:inline-block!important;width:max-content;border-radius:999px;margin-bottom:4px}.type-badge{font-size:10px;font-weight:800;padding:2px 7px;background:#f4ead1;color:#765b21}.exception-badge{display:none!important;background:#e4f0f5;color:#0f5470;border:1px solid #bfd9e5;font-size:12px;font-weight:900;padding:4px 9px;letter-spacing:.2px}.selected .exception-badge{display:inline-block!important}.event-location{font-size:13px;color:#68747a;margin-top:3px}.expand{padding:5px 8px;background:#f2f5f6;color:#765b21;border-color:#ddc88f}.expanded{display:none;padding:0 12px 12px 41px;font-size:13px;line-height:1.5;background:#edf1f3}.expanded.open{display:block}.amber-action{background:#0f5470;color:#fff;border-color:#0f5470}</style>').setWidth(820).setHeight(700);

  SpreadsheetApp.getUi().showModalDialog(html, 'Unclassified Calendar Events');
  return {count: items.length, planId: audit.planId, reviewSessionId: audit.reviewSessionId};
}

function savePmosCalendarUnclassifiedDecisions(items, ignoredIndexes) {
  const ignored = {};
  (ignoredIndexes || []).forEach(function (index) { ignored[Number(index)] = true; });
  const records = [];
  let temporaryCount = 0;
  let ignoredCount = 0;

  (items || []).forEach(function (item, index) {
    const itemKey = String(item && (item.eventId || item.seriesId || item.operationId) || '');
    if (!itemKey) throw new Error('An unclassified event is missing its stable Calendar identity.');
    const decision = ignored[index] ? 'IGNORE' : 'TEMPORARY';
    if (decision === 'IGNORE') ignoredCount++; else temporaryCount++;
    records.push({itemKey: itemKey, decision: decision});
  });

  const saved = savePmosReviewStep_('CALENDAR', 'UNCLASSIFIED_EVENT', records);
  if (!saved || saved.decisionCount !== records.length) throw new Error('Not all unclassified-event decisions were saved.');
  return {saved: true, decisionCount: records.length, temporaryCount: temporaryCount, ignoredCount: ignoredCount, reviewSessionId: saved.sessionId};
}
