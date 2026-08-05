/** Compact, expandable review for suggested customer matches. */
function showCalendarSuggestedMatchesReview() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  const items = audit.suggestedMatches || [];
  const session = getOrBeginPmosReviewSession_('CALENDAR', audit.sourceVersion);
  const selected = {};

  items.forEach(function (item) {
    const itemKey = String(item.eventId || item.seriesId || '');
    const decision = readPmosReviewSessionDecision_(session, 'SUGGESTED_MATCH', itemKey);
    selected[itemKey] = String(decision && decision.decision || '').toUpperCase() === 'IGNORE';
  });

  const rows = items.map(function (item, index) {
    const eventKey = String(item.eventId || item.seriesId || '');
    const checked = selected[eventKey] ? ' checked' : '';
    const type = item.recurring ? 'RECURRING' : 'ONE-TIME';
    const dateText = item.start ? String(item.start).replace('T', ' ').slice(0, 16) : '';
    return '<div class="match-row' + (checked ? ' selected' : '') + '" id="row-' + index + '">' +
      '<label class="match-summary" for="match-' + index + '">' +
        '<input class="match-check" type="checkbox" id="match-' + index + '" data-index="' + index + '"' + checked + '>' +
        '<span class="compact"><span class="type-badge">' + escapePmosAuditReviewHtml_(type) + '</span>' +
          '<span class="exception-badge">EXEMPT FROM MATCHING</span>' +
          '<span class="heading">' + escapePmosAuditReviewHtml_(item.title || 'Calendar event') +
            (dateText ? ' • ' + escapePmosAuditReviewHtml_(dateText) : '') + '</span>' +
          '<span class="match-target">→ ' + escapePmosAuditReviewHtml_(item.customerName) +
            (item.customerAddress ? ' • ' + escapePmosAuditReviewHtml_(item.customerAddress) : '') + '</span></span>' +
        '<button type="button" class="expand" onclick="toggleDetails(event,' + index + ')">Details</button>' +
      '</label>' +
      '<div class="expanded" id="details-' + index + '">' +
        '<div><strong>Match type:</strong> ' + escapePmosAuditReviewHtml_(type) + '</div>' +
        '<div><strong>Confidence:</strong> ' + Number(item.confidence || 0) + '%</div>' +
        '<div><strong>Matched by:</strong> ' + escapePmosAuditReviewHtml_((item.matchedFields || []).join(', ')) + '</div>' +
        (item.location ? '<div><strong>Event location:</strong> ' + escapePmosAuditReviewHtml_(item.location) + '</div>' : '') +
        '<div><strong>Customer:</strong> ' + escapePmosAuditReviewHtml_(item.customerName) + '</div>' +
        (item.customerAddress ? '<div><strong>Service address:</strong> ' + escapePmosAuditReviewHtml_(item.customerAddress) + '</div>' : '') +
      '</div></div>';
  }).join('');

  const body = items.length
    ? '<div class="instructions blue">Unselected events will be matched during Calendar Sync. Select only exceptions.</div>' +
      '<div class="bulk-toolbar" id="bulkToolbar"><label class="bulk-toggle" id="bulkToggle" role="button" tabindex="0">' +
      '<input type="checkbox" id="toggleAll" tabindex="-1"><span id="toggleAllLabel">Select all</span></label>' +
      '<span id="selectionCount">0 selected</span></div>' + rows
    : '<div class="empty">No customer matches are currently suggested.</div>';

  const dataJson = JSON.stringify(items).replace(/</g, '\\u003c');
  const footer = items.length
    ? '<button class="guided" id="approveButton" onclick="approveMatches(this)">Approve matches</button><button onclick="google.script.host.close()">Close</button>'
    : '<button onclick="google.script.host.close()">Close</button>';
  const script = '<script>' +
    'var matches=' + dataJson + ';' +
    'function boxes(){return Array.prototype.slice.call(document.querySelectorAll(".match-check"));}' +
    'function selectedIndexes(){return boxes().filter(function(x){return x.checked;}).map(function(x){return Number(x.dataset.index);});}' +
    'function allSelected(){var b=boxes();return b.length>0&&b.every(function(x){return x.checked;});}' +
    'function refresh(){var selected=selectedIndexes(),all=selected.length===boxes().length&&boxes().length>0;boxes().forEach(function(x){document.getElementById("row-"+x.dataset.index).classList.toggle("selected",x.checked);});document.getElementById("toggleAll").checked=all;document.getElementById("toggleAllLabel").textContent=all?"Clear all":"Select all";document.getElementById("selectionCount").textContent=selected.length+" selected";}' +
    'function toggleAll(){var value=!allSelected();boxes().forEach(function(x){x.checked=value;});refresh();}' +
    'function toggleDetails(event,i){event.preventDefault();event.stopPropagation();document.getElementById("details-"+i).classList.toggle("open");}' +
    'boxes().forEach(function(x){x.addEventListener("change",refresh);});document.getElementById("bulkToggle").addEventListener("click",function(e){e.preventDefault();toggleAll();});refresh();' +
    'function approveMatches(button){var exempt=selectedIndexes();var approvedCount=matches.length-exempt.length;if(!confirm("Approve "+approvedCount+" suggested customer matches and exempt "+exempt.length+" selected event(s)?"))return;button.disabled=true;button.textContent="Saving and continuing…";google.script.run.withSuccessHandler(function(result){if(!result||result.saved!==true){button.disabled=false;button.textContent="Approve matches";alert("The review decisions were not saved.");return;}google.script.host.close();}).withFailureHandler(function(e){button.disabled=false;button.textContent="Approve matches";alert(e&&e.message?e.message:String(e));}).saveAndAdvancePmosCalendarReview("SUGGESTED_MATCH",matches,exempt);}' +
    '</script>';

  const html = HtmlService.createHtmlOutput(buildPmosAuditReviewHtml_('Suggested Customer Matches', body, footer, script) + '<style>' +
    '.instructions.blue{background:#dbeafe;color:#1e3a8a}.match-row{background:#fff;border:1px solid #bfdbfe;border-left:5px solid #2563eb;border-radius:10px;margin:9px 0}.match-row.selected{background:#eff6ff;opacity:.78}.match-summary{display:grid;grid-template-columns:22px 1fr auto;gap:9px;align-items:start;padding:10px;cursor:pointer}.compact span{display:block}.type-badge,.exception-badge{display:inline-block!important;width:max-content;border-radius:999px;margin-bottom:4px}.type-badge{font-size:10px;font-weight:800;padding:2px 7px;background:#dbeafe;color:#1e3a8a}.exception-badge{display:none!important;background:#e2e8f0;color:#475569;font-size:13px;font-weight:900;padding:4px 11px;letter-spacing:.2px}.selected .exception-badge{display:inline-block!important}.match-target{font-size:13px;color:#1e3a8a;margin-top:3px}.expand{padding:5px 8px;background:#dbeafe;color:#1e3a8a}.expanded{display:none;padding:0 12px 12px 41px;font-size:13px;line-height:1.5}.expanded.open{display:block}</style>').setWidth(820).setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Suggested Customer Matches');
  return {count: items.length, planId: audit.planId, reviewSessionId: audit.reviewSessionId};
}

function savePmosCalendarSuggestedMatchDecisions(items, exemptIndexes) {
  const exempt = {};
  (exemptIndexes || []).forEach(function (index) { exempt[Number(index)] = true; });
  const records = [];
  let approvedCount = 0;
  let exemptCount = 0;

  (items || []).forEach(function (item, index) {
    const eventKey = String(item && (item.eventId || item.seriesId) || '');
    if (!eventKey) throw new Error('A suggested match is missing its Calendar event identity.');
    const decision = exempt[index] ? 'IGNORE' : 'MATCH';
    if (decision === 'MATCH') approvedCount++; else exemptCount++;
    records.push({itemKey: eventKey, decision: decision});
  });

  const saved = savePmosReviewStep_('CALENDAR', 'SUGGESTED_MATCH', records);
  if (!saved || saved.decisionCount !== records.length) throw new Error('Not all suggested-match decisions were saved.');
  return {
    saved: true,
    decisionCount: records.length,
    approvedCount: approvedCount,
    exemptCount: exemptCount,
    reviewSessionId: saved.sessionId
  };
}
