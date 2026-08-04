/**
 * Calendar Plan Audit review UI.
 *
 * The audit remains read-only. These windows open only after the audit and let
 * the user inspect findings. Writes occur only through explicit correction or
 * deletion-approval actions.
 */

const PMOS_CALENDAR_REVIEW_SHEET = 'Calendar Review Decisions';
const PMOS_CALENDAR_REVIEW_HEADERS = [
  'Review Key', 'Plan ID', 'Review Type', 'Decision', 'Series Key',
  'Calendar Event ID', 'Title', 'Details', 'Updated At'
];

function showCalendarAuditErrorsReview() {
  return showPmosCalendarAuditIssueReview_('ERROR');
}

function showCalendarAuditWarningsReview() {
  return showPmosCalendarAuditIssueReview_('WARNING');
}

/** Compatibility entry retained for older callers. */
function showCalendarAuditIssuesReview() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  return audit.errorCount
    ? showPmosCalendarAuditIssueReview_('ERROR')
    : showPmosCalendarAuditIssueReview_('WARNING');
}

function showPmosCalendarAuditIssueReview_(severity) {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  const normalized = String(severity || '').toUpperCase();
  const items = normalized === 'ERROR' ? (audit.errors || []) : (audit.warnings || []);
  const title = normalized === 'ERROR' ? 'Calendar Audit Errors' : 'Calendar Audit Warnings';
  const emptyText = normalized === 'ERROR'
    ? 'No blocking Calendar audit errors require attention.'
    : 'No Calendar audit warnings require review.';

  const body = items.length
    ? items.map(function (item, index) {
        const resolution = item.resolution || {};
        const deletion = item.reviewType === 'DELETION_CANDIDATE';
        const actions = [];
        if (resolution.type && resolution.type !== 'NONE') {
          actions.push(
            '<button class="guided" data-label="' + escapePmosAuditReviewHtml_(resolution.label) + '" ' +
            'onclick="runResolution(this,' + index + ')">' +
            escapePmosAuditReviewHtml_(resolution.label) + '</button>'
          );
        }
        if (deletion) {
          actions.push(
            '<button class="delete" data-label="Approve This Deletion" ' +
            'onclick="approveDeletion(this,' + index + ')">Approve This Deletion</button>'
          );
        }

        return '<div class="item ' + escapePmosAuditReviewHtml_(normalized.toLowerCase()) + '">' +
          '<div class="heading">' + escapePmosAuditReviewHtml_(item.title) + '</div>' +
          '<div class="details">' + escapePmosAuditReviewHtml_(item.details) + '</div>' +
          (item.layer ? '<div class="meta">Route: ' + escapePmosAuditReviewHtml_(item.layer) + '</div>' : '') +
          (item.seriesKey ? '<div class="meta">Series: ' + escapePmosAuditReviewHtml_(item.seriesKey) + '</div>' : '') +
          (resolution.explanation ? '<div class="recommendation">' + escapePmosAuditReviewHtml_(resolution.explanation) + '</div>' : '') +
          (actions.length ? '<div class="row-actions">' + actions.join('') + '</div>' : '') +
          '<div class="action-status" id="action-status-' + index + '"></div>' +
          '</div>';
      }).join('')
    : '<div class="empty">' + escapePmosAuditReviewHtml_(emptyText) + '</div>';

  const itemJson = JSON.stringify(items).replace(/</g, '\\u003c');
  const script = '<script>' +
    'var issues=' + itemJson + ';' +
    'function status(i,text){document.getElementById("action-status-"+i).textContent=text||"";}' +
    'function startButton(button,text){button.disabled=true;button.classList.add("opening");button.textContent=text;}' +
    'function resetButton(button){button.disabled=false;button.classList.remove("opening");button.textContent=button.getAttribute("data-label");}' +
    'function returnToAudit(){google.script.run.withFailureHandler(function(e){alert(e&&e.message?e.message:String(e));}).showCalendarAuditTaskWindow();}' +
    'function runResolution(button,i){var issue=issues[i],resolution=issue.resolution||{};startButton(button,"Opening "+(resolution.label||"action")+"…");status(i,"Opening…");' +
      'google.script.run.withSuccessHandler(function(result){button.textContent="Opened";status(i,result&&result.message?result.message:"Opened successfully.");setTimeout(function(){resetButton(button);},800);})' +
      '.withFailureHandler(function(e){resetButton(button);status(i,e&&e.message?e.message:String(e));})' +
      '.performPmosCalendarAuditResolution(resolution.type,issue);}' +
    'function approveDeletion(button,i){var issue=issues[i];if(!confirm("Approve deletion of this recurring Calendar series?"))return;startButton(button,"Approving…");status(i,"Saving deletion approval…");' +
      'google.script.run.withSuccessHandler(function(){button.textContent="Approved";status(i,"Deletion approved. Run Calendar Plan Audit again before syncing.");})' +
      '.withFailureHandler(function(e){resetButton(button);status(i,e&&e.message?e.message:String(e));})' +
      '.approveSinglePmosCalendarDeletion(' + JSON.stringify(audit.planId) + ',issue);}' +
    '</script>';

  const html = HtmlService.createHtmlOutput(buildPmosAuditReviewHtml_(
    title,
    body,
    '<button onclick="returnToAudit()">Close</button>',
    script
  )).setWidth(800).setHeight(690);

  SpreadsheetApp.getUi().showModalDialog(html, title);
  return { count: items.length, planId: audit.planId, severity: normalized };
}

