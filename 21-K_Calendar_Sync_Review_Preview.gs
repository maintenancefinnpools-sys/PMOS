/**
 * Calendar Sync preview for an approved Calendar Review Session.
 *
 * This window is intentionally read-only until the dedicated reviewed-event
 * executor is connected. It makes the complete approved plan visible without
 * allowing the recurring-series executor to ignore reviewed event actions.
 */
function openReviewedCalendarSyncPreview() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  if (!audit.reviewComplete) {
    throw new Error('Calendar review is not complete. Finish all review items before opening Calendar Sync.');
  }

  const preview = audit.preview || previewPmosCalendarSyncPlan();
  const counts = preview.reviewDecisionCounts || {};
  const reviewed = (preview.reviewedActions || []).slice();
  const resolutionErrors = Number(preview.reviewResolutionErrors || 0);
  const executorPending = Boolean(preview.reviewExecutorPending);

  const reviewedRows = reviewed.length
    ? reviewed.map(function (item) {
        return '<div class="review-row ' + escapePmosSyncPreviewHtml_(String(item.reviewAction || '').toLowerCase()) + '">' +
          '<div class="review-action">' + escapePmosSyncPreviewHtml_(formatPmosReviewedActionLabel_(item.reviewAction)) + '</div>' +
          '<div class="review-title">' + escapePmosSyncPreviewHtml_(item.title || item.entityId || 'Calendar event') + '</div>' +
          (item.customerName ? '<div class="review-meta">Customer: ' + escapePmosSyncPreviewHtml_(item.customerName) + '</div>' : '') +
          '<div class="review-reason">' + escapePmosSyncPreviewHtml_(item.reason || '') + '</div>' +
        '</div>';
      }).join('')
    : '<div class="empty">No reviewed Calendar-event actions are attached to this plan.</div>';

  const blockedText = resolutionErrors > 0
    ? resolutionErrors + ' reviewed action(s) could not be resolved safely.'
    : executorPending
      ? 'Reviewed event execution support is not connected yet. The plan can be inspected, but not started.'
      : '';

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:18px;color:#1f2937}h2{margin:0 0 4px}.muted{font-size:13px;color:#64748b}.section{margin-top:15px;border:1px solid #e2e8f0;border-radius:10px;padding:13px}.section h3{margin:0 0 10px}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.metric{border:1px solid #e2e8f0;border-radius:8px;padding:9px;background:#f8fafc}.metric span{display:block;font-size:11px;color:#64748b}.metric strong{display:block;margin-top:3px;font-size:17px}.review-list{max-height:315px;overflow:auto}.review-row{border:1px solid #e2e8f0;border-left:5px solid #64748b;border-radius:9px;padding:10px;margin:8px 0}.review-row.link_customer{border-left-color:#2563eb}.review-row.register_temporary_visit{border-left-color:#d97706}.review-row.preserve_event{border-left-color:#64748b}.review-row.delete_approved_event{border-left-color:#dc2626}.review-action{font-size:11px;font-weight:900;letter-spacing:.2px}.review-title{font-weight:700;margin-top:3px}.review-meta,.review-reason{font-size:12px;color:#475569;margin-top:3px}.notice{margin-top:14px;padding:11px;border-radius:9px;background:#fef3c7;color:#92400e;font-weight:700}.actions{display:flex;gap:8px;margin-top:14px}button{border:0;border-radius:8px;padding:10px 13px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e2e8f0;color:#1f2937}button:disabled{opacity:.5;cursor:default}.empty{color:#64748b;font-size:13px}
</style></head><body>
<h2>Calendar Sync</h2><div class="muted">Approved plan for ${escapePmosSyncPreviewHtml_(preview.calendarName || '')}</div>
<div class="section"><h3>Recurring schedule changes</h3><div class="metrics">
<div class="metric"><span>Create</span><strong>${Number(preview.creates || 0)}</strong></div>
<div class="metric"><span>Update</span><strong>${Number(preview.updates || 0)}</strong></div>
<div class="metric"><span>Delete</span><strong>${Number(preview.deletes || 0)}</strong></div>
</div></div>
<div class="section"><h3>Reviewed Calendar-event actions</h3><div class="metrics">
<div class="metric"><span>Customer matches</span><strong>${Number(counts.match || 0)}</strong></div>
<div class="metric"><span>Temporary Visits</span><strong>${Number(counts.temporary || 0)}</strong></div>
<div class="metric"><span>Keep events</span><strong>${Number(counts.keep || 0)}</strong></div>
<div class="metric"><span>Approved deletions</span><strong>${Number(counts.delete || 0)}</strong></div>
<div class="metric"><span>Resolution errors</span><strong>${resolutionErrors}</strong></div>
<div class="metric"><span>Review session</span><strong>${escapePmosSyncPreviewHtml_(String(preview.reviewSessionId || '').slice(0,8) || '—')}</strong></div>
</div><div class="review-list">${reviewedRows}</div></div>
${blockedText ? '<div class="notice">' + escapePmosSyncPreviewHtml_(blockedText) + '</div>' : ''}
<div class="actions"><button class="primary" ${executorPending || resolutionErrors ? 'disabled' : ''} onclick="startSync(this)">Start Calendar Sync</button><button class="secondary" onclick="google.script.host.close()">Close</button></div>
<script>
function startSync(button){button.disabled=true;button.textContent='Opening…';google.script.run.withSuccessHandler(function(){google.script.host.close();}).withFailureHandler(function(e){button.disabled=false;button.textContent='Start Calendar Sync';alert(e&&e.message?e.message:String(e));}).openPmosJobEngine('CALENDAR_SYNC');}
</script></body></html>`).setWidth(860).setHeight(720);

  SpreadsheetApp.getUi().showModalDialog(html, 'Calendar Sync');
  return {
    opened: true,
    reviewSessionId: preview.reviewSessionId || '',
    reviewedActionCount: reviewed.length,
    executorPending: executorPending,
    resolutionErrors: resolutionErrors
  };
}

function formatPmosReviewedActionLabel_(action) {
  switch (String(action || '')) {
    case 'LINK_CUSTOMER': return 'LINK TO CUSTOMER';
    case 'REGISTER_TEMPORARY_VISIT': return 'REGISTER TEMPORARY VISIT';
    case 'PRESERVE_EVENT': return 'KEEP THIS EVENT';
    case 'DELETE_APPROVED_EVENT': return 'DELETE APPROVED EVENT';
    default: return 'REVIEWED ACTION';
  }
}

function escapePmosSyncPreviewHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
