/**
 * Calendar Plan Audit review UI.
 *
 * The audit remains read-only. These windows open only after the audit and let
 * the user inspect findings. Deletion decisions are saved only after an
 * explicit button press.
 */

const PMOS_CALENDAR_REVIEW_SHEET = 'Calendar Review Decisions';
const PMOS_CALENDAR_REVIEW_HEADERS = [
  'Review Key',
  'Plan ID',
  'Review Type',
  'Decision',
  'Series Key',
  'Calendar Event ID',
  'Title',
  'Details',
  'Updated At'
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
    'Calendar Audit Findings',
    body,
    '<button onclick="google.script.host.close()">Close</button>'
  )).setWidth(760).setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(html, 'Calendar Audit Findings');
  return { count: items.length, planId: audit.planId };
}

function showCalendarDeletionReview() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  const items = audit.deletionCandidates || [];
  const body = items.length
    ? items.map(function (item, index) {
        return '<div class="item warning" id="candidate-' + index + '">' +
          '<div class="heading">' + escapePmosAuditReviewHtml_(item.title || item.seriesKey) + '</div>' +
          '<div class="details">' + escapePmosAuditReviewHtml_(item.reason) + '</div>' +
          (item.layer ? '<div class="meta">Route: ' + escapePmosAuditReviewHtml_(item.layer) + '</div>' : '') +
          '<div class="meta">Series: ' + escapePmosAuditReviewHtml_(item.seriesKey) + '</div>' +
          '<div class="row-actions">' +
            '<button class="keep" onclick="decide(' + index + ',\'KEEP\')">Keep</button>' +
            '<button class="delete" onclick="confirmDelete(' + index + ')">Approve deletion</button>' +
          '</div>' +
          '<div class="decision" id="decision-' + index + '"></div>' +
          '</div>';
      }).join('')
    : '<div class="empty">No Calendar series are currently suggested for deletion.</div>';

  const itemJson = JSON.stringify(items).replace(/</g, '\\u003c');
  const footer = '<button onclick="google.script.host.close()">Close</button>';
  const script = '<script>' +
    'var candidates=' + itemJson + ';' +
    'function confirmDelete(i){if(confirm("Approve deletion of this recurring Calendar series?"))decide(i,"DELETE");}' +
    'function decide(i,decision){var item=candidates[i];var output=document.getElementById("decision-"+i);output.textContent="Saving…";' +
      'google.script.run.withSuccessHandler(function(){output.textContent=decision==="DELETE"?"Deletion approved":"Keep decision saved";})' +
      '.withFailureHandler(function(e){output.textContent=e&&e.message?e.message:String(e);})' +
      '.savePmosCalendarReviewDecision(' + JSON.stringify(audit.planId) + ',"DELETION_CANDIDATE",decision,item);}' +
    '</script>';

  const html = HtmlService.createHtmlOutput(buildPmosAuditReviewHtml_(
    'Suggested Calendar Deletions',
    body,
    footer,
    script
  )).setWidth(780).setHeight(680);

  SpreadsheetApp.getUi().showModalDialog(html, 'Suggested Calendar Deletions');
  return { count: items.length, planId: audit.planId };
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
    reviewKey,
    String(planId || ''),
    String(reviewType || ''),
    normalizedDecision,
    seriesKey,
    String(record.eventId || record.seriesId || ''),
    String(record.title || ''),
    String(record.reason || record.details || ''),
    new Date()
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
      reviewKey: key,
      planId: String(row[1] || ''),
      reviewType: String(row[2] || ''),
      decision: String(row[3] || ''),
      seriesKey: String(row[4] || ''),
      calendarEventId: String(row[5] || ''),
      title: String(row[6] || ''),
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
    'h2{margin:0 0 14px}.item{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:10px 0}' +
    '.error{border-left:5px solid #dc2626}.warning{border-left:5px solid #d97706}.info{border-left:5px solid #2563eb}' +
    '.heading{font-weight:700}.details{margin-top:6px;white-space:pre-wrap}.meta{margin-top:5px;color:#64748b;font-size:12px}' +
    '.row-actions{display:flex;gap:8px;margin-top:10px}.decision{margin-top:7px;font-size:12px;font-weight:700}' +
    'button{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}.keep{background:#e2e8f0}.delete{background:#fee2e2;color:#991b1b}' +
    '.footer{position:sticky;bottom:0;background:#f8fafc;padding-top:12px}.empty{padding:16px;background:#fff;border-radius:10px}' +
    '</style></head><body><h2>' + escapePmosAuditReviewHtml_(title) + '</h2>' + body +
    '<div class="footer">' + footer + '</div>' + (extraScript || '') + '</body></html>';
}

function escapePmosAuditReviewHtml_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
    return {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character];
  });
}