function performPmosCalendarAuditResolution(resolutionType, issue) {
  const type = String(resolutionType || '').toUpperCase();
  if (type === 'DELETIONS') {
    showCalendarDeletionReview();
    return { opened: true, message: 'Suggested Deletions opened.' };
  }
  if (type === 'CUSTOMER_SYNC') {
    openPmosJobEngine('CUSTOMER_SYNC');
    return { opened: true, message: 'Customer Database Sync opened.' };
  }
  if (type === 'UPDATE_PMOS') {
    showUpdateCenter();
    return { opened: true, message: 'Update PMOS opened.' };
  }
  if (type === 'TRANSACTION_RECOVERY') {
    showCalendarTransactionRecoveryReview();
    return { opened: true, message: 'Transaction Recovery Review opened.' };
  }
  if (type === 'ROUTES_SHEET') {
    return activatePmosAuditSourceSheet_(PMOS.ROUTES_SHEET, issue);
  }
  if (type === 'SETTINGS_SHEET') {
    return activatePmosAuditSourceSheet_(PMOS.SETTINGS_SHEET, issue);
  }
  throw new Error('No guided correction action is available for this issue.');
}

function activatePmosAuditSourceSheet_(sheetName, issue) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(String(sheetName || ''));
  if (!sheet) throw new Error('Required sheet was not found: ' + sheetName + '.');
  sheet.activate();
  return {
    opened: true,
    message: String(sheetName) + ' selected. Close this review window to edit it.',
    issueId: String(issue && issue.id || '')
  };
}

function approveSinglePmosCalendarDeletion(planId, item) {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  if (String(planId || '') !== String(audit.planId || '')) {
    throw new Error('Calendar data changed. Run Calendar Plan Audit again before approving deletions.');
  }
  const key = String(item && item.seriesKey || '');
  const candidate = (audit.deletionCandidates || []).find(function (entry) {
    return String(entry.seriesKey || '') === key;
  });
  if (!candidate) throw new Error('This series is not a current deletion candidate.');
  return savePmosCalendarReviewDecision(
    audit.planId,
    'DELETION_CANDIDATE',
    'DELETE',
    candidate
  );
}

