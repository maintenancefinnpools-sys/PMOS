/**
 * Calendar Plan Audit review UI.
 *
 * The audit remains read-only. These windows open only after the audit and let
 * the user inspect findings. Deletion decisions are saved only after an
 * explicit approval of the selected items.
 */

const PMOS_CALENDAR_REVIEW_SHEET = 'Calendar Review Decisions';
const PMOS_CALENDAR_REVIEW_HEADERS = [
  'Review Key', 'Plan ID', 'Review Type', 'Decision', 'Series Key',
  'Calendar Event ID', 'Title', 'Details', 'Updated At'
];

function showCalendarAuditIssuesReview() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  const items = audit.issues || [];
  const body = items.length
    ? items.map(function (item) {
        return '<div class="item ' + escapePmosAuditReviewHtml_(item.severity.toLowerCase()) + '">' +
          '<div class="heading">' + escapePmosAuditReviewHtml_(item.severity + ' — ' + item.title) + '</div>' +
          '<div class="details">' + escapePmosAuditReviewHtml_(item.details) + '</div>' +
          (item.layer ? '<div class="meta">Route: ' + escapePmosAuditReviewHtml_(item.layer) + '</div>' : '') +
          (item.seriesKey ? '<div class="meta">Series: ' + escapePmosAuditReviewHtml_(item.seriesKey) + '</div>' : '') +
          '</div>';
      }).join('')
    : '<div class="empty">No errors or warnings require review.</div>';

  const html = HtmlService.createHtmlOutput(buildPmosAuditReviewHtml_(
    'Calendar Audit Findings', body,
    '<button onclick="google.script.host.close()">Close</button>'
  )).setWidth(760).setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(html, 'Calendar Audit Findings');
  return { count: items.length, planId: audit.planId };
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
    ? '<span id="selectionCount">0 selected</span>' +
      '<button class="delete" onclick="approveSelected()">Approve selected deletions</button>' +
      '<button onclick="google.script.host.close()">Close</button>'
    : '<button onclick="google.script.host.close()">Close</button>';
  const script = '<script>' +
    'var candidates=' + itemJson + ';' +
    'function selectedIndexes(){return Array.prototype.slice.call(document.querySelectorAll(".delete-check:checked")).map(function(x){return Number(x.getAttribute("data-index"));});}' +
    'function updateCount(){var n=selectedIndexes().length;document.getElementById("selectionCount").textContent=n+" selected";}' +
    'Array.prototype.forEach.call(document.querySelectorAll(".delete-check"),function(x){x.addEventListener("change",updateCount);});updateCount();' +
    'function approveSelected(){var indexes=selectedIndexes();if(!indexes.length){alert("No deletions are selected.");return;}' +
      'if(!confirm("Approve deletion of "+indexes.length+" selected recurring Calendar series?"))return;' +
      'var button=event.target;button.disabled=true;button.textContent="Saving…";' +
      'var items=indexes.map(function(i){return candidates[i];});' +
      'google.script.run.withSuccessHandler(function(){button.textContent="Approved";setTimeout(function(){google.script.host.close();},500);})' +
      '.withFailureHandler(function(e){button.disabled=false;button.textContent="Approve selected deletions";alert(e&&e.message?e.message:String(e));})' +
      '.saveSelectedPmosCalendarDeletions(' + JSON.stringify(audit.planId) + ',items);}' +
    '</script>';

  const html = HtmlService.createHtmlOutput(buildPmosAuditReviewHtml_(
    'Suggested Calendar Deletions', body, footer, script
  )).setWidth(780).setHeight(680);

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
    if (!key || !candidates[key]) throw new Error('A selected deletion is not part of the current audited plan.');
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
    if (String(values[index][0] || '') === reviewKey) { rowNumber = index + 1; break; }
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
    '.item{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:10px 0}' +
    '.selectable{display:grid;grid-template-columns:24px 1fr;gap:10px;cursor:pointer}.selectable input{margin-top:3px}' +
    '.selectable span{display:block}.error{border-left:5px solid #dc2626}.warning{border-left:5px solid #d97706}.info{border-left:5px solid #2563eb}' +
    '.heading{font-weight:700}.details{margin-top:6px;white-space:pre-wrap}.meta{margin-top:5px;color:#64748b;font-size:12px}' +
    'button{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}.delete{background:#fee2e2;color:#991b1b}' +
    '.footer{position:sticky;bottom:0;background:#f8fafc;padding-top:12px;display:flex;gap:8px;align-items:center}.footer span{margin-right:auto}.empty{padding:16px;background:#fff;border-radius:10px}' +
    '</style></head><body><h2>' + escapePmosAuditReviewHtml_(title) + '</h2>' + body +
    '<div class="footer">' + footer + '</div>' + (extraScript || '') + '</body></html>';
}

function escapePmosAuditReviewHtml_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
  });
}
