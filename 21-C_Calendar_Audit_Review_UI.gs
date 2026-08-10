/**
 * Calendar Plan Audit error/warning review UI and shared review styling.
 *
 * The audit remains read-only. Review decisions are owned by the current
 * Review Session engine and exception review windows.
 */

function showCalendarAuditErrorsReview() {
  return showPmosCalendarAuditIssueReview_('ERROR');
}

function showCalendarAuditWarningsReview() {
  return showPmosCalendarAuditIssueReview_('WARNING');
}

function showPmosCalendarAuditIssueReview_(severity) {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  const normalized = String(severity || '').toUpperCase();
  const items = normalized === 'ERROR' ? (audit.errors || []) : (audit.warnings || []);
  const title = normalized === 'ERROR' ? 'Calendar Audit Errors' : 'Calendar Audit Warnings';
  const emptyText = normalized === 'ERROR'
    ? 'No Calendar audit errors require attention.'
    : 'No Calendar audit warnings require review.';

  const body = items.length
    ? items.map(function (item, index) {
        const resolution = item.resolution || {};
        const actions = [];
        if (resolution.type && resolution.type !== 'NONE') {
          actions.push(
            '<button class="guided" data-label="' + escapePmosAuditReviewHtml_(resolution.label) + '" ' +
            'onclick="runResolution(this,' + index + ')">' +
            escapePmosAuditReviewHtml_(resolution.label) + '</button>'
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
    'function runResolution(button,i){var issue=issues[i],resolution=issue.resolution||{};startButton(button,"Opening "+(resolution.label||"action")+"…");status(i,"Opening…");' +
      'google.script.run.withSuccessHandler(function(result){button.textContent="Opened";status(i,result&&result.message?result.message:"Opened successfully.");setTimeout(function(){resetButton(button);},800);})' +
      '.withFailureHandler(function(e){resetButton(button);status(i,e&&e.message?e.message:String(e));})' +
      '.performPmosCalendarAuditResolution(resolution.type,issue);}' +
    '</script>';

  const html = HtmlService.createHtmlOutput(buildPmosAuditReviewHtml_(
    title,
    body,
    '<button onclick="google.script.host.close()">Close</button>',
    script
  )).setWidth(800).setHeight(690);

  SpreadsheetApp.getUi().showModalDialog(html, title);
  return { count: items.length, planId: audit.planId, severity: normalized };
}

function performPmosCalendarAuditResolution(resolutionType, issue) {
  const type = String(resolutionType || '').toUpperCase();
  if (type === 'DELETIONS') {
    showCalendarDeletionExceptionsReview();
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

function buildPmosAuditReviewHtml_(title, body, footer, extraScript) {
  return '<!DOCTYPE html><html><head><base target="_top"><style>' +
    'body{font-family:Arial,sans-serif;padding:18px;color:#1f2937;background:#f8fafc}' +
    'h2{margin:0 0 14px}.instructions{padding:10px 12px;background:#dbeafe;color:#1e3a8a;border-radius:8px;margin-bottom:12px}' +
    '.bulk-toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:10px 12px;margin:0 0 10px;background:#eff6ff;border:1px solid #93c5fd;border-radius:9px;box-shadow:0 2px 6px rgba(15,23,42,.08);transition:background .15s,border-color .15s}' +
    '.bulk-toolbar.partial{background:#dbeafe;border-color:#60a5fa}.bulk-toolbar.all{background:#bfdbfe;border-color:#3b82f6}' +
    '.bulk-toggle{display:flex;align-items:center;gap:7px;font-weight:700;cursor:pointer;color:#1e3a8a}.bulk-toggle input{width:16px;height:16px;accent-color:#2563eb;pointer-events:none}.bulk-toolbar #selectionCount{margin-left:auto;font-weight:700;color:#1e3a8a}' +
    '.item{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:10px 0}' +
    '.selectable{display:grid;grid-template-columns:24px 1fr;gap:10px;cursor:pointer}.selectable input{margin-top:3px}.selectable span{display:block}' +
    '.error{border-left:5px solid #dc2626}.warning{border-left:5px solid #d97706}.info{border-left:5px solid #2563eb}' +
    '.heading{font-weight:700}.details{margin-top:6px;white-space:pre-wrap}.meta{margin-top:5px;color:#64748b;font-size:12px}' +
    '.recommendation{margin-top:9px;padding:8px 10px;background:#eff6ff;color:#1e3a8a;border-radius:7px;font-size:13px}' +
    '.row-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.action-status{margin-top:7px;font-size:12px;font-weight:700;color:#475569}' +
    'button{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer;transition:background .15s,color .15s}.guided{background:#dbeafe;color:#1e3a8a}.secondary{background:#e2e8f0;color:#1f2937}.delete{background:#fee2e2;color:#991b1b}.opening{background:#fff1b8!important;color:#c45f5f!important}' +
    '.footer{position:sticky;bottom:0;background:#f8fafc;padding-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.footer span{margin-right:auto}.empty{padding:16px;background:#fff;border-radius:10px}' +
    'button:disabled{opacity:.88;cursor:default}' +
    '</style></head><body><h2>' + escapePmosAuditReviewHtml_(title) + '</h2>' + body +
    '<div class="footer">' + footer + '</div>' + (extraScript || '') + '</body></html>';
}

function escapePmosAuditReviewHtml_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
  });
}