function showCalendarDeletionReview() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  const items = audit.deletionCandidates || [];
  const decisions = readPmosCalendarReviewDecisions_();
  const selected = {};

  items.forEach(function (item) {
    const key = 'DELETION_CANDIDATE::' + String(item.seriesKey || '');
    selected[item.seriesKey] = Boolean(
      decisions[key] &&
      decisions[key].planId === audit.planId &&
      decisions[key].decision === 'DELETE'
    );
  });

  const body = items.length
    ? '<div class="instructions">All events are kept by default. Select only the recurring series that should be deleted.</div>' +
      '<div class="bulk-toolbar">' +
        '<label class="bulk-toggle"><input type="checkbox" id="toggleAll"><span id="toggleAllLabel">Select all</span></label>' +
        '<span id="selectionCount">0 selected</span>' +
      '</div>' +
      items.map(function (item, index) {
        const checked = selected[item.seriesKey] ? ' checked' : '';
        return '<label class="item warning selectable" for="delete-' + index + '">' +
          '<input class="delete-check" type="checkbox" id="delete-' + index + '" data-index="' + index + '"' + checked + '>' +
          '<span><span class="heading">' + escapePmosAuditReviewHtml_(item.title || item.seriesKey) + '</span>' +
          '<span class="details">' + escapePmosAuditReviewHtml_(item.reason) + '</span>' +
          (item.layer ? '<span class="meta">Route: ' + escapePmosAuditReviewHtml_(item.layer) + '</span>' : '') +
          '<span class="meta">Series: ' + escapePmosAuditReviewHtml_(item.seriesKey) + '</span></span>' +
          '</label>';
      }).join('')
    : '<div class="empty">No Calendar series are currently suggested for deletion.</div>';

  const itemJson = JSON.stringify(items).replace(/</g, '\\u003c');
  const footer = items.length
    ? '<button id="approveButton" class="delete" onclick="approveSelected(this)">Approve selected deletions</button>' +
      '<button onclick="returnToAudit()">Close</button>'
    : '<button onclick="returnToAudit()">Close</button>';
  const script = '<script>' +
    'var candidates=' + itemJson + ';' +
    'function boxes(){return Array.prototype.slice.call(document.querySelectorAll(".delete-check"));}' +
    'function selectedIndexes(){return boxes().filter(function(x){return x.checked;}).map(function(x){return Number(x.getAttribute("data-index"));});}' +
    'function allSelected(){var list=boxes();return list.length>0&&list.every(function(x){return x.checked;});}' +
    'function updateBulkControl(){var list=boxes(),selected=selectedIndexes().length,control=document.getElementById("toggleAll"),label=document.getElementById("toggleAllLabel");if(!control||!label)return;var all=selected===list.length&&list.length>0;control.checked=all;control.indeterminate=selected>0&&!all;label.textContent=all?"Clear all":"Select all";document.getElementById("selectionCount").textContent=selected+" selected";}' +
    'function toggleAll(event){event.preventDefault();var shouldSelect=!allSelected();boxes().forEach(function(x){x.checked=shouldSelect;});updateBulkControl();}' +
    'function returnToAudit(){google.script.run.withFailureHandler(function(e){alert(e&&e.message?e.message:String(e));}).showCalendarAuditTaskWindow();}' +
    'boxes().forEach(function(x){x.addEventListener("change",updateBulkControl);});' +
    'var bulk=document.getElementById("toggleAll");if(bulk)bulk.addEventListener("click",toggleAll);updateBulkControl();' +
    'function approveSelected(button){var indexes=selectedIndexes();if(!indexes.length){alert("No deletions are selected.");return;}' +
      'if(!confirm("Approve deletion of "+indexes.length+" selected recurring Calendar series?"))return;' +
      'button.disabled=true;button.classList.add("opening");button.textContent="Approving…";' +
      'var selectedItems=indexes.map(function(i){return candidates[i];});' +
      'google.script.run.withSuccessHandler(function(result){button.textContent="Approved "+String(result.approvedCount||0);setTimeout(function(){returnToAudit();},700);})' +
      '.withFailureHandler(function(e){button.disabled=false;button.classList.remove("opening");button.textContent="Approve selected deletions";alert(e&&e.message?e.message:String(e));})' +
      '.saveSelectedPmosCalendarDeletions(' + JSON.stringify(audit.planId) + ',selectedItems);}' +
    '</script>';

  const html = HtmlService.createHtmlOutput(buildPmosAuditReviewHtml_(
    'Suggested Calendar Deletions', body, footer, script
  )).setWidth(800).setHeight(700);

  SpreadsheetApp.getUi().showModalDialog(html, 'Suggested Calendar Deletions');
  return { count: items.length, planId: audit.planId };
}

function saveSelectedPmosCalendarDeletions(planId, selectedItems) {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  if (String(planId || '') !== String(audit.planId || '')) {
    throw new Error('Calendar data changed. Run the Plan Audit again before approving deletions.');
  }

  const candidates = {};
  (audit.deletionCandidates || []).forEach(function (item) {
    candidates[String(item.seriesKey || '')] = item;
  });

  const selectedKeys = {};
  (selectedItems || []).forEach(function (item) {
    const key = String(item && item.seriesKey || '');
    if (!key || !candidates[key]) {
      throw new Error('A selected deletion is not part of the current audited plan.');
    }
    selectedKeys[key] = true;
  });

  Object.keys(candidates).forEach(function (seriesKey) {
    savePmosCalendarReviewDecision(
      audit.planId,
      'DELETION_CANDIDATE',
      selectedKeys[seriesKey] ? 'DELETE' : 'KEEP',
      candidates[seriesKey]
    );
  });

  return {
    saved: true,
    approvedCount: Object.keys(selectedKeys).length,
    keptCount: Object.keys(candidates).length - Object.keys(selectedKeys).length,
    planId: audit.planId
  };
}

