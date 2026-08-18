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
  return '<!DOCTYPE html><html><head><base target="_top">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;700;900&display=swap" rel="stylesheet"><style>' +
    '*{box-sizing:border-box}body{margin:0;padding:18px;font-family:Mulish,Arial,sans-serif;color:#293944;background:#e5eaed}' +
    'h2{margin:0 0 14px;font-weight:900}.instructions{padding:10px 12px;background:#e4f0f5;color:#0f5470;border:1px solid #bfd9e5;border-left:4px solid #017db1;border-radius:8px;margin-bottom:12px}' +
    '.bulk-toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:10px 12px;margin:0 0 10px;background:#f2f5f6;border:1px solid #d2dade;border-radius:9px;box-shadow:0 3px 10px rgba(46,56,66,.045);transition:background .15s,border-color .15s}' +
    '.bulk-toolbar.partial{background:#e4f0f5;border-color:#75c4e5}.bulk-toolbar.all{background:#d7ebf3;border-color:#017db1}' +
    '.bulk-toggle{display:flex;align-items:center;gap:7px;font-weight:700;cursor:pointer;color:#293944}.bulk-toggle input{width:14px;height:14px;margin:0;accent-color:#017db1;pointer-events:none}.bulk-toolbar #selectionCount{margin-left:auto;font-weight:700;color:#68747a}' +
    '.item{background:#f9fafb;border:1px solid #d2dade;border-radius:9px;padding:12px;margin:9px 0;box-shadow:0 3px 10px rgba(46,56,66,.045)}' +
    '.selectable{display:grid;grid-template-columns:22px 1fr;gap:9px;cursor:pointer}.selectable input{width:14px;height:14px;margin-top:3px;accent-color:#017db1}.selectable span{display:block}' +
    '.error{border-left:5px solid #a6535d}.warning{border-left:5px solid #b88735}.info{border-left:5px solid #017db1}' +
    '.heading{font-weight:900}.details{margin-top:6px;white-space:pre-wrap}.meta{margin-top:5px;color:#68747a;font-size:12px}' +
    '.recommendation{margin-top:9px;padding:8px 10px;background:#e4f0f5;color:#0f5470;border:1px solid #bfd9e5;border-radius:7px;font-size:13px}' +
    '.row-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.action-status{margin-top:7px;font-size:12px;font-weight:700;color:#68747a}' +
    'button{border:1px solid #c7d2d8;border-radius:8px;padding:9px 12px;font-family:inherit;font-weight:700;cursor:pointer;transition:background .15s,border-color .15s}.guided{background:#0f5470;color:#fff;border-color:#0f5470}.guided:hover{background:#017db1;border-color:#017db1}.secondary,button:not([class]){background:#f2f5f6;color:#293944}.delete{background:#f4e3e5;color:#843f48;border-color:#deb9be}.opening{background:#f4ead1!important;color:#765b21!important;border-color:#ddc88f!important}' +
    '.footer{position:sticky;bottom:-18px;margin:12px -18px -18px;padding:12px 18px 14px;background:#f2f5f6;border-top:1px solid #d2dade;box-shadow:0 -4px 12px rgba(46,56,66,.05);display:flex;justify-content:flex-end;gap:8px;align-items:center;flex-wrap:wrap}.footer span{margin-right:auto}.empty{padding:16px;background:#f9fafb;border:1px solid #d2dade;border-radius:9px}' +
    'button:disabled{opacity:.65;cursor:default}' +
    '</style></head><body><h2>' + escapePmosAuditReviewHtml_(title) + '</h2>' + body +
    '<div class="footer">' + footer + '</div>' + (extraScript || '') + '</body></html>';
}

function escapePmosAuditReviewHtml_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
  });
}