function savePmosCalendarReviewDecision(planId, reviewType, decision, item) {
  const normalizedDecision = String(decision || '').trim().toUpperCase();
  if (['KEEP', 'DELETE', 'IGNORE'].indexOf(normalizedDecision) < 0) {
    throw new Error('Unsupported Calendar review decision: ' + normalizedDecision + '.');
  }

  const record = item || {};
  const seriesKey = String(record.seriesKey || '').trim();
  if (!seriesKey) throw new Error('Calendar review decision is missing its series key.');

  const sheet = ensurePmosCalendarReviewSheet_();
  const reviewKey = String(reviewType || 'REVIEW') + '::' + seriesKey;
  const values = sheet.getDataRange().getValues();
  let rowNumber = 0;
  for (let index = 1; index < values.length; index++) {
    if (String(values[index][0] || '') === reviewKey) {
      rowNumber = index + 1;
      break;
    }
  }

  const row = [
    reviewKey, String(planId || ''), String(reviewType || ''), normalizedDecision,
    seriesKey, String(record.eventId || record.seriesId || ''),
    String(record.title || ''), String(record.reason || record.details || ''), new Date()
  ];
  if (rowNumber) sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  return { saved: true, reviewKey: reviewKey, decision: normalizedDecision };
}

function readPmosCalendarReviewDecisions_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_CALENDAR_REVIEW_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const values = sheet.getDataRange().getValues();
  const result = {};
  values.slice(1).forEach(function (row) {
    const key = String(row[0] || '');
    if (!key) return;
    result[key] = {
      reviewKey: key, planId: String(row[1] || ''), reviewType: String(row[2] || ''),
      decision: String(row[3] || ''), seriesKey: String(row[4] || ''),
      calendarEventId: String(row[5] || ''), title: String(row[6] || ''),
      details: String(row[7] || ''),
      updatedAt: row[8] instanceof Date ? row[8].toISOString() : String(row[8] || '')
    };
  });
  return result;
}

function ensurePmosCalendarReviewSheet_() {
  const spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getSheetByName(PMOS_CALENDAR_REVIEW_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(PMOS_CALENDAR_REVIEW_SHEET);
    sheet.getRange(1, 1, 1, PMOS_CALENDAR_REVIEW_HEADERS.length)
      .setValues([PMOS_CALENDAR_REVIEW_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.hideSheet();
    return sheet;
  }
  const headers = sheet.getRange(1, 1, 1, PMOS_CALENDAR_REVIEW_HEADERS.length)
    .getValues()[0].map(function (value) { return String(value || '').trim(); });
  const valid = PMOS_CALENDAR_REVIEW_HEADERS.every(function (header, index) {
    return headers[index] === header;
  });
  if (!valid) throw new Error(PMOS_CALENDAR_REVIEW_SHEET + ' has an unexpected schema.');
  return sheet;
}

function buildPmosAuditReviewHtml_(title, body, footer, extraScript) {
  return '<!DOCTYPE html><html><head><base target="_top"><style>' +
    'body{font-family:Arial,sans-serif;padding:18px;color:#1f2937;background:#f8fafc}' +
    'h2{margin:0 0 14px}.instructions{padding:10px 12px;background:#dbeafe;color:#1e3a8a;border-radius:8px;margin-bottom:12px}' +
    '.bulk-toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:10px 12px;margin:0 0 10px;background:#fff7d6;border:1px solid #e5b748;border-radius:9px;box-shadow:0 2px 6px rgba(15,23,42,.08)}' +
    '.bulk-toggle{display:flex;align-items:center;gap:7px;font-weight:700;cursor:pointer}.bulk-toggle input{width:16px;height:16px}.bulk-toolbar #selectionCount{margin-left:auto;font-weight:700;color:#7c2d12}' +
    '.item{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:10px 0}' +
    '.selectable{display:grid;grid-template-columns:24px 1fr;gap:10px;cursor:pointer}.selectable input{margin-top:3px}.selectable span{display:block}' +
    '.error{border-left:5px solid #dc2626}.warning{border-left:5px solid #d97706}.info{border-left:5px solid #2563eb}' +
    '.heading{font-weight:700}.details{margin-top:6px;white-space:pre-wrap}.meta{margin-top:5px;color:#64748b;font-size:12px}' +
    '.recommendation{margin-top:9px;padding:8px 10px;background:#eff6ff;color:#1e3a8a;border-radius:7px;font-size:13px}' +
    '.row-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.action-status{margin-top:7px;font-size:12px;font-weight:700;color:#475569}' +
    'button{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer;transition:background .15s,color .15s}.guided{background:#dbeafe;color:#1e3a8a}.secondary{background:#e2e8f0;color:#1f2937}.delete{background:#fee2e2;color:#991b1b}.opening{background:#b45309!important;color:#fff!important}' +
    '.footer{position:sticky;bottom:0;background:#f8fafc;padding-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.footer span{margin-right:auto}.empty{padding:16px;background:#fff;border-radius:10px}' +
    'button:disabled{opacity:.7;cursor:default}' +
    '</style></head><body><h2>' + escapePmosAuditReviewHtml_(title) + '</h2>' + body +
    '<div class="footer">' + footer + '</div>' + (extraScript || '') + '</body></html>';
}

function escapePmosAuditReviewHtml_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
  });
}
